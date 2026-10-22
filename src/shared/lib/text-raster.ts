import { FIRST_CHAR, GLYPHS, GLYPH_ADVANCE, GLYPH_DESCENT, GLYPH_HEIGHT, GLYPH_WIDTH } from './glut-bitmap-9x15';

/** Generated text starts each line this many window pixels below the one before. */
export const TEXT_LINE_PIXELS = 17;

/** A line as glutBitmapCharacter draws it: printable ASCII only (generator/render.ts strips the rest). */
export function printableLine(line: string): string {
  return line
    .replace(/\r/g, '')
    .split('')
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return c > 0x1f && c < 0x7f;
    })
    .join('');
}

/** The lines a text draws, one glRasterPos2f each. */
export function textLines(text: string): string[] {
  return text.split('\n').map(printableLine);
}

/**
 * The text's own y-scale times every enclosing group's: how its object units reach the window
 * along y, before the projection.
 */
interface ScaledNode {
  id: string;
  transform: { scaleY: number };
  parentId?: string | null;
}
export function effectiveScaleY(node: ScaledNode, objects: readonly ScaledNode[]): number {
  let scale = node.transform.scaleY;
  let parentId = node.parentId ?? null;
  for (let guard = 0; parentId && guard < 64; guard++) {
    const id = parentId;
    const parent = objects.find((o) => o.id === id);
    if (!parent) break;
    scale *= parent.transform.scaleY;
    parentId = parent.parentId ?? null;
  }
  return scale;
}

/**
 * The object-unit step between line starts so they sit TEXT_LINE_PIXELS apart in a window of
 * `pixelsPerUnitY` (glutInitWindowSize height / viewing-volume height), rounded as the code prints it.
 */
export function textLineStep(pixelsPerUnitY: number, scaleY: number): number {
  const units = Math.abs(pixelsPerUnitY * scaleY);
  if (!Number.isFinite(units) || units < 1e-9) return 0;
  return Number((TEXT_LINE_PIXELS / units).toFixed(4));
}

/** Each line's raster y, in the text's own coordinates: line 1 at the origin, the rest one step lower each. */
export function rasterLineYs(lineCount: number, step: number): number[] {
  return Array.from({ length: lineCount }, (_, i) => (i === 0 ? 0 : -Number((i * step).toFixed(4))));
}

export interface LineBitmap {
  width: number;
  height: number;
  /** One byte per pixel, top row first: 1 where glBitmap sets the pixel. */
  bits: Uint8Array;
}

/** A line's pixels as successive glutBitmapCharacter calls lay them out, from the raster position rightwards. */
export function rasterizeLine(line: string): LineBitmap {
  const width = line.length * GLYPH_ADVANCE;
  const height = GLYPH_HEIGHT;
  const bits = new Uint8Array(width * height);
  for (let i = 0; i < line.length; i++) {
    const glyph = GLYPHS[line.charCodeAt(i) - FIRST_CHAR];
    if (!glyph) continue;
    for (let row = 0; row < GLYPH_HEIGHT; row++) {
      // glBitmap rows run bottom first; two bytes per row, most significant bit leftmost.
      const word = parseInt(glyph.slice(row * 4, row * 4 + 4), 16);
      const y = GLYPH_HEIGHT - 1 - row;
      for (let col = 0; col < GLYPH_WIDTH; col++) {
        if (word & (0x8000 >> col)) bits[y * width + i * GLYPH_ADVANCE + col] = 1;
      }
    }
  }
  return { width, height, bits };
}

/**
 * Where glBitmap puts a line whose raster position is at (`x`, `y`) in a window `height` pixels
 * tall, with y measured down from the top: the bitmap's top-left pixel, or null when the raster
 * position is outside the window and GL skips the line.
 */
export function lineOrigin(x: number, y: number, width: number, height: number): { left: number; top: number } | null {
  if (!(x >= 0 && x <= width && y >= 0 && y <= height)) return null;
  const bottomUp = Math.floor(height - y - GLYPH_DESCENT);
  return { left: Math.floor(x), top: height - bottomUp - GLYPH_HEIGHT };
}
