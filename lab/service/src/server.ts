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
 * Run with Node 24: node src/server.ts. LAB_SECRET is required; PORT defaults to 8080.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { compile as compileSource, COMPILE_LIMITS, type CompileOptions, type CompileResult } from './compile.ts';
import { MAIN_FILE, type Diagnostic } from './diagnostics.ts';

/** The Pages Function caps a source at 200 KB; the body may add JSON escaping and the visitor id. */
export const MAX_BODY_BYTES = 512 * 1024;
export const MAX_SOURCE_BYTES = 200 * 1024;
/** Cloud Run allows 2 concurrent requests per instance, one per vCPU. */
export const CONCURRENCY = 2;
/** The X-Lab-Diagnostics header's largest value. */
export const DIAGNOSTICS_HEADER_BYTES = 8 * 1024;

export type Admission =
  | { ok: true }
  | { ok: false; resting: 'month' | 'day' }
  | { ok: false; limit: 'visitor' | 'ip' };

/** Decides whether a compile may run. The monthly counter and the rate limits plug in here. */
export type Gate = (request: { visitor: string; ip: string }) => Promise<Admission>;

export interface ServiceOptions {
  secret: string;
  gate?: Gate;
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
  for (let keep = diagnostics.length - 1; keep >= 0; keep--) {
    const left = diagnostics.length - keep;
    const kept = diagnostics.slice(0, keep);
    const note: Diagnostic = {
      file: MAIN_FILE,
      line: kept.at(-1)?.line ?? 1,
      col: 1,
      severity: 'note',
      message: `${left} more message${left === 1 ? ' was' : 's were'} left out.`,
    };
    const value = toBase64Url(JSON.stringify([...kept, note]));
    if (value.length <= max) return value;
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
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > max) {
        reject(new TooLarge());
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const header = (req: IncomingMessage, name: string): string | undefined => {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
};

const VISITOR = /^[A-Za-z0-9_-]{1,64}$/;

export function createService(options: ServiceOptions): Server {
  const gate: Gate = options.gate ?? (async () => ({ ok: true }));
  const compile = options.compile ?? compileSource;
  const limits = options.limits ?? COMPILE_LIMITS;
  const slots = new Semaphore(options.concurrency ?? CONCURRENCY);

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

    const admission = await gate({ visitor, ip });
    if (!admission.ok) {
      if ('resting' in admission) return sendJson(res, 503, { resting: admission.resting });
      return sendJson(res, 429, { limit: admission.limit });
    }

    const release = await slots.acquire();
    let result: CompileResult;
    try {
      result = await compile(source, limits);
    } finally {
      release();
    }
    if (!result.ok) return sendJson(res, 422, { diagnostics: result.diagnostics });

    const gz = gzipSync(result.module);
    res.writeHead(200, {
      'Content-Type': 'application/wasm',
      'Content-Encoding': 'gzip',
      'Content-Length': gz.length,
      'Cache-Control': 'no-store',
      'X-Lab-Diagnostics': encodeDiagnostics(result.diagnostics),
    });
    res.end(gz);
  };

  return createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) sendJson(res, 500, { error: 'internal' });
      else res.destroy();
    });
  });
}

function main(): void {
  const secret = process.env.LAB_SECRET ?? '';
  if (!secret) {
    console.error('LAB_SECRET is not set.');
    process.exit(1);
  }
  const port = Number(process.env.PORT ?? 8080);
  createService({ secret }).listen(port, () => console.log(`compile service on :${port}`));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
