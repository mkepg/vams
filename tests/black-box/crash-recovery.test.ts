/**
 * BLACK-BOX TEST SUITE — BB-RECOVER
 * Crash recovery: lesson reloads, corrupt saves, the editor error boundary and the recovery screen.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { h, render } from 'preact';
import { useVamsStore, STORAGE_KEY } from '@/core/store';
import { takeCorruptSave } from '@/core/store/recovery-signal';
import { createMemoryLibrary, setSceneLibraryForTests } from '@/entities/project/model/scene-library';
import { EditorErrorBoundary, RecoveryScreen, isChunkLoadError, type RecoveryActions } from '@/features/crash-recovery';
import { keepCorruptSave, startFresh } from '@/pages/editor/model/recovery';
import { addQuad, addTriangle } from '../helpers/store';

async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Spies this file creates, restored after each test. vi.restoreAllMocks() would also undo the
 * console silencing that tests/setup.ts installs for the whole run.
 */
const spies: { mockRestore(): void }[] = [];
function track<T extends { mockRestore(): void }>(spy: T): T {
  spies.push(spy);
  return spy;
}

function stubReload() {
  return track(vi.spyOn(window.location, 'reload').mockImplementation(() => {}));
}

afterEach(() => {
  spies.splice(0).forEach((spy) => spy.mockRestore());
  setSceneLibraryForTests(null);
  sessionStorage.clear();
});

describe('BB-RECOVER-01: Reloading mid-lesson restores the student’s own scene', () => {
  it('leaves the lesson and puts the backed-up scene back', async () => {
    const student = addTriangle();
    useVamsStore.getState().setActiveLesson('primitives-demo-1');
    addQuad(); // the lesson's scene
    await useVamsStore.persist.rehydrate();
    const s = useVamsStore.getState();
    expect(s.objects.map((o) => o.id)).toEqual([student.id]);
    expect(s.sceneBackup).toBeNull();
    expect(s.activeLessonId).toBeNull();
  });
});

describe('BB-RECOVER-02: A normal reload leaves the scene alone', () => {
  it('keeps objects when no lesson backup was saved', async () => {
    const tri = addTriangle();
    await useVamsStore.persist.rehydrate();
    expect(useVamsStore.getState().objects.map((o) => o.id)).toEqual([tri.id]);
  });
});

describe('BB-RECOVER-03: An unreadable save is handed over, not deleted silently', () => {
  it('removes the key, keeps the text for the editor, and does not reload', async () => {
    const reload = stubReload();
    localStorage.setItem(STORAGE_KEY, '{"state":');
    await useVamsStore.persist.rehydrate();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(takeCorruptSave()).toBe('{"state":');
    expect(takeCorruptSave()).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('BB-RECOVER-04: Lesson backups are saved with the scene', () => {
  it('persists sceneBackup while a lesson runs', () => {
    addTriangle();
    useVamsStore.getState().setActiveLesson('primitives-demo-1');
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.version).toBe(7);
    expect(saved.state.sceneBackup).toHaveLength(1);
    useVamsStore.getState().clearLessonState();
  });
});

function Boom({ error }: { error: Error }): null {
  throw error;
}

function mountBoundary(error: Error, actions: RecoveryActions) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(
    h(EditorErrorBoundary, { fallback: (e: Error) => h(RecoveryScreen, { error: e, actions }) }, h(Boom, { error })),
    host,
  );
  return host;
}

const fakeActions = (): RecoveryActions => ({ reload: vi.fn(), download: vi.fn(), startFresh: vi.fn().mockResolvedValue(undefined) });

describe('BB-RECOVER-05: A render crash shows the recovery screen instead of a blank page', () => {
  it('offers Reload, Download my work and Start fresh, with the error in details', async () => {
    const actions = fakeActions();
    const host = mountBoundary(new Error('kaboom'), actions);
    await settle();
    expect(host.querySelector('h1')?.textContent).toBe('VAMS hit a problem');
    const labels = [...host.querySelectorAll('button')].map((b) => b.textContent);
    expect(labels).toEqual(['Reload', 'Download my work', 'Start fresh']);
    expect(host.querySelector('details pre')?.textContent).toContain('kaboom');
    host.querySelector<HTMLButtonElement>('button')!.click();
    expect(actions.reload).toHaveBeenCalledTimes(1);
    render(null, host);
    host.remove();
  });
});

describe('BB-RECOVER-06: A failed editor download reloads once, then shows the recovery screen', () => {
  it('reloads on the first chunk error in a tab session only', async () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/EditorApp-x.js'))).toBe(true);
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('kaboom'))).toBe(false);

    const reload = stubReload();
    const chunkError = new TypeError('Failed to fetch dynamically imported module: /assets/EditorApp-x.js');
    let host = mountBoundary(chunkError, fakeActions());
    await settle();
    expect(reload).toHaveBeenCalledTimes(1);
    render(null, host);
    host.remove();

    host = mountBoundary(chunkError, fakeActions());
    await settle();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(host.querySelector('h1')?.textContent).toBe('VAMS hit a problem');
    render(null, host);
    host.remove();
  });
});

describe('BB-RECOVER-07: An unreadable save is kept in My scenes', () => {
  it('stores the raw text as a corrupt-save backup', async () => {
    const library = createMemoryLibrary();
    setSceneLibraryForTests(library);
    await keepCorruptSave('{"state":', () => {});
    const [entry] = await library.list();
    expect(entry).toMatchObject({ kind: 'backup', reason: 'corrupt-save', name: 'Unreadable saved scene', file: null, raw: '{"state":' });
  });
});

describe('BB-RECOVER-08: Start fresh keeps the scene first, as a backup or as a download', () => {
  it('backs up to My scenes, clears the save and reloads', async () => {
    const library = createMemoryLibrary();
    setSceneLibraryForTests(library);
    const reload = stubReload();
    addTriangle();
    await startFresh();
    expect((await library.list()).map((e) => e.reason)).toEqual(['recovery']);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it('downloads the scene when the library cannot be written', async () => {
    const failing = createMemoryLibrary();
    setSceneLibraryForTests({ ...failing, save: () => Promise.reject(new Error('full')) });
    const reload = stubReload();
    // happy-dom follows a clicked download link, which would move the test page to the blob URL.
    const clicked = track(vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}));
    addTriangle();
    await startFresh();
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
