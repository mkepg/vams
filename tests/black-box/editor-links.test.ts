/**
 * BLACK-BOX TEST SUITE — BB-LINK
 * Links into the editor: prepared scenes, lesson and scene links, the slide 07 starting points
 * and the stage URL.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { sanitizeProjectData } from '@/entities/project/model/project-io';
import { PRESET_LINKS, presetHref } from '@/entities/project/model/preset-links';
import { getPreset, isPresetSlug } from '@/entities/project/model/scene-presets';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { extractDrawBlock, generateDemoCode, INITIAL_TRIANGLE } from '@/pages/home/model/demo-code';

const NO_CALLBACKS = { keyboard: '', mouse: '', reshape: '', motion: '', idle: '' };
/** Stands in for the canvas-drawn sample texture, which happy-dom cannot paint. */
const BRICKS = { id: 'sample-bricks', name: 'Tiling Bricks', dataUrl: 'data:image/png;base64,AA', width: 256, height: 256, isSample: true };

function program(slug: string): string {
  const preset = getPreset(slug)!;
  return generateCodeFromState(
    {
      objects: preset.data.objects,
      canvasBackgroundColor: preset.data.canvasBackgroundColor,
      callbacks: NO_CALLBACKS,
      viewportLimits: preset.data.viewportLimits,
      textures: [BRICKS],
    },
    { width: 800, height: 600 },
  );
}

describe('BB-LINK-01: Every prepared scene resolves by slug with its section', () => {
  it('lists four presets in order and rejects unknown slugs', () => {
    expect(PRESET_LINKS.map((p) => p.slug)).toEqual(['triangle', 'transforms', 'primitives', 'textured-quad']);
    expect(PRESET_LINKS.map((p) => p.title)).toEqual(['Triangle', 'Transforms', 'Primitives tour', 'Textured quad']);
    expect(PRESET_LINKS.map((p) => getPreset(p.slug)?.section)).toEqual(['Primitives', 'Transforms', 'Primitives', 'Textures']);
    expect(getPreset('nope')).toBeUndefined();
    expect(isPresetSlug('triangle')).toBe(true);
    expect(isPresetSlug('Triangle')).toBe(false);
    expect(presetHref('textured-quad')).toBe('/app?scene=textured-quad');
  });
});

describe('BB-LINK-02: Prepared scenes survive a save and load unchanged', () => {
  it('round-trips each preset through JSON and the project sanitizer', () => {
    for (const { slug } of PRESET_LINKS) {
      const data = getPreset(slug)!.data;
      expect(sanitizeProjectData(JSON.parse(JSON.stringify(data)))).toEqual(data);
    }
    expect(getPreset('transforms')!.data.objects.map((o) => o.type)).toEqual(['GROUP', 'QUADS', 'TRIANGLES', 'TRIANGLE_FAN']);
    expect(getPreset('primitives')!.data.objects.map((o) => o.type)).toEqual(['POINTS', 'LINE_STRIP', 'TRIANGLE_FAN', 'QUADS']);
    // Each call builds fresh objects, so a loaded preset can never alias another.
    expect(getPreset('triangle')!.data.objects[0]).not.toBe(getPreset('triangle')!.data.objects[0]);
  });
});

describe('BB-LINK-03: Prepared scenes generate the OpenGL they are meant to show', () => {
  it('matches the landing demo for Triangle and emits each preset\'s key calls', () => {
    expect(extractDrawBlock(program('triangle'))?.lines).toEqual(generateDemoCode(INITIAL_TRIANGLE).lines);

    const transforms = program('transforms');
    expect(transforms).toContain('ObjectState state_House = { 0.2000f, 0.1000f, 15.0000f, 0.8000f, 0.8000f };');
    expect(transforms).toContain('glTranslatef(state_House.x, state_House.y, 0.0f);');
    expect(transforms).toContain('glBegin(GL_TRIANGLE_FAN);');
    expect(transforms).toContain('void animate_Sun()');
    expect(transforms).toContain('glutIdleFunc(_vams_idle);');

    const primitives = program('primitives');
    for (const mode of ['GL_POINTS', 'GL_LINE_STRIP', 'GL_TRIANGLE_FAN', 'GL_QUADS']) {
      expect(primitives).toContain(`glBegin(${mode});`);
    }

    const textured = program('textured-quad');
    expect(textured).toContain('glBindTexture(GL_TEXTURE_2D, tex_Bricks);');
    expect(textured).toContain('glTexCoord2f(2.0000f, 2.0000f);');
    expect(textured).toContain('GL_TEXTURE_WRAP_S, GL_REPEAT');
    expect(textured).toContain('GL_TEXTURE_MAG_FILTER, GL_NEAREST');
  });
});

describe('BB-LINK-04: The preset list the home page imports carries no dependencies', () => {
  it('has no import statements', () => {
    expect(readFileSync('src/entities/project/model/preset-links.ts', 'utf8')).not.toMatch(/^\s*import\s/m);
  });
});
