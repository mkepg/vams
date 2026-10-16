/**
 * BLACK-BOX TEST SUITE — BB-CANVAS
 * The canvas column: its header, the stage and the program's window.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useVamsStore } from '@/core/store';
import CanvasHeader from '@/widgets/canvas/ui/CanvasHeader';
import CanvasWindow from '@/widgets/canvas/ui/CanvasWindow';
import { CanvasOverlays } from '@/widgets/canvas/ui/CanvasOverlays';
import { PROGRAM_WINDOW_TITLE } from '@/shared/lib/program-window';
import { useCanvasSize } from '@/shared/lib/use-canvas-size';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { runController } from '@/features/callbacks';
import { registerFakeRenderer } from '../helpers/fake-renderer';
import { useCanvasInteraction } from '@/features/scene-interaction/model/useCanvasInteraction';
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

afterEach(() => {
  vi.unstubAllGlobals();
  useVamsStore.setState({ interactionMode: 'SELECT', showCoordinateTracker: false, cursorWorld: null, viewportLimits: { minX: -1, maxX: 1, minY: -1, maxY: 1 } });
});

describe('BB-CANVAS-01: The header names the viewing volume on both axes', () => {
  it('reads x and y ranges with true minus signs', async () => {
    useVamsStore.setState({ viewportLimits: { minX: -2, maxX: 2, minY: -1.5, maxY: 1.5 } });
    const host = mount(h(CanvasHeader, {}));
    await settle();
    expect(host.querySelector('.canvas-header__title')!.textContent).toBe('Canvas');
    expect(host.querySelector('.canvas-header__volume')!.textContent).toBe('x −2…2 · y −1.5…1.5');
    unmount(host);
  });
});

describe('BB-CANVAS-02: The cursor readout shows only with the tracker on', () => {
  it('reads X and Y from the store', async () => {
    useVamsStore.setState({ cursorWorld: { x: 0.42, y: -0.18 } });
    const host = mount(h(CanvasHeader, {}));
    await settle();
    expect(host.querySelector('.canvas-header__cursor')).toBeNull();
    useVamsStore.setState({ showCoordinateTracker: true });
    await settle();
    expect(host.querySelector('.canvas-header__cursor')!.textContent).toBe('X 0.42  Y −0.18');
    unmount(host);
  });
});

describe('BB-CANVAS-03: Placing vertices puts the keys in the header', () => {
  it('replaces the floating banner', async () => {
    const host = mount(h(CanvasHeader, {}));
    useVamsStore.setState({ interactionMode: 'VERTEX_PLACE' });
    await settle();
    const hint = host.querySelector('.canvas-header__hint')!;
    expect(hint.textContent).toBe('Click to place · Enter finish · Backspace undo · Esc cancel');
    expect([...hint.querySelectorAll('kbd')].map((k) => k.textContent)).toEqual(['Enter', 'Backspace', 'Esc']);
    expect(host.querySelector('.canvas-header__volume')).toBeNull();
    expect(hint.getAttribute('title')).toBe('Click to place · Enter finish · Backspace undo · Esc cancel');
    unmount(host);
  });
});

function SizeProbe() {
  const s = useCanvasSize();
  return h('output', {}, `${s.width}x${s.height}`);
}

describe('BB-CANVAS-04: The window title bar reads what the program sets', () => {
  it('shows the glutCreateWindow title and the glutInitWindowSize size', async () => {
    const host = mount(h(CanvasWindow, { size: { width: 586, height: 610 }, running: false }, h('div', { class: 'scene' })));
    await settle();
    expect(host.querySelector('.canvas-window__title')!.textContent).toBe(PROGRAM_WINDOW_TITLE);
    expect(host.querySelector('.canvas-window__size')!.textContent).toBe('586 × 610');
    expect(host.querySelector('.canvas-window__running')).toBeNull();
    const code = generateCodeFromState(
      { objects: [], canvasBackgroundColor: '#000000', callbacks: emptyCallbacks(), viewportLimits: { minX: -1, maxX: 1, minY: -1, maxY: 1 }, textures: [] },
      { width: 586, height: 610 },
    );
    expect(code).toContain(`glutCreateWindow("${PROGRAM_WINDOW_TITLE}")`);
    expect(code).toContain('glutInitWindowSize(586, 610)');
    render(h(CanvasWindow, { size: { width: 586, height: 610 }, running: true }, h('div', {})), host);
    await settle();
    expect(host.querySelector('.canvas-window__running')!.textContent).toBe('running');
    unmount(host);
  });

  it('keeps the last real canvas size when a read comes back 0 by 0', async () => {
    let fire: () => void = () => {};
    const wrapper = document.createElement('div');
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: (entries: { target: Element }[]) => void) { fire = () => cb([{ target: wrapper }]); }
      observe() {}
      disconnect() {}
    });
    wrapper.className = 'canvas-wrapper';
    let w = 586;
    let tall = 610;
    Object.defineProperty(wrapper, 'clientWidth', { get: () => w });
    Object.defineProperty(wrapper, 'clientHeight', { get: () => tall });
    document.body.appendChild(wrapper);
    const host = mount(h(SizeProbe, {}));
    await settle();
    expect(host.querySelector('output')!.textContent).toBe('586x610');
    w = 0;
    tall = 0;
    fire();
    await settle();
    expect(host.querySelector('output')!.textContent).toBe('586x610');
    w = 0;
    tall = 400;
    fire();
    await settle();
    expect(host.querySelector('output')!.textContent).toBe('586x610');
    w = 586;
    tall = 0;
    fire();
    await settle();
    expect(host.querySelector('output')!.textContent).toBe('586x610');
    w = 700;
    tall = 400;
    fire();
    await settle();
    expect(host.querySelector('output')!.textContent).toBe('700x400');
    unmount(host);
    wrapper.remove();
  });
});

describe('BB-CANVAS-05: Nothing floats over the scene but the empty card', () => {
  it('has no viewport plate, tracker or banner, and the card keeps its text', async () => {
    const host = mount(h(CanvasOverlays, { showEmptyHint: true }));
    await settle();
    expect(host.querySelector('.viewport-info, .coordinate-tracker, .placement-mode-banner')).toBeNull();
    const card = host.querySelector('.empty-canvas-hint')!;
    expect(card.querySelector('p')!.textContent).toBe('Your scene is empty.');
    unmount(host);
  });
});

describe('BB-CANVAS-06: Run sits in the header and turns into Stop', () => {
  it('shows Run, then Stop while running', async () => {
    addTriangle();
    useVamsStore.getState().setCallbackHandler('keyboard', 'onKey');
    const unregister = registerFakeRenderer(new Map(), { getCanvasSize: () => ({ width: 800, height: 600 }) });
    const host = mount(h(CanvasHeader, {}));
    await settle();
    expect(host.querySelector('.run-button')).not.toBeNull();
    expect(host.querySelector('.run-stop')).toBeNull();
    expect(runController.start({ loop: false })).toBe(true);
    await settle();
    const stop = host.querySelector('.run-stop') as HTMLButtonElement;
    expect(stop.textContent).toContain('Stop');
    expect(host.querySelector('.run-button')).toBeNull();
    stop.click();
    await settle();
    expect(runController.getSnapshot().running).toBe(false);
    expect(host.querySelector('.run-button')).not.toBeNull();
    unmount(host);
    unregister();
  });
});

function InteractionProbe({ readOnly, on }: { readOnly: boolean; on: (event: string) => void }) {
  const stage = { eventMode: 'none', on: (e: string) => on(e), off: () => {}, hitArea: null as unknown };
  const app = { current: { stage, screen: { width: 100, height: 100 } } };
  useCanvasInteraction({
    pixiReady: true,
    appRef: app as never,
    worldRef: { current: null },
    canvasRef: { current: null },
    readOnly,
  });
  return null;
}

describe('BB-CANVAS-07: A read-only canvas takes no pointer or key input', () => {
  it('ignores Escape, Enter and stage pointerdown while placing, where an editable one reacts', async () => {
    const key = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    const prepare = () => useVamsStore.setState({ interactionMode: 'VERTEX_PLACE', pendingShapeType: 'GL_TRIANGLES', pendingMinVertices: 3, pendingVertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] } as never);
    prepare();
    const before = useVamsStore.getState().objects.length;
    const bound = vi.fn();
    let host = mount(h(InteractionProbe, { readOnly: true, on: bound }));
    await settle();
    key('Enter');
    key('Escape');
    expect(bound).not.toHaveBeenCalled();
    expect(useVamsStore.getState().objects.length).toBe(before);
    expect(useVamsStore.getState().interactionMode).toBe('VERTEX_PLACE');
    unmount(host);
    const editableBound = vi.fn();
    host = mount(h(InteractionProbe, { readOnly: false, on: editableBound }));
    await settle();
    expect(editableBound).toHaveBeenCalledWith('pointerdown');
    key('Enter');
    expect(useVamsStore.getState().objects.length).toBe(before + 1);
    unmount(host);
    useVamsStore.getState().cancelCustomShape();
  });
});

describe('BB-CANVAS-08: The viewport refits as soon as the canvas box changes size', () => {
  it('resizes the renderer before fitting, so a hidden panel never leaves the scene drawn for the old size', async () => {
    const screen = { width: 100, height: 100 };
    const position = { x: 0, y: 0 };
    const stage = { eventMode: 'none', on: () => {}, off: () => {}, hitArea: null as unknown };
    // PixiJS only queues its own resize; app.resize() applies the new size at once.
    const app = { current: { stage, screen, resize: () => Object.assign(screen, { width: 300, height: 200 }) } };
    const world = { current: { scale: { set: () => {} }, position: { set: (x: number, y: number) => Object.assign(position, { x, y }) } } };
    function ResizeProbe() {
      useCanvasInteraction({ pixiReady: true, appRef: app as never, worldRef: world as never, canvasRef: { current: null }, readOnly: true });
      return null;
    }
    useVamsStore.setState({ viewportLimits: { minX: -1, maxX: 1, minY: -1, maxY: 1 } } as never);
    const host = mount(h(ResizeProbe, {}));
    await settle();
    window.dispatchEvent(new Event('resize'));
    // The origin sits at the centre of the new 300 × 200 box.
    expect(position).toEqual({ x: 150, y: 100 });
    unmount(host);
  });
});
