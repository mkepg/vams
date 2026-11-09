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
 */
import { expect, test, type Page } from '@playwright/test';
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
});
