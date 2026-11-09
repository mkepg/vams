/**
 * The Lab for the visual specs, compiling with the real compiler in the page.
 * Needs the local runtime build: LAB_RUNTIME_LOCAL=1 npm run test:visual -- lab.spec lab-drawing.
 * lab/runtime/build.sh, run in the pinned emscripten/emsdk image, writes it to lab/runtime/out/.
 * Not part of `npm test`.
 *
 * The suite's web server is `vite preview`, which has none of what production puts in front of
 * the page, so the routes here stand in for it: the isolation headers public/_headers gives /lab,
 * and the runtime the Pages Function serves from /lab-runtime/<version>/: the local build in
 * lab/runtime/out, the pinned compiler's files, and the compiler's manifest, made as the dev
 * server makes it. Every runtime request is recorded, so a spec can say what the page fetched.
 */
import type { BrowserContext, Page } from '@playwright/test';
import { createReadStream, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { devManifest, labRuntimeFile, MANIFEST } from '../../../scripts/lab/vite-lab-dev';

export const LAB_RUNTIME_LOCAL = process.env.LAB_RUNTIME_LOCAL === '1';

const RUNTIME = resolve('lab/runtime/out');

const HIDE_TIMED_NOTICES = '.update-notice, [data-sonner-toaster] { display: none !important; }';

export type Theme = 'light' | 'dark';

/** Stops a spec early, with how to build what it needs. */
export function requireRuntime() {
  for (const name of ['vams_main.mjs', 'vams_main.wasm', 'lab-headers.json']) {
    if (!existsSync(join(RUNTIME, name))) {
      throw new Error('Build the runtime first: lab/runtime/build.sh, run in the pinned emscripten/emsdk image, writes lab/runtime/out/.');
    }
  }
}

const isLabPath = (pathname: string) => pathname === '/lab' || pathname.startsWith('/lab/');

/** The file names of every /lab-runtime/ request the page made, in order. */
export type RuntimeRequests = string[];

/** The compiler's files, as a request names them: everything the runtime holds but the main module. */
export const isCompilerFile = (name: string) => name !== 'vams_main.mjs' && name !== 'vams_main.wasm';

async function bodyOf(path: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of createReadStream(path)) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/** Puts production's routes in front of the preview server for this browser context. */
export async function routeLab(context: BrowserContext): Promise<RuntimeRequests> {
  const requests: RuntimeRequests = [];
  // The page and its workers get the isolation headers.
  await context.route(
    (url) => isLabPath(url.pathname),
    async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: { ...response.headers(), 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' },
      });
    },
  );
  await context.route(
    (url) => url.pathname.startsWith('/lab-runtime/'),
    async (route) => {
      const { pathname } = new URL(route.request().url());
      const name = pathname.split('/').pop() ?? '';
      requests.push(name);
      const headers = { 'cross-origin-resource-policy': 'same-origin', 'cache-control': 'no-store' };
      // The runtime is served under whatever version the build names; the local files are 'dev'.
      const devPath = `/lab-runtime/dev/${name}`;
      if (name === MANIFEST) {
        const manifest = devManifest(RUNTIME);
        if (!manifest) return route.fulfill({ status: 404 });
        return route.fulfill({ status: 200, body: JSON.stringify(manifest), headers: { ...headers, 'content-type': 'application/json; charset=utf-8' } });
      }
      const file = labRuntimeFile(devPath, RUNTIME);
      if (!file) return route.fulfill({ status: 404 });
      await route.fulfill({ status: 200, body: await bodyOf(file.path), headers: { ...headers, 'content-type': file.type } });
    },
  );
  return requests;
}

/**
 * Opens the Lab in a theme, with timed notices hidden. Every picture drawn on the stage's canvas
 * is kept, in order, in window.__labFrames, so a spec can read the framebuffer the page received.
 */
export async function openLab(page: Page, theme: Theme) {
  await page.addInitScript(
    ({ t, css }) => {
      window.localStorage.setItem('vams-theme', t);
      const frames: { width: number; height: number; pixels: Uint8ClampedArray }[] = [];
      (window as unknown as { __labFrames: typeof frames }).__labFrames = frames;
      const put = CanvasRenderingContext2D.prototype.putImageData;
      CanvasRenderingContext2D.prototype.putImageData = function (this: CanvasRenderingContext2D, data: ImageData, ...rest: number[]) {
        if (this.canvas.classList.contains('lab-stage__canvas')) {
          frames.push({ width: data.width, height: data.height, pixels: new Uint8ClampedArray(data.data) });
        }
        return (put as (d: ImageData, ...r: number[]) => void).call(this, data, ...rest);
      } as typeof put;
      const inject = () => {
        const style = document.createElement('style');
        style.textContent = css;
        (document.head ?? document.documentElement).appendChild(style);
      };
      if (document.documentElement) inject();
      else document.addEventListener('DOMContentLoaded', inject, { once: true });
    },
    { t: theme, css: HIDE_TIMED_NOTICES },
  );
  await page.goto('/lab');
  await page.waitForSelector('.lab-top-bar__run');
  await page.waitForFunction(() => window.crossOriginIsolated);
  await page.evaluate(() => document.fonts.ready);
}

/** Presses Run and waits for the program's first frame. The first Run also downloads the compiler. */
export async function runProgram(page: Page) {
  await page.locator('.lab-top-bar__run').click();
  await page.waitForFunction(() => (window as unknown as { __labFrames: unknown[] }).__labFrames.length > 0, undefined, { timeout: 90_000 });
}

/** The first frame the page received, top row first. */
export async function firstFrame(page: Page): Promise<{ width: number; height: number; data: Uint8Array }> {
  const frame = await page.evaluate(() => {
    const { width, height, pixels } = (window as unknown as { __labFrames: { width: number; height: number; pixels: Uint8ClampedArray }[] }).__labFrames[0];
    let binary = '';
    for (let i = 0; i < pixels.length; i += 0x8000) binary += String.fromCharCode(...pixels.subarray(i, i + 0x8000));
    return { width, height, base64: btoa(binary) };
  });
  return { width: frame.width, height: frame.height, data: new Uint8Array(Buffer.from(frame.base64, 'base64')) };
}
