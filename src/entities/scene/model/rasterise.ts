import type { PrimitiveType, ShadingModel, ViewportLimits } from '@/core/types/scene';
import type { UV } from '@/core/types/textures';
import type { Pt } from '@/entities/scene/model/pipeline-geometry';
import { primitivesOf, provokingOf } from '@/entities/scene/model/primitive-assembly';
import { toHexColor } from '@/shared/lib/hex-color';

/** The coarse pixel grid laid over the viewing volume. Pure. */
export interface PixelGrid {
  volume: ViewportLimits;
  cols: number;
  rows: number;
}

/** `across` pixels wide, as many rows as keep the pixels square, at least 1 and at most 4 × across. */
export function pixelGrid(v: ViewportLimits, across: number): PixelGrid {
  const ratio = (v.maxY - v.minY) / (v.maxX - v.minX);
  const rows = Math.min(4 * across, Math.max(1, Math.round(across * ratio)));
  return { volume: v, cols: across, rows: Number.isFinite(rows) ? rows : 1 };
}

/** Where the four samples of a multisampled pixel sit, in pixel units from its centre (y grows downward). */
export const MULTISAMPLE_OFFSETS: readonly Pt[] = [
  { x: -0.375, y: -0.125 },
  { x: 0.125, y: -0.375 },
  { x: 0.375, y: 0.125 },
  { x: -0.125, y: 0.375 },
];

export interface RasterInput {
  type: PrimitiveType;
  /** In world space. */
  corners: readonly Pt[];
  /** One hex colour per corner. */
  colours: readonly string[];
  uvs: readonly UV[] | null;
  shading: ShadingModel;
}

export interface Fragment {
  col: number;
  /** Row 0 is the top row. */
  row: number;
  /** The share of the pixel's samples the shape covers, 0..1. */
  coverage: number;
  rgb: [number, number, number];
  uv: UV | null;
}

type Rgb = [number, number, number];
interface Shade {
  rgb: Rgb;
  uv: UV | null;
}

const EPS = 1e-9;
const CENTRE: readonly Pt[] = [{ x: 0, y: 0 }];

