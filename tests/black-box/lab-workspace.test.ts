/**
 * BLACK-BOX TEST SUITE — BB-LAB (the workspace, the stage and the program window)
 * Test focus:
 *  - The program's window opens at the size and place the program asks for, scaled down only to fit
 *  - The title bar drags it and shows the program's title; the grip resizes it and sends a reshape
 *  - ✕ ends the worker, Run starts a fresh one, and the worker is served where the isolation headers are
 *  - Keys and the mouse reach the program only from its window, in its pixels, and releases always arrive
 *  - The right-click menu is a DOM menu the keyboard can work
 *  - Marey's split: two handles that move by keyboard and pointer, and a stacked layout below 760 px
 *  - The Console's input line
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h, hydrate, render } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { act } from 'preact/test-utils';
import { EditorView } from '@codemirror/view';
import { EDITOR_HINT, LabWorkspace, runChip } from '@/widgets/lab-workspace';
import LabTopBar from '@/widgets/lab-workspace/ui/LabTopBar';
import { useLabStore } from '@/entities/lab-project';
import { useLabStage } from '@/widgets/lab-workspace/model/stage-store';
import { HIDDEN_READ_MS, runController, useLabRun, type WorkerLike } from '@/features/lab-run';
import type { StartMessage, WorkerMessage } from '@/features/lab-run/model/protocol';
import {
  CONTROL,
  EVENT_SLOTS,
  INPUT_STATE,
  inputWaiting,
  openLayout,
  postEvent,
  putOutput,
  takeEvents,
  takeInput,
  type LabEvent,
  type LayoutViews,
} from '@/features/lab-run/model/shared-layout';
import type { CompileOptions, CompileResult } from '@/features/lab-compile';
import { LAB_MESSAGES, setCompilerEnv, useCompiler } from '@/features/lab-compile';
import { NOTICE_KEY } from '@/widgets/lab-workspace/ui/CompilerNotice';
import { LAB_WORKER_OUTPUT, isLabWorkerFile, labDevServer } from '../../scripts/lab/vite-lab-dev';
import { readFileSync } from 'node:fs';
import { PassThrough } from 'node:stream';

class FakeWorker implements WorkerLike {
  started: StartMessage | null = null;
  terminated = false;
  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  private opened: LayoutViews | null = null;
  postMessage(message: StartMessage) {
    this.started = message;
  }
  terminate() {
    this.terminated = true;
  }
  emit(message: WorkerMessage) {
    act(() => this.onmessage?.({ data: message } as MessageEvent<WorkerMessage>));
  }
  /** The worker's own view of the shared memory. */
  get views(): LayoutViews {
    this.opened ??= openLayout(this.started!.shared);
    return this.opened;
  }
  events(): LabEvent[] {
    return takeEvents(this.views);
  }
}

const MODULE = () => new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]).buffer;
const ok = (): CompileResult => ({ kind: 'ok', module: MODULE(), diagnostics: [] });

let workers: FakeWorker[] = [];
const hosts: HTMLElement[] = [];
const worker = () => workers[workers.length - 1];

beforeEach(() => {
  workers = [];
  runController.setWorkerFactory(() => {
    const w = new FakeWorker();
    workers.push(w);
    return w;
  });
  useLabStage.getState().reset();
  setCompilerEnv({ caches: () => undefined });
  localStorage.removeItem(NOTICE_KEY);
});

afterEach(() => {
  for (const host of hosts.splice(0)) {
    act(() => render(null, host));
    host.remove();
  }
  runController.reset();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, 'matchMedia');
});

const flush = async () => {
  for (let i = 0; i < 5; i++) await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
};

function mount(compile: (source: string, options?: CompileOptions) => Promise<CompileResult> = async () => ok(), download: () => void = () => {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  hosts.push(host);
  act(() => render(h(LabWorkspace, { compile, download }), host));
  return host;
}

const runButton = (host: HTMLElement) => [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Run'))!;

async function run(host: HTMLElement) {
  await act(() => runButton(host).click());
  await flush();
  return worker();
}

/** A compile that finds one error: it fills the log, which opens with its handle. */
const oneError = async (): Promise<CompileResult> => ({ kind: 'errors', diagnostics: [{ file: 'main.cpp', line: 1, col: 1, severity: 'error', message: 'expected ;' }] });

const DEMO = { type: 'window', title: 'Demo', width: 500, height: 500, x: 50, y: 40 } as const;

async function runWithWindow(host: HTMLElement, message: WorkerMessage = DEMO) {
  const w = await run(host);
  w.emit(message);
  return w;
}

const windowEl = (host: HTMLElement) => host.querySelector('.canvas-window') as HTMLElement;
const surface = (host: HTMLElement) => host.querySelector('.lab-stage__surface') as HTMLElement;
const px = (value: string) => Number.parseFloat(value);
const setStage = (width: number, height: number) => act(() => useLabStage.getState().setStage({ width, height }));
const pointer = (el: Element, type: string, x: number, y: number, button = 0, buttons = 1) =>
  act(() => {
    el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, button, buttons, pointerId: 1, bubbles: true }));
  });
const key = (el: Element, type: 'keydown' | 'keyup', k: string, code = '', extra: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent(type, { key: k, code, bubbles: true, cancelable: true, ...extra });
  act(() => {
    el.dispatchEvent(event);
  });
  return event;
};
/** The log's fold as the Lab's browser save holds it. */
const storedFold = () => (JSON.parse(localStorage.getItem('vams-lab') ?? '{}') as { state?: { log?: { folded?: boolean } } }).state?.log?.folded;
const rectOf = (el: Element, left: number, top: number, width: number, height: number) =>
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect);

