/**
 * VISUAL TEST SUITE — VIS-LAB (the compiler in the page)
 * The Lab with the real compiler, against the local runtime build. Needs it:
 * LAB_RUNTIME_LOCAL=1 npm run test:visual -- lab-compiler. Without it the checks skip.
 *
 *  - VIS-LAB-07: opening the Lab, or dismissing the notice, fetches nothing of the compiler;
 *    Run and Download now fetch it once, and a reload asks only the browser's cache
 *  - VIS-LAB-08: a program can't run JavaScript: emscripten_run_script stops it on an error
 *  - VIS-LAB-09: every name the code generator emits compiles, and every rejected name gives
 *    the VAMS message on its own line
 *  - VIS-LAB-10: a program that stores to IndexedDB through the main module's emscripten_idb_*
 *    stops, and no database appears
 *  - VIS-LAB-11: a program that starts a worker through emscripten_create_worker stops on an
 *    error, and the worker's script never runs
 *  - VIS-LAB-12: the gallery's jeepney, run in the editor and in the Lab, drives across the window
 *    at the same speed, though the Lab draws its frames in software
 *  - VIS-LAB-13: a sample of the GLUT misuse battery, run end to end, prints FreeGLUT's messages
 *    and ends with its exit codes
 *  - VIS-LAB-14: timers fire within 1 ms of their time, and an idle loop isn't held to the page's
 *    refresh, as on the reference
 *  - VIS-LAB-15: a script of keys and mouse actions gives the program the callbacks, values and
 *    modifiers FreeGLUT gave it on the reference, line for line
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generatorNames } from '../helpers/generator-names';
import { isCompilerFile, LAB_RUNTIME_LOCAL, openLab, requireRuntime, routeLab } from './helpers/lab';

const REJECTED_TEXT = " isn't part of VAMS Lab's OpenGL.";

/** Puts a program in the Lab's browser save and reloads, so the page opens with it. */
async function putProgram(page: Page, source: string) {
  await page.evaluate((text) => {
    const saved = JSON.parse(localStorage.getItem('vams-lab') ?? '{}');
    saved.state = { ...(saved.state ?? {}), source: text };
    localStorage.setItem('vams-lab', JSON.stringify(saved));
  }, source);
  await page.reload();
  await page.waitForSelector('.lab-top-bar__run');
}

/** Where the jeepney's front is, as a fraction of the window's width: the right end of its red stripe, the longest run of red in any row. */
async function jeepneyFront(page: Page, canvas: Locator): Promise<number> {
  const shot = (await canvas.screenshot()).toString('base64');
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let best = 0;
    let front = -1;
    for (let y = Math.floor(c.height * 0.4); y < c.height; y++) {
      let run = 0;
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        run = d[i] > 170 && d[i + 1] < 90 && d[i + 2] < 90 ? run + 1 : 0;
        if (run > best) {
          best = run;
          front = x;
        }
      }
    }
    return front / c.width;
  }, shot);
}

/**
 * How far the jeepney drives a second, in windows: over 8 s of screenshots, the distance it covers
 * across the stretch where it is wholly in view, never moves back and covers the most, over that
 * stretch's time. A canvas that shows the same frame to several screenshots then moves on is measured the
 * same as one that moves every time.
 */
async function jeepneySpeed(page: Page, canvas: Locator): Promise<number> {
  await page.waitForTimeout(500);
  const samples: [number, number][] = [];
  const start = Date.now();
  while (Date.now() - start < 8000) samples.push([Date.now(), await jeepneyFront(page, canvas)]);
  const inView = ([, x]: [number, number]) => x > 0.05 && x < 0.97;
  let best: [number, number][] = [];
  let run: [number, number][] = [];
  for (const s of samples) {
    if (inView(s) && (run.length === 0 || s[1] >= run[run.length - 1][1])) run.push(s);
    else run = inView(s) ? [s] : [];
    const covers = (r: [number, number][]) => (r.length ? r[r.length - 1][1] - r[0][1] : 0);
    if (covers(run) > covers(best)) best = [...run];
  }
  const [t0, x0] = best[0] ?? [0, 0];
  const [t1, x1] = best[best.length - 1] ?? [0, 0];
  expect(x1 - x0, 'the jeepney should cross a fifth of the window in view').toBeGreaterThan(0.2);
  return (x1 - x0) / ((t1 - t0) / 1000);
}

/** Presses Run and waits until Run rests: the program ended, stopped, or the compile gave errors. */
async function runUntilDone(page: Page) {
  await page.locator('.lab-top-bar__run').click();
  await expect(page.locator('.lab-top-bar__status')).not.toContainText(/Compiling|Downloading/, { timeout: 90_000 });
  await expect(page.locator('.lab-top-bar__status')).not.toContainText('Running', { timeout: 30_000 });
}

