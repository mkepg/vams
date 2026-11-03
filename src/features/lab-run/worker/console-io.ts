/**
 * The program's Console: what it prints, what it reads, and the Windows console extras.
 *
 * Output is batched into `stdout` and `stderr` messages, so a program printing in a tight loop
 * sends a few large messages rather than one per line. The first BURST writes in each BURST_MS go
 * at once, so a program that prints a little and then never waits still shows it. After that a
 * batch goes when it reaches FLUSH_BYTES, when FLUSH_MS have passed since the last one, when the
 * stream changes, and before the program blocks. Before it blocks, what stdio still holds is sent
 * too (vams_flush), so a prompt without a newline is on the page while the program waits.
 *
 * Input comes from the shared input buffer. Reading stdin sets the "waiting for a line" input
 * state, so the page shows an input line, and blocks until the student presses Enter. getch and
 * friends set the "waiting for a key" state instead and take one key at a time.
 */
import { CONTROL, INPUT_STATE, inputWaiting, peekInput, takeInput, type InputState, type LayoutViews } from '../model/shared-layout';
import { waitUntil, type WorkerHost } from './event-queue';

/** A batch goes once it holds this many bytes. */
export const FLUSH_BYTES = 64 * 1024;
/** A batch goes when this long has passed since the last one. */
export const FLUSH_MS = 16;
/** How many writes in each BURST_MS go at once, unbatched. */
export const BURST = 8;
export const BURST_MS = 100;

export const PAUSE_PROMPT = 'Press any key to continue . . .';

/** The Console line for a system() command the Lab doesn't run. */
export const systemMessage = (command: string) => `system("${command}") doesn't run in the Lab.`;

type Stream = 'stdout' | 'stderr';

const encoder = new TextEncoder();

export class ConsoleIO {
  private readonly views: LayoutViews;
  private readonly host: WorkerHost;
  private readonly batch = new Uint8Array(FLUSH_BYTES);
  private length = 0;
  private stream: Stream = 'stdout';
  private lastFlush = -Infinity;
  private readonly decoders = { stdout: new TextDecoder(), stderr: new TextDecoder() };
  /** What is left of the line stdin last read. */
  private line: Uint8Array = new Uint8Array(0);
  /** How far into the waiting input a newline has been looked for. */
  private scanned = 0;
  private burstStart = -Infinity;
  private burstPosts = 0;
  private programFlush: () => void = () => {};
  private draining = false;

  constructor(views: LayoutViews, host: WorkerHost) {
    this.views = views;
    this.host = host;
  }

  /** stdio's flush (vams_flush), once the program's main module has loaded. */
  connect(flush: () => void): void {
    this.programFlush = flush;
  }

  // Output.

  /** Program output (bytes, as the TTY writes them) or a line of the Lab's own (text). */
  write(stream: Stream, data: Uint8Array | string): void {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;
    if (stream !== this.stream) {
      this.flush();
      this.stream = stream;
    }
    for (let at = 0; at < bytes.length; ) {
      const n = Math.min(bytes.length - at, FLUSH_BYTES - this.length);
      this.batch.set(bytes.subarray(at, at + n), this.length);
      this.length += n;
      at += n;
      if (this.length === FLUSH_BYTES) this.flush();
    }
    if (!this.length) return;
    const now = this.host.now();
    if (now - this.burstStart >= BURST_MS) {
      this.burstStart = now;
      this.burstPosts = 0;
    }
    if (this.burstPosts < BURST || now - this.lastFlush >= FLUSH_MS) this.flush();
  }

  /** Sends what is batched. */
  flush(): void {
    this.lastFlush = this.host.now();
    if (!this.length) return;
    const text = this.decoders[this.stream].decode(this.batch.subarray(0, this.length), { stream: true });
    this.length = 0;
    if (!text) return;
    this.host.post({ type: this.stream, text });
    this.burstPosts++;
  }

  /** Sends what stdio holds, then what is batched: everything printed so far. Before every wait. */
  drain(): void {
    if (!this.draining) {
      this.draining = true;
      try {
        this.programFlush();
      } finally {
        this.draining = false;
      }
    }
    this.flush();
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
    this.drain();
    this.setState(INPUT_STATE.LINE);
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
    this.drain();
    this.setState(INPUT_STATE.KEY);
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
    this.drain();
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
    this.drain();
    const c = command.trim().toLowerCase();
    const pause = /^pause\s*(>\s*nul)?$/.exec(c);
    if (pause) {
      if (!pause[1]) this.write('stdout', PAUSE_PROMPT);
      this.key();
      if (!pause[1]) this.write('stdout', '\n');
      return 0;
    }
    if (c === 'cls') {
      this.host.post({ type: 'clear' });
      return 0;
    }
    this.write('stderr', `${systemMessage(command)}\n`);
    return 1;
  }

  /** Sleep(ms): waits on a word nothing writes, so only the time ends it. */
  sleep(ms: number): void {
    this.drain();
    if (ms > 0) this.host.wait(CONTROL.SLEEP, 0, ms);
  }
}