describe('BB-LAB-43: The window opens at the size and place the program asks for', () => {
  it('opens at glutInitWindowSize and glutInitWindowPosition on a stage with room', async () => {
    setStage(1200, 800);
    const host = mount();
    await runWithWindow(host);
    const el = windowEl(host);
    expect(px(el.style.left)).toBe(50);
    expect(px(el.style.top)).toBe(40);
    // The frame's border on each side, and the title bar.
    expect(px(el.style.width)).toBe(502);
    expect(px(el.style.height)).toBe(530);
    const canvas = el.querySelector('canvas')!;
    expect(canvas.width).toBe(500);
    expect(canvas.height).toBe(500);
    expect(el.querySelector('.canvas-window__size')!.textContent).toBe('500 × 500');
  });

  it('never scales a window up, and centres one the program does not place', async () => {
    setStage(1200, 800);
    const host = mount();
    await runWithWindow(host, { type: 'window', title: 'Small', width: 200, height: 100, x: -1, y: -1 });
    const el = windowEl(host);
    expect(px(el.style.width)).toBe(202);
    expect(px(el.style.height)).toBe(130);
    expect(px(el.style.left)).toBe(Math.round((1200 - 202) / 2));
    expect(px(el.style.top)).toBe(Math.round((800 - 130) / 2));
  });

  it('scales down to fit a smaller stage, keeping the shape, and back up when the stage grows', async () => {
    setStage(400, 300);
    const host = mount();
    await runWithWindow(host, { type: 'window', title: 'Wide', width: 800, height: 400, x: 0, y: 0 });
    const el = windowEl(host);
    const bodyW = px(el.style.width) - 2;
    const bodyH = px(el.style.height) - 30;
    expect(px(el.style.width)).toBeLessThanOrEqual(400);
    expect(px(el.style.height)).toBeLessThanOrEqual(300);
    expect(Math.abs(bodyW / bodyH - 2)).toBeLessThan(0.02);
    // The program still has the window it asked for.
    expect(el.querySelector('canvas')!.width).toBe(800);
    expect(useLabRun.getState().window).toMatchObject({ width: 800, height: 400 });
    setStage(1600, 1000);
    expect(px(windowEl(host).style.width)).toBe(802);
  });
});

describe('BB-LAB-44: The title bar drags the window and shows the program title', () => {
  it('moves with the bar and shows glutCreateWindow and glutSetWindowTitle text', async () => {
    setStage(1200, 800);
    const host = mount();
    const w = await runWithWindow(host);
    const bar = host.querySelector('.canvas-window__bar')!;
    expect(host.querySelector('.canvas-window__title')!.textContent).toBe('Demo');
    pointer(bar, 'pointerdown', 100, 100);
    pointer(bar, 'pointermove', 160, 130);
    pointer(bar, 'pointerup', 160, 130);
    expect(px(windowEl(host).style.left)).toBe(110);
    expect(px(windowEl(host).style.top)).toBe(70);
    // Moving the window is the window system's business: the program hears nothing.
    expect(w.events()).toEqual([]);
    w.emit({ type: 'title', title: 'Score: 3' });
    expect(host.querySelector('.canvas-window__title')!.textContent).toBe('Score: 3');
  });

  it('keeps the bar on the stage', async () => {
    setStage(1200, 800);
    const host = mount();
    await runWithWindow(host);
    const bar = host.querySelector('.canvas-window__bar')!;
    pointer(bar, 'pointerdown', 100, 100);
    pointer(bar, 'pointermove', 100, -400);
    pointer(bar, 'pointerup', 100, -400);
    expect(px(windowEl(host).style.top)).toBe(0);
  });
});

describe('BB-LAB-45: The grip resizes the window and the program gets a reshape', () => {
  it('posts the new size as a reshape, and the window shows it', async () => {
    setStage(1200, 800);
    const host = mount();
    const w = await runWithWindow(host);
    const grip = host.querySelector('.canvas-window__handle--se')!;
    pointer(grip, 'pointerdown', 600, 600);
    pointer(grip, 'pointermove', 650, 620);
    pointer(grip, 'pointerup', 650, 620);
    expect(w.events()).toEqual([{ kind: 'reshape', width: 550, height: 520 }]);
    expect(useLabRun.getState().window).toMatchObject({ width: 550, height: 520 });
    expect(px(windowEl(host).style.width)).toBe(552);
    expect(px(windowEl(host).style.height)).toBe(550);
  });

  it('sends a reshape for glutReshapeWindow and fills the stage for glutFullScreen', async () => {
    setStage(1200, 800);
    const host = mount();
    const w = await runWithWindow(host);
    w.emit({ ...DEMO, width: 320, height: 240 });
    expect(w.events()).toEqual([{ kind: 'reshape', width: 320, height: 240 }]);
    w.emit({ type: 'fullscreen' });
    expect(w.events()).toEqual([{ kind: 'reshape', width: 1198, height: 770 }]);
    expect(px(windowEl(host).style.width)).toBe(1200);
    expect(px(windowEl(host).style.height)).toBe(800);
  });
});

