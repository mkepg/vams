import { Matrix, Mesh, type MeshGeometry, type Shader } from 'pixi.js';
import type { SceneNode } from '@/core/types/scene';
import {
  POINT_SIZE,
  lineTriangles,
  pointTriangles,
  type GeoVertex,
  type LineMode,
  type Rgba,
  type Stipple,
  type Triangles,
} from '@/shared/lib/gl-geometry';
import { toRgba, vertexColorGeometry, VERTEX_COLOR_SHADER } from './meshRenderer';

/** Primitives whose width or size is in window pixels, so they are built where the window is known. */
export const WINDOW_GEOMETRY_TYPES: ReadonlySet<SceneNode['type']> = new Set(['POINTS', 'LINES', 'LINE_STRIP', 'LINE_LOOP']);

const ZERO_SCALE = 1e-6;

interface Source {
  type: SceneNode['type'];
  points: { x: number; y: number }[];
  colors: Rgba[];
  width: number;
  shade: 'FLAT' | 'SMOOTH';
  stipple: Stipple | null;
}

/**
 * Points and lines, built in window pixels the way glPointSize, glLineWidth and glLineStipple
 * measure them, then carried back into the parent's own coordinates. Whenever the parent's
 * place in the window changes (a drag, a group, a Run rule, the view), `place` builds them again,
 * so no scale ever stretches a line's width or a point's square.
 */
export class WindowGeometryMesh extends Mesh<MeshGeometry, Shader> {
  private readonly source: Source;
  private readonly lastMatrix = new Matrix(Number.NaN);
  private readonly scratch = new Matrix();

  constructor(node: SceneNode) {
    const source: Source = {
      type: node.type,
      points: node.vertices.map((v) => ({ x: v.x, y: v.y })),
      colors: node.vertices.map((v) => toRgba(v.color)),
      width: node.lineWidth ?? 1,
      shade: node.shading === 'FLAT' ? 'FLAT' : 'SMOOTH',
      stipple: node.lineStipple ?? null,
    };
    // Until the first placement the mesh holds one empty triangle on its first vertex.
    super({ geometry: vertexColorGeometry(placeholder(source)), shader: VERTEX_COLOR_SHADER });
    this.source = source;
    this.label = 'gl-window-geometry';
  }

  /** Builds the geometry again if the parent has moved in the window. Returns whether it did. */
  place(): boolean {
    const parent = this.parent;
    if (!parent) return false;
    // A zero glScalef still draws (points at the origin); nudge an exact 0 so the parent stays invertible.
    if (parent.scale.x === 0) parent.scale.x = ZERO_SCALE;
    if (parent.scale.y === 0) parent.scale.y = ZERO_SCALE;
    const m = parent.getGlobalTransform(this.scratch, false);
    const last = this.lastMatrix;
    if (m.a === last.a && m.b === last.b && m.c === last.c && m.d === last.d && m.tx === last.tx && m.ty === last.ty) {
      return false;
    }
    last.copyFrom(m);
    const det = m.a * m.d - m.b * m.c;
    if (det === 0) {
      this.visible = false;
      return true;
    }
    this.visible = true;
    const toLocal = m.clone().invert();
    const window = this.source.points.map((p, i): GeoVertex => {
      const at = m.apply(p);
      return { x: at.x, y: at.y, color: this.source.colors[i] };
    });
    const built = build(this.source, window);
    for (let i = 0; i < built.positions.length; i += 2) {
      const local = toLocal.apply({ x: built.positions[i], y: built.positions[i + 1] });
      built.positions[i] = local.x;
      built.positions[i + 1] = local.y;
    }
    const old = this.geometry;
    this.geometry = vertexColorGeometry(built.positions.length > 0 ? built : placeholder(this.source));
    old.destroy();
    return true;
  }
}

function build(source: Source, window: GeoVertex[]): Triangles {
  if (source.type === 'POINTS') return pointTriangles(window, POINT_SIZE);
  return lineTriangles(source.type as LineMode, window, source.width, source.shade, source.stipple);
}

/** One triangle with no area and no colour, so an empty mesh is still a valid one. */
function placeholder(source: Source): Triangles {
  const p = source.points[0] ?? { x: 0, y: 0 };
  return { positions: [p.x, p.y, p.x, p.y, p.x, p.y], colors: new Array(12).fill(0) };
}
