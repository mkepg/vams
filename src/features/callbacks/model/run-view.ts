import type { GlFrame, GlScene } from '@/features/code-generation/model/gl-draw';
import type { RunViewReply, RunViewRequest } from './run-view-protocol';

/** The part of a Worker the Run view uses, so tests can stand one in. */
export interface RunViewWorker {
  postMessage(message: RunViewRequest): void;
  onmessage: ((event: MessageEvent<RunViewReply>) => void) | null;
  terminate(): void;
}

const makeWorker = (): RunViewWorker =>
  new Worker(new URL('../worker/run-view-worker.ts', import.meta.url), { type: 'module', name: 'vams-run-view' }) as unknown as RunViewWorker;

/**
 * The editor's Run view: while Run is on, the canvas shows each frame as the exported program draws
 * it on the lab PCs, drawn by the Lab's software renderer in a worker. The run controller hands it
 * the latest state every frame; it posts a frame to the worker only when the last is back, keeping
 * the newest state meanwhile, so Run's steps never wait on drawing.
 */
class RunView {
  private worker: RunViewWorker | null = null;
  private busy = false;
  private pending: { frame: GlFrame; width: number; height: number } | null = null;
  private seq = 0;
  private canvas: HTMLCanvasElement | null = null;
  private showing = false;
  private listeners = new Set<() => void>();
  private create: () => RunViewWorker = makeWorker;

  /** The canvas frames are drawn into; null when it goes. */
  attach(canvas: HTMLCanvasElement | null): void {
    this.canvas = canvas;
  }

  /** Whether a frame of the running program is on show. */
  isShowing(): boolean {
    return this.showing;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** For tests: the worker the next start makes. */
  setWorkerFactory(create: (() => RunViewWorker) | null): void {
    this.create = create ?? makeWorker;
  }

  start(scene: GlScene, images: { id: string; dataUrl: string }[]): void {
    this.stop();
    let worker: RunViewWorker;
    try {
      worker = this.create();
    } catch {
      // Without workers the editing view keeps drawing Run, as it did before the Run view.
      return;
    }
    this.worker = worker;
    worker.onmessage = (event) => this.onFrame(event.data);
    worker.postMessage({ type: 'scene', scene, images });
  }

  /** The state to show next. */
  frame(frame: GlFrame, width: number, height: number): void {
    if (!this.worker || width <= 0 || height <= 0) return;
    if (this.busy) {
      this.pending = { frame, width, height };
      return;
    }
    this.send({ frame, width, height });
  }

  stop(): void {
    this.worker?.terminate();
    this.worker = null;
    this.busy = false;
    this.pending = null;
    if (this.canvas) this.canvas.getContext('2d')?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.setShowing(false);
  }

  private send(next: { frame: GlFrame; width: number; height: number }): void {
    this.busy = true;
    this.pending = null;
    this.worker!.postMessage({ type: 'frame', seq: ++this.seq, ...next });
  }

  private onFrame(reply: RunViewReply): void {
    if (!this.worker) return;
    this.busy = false;
    const canvas = this.canvas;
    if (canvas) {
      if (canvas.width !== reply.width) canvas.width = reply.width;
      if (canvas.height !== reply.height) canvas.height = reply.height;
      canvas.getContext('2d')?.putImageData(new ImageData(reply.pixels, reply.width, reply.height), 0, 0);
      this.setShowing(true);
    }
    if (this.pending) this.send(this.pending);
  }

  private setShowing(on: boolean): void {
    if (this.showing === on) return;
    this.showing = on;
    this.listeners.forEach((listener) => listener());
  }
}

/** App-wide singleton. */
export const runView = new RunView();
