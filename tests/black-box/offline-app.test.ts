/**
 * BLACK-BOX TEST SUITE — BB-PWA
 * Offline app: service-worker options, the precache route mapping, icons and the update notice.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { h, render } from 'preact';
import { buildPwaOptions, routeDocumentsTransform, toRouteUrl } from '@/app/pwa/pwa-options';
import UpdateNotice from '@/app/pwa/UpdateNotice';
import type { ServiceWorkerEvents } from '@/app/pwa/register';

async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

type ManifestIcon = { src: string; purpose?: string };

function manifestOf(): { icons?: ManifestIcon[]; [key: string]: unknown } {
  const manifest = buildPwaOptions().manifest;
  return manifest ? (manifest as { icons?: ManifestIcon[] }) : {};
}

describe('BB-PWA-01: Updates wait for the user and the app is installable', () => {
  it('prompts instead of activating on its own, and describes the app', () => {
    const options = buildPwaOptions();
    expect(options.registerType).toBe('prompt');
    expect(options.injectRegister).toBe(false);
    expect(options.workbox?.skipWaiting).not.toBe(true);
    expect(options.workbox?.clientsClaim).not.toBe(true);
    expect(options.devOptions?.enabled).toBe(false);
    const manifest = manifestOf();
    expect(manifest).toMatchObject({
      name: 'VAMS — Visual OpenGL 1.5 simulator',
      short_name: 'VAMS',
      start_url: '/app',
      scope: '/',
      display: 'standalone',
      theme_color: '#1d2b4f',
      background_color: '#f4f5f2',
    });
    expect(manifest.icons?.some((icon) => icon.purpose === 'maskable')).toBe(true);
  });
});

describe('BB-PWA-02: Linked and stage URLs resolve to cached pages', () => {
  it('ignores query parameters, skips social images and falls back to the 404 page', () => {
    const workbox = buildPwaOptions().workbox!;
    const ignored = workbox.ignoreURLParametersMatching ?? [];
    for (const param of ['scene', 'lesson', 'stage']) expect(ignored.some((re) => re.test(param))).toBe(true);
    expect(workbox.globIgnores).toContain('og/**');
    expect(workbox.globPatterns?.[0]).not.toContain('webmanifest');
    expect(workbox.navigateFallback).toBe('/404/index.html');
    expect(workbox.navigateFallbackDenylist?.some((re) => re.test('/sitemap.xml'))).toBe(true);
    expect(workbox.cleanupOutdatedCaches).toBe(true);
  });
});

describe('BB-PWA-03: Prerendered route documents are cached under their clean URL too', () => {
  it('adds an app entry and leaves the root and 404 documents alone', async () => {
    expect(toRouteUrl('app/index.html')).toBe('app');
    expect(toRouteUrl('index.html')).toBeNull();
    expect(toRouteUrl('404/index.html')).toBeNull();
    expect(toRouteUrl('assets/main.js')).toBeNull();
    const entries = ['index.html', 'app/index.html', '404/index.html', 'assets/a.js'].map((url) => ({ url, revision: 'r', size: 1 }));
    const { manifest } = await routeDocumentsTransform(entries);
    expect(manifest.map((e) => e.url)).toEqual(['index.html', 'app/index.html', 'app', '404/index.html', 'assets/a.js']);
    expect(manifest.find((e) => e.url === 'app')?.revision).toBe('r');
  });
});

describe('BB-PWA-04: Every icon the manifest and page name exists', () => {
  it('finds the icon files in public/', () => {
    const icons = manifestOf().icons ?? [];
    expect(icons).toHaveLength(3);
    for (const icon of icons) expect(existsSync(`public${icon.src}`)).toBe(true);
    expect(existsSync('public/apple-touch-icon-180x180.png')).toBe(true);
  });
});

function mountNotice(offlineNoticeMs = 6000) {
  let events: ServiceWorkerEvents | null = null;
  const update = vi.fn().mockResolvedValue(undefined);
  const register = (e: ServiceWorkerEvents) => {
    events = e;
    return Promise.resolve(update);
  };
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(h(UpdateNotice, { register, offlineNoticeMs }), host);
  return { host, update, fire: () => events! };
}

describe('BB-PWA-05: The notice offers the waiting update and announces offline readiness', () => {
  afterEach(() => document.documentElement.classList.remove('stage'));
  it('reloads into the update on request, hides on Later, and the offline note times out', async () => {
    const { host, update, fire } = mountNotice(150);
    await settle();
    expect(host.querySelector('[role="status"]')?.textContent).toBe('');

    fire().onOfflineReady();
    await settle();
    expect(host.textContent).toContain('VAMS now works offline.');
    await new Promise((resolve) => setTimeout(resolve, 250));
    await settle();
    expect(host.textContent).not.toContain('VAMS now works offline.');

    fire().onNeedRefresh();
    await settle();
    expect(host.textContent).toContain('A new version of VAMS is ready.');
    [...host.querySelectorAll('button')].find((b) => b.textContent === 'Reload')!.click();
    expect(update).toHaveBeenCalledWith(true);
    [...host.querySelectorAll('button')].find((b) => b.textContent === 'Later')!.click();
    await settle();
    expect(host.textContent).not.toContain('A new version');
    render(null, host);
    host.remove();
  });
});

describe('BB-PWA-06: No notice covers the slides while presenting', () => {
  afterEach(() => document.documentElement.classList.remove('stage'));
  it('holds the update notice until stage mode ends', async () => {
    const { host, fire } = mountNotice();
    await settle();
    document.documentElement.classList.add('stage');
    await settle();
    fire().onNeedRefresh();
    await settle();
    expect(host.textContent).not.toContain('A new version');
    document.documentElement.classList.remove('stage');
    await settle();
    expect(host.textContent).toContain('A new version of VAMS is ready.');
    render(null, host);
    host.remove();
  });
});

describe('BB-PWA-07: The page and host headers support the installed app', () => {
  it('sets a theme colour and never caches the service worker file', () => {
    expect(readFileSync('index.html', 'utf8')).toContain('<meta name="theme-color" content="#1d2b4f" />');
    const headers = readFileSync('public/_headers', 'utf8');
    expect(headers).toMatch(/\/sw\.js\s+Cache-Control: no-cache/);
    expect(headers).toMatch(/\/manifest\.webmanifest\s+Cache-Control: no-cache/);
  });
});
