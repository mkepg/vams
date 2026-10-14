import type { PrimitiveType } from '@/core/types/scene';

export interface PrimitiveDef {
  type: PrimitiveType;
  /** The plain name on the tile. */
  name: string;
  /** The OpenGL constant, in mono under the name. */
  glName: string;
  minVertices: number;
  /** Vertices per complete piece (3 for GL_TRIANGLES); null when any count past the minimum works. */
  stride: number | null;
  /** The placement hint, shown as the tile's tooltip and while placing. */
  hint: string;
}

const def = (type: PrimitiveType, name: string, minVertices: number, stride: number | null, hint: string): PrimitiveDef => ({
  type, name, glName: `GL_${type}`, minVertices, stride, hint,
});

export const PRIMITIVE_DEFS: readonly PrimitiveDef[] = [
  def('POINTS', 'Points', 1, null, 'Each click places an independent point.'),
  def('LINES', 'Lines', 2, 2, 'Click pairs of vertices — each pair forms one segment.'),
  def('LINE_STRIP', 'Line strip', 2, null, 'Each new vertex connects to the previous one.'),
  def('LINE_LOOP', 'Line loop', 3, null, 'Like Line Strip, but the last vertex connects back to the first.'),
  def('TRIANGLES', 'Triangles', 3, 3, 'Click groups of 3 — each triple forms one triangle.'),
  def('TRIANGLE_STRIP', 'Triangle strip', 3, null, 'Each new vertex forms a triangle with the previous two.'),
  def('TRIANGLE_FAN', 'Triangle fan', 3, null, 'First vertex is the center — all triangles fan outward from it.'),
  def('QUADS', 'Quads', 4, 4, 'Click groups of 4 — each quad is split into two triangles.'),
  def('QUAD_STRIP', 'Quad strip', 4, 2, 'Click pairs of vertices forming columns of quads.'),
  def('POLYGON', 'Polygon', 3, null, 'Vertices of a single convex polygon — order matters.'),
];

export function primitiveDef(type: PrimitiveType): PrimitiveDef {
  return PRIMITIVE_DEFS.find((d) => d.type === type)!;
}

export interface PrimitiveGroup {
  title: string;
  columns: 2 | 3;
  types: readonly PrimitiveType[];
}

export const PRIMITIVE_GROUPS: readonly PrimitiveGroup[] = [
  { title: 'Points and lines', columns: 2, types: ['POINTS', 'LINES', 'LINE_STRIP', 'LINE_LOOP'] },
  { title: 'Triangles', columns: 3, types: ['TRIANGLES', 'TRIANGLE_STRIP', 'TRIANGLE_FAN'] },
  { title: 'Quads and polygons', columns: 3, types: ['QUADS', 'QUAD_STRIP', 'POLYGON'] },
];
