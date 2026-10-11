import { useVamsStore } from '@/core/store';
import type { VamsState } from '@/core/store/types';
import type { GlutCallbackKind, MouseButton, RuleTrigger, SpecialKey } from '@/core/types/scene';
import { CALLBACK_KINDS, isCallbackValid, programObjects } from '@/core/callbacks/callbacks-model';
import { renderBridge } from '@/shared/engine/render-bridge';
import {
  createRunState, dispatch, runStateColor, stepAnimations, type RunEvent, type RunState,
} from './runtime';

/**
 * The canvas Run state. It owns the event listeners and the frame loop, keeps a temporary
 * run state, and draws it through the render bridge. Like the animation preview, it never
 * calls a scene-state setter: stopping resyncs the canvas from the store, which never changed.
 */
export interface RunFired {
  kind: GlutCallbackKind;
  handlerName: string;
  trigger: RuleTrigger | null;
  seq: number;
}
export interface RunSnapshot {
  running: boolean;
  lastCall: string | null;
  fired: RunFired | null;
  window: { width: number; height: number } | null;
  canvas: { width: number; height: number } | null;
}

export const MIN_WINDOW = { width: 200, height: 150 };
export const RESIZE_STEP = 10;
export const FLASH_MS = 700;
const FALLBACK_CANVAS = { width: 800, height: 600 };
const DEGREES_TO_RADIANS = Math.PI / 180;
const SPECIAL: Record<string, SpecialKey> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const KEYBOARD = /^[a-zA-Z0-9 ]$/;
const BUTTONS: MouseButton[] = ['left', 'middle', 'right'];
const STOPPED: RunSnapshot = { running: false, lastCall: null, fired: null, window: null, canvas: null };

export function canRun(state: Pick<VamsState, 'objects' | 'callbacks'>): boolean {
  if (state.objects.length === 0) return false;
  if (CALLBACK_KINDS.some((k) => isCallbackValid(state.callbacks, k))) return true;
  return programObjects(state.objects).some((o) => o.type !== 'GROUP' && o.type !== 'TEXT' && !!o.animation);
}

const clampSize = (size: { width: number; height: number }, canvas: { width: number; height: number }) => ({
  width: Math.round(Math.max(Math.min(MIN_WINDOW.width, canvas.width), Math.min(size.width, canvas.width))),
  height: Math.round(Math.max(Math.min(MIN_WINDOW.height, canvas.height), Math.min(size.height, canvas.height))),
});

class RunController {
  private run: RunState | null = null;
  private rafId: number | null = null;
  private storeUnsub: (() => void) | null = null;
  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  private pointer = { x: 0, y: 0 };
  private pendingMotion: { x: number; y: number } | null = null;
  private pendingSize: { width: number; height: number } | null = null;
  private applied = new Map<string, string>();
  private seq = 0;
  private listeners = new Set<() => void>();
  private snapshot: RunSnapshot = STOPPED;
  private readonly keyHandler = (event: KeyboardEvent) => this.onKey(event);

  start(options: { loop?: boolean } = {}): boolean {
    if (this.snapshot.running) return true;
    const state = useVamsStore.getState();
    if (!canRun(state)) return false;
    const canvas = renderBridge.getCanvasSize() ?? FALLBACK_CANVAS;
    this.run = createRunState(state.objects, state.viewportLimits, canvas);
    this.pointer = { x: 0, y: 0 };
    this.pendingMotion = null;
    this.pendingSize = null;
    this.applied = new Map(Object.keys(this.run.objects).map((id) => [id, 'null|true']));
    this.publish({ running: true, lastCall: null, fired: null, window: { ...canvas }, canvas: { ...canvas } });
    window.addEventListener('keydown', this.keyHandler, true);
    this.watchStore();
    // GLUT calls the reshape handler once when the window opens.
    this.handle({ type: 'reshape', width: canvas.width, height: canvas.height });
    if (options.loop !== false) this.startLoop();
    return true;
  }

  stop(): void {
    if (!this.snapshot.running) return;
    if (this.rafId !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.rafId);
    this.rafId = null;
    window.removeEventListener('keydown', this.keyHandler, true);
    this.storeUnsub?.();
    this.storeUnsub = null;
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.flashTimer = null;
    this.run = null;
    this.applied.clear();
    renderBridge.resync();
    this.publish(STOPPED);
  }

  pointerDown(button: number, x: number, y: number): void {
    const b = BUTTONS[button];
    this.pointer = { x, y };
    if (b) this.handle({ type: 'mouse', button: b, state: 'down', x, y });
  }

  pointerUp(button: number, x: number, y: number): void {
    const b = BUTTONS[button];
    this.pointer = { x, y };
    if (b) this.handle({ type: 'mouse', button: b, state: 'up', x, y });
  }

  /** Motion reaches the handler at most once per frame; the last position wins. */
  pointerMove(x: number, y: number, dragging: boolean): void {
    this.pointer = { x, y };
    if (dragging && this.snapshot.running) this.pendingMotion = { x, y };
  }

