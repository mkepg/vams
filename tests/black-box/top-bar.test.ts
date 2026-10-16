/**
 * BLACK-BOX TEST SUITE — BB-TOP
 * The editor's top bar: layout, the scene title, the File and settings menus.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useVamsStore } from '@/core/store';
import TopBar from '@/widgets/layout/top-bar';
import { SceneTitle, useSaveStatus } from '@/features/scene-library';
import { readThemeChoice, setThemeChoice } from '@/shared/lib/theme';

async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}
function mount(vnode: VNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(vnode, host);
  return host;
}
function unmount(host: HTMLElement) {
  render(null, host);
  host.remove();
}
async function openMenu(host: HTMLElement, label: string) {
  const trigger = [...host.querySelectorAll('button[aria-haspopup="menu"]')].find(
    (b) => b.getAttribute('aria-label') === label || b.textContent?.trim() === label,
  ) as HTMLButtonElement;
  trigger.click();
  await settle();
}
const menuItems = () =>
  [...document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]')].map((el) =>
    el.textContent?.trim(),
  );
const press = (el: Element, key: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

afterEach(() => {
  useVamsStore.setState({ appMode: 'Author', activeLessonId: null, currentStepIndex: 0, sceneName: 'Untitled scene' });
  useSaveStatus.setState({ status: 'idle' });
  setThemeChoice('system');
});

describe('BB-TOP-01: Layout B puts File, Learn and the scene on the left', () => {
  it('orders the controls and has one theme control', async () => {
    const host = mount(h(TopBar, {}));
    await settle();
    const left = host.querySelector('.top-bar__left')!;
    expect([...left.querySelectorAll('button')].map((b) => b.textContent?.trim())).toEqual(['File', 'Learn', 'Untitled scene']);
    const right = host.querySelector('.top-bar__actions')!;
    expect(right.querySelector('[aria-label="Settings"]')).not.toBeNull();
    expect(host.querySelector('[aria-label^="Switch to the"]')).toBeNull();
    expect(host.querySelector('.top-bar__share .share-button')).not.toBeNull();
    unmount(host);
  });
});

describe('BB-TOP-02: The File menu no longer repeats Save', () => {
  it('lists Save project file once and has no JSON export', async () => {
    const host = mount(h(TopBar, {}));
    await settle();
    await openMenu(host, 'File');
    const items = menuItems();
    expect(items.filter((label) => label === 'Save project file')).toHaveLength(1);
    expect(items).not.toContain('Export scene JSON');
    unmount(host);
  });
});

describe('BB-TOP-03: Settings holds the theme and the shortcuts', () => {
  it('offers Light, Dark and System and Keyboard shortcuts, and no view checkboxes', async () => {
    const host = mount(h(TopBar, {}));
    await settle();
    await openMenu(host, 'Settings');
    expect(menuItems()).toEqual(['Light', 'Dark', 'System', 'Keyboard shortcuts']);
    const radio = (name: string) =>
      [...document.querySelectorAll('[role="menuitemradio"]')].find((el) => el.textContent?.trim() === name) as HTMLElement;
    radio('Dark').click();
    await settle();
    expect(readThemeChoice()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    await openMenu(host, 'Settings');
    expect(radio('Dark').getAttribute('aria-checked')).toBe('true');
    expect(radio('System').getAttribute('aria-checked')).toBe('false');
    radio('System').click();
    await settle();
    expect(readThemeChoice()).toBe('system');
    expect(localStorage.getItem('vams-theme')).toBeNull();
    await openMenu(host, 'Settings');
    expect(radio('System').getAttribute('aria-checked')).toBe('true');
    unmount(host);
  });
});

describe('BB-TOP-04: The scene name renames in place', () => {
  it('saves on Enter, normalised, and Escape cancels', async () => {
    useVamsStore.setState({ sceneName: 'Untitled scene' });
    const host = mount(h(SceneTitle, {}));
    await settle();
    (host.querySelector('.scene-title__name') as HTMLButtonElement).click();
    await settle();
    const input = host.querySelector('input') as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    input.value = '  Solar system ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    press(input, 'Enter');
    await settle();
    expect(useVamsStore.getState().sceneName).toBe('Solar system');
    (host.querySelector('.scene-title__name') as HTMLButtonElement).click();
    await settle();
    const again = host.querySelector('input') as HTMLInputElement;
    again.value = 'Nope';
    again.dispatchEvent(new Event('input', { bubbles: true }));
    press(again, 'Escape');
    await settle();
    expect(useVamsStore.getState().sceneName).toBe('Solar system');
    expect(document.activeElement).toBe(host.querySelector('.scene-title__name'));
    unmount(host);
  });

  it('ignores the blur that follows Escape', async () => {
    useVamsStore.setState({ sceneName: 'Kept' });
    const host = mount(h(SceneTitle, {}));
    await settle();
    (host.querySelector('.scene-title__name') as HTMLButtonElement).click();
    await settle();
    const input = host.querySelector('input') as HTMLInputElement;
    input.value = 'Discarded';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    press(input, 'Escape');
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await settle();
    expect(useVamsStore.getState().sceneName).toBe('Kept');
    unmount(host);
  });
});

describe('BB-TOP-04 (cont.): committing a typed name', () => {
  it('normalises an empty or whitespace-only name on Enter and on blur', async () => {
    for (const how of ['Enter', 'blur'] as const) {
      useVamsStore.setState({ sceneName: 'Before' });
      const host = mount(h(SceneTitle, {}));
      await settle();
      (host.querySelector('.scene-title__name') as HTMLButtonElement).click();
      await settle();
      const input = host.querySelector('input') as HTMLInputElement;
      input.value = '   ';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      if (how === 'Enter') press(input, 'Enter');
      else input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      await settle();
      const name = useVamsStore.getState().sceneName;
      expect(name.trim()).not.toBe('');
      expect(name).toBe(name.trim());
      unmount(host);
    }
  });

  it('commits the live typed value on blur alone', async () => {
    useVamsStore.setState({ sceneName: 'Before' });
    const host = mount(h(SceneTitle, {}));
    await settle();
    (host.querySelector('.scene-title__name') as HTMLButtonElement).click();
    await settle();
    const input = host.querySelector('input') as HTMLInputElement;
    input.value = ' Typed then blurred ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await settle();
    expect(useVamsStore.getState().sceneName).toBe('Typed then blurred');
    unmount(host);
  });

  it('drops a half-finished rename when a lesson starts, and renames normally afterwards', async () => {
    useVamsStore.setState({ sceneName: 'Before' });
    const host = mount(h(SceneTitle, {}));
    await settle();
    (host.querySelector('.scene-title__name') as HTMLButtonElement).click();
    await settle();
    expect(host.querySelector('input')).not.toBeNull();
    render(h(SceneTitle, { lessonLabel: 'Lesson · Step 1 of 2' }), host);
    await settle();
    render(h(SceneTitle, {}), host);
    await settle();
    expect(host.querySelector('input')).toBeNull();
    (host.querySelector('.scene-title__name') as HTMLButtonElement).click();
    await settle();
    const again = host.querySelector('input') as HTMLInputElement;
    again.value = 'After lesson';
    again.dispatchEvent(new Event('input', { bubbles: true }));
    again.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await settle();
    expect(useVamsStore.getState().sceneName).toBe('After lesson');
    unmount(host);
  });
});

describe('BB-TOP-05: The save state reads Saving, Saved or Not saved', () => {
  it('follows the auto-save status', async () => {
    const host = mount(h(SceneTitle, {}));
    const state = () => host.querySelector('.scene-title__state')?.textContent ?? '';
    useSaveStatus.setState({ status: 'saving' });
    await settle();
    expect(state()).toBe('Saving…');
    useSaveStatus.setState({ status: 'saved' });
    await settle();
    expect(state()).toBe('Saved');
    useSaveStatus.setState({ status: 'error' });
    await settle();
    expect(state()).toBe('Not saved');
    expect(host.querySelector('.scene-title__state')!.getAttribute('title')).toContain('storage');
    useSaveStatus.setState({ status: 'idle' });
    await settle();
    expect(state()).toBe('');
    unmount(host);
  });
});

describe('BB-TOP-06: During a lesson the slot shows the lesson and its step', () => {
  it('reads the title and step, with no rename and no save state', async () => {
    useVamsStore.setState({ appMode: 'Lesson', activeLessonId: 'transforms-demo-1', currentStepIndex: 2 });
    const host = mount(h(TopBar, {}));
    await settle();
    const title = host.querySelector('.scene-title')!;
    expect(title.textContent).toMatch(/^.+ · Step 3 of \d+$/);
    expect(title.querySelector('.scene-title__name')).toBeNull();
    expect(title.querySelector('.scene-title__state')).toBeNull();
    unmount(host);
  });

  it('shows a label given to SceneTitle', async () => {
    const host = mount(h(SceneTitle, { lessonLabel: 'Demo · Step 1 of 4' }));
    await settle();
    expect(host.querySelector('.scene-title')!.textContent).toBe('Demo · Step 1 of 4');
    unmount(host);
  });
});
