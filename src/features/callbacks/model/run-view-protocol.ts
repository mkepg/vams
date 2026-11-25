import type { GlFrame, GlScene } from '@/features/code-generation/model/gl-draw';

/** The page to the Run view worker: the scene once at Run, then each frame to draw. */
export type RunViewRequest =
  | { type: 'scene'; scene: GlScene; images: { id: string; dataUrl: string }[] }
  | { type: 'frame'; seq: number; frame: GlFrame; width: number; height: number };

/** The worker to the page: a frame's pixels, top row first, RGBA. */
export interface RunViewReply {
  type: 'frame';
  seq: number;
  width: number;
  height: number;
  pixels: Uint8ClampedArray<ArrayBuffer>;
}

/** The Run view worker to one of its band workers: the scene, then each band of a frame to draw. */
export type RunBandRequest =
  | { type: 'scene'; scene: GlScene; images: { id: string; dataUrl: string }[] }
  | { type: 'band'; seq: number; frame: GlFrame; width: number; height: number; band: { y0: number; y1: number } };

/** A band worker's rows, top row first, RGBA, and how long they took to draw; null when it couldn't draw them. */
export interface RunBandReply {
  seq: number;
  pixels: Uint8ClampedArray<ArrayBuffer> | null;
  ms: number;
}
