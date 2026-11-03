import type { Filter, TextureBase, TextureUnit, Wrap } from './fragment';

/** GL_TEXTURE_MIN_FILTER's values; the four mipmap filters need every level down to 1 × 1. */
export type MinFilter =
  | Filter
  | 'NEAREST_MIPMAP_NEAREST'
  | 'LINEAR_MIPMAP_NEAREST'
  | 'NEAREST_MIPMAP_LINEAR'
  | 'LINEAR_MIPMAP_LINEAR';

/** One mipmap level: RGBA8 texels as TextureUnit stores them. */
export interface TextureImage {
  width: number;
  height: number;
  base: TextureBase;
  data: Uint8Array;
}

/** A texture object (3.8.12): its images and parameters, with GL's initial values. */
export interface TextureObject {
  levels: (TextureImage | undefined)[];
  minFilter: MinFilter;
  magFilter: Filter;
  wrapS: Wrap;
  wrapT: Wrap;
}

export function createTexture(): TextureObject {
  return { levels: [], minFilter: 'NEAREST_MIPMAP_LINEAR', magFilter: 'LINEAR', wrapS: 'REPEAT', wrapT: 'REPEAT' };
}

// The largest image glTexImage2D takes, in each direction.
export const MAX_TEXTURE_SIZE = 8192;
// The last mipmap level of the largest texture: log2(MAX_TEXTURE_SIZE).
export const MAX_TEXTURE_LEVEL = Math.log2(MAX_TEXTURE_SIZE);

export const GL_TEXTURE = {
  ALPHA: 0x1906,
  RGB: 0x1907,
  RGBA: 0x1908,
  LUMINANCE: 0x1909,
  LUMINANCE_ALPHA: 0x190a,
  BGR: 0x80e0,
  BGRA: 0x80e1,
} as const;

/** glTexImage2D's internalformat: 1 to 4 components or a base format name (Table 3.15). */
export function internalBase(internalformat: number): TextureBase | null {
  switch (internalformat) {
    case 1:
    case GL_TEXTURE.LUMINANCE:
      return 'LUMINANCE';
    case 2:
    case GL_TEXTURE.LUMINANCE_ALPHA:
      return 'LUMINANCE_ALPHA';
    case 3:
    case GL_TEXTURE.RGB:
      return 'RGB';
    case 4:
    case GL_TEXTURE.RGBA:
      return 'RGBA';
    case GL_TEXTURE.ALPHA:
      return 'ALPHA';
  }
  return null;
}

/** How many components a pixel of `format` holds, or 0 when it isn't a format glTexImage2D takes. */
export function formatComponents(format: number): number {
  switch (format) {
    case GL_TEXTURE.ALPHA:
    case GL_TEXTURE.LUMINANCE:
      return 1;
    case GL_TEXTURE.LUMINANCE_ALPHA:
      return 2;
    case GL_TEXTURE.RGB:
    case GL_TEXTURE.BGR:
      return 3;
    case GL_TEXTURE.RGBA:
    case GL_TEXTURE.BGRA:
      return 4;
  }
  return 0;
}

/** One pixel's components as R, G, B, A (3.6.4's conversion to RGBA: L to R, G and B; A 1 when absent). */
function toRgba(format: number, c: readonly number[]): [number, number, number, number] {
  switch (format) {
    case GL_TEXTURE.ALPHA:
      return [0, 0, 0, c[0]];
    case GL_TEXTURE.LUMINANCE:
      return [c[0], c[0], c[0], 1];
    case GL_TEXTURE.LUMINANCE_ALPHA:
      return [c[0], c[0], c[0], c[1]];
    case GL_TEXTURE.RGB:
      return [c[0], c[1], c[2], 1];
    case GL_TEXTURE.BGR:
      return [c[2], c[1], c[0], 1];
    case GL_TEXTURE.BGRA:
      return [c[2], c[1], c[0], c[3]];
    default:
      return [c[0], c[1], c[2], c[3]];
  }
}

