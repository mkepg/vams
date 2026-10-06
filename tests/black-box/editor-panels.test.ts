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
import SceneHierarchyPanel from '@/features/scene-hierarchy/ui/SceneHierarchyPanel';
import CustomShapeBuilderPanel from '@/features/custom-shapes/ui/CustomShapeBuilderPanel';
import ObjectAppearancePanel from '@/features/object-appearance/ui/ObjectAppearancePanel';
import LineStylePanel from '@/features/line-style/ui/LineStylePanel';
import CallbacksPanel from '@/features/callbacks/ui/CallbacksPanel';
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

describe('BB-PANEL-06: Scene Hierarchy is a keyboard-navigable tree', () => {
  it('uses tree semantics, moves with arrows and selects with Enter', async () => {
    const a = addTriangle(-0.5, 0);
    const b = addTriangle(0.5, 0);
    select(a.id);
    const host = mount(h(SceneHierarchyPanel, {}));
    await settle();
    expect(host.querySelector('[role="tree"]')).not.toBeNull();
    const items = [...host.querySelectorAll('[role="treeitem"]')] as HTMLElement[];
    expect(items).toHaveLength(2);
    expect(items.map((el) => el.dataset.objectId).sort()).toEqual([a.id, b.id].sort());
    const selected = items.find((el) => el.getAttribute('aria-selected') === 'true')!;
    expect(selected.dataset.objectId).toBe(a.id);
    expect(selected.getAttribute('tabindex')).toBe('0');
    items[0].focus();
    key(items[0], 'ArrowDown');
    await settle();
    expect(document.activeElement).toBe(items[1]);
    key(items[1], 'Enter');
    await settle();
    expect(useVamsStore.getState().selectedObjectId).toBe(items[1].dataset.objectId);
    unmount(host);
  });
});

describe('BB-PANEL-07: The primitive palette names every primitive and starts placement', () => {
  it('lists the GL primitives and shows the vertex table hint while building', async () => {
    const host = mount(h(CustomShapeBuilderPanel, {}));
    const labels = [...host.querySelectorAll('button')].map((b) => b.textContent?.trim());
    for (const name of ['GL_POINTS', 'GL_LINES', 'GL_LINE_STRIP', 'GL_LINE_LOOP', 'GL_TRIANGLES', 'GL_TRIANGLE_STRIP', 'GL_TRIANGLE_FAN', 'GL_QUADS', 'GL_POLYGON']) {
      expect(labels).toContain(name);
    }
    ([...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'GL_TRIANGLES') as HTMLButtonElement).click();
    await settle();
    expect(useVamsStore.getState().pendingShapeType).toBe('TRIANGLES');
    expect(hints(host)).toContain('glVertex2f(x, y)');
    unmount(host);
  });
});

describe('BB-PANEL-08: Appearance shows the colour values GL receives', () => {
  it('background reads glClearColor and fill follows the emission mode', async () => {
    useVamsStore.setState({ activeSection: 'Primitives' });
    let host = mount(h(ObjectAppearancePanel, {}));
    expect(hints(host)).toContain('glClearColor(0.00, 0.00, 0.00, 1.0)');
    unmount(host);
    const tri = addTriangle();
    select(tri.id);
    host = mount(h(ObjectAppearancePanel, {}));
    await settle();
    const fill = host.querySelector('input[aria-label="Fill hex value"]');
    expect(fill).not.toBeNull();
    expect(hints(host).some((t) => t?.startsWith('glColor3f('))).toBe(true);
    const emission = host.querySelector('[role="radiogroup"][aria-label="Color emission"]')!;
    ([...emission.querySelectorAll('[role="radio"]')].find((r) => r.textContent === 'glColor3ub') as HTMLButtonElement).click();
    await settle();
    expect(hints(host).some((t) => t?.startsWith('glColor3ub('))).toBe(true);
    unmount(host);
  });
});

describe('BB-PANEL-09: Line Style pairs width with an exact number and names stipple calls', () => {
  it('shows the slider, the switch and the glLineStipple hints', async () => {
    const line = addPrimitive('LINES', [{ x: -0.5, y: 0 }, { x: 0.5, y: 0 }]);
    select(line.id);
    const host = mount(h(LineStylePanel, {}));
    await settle();
    expect(host.querySelector('input[type="range"]')).not.toBeNull();
    expect(fieldNamed(host, 'Line width, exact value')).not.toBeNull();
    expect(hints(host)).toEqual(expect.arrayContaining(['glLineStipple', 'glLineWidth(width)']));
    const sw = host.querySelector('[role="switch"]') as HTMLButtonElement;
    expect(sw.textContent).toContain('Line stipple');
    const before = sw.getAttribute('aria-checked');
    sw.click();
    await settle();
    expect((host.querySelector('[role="switch"]') as HTMLElement).getAttribute('aria-checked')).not.toBe(before);
    unmount(host);
  });
});

