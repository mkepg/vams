/** A compiled command: a call with its arguments, and the data it reads, fixed at compile time. */
export type Command = () => void;

// GL_MAX_LIST_NESTING: the deepest glCallList runs (5.4); a call deeper than this is ignored.
export const MAX_LIST_NESTING = 64;

export const GL_LIST = { COMPILE: 0x1300, COMPILE_AND_EXECUTE: 0x1301 } as const;

// The most names one glGenLists hands out; a larger range finds no group and gets 0.
const MAX_GEN_RANGE = 1 << 16;

/**
 * Display lists (5.4): numbered command sequences. While a list is being defined, the commands
 * that are compiled go to it, and run as well in COMPILE_AND_EXECUTE mode; the list takes its new
 * contents only at glEndList.
 */
export class DisplayLists {
  private readonly lists = new Map<number, Command[]>();
  private defining: { list: number; mode: number; commands: Command[] } | null = null;
  private depth = 0;

  /** Whether a glNewList is open. */
  get open(): boolean {
    return this.defining !== null;
  }

  /** n such that n..n+range−1 were unused, each now an empty list; 0 when range is 0 or too large. */
  gen(range: number): number {
    if (range === 0 || range > MAX_GEN_RANGE) return 0;
    let first = 1;
    for (let n = 1; n - first < range; n++) {
      if (this.lists.has(n)) first = n + 1;
    }
    for (let n = first; n < first + range; n++) this.lists.set(n, []);
    return first;
  }

  delete(list: number, range: number): void {
    for (const n of [...this.lists.keys()]) if (n >= list && n < list + range) this.lists.delete(n);
  }

  begin(list: number, mode: number): void {
    this.defining = { list, mode, commands: [] };
  }

  end(): void {
    if (!this.defining) return;
    this.lists.set(this.defining.list, this.defining.commands);
    this.defining = null;
  }

  /**
   * Takes a compilable command: records it while a list is being defined, and says whether it
   * should also run now (no list open, or COMPILE_AND_EXECUTE).
   */
  record(command: Command): boolean {
    if (!this.defining) return true;
    this.defining.commands.push(command);
    return this.defining.mode === GL_LIST.COMPILE_AND_EXECUTE;
  }

  /** Runs list `n`'s commands in order; an unknown list or one nested past MAX_LIST_NESTING does nothing. */
  call(n: number): void {
    const commands = this.lists.get(n);
    if (!commands || this.depth >= MAX_LIST_NESTING) return;
    this.depth++;
    try {
      for (const command of commands) command();
    } finally {
      this.depth--;
    }
  }
}
