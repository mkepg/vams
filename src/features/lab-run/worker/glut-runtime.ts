/**
 * GLUT for the Lab, as FreeGLUT runs it on a lab PC: one window, its callbacks, timers, right-click
 * menus and the bitmap fonts, and a glutMainLoop that really loops.
 *
 * Each pass of the loop takes the window's events from the shared ring and calls their callbacks,
 * fires the timers that are due, calls display when a redisplay is pending, then calls idle when
 * one is set. With no idle callback it sleeps on Atomics.wait until the next timer or the next
 * event. Frames reach the page through the shared framebuffer: glutSwapBuffers (and glFlush in a
 * GLUT_SINGLE window) copies the frame there and waits, at most FRAME_WAIT_MS, for the page to take
 * it, as a lab PC waits for vsync.
 *
 * The program keeps one frame a page refresh, as a lab PC with vsync does and as the editor's Run
 * does, however long a frame takes to draw. A frame that took longer than a refresh puts the
 * program behind the page's refreshes (CONTROL.TICK), and it catches up by running the next frames
 * without drawing them: the GL context holds their drawing back (GLContext.hold), and drops it
 * when the frame after clears the whole window, so the frames shown have the pixels drawing every
 * frame would have given. An animation therefore moves at the same speed as in the editor; a
 * frame that is slow to draw only shows fewer of its steps.
 *
 * Nothing here relies on the program stopping by itself: the page ends a program by terminating
 * its worker.
 */
import { GLContext } from '@/shared/lib/gl-raster';
import {
  GLUT_FONTS,
  GLUT_FONT_HANDLES,
  glutBitmapCharacter,
  glutBitmapHeight,
  glutBitmapLength,
  glutBitmapString,
  glutBitmapWidth,
  type BitmapFont,
} from '@/shared/lib/glut-fonts';
import type { LabMenuEntry } from '../model/protocol';
import { CONTROL, FRAME_WAIT_MS, MAX_FRAMES_BEHIND, type LabEvent, type LayoutViews } from '../model/shared-layout';
import type { ConsoleIO } from './console-io';
import { EventQueue, type WorkerHost } from './event-queue';

/** The GLUT constants the runtime reads, with the values of the Lab's GL/freeglut_std.h and freeglut_ext.h. */
export const GLUT = {
  LEFT_BUTTON: 0,
  MIDDLE_BUTTON: 1,
  RIGHT_BUTTON: 2,
  DOWN: 0,
  UP: 1,
  DOUBLE: 0x0002,
  MULTISAMPLE: 0x0080,
  WINDOW_X: 0x0064,
  WINDOW_Y: 0x0065,
  WINDOW_WIDTH: 0x0066,
  WINDOW_HEIGHT: 0x0067,
  SCREEN_WIDTH: 0x00c8,
  SCREEN_HEIGHT: 0x00c9,
  INIT_WINDOW_X: 0x01f4,
  INIT_WINDOW_Y: 0x01f5,
  INIT_WINDOW_WIDTH: 0x01f6,
  INIT_WINDOW_HEIGHT: 0x01f7,
  ELAPSED_TIME: 0x02bc,
  ACTION_ON_WINDOW_CLOSE: 0x01f9,
  ACTION_EXIT: 0,
  ACTION_GLUTMAINLOOP_RETURNS: 1,
  ACTION_CONTINUE_EXECUTION: 2,
} as const;

/** What the program's main module gives the runtime once it has loaded. */
export interface ProgramMemory {
  /** The program's memory, as it is now (it can grow). */
  heap(): Uint8Array;
  /** The C library's exit: ends the program with `code`. */
  exit(code: number): never;
}

type Callback = (...args: number[]) => void;

interface Timer {
  due: number;
  callback: Callback;
  value: number;
}

interface Menu {
  callback: Callback;
  entries: LabMenuEntry[];
}

interface Window {
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The window callbacks, which need a window, as in FreeGLUT. */
type WindowCallback = 'display' | 'reshape' | 'keyboard' | 'keyboardUp' | 'special' | 'specialUp' | 'mouse' | 'motion' | 'passiveMotion' | 'wheel' | 'close';

export interface GlutOptions {
  views: LayoutViews;
  host: WorkerHost;
  console: ConsoleIO;
  /** What GLUT_SCREEN_WIDTH and GLUT_SCREEN_HEIGHT answer. */
  screen?: { width: number; height: number };
}

const noProgram: ProgramMemory = {
  heap: () => new Uint8Array(0),
  exit: (code) => {
    throw new Error(`exit(${code}) before the program loaded`);
  },
};

export class GlutRuntime {
  private readonly views: LayoutViews;
  private readonly host: WorkerHost;
  private readonly console: ConsoleIO;
  private readonly events: EventQueue;
  private readonly screen: { width: number; height: number };
  private program: ProgramMemory = noProgram;

