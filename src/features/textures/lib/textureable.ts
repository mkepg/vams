import type { SceneNode } from '@/core/types/scene';

/** The fillable primitives: the only shapes a texture can be drawn on. */
export const TEXTUREABLE_TYPES: ReadonlySet<SceneNode['type']> = new Set([
  'TRIANGLES', 'TRIANGLE_STRIP', 'TRIANGLE_FAN',
  'QUADS', 'QUAD_STRIP', 'POLYGON',
]);
