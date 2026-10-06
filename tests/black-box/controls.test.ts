/**
 * BLACK-BOX TEST SUITE — BB-CTRL
 * The shared control set in src/shared/ui/controls.
 */
import { describe, it, expect, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import {
  Button, ColorField, DataTable, GlHint, NumberField, Panel, PanelLayoutContext, SegmentedControl, SliderField, Switch, TextField,
  glColorReadout, normalizeHex, parseNumberInput, resetRecentColorsForTests,
} from '@/shared/ui/controls';
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';

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
function pointer(target: EventTarget, type: string, clientX: number, init: PointerEventInit = {}) {
  const event = new PointerEvent(type, { bubbles: true, cancelable: true, clientX, button: 0, pointerId: 1, ...init });
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

describe('BB-CTRL-07: parseNumberInput accepts decimals and rejects junk', () => {
  it('parses dots, commas and the minus sign; rejects empty and text', () => {
    expect(parseNumberInput('0.5')).toBe(0.5);
    expect(parseNumberInput(' -1,25 ')).toBe(-1.25);
    expect(parseNumberInput('−0.3')).toBe(-0.3);
    expect(parseNumberInput('.5')).toBe(0.5);
    expect(parseNumberInput('')).toBeNull();
    expect(parseNumberInput('abc')).toBeNull();
    expect(parseNumberInput('1.2.3')).toBeNull();
  });
});

describe('BB-CTRL-08: Typing commits once on blur, clamped to the range', () => {
  it('calls onBeginChange, onChange and onCommit once each', async () => {
    const onChange = vi.fn();
    const onBeginChange = vi.fn();
    const onCommit = vi.fn();
    const host = mount(h(NumberField, { label: 'Translate X', tag: 'X', value: 0, min: -1, max: 1, onChange, onBeginChange, onCommit }));
    const input = host.querySelector('input')!;
    expect(input.getAttribute('role')).toBe('spinbutton');
    expect(input.getAttribute('aria-label')).toBe('Translate X');
    input.dispatchEvent(new FocusEvent('focus'));
    input.value = '5';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('blur'));
    await settle();
    expect(onBeginChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(1);
    expect(onCommit).toHaveBeenCalledTimes(1);
    unmount(host);
  });
});

describe('BB-CTRL-09: An invalid entry shows a message and never writes NaN', () => {
  it('shows "Enter a number" on Enter and reverts on blur', async () => {
    const onChange = vi.fn();
    const host = mount(h(NumberField, { label: 'Scale X', value: 1, onChange }));
    const input = host.querySelector('input')!;
    input.dispatchEvent(new FocusEvent('focus'));
    input.value = 'abc';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    key(input, 'Enter');
    await settle();
    expect(host.textContent).toContain('Enter a number');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    input.dispatchEvent(new FocusEvent('blur'));
    await settle();
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('1.00');
    unmount(host);
  });
});

describe('BB-CTRL-10: Arrow keys step, Shift steps big, Alt steps fine, Home/End jump', () => {
  it('applies the right step for each modifier', async () => {
    const onChange = vi.fn();
    const host = mount(h(NumberField, { label: 'Rotate', value: 10, step: 1, min: -360, max: 360, precision: 1, onChange }));
    const input = host.querySelector('input')!;
    key(input, 'ArrowUp');
    expect(onChange).toHaveBeenLastCalledWith(11);
    key(input, 'ArrowDown', { shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(0);
    key(input, 'ArrowUp', { altKey: true });
    expect(onChange).toHaveBeenLastCalledWith(10.1);
    key(input, 'PageUp');
    expect(onChange).toHaveBeenLastCalledWith(20);
    key(input, 'End');
    expect(onChange).toHaveBeenLastCalledWith(360);
    key(input, 'Home');
    expect(onChange).toHaveBeenLastCalledWith(-360);
    unmount(host);
  });
});

describe('BB-CTRL-11: Scrubbing the tag changes the value with one history step', () => {
  it('moves by step per 4 px, begins once and commits once', async () => {
    const onChange = vi.fn();
    const onBeginChange = vi.fn();
    const onCommit = vi.fn();
    const host = mount(h(NumberField, { label: 'Translate X', tag: 'X', value: 0, step: 0.01, onChange, onBeginChange, onCommit }));
    const tag = host.querySelector('.vnum__tag')!;
    pointer(tag, 'pointerdown', 100);
    pointer(tag, 'pointermove', 101);
    expect(onBeginChange).not.toHaveBeenCalled();
    pointer(tag, 'pointermove', 140);
    pointer(tag, 'pointermove', 160);
    pointer(tag, 'pointerup', 160);
    await settle();
    expect(onBeginChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(0.15);
    expect(onCommit).toHaveBeenCalledTimes(1);
    unmount(host);
  });

  it('a click without movement focuses the input for typing', async () => {
    const host = mount(h(NumberField, { label: 'Translate X', tag: 'X', value: 0, onChange: vi.fn() }));
    const tag = host.querySelector('.vnum__tag')!;
    pointer(tag, 'pointerdown', 50);
    pointer(tag, 'pointerup', 51);
    await settle();
    expect(document.activeElement).toBe(host.querySelector('input'));
    unmount(host);
  });
});

describe('BB-CTRL-12: Esc during a scrub restores the value and does not reach window listeners', () => {
  it('restores the start value and stops the keydown', async () => {
    const onChange = vi.fn();
    const windowListener = vi.fn();
    window.addEventListener('keydown', windowListener);
    const host = mount(h(NumberField, { label: 'Rotate', tag: 'θ', value: 15, step: 1, onChange }));
    const tag = host.querySelector('.vnum__tag')!;
    pointer(tag, 'pointerdown', 0);
    pointer(tag, 'pointermove', 40);
    await settle();
    expect(onChange).toHaveBeenLastCalledWith(25);
    key(document.body, 'Escape');
    await settle();
    expect(onChange).toHaveBeenLastCalledWith(15);
    expect(windowListener).not.toHaveBeenCalled();
    window.removeEventListener('keydown', windowListener);
    unmount(host);
  });
});

describe('BB-CTRL-13: Esc while typing cancels the edit without bubbling', () => {
  it('stops propagation so a surrounding dialog stays open', async () => {
    const parentKeydown = vi.fn();
    const host = mount(h('div', { onKeyDown: parentKeydown }, h(NumberField, { label: 'Scale X', value: 1, onChange: vi.fn() })));
    const input = host.querySelector('input')!;
    input.dispatchEvent(new FocusEvent('focus'));
    input.value = '3';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    key(input, 'Escape');
    await settle();
    expect(parentKeydown).not.toHaveBeenCalled();
    expect(input.value).toBe('1.00');
    unmount(host);
  });
});

describe('BB-CTRL-14: SliderField pairs a range with an exact number', () => {
  it('both inputs share the value and report changes', async () => {
    const onChange = vi.fn();
    const onBeginChange = vi.fn();
    const onCommit = vi.fn();
    const host = mount(h(SliderField, { label: 'Line width', value: 3, min: 0.5, max: 12, step: 0.5, precision: 1, unit: 'px', onChange, onBeginChange, onCommit }));
    const range = host.querySelector('input[type="range"]') as HTMLInputElement;
    const number = host.querySelector('input[role="spinbutton"]') as HTMLInputElement;
    expect(host.querySelector('label')!.textContent).toBe('Line width');
    expect(range.value).toBe('3');
    expect(number.value).toBe('3.0');
    range.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    range.value = '4.5';
    range.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onBeginChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(4.5);
    expect(onCommit).not.toHaveBeenCalled();
    await settle();
    range.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('0.5');
    expect(host.textContent).toContain('12');
    unmount(host);
  });
});

describe('BB-CTRL-15: Hex parsing and the GL readout', () => {
  it('normalizes hex and formats glColor3f, glColor3ub and glClearColor', () => {
    expect(normalizeHex('B91C1C')).toBe('#b91c1c');
    expect(normalizeHex('#abc')).toBe('#aabbcc');
    expect(normalizeHex('#12345')).toBeNull();
    expect(normalizeHex('red')).toBeNull();
    expect(glColorReadout('#b91c1c', 'glColor3f')).toBe('glColor3f(0.73, 0.11, 0.11)');
    expect(glColorReadout('#b91c1c', 'glColor3ub')).toBe('glColor3ub(185, 28, 28)');
    expect(glColorReadout('#000000', 'glClearColor')).toBe('glClearColor(0.00, 0.00, 0.00, 1.0)');
  });
});

describe('BB-CTRL-16: Typing a hex value commits once and updates the readout', () => {
  it('calls onBeginChange, onChange and onCommit once', async () => {
    resetRecentColorsForTests();
    const onChange = vi.fn();
    const onBeginChange = vi.fn();
    const onCommit = vi.fn();
    const host = mount(h(ColorField, { label: 'Fill', value: '#ffffff', glCall: 'glColor3f', onChange, onBeginChange, onCommit }));
    const hex = host.querySelector('input[type="text"]') as HTMLInputElement;
    expect(hex.getAttribute('aria-label')).toBe('Fill hex value');
    expect(host.querySelector('.vcolor__gl')!.textContent).toBe('glColor3f(1.00, 1.00, 1.00)');
    hex.dispatchEvent(new FocusEvent('focus'));
    hex.value = 'b91c1c';
    hex.dispatchEvent(new Event('input', { bubbles: true }));
    key(hex, 'Enter');
    await settle();
    expect(onBeginChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('#b91c1c');
    expect(onCommit).toHaveBeenCalledTimes(1);
    render(h(ColorField, { label: 'Fill', value: '#b91c1c', glCall: 'glColor3f', onChange, onBeginChange, onCommit }), host);
    await settle();
    expect(host.querySelector('.vcolor__gl')!.textContent).toBe('glColor3f(0.73, 0.11, 0.11)');
    unmount(host);
  });
});

describe('BB-CTRL-17: An invalid hex value shows a message and reverts', () => {
  it('never calls onChange', async () => {
    const onChange = vi.fn();
    const host = mount(h(ColorField, { label: 'Fill', value: '#ffffff', glCall: 'glColor3f', onChange }));
    const hex = host.querySelector('input[type="text"]') as HTMLInputElement;
    hex.dispatchEvent(new FocusEvent('focus'));
    hex.value = 'zz';
    hex.dispatchEvent(new Event('input', { bubbles: true }));
    key(hex, 'Enter');
    await settle();
    expect(host.textContent).toContain('Enter a hex color like #B91C1C');
    hex.dispatchEvent(new FocusEvent('blur'));
    await settle();
    expect(onChange).not.toHaveBeenCalled();
    expect(hex.value).toBe('FFFFFF');
    unmount(host);
  });
});

describe('BB-CTRL-18: Picking begins history once and fills the recent colours', () => {
  it('one onBeginChange per picking session; recent swatch applies its colour', async () => {
    resetRecentColorsForTests();
    const onChange = vi.fn();
    const onBeginChange = vi.fn();
    const onCommit = vi.fn();
    const host = mount(h(ColorField, { label: 'Fill', value: '#ffffff', glCall: 'glColor3f', onChange, onBeginChange, onCommit }));
    const picker = host.querySelector('input[type="color"]') as HTMLInputElement;
    picker.value = '#ff0000';
    picker.dispatchEvent(new Event('input', { bubbles: true }));
    picker.value = '#00ff00';
    picker.dispatchEvent(new Event('input', { bubbles: true }));
    picker.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(onBeginChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('#00ff00');
    expect(onCommit).toHaveBeenCalledTimes(1);
    const chip = host.querySelector('button[aria-label="Use #00FF00"]') as HTMLButtonElement;
    expect(chip).not.toBeNull();
    chip.click();
    expect(onChange).toHaveBeenLastCalledWith('#00ff00');
    unmount(host);
  });
});

describe('BB-CTRL-19: Panel header toggles its body and names its GL call', () => {
  it('starts at defaultOpen, toggles on click, shows the hint', async () => {
    const host = mount(h(Panel, { title: 'Line Style', hint: 'glLineStipple', panelId: 'line-style-panel', defaultOpen: true }, h('p', {}, 'body')));
    const header = host.querySelector('.vpanel__header') as HTMLButtonElement;
    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('.vpanel__hint')!.textContent).toBe('glLineStipple');
    expect(host.textContent).toContain('body');
    header.click();
    await settle();
    expect(header.getAttribute('aria-expanded')).toBe('false');
    expect(host.textContent).not.toContain('body');
    expect(host.querySelector('[data-panel-id="line-style-panel"]')).not.toBeNull();
    unmount(host);
  });
});

describe('BB-CTRL-20: In lesson mode only the focus panel opens', () => {
  it('collapses other panels even when defaultOpen, and outlines the focus', () => {
    const tree = h(
      PanelLayoutContext.Provider,
      { value: { mode: 'lesson', focusPanelId: 'object-transform' } },
      h(Panel, { title: 'Scene Hierarchy', panelId: 'scene-hierarchy', defaultOpen: true }, 'tree'),
      h(Panel, { title: 'Object Transform', panelId: 'object-transform' }, 'fields'),
    );
    const host = mount(tree);
    const sections = host.querySelectorAll('.vpanel');
    expect(sections[0].querySelector('.vpanel__header')!.getAttribute('aria-expanded')).toBe('false');
    expect(sections[1].querySelector('.vpanel__header')!.getAttribute('aria-expanded')).toBe('true');
    expect(sections[1].classList.contains('is-lesson-focus')).toBe(true);
    unmount(host);
  });
});

describe('BB-CTRL-21: CollapsibleSection keeps working as Panel', () => {
  it('renders the same structure through the old import', () => {
    const host = mount(h(CollapsibleSection, { title: 'Callbacks', icon: h('svg', {}), panelId: 'callbacks-panel' }, 'x'));
    expect(host.querySelector('.vpanel[data-panel-id="callbacks-panel"]')).not.toBeNull();
    expect(host.querySelector('.vpanel__title')!.textContent).toBe('Callbacks');
    unmount(host);
  });
});

describe('BB-CTRL-22: DataTable renders a captioned table with column headers', () => {
  it('renders rows via column renderers and marks the active row', () => {
    const rows = [{ x: -0.5, y: -0.4 }, { x: 0.5, y: -0.4 }];
    const host = mount(h(DataTable<{ x: number; y: number }>, {
      caption: 'Vertices',
      columns: [
        { key: 'i', header: '#', render: (_r, i) => String(i) },
        { key: 'x', header: 'X', numeric: true, render: (r) => r.x.toFixed(2) },
        { key: 'y', header: 'Y', numeric: true, render: (r) => r.y.toFixed(2) },
      ],
      rows,
      rowKey: (_r, i) => `v${i}`,
      activeRowKey: 'v1',
    }));
    expect(host.querySelector('caption')!.textContent).toBe('Vertices');
    const headers = [...host.querySelectorAll('th')].map((th) => th.textContent);
    expect(headers).toEqual(['#', 'X', 'Y']);
    expect(host.querySelectorAll('th[scope="col"]')).toHaveLength(3);
    const bodyRows = host.querySelectorAll('tbody tr');
    expect(bodyRows).toHaveLength(2);
    expect(bodyRows[1].classList.contains('is-active')).toBe(true);
    expect(bodyRows[1].textContent).toBe('10.50-0.40');
    unmount(host);
  });
});

describe('BB-CTRL-23: A number field that unmounts mid-scrub clears the page scrub state', () => {
  it('removes is-scrubbing from body on unmount', async () => {
    const host = mount(h(NumberField, { label: 'Translate X', tag: 'X', value: 0, onChange: vi.fn() }));
    const tag = host.querySelector('.vnum__tag')!;
    pointer(tag, 'pointerdown', 0);
    pointer(tag, 'pointermove', 40);
    await settle();
    expect(document.body.classList.contains('is-scrubbing')).toBe(true);
    unmount(host);
    await settle();
    expect(document.body.classList.contains('is-scrubbing')).toBe(false);
  });
});

describe('BB-CTRL-24: A scrub discards a typed draft that was not committed', () => {
  it('keeps the scrubbed value when the field later blurs', async () => {
    const onChange = vi.fn();
    const host = mount(h(NumberField, { label: 'Rotate', tag: 'θ', value: 0, step: 1, onChange }));
    const input = host.querySelector('input')!;
    input.dispatchEvent(new FocusEvent('focus'));
    input.value = '99';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const tag = host.querySelector('.vnum__tag')!;
    pointer(tag, 'pointerdown', 0);
    pointer(tag, 'pointermove', 40);
    pointer(tag, 'pointerup', 40);
    await settle();
    expect(onChange).toHaveBeenLastCalledWith(10);
    input.dispatchEvent(new FocusEvent('blur'));
    await settle();
    expect(onChange).toHaveBeenLastCalledWith(10);
    expect(onChange).not.toHaveBeenCalledWith(99);
    unmount(host);
  });
});
