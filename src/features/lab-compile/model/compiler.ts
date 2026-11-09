/**
 * The page's side of the browser's compiler: whether this browser holds it, the one download,
 * and each compile, sent to the compiler worker with a time limit.
 *
 * The page downloads nothing until Run or Download now asks for it. Opening the Lab only asks
 * Cache Storage whether the files are there. A compile that passes the time limit, or a worker
 * that dies, takes the worker with it; the next compile starts a fresh one from the cache.
 */
import { create } from 'zustand';
import type { Diagnostic } from '@/shared/lib/lab-diagnostic';
import { compilerCached, deleteOtherCompilerCaches, type CachesLike } from './compiler-files';
import type { CompilerReply, CompilerRequest } from './compiler-protocol';

export type CompileResult =
  | { kind: 'ok'; module: ArrayBuffer; diagnostics: Diagnostic[] }
  | { kind: 'errors'; diagnostics: Diagnostic[] }
  /** The compiler stopped, or couldn't start. */
  | { kind: 'failed' }
  /** No connection, and the compiler isn't in this browser yet. */
  | { kind: 'offline' }
  /** The compiler's download failed. */
  | { kind: 'download' };

export interface CompileOptions {
  signal?: AbortSignal;
}

/**
 * `unknown` until the page has asked the cache. `absent`: not in this browser. `downloading`:
 * on its way, `received` of `total` unpacked bytes. `ready`: in this browser. `failed`: the last
 * download failed.
 */
export type CompilerState = 'unknown' | 'absent' | 'downloading' | 'ready' | 'failed';

export const useCompiler = create<{ state: CompilerState; received: number; total: number }>(() => ({
  state: 'unknown',
  received: 0,
  total: 0,
}));

/** The time a compile may take, from the moment it is sent. */
export const COMPILE_TIME_LIMIT_MS = 30_000;
export const TIME_LIMIT_MESSAGE = 'The compile took longer than 30 seconds, so it was stopped.';

/** What the page needs of a Worker. */
export interface CompilerWorker {
  postMessage(message: CompilerRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<CompilerReply>) => void) | null;
  onerror: ((event: Event) => void) | null;
}

interface CompilerEnv {
  createWorker: () => CompilerWorker;
  caches: () => CachesLike | undefined;
  online: () => boolean;
  timeoutMs: number;
}

const DEFAULT_ENV: CompilerEnv = {
  createWorker: () =>
    new Worker(new URL('../worker/lab-compiler.ts', import.meta.url), { type: 'module', name: 'vams-lab-compiler' }) as unknown as CompilerWorker,
  caches: () => (typeof caches === 'undefined' ? undefined : (caches as unknown as CachesLike)),
  online: () => typeof navigator === 'undefined' || navigator.onLine !== false,
  timeoutMs: COMPILE_TIME_LIMIT_MS,
};

let env: CompilerEnv = DEFAULT_ENV;

type Prepared = 'ready' | 'download' | 'offline' | 'failed';

let worker: CompilerWorker | null = null;
let prepared: Promise<Prepared> | null = null;
let nextId = 0;
const pending = new Map<number, (result: CompileResult) => void>();

/** Ends the worker and every compile waiting on it. */
function drop() {
  const w = worker;
  worker = null;
  prepared = null;
  w?.terminate();
  const waiting = [...pending.values()];
  pending.clear();
  for (const resolve of waiting) resolve({ kind: 'failed' });
}

/** Tests only: replaces parts of the environment, or with no argument, restores it and forgets everything. */
export function setCompilerEnv(partial?: Partial<CompilerEnv>) {
  drop();
  env = partial ? { ...DEFAULT_ENV, ...partial } : DEFAULT_ENV;
  nextId = 0;
  useCompiler.setState({ state: 'unknown', received: 0, total: 0 });
}

/** Asks the cache, without the network, whether this browser holds the version's compiler, and drops older versions'. */
export async function checkCompiler(version: string): Promise<void> {
  const api = env.caches();
  const held = api ? await compilerCached(api, version) : false;
  if (useCompiler.getState().state === 'unknown') useCompiler.setState({ state: held ? 'ready' : 'absent' });
  if (api) await deleteOtherCompilerCaches(api, version);
}

/** Starts the compiler, downloading it first if this browser lacks it. Every caller shares one start. */
export function downloadCompiler(version: string): Promise<Prepared> {
  if (prepared) return prepared;
  const before = useCompiler.getState().state;
  if (before !== 'ready' && !env.online()) return Promise.resolve('offline');

  const w = env.createWorker();
  worker = w;
  let settle: (outcome: Prepared) => void = () => {};
  const start = new Promise<Prepared>((resolve) => {
    let done = false;
    settle = (outcome) => {
      if (done) return;
      done = true;
      resolve(outcome);
    };
  });
  prepared = start;
  w.onmessage = (event) => {
    if (worker !== w) return;
    const m = event.data;
    if (m.type === 'progress') {
      const state = useCompiler.getState().state === 'ready' && m.received === m.total ? 'ready' : 'downloading';
      useCompiler.setState({ state, received: m.received, total: m.total });
    } else if (m.type === 'ready') {
      useCompiler.setState({ state: 'ready' });
      settle('ready');
    } else if (m.type === 'download-failed') {
      drop();
      useCompiler.setState({ state: 'failed' });
      settle(!m.network ? 'failed' : env.online() ? 'download' : 'offline');
    } else if (m.type === 'result') {
      pending.get(m.id)?.(m.result);
    }
  };
  w.onerror = () => {
    if (worker !== w) return;
    const starting = useCompiler.getState().state === 'downloading';
    drop();
    if (starting) useCompiler.setState({ state: 'failed' });
    settle('failed');
  };
  w.postMessage({ type: 'prepare', version });
  return start;
}

function abortError(): Error {
  return new DOMException('The compile was stopped.', 'AbortError');
}

/** The promise, or a rejection when the signal aborts first. What it waits on carries on. */
function unlessAborted<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

/** Compiles a program in this browser. A stop from the caller rejects; the download it started goes on. */
export async function compileSource(version: string, source: string, options: CompileOptions = {}): Promise<CompileResult> {
  const { signal } = options;
  const outcome = await unlessAborted(downloadCompiler(version), signal);
  if (outcome !== 'ready') return { kind: outcome };
  const w = worker;
  if (!w) return { kind: 'failed' };
  const id = ++nextId;
  const result = new Promise<CompileResult>((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve({ kind: 'errors', diagnostics: [{ file: 'main.cpp', line: 1, col: 1, severity: 'error', message: TIME_LIMIT_MESSAGE }] });
      if (worker === w) drop();
    }, env.timeoutMs);
    pending.set(id, (r) => {
      clearTimeout(timer);
      pending.delete(id);
      resolve(r);
    });
  });
  w.postMessage({ type: 'compile', id, source });
  return unlessAborted(result, signal);
}
