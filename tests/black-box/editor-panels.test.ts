/**
 * BLACK-BOX TEST SUITE — BB-PANEL
 * Editor panels rebuilt on the shared control set.
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { h, render, type VNode } from 'preact';
import { useVamsStore } from '@/core/store';
import ObjectTransformPanel from '@/features/object-transform/ui/ObjectTransformPanel';
import OrthoEditorPanel from '@/features/ortho-editor/ui/OrthoEditorPanel';
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
function pointer(target: EventTarget, type: string, clientX: number) {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX, button: 0, pointerId: 1 }));
}
function select(id: string) {
  useVamsStore.setState({ selectedObjectId: id });
}
function fieldNamed(host: HTMLElement, name: string) {
  return host.querySelector(`input[aria-label="${name}"]`) as HTMLInputElement | null;
}
function hints(host: HTMLElement) {
  return [...host.querySelectorAll('.gl-hint, .vpanel__hint, .vcolor__gl')].map((el) => el.textContent);
}
function typeInto(input: HTMLInputElement, text: string) {
  input.dispatchEvent(new FocusEvent('focus'));
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new FocusEvent('blur'));
}

describe('BB-PANEL-01: Object Transform names its rows and GL calls', () => {
  it('shows Translate, Rotate and Scale with their hints and named fields', () => {
    const tri = addTriangle();
    select(tri.id);
    const host = mount(h(ObjectTransformPanel, {}));
    expect(host.textContent).toContain('Translate');
    expect(hints(host)).toEqual(expect.arrayContaining([
      'glTranslatef(x, y, 0.0f)', 'glRotatef(angle, 0.0f, 0.0f, 1.0f)', 'glScalef(sx, sy, 1.0f)',
    ]));
    for (const name of ['Translate X', 'Translate Y', 'Rotate', 'Scale X', 'Scale Y']) {
      expect(fieldNamed(host, name)).not.toBeNull();
    }
    unmount(host);
  });
});

describe('BB-PANEL-02: Typing a translation updates the object with one undo step', () => {
  it('commits on blur and pushes history once', async () => {
    const tri = addTriangle();
    select(tri.id);
    useVamsStore.setState({ past: [], future: [] });
    const host = mount(h(ObjectTransformPanel, {}));
    typeInto(fieldNamed(host, 'Translate X')!, '0.5');
    await settle();
    const obj = useVamsStore.getState().objects.find((o) => o.id === tri.id)!;
    expect(obj.transform.translateX).toBe(0.5);
    expect(useVamsStore.getState().past).toHaveLength(1);
    unmount(host);
  });
});

describe('BB-PANEL-03: Scrubbing Rotate is one undo step', () => {
  it('drags the θ tag and records a single history entry', async () => {
    const tri = addTriangle();
    select(tri.id);
    useVamsStore.setState({ past: [], future: [] });
    const host = mount(h(ObjectTransformPanel, {}));
    const field = fieldNamed(host, 'Rotate')!.closest('.vnum')!;
    const tag = field.querySelector('.vnum__tag')!;
    pointer(tag, 'pointerdown', 0);
    pointer(tag, 'pointermove', 20);
    pointer(tag, 'pointermove', 60);
    pointer(tag, 'pointerup', 60);
    await settle();
    const obj = useVamsStore.getState().objects.find((o) => o.id === tri.id)!;
    expect(obj.transform.rotate).toBe(15);
    expect(useVamsStore.getState().past).toHaveLength(1);
    unmount(host);
  });
});

describe('BB-PANEL-04: Viewing Volume edits glOrtho bounds', () => {
  it('names the four bounds and updates the viewport', async () => {
    const host = mount(h(OrthoEditorPanel, {}));
    const header = host.querySelector('.vpanel__header') as HTMLButtonElement;
    if (header.getAttribute('aria-expanded') === 'false') header.click();
    await settle();
    expect(hints(host)).toEqual(expect.arrayContaining(['glOrtho', 'glOrtho(left, right, bottom, top, -1.0, 1.0)']));
    for (const name of ['Left', 'Right', 'Bottom', 'Top']) expect(fieldNamed(host, name)).not.toBeNull();
    typeInto(fieldNamed(host, 'Right')!, '2');
    await settle();
    expect(useVamsStore.getState().viewportLimits.maxX).toBe(2);
    unmount(host);
  });
});

describe('BB-PANEL-05: The old NumberInput is gone', () => {
  it('has no file left', () => {
    expect(existsSync('src/shared/ui/number-input/NumberInput.tsx')).toBe(false);
  });
});
