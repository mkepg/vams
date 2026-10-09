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
import VerticesPanel from '@/features/vertex-editor/ui/VerticesPanel';
import CustomShapeBuilderPanel from '@/features/custom-shapes/ui/CustomShapeBuilderPanel';
import ObjectAppearancePanel from '@/features/object-appearance/ui/ObjectAppearancePanel';
import LineStylePanel from '@/features/line-style/ui/LineStylePanel';
import CallbacksPanel from '@/features/callbacks/ui/CallbacksPanel';
import PipelineModeControls from '@/features/pipeline-controls/ui/PipelineModeControls';
import BuffersPanel from '@/features/buffers/ui/BuffersPanel';
import TextureLibraryPanel from '@/features/textures/ui/TextureLibraryPanel';
import TextureAttachmentPanel from '@/features/textures/ui/TextureAttachmentPanel';
import UVEditorPanel from '@/features/textures/ui/UVEditorPanel';
import { getPreset } from '@/entities/project/model/scene-presets';
import { loadProjectData } from '@/features/scene-library';
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

describe('BB-PANEL-07: The Add row names every primitive and starts placement', () => {
  it('shows four primitives, keeps the rest in More, and shows the vertex table hint while building', async () => {
    const host = mount(h(CustomShapeBuilderPanel, {}));
    const row = [...host.querySelectorAll('.add-row__item')].map((b) => b.textContent?.trim());
    expect(row).toEqual(['GL_POINTS', 'GL_LINES', 'GL_TRIANGLES', 'GL_QUADS']);
    (host.querySelector('.add-row__more') as HTMLButtonElement).click();
    await settle();
    const more = [...host.querySelectorAll('[role^="menuitem"] .vmenu__label')].map((el) => el.textContent);
    expect(more).toEqual(['GL_LINE_STRIP', 'GL_LINE_LOOP', 'GL_TRIANGLE_STRIP', 'GL_TRIANGLE_FAN', 'GL_QUAD_STRIP', 'GL_POLYGON']);
    key(document.activeElement!, 'Escape');
    await settle();
    ([...host.querySelectorAll('.add-row__item')].find((b) => b.textContent?.trim() === 'GL_TRIANGLES') as HTMLButtonElement).click();
    await settle();
    expect(useVamsStore.getState().pendingShapeType).toBe('TRIANGLES');
    expect(hints(host)).toContain('glVertex2f(x, y)');
    useVamsStore.getState().cancelCustomShape();
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

function loadTexturedQuad() {
  loadProjectData(getPreset('textured-quad')!.data);
  const quad = useVamsStore.getState().objects[0];
  select(quad.id);
  return quad;
}

describe('BB-PANEL-14: Viewport mode is an arrow-key radiogroup', () => {
  it('moves the mode with ArrowDown', async () => {
    useVamsStore.setState({ activeSection: 'Pipeline', pipelineMode: 'Playground' });
    const host = mount(h(PipelineModeControls, {}));
    const group = host.querySelector('[role="radiogroup"][aria-label="Viewport mode"]')!;
    const radios = group.querySelectorAll('[role="radio"]');
    expect([...radios].map((r) => r.textContent?.trim())).toEqual(['Coordinate Playground', 'Pipeline Diagram', 'Raster vs. Vector']);
    key(radios[0], 'ArrowDown');
    await settle();
    expect(useVamsStore.getState().pipelineMode).toBe('Diagram');
    unmount(host);
  });
});

describe('BB-PANEL-15: Buffers names its GL calls and keeps keyboard radiogroups', () => {
  it('shows the header hint and moves the rendering mode with arrows', async () => {
    const tri = addTriangle();
    select(tri.id);
    useVamsStore.setState({ activeSection: 'Buffers' });
    const host = mount(h(BuffersPanel, {}));
    await settle();
    expect(hints(host)).toContain('glVertexPointer');
    const group = host.querySelector('[role="radiogroup"][aria-label="Rendering mode"]')!;
    const radios = [...group.querySelectorAll('[role="radio"]')] as HTMLElement[];
    const checkedBefore = radios.findIndex((r) => r.getAttribute('aria-checked') === 'true');
    expect(radios[checkedBefore].getAttribute('tabindex')).toBe('0');
    key(radios[checkedBefore], 'ArrowRight');
    await settle();
    const after = [...host.querySelectorAll('[role="radiogroup"][aria-label="Rendering mode"] [role="radio"]')];
    expect(after.findIndex((r) => r.getAttribute('aria-checked') === 'true')).toBe((checkedBefore + 1) % radios.length);
    unmount(host);
  });
});

describe('BB-PANEL-16: Apply Texture uses GL constant segmented controls', () => {
  it('shows filter and wrap with their glTexParameteri hints', async () => {
    loadTexturedQuad();
    useVamsStore.setState({ activeSection: 'Textures' });
    const host = mount(h(TextureAttachmentPanel, {}));
    await settle();
    expect(hints(host)).toEqual(expect.arrayContaining([
      'glBindTexture',
      'glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, filter)',
      'glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, wrap)',
    ]));
    const filter = host.querySelector('[role="radiogroup"][aria-label="Filter mode"]')!;
    expect([...filter.querySelectorAll('[role="radio"]')].map((r) => r.textContent)).toEqual(['GL_NEAREST', 'GL_LINEAR']);
    ([...filter.querySelectorAll('[role="radio"]')][1] as HTMLButtonElement).click();
    await settle();
    const linear = [...host.querySelectorAll('[role="radiogroup"][aria-label="Filter mode"] [role="radio"]')][1];
    expect(linear.getAttribute('aria-checked')).toBe('true');
    const wrap = host.querySelector('[role="radiogroup"][aria-label="Wrap mode"]')!;
    expect([...wrap.querySelectorAll('[role="radio"]')].map((r) => r.textContent)).toEqual(['GL_REPEAT', 'GL_CLAMP_TO_EDGE']);
    unmount(host);
  });
});

describe('BB-PANEL-17: Texture Library remove buttons name their texture', () => {
  it('labels each remove button with the texture name', async () => {
    useVamsStore.setState({ uploadedTextures: [{ id: 'tex-1', name: 'Bricks', isSample: false, dataUrl: 'data:image/png;base64,', width: 4, height: 4 }] });
    const host = mount(h(TextureLibraryPanel, {}));
    await settle();
    expect(host.querySelector('button[aria-label="Remove Bricks"]')).not.toBeNull();
    unmount(host);
  });
});

function pointerAt(target: EventTarget, type: string, clientX: number, clientY: number) {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX, clientY, button: 0, pointerId: 1 }));
}
const rotationOf = (id: string) => useVamsStore.getState().objects.find((o) => o.id === id)!.transform;

describe('BB-PANEL-18: Dragging the rotate dial is one undo step back to the start', () => {
  it('restores the pre-drag rotation with a single undo', async () => {
    const tri = addTriangle();
    select(tri.id);
    useVamsStore.setState({ past: [], future: [] });
    const host = mount(h(ObjectTransformPanel, {}));
    const dial = host.querySelector('[role="slider"][aria-label="Rotation"]')!;
    // happy-dom has no layout, so the dial's centre is (0, 0): (10, 0) is 0° and (0, 10) is 90°.
    pointerAt(dial, 'pointerdown', 10, 0);
    await settle();
    pointerAt(dial, 'pointermove', 7, 7);
    await settle();
    pointerAt(dial, 'pointermove', 0, 10);
    await settle();
    pointerAt(dial, 'pointerup', 0, 10);
    await settle();
    expect(rotationOf(tri.id).rotate).toBe(90);
    expect(useVamsStore.getState().past).toHaveLength(1);
    useVamsStore.getState().undo();
    await settle();
    expect(rotationOf(tri.id).rotate).toBe(0);
    unmount(host);
  });
});

describe('BB-PANEL-19: The rotate dial and scale pad answer arrow keys', () => {
  it('turns by 1° (15° with Shift) and scales by 0.05 per axis', async () => {
    const tri = addTriangle();
    select(tri.id);
    useVamsStore.setState({ past: [], future: [] });
    const host = mount(h(ObjectTransformPanel, {}));
    const dial = host.querySelector('[role="slider"][aria-label="Rotation"]') as HTMLElement;
    const right = key(dial, 'ArrowRight');
    await settle();
    expect(right.defaultPrevented).toBe(true);
    expect(rotationOf(tri.id).rotate).toBe(1);
    expect(useVamsStore.getState().past).toHaveLength(1);
    key(dial, 'ArrowDown', { shiftKey: true });
    await settle();
    expect(rotationOf(tri.id).rotate).toBe(-14);
    expect(host.querySelector('[role="slider"][aria-label="Rotation"]')!.getAttribute('aria-valuenow')).toBe('-14');

    const pad = host.querySelector('[role="slider"][aria-label="Scale X and Y"]') as HTMLElement;
    // Locked by default: X and Y move together.
    key(pad, 'ArrowRight');
    await settle();
    expect(rotationOf(tri.id).scaleX).toBeCloseTo(1.05, 5);
    expect(rotationOf(tri.id).scaleY).toBeCloseTo(1.05, 5);
    (host.querySelector('button[aria-label="Unlock scale X and Y"]') as HTMLButtonElement).click();
    await settle();
    key(host.querySelector('[role="slider"][aria-label="Scale X and Y"]')!, 'ArrowUp');
    await settle();
    expect(rotationOf(tri.id).scaleX).toBeCloseTo(1.05, 5);
    expect(rotationOf(tri.id).scaleY).toBeCloseTo(1.1, 5);
    expect(host.querySelector('[role="slider"][aria-label="Scale X and Y"]')!.getAttribute('aria-valuetext')).toBe('scaleX 1.05, scaleY 1.10');
    unmount(host);
  });
});

describe('BB-PANEL-20: The UV Editor has a typed table of texture coordinates', () => {
  it('shows the glTexCoord2f hint and updates a vertex u from its field', async () => {
    const quad = loadTexturedQuad();
    useVamsStore.setState({ activeSection: 'Textures', past: [], future: [] });
    const host = mount(h(UVEditorPanel, {}));
    await settle();
    expect(hints(host)).toContain('glTexCoord2f(u, v)');
    expect(host.querySelector('caption')!.textContent).toBe('Texture coordinates');
    const u0 = fieldNamed(host, 'Vertex 0 U')!;
    expect(u0).not.toBeNull();
    expect(fieldNamed(host, 'Vertex 0 V')).not.toBeNull();
    typeInto(u0, '0.25');
    await settle();
    const uvs = useVamsStore.getState().objects.find((o) => o.id === quad.id)!.uvs!;
    expect(uvs[0].u).toBe(0.25);
    expect(useVamsStore.getState().past).toHaveLength(1);
    unmount(host);
  });
});

describe('BB-PANEL-21: Delete on a focused tree row deletes that row', () => {
  it('removes the focused object, not the selected one, and keeps the key from the window', async () => {
    const a = addTriangle(-0.5, 0);
    const b = addTriangle(0.5, 0);
    select(a.id);
    const host = mount(h(SceneHierarchyPanel, {}));
    await settle();
    const row = host.querySelector(`[role="treeitem"][data-object-id="${b.id}"]`) as HTMLElement;
    row.focus();
    let windowDeletes = 0;
    const spy = (event: KeyboardEvent) => {
      if (event.key === 'Delete') windowDeletes++;
    };
    window.addEventListener('keydown', spy);
    const event = key(row, 'Delete');
    window.removeEventListener('keydown', spy);
    await settle();
    expect(event.defaultPrevented).toBe(true);
    expect(windowDeletes).toBe(0);
    const ids = useVamsStore.getState().objects.map((o) => o.id);
    expect(ids).toContain(a.id);
    expect(ids).not.toContain(b.id);
    unmount(host);
  });
});

describe('BB-PANEL-22: The Vertices panel edits glVertex2f positions with one undo step', () => {
  it('lists each vertex and moves it through the store', async () => {
    const tri = addTriangle();
    select(tri.id);
    const host = mount(h(VerticesPanel, {}));
    await settle();
    expect(host.querySelectorAll('tbody tr')).toHaveLength(3);
    useVamsStore.setState({ past: [], future: [] });
    const before = useVamsStore.getState().past.length;
    typeInto(fieldNamed(host, 'Vertex 0 X')!, '0.25');
    await settle();
    const moved = useVamsStore.getState().objects.find((o) => o.id === tri.id)!;
    expect(moved.vertices[0].x).toBeCloseTo(0.25);
    expect(useVamsStore.getState().past.length).toBe(before + 1);
    unmount(host);
  });
});
