import type { Rgba, Shade } from '@/shared/lib/gl-geometry';
import { inBox, type Box, type Scissor } from './clip';
import { SAMPLES, resolvePixel, sampleStore, storePixel, toByte, type Framebuffer } from './framebuffer';

export type RGBA = Rgba;

/** A vertex in window coordinates, with its clip w for perspective-correct interpolation. */
export interface WinVertex {
  x: number;
  y: number;
  z: number;
  w: number;
  color: RGBA;
  tex?: [number, number];
}

/** Whether a vertex has a finite window position; one that doesn't (a 0/0 in the program) draws nothing. */
export function drawable(v: WinVertex): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y);
}

export type PolygonMode = 'POINT' | 'LINE' | 'FILL';
export type Face = 'FRONT' | 'BACK' | 'FRONT_AND_BACK';
export type BlendFactor =
  | 'ZERO'
  | 'ONE'
  | 'SRC_COLOR'
  | 'ONE_MINUS_SRC_COLOR'
  | 'DST_COLOR'
  | 'ONE_MINUS_DST_COLOR'
  | 'SRC_ALPHA'
  | 'ONE_MINUS_SRC_ALPHA'
  | 'DST_ALPHA'
  | 'ONE_MINUS_DST_ALPHA'
  | 'SRC_ALPHA_SATURATE';
export type EnvMode = 'MODULATE' | 'REPLACE' | 'DECAL' | 'BLEND' | 'ADD';
export type Wrap = 'REPEAT' | 'CLAMP' | 'CLAMP_TO_EDGE';
export type Filter = 'NEAREST' | 'LINEAR';
/** A texture's base internal format (Table 3.15), which decides what the environment takes from it. */
export type TextureBase = 'ALPHA' | 'LUMINANCE' | 'LUMINANCE_ALPHA' | 'RGB' | 'RGBA';

/**
 * One image of the bound 2D texture: RGBA8 texels, row 0 at t = 0, with the components its base
 * format lacks stored as luminance in R, G and B, alpha 1 or colour 0. `filter` is the one this
 * primitive samples with, the magnification or the minification filter.
 */
export interface TextureUnit {
  width: number;
  height: number;
  data: Uint8Array;
  base: TextureBase;
  wrapS: Wrap;
  wrapT: Wrap;
  filter: Filter;
  /** GL_TEXTURE_BORDER_COLOR, which GL_CLAMP with GL_LINEAR blends in at the image's edge; (0, 0, 0, 0) when absent. */
  border?: RGBA;
  /** For a *_MIPMAP_LINEAR filter between two levels: the next level, and how much of it to take (3.8.8). */
  next?: { unit: TextureUnit; weight: number };
}

/** The GL state rasterisation reads. Drawing a line moves `stipple.counter` on. */
export interface RasterState {
  /** GLUT_MULTISAMPLE: 4 samples a pixel and the multisample rules of 3.3.3, 3.4.4 and 3.5.6. */
  multisample: boolean;
  pointSize: number;
  lineWidth: number;
  stipple: { factor: number; pattern: number; enabled: boolean; counter: number };
  polygonMode: { front: PolygonMode; back: PolygonMode };
  cullFace: { enabled: boolean; mode: Face };
  frontFace: 'CCW' | 'CW';
  shadeModel: Shade;
  blend: { enabled: boolean; src: BlendFactor; dst: BlendFactor };
  scissor: Scissor | null;
  /** The bound texture while GL_TEXTURE_2D is on, otherwise null. */
  texture: TextureUnit | null;
  envMode: EnvMode;
}

/** GL's initial state (3.3 to 3.5, 4.1). */
export function defaultRasterState(): RasterState {
  return {
    multisample: false,
    pointSize: 1,
    lineWidth: 1,
    stipple: { factor: 1, pattern: 0xffff, enabled: false, counter: 0 },
    polygonMode: { front: 'FILL', back: 'FILL' },
    cullFace: { enabled: false, mode: 'BACK' },
    frontFace: 'CCW',
    shadeModel: 'SMOOTH',
    blend: { enabled: false, src: 'ONE', dst: 'ZERO' },
    scissor: null,
    texture: null,
    envMode: 'MODULATE',
  };
}

