import { lineSegments, type LineMode } from '@/shared/lib/gl-geometry';
import type { Framebuffer } from './framebuffer';
import type { RasterState, RGBA, TextureUnit, WinVertex } from './fragment';
import { rasterLine } from './lines';
import { rasterPoint } from './points';
import { rasterPolygon } from './polygons';

/** A processed vertex: clip coordinates, its clamped colour and its texture coordinates. */
export interface ClipVertex {
  x: number;
  y: number;
  z: number;
  w: number;
  color: RGBA;
  tex: [number, number];
}

/** glViewport's rectangle, and the depth range's initial 0..1. */
export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What a primitive is drawn into: the framebuffer, the GL state, and the texture for a level of detail. */
export interface Target {
  fb: Framebuffer;
  state: RasterState;
  viewport: Viewport;
  /** The bound texture's image and filter for level of detail λ, or null when texturing is off. */
  texture: ((lambda: number) => TextureUnit) | null;
}

export const GL_MODE = {
  POINTS: 0,
  LINES: 1,
  LINE_LOOP: 2,
  LINE_STRIP: 3,
  TRIANGLES: 4,
  TRIANGLE_STRIP: 5,
  TRIANGLE_FAN: 6,
  QUADS: 7,
  QUAD_STRIP: 8,
  POLYGON: 9,
} as const;

/** One polygon of a Begin/End object: its vertices in order, its FLAT vertex and its fill split. */
export interface PolygonPiece {
  vertices: number[];
  /** Index into `vertices` of the vertex whose colour FLAT shading takes (Table 2.12). */
  provoking: number;
  /** The triangles FILL draws, as indices into `vertices`; a fan from vertex 0 when absent. */
  split?: [number, number, number][];
}

// The split the reference driver uses for a quad: 0-1-3 and 1-2-3.
const QUAD_SPLIT: [number, number, number][] = [
  [0, 1, 3],
  [1, 2, 3],
];
// A quad strip's quad 2i, 2i+1, 2i+3, 2i+2 split the same way: 2i-2i+1-2i+3 and 2i-2i+3-2i+2.
const QUAD_STRIP_SPLIT: [number, number, number][] = [
  [0, 1, 2],
  [0, 2, 3],
];

/**
 * The polygons a Begin/End object of `mode` with `n` vertices makes (2.6.1). A strip's triangle
 * takes vertex A, vertex B and the new vertex in that order, so every triangle keeps the first
 * one's facing; FLAT takes the vertex Table 2.12 gives. Leftover vertices make nothing.
 */
export function polygonPieces(mode: number, n: number): PolygonPiece[] {
  const out: PolygonPiece[] = [];
  switch (mode) {
    case GL_MODE.TRIANGLES:
      for (let i = 0; i + 2 < n; i += 3) out.push({ vertices: [i, i + 1, i + 2], provoking: 2 });
      break;
    case GL_MODE.TRIANGLE_STRIP:
      for (let i = 0; i + 2 < n; i++) out.push({ vertices: i % 2 ? [i + 1, i, i + 2] : [i, i + 1, i + 2], provoking: 2 });
      break;
    case GL_MODE.TRIANGLE_FAN:
      for (let i = 1; i + 1 < n; i++) out.push({ vertices: [0, i, i + 1], provoking: 2 });
      break;
    case GL_MODE.QUADS:
      for (let i = 0; i + 3 < n; i += 4) out.push({ vertices: [i, i + 1, i + 2, i + 3], provoking: 3, split: QUAD_SPLIT });
      break;
    case GL_MODE.QUAD_STRIP:
      for (let i = 0; i + 3 < n; i += 2) out.push({ vertices: [i, i + 1, i + 3, i + 2], provoking: 2, split: QUAD_STRIP_SPLIT });
      break;
    case GL_MODE.POLYGON:
      if (n >= 3) out.push({ vertices: Array.from({ length: n }, (_, i) => i), provoking: 0 });
      break;
  }
  return out;
}

const LINE_MODES: Record<number, LineMode> = {
  [GL_MODE.LINES]: 'LINES',
  [GL_MODE.LINE_STRIP]: 'LINE_STRIP',
  [GL_MODE.LINE_LOOP]: 'LINE_LOOP',
};

const finite = (v: ClipVertex) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z) && Number.isFinite(v.w);

/** The six clip planes as distances that are ≥ 0 inside the volume −w ≤ x, y, z ≤ w (2.12). */
const PLANES: ((v: ClipVertex) => number)[] = [
  (v) => v.w + v.x,
  (v) => v.w - v.x,
  (v) => v.w + v.y,
  (v) => v.w - v.y,
  (v) => v.w + v.z,
  (v) => v.w - v.z,
];

export function insideVolume(v: ClipVertex): boolean {
  return finite(v) && PLANES.every((d) => d(v) >= 0);
}

