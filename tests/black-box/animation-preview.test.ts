/**
 * BLACK-BOX TEST SUITE — ANIM-BB
 * Transformation Playback Preview — observable behaviour.
 *
 * Focus (from the Animation Preview plan, §9 black-box checks):
 *  - Play starts visible motion; Stop restores the exact pose.
 *  - Selecting another object stops playback.
 *  - Entering Lesson Mode / switching sections stops playback.
 *  - Saving while playing matches saving while stopped (the strongest defense).
 *  - Each motion type plays distinctly.
 *  - Undo/redo while playing stops the preview first.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { animationController } from '@/features/animation-preview/model/animation-controller';
import type { MotionType } from '@/features/animation-preview/model/motion';
import { buildProjectFile } from '@/entities/project/model/project-io';
import { addTriangle, addQuad, getState } from '../helpers/store';
import { makeFakeDisplay, registerFakeRenderer, type FakeDisplay } from '../helpers/fake-renderer';

let unregister: () => void;

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  getState().setAppMode('Author');
  getState().setActiveSection('Transforms');
});

afterEach(() => {
  animationController.cleanup();
  if (unregister) unregister();
  vi.unstubAllGlobals();
});

function setupOne(): { id: string; display: FakeDisplay } {
  const tri = addTriangle();
  getState().selectObject(tri.id);
  const display = makeFakeDisplay();
  const displays = new Map<string, FakeDisplay>([[tri.id, display]]);
  unregister = registerFakeRenderer(displays);
  return { id: tri.id, display };
}

describe('ANIM-BB-01: Play starts visible motion', () => {
  it('a played object is displaced from its resting pose', () => {
    const { id, display } = setupOne();
    const restRotation = display.rotation;
    animationController.play(id, 'rotate', 1);
    animationController.applyMotionAt(0.5);
    expect(animationController.isPlaying()).toBe(true);
    expect(display.rotation).not.toBe(restRotation);
  });
});

describe('ANIM-BB-02: Stop restores the exact pose', () => {
  it('display returns to the saved transform after stop', () => {
    const tri = addTriangle();
    getState().updateObjectTransform(tri.id, {
      translateX: 0.3, translateY: 0.2, rotate: 15, scaleX: 1.2, scaleY: 1.2,
    });
    getState().selectObject(tri.id);
    const display = makeFakeDisplay();
    unregister = registerFakeRenderer(new Map([[tri.id, display]]));

    animationController.play(tri.id, 'orbit', 2);
    animationController.applyMotionAt(0.4);
    animationController.stop();

    expect(display.position.x).toBeCloseTo(0.3, 10);
    expect(display.position.y).toBeCloseTo(0.2, 10);
    expect(display.rotation).toBeCloseTo((15 * Math.PI) / 180, 10);
    expect(display.scale.x).toBeCloseTo(1.2, 10);
    expect(display.scale.y).toBeCloseTo(1.2, 10);
  });
});

describe('ANIM-BB-03: Selecting another object stops playback', () => {
  it('switching selection ends the current preview', () => {
    const a = addTriangle();
    const b = addQuad(0.5, 0, 0.1);
    getState().selectObject(a.id);
    unregister = registerFakeRenderer(
      new Map([[a.id, makeFakeDisplay()], [b.id, makeFakeDisplay()]]),
    );

    animationController.play(a.id, 'rotate', 1);
    expect(animationController.isPlaying()).toBe(true);

    getState().selectObject(b.id);
    expect(animationController.isPlaying()).toBe(false);
  });
});

describe('ANIM-BB-04: Entering Lesson Mode or switching sections stops playback', () => {
  it('entering Lesson Mode stops the preview', () => {
    const { id } = setupOne();
    animationController.play(id, 'pulse', 1);
    expect(animationController.isPlaying()).toBe(true);
    getState().setAppMode('Lesson');
    expect(animationController.isPlaying()).toBe(false);
  });

  it('switching curriculum section stops the preview', () => {
    const { id } = setupOne();
    animationController.play(id, 'slide', 1);
    expect(animationController.isPlaying()).toBe(true);
    getState().setActiveSection('Primitives');
    expect(animationController.isPlaying()).toBe(false);
  });
});

describe('ANIM-BB-05: Saving while playing matches saving while stopped', () => {
  it('the project payload is byte-identical during and after a preview', () => {
    const { id } = setupOne();

    const savedStopped = JSON.stringify(buildProjectFile(getState() as never).data);

    animationController.play(id, 'orbit', 2);
    animationController.applyMotionAt(0.6); // displace the on-screen object
    const savedPlaying = JSON.stringify(buildProjectFile(getState() as never).data);

    animationController.stop();
    const savedAfter = JSON.stringify(buildProjectFile(getState() as never).data);

    expect(savedPlaying).toBe(savedStopped);
    expect(savedAfter).toBe(savedStopped);
  });
});

describe('ANIM-BB-06: Each motion type plays distinctly', () => {
  const channelChecks: Record<MotionType, (d: FakeDisplay, base: FakeDisplay) => boolean> = {
    rotate: (d, base) => d.rotation !== base.rotation,
    pulse: (d, base) => d.scale.x !== base.scale.x || d.scale.y !== base.scale.y,
    slide: (d, base) => d.position.x !== base.position.x && d.position.y === base.position.y,
    orbit: (d, base) => d.position.x !== base.position.x && d.position.y !== base.position.y,
  };

  it.each(['rotate', 'pulse', 'slide', 'orbit'] as MotionType[])(
    'motion "%s" moves the expected transform channel',
    (motion) => {
      const { id, display } = setupOne();
      const rest = makeFakeDisplay(); // identity reference
      animationController.play(id, motion, 1);
      animationController.applyMotionAt(0.5);
      expect(channelChecks[motion](display, rest)).toBe(true);
      animationController.stop();
    },
  );
});

describe('ANIM-BB-07: Undo while playing stops the preview', () => {
  it('an undo ends playback before restoring history', () => {
    const tri = addTriangle();
    getState().selectObject(tri.id);
    // Create a history entry to undo into.
    getState().pushToHistory();
    getState().updateObjectTransform(tri.id, { translateX: 0.4 });
    unregister = registerFakeRenderer(new Map([[tri.id, makeFakeDisplay()]]));

    animationController.play(tri.id, 'rotate', 1);
    expect(animationController.isPlaying()).toBe(true);

    getState().undo();
    expect(animationController.isPlaying()).toBe(false);
  });
});
