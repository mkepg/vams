/**
 * GLUT for the Lab, as FreeGLUT runs it on a lab PC: one window, its callbacks, timers, right-click
 * menus and the bitmap fonts, and a glutMainLoop that really loops.
 *
 * Each pass of the loop takes the window's events from the shared ring and calls their callbacks,
 * fires the timers that are due, calls display when a redisplay is pending, then calls idle when
 * one is set. With no idle callback it sleeps on Atomics.wait until the next timer or the next
 * event. Frames reach the page through the shared framebuffer.
 *
 * glutSwapBuffers doesn't wait for the screen, as it doesn't on the reference: on Intel's driver a
 * composited window's SwapBuffers returns at once, so an idle loop runs as fast as the program can
 * go (about 1,750 frames a second for a trivial frame). The page shows the newest frame at each of
 * its refreshes, as the compositor does. A frame is drawn only when the page has taken the last
 * one published; a frame run before then is held back from drawing (GLContext.hold), which drops
 * it when the frame after clears the whole window, so the frames shown have the pixels drawing
 * every frame would have given. When the program stops to wait (Sleep, the Console, no idle work,
 * or its end), the last frame it ran is drawn and shown.
 *
 * Nothing here relies on the program stopping by itself: the page ends a program by terminating
 * its worker.
 */
import { GLContext, type RasterPool } from '@/shared/lib/gl-raster';
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
import { CONTROL, FRAME_WAIT_MS, type LabEvent, type LayoutViews } from '../model/shared-layout';
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

/**
 * The program's name in FreeGLUT's messages: its argv[0] on a lab PC, where x.bat builds it to
 * c:\openglcpp\Program.exe.
 */
export const PROGRAM_NAME = 'c:\\openglcpp\\Program.exe';

/** How long before a timer is due the runtime stops sleeping and spins, so the timer fires on time; and the most it spins. */
const TIMER_SPIN_MS = 2;
const MAX_SPIN_MS = 16;

