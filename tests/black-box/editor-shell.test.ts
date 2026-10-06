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
