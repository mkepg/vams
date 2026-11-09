/**
 * BLACK-BOX TEST SUITE — BB-LAB
 * The /lab page: its route, its header link, the isolation its worker needs, and the dev server
 * that serves the runtime built on this machine.
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { findRouteMeta, prerenderRoutes, publishedRoutes, ROUTES } from '@/app/routes/route-meta';
import { buildSitemap } from '@/app/seo/sitemap';
import { buildPwaOptions } from '@/app/pwa/pwa-options';
import SiteHeader from '@/widgets/site-header';
import { NAV_LINKS, navLinks } from '@/widgets/site-header/model/nav';
import { assertLiveRuntime, labEnabled, liveRuntimeProblem } from '@/pages/lab/model/lab-enabled';
import { LAB_ENABLED } from '@/shared/config/lab';
import LabPage from '@/pages/lab';
import { ISOLATION_RELOAD_KEY } from '@/pages/lab/model/isolation';
import { devManifest, isLabPage, labDevServer, labRuntimeFile } from '../../scripts/lab/vite-lab-dev';

describe('BB-LAB-32: /lab is a route, and the header lists Lab after Gallery', () => {
  it('has indexable metadata, a nav link after Gallery and a prerender entry', () => {
    const meta = ROUTES.find((r) => r.path === '/lab')!;
    expect(meta).toBeDefined();
    expect(meta.indexable).toBe(true);
    expect(findRouteMeta('/lab').title).toBe('Lab — VAMS');
    expect(meta.description).toBe('Write a 2D OpenGL and GLUT program in C++ and run it in your browser, with nothing to install.');
    // The tests run with the Lab on, as the dev server does.
    expect(LAB_ENABLED).toBe(true);
    const hrefs = navLinks(true).map((l) => l.href);
    expect(hrefs.indexOf('/lab')).toBe(hrefs.indexOf('/gallery') + 1);
    expect(navLinks(true).find((l) => l.href === '/lab')!.label).toBe('Lab');
    expect(NAV_LINKS.map((l) => l.href)).toEqual(hrefs);
    expect(prerenderRoutes(true)).toContain('/lab');
    expect(publishedRoutes(true)).toContain(meta);
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

  it('shows the message once, with no reload, when the browser blocks sessionStorage', async () => {
    setIsolated(false);
    const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    const blocked = () => {
      throw new Error('blocked');
    };
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: { getItem: blocked, setItem: blocked, removeItem: blocked },
    });
    const reload = vi.fn();
    const host = await open(reload);
    expect(reload).not.toHaveBeenCalled();
    expect(host.querySelectorAll('.lab__notice')).toHaveLength(1);
    expect(host.textContent!.split('The Lab needs a fresh page load.')).toHaveLength(2);
    if (original) Object.defineProperty(window, 'sessionStorage', original);
    else Reflect.deleteProperty(window, 'sessionStorage');
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
    expect(host.querySelector('.lab-workspace')).not.toBeNull();
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

  /** Runs the plugin's middleware on a fake server, with a fake request and response. */
  async function request(dir: string, url: string, method = 'GET') {
    const plugin = labDevServer(dir);
    let handler!: (req: unknown, res: unknown, next: () => void) => void;
    (plugin.configureServer as (server: unknown) => void)({ middlewares: { use: (fn: typeof handler) => (handler = fn) } });
    const headers: Record<string, string> = {};
    const body: Buffer[] = [];
    const res = Object.assign(new PassThrough(), {
      statusCode: 200,
      setHeader: (name: string, value: string) => void (headers[name.toLowerCase()] = value),
    });
    res.on('data', (chunk: Buffer) => body.push(chunk));
    const finished = new Promise<void>((done) => res.on('end', done));
    let passed = false;
    handler({ url, method }, res, () => {
      passed = true;
      res.end();
    });
    await finished;
    return { status: res.statusCode, headers, body: Buffer.concat(body).toString(), passed };
  }

  it('is a serve-only plugin', () => {
    expect(labDevServer('.').apply).toBe('serve');
  });

  it('sends COOP and COEP for /lab, then lets the page through', async () => {
    const r = await request(runtimeDir(), '/lab?x=1');
    expect(r.passed).toBe(true);
    expect(r.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(r.headers['cross-origin-embedder-policy']).toBe('require-corp');
    const other = await request(runtimeDir(), '/learn');
    expect(other.passed).toBe(true);
    expect(other.headers['cross-origin-opener-policy']).toBeUndefined();
  });

  it('streams a runtime file with its content type and CORP', async () => {
    const r = await request(runtimeDir(), '/lab-runtime/dev/vams_main.mjs');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('text/javascript; charset=utf-8');
    expect(r.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(r.body).toBe('export default 1;');
    expect(r.passed).toBe(false);
    const head = await request(runtimeDir(), '/lab-runtime/dev/vams_main.mjs', 'HEAD');
    expect(head.status).toBe(200);
    expect(head.body).toBe('');
  });

  it('answers 404 with nothing else for a missing file and for a path that climbs out', async () => {
    for (const url of ['/lab-runtime/dev/missing.wasm', '/lab-runtime/dev/../../package.json', '/lab-runtime/dev/%2e%2e/package.json']) {
      const r = await request(runtimeDir(), url);
      expect(r.status).toBe(404);
      expect(r.body).toBe('');
      expect(r.headers['content-type']).toBeUndefined();
      expect(r.passed).toBe(false);
    }
  });

  it('refuses methods other than GET and HEAD', async () => {
    const r = await request(runtimeDir(), '/lab-runtime/dev/vams_main.mjs', 'POST');
    expect(r.status).toBe(405);
    expect(r.body).toBe('');
  });

  const compilerDir = () => {
    const dir = mkdtempSync(join(tmpdir(), 'vams-lab-compiler-'));
    dirs.push(dir);
    writeFileSync(join(dir, 'bundle.js'), 'export {};');
    writeFileSync(join(dir, 'llvm.core.wasm'), new Uint8Array([0, 97, 115, 109, 1]));
    writeFileSync(join(dir, 'llvm-resources.tar'), new Uint8Array(3));
    return dir;
  };

  it('finds the compiler files after the runtime build, the runtime build first', () => {
    const dir = runtimeDir();
    const compiler = compilerDir();
    writeFileSync(join(compiler, 'vams_main.mjs'), 'not this one');
    expect(labRuntimeFile('/lab-runtime/dev/llvm-resources.tar', dir, compiler)).toMatchObject({ path: join(compiler, 'llvm-resources.tar'), type: 'application/x-tar' });
    expect(labRuntimeFile('/lab-runtime/dev/bundle.js', dir, compiler)?.type).toBe('text/javascript; charset=utf-8');
    expect(labRuntimeFile('/lab-runtime/dev/vams_main.mjs', dir, compiler)?.path).toBe(join(dir, 'vams_main.mjs'));
  });

  it('makes the compiler manifest from the files on disk, the headers pack last, and none without the pack', () => {
    const dir = runtimeDir();
    const compiler = compilerDir();
    expect(devManifest(dir, compiler)).toBeNull();
    writeFileSync(join(dir, 'lab-headers.json'), '{"include/GL/gl.h":""}');
    const modified = expect.any(Number);
    expect(devManifest(dir, compiler)).toEqual({
      files: [
        { name: 'bundle.js', bytes: 10, stored: 10, modified },
        { name: 'llvm-resources.tar', bytes: 3, stored: 3, modified },
        { name: 'llvm.core.wasm', bytes: 5, stored: 5, modified },
        { name: 'lab-headers.json', bytes: 22, stored: 22, modified },
      ],
    });
  });

  it('gives each file the time it last changed, so a rebuilt file of the same size is noticed', () => {
    const dir = runtimeDir();
    const compiler = compilerDir();
    const pack = join(dir, 'lab-headers.json');
    writeFileSync(pack, '{"include/GL/gl.h":""}');
    utimesSync(pack, new Date(1_000_000), new Date(1_000_000));
    expect(devManifest(dir, compiler)?.files.at(-1)?.modified).toBe(1_000_000);
    utimesSync(pack, new Date(2_000_000), new Date(2_000_000));
    expect(devManifest(dir, compiler)?.files.at(-1)?.modified).toBe(2_000_000);
  });

  it('serves the manifest at /lab-runtime/dev/compiler-manifest.json', async () => {
    const r = await request(runtimeDir(), '/lab-runtime/dev/compiler-manifest.json');
    expect(r.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(r.passed).toBe(false);
    // The temporary runtime has no headers pack, so there is no manifest to give.
    expect(r.status).toBe(404);
  });
});

describe('BB-LAB-59: A production build without the flag leaves the Lab out', () => {
  const off = { live: false, flag: undefined, dev: false };

  it('is on only when live, flagged with VITE_LAB=1, or in the dev server', () => {
    expect(labEnabled(off)).toBe(false);
    expect(labEnabled({ ...off, flag: '0' })).toBe(false);
    expect(labEnabled({ ...off, flag: '1' })).toBe(true);
    expect(labEnabled({ ...off, dev: true })).toBe(true);
    expect(labEnabled({ ...off, live: true })).toBe(true);
  });

  it('leaves out the header link, the prerender and the sitemap entry', () => {
    expect(navLinks(false).map((l) => l.href)).toEqual(['/', '/learn', '/gallery', '/guide', '/about']);
    expect(prerenderRoutes(false)).not.toContain('/lab');
    expect(publishedRoutes(false).some((r) => r.path === '/lab')).toBe(false);
    expect(buildSitemap('https://example.test', publishedRoutes(false))).not.toContain('/lab');
    expect(buildSitemap('https://example.test', publishedRoutes(true))).toContain('<loc>https://example.test/lab/</loc>');
  });

  it('makes every consumer read the one decision', () => {
    const config = readFileSync('vite.config.ts', 'utf8');
    expect(config).toContain('labEnabled({ live: LAB_LIVE');
    expect(config).toContain('__LAB_ENABLED__: JSON.stringify(labOn)');
    expect(config).toContain('prerenderRoutes(labOn)');
    expect(config).toContain('publishedRoutes(labOn)');
    expect(readFileSync('src/app/SiteApp.tsx', 'utf8')).toContain('LAB_ENABLED ?');
    expect(readFileSync('playwright.config.ts', 'utf8')).toContain("VITE_LAB: '1'");
  });
});

describe('BB-LAB-87: Every page’s bundle leaves the Lab out; the Lab loads on its own', () => {
  /** The modules main.tsx reaches through static imports: `import type` and import() are left out. */
  function staticGraph(entry: string): Set<string> {
    const seen = new Set<string>();
    const resolve = (from: string, spec: string): string | null => {
      const base = spec.startsWith('@/') ? join('src', spec.slice(2)) : spec.startsWith('.') ? join(from, '..', spec) : null;
      if (base === null) return `package:${spec.split('/')[0]}`;
      for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
        try {
          if (!(base + ext).match(/\.(ts|tsx)$/)) continue;
          readFileSync(base + ext);
          return (base + ext).replace(/\\/g, '/');
        } catch {
          // Try the next form.
        }
      }
      return null;
    };
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      if (file.startsWith('package:')) return;
      const text = readFileSync(file, 'utf8');
      for (const [, spec] of text.matchAll(/^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?'([^']+)'/gm)) {
        if (/\.(s?css)$/.test(spec)) continue;
        const next = resolve(file, spec);
        if (next) visit(next);
      }
    };
    visit(entry);
    return seen;
  }

  it('keeps the Lab page, its store and sonner out of the modules every page loads', () => {
    const graph = staticGraph('src/app/main.tsx');
    expect(graph.has('src/app/SiteApp.tsx')).toBe(true);
    expect(graph.has('src/pages/home/index.ts')).toBe(true);
    expect([...graph].filter((f) => f.startsWith('src/pages/lab/') || f.startsWith('src/widgets/lab-workspace/') || f.startsWith('src/entities/lab-project/'))).toEqual([]);
    expect(graph.has('package:sonner')).toBe(false);
    expect(readFileSync('src/app/SiteApp.tsx', 'utf8')).toMatch(/LAB_ENABLED \? lazy\(\(\) => import\('@\/pages\/lab'\)\)/);
  });
});

