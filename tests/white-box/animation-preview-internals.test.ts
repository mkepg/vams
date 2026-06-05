/**
 * WHITE-BOX TEST SUITE — ANIM-WB
 * Transformation Playback Preview — internal correctness.
 *
 * Focus (from the Animation Preview plan, §9 white-box checks):
 *  - Motion progress wraps correctly at the end of a cycle.
 *  - The baseline is captured and restored exactly.
 *  - The frame loop is cancelled on stop and on cleanup.
 *  - Idle-callback snippet generation is deterministic.
 *
 * The preview is a render-layer overlay, so these tests drive the controller
 * against a fake display object and assert it never mutates scene state.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  computePose,
  cyclePhase,
  BASE_FREQUENCY,
  type MotionType,
} from '@/features/animation-preview/model/motion';
import { generateIdleCallback } from '@/features/animation-preview/model/idle-callback';
import { animationController } from '@/features/animation-preview/model/animation-controller';
import type { TransformState } from '@/core/types/scene';
import { addTriangle, getState } from '../helpers/store';
import { makeFakeDisplay, registerFakeRenderer, type FakeDisplay } from '../helpers/fake-renderer';

const BASELINE: TransformState = {
  translateX: 0.2,
  translateY: -0.1,
  rotate: 30,
  scaleX: 1.5,
  scaleY: 0.8,
};

const MOTIONS: MotionType[] = ['rotate', 'pulse', 'slide', 'orbit'];

let unregister: () => void;
let cancelSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Stub the frame loop so it never self-advances; tests drive frames manually.
  vi.stubGlobal('requestAnimationFrame', () => 1);
  cancelSpy = vi.fn();
  vi.stubGlobal('cancelAnimationFrame', cancelSpy);
});

afterEach(() => {
  animationController.cleanup();
  if (unregister) unregister();
  vi.unstubAllGlobals();
});

describe('ANIM-WB-01: every motion returns the exact baseline at phase zero', () => {
  it.each(MOTIONS)('motion "%s" is identity at elapsed 0', (motion) => {
    const pose = computePose(motion, BASELINE, 0, 1);
    expect(pose).toEqual(BASELINE);
  });
});

describe('ANIM-WB-02: cycle phase wraps into [0, 1)', () => {
  it('phase is fractional and never reaches 1', () => {
    const cycle = 1 / BASE_FREQUENCY; // seconds for one full cycle at speed 1
    expect(cyclePhase(0, 1)).toBe(0);
    expect(cyclePhase(cycle * 0.25, 1)).toBeCloseTo(0.25, 6);
    expect(cyclePhase(cycle, 1)).toBeCloseTo(0, 6); // wraps back to 0
    expect(cyclePhase(cycle * 3.5, 1)).toBeCloseTo(0.5, 6);
    expect(cyclePhase(cycle * 999.999, 1)).toBeGreaterThanOrEqual(0);
    expect(cyclePhase(cycle * 999.999, 1)).toBeLessThan(1);
  });
});

describe('ANIM-WB-03: a full cycle returns to the baseline pose', () => {
  it.each(MOTIONS)('motion "%s" at one full cycle equals baseline', (motion) => {
    const cycle = 1 / BASE_FREQUENCY;
    const pose = computePose(motion, BASELINE, cycle, 1);
    // rotate accumulates +360°, which is the same orientation as the baseline.
    const normalize = (p: TransformState) => ({
      ...p,
      rotate: ((p.rotate % 360) + 360) % 360,
    });
    expect(normalize(pose).translateX).toBeCloseTo(BASELINE.translateX, 6);
    expect(normalize(pose).translateY).toBeCloseTo(BASELINE.translateY, 6);
    expect(normalize(pose).scaleX).toBeCloseTo(BASELINE.scaleX, 6);
    expect(normalize(pose).scaleY).toBeCloseTo(BASELINE.scaleY, 6);
    expect(normalize(pose).rotate).toBeCloseTo(((BASELINE.rotate % 360) + 360) % 360, 6);
  });
});

describe('ANIM-WB-04: baseline is captured from state and restored exactly on stop', () => {
  it('snaps the display back to the saved transform, untouched store', () => {
    const displays = new Map<string, FakeDisplay>();
    const tri = addTriangle();
    getState().updateObjectTransform(tri.id, BASELINE);
    getState().selectObject(tri.id);

    const display = makeFakeDisplay();
    displays.set(tri.id, display);
    unregister = registerFakeRenderer(displays);

    const stateBefore = JSON.stringify(getState().objects);

    animationController.play(tri.id, 'rotate', 1);
    // Drive a frame well into the motion so the display is clearly displaced.
    animationController.applyMotionAt(0.7);
    expect(display.rotation).not.toBeCloseTo((BASELINE.rotate * Math.PI) / 180, 6);

    animationController.stop();

    // Exact restore (the §8.1 numeric comparison).
    expect(display.position.x).toBeCloseTo(BASELINE.translateX, 10);
    expect(display.position.y).toBeCloseTo(BASELINE.translateY, 10);
    expect(display.rotation).toBeCloseTo((BASELINE.rotate * Math.PI) / 180, 10);
    expect(display.scale.x).toBeCloseTo(BASELINE.scaleX, 10);
    expect(display.scale.y).toBeCloseTo(BASELINE.scaleY, 10);

    // Scene state never changed.
    expect(JSON.stringify(getState().objects)).toBe(stateBefore);
  });
});

describe('ANIM-WB-05: the frame loop is cancelled on stop and on cleanup', () => {
  it('stop() cancels the pending animation frame', () => {
    const tri = addTriangle();
    getState().selectObject(tri.id);
    unregister = registerFakeRenderer(new Map());

    animationController.play(tri.id, 'rotate', 1);
    expect(animationController.isPlaying()).toBe(true);

    animationController.stop();
    expect(animationController.isPlaying()).toBe(false);
    expect(cancelSpy).toHaveBeenCalled();
  });

  it('cleanup() stops an active preview', () => {
    const tri = addTriangle();
    getState().selectObject(tri.id);
    unregister = registerFakeRenderer(new Map());

    animationController.play(tri.id, 'pulse', 2);
    animationController.cleanup();
    expect(animationController.isPlaying()).toBe(false);
  });
});

describe('ANIM-WB-06: idle-callback generation is deterministic', () => {
  it.each(MOTIONS)('motion "%s" yields identical output across calls', (motion) => {
    const a = generateIdleCallback(motion, 'My Shape');
    const b = generateIdleCallback(motion, 'My Shape');
    expect(a.code).toBe(b.code);
    expect(a.highlightLines).toEqual(b.highlightLines);
  });

  it('the highlighted line is a transform call on the object state struct', () => {
    const { code, highlightLines } = generateIdleCallback('rotate', 'Tri 1');
    const lines = code.split('\n');
    expect(highlightLines.length).toBeGreaterThan(0);
    for (const idx of highlightLines) {
      expect(lines[idx]).toContain('state_Tri_1');
    }
    // Sanitized identifier — no spaces leak into C code.
    expect(code).not.toContain('state_Tri 1');
  });
});
