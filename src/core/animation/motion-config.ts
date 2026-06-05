import type { AnimationMotion } from '@/core/types/scene';

/**
 * Canonical tuning for the four preview motions. Kept in core so the runtime
 * pose math (animation-preview) and the C++ idle-callback generator
 * (code-generation) describe the exact same motion — the body the student
 * compiles always matches what the canvas previews.
 */

/** Cycles per second at speed = 1 (one full loop every two seconds). */
export const BASE_FREQUENCY = 0.5;
/** Peak scale deviation for Pulse (±30%). */
export const PULSE_AMPLITUDE = 0.3;
/** Peak translation for Slide, in world units. */
export const SLIDE_AMPLITUDE = 0.5;
/** Orbit circle radius, in world units. */
export const ORBIT_RADIUS = 0.4;
/** Per-frame rotation step (degrees) at speed = 1, for the generated callback. */
export const ROTATE_STEP_PER_FRAME = 1.5;
/** Per-frame phase advance at speed = 1, for the generated callback. */
export const TIME_STEP_PER_FRAME = 0.03;

export interface MotionDescriptor {
  type: AnimationMotion;
  label: string;
  /** One-line description of what the motion demonstrates. */
  blurb: string;
}

export const MOTIONS: MotionDescriptor[] = [
  { type: 'rotate', label: 'Rotate', blurb: 'Spin around the pivot' },
  { type: 'pulse', label: 'Pulse', blurb: 'Scale up and down' },
  { type: 'slide', label: 'Slide', blurb: 'Move back and forth on X' },
  { type: 'orbit', label: 'Orbit', blurb: 'Travel a small circle' },
];
