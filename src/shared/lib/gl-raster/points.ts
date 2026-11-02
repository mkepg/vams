import { pointTriangles } from '@/shared/lib/gl-geometry';
import { fragmentBox } from './clip';
import type { Framebuffer } from './framebuffer';
import { emitFragment, type RasterState, type WinVertex } from './fragment';
import { fillTriangle } from './polygons';

/**
 * A point. Without multisampling it is a square of pixels, the size rounded to an integer: odd
 * sizes centre on (⌊xw⌋ + ½, ⌊yw⌋ + ½), even sizes on (⌊xw + ½⌋, ⌊yw + ½⌋) (3.3.1). With it, the
 * square of `pointSize` that gl-geometry builds covers samples. Every fragment takes the vertex's data.
 */
export function rasterPoint(fb: Framebuffer, v: WinVertex, state: RasterState): void {
  const box = fragmentBox(fb, state.scissor);
  if (state.multisample) {
    const { positions } = pointTriangles([v], state.pointSize);
    const corner = (i: number): WinVertex => ({ ...v, x: positions[i * 2], y: positions[i * 2 + 1] });
    for (let i = 0; i < positions.length / 2; i += 3) fillTriangle(fb, state, box, corner(i), corner(i + 1), corner(i + 2), false);
    return;
  }
  const size = Math.max(1, Math.round(state.pointSize));
  const x0 = size % 2 ? Math.floor(v.x) - (size - 1) / 2 : Math.floor(v.x + 0.5) - size / 2;
  const y0 = size % 2 ? Math.floor(v.y) - (size - 1) / 2 : Math.floor(v.y + 0.5) - size / 2;
  for (let y = y0; y < y0 + size; y++) {
    for (let x = x0; x < x0 + size; x++) emitFragment(fb, state, box, x, y, v.color, v.tex);
  }
}
