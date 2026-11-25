/**
 * The worker a student's program runs in. The page starts one for each Run and sends it `start`
 * (protocol.ts); the worker then
 *
 *   1. installs globalThis.__vamsLab, which every import of the main module's library_vams.js
 *      forwards to: the GL context, the GLUT runtime and the Console;
 *   2. imports the main module from /lab-runtime/<runtimeVersion>/;
 *   3. mounts the student's files in MEMFS, writes the side module to /main.wasm;
 *   4. takes away the globals that reach storage, the network or another script (seal-scope.ts),
 *      and calls vams_run('/main.wasm'), which runs the program's main, glutMainLoop and all.
 *
 * vams_run ends with exit(), and the main module runs its exit fully (EXIT_RUNTIME), so whichever
 * way the program ends, its static destructors run and stdio flushes every stream: what it
 * printed is in the output ring and what it wrote is in its files. The worker then posts the files
 * still open for writing, and `exit` with the code; a trap, an abort or a runtime that won't load
 * posts `crash` with its message. A C++ exception that nothing caught first prints libstdc++'s
 * "terminate called" lines, as on a lab PC. If that post fails, it posts `crash` as a last resort. The
 * worker never stops a program itself: the page terminates the worker.
 */
import type { GLContext, RasterPool } from '@/shared/lib/gl-raster';
import { ABORTED, UNCAUGHT_EXCEPTION } from '../model/crash-words';
import type { PageMessage, StartMessage, WorkerMessage } from '../model/protocol';
import { runtimeVersion } from '../model/runtime-version';
import { openLayout } from '../model/shared-layout';
import { ConsoleIO } from './console-io';
import { atomicsHost } from './event-queue';
import { GlutRuntime, type ProgramMemory } from './glut-runtime';
import { helperCount, startRasterPool, type HelperWorker } from './raster-pool';
import { fileReports, installFiles, type LabFS } from './lab-files';
import { sealProgramScope } from './seal-scope';

/** What library_vams.js finds on globalThis.__vamsLab. */
export interface VamsLab {
  /** Called by the main module as it loads, with its memory and its exit. */
  connect(program: ProgramMemory): void;
  /** The GL context the program draws with now. */
  readonly gl: GLContext;
  readonly glut: GlutRuntime;
  readonly console: ConsoleIO;
}

/** Where the program's side module is written. */
export const MODULE_PATH = '/main.wasm';

/** The main module's URL for a runtime version. */
export const runtimeUrl = (version: string) => `/lab-runtime/${version}/vams_main.mjs`;

/** The main module, as build.sh makes it: FS, ccall and getExceptionMessage exported. */
export interface MainModule {
  FS: LabFS;
  ccall(name: 'vams_run', returns: 'number', args: ['string'], values: [string]): number;
  /** An exception's type, demangled, and its what() when it is a std::exception. */
  getExceptionMessage?(exception: unknown): [string, string | undefined];
}

export type CreateMain = (options: {
  print(line: string): void;
  printErr(line: string): void;
  /** Called as abort() begins, before Emscripten prints its "Aborted(…)" line and traps. */
  onAbort?(what: unknown): void;
}) => Promise<MainModule>;

/** Emscripten's ExitStatus, thrown by exit(). */
function exitCode(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'ExitStatus') {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : 0;
  }
  return null;
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Whether `error` is a C++ exception that left main: wasm exceptions reach JavaScript as WebAssembly.Exception. */
function isWasmException(error: unknown): boolean {
  const Exception = (WebAssembly as unknown as { Exception?: abstract new (...args: never[]) => object }).Exception;
  return typeof Exception === 'function' && error instanceof Exception;
}

/**
 * What libstdc++ prints on a lab PC for an exception nothing caught, before the program ends:
 * the exception's type, and its what() when it has one.
 */
