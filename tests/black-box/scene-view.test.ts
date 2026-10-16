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
  it('leaves localStorage untouched and shows no canvas while loading', async () => {
    const data = carried();
    localStorage.setItem(STORAGE_KEY, '{"state":{"sceneName":"Mine"},"version":11}');
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    window.history.replaceState(null, '', `/app#s=${data}`);
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h(SceneViewApp, {}), host);
    expect(host.querySelector('.canvas-wrapper')).toBeNull();
    await settle();
    expect(host.querySelector('.canvas-wrapper')).not.toBeNull();
    useVamsStore.getState().renameScene('Changed in the view');
    await settle();
    expect(writes.mock.calls.filter(([key]) => key === STORAGE_KEY)).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{"state":{"sceneName":"Mine"},"version":11}');
    writes.mockRestore();
    render(null, host);
    host.remove();
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