  private initialised = false;
  private start: number;
  private initPosition = { x: -1, y: -1 };
  private initSize = { width: 300, height: 300 };
  private displayMode = 0;
  private window: Window | null = null;
  private context = new GLContext(1, 1);
  private readonly callbacks: Partial<Record<WindowCallback, Callback>> = {};
  private idle: Callback | null = null;
  private timers: Timer[] = [];
  private readonly menus = new Map<number, Menu>();
  private nextMenu = 1;
  private currentMenu = 0;
  private readonly attached = new Map<number, number>();
  private menusChanged = false;
  private redisplay = false;
  private reshapePending = false;
  private running = false;
  private actionOnClose: number = GLUT.ACTION_EXIT;
  private modifiers = 0;
  private published = false;
  /** The page refresh before the first frame, and the frames since, run or drawn (present()). */
  private pace: { base: number; frames: number } | null = null;
  /** Whether the frame being run is held back from drawing, to catch up with the page. */
  private catchingUp = false;
  /** Whether the last frame was run to catch up, so the page hasn't seen it. */
  private unshown = false;

  constructor({ views, host, console, screen }: GlutOptions) {
    this.views = views;
    this.host = host;
    this.console = console;
    this.events = new EventQueue(views, host);
    this.screen = screen ?? { width: 1920, height: 1080 };
    this.start = host.now();
  }

  /** The program's memory and exit, once its main module has loaded. */
  connect(program: ProgramMemory): void {
    this.program = program;
  }

  /** The GL context the program draws with: the window's, or a 1 × 1 one before there is a window. */
  get gl(): GLContext {
    return this.context;
  }

  /** FreeGLUT's fgError: the message on stderr, then exit(1). */
  private fail(message: string): never {
    this.console.write('stderr', `freeglut (program): ${message}\n`);
    return this.program.exit(1);
  }

  private requireInit(name: string): void {
    if (!this.initialised) this.fail(` ERROR:  Function <${name}> called without first calling 'glutInit'.`);
  }

  // Starting up.

  init(): void {
    this.initialised = true;
    this.start = this.host.now();
  }

  initWindowPosition(x: number, y: number): void {
    this.initPosition = { x, y };
  }

  initWindowSize(width: number, height: number): void {
    if (width > 0 && height > 0) this.initSize = { width, height };
  }

  initDisplayMode(mode: number): void {
    this.displayMode = mode;
  }

  // The window.

  /** A window size held to the screen, as Windows holds a window, so a huge one can't exhaust memory. */
  private fit(width: number, height: number): { width: number; height: number } {
    return {
      width: Math.max(1, Math.min(this.screen.width, Math.trunc(width))),
      height: Math.max(1, Math.min(this.screen.height, Math.trunc(height))),
    };
  }

  createWindow(title: string): number {
    this.requireInit('glutCreateWindow');
    const { width, height } = this.fit(this.initSize.width, this.initSize.height);
    this.window = { title, x: this.initPosition.x, y: this.initPosition.y, width, height };
    this.context = new GLContext(width, height, {
      multisample: (this.displayMode & GLUT.MULTISAMPLE) !== 0,
      memory: () => this.program.heap(),
    });
    this.ensureFramebuffer(width * height * 4);
    this.postWindow();
    // The window system sends the new window a reshape, then a paint.
    this.reshapePending = true;
    this.redisplay = true;
    return 1;
  }

  private postWindow(): void {
    const w = this.window;
    if (w) this.host.post({ type: 'window', title: w.title, width: w.width, height: w.height, x: w.x, y: w.y });
  }

  destroyWindow(): void {
    if (!this.window) return;
    this.callbacks.close?.();
    this.window = null;
  }

  getWindow(): number {
    return this.window ? 1 : 0;
  }

  setWindowTitle(title: string): void {
    if (!this.window) return;
    this.window.title = title;
    this.host.post({ type: 'title', title });
  }

  /** Asks the page for a new size; the reshape callback runs when the page sends it back. */
  reshapeWindow(width: number, height: number): void {
    if (!this.window) return;
    this.host.post({ type: 'window', title: this.window.title, width, height, x: this.window.x, y: this.window.y });
  }

  positionWindow(x: number, y: number): void {
    if (!this.window) return;
    this.window.x = x;
    this.window.y = y;
    this.postWindow();
  }

  fullScreen(): void {
    if (this.window) this.host.post({ type: 'fullscreen' });
  }

