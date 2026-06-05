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
 */

export interface IdleCallbackSnippet {
  code: string;
  /** 0-indexed line numbers of the transform call(s) that drive the motion. */
  highlightLines: number[];
}

const fmt = (n: number): string => `${n.toFixed(2)}f`;

export function generateIdleCallback(
  motion: MotionType,
  objectName: string,
): IdleCallbackSnippet {
  const name = sanitizeName(objectName);
  const state = `state_${name}`;

  // Each entry is [lineText, isDriving?]. The driving lines are the transform
  // calls highlighted in sync with the on-canvas motion.
  let rows: Array<[string, boolean?]>;

  switch (motion) {
    case 'rotate':
      rows = [
        ['void idle() {'],
        ['    // Animation is transformation that changes a little each frame'],
        [`    ${state}.rotation += 1.50f;`, true],
        [`    if (${state}.rotation >= 360.0f) ${state}.rotation -= 360.0f;`],
        ['    glutPostRedisplay();'],
        ['}'],
      ];
      break;

    case 'pulse':
      rows = [
        ['void idle() {'],
        ['    static float t = 0.0f;'],
        ['    t += 0.03f;'],
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
        ['    t += 0.03f;'],
        [`    ${state}.x = ${state}.baseX + ${fmt(SLIDE_AMPLITUDE)} * sinf(t);`, true],
        ['    glutPostRedisplay();'],
        ['}'],
      ];
      break;

    case 'orbit':
      rows = [
        ['void idle() {'],
        ['    static float t = 0.0f;'],
        ['    t += 0.03f;'],
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