/** The vertex at t from a to b, every value linear in clip coordinates (2.12, 2.14.8), taken from the nearer end. */
function lerp(a: ClipVertex, b: ClipVertex, t: number): ClipVertex {
  const m = t <= 0.5 ? (p: number, q: number) => p + (q - p) * t : (p: number, q: number) => q + (p - q) * (1 - t);
  return {
    x: m(a.x, b.x),
    y: m(a.y, b.y),
    z: m(a.z, b.z),
    w: m(a.w, b.w),
    color: [m(a.color[0], b.color[0]), m(a.color[1], b.color[1]), m(a.color[2], b.color[2]), m(a.color[3], b.color[3])],
    tex: [m(a.tex[0], b.tex[0]), m(a.tex[1], b.tex[1])],
  };
}

/**
 * A clipped vertex put onto the volume. Rounding can leave a cut a little outside it, and far
 * outside when the ends are huge; this keeps window coordinates inside the viewport.
 */
function onVolume(v: ClipVertex): ClipVertex {
  const c = (k: number) => Math.min(v.w, Math.max(-v.w, k));
  return { ...v, x: c(v.x), y: c(v.y), z: c(v.z) };
}

/** A segment cut to the clip volume, or null when none of it is inside. */
export function clipSegment(a: ClipVertex, b: ClipVertex): [ClipVertex, ClipVertex] | null {
  if (!finite(a) || !finite(b)) return null;
  let t0 = 0;
  let t1 = 1;
  for (const d of PLANES) {
    const da = d(a);
    const db = d(b);
    if (da < 0 && db < 0) return null;
    if (da < 0) t0 = Math.max(t0, da / (da - db));
    else if (db < 0) t1 = Math.min(t1, da / (da - db));
  }
  if (t0 > t1) return null;
  return [t0 > 0 ? onVolume(lerp(a, b, t0)) : a, t1 < 1 ? onVolume(lerp(a, b, t1)) : b];
}

/** A convex polygon cut to the clip volume one plane at a time; fewer than 3 vertices means none is left. */
export function clipPolygon(vertices: readonly ClipVertex[]): ClipVertex[] {
  if (!vertices.every(finite)) return [];
  let poly = [...vertices];
  for (const d of PLANES) {
    if (poly.length === 0) break;
    const next: ClipVertex[] = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const dp = d(p);
      const dq = d(q);
      if (dp >= 0) next.push(p);
      if ((dp >= 0) !== (dq >= 0)) next.push(lerp(p, q, dp / (dp - dq)));
    }
    poly = next;
  }
  return poly.length >= 3 ? poly.map(onVolume) : [];
}

/** Clip coordinates to window coordinates: the perspective divide, then the viewport (2.11.1). */
export function toWindow(v: ClipVertex, vp: Viewport): WinVertex {
  return {
    x: (v.x / v.w + 1) * (vp.width / 2) + vp.x,
    y: (v.y / v.w + 1) * (vp.height / 2) + vp.y,
    z: (v.z / v.w + 1) / 2,
    w: v.w,
    color: v.color,
    tex: v.tex,
  };
}

const withColor = (v: ClipVertex, color: RGBA): ClipVertex => ({ ...v, color });

/** The state for one primitive: the texture image and filter for its level of detail, or none. */
function stateFor(t: Target, lambda: number): RasterState {
  return t.texture ? { ...t.state, texture: t.texture(lambda) } : t.state;
}

/** λ = log₂ ρ of a triangle's affine texture mapping (eq. 3.17), in texels of `size` per window pixel. */
function triangleLambda(a: WinVertex, b: WinVertex, c: WinVertex, size: [number, number]): number {
  const det = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
  if (det === 0 || !a.tex || !b.tex || !c.tex) return -Infinity;
  const grad = (k: 0 | 1) => {
    const d1 = b.tex![k] - a.tex![k];
    const d2 = c.tex![k] - a.tex![k];
    return [((d1 * (c.y - a.y) - d2 * (b.y - a.y)) / det) * size[k], ((d2 * (b.x - a.x) - d1 * (c.x - a.x)) / det) * size[k]];
  };
  const [ux, uy] = grad(0);
  const [vx, vy] = grad(1);
  return Math.log2(Math.max(Math.hypot(ux, vx), Math.hypot(uy, vy)));
}

/** λ of a segment (eq. 3.18): texels moved per window pixel along it. */
function segmentLambda(a: WinVertex, b: WinVertex, size: [number, number]): number {
  const l = Math.hypot(b.x - a.x, b.y - a.y);
  if (l === 0 || !a.tex || !b.tex) return -Infinity;
  return Math.log2(Math.hypot((b.tex[0] - a.tex[0]) * size[0], (b.tex[1] - a.tex[1]) * size[1]) / l);
}

