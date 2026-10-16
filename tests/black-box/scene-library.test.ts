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
  sceneIdentity,
  sceneNameFromFile,
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
  startSceneAutosave,
  useSaveStatus,
} from '@/features/scene-library';
import { addQuad, addTriangle } from '../helpers/store';
import { h, render } from 'preact';
import MyScenesDialog from '@/features/scene-library/ui/MyScenesDialog';
import { useMyScenesDialog } from '@/features/scene-library/model/dialog-store';
import NewWorkspaceButton from '@/features/workspace-reset/ui/NewWorkspaceButton';
import { useConfirmStore } from '@/shared/ui/confirm-dialog/confirm-store';

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
    expect(isSceneEmpty({ ...blank, callbacks: { ...blank.callbacks, idle: { handlerName: 'x', rules: [] } } })).toBe(false);
    expect(isSceneEmpty({ ...blank, viewportLimits: { minX: -2, maxX: 2, minY: -1, maxY: 1 } })).toBe(false);
    expect(isSceneEmpty({ ...blank, uploadedTextures: [{ id: 'up-1' } as (typeof blank.uploadedTextures)[number]] })).toBe(false);
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
    expect(entry?.name).toBe(`Before opening ‘Triangle’`);
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
    const result = await replaceScene(incoming, { reason: 'library-open', label: backupLabel('Q'), name: 'Q' });
    expect(result).toEqual({ backedUp: true, detached: 0 });
    const state = useVamsStore.getState();
    expect(state.objects.map((o) => o.id)).toEqual(['q']);
    expect(state.theme).toBe(toEditorTheme(getActiveTheme()));
    expect(state.past).toEqual([]);
    expect(await library.list()).toHaveLength(1);
  });
  it('reports no backup when the scene was empty', async () => {
    useMemoryLibrary();
    const result = await replaceScene(sanitizeProjectData({ objects: [] }), { reason: 'scene-link', label: 'x', name: 'x' });
    expect(result.backedUp).toBe(false);
  });
});

