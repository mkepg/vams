/**
 * BLACK-BOX TEST SUITE — BB-TEX
 * The built-in sample textures and the lessons that name them.
 */
import { describe, it, expect } from 'vitest';
import { useVamsStore } from '@/core/store';
import { ATLAS_ICONS, FOX_PALETTE, FOX_SPRITE, SAMPLE_TEXTURE_SPECS } from '@/features/textures/lib/sample-textures';
import { getPreset } from '@/entities/project/model/scene-presets';
import { TEXTURES_LESSONS } from '@/features/lesson-engine/model/textures-lessons';

describe('BB-TEX-01: The samples are the teaching set, in order', () => {
  it('lists five samples with these ids, names and sizes', () => {
    expect(SAMPLE_TEXTURE_SPECS.map((s) => [s.id, s.name, s.width, s.height])).toEqual([
      ['sample-uv-grid', 'UV grid', 256, 256], ['sample-atlas', 'Sprite sheet', 256, 256],
      ['sample-pixel', 'Pixel fox', 64, 64], ['sample-bricks', 'Brick wall', 256, 256], ['sample-edges', 'Coloured edges', 256, 256],
    ]);
  });
});

describe('BB-TEX-02: Old sample ids still resolve', () => {
  it('finds the atlas, pixel and bricks samples by id', () => {
    const { getTextureById } = useVamsStore.getState();
    for (const id of ['sample-atlas', 'sample-pixel', 'sample-bricks']) {
      expect(getTextureById(id)?.isSample).toBe(true);
    }
  });

  it('opens the Textured quad preset with the Brick wall sample', () => {
    const preset = getPreset('textured-quad')!;
    const id = preset.data.objects[0].texture?.textureId;
    expect(id).toBe('sample-bricks');
    expect(useVamsStore.getState().getTextureById(id!)?.name).toBe('Brick wall');
  });
});

describe('BB-TEX-03: The fox sprite is a well-formed 16 × 16 grid', () => {
  it('has 16 rows of 16 characters, each a palette key', () => {
    expect(FOX_SPRITE).toHaveLength(16);
    for (const row of FOX_SPRITE) {
      expect(row).toHaveLength(16);
      for (const ch of row) expect(Object.keys(FOX_PALETTE)).toContain(ch);
    }
  });
});

describe('BB-TEX-04: The sprite sheet keeps its corners', () => {
  const text = JSON.stringify(TEXTURES_LESSONS);

  it('orders the icons top-left, top-right, bottom-left, bottom-right', () => {
    expect(ATLAS_ICONS).toEqual(['heart', 'coin', 'gem', 'star']);
  });

  it('names the samples the lessons use by their new names', () => {
    expect(text).toContain('green star');
    expect(text).not.toContain('Crate');
    expect(text).toContain('Brick wall');
    expect(text).not.toContain('Tiling Bricks');
  });
});