/** The internal format's components from RGBA (Table 3.15), stored as TextureUnit keeps them. */
function toInternal(base: TextureBase, [r, g, b, a]: readonly number[]): [number, number, number, number] {
  switch (base) {
    case 'ALPHA':
      return [0, 0, 0, a];
    case 'LUMINANCE':
      return [r, r, r, 1];
    case 'LUMINANCE_ALPHA':
      return [r, r, r, a];
    case 'RGB':
      return [r, g, b, 1];
    case 'RGBA':
      return [r, g, b, a];
  }
}

/**
 * An image from client pixels (3.6.4): rows of `width` pixels of `format`, each component read by
 * `component(byteOffset)` as `size` bytes, every row starting on a multiple of `alignment` bytes.
 * Pixels past the end of `bytes` read as 0; no `bytes` gives a black, transparent image.
 */
export function unpackImage(
  width: number,
  height: number,
  base: TextureBase,
  format: number,
  bytes: Uint8Array | null,
  size: number,
  component: (view: DataView, at: number) => number,
  alignment: number,
): TextureImage {
  const data = new Uint8Array(width * height * 4);
  const image: TextureImage = { width, height, base, data };
  if (!bytes) return image;
  const n = formatComponents(format);
  const rowBytes = Math.ceil((width * n * size) / alignment) * alignment;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const c: number[] = new Array(n);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = y * rowBytes + x * n * size;
      for (let k = 0; k < n; k++) {
        const o = at + k * size;
        c[k] = o + size <= bytes.byteLength ? component(view, o) : 0;
      }
      const texel = toInternal(base, toRgba(format, c));
      const p = (y * width + x) * 4;
      for (let k = 0; k < 4; k++) data[p + k] = Math.round(Math.min(1, Math.max(0, texel[k])) * 255);
    }
  }
  return image;
}

function isMipmapped(f: MinFilter): boolean {
  return f !== 'NEAREST' && f !== 'LINEAR';
}

/** q of 3.8.8: the last level of a full mipmap chain from a `w` × `h` image. */
function lastLevel(w: number, h: number): number {
  return Math.floor(Math.log2(Math.max(w, h)));
}

/**
 * Whether the texture can be applied (3.8.10): level 0 has texels, and a mipmap filter finds every
 * level to 1 × 1, each half the one before (rounded down, at least 1) and of the same format.
 */
export function isComplete(t: TextureObject): boolean {
  const base = t.levels[0];
  if (!base || base.width === 0 || base.height === 0) return false;
  if (!isMipmapped(t.minFilter)) return true;
  for (let d = 1; d <= lastLevel(base.width, base.height); d++) {
    const level = t.levels[d];
    const w = Math.max(1, base.width >> d);
    const h = Math.max(1, base.height >> d);
    if (!level || level.width !== w || level.height !== h || level.base !== base.base) return false;
  }
  return true;
}

/**
 * The image and filter a primitive samples with, from its level of detail λ (3.8.8, 3.8.9): the
 * magnification filter on level 0 while λ ≤ c, otherwise the minification filter. A mipmap filter
 * samples the level nearest λ with the filter its first word names. Call only on a complete texture.
 */
export function textureFor(t: TextureObject, lambda: number): TextureUnit {
  const c = t.magFilter === 'LINEAR' && (t.minFilter === 'NEAREST_MIPMAP_NEAREST' || t.minFilter === 'NEAREST_MIPMAP_LINEAR') ? 0.5 : 0;
  let level = 0;
  let filter: Filter = t.magFilter;
  if (lambda > c) {
    filter = t.minFilter.startsWith('LINEAR') ? 'LINEAR' : 'NEAREST';
    if (isMipmapped(t.minFilter)) {
      const q = lastLevel(t.levels[0]!.width, t.levels[0]!.height);
      level = t.minFilter.endsWith('MIPMAP_NEAREST')
        ? Math.min(q, Math.max(0, lambda <= 0.5 ? 0 : Math.ceil(lambda + 0.5) - 1))
        : Math.min(q, Math.max(0, Math.round(lambda)));
    }
  }
  const image = t.levels[level]!;
  return { width: image.width, height: image.height, data: image.data, base: image.base, wrapS: t.wrapS, wrapT: t.wrapT, filter };
}
