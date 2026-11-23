/**
 * Points, lines and filled primitives as triangles, by the OpenGL 1.5 rules for a multisampled
 * window (specification 3.3 to 3.5), as the reference Intel driver draws them: a point is a square
 * whose side is its size rounded half up, a line segment is a rectangle as long as the segment with
 * no caps or joins, stipple counts the pattern of 3.4.2 once per pixel column of the major axis, and
 * FLAT shading takes the provoking vertex of Table 2.12.
 *
 * Coordinates are whatever space the caller works in. Width, size and stipple are in window
 * pixels, so lines and points are built from window coordinates. Nothing here imports from
 * outside this folder.
 */

/** Red, green, blue and alpha, each 0 to 1. */
export type Rgba = readonly [number, number, number, number];

export interface GeoVertex {
  readonly x: number;
  readonly y: number;
  readonly color: Rgba;
}

/** Unindexed triangles: two numbers per vertex in `positions`, four in `colors`, three vertices each. */
export interface Triangles {
  positions: number[];
  colors: number[];
}

export type Shade = 'FLAT' | 'SMOOTH';
export type LineMode = 'LINES' | 'LINE_STRIP' | 'LINE_LOOP';
export type FillMode = 'TRIANGLES' | 'TRIANGLE_STRIP' | 'TRIANGLE_FAN' | 'QUADS' | 'QUAD_STRIP' | 'POLYGON';

export interface Stipple {
  factor: number;
  pattern: number;
}

/** The size the generated program gives every point (glPointSize(8.0f)). */
export const POINT_SIZE = 8;

/** The stipple counter wraps after 16 bits. */
const PATTERN_BITS = 16;

const empty = (): Triangles => ({ positions: [], colors: [] });

// `+ 0` turns -0 into 0, so equal shapes compare equal.
function push(out: Triangles, x: number, y: number, color: Rgba): void {
  out.positions.push(x + 0, y + 0);
  out.colors.push(color[0], color[1], color[2], color[3]);
}

function lerp(a: Rgba, b: Rgba, t: number): Rgba {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
}

/** A multisampled point's side, as the reference driver takes it: rounded half up, 1 to 255. */
export function pointSide(size: number): number {
  return Math.min(255, Math.max(1, Math.floor(size + 0.5)));
}

/** Each point as a square of side pointSide(size), centred on it, in its own colour. */
export function pointTriangles(vertices: readonly GeoVertex[], size: number): Triangles {
  const out = empty();
  const h = pointSide(size) / 2;
  for (const { x, y, color } of vertices) {
    push(out, x - h, y - h, color);
    push(out, x + h, y - h, color);
    push(out, x + h, y + h, color);
    push(out, x - h, y - h, color);
    push(out, x + h, y + h, color);
    push(out, x - h, y + h, color);
  }
  return out;
}

export interface Segment {
  a: number;
  b: number;
  /** The vertex whose colour a FLAT segment takes (Table 2.12). */
  provoking: number;
  /** GL_LINES restarts the stipple counter for every segment; strips and loops carry it on. */
  resetsStipple: boolean;
}

export function lineSegments(mode: LineMode, n: number): Segment[] {
  const out: Segment[] = [];
  if (mode === 'LINES') {
    for (let i = 0; i + 1 < n; i += 2) out.push({ a: i, b: i + 1, provoking: i + 1, resetsStipple: true });
    return out;
  }
  for (let i = 0; i + 1 < n; i++) out.push({ a: i, b: i + 1, provoking: i + 1, resetsStipple: i === 0 });
  if (mode === 'LINE_LOOP' && n >= 2) out.push({ a: n - 1, b: 0, provoking: 0, resetsStipple: false });
  return out;
}

/**
 * The stretches of the counter, from `start` to `start + length`, whose pattern bit is set. Bit
 * `⌊s / factor⌋ mod 16` decides fragment `s`; neighbouring set bits make one stretch.
 */
export function stippleRuns(start: number, length: number, factor: number, pattern: number): [number, number][] {
  const f = Math.min(256, Math.max(1, Math.round(factor)));
  const bits = pattern & 0xffff;
  const end = start + length;
  const runs: [number, number][] = [];
  let s = start;
  while (s < end) {
    const index = Math.floor(s / f);
    const next = Math.min(end, (index + 1) * f);
    if ((bits >> (index % PATTERN_BITS)) & 1) {
      const last = runs[runs.length - 1];
      if (last && last[1] === s) last[1] = next;
      else runs.push([s, next]);
    }
    s = next;
  }
  return runs;
}