describe('BB-LAB-92: A live build refuses the development runtime', () => {
  it('fails a build that is live while the runtime version is dev, and names the fix', () => {
    const problem = liveRuntimeProblem({ live: true, build: true, runtimeVersion: 'dev' });
    expect(problem).toMatch(/LAB_LIVE/);
    expect(problem).toMatch(/runtimeVersion/);
    expect(problem).toMatch(/publish-runtime/);
    expect(() => assertLiveRuntime({ live: true, build: true, runtimeVersion: 'dev' })).toThrow(problem!);
  });

  it('lets the dev server, the flagged visual build and a build with the Lab off through', () => {
    // The dev server serves the local runtime at /lab-runtime/dev/.
    expect(liveRuntimeProblem({ live: true, build: false, runtimeVersion: 'dev' })).toBeNull();
    // A build with LAB_LIVE false, as the VITE_LAB=1 visual build of a branch may be.
    expect(liveRuntimeProblem({ live: false, build: true, runtimeVersion: 'dev' })).toBeNull();
    expect(liveRuntimeProblem({ live: false, build: false, runtimeVersion: 'dev' })).toBeNull();
    // A published runtime may go live.
    expect(liveRuntimeProblem({ live: true, build: true, runtimeVersion: '4.0.10-1a2b3c4d' })).toBeNull();
    expect(() => assertLiveRuntime({ live: false, build: true, runtimeVersion: 'dev' })).not.toThrow();
  });

  it('is checked by the build with the real switch and the real runtime version', () => {
    const config = readFileSync('vite.config.ts', 'utf8');
    expect(config).toContain("import { runtimeVersion } from './src/features/lab-run/model/runtime-version'");
    expect(config).toContain("assertLiveRuntime({ live: LAB_LIVE, build: command === 'build', runtimeVersion })");
  });
});
