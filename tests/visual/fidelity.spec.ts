/**
 * Render fidelity (VIS-FID): the canvas draws each battery scene as the exported program draws it
 * on the course toolchain (MinGW g++, FreeGLUT, GLEW), compared by the rule in
 * tests/helpers/image-compare.ts against the references in tests/fixtures/fidelity/reference.
 *
 * Record the references on the reference machine (Windows) with
 *   FIDELITY_RECORD=1 VAMS_GLUT_TOOLCHAIN=<path to the toolchain's mingw32 folder> npx playwright test fidelity
 * which exports each scene's C++, builds it with the capture shim, runs it and saves its first frame.
 * stb_image.h is read from VAMS_STB_IMAGE, or from the Application folder beside mingw32.
 */
import { expect, test, type Page } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { FIDELITY_SCENES, type FidelityScene } from '../fixtures/fidelity/scenes';
import { compareImages, decodePng, encodePng, type Image } from '../helpers/image-compare';

const FIXTURES = resolve('tests/fixtures/fidelity');
const WORK = resolve('tests/visual/results.local/fidelity');
const RECORD = process.env.FIDELITY_RECORD === '1';
/** The program window's resize grip and rounded corners sit in the canvas's bottom corners. */
const CORNER = 16;

/** An 8 × 8 checker of one-pixel red and white cells. */
function checker(): Image {
  const data = new Uint8Array(8 * 8 * 4);
  for (let i = 0; i < 64; i++) {
    const white = ((i % 8) + Math.floor(i / 8)) % 2 === 0;
    data.set(white ? [255, 255, 255, 255] : [220, 30, 30, 255], i * 4);
  }
  return { width: 8, height: 8, data };
}

const dataUrl = (png: Uint8Array) => `data:image/png;base64,${Buffer.from(png).toString('base64')}`;

async function open(page: Page, scene: FidelityScene) {
  const uploadedTextures = (scene.textures ?? []).map((t) => ({ id: t.id, name: t.name, dataUrl: dataUrl(encodePng(checker())), width: 8, height: 8 }));
  await page.addInitScript(
    ({ objects, uploadedTextures }) => {
      window.localStorage.setItem('vams-theme', 'light');
      window.localStorage.setItem('vams-storage', JSON.stringify({
        state: {
          objects, uploadedTextures, hasSeenWelcome: true, activeSection: 'Primitives', canvasBackgroundColor: '#000000',
          axisVisibility: { showGlobalAxes: false, showLocalAxes: false, showOriginMarker: false, showGridlines: false, showGridNumbers: false },
        },
        version: 11,
      }));
    },
    { objects: scene.objects ?? [], uploadedTextures },
  );
  await page.goto(scene.gallery ? `/app?scene=${scene.gallery}` : '/app');
  await page.waitForSelector('.canvas-wrapper canvas');
  await page.evaluate(() => document.fonts.ready);
  // Let textures load and the window settle.
  await page.waitForTimeout(1500);
}

