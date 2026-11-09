/**
 * Points, lines and filled primitives as triangles, by the OpenGL 1.5 rules for a multisampled
 * window (specification 3.3 to 3.5): a point is a circle as wide as its size, a line segment is
 * a rectangle as long as the segment with no caps or joins, stipple reads the pattern of 3.4.2 in
 * distance along the line, as the reference driver does, and FLAT shading takes the provoking
 * vertex of Table 2.12.
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

/**
 * The sides of the polygon a point's circle is drawn as. A multiple of 4, so the polygon reaches
 * the circle's left, right, top and bottom; at 96 it covers all but 0.07% of the circle's area.
 */
const CIRCLE_SIDES = 96;

/** Each point as a circle as wide as `size`, centred on it, in its own colour (3.3.3). */
export function pointTriangles(vertices: readonly GeoVertex[], size: number): Triangles {
  const out = empty();
  const r = size / 2;
  const rim = Array.from({ length: CIRCLE_SIDES }, (_, i) => {
    const a = (2 * Math.PI * i) / CIRCLE_SIDES;
    // Snap the quarter turns, so the extremes sit exactly r away and sin(π) leaves no 1e-16.
    return i % (CIRCLE_SIDES / 4) === 0 ? [[1, 0], [0, 1], [-1, 0], [0, -1]][(4 * i) / CIRCLE_SIDES] : [Math.cos(a), Math.sin(a)];
  });
  for (const { x, y, color } of vertices) {
    for (let i = 0; i < CIRCLE_SIDES; i++) {
      const [c0, s0] = rim[i];
      const [c1, s1] = rim[(i + 1) % CIRCLE_SIDES];
      push(out, x, y, color);
      push(out, x + r * c0, y + r * s0, color);
      push(out, x + r * c1, y + r * s1, color);
    }
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
 * `out` in `flat` or, when it is null, the end colours blended. The counter is measured in window
 * units of distance along the line, as the reference driver measures it, so a 45° line repeats
 * every 16 × factor / √2 pixels of x. Returns how far the counter moves: the segment's length.
 */
export function segmentTriangles(
  out: Triangles,
  A: GeoVertex,
  B: GeoVertex,
  width: number,
  flat: Rgba | null,
  stipple: Stipple | null,
  counter: number,
): number {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return 0;
  const nx = (-dy / len) * (width / 2);
  const ny = (dx / len) * (width / 2);
  const spans: [number, number][] = stipple
    ? stippleRuns(counter, len, stipple.factor, stipple.pattern).map(([s0, s1]) => [(s0 - counter) / len, (s1 - counter) / len])
    : [[0, 1]];
  for (const [t0, t1] of spans) {
    const c0 = flat ?? lerp(A.color, B.color, t0);
    const c1 = flat ?? lerp(A.color, B.color, t1);
    const x0 = A.x + dx * t0;
    const y0 = A.y + dy * t0;
    const x1 = A.x + dx * t1;
    const y1 = A.y + dy * t1;
    push(out, x0 - nx, y0 - ny, c0);
    push(out, x1 - nx, y1 - ny, c1);
    push(out, x1 + nx, y1 + ny, c1);
    push(out, x0 - nx, y0 - ny, c0);
    push(out, x1 + nx, y1 + ny, c1);
    push(out, x0 + nx, y0 + ny, c0);
  }
  return len;
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