  postRedisplay(): void {
    if (this.window) this.redisplay = true;
  }

  // Frames.

  private get doubleBuffered(): boolean {
    return (this.displayMode & GLUT.DOUBLE) !== 0;
  }

  /** Makes sure the shared framebuffer holds `bytes`; a larger one is posted to the page. */
  private ensureFramebuffer(bytes: number): void {
    const views = this.views;
    if (bytes <= views.framebuffer.length) return;
    const buffer = new SharedArrayBuffer(Math.max(bytes, Math.ceil(views.framebuffer.length * 1.5)));
    views.framebuffer = new Uint8Array(buffer);
    views.generation += 1;
    this.host.post({ type: 'framebuffer', buffer, generation: views.generation });
  }

  /** Copies the frame to the page, top row first, and waits for the page to take it. */
  private publish(): void {
    const { width, height, color } = this.context.fb;
    const row = width * 4;
    this.ensureFramebuffer(row * height);
    const out = this.views.framebuffer;
    for (let y = 0; y < height; y++) out.set(color.subarray((height - 1 - y) * row, (height - y) * row), y * row);
    const control = this.views.control;
    Atomics.store(control, CONTROL.FRAME_WIDTH, width);
    Atomics.store(control, CONTROL.FRAME_HEIGHT, height);
    Atomics.store(control, CONTROL.FRAME_GENERATION, this.views.generation);
    const frame = Atomics.add(control, CONTROL.FRAME, 1) + 1;
    this.published = true;
    const deadline = this.host.now() + FRAME_WAIT_MS;
    for (;;) {
      const ack = Atomics.load(control, CONTROL.FRAME_ACK);
      if (ack >= frame) return;
      const left = deadline - this.host.now();
      if (left <= 0) return;
      this.host.wait(CONTROL.FRAME_ACK, ack, left);
    }
  }

  /**
   * The end of a frame: it goes to the page, unless it was run to catch up. Then whether the next
   * frame is drawn: not while the program is behind the page's refreshes, so it catches up.
   */
  private present(): void {
    this.unshown = this.catchingUp;
    if (this.catchingUp) this.published = true;
    else this.publish();
    const tick = Atomics.load(this.views.control, CONTROL.TICK);
    // The first frame belongs to the refresh it was drawn in.
    this.pace ??= { base: tick - 1, frames: 0 };
    this.pace.frames += 1;
    let behind = tick - this.pace.base - this.pace.frames;
    if (behind > MAX_FRAMES_BEHIND) {
      this.pace.base = tick - this.pace.frames;
      behind = 0;
    }
    this.catchingUp = behind > 0;
    this.context.hold(this.catchingUp);
  }

  /** Shows the last frame if it was run to catch up: when the program stops to wait, it is what stays on screen. */
  private showUnshown(): void {
    if (!this.unshown || !this.window) return;
    this.unshown = false;
    this.catchingUp = false;
    this.context.hold(false);
    this.publish();
  }

  swapBuffers(): void {
    if (this.window) this.present();
  }

  /** glFlush: in a GLUT_SINGLE window the frame goes to the page; a double-buffered one shows it at the swap. */
  flush(): void {
    this.context.flush();
    if (this.window && !this.doubleBuffered) this.present();
  }

  finish(): void {
    this.context.finish();
    if (this.window && !this.doubleBuffered) this.present();
  }

  // Callbacks.

  private setWindowCallback(name: WindowCallback, callback: Callback | null): void {
    if (!this.window) return;
    if (callback) this.callbacks[name] = callback;
    else delete this.callbacks[name];
  }

  displayFunc(callback: Callback | null): void {
    if (!callback) this.fail('Fatal error in program.  NULL display callback not permitted in GLUT 3.0+ or freeglut 2.0.1+');
    this.setWindowCallback('display', callback);
  }
  reshapeFunc(callback: Callback | null): void {
    this.setWindowCallback('reshape', callback);
  }
  keyboardFunc(callback: Callback | null): void {
    this.setWindowCallback('keyboard', callback);
  }
  keyboardUpFunc(callback: Callback | null): void {
    this.setWindowCallback('keyboardUp', callback);
  }
  specialFunc(callback: Callback | null): void {
    this.setWindowCallback('special', callback);
  }
  specialUpFunc(callback: Callback | null): void {
    this.setWindowCallback('specialUp', callback);
  }
  mouseFunc(callback: Callback | null): void {
    this.setWindowCallback('mouse', callback);
  }
  motionFunc(callback: Callback | null): void {
    this.setWindowCallback('motion', callback);
  }
  passiveMotionFunc(callback: Callback | null): void {
    this.setWindowCallback('passiveMotion', callback);
  }
  mouseWheelFunc(callback: Callback | null): void {
    this.setWindowCallback('wheel', callback);
  }
  closeFunc(callback: Callback | null): void {
    this.setWindowCallback('close', callback);
  }

