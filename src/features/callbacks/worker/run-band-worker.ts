/// <reference lib="webworker" />
/**
 * One of the Run view worker's band workers: it draws the rows of each frame it is sent, of the
 * scene it was given, and hands them back (run-view-worker.ts).
 */
import type { RunBandReply, RunBandRequest } from '../model/run-view-protocol';
import { SceneDrawer } from './run-view-draw';

const drawer = new SceneDrawer();
const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = (event: MessageEvent<RunBandRequest>) => {
  const message = event.data;
  if (message.type === 'scene') {
    drawer.setScene(message.scene, message.images);
    return;
  }
  const { seq, frame, width, height, band } = message;
  void drawer.loading.then(() => {
    let pixels: Uint8ClampedArray<ArrayBuffer> | null = null;
    const start = performance.now();
    try {
      if (drawer.ready) pixels = drawer.draw(frame, width, height, band);
    } catch (error) {
      console.error(error);
    }
    const reply: RunBandReply = { seq, pixels, ms: performance.now() - start };
    scope.postMessage(reply, pixels ? [pixels.buffer] : []);
  });
};