/** Every sample of a pixel covered. */
export const FULL_COVERAGE = (1 << SAMPLES) - 1;

const clamp01 = (c: number) => Math.min(1, Math.max(0, c));

/** A texture coordinate as the wrap mode leaves it (3.8.7): REPEAT keeps the fraction, CLAMP 0..1, CLAMP_TO_EDGE ½N..1 − ½N. */
function wrapCoord(s: number, size: number, mode: Wrap): number {
  if (mode === 'REPEAT') return s - Math.floor(s);
  const min = mode === 'CLAMP' ? 0 : 1 / (2 * size);
  return Math.min(1 - min, Math.max(min, s));
}

// GL_TEXTURE_BORDER_COLOR's initial value.
const BORDER: Rgba = [0, 0, 0, 0];

/** Texel i, j, or the border colour when either lies outside the image. */
function texel(t: TextureUnit, i: number, j: number): Rgba {
  if (i < 0 || j < 0 || i >= t.width || j >= t.height) return t.border ?? BORDER;
  const p = (j * t.width + i) * 4;
  return [t.data[p] / 255, t.data[p + 1] / 255, t.data[p + 2] / 255, t.data[p + 3] / 255];
}

/** A texel index as the wrap mode gives it: REPEAT wraps it into the image, the clamps leave it. */
function wrapIndex(i: number, size: number, mode: Wrap): number {
  return mode === 'REPEAT' ? ((i % size) + size) % size : i;
}

/**
 * The texture value at s, t: the nearest texel (eq. 3.19, 3.20) or the 2 × 2 weighted by eq. 3.22,
 * and between two mipmap levels the weighted sum of both (eq. 3.23).
 */
function sampleTexture(t: TextureUnit, s: number, u: number): Rgba {
  if (t.next) {
    const a = sampleLevel(t, s, u);
    const b = sampleLevel(t.next.unit, s, u);
    const w = t.next.weight;
    return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w, a[3] + (b[3] - a[3]) * w];
  }
  return sampleLevel(t, s, u);
}

/** One level's value at s, t. */
function sampleLevel(t: TextureUnit, s: number, u: number): Rgba {
  const x = wrapCoord(s, t.width, t.wrapS) * t.width;
  const y = wrapCoord(u, t.height, t.wrapT) * t.height;
  if (t.filter === 'NEAREST') {
    // s = 1 under a clamp takes the last texel.
    return texel(t, Math.min(t.width - 1, Math.floor(x)), Math.min(t.height - 1, Math.floor(y)));
  }
  const i0 = Math.floor(x - 0.5);
  const j0 = Math.floor(y - 0.5);
  const a = x - 0.5 - i0;
  const b = y - 0.5 - j0;
  const i = [wrapIndex(i0, t.width, t.wrapS), wrapIndex(i0 + 1, t.width, t.wrapS)];
  const j = [wrapIndex(j0, t.height, t.wrapT), wrapIndex(j0 + 1, t.height, t.wrapT)];
  const t00 = texel(t, i[0], j[0]);
  const t10 = texel(t, i[1], j[0]);
  const t01 = texel(t, i[0], j[1]);
  const t11 = texel(t, i[1], j[1]);
  const mix = (c: number) => (1 - a) * (1 - b) * t00[c] + a * (1 - b) * t10[c] + (1 - a) * b * t01[c] + a * b * t11[c];
  return [mix(0), mix(1), mix(2), mix(3)];
}

/**
 * The texture environment of Table 3.22 for the texture's base format. DECAL leaves an ALPHA or
 * LUMINANCE texture's fragment as it is, and BLEND's constant colour is its initial (0, 0, 0, 0).
 */
