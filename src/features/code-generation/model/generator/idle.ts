import { sanitizeName } from './utils';
import {
  ORBIT_RADIUS,
  PULSE_AMPLITUDE,
  SLIDE_AMPLITUDE,
  ROTATE_STEP_PER_FRAME,
  TIME_STEP_PER_FRAME,
} from '@/core/animation/motion-config';
import type { AnimationMotion } from '@/core/types/scene';

/**
 * GLUT idle-callback generation for the saved single-object animations.
 *
 * Animation is just transformation over time: a per-object `animate_<name>()`
 * function nudges the object's `state_<name>` each frame, and `_vams_idle()`
 * calls every animator before requesting a redraw. These bodies reference ONLY
 * the real `ObjectState` fields the generator already emits
 * (`struct ObjectState { float x, y; float rotation; float scaleX, scaleY; }`),
 * capturing a base value in a `static` local where a sine needs one — so the
 * generated program genuinely compiles and runs the motion the user authored.
 *
 * Speed scales the per-frame step linearly; the motion's shape (amplitude,
 * radius) does not. Output is fully deterministic.
 */

export interface IdleBody {
  /** Body statements, 4-space indented, ready to nest inside a callback fn. */
  lines: string[];
  /** Indices within `lines` of the transform call(s) that drive the motion. */
  drivingIndices: number[];
}

const fmt = (n: number): string => `${n.toFixed(2)}f`;
const fmt3 = (n: number): string => `${n.toFixed(3)}f`;

export function generateIdleBody(
  motion: AnimationMotion,
  objectName: string,
  speed = 1,
): IdleBody {
  const name = sanitizeName(objectName);
  const state = `state_${name}`;
  const rotateStep = fmt(ROTATE_STEP_PER_FRAME * speed);
  const timeStep = fmt3(TIME_STEP_PER_FRAME * speed);

  // [lineText, isDriving?] — driving lines are the transform calls highlighted
  // in sync with the on-canvas motion.
  let rows: Array<[string, boolean?]>;

  switch (motion) {
    case 'rotate':
      rows = [
        ['    // Animation is transformation that changes a little each frame'],
        [`    ${state}.rotation += ${rotateStep};`, true],
        [`    if (${state}.rotation >= 360.0f) ${state}.rotation -= 360.0f;`],
      ];
      break;

    case 'pulse':
      rows = [
        [`    static float baseSX_${name} = ${state}.scaleX;`],
        [`    static float baseSY_${name} = ${state}.scaleY;`],
        ['    static float t = 0.0f;'],
        [`    t += ${timeStep};`],
        [`    float s = 1.0f + ${fmt(PULSE_AMPLITUDE)} * sinf(t);`],
        [`    ${state}.scaleX = baseSX_${name} * s;`, true],
        [`    ${state}.scaleY = baseSY_${name} * s;`, true],
      ];
      break;

    case 'slide':
      rows = [
        [`    static float baseX_${name} = ${state}.x;`],
        ['    static float t = 0.0f;'],
        [`    t += ${timeStep};`],
        [`    ${state}.x = baseX_${name} + ${fmt(SLIDE_AMPLITUDE)} * sinf(t);`, true],
      ];
      break;

    case 'orbit':
      rows = [
        [`    static float baseX_${name} = ${state}.x;`],
        [`    static float baseY_${name} = ${state}.y;`],
        ['    static float t = 0.0f;'],
        [`    t += ${timeStep};`],
        [`    ${state}.x = baseX_${name} + ${fmt(ORBIT_RADIUS)} * sinf(t);`, true],
        [`    ${state}.y = baseY_${name} + ${fmt(ORBIT_RADIUS)} * (1.0f - cosf(t));`, true],
      ];
      break;

    default:
      rows = [];
  }

  return {
    lines: rows.map((r) => r[0]),
    drivingIndices: rows.map((r, i) => (r[1] ? i : -1)).filter((i) => i >= 0),
  };
}

/** A complete `void animate_<name>() { ... }` function for the program body. */
export function generateAnimateFunction(
  objectName: string,
  motion: AnimationMotion,
  speed = 1,
): string {
  const name = sanitizeName(objectName);
  const body = generateIdleBody(motion, objectName, speed).lines;
  return `void animate_${name}()\n{\n${body.map((l) => `${l}\n`).join('')}}\n\n`;
}
