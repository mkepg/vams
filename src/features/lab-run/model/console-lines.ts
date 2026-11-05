/**
 * The Console as the page keeps it: the program's output split into lines, the last
 * CONSOLE_LINES of them, so a program printing in a tight loop can't grow the page without end.
 * A line longer than CONSOLE_LINE_CHARS wraps onto the next, as a console window wraps at its
 * buffer width, so a program that prints for ever without a newline is bounded too. Output arrives
 * in reads that may end part way through a line; that part stays open until the rest of it, or
 * output on the other stream, arrives.
 */

/** The most lines the Console keeps. */
export const CONSOLE_LINES = 5000;
/** The longest line the Console keeps; a longer one wraps. */
export const CONSOLE_LINE_CHARS = 1000;

export type ConsoleStream = 'stdout' | 'stderr';

export interface ConsoleLine {
  stream: ConsoleStream;
  text: string;
}

export interface ConsoleLog {
  /** Ended lines, oldest first. */
  lines: ConsoleLine[];
  /** The line still being written, if any. */
  open: ConsoleLine | null;
}

export const emptyConsole = (): ConsoleLog => ({ lines: [], open: null });

/** `text` in pieces of at most CONSOLE_LINE_CHARS, never splitting a surrogate pair; [''] for ''. */
function wrap(text: string): string[] {
  if (text.length <= CONSOLE_LINE_CHARS) return [text];
  const pieces: string[] = [];
  for (let at = 0; at < text.length; ) {
    let end = Math.min(text.length, at + CONSOLE_LINE_CHARS);
    const last = text.charCodeAt(end - 1);
    if (end < text.length && last >= 0xd800 && last <= 0xdbff) end--;
    pieces.push(text.slice(at, end));
    at = end;
  }
  return pieces;
}

/** The log with `text` appended; `log` is left as it was. */
export function appendConsole(log: ConsoleLog, stream: ConsoleStream, text: string): ConsoleLog {
  const lines = log.lines.slice();
  let open = log.open;
  if (open && open.stream !== stream) {
    lines.push(open);
    open = null;
  }
  const parts = text.split('\n');
  parts[0] = (open?.text ?? '') + parts[0];
  for (let i = 0; i < parts.length - 1; i++) for (const piece of wrap(parts[i])) lines.push({ stream, text: piece });
  const rest = wrap(parts[parts.length - 1]);
  for (let i = 0; i < rest.length - 1; i++) lines.push({ stream, text: rest[i] });
  const tail = rest[rest.length - 1];
  open = tail ? { stream, text: tail } : null;
  const keep = CONSOLE_LINES - (open ? 1 : 0);
  return { lines: lines.length > keep ? lines.slice(lines.length - keep) : lines, open };
}

/** Every line the Console shows, the open one last. */
export function consoleLines(log: ConsoleLog): ConsoleLine[] {
  return log.open ? [...log.lines, log.open] : log.lines;
}