test.describe('VIS-LAB: the compiler in the page', () => {
  test.skip(!LAB_RUNTIME_LOCAL, 'Needs the local runtime build: LAB_RUNTIME_LOCAL=1');
  test.describe.configure({ timeout: 180_000 });
  test.use({ serviceWorkers: 'block' });
  test.beforeAll(() => requireRuntime());

  test('VIS-LAB-07: Nothing of the compiler downloads until Run or Download now', async ({ page }) => {
    const requests = await routeLab(page.context());
    await openLab(page, 'light');
    const notice = page.locator('.compiler-notice');
    await expect(notice).toContainText('Run uses a compiler that downloads once (about 18 MB).');
    await page.waitForTimeout(1500);
    expect(requests.filter(isCompilerFile)).toEqual([]);

    await notice.getByRole('button', { name: 'Dismiss' }).click();
    await expect(notice).toHaveCount(0);
    await page.reload();
    await page.waitForSelector('.lab-top-bar__run');
    await page.waitForTimeout(1000);
    await expect(page.locator('.compiler-notice')).toHaveCount(0);
    expect(requests.filter(isCompilerFile)).toEqual([]);

    await page.locator('.lab-top-bar__run').click();
    await expect(page.locator('.lab-top-bar__status')).toContainText('Running', { timeout: 90_000 });
    const fetched = requests.filter(isCompilerFile);
    expect(fetched).toEqual(expect.arrayContaining(['compiler-manifest.json', 'bundle.js', 'llvm.core.wasm', 'llvm-resources.tar', 'lab-headers.json']));
    // Each file once, but bundle.js: the download keeps it, and import() fetches it again, which
    // production's year-long immutable cache answers.
    const others = fetched.filter((name) => name !== 'bundle.js');
    expect(new Set(others).size).toBe(others.length);
    expect(fetched.filter((name) => name === 'bundle.js').length).toBeLessThanOrEqual(2);

    // A reload finds the compiler in this browser and fetches none of it.
    const before = requests.length;
    await page.reload();
    await page.waitForSelector('.lab-top-bar__run');
    await page.waitForTimeout(1000);
    expect(requests.slice(before).filter(isCompilerFile)).toEqual([]);
  });

  test('VIS-LAB-07: Download now fetches the compiler with its progress, and the notice goes', async ({ page }) => {
    const requests = await routeLab(page.context());
    await openLab(page, 'dark');
    await page.locator('.compiler-notice').getByRole('button', { name: 'Download now' }).click();
    await expect(page.locator('.compiler-notice')).toHaveCount(0, { timeout: 90_000 });
    expect(requests.filter(isCompilerFile)).toContain('llvm.core.wasm');
  });

  test('VIS-LAB-08: A program that calls emscripten_run_script is stopped, and its script never runs', async ({ page }) => {
    await routeLab(page.context());
    await openLab(page, 'light');
    // Run, the script would end the program with exit code 42; it must not get that far.
    await putProgram(
      page,
      [
        'extern "C" void emscripten_run_script(const char *script);',
        'int main() {',
        '  emscripten_run_script("postMessage({ type: \'exit\', code: 42 })");',
        '  return 0;',
        '}',
        '',
      ].join('\n'),
    );
    await runUntilDone(page);
    await expect(page.locator('.lab-top-bar__status')).toContainText('Stopped on an error');
    await expect(page.locator('.lab-top-bar__status')).not.toContainText('42');
    // The Console says why, in the words of a program that stopped.
    await page.getByRole('tab', { name: 'Console' }).click();
    const console = page.getByRole('tabpanel');
    await expect(console).toContainText('The program stopped:');
    await expect(console).not.toContainText('42');
  });

  test("VIS-LAB-10: A program can't reach the site's storage through the main module's IndexedDB functions", async ({ page }) => {
    await routeLab(page.context());
    await openLab(page, 'light');
    const databases = () => page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
    expect(await databases()).not.toContain('vams-probe');
    // The store opens the database the program names. Leaving main with the runtime alive hands
    // the worker back to its event loop, where the open would finish.
    await putProgram(
      page,
      [
        'extern "C" {',
        'void emscripten_idb_async_store(const char *db, const char *id, void *ptr, int num, void *arg, void (*onstore)(void *), void (*onerror)(void *));',
        'void emscripten_exit_with_live_runtime(void);',
        '}',
        'static char data[4] = {1, 2, 3, 4};',
        'static void done(void *) {}',
        'int main() {',
        '  emscripten_idb_async_store("vams-probe", "probe", data, 4, 0, done, done);',
        '  emscripten_exit_with_live_runtime();',
        '  return 0;',
        '}',
        '',
      ].join('\n'),
    );
    await runUntilDone(page);
    await expect(page.locator('.lab-top-bar__status')).toContainText('Stopped on an error');
    await page.waitForTimeout(1500);
    expect(await databases()).not.toContain('vams-probe');
  });

  test("VIS-LAB-11: A program can't start a worker of its own, which would run JavaScript", async ({ page }) => {
    await routeLab(page.context());
    const probes: string[] = [];
    await page.context().route('**/vams-probe*', (route) => {
      probes.push(route.request().url());
      return route.fulfill({ status: 204 });
    });
    await openLab(page, 'light');
    // The worker would run the data: URL's script and fetch the probe while the program waits.
    await putProgram(
      page,
      [
        '#include <time.h>',
        'extern "C" int emscripten_create_worker(const char *url);',
        'int main() {',
        '  emscripten_create_worker("data:text/javascript,fetch(\'http://localhost:4319/vams-probe\')");',
        '  clock_t end = clock() + 3 * CLOCKS_PER_SEC;',
        '  while (clock() < end) {}',
        '  return 0;',
        '}',
        '',
      ].join('\n'),
    );
    await runUntilDone(page);
    await page.waitForTimeout(1000);
    expect(probes).toEqual([]);
    await expect(page.locator('.lab-top-bar__status')).toContainText('Stopped on an error');
  });

  test('VIS-LAB-12: The jeepney drives as fast in the Lab as in the editor', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await routeLab(page.context());
    await page.goto('/app?scene=jeepney-street');
    await page.locator('canvas').first().waitFor();
    // The scene loads after the editor opens.
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: /^Run/ }).first().click();
    const editor = await jeepneySpeed(page, page.locator('canvas').first());

    await openLab(page, 'dark');
    await page.getByRole('button', { name: 'Examples' }).click();
    await page.getByRole('menuitem', { name: 'Jeepney street' }).click();
    await page.locator('.lab-top-bar__run').click();
    await expect(page.locator('.lab-top-bar__status')).toContainText('Running', { timeout: 90_000 });
    const lab = await jeepneySpeed(page, page.locator('canvas').filter({ visible: true }).last());
    // 60 steps a second in both; screenshots' timing makes each measure a little rough.
    expect(lab / editor).toBeGreaterThan(0.7);
    expect(lab / editor).toBeLessThan(1.3);
  });

  test('VIS-LAB-09: Every generator name compiles, and every rejected name gives the VAMS message on its line', async ({ page }) => {
    await routeLab(page.context());
    await openLab(page, 'light');

    const uses = generatorNames().map((name) => (/^(GL|GLUT)_/.test(name) ? `  (void)(${name});` : `  (void)&${name};`));
    await putProgram(page, ['#include <GL/glut.h>', 'int main() {', ...uses, '  return 0;', '}', ''].join('\n'));
    await runUntilDone(page);
    await expect(page.locator('.lab-top-bar__status')).toContainText('Ended with exit code 0');

    const header = readFileSync(join(process.cwd(), 'lab/include/vams_rejected.h'), 'utf8');
    const rejected = [...header.matchAll(/^\s*VAMS_REJECT\(\s*(\w+)\s*,/gm)].map((m) => m[1]);
    expect(rejected.length).toBeGreaterThan(20);
    // clang stops after 20 errors, so the names go in groups.
    for (let i = 0; i < rejected.length; i += 15) {
      const group = rejected.slice(i, i + 15);
      const FIRST = 3;
      await putProgram(page, ['#include <GL/glut.h>', 'int main() {', ...group.map((n) => `  (void)&${n};`), '  return 0;', '}', ''].join('\n'));
      await runUntilDone(page);
      const list = page.locator('.lab-log__list');
      for (let j = 0; j < group.length; j++) await expect(list).toContainText(`main.cpp:${FIRST + j}:`);
      for (const name of group) await expect(list).toContainText(`${name}${REJECTED_TEXT}`);
    }
  });

  test('VIS-LAB-13: GLUT misuse ends a program in the Lab as FreeGLUT ends it on a lab PC', async ({ page }) => {
    test.setTimeout(600_000);
    await routeLab(page.context());
    await openLab(page, 'light');
    const misuse = readFileSync(join(process.cwd(), 'tests/fixtures/lab/glut/misuse.cpp'), 'utf8');
    const recorded = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/lab/glut/reference.json'), 'utf8')).misuse;
    await putProgram(page, misuse);
    // One case of each kind: before glutInit, without a window, the loop's check, a warning, and the loop's end.
    for (const name of ['noinit-glutDisplayFunc', 'nowindow-glutPostRedisplay', 'mainloop-no-display', 'get-unknown', 'leave-returns']) {
      const want = recorded[name] as { stdout: string; stderr: string; exit: number };
      await page.locator('.lab-top-bar__run').click();
      const field = page.locator('#lab-console-input');
      await expect(field).toBeVisible({ timeout: 90_000 });
      await field.fill(name);
      await field.press('Enter');
      await expect(page.locator('.lab-top-bar__status')).toContainText(`Ended with exit code ${want.exit}`, { timeout: 30_000 });
      const console = page.getByRole('tabpanel');
      // The program's name in FreeGLUT's prefix is x.bat's Program.exe, as on a lab PC.
      const lines = `${want.stdout}${want.stderr}`.replaceAll('<program>', 'c:\\openglcpp\\Program.exe').split('\n');
      for (const line of lines.filter((l) => l.length > 0)) await expect(console, name).toContainText(line);
    }
  });

  test('VIS-LAB-14: Timers keep their time and idle runs as fast as it can, as on the reference', async ({ page }) => {
    await routeLab(page.context());
    await openLab(page, 'light');
    await putProgram(page, readFileSync(join(process.cwd(), 'tests/fixtures/lab/glut/pace.cpp'), 'utf8'));
    await page.locator('.lab-top-bar__run').click();
    await expect(page.locator('.lab-top-bar__status')).toContainText('Ended with exit code 0', { timeout: 120_000 });
    await page.getByRole('tab', { name: 'Console' }).click();
    const printed = (await page.getByRole('tabpanel').textContent()) ?? '';
    // The reference's mean intervals, measured with the window in front (GLUT behaviour spec); the Lab's must be within 1 ms of each.
    const reference: Record<number, number> = { 1: 1.55, 10: 10.4, 16: 16.39, 33: 33.05 };
    const means = Object.fromEntries(
      Object.keys(reference).map((p) => [p, Number(new RegExp(`timer ${p} ms: mean ([\\d.]+) ms`).exec(printed)?.[1])]),
    );
    for (const [period, mean] of Object.entries(means)) expect(Math.abs(mean - reference[Number(period)]), `timer ${period}: ${JSON.stringify(means)}`).toBeLessThanOrEqual(1);
    // Not held to the page's refresh: at least four frames a refresh at 60 Hz.
    const idle = Number(/idle frames per second (\d+)/.exec(printed)?.[1]);
    expect(idle).toBeGreaterThanOrEqual(240);
  });

  test('VIS-LAB-15: Keys and the mouse reach a program in the Lab as FreeGLUT hands them over on the reference', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await routeLab(page.context());
    await openLab(page, 'light');
    const dir = join(process.cwd(), 'tests/fixtures/lab/glut');
    await putProgram(page, readFileSync(join(dir, 'events.cpp'), 'utf8'));
    await page.locator('.lab-top-bar__run').click();
    await expect(page.locator('.lab-top-bar__status')).toContainText('Running', { timeout: 120_000 });
    const surface = page.locator('.canvas-window canvas').first();
    await expect(surface).toBeVisible();
    const box = (await surface.boundingBox())!;
    // Window pixels to page pixels: the window opens at 400 × 300, unscaled on a stage this size.
    const to = (x: number, y: number) => [box.x + ((x + 0.5) * box.width) / 400, box.y + ((y + 0.5) * box.height) / 300] as const;
    const script = readFileSync(join(dir, 'events.script.txt'), 'utf8').split(/\r?\n/).filter((l) => l.trim().length > 0);
    for (const line of script) {
      const [what, ...args] = line.trim().split(/\s+/);
      const n = args.map(Number);
      switch (what) {
        case 'click':
          await page.mouse.move(...to(n[0], n[1]));
          await page.mouse.down();
          await page.mouse.up();
          break;
        case 'middle':
          await page.mouse.move(...to(n[0], n[1]));
          await page.mouse.down({ button: 'middle' });
          await page.mouse.up({ button: 'middle' });
          break;
        case 'move':
          await page.mouse.move(...to(n[0], n[1]));
          break;
        case 'drag':
          await page.mouse.move(...to(n[0], n[1]));
          await page.mouse.down();
          await page.mouse.move(...to(n[2], n[3]));
          await page.mouse.up();
          break;
        case 'wheel':
          await page.mouse.move(...to(Number(args[1]), Number(args[2])));
          await page.mouse.wheel(0, args[0] === 'up' ? -100 : 100);
          break;
        case 'key':
          await page.keyboard.press(args[0]);
          break;
        case 'close':
          await page.locator('.canvas-window button[aria-label="Close"]').click();
          break;
      }
      // One event at a time, as the reference posts one message a tick.
      await page.waitForTimeout(30);
    }
    await expect(page.locator('.lab-top-bar__status')).toContainText('Ended with exit code 0', { timeout: 10_000 });
    await page.getByRole('tab', { name: 'Console' }).click();
    const printed = ((await page.getByRole('tabpanel').textContent()) ?? '').split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const recorded = JSON.parse(readFileSync(join(dir, 'reference.json'), 'utf8')).events as string[];
    expect(printed).toEqual(recorded);
  });
});
