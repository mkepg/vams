/**
 * BLACK-BOX TEST SUITE — BB-CTRL
 * The shared control set in src/shared/ui/controls.
 */
import { describe, it, expect, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import { Button, GlHint, SegmentedControl, Switch, TextField } from '@/shared/ui/controls';

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

describe('BB-CTRL-01: Icon-only buttons carry their label as name and tooltip', () => {
  it('renders aria-label and title from label, and the variant class', () => {
    const host = mount(h(Button, { iconOnly: true, label: 'Undo', variant: 'quiet', icon: h('svg', {}) }));
    const button = host.querySelector('button')!;
    expect(button.getAttribute('aria-label')).toBe('Undo');
    expect(button.getAttribute('title')).toBe('Undo');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.className).toContain('vbtn--quiet');
    expect(button.className).toContain('vbtn--icon');
    unmount(host);
  });
});

describe('BB-CTRL-02: Text buttons keep their text and fire onClick', () => {
  it('renders children, calls onClick, and passes disabled through', () => {
    const onClick = vi.fn();
    const host = mount(h(Button, { variant: 'primary', onClick }, 'Add vertex'));
    const button = host.querySelector('button')!;
    expect(button.textContent).toBe('Add vertex');
    expect(button.hasAttribute('aria-label')).toBe(false);
    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    render(h(Button, { variant: 'primary', onClick, disabled: true }, 'Add vertex'), host);
    expect(host.querySelector('button')!.disabled).toBe(true);
    unmount(host);
  });
});

describe('BB-CTRL-03: GlHint names the call and hides from assistive technology', () => {
  it('renders the function name and arguments', () => {
    const host = mount(h(GlHint, { call: 'glTranslatef', args: 'x, y, 0.0f' }));
    const hint = host.querySelector('.gl-hint')!;
    expect(hint.getAttribute('aria-hidden')).toBe('true');
    expect(hint.querySelector('.gl-hint__fn')!.textContent).toBe('glTranslatef');
    expect(hint.textContent).toBe('glTranslatef(x, y, 0.0f)');
    unmount(host);
  });
});

describe('BB-CTRL-04: Switch exposes role and checked state', () => {
  it('toggles through onChange', () => {
    const onChange = vi.fn();
    const host = mount(h(Switch, { checked: false, onChange, label: 'Line stipple' }));
    const sw = host.querySelector('[role="switch"]') as HTMLButtonElement;
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(sw.textContent).toContain('Line stipple');
    sw.click();
    expect(onChange).toHaveBeenCalledWith(true);
    unmount(host);
  });
});

describe('BB-CTRL-05: SegmentedControl is a radiogroup with arrow keys and roving tabindex', () => {
  it('moves the selection with arrows, Home and End', () => {
    const onChange = vi.fn();
    const options = [
      { value: 'NEAREST', label: 'GL_NEAREST' },
      { value: 'LINEAR', label: 'GL_LINEAR' },
      { value: 'MIPMAP', label: 'GL_X' },
    ];
    const host = mount(h(SegmentedControl, { label: 'Filter', options, value: 'NEAREST', onChange }));
    const group = host.querySelector('[role="radiogroup"]')!;
    expect(group.getAttribute('aria-label')).toBe('Filter');
    const radios = host.querySelectorAll('[role="radio"]');
    expect(radios[0].getAttribute('aria-checked')).toBe('true');
    expect(radios[0].getAttribute('tabindex')).toBe('0');
    expect(radios[1].getAttribute('tabindex')).toBe('-1');
    key(radios[0], 'ArrowRight');
    expect(onChange).toHaveBeenLastCalledWith('LINEAR');
    key(radios[0], 'ArrowLeft');
    expect(onChange).toHaveBeenLastCalledWith('MIPMAP');
    key(radios[0], 'End');
    expect(onChange).toHaveBeenLastCalledWith('MIPMAP');
    key(radios[0], 'Home');
    expect(onChange).toHaveBeenLastCalledWith('NEAREST');
    unmount(host);
  });
});

describe('BB-CTRL-06: TextField commits on Enter and blur, reverts on Esc', () => {
  it('commits typed text once and restores on Escape', async () => {
    const onCommit = vi.fn();
    const host = mount(h(TextField, { label: 'Name', value: 'Roof', onCommit }));
    const input = host.querySelector('input')!;
    expect(host.querySelector('label')!.textContent).toBe('Name');
    input.focus();
    input.value = 'Gable';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    key(input, 'Enter');
    await settle();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('Gable');

    input.focus();
    input.value = 'Oops';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const esc = key(input, 'Escape');
    await settle();
    expect(esc.defaultPrevented).toBe(true);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(input.value).toBe('Roof');
    unmount(host);
  });
});
