/**
 * What the Console says when a program stops on an error. A lab PC's program that crashes ends
 * with a Windows exception code and prints nothing, or only libstdc++'s "terminate called" lines;
 * the browser's own words for the same stop ("unreachable", "memory access out of bounds") mean
 * nothing to a student. So each kind of stop is said in plain words, and a message the Lab doesn't
 * know is passed on as it came.
 */

/** The worker's message for an exception that nothing caught; it prints libstdc++'s lines first. */
export const UNCAUGHT_EXCEPTION = 'uncaught exception';

/** The worker's message for a program that called abort(); Emscripten's own "Aborted()" line is left out. */
export const ABORTED = 'aborted';

/** Each kind of stop: the browsers' messages for it (Chromium's and Firefox's), then the words. */
const KINDS: { messages: (m: string) => boolean; words: string }[] = [
  {
    messages: (m) => m === UNCAUGHT_EXCEPTION,
    words: 'it threw an exception that nothing caught.',
  },
  {
    messages: (m) => m === ABORTED,
    words: 'it called abort().',
  },
  {
    messages: (m) => /^(integer )?(divide|remainder) by zero$/.test(m),
    words: 'it divided a whole number by zero.',
  },
  {
    messages: (m) => m === 'divide result unrepresentable' || m === 'integer overflow',
    words: "it divided the smallest int by -1, and the answer doesn't fit in an int.",
  },
  {
    messages: (m) => m === 'memory access out of bounds' || m === 'index out of bounds',
    words: "it read or wrote memory outside the program's own: past the end of an array, through a pointer that was never set, or with a stack that ran out.",
  },
  {
    messages: (m) => m === 'Maximum call stack size exceeded' || m === 'too much recursion',
    words: 'it ran out of stack, which a function that calls itself without end does.',
  },
  {
    messages: (m) => /^(null function|table index is out of bounds|indirect call|function signature mismatch)/.test(m),
    words: "it called a function through a pointer that doesn't point to one.",
  },
  {
    messages: (m) => m === 'unreachable' || m === 'unreachable executed',
    words: 'it reached code the compiler marked as never reached, such as the end of a function that should have returned a value.',
  },
];

/** The words after "The program stopped: " for a message from the worker. */
export function crashWords(message: string): string {
  return KINDS.find((kind) => kind.messages(message))?.words ?? message;
}
