/**
 * The memory the Lab page and the program's worker share: one SharedArrayBuffer, laid out as
 *
 *   control words   CONTROL_WORDS × Int32, at 0
 *   event ring      EVENT_SLOTS events of EVENT_WORDS × Int32, page to worker
 *   input buffer    INPUT_BYTES of typed Console input, page to worker, as a byte ring
 *   output ring     OUTPUT_BYTES of program output, worker to page
 *   framebuffer     the rest: the last frame, RGBA8, top row first, worker to page
 *
 * Every ring has one writer and one reader, each owning one of its two counters, so neither side
 * ever takes a lock. A counter counts around twice the ring's capacity, not for ever, so it never
 * leaves Int32 however long the program prints; the ring holds `(head - tail) mod 2 x capacity`
 * items, which tells a full ring from an empty one. After writing an event or input the page bumps SIGNAL and notifies it, which
 * is the one word the worker sleeps on while it waits for anything.
 *
 * The program's output goes through the output ring, not messages, so the page can read it while
 * the program runs, whatever the program does next: a program that prints and then spins in a loop
 * still shows everything it printed. The page reads the ring with an OutputReader on every
 * animation frame (and on a timer while the tab is hidden), and once more when `exit` or `crash`
 * arrives; when the ring is full the program waits for the page, so output can't outrun it.
 *
 * When a reshape makes the window larger than the framebuffer, the worker makes a new
 * SharedArrayBuffer for frames alone and posts it as a `framebuffer` message. FRAME_GENERATION
 * says which buffer a frame is in: 0 is the framebuffer here, and each new buffer counts up.
 */

/** What the page sends the worker in `start`. */
export interface SharedLayout {
  buffer: SharedArrayBuffer;
}

/** Indexes of the control words. */
export const CONTROL = {
  /** Frames published so far. The worker adds 1 after writing each frame. */
  FRAME: 0,
  /** The last frame the page has copied. The worker waits for it, at most FRAME_WAIT_MS. */
  FRAME_ACK: 1,
  /** Events written so far (page). */
  EVENT_HEAD: 2,
  /** Events read so far (worker). */
  EVENT_TAIL: 3,
  /** What the program is waiting for in the Console: an InputState. */
  INPUT_STATE: 4,
  /** Input bytes written so far (page). */
  INPUT_HEAD: 5,
  /** Input bytes read so far (worker). */
  INPUT_TAIL: 6,
  /** Bumped and notified by the page after every event or input. */
  SIGNAL: 7,
  /** Never written: Sleep waits on it for its whole time. */
  SLEEP: 8,
  /** The published frame's size, in pixels. */
  FRAME_WIDTH: 9,
  FRAME_HEIGHT: 10,
  /** Which framebuffer the published frame is in. */
  FRAME_GENERATION: 11,
  /** Output bytes written so far (worker). */
  OUTPUT_HEAD: 12,
  /** Output bytes read so far (page). The page notifies it after each read. */
  OUTPUT_TAIL: 13,
} as const;

export const CONTROL_WORDS = 16;
export const EVENT_SLOTS = 256;
export const EVENT_WORDS = 8;
export const INPUT_BYTES = 8192;
export const OUTPUT_BYTES = 64 * 1024;
/** The longest a frame waits for the page to take it, as a lab PC's vsync waits. */
export const FRAME_WAIT_MS = 100;
/** The framebuffer a new layout holds: a 1024 × 768 window. */
export const DEFAULT_FRAMEBUFFER_BYTES = 1024 * 768 * 4;

/** `n` modulo `m`, never negative. */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** A counter of a ring holding `capacity` items, read from shared memory and kept in its range. */
function counter(control: Int32Array, word: number, capacity: number): number {
  return mod(Atomics.load(control, word), 2 * capacity);
}

/** How many items a ring holds. */
function held(head: number, tail: number, capacity: number): number {
  return mod(head - tail, 2 * capacity);
}

/** A counter moved on by `by` items. */
function advance(at: number, by: number, capacity: number): number {
  return mod(at + by, 2 * capacity);
}

