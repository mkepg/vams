/**
 * A RasterPool that draws every band on the test's own thread, one after another, as the Lab's
 * drawing threads draw them side by side: each band but the first gets a structured clone of the
 * commands, as a message to a worker does, and a framebuffer of its own over the same shared
 * memory, with its own list of pixels to average.
 */
import { createFramebuffer, deferResolve, drawBand, splitRows, type DrawCommand, type Framebuffer, type RasterPool } from '@/shared/lib/gl-raster';

export function threadPool(bands: number): RasterPool & { draws: number } {
  const pool = {
    draws: 0,
    draw(fb: Framebuffer, commands: readonly DrawCommand[]) {
      pool.draws++;
      const rows = splitRows(fb.height, bands);
      // Every copy is made before any band is drawn, as each message is posted before this thread draws.
      const copies = rows.map((_, i) => (i === 0 ? commands : (structuredClone(commands) as DrawCommand[])));
      rows.forEach((band, i) => {
        if (i === 0) return;
        const other = createFramebuffer(fb.width, fb.height, fb.color.buffer as SharedArrayBuffer);
        if (fb.samples) {
          other.samples = fb.samples;
          deferResolve(other);
        }
        drawBand(other, band, copies[i]);
      });
      drawBand(fb, rows[0], copies[0]);
    },
    share(bytes: Uint8Array) {
      const shared = new Uint8Array(new SharedArrayBuffer(bytes.length));
      shared.set(bytes);
      return shared;
    },
  };
  return pool;
}
