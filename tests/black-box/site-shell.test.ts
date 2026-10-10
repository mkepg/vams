/**
 * BLACK-BOX TEST SUITE — BB-SITE
 * Site shell: theming, route metadata and SEO output, prerendering, site chrome.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  readStoredTheme,
  resolveTheme,
  getActiveTheme,
  setTheme,
  toggleTheme,
  subscribeTheme,
  followSystemTheme,
  toEditorTheme,
  THEME_STORAGE_KEY,
} from '@/shared/lib/theme';

/** A controllable prefers-color-scheme query. */
function mockScheme(initiallyDark: boolean) {
  let dark = initiallyDark;
  const listeners = new Set<() => void>();
  const query = {
    get matches() { return dark; },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  };
  vi.spyOn(window, 'matchMedia').mockImplementation(() => query as unknown as MediaQueryList);
  return {
    set(next: boolean) {
      dark = next;
      listeners.forEach((l) => l());
    },
    listenerCount: () => listeners.size,
  };
}

function resetTheme() {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
}

afterEach(() => vi.restoreAllMocks());

describe('BB-SITE-01: Stored themes resolve, and legacy names migrate', () => {
  beforeEach(resetTheme);
  it('reads dark and light, and rewrites blueprint and vellum under the same key', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(readStoredTheme()).toBe('dark');
    localStorage.setItem(THEME_STORAGE_KEY, 'blueprint');
    expect(readStoredTheme()).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    localStorage.setItem(THEME_STORAGE_KEY, 'vellum');
    expect(readStoredTheme()).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });
});

describe('BB-SITE-02: With no usable stored value the theme follows the OS', () => {
  beforeEach(resetTheme);
  it('ignores unknown values and survives storage that throws', () => {
    mockScheme(true);
    localStorage.setItem(THEME_STORAGE_KEY, 'toString');
    expect(readStoredTheme()).toBeNull();
    expect(resolveTheme()).toBe('dark');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(resolveTheme()).toBe('dark');
    expect(getActiveTheme()).toBe('dark');
  });
});

