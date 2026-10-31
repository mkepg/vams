/**
 * Compiles a student's main.cpp to a WebAssembly side module.
 *
 * Each compile gets a fresh temporary directory, removed afterwards. The tools
 * run with an empty environment (as env -i gives), with that directory as
 * their working directory, in a process group of their own, under a memory
 * limit. The compile stops at the wall-clock limit, or when the compiler's
 * messages pass the output cap. The service runs as the unprivileged user
 * lab (lab/toolchain/Dockerfile), and so do the tools.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { checkIncludes } from './includes.ts';
import { includeTrace, MAIN_FILE, rewriteDiagnostics, type Diagnostic } from './diagnostics.ts';

export interface CompileOptions {
  timeoutMs: number;
  outCapBytes: number;
  /** Aborted when nobody waits for the result any more, as when the client has gone. */
  signal?: AbortSignal;
}

export type CompileResult =
  | { ok: true; module: Uint8Array; diagnostics: Diagnostic[]; ms: number }
  | { ok: false; diagnostics: Diagnostic[]; ms: number };

/** The spec's limits: 10 seconds of wall clock and 256 KB of compiler messages. */
export const COMPILE_LIMITS: CompileOptions = { timeoutMs: 10_000, outCapBytes: 256 * 1024 };

/** Where the image keeps the bundled headers, Emscripten's sysroot and the LLVM tools. */
export const LAB_PATHS = {
  include: process.env.LAB_INCLUDE ?? '/lab/include',
  sysroot: process.env.LAB_SYSROOT ?? '/lab/sysroot',
  llvmBin: process.env.LAB_LLVM_BIN ?? '/opt/llvm/bin',
};

/** Address space for each tool, in MB. */
const MEMORY_MB = Number(process.env.LAB_MEMORY_MB ?? 1024);

/**
 * The side-module flags, word for word as lab/runtime/build.sh holds them in
 * SIDE_CC_FLAGS, SIDE_LD_FLAGS and SIDE_STRIP_FLAGS. WB-LAB-13 checks that
 * the two agree.
 */
export function sideFlags(include = LAB_PATHS.include, sysroot = LAB_PATHS.sysroot) {
  const common = [
    '-std=c++17', '-O1', '-fPIC', '-fwasm-exceptions', '-nostdinc++',
    '-isystem', include, '-isystem', `${sysroot}/include/c++/v1`,
  ];
  const llvm = [
    '-mllvm', '-combiner-global-alias-analysis=false', '-mllvm', '-wasm-enable-sjlj',
    '-mllvm', '-wasm-use-legacy-eh', '-mllvm', '-disable-lsr',
  ];
  return {
    cc: [
      '--target=wasm32-unknown-emscripten', `--sysroot=${sysroot}`, '-fvisibility=default', ...llvm,
      '-DEMSCRIPTEN', '-Xclang', '-iwithsysroot/include/fakesdl', '-Xclang', '-iwithsysroot/include/compat',
      ...common,
    ],
    ld: [
      ...llvm, '-mllvm', '-wasm-enable-eh', '-mllvm', '-exception-model=wasm', '--import-memory',
      '--strip-debug', '--export-dynamic', '--export=__wasm_call_ctors', '--export-if-defined=main',
      '--export-if-defined=__main_argc_argv', '--export-if-defined=__wasm_apply_data_relocs',
      '--experimental-pic', '--unresolved-symbols=import-dynamic', '-shared',
    ],
    strip: ['--remove-section=.debug*', '--remove-section=producers', '--remove-section=name'],
  };
}

/**
 * Flags that change only how clang reports: plain one-line diagnostics with no
 * source excerpts, no crash reproducer files, and the -H list of every header
 * it enters, which the service checks.
 */
export const REPORT_FLAGS = ['-fno-color-diagnostics', '-fno-caret-diagnostics', '-fno-crash-diagnostics', '-H'];

const fail = (line: number, col: number, message: string): Diagnostic => ({
  file: MAIN_FILE, line, col, severity: 'error', message,
});

/** True when every header clang entered is a bundled, sysroot or clang header. */
export function traceIsInside(trace: string[], paths = LAB_PATHS): boolean {
  const roots = [paths.include, paths.sysroot, posix.join(paths.llvmBin, '..', 'lib', 'clang')].map(
    (r) => posix.normalize(r).replace(/\/?$/, '/'),
  );
  return trace.every((p) => {
    if (!posix.isAbsolute(p)) return false;
    const n = posix.normalize(p);
    return roots.some((r) => n.startsWith(r));
  });
}

interface Run {
  code: number | null;
  output: string;
  trace: string[];
  timedOut: boolean;
  capped: boolean;
  aborted: boolean;
}

/** Output a run may still write before it is cut off: the budget is shared by every step of a compile. */
interface Budget {
  deadline: number;
  bytesLeft: number;
}