describe('BB-LAB-46: ✕ ends the program, and Run starts a fresh worker', () => {
  it('terminates the worker on ✕ and starts a new one on Run', async () => {
    setStage(1200, 800);
    const compile = vi.fn(async () => ok());
    const host = mount(compile);
    const first = await runWithWindow(host);
    expect(first.started!.type).toBe('start');
    expect(useLabRun.getState().status).toBe('running');
    await act(() => (host.querySelector('.canvas-window button[aria-label="Close"]') as HTMLButtonElement).click());
    expect(first.terminated).toBe(true);
    expect(useLabRun.getState().status).toBe('idle');
    expect(windowEl(host)).toBeNull();
    const second = await run(host);
    expect(compile).toHaveBeenCalledTimes(2);
    expect(second).not.toBe(first);
    expect(second.started!.shared.buffer).not.toBe(first.started!.shared.buffer);
    expect(useLabRun.getState().status).toBe('running');
  });

  it('shows how the program ended, and keeps the Console', async () => {
    const host = mount();
    const w = await run(host);
    w.emit({ type: 'exit', code: 3 });
    expect(w.terminated).toBe(true);
    expect(useLabRun.getState()).toMatchObject({ status: 'exited', exitCode: 3 });
    expect(host.querySelector('.lab-top-bar__status')!.textContent).toContain('exit code 3');
    const again = await run(host);
    again.emit({ type: 'crash', message: 'unreachable' });
    expect(useLabRun.getState().status).toBe('crashed');
    expect(host.querySelector('.lab-log__console')!.textContent).toContain('The program stopped: unreachable');
  });

  it('puts each compile result in Run’s status and message, with the spec’s words', async () => {
    const results: CompileResult[] = [
      { kind: 'offline' },
      { kind: 'download' },
      { kind: 'failed' },
      { kind: 'errors', diagnostics: [{ file: 'main.cpp', line: 2, col: 1, severity: 'error', message: 'expected ;' }] },
    ];
    const host = mount(async () => results.shift()!);
    for (const expected of [LAB_MESSAGES.offline, LAB_MESSAGES.download, LAB_MESSAGES.failed]) {
      await run(host);
      expect(useLabRun.getState().status).toBe('idle');
      expect(host.querySelector('.lab-log__message')!.textContent).toBe(expected);
    }
    await run(host);
    expect(useLabRun.getState().status).toBe('idle');
    expect(host.querySelector('.lab-top-bar__status')!.textContent).toContain('main.cpp · 1 error');
    expect(workers).toHaveLength(0);
  });

  it('says Run is downloading the compiler while it does, then compiling, then runs', async () => {
    let finish!: (r: CompileResult) => void;
    const host = mount(
      () =>
        new Promise<CompileResult>((resolve) => {
          useCompiler.setState({ state: 'downloading', received: 1, total: 2 });
          finish = resolve;
        }),
    );
    await act(() => runButton(host).click());
    await flush();
    expect(useLabRun.getState().status).toBe('downloading');
    expect(host.querySelector('.lab-top-bar__status')!.textContent).toContain('Downloading the compiler…');
    expect(host.querySelector('.lab-stage__message')!.textContent).toBe('Downloading the compiler…');
    await act(() => useCompiler.setState({ state: 'ready' }));
    expect(useLabRun.getState().status).toBe('compiling');
    finish(ok());
    await flush();
    expect(useLabRun.getState().status).toBe('running');
    expect(host.querySelector('.lab-log__message')).toBeNull();
  });

  it('emits the worker under lab/, and the dev server isolates the worker script', async () => {
    expect(LAB_WORKER_OUTPUT.entryFileNames({ name: 'lab-worker' }).startsWith('lab/')).toBe(true);
    expect(LAB_WORKER_OUTPUT.entryFileNames({ name: 'lab-compiler' }).startsWith('lab/')).toBe(true);
    expect(readFileSync('vite.config.ts', 'utf8')).toMatch(/worker:\s*\{[^}]*output:\s*LAB_WORKER_OUTPUT/);
    const plugin = labDevServer('.');
    let handler!: (req: unknown, res: unknown, next: () => void) => void;
    (plugin.configureServer as (server: unknown) => void)({ middlewares: { use: (fn: typeof handler) => (handler = fn) } });
    const headers: Record<string, string> = {};
    const res = Object.assign(new PassThrough(), { statusCode: 200, setHeader: (n: string, v: string) => void (headers[n.toLowerCase()] = v) });
    let passed = false;
    handler({ url: '/src/features/lab-run/worker/lab-worker.ts?worker_file&type=module', method: 'GET', headers: { 'sec-fetch-dest': 'worker' } }, res, () => {
      passed = true;
    });
    expect(passed).toBe(true);
    expect(headers['cross-origin-embedder-policy']).toBe('require-corp');
  });
});