/** Exports the scene's program, builds it on the course toolchain and saves its first frame as the reference. */
async function record(page: Page, scene: FidelityScene, size: { width: number; height: number }) {
  const toolchain = process.env.VAMS_GLUT_TOOLCHAIN;
  if (!toolchain) throw new Error('Set VAMS_GLUT_TOOLCHAIN to the course toolchain\'s mingw32 folder.');
  const dir = join(WORK, scene.id);
  mkdirSync(dir, { recursive: true });

  await page.getByRole('button', { name: 'File' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export C++ code' }).click();
  // The program loads images from the folder it runs in.
  const cpp = readFileSync(await (await download).path(), 'utf8').replaceAll('C:\\\\path\\\\to\\\\your\\\\', '');
  writeFileSync(join(dir, 'scene.cpp'), cpp);

  const declared = /glutInitWindowSize\((\d+), (\d+)\)/.exec(cpp);
  if (!declared || +declared[1] !== size.width || +declared[2] !== size.height) {
    throw new Error(`The program window is ${declared?.[1]} × ${declared?.[2]}; the canvas is ${size.width} × ${size.height}.`);
  }

  // Every image the program loads, by the name the code asks for.
  const stored = JSON.parse((await page.evaluate(() => window.localStorage.getItem('vams-storage'))) ?? '{}');
  const images = new Map<string, string>((stored.state?.uploadedTextures ?? []).map((t: { name: string; dataUrl: string }) => [t.name, t.dataUrl]));
  // Sample textures are drawn in the browser and never stored: read them from the object's texture tile.
  for (const [, objectName, name] of cpp.matchAll(/\/\/ (.+) — texture object[\s\S]*?stbi_load\("([^"]+)\.png"/g)) {
    let url = images.get(name);
    if (!url) {
      await page.getByRole('treeitem', { name: objectName, exact: true }).click();
      const tile = page.locator(`button.tx-tile[aria-label="${name}"] img`);
      if ((await tile.count()) === 0) await page.getByRole('button', { name: 'Texture', exact: true }).click();
      url = (await tile.getAttribute('src')) ?? undefined;
    }
    if (!url) throw new Error(`The program loads ${name}.png, which the page doesn't show.`);
    writeFileSync(join(dir, `${name}.png`), Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
  }

  // The course keeps stb_image.h beside the program, in the Application folder next to mingw32.
  const stb = process.env.VAMS_STB_IMAGE ?? join(toolchain, '..', 'Application');
  const env = { ...process.env, PATH: `${join(toolchain, 'bin')};${process.env.PATH}`, VAMS_CAPTURE_OUT: join(dir, 'frame.rgba') };
  const build = spawnSync(join(toolchain, 'bin', 'g++.exe'), [
    '-include', join(FIXTURES, 'capture', 'capture-pre.h'), join(dir, 'scene.cpp'), join(FIXTURES, 'capture', 'capture.cpp'),
    `-I${join(toolchain, 'include')}`, `-I${stb}`, `-L${join(toolchain, 'lib')}`,
    '-lglew32', '-lfreeglut', '-lopengl32', '-lglu32', '-lwinmm', '-lgdi32', '-o', join(dir, 'scene.exe'),
  ], { env, encoding: 'utf8' });
  if (build.status !== 0) throw new Error(`The program didn't build:\n${build.stderr}`);
  const run = spawnSync(join(dir, 'scene.exe'), [], { cwd: dir, env, timeout: 20_000 });
  if (run.status !== 0 || !existsSync(join(dir, 'frame.rgba'))) throw new Error(`The program didn't save a frame (exit ${run.status}).`);

  const frame = readFileSync(join(dir, 'frame.rgba'));
  const width = frame.readInt32LE(0);
  const height = frame.readInt32LE(4);
  const samples = frame.readInt32LE(8);
  if (samples !== 4) throw new Error(`The program ran with ${samples} samples; the references are recorded with 4.`);
  const rows = frame.subarray(12);
  const data = new Uint8Array(width * height * 4);
  // glReadPixels starts at the bottom row.
  for (let y = 0; y < height; y++) data.set(rows.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  writeFileSync(join(FIXTURES, 'reference', `${scene.id}.png`), encodePng({ width, height, data }));
}

FIDELITY_SCENES.forEach((scene, i) => {
  test(`VIS-FID-${String(i + 1).padStart(2, '0')}: ${scene.id} draws as FreeGLUT draws it`, async ({ page }) => {
    await open(page, scene);
    const shot = decodePng(await page.locator('.canvas-wrapper').screenshot());
    if (RECORD) await record(page, scene, shot);
    const reference = decodePng(readFileSync(join(FIXTURES, 'reference', `${scene.id}.png`)));
    const inCorner = (x: number, y: number) => y >= shot.height - CORNER && (x < CORNER || x >= shot.width - CORNER);
    const result = compareImages(shot, reference, inCorner);
    if (!result.ok) {
      mkdirSync(WORK, { recursive: true });
      writeFileSync(join(WORK, `${scene.id}.canvas.png`), encodePng(shot));
    }
    expect(result.failures, `first differences [x, y, size]: ${JSON.stringify(result.examples)}`).toBeLessThanOrEqual(scene.texelTies ?? 0);
  });
});
