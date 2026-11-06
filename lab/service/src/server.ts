/**
 * The compile service's HTTP front: POST /compile, reached only through the
 * site's Pages Function, which adds the shared secret and the client's IP.
 *
 *   200 application/wasm, gzip-encoded, with X-Lab-Diagnostics   compiled
 *   422 { diagnostics }                                          compile errors
 *   503 { resting: 'month' | 'day' }                             the allowance is spent
 *   429 { limit: 'visitor' | 'ip' }                              over a rate limit
 *   401                                                          no secret, or the wrong one
 *
 * Every compile is reserved with the usage store first and settled after it.
 * Run with Node 24: node src/server.ts. LAB_SECRET is required; PORT defaults to 8080.
 * With GOOGLE_CLOUD_PROJECT set the service counts in that project's Firestore,
 * and without it in memory.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { compile as compileSource, COMPILE_LIMITS, type CompileOptions, type CompileResult } from './compile.ts';
import { MAIN_FILE, type Diagnostic } from './diagnostics.ts';
import { firestoreStore, memoryStore, type UsageStore } from './usage.ts';

/** The Pages Function caps a source at 200 KB; the body may add JSON escaping and the visitor id. */
export const MAX_BODY_BYTES = 512 * 1024;
export const MAX_SOURCE_BYTES = 200 * 1024;
/** Cloud Run allows 2 concurrent requests per instance, one per vCPU. */
export const CONCURRENCY = 2;
/** The X-Lab-Diagnostics header's largest value. */
export const DIAGNOSTICS_HEADER_BYTES = 8 * 1024;
/** How long a client may take to send its headers, and its whole request. */
export const HEADERS_TIMEOUT_MS = 10_000;
export const REQUEST_TIMEOUT_MS = 30_000;

export interface ServiceOptions {
  secret: string;
  /** Where compiles are counted; a fresh memory store when left out. */
  usage?: UsageStore;
  compile?: (source: string, opts: CompileOptions) => Promise<CompileResult>;
  limits?: CompileOptions;
  concurrency?: number;
}

/** Lets `size` callers through at once; the rest wait their turn. */
export class Semaphore {
  size: number;
  active = 0;
  waiting: (() => void)[] = [];
  constructor(size: number) {
    this.size = size;
  }
  async acquire(): Promise<() => void> {
    if (this.active >= this.size) await new Promise<void>((go) => this.waiting.push(go));
    this.active++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active--;
      this.waiting.shift()?.();
    };
  }
}

const digest = (s: string) => createHash('sha256').update(s, 'utf8').digest();

/** Compares in constant time; hashing first makes the lengths equal. */
export function secretMatches(given: string | undefined, secret: string): boolean {
  if (typeof given !== 'string' || !secret) return false;
  return timingSafeEqual(digest(given), digest(secret));
}

const toBase64Url = (s: string) => Buffer.from(s, 'utf8').toString('base64url');

/**
 * The diagnostics as base64url JSON, at most `max` bytes. When they don't fit,
 * the last ones give way to a note that says how many were left out.
 */
export function encodeDiagnostics(diagnostics: Diagnostic[], max = DIAGNOSTICS_HEADER_BYTES): string {
  const full = toBase64Url(JSON.stringify(diagnostics));
  if (full.length <= max) return full;

  const noteFor = (keep: number): Diagnostic => {
    const left = diagnostics.length - keep;
    return {
      file: MAIN_FILE,
      line: diagnostics[keep - 1]?.line ?? 1,
      col: 1,
      severity: 'note',
      message: `${left} more message${left === 1 ? ' was' : 's were'} left out.`,
    };
  };
  const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf8');
  // base64url has no padding: 4 characters for every 3 bytes, rounded up.
  const encoded = (n: number) => Math.ceil((n * 4) / 3);

  // before[k] is the size of the first k diagnostics as JSON, with the commas after them.
  const before = [0];
  for (const d of diagnostics) before.push(before[before.length - 1] + bytes(d) + 1);
  for (let keep = diagnostics.length - 1; keep >= 0; keep--) {
    // "[", the kept diagnostics and their commas, the note, "]".
    if (encoded(before[keep] + bytes(noteFor(keep)) + 2) <= max) {
      return toBase64Url(JSON.stringify([...diagnostics.slice(0, keep), noteFor(keep)]));
    }
  }
  return toBase64Url('[]');
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
  });
  res.end(text);
}

class TooLarge extends Error {}

function readBody(req: IncomingMessage, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let ended = false;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > max) {
        reject(new TooLarge());
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      ended = true;
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
    req.on('aborted', () => reject(new Error('The client went away.')));
    req.on('close', () => {
      if (!ended) reject(new Error('The client went away.'));
    });
  });
}

const header = (req: IncomingMessage, name: string): string | undefined => {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
};

const VISITOR = /^[A-Za-z0-9_-]{1,64}$/;
/** What a request that failed inside the service answers, with 500. */
const INTERNAL_ERROR = { error: 'internal' };