  idleFunc(callback: Callback | null): void {
    this.idle = callback;
  }

  /** glutTimerFunc: `callback(value)` once, `ms` from now; timers due at the same time fire in the order they were set. */
  timerFunc(ms: number, callback: Callback | null, value: number): void {
    if (!callback) return;
    const due = this.host.now() + Math.max(0, ms);
    const at = this.timers.findIndex((t) => t.due > due);
    this.timers.splice(at < 0 ? this.timers.length : at, 0, { due, callback, value });
  }

  // Menus.

  createMenu(callback: Callback | null): number {
    if (!callback) return 0;
    const id = this.nextMenu++;
    this.menus.set(id, { callback, entries: [] });
    this.currentMenu = id;
    this.menusChanged = true;
    return id;
  }

  destroyMenu(id: number): void {
    if (!this.menus.delete(id)) return;
    for (const [button, menu] of this.attached) if (menu === id) this.attached.delete(button);
    if (this.currentMenu === id) this.currentMenu = 0;
    this.menusChanged = true;
  }

  private addEntry(entry: LabMenuEntry): void {
    const menu = this.menus.get(this.currentMenu);
    if (!menu) return;
    menu.entries.push(entry);
    this.menusChanged = true;
  }

  addMenuEntry(label: string, value: number): void {
    this.addEntry({ label, value });
  }

  addSubMenu(label: string, submenu: number): void {
    if (this.menus.has(submenu)) this.addEntry({ label, submenu });
  }

  attachMenu(button: number): void {
    if (!this.window || !this.menus.has(this.currentMenu)) return;
    this.attached.set(button, this.currentMenu);
    this.menusChanged = true;
  }

  detachMenu(button: number): void {
    if (this.attached.delete(button)) this.menusChanged = true;
  }

  private sendMenus(): void {
    if (!this.menusChanged) return;
    this.menusChanged = false;
    this.host.post({
      type: 'menus',
      tree: [...this.menus].map(([id, m]) => ({ id, entries: m.entries.map((e) => ({ ...e })) })),
      attached: [...this.attached].map(([button, menu]) => ({ button, menu })),
    });
  }

  // State.

  get(query: number): number {
    const w = this.window;
    switch (query) {
      case GLUT.WINDOW_X:
        return w ? w.x : 0;
      case GLUT.WINDOW_Y:
        return w ? w.y : 0;
      case GLUT.WINDOW_WIDTH:
        return w ? w.width : 0;
      case GLUT.WINDOW_HEIGHT:
        return w ? w.height : 0;
      case GLUT.SCREEN_WIDTH:
        return this.screen.width;
      case GLUT.SCREEN_HEIGHT:
        return this.screen.height;
      case GLUT.INIT_WINDOW_X:
        return this.initPosition.x;
      case GLUT.INIT_WINDOW_Y:
        return this.initPosition.y;
      case GLUT.INIT_WINDOW_WIDTH:
        return this.initSize.width;
      case GLUT.INIT_WINDOW_HEIGHT:
        return this.initSize.height;
      case GLUT.ELAPSED_TIME:
        return Math.floor(this.host.now() - this.start);
    }
    return -1;
  }

  /** The Shift, Ctrl and Alt keys held for the event being handled; 0 outside an input callback. */
  getModifiers(): number {
    return this.modifiers;
  }

  setOption(option: number, value: number): void {
    if (option === GLUT.ACTION_ON_WINDOW_CLOSE) this.actionOnClose = value;
  }

  // Bitmap text.

  private font(handle: number): BitmapFont | null {
    const name = GLUT_FONT_HANDLES[handle];
    return name ? GLUT_FONTS[name] : null;
  }

  bitmapCharacter(handle: number, character: number): void {
    const f = this.font(handle);
    if (f) glutBitmapCharacter(this.context, f, character);
  }

  bitmapString(handle: number, text: ArrayLike<number>): void {
    const f = this.font(handle);
    if (f) glutBitmapString(this.context, f, text);
  }

  bitmapWidth(handle: number, character: number): number {
    const f = this.font(handle);
    return f ? glutBitmapWidth(f, character) : 0;
  }

  bitmapLength(handle: number, text: ArrayLike<number>): number {
    const f = this.font(handle);
    return f ? glutBitmapLength(f, text) : 0;
  }

