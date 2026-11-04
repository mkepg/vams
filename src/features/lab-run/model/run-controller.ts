/**
 * Runs the student's program: one Web Worker for each Run, the memory it shares with the page,
 * and what the page shows of it (its window, its menus and the Console).
 *
 * Run's whole life is one status. The workspace sets the compile part (`compiling`, `busy`, and
 * back to `idle` when the compile gives no program); `start` takes it from there to `running`,
 * which reads as `waitingInput` while the program waits in the Console, and ends at `exited`,
 * `crashed`, or `idle` when ✕ stops it.
 *
 * While a program runs the page pumps the shared memory on every animation frame, and on a timer
 * while the tab is hidden (a hidden tab has no animation frames, and a program printing into a
 * full output ring would wait for ever): it posts the events waiting in the outbox, reads the
 * output ring into the Console, notes what the program waits for, and copies the newest frame.
 * When the program ends the page reads the ring one last time with OutputReader.finish().
 */
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { appendConsole, emptyConsole, type ConsoleLog } from './console-lines';
import { EventOutbox } from './event-outbox';
import type { AttachedMenu, LabFile, LabMenu, StartMessage, WorkerMessage } from './protocol';
import {
  acknowledgeFrame,
  adoptFramebuffer,
  createSharedLayout,
  INPUT_STATE,
  inputState,
  latestFrame,
  openLayout,
  OutputReader,
  postEvent as postToRing,
  sendKey as sendKeyToRing,
  sendLine as sendLineToRing,
  type InputState,
  type LabEvent,
  type LayoutViews,
  type OutputChunk,
} from './shared-layout';

export type RunStatus = 'idle' | 'compiling' | 'busy' | 'running' | 'waitingInput' | 'exited' | 'crashed';

/** The program's window, in its own pixels: what glutCreateWindow, glutReshapeWindow and the grip made it. */
export interface ProgramWindow {
  title: string;
  width: number;
  height: number;
  /** glutInitWindowPosition or glutPositionWindow; −1 lets the stage place it. */
  x: number;
  y: number;
  /** glutFullScreen: the window fills the stage. */
  fullscreen: boolean;
}

/** A copy of the newest frame, top row first. */
export interface Picture {
  width: number;
  height: number;
  pixels: Uint8ClampedArray<ArrayBuffer>;
}

export interface LabRunState {
  status: RunStatus;
  exitCode?: number;
  window: ProgramWindow | null;
  menus: LabMenu[];
  attached: AttachedMenu[];
  console: ConsoleLog;
  /** What the program waits for in the Console. */
  input: InputState;
  /** Files the program wrote, newest version of each. */
  written: LabFile[];
}

const initialState = (): LabRunState => ({
  status: 'idle',
  exitCode: undefined,
  window: null,
  menus: [],
  attached: [],
  console: emptyConsole(),
  input: INPUT_STATE.NONE,
  written: [],
});

export const useLabRun = create<LabRunState>(initialState);

/** Run's status, and the exit code once the program has exited. */
export function useRunState(): { status: RunStatus; exitCode?: number } {
  return useLabRun(useShallow((s) => ({ status: s.status, exitCode: s.exitCode })));
}

/** What the page needs of a Worker. */
export interface WorkerLike {
  postMessage(message: StartMessage): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null;
  onerror: ((event: Event) => void) | null;
}

export type WorkerFactory = () => WorkerLike;

const defaultWorker: WorkerFactory = () =>
  new Worker(new URL('../worker/lab-worker.ts', import.meta.url), { type: 'module', name: 'vams-lab-program' }) as unknown as WorkerLike;

/** How often a hidden tab reads the shared memory. */
export const HIDDEN_READ_MS = 100;

/** The Console line for a program that stopped on an error. */
export const crashLine = (message: string) => `The program stopped: ${message}`;
/** What the Console says when the worker itself would not start. */
export const NO_START = "The program couldn't start.";

const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

class RunController {
  private worker: WorkerLike | null = null;
  private views: LayoutViews | null = null;
  private reader: OutputReader | null = null;
  private outbox = new EventOutbox();
  /** Counts runs, so a message from an earlier worker is never taken for this one's. */
  private run = 0;
  private frame = 0;
  private picture: Picture | null = null;
  private readonly sinks = new Set<(picture: Picture) => void>();
  private raf = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private createWorker: WorkerFactory = defaultWorker;

