import { useVamsStore } from '@/core/store';
import type { VamsState } from '@/core/store/types';
import { showsIllustration } from '@/core/store/illustration';
import type { GlutCallbackKind, MouseButton, RuleTrigger, SpecialKey } from '@/core/types/scene';
import { CALLBACK_KINDS, isCallbackValid } from '@/core/callbacks/callbacks-model';
import { renderBridge } from '@/shared/engine/render-bridge';
import {
  createRunState, dispatch, runStateColor, windowToWorld, type RunEvent, type RunState,
} from './runtime';

/**
 * The canvas Run state. It owns the event listeners and the frame loop, keeps a temporary
 * run state, and draws it through the render bridge. It never calls a scene-state setter:
 * stopping resyncs the canvas from the store, which never changed.
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
  /** The last handler that fired, kept open in the code after its flash until Run stops. */
  lastFired: RunFired | null;
  window: { width: number; height: number } | null;
  canvas: { width: number; height: number } | null;
}

export const FLASH_MS = 700;
const FALLBACK_CANVAS = { width: 800, height: 600 };
const DEGREES_TO_RADIANS = Math.PI / 180;
const SPECIAL: Record<string, SpecialKey> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const KEYBOARD = /^[a-zA-Z0-9 ]$/;
const BUTTONS: MouseButton[] = ['left', 'middle', 'right'];
/** Pointer Events' `buttons` bit for each MouseEvent `button`: left 1, middle 4, right 2. */
const BUTTON_BITS = [1, 4, 2];
const STOPPED: RunSnapshot = { running: false, lastCall: null, fired: null, lastFired: null, window: null, canvas: null };

export type RunBlock = 'illustration' | 'empty' | 'no-callback' | null;

/** Why Run is off, in the order the canvas explains it; null when it can run. */
export function runBlock(
  state: Pick<VamsState, 'objects' | 'callbacks' | 'activeSection' | 'pipelineMode' | 'quizPipelineStage'>,
): RunBlock {
  // A Pipeline illustration hides the canvas, so there is nothing to run on.
  if (showsIllustration(state)) return 'illustration';
  if (state.objects.length === 0) return 'empty';
  if (!CALLBACK_KINDS.some((k) => isCallbackValid(state.callbacks, k))) return 'no-callback';
  return null;
}

export function canRun(
  state: Pick<VamsState, 'objects' | 'callbacks' | 'activeSection' | 'pipelineMode' | 'quizPipelineStage'>,
): boolean {
  return runBlock(state) === null;
}

class RunController {
  private run: RunState | null = null;
  private rafId: number | null = null;
  private storeUnsub: (() => void) | null = null;
  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  private pointer = { x: 0, y: 0 };
  private pendingMotion: { x: number; y: number } | null = null;
  /** The `buttons` bits the handler has been told are down. */
  private held = 0;
  private applied = new Map<string, string>();
  private seq = 0;
  private listeners = new Set<() => void>();
  private snapshot: RunSnapshot = STOPPED;
  private readonly keyHandler = (event: KeyboardEvent) => this.onKey(event);

  start(options: { loop?: boolean } = {}): boolean {
    if (this.snapshot.running) return true;
    const state = useVamsStore.getState();
    if (!canRun(state)) return false;
    // The program's window is the canvas: GLUT's window size is the canvas size.
    const canvas = renderBridge.getCanvasSize() ?? FALLBACK_CANVAS;
    this.run = createRunState(state.objects, state.viewportLimits, canvas);
    this.pointer = { x: 0, y: 0 };
    this.pendingMotion = null;
    this.held = 0;
    this.applied = new Map(Object.keys(this.run.objects).map((id) => [id, 'null|true']));
    this.publish({ running: true, lastCall: null, fired: null, lastFired: null, window: { ...canvas }, canvas: { ...canvas } });
    renderBridge.setEditorOverlaysHidden(true);
    renderBridge.setRunTextPixelsPerUnitY(canvas.height / (state.viewportLimits.maxY - state.viewportLimits.minY));
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
    renderBridge.setEditorOverlaysHidden(false);
    renderBridge.setRunTextPixelsPerUnitY(null);
    this.publish(STOPPED);
  }

