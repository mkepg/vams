import { fragmentBox } from './clip';
import { SAMPLE_OFFSETS, type Framebuffer } from './framebuffer';
import { drawable, emitFragment, type RasterState, type WinVertex } from './fragment';

// The widest aliased point. The reference driver's range isn't documented; 64 is close to Mesa's.
export const MAX_POINT_SIZE = 64;

/**
 * A point. Without multisampling it is a square of pixels, the size rounded to an integer up to
 * MAX_POINT_SIZE: odd sizes centre on (⌊xw⌋ + ½, ⌊yw⌋ + ½), even sizes on (⌊xw + ½⌋, ⌊yw + ½⌋)
 * (3.3.1). With it, the point is a circle as wide as its size, up to MAX_POINT_SIZE, centred on the
 * vertex, and covers the samples inside it (3.3.3). Every fragment takes the vertex's data.
 */
export function rasterPoint(fb: Framebuffer, v: WinVertex, state: RasterState): void {
  if (!drawable(v)) return;
  const box = fragmentBox(fb, state.scissor);
  if (state.multisample) {
    const r = Math.min(MAX_POINT_SIZE, Math.max(0, state.pointSize)) / 2;
    for (let y = Math.floor(v.y - r); y <= Math.floor(v.y + r); y++) {
      for (let x = Math.floor(v.x - r); x <= Math.floor(v.x + r); x++) {
        let coverage = 0;
        for (let k = 0; k < SAMPLE_OFFSETS.length; k++) {
          const dx = x + 0.5 + SAMPLE_OFFSETS[k][0] - v.x;
          const dy = y + 0.5 + SAMPLE_OFFSETS[k][1] - v.y;
          if (dx * dx + dy * dy < r * r) coverage |= 1 << k;
        }
        if (coverage) emitFragment(fb, state, box, x, y, v.color, v.tex, coverage);
      }
    }
    return;
  }
  const size = Math.min(MAX_POINT_SIZE, Math.max(1, Math.round(state.pointSize)));
  const x0 = size % 2 ? Math.floor(v.x) - (size - 1) / 2 : Math.floor(v.x + 0.5) - size / 2;
  const y0 = size % 2 ? Math.floor(v.y) - (size - 1) / 2 : Math.floor(v.y + 0.5) - size / 2;
  for (let y = y0; y < y0 + size; y++) {
    for (let x = x0; x < x0 + size; x++) emitFragment(fb, state, box, x, y, v.color, v.tex);
  }
}
