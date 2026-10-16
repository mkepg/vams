/**
 * BLACK-BOX TEST SUITE — BB-SHELL
 * The editor shell: dialogs, menus, the top bar and the editor column.
 */
import { describe, it, expect, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useState } from 'react';
import { Dialog, MenuButton, type MenuEntry } from '@/shared/ui/controls';
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog';
import { confirm, useConfirmStore } from '@/shared/ui/confirm-dialog/confirm-store';
import { STORAGE_KEY, useVamsStore } from '@/core/store';
import { isSceneEmpty } from '@/entities/project/model/scene-empty';
import HistoryControls from '@/features/history-controls/ui/HistoryControls';
import NewWorkspaceButton from '@/features/workspace-reset/ui/NewWorkspaceButton';
import EditorPreferencesMenu from '@/features/editor-preferences/ui/EditorPreferencesMenu';
import LearnButton from '@/features/lesson-engine/ui/LearnButton';
import FileMenu from '@/widgets/layout/top-bar/FileMenu';
import { EditorPanel, ObjectInspector, SettingsPanel } from '@/widgets/layout/editor-column';
import { runController } from '@/features/callbacks';
import { registerFakeRenderer } from '../helpers/fake-renderer';
import { DEFAULT_OPEN_GROUPS } from '@/core/inspector';
import Rail from '@/widgets/layout/rail';
import CodeMathColumn from '@/widgets/layout/code-math-column';
import { useMyScenesDialog } from '@/features/scene-library';
import { CanvasOverlays } from '@/widgets/canvas/ui/CanvasOverlays';
import { addPrimitive, addTriangle } from '../helpers/store';

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

/** A matchMedia stand-in whose answer can change, notifying the editor like a real resize. */
function mediaQuery(initial: boolean) {
  const real = window.matchMedia;
  let matches = initial;
  const listeners = new Set<() => void>();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() { return matches; },
    media: query,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
  }));
  return {
    set(next: boolean) {
      matches = next;
      listeners.forEach((listener) => listener());
    },
    restore() {
      window.matchMedia = real;
    },
  };
}

async function shell(parts: { panel?: VNode; canvas?: VNode } = {}) {
  const { default: EditorShell } = await import('@/pages/editor/ui/EditorShell');
  return mount(h(EditorShell, {
    topBar: h('header', {}, 'top'),
    rail: h(Rail, {}),
    panel: parts.panel ?? h('div', {}, h('button', { id: 'inside' }, 'inside')),
    canvas: parts.canvas ?? h('div', {}, 'canvas'),
    codeMath: h('div', {}, 'code'),
  }));
}
/** Starts a real Run on a fake renderer; returns the cleanup. */
function startRun() {
  addTriangle();
  useVamsStore.getState().setCallbackHandler('keyboard', 'onKey');
  const unregister = registerFakeRenderer(new Map(), { getCanvasSize: () => ({ width: 800, height: 600 }) });
  expect(runController.start({ loop: false })).toBe(true);
  return () => {
    runController.stop();
    unregister();
  };
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
      'New workspace', 'My scenes…', 'Open project file…', 'Save project file', 'Export C++ code',
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
    expect(menuItems(host)).toEqual(['Save project file', 'Export C++ code']);
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
    await openMenu(host, 'Settings');
    const grid = [...host.querySelectorAll('[role="menuitemcheckbox"]')].find((el) => el.textContent?.includes('Gridlines'))!;
    const before = useVamsStore.getState().axisVisibility.showGridlines;
    expect(grid.getAttribute('aria-checked')).toBe(String(before));
    (grid as HTMLElement).click();
    await settle();
    expect(useVamsStore.getState().axisVisibility.showGridlines).toBe(!before);
    await openMenu(host, 'Settings');
    chooseItem(host, 'Keyboard shortcuts');
    await settle();
    expect(useVamsStore.getState().activeHelpTopicId).toBe('shortcuts');
    useVamsStore.getState().closeHelp();
    unmount(host);
  });
});

describe('BB-SHELL-13: The Learn button opens the course drawer in both modes', () => {
  it('is a dialog trigger named Learn that sets learnOpen', async () => {
    for (const appMode of ['Author', 'Lesson'] as const) {
      useVamsStore.setState({ appMode, learnOpen: false });
      const host = mount(h(LearnButton, {}));
      const button = host.querySelector('button.learn-trigger') as HTMLButtonElement;
      expect(button.textContent).toContain('Learn');
      expect(button.getAttribute('aria-haspopup')).toBe('dialog');
      button.click();
      await settle();
      expect(useVamsStore.getState().learnOpen).toBe(true);
      unmount(host);
    }
    useVamsStore.setState({ appMode: 'Author', learnOpen: false });
  });
});

