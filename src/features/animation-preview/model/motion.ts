import type { TransformState } from '@/core/types/scene';

/**
 * The four transient preview motions. Each is pure transform-over-time and
 * maps onto an operation the Transforms section already teaches:
 *   - rotate → glRotatef
 *   - pulse  → glScalef
 *   - slide  → glTranslatef (one axis)
 *   - orbit  → glTranslatef (a small circle)
 */
export type MotionType = 'rotate' | 'pulse' | 'slide' | 'orbit';

export interface MotionDescriptor {
  type: MotionType;
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

/**
 * Motion tuning constants. Kept module-level so the playback math and the
 * generated idle-callback snippets describe the exact same motion.
 */
/** Cycles per second at speed = 1 (one full loop every two seconds). */
export const BASE_FREQUENCY = 0.5;
/** Peak scale deviation for Pulse (±30%). */
export const PULSE_AMPLITUDE = 0.3;
/** Peak translation for Slide, in world units. */
export const SLIDE_AMPLITUDE = 0.5;
/** Orbit circle radius, in world units. */
export const ORBIT_RADIUS = 0.4;

const TAU = Math.PI * 2;

/**
 * The normalized cycle phase in [0, 1) for a given elapsed time and speed.
 * Wrapping here (rather than letting time grow unbounded) keeps long-running
 * previews numerically identical to short ones — the white-box "wrap" check.
 */
export function cyclePhase(elapsedSeconds: number, speed: number): number {
  const raw = elapsedSeconds * speed * BASE_FREQUENCY;
  const wrapped = raw - Math.floor(raw);
  // Guard against -0 / floating fuzz so phase is always a clean [0, 1).
  return wrapped < 0 ? wrapped + 1 : wrapped;
}

/**
 * Compute the previewed pose for a motion, layered on top of a baseline
 * (the object's saved transform). At phase 0 every motion returns EXACTLY the
 * baseline, which is what makes "stop snaps back to the saved pose" exact.
 */
export function computePose(
  motion: MotionType,
  baseline: TransformState,
  elapsedSeconds: number,
  speed: number,
): TransformState {
  const phase = cyclePhase(elapsedSeconds, speed);
  const theta = phase * TAU;

  switch (motion) {
    case 'rotate':
      return { ...baseline, rotate: baseline.rotate + phase * 360 };

    case 'pulse': {
      const factor = 1 + PULSE_AMPLITUDE * Math.sin(theta);
      return {
        ...baseline,
        scaleX: baseline.scaleX * factor,
        scaleY: baseline.scaleY * factor,
      };
    }

    case 'slide':
      return {
        ...baseline,
        translateX: baseline.translateX + SLIDE_AMPLITUDE * Math.sin(theta),
      };

    case 'orbit':
      // Circle that passes through the baseline point at phase 0, centered
      // directly above it — so there is never a positional "jump" on start.
      return {
        ...baseline,
        translateX: baseline.translateX + ORBIT_RADIUS * Math.sin(theta),
        translateY: baseline.translateY + ORBIT_RADIUS * (1 - Math.cos(theta)),
      };

    default:
      return { ...baseline };
  }
}
