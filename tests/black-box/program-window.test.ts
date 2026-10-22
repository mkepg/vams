/**
 * BLACK-BOX TEST SUITE — BB-WINDOW
 * The program window: it floats on the stage, moves, resizes, minimises, maximises and closes.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useVamsStore } from '@/core/store';
import ProgramWindow from '@/widgets/canvas/ui/ProgramWindow';
import CanvasWindow from '@/widgets/canvas/ui/CanvasWindow';
import { useProgramWindow } from '@/widgets/canvas/model/program-window-store';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { runController } from '@/features/callbacks';
import { registerFakeRenderer } from '../helpers/fake-renderer';
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

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const STAGE = { width: 1000, height: 600 };
const windowState = () => useProgramWindow.getState();
const code = () =>
  generateCodeFromState(
    { ...useVamsStore.getState(), callbacks: emptyCallbacks() } as never,
    { width: 586, height: 610 },
  );
function mountWindow() {
  const host = mount(h(ProgramWindow, { size: { width: 586, height: 610 } }, h('div', { class: 'canvas-wrapper' })));
  windowState().setStage(STAGE);
  return host;
}
const press = (el: Element, type: string, x: number, y: number) =>
  el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, button: 0, pointerId: 1, bubbles: true }));
const button = (host: HTMLElement, label: string) => host.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
const chip = (host: HTMLElement) => host.querySelector('.canvas-chip') as HTMLButtonElement | null;
const windowEl = (host: HTMLElement) => host.querySelector('.canvas-window') as HTMLElement;

afterEach(() => {
  windowState().reset();
  runController.stop();
});

describe('BB-WINDOW-01: The window starts floating and centred on the stage, shaped to the viewing volume', () => {
  it('fits the stage height inside a 24 px margin, with three real buttons in the bar', async () => {
    const host = mountWindow();
    await settle();
    const el = windowEl(host);
    expect([el.style.left, el.style.top, el.style.width, el.style.height]).toEqual(['238px', '24px', '524px', '552px']);
    const labels = [...host.querySelectorAll('.canvas-window__bar button')].map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(['Minimise', 'Maximise', 'Close']);
    expect(chip(host)).toBeNull();
    unmount(host);
  });
  it('stays centred and refits while unmoved, then keeps its place once moved', async () => {
    const host = mountWindow();
    windowState().setStage({ width: 800, height: 500 });
    await settle();
    expect(windowEl(host).style.width).toBe('424px');
    windowState().moveTo(200, 100);
    windowState().setStage({ width: 600, height: 400 });
    await settle();
    expect(windowState().placedByUser).toBe(true);
    expect(windowEl(host).style.left).toBe('200px');
    expect(windowEl(host).style.width).toBe('424px');
    unmount(host);
  });
  it('gives the plain CanvasWindow no buttons or handles', () => {
    const host = mount(h(CanvasWindow, { size: { width: 1, height: 1 }, running: false }, h('div', {})));
    expect(host.querySelector('.canvas-window__bar button')).toBeNull();
    expect(host.querySelector('.canvas-window__handle')).toBeNull();
    unmount(host);
  });
});

describe('BB-WINDOW-02: Dragging the title bar moves the window and changes no code', () => {
  it('follows the pointer, ignores the buttons, and leaves the generated code as it was', async () => {
    addTriangle();
    const before = code();
    const host = mountWindow();
    await settle();
    const bar = host.querySelector('.canvas-window__bar')!;
    press(bar, 'pointerdown', 300, 40);
    press(bar, 'pointermove', 180, 100);
    press(bar, 'pointerup', 180, 100);
    await settle();
    expect([windowEl(host).style.left, windowEl(host).style.top]).toEqual(['118px', '84px']);
    expect(windowEl(host).style.width).toBe('524px');
    expect(code()).toBe(before);
    press(button(host, 'Minimise'), 'pointerdown', 10, 10);
    press(bar, 'pointermove', 0, 0);
    expect(windowEl(host).style.left).toBe('118px');
    unmount(host);
  });
  it('keeps the title bar reachable', async () => {
    const host = mountWindow();
    await settle();
    const bar = host.querySelector('.canvas-window__bar')!;
    press(bar, 'pointerdown', 300, 40);
    press(bar, 'pointermove', 9000, -900);
    press(bar, 'pointerup', 9000, -900);
    expect([windowState().rect!.x, windowState().rect!.y]).toEqual([920, 0]);
    unmount(host);
  });
});

describe('BB-WINDOW-03: Dragging an edge or the corner resizes the window', () => {
  it('sets the size from the corner and the right edge, and stops at the minimum', async () => {
    const host = mountWindow();
    await settle();
    windowState().resizeTo({ x: 24, y: 24, width: 600, height: 400 });
    await settle();
    const corner = host.querySelector('.canvas-window__handle--se')!;
    press(corner, 'pointerdown', 600, 400);
    press(corner, 'pointermove', 500, 350);
    await settle();
    expect([windowEl(host).style.width, windowEl(host).style.height]).toEqual(['500px', '350px']);
    press(corner, 'pointermove', -9000, -9000);
    press(corner, 'pointerup', -9000, -9000);
    await settle();
    expect([windowEl(host).style.width, windowEl(host).style.height]).toEqual(['242px', '210px']);
    expect(windowState().placedByUser).toBe(true);
    const east = host.querySelector('.canvas-window__handle--e')!;
    press(east, 'pointerdown', 0, 0);
    press(east, 'pointermove', 100, 50);
    press(east, 'pointerup', 100, 50);
    await settle();
    expect([windowEl(host).style.width, windowEl(host).style.height]).toEqual(['342px', '210px']);
    unmount(host);
  });
});

describe('BB-WINDOW-04: Minimise and Maximise act like a real window', () => {
  it('minimise hides the window by visibility and shows a chip that restores it', async () => {
    const host = mountWindow();
    await settle();
    button(host, 'Minimise').click();
    await settle();
    expect(windowEl(host).classList.contains('canvas-window--away')).toBe(true);
    expect(host.querySelector('.canvas-wrapper')).not.toBeNull();
    expect(chip(host)!.textContent).toBe('VAMS Preview');
    chip(host)!.click();
    await settle();
    expect(chip(host)).toBeNull();
    expect(windowEl(host).classList.contains('canvas-window--away')).toBe(false);
    expect(windowEl(host).style.left).toBe('238px');
    unmount(host);
  });
  it('maximise fills the stage, flips its label to Restore, and restores the floating window', async () => {
    const host = mountWindow();
    await settle();
    button(host, 'Maximise').click();
    await settle();
    expect(windowEl(host).classList.contains('canvas-window--maximised')).toBe(true);
    expect(button(host, 'Maximise')).toBeNull();
    button(host, 'Restore').click();
    await settle();
    expect(windowEl(host).classList.contains('canvas-window--maximised')).toBe(false);
    expect(button(host, 'Maximise')).not.toBeNull();
    expect(windowEl(host).style.width).toBe('524px');
    unmount(host);
  });
  it('double-clicking the title bar toggles maximise, but not on a button; a maximised window does not drag', async () => {
    const host = mountWindow();
    await settle();
    const bar = host.querySelector('.canvas-window__bar')!;
    bar.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await settle();
    expect(windowState().mode).toBe('maximised');
    press(bar, 'pointerdown', 300, 40);
    press(bar, 'pointermove', 100, 100);
    expect(windowState().rect).toEqual({ x: 238, y: 24, width: 524, height: 552 });
    button(host, 'Restore').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await settle();
    expect(windowState().mode).toBe('maximised');
    bar.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await settle();
    expect(windowState().mode).toBe('floating');
    unmount(host);
  });
  it('a window minimised from full size comes back full size', async () => {
    const host = mountWindow();
    await settle();
    button(host, 'Maximise').click();
    await settle();
    button(host, 'Minimise').click();
    await settle();
    chip(host)!.click();
    await settle();
    expect(windowState().mode).toBe('maximised');
    unmount(host);
  });
});

describe('BB-WINDOW-05: Close stops Run, and the chip reopens the window', () => {
  it('stops a running program, keeps the scene and offers Open VAMS Preview', async () => {
    addTriangle();
    useVamsStore.getState().setCallbackHandler('keyboard', 'onKey');
    const unregister = registerFakeRenderer(new Map(), { getCanvasSize: () => ({ width: 800, height: 600 }) });
    const host = mountWindow();
    await settle();
    expect(runController.start({ loop: false })).toBe(true);
    await settle();
    expect(host.querySelector('.canvas-window__running')).not.toBeNull();
    button(host, 'Close').click();
    await settle();
    expect(runController.getSnapshot().running).toBe(false);
    expect(useVamsStore.getState().objects.length).toBe(1);
    expect(windowEl(host).classList.contains('canvas-window--away')).toBe(true);
    expect(chip(host)!.textContent).toBe('Open VAMS Preview');
    await frame();
    expect(document.activeElement).toBe(chip(host));
    chip(host)!.click();
    await settle();
    expect(chip(host)).toBeNull();
    expect(windowState().mode).toBe('floating');
    unmount(host);
    unregister();
  });
});

describe('BB-WINDOW-06: Run brings back a minimised or closed window', () => {
  it.each(['Minimise', 'Close'])('after %s, starting the program shows the window again', async (label) => {
    addTriangle();
    useVamsStore.getState().setCallbackHandler('keyboard', 'onKey');
    const unregister = registerFakeRenderer(new Map(), { getCanvasSize: () => ({ width: 800, height: 600 }) });
    const host = mountWindow();
    await settle();
    button(host, label).click();
    await settle();
    expect(windowState().mode).not.toBe('floating');
    expect(runController.start({ loop: false })).toBe(true);
    await settle();
    expect(windowState().mode).toBe('floating');
    expect(chip(host)).toBeNull();
    unmount(host);
    unregister();
  });
});

describe('BB-WINDOW-07: The chip takes focus only after the student hides the window', () => {
  it('does not take focus on mount while the window is already hidden', async () => {
    windowState().close();
    const host = mountWindow();
    await settle();
    await frame();
    expect(document.activeElement).not.toBe(chip(host));
    unmount(host);
  });
  it('does not take focus when a run ends while the window is minimised', async () => {
    addTriangle();
    useVamsStore.getState().setCallbackHandler('keyboard', 'onKey');
    const unregister = registerFakeRenderer(new Map(), { getCanvasSize: () => ({ width: 800, height: 600 }) });
    const host = mountWindow();
    await settle();
    button(host, 'Minimise').click();
    await settle();
    await frame();
    expect(document.activeElement).toBe(chip(host));
    (document.activeElement as HTMLElement).blur();
    expect(runController.start({ loop: false })).toBe(true);
    await settle();
    runController.stop();
    await settle();
    await frame();
    expect(document.activeElement).not.toBe(chip(host));
    unmount(host);
    unregister();
  });
});

describe('BB-WINDOW-08: A lesson, a swapped scene or vertex placement brings the window back', () => {
  const hide = async (host: HTMLElement) => {
    button(host, 'Close').click();
    await settle();
    expect(windowState().mode).toBe('closed');
  };
  afterEach(() => {
    useVamsStore.setState({ interactionMode: 'SELECT', activeLessonId: null });
  });
  it.each([
    ['a lesson starts', () => useVamsStore.setState({ activeLessonId: 'transforms-demo-1' })],
    ['a scene is swapped in', () => useVamsStore.getState().markSceneSwap()],
    ['vertex placement starts', () => useVamsStore.setState({ interactionMode: 'VERTEX_PLACE' })],
  ])('shows a closed window when %s, where it was', async (_label, act) => {
    const host = mountWindow();
    await settle();
    const rect = { ...windowState().rect! };
    await hide(host);
    act();
    await settle();
    expect(windowState().mode).toBe('floating');
    expect(windowState().rect).toEqual(rect);
    expect(chip(host)).toBeNull();
    unmount(host);
  });
  it('shows a minimised window too', async () => {
    const host = mountWindow();
    await settle();
    button(host, 'Minimise').click();
    await settle();
    useVamsStore.getState().markSceneSwap();
    await settle();
    expect(windowState().mode).toBe('floating');
    unmount(host);
  });
});
