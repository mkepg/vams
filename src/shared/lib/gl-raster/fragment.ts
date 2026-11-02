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
export type EnvMode = 'MODULATE' | 'REPLACE' | 'DECAL' | 'ADD';
export type Wrap = 'REPEAT' | 'CLAMP';

/** A bound 2D texture: RGBA8 texels, row 0 at t = 0, sampled GL_NEAREST. */
export interface TextureUnit {
  width: number;
  height: number;
  data: Uint8Array;
  wrapS: Wrap;
  wrapT: Wrap;
  filter: 'NEAREST';
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

function wrap(i: number, size: number, mode: Wrap): number {
  return mode === 'REPEAT' ? ((i % size) + size) % size : Math.min(size - 1, Math.max(0, i));
}

function sampleTexture(t: TextureUnit, s: number, u: number): Rgba {
  const i = wrap(Math.floor(s * t.width), t.width, t.wrapS);
  const j = wrap(Math.floor(u * t.height), t.height, t.wrapT);
  const p = (j * t.width + i) * 4;
  return [t.data[p] / 255, t.data[p + 1] / 255, t.data[p + 2] / 255, t.data[p + 3] / 255];
}

/** The texture environment of Table 3.22 for an RGBA texture. */
function texture(state: RasterState, f: Rgba, tex: readonly [number, number] | undefined): Rgba {
  if (!state.texture || !tex) return f;
  const t = sampleTexture(state.texture, tex[0], tex[1]);
  switch (state.envMode) {
    case 'REPLACE':
      return t;
    case 'MODULATE':
      return [f[0] * t[0], f[1] * t[1], f[2] * t[2], f[3] * t[3]];
    case 'DECAL':
      return [f[0] * (1 - t[3]) + t[0] * t[3], f[1] * (1 - t[3]) + t[1] * t[3], f[2] * (1 - t[3]) + t[2] * t[3], f[3]];
    case 'ADD':
      return [f[0] + t[0], f[1] + t[1], f[2] + t[2], f[3] * t[3]];
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