function texture(state: RasterState, f: Rgba, tex: readonly [number, number] | undefined): Rgba {
  if (!state.texture || !tex) return f;
  const { base } = state.texture;
  const t = sampleTexture(state.texture, tex[0], tex[1]);
  const hasColor = base !== 'ALPHA';
  const hasAlpha = base === 'ALPHA' || base === 'LUMINANCE_ALPHA' || base === 'RGBA';
  const rgb = (fn: (c: number) => number): [number, number, number] => (hasColor ? [fn(0), fn(1), fn(2)] : [f[0], f[1], f[2]]);
  switch (state.envMode) {
    case 'REPLACE':
      return [...rgb((c) => t[c]), hasAlpha ? t[3] : f[3]];
    case 'MODULATE':
      return [...rgb((c) => f[c] * t[c]), hasAlpha ? f[3] * t[3] : f[3]];
    case 'DECAL':
      if (base === 'RGBA') return [...rgb((c) => f[c] * (1 - t[3]) + t[c] * t[3]), f[3]];
      if (base === 'RGB') return [t[0], t[1], t[2], f[3]];
      return f;
    case 'BLEND':
      return [...rgb((c) => f[c] * (1 - t[c])), hasAlpha ? f[3] * t[3] : f[3]];
    case 'ADD':
      return [...rgb((c) => f[c] + t[c]), hasAlpha ? f[3] * t[3] : f[3]];
  }
}

/** A blend factor's weight for one component `c` (0 to 3), from source `s` and destination `d`. */
function factor(name: BlendFactor, c: number, s: Rgba, d: Rgba): number {
  switch (name) {
    case 'ZERO':
      return 0;
    case 'ONE':
      return 1;
    case 'SRC_COLOR':
      return s[c];
    case 'ONE_MINUS_SRC_COLOR':
      return 1 - s[c];
    case 'DST_COLOR':
      return d[c];
    case 'ONE_MINUS_DST_COLOR':
      return 1 - d[c];
    case 'SRC_ALPHA':
      return s[3];
    case 'ONE_MINUS_SRC_ALPHA':
      return 1 - s[3];
    case 'DST_ALPHA':
      return d[3];
    case 'ONE_MINUS_DST_ALPHA':
      return 1 - d[3];
    case 'SRC_ALPHA_SATURATE':
      return c === 3 ? 1 : Math.min(s[3], 1 - d[3]);
  }
}

/** Blends `s` over the 4 bytes at `at` in `buf` (4.1.8) and writes the result back as bytes. */
function blendInto(state: RasterState, s: Rgba, buf: Uint8Array, at: number): void {
  if (!state.blend.enabled) {
    for (let c = 0; c < 4; c++) buf[at + c] = toByte(s[c]);
    return;
  }
  const d: Rgba = [buf[at] / 255, buf[at + 1] / 255, buf[at + 2] / 255, buf[at + 3] / 255];
  for (let c = 0; c < 4; c++) {
    buf[at + c] = toByte(s[c] * factor(state.blend.src, c, s, d) + d[c] * factor(state.blend.dst, c, s, d));
  }
}

const scratch = new Uint8Array(4);

/**
 * One fragment through texturing, the scissor and window test and blending, into pixel `x`, `y`.
 * In multisample mode only the samples set in `coverage` take it, and the pixel is their average.
 */
export function emitFragment(
  fb: Framebuffer,
  state: RasterState,
  box: Box,
  x: number,
  y: number,
  color: Rgba,
  tex: readonly [number, number] | undefined,
  coverage: number = FULL_COVERAGE,
): void {
  if (!inBox(box, x, y)) return;
  const t = texture(state, color, tex);
  const s: Rgba = [clamp01(t[0]), clamp01(t[1]), clamp01(t[2]), clamp01(t[3])];
  const p = (y * fb.width + x) * 4;
  if (!state.multisample) {
    scratch.set(fb.color.subarray(p, p + 4));
    blendInto(state, s, scratch, 0);
    storePixel(fb, x, y, scratch[0], scratch[1], scratch[2], scratch[3]);
    return;
  }
  const samples = sampleStore(fb);
  for (let k = 0; k < SAMPLES; k++) if (coverage & (1 << k)) blendInto(state, s, samples, p * SAMPLES + k * 4);
  resolvePixel(fb, x, y);
}