export function terminateText(main: Pick<MainModule, 'getExceptionMessage'>, exception: unknown): string {
  let named: [string, string | undefined] | undefined;
  try {
    named = main.getExceptionMessage?.(exception);
  } catch {
    named = undefined;
  }
  if (!named) return '';
  const [type, what] = named;
  return `terminate called after throwing an instance of '${type}'\n${what ? `  what():  ${what}\n` : ''}`;
}

/**
 * Runs the program in `start`, posting what it does with `post`, and the main module from
 * `loadMain`. `seal` runs once the main module is loaded and the files are in place, just before
 * the program's main; a seal that throws stops the program there. `pool`: the threads the window
 * is drawn with, started before the seal takes workers away.
 */
export async function runProgram(
  start: StartMessage,
  post: (message: WorkerMessage) => void,
  loadMain: () => Promise<CreateMain>,
  seal: () => void = () => {},
  pool: RasterPool | null = null,
): Promise<void> {
  const views = openLayout(start.shared);
  const host = atomicsHost(views, post);
  const io = new ConsoleIO(views, host);
  const glut = new GlutRuntime({ views, host, console: io, screen: start.screen, pool });
  const lab: VamsLab = {
    connect: (memory) => glut.connect(memory),
    get gl() {
      return glut.gl;
    },
    glut,
    console: io,
  };
  (globalThis as { __vamsLab?: VamsLab }).__vamsLab = lab;
  let files: { closeAll(): void } | null = null;
  const finish = (message: WorkerMessage) => {
    try {
      files?.closeAll();
      post(message);
    } catch (error) {
      // The page must hear how the program ended, or Run would look as if it were still going.
      post({ type: 'crash', message: errorMessage(error) });
    }
  };
  let main: MainModule | null = null;
  // abort() on a lab PC prints nothing, so Emscripten's "Aborted()" line isn't passed on.
  let aborted = false;
  try {
    const create = await loadMain();
    main = await create({
      print: (line) => io.write('stdout', `${line}\n`),
      printErr: (line) => {
        if (!(aborted && line.startsWith('Aborted('))) io.write('stderr', `${line}\n`);
      },
      onAbort: () => {
        aborted = true;
      },
    });
    files = installFiles(main.FS, start.files, fileReports(io, host), [MODULE_PATH]);
    main.FS.writeFile(MODULE_PATH, new Uint8Array(start.module));
    seal();
    const code = main.ccall('vams_run', 'number', ['string'], [MODULE_PATH]);
    finish({ type: 'exit', code });
  } catch (error) {
    const code = exitCode(error);
    if (code !== null) finish({ type: 'exit', code });
    else if (aborted) finish({ type: 'crash', message: ABORTED });
    else if (main && isWasmException(error)) {
      io.write('stderr', terminateText(main, error));
      finish({ type: 'crash', message: UNCAUGHT_EXCEPTION });
    } else finish({ type: 'crash', message: errorMessage(error) });
  }
}

interface WorkerScope {
  postMessage(message: WorkerMessage): void;
  onmessage: ((event: MessageEvent<PageMessage>) => void) | null;
}

declare const WorkerGlobalScope: { new (): unknown } | undefined;

// Started as a Web Worker; imported anywhere else, it only exports.
if (typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope) {
  const scope = globalThis as unknown as WorkerScope;
  scope.onmessage = (event) => {
    if (event.data.type !== 'start') return;
    scope.onmessage = null;
    // The drawing threads start now, while they load the program's runtime, and before the seal.
    const pool = startRasterPool(
      () => new Worker(new URL('./lab-raster.ts', import.meta.url), { type: 'module', name: 'lab-raster' }) as unknown as HelperWorker,
      helperCount(navigator.hardwareConcurrency),
    );
    void runProgram(
      event.data,
      (message) => scope.postMessage(message),
      async () => {
        const module = (await import(/* @vite-ignore */ runtimeUrl(runtimeVersion))) as { default: CreateMain };
        return module.default;
      },
      () => sealProgramScope(globalThis),
      pool,
    );
  };
}
