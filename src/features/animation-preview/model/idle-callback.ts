import { sanitizeName } from '@/features/code-generation/model/generator/utils';
import {
  ORBIT_RADIUS,
  PULSE_AMPLITUDE,
  SLIDE_AMPLITUDE,
  type MotionType,
} from './motion';

/**
 * Deterministic GLUT idle-callback snippets — one per preview motion.
 *
 * For a compiled OpenGL 1.5 program, animation is driven by registering an
 * idle callback with `glutIdleFunc` that nudges the object's transform a
 * little each frame and calls `glutPostRedisplay`. These snippets show the
 * exact callback that would produce the motion the user is watching, using
 * the same `state_<name>` struct the main code generator emits — so it is
 * truthful that "this code produces this motion."
 *
 * Because the motion set is small and fixed, generation stays honest and the
 * output is fully deterministic (same inputs → byte-identical string).
 *
 * Speed matters: in a real idle callback the playback rate is set by how much
 * the transform advances each frame, so the per-frame step scales linearly
 * with the chosen preview speed. That keeps the snippet truthful — the code
 * shown always matches the speed the user is watching on the canvas.
 */

export interface IdleCallbackSnippet {
  code: string;
  /** 0-indexed line numbers of the transform call(s) that drive the motion. */
  highlightLines: number[];
}

/** Per-frame rotation step (degrees) at speed = 1. */
const ROTATE_STEP_PER_FRAME = 1.5;
/** Per-frame phase advance (radians-ish accumulator) at speed = 1. */
const TIME_STEP_PER_FRAME = 0.03;

const fmt = (n: number): string => `${n.toFixed(2)}f`;
const fmt3 = (n: number): string => `${n.toFixed(3)}f`;

export function generateIdleCallback(
  motion: MotionType,
  objectName: string,
  speed = 1,
): IdleCallbackSnippet {
  const name = sanitizeName(objectName);
  const state = `state_${name}`;

  // The per-frame increments scale with playback speed; the motion's shape
  // (amplitude, radius) does not.
  const rotateStep = fmt(ROTATE_STEP_PER_FRAME * speed);
  const timeStep = fmt3(TIME_STEP_PER_FRAME * speed);

  // Each entry is [lineText, isDriving?]. The driving lines are the transform
  // calls highlighted in sync with the on-canvas motion.
  let rows: Array<[string, boolean?]>;

  switch (motion) {
    case 'rotate':
      rows = [
        ['void idle() {'],
        ['    // Animation is transformation that changes a little each frame'],
        [`    ${state}.rotation += ${rotateStep};`, true],
        [`    if (${state}.rotation >= 360.0f) ${state}.rotation -= 360.0f;`],
        ['    glutPostRedisplay();'],
        ['}'],
      ];
      break;

    case 'pulse':
      rows = [
        ['void idle() {'],
        ['    static float t = 0.0f;'],
        [`    t += ${timeStep};`],
        [`    float s = 1.0f + ${fmt(PULSE_AMPLITUDE)} * sinf(t);`],
        [`    ${state}.scaleX = ${state}.baseScaleX * s;`, true],
        [`    ${state}.scaleY = ${state}.baseScaleY * s;`, true],
        ['    glutPostRedisplay();'],
        ['}'],
      ];
      break;

    case 'slide':
      rows = [
        ['void idle() {'],
        ['    static float t = 0.0f;'],
        [`    t += ${timeStep};`],
        [`    ${state}.x = ${state}.baseX + ${fmt(SLIDE_AMPLITUDE)} * sinf(t);`, true],
        ['    glutPostRedisplay();'],
        ['}'],
      ];
      break;

    case 'orbit':
      rows = [
        ['void idle() {'],
        ['    static float t = 0.0f;'],
        [`    t += ${timeStep};`],
        [`    ${state}.x = ${state}.baseX + ${fmt(ORBIT_RADIUS)} * sinf(t);`, true],
        [`    ${state}.y = ${state}.baseY + ${fmt(ORBIT_RADIUS)} * (1.0f - cosf(t));`, true],
        ['    glutPostRedisplay();'],
        ['}'],
      ];
      break;

    default:
      rows = [['void idle() {'], ['}']];
  }

  const code = rows.map((r) => r[0]).join('\n');
  const highlightLines = rows
    .map((r, i) => (r[1] ? i : -1))
    .filter((i) => i >= 0);

  return { code, highlightLines };
}
