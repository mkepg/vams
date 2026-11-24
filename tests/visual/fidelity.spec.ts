/**
 * Render fidelity (VIS-FID): the canvas draws each battery scene as the exported program draws it
 * on the course toolchain (MinGW g++, FreeGLUT, GLEW), compared by the edge rule in
 * tests/helpers/image-compare.ts against the references in tests/fixtures/fidelity/reference.
 *
 * Record the references on the reference machine (Windows) with
 *   FIDELITY_RECORD=1 VAMS_GLUT_TOOLCHAIN=<path to the toolchain's mingw32 folder> npx playwright test fidelity
 * which exports each scene's C++, builds it with the capture shim, runs it and saves its first frame.
 * A recording fails unless the program ran on a renderer naming VAMS_CAPTURE_RENDERER (default
 * Intel), the GPU the Lab's references are recorded on too, and with Intel's 4 sample positions.
 * stb_image.h is read from VAMS_STB_IMAGE, or from the Application folder beside mingw32.
 */
import { expect, test, type Page } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { FIDELITY_SCENES, type FidelityScene } from '../fixtures/fidelity/scenes';
import { compareEdges, compareStrict, decodePng, encodePng, type Image } from '../helpers/image-compare';

const FIXTURES = resolve('tests/fixtures/fidelity');
const WORK = resolve('tests/visual/results.local/fidelity');
const RECORD = process.env.FIDELITY_RECORD === '1';
/** Intel's 4 sample positions (glGetMultisamplefv), which gl-raster's SAMPLE_OFFSETS use. */
const INTEL_SAMPLES = 'samples 0.3750,0.1250 0.8750,0.3750 0.1250,0.6250 0.6250,0.8750';
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

/**
 * An Idle callback with no rules: the program it exports draws the same display(), and Run can
 * start, which needs a valid callback.
 */
const IDLE_ONLY = {
  keyboard: { handlerName: '', rules: [] },
  special: { handlerName: '', rules: [] },
  mouse: { handlerName: '', rules: [] },
  motion: { handlerName: '', rules: [] },
  reshape: { handlerName: '', resize: 'keep' },
  idle: { handlerName: 'idle', rules: [] },
};

async function open(page: Page, scene: FidelityScene) {
  const uploadedTextures = (scene.textures ?? []).map((t) => ({ id: t.id, name: t.name, dataUrl: dataUrl(encodePng(checker())), width: 8, height: 8 }));
  await page.addInitScript(
    ({ objects, uploadedTextures, callbacks }) => {
      window.localStorage.setItem('vams-theme', 'light');
      window.localStorage.setItem('vams-storage', JSON.stringify({
        state: {
          objects, uploadedTextures, callbacks, hasSeenWelcome: true, activeSection: 'Primitives', canvasBackgroundColor: '#000000',
          axisVisibility: { showGlobalAxes: false, showLocalAxes: false, showOriginMarker: false, showGridlines: false, showGridNumbers: false },
        },
        version: 11,
      }));
    },
    { objects: scene.objects ?? [], uploadedTextures, callbacks: IDLE_ONLY },
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
  const run = spawnSync(join(dir, 'scene.exe'), [], { cwd: dir, env, timeout: 20_000, encoding: 'utf8' });
  if (run.status !== 0 || !existsSync(join(dir, 'frame.rgba'))) throw new Error(`The program didn't save a frame (exit ${run.status}).`);
  const renderer = run.stderr.trim().split(/\r?\n/).pop() ?? '';
  const want = process.env.VAMS_CAPTURE_RENDERER ?? 'Intel';
  if (!renderer.includes(want)) throw new Error(`The program ran on "${renderer}"; the references are recorded on ${want}.`);

  const frame = readFileSync(join(dir, 'frame.rgba'));
  const width = frame.readInt32LE(0);
  const height = frame.readInt32LE(4);
  const samples = frame.readInt32LE(8);
  if (samples !== 4) throw new Error(`The program ran with ${samples} samples; the references are recorded with 4.`);
  if (!run.stderr.includes(INTEL_SAMPLES)) throw new Error(`The sample positions aren't Intel's:\n${run.stderr}`);
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
    const result = compareEdges(shot, reference, inCorner);
    if (!result.ok) {
      mkdirSync(WORK, { recursive: true });
      writeFileSync(join(WORK, `${scene.id}.canvas.png`), encodePng(shot));
    }
    expect(result.failures, `first differences [x, y, size]: ${JSON.stringify(result.examples)}`).toBeLessThanOrEqual(scene.texelTies ?? 0);
  });
});

// The Run view draws through gl-raster, which matches the reference GPU at every pixel. A scene
// with no rules shows the program's first frame for as long as it runs. Gallery scenes move from
// the first step; ALG-RUN-01 holds their Run view to the program's own calls instead, and
// VIS-LAB-05 holds those calls to the reference GPU.
/**
 * Named exceptions of the Run view: multisampled line edges, where one sample of a pixel lies within
 * 0.003 of a pixel outside a sloped or wide line and the reference driver's fixed-point edge setup
 * counts it as inside (the Lab battery's LINE_EDGE, docs/lab-operations.md).
 */
const RUN_EXCEPTIONS: Record<string, number> = {
  'scaled-lines-and-points': 31,
  'stipple-presets-1px': 2,
  'stipple-presets-4.5px': 31,
  'every-primitive-flat': 18,
  'every-primitive-smooth': 18,
};

FIDELITY_SCENES.filter((scene) => !scene.gallery).forEach((scene, i) => {
  const id = FIDELITY_SCENES.length + i + 1;
  test(`VIS-FID-${id}: ${scene.id} runs as FreeGLUT draws it, every pixel`, async ({ page }) => {
    await open(page, scene);
    await page.getByRole('button', { name: /^Run/ }).first().click();
    await page.locator('.run-view[data-showing]').waitFor();
    await page.waitForTimeout(300);
    const shot = decodePng(await page.locator('.canvas-wrapper').screenshot());
    const reference = decodePng(readFileSync(join(FIXTURES, 'reference', `${scene.id}.png`)));
    const inCorner = (x: number, y: number) => y >= shot.height - CORNER && (x < CORNER || x >= shot.width - CORNER);
    const result = compareStrict(shot, reference, inCorner);
    if (!result.ok) {
      mkdirSync(WORK, { recursive: true });
      writeFileSync(join(WORK, `${scene.id}.run.png`), encodePng(shot));
    }
    expect(result.failures, `first differences [x, y, size]: ${JSON.stringify(result.examples)}`).toBe(RUN_EXCEPTIONS[scene.id] ?? 0);
  });
});