/** Line segments as rectangles `width` wide, cut into dashes by `stipple` when it is set. */
export function lineTriangles(
  mode: LineMode,
  vertices: readonly GeoVertex[],
  width: number,
  shade: Shade,
  stipple: Stipple | null,
): Triangles {
  const out = empty();
  let counter = 0;
  for (const seg of lineSegments(mode, vertices.length)) {
    if (seg.resetsStipple) counter = 0;
    const flat = shade === 'FLAT' ? vertices[seg.provoking].color : null;
    const moved = segmentTriangles(out, vertices[seg.a], vertices[seg.b], width, flat, stipple, counter);
    if (stipple) counter = advanceStipple(counter, moved, stipple.factor);
  }
  return out;
}

/**
 * One segment's rectangle, or its stipple pieces with the counter starting at `counter`, added to
 * `out` in `flat` or, when it is null, the end colours blended. As the reference Intel driver draws
 * it, the counter moves on once per fragment of the major axis, as in aliased drawing (3.4.2), and
 * each pixel column (row, for a y-major segment) of the rectangle takes the pattern bit of its own
 * fragment: a piece is the rectangle cut to whole columns, so its ends are the segment's ends and
 * its cuts are square to the major axis. A column the rectangle reaches before the first fragment
 * takes the first fragment's bit; one after the last reads the bit its place in the count gives.
 * With `axisEnds`, the shape is the parallelogram an aliased wide line fills instead: `width`
 * across the minor axis, its ends square to the major axis. Returns how far the counter moves: the
 * segment's fragments.
 */
export function segmentTriangles(
  out: Triangles,
  A: GeoVertex,
  B: GeoVertex,
  width: number,
  flat: Rgba | null,
  stipple: Stipple | null,
  counter: number,
  axisEnds = false,
): number {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return 0;
  const len = Math.sqrt(len2);
  const frags = fragmentColumns(A, B);
  const [nx, ny] = axisEnds
    ? frags.xMajor ? [0, width / 2] : [-width / 2, 0]
    : [(-dy / len) * (width / 2), (dx / len) * (width / 2)];
  const rect: [number, number][] = [[A.x - nx, A.y - ny], [B.x - nx, B.y - ny], [B.x + nx, B.y + ny], [A.x + nx, A.y + ny]];
  const colorAt = (x: number, y: number): Rgba => flat ?? lerp(A.color, B.color, ((x - A.x) * dx + (y - A.y) * dy) / len2);
  const fan = (poly: [number, number][]) => {
    for (let i = 1; i + 1 < poly.length; i++) {
      for (const [x, y] of [poly[0], poly[i], poly[i + 1]]) push(out, x, y, colorAt(x, y));
    }
  };
  if (!stipple) {
    fan(rect);
    return frags.count;
  }
  // The columns the rectangle reaches, as fragment indices from the first fragment.
  const major = rect.map(([x, y]) => (frags.xMajor ? x : y));
  const index = (m: number) => (frags.forward ? Math.floor(m) - frags.first : frags.first - Math.floor(m));
  const k0 = Math.min(...major.map(index));
  const k1 = Math.max(...major.map(index));
  // Columns before the first fragment take its bit, as the reference driver draws them.
  const runs = stippleRuns(counter, Math.max(1, k1 + 1), stipple.factor, stipple.pattern);
  for (const [s0, s1] of runs) {
    // Fragments a to b − 1 cover columns first + a to first + b (forward), or the mirror.
    const a = s0 === counter ? Math.min(0, k0) : s0 - counter;
    const b = s1 - counter;
    const lo = frags.forward ? frags.first + a : frags.first + 1 - b;
    const hi = frags.forward ? frags.first + b : frags.first + 1 - a;
    // A run past the rectangle's ends (the bit of the column after the last) covers nothing.
    if (hi <= Math.min(...major) || lo >= Math.max(...major)) continue;
    const piece = clipToSlab(rect, frags.xMajor ? 0 : 1, lo, hi);
    if (piece.length >= 3) fan(piece);
  }
  return frags.count;
}

