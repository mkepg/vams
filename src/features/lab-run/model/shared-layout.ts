/**
 * The memory the Lab page and the program's worker share: one SharedArrayBuffer, laid out as
 *
 *   control words   CONTROL_WORDS × Int32, at 0
 *   event ring      EVENT_SLOTS events of EVENT_WORDS × Int32, page to worker
 *   input buffer    INPUT_BYTES of typed Console input, page to worker, as a byte ring
 *   framebuffer     the rest: the last frame, RGBA8, top row first, worker to page
 *
 * Every ring has one writer and one reader, each owning one of its two counters, so neither side
 * ever takes a lock. After writing an event or input the page bumps SIGNAL and notifies it, which
 * is the one word the worker sleeps on while it waits for anything.
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
} as const;

export const CONTROL_WORDS = 16;
export const EVENT_SLOTS = 256;
export const EVENT_WORDS = 8;
export const INPUT_BYTES = 8192;
/** The longest a frame waits for the page to take it, as a lab PC's vsync waits. */
export const FRAME_WAIT_MS = 100;
/** The framebuffer a new layout holds: a 1024 × 768 window. */
export const DEFAULT_FRAMEBUFFER_BYTES = 1024 * 768 * 4;

const EVENTS_OFFSET = CONTROL_WORDS * 4;
const INPUT_OFFSET = EVENTS_OFFSET + EVENT_SLOTS * EVENT_WORDS * 4;
const FRAMEBUFFER_OFFSET = INPUT_OFFSET + INPUT_BYTES;

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
  const head = Atomics.load(control, CONTROL.EVENT_HEAD);
  if (head - Atomics.load(control, CONTROL.EVENT_TAIL) >= EVENT_SLOTS) return false;
  const at = (head % EVENT_SLOTS) * EVENT_WORDS;
  events.fill(0, at, at + EVENT_WORDS);
  events.set(encode(event), at);
  Atomics.store(control, CONTROL.EVENT_HEAD, head + 1);
  wake(control);
  return true;
}

/** Worker: whether an event is waiting. */
export function eventsWaiting(views: LayoutViews): boolean {
  return Atomics.load(views.control, CONTROL.EVENT_HEAD) !== Atomics.load(views.control, CONTROL.EVENT_TAIL);
}

/** Worker: takes every event waiting, oldest first. */
export function takeEvents(views: LayoutViews): LabEvent[] {
  const { control, events } = views;
  const head = Atomics.load(control, CONTROL.EVENT_HEAD);
  let tail = Atomics.load(control, CONTROL.EVENT_TAIL);
  const out: LabEvent[] = [];
  for (; tail !== head; tail++) out.push(decode(events, (tail % EVENT_SLOTS) * EVENT_WORDS));
  Atomics.store(control, CONTROL.EVENT_TAIL, tail);
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
  const head = Atomics.load(control, CONTROL.INPUT_HEAD);
  if (head - Atomics.load(control, CONTROL.INPUT_TAIL) + bytes.length > INPUT_BYTES) return false;
  for (let i = 0; i < bytes.length; i++) input[(head + i) % INPUT_BYTES] = bytes[i];
  Atomics.store(control, CONTROL.INPUT_HEAD, head + bytes.length);
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
  return Atomics.load(views.control, CONTROL.INPUT_HEAD) - Atomics.load(views.control, CONTROL.INPUT_TAIL);
}

/** Worker: the `offset`th waiting input byte, without taking it. */
export function peekInput(views: LayoutViews, offset: number): number {
  return views.input[(Atomics.load(views.control, CONTROL.INPUT_TAIL) + offset) % INPUT_BYTES];
}

/** Worker: takes the next `count` waiting input bytes. */
export function takeInput(views: LayoutViews, count: number): Uint8Array {
  const out = new Uint8Array(count);
  for (let i = 0; i < count; i++) out[i] = peekInput(views, i);
  Atomics.add(views.control, CONTROL.INPUT_TAIL, count);
  return out;
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
 * Page: the newest frame, when it is newer than `since` and in the framebuffer the page holds.
 * The page copies the pixels out, then calls acknowledgeFrame.
 */
export function latestFrame(views: LayoutViews, since: number): Frame | null {
  const { control } = views;
  const frame = Atomics.load(control, CONTROL.FRAME);
  if (frame === since || Atomics.load(control, CONTROL.FRAME_GENERATION) !== views.generation) return null;
  const width = Atomics.load(control, CONTROL.FRAME_WIDTH);
  const height = Atomics.load(control, CONTROL.FRAME_HEIGHT);
  return { frame, width, height, pixels: views.framebuffer.subarray(0, width * height * 4) };
}

/** Page: the frame is copied; the program may go on drawing. */
export function acknowledgeFrame(views: LayoutViews, frame: number): void {
  Atomics.store(views.control, CONTROL.FRAME_ACK, frame);
  Atomics.notify(views.control, CONTROL.FRAME_ACK);
}
