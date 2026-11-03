import { fragmentBox, type Box } from './clip';
import { SAMPLE_OFFSETS, type Framebuffer } from './framebuffer';
import { drawable, emitFragment, FULL_COVERAGE, type RasterState, type RGBA, type WinVertex } from './fragment';
import { rasterLine } from './lines';
import { rasterPoint } from './points';

const CENTRE: readonly (readonly [number, number])[] = [[0, 0]];

/**
 * Whether a point the edge function `e` puts exactly on edge (dx, dy) of a counter-clockwise
 * triangle belongs to it: left edges (running down) and top edges (running left, interior below)
 * do, so two triangles sharing an edge never both take a point on it (3.5.1).
 */
function inside(e: number, dx: number, dy: number): boolean {
  return e > 0 || (e === 0 && (dy < 0 || (dy === 0 && dx < 0)));
}

/** The value at weights wb, wc of b and c (a takes the rest), written so equal values stay exact. */
function mix(fa: number, fb: number, fc: number, wb: number, wc: number): number {
  return fa + (fb - fa) * wb + (fc - fa) * wc;
}

/**
 * Fills triangle a, b, c by point sampling: each pixel centre, or each of the 4 samples in
 * multisample mode, inside the triangle is covered. Colour and texture coordinates are taken at
 * the pixel centre, perspective-correct by eq. 3.6 when `perspective` is set and linear otherwise.
 */
export function fillTriangle(
  fb: Framebuffer,
  state: RasterState,
  box: Box,
  a: WinVertex,
  b: WinVertex,
  c: WinVertex,
  perspective: boolean,
): void {
  let area = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
  if (area === 0) return;
  if (area < 0) {
    [b, c] = [c, b];
    area = -area;
  }
  const x0 = Math.max(box.x0, Math.floor(Math.min(a.x, b.x, c.x)));
  const x1 = Math.min(box.x1 - 1, Math.floor(Math.max(a.x, b.x, c.x)));
  const y0 = Math.max(box.y0, Math.floor(Math.min(a.y, b.y, c.y)));
  const y1 = Math.min(box.y1 - 1, Math.floor(Math.max(a.y, b.y, c.y)));
  // Edge functions: positive left of the edge, which is inside for a counter-clockwise triangle.
  // Each is worked out from the edge's left end (its lower end when it is vertical), so the
  // triangle on the other side of a shared edge gets exactly the negated value, and the tie rule
  // in inside() sees both as 0.
  const edge = (p: WinVertex, q: WinVertex, x: number, y: number) =>
    p.x < q.x || (p.x === q.x && p.y < q.y)
      ? (q.x - p.x) * (y - p.y) - (q.y - p.y) * (x - p.x)
      : -((p.x - q.x) * (y - q.y) - (p.y - q.y) * (x - q.x));
  const offsets = state.multisample ? SAMPLE_OFFSETS : CENTRE;
  const tex = a.tex && b.tex && c.tex ? [a.tex, b.tex, c.tex] : null;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let coverage = 0;
      for (let k = 0; k < offsets.length; k++) {
        const sx = x + 0.5 + offsets[k][0];
        const sy = y + 0.5 + offsets[k][1];
        if (
          inside(edge(b, c, sx, sy), c.x - b.x, c.y - b.y) &&
          inside(edge(c, a, sx, sy), a.x - c.x, a.y - c.y) &&
          inside(edge(a, b, sx, sy), b.x - a.x, b.y - a.y)
        ) {
          coverage |= 1 << k;
        }
      }
      if (!coverage) continue;
      // Barycentric weights of b and c at the pixel centre (a's is the rest).
      let wb = edge(c, a, x + 0.5, y + 0.5) / area;
      let wc = edge(a, b, x + 0.5, y + 0.5) / area;
      if (perspective) {
        const qa = (1 - wb - wc) / a.w;
        const qb = wb / b.w;
        const qc = wc / c.w;
        const sum = qa + qb + qc;
        wb = qb / sum;
        wc = qc / sum;
      }
      const color: RGBA = [
        mix(a.color[0], b.color[0], c.color[0], wb, wc),
        mix(a.color[1], b.color[1], c.color[1], wb, wc),
        mix(a.color[2], b.color[2], c.color[2], wb, wc),
        mix(a.color[3], b.color[3], c.color[3], wb, wc),
      ];
      const st: [number, number] | undefined = tex
        ? [mix(tex[0][0], tex[1][0], tex[2][0], wb, wc), mix(tex[0][1], tex[1][1], tex[2][1], wb, wc)]
        : undefined;
      emitFragment(fb, state, box, x, y, color, st, state.multisample ? coverage : FULL_COVERAGE);
    }
  }
}

/**
 * One polygon, its vertices in order (a triangle, a quad, a GL_POLYGON). It faces front when its
 * area (eq. 2.6) is positive for GL_CCW, negative for GL_CW, and culling and the face's polygon
 * mode follow from that (3.5.1, 3.5.4). FLAT shading colours it all with vertex `provoking`
 * (Table 2.12). FILL draws the `triangles` it is split into, a fan from vertex 0 unless given.
 */
export function rasterPolygon(
  fb: Framebuffer,
  vertices: readonly WinVertex[],
  state: RasterState,
  provoking: number = vertices.length - 1,
  triangles?: readonly (readonly [number, number, number])[],
): void {
  const n = vertices.length;
  if (n < 3 || !vertices.every(drawable)) return;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const p = vertices[i];
    const q = vertices[(i + 1) % n];
    area += p.x * q.y - q.x * p.y;
  }
  const front = state.frontFace === 'CCW' ? area > 0 : area < 0;
  const { enabled, mode } = state.cullFace;
  if (enabled && (mode === 'FRONT_AND_BACK' || (mode === 'FRONT') === front)) return;

  const flat = state.shadeModel === 'FLAT' ? vertices[provoking].color : null;
  const vs = flat ? vertices.map((v) => ({ ...v, color: flat })) : vertices;
  const polygonMode = front ? state.polygonMode.front : state.polygonMode.back;
  if (polygonMode === 'POINT') {
    for (const v of vs) rasterPoint(fb, v, state);
    return;
  }
  if (polygonMode === 'LINE') {
    // The stipple counter restarts at the first edge only.
    state.stipple.counter = 0;
    for (let i = 0; i < n; i++) rasterLine(fb, vs[i], vs[(i + 1) % n], state);
    return;
  }
  const box = fragmentBox(fb, state.scissor);
  const split = triangles ?? Array.from({ length: n - 2 }, (_, i) => [0, i + 1, i + 2] as const);
  for (const [i, j, k] of split) fillTriangle(fb, state, box, vs[i], vs[j], vs[k], !state.multisample);
}

/** A triangle; FLAT shading takes its last vertex (Table 2.12). */
export function rasterTriangle(fb: Framebuffer, a: WinVertex, b: WinVertex, c: WinVertex, state: RasterState): void {
  rasterPolygon(fb, [a, b, c], state, 2);
}
