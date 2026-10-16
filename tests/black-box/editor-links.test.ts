/**
 * BLACK-BOX TEST SUITE — BB-LINK
 * Links into the editor: prepared scenes, lesson and scene links, the slide 07 starting points
 * and the stage URL.
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { toast } from 'sonner';
import { h, render } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { useVamsStore } from '@/core/store';
import { PROGRESS_KEY, readProgress } from '@/features/lesson-engine/model/progress';
import { createMemoryLibrary, setSceneLibraryForTests, type SceneLibrary } from '@/entities/project/model/scene-library';
import { applyEditorLink, parseEditorLink, stripEditorLinkParams } from '@/pages/editor/model/editor-link';
import { useEditorLink } from '@/pages/editor/model/useEditorLink';
import { withStageParam } from '@/features/stage-mode/model/stage-controller';
import TryItSection from '@/pages/home/ui/sections/TryItSection';
import { addQuad, addTriangle } from '../helpers/store';
import { parseShareLink, shouldShowSceneView, editorAnywayUrl, PHONE_MAX_WIDTH } from '@/pages/editor/model/share-link';
import { openSharedScene } from '@/pages/editor/model/open-shared';
import { SHARE_MESSAGES } from '@/features/share';
import { buildSharePayload, encodeShare } from '@/entities/project/model/share';
import { readFileSync } from 'node:fs';
import { sanitizeProjectData } from '@/entities/project/model/project-io';
import { PRESET_LINKS, presetHref } from '@/entities/project/model/preset-links';
import { getPreset, isPresetSlug } from '@/entities/project/model/scene-presets';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { extractDrawBlock, generateDemoCode, INITIAL_TRIANGLE } from '@/pages/home/model/demo-code';

/** Stands in for the canvas-drawn sample texture, which happy-dom cannot paint. */
const BRICKS = { id: 'sample-bricks', name: 'Tiling Bricks', dataUrl: 'data:image/png;base64,AA', width: 256, height: 256, isSample: true };

