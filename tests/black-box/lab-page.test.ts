/**
 * BLACK-BOX TEST SUITE — BB-LAB
 * The /lab page: its route, its header link, the isolation its worker needs, and the dev server
 * that serves the runtime built on this machine.
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { findRouteMeta, ROUTES } from '@/app/routes/route-meta';
import { buildPwaOptions } from '@/app/pwa/pwa-options';
import SiteHeader from '@/widgets/site-header';
import { NAV_LINKS } from '@/widgets/site-header/model/nav';
import LabPage from '@/pages/lab';
import { ISOLATION_RELOAD_KEY } from '@/pages/lab/model/isolation';
import { isLabPage, labRuntimeFile } from '../../scripts/lab/vite-lab-dev';

describe('BB-LAB-32: /lab is a route, and the header lists Lab after Gallery', () => {
  it('has indexable metadata, a nav link after Gallery and a prerender entry', () => {
    const meta = ROUTES.find((r) => r.path === '/lab')!;
    expect(meta).toBeDefined();
    expect(meta.indexable).toBe(true);
    expect(findRouteMeta('/lab').title).toBe('Lab — VAMS');
    expect(meta.description).toBe('Write a 2D OpenGL and GLUT program in C++ and run it in your browser, with nothing to install.');
    const hrefs = NAV_LINKS.map((l) => l.href);
    expect(hrefs.indexOf('/lab')).toBe(hrefs.indexOf('/gallery') + 1);
    expect(NAV_LINKS.find((l) => l.href === '/lab')!.label).toBe('Lab');
    expect(readFileSync('vite.config.ts', 'utf8')).toMatch(/additionalPrerenderRoutes:\s*\[[^\]]*'\/lab'/);
  });
});

describe('BB-LAB-33: The Lab link is a native link the router does not intercept', () => {
  it('is marked native and carries a target the router leaves to the browser', () => {
    expect(NAV_LINKS.find((l) => l.href === '/lab')!.native).toBe(true);
    expect(NAV_LINKS.filter((l) => l.href !== '/lab').every((l) => !l.native)).toBe(true);
    const host = document.createElement('div');
    render(h(SiteHeader, { current: '/' }), host);
    const lab = host.querySelector<HTMLAnchorElement>('a[href="/lab"]')!;
    // preact-iso handles a click on any same-origin link whose target is empty or _self.
    expect(/^(_?self)?$/i.test(lab.target)).toBe(false);
    const learn = host.querySelector<HTMLAnchorElement>('a.site-header__link[href="/learn"]')!;
    expect(/^(_?self)?$/i.test(learn.target)).toBe(true);
    render(null, host);
  });
});

/** The rules a header block applies to each path in a Pages _headers file. */
function parseHeaders(file: string): Map<string, Record<string, string>> {
  const rules = new Map<string, Record<string, string>>();
  let current: Record<string, string> | null = null;
  for (const line of file.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) {
      current = rules.get(line.trim()) ?? {};
      rules.set(line.trim(), current);
    } else if (current) {
      const i = line.indexOf(':');
      current[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return rules;
}

describe('BB-LAB-34: public/_headers isolates /lab and /lab/* and nothing else', () => {
  it('sets both cross-origin policies for exactly those two paths', () => {
    const rules = parseHeaders(readFileSync('public/_headers', 'utf8'));
    const isolated = [...rules.entries()].filter(([, r]) => 'Cross-Origin-Opener-Policy' in r || 'Cross-Origin-Embedder-Policy' in r);
    expect(isolated.map(([path]) => path).sort()).toEqual(['/lab', '/lab/*']);
    for (const [, r] of isolated) {
      expect(r['Cross-Origin-Opener-Policy']).toBe('same-origin');
      expect(r['Cross-Origin-Embedder-Policy']).toBe('require-corp');
    }
  });
});

describe('BB-LAB-35: The service worker leaves /lab to the network', () => {
  it('denies the navigation fallback for /lab and keeps lab files out of the precache', () => {
    const workbox = buildPwaOptions().workbox!;
    const deny = workbox.navigateFallbackDenylist ?? [];
    expect(deny.some((re) => re.test('/lab'))).toBe(true);
    expect(deny.some((re) => re.test('/lab/'))).toBe(true);
    expect(deny.some((re) => re.test('/learn'))).toBe(false);
    expect(workbox.globIgnores).toContain('lab/**');
    expect(workbox.globPatterns?.join(' ')).not.toMatch(/lab/);
  });
});

describe('BB-LAB-36: A page that is not isolated reloads once, then asks for a reload', () => {
  const setIsolated = (value: boolean) => Object.defineProperty(window, 'crossOriginIsolated', { value, configurable: true });
  afterEach(() => {
    sessionStorage.clear();
    Reflect.deleteProperty(window, 'crossOriginIsolated');
  });

  async function open(reload: () => void) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    await act(() => render(h(LabPage, { reload }), host));
    return host;
  }

  it('reloads on the first false and marks the attempt', async () => {
    setIsolated(false);
    const reload = vi.fn();
    const host = await open(reload);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(ISOLATION_RELOAD_KEY)).not.toBeNull();
    expect(host.textContent).not.toContain('The Lab needs a fresh page load.');
    render(null, host);
    host.remove();
  });

  it('shows the message and a working Reload button on the second false', async () => {
    setIsolated(false);
    sessionStorage.setItem(ISOLATION_RELOAD_KEY, '1');
    const reload = vi.fn();
    const host = await open(reload);
    expect(reload).not.toHaveBeenCalled();
    expect(host.querySelector('.lab__notice')!.textContent).toBe('The Lab needs a fresh page load. Reload');
    const button = host.querySelector<HTMLButtonElement>('.lab__notice button')!;
    expect(button.textContent).toBe('Reload');
    await act(() => button.click());
    expect(reload).toHaveBeenCalledTimes(1);
    render(null, host);
    host.remove();
  });

  it('shows the workspace, and clears the mark, when the page is isolated', async () => {
    setIsolated(true);
    sessionStorage.setItem(ISOLATION_RELOAD_KEY, '1');
    const reload = vi.fn();
    const host = await open(reload);
    expect(reload).not.toHaveBeenCalled();
    expect(host.querySelector('.lab__notice')).toBeNull();
    expect(host.querySelector('.lab__placeholder')).not.toBeNull();
    expect(sessionStorage.getItem(ISOLATION_RELOAD_KEY)).toBeNull();
    render(null, host);
    host.remove();
  });
});