describe('BB-LAB-47: Keys and the mouse reach the program only from its window', () => {
  it('sends keys while the window has focus, and none from anywhere else', async () => {
    setStage(1200, 800);
    const host = mount();
    const w = await runWithWindow(host);
    key(document.body, 'keydown', 'a', 'KeyA');
    expect(w.events()).toEqual([]);
    const s = surface(host);
    act(() => s.focus());
    expect(document.activeElement).toBe(s);
    const down = key(s, 'keydown', 'a', 'KeyA');
    key(s, 'keyup', 'a', 'KeyA');
    const arrow = key(s, 'keydown', 'ArrowLeft', 'ArrowLeft', { shiftKey: true });
    key(s, 'keyup', 'ArrowLeft', 'ArrowLeft');
    expect(down.defaultPrevented).toBe(true);
    expect(arrow.defaultPrevented).toBe(true);
    expect(w.events()).toEqual([
      { kind: 'key', key: 97, x: 0, y: 0, modifiers: 0 },
      { kind: 'keyUp', key: 97, x: 0, y: 0, modifiers: 0 },
      { kind: 'special', key: 100, x: 0, y: 0, modifiers: 1 },
      { kind: 'specialUp', key: 100, x: 0, y: 0, modifiers: 0 },
    ]);
    // Tab moves focus on, as everywhere on the page.
    expect(key(s, 'keydown', 'Tab', 'Tab').defaultPrevented).toBe(false);
    expect(w.events()).toEqual([]);
  });

  it('releases a key held when the window loses focus', async () => {
    setStage(1200, 800);
    const host = mount();
    const w = await runWithWindow(host);
    const s = surface(host);
    act(() => s.focus());
    key(s, 'keydown', 'd', 'KeyD');
    act(() => s.blur());
    expect(w.events().map((e) => e.kind)).toEqual(['key', 'keyUp']);
  });

  it('gives mouse positions in window pixels, y down, corrected for the scale', async () => {
    setStage(1200, 800);
    const host = mount();
    const w = await runWithWindow(host);
    rectOf(surface(host), 100, 50, 500, 500);
    pointer(surface(host), 'pointerdown', 110, 70);
    pointer(surface(host), 'pointermove', 120, 90);
    pointer(surface(host), 'pointerup', 120, 90, 0, 0);
    pointer(surface(host), 'pointermove', 130, 95, 0, 0);
    expect(w.events()).toEqual([
      { kind: 'mouse', button: 0, state: 0, x: 10, y: 20, modifiers: 0 },
      { kind: 'motion', x: 20, y: 40 },
      { kind: 'mouse', button: 0, state: 1, x: 20, y: 40, modifiers: 0 },
      { kind: 'passiveMotion', x: 30, y: 45 },
    ]);
    // The same window shown at half size on a small stage.
    setStage(300, 300);
    rectOf(surface(host), 0, 0, 250, 250);
    pointer(surface(host), 'pointerdown', 25, 200);
    expect(w.events()).toEqual([{ kind: 'mouse', button: 0, state: 0, x: 50, y: 400, modifiers: 0 }]);
  });

  it('never drops a release while the ring is full, and keeps only the latest motion', async () => {
    setStage(1200, 800);
    const host = mount();
    const w = await runWithWindow(host);
    // The program is busy and reads nothing: fill the ring.
    for (let i = 0; i < EVENT_SLOTS; i++) expect(postEvent(w.views, { kind: 'entry', state: 1 })).toBe(true);
    const s = surface(host);
    act(() => s.focus());
    key(s, 'keydown', 'w', 'KeyW');
    for (let i = 0; i < 2000; i++) pointer(s, 'pointermove', i % 400, 10, 0, 0);
    key(s, 'keyup', 'w', 'KeyW');
    expect(w.events()).toHaveLength(EVENT_SLOTS);
    act(() => runController.pump());
    const later = w.events();
    expect(later.map((e) => e.kind)).toEqual(['key', 'passiveMotion', 'keyUp']);
  });

  it('tells the student how the keyboard leaves the editor, and Esc then Tab does', async () => {
    const host = mount();
    const content = host.querySelector('.cm-content') as HTMLElement;
    const hint = document.getElementById(content.getAttribute('aria-describedby')!)!;
    expect(hint.textContent).toContain('Esc then Tab');
    expect(hint.textContent).toContain('Ctrl+M');
    const view = EditorView.findFromDOM(host.querySelector('.cm-editor') as HTMLElement)!;
    expect(key(view.contentDOM, 'keydown', 'Tab', 'Tab', { keyCode: 9 } as KeyboardEventInit).defaultPrevented).toBe(true);
    key(view.contentDOM, 'keydown', 'Escape', 'Escape', { keyCode: 27 } as KeyboardEventInit);
    expect(key(view.contentDOM, 'keydown', 'Tab', 'Tab', { keyCode: 9 } as KeyboardEventInit).defaultPrevented).toBe(false);
  });
});

const MENUS: WorkerMessage = {
  type: 'menus',
  tree: [
    { id: 1, entries: [{ label: 'Red', value: 1 }, { label: 'Shapes', submenu: 2 }, { label: 'Quit', value: 9 }] },
    { id: 2, entries: [{ label: 'Square', value: 4 }] },
  ],
  attached: [{ button: 2, menu: 1 }],
};

