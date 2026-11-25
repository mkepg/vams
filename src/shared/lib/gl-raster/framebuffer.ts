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
  /**
   * The rows drawing may touch, when the window is drawn a band a thread (fragmentBox). Every pixel
   * of the band takes the fragments it would take drawn whole, in the same order, so its bytes are
   * the same; rows outside it are left as they are.
   */
  band?: Band | null;
}

/** Rows y0 ≤ y < y1 of a window. */
export interface Band {
  y0: number;
  y1: number;
}

/**
 * `count` bands, bottom up, that share the `height` rows of a window between them as evenly as
 * whole rows allow; fewer when there are fewer rows than bands.
 */
export function splitRows(height: number, count: number): Band[] {
  const n = Math.max(1, Math.min(count, height));
  return Array.from({ length: n }, (_, i) => ({ y0: Math.floor((i * height) / n), y1: Math.floor(((i + 1) * height) / n) }));
}

/**
 * `count` bands for the next frame, from the last frame's `bands` and the time each took: the rows
 * move towards where each band costs the same, taking every row of a band to cost the same, half
 * way at a time so a frame that differs doesn't swing them. A scene with most of its drawing in a
 * few rows therefore gives those rows to more threads. Even bands when the last split doesn't fit.
 */
export function balanceRows(height: number, bands: readonly Band[], times: readonly number[], count: number): Band[] {
  const n = Math.max(1, Math.min(count, height));
  const fits =
    bands.length === n &&
    times.length === n &&
    bands[0].y0 === 0 &&
    bands[n - 1].y1 === height &&
    bands.every((b, i) => b.y1 > b.y0 && (i === 0 || b.y0 === bands[i - 1].y1)) &&
    times.every((t) => Number.isFinite(t) && t >= 0);
  const total = fits ? times.reduce((a, b) => a + b, 0) : 0;
  if (!fits || !(total > 0)) return splitRows(height, count);
  // A band that took no time still costs a little a row, so its rows don't all go to it.
  const cost = times.map((t) => Math.max(t, total / (20 * n)));
  const sum = cost.reduce((a, b) => a + b, 0);
  const cuts = [0];
  let band = 0;
  let before = 0;
  for (let k = 1; k < n; k++) {
    const target = (sum * k) / n;
    while (before + cost[band] < target) before += cost[band++];
    const b = bands[band];
    const at = b.y0 + ((target - before) / cost[band]) * (b.y1 - b.y0);
    const cut = Math.round((bands[k].y0 + at) / 2);
    cuts.push(Math.min(height - (n - k), Math.max(cuts[k - 1] + 1, cut)));
  }
  cuts.push(height);
  return cuts.slice(0, n).map((y0, i) => ({ y0, y1: cuts[i + 1] }));
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

/**
 * A framebuffer in shared memory, its sample store too when it is multisampled, so several threads
 * can draw bands of it. Both start at 0, as a new framebuffer's colour and its first samples do.
 */
export function createSharedFramebuffer(width: number, height: number, multisample: boolean): Framebuffer {
  const bytes = width * height * 4;
  const fb = createFramebuffer(width, height, new SharedArrayBuffer(bytes));
  if (multisample) fb.samples = new Uint8Array(new SharedArrayBuffer(bytes * SAMPLES));
  return fb;
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
  const colorWords = wordsOf(color);
  for (let k = 0; k < pending.count; k++) {
    const i = list[k];
    if (!flags[i]) continue;
    flags[i] = 0;
    const w = i * SAMPLES;
    const first = words[w];
    if (first === words[w + 1] && first === words[w + 2] && first === words[w + 3]) {
      if (colorWords) colorWords[i] = first;
      else color.set(samples.subarray(w * 4, w * 4 + 4), i * 4);
    } else resolvePixel(fb, i % fb.width, Math.floor(i / fb.width));
  }
  pending.count = 0;
}

/** The buffer as 32-bit words, a pixel each, or null when it doesn't start on a word. */
function wordsOf(bytes: Uint8Array): Uint32Array | null {
  return bytes.byteOffset % 4 === 0 ? new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.length >> 2) : null;
}

const wordBytes = new Uint8Array(4);
const wordOfBytes = new Uint32Array(wordBytes.buffer);

/** The 32-bit word that holds the bytes r g b a in memory order, as the buffers' words do. */
function word(r: number, g: number, b: number, a: number): number {
  wordBytes[0] = r;
  wordBytes[1] = g;
  wordBytes[2] = b;
  wordBytes[3] = a;
  return wordOfBytes[0];
}

/**
 * Sets pixels `xa` to `xb` of row `y` to the bytes `r g b a`, and every one of their samples, as
 * storePixel does for each: one run of words.
 */
export function storeRun(fb: Framebuffer, y: number, xa: number, xb: number, r: number, g: number, b: number, a: number): void {
  if (xb < xa) return;
  const start = y * fb.width + xa;
  const end = y * fb.width + xb + 1;
  if (fb.pending) fb.pending.flags.fill(0, start, end);
  const colorWords = wordsOf(fb.color);
  if (!colorWords) {
    for (let x = xa; x <= xb; x++) storePixel(fb, x, y, r, g, b, a);
    return;
  }
  const value = word(r, g, b, a);
  colorWords.fill(value, start, end);
  const samples = fb.samples;
  if (samples) new Uint32Array(samples.buffer, samples.byteOffset, samples.length >> 2).fill(value, start * SAMPLES, end * SAMPLES);
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