describe('BB-SITE-03: setTheme persists and applies the theme', () => {
  beforeEach(resetTheme);
  it('stores the value and sets data-theme on <html>', () => {
    setTheme('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(getActiveTheme()).toBe('dark');
  });
});

describe('BB-SITE-04: The OS is followed live only until the student chooses', () => {
  beforeEach(resetTheme);
  it('applies OS changes while unset, then ignores them after a toggle', () => {
    const scheme = mockScheme(false);
    const seen: string[] = [];
    const unsubscribe = subscribeTheme((theme) => seen.push(theme));
    const stop = followSystemTheme();
    scheme.set(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(toggleTheme()).toBe('light');
    scheme.set(true);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(seen).toEqual(['dark', 'light']);
    stop();
    expect(scheme.listenerCount()).toBe(0);
    unsubscribe();
  });
});

describe('BB-SITE-05: Site themes are the editor store values', () => {
  it('maps each theme to itself', () => {
    expect(toEditorTheme('dark')).toBe('dark');
    expect(toEditorTheme('light')).toBe('light');
  });
});

import { ROUTES, findRouteMeta, DEFAULT_SITE_URL } from '@/app/routes/route-meta';
import { buildHead, absoluteUrl } from '@/app/seo/head';
import { buildSitemap, buildRobots } from '@/app/seo/sitemap';

const SITE = 'https://example.test';
const BANNED = ['coming soon', 'not yet', 'future', 'deferred', 'unsupported', 'not supported', '3d', 'lighting'];

describe('BB-SITE-06: Every route declares complete metadata', () => {
  it('has a unique path and a non-empty title and description', () => {
    const paths = ROUTES.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const route of ROUTES) {
      expect(route.title.trim().length).toBeGreaterThan(0);
      expect(route.description.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('BB-SITE-07: Only content routes are indexable', () => {
  it('indexes / and keeps /app and /404 out of search', () => {
    expect(findRouteMeta('/').indexable).toBe(true);
    expect(findRouteMeta('/app').indexable).toBe(false);
    expect(findRouteMeta('/404').indexable).toBe(false);
  });
});

describe('BB-SITE-08: findRouteMeta normalises paths and falls back to 404', () => {
  it('ignores trailing slashes and maps unknown paths to /404', () => {
    expect(findRouteMeta('/app/').path).toBe('/app');
    expect(findRouteMeta('/no-such-page').path).toBe('/404');
  });
});

describe('BB-SITE-09: The home page head carries SEO and preview tags', () => {
  it('includes description, canonical URL, Open Graph tags and JSON-LD', () => {
    const head = buildHead(findRouteMeta('/'), SITE);
    const elements = [...head.elements];
    const meta = (key: string, value: string) =>
      elements.find((e) => e.type === 'meta' && (e.props.name === key || e.props.property === key))?.props.content === value;
    expect(head.title).toBe(findRouteMeta('/').title);
    expect(head.lang).toBe('en');
    expect(meta('description', findRouteMeta('/').description)).toBe(true);
    expect(elements.some((e) => e.type === 'link' && e.props.rel === 'canonical' && e.props.href === 'https://example.test/')).toBe(true);
    expect(meta('og:image', absoluteUrl(SITE, '/og/og-default.png'))).toBe(true);
    expect(meta('twitter:card', 'summary_large_image')).toBe(true);
    const jsonLd = elements.find((e) => e.type === 'script' && e.props.type === 'application/ld+json');
    expect(JSON.parse(jsonLd!.props.children)['@type']).toBe('SoftwareApplication');
    expect(elements.some((e) => e.props.name === 'robots')).toBe(false);
  });
});

describe('BB-SITE-10: Non-indexable routes are marked noindex', () => {
  it('adds robots noindex and omits the canonical link for /app', () => {
    const elements = [...buildHead(findRouteMeta('/app'), SITE).elements];
    expect(elements.some((e) => e.props.name === 'robots' && e.props.content === 'noindex')).toBe(true);
    expect(elements.some((e) => e.props.rel === 'canonical')).toBe(false);
  });
});

describe('BB-SITE-11: Sitemap and robots list only indexable routes', () => {
  it('builds absolute URLs from the configured site URL', () => {
    const sitemap = buildSitemap(SITE);
    expect(sitemap).toContain('<loc>https://example.test/</loc>');
    expect(sitemap).not.toContain('/app');
    expect(sitemap).not.toContain('/404');
    expect(buildRobots(SITE)).toContain('Sitemap: https://example.test/sitemap.xml');
    expect(DEFAULT_SITE_URL).toBe('https://panic-vams.netlify.app');
  });
});

describe('BB-SITE-12: Route copy follows the student-facing language rules', () => {
  it('contains none of the banned phrases', () => {
    for (const route of ROUTES) {
      const text = `${route.title} ${route.description}`.toLowerCase();
      for (const phrase of BANNED) expect(text).not.toContain(phrase);
    }
  });
});

import { h, render } from 'preact';
import Logo from '@/shared/ui/logo';

describe('BB-SITE-13: The wordmark exposes an accessible name and its text', () => {
  it('renders VAMS as text inside a named image', () => {
    const host = document.createElement('div');
    render(h(Logo, {}), host);
    const logo = host.querySelector('.vams-logo')!;
    expect(logo.getAttribute('role')).toBe('img');
    expect(logo.getAttribute('aria-label')).toBe('VAMS');
    expect(host.querySelector('.vams-logo__word')?.textContent).toBe('VAMS');
    expect(host.querySelector('svg')).toBeNull();
    render(null, host);
  });
});

describe('BB-SITE-14: The wordmark text is hidden from assistive technology', () => {
  it('keeps the name on the wrapper only, and accepts a custom name', () => {
    const host = document.createElement('div');
    render(h(Logo, { title: 'VAMS home' }), host);
    expect(host.querySelector('.vams-logo')!.getAttribute('aria-label')).toBe('VAMS home');
    expect(host.querySelector('.vams-logo__word')!.getAttribute('aria-hidden')).toBe('true');
    render(null, host);
  });
});

import { readFileSync } from 'node:fs';
import { prerender } from '@/app/prerender';
import { NAV_LINKS } from '@/widgets/site-header/model/nav';

async function prerenderAt(url: string) {
  window.history.replaceState(null, '', url);
  return prerender({ url });
}

describe('BB-SITE-15: Prerendering / produces the home page with its head', () => {
  it('renders home content, hydration data, the route title and discovers /app', async () => {
    const result = await prerenderAt('/');
    expect(result.html).toContain('class="home"');
    expect(result.html).toContain('<script type="isodata"></script>');
    expect(result.head.title).toBe(findRouteMeta('/').title);
    expect([...result.links]).toContain('/app');
  });
});

describe('BB-SITE-16: Prerendering /app produces only the loading shell', () => {
  it('renders the loading status and marks the page noindex', async () => {
    const result = await prerenderAt('/app');
    expect(result.html).toContain('class="editor-loading"');
    expect(result.html).toContain('role="status"');
    const robots = [...result.head.elements].find((e) => e.props.name === 'robots');
    expect(robots?.props.content).toContain('noindex');
  });
});

describe('BB-SITE-17: Unknown paths prerender the not-found page', () => {
  it('renders the not-found page with 404 metadata', async () => {
    const result = await prerenderAt('/404');
    expect(result.html).toContain('class="not-found"');
    expect(result.head.title).toBe(findRouteMeta('/404').title);
  });
  it('renders the not-found page for a path no route declares', async () => {
    const result = await prerenderAt('/nope');
    expect(result.html).toContain('class="not-found"');
    expect(result.head.title).toBe(findRouteMeta('/404').title);
  });
});

describe('BB-SITE-18: The header links only finished, indexable pages', () => {
  it('references routes that exist and are indexable', () => {
    for (const link of NAV_LINKS) {
      const meta = findRouteMeta(link.href);
      expect(meta.path).toBe(link.href);
      expect(meta.indexable).toBe(true);
    }
  });
});

describe('BB-SITE-19: The early theme script matches the theme module', () => {
  it('reads the same storage key and sets the editor class on /app', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain(`'${THEME_STORAGE_KEY}'`);
    expect(html).toContain("classList.add('route-editor')");
    expect(html).toContain("'(prefers-color-scheme: dark)'");
  });
});

describe('BB-SITE-21: The pre-paint script resolves the same theme as the module', () => {
  const html = readFileSync('index.html', 'utf8');
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1];
  const cases: { stored: string | null; osDark: boolean }[] = [
    { stored: null, osDark: false },
    { stored: null, osDark: true },
    { stored: 'dark', osDark: false },
    { stored: 'light', osDark: true },
    { stored: 'blueprint', osDark: false },
    { stored: 'vellum', osDark: true },
    { stored: 'nonsense', osDark: true },
  ];
  for (const { stored, osDark } of cases) {
    it(`stored=${stored} osDark=${osDark}`, () => {
      localStorage.clear();
      if (stored !== null) localStorage.setItem(THEME_STORAGE_KEY, stored);
      mockScheme(osDark);
      delete document.documentElement.dataset.theme;
      new Function(script)();
      const painted = document.documentElement.dataset.theme;
      delete document.documentElement.dataset.theme;
      if (stored === 'blueprint' || stored === 'vellum') expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(painted);
      expect(painted).toBe(resolveTheme());
    });
  }
});

import SiteApp from '@/app/SiteApp';

async function settle() {
  for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

async function navigate(url: string) {
  window.history.pushState(null, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
  await settle();
}

describe('BB-SITE-20: Client-side navigation updates the document title', () => {
  it('sets the route title, ignoring query and hash, and uses the 404 title for unknown paths', async () => {
    window.history.replaceState(null, '', '/');
    document.title = findRouteMeta('/').title;
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h(SiteApp, {}), host);
    await settle();

    await navigate('/nope?from=test#top');
    expect(host.querySelector('.not-found')).not.toBeNull();
    expect(document.title).toBe(findRouteMeta('/404').title);

    await navigate('/?ref=nav');
    expect(host.querySelector('.home')).not.toBeNull();
    expect(document.title).toBe(findRouteMeta('/').title);

    render(null, host);
    host.remove();
  });
});

/** Line endings normalised, so a CRLF checkout (core.autocrlf) parses the same. */
const TOKENS = readFileSync('src/shared/styles/_tokens.scss', 'utf8').replace(/\r\n/g, '\n');

/** The text of one top-level block. */
function blockBody(selector: string): string {
  const start = TOKENS.indexOf(`${selector} {`);
  return TOKENS.slice(start, TOKENS.indexOf('\n}\n', start));
}

function toHex(channels: number[]): string {
  return '#' + channels.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
}

/** `--name: #rrggbb;` declarations inside one top-level block. */
function block(selector: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const m of blockBody(selector).matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) values[m[1]] = m[2].toLowerCase();
  return values;
}

/** A `--name: r, g, b;` triplet inside one top-level block, as #rrggbb. */
function rgbToken(selector: string, name: string): string {
  const m = new RegExp(`${name}:\\s*(\\d+),\\s*(\\d+),\\s*(\\d+)\\s*;`).exec(blockBody(selector))!;
  return toHex(m.slice(1, 4).map(Number));
}

/** The translucent `--canvas-plate` composited over an opaque backdrop, as #rrggbb. */
function plateOver(selector: string, backdrop: string): string {
  const [r, g, b, a] = /--canvas-plate:\s*rgba\(([^)]+)\)/.exec(blockBody(selector))![1].split(',').map(Number);
  return toHex([r, g, b].map((c, i) => c * a + parseInt(backdrop.slice(1 + i * 2, 3 + i * 2), 16) * (1 - a)));
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const PALETTE = {
  dark: { '--paper': '#10141f', '--paper-raised': '#171d2b', '--paper-sunken': '#0b0e16', '--rule': '#29324a', '--ink': '#e4e8f2', '--ink-muted': '#a2abc2', '--ink-faint': '#8a93ab', '--accent': '#4762f5', '--on-accent': '#ffffff', '--accent-text': '#9cadff', '--focus-ring': '#9cadff' },
  light: { '--paper': '#e9edf6', '--paper-raised': '#f6f8fd', '--paper-sunken': '#dde3f0', '--rule': '#c6cfe2', '--ink': '#121827', '--ink-muted': '#47506a', '--ink-faint': '#535c76', '--accent': '#2f4de0', '--on-accent': '#ffffff', '--accent-text': '#2f4de0', '--focus-ring': '#2f4de0' },
};

describe('BB-SITE-22: The tokens declare the Ink + Cobalt palette (Cobalt mist surfaces) for both themes', () => {
  it('matches the spec values and no longer names the old themes', () => {
    const light = block(':root');
    const dark = block("[data-theme='dark']");
    for (const [token, value] of Object.entries(PALETTE.light)) expect(light[token], token).toBe(value);
    for (const [token, value] of Object.entries(PALETTE.dark)) expect(dark[token], token).toBe(value);
    expect(TOKENS).not.toMatch(/blueprint|vellum/i);
    expect(TOKENS).toContain("'Bricolage Grotesque Variable'");
    expect(TOKENS).toContain("'JetBrains Mono Variable'");
  });
});

describe('BB-SITE-23: Text and focus tokens meet WCAG AA on every surface', () => {
  for (const [theme, selector] of [['light', ':root'], ['dark', "[data-theme='dark']"]] as const) {
    it(`${theme} theme`, () => {
      const t = block(selector);
      const surfaces = ['--paper', '--paper-raised', '--paper-sunken', '--code-bg'];
      for (const fg of ['--ink', '--ink-muted', '--ink-faint', '--accent-text', '--success', '--danger']) {
        for (const bg of surfaces) expect(contrast(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(t['--on-accent'], t['--accent'])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t['--on-accent-blue'], rgbToken(selector, '--accent-blue-rgb')), '--on-accent-blue').toBeGreaterThanOrEqual(4.5);
      expect(contrast(t['--on-accent-light'], t['--accent-blue-light']), '--on-accent-light').toBeGreaterThanOrEqual(4.5);
      expect(contrast(t['--canvas-plate-text'], plateOver(selector, t['--paper'])), '--canvas-plate-text').toBeGreaterThanOrEqual(4.5);
      expect(contrast(t['--focus-ring'], t['--paper'])).toBeGreaterThanOrEqual(3);
      expect(contrast(t['--field-line'], t['--paper'])).toBeGreaterThanOrEqual(3);
      expect(contrast(t['--field-line'], t['--field-bg'])).toBeGreaterThanOrEqual(3);
    });
  }
});

describe('BB-SITE-24: Every header, footer and loading screen shows the wordmark', () => {
  it('has no vertex mark left and names the header link VAMS home', () => {
    for (const file of [
      'src/widgets/site-header/ui/SiteHeader.tsx',
      'src/widgets/layout/top-bar/TopBar.tsx',
      'src/widgets/site-footer/ui/SiteFooter.tsx',
      'src/pages/editor/ui/EditorLoading.tsx',
    ]) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toContain('<Logo');
      expect(source, file).not.toContain('VertexMark');
    }
    expect(readFileSync('src/widgets/site-header/ui/SiteHeader.tsx', 'utf8')).toContain('aria-label="VAMS home"');
  });
});

describe('BB-SITE-25: The wordmark font is preloaded and cannot shift the header', () => {
  it('preloads Minecrafter, blocks on it briefly, and sizes the word in em', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('<link rel="preload" href="/fonts/Minecrafter.ttf" as="font" type="font/ttf" crossorigin />');
    const global = readFileSync('src/app/styles/global.scss', 'utf8');
    expect(global).toMatch(/font-family: 'Minecrafter';[\s\S]*?font-display: block;/);
    const logo = readFileSync('src/shared/ui/logo/logo.scss', 'utf8');
    expect(logo).toMatch(/height: 1em;/);
    expect(logo).toMatch(/prefers-reduced-motion: no-preference/);
  });
});

describe('BB-SITE-26: Canvas overlays take their text colour from the plate, not the accent', () => {
  it('uses --canvas-plate-text on the plate', () => {
    const canvas = readFileSync('src/widgets/canvas/vams-canvas.scss', 'utf8');
    expect(canvas).toMatch(/color: var\(--canvas-plate-text\);\s*background: var\(--canvas-plate\);/);
  });
});

describe('BB-SITE-27: The ink chrome bar meets contrast in both themes and stands apart from the page', () => {
  for (const [theme, selector] of [['light', ':root'], ['dark', "[data-theme='dark']"]] as const) {
    it(`${theme} theme`, () => {
      // The dark block inherits every chrome token it does not override.
      const t = { ...block(':root'), ...block(selector) };
      for (const bg of ['--chrome', '--chrome-raised', '--chrome-hover']) {
        for (const fg of ['--chrome-ink', '--chrome-muted', '--chrome-faint', '--chrome-accent-text']) {
          expect(contrast(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(contrast(t['--on-accent'], t['--chrome-accent']), 'button text on the bar accent').toBeGreaterThanOrEqual(4.5);
      expect(contrast(t['--chrome-accent'], t['--chrome']), 'bar accent fill on the bar').toBeGreaterThanOrEqual(3);
      expect(contrast(t['--chrome-line'], t['--chrome']), 'button borders on the bar').toBeGreaterThanOrEqual(3);
      expect(contrast(t['--chrome-accent-text'], t['--chrome']), 'focus ring on the bar').toBeGreaterThanOrEqual(3);
      expect(contrast(t['--chrome-lip'], '#000000'), 'lip against the black canvas').toBeGreaterThanOrEqual(1.5);
      if (theme === 'light') expect(contrast(t['--chrome'], t['--paper']), 'bar against the page').toBeGreaterThanOrEqual(7);
    });
  }

  it('is applied to the editor top bar and the site header through one mixin', () => {
    expect(TOKENS).toMatch(/@mixin ink-chrome \{/);
    for (const file of ['src/widgets/layout/top-bar/top-bar.scss', 'src/widgets/site-header/ui/site-header.scss']) {
      expect(readFileSync(file, 'utf8'), file).toMatch(/@include ink-chrome;/);
    }
  });
});

describe('BB-SITE-28: On light paper the wordmark sits on an ink plate', () => {
  it('renders the plate class when asked', () => {
    const host = document.createElement('div');
    render(h(Logo, { plate: true }), host);
    expect(host.querySelector('.vams-logo')!.classList.contains('vams-logo--plate')).toBe(true);
    render(null, host);
  });

  it('uses the plate on the loading screen and the footer, and draws it only in the light theme', () => {
    for (const file of ['src/pages/editor/ui/EditorLoading.tsx', 'src/widgets/site-footer/ui/SiteFooter.tsx']) {
      expect(readFileSync(file, 'utf8'), file).toMatch(/<Logo[^>]*\bplate\b/);
    }
    const logo = readFileSync('src/shared/ui/logo/logo.scss', 'utf8').replace(/\r\n/g, '\n');
    expect(logo).toMatch(/:root:not\(\[data-theme='dark'\]\) \.vams-logo--plate \{[^}]*background: var\(--chrome\);/);
  });
});

/** The header links marked as the current page in prerendered HTML. */
function currentNavHref(html: string): string[] {
  const host = document.createElement('div');
  host.innerHTML = html;
  return [...host.querySelectorAll('.site-header__link[aria-current="page"]')].map((a) => a.getAttribute('href')!);
}

describe('BB-SITE-29: /learn is a finished, linked, prerendered page', () => {
  it('has indexable metadata, a header link, a sitemap entry and a prerender entry', async () => {
    const meta = findRouteMeta('/learn');
    expect(meta.path).toBe('/learn');
    expect(meta.indexable).toBe(true);
    expect(meta.title).toBe('Learn — VAMS');
    expect(NAV_LINKS.map(({ href, label }) => ({ href, label }))).toEqual([
      { href: '/', label: 'Home' },
      { href: '/learn', label: 'Learn' },
      { href: '/about', label: 'About' },
    ]);
    expect(buildSitemap(SITE)).toContain('<loc>https://example.test/learn</loc>');
    expect(readFileSync('vite.config.ts', 'utf8')).toMatch(/additionalPrerenderRoutes:\s*\[[^\]]*'\/learn'/);
    const result = await prerenderAt('/learn');
    expect(result.html).toContain('class="learn"');
    expect(currentNavHref(result.html)).toEqual(['/learn']);
    expect(result.head.title).toBe('Learn — VAMS');
  });

  it('marks Home current on the home page and nothing current on the not-found page', async () => {
    expect(currentNavHref((await prerenderAt('/')).html)).toEqual(['/']);
    expect(currentNavHref((await prerenderAt('/404')).html)).toEqual([]);
  });
});

import SiteFooter from '@/widgets/site-footer';

describe('BB-SITE-30: The footer links to /learn first', () => {
  it('puts Learn ahead of the source and license links', () => {
    const host = document.createElement('div');
    render(h(SiteFooter, {}), host);
    const first = host.querySelector('.site-footer__links a')!;
    expect(first.getAttribute('href')).toBe('/learn');
    expect(first.textContent).toBe('Learn');
    render(null, host);
  });
});

describe('BB-SITE-31: About is current only on /about, and has no icon', () => {
  it('marks /about current on the About page and leaves Learn plain', async () => {
    window.history.replaceState(null, '', '/about');
    expect(currentNavHref((await prerenderAt('/about')).html)).toEqual(['/about']);
    expect(currentNavHref((await prerenderAt('/learn')).html)).toEqual(['/learn']);
    expect(NAV_LINKS.find((link) => link.href === '/about')!.icon).toBeUndefined();
  });
});

describe('BB-SITE-32: The footer links run Learn, About, then the source', () => {
  it('lists Learn and About ahead of the source and license links', () => {
    const host = document.createElement('div');
    render(h(SiteFooter, {}), host);
    const links = [...host.querySelectorAll('.site-footer__links a')];
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Learn', '/learn'],
      ['About', '/about'],
      ['Source on GitHub', 'https://github.com/mkepg/vams'],
    ]);
    render(null, host);
  });
});

describe('BB-SITE-33: On phones the header CTA reads Open app', () => {
  it('wraps "the " in a span that the 480 px rule hides', async () => {
    const host = document.createElement('div');
    host.innerHTML = (await prerenderAt('/')).html;
    const cta = host.querySelector('.site-header__cta')!;
    expect(cta.textContent).toBe('Open the app');
    expect(cta.querySelector('.site-header__cta-the')!.textContent).toBe('the ');
    const scss = readFileSync('src/widgets/site-header/ui/site-header.scss', 'utf8').replace(/\r\n/g, '\n');
    const phone = scss.slice(scss.indexOf('@media (max-width: 480px)'));
    expect(phone).toMatch(/\.site-header__cta-the\s*\{\s*display:\s*none;\s*\}/);
  });
});

describe('BB-SITE-34: Below 375 px the switcher drops Home', () => {
  it('hides the list item that holds the Home link in the 374 px rule', () => {
    const scss = readFileSync('src/widgets/site-header/ui/site-header.scss', 'utf8').replace(/\r\n/g, '\n');
    const start = scss.indexOf('@media (max-width: 374px)');
    expect(start).toBeGreaterThanOrEqual(0);
    const rest = scss.slice(start + 1);
    const next = rest.indexOf('@media');
    const block = scss.slice(start, next === -1 ? undefined : start + 1 + next);
    expect(block).toMatch(
      /li:has\(>\s*\.site-header__link\[href=['"]\/['"]\]\)\s*\{\s*display:\s*none;\s*\}/,
    );
  });
});
