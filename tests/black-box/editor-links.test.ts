/**
 * BLACK-BOX TEST SUITE — BB-LINK
 * Links into the editor: prepared scenes, lesson and scene links, the slide 07 starting points
 * and the stage URL.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { h, render } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { useVamsStore } from '@/core/store';
import { createMemoryLibrary, setSceneLibraryForTests, type SceneLibrary } from '@/entities/project/model/scene-library';
import { applyEditorLink, parseEditorLink, stripEditorLinkParams } from '@/pages/editor/model/editor-link';
import { useEditorLink } from '@/pages/editor/model/useEditorLink';
import { withStageParam } from '@/features/stage-mode/model/stage-controller';
import TryItSection from '@/pages/home/ui/sections/TryItSection';
import { addTriangle } from '../helpers/store';
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

async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

function memoryLibrary(): SceneLibrary {
  const library = createMemoryLibrary();
  setSceneLibraryForTests(library);
  return library;
}

const noop = { openLibrary: () => {} };

describe('BB-LINK-05: Links are parsed against real lessons and scenes', () => {
  it('recognises lessons, scenes, and rejects anything else', () => {
    expect(parseEditorLink('')).toEqual({ kind: 'none' });
    expect(parseEditorLink('?stage')).toEqual({ kind: 'none' });
    expect(parseEditorLink('?lesson=primitives-demo-1')).toEqual({ kind: 'lesson', id: 'primitives-demo-1' });
    expect(parseEditorLink('?scene=triangle')).toEqual({ kind: 'scene', slug: 'triangle' });
    expect(parseEditorLink('?scene=%20triangle%20')).toEqual({ kind: 'scene', slug: 'triangle' });
    expect(parseEditorLink('?scene=Triangle')).toEqual({ kind: 'invalid', param: 'scene', value: 'Triangle' });
    expect(parseEditorLink('?lesson=')).toEqual({ kind: 'invalid', param: 'lesson', value: '' });
    // lesson wins over scene, even when the lesson is unknown
    expect(parseEditorLink('?lesson=nope&scene=triangle')).toEqual({ kind: 'invalid', param: 'lesson', value: 'nope' });
    expect(parseEditorLink('?scene=x', { isLesson: () => false, isScene: () => true })).toEqual({ kind: 'scene', slug: 'x' });
  });
});

describe('BB-LINK-06: Link parameters are removed and every other parameter is kept', () => {
  it('strips lesson and scene only', () => {
    expect(stripEditorLinkParams('?scene=triangle')).toBe('');
    expect(stripEditorLinkParams('?a=1&scene=x&b=2')).toBe('?a=1&b=2');
    expect(stripEditorLinkParams('?lesson=x&scene=y')).toBe('');
    expect(stripEditorLinkParams('')).toBe('');
  });
});

describe('BB-LINK-07: A lesson link opens the lesson in its section', () => {
  it('switches section, starts the lesson and skips the welcome card', async () => {
    const tri = addTriangle();
    await applyEditorLink({ kind: 'lesson', id: 'transforms-demo-1' }, noop);
    const s = useVamsStore.getState();
    expect(s.activeSection).toBe('Transforms');
    expect(s.activeLessonId).toBe('transforms-demo-1');
    expect(s.appMode).toBe('Lesson');
    expect(s.sceneBackup?.map((o) => o.id)).toEqual([tri.id]);
    expect(s.hasSeenWelcome).toBe(true);
    s.clearLessonState();
    s.setAppMode('Author');
  });
});

describe('BB-LINK-08: A scene link keeps the current scene, then opens the prepared one', () => {
  afterEach(() => setSceneLibraryForTests(null));
  it('backs up, loads the preset and switches to its section', async () => {
    const library = memoryLibrary();
    addTriangle();
    await applyEditorLink({ kind: 'scene', slug: 'transforms' }, noop);
    const s = useVamsStore.getState();
    expect(s.objects.map((o) => o.name)).toEqual(['House', 'Walls', 'Roof', 'Sun']);
    expect(s.activeSection).toBe('Transforms');
    expect((await library.list()).map((e) => e.name)).toEqual(['Before opening ‘Transforms’']);
  });
});

describe('BB-LINK-09: A scene link on an empty canvas makes no backup', () => {
  afterEach(() => setSceneLibraryForTests(null));
  it('loads without writing to the library', async () => {
    const library = memoryLibrary();
    await applyEditorLink({ kind: 'scene', slug: 'triangle' }, noop);
    expect(useVamsStore.getState().objects.map((o) => o.name)).toEqual(['Triangle']);
    expect(await library.list()).toEqual([]);
  });
});

describe('BB-LINK-10: A scene link never replaces work it could not back up', () => {
  afterEach(() => setSceneLibraryForTests(null));
  it('leaves the scene when the backup fails', async () => {
    const failing = createMemoryLibrary();
    setSceneLibraryForTests({ ...failing, save: () => Promise.reject(new Error('full')) });
    const tri = addTriangle();
    await applyEditorLink({ kind: 'scene', slug: 'triangle' }, noop);
    expect(useVamsStore.getState().objects.map((o) => o.id)).toEqual([tri.id]);
  });
});

describe('BB-LINK-11: An invalid link changes nothing but the welcome card', () => {
  it('keeps the scene, mode and section', async () => {
    const tri = addTriangle();
    const before = useVamsStore.getState().activeSection;
    await applyEditorLink({ kind: 'invalid', param: 'scene', value: 'nope' }, noop);
    const s = useVamsStore.getState();
    expect(s.objects.map((o) => o.id)).toEqual([tri.id]);
    expect(s.appMode).toBe('Author');
    expect(s.activeSection).toBe(before);
    expect(s.hasSeenWelcome).toBe(true);
  });
});

describe('BB-LINK-12: A link applies once: the URL is cleaned so a reload does not repeat it', () => {
  afterEach(() => {
    setSceneLibraryForTests(null);
    window.history.replaceState(null, '', '/');
  });
  it('removes its parameter, keeps the rest, and a second mount does nothing', async () => {
    const library = memoryLibrary();
    addTriangle();
    window.history.replaceState(null, '', '/app?scene=transforms&x=1#h');
    function Probe() {
      useEditorLink();
      return null;
    }
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h(Probe, null), host);
    await settle();
    expect(window.location.pathname).toBe('/app');
    expect(window.location.search).toBe('?x=1');
    expect(window.location.hash).toBe('#h');
    expect(useVamsStore.getState().objects[0].name).toBe('House');

    // Simulate a reload: the editor mounts again on the cleaned URL.
    render(null, host);
    render(h(Probe, null), host);
    await settle();
    expect((await library.list()).filter((e) => e.kind === 'backup')).toHaveLength(1);
    expect(useVamsStore.getState().objects[0].name).toBe('House');
    render(null, host);
    host.remove();
  });
});

describe('BB-LINK-13: Slide 07 offers the prepared scenes, and stage mode keeps other URL parameters', () => {
  it('links each preset and toggles only the stage parameter', () => {
    const html = renderToString(h(TryItSection, null));
    expect(html).toContain('Start from:');
    for (const p of PRESET_LINKS) expect(html).toContain(`href="${presetHref(p.slug)}"`);

    expect(withStageParam('', true)).toBe('?stage');
    expect(withStageParam('?stage', false)).toBe('');
    expect(withStageParam('?x=1', true)).toBe('?stage&x=1');
    expect(withStageParam('?stage&x=1', false)).toBe('?x=1');
    expect(withStageParam('?stage=&x=1', true)).toBe('?stage&x=1');
  });
});