const EVENTS_OFFSET = CONTROL_WORDS * 4;
const INPUT_OFFSET = EVENTS_OFFSET + EVENT_SLOTS * EVENT_WORDS * 4;
const OUTPUT_OFFSET = INPUT_OFFSET + INPUT_BYTES;
const FRAMEBUFFER_OFFSET = OUTPUT_OFFSET + OUTPUT_BYTES;

/** What the program waits for in the Console. The page shows an input line only for LINE. */
export const INPUT_STATE = {
  /** Not reading the Console. */
  NONE: 0,
  /** cin, scanf, getchar or getline: the page sends a line when the student presses Enter. */
  LINE: 1,
  /** getch, getche, kbhit or system("pause"): the page sends each key as it is pressed. */
  KEY: 2,
} as const;
export type InputState = (typeof INPUT_STATE)[keyof typeof INPUT_STATE];

/** The views each side reads and writes through. `framebuffer` changes when a larger one is posted. */
export interface LayoutViews {
  control: Int32Array;
  events: Int32Array;
  input: Uint8Array;
  output: Uint8Array;
  framebuffer: Uint8Array;
  /** The generation `framebuffer` belongs to. */
  generation: number;
}

/** A new layout, made by the page before it starts the worker. */
export function createSharedLayout(framebufferBytes = DEFAULT_FRAMEBUFFER_BYTES): SharedLayout {
  return { buffer: new SharedArrayBuffer(FRAMEBUFFER_OFFSET + framebufferBytes) };
}

export function openLayout(layout: SharedLayout): LayoutViews {
  const { buffer } = layout;
  return {
    control: new Int32Array(buffer, 0, CONTROL_WORDS),
    events: new Int32Array(buffer, EVENTS_OFFSET, EVENT_SLOTS * EVENT_WORDS),
    input: new Uint8Array(buffer, INPUT_OFFSET, INPUT_BYTES),
    output: new Uint8Array(buffer, OUTPUT_OFFSET, OUTPUT_BYTES),
    framebuffer: new Uint8Array(buffer, FRAMEBUFFER_OFFSET),
    generation: 0,
  };
}

// Events.

/**
 * An event from the program window. Coordinates are window pixels with y down, as GLUT gives
 * them; `modifiers` is glutGetModifiers' GLUT_ACTIVE_SHIFT | CTRL | ALT. `menu` is a menu entry
 * chosen with its menu's id; `entry` is the pointer entering (1) or leaving (0) the window.
 */
export type LabEvent =
  | { kind: 'key' | 'keyUp'; key: number; x: number; y: number; modifiers: number }
  | { kind: 'special' | 'specialUp'; key: number; x: number; y: number; modifiers: number }
  | { kind: 'mouse'; button: number; state: number; x: number; y: number; modifiers: number }
  | { kind: 'wheel'; wheel: number; direction: number; x: number; y: number; modifiers: number }
  | { kind: 'motion' | 'passiveMotion'; x: number; y: number }
  | { kind: 'reshape'; width: number; height: number }
  | { kind: 'menu'; menu: number; value: number }
  | { kind: 'entry'; state: number };

const KINDS = ['key', 'keyUp', 'special', 'specialUp', 'mouse', 'motion', 'passiveMotion', 'reshape', 'menu', 'entry', 'wheel'] as const;

/** An event as its EVENT_WORDS words: the kind, then its fields in a fixed order. */
function encode(e: LabEvent): number[] {
  const kind = KINDS.indexOf(e.kind);
  switch (e.kind) {
    case 'key':
    case 'keyUp':
    case 'special':
    case 'specialUp':
      return [kind, e.key, e.x, e.y, e.modifiers];
    case 'mouse':
      return [kind, e.button, e.state, e.x, e.y, e.modifiers];
    case 'wheel':
      return [kind, e.wheel, e.direction, e.x, e.y, e.modifiers];
    case 'motion':
    case 'passiveMotion':
      return [kind, e.x, e.y];
    case 'reshape':
      return [kind, e.width, e.height];
    case 'menu':
      return [kind, e.menu, e.value];
    case 'entry':
      return [kind, e.state];
  }
}