  /** Replaced by the tests. */
  setWorkerFactory(factory: WorkerFactory | null): void {
    this.createWorker = factory ?? defaultWorker;
  }

  // The compile part of Run.

  /** Run was pressed: a running program ends, and the compile starts. */
  compiling(): void {
    this.end();
    useLabRun.setState({ status: 'compiling', exitCode: undefined, window: null, menus: [], attached: [], input: INPUT_STATE.NONE });
  }

  /** The compile service is busy and the compile is being retried. */
  busy(): void {
    if (useLabRun.getState().status === 'compiling') useLabRun.setState({ status: 'busy' });
  }

  /** The compile gave no program: errors, or a reason Run can't go ahead. */
  compileEnded(): void {
    const { status } = useLabRun.getState();
    if (status === 'compiling' || status === 'busy') useLabRun.setState({ status: 'idle' });
  }

  // The program.

  /** Runs a compiled program in a fresh worker, with a fresh Console. */
  start(module: ArrayBuffer, files: LabFile[] = []): void {
    this.end();
    const run = ++this.run;
    const shared = createSharedLayout();
    const views = openLayout(shared);
    this.views = views;
    this.reader = new OutputReader(views);
    this.outbox = new EventOutbox();
    this.frame = 0;
    this.picture = null;
    useLabRun.setState({ ...initialState(), status: 'running' });
    let worker: WorkerLike;
    try {
      worker = this.createWorker();
    } catch {
      this.ended({ type: 'crash', message: NO_START }, NO_START);
      return;
    }
    this.worker = worker;
    worker.onmessage = (event) => {
      if (run === this.run) this.receive(event.data);
    };
    worker.onerror = (event) => {
      event.preventDefault?.();
      if (run !== this.run) return;
      // A worker script that fails to load or to run reports an error event, often with no message.
      const message = (event as ErrorEvent).message;
      this.ended({ type: 'crash', message: message || NO_START }, message ? undefined : NO_START);
    };
    worker.postMessage({ type: 'start', module, files, shared });
    this.startPump();
  }

  /** ✕: ends the program where it is. What it printed stays in the Console. */
  stop(): void {
    if (!this.worker) return;
    this.pump();
    this.append(this.reader?.finish() ?? []);
    this.end();
    useLabRun.setState({ status: 'idle', window: null, menus: [], attached: [], input: INPUT_STATE.NONE });
  }

  /** Back to the start, with the browser's own worker. Used by the tests. */
  reset(): void {
    this.end();
    this.createWorker = defaultWorker;
    this.sinks.clear();
    useLabRun.setState(initialState());
  }

  // What the page sends.

  /** Queues an event for the program; see EventOutbox for what happens when the ring is full. */
  postEvent(event: LabEvent): void {
    const views = this.views;
    if (!views) return;
    this.outbox.push(event);
    this.outbox.flush((e) => postToRing(views, e));
  }

  /** The window's new size, from the grip or glutFullScreen: the program gets a reshape. */
  resizeWindow(width: number, height: number, fullscreen?: boolean): void {
    const current = useLabRun.getState().window;
    if (!current) return;
    width = Math.max(1, Math.round(width));
    height = Math.max(1, Math.round(height));
    const next = { ...current, width, height, fullscreen: fullscreen ?? current.fullscreen };
    if (next.width === current.width && next.height === current.height && next.fullscreen === current.fullscreen) return;
    useLabRun.setState({ window: next });
    if (width !== current.width || height !== current.height) this.postEvent({ kind: 'reshape', width, height });
  }

  /** The line the student typed in the Console, sent when they press Enter, and echoed as a console does. */
  sendLine(text: string): boolean {
    const views = this.views;
    if (!views || inputState(views) !== INPUT_STATE.LINE) return false;
    if (!sendLineToRing(views, text)) return false;
    this.append([{ stream: 'stdout', text: `${text}\n` }]);
    useLabRun.setState({ input: INPUT_STATE.NONE, status: 'running' });
    return true;
  }

  /** One key pressed in the Console while the program waits for a key. */
  sendKey(code: number): boolean {
    const views = this.views;
    if (!views || inputState(views) !== INPUT_STATE.KEY) return false;
    return sendKeyToRing(views, code);
  }

