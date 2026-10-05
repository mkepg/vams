/**
 * BLACK-BOX TEST SUITE — BB-LIB
 * My scenes: the scene library, scene operations and the My scenes dialog.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createStore } from 'idb-keyval';
import { useVamsStore } from '@/core/store';
import { buildProjectFile } from '@/entities/project/model/project-io';
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