describe('BB-LIB-09: A failed backup leaves the scene untouched', () => {
  afterEach(() => setSceneLibraryForTests(null));
  it('rejects and keeps the current objects', async () => {
    setSceneLibraryForTests(failingLibrary());
    const tri = addTriangle();
    await expect(
      replaceScene(sanitizeProjectData({ objects: [] }), { reason: 'scene-link', label: 'x', name: 'x' }),
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

async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

function mount(vnode: ReturnType<typeof h>) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(vnode, host);
  return host;
}

function unmount(host: HTMLElement) {
  render(null, host);
  host.remove();
}

async function mountDialog() {
  useMyScenesDialog.getState().open();
  const host = mount(h(MyScenesDialog, null));
  await settle();
  return host;
}

function buttonNamed(host: HTMLElement, name: string): HTMLButtonElement | undefined {
  return [...host.querySelectorAll('button')].find(
    (b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name,
  );
}

function rowNames(host: HTMLElement, list: 'saved' | 'backups'): string[] {
  return [...host.querySelectorAll(`[data-list="${list}"] .my-scenes__name`)].map((n) => n.textContent ?? '');
}

describe('BB-LIB-11: My scenes lists saved scenes and backups separately', () => {
  afterEach(() => {
    setSceneLibraryForTests(null);
    useMyScenesDialog.getState().close();
  });
  it('shows each list newest first and offers only Download for an unreadable save', async () => {
    // The memory adapter reports persistent: false; present it as the browser-backed store the note describes.
    const library = { ...createMemoryLibrary(), persistent: true };
    setSceneLibraryForTests(library);
    await library.save(entry('s1', 'saved', 1000, 'Older'));
    await library.save(entry('s2', 'saved', 2000, 'Newer'));
    await library.save({ ...entry('c', 'backup', 3000, 'Unreadable saved scene'), reason: 'corrupt-save', file: null, raw: '{' });
    const host = await mountDialog();
    expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-labelledby')).toBe('my-scenes-title');
    expect(rowNames(host, 'saved')).toEqual(['Newer', 'Older']);
    expect(rowNames(host, 'backups')).toEqual(['Unreadable saved scene']);
    expect(buttonNamed(host, 'Open Unreadable saved scene')).toBeUndefined();
    expect(buttonNamed(host, 'Download Unreadable saved scene')).toBeDefined();
    expect(host.textContent).toContain('Clearing site data removes them');
    unmount(host);
  });
});

describe('BB-LIB-12: Saving the current scene from the dialog', () => {
  afterEach(() => {
    setSceneLibraryForTests(null);
    useMyScenesDialog.getState().close();
  });
  it('is disabled for an empty scene and saves a named entry otherwise', async () => {
    const library = useMemoryLibrary();
    let host = await mountDialog();
    expect(buttonNamed(host, 'Save copy')?.disabled).toBe(true);
    expect(host.textContent).toContain('Add something to the canvas first.');
    expect(host.textContent).toContain('Nothing saved yet.');
    unmount(host);

    addTriangle();
    host = await mountDialog();
    const input = host.querySelector<HTMLInputElement>('#my-scenes-name')!;
    input.value = 'My triangle';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect((await library.list()).map((e) => [e.name, e.kind])).toEqual([['My triangle', 'saved']]);
    expect(rowNames(host, 'saved')).toEqual(['My triangle']);
    unmount(host);
  });
});

describe('BB-LIB-13: Opening an entry replaces the scene and keeps the old one as a backup', () => {
  afterEach(() => {
    setSceneLibraryForTests(null);
    useMyScenesDialog.getState().close();
  });
  it('sanitises the stored file, loads it and closes the dialog', async () => {
    const library = useMemoryLibrary();
    const stored = entry('s1', 'saved', 1000, 'Stored');
    // An entry written by another build: one valid quad and one object type this build does not know.
    stored.file = {
      ...stored.file!,
      data: { ...stored.file!.data, objects: [{ id: 'q', name: 'Q', type: 'QUADS', vertices: [] }, { id: 'z', type: 'HEXAGON' }] as never },
    };
    await library.save(stored);
    addTriangle();
    const host = await mountDialog();
    buttonNamed(host, 'Open Stored')!.click();
    await settle();
    expect(useVamsStore.getState().objects.map((o) => o.id)).toEqual(['q']);
    expect(useMyScenesDialog.getState().isOpen).toBe(false);
    const backups = (await library.list()).filter((e) => e.kind === 'backup');
    expect(backups.map((e) => e.name)).toEqual(['Before opening ‘Stored’']);
    unmount(host);
  });
});

describe('BB-LIB-14: Renaming in place: Enter saves, Escape cancels without closing', () => {
  afterEach(() => {
    setSceneLibraryForTests(null);
    useMyScenesDialog.getState().close();
  });
  it('renames with Enter and keeps the dialog open on Escape', async () => {
    const library = useMemoryLibrary();
    await library.save(entry('s1', 'saved', 1000, 'Draft'));
    const host = await mountDialog();
    buttonNamed(host, 'Rename Draft')!.click();
    await settle();
    let field = host.querySelector<HTMLInputElement>('input[aria-label="New name for Draft"]')!;
    field.value = 'Final';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
    expect((await library.get('s1'))?.name).toBe('Final');

    buttonNamed(host, 'Rename Final')!.click();
    await settle();
    field = host.querySelector<HTMLInputElement>('input[aria-label="New name for Final"]')!;
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(useMyScenesDialog.getState().isOpen).toBe(true);
    expect(host.querySelector('input[aria-label="New name for Final"]')).toBeNull();
    unmount(host);
  });
});

describe('BB-LIB-15: New workspace keeps a backup first and stops if it cannot', () => {
  it('clears after a successful backup and keeps the scene when the backup fails', async () => {
    const ok = vi.fn().mockResolvedValue(null);
    addTriangle();
    let host = mount(h(NewWorkspaceButton, { beforeReset: ok }));
    host.querySelector('button')!.click();
    await settle();
    expect(useConfirmStore.getState().options?.message).toBe('Your current scene will be kept in My scenes as a backup.');
    useConfirmStore.getState().handleConfirm();
    await settle();
    expect(ok).toHaveBeenCalledTimes(1);
    expect(useVamsStore.getState().objects).toEqual([]);
    unmount(host);

    const failing = vi.fn().mockRejectedValue(new Error('full'));
    addTriangle();
    host = mount(h(NewWorkspaceButton, { beforeReset: failing }));
    host.querySelector('button')!.click();
    await settle();
    useConfirmStore.getState().handleConfirm();
    await settle();
    expect(useVamsStore.getState().objects).toHaveLength(1);
    unmount(host);
  });
});

describe('BB-LIB-16: A full browser storage does not break the dialog', () => {
  afterEach(() => {
    setSceneLibraryForTests(null);
    useMyScenesDialog.getState().close();
  });
  it('keeps the scene and the dialog when Save fails', async () => {
    setSceneLibraryForTests(failingLibrary());
    const tri = addTriangle();
    const host = await mountDialog();
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect(useMyScenesDialog.getState().isOpen).toBe(true);
    expect(useVamsStore.getState().objects.map((o) => o.id)).toEqual([tri.id]);
    expect(buttonNamed(host, 'Save copy')?.disabled).toBe(false);
    unmount(host);
  });
});

describe('BB-LIB-17: The working scene has a name the student can change', () => {
  it('normalises names as My scenes does, and makes fresh identities', () => {
    const s = useVamsStore.getState();
    s.renameScene('  Solar system  ');
    expect(useVamsStore.getState().sceneName).toBe('Solar system');
    s.renameScene('   ');
    expect(useVamsStore.getState().sceneName).toBe(UNTITLED_SCENE);
    s.renameScene('x'.repeat(120));
    expect(useVamsStore.getState().sceneName).toHaveLength(80);
    const a = sceneIdentity();
    const b = sceneIdentity('Orbit');
    expect(a.sceneName).toBe(UNTITLED_SCENE);
    expect(b.sceneName).toBe('Orbit');
    expect(a.sceneId).not.toBe(b.sceneId);
    expect(sceneIdentity('Kept', 'id-9').sceneId).toBe('id-9');
    expect(sceneNameFromFile('solar-system.vams')).toBe('solar-system');
    expect(sceneNameFromFile('scene.JSON')).toBe('scene');
    expect(sceneNameFromFile('.vams')).toBe(UNTITLED_SCENE);
  });
});

async function drainAutosave(done: () => Promise<void> | void) {
  await vi.advanceTimersByTimeAsync(1100);
  await vi.waitFor(done);
}

describe('BB-LIB-18: Edits save the working scene to its own My scenes entry', () => {
  afterEach(() => vi.useRealTimers());

  it('writes the scene under its id and name a second after the edit', async () => {
    vi.useFakeTimers();
    const lib = createMemoryLibrary();
    useVamsStore.setState({ sceneId: 'mine', sceneName: 'Solar system' });
    const stop = startSceneAutosave({ library: async () => lib });
    addTriangle();
    expect(useSaveStatus.getState().status).toBe('saving');
    expect(await lib.list()).toEqual([]);
    await drainAutosave(() => expect(useSaveStatus.getState().status).toBe('saved'));
    const [entry] = await lib.list();
    expect(entry).toMatchObject({ id: 'mine', name: 'Solar system', kind: 'saved', reason: null });
    expect(entry.file!.data.objects).toHaveLength(1);
    stop();
  });
});

describe('BB-LIB-19: An empty untitled scene is not saved, a named one is', () => {
  afterEach(() => vi.useRealTimers());

  it('skips the blank editor and saves once the scene is renamed', async () => {
    vi.useFakeTimers();
    const lib = createMemoryLibrary();
    const stop = startSceneAutosave({ library: async () => lib });
    useVamsStore.setState({ sceneId: 'other' });
    await vi.advanceTimersByTimeAsync(1100);
    expect(await lib.list()).toEqual([]);
    useVamsStore.getState().renameScene('Plan');
    await drainAutosave(async () => expect((await lib.list()).map((e) => e.name)).toEqual(['Plan']));
    stop();
  });
});

describe('BB-LIB-20: Lesson scenes never write to My scenes', () => {
  afterEach(() => vi.useRealTimers());

  it('does nothing while a lesson is active', async () => {
    vi.useFakeTimers();
    const lib = createMemoryLibrary();
    const stop = startSceneAutosave({ library: async () => lib });
    useVamsStore.setState({ activeLessonId: 'transforms-demo-1', appMode: 'Lesson' });
    addTriangle();
    await vi.advanceTimersByTimeAsync(1100);
    expect(await lib.list()).toEqual([]);
    useVamsStore.setState({ activeLessonId: null, appMode: 'Author' });
    stop();
  });
});

describe('BB-LIB-21: An edit just before a scene switch is saved to the scene it belongs to', () => {
  afterEach(() => vi.useRealTimers());

  it('writes the old content to the old entry and the new content to the new one', async () => {
    vi.useFakeTimers();
    const lib = createMemoryLibrary();
    useVamsStore.setState({ sceneId: 'old', sceneName: 'Old' });
    const stop = startSceneAutosave({ library: async () => lib });
    addTriangle();
    addQuad();
    loadProjectData(sanitizeProjectData({ objects: [] }), sceneIdentity('New', 'new'));
    addTriangle();
    await drainAutosave(async () => expect(await lib.list()).toHaveLength(2));
    const byId = Object.fromEntries((await lib.list()).map((e) => [e.id, e]));
    expect(byId.old.file!.data.objects).toHaveLength(2);
    expect(byId.old.name).toBe('Old');
    expect(byId.new.file!.data.objects).toHaveLength(1);
    expect(byId.new.name).toBe('New');
    stop();
  });

  it('never shows the new content under the old id', () => {
    useVamsStore.setState({ sceneId: 'old', sceneName: 'Old' });
    addTriangle();
    const seen: [string, number][] = [];
    const unsub = useVamsStore.subscribe((s) => seen.push([s.sceneId, s.objects.length]));
    loadProjectData(sanitizeProjectData({ objects: [] }), sceneIdentity('New', 'new'));
    unsub();
    expect(seen.some(([id, n]) => id === 'old' && n === 0)).toBe(false);
  });
});

describe('BB-LIB-22: A refused save shows "Not saved" and breaks nothing', () => {
  afterEach(() => vi.useRealTimers());

  it('sets the error status, then recovers on the next good save', async () => {
    vi.useFakeTimers();
    const lib = createMemoryLibrary();
    const refuse = vi.spyOn(lib, 'save').mockRejectedValueOnce(new DOMException('full', 'QuotaExceededError'));
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    useVamsStore.setState({ sceneId: 'mine', sceneName: 'Mine' });
    const stop = startSceneAutosave({ library: async () => lib });
    expect(() => addTriangle()).not.toThrow();
    await drainAutosave(() => expect(useSaveStatus.getState().status).toBe('error'));
    addQuad();
    await drainAutosave(() => expect(useSaveStatus.getState().status).toBe('saved'));
    expect(refuse).toHaveBeenCalledTimes(2);
    errors.mockRestore();
    stop();
  });
});

describe('BB-LIB-23: Opening a scene sets its name and id', () => {
  afterEach(() => setSceneLibraryForTests(null));

  it('starts a new identity for a preset or file, and adopts a saved entry', async () => {
    setSceneLibraryForTests(createMemoryLibrary());
    useVamsStore.setState({ sceneId: 'before', sceneName: 'Before' });
    await replaceScene(sanitizeProjectData({ objects: [] }), { reason: 'open-file', label: 'x', name: 'orbit' });
    expect(useVamsStore.getState().sceneName).toBe('orbit');
    expect(useVamsStore.getState().sceneId).not.toBe('before');
    await replaceScene(sanitizeProjectData({ objects: [] }), {
      reason: 'library-open',
      label: 'x',
      name: 'Kept',
      adoptId: 'saved-7',
    });
    expect(useVamsStore.getState()).toMatchObject({ sceneId: 'saved-7', sceneName: 'Kept' });
  });
});

describe('BB-LIB-24: A new workspace is a new untitled scene, and My scenes saves a copy', () => {
  afterEach(() => {
    setSceneLibraryForTests(null);
    useMyScenesDialog.getState().close();
  });

  it('resets the identity and labels the manual save as a copy', async () => {
    useMemoryLibrary();
    useVamsStore.setState({ sceneId: 'before', sceneName: 'Before' });
    addTriangle();
    const host = mount(h(NewWorkspaceButton, { beforeReset: async () => {} }));
    host.querySelector('button')!.click();
    await settle();
    useConfirmStore.getState().handleConfirm();
    await settle();
    expect(useVamsStore.getState().sceneName).toBe(UNTITLED_SCENE);
    expect(useVamsStore.getState().sceneId).not.toBe('before');
    unmount(host);

    addTriangle();
    const dialog = await mountDialog();
    expect(dialog.textContent).toContain('Save a copy');
    unmount(dialog);
  });
});

describe('BB-LIB-25: Renaming the working scene in My scenes renames it in the editor', () => {
  afterEach(() => {
    setSceneLibraryForTests(null);
    useMyScenesDialog.getState().close();
  });

  it('keeps the next auto-save from undoing the rename', async () => {
    const library = useMemoryLibrary();
    useVamsStore.setState({ sceneId: 'mine', sceneName: 'Mine' });
    addTriangle();
    await library.save(entry('mine', 'saved', 1000, 'Mine'));
    await library.save(entry('other', 'saved', 500, 'Other'));
    const host = await mountDialog();
    const rename = async (label: string, value: string) => {
      buttonNamed(host, label)!.click();
      await settle();
      const input = host.querySelector<HTMLInputElement>('.my-scenes__rename')!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await settle();
    };
    await rename('Rename Other', 'Elsewhere');
    expect(useVamsStore.getState().sceneName).toBe('Mine');
    await rename('Rename Mine', 'Renamed');
    expect((await library.get('mine'))?.name).toBe('Renamed');
    expect(useVamsStore.getState().sceneName).toBe('Renamed');
    unmount(host);
  });
});
