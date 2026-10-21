import type { PrimitiveType, SceneNode, ViewportLimits } from '@/core/types/scene';
import { primitivesOf } from '@/entities/scene/model/primitive-assembly';

export interface Pt {
  x: number;
  y: number;
}

/** The object, then each enclosing group, innermost first. */
export function chainOf(node: SceneNode, objects: readonly SceneNode[]): SceneNode[] {
  const byId = new Map(objects.map((o) => [o.id, o]));
  const chain = [node];
  let parent = node.parentId ? byId.get(node.parentId) : undefined;
  while (parent && !chain.includes(parent)) {
    chain.push(parent);
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return chain;
}

/** Scale, then rotate (degrees), then move, for the object and then each enclosing group. */
export function worldPoint(p: Pt, chain: readonly SceneNode[]): Pt {
  let q = p;
  for (const { transform: t } of chain) {
    const r = (t.rotate * Math.PI) / 180;
    const x = q.x * t.scaleX;
    const y = q.y * t.scaleY;
    q = { x: x * Math.cos(r) - y * Math.sin(r) + t.translateX, y: x * Math.sin(r) + y * Math.cos(r) + t.translateY };
  }
  return q;
}

/** One polygon (or segment, or point) per primitive the type makes from the corners. */
export function worldPrimitives(type: PrimitiveType, corners: readonly Pt[]): Pt[][] {
  return primitivesOf(type, corners.length).map((members) => members.map((i) => corners[i]));
}

const inside = (p: Pt, v: ViewportLimits) => p.x >= v.minX && p.x <= v.maxX && p.y >= v.minY && p.y <= v.maxY;

/** The four volume edges as a signed distance (positive inside) and the point where an edge is crossed. */
const EDGES: { dist: (p: Pt, v: ViewportLimits) => number }[] = [
  { dist: (p, v) => p.x - v.minX },
  { dist: (p, v) => v.maxX - p.x },
  { dist: (p, v) => p.y - v.minY },
  { dist: (p, v) => v.maxY - p.y },
];

/** Sutherland–Hodgman against the four volume edges. */
export function clipPolygon(poly: readonly Pt[], v: ViewportLimits): Pt[] {
  let out = [...poly];
  for (const { dist } of EDGES) {
    const input = out;
    out = [];
    input.forEach((cur, i) => {
      const prev = input[(i + input.length - 1) % input.length];
      const dc = dist(cur, v);
      const dp = dist(prev, v);
      if ((dc >= 0) !== (dp >= 0)) {
        const t = dp / (dp - dc);
        out.push({ x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t });
      }
      if (dc >= 0) out.push(cur);
    });
  }
  return out;
}

/** Liang–Barsky: the part of the segment inside the volume, or null when none is. */
export function clipSegment(a: Pt, b: Pt, v: ViewportLimits): [Pt, Pt] | null {
  let t0 = 0;
  let t1 = 1;
  for (const { dist } of EDGES) {
    const da = dist(a, v);
    const db = dist(b, v);
    if (da < 0 && db < 0) return null;
    if (da < 0) t0 = Math.max(t0, da / (da - db));
    else if (db < 0) t1 = Math.min(t1, da / (da - db));
  }
  if (t0 > t1) return null;
  const at = (t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  return [at(t0), at(t1)];
}

export type ClipOutcome = 'inside' | 'partial' | 'outside';

/** Whether the shape lies wholly inside the viewing volume, partly, or wholly outside it. Never throws. */
export function clipOutcome(type: PrimitiveType, corners: readonly Pt[], v: ViewportLimits): ClipOutcome {
  const made = worldPrimitives(type, corners);
  // Too few corners to make a primitive: judge the corners themselves.
  const prims = made.length > 0 ? made : [[...corners]];
  const kept = prims.map((prim) => {
    if (prim.every((p) => inside(p, v))) return 'inside' as const;
    if (prim.length === 1) return 'outside' as const;
    const survives = prim.length === 2 ? clipSegment(prim[0], prim[1], v) !== null : clipPolygon(prim, v).length > 0;
    return survives ? ('partial' as const) : ('outside' as const);
  });
  if (kept.every((k) => k === 'inside')) return 'inside';
  if (kept.every((k) => k === 'outside')) return 'outside';
  return 'partial';
}

/** The viewing volume grown by 20% of its width and height on each side. */
export function figureFrame(v: ViewportLimits): ViewportLimits {
  const dx = (v.maxX - v.minX) * 0.2;
  const dy = (v.maxY - v.minY) * 0.2;
  return { minX: v.minX - dx, maxX: v.maxX + dx, minY: v.minY - dy, maxY: v.maxY + dy };
}