describe('BB-LAB-48: Right-click opens the attached menu as a DOM menu', () => {
  it('opens on the right button, works by keyboard, and posts the choice', async () => {
    setStage(1200, 800);
    const host = mount();
    const w = await runWithWindow(host);
    w.emit(MENUS);
    rectOf(surface(host), 100, 50, 500, 500);
    pointer(surface(host), 'pointerdown', 150, 100, 2, 2);
    const menu = host.querySelector('[role="menu"]') as HTMLElement;
    expect(menu).not.toBeNull();
    const items = [...menu.querySelectorAll('[role="menuitem"]')];
    expect(items.map((i) => i.textContent)).toEqual(['Red', 'Shapes', 'Quit']);
    expect(items[1].getAttribute('aria-haspopup')).toBe('menu');
    expect(document.activeElement).toBe(items[0]);
    // A button with a menu opens the menu, not the mouse callback.
    expect(w.events()).toEqual([]);
    key(document.activeElement!, 'keydown', 'ArrowDown');
    expect(document.activeElement!.textContent).toBe('Shapes');
    key(document.activeElement!, 'keydown', 'ArrowRight');
    expect(document.activeElement!.textContent).toBe('Square');
    key(document.activeElement!, 'keydown', 'Enter');
    expect(w.events()).toEqual([{ kind: 'menu', menu: 2, value: 4 }]);
    expect(host.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(surface(host));
  });

  it('opens from the keyboard, closes on Esc, and takes a click', async () => {
    setStage(1200, 800);
    const host = mount();
    const w = await runWithWindow(host);
    w.emit(MENUS);
    const s = surface(host);
    act(() => s.focus());
    key(s, 'keydown', 'F10', 'F10', { shiftKey: true });
    expect(host.querySelector('[role="menu"]')).not.toBeNull();
    key(document.activeElement!, 'keydown', 'Escape');
    expect(host.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(s);
    key(s, 'keydown', 'ContextMenu', 'ContextMenu');
    const quit = [...host.querySelectorAll('[role="menuitem"]')].find((i) => i.textContent === 'Quit') as HTMLElement;
    await act(() => quit.click());
    expect(w.events()).toEqual([{ kind: 'menu', menu: 1, value: 9 }]);
  });

  it('leaves a button without a menu to the mouse callback', async () => {
    setStage(1200, 800);
    const host = mount();
    const w = await runWithWindow(host);
    w.emit(MENUS);
    rectOf(surface(host), 0, 0, 500, 500);
    pointer(surface(host), 'pointerdown', 5, 6, 0, 1);
    expect(host.querySelector('[role="menu"]')).toBeNull();
    expect(w.events()).toEqual([{ kind: 'mouse', button: 0, state: 0, x: 5, y: 6, modifiers: 0 }]);
  });
});

function narrowScreen(narrow: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: narrow && query === '(max-width: 759px)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

const areas = (host: HTMLElement) => (host.querySelector('.lab-workspace__split') as HTMLElement).style.gridTemplateAreas;

describe('BB-LAB-49: Below 760 px the panes stack window, code, log, with no handles', () => {
  it('stacks with no separators on a narrow screen', () => {
    narrowScreen(true);
    const host = mount();
    expect(host.querySelector('.lab-workspace')!.getAttribute('data-layout')).toBe('stacked');
    expect(host.querySelectorAll('[role="separator"]')).toHaveLength(0);
    expect(areas(host).replace(/\s+/g, ' ').trim()).toBe('"stage" "code" "log"');
  });

  it('splits code and log on the left of the stage on a wide screen', async () => {
    narrowScreen(false);
    const host = mount(oneError);
    expect(host.querySelector('.lab-workspace')!.getAttribute('data-layout')).toBe('split');
    // An empty log is only its bar, with no handle to size it; what the compiler says opens it.
    expect(host.querySelectorAll('[role="separator"]')).toHaveLength(1);
    await run(host);
    expect(host.querySelectorAll('[role="separator"]')).toHaveLength(2);
    const rows = areas(host).match(/"[^"]*"/g)!;
    expect(rows[0]).toBe('"code panes stage"');
    expect(rows[rows.length - 1]).toBe('"log panes stage"');
  });
});

describe('BB-LAB-50: The handles resize the panes by keyboard and pointer, within limits', () => {
  const paneHandle = (host: HTMLElement) => host.querySelector('[role="separator"][aria-orientation="vertical"]') as HTMLElement;
  const logHandle = (host: HTMLElement) => host.querySelector('[role="separator"][aria-orientation="horizontal"]') as HTMLElement;
  const now = (el: HTMLElement) => Number(el.getAttribute('aria-valuenow'));

  it('moves by arrow keys, Home and End, and stops at the limits', async () => {
    const host = mount(oneError);
    await run(host);
    const panes = paneHandle(host);
    expect(panes.tabIndex).toBe(0);
    expect(panes.getAttribute('aria-label')).toBeTruthy();
    expect(now(panes)).toBe(52);
    expect(panes.getAttribute('aria-valuemin')).toBe('20');
    expect(panes.getAttribute('aria-valuemax')).toBe('80');
    key(panes, 'keydown', 'ArrowRight');
    expect(now(panes)).toBe(54);
    key(panes, 'keydown', 'ArrowLeft');
    key(panes, 'keydown', 'ArrowLeft');
    expect(now(panes)).toBe(50);
    key(panes, 'keydown', 'End');
    expect(now(panes)).toBe(80);
    key(panes, 'keydown', 'ArrowRight');
    expect(now(panes)).toBe(80);
    key(panes, 'keydown', 'Home');
    expect(now(panes)).toBe(20);
    const log = logHandle(host);
    const before = now(log);
    key(log, 'keydown', 'ArrowDown');
    expect(now(log)).toBe(before + 2);
    key(log, 'keydown', 'ArrowUp', '', { shiftKey: true });
    expect(now(log)).toBe(before - 8);
  });

  it('follows the pointer and stops at the limits', async () => {
    const host = mount(oneError);
    await run(host);
    const split = host.querySelector('.lab-workspace__split') as HTMLElement;
    rectOf(split, 0, 0, 1000, 600);
    const panes = paneHandle(host);
    pointer(panes, 'pointerdown', 520, 300);
    pointer(panes, 'pointermove', 300, 300);
    expect(now(panes)).toBe(30);
    expect(split.style.gridTemplateColumns).toContain('0.3fr');
    pointer(panes, 'pointermove', 990, 300);
    pointer(panes, 'pointerup', 990, 300);
    expect(now(panes)).toBe(80);
    pointer(panes, 'pointermove', 100, 300);
    expect(now(panes)).toBe(80);
    const log = logHandle(host);
    pointer(log, 'pointerdown', 300, 400);
    pointer(log, 'pointermove', 300, 30);
    pointer(log, 'pointerup', 300, 30);
    expect(now(log)).toBe(30);
  });
});

describe('BB-LAB-51: The Console shows an input line only while the program waits', () => {
  it('shows the line while the program reads, and Enter sends it', async () => {
    const host = mount();
    const w = await run(host);
    act(() => runController.pump());
    expect(host.querySelector('.lab-log__input')).toBeNull();
    Atomics.store(w.views.control, CONTROL.INPUT_STATE, INPUT_STATE.LINE);
    act(() => runController.pump());
    expect(useLabRun.getState().status).toBe('waitingInput');
    expect(host.querySelector('#lab-log-tab-console')!.getAttribute('aria-selected')).toBe('true');
    const input = host.querySelector('.lab-log__input input') as HTMLInputElement;
    expect(input).not.toBeNull();
    input.value = 'hello 42';
    act(() => {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    key(input, 'keydown', 'Enter', 'Enter');
    const bytes = takeInput(w.views, inputWaiting(w.views));
    expect(new TextDecoder().decode(bytes)).toBe('hello 42\n');
    expect(host.querySelector('.lab-log__console')!.textContent).toContain('hello 42');
    Atomics.store(w.views.control, CONTROL.INPUT_STATE, INPUT_STATE.NONE);
    act(() => runController.pump());
    expect(host.querySelector('.lab-log__input')).toBeNull();
    expect(useLabRun.getState().status).toBe('running');
  });

  it('sends each key while the program waits for one', async () => {
    const host = mount();
    const w = await run(host);
    Atomics.store(w.views.control, CONTROL.INPUT_STATE, INPUT_STATE.KEY);
    act(() => runController.pump());
    const input = host.querySelector('.lab-log__input input') as HTMLInputElement;
    key(input, 'keydown', 'y', 'KeyY');
    key(input, 'keydown', 'Enter', 'Enter');
    expect([...takeInput(w.views, inputWaiting(w.views))]).toEqual([121, 13]);
  });
});

describe('BB-LAB-71: The prerendered workspace hydrates into the layout the screen needs', () => {
  /** Renders as the prerender does (no matchMedia, no saved fold), then hydrates on this screen. */
  async function hydrateOn(narrow: boolean, folded: boolean) {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: undefined });
    const html = renderToString(h(LabWorkspace, { compile: async () => ok() }));
    narrowScreen(narrow);
    if (folded) useLabStore.getState().setLogFolded(true);
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);
    hosts.push(host);
    act(() => hydrate(h(LabWorkspace, { compile: async () => ok() }), host));
    await flush();
    return host;
  }

  it('stacks a narrow screen after hydration, with no handles and every pane in its place', async () => {
    const host = await hydrateOn(true, false);
    expect(host.querySelector('.lab-workspace')!.getAttribute('data-layout')).toBe('stacked');
    expect(host.querySelectorAll('[role="separator"]')).toHaveLength(0);
    expect(areas(host).replace(/\s+/g, ' ').trim()).toBe('"stage" "code" "log"');
    expect(host.querySelector('.lab-workspace__stage > .lab-stage')).not.toBeNull();
    expect(host.querySelector('.lab-workspace__log > .lab-log')).not.toBeNull();
  });

  it('folds the log after hydration when the last visit left it folded', async () => {
    const host = await hydrateOn(false, true);
    expect(host.querySelector('.lab-log')!.getAttribute('data-folded')).toBe('true');
    expect(host.querySelectorAll('[role="separator"]')).toHaveLength(1);
    expect(host.querySelector('.lab-workspace__log > .lab-log')).not.toBeNull();
  });
});

describe('BB-LAB-72: A compile message or error comes forward after a run that showed the Console', () => {
  const tabSelected = (host: HTMLElement, tab: string) => host.querySelector(`#lab-log-tab-${tab}`)!.getAttribute('aria-selected') === 'true';

  it('shows the offline and failed lines, and the errors, in front of the Console', async () => {
    const results: CompileResult[] = [
      ok(),
      { kind: 'offline' },
      ok(),
      { kind: 'failed' },
      ok(),
      { kind: 'errors', diagnostics: [{ file: 'main.cpp', line: 4, col: 2, severity: 'error', message: 'expected ;' }] },
    ];
    const host = mount(async () => results.shift()!);
    for (const expected of [LAB_MESSAGES.offline, LAB_MESSAGES.failed]) {
      await run(host);
      expect(tabSelected(host, 'console')).toBe(true);
      await run(host);
      expect(tabSelected(host, 'compiler')).toBe(true);
      expect(host.querySelector('.lab-log__message')!.textContent).toBe(expected);
    }
    await run(host);
    expect(tabSelected(host, 'console')).toBe(true);
    await run(host);
    expect(tabSelected(host, 'compiler')).toBe(true);
    expect(host.querySelector('.lab-log__list')!.textContent).toContain('main.cpp:4:2');
  });

  it('unfolds a folded log for the message, and remembers it open', async () => {
    useLabStore.getState().setLogFolded(true);
    const host = mount(async () => ({ kind: 'offline' }));
    await flush();
    expect(host.querySelector('.lab-log')!.getAttribute('data-folded')).toBe('true');
    await run(host);
    expect(host.querySelector('.lab-log')!.getAttribute('data-folded')).toBe('false');
    expect(host.querySelector('.lab-log__message')!.textContent).toBe(LAB_MESSAGES.offline);
    expect(storedFold()).toBe(false);
  });
});

describe('BB-LAB-73: A program with no window can be stopped', () => {
  it('shows Stop while it runs, and Stop ends it as ✕ does', async () => {
    const host = mount();
    const w = await run(host);
    putOutput(w.views, 'stdout', new TextEncoder().encode('tick\n'));
    const stop = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Stop' || b.getAttribute('aria-label') === 'Stop')!;
    expect(stop).toBeDefined();
    await act(() => stop.click());
    expect(w.terminated).toBe(true);
    expect(useLabRun.getState().status).toBe('idle');
    expect(host.querySelector('.lab-log__console')!.textContent).toContain('tick');
    expect([...host.querySelectorAll('button')].some((b) => b.textContent === 'Stop')).toBe(false);
  });
});

describe('BB-LAB-74: Output reaches the Console at exit and while the tab is hidden', () => {
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('reads what the program printed just before exit, a split character included', async () => {
    const host = mount();
    const w = await run(host);
    const bytes = new TextEncoder().encode('last line\nbye é');
    putOutput(w.views, 'stdout', bytes.subarray(0, bytes.length - 1));
    w.emit({ type: 'exit', code: 0 });
    const text = host.querySelector('.lab-log__console')!.textContent!;
    expect(text).toContain('last line');
    expect(text).toContain('bye �');
  });

  it('reads on a timer only while the tab is hidden', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    runController.start(MODULE());
    const w = worker();
    putOutput(w.views, 'stdout', new TextEncoder().encode('while hidden\n'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    vi.advanceTimersByTime(HIDDEN_READ_MS * 3);
    expect(useLabRun.getState().console.lines).toEqual([]);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    vi.advanceTimersByTime(HIDDEN_READ_MS);
    expect(useLabRun.getState().console.lines).toEqual([{ stream: 'stdout', text: 'while hidden' }]);
  });
});

describe('BB-LAB-75: A worker that cannot start says so once', () => {
  it('prints one plain sentence, whether the worker fails to load or to be made', async () => {
    const host = mount();
    const w = await run(host);
    act(() => w.onerror?.(new Event('error')));
    expect(useLabRun.getState().status).toBe('crashed');
    const text = host.querySelector('.lab-log__console')!.textContent!;
    expect(text.trim()).toBe("The program couldn't start.");
    runController.setWorkerFactory(() => {
      throw new Error('no workers here');
    });
    await run(host);
    expect(host.querySelector('.lab-log__console')!.textContent!.trim()).toBe("The program couldn't start.");
  });
});

describe('BB-LAB-76: Bringing the Console forward remembers the log open', () => {
  it('stores the unfolded log when a run unfolds it', async () => {
    useLabStore.getState().setLogFolded(true);
    const host = mount();
    await flush();
    expect(storedFold()).toBe(true);
    const w = await run(host);
    expect(storedFold()).toBe(false);
    // The Console is in front, and opens once the program prints.
    putOutput(w.views, 'stdout', new TextEncoder().encode('hello\n'));
    act(() => runController.pump());
    expect(host.querySelector('.lab-log')!.getAttribute('data-folded')).toBe('false');
  });
});

describe('BB-LAB-77: Only the Lab worker goes under lab/', () => {
  it('names the Lab worker under lab/ and any other worker under assets/, and the Lab-off build drops only the Lab worker', () => {
    expect(LAB_WORKER_OUTPUT.entryFileNames({ name: 'lab-worker' })).toBe('lab/[name]-[hash].js');
    expect(LAB_WORKER_OUTPUT.entryFileNames({ name: 'thumbnail-worker' })).toBe('assets/[name]-[hash].js');
    expect(isLabWorkerFile('lab/lab-worker-DkxZQMY4.js')).toBe(true);
    expect(isLabWorkerFile('assets/thumbnail-worker-1234.js')).toBe(false);
    expect(isLabWorkerFile('lab/index.html')).toBe(false);
  });
});

describe('BB-LAB-94: The notice offers the compiler, shows its download, and goes once it is here', () => {
  const notice = (host: HTMLElement) => host.querySelector('.compiler-notice');
  const button = (host: HTMLElement, text: string) => [...host.querySelectorAll('.compiler-notice button')].find((b) => b.textContent === text || b.getAttribute('aria-label') === text) as HTMLButtonElement | undefined;

  it('offers Download now when the compiler is not in this browser, and asks only the cache', async () => {
    const download = vi.fn();
    const host = mount(undefined, download);
    await flush();
    expect(useCompiler.getState().state).toBe('absent');
    expect(notice(host)!.textContent).toContain('Run uses a compiler that downloads once (about 18 MB).');
    expect(LAB_MESSAGES.notice).toBe('Run uses a compiler that downloads once (about 18 MB).');
    await act(() => button(host, 'Download now')!.click());
    expect(download).toHaveBeenCalledTimes(1);
  });

  it('is dismissed and stays dismissed, but shows the download whenever one runs', async () => {
    const host = mount();
    await flush();
    await act(() => button(host, 'Dismiss')!.click());
    expect(notice(host)).toBeNull();
    expect(localStorage.getItem(NOTICE_KEY)).toBe('dismissed');
    const again = mount();
    await flush();
    expect(notice(again)).toBeNull();
    await act(() => useCompiler.setState({ state: 'downloading', received: 30, total: 60 }));
    const bar = again.querySelector('.compiler-notice [role="progressbar"]')!;
    expect(bar.getAttribute('aria-valuenow')).toBe('9');
    expect(bar.getAttribute('aria-valuemax')).toBe('18');
    expect(notice(again)!.textContent).toContain('Downloading the compiler… 9 of 18 MB');
  });

  it('offers the download again after a failed one, and shows nothing once the compiler is here', async () => {
    const host = mount();
    await flush();
    await act(() => useCompiler.setState({ state: 'failed' }));
    expect(notice(host)!.textContent).toContain("The compiler couldn't download. Your code is saved in this browser. Try Run again.");
    expect(button(host, 'Download now')).toBeTruthy();
    await act(() => useCompiler.setState({ state: 'ready' }));
    expect(notice(host)).toBeNull();
  });
});

describe('BB-LAB-95: Two Runs during the first download compile once, with the newest code', () => {
  it('drops the first Run when the second starts, and runs what the second compiled', async () => {
    const calls: { source: string; signal?: AbortSignal; finish: (r: CompileResult) => void }[] = [];
    const host = mount(
      (source, options) =>
        new Promise<CompileResult>((resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(new DOMException('stopped', 'AbortError')));
          calls.push({ source, signal: options?.signal, finish: resolve });
        }),
    );
    await act(() => runButton(host).click());
    act(() => useLabStore.getState().setSource('int main() { return 2; }'));
    await act(() => runButton(host).click());
    await flush();
    expect(calls).toHaveLength(2);
    expect(calls[0].signal!.aborted).toBe(true);
    expect(calls[1].source).toBe('int main() { return 2; }');
    calls[1].finish(ok());
    await flush();
    expect(workers).toHaveLength(1);
    expect(useLabRun.getState().status).toBe('running');
  });
});

describe('BB-LAB-101: The top bar labels the Lab experimental, beside its name', () => {
  it('shows one Experimental tag straight after the Lab heading', () => {
    const host = document.createElement('div');
    render(h(LabTopBar, { file: 'main.cpp', phase: { label: 'Ready', tone: 'idle' }, onRun: () => {} }), host);
    const tags = host.querySelectorAll('.lab-top-bar__tag');
    expect(tags).toHaveLength(1);
    expect(tags[0].textContent).toBe('Experimental');
    expect(host.querySelector('.lab-top-bar__name')?.nextElementSibling).toBe(tags[0]);
    render(null, host);
  });
});

describe('BB-LAB-108: The log is a slim bar until the compiler or the program has something to say', () => {
  it('starts as its bar, with nothing to unfold, and says what will appear there', () => {
    const host = mount();
    const log = host.querySelector('.lab-log')!;
    expect(log.getAttribute('data-folded')).toBe('true');
    expect(log.getAttribute('data-empty')).toBe('true');
    expect((host.querySelector('.lab-log__fold') as HTMLButtonElement).disabled).toBe(true);
    expect(host.querySelector('#lab-log-body')).toBeNull();
    expect(host.querySelector('.lab-log__idle')!.textContent).toBe("The compiler's messages and your program's output appear here.");
  });

  it('opens for the compiler\'s errors, and the student can fold it again', async () => {
    const host = mount(oneError);
    await run(host);
    const log = host.querySelector('.lab-log')!;
    expect(log.getAttribute('data-folded')).toBe('false');
    expect(host.querySelector('.lab-log__idle')).toBeNull();
    const fold = host.querySelector('.lab-log__fold') as HTMLButtonElement;
    expect(fold.disabled).toBe(false);
    await act(() => fold.click());
    expect(log.getAttribute('data-folded')).toBe('true');
  });

  it('opens when the program asks for input, though it printed nothing', async () => {
    const host = mount();
    const w = await run(host);
    expect(host.querySelector('.lab-log')!.getAttribute('data-folded')).toBe('true');
    Atomics.store(w.views.control, CONTROL.INPUT_STATE, INPUT_STATE.LINE);
    act(() => runController.pump());
    expect(host.querySelector('.lab-log')!.getAttribute('data-folded')).toBe('false');
    expect(host.querySelector('.lab-log__input input')).not.toBeNull();
  });
});

describe('BB-LAB-109: The top bar shows Run\'s state in a coloured chip beside the file', () => {
  const error = [{ file: 'main.cpp', line: 1, col: 1, severity: 'error' as const, message: 'x' }];
  const warning = [{ ...error[0], severity: 'warning' as const }];

  it.each([
    ['idle', undefined, [], 'Ready', 'idle'],
    ['idle', undefined, warning, 'Ready', 'idle'],
    ['idle', undefined, error, 'Errors', 'error'],
    ['compiling', undefined, [], 'Compiling…', 'busy'],
    ['downloading', undefined, [], 'Downloading the compiler…', 'busy'],
    ['running', undefined, [], 'Running', 'running'],
    ['waitingInput', undefined, [], 'Waiting for input in the Console', 'running'],
    ['exited', 3, [], 'Ended with exit code 3', 'ended'],
    ['crashed', undefined, [], 'Stopped on an error', 'error'],
  ] as const)('%s with exit code %s and %j: %s', (status, code, diagnostics, label, tone) => {
    expect(runChip(status, code, diagnostics)).toEqual({ label, tone });
  });

  it('keeps the file and the chip in one status line', async () => {
    const host = mount(oneError);
    await run(host);
    const status = host.querySelector('.lab-top-bar__status')!;
    expect(status.getAttribute('role')).toBe('status');
    expect(status.querySelector('.lab-top-bar__file')!.textContent).toBe('main.cpp · 1 error');
    const chip = status.querySelector('.lab-status')!;
    expect(chip.getAttribute('data-tone')).toBe('error');
    expect(chip.textContent).toBe('Errors');
  });
});

describe('BB-LAB-110: How the keyboard leaves the editor is one button away, and always in its description', () => {
  it('names the hint in the editor\'s description, shows it on the button, and Escape closes it', async () => {
    const host = mount();
    const hint = host.querySelector('#lab-editor-hint')!;
    expect(hint.textContent).toBe(EDITOR_HINT);
    expect(host.querySelector('.cm-content')!.getAttribute('aria-describedby')).toContain('lab-editor-hint');
    const button = host.querySelector('.editor-help__button') as HTMLButtonElement;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe('lab-editor-hint');
    await act(() => button.click());
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('.editor-help')!.getAttribute('data-open')).toBe('true');
    await act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  it('closes on a click elsewhere', async () => {
    const host = mount();
    const button = host.querySelector('.editor-help__button') as HTMLButtonElement;
    await act(() => button.click());
    await act(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('BB-LAB-111: The VAMS LAB lockup reads as the page\'s heading, Lab', () => {
  it('draws LAB for the eye and says Lab to a screen reader', () => {
    const host = mount();
    const heading = host.querySelector('h1.lab-top-bar__name')!;
    expect(heading.querySelector('.lab-top-bar__word')!.getAttribute('aria-hidden')).toBe('true');
    expect(heading.querySelector('.lab-top-bar__word')!.textContent).toBe('LAB');
    expect(heading.querySelector('.lab-top-bar__hidden')!.textContent).toBe('Lab');
    expect(host.querySelector('.lab-top-bar__home')!.getAttribute('aria-label')).toBe('VAMS home');
  });
});
