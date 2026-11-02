import type { Rgba } from '@/shared/lib/gl-geometry';
import { fragmentBox, type Scissor } from './clip';

/**
 * An RGBA8 colour buffer, four bytes a pixel, row 0 at the bottom as in GL. Multisampled drawing
 * keeps four samples a pixel in `samples`, made on first use, and `color` holds their average.
 */
export interface Framebuffer {
  readonly width: number;
  readonly height: number;
  readonly color: Uint8Array;
  samples: Uint8Array | null;
}

/** The four sample positions of a multisampled pixel, in pixels from its centre: (−2, −6), (6, −2), (−6, 2), (2, 6) sixteenths. */
export const SAMPLE_OFFSETS: readonly (readonly [number, number])[] = [
  [-2 / 16, -6 / 16],
  [6 / 16, -2 / 16],
  [-6 / 16, 2 / 16],
  [2 / 16, 6 / 16],
];

export const SAMPLES = SAMPLE_OFFSETS.length;

/** A colour component, 0 to 1, as GL stores it in 8 bits: round(c × 255). */
export function toByte(c: number): number {
  return Math.round(Math.min(1, Math.max(0, c)) * 255);
}

/** A framebuffer of `width` × `height`, cleared to 0, in `buffer` when one is given. */
export function createFramebuffer(width: number, height: number, buffer?: SharedArrayBuffer): Framebuffer {
  const bytes = width * height * 4;
  if (buffer && buffer.byteLength < bytes) {
    throw new RangeError(`A ${width} × ${height} framebuffer needs ${bytes} bytes; the buffer has ${buffer.byteLength}.`);
  }
  return { width, height, color: buffer ? new Uint8Array(buffer, 0, bytes) : new Uint8Array(bytes), samples: null };
}

/** The sample store, made from the colour buffer the first time it is needed. */
export function sampleStore(fb: Framebuffer): Uint8Array {
  if (fb.samples) return fb.samples;
  const samples = new Uint8Array(fb.color.length * SAMPLES);
  for (let p = 0; p < fb.color.length; p += 4) {
    for (let s = 0; s < SAMPLES; s++) samples.set(fb.color.subarray(p, p + 4), p * SAMPLES + s * 4);
  }
  fb.samples = samples;
  return samples;
}

/** Sets pixel `x`, `y` to the bytes `r g b a`, and every one of its samples with it. */
export function storePixel(fb: Framebuffer, x: number, y: number, r: number, g: number, b: number, a: number): void {
  const p = (y * fb.width + x) * 4;
  fb.color[p] = r;
  fb.color[p + 1] = g;
  fb.color[p + 2] = b;
  fb.color[p + 3] = a;
  if (!fb.samples) return;
  for (let s = 0; s < SAMPLES; s++) fb.samples.set(fb.color.subarray(p, p + 4), p * SAMPLES + s * 4);
}

/** Sets pixel `x`, `y` to the average of its samples. */
export function resolvePixel(fb: Framebuffer, x: number, y: number): void {
  const samples = sampleStore(fb);
  const p = (y * fb.width + x) * 4;
  for (let c = 0; c < 4; c++) {
    let sum = 0;
    for (let s = 0; s < SAMPLES; s++) sum += samples[p * SAMPLES + s * 4 + c];
    fb.color[p + c] = Math.round(sum / SAMPLES);
  }
}

/** Fills the window, or the scissor rectangle when it is on, with `color`, as glClear does. */
export function clearFramebuffer(fb: Framebuffer, color: Rgba, scissor: Scissor | null = null): void {
  const box = fragmentBox(fb, scissor);
  const [r, g, b, a] = color.map(toByte);
  for (let y = box.y0; y < box.y1; y++) {
    for (let x = box.x0; x < box.x1; x++) storePixel(fb, x, y, r, g, b, a);
  }
}
