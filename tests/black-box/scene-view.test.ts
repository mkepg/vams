/**
 * BLACK-BOX TEST SUITE — BB-VIEW
 * The read-only scene view a phone gets for a shared link.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { h, render } from 'preact';
import { createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEY, useVamsStore } from '@/core/store';
import { buildSharePayload, encodeShare } from '@/entities/project/model/share';
import SceneViewApp from '@/pages/editor/ui/SceneViewApp';
import { addTriangle } from '../helpers/store';

vi.mock('@/widgets/canvas/VamsCanvas', () => ({ default: () => h('div', { class: 'canvas-wrapper' }) }));

async function settle() {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}
function carried(name = 'Solar system') {
  addTriangle();
  const s = useVamsStore.getState();
  const data = encodeShare(buildSharePayload({ sceneName: name, objects: s.objects, callbacks: s.callbacks, viewportLimits: s.viewportLimits, canvasBackgroundColor: s.canvasBackgroundColor, textures: [] }));
  useVamsStore.setState({ objects: [] });
  return data;
}

afterEach(() => {
  useVamsStore.persist.setOptions({ storage: createJSONStorage(() => localStorage) });
  window.history.replaceState(null, '', '/');
});

/** Loads the store and the view fresh, as a new page load at this width and address does. */
async function loadView(seed: string | null, width: number) {
  vi.resetModules();
  // happy-dom has no 2D canvas, and a fresh module copy has lost the setup file's stand-in for the sample textures.
  vi.doMock('@/features/textures/lib/sample-textures', () => ({ getSampleTextures: () => [] }));
  localStorage.removeItem(STORAGE_KEY);
  const first = await import('@/core/store');
  const { buildSharePayload: build, encodeShare: encode } = await import('@/entities/project/model/share');
  const s = first.useVamsStore.getState();
  const data = encode(build({ sceneName: 'Shared', objects: [], callbacks: s.callbacks, viewportLimits: s.viewportLimits, canvasBackgroundColor: s.canvasBackgroundColor, textures: [] }));
  vi.resetModules();
  localStorage.removeItem(STORAGE_KEY);
  if (seed !== null) localStorage.setItem(STORAGE_KEY, seed);
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  window.history.replaceState(null, '', `/app#s=${data}`);
  const { default: View } = await import('@/pages/editor/ui/SceneViewApp');
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(h(View, {}), host);
  await settle();
  return () => {
    render(null, host);
    host.remove();
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
  };
}

describe('BB-VIEW-01: A phone sees the shared scene and its code', () => {
  it('shows the name, the window and the generated C++', async () => {
    window.history.replaceState(null, '', `/app#s=${carried()}`);
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h(SceneViewApp, {}), host);
    await settle();
    expect(host.querySelector('.scene-view__name')!.textContent).toBe('Solar system');
    expect(host.querySelector('.canvas-window__title')!.textContent).toBe('VAMS Preview');
    expect(host.querySelector('.canvas-window__btn')).toBeNull();
    expect(host.textContent).toContain('Editing needs a computer. Open this link there.');
    expect(host.querySelector('.scene-view__code')!.textContent).toContain('glBegin(GL_TRIANGLES)');
    render(null, host);
    host.remove();
  });
});

describe('BB-VIEW-02: The view writes nothing to the visitor’s storage', () => {
  it('leaves localStorage untouched through an edit, and shows no canvas while loading', async () => {
    const SEEDED = '{"state":{"sceneName":"Mine"},"version":11}';
    const done = await loadView(SEEDED, 390);
    const { useVamsStore: store } = await import('@/core/store');
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    store.getState().renameScene('Changed in the view');
    await settle();
    expect(writes.mock.calls.filter(([key]) => key === STORAGE_KEY)).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(SEEDED);
    writes.mockRestore();
    done();
  });
});

describe('BB-VIEW-03: A link that can’t open says why', () => {
  it('shows the damaged-link message', async () => {
    window.history.replaceState(null, '', '/app#s=damaged');
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h(SceneViewApp, {}), host);
    await settle();
    expect(host.textContent).toContain('That link is incomplete. Ask for it again.');
    expect(host.querySelector('.canvas-wrapper')).toBeNull();
    render(null, host);
    host.remove();
  });
});

describe('BB-VIEW-04: The view offers the editor anyway, and copies its link', () => {
  it('links to ?editor=1 and copies the current address', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const data = carried();
    window.history.replaceState(null, '', `/app#s=${data}`);
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h(SceneViewApp, {}), host);
    await settle();
    expect((host.querySelector('.scene-view__anyway') as HTMLAnchorElement).getAttribute('href')).toBe(`/app?editor=1#s=${data}`);
    ([...host.querySelectorAll('button')].find((b) => b.textContent === 'Copy link') as HTMLButtonElement).click();
    await settle();
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    render(null, host);
    host.remove();
  });
});

describe('BB-VIEW-05: Loading the view leaves the visitor’s saved editor as it was', () => {
  const SAVED = '{"state":{"sceneName":"Mine","sceneBackup":{"objects":[]}},"version":9}';
  it('keeps an existing saved entry byte for byte', async () => {
    const done = await loadView(SAVED, 390);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(SAVED);
    done();
  });

  it('creates no entry for a first-time visitor', async () => {
    const done = await loadView(null, 390);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    done();
  });

  it('still saves in the editor at a normal width', async () => {
    const done = await loadView(null, 1280);
    const { useVamsStore: store } = await import('@/core/store');
    store.getState().renameScene('Kept');
    await settle();
    expect(localStorage.getItem(STORAGE_KEY)).toContain('Kept');
    done();
  });
});

describe('BB-VIEW-06: A load that throws still ends in a message', () => {
  it('shows the unavailable message when the shared scene cannot be resolved', async () => {
    vi.resetModules();
    vi.doMock('@/widgets/canvas/VamsCanvas', () => ({ default: () => h('div', { class: 'canvas-wrapper' }) }));
    vi.doMock('@/features/share/model/resolve-shared', async (importOriginal) => ({
      ...(await importOriginal<typeof import('@/features/share/model/resolve-shared')>()),
      resolveSharedScene: () => Promise.reject(new Error('boom')),
    }));
    window.history.replaceState(null, '', '/s/k3x9q2Ab');
    const { default: View } = await import('@/pages/editor/ui/SceneViewApp');
    const { SHARE_MESSAGES } = await import('@/features/share');
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h(View, {}), host);
    await settle();
    expect(host.textContent).not.toContain('Opening the scene');
    expect(host.textContent).toContain(SHARE_MESSAGES.unavailable);
    render(null, host);
    host.remove();
    vi.doUnmock('@/features/share/model/resolve-shared');
  });
});