describe('BB-SHELL-14: The rail panels are the same in every section', () => {
  it('shows each panel’s controls whatever the section, with no section menu', async () => {
    const tri = addTriangle();
    useVamsStore.setState({ appMode: 'Author', selectedObjectId: tri.id });
    const panels: [string, string[]][] = [
      ['add', ['[data-panel-id="primitive-palette"]', '[data-panel-id="text-node-panel"]']],
      ['scene', ['[data-panel-id="scene-hierarchy"]', '.inspector']],
      ['settings', ['[data-group="background"]']],
      ['callbacks', ['[data-panel-id="callbacks-panel"]']],
    ];
    for (const section of ['Pipeline', 'Primitives', 'Buffers', 'Transforms', 'Textures'] as const) {
      useVamsStore.setState({ activeSection: section });
      for (const [panel, selectors] of panels) {
        useVamsStore.getState().setRailPanel(panel as 'add');
        const host = mount(h(EditorPanel, {}));
        await settle();
        expect(host.querySelector('.section-menu')).toBeNull();
        for (const selector of selectors) expect(host.querySelector(selector)).not.toBeNull();
        unmount(host);
      }
    }
    useVamsStore.setState({ objects: [], selectedObjectId: null });
  });
});

describe('BB-SHELL-15: The inspector shows the object in pipeline order; the scene settings have their own panel', () => {
  const groupTitles = (host: HTMLElement) => [...host.querySelectorAll('.inspector-group__title')].map((t) => t.textContent);

  it('orders object groups, shows an empty state without a selection, and keeps settings in Settings', async () => {
    const tri = addTriangle();
    useVamsStore.setState({ appMode: 'Author', selectedObjectId: tri.id });
    const host = mount(h(ObjectInspector, {}));
    await settle();
    expect(groupTitles(host)).toEqual(['Vertices', 'Buffers', 'Transform', 'Appearance', 'Texture']);
    expect(host.querySelector('[data-group="transform"] .inspector-group__header')!.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('[data-group="vertices"] .inspector-group__header')!.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('[data-group="transform"] .inspector-group__hint')!.textContent).toContain('glTranslatef');
    useVamsStore.setState({ selectedObjectId: null });
    await settle();
    expect(groupTitles(host)).toEqual([]);
    expect(host.querySelector('.inspector__empty')).not.toBeNull();
    unmount(host);
    const settings = mount(h(SettingsPanel, {}));
    await settle();
    expect(groupTitles(settings)).toEqual(['Background', 'Viewing volume', 'Texture library']);
    unmount(settings);
    useVamsStore.setState({ objects: [] });
  });

  it('leaves out Line style for a triangle and the Texture group for a line', async () => {
    const line = addPrimitive('LINES', [{ x: -0.5, y: 0 }, { x: 0.5, y: 0 }]);
    useVamsStore.setState({ appMode: 'Author', selectedObjectId: line.id });
    const host = mount(h(ObjectInspector, {}));
    await settle();
    expect(host.querySelector('[data-group="texture"]')).toBeNull();
    useVamsStore.getState().toggleGroup('appearance');
    await settle();
    expect(host.querySelector('[data-panel-id="line-style-panel"]')).not.toBeNull();
    const tri = addTriangle();
    useVamsStore.setState({ selectedObjectId: tri.id });
    await settle();
    expect(host.querySelector('[data-panel-id="line-style-panel"]')).toBeNull();
    expect(host.querySelector('[data-group="texture"]')).not.toBeNull();
    unmount(host);
    useVamsStore.setState({ objects: [], selectedObjectId: null, openGroups: [...DEFAULT_OPEN_GROUPS] });
  });

  it('shows only Transform for a group, with its child count', async () => {
    const tri = addTriangle();
    const line = addPrimitive('LINES', [{ x: -0.5, y: 0 }, { x: 0.5, y: 0 }]);
    useVamsStore.setState({ appMode: 'Author' });
    useVamsStore.getState().createGroup([tri.id, line.id]);
    const group = useVamsStore.getState().objects.find((o) => o.type === 'GROUP')!;
    expect(useVamsStore.getState().selectedObjectId).toBe(group.id);
    const host = mount(h(ObjectInspector, {}));
    await settle();
    expect(groupTitles(host)).toEqual(['Transform']);
    expect(host.querySelector('.inspector__meta')!.textContent).toBe('Group · 2 objects');
    unmount(host);
    useVamsStore.setState({ objects: [], selectedObjectId: null });
  });
});

