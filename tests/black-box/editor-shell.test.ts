/**
 * BLACK-BOX TEST SUITE — BB-SHELL
 * The editor shell: dialogs, menus, the top bar and the section column.
 */
import { describe, it, expect, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useState } from 'react';
import { Dialog, MenuButton, type MenuEntry } from '@/shared/ui/controls';
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog';
import { confirm, useConfirmStore } from '@/shared/ui/confirm-dialog/confirm-store';
import { useVamsStore } from '@/core/store';
import { isSceneEmpty } from '@/entities/project/model/scene-empty';
import HistoryControls from '@/features/history-controls/ui/HistoryControls';
import NewWorkspaceButton from '@/features/workspace-reset/ui/NewWorkspaceButton';
import EditorPreferencesMenu from '@/features/editor-preferences/ui/EditorPreferencesMenu';
import LessonLauncher from '@/features/lesson-engine/ui/LessonLauncher';
import FileMenu from '@/widgets/layout/top-bar/FileMenu';
import { useMyScenesDialog } from '@/features/scene-library';
import { addTriangle } from '../helpers/store';

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
function key(target: EventTarget, k: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

function DialogHarness({ onClose }: { onClose: () => void }) {
  return h(Dialog, { open: true, onClose, labelledBy: 't' },
    h('h2', { id: 't' }, 'Title'),
    h('button', { id: 'first' }, 'First'),
    h('input', { id: 'middle' }),
    h('button', { id: 'last' }, 'Last'),
  );
}

describe('BB-SHELL-01: Dialog moves focus in, traps Tab, and labels itself', () => {
  it('focuses the first control and wraps Tab at both ends', async () => {
    const host = mount(h(DialogHarness, { onClose: vi.fn() }));
    await settle();
    const dialog = host.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('t');
    expect(document.activeElement?.id).toBe('first');
    (host.querySelector('#last') as HTMLElement).focus();
    const forward = key(document.activeElement!, 'Tab');
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe('first');
    const back = key(document.activeElement!, 'Tab', { shiftKey: true });
    expect(back.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe('last');
    unmount(host);
  });
});

describe('BB-SHELL-02: Esc and the scrim close the dialog; focus returns', () => {
  it('calls onClose for Esc and scrim mousedown and restores focus on unmount', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const onClose = vi.fn();
    const host = mount(h(DialogHarness, { onClose }));
    await settle();
    const windowListener = vi.fn();
    window.addEventListener('keydown', windowListener);
    key(document.activeElement!, 'Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(windowListener).not.toHaveBeenCalled();
    window.removeEventListener('keydown', windowListener);
    host.querySelector('.vdialog-scrim')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
    unmount(host);
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});

describe('BB-SHELL-03: ConfirmDialog is an alertdialog on the shared Dialog', () => {
  it('focuses confirm, Enter resolves true, Esc resolves false', async () => {
    const host = mount(h(ConfirmDialog, {}));
    let result = confirm({ title: 'Start a new workspace?', message: 'm', confirmLabel: 'New workspace' });
    await settle();
    const dialog = host.querySelector('[role="alertdialog"]')!;
    expect(dialog).not.toBeNull();
    expect(document.activeElement?.textContent).toBe('New workspace');
    key(document.activeElement!, 'Enter');
    await expect(result).resolves.toBe(true);
    result = confirm({ title: 'Again?' });
    await settle();
    key(document.activeElement!, 'Escape');
    await expect(result).resolves.toBe(false);
    expect(useConfirmStore.getState().open).toBe(false);
    unmount(host);
  });
});

function entries(log: string[]): MenuEntry[] {
  return [
    { kind: 'group', id: 'g', label: 'Demos' },
    { kind: 'item', id: 'a', label: 'Apples', onSelect: () => log.push('a') },
    { kind: 'item', id: 'b', label: 'Bananas', onSelect: () => log.push('b') },
    { kind: 'separator', id: 's' },
    { kind: 'checkbox', id: 'c', label: 'Cherries', checked: true, onSelect: () => log.push('c') },
  ];
}

describe('BB-SHELL-04: MenuButton follows the APG menu button pattern', () => {
  it('opens on ArrowDown, wraps, jumps, typeaheads, and activates with Enter', async () => {
    const log: string[] = [];
    const host = mount(h(MenuButton, { label: 'Fruit', entries: entries(log) }, 'Fruit'));
    const trigger = host.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    key(trigger, 'ArrowDown');
    await settle();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const menu = host.querySelector('[role="menu"]')!;
    expect(menu.getAttribute('aria-label')).toBe('Fruit');
    expect(menu.querySelector('[role="group"]')!.getAttribute('aria-labelledby')).toBeTruthy();
    expect(menu.querySelector('[role="separator"]')).not.toBeNull();
    expect(document.activeElement?.textContent).toContain('Apples');
    key(document.activeElement!, 'ArrowUp');
    await settle();
    expect(document.activeElement?.textContent).toContain('Cherries');
    expect(document.activeElement?.getAttribute('role')).toBe('menuitemcheckbox');
    expect(document.activeElement?.getAttribute('aria-checked')).toBe('true');
    key(document.activeElement!, 'Home');
    await settle();
    expect(document.activeElement?.textContent).toContain('Apples');
    key(document.activeElement!, 'b');
    await settle();
    expect(document.activeElement?.textContent).toContain('Bananas');
    key(document.activeElement!, 'Enter');
    await settle();
    expect(log).toEqual(['b']);
    expect(host.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    unmount(host);
  });
});

describe('BB-SHELL-05: Esc and outside clicks close the menu', () => {
  it('Esc returns focus to the trigger and does not reach window', async () => {
    const host = mount(h(MenuButton, { label: 'Fruit', entries: entries([]) }, 'Fruit'));
    const trigger = host.querySelector('button')!;
    trigger.click();
    await settle();
    const windowListener = vi.fn();
    window.addEventListener('keydown', windowListener);
    key(document.activeElement!, 'Escape');
    await settle();
    expect(windowListener).not.toHaveBeenCalled();
    window.removeEventListener('keydown', windowListener);
    expect(host.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    trigger.click();
    await settle();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await settle();
    expect(host.querySelector('[role="menu"]')).toBeNull();
    unmount(host);
  });
});

describe('BB-SHELL-06: Choosing an item that unmounts the menu does not throw', () => {
  it('survives the trigger disappearing during onSelect', async () => {
    function Host() {
      const [shown, setShown] = useState(true);
      return shown
        ? h(MenuButton, { label: 'Lessons', entries: [{ kind: 'item', id: 'x', label: 'Start', onSelect: () => setShown(false) }] }, 'Lessons')
        : h('p', {}, 'lesson running');
    }
    const host = mount(h(Host, {}));
    host.querySelector('button')!.click();
    await settle();
    expect(() => key(document.activeElement!, 'Enter')).not.toThrow();
    await settle();
    expect(host.textContent).toContain('lesson running');
    expect(document.activeElement).not.toBeNull();
    unmount(host);
  });
});

const TEXTURE = { id: 'tex-1', name: 'Bricks', isSample: false, dataUrl: 'data:image/png;base64,', width: 4, height: 4 };

function menuItems(host: HTMLElement) {
  return [...host.querySelectorAll('[role^="menuitem"]')].map((el) => el.querySelector('.vmenu__label')!.textContent);
}
async function openMenu(host: HTMLElement, name: string) {
  const trigger = [...host.querySelectorAll('button[aria-haspopup="menu"]')].find(
    (b) => b.textContent?.includes(name) || b.getAttribute('aria-label') === name,
  ) as HTMLButtonElement;
  trigger.click();
  await settle();
  return trigger;
}
function chooseItem(host: HTMLElement, label: string) {
  const item = [...host.querySelectorAll('[role^="menuitem"]')].find(
    (el) => el.querySelector('.vmenu__label')!.textContent === label,
  ) as HTMLElement;
  item.click();
}

describe('BB-SHELL-07: Undo and Redo enable as soon as there is history', () => {
  it('re-renders when past and future change', async () => {
    const host = mount(h(HistoryControls, {}));
    const [undo, redo] = host.querySelectorAll('button');
    expect(undo.getAttribute('aria-label')).toBe('Undo');
    expect(undo.disabled).toBe(true);
    useVamsStore.getState().pushToHistory();
    addTriangle();
    await settle();
    expect(undo.disabled).toBe(false);
    undo.click();
    await settle();
    expect(redo.disabled).toBe(false);
    unmount(host);
  });
});

describe('BB-SHELL-08: A scene with only uploaded textures counts as work', () => {
  it('isSceneEmpty sees textures; New workspace asks first and clears them', async () => {
    const base = useVamsStore.getState();
    expect(isSceneEmpty(base)).toBe(true);
    useVamsStore.setState({ uploadedTextures: [TEXTURE] });
    expect(isSceneEmpty(useVamsStore.getState())).toBe(false);
    const beforeReset = vi.fn().mockResolvedValue(null);
    const host = mount(h(NewWorkspaceButton, { beforeReset }));
    host.querySelector('button')!.click();
    await settle();
    expect(useConfirmStore.getState().open).toBe(true);
    useConfirmStore.getState().handleConfirm();
    await settle();
    expect(beforeReset).toHaveBeenCalledTimes(1);
    expect(useVamsStore.getState().uploadedTextures).toEqual([]);
    unmount(host);
  });
});

describe('BB-SHELL-09: The File menu lists the project actions in order', () => {
  it('shows every action in Author mode and opens My scenes', async () => {
    const host = mount(h(FileMenu, {}));
    await openMenu(host, 'File');
    expect(menuItems(host)).toEqual([
      'New workspace', 'My scenes…', 'Open project file…', 'Save project file', 'Export C++ code', 'Export scene JSON',
    ]);
    expect(host.querySelectorAll('[role="separator"]')).toHaveLength(2);
    chooseItem(host, 'My scenes…');
    await settle();
    expect(useMyScenesDialog.getState().isOpen).toBe(true);
    useMyScenesDialog.getState().close();
    unmount(host);
  });
});

describe('BB-SHELL-10: In Lesson mode the File menu only saves and exports', () => {
  it('hides the actions that replace the scene', async () => {
    useVamsStore.setState({ appMode: 'Lesson' });
    const host = mount(h(FileMenu, {}));
    await openMenu(host, 'File');
    expect(menuItems(host)).toEqual(['Save project file', 'Export C++ code', 'Export scene JSON']);
    unmount(host);
    useVamsStore.setState({ appMode: 'Author' });
  });
});

describe('BB-SHELL-11: Opening a project file asks first when the scene has work', () => {
  it('uses the shared confirm and does not open the picker on Cancel', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    addTriangle();
    const host = mount(h(FileMenu, {}));
    await openMenu(host, 'File');
    chooseItem(host, 'Open project file…');
    await settle();
    expect(useConfirmStore.getState().options?.title).toBe('Open a project file?');
    useConfirmStore.getState().handleCancel();
    await settle();
    expect(click).not.toHaveBeenCalled();
    await openMenu(host, 'File');
    chooseItem(host, 'Open project file…');
    await settle();
    useConfirmStore.getState().handleConfirm();
    await settle();
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
    unmount(host);
  });
});

describe('BB-SHELL-12: The settings menu toggles view options and opens shortcuts', () => {
  it('menuitemcheckbox entries reflect and toggle state', async () => {
    const host = mount(h(EditorPreferencesMenu, {}));
    await openMenu(host, 'View settings');
    const grid = [...host.querySelectorAll('[role="menuitemcheckbox"]')].find((el) => el.textContent?.includes('Gridlines'))!;
    const before = useVamsStore.getState().axisVisibility.showGridlines;
    expect(grid.getAttribute('aria-checked')).toBe(String(before));
    (grid as HTMLElement).click();
    await settle();
    expect(useVamsStore.getState().axisVisibility.showGridlines).toBe(!before);
    await openMenu(host, 'View settings');
    chooseItem(host, 'Keyboard shortcuts');
    await settle();
    expect(useVamsStore.getState().activeHelpTopicId).toBe('shortcuts');
    useVamsStore.getState().closeHelp();
    unmount(host);
  });
});

describe('BB-SHELL-13: The Lessons menu lists the section’s demos and exercises', () => {
  it('groups lessons and starts the chosen one', async () => {
    useVamsStore.setState({ activeSection: 'Transforms', appMode: 'Author' });
    const host = mount(h(LessonLauncher, {}));
    await openMenu(host, 'Lessons');
    const groups = [...host.querySelectorAll('.vmenu__group')].map((g) => g.textContent);
    expect(groups).toEqual(['Demos', 'Exercises']);
    chooseItem(host, 'Translate to Position');
    await settle();
    expect(useVamsStore.getState().appMode).toBe('Lesson');
    expect(useVamsStore.getState().activeLessonId).toBe('transforms-exercise-1');
    useVamsStore.getState().clearLessonState();
    useVamsStore.setState({ appMode: 'Author' });
    unmount(host);
  });
});
