import { fragmentBox, type Box } from './clip';
import { SAMPLE_OFFSETS, type Framebuffer } from './framebuffer';
import { drawable, emitFragment, fillSolid, FULL_COVERAGE, solidBytes, type RasterState, type RGBA, type WinVertex } from './fragment';
import { rasterLine } from './lines';
import { rasterPoint } from './points';

const CENTRE: readonly (readonly [number, number])[] = [[0, 0]];

/**
 * The edge function of edge p→q, positive left of it, worked out from the edge's left end (its
 * lower end when it is vertical), so the triangle on the other side of a shared edge gets exactly
 * the negated value. `takesTies`: whether a point exactly on it belongs to a counter-clockwise
 * triangle. Left edges (running down) and top edges (running left, interior below) do, so two
 * triangles sharing an edge never both take a point on it (3.5.1). Its parts are fixed once a
 * triangle, and each point costs two products.
 */
interface Edge {
  dx: number;
  dy: number;
  ox: number;
  oy: number;
  negate: boolean;
  takesTies: boolean;
}

function edgeOf(p: WinVertex, q: WinVertex): Edge {
  const fromP = p.x < q.x || (p.x === q.x && p.y < q.y);
  const [o, e] = fromP ? [p, q] : [q, p];
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  return { dx: e.x - o.x, dy: e.y - o.y, ox: o.x, oy: o.y, negate: !fromP, takesTies: dy < 0 || (dy === 0 && dx < 0) };
}

function edgeAt(f: Edge, x: number, y: number): number {
  const v = f.dx * (y - f.oy) - f.dy * (x - f.ox);
  return f.negate ? -v : v;
}

/**
 * Narrows the pixels of row y that edge `f` can cover, `span`, to those within a pixel of its
 * crossing, and the pixels it covers whole, `inner`, to those more than a pixel inside it. Every
 * sample of row y lies between y and y + 1, and every sample of pixel x between x and x + 1, so a
 * pixel more than a pixel outside the crossing has no sample inside, and one more than a pixel
 * inside has every sample inside, by a margin rounding can't cross. The exact test decides every
 * pixel between the two; this only settles the ones whose answer can't be in doubt.
 */
function narrow(f: Edge, y: number, span: [number, number], inner: [number, number]): void {
  if (f.dy === 0) {
    // A level edge holds for all of row y, or for none of it: inside at both of its bounds is
    // inside at every sample between them.
    if (!(edgeAt(f, f.ox, y) > 0 && edgeAt(f, f.ox, y + 1) > 0)) inner[1] = inner[0] - 1;
    return;
  }
  // Inside is edgeAt ≥ 0, and edgeAt rises with x when (−dy, negated) says so.
  const rising = f.negate ? f.dy > 0 : f.dy < 0;
  const r0 = f.ox + (f.dx * (y - f.oy)) / f.dy;
  const r1 = f.ox + (f.dx * (y + 1 - f.oy)) / f.dy;
  if (rising) {
    span[0] = Math.max(span[0], Math.floor(Math.min(r0, r1)) - 1);
    inner[0] = Math.max(inner[0], Math.ceil(Math.max(r0, r1)) + 1);
  } else {
    span[1] = Math.min(span[1], Math.ceil(Math.max(r0, r1)) + 1);
    inner[1] = Math.min(inner[1], Math.floor(Math.min(r0, r1)) - 2);
  }
}

/** Whether point x, y is inside edge `f`, or on it and the edge takes ties. */
function covers(f: Edge, x: number, y: number): boolean {
  const e = edgeAt(f, x, y);
  return e > 0 || (e === 0 && f.takesTies);
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
  const bc = edgeOf(b, c);
  const ca = edgeOf(c, a);
  const ab = edgeOf(a, b);
  const offsets = state.multisample ? SAMPLE_OFFSETS : CENTRE;
  const tex = a.tex && b.tex && c.tex ? [a.tex, b.tex, c.tex] : null;
  // One colour at every vertex, untextured, mixes to that colour exactly (the differences are 0),
  // so the weights aren't needed: with perspective too when every w is the same ordinary number,
  // as in any 2D drawing, since the weights are then finite.
  const same = (i: number) => a.color[i] === b.color[i] && a.color[i] === c.color[i];
  const flatW = a.w === b.w && a.w === c.w && Math.abs(a.w) > 1e-30 && Math.abs(a.w) < 1e30;
  // Texture coordinates count only when a texture applies (texture() leaves the colour alone otherwise).
  const textured = !!(state.texture && tex);
  const solid = !textured && (!perspective || flatW) && same(0) && same(1) && same(2) && same(3) ? a.color : null;
  // Unblended, the inside of such a triangle is one set of bytes.
  const bytes = solid ? solidBytes(state, solid) : null;
  const span: [number, number] = [x0, x1];
  const inner: [number, number] = [x0, x1];
  for (let y = y0; y <= y1; y++) {
    span[0] = inner[0] = x0;
    span[1] = inner[1] = x1;
    narrow(bc, y, span, inner);
    narrow(ca, y, span, inner);
    narrow(ab, y, span, inner);
    for (let x = span[0]; x <= span[1]; x++) {
      let coverage = 0;
      if (x >= inner[0] && x <= inner[1]) {
        if (bytes) {
          fillSolid(fb, state, x, y, bytes);
          continue;
        }
        coverage = (1 << offsets.length) - 1;
      } else {
        for (let k = 0; k < offsets.length; k++) {
          const sx = x + 0.5 + offsets[k][0];
          const sy = y + 0.5 + offsets[k][1];
          if (covers(bc, sx, sy) && covers(ca, sx, sy) && covers(ab, sx, sy)) coverage |= 1 << k;
        }
      }
      if (!coverage) continue;
      const mask = state.multisample ? coverage : FULL_COVERAGE;
      if (solid) {
        emitFragment(fb, state, box, x, y, solid, undefined, mask);
        continue;
      }
      // Barycentric weights of b and c at the pixel centre (a's is the rest).
      let wb = edgeAt(ca, x + 0.5, y + 0.5) / area;
      let wc = edgeAt(ab, x + 0.5, y + 0.5) / area;
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
      emitFragment(fb, state, box, x, y, color, st, mask);
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
