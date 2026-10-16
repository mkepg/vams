import type { SceneNode, Vertex } from '@/core/types/scene';
import type { UV } from '@/core/types/textures';

/** True when the object has a texture AND a UV per vertex: the gate the renderer uses to emit texture-mapping calls. */
export function hasTexture(o: SceneNode): boolean {
  return !!(o.texture && o.uvs && o.uvs.length === o.vertices.length);
}

/** Two corners are one vertex when position, colour and (if textured) UV all match. */
export function vertexKey(v: Vertex, uv: UV | null): string {
  return uv
    ? `${v.x.toFixed(6)}|${v.y.toFixed(6)}|${v.color}|${uv.u.toFixed(6)}|${uv.v.toFixed(6)}`
    : `${v.x.toFixed(6)}|${v.y.toFixed(6)}|${v.color}`;
}

export interface Deduplicated {
  uniqueVerts: Vertex[];
  uniqueUvs: UV[] | null;
  /** For each original vertex, its place among the unique ones. */
  indices: number[];
}

/** The unique vertices of an indexed object and each original vertex's index into them; null when not indexed. */
export function deduplicate(o: SceneNode): Deduplicated | null {
  if (!o.useIndexed) return null;
  const textured = hasTexture(o);
  const uniqueVerts: Vertex[] = [];
  const uniqueUvs: UV[] = [];
  const indices: number[] = [];
  const keyToIndex = new Map<string, number>();
  for (let i = 0; i < o.vertices.length; i++) {
    const v = o.vertices[i];
    const uv = textured ? o.uvs![i] : null;
    const key = vertexKey(v, uv);
    let idx = keyToIndex.get(key);
    if (idx === undefined) {
      idx = uniqueVerts.length;
      uniqueVerts.push(v);
      if (uv) uniqueUvs.push(uv);
      keyToIndex.set(key, idx);
    }
    indices.push(idx);
  }
  return { uniqueVerts, uniqueUvs: textured ? uniqueUvs : null, indices };
}
