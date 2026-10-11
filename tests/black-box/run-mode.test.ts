/**
 * BLACK-BOX TEST SUITE — BB-RUN
 * The canvas Run state: events reach handlers, the canvas moves, and scene state never changes.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { useVamsStore, STORAGE_KEY } from '@/core/store';
import { buildProjectFile } from '@/entities/project/model/project-io';
import { canRun, runController, MIN_WINDOW } from '@/features/callbacks/model/run-controller';
import { makeFakeDisplay, registerFakeRenderer, type FakeDisplay } from '../helpers/fake-renderer';
import { addTriangle, getState } from '../helpers/store';

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

describe('BB-RUN-1: Run needs an object and a callback or an animation', () => {
  it('is off for an empty scene, a scene with nothing to run, or an invalid name', () => {
    expect(canRun(getState())).toBe(false);
    const t = addTriangle();
    expect(canRun(getState())).toBe(false);
    getState().setCallbackHandler('keyboard', 'main');
    expect(canRun(getState())).toBe(false);
    getState().setCallbackHandler('keyboard', 'onKey');
    expect(canRun(getState())).toBe(true);
    getState().clearCallback('keyboard');
    getState().setObjectAnimation(t.id, { motion: 'rotate', speed: 1 });
    expect(canRun(getState())).toBe(true);
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

describe('BB-RUN-7: The program window resizes within its limits and follows the canvas', () => {
  it('clamps, fires Reshape on the next frame, and shrinks with the canvas', () => {
    const { resize } = setup();
    getState().setCallbackHandler('reshape', 'onReshape');
    runController.start({ loop: false });
    runController.resizeWindow(50, 5000);
    runController.stepFrame();
    expect(runController.getSnapshot().window).toEqual({ width: MIN_WINDOW.width, height: 600 });
    expect(runController.getSnapshot().lastCall).toBe('onReshape(200, 600)');
    runController.nudgeWindow(10, -10);
    runController.stepFrame();
    expect(runController.getSnapshot().window).toEqual({ width: 210, height: 590 });
    resize({ width: 640, height: 400 });
    runController.resizeWindow(800, 600);
    runController.stepFrame();
    expect(runController.getSnapshot().window).toEqual({ width: 640, height: 400 });
  });

  it('reapplies its view every frame', () => {
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