/** The bound texture's level-0 size, which λ measures in. */
function textureSize(t: Target): [number, number] {
  const unit = t.texture?.(-Infinity);
  return unit ? [unit.width, unit.height] : [1, 1];
}

/** A segment clipped, mapped to the window and rasterised; the stipple counter carries on in `t.state`. */
function drawSegment(t: Target, a: ClipVertex, b: ClipVertex, size: [number, number]): void {
  const clipped = clipSegment(a, b);
  if (!clipped) return;
  const wa = toWindow(clipped[0], t.viewport);
  const wb = toWindow(clipped[1], t.viewport);
  rasterLine(t.fb, wa, wb, stateFor(t, segmentLambda(wa, wb, size)));
}

/** A point, drawn only when its vertex is inside the clip volume (2.12). */
function drawPoint(t: Target, v: ClipVertex): void {
  if (insideVolume(v)) rasterPoint(t.fb, toWindow(v, t.viewport), stateFor(t, -Infinity));
}

/** Twice the signed area of a polygon in window coordinates (eq. 2.6). */
function area(vs: readonly WinVertex[]): number {
  let sum = 0;
  for (let i = 0; i < vs.length; i++) {
    const p = vs[i];
    const q = vs[(i + 1) % vs.length];
    sum += p.x * q.y - q.x * p.y;
  }
  return sum;
}

const FILL_ONLY = { front: 'FILL', back: 'FILL' } as const;
const NO_CULL = { enabled: false, mode: 'BACK' } as const;

/**
 * One polygon. Its facing comes from the clipped polygon's area and decides culling and the
 * polygon mode (3.5.1, 3.5.4). POINT draws the original vertices inside the volume; LINE draws the
 * original edges, each clipped as a segment, with the stipple counter restarting at the first; FILL
 * clips each triangle of the split and fills it. FLAT colours every vertex with the provoking one.
 */
function drawPolygon(t: Target, all: readonly ClipVertex[], piece: PolygonPiece, size: [number, number]): void {
  const flat = t.state.shadeModel === 'FLAT' ? all[piece.vertices[piece.provoking]].color : null;
  const vs = piece.vertices.map((i) => (flat ? withColor(all[i], flat) : all[i]));
  const whole = clipPolygon(vs).map((v) => toWindow(v, t.viewport));
  if (whole.length === 0) return;
  const a = area(whole);
  const front = t.state.frontFace === 'CCW' ? a > 0 : a < 0;
  const { enabled, mode } = t.state.cullFace;
  if (enabled && (mode === 'FRONT_AND_BACK' || (mode === 'FRONT') === front)) return;
  const polygonMode = front ? t.state.polygonMode.front : t.state.polygonMode.back;
  if (polygonMode === 'POINT') {
    for (const v of vs) drawPoint(t, v);
    return;
  }
  if (polygonMode === 'LINE') {
    t.state.stipple.counter = 0;
    for (let i = 0; i < vs.length; i++) drawSegment(t, vs[i], vs[(i + 1) % vs.length], size);
    return;
  }
  const split = piece.split ?? Array.from({ length: vs.length - 2 }, (_, i): [number, number, number] => [0, i + 1, i + 2]);
  for (const [i, j, k] of split) {
    const tri = clipPolygon([vs[i], vs[j], vs[k]]).map((v) => toWindow(v, t.viewport));
    if (tri.length === 0) continue;
    const state = { ...stateFor(t, triangleLambda(tri[0], tri[1], tri[2], size)), polygonMode: FILL_ONLY, cullFace: NO_CULL };
    rasterPolygon(t.fb, tri, state, 0);
  }
}

/**
 * A Begin/End object of `mode` from its processed vertices: assembled into points, segments or
 * polygons (2.6.1), clipped to the volume (2.12) and rasterised (3.3 to 3.5). The stipple counter
 * restarts at the start, and for every GL_LINES segment, but runs on through a strip or loop.
 */
export function drawPrimitive(t: Target, mode: number, vs: readonly ClipVertex[]): void {
  t.state.stipple.counter = 0;
  const size = textureSize(t);
  if (mode === GL_MODE.POINTS) {
    for (const v of vs) drawPoint(t, v);
    return;
  }
  const lineMode = LINE_MODES[mode];
  if (lineMode) {
    for (const seg of lineSegments(lineMode, vs.length)) {
      if (seg.resetsStipple) t.state.stipple.counter = 0;
      const flat = t.state.shadeModel === 'FLAT' ? vs[seg.provoking].color : null;
      const a = flat ? withColor(vs[seg.a], flat) : vs[seg.a];
      const b = flat ? withColor(vs[seg.b], flat) : vs[seg.b];
      drawSegment(t, a, b, size);
    }
    return;
  }
  for (const piece of polygonPieces(mode, vs.length)) drawPolygon(t, vs, piece, size);
}