function decode(w: Int32Array, at: number): LabEvent {
  const kind = KINDS[w[at]];
  const [a, b, c, d, e] = [w[at + 1], w[at + 2], w[at + 3], w[at + 4], w[at + 5]];
  switch (kind) {
    case 'key':
    case 'keyUp':
    case 'special':
    case 'specialUp':
      return { kind, key: a, x: b, y: c, modifiers: d };
    case 'mouse':
      return { kind, button: a, state: b, x: c, y: d, modifiers: e };
    case 'wheel':
      return { kind, wheel: a, direction: b, x: c, y: d, modifiers: e };
    case 'motion':
    case 'passiveMotion':
      return { kind, x: a, y: b };
    case 'reshape':
      return { kind, width: a, height: b };
    case 'menu':
      return { kind, menu: a, value: b };
    default:
      return { kind: 'entry', state: a };
  }
}

function wake(control: Int32Array): void {
  Atomics.add(control, CONTROL.SIGNAL, 1);
  Atomics.notify(control, CONTROL.SIGNAL);
}

/** Page: queues an event for the program. False when the ring is full and the event is dropped. */
export function postEvent(views: LayoutViews, event: LabEvent): boolean {
  const { control, events } = views;
  const head = counter(control, CONTROL.EVENT_HEAD, EVENT_SLOTS);
  if (held(head, counter(control, CONTROL.EVENT_TAIL, EVENT_SLOTS), EVENT_SLOTS) >= EVENT_SLOTS) return false;
  const at = (head % EVENT_SLOTS) * EVENT_WORDS;
  events.fill(0, at, at + EVENT_WORDS);
  events.set(encode(event), at);
  Atomics.store(control, CONTROL.EVENT_HEAD, advance(head, 1, EVENT_SLOTS));
  wake(control);
  return true;
}

/** Worker: whether an event is waiting. */
export function eventsWaiting(views: LayoutViews): boolean {
  const { control } = views;
  return counter(control, CONTROL.EVENT_HEAD, EVENT_SLOTS) !== counter(control, CONTROL.EVENT_TAIL, EVENT_SLOTS);
}

/** Worker: takes every event waiting, oldest first. */
export function takeEvents(views: LayoutViews): LabEvent[] {
  const { control, events } = views;
  const head = counter(control, CONTROL.EVENT_HEAD, EVENT_SLOTS);
  const tail = counter(control, CONTROL.EVENT_TAIL, EVENT_SLOTS);
  const out: LabEvent[] = [];
  for (let i = 0, n = held(head, tail, EVENT_SLOTS); i < n; i++) {
    out.push(decode(events, (advance(tail, i, EVENT_SLOTS) % EVENT_SLOTS) * EVENT_WORDS));
  }
  Atomics.store(control, CONTROL.EVENT_TAIL, head);
  return out;
}

// Typed input.

/** Page: what the program waits for in the Console. */
export function inputState(views: LayoutViews): InputState {
  return Atomics.load(views.control, CONTROL.INPUT_STATE) as InputState;
}

/** Page: queues Console input. False, and nothing queued, when it doesn't fit. */
export function sendInput(views: LayoutViews, bytes: Uint8Array): boolean {
  const { control, input } = views;
  const head = counter(control, CONTROL.INPUT_HEAD, INPUT_BYTES);
  if (held(head, counter(control, CONTROL.INPUT_TAIL, INPUT_BYTES), INPUT_BYTES) + bytes.length > INPUT_BYTES) return false;
  for (let i = 0; i < bytes.length; i++) input[(head + i) % INPUT_BYTES] = bytes[i];
  Atomics.store(control, CONTROL.INPUT_HEAD, advance(head, bytes.length, INPUT_BYTES));
  wake(control);
  return true;
}

const encoder = new TextEncoder();

