/**
 * A helper's side of the Lab's drawing threads (raster-pool.ts): it draws the band of each job
 * into the shared framebuffer, then says so in shared memory, where the program's worker waits.
 */
import { createFramebuffer, deferResolve, drawBand, type Framebuffer } from '@/shared/lib/gl-raster';
import { SYNC, type HelperMessage } from './raster-pool';

export class RasterHelper {
  private sync: Int32Array | null = null;
  private index = 0;
  private fb: Framebuffer | null = null;
  private frame = 0;

  handle(message: HelperMessage): void {
    if (message.type === 'init') {
      this.sync = new Int32Array(message.sync);
      this.index = message.index;
      Atomics.store(this.sync, SYNC.ready(this.index), 1);
      return;
    }
    const sync = this.sync;
    if (!sync) return;
    const start = performance.now();
    try {
      drawBand(this.framebuffer(message), message.band, message.commands);
      Atomics.store(sync, SYNC.time(this.index), Math.round((performance.now() - start) * 1000));
    } catch (error) {
      Atomics.store(sync, SYNC.failed(this.index), 1);
      console.error(error);
    }
    Atomics.store(sync, SYNC.done(this.index), message.seq);
    Atomics.notify(sync, SYNC.done(this.index));
  }

  /** The job's framebuffer: views of its shared memory, and this helper's own list of the pixels it has to average. */
  private framebuffer(job: Extract<HelperMessage, { type: 'draw' }>): Framebuffer {
    if (this.fb && this.frame === job.frame) return this.fb;
    const fb = createFramebuffer(job.width, job.height, job.color);
    if (job.samples) {
      fb.samples = new Uint8Array(job.samples);
      deferResolve(fb);
    }
    this.fb = fb;
    this.frame = job.frame;
    return fb;
  }
}
