import { advanceStipple, segmentTriangles, type Triangles } from '@/shared/lib/gl-geometry';
import { fragmentBox } from './clip';
import type { Framebuffer } from './framebuffer';
import { drawable, emitFragment, type RasterState, type RGBA, type WinVertex } from './fragment';
import { fillTriangle } from './polygons';

// Endpoints are snapped to 1/65536 of a pixel, so a coordinate the transforms leave a rounding
// error away from a pixel edge or centre lands on it, and the tie rules below decide it.
const SNAP = 2 ** 16;
const snap = (c: number) => Math.round(c * SNAP) / SNAP;

// The widest line, as the reference Intel driver reports it (GL_ALIASED_LINE_WIDTH_RANGE 1 to 2047).
export const MAX_LINE_WIDTH = 2047;

/** A width rounded to the nearest whole pixel, a half up, as the reference Intel driver rounds it (4.5 is 5). */
function roundWidth(w: number): number {
  return Math.floor(w + 0.5);
}

/**
 * Whether the segment p → q meets pixel (cx, cy)'s diamond |x − cx| + |y − cy| < ½, as the reference
 * Intel driver bounds it: open at its two upper edges, closed at its two lower ones. Each edge's
 * half-plane cuts t ∈ [0, 1] down; a closed one keeps its bound, an open one drops it.
 */
function meetsDiamond(px: number, py: number, qx: number, qy: number, cx: number, cy: number): boolean {
  let lo = 0;
  let hi = 1;
  let loOpen = false;
  let hiOpen = false;
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) {
      // The edge sx(x − cx) + sy(y − cy) = ½; sy = −1 are the lower edges, which are closed.
      const open = sy === 1;
      const g0 = sx * (px - cx) + sy * (py - cy);
      const k = sx * (qx - px) + sy * (qy - py);
      if (k === 0) {
        if (open ? g0 >= 0.5 : g0 > 0.5) return false;
        continue;
      }
      const t = (0.5 - g0) / k;
      if (k > 0) {
        if (t < hi || (t === hi && open)) [hi, hiOpen] = [t, open || (t === hi && hiOpen)];
      } else if (t > lo || (t === lo && open)) [lo, loOpen] = [t, open || (t === lo && loOpen)];
    }
  }
  return lo < hi || (lo === hi && !loOpen && !hiOpen);
}

/** Whether point (x, y) lies on the segment p → q, exactly. */
function onSegment(px: number, py: number, qx: number, qy: number, x: number, y: number): boolean {
  const dx = qx - px;
  const dy = qy - py;
  if (dx * (y - py) - dy * (x - px) !== 0) return false;
  const t = (x - px) * dx + (y - py) * dy;
  return t >= 0 && t <= dx * dx + dy * dy;
}

/**
 * The fragments of a width-1 segment by the diamond-exit rule, in order from a to b: each pixel
 * whose diamond the segment meets, unless b lies in it (3.4.1). The diamond is open, apart from two
 * of its corners, which settle a segment that only touches corners or ends on one. These are the
 * corners the reference Intel driver takes: the bottom one and, for an x-major segment, the one the
 * segment comes from (left when it runs right); the bottom and right ones for a y-major segment. An
 * end on the diamond's two lower edges counts as inside it, so that pixel is the segment's last and
 * left out. An exact 45° segment is y-major.
 * An x-major segment has at most one fragment a column, on the row its line crosses the column's
 * centre, so only that row and its neighbours are tried; a y-major one is the same with x and y
 * swapped.
 */
