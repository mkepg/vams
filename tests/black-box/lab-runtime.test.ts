/**
 * BLACK-BOX TEST SUITE — BB-LAB (the worker runtime)
 * The GLUT runtime, the Console and the file list a Lab program runs on, driven the way the main
 * module's imports drive them: a fake program written as TypeScript callbacks, so no compiler is
 * needed.
 *
 * Test focus:
 *  - Window events from the shared ring reach the program's callbacks, with GLUT's coordinates
 *  - Reshape, idle and timers run as FreeGLUT's main loop runs them
 *  - Typed input, getch, system() and Sleep wait for the Console as a lab PC's console does
 *  - Menus, window messages, files, display lists and bitmap text
 *  - Output in a tight loop arrives batched, and the Console keeps its last 5,000 lines
 *
 * Most tests run the runtime on a clock of their own: each time it would block, the test plays
 * the page (sends an event, a key, or takes a frame) and moves the clock on, so they are exact and
 * quick. BB-LAB-23 blocks for real, with Atomics.wait in a worker thread, while the test thread
 * is the page.
 */
import { resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import { build, type Rollup } from 'vite';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { GL, GLContext } from '@/shared/lib/gl-raster';
import { GLUT_FONTS, glutBitmapString } from '@/shared/lib/glut-fonts';
import { appendConsole, consoleLines, emptyConsole, CONSOLE_LINES } from '@/features/lab-run/model/console-lines';
import type { WorkerMessage } from '@/features/lab-run/model/protocol';
import {
  acknowledgeFrame,
  CONTROL,
  createSharedLayout,
  INPUT_STATE,
  inputState,
  latestFrame,
  openLayout,
  postEvent,
  sendKey,
  sendLine,
  adoptFramebuffer,
  type Frame,
  type LabEvent,
} from '@/features/lab-run/model/shared-layout';
import { ConsoleIO, PAUSE_PROMPT, systemMessage } from '@/features/lab-run/worker/console-io';
import type { WorkerHost } from '@/features/lab-run/worker/event-queue';
import { GLUT, GlutRuntime } from '@/features/lab-run/worker/glut-runtime';
import { fileReports, installFiles, missingMessage, type FSStream, type LabFS } from '@/features/lab-run/worker/lab-files';
import type { ConsoleCall, ConsoleReply } from '../helpers/lab-console-worker';

/** exit() from the program, as the fake program's C library throws it. */
class ProgramExit extends Error {
  readonly code: number;
  constructor(code: number) {
    super(`exit(${code})`);
    this.code = code;
  }
}

interface Wait {
  index: number;
  timeout: number;
  at: number;
}

/**
 * A runtime on the test's clock, with the page played by the test. When the runtime would block,
 * the page takes any frame waiting for it, or does the next of `page.actions`; when there is nothing
 * to do, the clock moves on by the timeout.
 */
function lab(framebufferBytes?: number) {
  const layout = createSharedLayout(framebufferBytes);
  const worker = openLayout(layout);
  const pageViews = openLayout(layout);
  const messages: WorkerMessage[] = [];
  const frames: Frame[] = [];
  const waits: Wait[] = [];
  const actions: (() => void)[] = [];
  const page = {
    views: pageViews,
    messages,
    frames,
    waits,
    actions,
    clock: 0,
    send: (...events: LabEvent[]) => actions.push(() => events.forEach((e) => expect(postEvent(pageViews, e)).toBe(true))),
  };
  let seen = 0;
  const takeFrame = () => {
    for (const m of messages) if (m.type === 'framebuffer') adoptFramebuffer(pageViews, m.buffer, m.generation);
    const f = latestFrame(pageViews, seen);
    if (!f) return false;
    seen = f.frame;
    frames.push({ ...f, pixels: f.pixels.slice() });
    acknowledgeFrame(pageViews, f.frame);
    return true;
  };
  const host: WorkerHost = {
    post: (m) => messages.push(m),
    now: () => page.clock,
    wait: (index, value, timeout) => {
      if (Atomics.load(worker.control, index) !== value) return;
      waits.push({ index, timeout, at: page.clock });
      if (waits.length > 10_000) throw new Error('the runtime kept waiting');
      if (index === CONTROL.FRAME_ACK && takeFrame()) return;
      const action = actions.shift();
      if (action) return action();
      if (!Number.isFinite(timeout)) throw new Error('the runtime would wait for ever');
      page.clock += timeout;
    },
  };
  const io = new ConsoleIO(worker, host);
  const glut = new GlutRuntime({ views: worker, host, console: io });
  glut.connect({
    heap: () => new Uint8Array(0),
    flush: () => {},
    exit: (code) => {
      throw new ProgramExit(code);
    },
  });
  return { page, worker, io, glut, host };
}

/** glutInit, a window and a loop that returns when it is left, as `glutSetOption` allows. */
function openWindow(glut: GlutRuntime, width = 200, height = 100, mode: number = GLUT.DOUBLE): void {
  glut.init();
  glut.initDisplayMode(mode);
  glut.initWindowSize(width, height);
  glut.initWindowPosition(40, 30);
  glut.createWindow('Test');
  glut.setOption(GLUT.ACTION_ON_WINDOW_CLOSE, GLUT.ACTION_GLUTMAINLOOP_RETURNS);
}

const text = (messages: WorkerMessage[], type: 'stdout' | 'stderr') =>
  messages.flatMap((m) => (m.type === type ? [m.text] : [])).join('');

const bytes = (s: string) => new TextEncoder().encode(s);

describe('BB-LAB-20: Keyboard, special, mouse and motion callbacks get the window’s events', () => {
  it('each callback gets its event’s values, in the order the page sent them, y down in window pixels', () => {
    const { page, glut } = lab();
    openWindow(glut);
    const got: unknown[][] = [];
    glut.displayFunc(() => glut.swapBuffers());
    glut.keyboardFunc((k, x, y) => got.push(['key', k, x, y, glut.getModifiers()]));
    glut.keyboardUpFunc((k, x, y) => got.push(['keyUp', k, x, y]));
    glut.specialFunc((k, x, y) => got.push(['special', k, x, y, glut.getModifiers()]));
    glut.specialUpFunc((k, x, y) => got.push(['specialUp', k, x, y]));
    glut.mouseFunc((b, s, x, y) => got.push(['mouse', b, s, x, y]));
    glut.motionFunc((x, y) => got.push(['motion', x, y]));
    glut.passiveMotionFunc((x, y) => {
      got.push(['passiveMotion', x, y]);
      glut.leaveMainLoop();
    });
    page.send(
      { kind: 'key', key: 97, x: 10, y: 20, modifiers: 1 },
      { kind: 'keyUp', key: 97, x: 10, y: 20, modifiers: 0 },
      { kind: 'special', key: 0x64, x: 11, y: 21, modifiers: 2 },
      { kind: 'specialUp', key: 0x64, x: 11, y: 21, modifiers: 0 },
      // Near the bottom-left corner of a 200 × 100 window, as GLUT counts y: from the top.
      { kind: 'mouse', button: GLUT.LEFT_BUTTON, state: GLUT.DOWN, x: 3, y: 97, modifiers: 0 },
      { kind: 'motion', x: 50, y: 60 },
      { kind: 'mouse', button: GLUT.LEFT_BUTTON, state: GLUT.UP, x: 50, y: 60, modifiers: 0 },
      { kind: 'passiveMotion', x: 199, y: 0 },
    );
    glut.mainLoop();
    expect(got).toEqual([
      ['key', 97, 10, 20, 1],
      ['keyUp', 97, 10, 20],
      ['special', 0x64, 11, 21, 2],
      ['specialUp', 0x64, 11, 21],
      ['mouse', GLUT.LEFT_BUTTON, GLUT.DOWN, 3, 97],
      ['motion', 50, 60],
      ['mouse', GLUT.LEFT_BUTTON, GLUT.UP, 50, 60],
      ['passiveMotion', 199, 0],
    ]);
    // Outside a callback there are no modifiers.
    expect(glut.getModifiers()).toBe(0);
  });

  it('a wheel turn reaches the mouse callback as buttons 3 and 4 when there is no wheel callback', () => {
    const { page, glut } = lab();
    openWindow(glut);
    const got: number[][] = [];
    glut.displayFunc(() => glut.swapBuffers());
    glut.mouseFunc((b, s, x, y) => {
      got.push([b, s, x, y]);
      if (got.length === 4) glut.leaveMainLoop();
    });
    page.send(
      { kind: 'wheel', wheel: 0, direction: 1, x: 5, y: 6, modifiers: 0 },
      { kind: 'wheel', wheel: 0, direction: -1, x: 5, y: 6, modifiers: 0 },
    );
    glut.mainLoop();
    expect(got).toEqual([
      [3, GLUT.DOWN, 5, 6],
      [3, GLUT.UP, 5, 6],
      [4, GLUT.DOWN, 5, 6],
      [4, GLUT.UP, 5, 6],
    ]);
  });
});

describe('BB-LAB-21: A reshape calls the reshape callback and resizes the framebuffer', () => {
  it('the callback gets the new size, the context draws at it, and a larger framebuffer is posted', () => {
    const { page, glut } = lab(200 * 100 * 4);
    openWindow(glut, 200, 100);
    const sizes: number[][] = [];
    glut.reshapeFunc((w, h) => {
      sizes.push([w, h]);
      glut.gl.viewport(0, 0, w, h);
    });
    glut.displayFunc(() => {
      glut.gl.clearColor(0, 0, 1, 1);
      glut.gl.clear(GL.COLOR_BUFFER_BIT);
      glut.swapBuffers();
      if (sizes.length === 2) glut.leaveMainLoop();
    });
    page.send({ kind: 'reshape', width: 320, height: 240 });
    glut.mainLoop();
    // The window's first reshape, as it opens, then the page's.
    expect(sizes).toEqual([
      [200, 100],
      [320, 240],
    ]);
    expect([glut.gl.fb.width, glut.gl.fb.height]).toEqual([320, 240]);
    expect([glut.get(GLUT.WINDOW_WIDTH), glut.get(GLUT.WINDOW_HEIGHT)]).toEqual([320, 240]);
    const posted = page.messages.filter((m) => m.type === 'framebuffer');
    expect(posted).toHaveLength(1);
    expect(posted[0].type === 'framebuffer' && posted[0].buffer.byteLength).toBeGreaterThanOrEqual(320 * 240 * 4);
    const last = page.frames[page.frames.length - 1];
    expect([last.width, last.height]).toEqual([320, 240]);
    for (let i = 0; i < last.pixels.length; i += 4) {
      if (last.pixels[i + 2] !== 255 || last.pixels[i] !== 0) throw new Error(`pixel ${i / 4} is not blue`);
    }
  });

  it('without a reshape callback the viewport follows the window, as FreeGLUT’s default reshape does', () => {
    const { page, glut } = lab();
    openWindow(glut, 20, 10);
    let passes = 0;
    glut.displayFunc(() => {
      const gl = glut.gl;
      gl.matrixMode(GL.PROJECTION);
      gl.loadIdentity();
      gl.ortho2D(0, 1, 0, 1);
      gl.clear(GL.COLOR_BUFFER_BIT);
      gl.rectf(0, 0, 1, 1);
      glut.swapBuffers();
      if (++passes === 2) glut.leaveMainLoop();
    });
    page.send({ kind: 'reshape', width: 40, height: 30 });
    glut.mainLoop();
    const last = page.frames[page.frames.length - 1];
    // The rectangle fills the whole 40 × 30 window.
    expect(last.pixels.every((v) => v === 255)).toBe(true);
  });
});

describe('BB-LAB-22: Idle runs again and again, and timers fire in order at their times', () => {
  it('idle is called on every pass, and timers fire in time order, in the order set when due together', () => {
    const { page, glut } = lab();
    openWindow(glut);
    const fired: number[][] = [];
    glut.displayFunc(() => glut.swapBuffers());
    glut.timerFunc(100, (v) => fired.push([v, glut.get(GLUT.ELAPSED_TIME)]), 1);
    glut.timerFunc(50, (v) => fired.push([v, glut.get(GLUT.ELAPSED_TIME)]), 2);
    glut.timerFunc(50, (v) => fired.push([v, glut.get(GLUT.ELAPSED_TIME)]), 3);
    let idles = 0;
    glut.idleFunc(() => {
      idles++;
      page.clock += 10;
      if (page.clock >= 150) glut.leaveMainLoop();
    });
    glut.mainLoop();
    expect(idles).toBe(15);
    expect(fired).toEqual([
      [2, 50],
      [3, 50],
      [1, 100],
    ]);
  });

  it('with no idle callback the loop sleeps until the next timer is due', () => {
    const { page, glut } = lab();
    openWindow(glut);
    const fired: number[] = [];
    glut.displayFunc(() => glut.swapBuffers());
    glut.timerFunc(30, () => fired.push(page.clock), 0);
    glut.timerFunc(80, () => {
      fired.push(page.clock);
      glut.leaveMainLoop();
    }, 0);
    glut.mainLoop();
    expect(fired).toEqual([30, 80]);
    const sleeps = page.waits.filter((w) => w.index === CONTROL.SIGNAL);
    expect(sleeps.map((w) => [w.at, w.timeout])).toEqual([
      [0, 30],
      [30, 50],
    ]);
  });

  it('a timer that sets itself again keeps firing at its interval', () => {
    const { page, glut } = lab();
    openWindow(glut);
    const fired: number[] = [];
    glut.displayFunc(() => glut.swapBuffers());
    const tick = (v: number) => {
      fired.push(page.clock);
      if (v < 4) glut.timerFunc(16, tick, v + 1);
      else glut.leaveMainLoop();
    };
    glut.timerFunc(16, tick, 1);
    glut.mainLoop();
    expect(fired).toEqual([16, 32, 48, 64]);
  });

  it('glutGet(GLUT_ELAPSED_TIME) counts milliseconds from glutInit', () => {
    const { page, glut } = lab();
    page.clock = 500;
    glut.init();
    page.clock = 750.6;
    expect(glut.get(GLUT.ELAPSED_TIME)).toBe(250);
  });
});

describe('BB-LAB-23: readLine blocks until a line is in the input buffer, then returns it with \\n', () => {
  let workerCode = '';

  beforeAll(async () => {
    const out = (await build({
      configFile: false,
      logLevel: 'silent',
      resolve: { alias: { '@': resolve(__dirname, '../../src') } },
      build: {
        ssr: resolve(__dirname, '../helpers/lab-console-worker.ts'),
        write: false,
        minify: false,
        rollupOptions: { output: { format: 'cjs' } },
      },
    })) as Rollup.RollupOutput | Rollup.RollupOutput[];
    workerCode = (Array.isArray(out) ? out[0] : out).output[0].code;
  }, 60_000);

  let worker: Worker | null = null;
  afterEach(async () => {
    await worker?.terminate();
    worker = null;
  });

  const until = async (ready: () => boolean, ms = 5000) => {
    const end = Date.now() + ms;
    while (!ready()) {
      if (Date.now() > end) throw new Error('timed out');
      await new Promise((r) => setTimeout(r, 5));
    }
  };

  it('a worker thread blocked in readLine on Atomics.wait wakes with the line the page sends', async () => {
    const layout = createSharedLayout(0);
    const page = openLayout(layout);
    const replies: ConsoleReply[] = [];
    const calls: ConsoleCall[] = [{ write: 'How many? ' }, 'readLine', 'getch'];
    worker = new Worker(workerCode, { eval: true, workerData: { layout, calls } });
    worker.on('message', (r: ConsoleReply) => replies.push(r));
    await until(() => inputState(page) === INPUT_STATE.LINE);
    // The prompt reached the page before the program blocked, and nothing has come back since.
    await until(() => replies.length > 0);
    await new Promise((r) => setTimeout(r, 100));
    expect(replies).toEqual([{ posted: { type: 'stdout', text: 'How many? ' } }]);
    expect(sendLine(page, '42 apples')).toBe(true);
    await until(() => replies.length === 2);
    expect(replies[1]).toEqual({ result: '42 apples\n' });
    // Then it waits for a key, and the line's state is gone.
    await until(() => inputState(page) === INPUT_STATE.KEY);
    sendKey(page, 13);
    await until(() => replies.length === 3);
    expect(replies[2]).toEqual({ result: 13 });
    expect(inputState(page)).toBe(INPUT_STATE.NONE);
  });

  it('stdin reads a line a piece at a time, and blocks for the next only at its end', () => {
    const { page, io } = lab();
    page.actions.push(() => sendLine(page.views, '12 34'));
    const read = (n: number) => new TextDecoder().decode(io.readStdin(n));
    expect(read(3)).toBe('12 ');
    expect(read(100)).toBe('34\n');
    expect(page.waits).toHaveLength(1);
    page.actions.push(() => {
      expect(inputState(page.views)).toBe(INPUT_STATE.LINE);
      sendLine(page.views, 'next');
    });
    expect(read(100)).toBe('next\n');
    expect(page.waits).toHaveLength(2);
    expect(inputState(page.views)).toBe(INPUT_STATE.NONE);
  });
});

describe('BB-LAB-24: getch returns one key without echo, and getche echoes it', () => {
  it('getch waits for a key in the Console and prints nothing', () => {
    const { page, io } = lab();
    page.actions.push(() => {
      expect(inputState(page.views)).toBe(INPUT_STATE.KEY);
      sendKey(page.views, 'q'.charCodeAt(0));
    });
    expect(io.getch()).toBe(113);
    io.flush();
    expect(text(page.messages, 'stdout')).toBe('');
    expect(page.waits).toHaveLength(1);
  });

  it('getche waits for a key and echoes it', () => {
    const { page, io } = lab();
    page.actions.push(() => sendKey(page.views, 'z'.charCodeAt(0)));
    expect(io.getche()).toBe(122);
    io.flush();
    expect(text(page.messages, 'stdout')).toBe('z');
  });

  it('kbhit says whether a key is waiting, without waiting', () => {
    const { page, io } = lab();
    expect(io.kbhit()).toBe(false);
    // From the first kbhit, the Console sends its keys.
    expect(inputState(page.views)).toBe(INPUT_STATE.KEY);
    sendKey(page.views, 'x'.charCodeAt(0));
    expect(io.kbhit()).toBe(true);
    expect(io.getch()).toBe(120);
    expect(page.waits).toHaveLength(0);
  });
});

describe('BB-LAB-25: system() handles pause and cls, names any other command, and Sleep waits', () => {
  it('system("pause") prints its line, then waits for a key', () => {
    const { page, io } = lab();
    page.actions.push(() => {
      expect(text(page.messages, 'stdout')).toBe(PAUSE_PROMPT);
      expect(PAUSE_PROMPT).toBe('Press any key to continue . . .');
      sendKey(page.views, 13);
    });
    expect(io.system('pause')).toBe(0);
    io.flush();
    expect(text(page.messages, 'stdout')).toBe(`${PAUSE_PROMPT}\n`);
    expect(page.waits).toHaveLength(1);
  });

  it('system("pause>nul") waits for a key without printing', () => {
    const { page, io } = lab();
    page.actions.push(() => sendKey(page.views, 32));
    expect(io.system('pause>nul')).toBe(0);
    io.flush();
    expect(text(page.messages, 'stdout')).toBe('');
    expect(page.waits).toHaveLength(1);
  });

  it('system("cls") posts a clear after what was printed before it', () => {
    const { page, io } = lab();
    io.write('stdout', 'old');
    expect(io.system('cls')).toBe(0);
    expect(page.messages.map((m) => m.type)).toEqual(['stdout', 'clear']);
  });

  it('system("dir") prints the line naming it and returns 1', () => {
    const { page, io } = lab();
    expect(io.system('dir')).toBe(1);
    io.flush();
    expect(systemMessage('dir')).toBe('system("dir") doesn\'t run in the Lab.');
    expect(text(page.messages, 'stderr')).toBe('system("dir") doesn\'t run in the Lab.\n');
  });

  it('Sleep(ms) waits its whole time on a word that never changes', () => {
    const { page, io } = lab();
    io.sleep(30);
    expect(page.waits).toEqual([{ index: CONTROL.SLEEP, timeout: 30, at: 0 }]);
    expect(page.clock).toBe(30);
    // Events and input wake the program's other waits, never Sleep.
    postEvent(page.views, { kind: 'key', key: 1, x: 0, y: 0, modifiers: 0 });
    expect(Atomics.load(page.views.control, CONTROL.SLEEP)).toBe(0);
  });
});

describe('BB-LAB-26: A menu entry calls its menu’s callback with its value', () => {
  it('the page gets the menus, and an entry of the menu or its submenu calls the right callback', () => {
    const { page, glut } = lab();
    openWindow(glut);
    const calls: string[] = [];
    glut.displayFunc(() => glut.swapBuffers());
    glut.mouseFunc((b) => calls.push(`mouse ${b}`));
    const colours = glut.createMenu((v) => calls.push(`colours ${v}`));
    glut.addMenuEntry('Red', 1);
    glut.addMenuEntry('Green', 2);
    const main = glut.createMenu((v) => {
      calls.push(`main ${v}`);
      if (v === 9) glut.leaveMainLoop();
    });
    glut.addSubMenu('Colour', colours);
    glut.addMenuEntry('Quit', 9);
    glut.attachMenu(GLUT.RIGHT_BUTTON);
    page.send(
      // The button with a menu opens the menu; the program's mouse callback doesn't see it.
      { kind: 'mouse', button: GLUT.RIGHT_BUTTON, state: GLUT.DOWN, x: 5, y: 5, modifiers: 0 },
      { kind: 'menu', menu: colours, value: 2 },
      { kind: 'mouse', button: GLUT.LEFT_BUTTON, state: GLUT.DOWN, x: 5, y: 5, modifiers: 0 },
      { kind: 'menu', menu: main, value: 9 },
    );
    glut.mainLoop();
    expect(calls).toEqual(['colours 2', `mouse ${GLUT.LEFT_BUTTON}`, 'main 9']);
    expect(page.messages.filter((m) => m.type === 'menus')).toEqual([
      {
        type: 'menus',
        tree: [
          { id: colours, entries: [{ label: 'Red', value: 1 }, { label: 'Green', value: 2 }] },
          { id: main, entries: [{ label: 'Colour', submenu: colours }, { label: 'Quit', value: 9 }] },
        ],
        attached: [{ button: GLUT.RIGHT_BUTTON, menu: main }],
      },
    ]);
  });
});

/** Emscripten's FS as far as the Lab uses it: flat paths, O_CREAT, O_TRUNC and ENOENT. */
class FakeFS implements LabFS {
  readonly files = new Map<string, Uint8Array>();
  open(path: unknown, flags: number | string): FSStream {
    const f = typeof flags === 'string' ? ({ r: 0, w: 577, a: 1089 } as Record<string, number>)[flags] : flags;
    const p = String(path);
    if (!this.files.has(p)) {
      if (!(f & 64)) throw Object.assign(new Error('FS error'), { errno: 44 });
      this.files.set(p, new Uint8Array(0));
    } else if (f & 512) this.files.set(p, new Uint8Array(0));
    return { path: p };
  }
  close(stream: FSStream): void {
    void stream;
  }
  stat(path: unknown) {
    const data = this.files.get(String(path));
    if (!data) throw Object.assign(new Error('FS error'), { errno: 44 });
    return { size: data.length };
  }
  mkdir(): void {}
  writeFile(path: string, data: Uint8Array): void {
    this.files.set(path, data.slice());
  }
  readFile(path: string): Uint8Array {
    const data = this.files.get(path);
    if (!data) throw Object.assign(new Error('FS error'), { errno: 44 });
    return data;
  }
  /** What a write through `stream` leaves in its file. */
  append(stream: FSStream, data: Uint8Array): void {
    const p = (stream as { path: string }).path;
    const old = this.files.get(p)!;
    const next = new Uint8Array(old.length + data.length);
    next.set(old);
    next.set(data, old.length);
    this.files.set(p, next);
  }
  contents(stream: FSStream): Uint8Array {
    return this.readFile((stream as { path: string }).path);
  }
}

function filesLab() {
  const { page, io, host } = lab();
  const fs = new FakeFS();
  const png = Uint8Array.of(0x89, 0x50, 0x4e, 0x47);
  const input = bytes('3 4\n');
  const files = installFiles(
    fs,
    [
      { name: 'skibidi.png', bytes: png },
      { name: 'Input.txt', bytes: input },
    ],
    fileReports(io, host),
    ['/main.wasm'],
  );
  return { page, io, fs, files, png, input };
}

describe('BB-LAB-27: A path finds the uploaded file by its name, whatever its folder or case', () => {
  it('a Windows path, ./Input.txt and input.txt open the files in the list', () => {
    const { fs, png, input } = filesLab();
    expect(fs.contents(fs.open('C:\\Users\\x\\Desktop\\skibidi.png', 0))).toEqual(png);
    expect(fs.contents(fs.open('./Input.txt', 0))).toEqual(input);
    expect(fs.contents(fs.open('input.txt', 'r'))).toEqual(input);
    // Emscripten hands FS.open the path joined to the working directory.
    expect(fs.contents(fs.open('/C:\\Users\\x\\Desktop\\SKIBIDI.PNG', 0))).toEqual(png);
    expect(fs.stat('./INPUT.TXT')).toEqual({ size: input.length });
  });

  it('a name not in the list fails, and the Console says which name it looked for, once', () => {
    const { page, io, fs } = filesLab();
    expect(() => fs.open('C:\\lab\\nothere.txt', 0)).toThrow();
    expect(() => fs.open('nothere.txt', 0)).toThrow();
    io.flush();
    expect(missingMessage('nothere.txt')).toBe("Looked for nothere.txt, which isn't in your files.");
    expect(text(page.messages, 'stderr')).toBe("Looked for nothere.txt, which isn't in your files.\n");
  });

  it('the runtime’s own paths are left alone', () => {
    const { fs } = filesLab();
    fs.writeFile('/main.wasm', Uint8Array.of(0, 0x61, 0x73, 0x6d));
    expect(fs.contents(fs.open('/main.wasm', 0))).toEqual(Uint8Array.of(0, 0x61, 0x73, 0x6d));
  });
});

describe('BB-LAB-28: A file the program writes is posted with its bytes when it closes', () => {
  it('a new file is posted by its name, and an existing one keeps the list’s spelling', () => {
    const { page, fs } = filesLab();
    const out = fs.open('C:\\Users\\x\\Desktop\\Result.txt', 'w');
    fs.append(out, bytes('7\n'));
    expect(page.messages.filter((m) => m.type === 'fileWritten')).toEqual([]);
    fs.close(out);
    const again = fs.open('INPUT.TXT', 577);
    fs.append(again, bytes('5 6\n'));
    fs.close(again);
    expect(page.messages.filter((m) => m.type === 'fileWritten')).toEqual([
      { type: 'fileWritten', name: 'Result.txt', bytes: bytes('7\n') },
      { type: 'fileWritten', name: 'Input.txt', bytes: bytes('5 6\n') },
    ]);
    // The written file is in the list now, for the program to read back.
    expect(fs.contents(fs.open('result.txt', 0))).toEqual(bytes('7\n'));
  });

  it('a file still open when the program ends is posted too', () => {
    const { page, fs, files } = filesLab();
    fs.append(fs.open('log.txt', 'a'), bytes('done'));
    files.closeAll();
    expect(page.messages.filter((m) => m.type === 'fileWritten')).toEqual([{ type: 'fileWritten', name: 'log.txt', bytes: bytes('done') }]);
  });
});

describe('BB-LAB-29: The window’s title and full screen reach the page', () => {
  it('glutCreateWindow, glutSetWindowTitle and glutFullScreen post their messages', () => {
    const { page, glut } = lab();
    openWindow(glut, 500, 400);
    glut.setWindowTitle('Moving square');
    glut.fullScreen();
    expect(page.messages).toEqual([
      { type: 'window', title: 'Test', width: 500, height: 400, x: 40, y: 30 },
      { type: 'title', title: 'Moving square' },
      { type: 'fullscreen' },
    ]);
  });

  it('a GLUT call before glutInit stops the program with FreeGLUT’s message', () => {
    const { page, glut, io } = lab();
    expect(() => glut.createWindow('x')).toThrow(ProgramExit);
    io.flush();
    expect(text(page.messages, 'stderr')).toContain("Function <glutCreateWindow> called without first calling 'glutInit'.");
  });
});

/** A 64 × 32 scene through `gl`: a display list's red square, then "Hi" in 9 × 15 at (20, 10). */
function drawScene(gl: GLContext, string: (text: ArrayLike<number>) => void): void {
  gl.matrixMode(GL.PROJECTION);
  gl.loadIdentity();
  gl.ortho2D(0, 64, 0, 32);
  gl.matrixMode(GL.MODELVIEW);
  gl.clear(GL.COLOR_BUFFER_BIT);
  const list = gl.genLists(1);
  gl.newList(list, GL.COMPILE);
  gl.color3f(1, 0, 0);
  gl.rectf(2, 2, 10, 10);
  gl.endList();
  gl.callList(list);
  gl.color3f(1, 1, 1);
  gl.rasterPos2i(20, 10);
  string(bytes('Hi'));
}

describe('BB-LAB-30: Display lists and glutBitmapString draw through the context', () => {
  it('the frame the page gets is the scene, top row first', () => {
    const { page, glut } = lab();
    openWindow(glut, 64, 32);
    glut.displayFunc(() => {
      drawScene(glut.gl, (t) => glut.bitmapString(2, t));
      glut.swapBuffers();
      glut.leaveMainLoop();
    });
    glut.mainLoop();
    expect(page.frames).toHaveLength(1);
    const frame = page.frames[0];
    // The same calls on a context of its own, with GLUT_BITMAP_9_BY_15 (handle 2) from glut-fonts.
    const reference = new GLContext(64, 32);
    drawScene(reference, (t) => glutBitmapString(reference, GLUT_FONTS.GLUT_BITMAP_9_BY_15, t));
    const row = 64 * 4;
    for (let y = 0; y < 32; y++) {
      const top = frame.pixels.subarray((31 - y) * row, (32 - y) * row);
      expect(Array.from(top)).toEqual(Array.from(reference.fb.color.subarray(y * row, (y + 1) * row)));
    }
    const px = (x: number, y: number) => Array.from(frame.pixels.subarray(((31 - y) * 64 + x) * 4, ((31 - y) * 64 + x) * 4 + 4));
    expect(px(5, 5)).toEqual([255, 0, 0, 255]);
    const white = [];
    for (let i = 0; i < frame.pixels.length; i += 4) if (frame.pixels[i] === 255 && frame.pixels[i + 1] === 255) white.push(i);
    expect(white.length).toBeGreaterThan(10);
  });

  it('a GLUT_SINGLE window shows each glFlush', () => {
    const { page, glut } = lab();
    openWindow(glut, 4, 4, 0);
    glut.displayFunc(() => {
      glut.gl.clearColor(0, 1, 0, 1);
      glut.gl.clear(GL.COLOR_BUFFER_BIT);
      glut.flush();
      glut.leaveMainLoop();
    });
    glut.mainLoop();
    expect(page.frames).toHaveLength(1);
    expect(Array.from(page.frames[0].pixels.subarray(0, 4))).toEqual([0, 255, 0, 255]);
  });
});

describe('BB-LAB-31: Output in a tight loop arrives batched, and the Console keeps the last 5,000 lines', () => {
  it('100,000 lines arrive in a few messages, all of them, and the Console shows the last 5,000', () => {
    const { page, io } = lab();
    let all = '';
    for (let i = 0; i < 100_000; i++) {
      const line = `line ${i}\n`;
      all += line;
      io.write('stdout', bytes(line));
      page.clock += 0.01;
    }
    io.flush();
    const batches = page.messages.filter((m) => m.type === 'stdout');
    expect(batches.length).toBeLessThan(200);
    expect(text(page.messages, 'stdout')).toBe(all);
    let log = emptyConsole();
    for (const m of batches) if (m.type === 'stdout') log = appendConsole(log, 'stdout', m.text);
    const lines = consoleLines(log);
    expect(CONSOLE_LINES).toBe(5000);
    expect(lines).toHaveLength(5000);
    expect(lines[0]).toEqual({ stream: 'stdout', text: 'line 95000' });
    expect(lines[4999]).toEqual({ stream: 'stdout', text: 'line 99999' });
  });

  it('a line split across batches, and a character split across them, come out whole', () => {
    let log = emptyConsole();
    log = appendConsole(log, 'stdout', 'Enter a ');
    log = appendConsole(log, 'stdout', 'number: ');
    expect(consoleLines(log)).toEqual([{ stream: 'stdout', text: 'Enter a number: ' }]);
    log = appendConsole(log, 'stderr', 'oops\n');
    expect(consoleLines(log)).toEqual([
      { stream: 'stdout', text: 'Enter a number: ' },
      { stream: 'stderr', text: 'oops' },
    ]);
    const { page, io } = lab();
    const peso = bytes('₱5\n');
    io.write('stdout', peso.subarray(0, 2));
    io.flush();
    io.write('stdout', peso.subarray(2));
    io.flush();
    expect(text(page.messages, 'stdout')).toBe('₱5\n');
  });

  it('what a program prints, and what stdio still holds, reaches the page before it blocks', () => {
    const { page, io } = lab();
    // stdio's line buffer, as vams_flush hands it over.
    let held = 'Name: ';
    io.connect(() => {
      io.write('stdout', bytes(held));
      held = '';
    });
    io.write('stdout', bytes('first\n'));
    page.actions.push(() => {
      expect(text(page.messages, 'stdout')).toBe('first\nName: ');
      sendLine(page.views, 'Ada');
    });
    expect(io.readLine()).toBe('Ada\n');
  });

  it('a few lines go at once, so a program that prints and then never waits still shows them', () => {
    const { page, io } = lab();
    for (const line of ['a\n', 'b\n', 'c\n']) io.write('stdout', bytes(line));
    // No flush: the program is busy, in a loop that never returns.
    expect(text(page.messages, 'stdout')).toBe('a\nb\nc\n');
  });
});