describe('BB-SHELL-16: Canvas overlays keep the empty card and its actions', () => {
  it('shows the empty card with its two actions, and drops it while placing vertices', async () => {
    const host = mount(h(CanvasOverlays, { showEmptyHint: true }));
    const buttons = [...host.querySelectorAll('.empty-canvas-hint button')].map((b) => b.textContent?.trim());
    expect(buttons).toEqual(['Add a shape', 'Start a lesson']);
    ([...host.querySelectorAll('.empty-canvas-hint button')][1] as HTMLButtonElement).click();
    expect(useVamsStore.getState().learnOpen).toBe(true);
    useVamsStore.setState({ learnOpen: false, interactionMode: 'VERTEX_PLACE' });
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
    expect(host.querySelector('.empty-canvas-hint')).toBeNull();
    useVamsStore.setState({ interactionMode: 'SELECT' });
    unmount(host);
  });
});

describe('BB-SHELL-17: The canvas plate tokens exist in both themes', () => {
  it('declares the plate tokens identically for light and dark', async () => {
    const { readFileSync } = await import('node:fs');
    const scss = readFileSync('src/shared/styles/_tokens.scss', 'utf8');
    for (const token of ['--canvas-plate', '--canvas-plate-line', '--canvas-x', '--canvas-y']) {
      expect(scss.split(`${token}:`).length - 1).toBe(2);
    }
  });
});

describe('BB-SHELL-18: Enter on the focused Cancel button cancels the confirm dialog', () => {
  it('resolves false and never confirms', async () => {
    const host = mount(h(ConfirmDialog, {}));
    const result = confirm({ title: 'Delete this scene?', confirmLabel: 'Delete', tone: 'danger' });
    await settle();
    expect(document.activeElement?.textContent).toBe('Delete');
    // Tab from Confirm, the last control, wraps to Cancel.
    key(document.activeElement!, 'Tab');
    const cancel = document.activeElement as HTMLButtonElement;
    expect(cancel.textContent).toBe('Cancel');
    const enter = key(cancel, 'Enter');
    // The browser turns Enter on a focused button into a click unless the keydown was cancelled.
    if (!enter.defaultPrevented) cancel.click();
    await expect(result).resolves.toBe(false);
    expect(useConfirmStore.getState().open).toBe(false);
    unmount(host);
  });
});

describe('BB-SHELL-19: Space activates a menu item once, on keyup', () => {
  it('runs the item once and leaves the menu closed after the key is released', async () => {
    const log: string[] = [];
    const host = mount(h(MenuButton, { label: 'Fruit', entries: entries(log) }, 'Fruit'));
    const trigger = host.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;
    trigger.click();
    await settle();
    const item = document.activeElement as HTMLElement;
    expect(item.textContent).toContain('Apples');
    const down = key(item, ' ');
    expect(down.defaultPrevented).toBe(true);
    await settle();
    expect(log).toEqual([]);
    item.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }));
    await settle();
    expect(log).toEqual(['a']);
    expect(host.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    // A stray keyup after activation (Firefox fires it on the refocused trigger) changes nothing.
    trigger.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }));
    await settle();
    expect(log).toEqual(['a']);
    expect(host.querySelector('[role="menu"]')).toBeNull();
    unmount(host);
  });
});

import { readCssColor } from '@/shared/lib/theme';

describe('BB-SHELL-20: Canvas colours are read from the theme tokens', () => {
  it('parses a #rrggbb custom property and falls back otherwise', () => {
    const root = document.documentElement;
    root.style.setProperty('--accent', '#4762f5');
    expect(readCssColor('--accent', 0)).toBe(0x4762f5);
    root.style.setProperty('--accent', 'rgb(1, 2, 3)');
    expect(readCssColor('--accent', 0x123456)).toBe(0x123456);
    root.style.removeProperty('--accent');
    expect(readCssColor('--missing', 0xabcdef)).toBe(0xabcdef);
  });
});

describe('BB-SHELL-21: The canvas selection outline uses the accent, not a fixed blue', () => {
  it('has no hard-coded selection colour left in the engine', async () => {
    const { readFileSync } = await import('node:fs');
    for (const file of ['src/shared/engine/selection-overlay.ts', 'src/shared/engine/pixi/primitives/rendering/drawableFactory.ts']) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toContain('0x0099ff');
      expect(source, file).toContain("readCssColor('--accent'");
    }
  });
});

import { execSync } from 'node:child_process';
import { readFileSync as readSource } from 'node:fs';

