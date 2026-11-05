/**
 * GLUT's seven bitmap fonts, ported from freeglut's fg_font_data.c, and the glutBitmap* calls
 * that draw and measure them as freeglut's fg_font.c does.
 */
import { FONT_8_BY_13 } from './font-8x13';
import { FONT_9_BY_15 } from './font-9x15';
import { FONT_HELVETICA_10 } from './font-helvetica-10';
import { FONT_HELVETICA_12 } from './font-helvetica-12';
import { FONT_HELVETICA_18 } from './font-helvetica-18';
import { FONT_TIMES_ROMAN_10 } from './font-times-10';
import { FONT_TIMES_ROMAN_24 } from './font-times-24';

/** A freeglut SFG_Font: every glyph is `height` rows, drawn from (xorig, yorig) below the raster position. */
export interface BitmapFont {
  /** The X font it was taken from. */
  name: string;
  height: number;
  xorig: number;
  yorig: number;
  /** Characters 0 to 255: [width, rows bottom first as hex, ⌈width / 8⌉ bytes a row]. */
  glyphs: readonly (readonly [number, string])[];
}

export type GlutFontName =
  | 'GLUT_BITMAP_8_BY_13'
  | 'GLUT_BITMAP_9_BY_15'
  | 'GLUT_BITMAP_TIMES_ROMAN_10'
  | 'GLUT_BITMAP_TIMES_ROMAN_24'
  | 'GLUT_BITMAP_HELVETICA_10'
  | 'GLUT_BITMAP_HELVETICA_12'
  | 'GLUT_BITMAP_HELVETICA_18';

export const GLUT_FONTS: Record<GlutFontName, BitmapFont> = {
  GLUT_BITMAP_8_BY_13: FONT_8_BY_13,
  GLUT_BITMAP_9_BY_15: FONT_9_BY_15,
  GLUT_BITMAP_TIMES_ROMAN_10: FONT_TIMES_ROMAN_10,
  GLUT_BITMAP_TIMES_ROMAN_24: FONT_TIMES_ROMAN_24,
  GLUT_BITMAP_HELVETICA_10: FONT_HELVETICA_10,
  GLUT_BITMAP_HELVETICA_12: FONT_HELVETICA_12,
  GLUT_BITMAP_HELVETICA_18: FONT_HELVETICA_18,
};

/** The handle each font's GLUT_BITMAP_* constant stands for in the Lab's GL/freeglut_std.h, as under MinGW. */
export const GLUT_FONT_HANDLES: Readonly<Record<number, GlutFontName>> = {
  2: 'GLUT_BITMAP_9_BY_15',
  3: 'GLUT_BITMAP_8_BY_13',
  4: 'GLUT_BITMAP_TIMES_ROMAN_10',
  5: 'GLUT_BITMAP_TIMES_ROMAN_24',
  6: 'GLUT_BITMAP_HELVETICA_10',
  7: 'GLUT_BITMAP_HELVETICA_12',
  8: 'GLUT_BITMAP_HELVETICA_18',
};

/** What glutBitmap* draws into: the GL context's glBitmap. */
export interface BitmapTarget {
  bitmap(width: number, height: number, xorig: number, yorig: number, xmove: number, ymove: number, bits: Uint8Array | null): void;
}

const decoded = new WeakMap<BitmapFont, Uint8Array[]>();

/** Glyph `c`'s rows as bytes, decoded once per font. */
function glyphBits(font: BitmapFont, c: number): Uint8Array {
  let cache = decoded.get(font);
  if (!cache) {
    cache = [];
    decoded.set(font, cache);
  }
  let bits = cache[c];
  if (!bits) {
    const hex = font.glyphs[c][1];
    bits = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bits.length; i++) bits[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    cache[c] = bits;
  }
  return bits;
}

/** A string's bytes as glutBitmapString reads them: up to the first 0, each character's low 8 bits. */
function bytesOf(text: string | ArrayLike<number>): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = (typeof text === 'string' ? text.charCodeAt(i) : text[i]) & 0xff;
    if (c === 0) break;
    out.push(c);
  }
  return out;
}

function drawGlyph(ctx: BitmapTarget, font: BitmapFont, c: number): void {
  const width = font.glyphs[c][0];
  ctx.bitmap(width, font.height, font.xorig, font.yorig, width, 0, glyphBits(font, c));
}

/** glutBitmapCharacter: one glyph at the raster position, which then moves right by its width. Characters outside 1..255 draw nothing. */
export function glutBitmapCharacter(ctx: BitmapTarget, font: BitmapFont, character: number): void {
  if (!(character >= 1 && character < 256)) return;
  drawGlyph(ctx, font, Math.trunc(character));
}

/** glutBitmapString: each character in turn; a newline moves the raster position back to the line's start and one font height down. */
export function glutBitmapString(ctx: BitmapTarget, font: BitmapFont, text: string | ArrayLike<number>): void {
  let x = 0;
  for (const c of bytesOf(text)) {
    if (c === 10) {
      ctx.bitmap(0, 0, 0, 0, -x, -font.height, null);
      x = 0;
    } else {
      drawGlyph(ctx, font, c);
      x += font.glyphs[c][0];
    }
  }
}

/** glutBitmapWidth: how far a character moves the raster position; 0 outside 1..255. */
export function glutBitmapWidth(font: BitmapFont, character: number): number {
  return character > 0 && character < 256 ? font.glyphs[Math.trunc(character)][0] : 0;
}

/** glutBitmapLength: the widest line of the string, in pixels. */
export function glutBitmapLength(font: BitmapFont, text: string | ArrayLike<number>): number {
  let length = 0;
  let line = 0;
  for (const c of bytesOf(text)) {
    if (c === 10) {
      length = Math.max(length, line);
      line = 0;
    } else {
      line += font.glyphs[c][0];
    }
  }
  return Math.max(length, line);
}

/** glutBitmapHeight: the font's line height. */
export function glutBitmapHeight(font: BitmapFont): number {
  return font.height;
}
