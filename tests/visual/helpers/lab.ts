/**
 * The Lab for the visual specs, compiling through the compile service's image on this machine.
 * Needs Docker: LAB_DOCKER=1 npm run test:visual -- lab.spec lab-drawing. Not part of `npm test`.
 *
 * The suite's web server is `vite preview`, which has none of what production puts in front of
 * the page, so the routes here stand in for it: the isolation headers public/_headers gives /lab,
 * the runtime the Pages Function serves from /lab-runtime/<version>/ (here the local build in
 * lab/runtime/out), and /api/compile, which forwards to the container with its secret and an IP.
 */
import type { BrowserContext, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const LAB_DOCKER = process.env.LAB_DOCKER === '1';

const IMAGE = 'vams-lab-compile';
const RUNTIME = resolve('lab/runtime/out');
const RUNTIME_TYPES: Record<string, string> = { mjs: 'text/javascript; charset=utf-8', wasm: 'application/wasm' };
const PASS_HEADERS = ['content-type', 'x-lab-diagnostics', 'retry-after'];

const HIDE_TIMED_NOTICES = '.update-notice, [data-sonner-toaster] { display: none !important; }';

export type Theme = 'light' | 'dark';

export interface CompileService {
  url: string;
  secret: string;
  stop(): void;
}

const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** Builds the compile service's image (from cache when nothing changed), runs it, and waits for it to answer. */
export async function startCompileService(): Promise<CompileService> {
  if (!existsSync(join(RUNTIME, 'vams_main.mjs')) || !existsSync(join(RUNTIME, 'vams_main.wasm'))) {
    throw new Error('Build the runtime first: lab/runtime/build.sh, run in the pinned emscripten/emsdk image, writes lab/runtime/out/vams_main.{mjs,wasm}.');
  }
  const version = readFileSync('lab/toolchain/EMSDK_VERSION', 'utf8').trim();
  docker('build', '-q', '-f', 'lab/toolchain/Dockerfile', '--build-arg', `EMSDK_VERSION=${version}`, '-t', IMAGE, '.');
  const secret = `lab-${randomBytes(12).toString('hex')}`;
  const container = docker('run', '-d', '--rm', '-p', '127.0.0.1::8080', '-e', `LAB_SECRET=${secret}`, IMAGE);
  const stop = () => {
    try {
      docker('rm', '-f', container);
    } catch {
      /* already gone */
    }
  };
  try {
    const port = docker('port', container, '8080').split('\n')[0].split(':').at(-1);
    const url = `http://127.0.0.1:${port}/compile`;
    for (let i = 0; i < 100; i++) {
      try {
        // Any answer means it is listening; a GET is refused with 405.
        await fetch(url);
        return { url, secret, stop };
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    throw new Error('The compile service did not start.');
  } catch (error) {
    stop();
    throw error;
  }
}

const isLabPath = (pathname: string) => pathname === '/lab' || pathname.startsWith('/lab/');

/** Puts production's routes in front of the preview server for this browser context. */
export async function routeLab(context: BrowserContext, service: CompileService) {
  // The page and its program worker get the isolation headers.
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
      const name = new URL(route.request().url()).pathname.split('/').pop() ?? '';
      const type = RUNTIME_TYPES[name.slice(name.lastIndexOf('.') + 1)];
      if (!type || !existsSync(join(RUNTIME, name))) return route.fulfill({ status: 404 });
      await route.fulfill({
        status: 200,
        body: readFileSync(join(RUNTIME, name)),
        headers: { 'content-type': type, 'cross-origin-resource-policy': 'same-origin', 'cache-control': 'no-store' },
      });
    },
  );
  await context.route(
    (url) => url.pathname === '/api/compile',
    async (route) => {
      const upstream = await fetch(service.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-Lab-Secret': service.secret, 'X-Lab-Client-IP': '203.0.113.9' },
        body: route.request().postData() ?? undefined,
      });
      // fetch has already undone the service's gzip, so the body goes on without Content-Encoding.
      const headers: Record<string, string> = {};
      for (const name of PASS_HEADERS) {
        const value = upstream.headers.get(name);
        if (value !== null) headers[name] = value;
      }
      await route.fulfill({ status: upstream.status, headers, body: Buffer.from(await upstream.arrayBuffer()) });
    },
  );
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

/** Presses Run and waits for the program's first frame. */
export async function runProgram(page: Page) {
  await page.locator('.lab-top-bar__run').click();
  await page.waitForFunction(() => (window as unknown as { __labFrames: unknown[] }).__labFrames.length > 0, undefined, { timeout: 60_000 });
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