function parse(hex: string | undefined): Rgb {
  const h = toHexColor(hex);
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

const mix = (weights: number[], values: Rgb[]): Rgb => [0, 1, 2].map((c) => Math.round(Math.min(255, Math.max(0, weights.reduce((s, w, k) => s + w * values[k][c], 0))))) as Rgb;

function mixUv(weights: number[], uvs: UV[] | null): UV | null {
  if (!uvs) return null;
  return { u: weights.reduce((s, w, k) => s + w * uvs[k].u, 0), v: weights.reduce((s, w, k) => s + w * uvs[k].v, 0) };
}

/** Every pixel the corners cover, with how much of it, and the colour and UV there. */
export function rasterise(input: RasterInput, grid: PixelGrid, multisample: boolean): Fragment[] {
  const { volume: v, cols, rows } = grid;
  const w = v.maxX - v.minX;
  const h = v.maxY - v.minY;
  if (!(w > 0) || !(h > 0) || cols < 1 || rows < 1) return [];
  const offsets = multisample ? MULTISAMPLE_OFFSETS : CENTRE;
  const { type, corners, shading } = input;
  const pxW = w / cols;
  const pxH = h / rows;
  const isLine = type === 'LINES' || type === 'LINE_STRIP' || type === 'LINE_LOOP';
  const colourAt = (i: number) => parse(input.colours[i]);
  const uvsOf = (ids: number[]) => (input.uvs ? ids.map((i) => input.uvs![i] ?? { u: 0, v: 0 }) : null);
  // Per pixel, the shade of each sample; later primitives paint over earlier ones.
  const samples = new Map<number, (Shade | null)[]>();
  const paint = (col: number, row: number, k: number, shade: Shade) => {
    const key = row * cols + col;
    let list = samples.get(key);
    if (!list) samples.set(key, (list = offsets.map(() => null)));
    list[k] = shade;
  };
  const worldOf = (col: number, row: number, o: Pt): Pt => ({ x: v.minX + (col + 0.5 + o.x) * pxW, y: v.maxY - (row + 0.5 + o.y) * pxH });

  for (const members of primitivesOf(type, corners.length)) {
    const pts = members.map((i) => corners[i]);
    if (pts.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) continue;
    const bounds = (list: Pt[], pad: number): [number, number, number, number] => [
      Math.max(0, Math.floor((Math.min(...list.map((p) => p.x)) - v.minX) / pxW - pad)),
      Math.min(cols - 1, Math.floor((Math.max(...list.map((p) => p.x)) - v.minX) / pxW + pad)),
      Math.max(0, Math.floor((v.maxY - Math.max(...list.map((p) => p.y))) / pxH - pad)),
      Math.min(rows - 1, Math.floor((v.maxY - Math.min(...list.map((p) => p.y))) / pxH + pad)),
    ];

    if (type === 'POINTS') {
      const col = Math.floor((pts[0].x - v.minX) / pxW);
      const row = Math.floor((v.maxY - pts[0].y) / pxH);
      if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
      const shade = { rgb: colourAt(members[0]), uv: input.uvs ? (input.uvs[members[0]] ?? null) : null };
      offsets.forEach((_, k) => paint(col, row, k, shade));
    } else if (isLine) {
      const [a, b] = pts;
      const [c0, c1, r0, r1] = bounds([a, b], 1);
      const dx = (b.x - a.x) / pxW;
      const dy = (b.y - a.y) / pxH;
      const len2 = dx * dx + dy * dy;
      const rgbs = members.map(colourAt);
      const uvs = uvsOf(members);
      for (let row = r0; row <= r1; row++)
        for (let col = c0; col <= c1; col++)
          offsets.forEach((o, k) => {
            const s = worldOf(col, row, o);
            const sx = (s.x - a.x) / pxW;
            const sy = (s.y - a.y) / pxH;
            const t = len2 > EPS ? Math.min(1, Math.max(0, (sx * dx + sy * dy) / len2)) : 0;
            if (Math.hypot(sx - t * dx, sy - t * dy) > 0.5 + EPS) return;
            paint(col, row, k, { rgb: mix([1 - t, t], rgbs), uv: mixUv([1 - t, t], uvs) });
          });
    } else {
      if (pts.length < 3) continue;
      const flatId = provokingOf(type, members);
      for (let j = 1; j + 1 < pts.length; j++) {
        const ids = [members[0], members[j], members[j + 1]];
        const [a, b, c] = [pts[0], pts[j], pts[j + 1]];
        const area = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
        if (Math.abs(area) < EPS) continue;
        const [c0, c1, r0, r1] = bounds([a, b, c], 1);
        const rgbs = ids.map(colourAt);
        const uvs = uvsOf(ids);
        for (let row = r0; row <= r1; row++)
          for (let col = c0; col <= c1; col++)
            offsets.forEach((o, k) => {
              const p = worldOf(col, row, o);
              const wb = ((p.x - a.x) * (c.y - a.y) - (c.x - a.x) * (p.y - a.y)) / area;
              const wc = ((b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y)) / area;
              const wa = 1 - wb - wc;
              if (wa < -EPS || wb < -EPS || wc < -EPS) return;
              if (shading === 'FLAT') {
                paint(col, row, k, { rgb: colourAt(flatId), uv: input.uvs ? (input.uvs[flatId] ?? null) : null });
              } else {
                paint(col, row, k, { rgb: mix([wa, wb, wc], rgbs), uv: mixUv([wa, wb, wc], uvs) });
              }
            });
      }
    }
  }

  const out: Fragment[] = [];
  for (const [key, list] of [...samples].sort((p, q) => p[0] - q[0])) {
    const hit = list.filter((s): s is Shade => s !== null);
    if (hit.length === 0) continue;
    out.push({ col: key % cols, row: Math.floor(key / cols), coverage: hit.length / offsets.length, rgb: hit[0].rgb, uv: hit[0].uv });
  }
  return out;
}