/** Page: the line the student typed, sent when they press Enter; the program reads it with its `\n`. */
export function sendLine(views: LayoutViews, text: string): boolean {
  return sendInput(views, encoder.encode(`${text}\n`));
}

/** Page: one key pressed in the Console while the program waits for a key (13 for Enter, as on Windows). */
export function sendKey(views: LayoutViews, code: number): boolean {
  return sendInput(views, Uint8Array.of(code & 0xff));
}

/** Worker: how many input bytes are waiting. */
export function inputWaiting(views: LayoutViews): number {
  const { control } = views;
  return held(counter(control, CONTROL.INPUT_HEAD, INPUT_BYTES), counter(control, CONTROL.INPUT_TAIL, INPUT_BYTES), INPUT_BYTES);
}

/** Worker: the `offset`th waiting input byte, without taking it. */
export function peekInput(views: LayoutViews, offset: number): number {
  return views.input[(counter(views.control, CONTROL.INPUT_TAIL, INPUT_BYTES) + offset) % INPUT_BYTES];
}

/** Worker: takes the next `count` waiting input bytes. */
export function takeInput(views: LayoutViews, count: number): Uint8Array {
  const out = new Uint8Array(count);
  for (let i = 0; i < count; i++) out[i] = peekInput(views, i);
  const { control } = views;
  Atomics.store(control, CONTROL.INPUT_TAIL, advance(counter(control, CONTROL.INPUT_TAIL, INPUT_BYTES), count, INPUT_BYTES));
  return out;
}

// Program output.

/**
 * Each record in the output ring is a kind byte, a 16-bit little-endian length, then that many
 * bytes: UTF-8 for stdout and stderr, none for a clear.
 */
const OUTPUT_KIND = { stdout: 1, stderr: 2, clear: 3 } as const;
const RECORD_HEADER = 3;
/** The longest record payload. */
export const MAX_OUTPUT_RECORD = OUTPUT_BYTES - RECORD_HEADER;

export type OutputKind = keyof typeof OUTPUT_KIND;

/** Worker: how many record bytes fit in the ring now, header included. */
export function outputRoom(views: LayoutViews): number {
  const { control } = views;
  return OUTPUT_BYTES - held(counter(control, CONTROL.OUTPUT_HEAD, OUTPUT_BYTES), counter(control, CONTROL.OUTPUT_TAIL, OUTPUT_BYTES), OUTPUT_BYTES);
}

/** Worker: appends a record; the caller has made sure it fits (outputRoom). */
export function putOutput(views: LayoutViews, kind: OutputKind, bytes: Uint8Array = new Uint8Array(0)): void {
  const { control, output } = views;
  const head = counter(control, CONTROL.OUTPUT_HEAD, OUTPUT_BYTES);
  const header = [OUTPUT_KIND[kind], bytes.length & 0xff, bytes.length >> 8];
  for (let i = 0; i < RECORD_HEADER; i++) output[(head + i) % OUTPUT_BYTES] = header[i];
  for (let i = 0; i < bytes.length; i++) output[(head + RECORD_HEADER + i) % OUTPUT_BYTES] = bytes[i];
  // The record is complete before the page can see it.
  Atomics.store(control, CONTROL.OUTPUT_HEAD, advance(head, RECORD_HEADER + bytes.length, OUTPUT_BYTES));
}

/** Output the page reads: text on a stream, or system("cls") clearing the Console. */
export type OutputChunk = { stream: 'stdout' | 'stderr'; text: string } | { stream: 'clear' };

/**
 * Page: reads the output ring. Each take returns what the program printed since the last one,
 * consecutive text on one stream joined, and a character split across takes comes out whole.
 *
 * Use one reader for each run: its decoders hold the half of a character a take ended in, so a
 * reader carried into the next run could join the end of one program's output to the start of
 * another's. Build it from the page's own LayoutViews (the ones the page opened, not the
 * worker's). `take()` advances OUTPUT_TAIL and notifies it, which wakes a program waiting for room
 * in the ring. Take on every animation frame, on a timer while the tab is hidden, and once more
 * after `exit` or `crash` arrives, with `finish()`.
 */