export function createService(options: ServiceOptions): Server {
  const usage = options.usage ?? memoryStore();
  const compile = options.compile ?? compileSource;
  const limits = options.limits ?? COMPILE_LIMITS;
  const slots = new Semaphore(options.concurrency ?? CONCURRENCY);
  // A settle that fails is logged: the response still goes out.
  const settleQuietly = (input: { bytes: number; ms: number; now: Date }) =>
    usage.settle(input).catch((e: unknown) => {
      console.error('settle failed:', e instanceof Error ? e.message : e);
    });

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const path = (req.url ?? '').split('?')[0];
    if (path !== '/compile') return sendJson(res, 404, { error: 'not-found' });
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'method' });
    }
    if (!secretMatches(header(req, 'x-lab-secret'), options.secret)) return sendJson(res, 401, { error: 'secret' });

    const ip = header(req, 'x-lab-client-ip')?.trim() ?? '';
    if (!ip) return sendJson(res, 400, { error: 'client-ip' });

    let body: unknown;
    try {
      body = JSON.parse(await readBody(req, MAX_BODY_BYTES));
    } catch (e) {
      if (e instanceof TooLarge) return sendJson(res, 413, { error: 'too-large' });
      return sendJson(res, 400, { error: 'body' });
    }
    const { source, visitor } = (body ?? {}) as { source?: unknown; visitor?: unknown };
    if (typeof source !== 'string' || typeof visitor !== 'string' || !VISITOR.test(visitor)) {
      return sendJson(res, 400, { error: 'body' });
    }
    if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) return sendJson(res, 413, { error: 'too-large' });

    // A client that goes away stops its compile, so the slot frees at once. This
    // listens before the reserve, so a client that leaves during it is caught too.
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) abort.abort();
    });
    // A client that left as its body ended closes on a later turn of the event loop. On
    // Linux its close is only read in the next poll phase, so this waits through one (the
    // timer) before the check (the immediate). Waiting means a client gone costs no reserve.
    await new Promise((go) => setTimeout(go, 0));
    await new Promise((go) => setImmediate(go));
    if (req.socket.destroyed || abort.signal.aborted) return;
    const reservation = await usage.reserve({ visitor, ip, now: new Date() });
    if (!reservation.ok) {
      const { reason } = reservation;
      if (reason === 'month' || reason === 'day') return sendJson(res, 503, { resting: reason });
      return sendJson(res, 429, { limit: reason });
    }

    const release = await slots.acquire();
    let result: CompileResult | null = null;
    const started = performance.now();
    let failure: { error: unknown } | null = null;
    try {
      if (!abort.signal.aborted) result = await compile(source, { ...limits, signal: abort.signal });
    } catch (error) {
      failure = { error };
    } finally {
      release();
    }
    if (failure) {
      // A compile that throws still used the CPU it ran for, and the 500 still goes out: the
      // month counts both. The reserve has already charged the rate windows, so only the month
      // is written here.
      const bytes = abort.signal.aborted ? 0 : Buffer.byteLength(JSON.stringify(INTERNAL_ERROR));
      await settleQuietly({ bytes, ms: performance.now() - started, now: new Date() });
      throw failure.error;
    }
    if (!result) return;

    // The month counts what the response sends: the body, and the diagnostics header.
    let send: () => void;
    let bytes: number;
    if (result.ok) {
      const gz = gzipSync(result.module);
      const diagnostics = encodeDiagnostics(result.diagnostics);
      bytes = gz.length + diagnostics.length;
      send = () => {
        res.writeHead(200, {
          'Content-Type': 'application/wasm',
          'Content-Encoding': 'gzip',
          'Content-Length': gz.length,
          'Cache-Control': 'no-store',
          'X-Lab-Diagnostics': diagnostics,
        });
        res.end(gz);
      };
    } else {
      const body = { diagnostics: result.diagnostics };
      bytes = Buffer.byteLength(JSON.stringify(body));
      send = () => sendJson(res, 422, body);
    }
    if (abort.signal.aborted) bytes = 0;
    // Settled before the response ends, while Cloud Run still gives the request CPU.
    await settleQuietly({ bytes, ms: result.ms, now: new Date() });
    if (!abort.signal.aborted) send();
  };

  const server = createServer((req, res) => {
    handle(req, res).catch((e: unknown) => {
      // The message only: a stack could carry part of a student's source.
      console.error('compile request failed:', e instanceof Error ? e.message : String(e));
      if (!res.headersSent) sendJson(res, 500, INTERNAL_ERROR);
      else res.destroy();
    });
  });
  server.headersTimeout = HEADERS_TIMEOUT_MS;
  server.requestTimeout = REQUEST_TIMEOUT_MS;
  return server;
}

function main(): void {
  const secret = process.env.LAB_SECRET ?? '';
  if (!secret) {
    console.error('LAB_SECRET is not set.');
    process.exit(1);
  }
  const port = Number(process.env.PORT ?? 8080);
  const project = process.env.GOOGLE_CLOUD_PROJECT ?? '';
  const usage = project ? firestoreStore(project) : memoryStore();
  const counted = project ? `in Firestore (${project})` : 'in memory';
  createService({ secret, usage }).listen(port, () => console.log(`compile service on :${port}, counting ${counted}`));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
