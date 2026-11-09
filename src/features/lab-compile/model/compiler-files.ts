/**
 * The compiler's files: where a runtime version keeps them, the Cache Storage cache that holds
 * them in this browser, and the download that fills it. The compiler worker runs the download;
 * the page only asks the cache what it holds, which needs no network.
 */
import type { FileTree } from './compile';

/** Lists every file the compiler needs, with its size unpacked (`bytes`) and as stored (`stored`). */
export const MANIFEST = 'compiler-manifest.json';
/** The headers pack lab/runtime/build.sh writes. */
export const HEADERS_PACK = 'lab-headers.json';
/** The compiler's entry point, which fetches the rest beside itself. */
export const COMPILER_ENTRY = 'bundle.js';

export interface ManifestFile {
  name: string;
  bytes: number;
  stored: number;
  /** The dev server's only: when the file last changed, so an edit of the same size is noticed. */
  modified?: number;
}

/** The version the dev server serves from the local build. Its files change; a published version's never do. */
export const DEV_VERSION = 'dev';

export interface Manifest {
  files: ManifestFile[];
}

const CACHE_PREFIX = 'vams-lab-compiler-';

export const compilerCacheName = (version: string) => `${CACHE_PREFIX}${version}`;
export const runtimeBase = (version: string) => `/lab-runtime/${version}/`;

/** The parts of the Cache Storage API the loader uses, so the tests can stand in for it. */
export interface CacheLike {
  match(request: string): Promise<Response | undefined>;
  put(request: string, response: Response): Promise<void>;
}
export interface CachesLike {
  has(name: string): Promise<boolean>;
  open(name: string): Promise<CacheLike>;
  keys(): Promise<string[]>;
  delete(name: string): Promise<boolean>;
}

/** Thrown when a file can't be fetched: no connection, an answer other than 200, or a download that stalls. */
export class DownloadError extends Error {}

/** How long the download waits for an answer, and for each piece of a file, before it gives up. */
export const COMPILER_IDLE_MS = 30_000;

/** A cache held in this worker's memory: each match is a fresh answer from the same bytes. */
function memoryCache(): CacheLike {
  const files = new Map<string, { body: Blob; type: string }>();
  return {
    match: async (request) => {
      const held = files.get(request);
      return held ? new Response(held.body, { headers: { 'content-type': held.type } }) : undefined;
    },
    put: async (request, response) => {
      files.set(request, { body: await response.blob(), type: response.headers.get('content-type') ?? 'application/octet-stream' });
    },
  };
}

/**
 * The version's compiler cache. A browser with no Cache Storage, one that won't open it, or one
 * whose quota refuses a file still gets the compiler: what the cache can't keep is kept in
 * memory, for as long as the compiler worker lives, and the next visit downloads it again.
 */
export async function openCompilerCache(cachesApi: CachesLike | undefined, version: string): Promise<CacheLike> {
  const memory = memoryCache();
  let stored: CacheLike | null = null;
  try {
    stored = cachesApi ? await cachesApi.open(compilerCacheName(version)) : null;
  } catch {
    stored = null;
  }
  if (!stored) return memory;
  const cache = stored;
  return {
    match: async (request) => (await memory.match(request)) ?? (await cache.match(request).catch(() => undefined)),
    put: async (request, response) => {
      const copy = response.clone();
      try {
        await cache.put(request, response);
      } catch {
        await memory.put(request, copy);
      }
    },
  };
}

/** The manifest, if it is well formed. */
export function readManifest(value: unknown): Manifest | null {
  if (!value || typeof value !== 'object' || !Array.isArray((value as Manifest).files)) return null;
  const files = (value as Manifest).files.filter(
    (f) => f && typeof f.name === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(f.name) && Number.isFinite(f.bytes) && Number.isFinite(f.stored),
  );
  return files.length === (value as Manifest).files.length && files.length > 0 ? { files } : null;
}

/** Whether this browser holds every file of a version's compiler. It asks only the cache. */
export async function compilerCached(cachesApi: CachesLike, version: string): Promise<boolean> {
  try {
    if (!(await cachesApi.has(compilerCacheName(version)))) return false;
    const cache = await cachesApi.open(compilerCacheName(version));
    const base = runtimeBase(version);
    const stored = await cache.match(base + MANIFEST);
    const manifest = stored ? readManifest(await stored.json()) : null;
    if (!manifest) return false;
    for (const f of manifest.files) if (!(await cache.match(base + f.name))) return false;
    return true;
  } catch {
    return false;
  }
}

/** Deletes the compiler caches of every other version. */
export async function deleteOtherCompilerCaches(cachesApi: CachesLike, version: string): Promise<void> {
  try {
    const keep = compilerCacheName(version);
    for (const name of await cachesApi.keys()) if (name.startsWith(CACHE_PREFIX) && name !== keep) await cachesApi.delete(name);
  } catch {
    /* Storage that can't be read has nothing to delete. */
  }
}

const TYPES: Record<string, string> = {
  wasm: 'application/wasm',
  js: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  tar: 'application/x-tar',
};
const typeOf = (name: string) => TYPES[name.slice(name.lastIndexOf('.') + 1)] ?? 'application/octet-stream';