/** The convex polygon `poly` cut to lo ≤ coordinate `axis` ≤ hi (Sutherland–Hodgman, two planes). */
function clipToSlab(poly: [number, number][], axis: 0 | 1, lo: number, hi: number): [number, number][] {
  const cut = (pts: [number, number][], keep: (v: number) => boolean, at: number): [number, number][] => {
    const res: [number, number][] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      const pin = keep(p[axis]);
      const qin = keep(q[axis]);
      if (pin) res.push(p);
      if (pin !== qin) {
        const t = (at - p[axis]) / (q[axis] - p[axis]);
        const x = p[0] + (q[0] - p[0]) * t;
        const y = p[1] + (q[1] - p[1]) * t;
        res.push(axis === 0 ? [at, y] : [x, at]);
      }
    }
    return res;
  };
  return cut(cut(poly, (v) => v >= lo, lo), (v) => v <= hi, hi);
}

/**
 * A segment's window fragments: one per pixel along the major axis whose centre lies on the
 * segment, first end included and last end left out (3.4.1). `first` is the first fragment's
 * column (row, when y is the major axis), and `forward` whether the segment runs up the axis.
 */
function fragmentColumns(A: GeoVertex, B: GeoVertex): { count: number; first: number; forward: boolean; xMajor: boolean } {
  const xMajor = Math.abs(B.x - A.x) >= Math.abs(B.y - A.y);
  const m0 = xMajor ? A.x : A.y;
  const m1 = xMajor ? B.x : B.y;
  const forward = m1 >= m0;
  // The first and last pixel whose centre (c + 0.5) is on the segment.
  const first = forward ? Math.ceil(m0 - 0.5) : Math.floor(m0 - 0.5);
  const last = forward ? Math.ceil(m1 - 0.5) - 1 : Math.floor(m1 - 0.5) + 1;
  const count = Math.max(0, forward ? last - first + 1 : first - last + 1);
  return { count, first, forward, xMajor };
}

/**
 * Where the stipple counter stands after moving `by` from `counter`. Only its place in the
 * pattern matters, so it is kept within one repeat of 16 × factor, and never grows large enough
 * to lose precision.
 */
export function advanceStipple(counter: number, by: number, factor: number): number {
  return (counter + by) % (PATTERN_BITS * Math.min(256, Math.max(1, Math.round(factor))));
}

/** The triangles of a filled primitive, each with the vertex that provokes its FLAT colour. */
function fillTriangles(mode: FillMode, n: number): { tri: [number, number, number]; provoking: number }[] {
  const out: { tri: [number, number, number]; provoking: number }[] = [];
  switch (mode) {
    case 'TRIANGLES':
      for (let i = 0; i + 2 < n; i += 3) out.push({ tri: [i, i + 1, i + 2], provoking: i + 2 });
      break;
    case 'TRIANGLE_STRIP':
      for (let i = 0; i + 2 < n; i++) out.push({ tri: [i, i + 1, i + 2], provoking: i + 2 });
      break;
    case 'TRIANGLE_FAN':
      for (let i = 1; i + 1 < n; i++) out.push({ tri: [0, i, i + 1], provoking: i + 1 });
      break;
    case 'QUADS':
      // The split the reference driver uses: 0-1-3 and 1-2-3.
      for (let i = 0; i + 3 < n; i += 4) {
        out.push({ tri: [i, i + 1, i + 3], provoking: i + 3 }, { tri: [i + 1, i + 2, i + 3], provoking: i + 3 });
      }
      break;
    case 'QUAD_STRIP':
      for (let i = 0; i + 3 < n; i += 2) {
        out.push({ tri: [i, i + 1, i + 3], provoking: i + 3 }, { tri: [i, i + 3, i + 2], provoking: i + 3 });
      }
      break;
    case 'POLYGON':
      for (let i = 1; i + 1 < n; i++) out.push({ tri: [0, i, i + 1], provoking: 0 });
      break;
  }
  return out;
}

/** A filled primitive's triangles: blended vertex colours for SMOOTH, one colour per primitive for FLAT. */
export function polygonTriangles(mode: FillMode, vertices: readonly GeoVertex[], shade: Shade): Triangles {
  const out = empty();
  for (const { tri, provoking } of fillTriangles(mode, vertices.length)) {
    for (const i of tri) {
      const color = shade === 'FLAT' ? vertices[provoking].color : vertices[i].color;
      push(out, vertices[i].x, vertices[i].y, color);
    }
  }
  return out;
}
