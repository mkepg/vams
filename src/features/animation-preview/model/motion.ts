import type { AnimationMotion, TransformState } from '@/core/types/scene';
import {
  BASE_FREQUENCY,
  ORBIT_RADIUS,
  PULSE_AMPLITUDE,
  SLIDE_AMPLITUDE,
  MOTIONS,
} from '@/core/animation/motion-config';

/**
 * Runtime pose math for the four preview motions. The canonical tuning and the
 * motion list live in core ({@link '@/core/animation/motion-config'}) so this
 * runtime and the C++ idle-callback generator stay in lockstep.
 *
 * Each motion maps onto an operation the Transforms section already teaches:
 *   - rotate → glRotatef
 *   - pulse  → glScalef
 *   - slide  → glTranslatef (one axis)
 *   - orbit  → glTranslatef (a small circle)
 */
export type MotionType = AnimationMotion;

// Re-export the shared tuning/list so existing importers keep one entry point.
export { BASE_FREQUENCY, PULSE_AMPLITUDE, SLIDE_AMPLITUDE, ORBIT_RADIUS, MOTIONS };
export type { MotionDescriptor } from '@/core/animation/motion-config';

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