/** The promise, or a DownloadError with `message` when it takes longer than `ms`; `onTimeout` then cleans up. */
function within<T>(promise: Promise<T>, ms: number, message: string, onTimeout: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout();
      reject(new DownloadError(message));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function fetchOk(fetchFn: typeof fetch, url: string, idleMs: number): Promise<Response> {
  const abort = new AbortController();
  let res: Response;
  try {
    res = await within(fetchFn(url, { signal: abort.signal }), idleMs, `${url} didn't answer`, () => abort.abort());
  } catch (error) {
    if (error instanceof DownloadError) throw error;
    throw new DownloadError(`${url} couldn't be fetched`);
  }
  if (res.status !== 200 || !res.body) throw new DownloadError(`${url} answered ${res.status}`);
  return res;
}

export interface FillOptions {
  /** How long to wait for an answer, and for each piece of a file. */
  idleMs?: number;
}

/**
 * Fetches each file the cache lacks and keeps it, calling `progress` with the bytes received so
 * far and the total, both as stored. The first report already counts the files the cache holds,
 * so a cache that holds them all reports the total at once, and the page never shows a download.
 * The dev version's manifest is fetched every time, and a file whose entry changed is fetched again.
 */
export async function fillCompilerCache(
  cache: CacheLike,
  version: string,
  fetchFn: typeof fetch,
  progress: (received: number, total: number) => void,
  options: FillOptions = {},
): Promise<Manifest> {
  const idleMs = options.idleMs ?? COMPILER_IDLE_MS;
  const base = runtimeBase(version);
  const heldResponse = await cache.match(base + MANIFEST);
  const held = heldResponse ? readManifest(await heldResponse.json().catch(() => null)) : null;
  let manifest = held;
  // The dev runtime's files change as it is rebuilt, so its manifest is always asked for again.
  if (!manifest || version === DEV_VERSION) {
    let fresh: Manifest | null = null;
    try {
      const res = await fetchOk(fetchFn, base + MANIFEST, idleMs);
      fresh = readManifest(await res.json().catch(() => null));
    } catch (error) {
      if (!held) throw error;
    }
    manifest = fresh ?? held;
  }
  if (!manifest) throw new DownloadError('The compiler manifest is not readable.');
  // A published version's files never change, so any file the cache holds is kept, even from a
  // download cut short. A dev file is kept only while its entry is the one the cache was filled from.
  const unchanged = new Set((held?.files ?? []).map((f) => JSON.stringify(f)));
  const current = (f: ManifestFile) => version !== DEV_VERSION || unchanged.has(JSON.stringify(f));
  // Progress counts bytes as stored: what each file costs to fetch, not what it unpacks to.
  const total = manifest.files.reduce((n, f) => n + f.stored, 0);
  const missing: ManifestFile[] = [];
  let received = 0;
  for (const f of manifest.files) {
    if (current(f) && (await cache.match(base + f.name))) received += f.stored;
    else missing.push(f);
  }
  progress(received, total);
  for (const f of missing) {
    const res = await fetchOk(fetchFn, base + f.name, idleMs);
    const reader = res.body!.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      let read: ReadableStreamReadResult<Uint8Array>;
      try {
        read = await within(reader.read(), idleMs, `${f.name} stopped downloading`, () => void reader.cancel().catch(() => {}));
      } catch {
        throw new DownloadError(`${f.name} stopped downloading`);
      }
      if (read.done) break;
      chunks.push(read.value);
      size += read.value.length;
      // The browser unpacks as it reads, so the part of the stored size is the part of the unpacked one.
      const part = f.bytes > 0 ? Math.round((f.stored * Math.min(size, f.bytes)) / f.bytes) : f.stored;
      progress(received + part, total);
    }
    if (size !== f.bytes) throw new DownloadError(`${f.name} arrived with ${size} bytes, not ${f.bytes}`);
    received += f.stored;
    await cache.put(base + f.name, new Response(new Blob(chunks as BlobPart[]), { headers: { 'content-type': typeOf(f.name) } }));
  }
  // The manifest goes in last: a cache that holds it holds every file it lists.
  await cache.put(base + MANIFEST, new Response(JSON.stringify(manifest), { headers: { 'content-type': TYPES.json } }));
  return manifest;
}

/** A fetch that answers the version's files from the cache, and anything else from `fetchFn`. */
export function cachedFetch(cache: CacheLike, version: string, fetchFn: typeof fetch): typeof fetch {
  const base = runtimeBase(version);
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = url.startsWith('/') ? url : new URL(url).pathname;
    if (path.startsWith(base)) {
      const held = await cache.match(path);
      if (held) return held;
    }
    return fetchFn(input, init);
  }) as typeof fetch;
}

/**
 * The compiler's entry point, made to run from a blob URL: each `import.meta.url` becomes the
 * address it was fetched from, so the files it fetches beside itself are still found there, and
 * answered from the compiler's cache.
 */
export function localBundle(text: string, url: string): string {
  return text.replaceAll('import.meta.url', JSON.stringify(url));
}

/**
 * The headers pack, a map of paths under /lab to text, as a file tree. Each file is encoded to
 * UTF-8 once, here, rather than by the compiler on every compile.
 */
export function headersTree(pack: Record<string, string>): FileTree {
  const root: FileTree = {};
  const encoder = new TextEncoder();
  for (const [path, text] of Object.entries(pack)) {
    const parts = path.split('/');
    let dir = root;
    for (const part of parts.slice(0, -1)) {
      const next = dir[part];
      if (next === undefined) dir = dir[part] = {};
      else if (typeof next === 'object' && !(next instanceof Uint8Array)) dir = next;
      else throw new Error(`${path} runs through a file`);
    }
    dir[parts[parts.length - 1]] = encoder.encode(text);
  }
  return root;
}
