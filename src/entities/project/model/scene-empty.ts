import type { VamsState } from '@/core/store/types';

export type SceneFields = Pick<
  VamsState,
  'objects' | 'uploadedTextures' | 'canvasBackgroundColor' | 'pendingShapeType' | 'callbacks' | 'viewportLimits'
>;

/** True when there is nothing on the canvas worth keeping. Uploaded textures count as work. */
export function isSceneEmpty(state: SceneFields): boolean {
  const { minX, maxX, minY, maxY } = state.viewportLimits;
  return (
    state.objects.length === 0 &&
    state.uploadedTextures.length === 0 &&
    state.canvasBackgroundColor === '#000000' &&
    state.pendingShapeType === null &&
    Object.values(state.callbacks).every((body) => body.trim() === '') &&
    minX === -1 &&
    maxX === 1 &&
    minY === -1 &&
    maxY === 1
  );
}
