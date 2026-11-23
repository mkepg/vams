/**
 * BLACK-BOX TEST SUITE — BB-RUN (the Run view)
 * While Run is on, the canvas shows the running program's frames as the Lab's software renderer
 * draws them in a worker. These checks stand a fake worker in for it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVamsStore } from '@/core/store';
import { runController } from '@/features/callbacks/model/run-controller';
import { runView, type RunViewWorker } from '@/features/callbacks/model/run-view';
import type { RunViewReply, RunViewRequest } from '@/features/callbacks/model/run-view-protocol';
import { registerFakeRenderer } from '../helpers/fake-renderer';
import { addTriangle } from '../helpers/store';

class FakeWorker implements RunViewWorker {
  sent: RunViewRequest[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent<RunViewReply>) => void) | null = null;
  postMessage(message: RunViewRequest) {
    this.sent.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  /** Sends the frame the page last asked for back, all pixels white. */
  reply() {
    const frames = this.sent.filter((m) => m.type === 'frame');
    const last = frames[frames.length - 1] as Extract<RunViewRequest, { type: 'frame' }>;
    const pixels = new Uint8ClampedArray(last.width * last.height * 4).fill(255);
    this.onmessage?.({ data: { type: 'frame', seq: last.seq, width: last.width, height: last.height, pixels } } as MessageEvent<RunViewReply>);
  }
  frames() {
    return this.sent.filter((m): m is Extract<RunViewRequest, { type: 'frame' }> => m.type === 'frame');
  }
}

let worker: FakeWorker;
let unregister: () => void;
const drawn: unknown[] = [];
const canvas = {
  width: 0,
  height: 0,
  getContext: () => ({ putImageData: (image: unknown) => drawn.push(image), clearRect: () => {} }),
} as unknown as HTMLCanvasElement;

beforeEach(() => {
  vi.stubGlobal('ImageData', class {
    constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
  });
  worker = new FakeWorker();
  runView.setWorkerFactory(() => worker);
  runView.attach(canvas);
  drawn.length = 0;
  addTriangle();
  useVamsStore.getState().setCallbackHandler('keyboard', 'onKey');
  unregister = registerFakeRenderer(new Map(), { getCanvasSize: () => ({ width: 80, height: 60 }) });
});

afterEach(() => {
  runController.stop();
  unregister();
  runView.setWorkerFactory(null);
  runView.attach(null);
  vi.unstubAllGlobals();
});

describe('BB-RUN-28: While Run is on the canvas shows the program\'s frames, and stopping takes them away', () => {
  it('hands the worker the scene, then draws the first frame display() makes, before any idle pass', () => {
    expect(runController.start({ loop: false })).toBe(true);
    const scene = worker.sent[0] as Extract<RunViewRequest, { type: 'scene' }>;
    expect(scene.type).toBe('scene');
    expect(scene.scene.objects).toHaveLength(1);
    expect(scene.scene.canvasSize).toEqual({ width: 80, height: 60 });
    expect(worker.frames()).toHaveLength(1);
    expect(worker.frames()[0]).toMatchObject({ width: 80, height: 60 });
    expect(runView.isShowing()).toBe(false);
    worker.reply();
    expect(runView.isShowing()).toBe(true);
    expect(drawn).toHaveLength(1);
    expect([canvas.width, canvas.height]).toEqual([80, 60]);
  });

  it('stopping ends the worker and hides the frames, so the editing view shows again', () => {
    runController.start({ loop: false });
    worker.reply();
    runController.stop();
    expect(worker.terminated).toBe(true);
    expect(runView.isShowing()).toBe(false);
  });
});

describe('BB-RUN-29: A slow frame never holds Run up: the newest state waits for the worker, the rest are dropped', () => {
  it('posts one frame at a time and then the latest state', () => {
    runController.start({ loop: false });
    runController.stepFrame();
    runController.stepFrame();
    runController.stepFrame();
    // Still drawing the first: nothing more has gone to the worker.
    expect(worker.frames()).toHaveLength(1);
    worker.reply();
    expect(worker.frames()).toHaveLength(2);
    worker.reply();
    expect(worker.frames()).toHaveLength(2);
    expect(drawn).toHaveLength(2);
  });

  it('keeps Run working where no worker can start', () => {
    runView.setWorkerFactory(() => {
      throw new Error('no workers here');
    });
    expect(runController.start({ loop: false })).toBe(true);
    runController.stepFrame();
    expect(runView.isShowing()).toBe(false);
  });
});
