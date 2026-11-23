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
