/**
 * BLACK-BOX TEST SUITE — BB-LIB
 * My scenes: the scene library, scene operations and the My scenes dialog.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createStore } from 'idb-keyval';
import { useVamsStore } from '@/core/store';
import { buildProjectFile, sanitizeProjectData } from '@/entities/project/model/project-io';
import {
  BACKUP_LIMIT,
  createIdbLibrary,
  createMemoryLibrary,
  getSceneLibrary,
  normalizeSceneName,
  setSceneLibraryForTests,
  UNTITLED_SCENE,
  type SceneEntry,
  type SceneLibrary,
} from '@/entities/project/model/scene-library';
import { getActiveTheme, toEditorTheme } from '@/shared/lib/theme';
import {
  backupCurrentScene,
  backupLabel,
  entryFileName,
  isSceneEmpty,
  loadProjectData,
  replaceScene,
} from '@/features/scene-library';
import { addQuad, addTriangle } from '../helpers/store';

let dbCount = 0;
const adapters: [string, () => SceneLibrary][] = [
  ['memory', createMemoryLibrary],
  ['indexeddb', () => createIdbLibrary(createStore(`vams-test-${++dbCount}`, 'scenes'))],
];

function entry(id: string, kind: SceneEntry['kind'], at: number, name = id): SceneEntry {
  return {
    id,
    name,
    kind,
    reason: kind === 'backup' ? 'scene-link' : null,
    createdAt: at,
    updatedAt: at,
    file: buildProjectFile(useVamsStore.getState()),
    raw: null,
  };
}

describe('BB-LIB-01: Saved entries round-trip and list newest first', () => {
  it.each(adapters)('%s adapter', async (name, make) => {
    const library = make();
    expect(library.persistent).toBe(name === 'indexeddb');
    await library.save(entry('a', 'saved', 1000));
    await library.save(entry('b', 'saved', 3000));
    await library.save(entry('c', 'saved', 2000));
    expect((await library.list()).map((e) => e.id)).toEqual(['b', 'c', 'a']);
    const b = await library.get('b');
    expect(b?.file?.app).toBe('VAMS');
    expect(await library.get('missing')).toBeUndefined();
  });
});

describe('BB-LIB-02: Entries can be renamed and removed', () => {
  it.each(adapters)('%s adapter', async (_name, make) => {
    const library = make();
    await library.save(entry('a', 'saved', 1000, 'First'));
    await library.rename('a', '  Bricks  ');
    expect((await library.get('a'))?.name).toBe('Bricks');
    await library.rename('missing', 'x'); // no throw for an unknown id
    await library.remove('a');
    expect(await library.list()).toEqual([]);
  });
});

describe('BB-LIB-03: Only the newest five backups are kept; saved entries are never pruned', () => {
  it.each(adapters)('%s adapter', async (_name, make) => {
    const library = make();
    for (let i = 0; i < 3; i++) await library.save(entry(`saved-${i}`, 'saved', i));
    for (let i = 0; i < 7; i++) await library.save(entry(`backup-${i}`, 'backup', 100 + i));
    const all = await library.list();
    const backups = all.filter((e) => e.kind === 'backup').map((e) => e.id);
    expect(backups).toHaveLength(BACKUP_LIMIT);
    expect(backups).toEqual(['backup-6', 'backup-5', 'backup-4', 'backup-3', 'backup-2']);
    expect(all.filter((e) => e.kind === 'saved')).toHaveLength(3);
  });
});

describe('BB-LIB-04: Scene names are trimmed, capped and never empty', () => {
  it('normalises names', () => {
    expect(normalizeSceneName('  Bricks  ')).toBe('Bricks');
    expect(normalizeSceneName('   ')).toBe(UNTITLED_SCENE);
    expect(normalizeSceneName('x'.repeat(100))).toHaveLength(80);
  });
});

describe('BB-LIB-05: The shared library falls back to memory without IndexedDB', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setSceneLibraryForTests(null);
  });
  it('uses IndexedDB when present and memory when absent', async () => {
    setSceneLibraryForTests(null);
    expect((await getSceneLibrary()).persistent).toBe(true);
    setSceneLibraryForTests(null);
    vi.stubGlobal('indexedDB', undefined);
    expect((await getSceneLibrary()).persistent).toBe(false);
  });
});

function useMemoryLibrary(): SceneLibrary {
  const library = createMemoryLibrary();
  setSceneLibraryForTests(library);
  return library;
}

function failingLibrary(): SceneLibrary {
  const library = createMemoryLibrary();
  return { ...library, save: () => Promise.reject(new Error('QuotaExceededError')) };
}

describe('BB-LIB-06: A scene counts as empty only when nothing would be lost', () => {
  it('checks objects, background, a shape in progress, callbacks and the viewport', () => {
    const blank = useVamsStore.getState();
    expect(isSceneEmpty(blank)).toBe(true);
    expect(isSceneEmpty({ ...blank, canvasBackgroundColor: '#112233' })).toBe(false);
    expect(isSceneEmpty({ ...blank, pendingShapeType: 'TRIANGLES' })).toBe(false);
    expect(isSceneEmpty({ ...blank, callbacks: { ...blank.callbacks, idle: 'x += 1;' } })).toBe(false);
    expect(isSceneEmpty({ ...blank, viewportLimits: { minX: -2, maxX: 2, minY: -1, maxY: 1 } })).toBe(false);
    addTriangle();
    expect(isSceneEmpty(useVamsStore.getState())).toBe(false);
  });
});

describe('BB-LIB-07: Backing up the current scene', () => {
  afterEach(() => setSceneLibraryForTests(null));
  it('skips an empty scene and saves a labelled backup otherwise', async () => {
    const library = useMemoryLibrary();
    expect(await backupCurrentScene('scene-link', backupLabel('Triangle'))).toBeNull();
    expect(await library.list()).toEqual([]);

    const tri = addTriangle();
    const entry = await backupCurrentScene('scene-link', backupLabel('Triangle'));
    expect(entry?.name).toBe(`Before opening 'Triangle'`);
    const [stored] = await library.list();
    expect(stored.kind).toBe('backup');
    expect(stored.reason).toBe('scene-link');
    expect(stored.file?.data.objects.map((o) => o.id)).toEqual([tri.id]);
    expect(entryFileName(stored)).toBe('before-opening-triangle.vams');
  });
});

describe('BB-LIB-08: Replacing the scene backs up first, then loads', () => {
  afterEach(() => setSceneLibraryForTests(null));
  it('loads the data with the site theme and a cleared history', async () => {
    const library = useMemoryLibrary();
    addTriangle();
    const incoming = sanitizeProjectData({ objects: [{ id: 'q', name: 'Q', type: 'QUADS', vertices: [] }], theme: 'light' });
    const result = await replaceScene(incoming, { reason: 'library-open', label: backupLabel('Q') });
    expect(result).toEqual({ backedUp: true, detached: 0 });
    const state = useVamsStore.getState();
    expect(state.objects.map((o) => o.id)).toEqual(['q']);
    expect(state.theme).toBe(toEditorTheme(getActiveTheme()));
    expect(state.past).toEqual([]);
    expect(await library.list()).toHaveLength(1);
  });
  it('reports no backup when the scene was empty', async () => {
    useMemoryLibrary();
    const result = await replaceScene(sanitizeProjectData({ objects: [] }), { reason: 'scene-link', label: 'x' });
    expect(result.backedUp).toBe(false);
  });
});

describe('BB-LIB-09: A failed backup leaves the scene untouched', () => {
  afterEach(() => setSceneLibraryForTests(null));
  it('rejects and keeps the current objects', async () => {
    setSceneLibraryForTests(failingLibrary());
    const tri = addTriangle();
    await expect(
      replaceScene(sanitizeProjectData({ objects: [] }), { reason: 'scene-link', label: 'x' }),
    ).rejects.toThrow('QuotaExceededError');
    expect(useVamsStore.getState().objects.map((o) => o.id)).toEqual([tri.id]);
  });
});

describe('BB-LIB-10: Loading detaches textures the editor does not have', () => {
  it('drops unknown texture attachments and counts them', () => {
    addQuad();
    const data = sanitizeProjectData({
      objects: [
        { id: 'a', name: 'A', type: 'QUADS', vertices: [], texture: { textureId: 'missing', filter: 'LINEAR', wrap: 'REPEAT' } },
        { id: 'b', name: 'B', type: 'QUADS', vertices: [], texture: { textureId: 'sample-bricks', filter: 'LINEAR', wrap: 'REPEAT' } },
      ],
    });
    expect(loadProjectData(data)).toBe(1);
    const [a, b] = useVamsStore.getState().objects;
    expect(a.texture).toBeNull();
    expect(b.texture?.textureId).toBe('sample-bricks');
  });
});
