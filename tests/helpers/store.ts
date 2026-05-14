import { useVamsStore } from '@/core/store';
import type { PrimitiveType, PendingVertex } from '@/core/types/scene';

export const getState = () => useVamsStore.getState();
export const setState = (patch: Parameters<typeof useVamsStore.setState>[0]) =>
  useVamsStore.setState(patch);

export function addPrimitive(type: PrimitiveType, vertices: PendingVertex[]) {
  getState().addCustomObject(type, vertices);
  const newObj = getState().objects[0];
  return newObj;
}

export function addTriangle(
  cx = 0,
  cy = 0,
  size = 0.5,
) {
  // Symmetric isoceles triangle whose centroid sits exactly at (cx, cy),
  // so the resulting transform.translate matches the requested centre.
  return addPrimitive('TRIANGLES', [
    { x: cx - size, y: cy - size / 3 * 2 },
    { x: cx + size, y: cy - size / 3 * 2 },
    { x: cx,        y: cy + size / 3 * 4 },
  ]);
}

export function addQuad(cx = 0, cy = 0, size = 0.5) {
  return addPrimitive('QUADS', [
    { x: cx - size, y: cy - size },
    { x: cx + size, y: cy - size },
    { x: cx + size, y: cy + size },
    { x: cx - size, y: cy + size },
  ]);
}

export function findById(id: string) {
  return getState().objects.find((o) => o.id === id);
}
