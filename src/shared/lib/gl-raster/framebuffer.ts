import type { Rgba } from '@/shared/lib/gl-geometry';
import { fragmentBox, type Scissor } from './clip';

/**
 * An RGBA8 colour buffer, four bytes a pixel, row 0 at the bottom as in GL. Multisampled drawing
 * keeps four samples a pixel in `samples`, made on first use, and `color` holds their average.
 *
 * A framebuffer with `pending` (deferResolve) works the average out once a pixel, when the colour
 * is next read (resolvePending), rather than after every fragment: a pixel that shapes cover one
 * over another is averaged once, from its final samples, which is the value the last fragment's
 * average would have left. Without `pending`, each fragment's pixel is averaged at once.
 */
export interface Framebuffer {
  readonly width: number;
  readonly height: number;
  readonly color: Uint8Array;
  samples: Uint8Array | null;
  pending?: PendingPixels | null;
}

/** The pixels whose samples changed since their colour was last averaged, each once. */
export interface PendingPixels {
  readonly flags: Uint8Array;
  readonly list: Int32Array;
  count: number;
}

/** The four sample positions of a multisampled pixel, in pixels from its centre: (−2, −6), (6, −2), (−6, 2), (2, 6) sixteenths. */
export const SAMPLE_OFFSETS: readonly (readonly [number, number])[] = [
  [-2 / 16, -6 / 16],
  [6 / 16, -2 / 16],
  [-6 / 16, 2 / 16],
  [2 / 16, 6 / 16],
];

/** Samples a pixel. The store keeps a pixel's samples together, four bytes each, in this order. */
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
  const { color } = fb;
  const samples = new Uint8Array(color.length * SAMPLES);
  for (let p = 0; p < color.length; p += 4) {
    for (let at = p * SAMPLES, end = at + SAMPLES * 4; at < end; at += 4) {
      samples[at] = color[p];
      samples[at + 1] = color[p + 1];
      samples[at + 2] = color[p + 2];
      samples[at + 3] = color[p + 3];
    }
  }
  fb.samples = samples;
  return samples;
}

/** Makes `fb` average its pixels when its colour is read, rather than after each fragment. */
export function deferResolve(fb: Framebuffer): void {
  const pixels = fb.width * fb.height;
  fb.pending = { flags: new Uint8Array(pixels), list: new Int32Array(pixels), count: 0 };
}

/** Pixel `x`, `y`'s samples changed: averages it now, or marks it for resolvePending. */
export function touchPixel(fb: Framebuffer, x: number, y: number): void {
  const pending = fb.pending;
  if (!pending) {
    resolvePixel(fb, x, y);
    return;
  }
  const i = y * fb.width + x;
  if (pending.flags[i]) return;
  pending.flags[i] = 1;
  pending.list[pending.count++] = i;
}

/** Averages every pixel touchPixel marked, so `color` is up to date. */
export function resolvePending(fb: Framebuffer): void {
  const pending = fb.pending;
  if (!pending || !pending.count) return;
  const { flags, list } = pending;
  const samples = sampleStore(fb);
  // A pixel whose four samples hold the same four bytes, as most do, resolves channel by channel
  // to SAME, which a 32-bit comparison of the samples finds at once.
  const words = new Uint32Array(samples.buffer, samples.byteOffset, samples.length >> 2);
  const color = fb.color;
  for (let k = 0; k < pending.count; k++) {
    const i = list[k];
    if (!flags[i]) continue;
    flags[i] = 0;
    const w = i * SAMPLES;
    if (words[w] === words[w + 1] && words[w] === words[w + 2] && words[w] === words[w + 3]) {
      const at = w * 4;
      const p = i * 4;
      color[p] = SAME[samples[at]];
      color[p + 1] = SAME[samples[at + 1]];
      color[p + 2] = SAME[samples[at + 2]];
      color[p + 3] = samples[at + 3];
    } else resolvePixel(fb, i % fb.width, Math.floor(i / fb.width));
  }
  pending.count = 0;
}

/** Sets pixel `x`, `y` to the bytes `r g b a`, and every one of its samples with it. */
export function storePixel(fb: Framebuffer, x: number, y: number, r: number, g: number, b: number, a: number): void {
  // Set outright, the colour is these bytes, not their average, so no average is owed.
  if (fb.pending) fb.pending.flags[y * fb.width + x] = 0;
  const p = (y * fb.width + x) * 4;
  fb.color[p] = r;
  fb.color[p + 1] = g;
  fb.color[p + 2] = b;
  fb.color[p + 3] = a;
  const samples = fb.samples;
  if (!samples) return;
  for (let at = p * SAMPLES, end = at + SAMPLES * 4; at < end; at += 4) {
    samples[at] = r;
    samples[at + 1] = g;
    samples[at + 2] = b;
    samples[at + 3] = a;
  }
}

