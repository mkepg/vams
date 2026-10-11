import type { RuleTrigger } from '@/core/types/scene';
import { BUTTON_LABELS, SPECIAL_LABELS, STATE_LABELS } from './generator/handlers';

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/**
 * The 0-based lines of a handler that ran for `trigger`: its case or if branch, or the whole
 * handler for Motion, Idle, Reshape (`null`) or a trigger without a branch. Empty when the
 * handler is not in `code`.
 */
export function locateHandlerBranch(code: string, handlerName: string, trigger: RuleTrigger | null): number[] {
  const lines = code.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.startsWith(`void ${handlerName}(`));
  if (start < 0) return [];
  let end = start + 1;
  while (end < lines.length - 1 && lines[end] !== '}') end++;
  const whole = range(start, end);
  if (!trigger || trigger.kind === 'motion' || trigger.kind === 'idle') return whole;
  const label = trigger.kind === 'keyboard'
    ? `    case '${trigger.key}':`
    : trigger.kind === 'special'
      ? `    case ${SPECIAL_LABELS[trigger.key]}:`
      : `    if (button == ${BUTTON_LABELS[trigger.button]} && state == ${STATE_LABELS[trigger.state]}) {`;
  const first = lines.findIndex((l, i) => i > start && i < end && l === label);
  if (first < 0) return whole;
  const closer = trigger.kind === 'mouse' ? '    }' : '        break;';
  let last = first + 1;
  while (last < end && lines[last] !== closer) last++;
  return range(first, last);
}