describe('BB-LAB-65: The dev server serves the local runtime build and isolates /lab', () => {
  const dirs: string[] = [];
  afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));
  const runtimeDir = () => {
    const dir = mkdtempSync(join(tmpdir(), 'vams-lab-out-'));
    dirs.push(dir);
    writeFileSync(join(dir, 'vams_main.mjs'), 'export default 1;');
    writeFileSync(join(dir, 'vams_main.wasm'), new Uint8Array([0, 97, 115, 109]));
    mkdirSync(join(dir, 'task11'));
    return dir;
  };

  it('finds the runtime files with their content types', () => {
    const dir = runtimeDir();
    expect(labRuntimeFile('/lab-runtime/dev/vams_main.mjs', dir)?.type).toBe('text/javascript; charset=utf-8');
    expect(labRuntimeFile('/lab-runtime/dev/vams_main.wasm', dir)?.type).toBe('application/wasm');
  });

  it('finds nothing for a missing file, another version, a folder or a path that climbs out', () => {
    const dir = runtimeDir();
    expect(labRuntimeFile('/lab-runtime/dev/missing.mjs', dir)).toBeNull();
    expect(labRuntimeFile('/lab-runtime/1.0.0/vams_main.mjs', dir)).toBeNull();
    expect(labRuntimeFile('/lab-runtime/dev/task11', dir)).toBeNull();
    expect(labRuntimeFile('/lab-runtime/dev/../package.json', dir)).toBeNull();
    expect(labRuntimeFile('/lab-runtime/dev/%2e%2e/package.json', dir)).toBeNull();
  });

  it('sends the isolation headers for /lab and its subpaths only', () => {
    expect(isLabPage('/lab')).toBe(true);
    expect(isLabPage('/lab/')).toBe(true);
    expect(isLabPage('/learn')).toBe(false);
    expect(isLabPage('/lab-runtime/dev/vams_main.mjs')).toBe(false);
  });

  it('is a dev-only plugin in the config', () => {
    expect(readFileSync('vite.config.ts', 'utf8')).toContain('labDevServer(');
    expect(readFileSync('scripts/lab/vite-lab-dev.ts', 'utf8')).toContain("apply: 'serve'");
  });
});