  bitmapHeight(handle: number): number {
    const f = this.font(handle);
    return f ? glutBitmapHeight(f) : 0;
  }

  // The main loop.

  /** A new window size from the page: a new framebuffer, then the reshape callback, then a redisplay. */
  private reshape(width: number, height: number): void {
    const w = this.window;
    if (!w) return;
    ({ width, height } = this.fit(width, height));
    if (width !== this.context.width || height !== this.context.height) {
      this.ensureFramebuffer(width * height * 4);
      this.context.resize(width, height);
    }
    w.width = width;
    w.height = height;
    const reshape = this.callbacks.reshape;
    // FreeGLUT's default reshape sets the viewport to the whole window.
    if (reshape) reshape(width, height);
    else this.context.viewport(0, 0, width, height);
    this.redisplay = true;
  }

  private withModifiers(modifiers: number, run: () => void): void {
    this.modifiers = modifiers;
    try {
      run();
    } finally {
      this.modifiers = 0;
    }
  }

  private dispatch(e: LabEvent): void {
    const cb = this.callbacks;
    switch (e.kind) {
      case 'key':
        return this.withModifiers(e.modifiers, () => cb.keyboard?.(e.key & 0xff, e.x, e.y));
      case 'keyUp':
        return this.withModifiers(e.modifiers, () => cb.keyboardUp?.(e.key & 0xff, e.x, e.y));
      case 'special':
        return this.withModifiers(e.modifiers, () => cb.special?.(e.key, e.x, e.y));
      case 'specialUp':
        return this.withModifiers(e.modifiers, () => cb.specialUp?.(e.key, e.x, e.y));
      case 'mouse':
        // A button with a menu attached opens the menu instead.
        if (this.attached.has(e.button)) return;
        return this.withModifiers(e.modifiers, () => cb.mouse?.(e.button, e.state, e.x, e.y));
      case 'wheel':
        return this.withModifiers(e.modifiers, () => {
          if (cb.wheel) return cb.wheel(e.wheel, e.direction, e.x, e.y);
          // Without a wheel callback, FreeGLUT reports a turn as a press and release of button 3 (up) or 4.
          const button = e.direction > 0 ? 3 : 4;
          cb.mouse?.(button, GLUT.DOWN, e.x, e.y);
          cb.mouse?.(button, GLUT.UP, e.x, e.y);
        });
      case 'motion':
        return cb.motion?.(e.x, e.y);
      case 'passiveMotion':
        return cb.passiveMotion?.(e.x, e.y);
      case 'reshape':
        return this.reshape(e.width, e.height);
      case 'menu': {
        const menu = this.menus.get(e.menu);
        if (!menu) return;
        const current = this.currentMenu;
        this.currentMenu = e.menu;
        try {
          menu.callback(e.value);
        } finally {
          this.currentMenu = current;
        }
        return;
      }
      case 'entry':
        // The 2D set has no glutEntryFunc, so entering or leaving the window calls nothing.
        return;
    }
  }

  private fireTimers(): void {
    const now = this.host.now();
    while (this.timers.length && this.timers[0].due <= now) {
      const t = this.timers.shift()!;
      t.callback(t.value);
    }
  }

  /** Sleeps until the next timer, or until an event arrives. */
  private sleepForWork(): void {
    if (this.redisplay || this.reshapePending || this.events.waiting) return;
    const timeout = this.timers.length ? this.timers[0].due - this.host.now() : Infinity;
    if (timeout <= 0) return;
    this.showUnshown();
    this.events.waitForEvent(timeout);
  }

  mainLoop(): void {
    this.requireInit('glutMainLoop');
    if (this.window && !this.callbacks.display) this.fail(' ERROR:  No display callback registered for window 1');
    this.running = true;
    while (this.running && this.window) {
      this.sendMenus();
      if (this.reshapePending) {
        this.reshapePending = false;
        this.reshape(this.window.width, this.window.height);
      }
      for (const e of this.events.take()) this.dispatch(e);
      this.fireTimers();
      if (this.redisplay && this.window && this.callbacks.display) {
        this.redisplay = false;
        this.published = false;
        this.callbacks.display();
        // A GLUT_SINGLE window shows what display drew even when it never calls glFlush.
        if (!this.doubleBuffered && !this.published && this.window) this.present();
      }
      if (!this.running || !this.window) break;
      if (this.idle) this.idle();
      else this.sleepForWork();
    }
    this.running = false;
    this.showUnshown();
    if (this.actionOnClose === GLUT.ACTION_EXIT) this.program.exit(0);
  }

  leaveMainLoop(): void {
    this.running = false;
  }
}
