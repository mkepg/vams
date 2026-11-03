/**
 * The Console as the page keeps it: the program's output split into lines, the last
 * CONSOLE_LINES of them, so a program printing in a tight loop can't grow the page without end.
 * Output arrives in batches that may end part way through a line; that part stays open until the
 * rest of it, or output on the other stream, arrives.
 */

/** The most lines the Console keeps. */
export const CONSOLE_LINES = 5000;

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
  for (let i = 0; i < parts.length - 1; i++) lines.push({ stream, text: parts[i] });
  const rest = parts[parts.length - 1];
  open = rest ? { stream, text: rest } : null;
  const keep = CONSOLE_LINES - (open ? 1 : 0);
  return { lines: lines.length > keep ? lines.slice(lines.length - keep) : lines, open };
}

/** Every line the Console shows, the open one last. */
export function consoleLines(log: ConsoleLog): ConsoleLine[] {
  return log.open ? [...log.lines, log.open] : log.lines;
}
