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

/**
 * The four sample positions of a multisampled pixel, in pixels from its centre, y up as in GL:
 * (−2, 6), (6, 2), (−6, −2), (2, −6) sixteenths. The reference Intel driver reports them through
 * glGetMultisamplefv as (0.375, 0.125), (0.875, 0.375), (0.125, 0.625), (0.625, 0.875) from the
 * pixel's corner, but covers samples as if y ran down: its points' corners fit only the mirrored
 * pattern (docs/specs/2026-11-24-intel-reference-design.md).
 */
export const SAMPLE_OFFSETS: readonly (readonly [number, number])[] = [
  [-2 / 16, 6 / 16],
  [6 / 16, 2 / 16],
  [-6 / 16, -2 / 16],
  [2 / 16, -6 / 16],
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
  // A pixel whose four samples hold the same four bytes, as most do, resolves to those bytes
  // (RESOLVE[4v] is v), which a 32-bit comparison of the samples finds at once.
  const words = new Uint32Array(samples.buffer, samples.byteOffset, samples.length >> 2);
  const color = fb.color;
  for (let k = 0; k < pending.count; k++) {
    const i = list[k];
    if (!flags[i]) continue;
    flags[i] = 0;
    const w = i * SAMPLES;
    if (words[w] === words[w + 1] && words[w] === words[w + 2] && words[w] === words[w + 3]) {
      color.set(samples.subarray(w * 4, w * 4 + 4), i * 4);
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

/**
 * The resolved byte for each sum of a channel's 4 sample bytes, 0 to 1020: (sum + 1) >> 2, so a
 * quarter-way value rounds down, except that an average of exactly 127.5 rounds up to 128. That is
 * the reference Intel driver's resolve, measured for 1, 2 and 3 of 4 samples of every byte over
 * black and over white (docs/specs/2026-11-24-intel-reference-design.md).
 */
const RESOLVE = Uint8Array.from({ length: 4 * 255 + 1 }, (_, sum) => (sum === 510 ? 128 : (sum + 1) >> 2));

/** The resolved byte of the channel at `at` in a pixel's 4 samples (SAMPLES is 4). */
function resolvedByte(samples: Uint8Array, at: number): number {
  return RESOLVE[samples[at] + samples[at + 4] + samples[at + 8] + samples[at + 12]];
}

/**
 * Sets pixel `x`, `y` to the average of its samples, each channel by RESOLVE, as the reference
 * driver resolves them: a pixel half covered by white over black is 128.
 */
export function resolvePixel(fb: Framebuffer, x: number, y: number): void {
  const samples = sampleStore(fb);
  const p = (y * fb.width + x) * 4;
  const at = p * SAMPLES;
  fb.color[p] = resolvedByte(samples, at);
  fb.color[p + 1] = resolvedByte(samples, at + 1);
  fb.color[p + 2] = resolvedByte(samples, at + 2);
  fb.color[p + 3] = resolvedByte(samples, at + 3);
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