function diamondExit(ax: number, ay: number, bx: number, by: number): [number, number][] {
  const out: [number, number][] = [];
  [ax, ay, bx, by] = [snap(ax), snap(ay), snap(bx), snap(by)];
  const xMajor = Math.abs(bx - ax) > Math.abs(by - ay);
  const corners: [number, number][] = xMajor ? [[0, -0.5], [bx > ax ? -0.5 : 0.5, 0]] : [[0, -0.5], [0.5, 0]];
  const inside = (x: number, y: number, cx: number, cy: number) =>
    Math.abs(x - cx) + Math.abs(y - cy) < 0.5 || corners.some(([ox, oy]) => x === cx + ox && y === cy + oy);
  // In (u, v) the major axis is u.
  const [pu, pv, qu, qv] = xMajor ? [ax, ay, bx, by] : [ay, ax, by, bx];
  if (pu === qu) return out;
  const step = qu > pu ? 1 : -1;
  const first = Math.floor(pu) - step;
  const last = Math.floor(qu) + step;
  for (let u = first; u !== last + step; u += step) {
    const cu = u + 0.5;
    const row = Math.floor(pv + ((cu - pu) * (qv - pv)) / (qu - pu));
    for (let v = row - 1; v <= row + 1; v++) {
      const [cx, cy] = xMajor ? [cu, v + 0.5] : [v + 0.5, cu];
      // b ends the segment in this pixel when it is inside the diamond, or on its two lower edges.
      if (inside(bx, by, cx, cy) || (by < cy && Math.abs(bx - cx) + Math.abs(by - cy) === 0.5)) continue;
      if (meetsDiamond(ax, ay, bx, by, cx, cy) || corners.some(([ox, oy]) => onSegment(ax, ay, bx, by, cx + ox, cy + oy))) {
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
 * Segment a → b. Without multisampling, width rounded to an integer up to MAX_LINE_WIDTH: a width-1
 * segment is its diamond-exit fragments, each kept or dropped by the stipple bit (3.4.1, 3.4.2). A
 * wider one is, as the reference Intel driver draws it, the parallelogram w across the minor axis
 * with ends square to the major axis, filled at pixel centres by the polygon rules (ties to its top
 * and left edges), each column kept or dropped by its stipple bit. With multisampling, the
 * rectangle or stipple pieces gl-geometry builds, the pattern counted per column of the major axis
 * as the editor counts it, cover samples (3.4.4). Data are perspective-correct (eq. 3.4). The
 * stipple counter moves on once per fragment of the major axis, carried in `state.stipple.counter`.
 */
export function rasterLine(fb: Framebuffer, a: WinVertex, b: WinVertex, state: RasterState): void {
  if (!drawable(a) || !drawable(b)) return;
  const box = fragmentBox(fb, state.scissor);
  const w = Math.min(MAX_LINE_WIDTH, Math.max(1, roundWidth(state.lineWidth)));
  if (state.multisample || w > 1) {
    const { enabled, factor, pattern } = state.stipple;
    const out: Triangles = { positions: [], colors: [] };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return;
    const axisEnds = !state.multisample;
    const width = state.multisample ? state.lineWidth : w;
    const moved = segmentTriangles(out, a, b, width, null, enabled ? { factor, pattern } : null, state.stipple.counter, axisEnds);
    if (enabled) state.stipple.counter = advanceStipple(state.stipple.counter, moved, factor);
    const xMajor = Math.abs(dx) >= Math.abs(dy);
    const corner = (i: number): WinVertex => {
      const x = out.positions[i * 2];
      const y = out.positions[i * 2 + 1];
      // t of the corner's projection onto the segment (eq. 3.3); for the parallelogram, its place
      // along the major axis, which the ends' columns share.
      const t = axisEnds ? (xMajor ? (x - a.x) / dx : (y - a.y) / dy) : ((x - a.x) * dx + (y - a.y) * dy) / len2;
      // eq. 3.4: t weighted by each end's 1/w.
      const tw = axisEnds ? t / b.w / ((1 - t) / a.w + t / b.w) : t;
      return { x, y, z: a.z + (b.z - a.z) * t, w: 1, ...along(state, a, b, tw) };
    };
    for (let i = 0; i < out.positions.length / 2; i += 3) fillTriangle(fb, state, box, corner(i), corner(i + 1), corner(i + 2), false);
    return;
  }

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