function program(slug: string): string {
  const preset = getPreset(slug)!;
  return generateCodeFromState(
    {
      objects: preset.data.objects,
      canvasBackgroundColor: preset.data.canvasBackgroundColor,
      callbacks: preset.data.callbacks,
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
    expect(transforms).toContain('void onIdle()\n{\n    state_Sun.rotation += 2.00f;\n    glutPostRedisplay();\n}');
    expect(transforms).not.toContain('animate_');
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

describe('BB-LINK-14: A lesson link records the lesson it replaces as left mid-way', () => {
  afterEach(() => localStorage.removeItem(PROGRESS_KEY));
  it('saves the running lesson and its step before opening the linked one', async () => {
    await applyEditorLink({ kind: 'lesson', id: 'transforms-demo-1' }, noop);
    useVamsStore.setState({ currentStepIndex: 2 });
    await applyEditorLink({ kind: 'lesson', id: 'textures-demo-1' }, noop);
    expect(readProgress().current).toEqual({ lessonId: 'transforms-demo-1', step: 2 });
    const s = useVamsStore.getState();
    expect(s.activeLessonId).toBe('textures-demo-1');
    expect(s.activeSection).toBe('Textures');
    s.clearLessonState();
    s.setAppMode('Author');
  });

  it('records nothing when no lesson is running', async () => {
    await applyEditorLink({ kind: 'lesson', id: 'textures-demo-1' }, noop);
    expect(readProgress().current).toBeNull();
    const s = useVamsStore.getState();
    s.clearLessonState();
    s.setAppMode('Author');
  });
});

const sharedPayload = (extra: Record<string, unknown> = {}) => {
  addTriangle();
  const s = useVamsStore.getState();
  const p = buildSharePayload({ sceneName: 'Solar system', objects: s.objects, callbacks: s.callbacks, viewportLimits: s.viewportLimits, canvasBackgroundColor: s.canvasBackgroundColor, textures: [] });
  useVamsStore.setState({ objects: [] });
  return { ...p, ...extra };
};

describe('BB-LINK-15: Shared links are recognised by path or hash', () => {
  it('parses /s/<id> and #s=<data>, and ignores everything else', () => {
    expect(parseShareLink('/s/k3x9q2Ab', '')).toEqual({ kind: 'stored', id: 'k3x9q2Ab' });
    expect(parseShareLink('/s/k3x9q2Ab/', '')).toEqual({ kind: 'stored', id: 'k3x9q2Ab' });
    expect(parseShareLink('/app', '#s=abc_-1')).toEqual({ kind: 'carried', data: 'abc_-1' });
    expect(parseShareLink('/app', '')).toBeNull();
    expect(parseShareLink('/app', '#section')).toBeNull();
    expect(parseShareLink('/learn', '')).toBeNull();
  });

  it('sends phones to the scene view unless they asked for the editor', () => {
    expect(PHONE_MAX_WIDTH).toBe(960);
    const stored = { pathname: '/s/k3x9q2Ab', search: '', hash: '' };
    expect(shouldShowSceneView(390, stored)).toBe(true);
    expect(shouldShowSceneView(959, { pathname: '/app', search: '', hash: '#s=abc' })).toBe(true);
    expect(shouldShowSceneView(960, stored)).toBe(false);
    expect(shouldShowSceneView(390, { ...stored, search: '?editor=1' })).toBe(false);
    expect(shouldShowSceneView(390, { pathname: '/app', search: '', hash: '' })).toBe(false);
    expect(editorAnywayUrl(stored)).toBe('/s/k3x9q2Ab?editor=1');
    expect(editorAnywayUrl({ pathname: '/app', search: '', hash: '#s=abc' })).toBe('/app?editor=1#s=abc');
  });
});

describe('BB-LINK-16: A carried link opens its scene, backed up and named', () => {
  afterEach(() => setSceneLibraryForTests(null));
  it('replaces the scene, names it and keeps the visitor’s view settings', async () => {
    const lib = createMemoryLibrary();
    setSceneLibraryForTests(lib);
    const data = encodeShare(sharedPayload());
    addQuad();
    useVamsStore.setState({ showCoordinateTracker: true });
    const ok = await openSharedScene({ kind: 'carried', data }, { openLibrary: () => {} });
    expect(ok).toBe(true);
    const s = useVamsStore.getState();
    expect(s.sceneName).toBe('Solar system');
    expect(s.objects).toHaveLength(1);
    expect(s.showCoordinateTracker).toBe(true);
    expect((await lib.list()).some((e) => e.kind === 'backup' && e.reason === 'shared-link')).toBe(true);
  });
});

describe('BB-LINK-17: A stored link fetches its scene; failures say why', () => {
  afterEach(() => setSceneLibraryForTests(null));
  it('opens on 200 and words 404, offline, damaged and server errors', async () => {
    const lib = createMemoryLibrary();
    setSceneLibraryForTests(lib);
    const errors = vi.spyOn(toast, 'error');
    const body = JSON.stringify(sharedPayload());
    expect(await openSharedScene({ kind: 'stored', id: 'k3x9q2Ab' }, { openLibrary: () => {}, fetchImpl: vi.fn(async () => new Response(body, { status: 200 })) })).toBe(true);
    expect(useVamsStore.getState().sceneName).toBe('Solar system');
    await openSharedScene({ kind: 'stored', id: 'k3x9q2Ab' }, { openLibrary: () => {}, fetchImpl: vi.fn(async () => new Response('', { status: 404 })) });
    expect(errors).toHaveBeenLastCalledWith(SHARE_MESSAGES.missing);
    expect(SHARE_MESSAGES.missing).toBe('That shared scene has expired or can’t be found. Ask for a new link.');
    await openSharedScene({ kind: 'stored', id: 'k3x9q2Ab' }, { openLibrary: () => {}, fetchImpl: vi.fn(async () => { throw new TypeError('offline'); }) });
    expect(errors).toHaveBeenLastCalledWith('Connect to the internet to open this shared scene.');
    await openSharedScene({ kind: 'carried', data: 'damaged' }, { openLibrary: () => {} });
    expect(errors).toHaveBeenLastCalledWith('That link is incomplete. Ask for it again.');
    await openSharedScene({ kind: 'stored', id: 'k3x9q2Ab' }, { openLibrary: () => {}, fetchImpl: vi.fn(async () => new Response('', { status: 503 })) });
    expect(errors).toHaveBeenLastCalledWith('That shared scene couldn’t be loaded. Try again in a moment.');
    errors.mockRestore();
  });
});

describe('BB-LINK-18: Opening a shared link leaves a running lesson first', () => {
  afterEach(() => setSceneLibraryForTests(null));
  it('ends the lesson, so its backup does not return over the shared scene', async () => {
    setSceneLibraryForTests(createMemoryLibrary());
    const data = encodeShare(sharedPayload());
    useVamsStore.setState({ appMode: 'Lesson', activeLessonId: 'transforms-demo-1', sceneBackup: [], currentStepIndex: 1 });
    await openSharedScene({ kind: 'carried', data }, { openLibrary: () => {} });
    const s = useVamsStore.getState();
    expect(s.activeLessonId).toBeNull();
    expect(s.appMode).toBe('Author');
    expect(s.sceneBackup).toBeNull();
    expect(s.objects).toHaveLength(1);
  });
});

describe('BB-LINK-19: A texture the share does not carry is dropped, and the scene still opens', () => {
  afterEach(() => setSceneLibraryForTests(null));
  it('detaches the missing texture', async () => {
    setSceneLibraryForTests(createMemoryLibrary());
    const p = sharedPayload() as ReturnType<typeof sharedPayload> & { objects: Record<string, unknown>[] };
    p.objects = p.objects.map((o) => ({ ...o, texture: { textureId: 'not-here', filter: 'NEAREST', wrap: 'REPEAT' } }));
    expect(await openSharedScene({ kind: 'carried', data: encodeShare(p as never) }, { openLibrary: () => {} })).toBe(true);
    expect(useVamsStore.getState().objects[0].texture).toBeNull();
  });
});

describe('BB-LINK-20: A shared link in the address bar opens once, on load and on hashchange', () => {
  afterEach(() => {
    setSceneLibraryForTests(null);
    window.history.replaceState(null, '', '/');
  });
  it('cleans the URL to /app and applies a later #s= without a reload', async () => {
    setSceneLibraryForTests(createMemoryLibrary());
    const data = encodeShare(sharedPayload());
    window.history.replaceState(null, '', `/app?editor=1#s=${data}`);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const Probe = () => {
      useEditorLink();
      return null;
    };
    render(h(Probe, {}), host);
    await settle();
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/app');
    expect(useVamsStore.getState().sceneName).toBe('Solar system');
    const other = encodeShare({ ...sharedPayload(), name: 'Orbit' } as never);
    window.location.hash = `#s=${other}`;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await settle();
    expect(useVamsStore.getState().sceneName).toBe('Orbit');
    render(null, host);
    host.remove();
  });
});

describe('BB-LINK-21: /s/<id> is a route of the site', () => {
  it('renders the editor page for /s/<id>', () => {
    const source = readFileSync('src/app/SiteApp.tsx', 'utf8');
    expect(source).toMatch(/<Route path="\/s\/:id" component=\{EditorPage\} \/>/);
    const redirects = readFileSync('public/_redirects', 'utf8');
    expect(redirects).toMatch(/^\/s\/\*\s+\/app\s+200$/m);
  });
});