  resizeWindow(width: number, height: number): void {
    const canvas = this.snapshot.canvas;
    if (!this.snapshot.running || !canvas) return;
    this.pendingSize = clampSize({ width, height }, canvas);
  }

  nudgeWindow(dx: number, dy: number): void {
    const base = this.pendingSize ?? this.snapshot.window;
    if (base) this.resizeWindow(base.width + dx, base.height + dy);
  }

  /** One frame: canvas size, pending resize and motion, the idle pass, then a draw. */
  stepFrame(): void {
    if (!this.run || !this.snapshot.canvas || !this.snapshot.window) return;
    const canvas = renderBridge.getCanvasSize() ?? this.snapshot.canvas;
    if (canvas.width !== this.snapshot.canvas.width || canvas.height !== this.snapshot.canvas.height) {
      this.publish({ ...this.snapshot, canvas: { ...canvas } });
      this.pendingSize = clampSize(this.pendingSize ?? this.snapshot.window, canvas);
    }
    const size = this.pendingSize;
    this.pendingSize = null;
    const window = this.snapshot.window!;
    if (size && (size.width !== window.width || size.height !== window.height)) {
      this.handle({ type: 'reshape', width: size.width, height: size.height });
    }
    const motion = this.pendingMotion;
    this.pendingMotion = null;
    if (motion) this.handle({ type: 'motion', x: motion.x, y: motion.y });
    if (!this.run) return;
    const state = useVamsStore.getState();
    this.run = stepAnimations(this.run, state.objects);
    this.run = dispatch(this.run, state.callbacks, { type: 'idle' }).state;
    this.draw();
  }

  isRunning(): boolean {
    return this.snapshot.running;
  }

  cleanup(): void {
    this.stop();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): RunSnapshot => this.snapshot;

  private handle(event: RunEvent): void {
    if (!this.run) return;
    const result = dispatch(this.run, useVamsStore.getState().callbacks, event);
    this.run = result.state;
    let next = this.snapshot;
    if (event.type === 'reshape') next = { ...next, window: { ...this.run.window } };
    if (result.call && result.kind && result.handlerName) {
      next = {
        ...next,
        lastCall: result.call,
        fired: { kind: result.kind, handlerName: result.handlerName, trigger: result.matched, seq: ++this.seq },
      };
      this.armFlashClear();
    }
    if (next !== this.snapshot) this.publish(next);
    this.draw();
  }

  private onKey(event: KeyboardEvent): void {
    if (!this.snapshot.running || event.key === 'Tab') return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.stop();
      return;
    }
    // A focused button keeps only its activation keys, and the window handle its arrows.
    // Nothing else reaches editor shortcuts or handlers.
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('button')) {
      const modified = event.ctrlKey || event.metaKey || event.altKey;
      const activation = event.key === 'Enter' || event.key === ' ';
      const arrow = event.key in SPECIAL && !!target.closest('.run-handle');
      if (!modified && (activation || arrow)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const { x, y } = this.pointer;
    const special = SPECIAL[event.key];
    if (special) this.handle({ type: 'special', key: special, x, y });
    else if (KEYBOARD.test(event.key)) this.handle({ type: 'key', key: event.key, x, y });
  }

  private draw(): void {
    const run = this.run;
    if (!run) return;
    for (const [id, o] of Object.entries(run.objects)) {
      const display = renderBridge.getDisplayObject(id);
      if (display && !display.destroyed) {
        display.position.set(o.x, o.y);
        display.rotation = o.rotation * DEGREES_TO_RADIANS;
        display.scale.set(o.scaleX, o.scaleY);
      }
      const color = o.useColor ? runStateColor(o) : null;
      const key = `${color}|${o.visible}`;
      if (this.applied.get(id) !== key) {
        this.applied.set(id, key);
        renderBridge.setAppearance(id, { color, visible: o.visible });
      }
    }
    const window = this.snapshot.window;
    if (window) renderBridge.setView(run.view, { x: 0, y: 0, width: window.width, height: window.height });
  }

  private armFlashClear(): void {
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => {
      this.flashTimer = null;
      if (this.snapshot.fired) this.publish({ ...this.snapshot, fired: null });
    }, FLASH_MS);
  }

  private startLoop(): void {
    if (typeof requestAnimationFrame !== 'function') return;
    const frame = () => {
      if (!this.snapshot.running) return;
      this.stepFrame();
      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  /** Any change to the scene, the course position or history ends the run. */
  private watchStore(): void {
    this.storeUnsub = useVamsStore.subscribe((state, prev) => {
      if (
        state.objects !== prev.objects ||
        state.callbacks !== prev.callbacks ||
        state.viewportLimits !== prev.viewportLimits ||
        state.selectedObjectId !== prev.selectedObjectId ||
        state.appMode !== prev.appMode ||
        state.activeSection !== prev.activeSection ||
        state.activeLessonId !== prev.activeLessonId ||
        state.currentStepIndex !== prev.currentStepIndex ||
        state.past !== prev.past ||
        state.future !== prev.future
      ) {
        this.stop();
      }
    });
  }

  private publish(next: RunSnapshot): void {
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }
}

/** App-wide singleton. */
export const runController = new RunController();
