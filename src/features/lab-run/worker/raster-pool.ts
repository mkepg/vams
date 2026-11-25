/**
 * The Lab's drawing threads. The program's worker starts helper workers before the program runs
 * (the scope is sealed against starting any after), and the program's GL context hands each frame's
 * drawing to them: every helper draws a band of the window's rows into the shared framebuffer while
 * the program's worker draws the first band, so a frame takes about the time of one band.
 *
 * A helper is used once it has started, which it says through shared memory, so a program that
 * draws before the helpers are up draws on its own thread meanwhile. Each frame's bands are cut
 * from the time the last frame's took (balanceRows), so the threads finish together. The program's worker waits for
 * each helper's band on Atomics.wait; a helper that never answers is stopped and left out from then
 * on.
 */
import { balanceRows, drawBand, type Band, type DrawCommand, type Framebuffer, type RasterPool } from '@/shared/lib/gl-raster';

/** The most helpers a pool starts: with the program's own thread, the window is drawn in up to this many bands, plus one. */
export const MAX_HELPERS = 3;

/** How long the program's worker waits for a helper's band before it gives the helper up. */
export const HELPER_TIMEOUT_MS = 10_000;

/**
 * Where in the pool's shared Int32Array helper `i` says it is ready, which job it finished, that
 * its last job failed, and how long its last band took, in microseconds.
 */
export const SYNC = {
  ready: (i: number) => i,
  done: (i: number) => MAX_HELPERS + i,
  failed: (i: number) => 2 * MAX_HELPERS + i,
  time: (i: number) => 3 * MAX_HELPERS + i,
  length: 4 * MAX_HELPERS,
} as const;

/** The program's worker to a helper. */
export type HelperMessage =
  | { type: 'init'; index: number; sync: SharedArrayBuffer }
  | {
      type: 'draw';
      seq: number;
      /** Which framebuffer: a new one each time the window gets a new size. */
      frame: number;
      width: number;
      height: number;
      color: SharedArrayBuffer;
      samples: SharedArrayBuffer | null;
      band: { y0: number; y1: number };
      commands: readonly DrawCommand[];
    };

/** The part of a Worker the pool uses, so tests can stand one in. */
export interface HelperWorker {
  postMessage(message: HelperMessage): void;
  terminate(): void;
}

/** How many helpers to start on a machine with `cores` logical cores: one each, leaving the page's thread and the program's. */
export function helperCount(cores: number | undefined): number {
  return Math.max(0, Math.min(MAX_HELPERS, Math.floor(cores ?? 0) - 2));
}

const isShared = (bytes: Uint8Array | null) => !bytes || bytes.buffer instanceof SharedArrayBuffer;

export class WorkerRasterPool implements RasterPool {
  private readonly sync: Int32Array;
  private readonly gone: boolean[];
  private seq = 0;
  private readonly frames = new WeakMap<Framebuffer, number>();
  private nextFrame = 1;
  /** The last frame's bands and the time each took, which the next frame's bands are cut from. */
  private last: { bands: Band[]; times: number[] } = { bands: [], times: [] };
  private readonly helpers: readonly HelperWorker[];
  private readonly now: () => number;

  constructor(helpers: readonly HelperWorker[], sync: SharedArrayBuffer, now: () => number = () => performance.now()) {
    this.helpers = helpers;
    this.now = now;
    this.sync = new Int32Array(sync);
    this.gone = helpers.map(() => false);
  }

  /** The helpers drawing can go to now: started, and not given up. */
  private ready(): number[] {
    return this.helpers.map((_, i) => i).filter((i) => !this.gone[i] && Atomics.load(this.sync, SYNC.ready(i)) === 1);
  }

  private frameId(fb: Framebuffer): number {
    let id = this.frames.get(fb);
    if (id === undefined) {
      id = this.nextFrame++;
      this.frames.set(fb, id);
    }
    return id;
  }

  draw(fb: Framebuffer, commands: readonly DrawCommand[]): void {
    const ready = isShared(fb.color) && isShared(fb.samples) ? this.ready() : [];
    const bands = balanceRows(fb.height, this.last.bands, this.last.times, ready.length + 1);
    if (bands.length < 2) {
      drawBand(fb, null, commands);
      return;
    }
    const seq = ++this.seq;
    const used = ready.slice(0, bands.length - 1);
    // Each helper gets its copy of the commands before this thread draws, which moves their stipple counters and raster positions on.
    used.forEach((helper, k) =>
      this.helpers[helper].postMessage({
        type: 'draw',
        seq,
        frame: this.frameId(fb),
        width: fb.width,
        height: fb.height,
        color: fb.color.buffer as SharedArrayBuffer,
        samples: (fb.samples?.buffer as SharedArrayBuffer | undefined) ?? null,
        band: bands[k + 1],
        commands,
      }),
    );
    const start = this.now();
    drawBand(fb, bands[0], commands);
    const times = [this.now() - start];
    // A helper that fails has run out of something the program's thread still has (drawing that
    // throws would have thrown here first), so the program carries on: the frames after this one
    // are drawn without it.
    let all = true;
    for (const helper of used) {
      all = this.finished(helper, seq) && all;
      times.push(Atomics.load(this.sync, SYNC.time(helper)) / 1000);
    }
    this.last = all ? { bands, times } : { bands: [], times: [] };
  }

  /** Waits for helper `i` to finish job `seq`; false when it failed, or never answered, and was given up. */
  private finished(i: number, seq: number): boolean {
    const at = SYNC.done(i);
    const deadline = this.now() + HELPER_TIMEOUT_MS;
    for (;;) {
      const done = Atomics.load(this.sync, at);
      if (done >= seq) break;
      const left = deadline - this.now();
      if (left <= 0) {
        this.gone[i] = true;
        this.helpers[i].terminate();
        return false;
      }
      Atomics.wait(this.sync, at, done, left);
    }
    if (Atomics.load(this.sync, SYNC.failed(i))) {
      this.gone[i] = true;
      this.helpers[i].terminate();
      return false;
    }
    return true;
  }

  share(bytes: Uint8Array): Uint8Array {
    if (bytes.buffer instanceof SharedArrayBuffer) return bytes;
    const shared = new Uint8Array(new SharedArrayBuffer(bytes.length));
    shared.set(bytes);
    return shared;
  }
}

/**
 * Starts `count` helpers with `create` and a pool to draw with them, or null when there are none
 * to start (one core, no shared memory, or no workers here).
 */
export function startRasterPool(create: () => HelperWorker, count: number): WorkerRasterPool | null {
  if (count < 1 || typeof SharedArrayBuffer === 'undefined') return null;
  const sync = new SharedArrayBuffer(SYNC.length * 4);
  const helpers: HelperWorker[] = [];
  for (let index = 0; index < count; index++) {
    try {
      const helper = create();
      helper.postMessage({ type: 'init', index, sync });
      helpers.push(helper);
    } catch {
      break;
    }
  }
  return helpers.length ? new WorkerRasterPool(helpers, sync) : null;
}
