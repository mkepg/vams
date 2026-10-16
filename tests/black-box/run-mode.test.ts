/**
 * BLACK-BOX TEST SUITE — BB-RUN
 * The canvas Run state: events reach handlers, the canvas moves, and scene state never changes.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useVamsStore, STORAGE_KEY } from '@/core/store';
import { buildProjectFile } from '@/entities/project/model/project-io';
import { canRun, runController, MIN_WINDOW, RUN_STRIP_HEIGHT } from '@/features/callbacks/model/run-controller';
import { makeFakeDisplay, registerFakeRenderer, type FakeDisplay } from '../helpers/fake-renderer';
import { addTriangle, getState } from '../helpers/store';
import RunOverlay, { RUN_EMPTY_REASON, RUN_NO_CALLBACK_REASON, RUN_OPEN_CALLBACKS } from '@/features/callbacks/ui/RunOverlay';
import { renderBridge } from '@/shared/engine/render-bridge';
import { SelectionOverlay } from '@/shared/engine/selection-overlay';
import { Container } from 'pixi.js';
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
  it('shows onReshape(800, 568)', () => {
    setup();
    getState().setCallbackHandler('reshape', 'onReshape');
    expect(runController.start({ loop: false })).toBe(true);
    expect(runController.getSnapshot().lastCall).toBe('onReshape(800, 568)');
    expect(runController.getSnapshot().window).toEqual({ width: 800, height: 568 });
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

describe('BB-RUN-7: The program window resizes within its limits and follows the canvas', () => {
  it('clamps, fires Reshape on the next frame, and shrinks with the canvas', () => {
    const { resize } = setup();
    getState().setCallbackHandler('reshape', 'onReshape');
    runController.start({ loop: false });
    runController.resizeWindow(50, 5000);
    runController.stepFrame();
    expect(runController.getSnapshot().window).toEqual({ width: MIN_WINDOW.width, height: 568 });
    expect(runController.getSnapshot().lastCall).toBe('onReshape(200, 568)');
    runController.nudgeWindow(10, -10);
    runController.stepFrame();
    expect(runController.getSnapshot().window).toEqual({ width: 210, height: 558 });
    resize({ width: 640, height: 400 });
    runController.resizeWindow(800, 600);
    runController.stepFrame();
    expect(runController.getSnapshot().window).toEqual({ width: 640, height: 368 });
  });

  it('reapplies its view every frame', () => {
    const { setView } = setup();
    runController.start({ loop: false });
    setView.mockClear();
    runController.stepFrame();
    expect(setView).toHaveBeenCalledWith(expect.objectContaining({ minX: -1, maxX: 1 }), { x: 0, y: RUN_STRIP_HEIGHT, width: 800, height: 568 });
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
  it('blocks editor shortcuts and passes activation and handle arrows', () => {
    setup();
    runController.start({ loop: false });
    const button = document.createElement('button');
    const handle = document.createElement('button');
    handle.className = 'run-handle';
    document.body.append(button, handle);
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
      send(handle, 'ArrowLeft');
      expect(spy).toHaveBeenCalledTimes(3);
      expect(runController.getSnapshot().lastCall).toBeNull();
    } finally {
      window.removeEventListener('keydown', spy);
      button.remove();
      handle.remove();
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

describe('BB-RUN-11: The overlay shows Run, then the strip, the readout and the handle', () => {
  it('starts, shows "Waiting for an event", resizes by keys in 10px steps, and stops', async () => {
    setup();
    const host = mount(h(RunOverlay, {}));
    await settle();
    const run = host.querySelector('.run-button') as HTMLButtonElement;
    expect(run.disabled).toBe(false);
    run.click();
    await settle();
    expect(host.querySelector('.run-strip')?.textContent).toContain('Running');
    expect(host.querySelector('.run-readout')?.textContent).toBe('Waiting for an event');
    expect(document.activeElement).toBe(host.querySelector('.run-surface'));
    const handle = host.querySelector('.run-handle') as HTMLButtonElement;
    const bubbled = vi.fn();
    window.addEventListener('keydown', bubbled);
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    window.removeEventListener('keydown', bubbled);
    expect(bubbled).not.toHaveBeenCalled();
    runController.stepFrame();
    await settle();
    expect(runController.getSnapshot().window).toEqual({ width: 790, height: 568 });
    const stop = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Stop'))!;
    stop.click();
    await settle();
    expect(runController.getSnapshot().running).toBe(false);
    expect(document.activeElement).toBe(host.querySelector('.run-button'));
    render(null, host);
    host.remove();
  });

  it('is disabled with a reason when nothing can run', async () => {
    const host = mount(h(RunOverlay, {}));
    await settle();
    const run = host.querySelector('.run-button') as HTMLButtonElement;
    expect(run.disabled).toBe(true);
    expect(host.querySelector('.run-plate')?.textContent).toBe(RUN_EMPTY_REASON);
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

  it('hides Run and its plate over an illustration', async () => {
    setup();
    showIllustration();
    const host = mount(h(RunOverlay, {}));
    await settle();
    expect(host.querySelector('.run-button')).toBeNull();
    expect(host.querySelector('.run-plate')).toBeNull();
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

describe('BB-RUN-15: The program window starts below the Running strip', () => {
  it('reports the height below the strip to Reshape and maps the view below it', () => {
    const { setView } = setup();
    getState().setCallbackHandler('reshape', 'onReshape');
    runController.start({ loop: false });
    expect(RUN_STRIP_HEIGHT).toBe(32);
    expect(runController.getSnapshot().lastCall).toBe(`onReshape(800, ${600 - RUN_STRIP_HEIGHT})`);
    setView.mockClear();
    runController.stepFrame();
    expect(setView).toHaveBeenCalledWith(expect.anything(), { x: 0, y: RUN_STRIP_HEIGHT, width: 800, height: 600 - RUN_STRIP_HEIGHT });
  });

  it('draws the window under the strip', async () => {
    setup();
    const host = mount(h(RunOverlay, {}));
    runController.start({ loop: false });
    await settle();
    expect((host.querySelector('.run-window') as HTMLElement).style.height).toBe(`${600 - RUN_STRIP_HEIGHT}px`);
    const { readFileSync } = await import('node:fs');
    const scss = readFileSync('src/features/callbacks/ui/run-overlay.scss', 'utf8');
    expect(scss).toMatch(/--run-strip-height:\s*32px/);
    const windowRule = scss.slice(scss.indexOf('.run-window {'), scss.indexOf('}', scss.indexOf('.run-window {')));
    expect(windowRule).toMatch(/top:\s*var\(--run-strip-height\)/);
    render(null, host);
    host.remove();
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

describe('BB-RUN-17: Run off says why on the canvas', () => {
  it('asks for a shape, then a callback with a link to Callbacks, then gets out of the way', async () => {
    const host = mount(h(RunOverlay, {}));
    await settle();
    const run = () => host.querySelector('.run-button') as HTMLButtonElement;
    const plate = () => host.querySelector('.run-plate');
    expect(run().disabled).toBe(true);
    expect(plate()!.textContent).toBe(RUN_EMPTY_REASON);
    expect(run().getAttribute('aria-describedby')).toBe(plate()!.id);
    addTriangle();
    await settle();
    expect(plate()!.textContent).toBe(`${RUN_NO_CALLBACK_REASON} ${RUN_OPEN_CALLBACKS}`);
    getState().setRailPanel('scene');
    (plate()!.querySelector('button') as HTMLButtonElement).click();
    expect(getState().railPanel).toBe('callbacks');
    getState().setCallbackHandler('keyboard', 'onKey');
    await settle();
    expect(run().disabled).toBe(false);
    expect(plate()).toBeNull();
    expect(host.querySelector('[data-tour-anchor="run"]')).not.toBeNull();
    render(null, host);
    host.remove();
  });
});

describe('BB-RUN-18: The Run note sits in the window bar, clear of the frame', () => {
  it('is placed from the header by the stage padding and the frame, not hung under the button', async () => {
    const { readFileSync } = await import('node:fs');
    const scss = readFileSync('src/features/callbacks/ui/run-overlay.scss', 'utf8');
    const start = scss.indexOf('.run-plate {');
    const rule = scss.slice(start, scss.indexOf('&__link', start));
    expect(rule).toMatch(/top:\s*calc\(100% \+ 1px \+ var\(--stage-pad/);
    expect(rule).toMatch(/right:\s*calc\(var\(--stage-pad/);
    expect(rule).toMatch(/height:\s*22px/);
    expect(rule).toMatch(/var\(--paper-raised\)/);
    expect(rule).not.toMatch(/var\(--space-1\)\);\s*\n\s*right:\s*0/);
    const pane = readFileSync('src/widgets/canvas/canvas-pane.scss', 'utf8');
    expect(pane).toMatch(/--stage-pad:\s*14px/);
    const header = pane.slice(pane.indexOf('.canvas-header {'), pane.indexOf('&__title'));
    expect(header).toMatch(/position:\s*relative/);
  });
});
