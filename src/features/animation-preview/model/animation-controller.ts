import type { Container } from 'pixi.js';
import { useVamsStore } from '@/core/store';
import type { TransformState } from '@/core/types/scene';
import { renderBridge } from '@/shared/engine/render-bridge';
import { computePose, type MotionType } from './motion';

/**
 * Playback controller for the transient Animation Preview.
 *
 * It owns a frame loop that animates ONE live display object on top of a
 * captured baseline, and snaps it back exactly when stopped. It deliberately
 * never calls a scene-state setter — that single restraint is what keeps the
 * manuscript's claims (one-directional flow, no retained simulation state,
 * no playback engine in the data model) intact. Saving while a preview plays
 * produces the same `.vams` file as saving while stopped.
 */

export interface AnimationSnapshot {
  playing: boolean;
  objectId: string | null;
  motion: MotionType;
  speed: number;
}

const DEGREES_TO_RADIANS = Math.PI / 180;

class AnimationController {
  private rafId: number | null = null;
  private objectId: string | null = null;
  private motion: MotionType = 'rotate';
  private speed = 1;
  private baseline: TransformState | null = null;
  private startTime = 0;

  private storeUnsub: (() => void) | null = null;
  private listeners = new Set<() => void>();
  private snapshot: AnimationSnapshot = {
    playing: false,
    objectId: null,
    motion: 'rotate',
    speed: 1,
  };

  /* ---------------------------------------------------------------- */
  /*  Public API                                                       */
  /* ---------------------------------------------------------------- */

  /**
   * Begin previewing `motion` on the object with `objectId`. Captures the
   * object's saved transform as the baseline, then starts the frame loop.
   * Any in-flight preview is stopped first, so two loops never coexist.
   */
  play(objectId: string, motion: MotionType, speed = 1): void {
    this.stop();

    const obj = useVamsStore.getState().objects.find((o) => o.id === objectId);
    if (!obj) return;

    this.objectId = objectId;
    this.motion = motion;
    this.speed = speed;
    this.baseline = { ...obj.transform };
    this.startTime = now();

    this.publish({ playing: true, objectId, motion, speed });
    this.watchForExternalChanges();
    this.startLoop();
  }

  /**
   * Stop the preview: cancel the loop, restore the exact baseline pose, and
   * ask the renderer to re-sync from state so the store is authoritative
   * again. Safe to call when nothing is playing.
   */
  stop(): void {
    const wasPlaying = this.snapshot.playing;

    if (this.rafId !== null) {
      cancelFrame(this.rafId);
      this.rafId = null;
    }
    if (this.storeUnsub) {
      this.storeUnsub();
      this.storeUnsub = null;
    }

    // Restore the exact saved pose, then let the renderer reassert state as the
    // single source of truth. `resync` overwrites everything, so even if the
    // store changed underneath us (undo/redo) the canvas ends up correct.
    this.restoreBaseline();
    renderBridge.resync();

    this.objectId = null;
    this.baseline = null;

    if (wasPlaying) {
      this.publish({ ...this.snapshot, playing: false, objectId: null });
    }
  }

  /** Remember a motion choice for the next Play (no effect while stopped). */
  setPreferredMotion(motion: MotionType): void {
    if (this.snapshot.motion === motion) return;
    this.motion = motion;
    this.publish({ ...this.snapshot, motion });
  }

  /** Remember a speed choice for the next Play (no effect while stopped). */
  setPreferredSpeed(speed: number): void {
    if (this.snapshot.speed === speed) return;
    this.speed = speed;
    this.publish({ ...this.snapshot, speed });
  }

  /** True while a preview loop is active. */
  isPlaying(): boolean {
    return this.snapshot.playing;
  }

  /** Cancel everything. Called on app teardown so the loop never leaks. */
  cleanup(): void {
    this.stop();
    this.listeners.clear();
  }

  /* ---------------------------------------------------------------- */
  /*  External store integration (useSyncExternalStore)                */
  /* ---------------------------------------------------------------- */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): AnimationSnapshot => this.snapshot;

  /* ---------------------------------------------------------------- */
  /*  Internals                                                        */
  /* ---------------------------------------------------------------- */

  /**
   * Apply the motion for a given elapsed time onto the live display object.
   * Exposed (not private) only so tests can drive a deterministic frame
   * without spinning the real animation-frame loop.
   */
  applyMotionAt(elapsedSeconds: number): void {
    if (!this.objectId || !this.baseline) return;
    const display = renderBridge.getDisplayObject(this.objectId);
    if (!display) return;
    const pose = computePose(this.motion, this.baseline, elapsedSeconds, this.speed);
    writePose(display, pose);
  }

  private startLoop(): void {
    if (typeof requestAnimationFrame !== 'function') return;
    const frame = () => {
      if (!this.snapshot.playing) return;
      this.applyMotionAt((now() - this.startTime) / 1000);
      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  private restoreBaseline(): void {
    if (!this.objectId || !this.baseline) return;
    const display = renderBridge.getDisplayObject(this.objectId);
    if (display) writePose(display, this.baseline);
  }

  /**
   * Stop the preview the moment anything the user does would make a running
   * loop misleading: picking another object, leaving Author mode, switching
   * curriculum sections, or undo/redo (which the past/future stacks reveal).
   */
  private watchForExternalChanges(): void {
    this.storeUnsub = useVamsStore.subscribe((state, prev) => {
      if (
        state.selectedObjectId !== prev.selectedObjectId ||
        state.appMode !== prev.appMode ||
        state.activeSection !== prev.activeSection ||
        state.past !== prev.past ||
        state.future !== prev.future
      ) {
        this.stop();
      }
    });
  }

  private publish(next: AnimationSnapshot): void {
    this.snapshot = next;
    this.listeners.forEach((l) => l());
  }
}

function writePose(display: Container, pose: TransformState): void {
  display.position.set(pose.translateX, pose.translateY);
  display.rotation = pose.rotate * DEGREES_TO_RADIANS;
  display.scale.set(pose.scaleX, pose.scaleY);
}

function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function cancelFrame(id: number): void {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
}

/** App-wide singleton. The preview is intentionally single-object. */
export const animationController = new AnimationController();
