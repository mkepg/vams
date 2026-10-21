import type { Vertex } from '@/core/types/scene';
import type { UV } from '@/core/types/textures';
import { defaultUVsFor } from '@/entities/scene/model/scene-slice';

export type UVPreset = 'fit' | 'tile' | 'flip-u' | 'flip-v';

/**
 * The UVs a preset gives a shape. Fit spreads the texture once over the bounding box and Tile
 * twice; the flips mirror the UVs the shape already has, or the fitted ones when it has none.
 */
export function presetUVs(preset: UVPreset, vertices: readonly Vertex[], current: readonly UV[] | null): UV[] {
  const fitted = defaultUVsFor([...vertices]);
  const base = current && current.length === vertices.length ? current : fitted;
  switch (preset) {
    case 'fit':
      return fitted;
    case 'tile':
      return fitted.map(({ u, v }) => ({ u: u * 2, v: v * 2 }));
    case 'flip-u':
      return base.map(({ u, v }) => ({ u: 1 - u, v }));
    case 'flip-v':
      return base.map(({ u, v }) => ({ u, v: 1 - v }));
  }
}
