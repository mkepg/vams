/**
 * BLACK-BOX TEST SUITE — BB-SITE
 * Site shell: theming, route metadata and SEO output, prerendering, site chrome.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  readStoredTheme,
  getActiveTheme,
  setTheme,
  toggleTheme,
  subscribeTheme,
  toEditorTheme,
  THEME_STORAGE_KEY,
} from '@/shared/lib/theme';

function resetTheme() {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
}

describe('BB-SITE-01: Theme defaults to vellum', () => {
  beforeEach(resetTheme);
  it('returns vellum when nothing is stored', () => {
    expect(readStoredTheme()).toBe('vellum');
    expect(getActiveTheme()).toBe('vellum');
  });
});

describe('BB-SITE-02: Invalid stored theme values are ignored', () => {
  beforeEach(resetTheme);
  it('falls back to vellum for an unknown value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(readStoredTheme()).toBe('vellum');
  });
});

describe('BB-SITE-03: setTheme persists and applies the theme', () => {
  beforeEach(resetTheme);
  it('stores the value and sets data-theme on <html>', () => {
    setTheme('blueprint');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('blueprint');
    expect(document.documentElement.dataset.theme).toBe('blueprint');
    expect(getActiveTheme()).toBe('blueprint');
  });
});

describe('BB-SITE-04: toggleTheme flips themes and notifies subscribers', () => {
  beforeEach(resetTheme);
  it('alternates vellum and blueprint and stops notifying after unsubscribe', () => {
    const seen: string[] = [];
    const unsubscribe = subscribeTheme((theme) => seen.push(theme));
    expect(toggleTheme()).toBe('blueprint');
    expect(toggleTheme()).toBe('vellum');
    unsubscribe();
    toggleTheme();
    expect(seen).toEqual(['blueprint', 'vellum']);
  });
});

describe('BB-SITE-05: Site themes map onto the editor store values', () => {
  it('maps blueprint to dark and vellum to light', () => {
    expect(toEditorTheme('blueprint')).toBe('dark');
    expect(toEditorTheme('vellum')).toBe('light');
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

describe('BB-SITE-13: The full logo exposes an accessible name and wordmark', () => {
  it('renders the vertex mark with the selected apex and the VAMS wordmark', () => {
    const host = document.createElement('div');
    render(h(Logo, { variant: 'full' }), host);
    const logo = host.querySelector('.vams-logo')!;
    expect(logo.getAttribute('role')).toBe('img');
    expect(logo.getAttribute('aria-label')).toBe('VAMS');
    expect(host.querySelectorAll('.vams-logo__vertex').length).toBe(3);
    expect(host.querySelector('.vams-logo__vertex--selected')).not.toBeNull();
    expect(host.querySelector('.vams-logo__word')?.textContent).toBe('VAMS');
    render(null, host);
  });
});

describe('BB-SITE-14: The mark-only logo omits the wordmark', () => {
  it('renders only the symbol', () => {
    const host = document.createElement('div');
    render(h(Logo, { variant: 'mark' }), host);
    expect(host.querySelector('.vams-logo__mark')).not.toBeNull();
    expect(host.querySelector('.vams-logo__word')).toBeNull();
    render(null, host);
  });
});