  /** Calls `sink` with every new frame, and with the newest one now if there is one. */
  subscribeFrames(sink: (picture: Picture) => void): () => void {
    this.sinks.add(sink);
    if (this.picture) sink(this.picture);
    return () => {
      this.sinks.delete(sink);
    };
  }

  // Reading the shared memory.

  /** One read of the shared memory. The pump calls it; the tests call it directly. */
  pump(): void {
    const views = this.views;
    if (!views || !this.worker) return;
    this.outbox.flush((e) => postToRing(views, e));
    this.append(this.reader?.take() ?? []);
    const input = inputState(views);
    const { status, input: was } = useLabRun.getState();
    if (status === 'running' || status === 'waitingInput') {
      const next = input === INPUT_STATE.NONE ? 'running' : 'waitingInput';
      if (next !== status || input !== was) useLabRun.setState({ input, status: next });
    }
    const frame = latestFrame(views, this.frame);
    if (!frame) return;
    const bytes = frame.width * frame.height * 4;
    const picture =
      this.picture && this.picture.pixels.length === bytes
        ? { width: frame.width, height: frame.height, pixels: this.picture.pixels }
        : { width: frame.width, height: frame.height, pixels: new Uint8ClampedArray(bytes) };
    picture.pixels.set(frame.pixels);
    this.picture = picture;
    this.frame = frame.frame;
    acknowledgeFrame(views, frame.frame);
    for (const sink of this.sinks) sink(picture);
  }

  private startPump(): void {
    if (typeof requestAnimationFrame === 'function') {
      const tick = () => {
        this.pump();
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    }
    this.timer = setInterval(() => {
      if (isHidden()) this.pump();
    }, HIDDEN_READ_MS);
  }

  private stopPump(): void {
    if (this.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private append(chunks: OutputChunk[]): void {
    if (!chunks.length) return;
    let log: ConsoleLog = useLabRun.getState().console;
    for (const chunk of chunks) log = chunk.stream === 'clear' ? emptyConsole() : appendConsole(log, chunk.stream, chunk.text);
    useLabRun.setState({ console: log });
  }

  private receive(message: WorkerMessage): void {
    const views = this.views;
    if (!views) return;
    const state = useLabRun.getState();
    switch (message.type) {
      case 'window': {
        const previous = state.window;
        const { title, width, height, x, y } = message;
        // After the first, a new size is glutReshapeWindow asking the window system: the program hears back in a reshape.
        if (previous && (previous.width !== width || previous.height !== height)) this.postEvent({ kind: 'reshape', width, height });
        useLabRun.setState({ window: { title, width, height, x, y, fullscreen: false } });
        return;
      }
      case 'title':
        if (state.window) useLabRun.setState({ window: { ...state.window, title: message.title } });
        return;
      case 'fullscreen':
        // The stage knows its own size, so it sends the reshape.
        if (state.window) useLabRun.setState({ window: { ...state.window, fullscreen: true } });
        return;
      case 'menus':
        useLabRun.setState({ menus: message.tree, attached: message.attached });
        return;
      case 'framebuffer':
        adoptFramebuffer(views, message.buffer, message.generation);
        return;
      case 'fileWritten': {
        const written = state.written.filter((f) => f.name !== message.name);
        useLabRun.setState({ written: [...written, { name: message.name, bytes: message.bytes }] });
        return;
      }
      case 'exit':
      case 'crash':
        this.ended(message);
        return;
    }
  }

  /** The program has ended. A crash prints `line` in the Console, by default "The program stopped: <message>". */
  private ended(message: { type: 'exit'; code: number } | { type: 'crash'; message: string }, line?: string): void {
    this.pump();
    this.append(this.reader?.finish() ?? []);
    if (message.type === 'crash') this.append([{ stream: 'stderr', text: `${line ?? crashLine(message.message)}\n` }]);
    this.end();
    useLabRun.setState({
      status: message.type === 'exit' ? 'exited' : 'crashed',
      exitCode: message.type === 'exit' ? message.code : undefined,
      window: null,
      menus: [],
      attached: [],
      input: INPUT_STATE.NONE,
    });
  }

  /** Terminates the worker, if there is one, and lets go of its memory. */
  private end(): void {
    this.stopPump();
    this.run++;
    this.worker?.terminate();
    this.worker = null;
    this.views = null;
    this.reader = null;
    this.picture = null;
    this.outbox = new EventOutbox();
  }
}

export const runController = new RunController();
export type { RunController };
