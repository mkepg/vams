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
}

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

/** Thrown when a file can't be fetched: no connection, or an answer other than 200. */
export class DownloadError extends Error {}

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

async function fetchOk(fetchFn: typeof fetch, url: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetchFn(url);
  } catch {
    throw new DownloadError(`${url} couldn't be fetched`);
  }
  if (res.status !== 200 || !res.body) throw new DownloadError(`${url} answered ${res.status}`);
  return res;
}

/**
 * Fetches each file the cache lacks and keeps it, calling `progress` with the unpacked bytes
 * received so far (files already held count as received) and the total.
 */
export async function fillCompilerCache(
  cache: CacheLike,
  version: string,
  fetchFn: typeof fetch,
  progress: (received: number, total: number) => void,
): Promise<Manifest> {
  const base = runtimeBase(version);
  let manifest: Manifest | null = null;
  const held = await cache.match(base + MANIFEST);
  if (held) manifest = readManifest(await held.json().catch(() => null));
  if (!manifest) {
    const res = await fetchOk(fetchFn, base + MANIFEST);
    manifest = readManifest(await res.json().catch(() => null));
    if (!manifest) throw new DownloadError('The compiler manifest is not readable.');
  }
  const total = manifest.files.reduce((n, f) => n + f.bytes, 0);
  let received = 0;
  progress(received, total);
  for (const f of manifest.files) {
    if (await cache.match(base + f.name)) {
      received += f.bytes;
      progress(received, total);
      continue;
    }
    const res = await fetchOk(fetchFn, base + f.name);
    const reader = res.body!.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      let read: ReadableStreamReadResult<Uint8Array>;
      try {
        read = await reader.read();
      } catch {
        throw new DownloadError(`${f.name} stopped downloading`);
      }
      if (read.done) break;
      chunks.push(read.value);
      size += read.value.length;
      received += read.value.length;
      progress(Math.min(received, total), total);
    }
    if (size !== f.bytes) throw new DownloadError(`${f.name} arrived with ${size} bytes, not ${f.bytes}`);
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

/** The headers pack, a map of paths under /lab to text, as a file tree. */
export function headersTree(pack: Record<string, string>): FileTree {
  const root: FileTree = {};
  for (const [path, text] of Object.entries(pack)) {
    const parts = path.split('/');
    let dir = root;
    for (const part of parts.slice(0, -1)) {
      const next = dir[part];
      if (next === undefined) dir = dir[part] = {};
      else if (typeof next === 'object' && !(next instanceof Uint8Array)) dir = next;
      else throw new Error(`${path} runs through a file`);
    }
    dir[parts[parts.length - 1]] = text;
  }
  return root;
}