describe('BB-PANEL-10: Callbacks name their GLUT registration', () => {
  it('shows one glut*Func hint per handler kind', async () => {
    const host = mount(h(CallbacksPanel, {}));
    (host.querySelector('.vpanel__header') as HTMLButtonElement).click();
    await settle();
    expect(hints(host)).toEqual(expect.arrayContaining([
      'glutKeyboardFunc(handler)', 'glutMouseFunc(handler)', 'glutReshapeFunc(handler)', 'glutMotionFunc(handler)', 'glutIdleFunc(handler)',
    ]));
    unmount(host);
  });
});

describe('BB-PANEL-11: Every Primitives-section control has a name', () => {
  it('has no unnamed button or input', async () => {
    const tri = addTriangle();
    select(tri.id);
    for (const Component of [SceneHierarchyPanel, CustomShapeBuilderPanel, ObjectAppearancePanel, CallbacksPanel]) {
      const host = mount(h(Component, {}));
      await settle();
      const unnamed = [...host.querySelectorAll('button, input, textarea')].filter((el) => {
        const named = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.textContent?.trim()
          || (el.id && host.querySelector(`label[for="${el.id}"]`));
        return !named && el.getAttribute('aria-hidden') !== 'true' && !(el as HTMLInputElement).hidden;
      });
      expect(unnamed.map((el) => el.outerHTML.slice(0, 80))).toEqual([]);
      unmount(host);
    }
  });
});

describe('BB-PANEL-12: Scene Hierarchy keeps keyboard focus after rename and delete', () => {
  it('returns focus to the renamed row and moves it to a neighbour when the focused row is deleted', async () => {
    const a = addTriangle(-0.5, 0);
    const b = addTriangle(0.5, 0);
    addTriangle(0, 0.5);
    select(a.id);
    const host = mount(h(SceneHierarchyPanel, {}));
    await settle();
    const rowOf = (id: string) => host.querySelector(`[role="treeitem"][data-object-id="${id}"]`) as HTMLElement;
    rowOf(b.id).focus();
    key(rowOf(b.id), 'F2');
    await settle();
    const input = host.querySelector('.rename-input') as HTMLInputElement;
    input.focus();
    input.value = 'Renamed';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    key(input, 'Enter');
    await settle();
    expect(host.querySelector('.rename-input')).toBeNull();
    expect(useVamsStore.getState().objects.find((o) => o.id === b.id)!.name).toBe('Renamed');
    expect(document.activeElement).toBe(rowOf(b.id));

    const order = [...host.querySelectorAll('[role="treeitem"]')].map((el) => (el as HTMLElement).dataset.objectId!);
    const focused = rowOf(b.id);
    const index = order.indexOf(b.id);
    useVamsStore.getState().deleteObject(b.id);
    await settle();
    expect(focused.isConnected).toBe(false);
    const rest = order.filter((id) => id !== b.id);
    expect((document.activeElement as HTMLElement).dataset.objectId).toBe(rest[Math.min(index, rest.length - 1)]);
    unmount(host);
  });
});

describe('BB-PANEL-13: Scene Hierarchy groups expand, collapse and rename from the keyboard', () => {
  it('collapses and expands with arrows, walks to the parent and renames only the focused row', async () => {
    const a = addTriangle(-0.5, 0);
    const b = addTriangle(0.5, 0);
    const c = addTriangle(0, 0.5);
    useVamsStore.getState().createGroup([a.id, b.id]);
    select(c.id);
    const host = mount(h(SceneHierarchyPanel, {}));
    await settle();
    const items = () => [...host.querySelectorAll('[role="treeitem"]')] as HTMLElement[];
    const group = items().find((el) => el.hasAttribute('aria-expanded'))!;
    expect(items()).toHaveLength(4);

    group.focus();
    key(group, 'ArrowLeft');
    await settle();
    expect(group.getAttribute('aria-expanded')).toBe('false');
    expect(items()).toHaveLength(2);

    key(group, 'ArrowRight');
    await settle();
    expect(group.getAttribute('aria-expanded')).toBe('true');
    const children = items().filter((el) => el.getAttribute('aria-level') === '2');
    expect(children.map((el) => el.dataset.objectId).sort()).toEqual([a.id, b.id].sort());

    key(group, 'ArrowRight');
    await settle();
    expect(document.activeElement).toBe(children[0]);
    key(children[0], 'ArrowLeft');
    await settle();
    expect(document.activeElement).toBe(group);

    let windowF2 = 0;
    const spy = (event: KeyboardEvent) => {
      if (event.key === 'F2') windowF2++;
    };
    window.addEventListener('keydown', spy);
    key(group, 'F2');
    await settle();
    window.removeEventListener('keydown', spy);
    expect(windowF2).toBe(0);
    const inputs = host.querySelectorAll('.rename-input');
    expect(inputs).toHaveLength(1);
    expect(inputs[0].closest('[role="treeitem"]')).toBe(group);
    unmount(host);
  });
});
