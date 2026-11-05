/**
 * Runs raster calls in a worker thread, so a test can end a call that never returns. Each message
 * is a list of calls; each call draws into a fresh framebuffer, and the reply lists the pixels each
 * one covered and where it left the stipple counter.
 */
import { parentPort } from 'node:worker_threads';
import {
  createFramebuffer,
  rasterLine,
  rasterPoint,
  rasterPolygon,
  rasterTriangle,
  type RasterState,
  type WinVertex,
} from '@/shared/lib/gl-raster';

export interface RasterCall {
  fn: 'rasterPoint' | 'rasterLine' | 'rasterTriangle' | 'rasterPolygon';
  vertices: WinVertex[];
  state: RasterState;
  width: number;
  height: number;
}

export interface RasterResult {
  covered: string[];
  counter: number;
}

function run({ fn, vertices: vs, state, width, height }: RasterCall): RasterResult {
  const fb = createFramebuffer(width, height);
  if (fn === 'rasterPoint') rasterPoint(fb, vs[0], state);
  else if (fn === 'rasterLine') rasterLine(fb, vs[0], vs[1], state);
  else if (fn === 'rasterTriangle') rasterTriangle(fb, vs[0], vs[1], vs[2], state);
  else rasterPolygon(fb, vs, state);
  const covered: string[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (fb.color[i] || fb.color[i + 1] || fb.color[i + 2] || fb.color[i + 3]) covered.push(`${x},${y}`);
    }
  }
  return { covered, counter: state.stipple.counter };
}

parentPort?.on('message', (calls: RasterCall[]) => parentPort?.postMessage(calls.map(run)));
