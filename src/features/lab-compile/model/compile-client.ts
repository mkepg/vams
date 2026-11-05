import type { Diagnostic } from '@/shared/lib/lab-diagnostic';
import { visitorId } from './visitor';

export type CompileResult =
  | { kind: 'ok'; module: ArrayBuffer; diagnostics: Diagnostic[] }
  | { kind: 'errors'; diagnostics: Diagnostic[] }
  | { kind: 'resting'; until: 'month' | 'day' }
  | { kind: 'limited' }
  /** The service answered with something that is not a result; status 0 is a network error. */
  | { kind: 'failed'; status: number }
  | { kind: 'offline' };

export interface CompileOptions {
  signal?: AbortSignal;
  /** Called once, when the first retry is about to wait. */
  onBusy?: () => void;
  /** The clock, in milliseconds. */
  now?: () => number;
  /** Replaced by the tests; the page uses the browser's. */
  fetch?: typeof fetch;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  online?: () => boolean;
}

/** The waits before each retry of a busy answer: 60 s in all. */
export const RETRY_WAITS_MS = [1000, 2000, 4000, 8000, 16000, 29000] as const;

const ENDPOINT = '/api/compile';

function abortError(): Error {
  return new DOMException('The compile was stopped.', 'AbortError');
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

const SEVERITIES = new Set(['error', 'warning', 'note']);

/** The entries that have the shape of a diagnostic; anything else is dropped. */
function validDiagnostics(value: unknown): Diagnostic[] {
  if (!Array.isArray(value)) return [];
  const out: Diagnostic[] = [];
  for (const d of value) {
    if (!d || typeof d !== 'object') continue;
    const { line, col, severity, message } = d as Record<string, unknown>;
    if (typeof line !== 'number' || !Number.isFinite(line) || typeof col !== 'number' || !Number.isFinite(col)) continue;
    if (typeof severity !== 'string' || !SEVERITIES.has(severity) || typeof message !== 'string') continue;
    out.push({ file: 'main.cpp', line, col, severity: severity as Diagnostic['severity'], message });
  }
  return out;
}

/** The service's X-Lab-Diagnostics header: base64url of UTF-8 JSON. */
export function decodeDiagnostics(header: string | null): Diagnostic[] {
  if (!header) return [];
  try {
    const base64 = header.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)), (c) => c.charCodeAt(0));
    return validDiagnostics(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return [];
  }
}

const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d];

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await res.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Sends the source to the compile function and sorts the answer. A busy answer (Cloud Run's 429,
 * or a 503 that is not resting) is retried after 1, 2, 4, 8, 16 and 29 s; after that, or on a
 * rate limit the service names, the result is 'limited'. A stop from the caller rejects.
 */
export async function compileSource(source: string, opts: CompileOptions = {}): Promise<CompileResult> {
  const { signal, onBusy, now = Date.now, sleep = defaultSleep } = opts;
  const send = opts.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const online = opts.online ?? (() => typeof navigator === 'undefined' || navigator.onLine !== false);
  if (!online()) return { kind: 'offline' };
  const body = JSON.stringify({ source, visitor: visitorId() });
  const started = now();

  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) throw abortError();
    let res: Response;
    try {
      res = await send(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body, signal });
    } catch (err) {
      if (signal?.aborted) throw err;
      return online() ? { kind: 'failed', status: 0 } : { kind: 'offline' };
    }

    if (res.status === 200) {
      const module = await res.arrayBuffer();
      const magic = new Uint8Array(module, 0, Math.min(4, module.byteLength));
      const isWasm = (res.headers.get('content-type') ?? '').includes('application/wasm') || WASM_MAGIC.every((b, i) => magic[i] === b);
      if (!isWasm) return { kind: 'failed', status: 200 };
      return { kind: 'ok', module, diagnostics: decodeDiagnostics(res.headers.get('x-lab-diagnostics')) };
    }
    if (res.status === 422) {
      const answer = await readJson(res);
      return { kind: 'errors', diagnostics: validDiagnostics(answer.diagnostics) };
    }
    if (res.status === 413) {
      return { kind: 'errors', diagnostics: [{ file: 'main.cpp', line: 1, col: 1, severity: 'error', message: 'The source is over 200 KB.' }] };
    }

    let busy = res.status === 429 || res.status === 503;
    if (busy) {
      const answer = await readJson(res);
      if (answer.resting === 'month' || answer.resting === 'day') return { kind: 'resting', until: answer.resting };
      if (answer.offline === true) return { kind: 'offline' };
      // The service names its own rate limits; only Cloud Run's plain 429 means "wait".
      if (answer.limit !== undefined) busy = false;
    }
    if (!busy) return res.status === 429 ? { kind: 'limited' } : { kind: 'failed', status: res.status };

    const wait = RETRY_WAITS_MS[attempt];
    if (wait === undefined || now() - started > 61000) return { kind: 'limited' };
    if (attempt === 0) onBusy?.();
    await sleep(wait, signal);
  }
}
