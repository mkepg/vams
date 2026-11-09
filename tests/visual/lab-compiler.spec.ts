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
