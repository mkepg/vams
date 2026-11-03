import type { CompileResult } from './compile-client';

/** What the page says while Run waits, and when Run cannot go ahead. Worded by the Lab spec. */
export const LAB_MESSAGES = {
  busy: 'Compiling… the Lab is busy, this can take a few seconds',
  restingMonth: 'Run is resting until the 1st. Your code is saved in this browser.',
  restingDay: 'Run is resting until tomorrow. Your code is saved in this browser.',
  offline: 'Run needs the internet. Your code is saved in this browser.',
  limited: 'The Lab is too busy to compile right now. Your code is saved in this browser. Try Run again in a minute.',
  failed: "The Lab couldn't compile this time. Your code is saved in this browser. Try Run again.",
} as const;

/** The line to show for a result that did not produce a program, or null when there is nothing to say. */
export function compileMessage(result: CompileResult): string | null {
  switch (result.kind) {
    case 'resting':
      return result.until === 'day' ? LAB_MESSAGES.restingDay : LAB_MESSAGES.restingMonth;
    case 'offline':
      return LAB_MESSAGES.offline;
    case 'limited':
      return LAB_MESSAGES.limited;
    case 'failed':
      return LAB_MESSAGES.failed;
    default:
      return null;
  }
}
