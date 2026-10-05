/**
 * BLACK-BOX TEST SUITE — BB-RECOVER
 * Crash recovery: lesson reloads, corrupt saves, the editor error boundary and the recovery screen.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { h, render } from 'preact';
import { useVamsStore, STORAGE_KEY } from '@/core/store';
import { peekCorruptSave, reportCorruptSave, takeCorruptSave } from '@/core/store/recovery-signal';
import { createMemoryLibrary, setSceneLibraryForTests } from '@/entities/project/model/scene-library';
import { EditorErrorBoundary, RecoveryScreen, isChunkLoadError, type RecoveryActions } from '@/features/crash-recovery';
import { downloadWork, keepCorruptSave, startFresh } from '@/pages/editor/model/recovery';
import { addQuad, addTriangle } from '../helpers/store';
import type { VamsProjectFile } from '@/entities/project/model/project-io';

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

const fakeActions = (): RecoveryActions => ({ reload: vi.fn(), download: vi.fn().mockResolvedValue(undefined), startFresh: vi.fn().mockResolvedValue(undefined) });

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
  it('shows a message when Download my work or Start fresh cannot run', async () => {
    const actions: RecoveryActions = { reload: vi.fn(), download: vi.fn().mockRejectedValue(new Error('offline')), startFresh: vi.fn().mockRejectedValue(new Error('offline')) };
    const host = mountBoundary(new Error('kaboom'), actions);
    await settle();
    const buttons = [...host.querySelectorAll('button')];
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('');
    buttons[1].click();
    await settle();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("That didn't work. Reload to try again.");
    buttons[2].click();
    await settle();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("That didn't work. Reload to try again.");
    expect(actions.startFresh).toHaveBeenCalledTimes(1);
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

describe('BB-RECOVER-09: Lesson textures are saved once', () => {
  it('stores no second copy of uploaded textures during a lesson and keeps them after a reload', async () => {
    const asset = { id: 'up-1', name: 'Tiny', dataUrl: 'data:image/png;base64,iVBORw0KGgo=', width: 1, height: 1 };
    useVamsStore.getState().addUploadedTexture(asset);
    addTriangle();
    useVamsStore.getState().setActiveLesson('primitives-demo-1');
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.state.uploadedTexturesBackup).toBeNull();
    expect(saved.state.uploadedTextures.map((t: { id: string }) => t.id)).toEqual(['up-1']);
    await useVamsStore.persist.rehydrate();
    expect(useVamsStore.getState().uploadedTextures.map((t) => t.id)).toEqual(['up-1']);
    useVamsStore.getState().removeUploadedTexture('up-1');
  });
});

describe('BB-RECOVER-10: Start fresh keeps the student’s scene during a lesson', () => {
  it('backs up the scene from before the lesson, not the lesson’s scene', async () => {
    const library = createMemoryLibrary();
    setSceneLibraryForTests(library);
    stubReload();
    const student = addTriangle();
    useVamsStore.getState().setActiveLesson('primitives-demo-1');
    const lessonObject = addQuad();
    await startFresh();
    const [entry] = await library.list();
    const ids = (entry.file as VamsProjectFile).data.objects.map((o) => o.id);
    expect(ids).toEqual([student.id]);
    expect(ids).not.toContain(lessonObject.id);
  });
});

describe('BB-RECOVER-11: The recovery screen drops the editor route styling', () => {
  it('removes the route-editor class from the page root when it mounts', async () => {
    document.documentElement.classList.add('route-editor');
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h(RecoveryScreen, { error: new Error('kaboom'), actions: fakeActions() }), host);
    await settle();
    expect(document.documentElement.classList.contains('route-editor')).toBe(false);
    render(null, host);
    host.remove();
  });
});

describe('BB-RECOVER-12: Download my work can still offer an unreadable save', () => {
  it('falls back to the unreadable text held in memory once the save is gone from storage', () => {
    takeCorruptSave();
    reportCorruptSave('{"state":');
    localStorage.removeItem(STORAGE_KEY);
    const blobs: Blob[] = [];
    track(vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => (blobs.push(blob as Blob), 'blob:test')));
    track(vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {}));
    track(vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}));
    track(vi.spyOn(JSON, 'stringify').mockImplementationOnce(() => {
      throw new Error('cannot serialise');
    }));
    downloadWork();
    expect(blobs).toHaveLength(1);
    expect(peekCorruptSave()).toBe('{"state":');
    takeCorruptSave();
  });
});