  pointerDown(button: number, x: number, y: number): void {
    this.button(button, 'down', x, y);
  }

  pointerUp(button: number, x: number, y: number): void {
    this.button(button, 'up', x, y);
  }

  /**
   * Motion reaches the handler at most once per frame; the last position wins. `buttons` is the
   * event's bitmask: Pointer Events report a second button pressed or released while another is
   * held as a move whose bits changed, and GLUT reports it to the Mouse handler.
   */
  pointerMove(x: number, y: number, buttons: number | boolean): void {
    this.setPointer(x, y);
    const dragging = typeof buttons === 'number' ? buttons !== 0 : buttons;
    if (dragging && this.snapshot.running) this.pendingMotion = { x, y };
    if (typeof buttons !== 'number' || buttons === this.held || this.held === 0) return;
    BUTTON_BITS.forEach((bit, button) => {
      const now = (buttons & bit) !== 0;
      if (now !== ((this.held & bit) !== 0)) this.button(button, now ? 'down' : 'up', x, y);
    });
  }

  /** One frame: a resize of the program's window, pending motion, the idle pass, then a draw. */
  stepFrame(): void {
    if (!this.run || !this.snapshot.canvas || !this.snapshot.window) return;
    // Resizing the program's window resizes the canvas; GLUT reports that to the reshape handler.
    const canvas = renderBridge.getCanvasSize() ?? this.snapshot.canvas;
    if (canvas.width !== this.snapshot.canvas.width || canvas.height !== this.snapshot.canvas.height) {
      this.publish({ ...this.snapshot, canvas: { ...canvas } });
      this.handle({ type: 'reshape', width: canvas.width, height: canvas.height });
    }
    const motion = this.pendingMotion;
    this.pendingMotion = null;
    if (motion) this.handle({ type: 'motion', x: motion.x, y: motion.y });
    if (!this.run) return;
    const state = useVamsStore.getState();
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

  private button(button: number, state: 'down' | 'up', x: number, y: number): void {
    const b = BUTTONS[button];
    this.setPointer(x, y);
    const bit = BUTTON_BITS[button] ?? 0;
    this.held = state === 'down' ? this.held | bit : this.held & ~bit;
    // GLUT keeps the order events happened in: a drag waiting for the next frame comes first.
    const motion = this.pendingMotion;
    this.pendingMotion = null;
    if (motion) this.handle({ type: 'motion', x: motion.x, y: motion.y });
    if (b) this.handle({ type: 'mouse', button: b, state, x, y });
  }

  /**
   * The pointer, and the readout's world position as the generated windowToWorld computes it.
   * The readout is interaction state, outside history and saving; Run's store watcher ignores it.
   */
  private setPointer(x: number, y: number): void {
    this.pointer = { x, y };
    if (this.run) useVamsStore.getState().setCursorWorld(windowToWorld(this.run.view, this.run.window, x, y));
  }

  private handle(event: RunEvent): void {
    if (!this.run) return;
    const result = dispatch(this.run, useVamsStore.getState().callbacks, event);
    this.run = result.state;
    let next = this.snapshot;
    if (event.type === 'reshape') next = { ...next, window: { ...this.run.window } };
    if (result.call && result.kind && result.handlerName) {
      const fired = { kind: result.kind, handlerName: result.handlerName, trigger: result.matched, seq: ++this.seq };
      next = { ...next, lastCall: result.call, fired, lastFired: fired };
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
    // A focused button keeps only its activation keys. Nothing else reaches editor shortcuts or handlers.
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('button')) {
      const modified = event.ctrlKey || event.metaKey || event.altKey;
      const activation = event.key === 'Enter' || event.key === ' ';
      if (!modified && activation) return;
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
    const size = this.snapshot.window;
    if (size) renderBridge.setView(run.view, { x: 0, y: 0, width: size.width, height: size.height });
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
        state.pipelineMode !== prev.pipelineMode ||
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