/** The window size FreeGLUT opens when glutInitWindowSize was refused, where Windows would choose one. */
const DEFAULT_WINDOW_SIZE = { width: 300, height: 300 };

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
  callback: Callback | null;
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
  /** The threads the window is drawn with (raster-pool.ts); without them, the program's own. */
  pool?: RasterPool | null;
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
  private readonly pool: RasterPool | null;
  private program: ProgramMemory = noProgram;

  private initialised = false;
  private start: number;
  /** glutInitWindowPosition and glutInitWindowSize, used only when both values were accepted, as FreeGLUT's `Use`. */
  private initPosition = { x: -1, y: -1, use: false };
  private initSize = { ...DEFAULT_WINDOW_SIZE, use: true };
  private displayMode = 0;
  private window: Window | null = null;
  /** glutDestroyWindow took the window away; its close callback runs when the loop next closes windows. */
  private closing = false;
  /** Whether an input callback is running, the only time glutGetModifiers has an answer. */
  private inInput = false;
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
  /** Whether the frame being run is held back from drawing, because the page hasn't taken the last one yet. */
  private holding = false;
  /** Whether the last frame was held, so the page hasn't seen it. */
  private unshown = false;
  /** How long before a timer is due the runtime spins rather than sleeps (waitForTimer). */
  private spinMs = TIMER_SPIN_MS;

  constructor({ views, host, console, screen, pool }: GlutOptions) {
    this.pool = pool ?? null;
    this.views = views;
    this.host = host;
    this.console = console;
    this.events = new EventQueue(views, host);
    console.onPause = () => this.showUnshown();
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

  /** FreeGLUT's message prefix: the program's name is known only once glutInit has run. */
  private get prefix(): string {
    return this.initialised ? `freeglut (${PROGRAM_NAME}): ` : 'freeglut ';
  }

  /** FreeGLUT's fgError: the message on stderr, then exit(1). */
  private fail(message: string): never {
    this.console.write('stderr', `${this.prefix}${message}\n`);
    return this.program.exit(1);
  }

  /** FreeGLUT's fgWarning: the message on stderr, and the program carries on. */
  private warn(message: string): void {
    this.console.write('stderr', `${this.prefix}${message}\n`);
  }

  private requireInit(name: string): void {
    if (!this.initialised) this.fail(` ERROR:  Function <${name}> called without first calling 'glutInit'.`);
  }

  /** FREEGLUT_EXIT_IF_NO_WINDOW, for the calls that act on the current window. */
  private requireWindow(name: string): void {
    this.requireInit(name);
    if (!this.window) this.fail(` ERROR:  Function <${name}> called with no current window defined.`);
  }

  // Starting up.

  init(): void {
    if (this.initialised) this.fail('illegal glutInit() reinitialization attempt');
    this.initialised = true;
    this.start = this.host.now();
  }

  initWindowPosition(x: number, y: number): void {
    this.initPosition = { x, y, use: x >= 0 && y >= 0 };
  }

  initWindowSize(width: number, height: number): void {
    this.initSize = { width, height, use: width > 0 && height > 0 };
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
    const size = this.initSize.use ? this.initSize : DEFAULT_WINDOW_SIZE;
    const { width, height } = this.fit(size.width, size.height);
    const { x, y } = this.initPosition.use ? this.initPosition : { x: -1, y: -1 };
    this.window = { title, x, y, width, height };
    this.closing = false;
    this.context = new GLContext(width, height, {
      multisample: (this.displayMode & GLUT.MULTISAMPLE) !== 0,
      memory: () => this.program.heap(),
      pool: this.pool ?? undefined,
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

  /**
   * As FreeGLUT's fgAddToWindowDestroyList: the window stops being current and loses every callback
   * but close at once; the close callback runs when the loop next closes windows (closeWindows).
   */
  destroyWindow(): void {
    this.requireInit('glutDestroyWindow');
    if (!this.window) return;
    this.window = null;
    this.closing = true;
    this.host.post({ type: 'windowClosed' });
    const close = this.callbacks.close;
    for (const name of Object.keys(this.callbacks) as WindowCallback[]) delete this.callbacks[name];
    if (close) this.callbacks.close = close;
  }

  /** FreeGLUT's fgCloseWindows: a destroyed window's close callback runs, and the window is gone. */
  private closeWindows(): void {
    if (!this.closing) return;
    this.closing = false;
    const close = this.callbacks.close;
    delete this.callbacks.close;
    close?.();
  }

  getWindow(): number {
    return this.window ? 1 : 0;
  }

  setWindowTitle(title: string): void {
    this.requireWindow('glutSetWindowTitle');
    this.window!.title = title;
    this.host.post({ type: 'title', title });
  }

  /** Asks the page for a new size; the reshape callback runs when the page sends it back. */
  reshapeWindow(width: number, height: number): void {
    this.requireWindow('glutReshapeWindow');
    const w = this.window!;
    this.host.post({ type: 'window', title: w.title, width, height, x: w.x, y: w.y });
  }

  positionWindow(x: number, y: number): void {
    this.requireWindow('glutPositionWindow');
    this.window!.x = x;
    this.window!.y = y;
    this.postWindow();
  }

  fullScreen(): void {
    this.requireWindow('glutFullScreen');
    this.host.post({ type: 'fullscreen' });
  }

  postRedisplay(): void {
    this.requireWindow('glutPostRedisplay');
    this.redisplay = true;
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

  /** Whether the page has taken every frame published, so the shared framebuffer is free to write. */
  private pageTookLast(): boolean {
    const control = this.views.control;
    return Atomics.load(control, CONTROL.FRAME_ACK) >= Atomics.load(control, CONTROL.FRAME);
  }

  /**
   * Copies the frame to the page, top row first. The page must have taken the last one, or the copy
   * would tear the frame it is reading: a held frame never gets here, and a frame shown as the
   * program stops to wait waits for the page, at most FRAME_WAIT_MS.
   */
  private publish(): void {
    const control = this.views.control;
    const deadline = this.host.now() + FRAME_WAIT_MS;
    while (!this.pageTookLast()) {
      const left = deadline - this.host.now();
      if (left <= 0) break;
      this.host.wait(CONTROL.FRAME_ACK, Atomics.load(control, CONTROL.FRAME_ACK), left);
    }
    const { width, height, color } = this.context.fb;
    const row = width * 4;
    this.ensureFramebuffer(row * height);
    const out = this.views.framebuffer;
    for (let y = 0; y < height; y++) out.set(color.subarray((height - 1 - y) * row, (height - y) * row), y * row);
    Atomics.store(control, CONTROL.FRAME_WIDTH, width);
    Atomics.store(control, CONTROL.FRAME_HEIGHT, height);
    Atomics.store(control, CONTROL.FRAME_GENERATION, this.views.generation);
    Atomics.add(control, CONTROL.FRAME, 1);
    this.published = true;
  }

  /**
   * The end of a frame: a drawn frame goes to the page, without waiting for the screen. Then whether
   * the next frame is drawn: only when the page has taken this one. A frame run before then would be
   * replaced before the page could show it, so it is held, which costs next to nothing. A scene slow
   * to draw in software therefore still runs its frames, and a program paced by the clock keeps its
   * pace; the page shows the newest frame drawn.
   */
  private present(): void {
    this.unshown = this.holding;
    if (this.holding) this.published = true;
    else this.publish();
    this.holding = !this.pageTookLast();
    this.context.hold(this.holding);
  }

  /** Shows the last frame if it was held: when the program stops to wait, it is what stays on screen. */
  private showUnshown(): void {
    if (!this.unshown || !this.window) return;
    this.unshown = false;
    this.holding = false;
    this.context.hold(false);
    this.publish();
  }

  swapBuffers(): void {
    this.requireWindow('glutSwapBuffers');
    this.present();
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

  /** Sets a callback of the current window; without one, FreeGLUT quietly does nothing. */
  private setWindowCallback(name: WindowCallback, callback: Callback | null, fn: string): void {
    this.requireInit(fn);
    if (!this.window) return;
    if (callback) this.callbacks[name] = callback;
    else delete this.callbacks[name];
  }

  displayFunc(callback: Callback | null): void {
    this.requireInit('glutDisplayFunc');
    if (!callback) this.fail('Fatal error in program.  NULL display callback not permitted in GLUT 3.0+ or freeglut 2.0.1+');
    this.setWindowCallback('display', callback, 'glutDisplayFunc');
  }
  reshapeFunc(callback: Callback | null): void {
    this.setWindowCallback('reshape', callback, 'glutReshapeFunc');
  }
  keyboardFunc(callback: Callback | null): void {
    this.setWindowCallback('keyboard', callback, 'glutKeyboardFunc');
  }
  keyboardUpFunc(callback: Callback | null): void {
    this.setWindowCallback('keyboardUp', callback, 'glutKeyboardUpFunc');
  }
  specialFunc(callback: Callback | null): void {
    this.setWindowCallback('special', callback, 'glutSpecialFunc');
  }
  specialUpFunc(callback: Callback | null): void {
    this.setWindowCallback('specialUp', callback, 'glutSpecialUpFunc');
  }
  mouseFunc(callback: Callback | null): void {
    this.setWindowCallback('mouse', callback, 'glutMouseFunc');
  }
  motionFunc(callback: Callback | null): void {
    this.setWindowCallback('motion', callback, 'glutMotionFunc');
  }
  passiveMotionFunc(callback: Callback | null): void {
    this.setWindowCallback('passiveMotion', callback, 'glutPassiveMotionFunc');
  }
  mouseWheelFunc(callback: Callback | null): void {
    this.setWindowCallback('wheel', callback, 'glutMouseWheelFunc');
  }
  closeFunc(callback: Callback | null): void {
    this.setWindowCallback('close', callback, 'glutCloseFunc');
  }

  idleFunc(callback: Callback | null): void {
    this.requireInit('glutIdleFunc');
    this.idle = callback;
  }

  /** glutTimerFunc: `callback(value)` once, `ms` from now; timers due at the same time fire in the order they were set. */
  timerFunc(ms: number, callback: Callback | null, value: number): void {
    this.requireInit('glutTimerFunc');
    if (!callback) return;
    const due = this.host.now() + Math.max(0, ms);
    const at = this.timers.findIndex((t) => t.due > due);
    this.timers.splice(at < 0 ? this.timers.length : at, 0, { due, callback, value });
  }

  // Menus.

  /** glutCreateMenu: FreeGLUT makes the menu even with a NULL callback; choosing from it then calls nothing here. */
  createMenu(callback: Callback | null): number {
    this.requireInit('glutCreateMenu');
    const id = this.nextMenu++;
    this.menus.set(id, { callback, entries: [] });
    this.currentMenu = id;
    this.menusChanged = true;
    return id;
  }

  destroyMenu(id: number): void {
    this.requireInit('glutDestroyMenu');
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
    this.requireInit('glutAddMenuEntry');
    this.addEntry({ label, value });
  }

  addSubMenu(label: string, submenu: number): void {
    this.requireInit('glutAddSubMenu');
    if (this.menus.has(submenu)) this.addEntry({ label, submenu });
  }

  attachMenu(button: number): void {
    this.requireInit('glutAttachMenu');
    if (!this.window || !this.menus.has(this.currentMenu)) return;
    this.attached.set(button, this.currentMenu);
    this.menusChanged = true;
  }

  detachMenu(button: number): void {
    this.requireInit('glutDetachMenu');
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

  /** glutGet. GLUT_ELAPSED_TIME answers before glutInit, as FreeGLUT's does; an unknown query warns and answers -1. */
  get(query: number): number {
    if (query === GLUT.ELAPSED_TIME) return Math.floor(this.host.now() - this.start);
    this.requireInit('glutGet');
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
        return this.initPosition.use ? this.initPosition.x : -1;
      case GLUT.INIT_WINDOW_Y:
        return this.initPosition.use ? this.initPosition.y : -1;
      case GLUT.INIT_WINDOW_WIDTH:
        return this.initSize.use ? this.initSize.width : -1;
      case GLUT.INIT_WINDOW_HEIGHT:
        return this.initSize.use ? this.initSize.height : -1;
    }
    this.warn(`glutGet(): missing enum handle ${query}`);
    return -1;
  }

  /** The Shift, Ctrl and Alt keys held for the event being handled. Outside an input callback FreeGLUT warns and answers 0. */
  getModifiers(): number {
    this.requireInit('glutGetModifiers');
    if (!this.inInput) {
      this.warn('glutGetModifiers() called outside an input callback');
      return 0;
    }
    return this.modifiers;
  }

  setOption(option: number, value: number): void {
    this.requireInit('glutSetOption');
    if (option === GLUT.ACTION_ON_WINDOW_CLOSE) this.actionOnClose = value;
  }

  // Bitmap text.

  /** The bitmap font a handle names; any other handle warns, as FreeGLUT's fghFontByID does. */
  private font(handle: number, fn: string): BitmapFont | null {
    this.requireInit(fn);
    const name = GLUT_FONT_HANDLES[handle];
    if (name) return GLUT_FONTS[name];
    const address = (handle >>> 0).toString(16).toUpperCase().padStart(8, '0');
    // FreeGLUT's own message ends in a newline, and fgWarning adds another.
    this.warn(`${fn}: bitmap font 0x${address} not found. Make sure you're not passing a stroke font.\n`);
    return null;
  }

  bitmapCharacter(handle: number, character: number): void {
    const f = this.font(handle, 'glutBitmapCharacter');
    if (f) glutBitmapCharacter(this.context, f, character);
  }

  bitmapString(handle: number, text: ArrayLike<number>): void {
    const f = this.font(handle, 'glutBitmapString');
    if (f) glutBitmapString(this.context, f, text);
  }

  bitmapWidth(handle: number, character: number): number {
    const f = this.font(handle, 'glutBitmapWidth');
    return f ? glutBitmapWidth(f, character) : 0;
  }

  bitmapLength(handle: number, text: ArrayLike<number>): number {
    const f = this.font(handle, 'glutBitmapLength');
    return f ? glutBitmapLength(f, text) : 0;
  }

  bitmapHeight(handle: number): number {
    const f = this.font(handle, 'glutBitmapHeight');
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

  /** Runs an input callback, with glutGetModifiers answering `modifiers` while it runs. */
  private withModifiers(modifiers: number, run: () => void): void {
    this.modifiers = modifiers;
    this.inInput = true;
    try {
      run();
    } finally {
      this.modifiers = 0;
      this.inInput = false;
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
          menu.callback?.(e.value);
        } finally {
          this.currentMenu = current;
        }
        return;
      }
      case 'entry':
        // The 2D set has no glutEntryFunc, so entering or leaving the window calls nothing.
        return;
      case 'close':
        // FreeGLUT's WM_CLOSE: the window is destroyed and its close callback runs at once; the loop then ends.
        if (!this.window) return;
        this.destroyWindow();
        this.closeWindows();
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
    const due = this.timers.length ? this.timers[0].due : Infinity;
    if (due <= this.host.now()) return;
    this.showUnshown();
    if (due === Infinity) this.events.waitForEvent(Infinity);
    else this.waitForTimer(due);
  }

  /**
   * Waits until `due` on the host's clock, or an event. A browser's wait can wake late, by a
   * millisecond or by a whole 15.6 ms Windows tick, where FreeGLUT's timers fire within half a
   * millisecond. So the runtime sleeps until `spinMs` before `due` and spins the rest; `spinMs`
   * grows to the latest wake it has seen (up to MAX_SPIN_MS) and eases back to TIMER_SPIN_MS when
   * wakes are on time. A clock that doesn't move while spinning (a test's) gets a plain wait instead.
   */
  private waitForTimer(due: number): void {
    const wake = due - this.spinMs;
    if (wake > this.host.now()) {
      this.events.waitForEvent(wake - this.host.now());
      const late = this.host.now() - wake;
      this.spinMs = late > 0 ? Math.min(MAX_SPIN_MS, Math.max(this.spinMs, late + 1)) : Math.max(TIMER_SPIN_MS, this.spinMs * 0.9);
    }
    let last = this.host.now();
    let still = 0;
    while (!this.events.waiting) {
      const now = this.host.now();
      if (now >= due) return;
      if (now === last && ++still > 1000) return this.events.waitForEvent(due - now);
      if (now !== last) still = 0;
      last = now;
    }
  }

  mainLoop(): void {
    this.requireInit('glutMainLoop');
    if (!this.window && !this.closing) this.fail(' ERROR:  glutMainLoop called with no windows created.');
    // FreeGLUT's own message ends in a newline, and fgError adds another.
    const noDisplay = 'ERROR:  No display callback registered for window 1\n';
    if (!this.window) {
      // A window destroyed before the loop: FreeGLUT closes it, then finds it has no display callback.
      this.closeWindows();
      this.fail(noDisplay);
    }
    if (!this.callbacks.display) this.fail(noDisplay);
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
      // The page has taken the last frame since this one was held: draw it now, rather than spin
      // until the program's next step brings a frame to draw. It is the newest frame the program ran.
      if (this.unshown && this.pageTookLast()) {
        this.showUnshown();
        // Then as after any frame: the next is held until the page takes this one.
        this.holding = !this.pageTookLast();
        this.context.hold(this.holding);
      }
      if (this.idle) this.idle();
      else this.sleepForWork();
    }
    this.running = false;
    this.showUnshown();
    this.closeWindows();
    // FreeGLUT's fgDeinitialize: the window still open is closed, and glutInit is forgotten.
    if (this.window) {
      this.destroyWindow();
      this.closeWindows();
    }
    this.initialised = false;
    if (this.actionOnClose === GLUT.ACTION_EXIT) this.program.exit(0);
  }

  leaveMainLoop(): void {
    this.requireInit('glutLeaveMainLoop');
    this.running = false;
  }
}
