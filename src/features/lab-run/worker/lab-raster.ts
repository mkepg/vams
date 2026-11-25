/// <reference lib="webworker" />
/**
 * One of the Lab's drawing threads, which the program's worker starts (raster-pool.ts). It runs no
 * program code: it only draws the bands of frames it is sent.
 */
import { RasterHelper } from './raster-helper';
import type { HelperMessage } from './raster-pool';

const helper = new RasterHelper();
self.onmessage = (event: MessageEvent<HelperMessage>) => helper.handle(event.data);