const EDITOR_SCSS = execSync('git ls-files "src/**/*.scss"', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((f) => !/^src\/(pages\/home|pages\/not-found|widgets\/site-header|widgets\/site-footer|app\/|shared\/styles|shared\/ui\/logo|features\/stage-mode)/.test(f));

describe('BB-SHELL-22: Editor text sizes come from the type scale', () => {
  it('uses only --text-* tokens or inherit for font-size', () => {
    expect(EDITOR_SCSS.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of EDITOR_SCSS) {
      for (const m of readSource(file, 'utf8').matchAll(/font-size:\s*([^;]+);/g)) {
        if (!/^(var\(--text-(xs|sm|base|md|lg|xl|2xl|table)\)|inherit)(\s*!important)?$/.test(m[1].trim())) offenders.push(`${file}: ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('BB-SHELL-23: Editor labels are sentence case', () => {
  it('has no uppercase text-transform in editor styles', () => {
    expect(EDITOR_SCSS.length).toBeGreaterThan(0);
    const offenders = EDITOR_SCSS.filter((file) => /text-transform:\s*uppercase/.test(readSource(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

describe('BB-SHELL-24: Selected items share one selection style', () => {
  it('marks each selected-state rule with the selected-mark mixin', () => {
    expect(EDITOR_SCSS.length).toBeGreaterThan(0);
    // Only the selected item's own rule; descendant rules such as `&.active .icon` style its parts.
    const SELECTED = /&\.(active|selected)\s*\{|&\[aria-checked='true'\]\s*\{|tr\.is-active td/;
    const offenders: string[] = [];
    for (const file of EDITOR_SCSS) {
      const lines = readSource(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!SELECTED.test(line) || line.includes('&__')) return;
        const block = lines.slice(i, i + 12).join('\n');
        if (!block.includes('@include selected-mark')) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

describe('BB-SHELL-25: Add a shape opens the Add panel', () => {
  async function addAShape(narrow: boolean) {
    const media = mediaQuery(narrow);
    useVamsStore.setState({ railPanel: 'settings', railHidden: false });
    const host = await shell({
      panel: h(EditorPanel, {}),
      canvas: h(CanvasOverlays, {
        viewportLimits: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
        interactionMode: 'SELECT',
        coordinates: { x: 0, y: 0 },
        showCoordinateTracker: false,
        showEmptyHint: true,
      }),
    });
    try {
      await settle();
      expect(useVamsStore.getState().railHidden).toBe(narrow);
      const add = [...host.querySelectorAll('.empty-canvas-hint button')].find((b) => b.textContent?.trim() === 'Add a shape') as HTMLButtonElement;
      add.click();
      await settle();
      expect(useVamsStore.getState().railPanel).toBe('add');
      expect(useVamsStore.getState().railHidden).toBe(false);
      expect(host.querySelector('.editor')!.classList.contains('is-panel-hidden')).toBe(false);
      expect(host.querySelector('.add-panel')).not.toBeNull();
    } finally {
      unmount(host);
      media.restore();
    }
  }

  it('opens the closed drawer on a narrow screen', async () => {
    await addAShape(true);
  });

  it('switches the panel in the wide layout', async () => {
    await addAShape(false);
  });
});

describe('BB-SHELL-26: The rail and the code column keep their state in the store', () => {
  it('unhides on a panel change and clears the code dot only when Code shows', () => {
    const s = () => useVamsStore.getState();
    useVamsStore.setState({ railPanel: 'add', railHidden: false, codePane: 'code', codeHidden: false, codeChangedUnseen: false });
    s().setRailHidden(true);
    s().setRailPanel('settings');
    expect(s().railPanel).toBe('settings');
    expect(s().railHidden).toBe(false);
    s().markCodeChanged();
    expect(s().codeChangedUnseen).toBe(false);
    s().setCodePane('math');
    s().markCodeChanged();
    expect(s().codeChangedUnseen).toBe(true);
    s().setCodePane('code');
    expect(s().codeChangedUnseen).toBe(false);
    s().setCodeHidden(true);
    expect(s().codeHidden).toBe(true);
    s().setCodeHidden(false);
  });
});

describe('BB-SHELL-27: The editor opens on Add for an empty scene and on Scene otherwise', () => {
  it('picks the opening panel from the scene', () => {
    const s = () => useVamsStore.getState();
    useVamsStore.setState({ railPanel: 'settings', railHidden: true });
    s().pickOpeningPanel();
    expect(s().railPanel).toBe('add');
    expect(s().railHidden).toBe(false);
    addTriangle();
    useVamsStore.setState({ railPanel: 'add' });
    s().pickOpeningPanel();
    expect(s().railPanel).toBe('scene');
  });

  it('picks it when the saved scene loads', async () => {
    const tri = addTriangle();
    useVamsStore.setState({ objects: [], selectedObjectId: null, railPanel: 'add' });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { objects: [tri] }, version: 9 }));
    await useVamsStore.persist.rehydrate();
    expect(useVamsStore.getState().objects).toHaveLength(1);
    expect(useVamsStore.getState().railPanel).toBe('scene');
  });
});

describe('BB-SHELL-28: Every way an object becomes selected switches the rail to Scene and opens it', () => {
  const away = () => useVamsStore.setState({ railPanel: 'settings', railHidden: true });
  const expectScene = () => {
    expect(useVamsStore.getState().railPanel).toBe('scene');
    expect(useVamsStore.getState().railHidden).toBe(false);
  };

  it('follows selection, creation, duplication, text, grouping and undo', async () => {
    const s = () => useVamsStore.getState();
    away();
    const tri = addTriangle();
    expectScene();
    s().selectObject(null);
    away();
    s().selectObject(tri.id);
    expectScene();
    away();
    s().duplicateObject(tri.id);
    expectScene();
    away();
    s().addTextObject('Hi', 0, 0);
    expectScene();
    const shapes = s().objects.filter((o) => o.type !== 'TEXT').map((o) => o.id);
    away();
    s().createGroup(shapes);
    expectScene();
    // History snapshots closer than 50 ms apart are merged, so let the earlier ones age out first.
    await new Promise((resolve) => setTimeout(resolve, 60));
    s().pushToHistory();
    s().selectObject(null);
    away();
    s().undo();
    expect(s().selectedObjectId).not.toBeNull();
    expectScene();
  });

  it('leaves the rail alone when the selection is cleared', () => {
    addTriangle();
    useVamsStore.setState({ railPanel: 'settings', railHidden: false });
    useVamsStore.getState().selectObject(null);
    expect(useVamsStore.getState().railPanel).toBe('settings');
  });
});

describe('BB-SHELL-29: A lesson step switches the rail to its panel and opens it', () => {
  it('maps each focus to its panel and leaves the rail for the lesson bar’s own controls', () => {
    const s = () => useVamsStore.getState();
    const cases: [string, string][] = [
      ['ortho-editor', 'settings'],
      ['texture-library', 'settings'],
      ['callbacks-panel', 'callbacks'],
      ['primitive-palette', 'add'],
      ['text-node-panel', 'add'],
      ['scene-hierarchy', 'scene'],
      ['object-transform', 'scene'],
      ['appearance-panel', 'settings'],
    ];
    for (const [panelId, panel] of cases) {
      useVamsStore.setState({ railPanel: panel === 'add' ? 'scene' : 'add', railHidden: true });
      s().setLessonFocusPanel(panelId);
      expect(s().railPanel).toBe(panel);
      expect(s().railHidden).toBe(false);
    }
    useVamsStore.setState({ railPanel: 'scene', railHidden: true });
    s().setLessonFocusPanel('pipeline-mode-controls');
    expect(s().railPanel).toBe('scene');
    expect(s().railHidden).toBe(true);
    s().setLessonFocusPanel(null);
    expect(s().railPanel).toBe('scene');
    useVamsStore.setState({ railHidden: false });
  });
});

describe('BB-SHELL-30: The rail and the code column are never saved', () => {
  it('keeps them out of the saved editor data, which stays at version 10', () => {
    const s = () => useVamsStore.getState();
    s().setRailPanel('callbacks');
    s().setCodePane('math');
    s().setCodeHidden(true);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(saved.version).toBe(11);
    for (const key of ['railPanel', 'railHidden', 'codePane', 'codeHidden', 'codeChangedUnseen']) {
      expect(saved.state).not.toHaveProperty(key);
    }
    useVamsStore.setState({ codePane: 'code', codeHidden: false });
  });
});

describe('BB-SHELL-31: The canvas follows its box when the layout around it changes', () => {
  it('reports every size change of the observed element and stops on cleanup', async () => {
    const { observeResize } = await import('@/shared/engine/observe-resize');
    const RealObserver = globalThis.ResizeObserver;
    let callback: ResizeObserverCallback = () => {};
    const disconnect = vi.fn();
    globalThis.ResizeObserver = class {
      constructor(cb: ResizeObserverCallback) { callback = cb; }
      observe() {}
      unobserve() {}
      disconnect() { disconnect(); }
    } as unknown as typeof ResizeObserver;
    try {
      const onResize = vi.fn();
      const stop = observeResize(document.createElement('div'), onResize);
      callback([], {} as ResizeObserver);
      callback([], {} as ResizeObserver);
      expect(onResize).toHaveBeenCalledTimes(2);
      stop();
      expect(disconnect).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.ResizeObserver = RealObserver;
    }
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('src/widgets/canvas/VamsCanvas.tsx', 'utf8')).toContain('observeResize(');
  });
});

describe('BB-SHELL-32: The rail lists Add, Scene, Settings and Callbacks as vertical tabs', () => {
  it('names each tab, sets Callbacks apart and marks the open panel', async () => {
    const media = mediaQuery(false);
    try {
      useVamsStore.setState({ railPanel: 'scene', railHidden: false });
      const host = mount(h(Rail, {}));
      await settle();
      const list = host.querySelector('[role="tablist"]')!;
      expect(list.getAttribute('aria-orientation')).toBe('vertical');
      expect(list.getAttribute('aria-label')).toBe('Editor panels');
      const tabs = [...list.querySelectorAll('[role="tab"]')];
      expect(tabs.map((t) => t.querySelector('.rail__label')!.textContent)).toEqual(['Add', 'Scene', 'Settings', 'Callbacks']);
      expect(tabs.map((t) => t.id)).toEqual(['rail-tab-add', 'rail-tab-scene', 'rail-tab-settings', 'rail-tab-callbacks']);
      for (const tab of tabs) expect(tab.getAttribute('aria-controls')).toBe('editor-panel');
      const divider = list.querySelector('.rail__divider')!;
      expect(divider.previousElementSibling).toBe(tabs[2]);
      expect(divider.nextElementSibling).toBe(tabs[3]);
      expect(tabs.map((t) => t.getAttribute('aria-selected') === 'true')).toEqual([false, true, false, false]);
      expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '0', '-1', '-1']);
      expect(tabs[0].getAttribute('data-tour-anchor')).toBe('rail-add');
      (tabs[2] as HTMLButtonElement).click();
      await settle();
      expect(useVamsStore.getState().railPanel).toBe('settings');
      unmount(host);
    } finally {
      media.restore();
    }
  });
});

describe('BB-SHELL-33: Arrow keys move between rail tabs; Enter opens one', () => {
  it('moves focus with Up, Down, Home and End and wraps at the ends', async () => {
    const media = mediaQuery(false);
    try {
      useVamsStore.setState({ railPanel: 'add', railHidden: false });
      const host = mount(h(Rail, {}));
      await settle();
      const tab = (id: string) => host.querySelector(`#rail-tab-${id}`) as HTMLButtonElement;
      tab('add').focus();
      key(tab('add'), 'ArrowDown');
      expect(document.activeElement).toBe(tab('scene'));
      key(tab('scene'), 'End');
      expect(document.activeElement).toBe(tab('callbacks'));
      key(tab('callbacks'), 'ArrowDown');
      expect(document.activeElement).toBe(tab('add'));
      key(tab('add'), 'ArrowUp');
      expect(document.activeElement).toBe(tab('callbacks'));
      key(tab('callbacks'), 'Home');
      expect(document.activeElement).toBe(tab('add'));
      // Moving focus never switches the panel; activating does.
      expect(useVamsStore.getState().railPanel).toBe('add');
      unmount(host);
    } finally {
      media.restore();
    }
  });
});

describe('BB-SHELL-34: The Callbacks badge counts the callbacks that work', () => {
  it('hides at zero and counts only valid handlers', async () => {
    const media = mediaQuery(false);
    try {
      const host = mount(h(Rail, {}));
      await settle();
      expect(host.querySelector('.rail__badge')).toBeNull();
      const s = useVamsStore.getState();
      s.setCallbackHandler('keyboard', 'onKey');
      s.setCallbackHandler('idle', 'onIdle');
      s.setCallbackHandler('mouse', 'onKey');
      await settle();
      expect(host.querySelector('.rail__badge')!.textContent).toBe('2');
      expect(host.querySelector('#rail-tab-callbacks')!.textContent).toContain('2 on');
      unmount(host);
    } finally {
      media.restore();
    }
  });
});

describe('BB-SHELL-35: Hide folds the panel and any rail item brings it back', () => {
  it('toggles Hide and Show, leaves no tab selected while hidden, and ignores a click on the open item', async () => {
    const media = mediaQuery(false);
    try {
      useVamsStore.setState({ railPanel: 'scene', railHidden: false });
      const host = mount(h(Rail, {}));
      await settle();
      const hide = host.querySelector('.rail__hide') as HTMLButtonElement;
      expect(hide.textContent).toContain('Hide');
      expect(hide.getAttribute('aria-expanded')).toBe('true');
      (host.querySelector('#rail-tab-scene') as HTMLButtonElement).click();
      expect(useVamsStore.getState().railHidden).toBe(false);
      hide.click();
      await settle();
      expect(useVamsStore.getState().railHidden).toBe(true);
      expect(hide.textContent).toContain('Show');
      expect(host.querySelectorAll('[role="tab"][aria-selected="true"]')).toHaveLength(0);
      (host.querySelector('#rail-tab-add') as HTMLButtonElement).click();
      await settle();
      expect(useVamsStore.getState().railHidden).toBe(false);
      expect(useVamsStore.getState().railPanel).toBe('add');
      unmount(host);
    } finally {
      media.restore();
    }
  });
});

describe('BB-SHELL-36: The rail pill tokens exist in both themes', () => {
  it('declares --rail-pill-hover and --rail-pill-active for light and dark', async () => {
    const { readFileSync } = await import('node:fs');
    const scss = readFileSync('src/shared/styles/_tokens.scss', 'utf8');
    for (const token of ['--rail-pill-hover', '--rail-pill-active']) {
      expect(scss.split(`${token}:`).length - 1).toBe(2);
    }
  });
});

describe('BB-SHELL-37: The editor grid has a rail, a panel, the canvas and the code column', () => {
  it('lays out four regions, folds the panel and the code column, and makes the rail inert during Run', async () => {
    const media = mediaQuery(false);
    useVamsStore.setState({ railPanel: 'scene', railHidden: false, codeHidden: false });
    const host = await shell();
    try {
      await settle();
      const editor = host.querySelector('.editor')!;
      const panel = host.querySelector('#editor-panel')!;
      expect(panel.getAttribute('role')).toBe('tabpanel');
      expect(panel.getAttribute('aria-labelledby')).toBe('rail-tab-scene');
      expect(host.querySelector('.editor__rail .rail')).not.toBeNull();
      expect(host.querySelector('[data-tour-anchor="panel"]')).toBe(panel);
      expect(host.querySelector('.editor__stage')!.getAttribute('data-tour-anchor')).toBe('canvas');
      expect(host.querySelector('.editor__code')!.getAttribute('data-tour-anchor')).toBe('code-column');
      expect(host.querySelector('.editor__panels-toggle')).toBeNull();
      useVamsStore.getState().setRailHidden(true);
      await settle();
      expect(editor.classList.contains('is-panel-hidden')).toBe(true);
      useVamsStore.getState().setCodeHidden(true);
      await settle();
      expect(editor.classList.contains('is-code-hidden')).toBe(true);
      useVamsStore.setState({ railHidden: false, codeHidden: false });
      const stop = startRun();
      await settle();
      expect(host.querySelector('.editor__rail')!.hasAttribute('inert')).toBe(true);
      expect(panel.hasAttribute('inert')).toBe(true);
      stop();
      await settle();
      expect(host.querySelector('.editor__rail')!.hasAttribute('inert')).toBe(false);
    } finally {
      unmount(host);
      media.restore();
    }
  });
});

describe('BB-SHELL-38: On narrow screens the panel is a drawer beside the rail', () => {
  it('opens from the rail, closes from its own item and Esc, and closes when Run starts', async () => {
    const media = mediaQuery(true);
    useVamsStore.setState({ railPanel: 'scene', railHidden: false });
    const host = await shell();
    try {
      await settle();
      const state = () => useVamsStore.getState();
      expect(host.querySelector('.editor')!.classList.contains('editor--narrow')).toBe(true);
      expect(state().railHidden).toBe(true);
      const tab = (id: string) => host.querySelector(`#rail-tab-${id}`) as HTMLButtonElement;
      tab('scene').click();
      await settle();
      expect(state().railHidden).toBe(false);
      tab('scene').click();
      await settle();
      expect(state().railHidden).toBe(true);
      tab('settings').click();
      await settle();
      expect(state().railPanel).toBe('settings');
      expect(state().railHidden).toBe(false);
      const inside = host.querySelector('#inside') as HTMLElement;
      inside.focus();
      key(inside, 'Escape');
      await settle();
      expect(state().railHidden).toBe(true);
      expect(document.activeElement).toBe(tab('settings'));
      state().setRailPanel('scene');
      await settle();
      const stop = startRun();
      await settle();
      expect(state().railHidden).toBe(true);
      stop();
    } finally {
      unmount(host);
      media.restore();
    }
  });
});

describe('BB-SHELL-39: Crossing 1100 px closes the drawer or shows the panel, and never strands focus', () => {
  it('closes the panel into a drawer when the window narrows and shows it again when it widens', async () => {
    const media = mediaQuery(false);
    useVamsStore.setState({ railPanel: 'scene', railHidden: false });
    const host = await shell();
    try {
      await settle();
      const editor = host.querySelector('.editor')!;
      expect(editor.classList.contains('editor--narrow')).toBe(false);
      expect(useVamsStore.getState().railHidden).toBe(false);
      (host.querySelector('#inside') as HTMLElement).focus();
      media.set(true);
      await settle();
      expect(editor.classList.contains('editor--narrow')).toBe(true);
      expect(useVamsStore.getState().railHidden).toBe(true);
      expect(document.activeElement).toBe(host.querySelector('#rail-tab-scene'));
      (host.querySelector('#rail-tab-scene') as HTMLButtonElement).click();
      await settle();
      expect(useVamsStore.getState().railHidden).toBe(false);
      media.set(false);
      await settle();
      expect(editor.classList.contains('editor--narrow')).toBe(false);
      expect(useVamsStore.getState().railHidden).toBe(false);
    } finally {
      unmount(host);
      media.restore();
    }
  });
});

describe('BB-SHELL-40: The right column switches between Code and Math and marks code that changed out of sight', () => {
  it('starts on Code, shows Math, and shows the dot until Code is shown again', async () => {
    useVamsStore.setState({ codePane: 'code', codeHidden: false, codeChangedUnseen: false });
    const host = mount(h(CodeMathColumn, {}));
    await settle();
    const radios = () => [...host.querySelectorAll<HTMLButtonElement>('[data-tour-anchor="code-switch"] [role="radio"]')];
    expect(host.querySelector('[data-tour-anchor="code-switch"] [role="radiogroup"]')!.getAttribute('aria-label')).toBe('Code or math');
    expect(radios().map((r) => r.textContent)).toEqual(['Code', 'Math']);
    expect(host.querySelector('.code-viewer-container')).not.toBeNull();
    expect(host.querySelector('.math-panel-container')).toBeNull();
    radios()[1].click();
    await settle();
    expect(host.querySelector('.math-panel-container')).not.toBeNull();
    expect(host.querySelector('.code-viewer-container')).toBeNull();
    expect(host.querySelector('.code-math-switch__dot')).toBeNull();
    addTriangle();
    await settle();
    expect(host.querySelector('.code-math-switch__dot')!.textContent).toBe('Code changed');
    radios()[0].click();
    await settle();
    expect(host.querySelector('.code-math-switch__dot')).toBeNull();
    expect(useVamsStore.getState().codeChangedUnseen).toBe(false);
    unmount(host);
  });
});

describe('BB-SHELL-41: Hide tucks the code column to an edge tab that brings it back', () => {
  it('hides from Code or Math and shows again from the edge tab', async () => {
    useVamsStore.setState({ codePane: 'code', codeHidden: false });
    const host = mount(h(CodeMathColumn, {}));
    await settle();
    (host.querySelector('button[aria-label="Hide code and math"]') as HTMLButtonElement).click();
    await settle();
    expect(useVamsStore.getState().codeHidden).toBe(true);
    const edge = host.querySelector('.code-math-edge') as HTMLButtonElement;
    expect(edge.getAttribute('aria-label')).toBe('Show code and math');
    expect(edge.textContent).toContain('Code & math');
    expect(host.querySelector('.code-viewer-container')).toBeNull();
    edge.click();
    await settle();
    expect(useVamsStore.getState().codeHidden).toBe(false);
    expect(host.querySelector('.code-viewer-container')).not.toBeNull();
    useVamsStore.getState().setCodePane('math');
    await settle();
    expect(host.querySelector('button[aria-label="Hide code and math"]')).not.toBeNull();
    useVamsStore.getState().setCodePane('code');
    unmount(host);
  });
});

describe('BB-SHELL-42: Add a shape moves focus to the first primitive tile', () => {
  async function clickAddAShape(railHidden: boolean) {
    useVamsStore.setState({ railPanel: 'add', railHidden });
    const host = await shell({
      panel: h(EditorPanel, {}),
      canvas: h(CanvasOverlays, {
        viewportLimits: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
        interactionMode: 'SELECT',
        coordinates: { x: 0, y: 0 },
        showCoordinateTracker: false,
        showEmptyHint: true,
      }),
    });
    await settle();
    const add = [...host.querySelectorAll('.empty-canvas-hint button')].find((b) => b.textContent?.trim() === 'Add a shape') as HTMLButtonElement;
    add.focus();
    add.click();
    await new Promise((resolve) => setTimeout(resolve, 80));
    return host;
  }

  it('focuses the tile when Add is already showing', async () => {
    const media = mediaQuery(false);
    const host = await clickAddAShape(false);
    try {
      expect(document.activeElement).toBe(host.querySelector('.primitive-tile'));
      expect(document.activeElement?.classList.contains('primitive-tile')).toBe(true);
    } finally {
      unmount(host);
      media.restore();
    }
  });

  it('shows the hidden panel first and focuses the tile', async () => {
    const media = mediaQuery(false);
    const host = await clickAddAShape(true);
    try {
      expect(useVamsStore.getState().railHidden).toBe(false);
      expect(document.activeElement).toBe(host.querySelector('.primitive-tile'));
      expect(document.activeElement?.classList.contains('primitive-tile')).toBe(true);
    } finally {
      unmount(host);
      media.restore();
    }
  });
});

describe('BB-SHELL-43: The settings menu toggles Grid numbers', () => {
  it('lists the checkbox right after Gridlines and flips the setting', async () => {
    useVamsStore.getState().setAxisVisibility({ showGridNumbers: true });
    const host = mount(h(EditorPreferencesMenu, {}));
    await openMenu(host, 'Settings');
    const boxes = [...host.querySelectorAll('[role="menuitemcheckbox"]')];
    const at = boxes.findIndex((el) => el.textContent?.includes('Gridlines'));
    const item = boxes[at + 1] as HTMLElement;
    expect(item.textContent).toContain('Grid numbers');
    expect(item.getAttribute('aria-checked')).toBe('true');
    item.click();
    await settle();
    expect(useVamsStore.getState().axisVisibility.showGridNumbers).toBe(false);
    unmount(host);
    useVamsStore.getState().setAxisVisibility({ showGridNumbers: true });
  });
});
