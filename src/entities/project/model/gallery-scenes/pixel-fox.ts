import type { CallbacksState, SceneNode, SpecialKey } from '@/core/types/scene';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { node, vertices } from '../scene-nodes';
import { CLOUD_TEXTURE } from './gallery-textures';
import { GALLERY_VIEW, rule, type GalleryScene } from './gallery-scene';

/** Id of the editor's built-in "Pixel fox" sample texture (features/textures/lib/sample-textures.ts). */
const SAMPLE_FOX_ID = 'sample-pixel';
const { minX, maxX, minY, maxY } = GALLERY_VIEW;

function build(): SceneNode[] {
  // Top first, as the store keeps objects.
  return [
    node({
      id: 'fox',
      name: 'Fox',
      type: 'QUADS',
      renderingMode: 'VBO',
      bufferUsage: 'STATIC',
      texture: { textureId: SAMPLE_FOX_ID, filter: 'NEAREST', wrap: 'CLAMP_TO_EDGE' },
      uvs: [{ u: 0, v: 0 }, { u: 1, v: 0 }, { u: 1, v: 1 }, { u: 0, v: 1 }],
      vertices: vertices('fox', [[-0.2, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2]], '#ffffff'),
    }),
    node({
      id: 'clouds',
      name: 'Clouds',
      type: 'QUADS',
      renderingMode: 'VERTEX_ARRAY',
      texture: { textureId: CLOUD_TEXTURE.id, filter: 'NEAREST', wrap: 'REPEAT' },
      // UVs run past 1, so with GL_REPEAT the tile repeats 8 times across and 4.5 times up.
      uvs: [{ u: 0, v: 0 }, { u: 8, v: 0 }, { u: 8, v: 4.5 }, { u: 0, v: 4.5 }],
      vertices: vertices('clouds', [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]], '#ffffff'),
    }),
  ];
}

function callbacks(): CallbacksState {
  const c = emptyCallbacks();
  const moves: [SpecialKey, number, number][] = [['up', 0, 0.05], ['down', 0, -0.05], ['left', -0.05, 0], ['right', 0.05, 0]];
  c.special = { handlerName: 'onSpecial', rules: moves.map(([key, dx, dy]) => rule(`steer-${key}`, 'fox', { kind: 'special', key }, { type: 'translate', dx, dy })) };
  c.keyboard = { handlerName: 'onKey', rules: [rule('home', 'fox', { kind: 'keyboard', key: ' ' }, { type: 'reset' })] };
  c.reshape = { handlerName: 'onReshape', resize: 'keep' };
  return c;
}

export const pixelFox: GalleryScene = { section: 'Textures', background: '#78c8eb', build, callbacks, textures: [CLOUD_TEXTURE] };
