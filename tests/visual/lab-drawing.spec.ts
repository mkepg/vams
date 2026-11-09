/**
 * VISUAL TEST SUITE — VIS-LAB (the Lab's drawing)
 * VIS-LAB-05: every program of the Lab's reference battery, opened in the Lab as a .zip with the
 * images it loads, compiled by the compiler in the page and run, draws its first frame
 * as FreeGLUT draws it on the course toolchain. The frame is the one the page took from the
 * shared framebuffer, compared by the battery's rule (tests/helpers/image-compare.ts) with
 * tests/fixtures/lab/reference/<program>.png.
 *
 * Needs the local runtime build: LAB_RUNTIME_LOCAL=1 npm run test:visual -- lab-drawing. Without it the checks skip. A failure
 * writes the frame and a diff image to tests/visual/results.local/lab-drawing/.
 */
import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { zipSync } from 'fflate';
import { compareImages, decodePng, encodePng, type Image } from '../helpers/image-compare';
import { firstFrame, LAB_RUNTIME_LOCAL, openLab, requireRuntime, routeLab, runProgram } from './helpers/lab';

const PROGRAMS = resolve('tests/fixtures/lab/programs');
const REFERENCES = resolve('tests/fixtures/lab/reference');
const WORK = resolve('tests/visual/results.local/lab-drawing');
const MANIFEST: { programs: Record<string, string> } = JSON.parse(readFileSync(join(REFERENCES, 'manifest.json'), 'utf8'));

/**
 * Known residuals, parked when the battery was recorded: the end pixels of lines-wide's 45° width-4
 * lines, where no model of the reference GPU fits exactly.
 */
const PARKED: Record<string, number> = { 'lines-wide': 2 };

/** The program as main.cpp, with the images it loads beside it. */
function workZip(name: string): Buffer {
  const source = readFileSync(join(PROGRAMS, `${name}.cpp`));
  const images = new Set([...source.toString('utf8').matchAll(/"([^"\\/]+\.png)"/g)].map((m) => m[1]));
  const entries: Record<string, Uint8Array> = { 'main.cpp': source };
  for (const image of images) entries[image] = readFileSync(join(PROGRAMS, image));
  return Buffer.from(zipSync(entries));
}

/** Red where the frame and the reference differ by more than 2 in a channel, the reference dimmed elsewhere. */
function diffImage(actual: Image, reference: Image): Image {
  const data = new Uint8Array(reference.data.length);
  for (let i = 0; i < data.length; i += 4) {
    const d = Math.max(...[0, 1, 2].map((c) => Math.abs(actual.data[i + c] - reference.data[i + c])));
    if (d > 2) data.set([255, 0, 0, 255], i);
    else for (let c = 0; c < 3; c++) data[i + c] = reference.data[i + c] >> 2;
    data[i + 3] = 255;
  }
  return { width: reference.width, height: reference.height, data };
}

test.describe('VIS-LAB-05: Each battery program draws in the Lab as FreeGLUT draws it', () => {
  test.skip(!LAB_RUNTIME_LOCAL, 'Needs the local runtime build: LAB_RUNTIME_LOCAL=1');
  test.describe.configure({ timeout: 120_000 });
  test.use({ serviceWorkers: 'block' });

  test.beforeAll(() => requireRuntime());

  for (const name of Object.keys(MANIFEST.programs).sort()) {
    test(`VIS-LAB-05: ${name}`, async ({ page }) => {
      await routeLab(page.context());
      await openLab(page, 'light');
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Open', exact: true }).click();
      await (await chooser).setFiles({ name: `${name}.zip`, mimeType: 'application/zip', buffer: workZip(name) });
      // Open keeps the code in the browser save, which is what Run compiles.
      const source = readFileSync(join(PROGRAMS, `${name}.cpp`), 'utf8').replace(/\r\n?/g, '\n');
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vams-lab') ?? '{}').state?.source)).toBe(source);
      await runProgram(page);

      const frame = await firstFrame(page);
      const reference = decodePng(readFileSync(join(REFERENCES, `${name}.png`)));
      const result = compareImages(frame, reference);
      if (!result.ok) {
        mkdirSync(WORK, { recursive: true });
        writeFileSync(join(WORK, `${name}.lab.png`), encodePng(frame));
        if (frame.width === reference.width && frame.height === reference.height) {
          writeFileSync(join(WORK, `${name}.diff.png`), encodePng(diffImage(frame, reference)));
        }
      }
      test.info().annotations.push({ type: 'failures', description: `${name}: ${result.failures}` });
      expect(result.failures, `first differences [x, y, size]: ${JSON.stringify(result.examples)}`).toBeLessThanOrEqual(PARKED[name] ?? 0);
    });
  }
});
