/**
 * The program's Console: what it prints, what it reads, and the Windows console extras.
 *
 * Output goes into the shared output ring as the program writes it, and the page reads the ring
 * on its own animation frames, so everything printed reaches the page even when the program then
 * spins without ever waiting. A program printing in a tight loop fills the ring between two of the
 * page's reads and then waits for the next one, which batches its output and keeps it from running
 * ahead of the page.
 *
 * Input comes from the shared input buffer. Reading stdin sets the "waiting for a line" input
 * state, so the page shows an input line, and blocks until the student presses Enter. getch and
 * friends set the "waiting for a key" state instead and take one key at a time.
 */
import {
  CONTROL,
  INPUT_STATE,
  inputWaiting,
  MAX_OUTPUT_RECORD,
  outputRoom,
  peekInput,
  putOutput,
  takeInput,
  type InputState,
  type LayoutViews,
} from '../model/shared-layout';
import { waitUntil, type WorkerHost } from './event-queue';

export const PAUSE_PROMPT = 'Press any key to continue . . .';

/** The Console line for a system() command the Lab doesn't run. */
export const systemMessage = (command: string) => `system("${command}") doesn't run in the Lab.`;

type Stream = 'stdout' | 'stderr';

const encoder = new TextEncoder();
// A record's header, and at least one byte of it.
const SMALLEST_RECORD = 4;

export class ConsoleIO {
  private readonly views: LayoutViews;
  private readonly host: WorkerHost;
  /** What is left of the line stdin last read. */
  private line: Uint8Array = new Uint8Array(0);
  /** How far into the waiting input a newline has been looked for. */
  private scanned = 0;
  /** How many times the program has stopped to wait: for a line, a key, or a Sleep. */
  pauses = 0;

  constructor(views: LayoutViews, host: WorkerHost) {
    this.views = views;
    this.host = host;
  }

  // Output.

  /** Waits until the page has read enough of the output ring for `bytes` more. */
  private room(bytes: number): number {
    for (;;) {
      const tail = Atomics.load(this.views.control, CONTROL.OUTPUT_TAIL);
      const room = outputRoom(this.views);
      if (room >= bytes) return room;
      this.host.wait(CONTROL.OUTPUT_TAIL, tail, Infinity);
    }
  }

  /** Program output (bytes, as the TTY writes them) or a line of the Lab's own (text). */
  write(stream: Stream, data: Uint8Array | string): void {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;
    for (let at = 0; at < bytes.length; ) {
      const n = Math.min(bytes.length - at, MAX_OUTPUT_RECORD, this.room(SMALLEST_RECORD) - (SMALLEST_RECORD - 1));
      putOutput(this.views, stream, bytes.subarray(at, at + n));
      at += n;
    }
  }

  /** system("cls"): the Console clears, after what was printed before it. */
  private clear(): void {
    this.room(SMALLEST_RECORD - 1);
    putOutput(this.views, 'clear');
  }

  // Input.

  private setState(state: InputState): void {
    Atomics.store(this.views.control, CONTROL.INPUT_STATE, state);
  }

  /** The offset of the first newline waiting, or −1. */
  private newline(): number {
    const waiting = inputWaiting(this.views);
    for (; this.scanned < waiting; this.scanned++) if (peekInput(this.views, this.scanned) === 10) return this.scanned;
    return -1;
  }

  /** The next line the student enters, as bytes ending in `\n`. Blocks until there is one. */
  private lineBytes(): Uint8Array {
    this.setState(INPUT_STATE.LINE);
    if (this.newline() < 0) this.pauses++;
    waitUntil(this.host, this.views, () => this.newline() >= 0);
    this.setState(INPUT_STATE.NONE);
    const bytes = takeInput(this.views, this.newline() + 1);
    this.scanned = 0;
    return bytes;
  }

  /** The next line the student enters, with its `\n`. Blocks until there is one. */
  readLine(): string {
    return new TextDecoder().decode(this.lineBytes());
  }

  /**
   * stdin's read: up to `max` bytes of the line being read, blocking for the next line only when
   * the last one has been read to its end, as a console does.
   */
  readStdin(max: number): Uint8Array {
    if (max <= 0) return new Uint8Array(0);
    if (!this.line.length) this.line = this.lineBytes();
    const out = this.line.subarray(0, max);
    this.line = this.line.subarray(out.length);
    return out;
  }

  /** One key pressed in the Console. Blocks until there is one. */
  private key(): number {
    this.setState(INPUT_STATE.KEY);
    if (inputWaiting(this.views) === 0) this.pauses++;
    waitUntil(this.host, this.views, () => inputWaiting(this.views) > 0);
    this.setState(INPUT_STATE.NONE);
    this.scanned = 0;
    return takeInput(this.views, 1)[0];
  }

  /** conio's getch: one key, not echoed. */
  getch(): number {
    return this.key();
  }

  /** conio's getche: one key, echoed to the Console. */
  getche(): number {
    const k = this.key();
    this.write('stdout', k === 13 ? '\n' : Uint8Array.of(k));
    return k;
  }

  /** conio's kbhit: whether a key is waiting, without waiting. From now the page sends keys. */
  kbhit(): boolean {
    if (inputWaiting(this.views) > 0) return true;
    this.setState(INPUT_STATE.KEY);
    return false;
  }

  // Windows extras.

  /**
   * system(): "pause" waits for a key, "cls" clears the Console, and any other command prints a
   * line saying it doesn't run and returns 1. Without a command there is no shell to ask: 0.
   */
  system(command: string | null): number {
    if (command === null) return 0;
    const c = command.trim().toLowerCase();
    const pause = /^pause\s*(>\s*nul)?$/.exec(c);
    if (pause) {
      if (!pause[1]) this.write('stdout', PAUSE_PROMPT);
      this.key();
      if (!pause[1]) this.write('stdout', '\n');
      return 0;
    }
    if (c === 'cls') {
      this.clear();
      return 0;
    }
    this.write('stderr', `${systemMessage(command)}\n`);
    return 1;
  }

  /** Sleep(ms): waits on a word nothing writes, so only the time ends it. */
  sleep(ms: number): void {
    if (ms <= 0) return;
    this.pauses++;
    this.host.wait(CONTROL.SLEEP, 0, ms);
  }
}
