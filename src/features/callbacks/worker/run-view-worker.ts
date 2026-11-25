/// <reference lib="webworker" />
/**
 * The editor's Run view, off the page's thread: it draws each frame of the running scene with the
 * Lab's software renderer, through gl-draw (the exported program's display()), and hands the pixels
 * back, top row first. The page posts a frame only when the last is back, so a slow frame never
 * holds up Run's steps.
 *
 * The frame is drawn a band of rows a thread: this worker starts band workers, one a spare core,
 * sends each the scene and then a band of every frame, draws the first band itself meanwhile, and
 * puts the bands together. Each frame's bands are cut from the time the last frame's took
 * (balanceRows), so the threads finish together. A band worker that fails has its band drawn here
 * instead, and is left out from then on; without band workers this worker draws the whole frame.
 */
import { balanceRows, type Band } from '@/shared/lib/gl-raster';
import type { GlFrame } from '@/features/code-generation/model/gl-draw';
import type { RunBandReply, RunBandRequest, RunViewReply, RunViewRequest } from '../model/run-view-protocol';
import { SceneDrawer } from './run-view-draw';

/** The most band workers: the frame is drawn in up to this many bands, plus this worker's. */
const MAX_BAND_WORKERS = 3;

const scope = self as unknown as DedicatedWorkerGlobalScope;
const drawer = new SceneDrawer();

interface BandWorker {
  worker: Worker;
  gone: boolean;
  /** The band asked of it, answered by its next reply, or by null when it fails. */
  waiting: ((reply: Drawn | null) => void) | null;
}

/** A band's rows and how long they took to draw. */
interface Drawn {
  pixels: Uint8ClampedArray<ArrayBuffer>;
  ms: number;
}

/** One band worker a core, leaving the page's thread and this one. */
function startBandWorkers(): BandWorker[] {
  const count = Math.max(0, Math.min(MAX_BAND_WORKERS, Math.floor(navigator.hardwareConcurrency ?? 0) - 2));
  const out: BandWorker[] = [];
  for (let i = 0; i < count; i++) {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./run-band-worker.ts', import.meta.url), { type: 'module', name: 'vams-run-band' });
    } catch {
      break;
    }
    const band: BandWorker = { worker, gone: false, waiting: null };
    worker.onmessage = (event: MessageEvent<RunBandReply>) => {
      const { pixels, ms } = event.data;
      answer(band, pixels ? { pixels, ms } : null);
    };
    worker.onerror = () => {
      band.gone = true;
      worker.terminate();
      answer(band, null);
    };
    out.push(band);
  }
  return out;
}

function answer(band: BandWorker, reply: Drawn | null): void {
  const waiting = band.waiting;
  band.waiting = null;
  waiting?.(reply);
}

const bands = startBandWorkers();
/** The last frame's bands and the time each took, which the next frame's bands are cut from. */
let last: { rows: Band[]; times: number[] } = { rows: [], times: [] };

function post(band: BandWorker, message: RunBandRequest): void {
  try {
    band.worker.postMessage(message);
  } catch {
    band.gone = true;
  }
}

/** Band `rows` from `band`, or null when it fails. */
function ask(band: BandWorker, seq: number, frame: GlFrame, width: number, height: number, rows: Band): Promise<Drawn | null> {
  return new Promise((resolve) => {
    band.waiting = resolve;
    post(band, { type: 'band', seq, frame, width, height, band: rows });
    if (band.gone) answer(band, null);
  });
}

async function draw(frame: GlFrame, width: number, height: number, seq: number): Promise<Uint8ClampedArray<ArrayBuffer>> {
  const live = bands.filter((band) => !band.gone);
  const rows = balanceRows(height, last.rows, last.times, live.length + 1);
  const asked = rows.slice(1).map((band, k) => ask(live[k], seq, frame, width, height, band));
  const start = performance.now();
  const own = drawer.draw(frame, width, height, rows[0]);
  const pieces: (Drawn | null)[] = [{ pixels: own, ms: performance.now() - start }, ...(await Promise.all(asked))];
  last = pieces.every(Boolean) ? { rows, times: pieces.map((p) => p!.ms) } : { rows: [], times: [] };
  if (pieces.length === 1) return own;
  // Each band's rows, top row first, go where the band sits from the top of the window.
  const rowBytes = width * 4;
  const out = new Uint8ClampedArray(height * rowBytes);
  rows.forEach((band, i) => {
    out.set(pieces[i]?.pixels ?? drawer.draw(frame, width, height, band), (height - band.y1) * rowBytes);
  });
  return out;
}

scope.onmessage = (event: MessageEvent<RunViewRequest>) => {
  const message = event.data;
  if (message.type === 'scene') {
    drawer.setScene(message.scene, message.images);
    for (const band of bands) post(band, message);
    return;
  }
  const { frame, width, height, seq } = message;
  void drawer.loading.then(async () => {
    if (!drawer.ready) return;
    const pixels = await draw(frame, width, height, seq);
    const reply: RunViewReply = { type: 'frame', seq, width, height, pixels };
    scope.postMessage(reply, [pixels.buffer]);
  });
};
