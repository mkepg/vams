import { fragmentBox } from './clip';
import type { Framebuffer } from './framebuffer';
import { emitFragment, type RasterState, type RGBA } from './fragment';

/**
 * The current raster position (2.13): window coordinates, and the colour and texture coordinates
 * it took from the current values when it was set. It is invalid when its vertex fell outside the
 * clip volume; glBitmap then draws nothing and doesn't move it.
 */
export interface RasterPos {
  valid: boolean;
  x: number;
  y: number;
  z: number;
  color: RGBA;
  tex: [number, number];
}

export function initialRasterPos(): RasterPos {
  return { valid: true, x: 0, y: 0, z: 0, color: [1, 1, 1, 1], tex: [0, 0] };
}

/**
 * glBitmap (3.7) with the unpacking GLUT sets for its fonts: `height` rows of ⌈width / 8⌉ bytes,
 * bottom row first, most significant bit leftmost. Each set bit is a fragment at
 * (⌊x − xorig⌋ + i, ⌊y − yorig⌋ + j) in the raster position's colour and texture coordinates;
 * then the position moves by (xmove, ymove).
 */
export function drawBitmap(
  fb: Framebuffer,
  state: RasterState,
  pos: RasterPos,
  width: number,
  height: number,
  xorig: number,
  yorig: number,
  xmove: number,
  ymove: number,
  bits: Uint8Array | null,
): void {
  if (!pos.valid) return;
  if (bits && width > 0 && height > 0) {
    const box = fragmentBox(fb, state.scissor);
    const x0 = Math.floor(pos.x - xorig);
    const y0 = Math.floor(pos.y - yorig);
    const rowBytes = Math.ceil(width / 8);
    // Only the rows and columns that can land on the window are read.
    for (let j = Math.max(0, box.y0 - y0); j < Math.min(height, box.y1 - y0); j++) {
      for (let i = Math.max(0, box.x0 - x0); i < Math.min(width, box.x1 - x0); i++) {
        const byte = bits[j * rowBytes + (i >> 3)] ?? 0;
        if (byte & (0x80 >> (i & 7))) emitFragment(fb, state, box, x0 + i, y0 + j, pos.color, pos.tex);
      }
    }
  }
  pos.x += xmove;
  pos.y += ymove;
}
