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
 * posts `crash` with its message. If that post fails, it posts `crash` as a last resort. The
 * worker never stops a program itself: the page terminates the worker.
 */
import type { GLContext } from '@/shared/lib/gl-raster';
import type { PageMessage, StartMessage, WorkerMessage } from '../model/protocol';
import { runtimeVersion } from '../model/runtime-version';
import { openLayout } from '../model/shared-layout';
import { ConsoleIO } from './console-io';
import { atomicsHost } from './event-queue';
import { GlutRuntime, type ProgramMemory } from './glut-runtime';
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

/** The main module, as build.sh makes it: FS and ccall exported. */
export interface MainModule {
  FS: LabFS;
  ccall(name: 'vams_run', returns: 'number', args: ['string'], values: [string]): number;
}

export type CreateMain = (options: { print(line: string): void; printErr(line: string): void }) => Promise<MainModule>;

/** Emscripten's ExitStatus, thrown by exit(). */
function exitCode(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'ExitStatus') {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : 0;
  }
  return null;
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Runs the program in `start`, posting what it does with `post`, and the main module from
 * `loadMain`. `seal` runs once the main module is loaded and the files are in place, just before
 * the program's main; a seal that throws stops the program there.
 */
export async function runProgram(
  start: StartMessage,
  post: (message: WorkerMessage) => void,
  loadMain: () => Promise<CreateMain>,
  seal: () => void = () => {},
): Promise<void> {
  const views = openLayout(start.shared);
  const host = atomicsHost(views, post);
  const io = new ConsoleIO(views, host);
  const glut = new GlutRuntime({ views, host, console: io, screen: start.screen });
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
  try {
    const create = await loadMain();
    const main = await create({
      print: (line) => io.write('stdout', `${line}\n`),
      printErr: (line) => io.write('stderr', `${line}\n`),
    });
    files = installFiles(main.FS, start.files, fileReports(io, host), [MODULE_PATH]);
    main.FS.writeFile(MODULE_PATH, new Uint8Array(start.module));
    seal();
    const code = main.ccall('vams_run', 'number', ['string'], [MODULE_PATH]);
    finish({ type: 'exit', code });
  } catch (error) {
    const code = exitCode(error);
    if (code !== null) finish({ type: 'exit', code });
    else finish({ type: 'crash', message: errorMessage(error) });
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
    void runProgram(
      event.data,
      (message) => scope.postMessage(message),
      async () => {
        const module = (await import(/* @vite-ignore */ runtimeUrl(runtimeVersion))) as { default: CreateMain };
        return module.default;
      },
      () => sealProgramScope(globalThis),
    );
  };
}