export class OutputReader {
  private readonly views: LayoutViews;
  private readonly decoders = { stdout: new TextDecoder(), stderr: new TextDecoder() };

  constructor(views: LayoutViews) {
    this.views = views;
  }

  take(): OutputChunk[] {
    const { control, output } = this.views;
    const head = counter(control, CONTROL.OUTPUT_HEAD, OUTPUT_BYTES);
    let tail = counter(control, CONTROL.OUTPUT_TAIL, OUTPUT_BYTES);
    if (tail === head) return [];
    const chunks: OutputChunk[] = [];
    while (tail !== head) {
      const kind = output[tail % OUTPUT_BYTES];
      const length = output[(tail + 1) % OUTPUT_BYTES] | (output[(tail + 2) % OUTPUT_BYTES] << 8);
      const bytes = new Uint8Array(length);
      for (let i = 0; i < length; i++) bytes[i] = output[(tail + RECORD_HEADER + i) % OUTPUT_BYTES];
      tail = advance(tail, RECORD_HEADER + length, OUTPUT_BYTES);
      if (kind === OUTPUT_KIND.clear) {
        chunks.push({ stream: 'clear' });
        continue;
      }
      const stream = kind === OUTPUT_KIND.stderr ? 'stderr' : 'stdout';
      const text = this.decoders[stream].decode(bytes, { stream: true });
      if (!text) continue;
      const last = chunks[chunks.length - 1];
      if (last && last.stream === stream) last.text += text;
      else chunks.push({ stream, text });
    }
    Atomics.store(control, CONTROL.OUTPUT_TAIL, tail);
    Atomics.notify(control, CONTROL.OUTPUT_TAIL);
    return chunks;
  }

  /**
   * The end of the output: takes what is still in the ring, then ends each stream, so a UTF-8
   * sequence the program stopped in the middle of comes out as U+FFFD and is not dropped. Call it
   * once, after `exit` or `crash`.
   */
  finish(): OutputChunk[] {
    const chunks = this.take();
    for (const stream of ['stdout', 'stderr'] as const) {
      const text = this.decoders[stream].decode();
      if (text) chunks.push({ stream, text });
    }
    return chunks;
  }
}

// Frames.

/** A frame the page can show: `pixels` is width × height RGBA8, top row first. */
export interface Frame {
  frame: number;
  width: number;
  height: number;
  pixels: Uint8Array;
}

/** Page: a larger framebuffer the worker posted. */
export function adoptFramebuffer(views: LayoutViews, buffer: SharedArrayBuffer, generation: number): void {
  views.framebuffer = new Uint8Array(buffer);
  views.generation = generation;
}

/**
 * Page: the newest frame, when it is newer than `since`, in the framebuffer the page holds, and
 * not changed by the worker while it was being read. The page copies the pixels out, then calls
 * acknowledgeFrame.
 */
export function latestFrame(views: LayoutViews, since: number): Frame | null {
  const { control } = views;
  const frame = Atomics.load(control, CONTROL.FRAME);
  const generation = Atomics.load(control, CONTROL.FRAME_GENERATION);
  const width = Atomics.load(control, CONTROL.FRAME_WIDTH);
  const height = Atomics.load(control, CONTROL.FRAME_HEIGHT);
  if (frame === since || generation !== views.generation) return null;
  // A frame published between the loads may have a size from another one: wait for the next.
  if (Atomics.load(control, CONTROL.FRAME) !== frame || Atomics.load(control, CONTROL.FRAME_GENERATION) !== generation) return null;
  if (width <= 0 || height <= 0 || width * height * 4 > views.framebuffer.length) return null;
  return { frame, width, height, pixels: views.framebuffer.subarray(0, width * height * 4) };
}

/** Page: the frame is copied; the program may go on drawing. */
export function acknowledgeFrame(views: LayoutViews, frame: number): void {
  Atomics.store(views.control, CONTROL.FRAME_ACK, frame);
  Atomics.notify(views.control, CONTROL.FRAME_ACK);
}
