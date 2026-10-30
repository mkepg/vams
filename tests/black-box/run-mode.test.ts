/**
 * BLACK-BOX TEST SUITE — BB-RUN
 * The canvas Run state: events reach handlers, the canvas moves, and scene state never changes.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useVamsStore, STORAGE_KEY } from '@/core/store';
import { buildProjectFile } from '@/entities/project/model/project-io';
import { canRun, FLASH_MS, runController } from '@/features/callbacks/model/run-controller';
import { makeFakeDisplay, registerFakeRenderer, type FakeDisplay } from '../helpers/fake-renderer';
import { addTriangle, getState } from '../helpers/store';
import RunOverlay, { RUN_EMPTY_REASON, RUN_HINT, RUN_NO_CALLBACK_REASON, RUN_OPEN_CALLBACKS } from '@/features/callbacks/ui/RunOverlay';
import { renderBridge } from '@/shared/engine/render-bridge';
import { SelectionOverlay, setEditorOutlinesHidden } from '@/shared/engine/selection-overlay';
import { Container, Graphics } from 'pixi.js';
import { createDrawable } from '@/shared/engine/pixi/primitives';
import { GROUP_OUTLINE } from '@/shared/engine/pixi/primitives/rendering/drawableFactory';
import type { SceneNode } from '@/core/types/scene';
import SceneCodePanel from '@/features/code-generation/ui/SceneCodePanel';
import EditorShell from '@/pages/editor/ui/EditorShell';

let unregister: (() => void) | null = null;
afterEach(() => {
  runController.stop();
  unregister?.();
  unregister = null;
});

function setup(canvas = { width: 800, height: 600 }) {
  const t = addTriangle(0, 0, 0.2);
  const displays = new Map<string, FakeDisplay>([[t.id, makeFakeDisplay()]]);
  const setView = vi.fn();
  const setAppearance = vi.fn();
  const onResync = vi.fn();
  let size = canvas;
  unregister = registerFakeRenderer(displays, { setView, setAppearance, onResync, getCanvasSize: () => size });
  getState().setCallbackHandler('keyboard', 'onKey');
  getState().addCallbackRule('keyboard', {
    id: 'r', objectId: t.id, trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'translate', dx: 0.1, dy: 0 },
  });
  return { t, display: displays.get(t.id)!, setView, setAppearance, onResync, resize: (s: typeof canvas) => { size = s; } };
}
const press = (key: string, init: KeyboardEventInit = {}) => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  document.body.dispatchEvent(e);
  return e;
};

describe('BB-RUN-1: Run needs an object and a callback', () => {
  it('is off for an empty scene, a scene with nothing to run, or an invalid name', () => {
    expect(canRun(getState())).toBe(false);
    addTriangle();
    expect(canRun(getState())).toBe(false);
    getState().setCallbackHandler('keyboard', 'main');
    expect(canRun(getState())).toBe(false);
    getState().setCallbackHandler('keyboard', 'onKey');
    expect(canRun(getState())).toBe(true);
    getState().clearCallback('keyboard');
    expect(canRun(getState())).toBe(false);
  });
});

describe('BB-RUN-2: Starting Run calls Reshape once with the window size', () => {
  it('shows onReshape(800, 600)', () => {
    setup();
    getState().setCallbackHandler('reshape', 'onReshape');
    expect(runController.start({ loop: false })).toBe(true);
    expect(runController.getSnapshot().lastCall).toBe('onReshape(800, 600)');
    expect(runController.getSnapshot().window).toEqual({ width: 800, height: 600 });
  });
});

describe('BB-RUN-3: A key moves the target and names the branch', () => {
  it('moves the display object and sets fired', () => {
    const { display } = setup();
    runController.start({ loop: false });
    runController.pointerMove(412, 230, false);
    press('d');
    expect(display.position.x).toBeCloseTo(0.1, 6);
    const snap = runController.getSnapshot();
    expect(snap.lastCall).toBe("onKey('d', 412, 230)");
    expect(snap.fired).toMatchObject({ kind: 'keyboard', handlerName: 'onKey', trigger: { kind: 'keyboard', key: 'd' } });
  });
});

describe('BB-RUN-4: Run never writes the store', () => {
  it('keeps the persisted value and the project file identical', () => {
    setup();
    const persisted = () => localStorage.getItem(STORAGE_KEY);
    const file = () => JSON.stringify({ ...buildProjectFile(getState() as never), exportedAt: '' });
    const before = [persisted(), file()];
    runController.start({ loop: false });
    press('d');
    runController.pointerDown(0, 10, 10);
    runController.stepFrame();
    expect([persisted(), file()]).toEqual(before);
    runController.stop();
    expect([persisted(), file()]).toEqual(before);
  });
});

describe('BB-RUN-5: Stop, Esc and undo end Run and restore the canvas', () => {
  it.each(['stop', 'escape', 'undo'] as const)('%s', async (how) => {
    const { display, onResync } = setup();
    await new Promise((r) => setTimeout(r, 60));
    getState().setCallbackHandler('mouse', 'onMouse');
    runController.start({ loop: false });
    press('d');
    expect(display.position.x).toBeCloseTo(0.1, 6);
    if (how === 'stop') runController.stop();
    if (how === 'escape') press('Escape');
    if (how === 'undo') getState().undo();
    expect(runController.getSnapshot().running).toBe(false);
    expect(onResync).toHaveBeenCalled();
    expect(display.position.x).toBeCloseTo(getState().objects[0].transform.translateX, 6);
  });
});

describe('BB-RUN-7: The program window is the canvas, and resizing it fires Reshape', () => {
  it('reports the canvas size, then each new size once, on the next frame', () => {
    const { resize } = setup();
    getState().setCallbackHandler('reshape', 'onReshape');
    runController.start({ loop: false });
    expect(runController.getSnapshot().window).toEqual({ width: 800, height: 600 });
    runController.stepFrame();
    expect(runController.getSnapshot().lastCall).toBe('onReshape(800, 600)');
    resize({ width: 640, height: 400 });
    runController.stepFrame();
    expect(runController.getSnapshot().window).toEqual({ width: 640, height: 400 });
    expect(runController.getSnapshot().lastCall).toBe('onReshape(640, 400)');
  });

  it('reapplies its view every frame, over the whole canvas', () => {
    const { setView } = setup();
    runController.start({ loop: false });
    setView.mockClear();
    runController.stepFrame();
    expect(setView).toHaveBeenCalledWith(expect.objectContaining({ minX: -1, maxX: 1 }), { x: 0, y: 0, width: 800, height: 600 });
  });
});

describe('BB-RUN-8: Esc, Tab and modified keys never reach a handler', () => {
  it('keeps the readout and the store unchanged', async () => {
    const { display } = setup();
    await new Promise((r) => setTimeout(r, 60));
    runController.start({ loop: false });
    const tab = press('Tab');
    expect(tab.defaultPrevented).toBe(false);
    press('z', { ctrlKey: true });
    press('d', { ctrlKey: true });
    expect(runController.getSnapshot().running).toBe(true);
    expect(runController.getSnapshot().lastCall).toBeNull();
    expect(display.position.x).toBeCloseTo(0, 6);
    expect(getState().objects).toHaveLength(1);
    press('Escape');
    expect(runController.getSnapshot().lastCall).toBeNull();
  });
});

describe('BB-RUN-9: A lesson step change stops Run', () => {
  it('stops when currentStepIndex changes', () => {
    setup();
    runController.start({ loop: false });
    useVamsStore.setState({ currentStepIndex: 1 });
    expect(runController.getSnapshot().running).toBe(false);
  });
});

describe('BB-RUN-13: A focused button keeps only its own keys during Run', () => {
  it('blocks editor shortcuts and arrows, and passes activation', () => {
    setup();
    runController.start({ loop: false });
    const button = document.createElement('button');
    document.body.append(button);
    const spy = vi.fn();
    window.addEventListener('keydown', spy);
    const send = (el: HTMLElement, key: string, init: KeyboardEventInit = {}) =>
      el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
    try {
      button.focus();
      send(button, 'Delete');
      send(button, 'z', { ctrlKey: true });
      send(button, 'd', { ctrlKey: true });
      send(button, 'ArrowRight');
      expect(spy).not.toHaveBeenCalled();
      expect(runController.getSnapshot().running).toBe(true);
      expect(runController.getSnapshot().lastCall).toBeNull();
      send(button, 'Enter');
      send(button, ' ');
      expect(spy).toHaveBeenCalledTimes(2);
    } finally {
      window.removeEventListener('keydown', spy);
      button.remove();
    }
  });
});

const settle = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); };
function mount(vnode: VNode) {
  const host = document.createElement('div');
  host.style.position = 'relative';
  document.body.appendChild(host);
  render(vnode, host);
  return host;
}
const isInert = (el: Element | null) => !!el && ((el as HTMLElement & { inert?: boolean }).inert === true || el.hasAttribute('inert'));

describe('BB-RUN-6: Editing pauses while running', () => {
  it('makes the column inert, and Delete and Ctrl+Z never reach other listeners', async () => {
    const { t } = setup();
    useVamsStore.setState({ selectedObjectId: t.id });
    const host = mount(h(EditorShell, {
      topBar: h('header', { class: 'top-bar' }, h('div', { class: 'top-bar__actions' }, 'actions')),
      rail: h('div', {}, 'rail'),
      panel: h('div', {}, 'panel'),
      canvas: h('div', {}, 'canvas'),
      codeMath: h('div', {}, 'code'),
    }));
    runController.start({ loop: false });
    await settle();
    expect(isInert(host.querySelector('#editor-panel'))).toBe(true);
    const later = vi.fn();
    window.addEventListener('keydown', later);
    press('Delete');
    press('z', { ctrlKey: true });
    window.removeEventListener('keydown', later);
    expect(later).not.toHaveBeenCalled();
    expect(runController.getSnapshot().running).toBe(true);
    render(null, host);
    host.remove();
  });
});

describe('BB-RUN-10: Pointer events reach the Mouse handler, even released outside', () => {
  it('delivers down and up with window coordinates', async () => {
    const { t } = setup();
    getState().setCallbackHandler('mouse', 'onMouse');
    getState().addCallbackRule('mouse', {
      id: 'm', objectId: t.id, trigger: { kind: 'mouse', button: 'left', state: 'up' }, action: { type: 'rotate', degrees: 15 },
    });
    const host = mount(h(RunOverlay, {}));
    runController.start({ loop: false });
    await settle();
    const surface = host.querySelector('.run-surface') as HTMLElement;
    surface.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 30, clientY: 40, pointerId: 1 }));
    surface.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: 5000, clientY: 40, pointerId: 1 }));
    expect(runController.getSnapshot().lastCall).toMatch(/^onMouse\(GLUT_LEFT_BUTTON, GLUT_UP, \d+, 40\)$/);
    expect(runController.getSnapshot().fired?.trigger).toEqual({ kind: 'mouse', button: 'left', state: 'up' });
    render(null, host);
    host.remove();
  });
});

describe('BB-RUN-11: The overlay shows Run, then only an input surface over the canvas', () => {
  it('starts, focuses the surface, draws no strip, readout or handle, and stops', async () => {
    setup();
    const host = mount(h(RunOverlay, {}));
    await settle();
    const run = host.querySelector('.run-button') as HTMLButtonElement;
    expect(run.disabled).toBe(false);
    run.click();
    await settle();
    expect(document.activeElement).toBe(host.querySelector('.run-surface'));
    expect(host.querySelector('.run-layer')!.children).toHaveLength(2);
    expect(host.querySelector('.run-strip, .run-readout, .run-handle, .run-window')).toBeNull();
    const stop = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Stop'))!;
    stop.click();
    await settle();
    expect(runController.getSnapshot().running).toBe(false);
    expect(document.activeElement).toBe(host.querySelector('.run-button'));
    render(null, host);
    host.remove();
  });

  it('is aria-disabled with a reason when nothing can run', async () => {
    const host = mount(h(RunOverlay, {}));
    await settle();
    const run = host.querySelector('.run-button') as HTMLButtonElement;
    expect(run.disabled).toBe(false);
    expect(run.getAttribute('aria-disabled')).toBe('true');
    expect(host.querySelector('.run-plate')).toBeNull();
    expect(document.getElementById(run.getAttribute('aria-describedby')!)?.textContent).toBe(RUN_EMPTY_REASON);
    render(null, host);
    host.remove();
  });
});

describe('BB-RUN-12: The code panel flashes the branch that fired', () => {
  it('highlights the case d lines', async () => {
    setup();
    const host = mount(h(SceneCodePanel, { flashBranch: { handlerName: 'onKey', trigger: { kind: 'keyboard', key: 'd' }, seq: 1 } }));
    await settle();
    const changed = [...host.querySelectorAll('.code-line.is-fired .code-line__text')].map((el) => el.textContent?.trim());
    expect(changed).toEqual(expect.arrayContaining(["case 'd':", "case 'D':", 'break;']));
    render(null, host);
    host.remove();
  });
});

describe('BB-RUN-14: Run is unavailable while a Pipeline illustration replaces the canvas', () => {
  const showIllustration = () =>
    useVamsStore.setState({ appMode: 'Lesson', activeSection: 'Pipeline', pipelineMode: 'Diagram' });
  afterEach(() => {
    useVamsStore.setState({ appMode: 'Author', pipelineMode: 'Playground' });
  });

  it('canRun is false for an illustration mode and true again in Playground', () => {
    setup();
    useVamsStore.setState({ appMode: 'Lesson', activeSection: 'Pipeline', pipelineMode: 'Playground' });
    expect(canRun(getState())).toBe(true);
    showIllustration();
    expect(canRun(getState())).toBe(false);
    useVamsStore.setState({ pipelineMode: 'RasterVector' });
    expect(canRun(getState())).toBe(false);
    useVamsStore.setState({ pipelineMode: 'Playground' });
    expect(canRun(getState())).toBe(true);
  });

  it('canRun is false in Author mode too, while the Pipeline section shows an illustration', () => {
    setup();
    useVamsStore.setState({ appMode: 'Author', activeSection: 'Pipeline', pipelineMode: 'Diagram' });
    expect(canRun(getState())).toBe(false);
    useVamsStore.setState({ pipelineMode: 'Playground' });
    expect(canRun(getState())).toBe(true);
  });

  it('hides Run over an illustration', async () => {
    setup();
    showIllustration();
    const host = mount(h(RunOverlay, {}));
    await settle();
    expect(host.querySelector('.run-button')).toBeNull();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    useVamsStore.setState({ pipelineMode: 'Playground' });
    await settle();
    expect(host.querySelector('.run-button')).not.toBeNull();
    render(null, host);
    host.remove();
  });

  it('a running Run stops when the Pipeline mode changes to an illustration', () => {
    setup();
    useVamsStore.setState({ appMode: 'Lesson', activeSection: 'Pipeline', pipelineMode: 'Playground' });
    expect(runController.start({ loop: false })).toBe(true);
    expect(runController.getSnapshot().running).toBe(true);
    useVamsStore.setState({ pipelineMode: 'Diagram' });
    expect(runController.getSnapshot().running).toBe(false);
  });

  it('start refuses while an illustration is showing', () => {
    setup();
    showIllustration();
    expect(runController.start({ loop: false })).toBe(false);
  });
});

describe('BB-RUN-15: The program window shows that it runs, and its last call, in its own title bar', () => {
  it('reads running and how to stop, then the last call, and leaves the scene where it was', async () => {
    setup();
    const { default: ProgramWindow } = await import('@/widgets/canvas/ui/ProgramWindow');
    const win = mount(h(ProgramWindow, { size: { width: 800, height: 600 } }, h('div', {})));
    await settle();
    expect(win.querySelector('.canvas-window__status')).toBeNull();
    runController.start({ loop: false });
    await settle();
    const bar = win.querySelector('.canvas-window__bar')!;
    expect(bar.querySelector('.canvas-window__running')).not.toBeNull();
    expect(bar.querySelector('.canvas-window__status')!.textContent).toBe(RUN_HINT);
    press('d');
    await settle();
    expect(bar.querySelector('.canvas-window__status')!.textContent).toBe(runController.getSnapshot().lastCall);
    expect(runController.getSnapshot().lastCall).toMatch(/^onKey\('d'/);
    const { readFileSync } = await import('node:fs');
    const scss = readFileSync('src/features/callbacks/ui/run-overlay.scss', 'utf8');
    expect(scss).not.toMatch(/run-strip|run-window|run-readout|run-handle/);
    render(null, win);
    win.remove();
  });
});

describe('BB-RUN-16: The selection outline and handles hide during Run and come back after', () => {
  it.each(['stop', 'undo', 'selection'] as const)('hides them while running and shows them after %s', (how) => {
    setup();
    expect(renderBridge.editorOverlaysHidden()).toBe(false);
    runController.start({ loop: false });
    expect(renderBridge.editorOverlaysHidden()).toBe(true);
    if (how === 'stop') runController.stop();
    if (how === 'undo') getState().undo();
    if (how === 'selection') getState().selectObject(null);
    expect(runController.getSnapshot().running).toBe(false);
    expect(renderBridge.editorOverlaysHidden()).toBe(false);
  });

  it('keeps the outline hidden while suppressed, even when its target is set again', () => {
    const parent = new Container();
    const overlay = new SelectionOverlay();
    const target = new Container();
    parent.addChild(overlay);
    parent.addChild(target);
    overlay.setTarget(target);
    expect(overlay.visible).toBe(true);
    overlay.setSuppressed(true);
    expect(overlay.visible).toBe(false);
    overlay.setTarget(target);
    expect(overlay.visible).toBe(false);
    overlay.setSuppressed(false);
    expect(overlay.visible).toBe(true);
  });
});

describe('BB-RUN-17: Run off says why when it is clicked', () => {
  it('asks for a shape, then a callback with a button to Callbacks, then starts', async () => {
    const host = mount(h(RunOverlay, {}));
    await settle();
    const run = () => host.querySelector('.run-button') as HTMLButtonElement;
    const dialog = () => host.querySelector('[role="dialog"]');
    expect(run().getAttribute('aria-disabled')).toBe('true');
    expect(dialog()).toBeNull();
    expect(document.getElementById(run().getAttribute('aria-describedby')!)?.textContent).toBe(RUN_EMPTY_REASON);
    addTriangle();
    await settle();
    expect(document.getElementById(run().getAttribute('aria-describedby')!)?.textContent).toBe(RUN_NO_CALLBACK_REASON);
    run().click();
    await settle();
    expect(dialog()!.textContent).toContain(RUN_OPEN_CALLBACKS);
    getState().setRailPanel('scene');
    ([...dialog()!.querySelectorAll('button')].find((b) => b.textContent === RUN_OPEN_CALLBACKS) as HTMLButtonElement).click();
    await settle();
    expect(getState().railPanel).toBe('callbacks');
    expect(dialog()).toBeNull();
    getState().setCallbackHandler('keyboard', 'onKey');
    await settle();
    expect(run().getAttribute('aria-disabled')).toBeNull();
    expect(run().hasAttribute('aria-describedby')).toBe(false);
    expect(host.querySelector('[data-tour-anchor="run"]')).not.toBeNull();
    render(null, host);
    host.remove();
  });
});

describe('BB-RUN-18: The window bar holds no Run note', () => {
  it('has no note in the bar or the header, and no style for one', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('src/features/callbacks/ui/run-overlay.scss', 'utf8')).not.toContain('.run-plate');
    expect(readFileSync('src/widgets/canvas/ui/canvas-window.scss', 'utf8')).not.toMatch(/run-plate|@container/);
    const { ProgramWindow } = { ProgramWindow: (await import('@/widgets/canvas/ui/ProgramWindow')).default };
    const win = mount(h(ProgramWindow, { size: { width: 100, height: 100 } }, h('div', {})));
    await settle();
    expect(win.querySelector('.run-plate')).toBeNull();
    expect(win.querySelector('.canvas-window__bar')!.querySelector('.run-control')).toBeNull();
    render(null, win);
    win.remove();
  });
});

describe('BB-RUN-19: A blocked Run opens a small dialog that says what to do', () => {
  const run = (host: HTMLElement) => host.querySelector('.run-button') as HTMLButtonElement;
  const dialog = (host: HTMLElement) => host.querySelector('[role="dialog"]') as HTMLElement | null;
  const heading = (d: HTMLElement) => document.getElementById(d.getAttribute('aria-labelledby')!)!.textContent;
  const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

  it('names the empty scene, and its button does what the empty card does', async () => {
    const host = mount(h(RunOverlay, {}));
    await settle();
    run(host).click();
    await settle();
    const d = dialog(host)!;
    expect(heading(d)).toBe('Add a shape first');
    expect(d.textContent).toContain('Your program has nothing to draw yet. Add a shape, then press Run.');
    expect(run(host).getAttribute('aria-expanded')).toBe('true');
    const add = d.querySelector('button') as HTMLButtonElement;
    expect(add.textContent).toBe('Add a shape');
    expect(document.activeElement).toBe(add);
    getState().setRailPanel('scene');
    add.click();
    await settle();
    expect(getState().railPanel).toBe('add');
    expect(dialog(host)).toBeNull();
    render(null, host);
    host.remove();
  });

  it('names the missing callback and closes with Escape, returning focus to Run', async () => {
    addTriangle();
    const host = mount(h(RunOverlay, {}));
    await settle();
    run(host).click();
    await settle();
    const d = dialog(host)!;
    expect(heading(d)).toBe('Run needs a callback');
    expect(d.textContent).toContain('Switch on a callback in Callbacks and give it a rule, then press Run.');
    expect(d.querySelector('button')!.textContent).toBe('Open Callbacks');
    key(d.querySelector('button')!, 'Escape');
    await settle();
    expect(dialog(host)).toBeNull();
    expect(document.activeElement).toBe(run(host));
    render(null, host);
    host.remove();
  });

  it('toggles on a second click and closes on a click outside', async () => {
    addTriangle();
    const host = mount(h(RunOverlay, {}));
    await settle();
    run(host).click();
    await settle();
    expect(dialog(host)).not.toBeNull();
    run(host).click();
    await settle();
    expect(dialog(host)).toBeNull();
    run(host).click();
    await settle();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await settle();
    expect(dialog(host)).toBeNull();
    expect(document.activeElement).toBe(run(host));
    render(null, host);
    host.remove();
  });

  it('stays closed when the reason it opened for comes back on its own', async () => {
    const host = mount(h(RunOverlay, {}));
    await settle();
    run(host).click();
    await settle();
    expect(heading(dialog(host)!)).toBe('Add a shape first');
    const t = addTriangle();
    await settle();
    expect(dialog(host)).toBeNull();
    getState().deleteObject(t.id);
    await settle();
    expect(dialog(host)).toBeNull();
    expect(run(host).getAttribute('aria-expanded')).toBe('false');
    render(null, host);
    host.remove();
  });

  it('leaves a ready Run alone: no aria-disabled, and a click starts the program', async () => {
    setup();
    const host = mount(h(RunOverlay, {}));
    await settle();
    expect(run(host).getAttribute('aria-disabled')).toBeNull();
    run(host).click();
    await settle();
    expect(runController.getSnapshot().running).toBe(true);
    expect(dialog(host)).toBeNull();
    render(null, host);
    host.remove();
  });
});

describe('BB-RUN-20: The cursor readout shows windowToWorld during Run', () => {
  it('maps the pointer through Run\'s widened volume, not the editor\'s', () => {
    setup();
    getState().setCallbackHandler('reshape', 'onReshape');
    runController.start({ loop: false });
    runController.pointerMove(0, 0, false);
    expect(getState().cursorWorld!.x).toBeCloseTo(-4 / 3, 4);
    expect(getState().cursorWorld!.y).toBeCloseTo(1, 4);
    runController.pointerMove(800, 600, false);
    expect(getState().cursorWorld!.x).toBeCloseTo(4 / 3, 4);
    expect(getState().cursorWorld!.y).toBeCloseTo(-1, 4);
    expect(runController.getSnapshot().running).toBe(true);
  });
});

describe('BB-RUN-21: A repeat restarts the flash and does not scroll the code again', () => {
  it('alternates the flash class per call and scrolls once for the same branch', async () => {
    setup();
    const scrollTo = vi.fn();
    const original = HTMLElement.prototype.scrollTo;
    HTMLElement.prototype.scrollTo = scrollTo as unknown as typeof original;
    const branch = (seq: number) => ({ handlerName: 'onKey', trigger: { kind: 'keyboard' as const, key: 'd' }, seq });
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h(SceneCodePanel, { flashBranch: branch(1) }), host);
    await settle();
    const calls = scrollTo.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    const again = () => host.querySelectorAll('.code-line.is-fired.is-fired--again').length;
    expect(host.querySelectorAll('.code-line.is-fired').length).toBeGreaterThan(0);
    expect(again()).toBe(0);
    render(h(SceneCodePanel, { flashBranch: branch(2) }), host);
    await settle();
    expect(again()).toBe(host.querySelectorAll('.code-line.is-fired').length);
    render(h(SceneCodePanel, { flashBranch: branch(3) }), host);
    await settle();
    expect(again()).toBe(0);
    expect(scrollTo.mock.calls.length).toBe(calls);
    HTMLElement.prototype.scrollTo = original;
    render(null, host);
    host.remove();
  });
});

describe('BB-RUN-22: Motion waiting for the frame reaches the handler before a button change', () => {
  it('moves to the pointer, then the release resets it', () => {
    const { t, display } = setup();
    getState().setCallbackHandler('mouse', 'onMouse');
    getState().setCallbackHandler('motion', 'onMotion');
    getState().addCallbackRule('motion', { id: 'mv', objectId: t.id, trigger: { kind: 'motion' }, action: { type: 'moveToPointer' } });
    getState().addCallbackRule('mouse', {
      id: 'up', objectId: t.id, trigger: { kind: 'mouse', button: 'left', state: 'up' }, action: { type: 'reset' },
    });
    runController.start({ loop: false });
    runController.pointerDown(0, 400, 300);
    runController.pointerMove(600, 150, true);
    runController.pointerUp(0, 600, 150);
    runController.stepFrame();
    expect(display.position.x).toBeCloseTo(0, 6);
    expect(display.position.y).toBeCloseTo(0, 6);
    expect(runController.getSnapshot().lastCall).toBe('onMouse(GLUT_LEFT_BUTTON, GLUT_UP, 600, 150)');
  });
});

describe('BB-RUN-23: A second button pressed while one is held reaches the Mouse handler', () => {
  it('reports the right button down and up from the moves that change buttons', async () => {
    setup();
    getState().setCallbackHandler('mouse', 'onMouse');
    const host = mount(h(RunOverlay, {}));
    runController.start({ loop: false });
    await settle();
    const surface = host.querySelector('.run-surface') as HTMLElement;
    const fire = (type: string, init: PointerEventInit) =>
      surface.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: 30, clientY: 40, pointerId: 1, ...init }));
    fire('pointerdown', { button: 0, buttons: 1 });
    expect(runController.getSnapshot().lastCall).toBe('onMouse(GLUT_LEFT_BUTTON, GLUT_DOWN, 30, 40)');
    fire('pointermove', { button: 2, buttons: 3 });
    expect(runController.getSnapshot().lastCall).toBe('onMouse(GLUT_RIGHT_BUTTON, GLUT_DOWN, 30, 40)');
    fire('pointermove', { button: 2, buttons: 1 });
    expect(runController.getSnapshot().lastCall).toBe('onMouse(GLUT_RIGHT_BUTTON, GLUT_UP, 30, 40)');
    fire('pointerup', { button: 0, buttons: 0 });
    expect(runController.getSnapshot().lastCall).toBe('onMouse(GLUT_LEFT_BUTTON, GLUT_UP, 30, 40)');
    render(null, host);
    host.remove();
  });
});

describe('BB-RUN-24: When the scene stops Run, focus stays where the student put it', () => {
  it('keeps focus on an outside field, and still returns it to Run after Stop', async () => {
    const { t } = setup();
    const host = mount(h(RunOverlay, {}));
    const field = document.createElement('input');
    document.body.appendChild(field);
    await settle();
    (host.querySelector('.run-button') as HTMLButtonElement).click();
    await settle();
    field.focus();
    getState().updateObjectName(t.id, 'Moved');
    await settle();
    expect(runController.getSnapshot().running).toBe(false);
    expect(document.activeElement).toBe(field);
    (host.querySelector('.run-button') as HTMLButtonElement).click();
    await settle();
    expect(document.activeElement).toBe(host.querySelector('.run-surface'));
    press('Escape');
    await settle();
    expect(document.activeElement).toBe(host.querySelector('.run-button'));
    field.remove();
    render(null, host);
    host.remove();
  });
});

describe('BB-RUN-25: The handler that fired stays open in the code until Run stops', () => {
  it('keeps the last branch after its flash ends, and clears it on Stop', () => {
    vi.useFakeTimers();
    try {
      setup();
      runController.start({ loop: false });
      press('d');
      const fired = { handlerName: 'onKey', trigger: { kind: 'keyboard', key: 'd' } };
      expect(runController.getSnapshot().lastFired).toMatchObject(fired);
      vi.advanceTimersByTime(FLASH_MS + 1);
      expect(runController.getSnapshot().fired).toBeNull();
      expect(runController.getSnapshot().lastFired).toMatchObject(fired);
      runController.stop();
      expect(runController.getSnapshot().lastFired).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the held branch unfolded and unlit once the flash is over', async () => {
    const { t } = setup();
    getState().selectObject(t.id);
    const held = { handlerName: 'onKey', trigger: { kind: 'keyboard' as const, key: 'd' } };
    const host = mount(h(SceneCodePanel, { heldBranch: held }));
    await settle();
    const shown = [...host.querySelectorAll('.code-line .code-line__text')].map((el) => el.textContent?.trim());
    expect(shown).toEqual(expect.arrayContaining(["case 'd':", 'break;']));
    expect(host.querySelector('.code-line.is-fired')).toBeNull();
    render(h(SceneCodePanel, {}), host);
    await settle();
    const folded = [...host.querySelectorAll('.code-line .code-line__text')].map((el) => el.textContent?.trim());
    expect(folded).not.toContain("case 'd':");
    render(null, host);
    host.remove();
  });
});

describe('BB-RUN-26: Run leaves no selection outline behind', () => {
  /** Whether the outline is drawn: the overlay and its border both showing. */
  const drawn = (overlay: SelectionOverlay) => overlay.visible && overlay.children.every((c) => c.visible);

  function selectedOutline() {
    const parent = new Container();
    const overlay = new SelectionOverlay();
    const target = new Container();
    target.addChild(new Graphics().rect(0, 0, 1, 1).fill(0xffffff));
    parent.addChild(overlay);
    parent.addChild(target);
    overlay.setTarget(target);
    return { overlay, target };
  }

  it('keeps the outline hidden while Run hides it, even when the overlay is shown again', () => {
    // An edit saved on the click that starts Run reselects the object after Run has hidden the outline.
    const { overlay, target } = selectedOutline();
    expect(drawn(overlay)).toBe(true);
    overlay.setSuppressed(true);
    overlay.visible = true;
    expect(drawn(overlay)).toBe(false);
    overlay.setTarget(target);
    overlay.update();
    expect(drawn(overlay)).toBe(false);
    overlay.setSuppressed(false);
    expect(drawn(overlay)).toBe(true);
  });

  it('shows no outline after Run stops when nothing is selected', () => {
    const { overlay } = selectedOutline();
    overlay.setSuppressed(true);
    overlay.setTarget(null);
    overlay.setSuppressed(false);
    expect(drawn(overlay)).toBe(false);
  });

  const node = (id: string, extra: Partial<SceneNode>): SceneNode => ({
    id, name: id, type: 'TRIANGLES', visible: true, shading: 'SMOOTH', parentId: null, children: [],
    transform: { translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1 },
    vertices: [], lineStipple: null,
    ...extra,
  });
  const roof = node('roof', {
    parentId: 'house',
    vertices: [{ id: 'a', x: -0.4, y: 0 }, { id: 'b', x: 0.4, y: 0 }, { id: 'c', x: 0, y: 0.4 }].map((v) => ({ ...v, color: '#ff0000' })),
  });
  const house = node('house', { type: 'GROUP', children: ['roof'] });
  const groupOutline = (selected: boolean) =>
    createDrawable(house, 268, { groupChildren: [roof], isSelected: selected }).getChildByLabel(GROUP_OUTLINE) as Graphics | null;

  it('names the dashed box a selected group draws, and draws none for a group that is not selected', () => {
    const selected = groupOutline(true)!;
    expect(selected).toBeInstanceOf(Graphics);
    expect(selected.getLocalBounds().width).toBeGreaterThan(0);
    expect(groupOutline(false)?.getLocalBounds().width ?? 0).toBe(0);
  });

  it("hides a selected group's dashed box and the selection outline together, and shows both again", () => {
    const { overlay } = selectedOutline();
    const group = createDrawable(house, 268, { groupChildren: [roof], isSelected: true });
    const outline = group.getChildByLabel(GROUP_OUTLINE)!;
    setEditorOutlinesHidden(overlay, group, true);
    expect(outline.visible).toBe(false);
    expect(drawn(overlay)).toBe(false);
    // The group's children stay drawn: only the editor's marks hide.
    expect(group.children.filter((c) => c !== outline).every((c) => c.visible)).toBe(true);
    setEditorOutlinesHidden(overlay, group, false);
    expect(outline.visible).toBe(true);
    expect(drawn(overlay)).toBe(true);
  });

  it('hides only the selection outline when the selection is a shape or nothing', () => {
    const { overlay, target } = selectedOutline();
    setEditorOutlinesHidden(overlay, target, true);
    expect(drawn(overlay)).toBe(false);
    expect(target.children.every((c) => c.visible)).toBe(true);
    setEditorOutlinesHidden(overlay, undefined, false);
    expect(drawn(overlay)).toBe(true);
  });
});

describe('BB-RUN-27: Text keeps the line step the program started with through a resize', () => {
  it('holds the starting pixels per unit while Run lasts, and lets go on Stop', () => {
    const { resize } = setup({ width: 800, height: 600 });
    expect(renderBridge.runTextPixelsPerUnitY()).toBeNull();
    runController.start({ loop: false });
    expect(renderBridge.runTextPixelsPerUnitY()).toBe(300);
    resize({ width: 400, height: 300 });
    runController.stepFrame();
    expect(renderBridge.runTextPixelsPerUnitY()).toBe(300);
    runController.stop();
    expect(renderBridge.runTextPixelsPerUnitY()).toBeNull();
  });
});
