import { segmentTriangles, type Triangles } from '@/shared/lib/gl-geometry';
import { fragmentBox } from './clip';
import type { Framebuffer } from './framebuffer';
import { drawable, emitFragment, type RasterState, type RGBA, type WinVertex } from './fragment';
import { fillTriangle } from './polygons';

// The endpoints move by (−ε, −ε²) so none lies on a diamond's edge (3.4.1). ε is small next to a
// pixel and ε² still well above a double's rounding at window sizes.
const EPS = 2 ** -16;
const EPS2 = 2 ** -32;

// The widest aliased line. The reference driver's range isn't documented; 10 is Mesa's.
const MAX_LINE_WIDTH = 10;

/**
 * Whether the segment p → q meets the open diamond |x − cx| + |y − cy| < ½: the four half-planes
 * cut t ∈ [0, 1] down to an open interval, which must be left non-empty.
 */
function meetsDiamond(px: number, py: number, qx: number, qy: number, cx: number, cy: number): boolean {
  let lo = -Infinity;
  let hi = Infinity;
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) {
      const g0 = sx * (px - cx) + sy * (py - cy);
      const k = sx * (qx - px) + sy * (qy - py);
      if (k === 0) {
        if (g0 >= 0.5) return false;
      } else if (k > 0) {
        hi = Math.min(hi, (0.5 - g0) / k);
      } else {
        lo = Math.max(lo, (0.5 - g0) / k);
      }
    }
  }
  return lo < hi && lo < 1 && hi > 0;
}

/**
 * The fragments of a width-1 segment by the diamond-exit rule, in order from a to b: each pixel
 * whose diamond the segment meets, unless b lies in it (3.4.1). An x-major segment has at most one
 * a column, on the row its line crosses the column's centre, so only that row and its neighbours
 * are tried; a y-major one is the same with x and y swapped.
 */
function diamondExit(ax: number, ay: number, bx: number, by: number): [number, number][] {
  const out: [number, number][] = [];
  const xMajor = Math.abs(bx - ax) >= Math.abs(by - ay);
  // In (u, v) the major axis is u.
  const [pu, pv, qu, qv] = xMajor ? [ax - EPS, ay - EPS2, bx - EPS, by - EPS2] : [ay - EPS2, ax - EPS, by - EPS2, bx - EPS];
  if (pu === qu) return out;
  const step = qu > pu ? 1 : -1;
  const first = Math.floor(pu) - step;
  const last = Math.floor(qu) + step;
  for (let u = first; u !== last + step; u += step) {
    const cu = u + 0.5;
    const row = Math.floor(pv + ((cu - pu) * (qv - pv)) / (qu - pu));
    for (let v = row - 1; v <= row + 1; v++) {
      const cv = v + 0.5;
      if (Math.abs(qu - cu) + Math.abs(qv - cv) < 0.5) continue;
      if (meetsDiamond(pu, pv, qu, qv, cu, cv)) {
        out.push(xMajor ? [u, v] : [v, u]);
        break;
      }
    }
  }
  return out;
}

/** Whether fragment `s` of the stipple counter is drawn (3.4.2). */
function stippled(state: RasterState, s: number): boolean {
  const { enabled, factor, pattern } = state.stipple;
  if (!enabled) return true;
  const r = Math.min(256, Math.max(1, Math.round(factor)));
  return ((pattern >> (Math.floor(s / r) % 16)) & 1) === 1;
}

function lerpColor(a: RGBA, b: RGBA, t: number): RGBA {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
}

/** The colour and texture coordinates at t from a to b, linearly (eq. 3.5); FLAT keeps b's colour. */
function along(state: RasterState, a: WinVertex, b: WinVertex, t: number): Pick<WinVertex, 'color' | 'tex'> {
  const color = state.shadeModel === 'FLAT' ? b.color : lerpColor(a.color, b.color, t);
  const tex: [number, number] | undefined =
    a.tex && b.tex ? [a.tex[0] + (b.tex[0] - a.tex[0]) * t, a.tex[1] + (b.tex[1] - a.tex[1]) * t] : undefined;
  return { color, tex };
}

/**
 * Segment a → b. Without multisampling: width rounded to an integer up to MAX_LINE_WIDTH, the
 * segment moved (w − 1)/2 down (x-major) or left (y-major), and each diamond-exit fragment of the moved segment
 * the first of w in the minor direction, the whole column kept or dropped by the stipple bit (3.4.2).
 * Data are perspective-correct (eq. 3.4) at each fragment's centre. With multisampling, the
 * rectangle or stipple pieces gl-geometry builds cover samples (3.4.4). Either way the stipple
 * counter moves on once per fragment of the major axis, carried in `state.stipple.counter`.
 */
export function rasterLine(fb: Framebuffer, a: WinVertex, b: WinVertex, state: RasterState): void {
  if (!drawable(a) || !drawable(b)) return;
  const box = fragmentBox(fb, state.scissor);
  if (state.multisample) {
    const { enabled, factor, pattern } = state.stipple;
    const out: Triangles = { positions: [], colors: [] };
    state.stipple.counter += segmentTriangles(out, a, b, state.lineWidth, null, enabled ? { factor, pattern } : null, state.stipple.counter);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const corner = (i: number): WinVertex => {
      const x = out.positions[i * 2];
      const y = out.positions[i * 2 + 1];
      // t of the corner's projection onto the segment (eq. 3.3).
      const t = ((x - a.x) * dx + (y - a.y) * dy) / len2;
      return { x, y, z: a.z + (b.z - a.z) * t, w: 1, ...along(state, a, b, t) };
    };
    for (let i = 0; i < out.positions.length / 2; i += 3) fillTriangle(fb, state, box, corner(i), corner(i + 1), corner(i + 2), false);
    return;
  }

  const w = Math.min(MAX_LINE_WIDTH, Math.max(1, Math.round(state.lineWidth)));
  const xMajor = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  const shift = (w - 1) / 2;
  const ax = xMajor ? a.x : a.x - shift;
  const ay = xMajor ? a.y - shift : a.y;
  const bx = xMajor ? b.x : b.x - shift;
  const by = xMajor ? b.y - shift : b.y;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  for (const [fx, fy] of diamondExit(ax, ay, bx, by)) {
    const s = state.stipple.counter++;
    if (!stippled(state, s)) continue;
    const t = Math.min(1, Math.max(0, ((fx + 0.5 - ax) * dx + (fy + 0.5 - ay) * dy) / len2));
    // eq. 3.4: t weighted by each end's 1/w.
    const tw = t / b.w / ((1 - t) / a.w + t / b.w);
    const { color, tex } = along(state, a, b, tw);
    for (let k = 0; k < w; k++) {
      if (xMajor) emitFragment(fb, state, box, fx, fy + k, color, tex);
      else emitFragment(fb, state, box, fx + k, fy, color, tex);
    }
  }
}