function run(tool: string, args: string[], cwd: string, budget: Budget, signal?: AbortSignal): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      '/bin/sh',
      ['-c', 'ulimit -v "$1" && shift && exec "$@"', 'sh', String(MEMORY_MB * 1024), tool, ...args],
      { cwd, env: {}, detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let kept = '';
    let pending = '';
    const trace: string[] = [];
    let timedOut = false;
    let capped = false;
    let aborted = false;
    let traceBytes = 0;

    const stop = () => {
      try {
        if (child.pid) process.kill(-child.pid, 'SIGKILL');
      } catch {
        // The group has already gone.
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, Math.max(0, budget.deadline - Date.now()));
    const onAbort = () => {
      aborted = true;
      stop();
    };
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort, { once: true });
    const settle = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };

    const take = (chunk: string) => {
      if (capped) return;
      pending += chunk;
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) {
        const t = includeTrace(line);
        if (t.length) {
          trace.push(...t);
          traceBytes += line.length;
          continue;
        }
        const bytes = Buffer.byteLength(line, 'utf8') + 1;
        if (bytes > budget.bytesLeft) {
          pending = line;
          break;
        }
        budget.bytesLeft -= bytes;
        kept += `${line}\n`;
      }
      // The header list is finite; this bounds it all the same.
      if (Buffer.byteLength(pending, 'utf8') > budget.bytesLeft || traceBytes > 4 * 1024 * 1024) {
        capped = true;
        stop();
      }
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('error', (e) => {
      settle();
      reject(e);
    });
    child.on('close', (code) => {
      settle();
      // Whatever the tool started in its group goes with it.
      stop();
      if (capped && pending) {
        // Keep the start of the line that passed the cap, so its place in main.cpp still shows.
        kept += `${pending.slice(0, 2000)}…\n`;
      } else if (pending && !includeTrace(pending).length) {
        kept += pending;
      }
      resolve({ code, output: kept, trace, timedOut, capped, aborted });
    });
  });
}

function stopped(r: Run, opts: CompileOptions): Diagnostic | null {
  if (r.aborted) return fail(1, 1, 'The compile was stopped.');
  if (r.timedOut) {
    const s = opts.timeoutMs / 1000;
    return fail(1, 1, `The compile took longer than ${s} second${s === 1 ? '' : 's'}, so it was stopped.`);
  }
  if (r.capped) {
    const kb = Math.round(opts.outCapBytes / 1024);
    return fail(1, 1, `The compiler's messages passed ${kb} KB, so the compile was stopped. Fix the first error and compile again.`);
  }
  return null;
}

export async function compile(source: string, opts: CompileOptions): Promise<CompileResult> {
  const started = performance.now();
  const ms = () => Math.round(performance.now() - started);

  const checked = checkIncludes(source);
  if (!checked.ok) return { ok: false, diagnostics: [fail(checked.line, checked.col, checked.message)], ms: ms() };

  const gone = (): CompileResult => ({ ok: false, diagnostics: [fail(1, 1, 'The compile was stopped.')], ms: ms() });
  if (opts.signal?.aborted) return gone();

  const dir = await mkdtemp(join(tmpdir(), 'vams-'));
  try {
    await writeFile(join(dir, MAIN_FILE), checked.source);
    const flags = sideFlags();
    const budget: Budget = { deadline: Date.now() + opts.timeoutMs, bytesLeft: opts.outCapBytes };
    const bin = (name: string) => posix.join(LAB_PATHS.llvmBin, name);

    const cc = await run(bin('clang++'), [...flags.cc, ...REPORT_FLAGS, '-c', MAIN_FILE, '-o', 'main.o'], dir, budget, opts.signal);
    if (!traceIsInside(cc.trace)) {
      return { ok: false, diagnostics: [fail(1, 1, 'This program reaches a file outside VAMS Lab\'s headers.')], ms: ms() };
    }
    const diagnostics = rewriteDiagnostics(cc.output);
    const stop = stopped(cc, opts);
    if (stop) return { ok: false, diagnostics: [...diagnostics, stop], ms: ms() };
    if (cc.code !== 0) {
      if (!diagnostics.some((d) => d.severity === 'error')) {
        diagnostics.push(fail(1, 1, 'The compiler stopped before it finished. Compile again.'));
      }
      return { ok: false, diagnostics, ms: ms() };
    }

    for (const [tool, args] of [
      ['wasm-ld', [...flags.ld, 'main.o', '-o', 'main.wasm']],
      ['llvm-objcopy', ['main.wasm', 'main.wasm', ...flags.strip]],
    ] as const) {
      const step = await run(bin(tool), [...args], dir, budget, opts.signal);
      const found = rewriteDiagnostics(step.output);
      const halt = stopped(step, opts);
      if (halt) return { ok: false, diagnostics: [...diagnostics, ...found, halt], ms: ms() };
      if (step.code !== 0) {
        if (!found.some((d) => d.severity === 'error')) found.push(fail(1, 1, 'Linking stopped before it finished. Compile again.'));
        return { ok: false, diagnostics: [...diagnostics, ...found], ms: ms() };
      }
      diagnostics.push(...found);
    }

    const module = new Uint8Array(await readFile(join(dir, 'main.wasm')));
    return { ok: true, module, diagnostics, ms: ms() };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