// A byte's light in linear terms, by the sRGB curve, for each of the 256 values.
const LINEAR = Array.from({ length: 256 }, (_, v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

/** Linear light back to an sRGB byte. */
function srgbByte(l: number): number {
  const c = l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, c)) * 255);
}

/** The resolved byte of one colour channel whose samples hold `values`, in sample order. */
function resolveChannel(values: ArrayLike<number>): number {
  let sum = 0;
  for (let s = 0; s < SAMPLES; s++) sum += LINEAR[values[s]];
  return srgbByte(sum / SAMPLES);
}

// The resolve, worked out once for each set of sample bytes. A pixel whose samples all hold the
// same byte, as every pixel inside a shape does, reads SAME; any other set is kept in RESOLVED as
// it is first met, so the pow in srgbByte runs once per set rather than once per fragment.
const SAME = Uint8Array.from({ length: 256 }, (_, v) => resolveChannel(new Array<number>(SAMPLES).fill(v)));
const RESOLVED = new Map<number, number>();
const RESOLVED_LIMIT = 1 << 16;

/** The resolved byte of the channel at `at` in a pixel's 4 samples (SAMPLES is 4). */
function resolvedByte(samples: Uint8Array, at: number): number {
  const v0 = samples[at];
  const v1 = samples[at + 4];
  const v2 = samples[at + 8];
  const v3 = samples[at + 12];
  if (v0 === v1 && v1 === v2 && v2 === v3) return SAME[v0];
  const key = v0 | (v1 << 8) | (v2 << 16) | (v3 << 24);
  let byte = RESOLVED.get(key);
  if (byte === undefined) {
    byte = resolveChannel([v0, v1, v2, v3]);
    if (RESOLVED.size >= RESOLVED_LIMIT) RESOLVED.clear();
    RESOLVED.set(key, byte);
  }
  return byte;
}

/**
 * Sets pixel `x`, `y` to the average of its samples. Red, green and blue are averaged as light, in
 * sRGB, as the reference driver resolves them, so a pixel half covered by white over black is 188,
 * not 128; alpha is averaged as it is.
 */
export function resolvePixel(fb: Framebuffer, x: number, y: number): void {
  const samples = sampleStore(fb);
  const p = (y * fb.width + x) * 4;
  const at = p * SAMPLES;
  fb.color[p] = resolvedByte(samples, at);
  fb.color[p + 1] = resolvedByte(samples, at + 1);
  fb.color[p + 2] = resolvedByte(samples, at + 2);
  let alpha = 0;
  for (let s = 0; s < SAMPLES; s++) alpha += samples[at + s * 4 + 3];
  fb.color[p + 3] = Math.round(alpha / SAMPLES);
}

/** Repeats the `unit` bytes already at `start` up to `end`, doubling the copy each time. */
function repeat(buf: Uint8Array, start: number, end: number, unit: number): void {
  for (let filled = unit; start + filled < end; filled *= 2) buf.copyWithin(start + filled, start, Math.min(start + filled, end - filled));
}

/** Fills the window, or the scissor rectangle when it is on, with `color`, as glClear does. */
export function clearFramebuffer(fb: Framebuffer, color: Rgba, scissor: Scissor | null = null): void {
  const box = fragmentBox(fb, scissor);
  if (box.x0 >= box.x1 || box.y0 >= box.y1) return;
  // The pixels outside the box keep what they hold, so they are averaged first.
  resolvePending(fb);
  const [r, g, b, a] = color.map(toByte);
  // A box as wide as the window is one run of bytes; a narrower one is a run a row.
  const whole = box.x0 === 0 && box.x1 === fb.width;
  const runs: [number, number][] = whole
    ? [[box.y0 * fb.width, box.y1 * fb.width]]
    : Array.from({ length: box.y1 - box.y0 }, (_, i) => [(box.y0 + i) * fb.width + box.x0, (box.y0 + i) * fb.width + box.x1]);
  for (const [first, last] of runs) {
    const p = first * 4;
    fb.color[p] = r;
    fb.color[p + 1] = g;
    fb.color[p + 2] = b;
    fb.color[p + 3] = a;
    repeat(fb.color, p, last * 4, 4);
    if (fb.samples) {
      storePixel(fb, first % fb.width, Math.floor(first / fb.width), r, g, b, a);
      repeat(fb.samples, p * SAMPLES, last * 4 * SAMPLES, 4 * SAMPLES);
    }
  }
}
