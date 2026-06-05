import { generateIdleBody } from '@/features/code-generation/model/generator/idle';
import type { MotionType } from './motion';

/**
 * Standalone `void idle() { ... }` snippet for the canvas overlay, built from
 * the same shared idle-body generator the real program uses — so the overlay,
 * the main code panel, and the exported program never drift apart.
 */
export { generateIdleBody } from '@/features/code-generation/model/generator/idle';

export interface IdleCallbackSnippet {
  code: string;
  /** 0-indexed line numbers of the transform call(s) that drive the motion. */
  highlightLines: number[];
}

export function generateIdleCallback(
  motion: MotionType,
  objectName: string,
  speed = 1,
): IdleCallbackSnippet {
  const body = generateIdleBody(motion, objectName, speed);
  const code = ['void idle() {', ...body.lines, '    glutPostRedisplay();', '}'].join('\n');
  // +1 offsets every body index past the opening `void idle() {` line.
  const highlightLines = body.drivingIndices.map((i) => i + 1);
  return { code, highlightLines };
}
