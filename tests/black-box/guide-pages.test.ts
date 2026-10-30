/**
 * BLACK-BOX TEST SUITE — BB-GUIDE
 * The /guide page (every Help topic outside the editor, with the glossary) and the /teach page for instructors.
 */
import { describe, it, expect, vi } from 'vitest';
import { h, render } from 'preact';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { findRouteMeta } from '@/app/routes/route-meta';
import { buildSitemap } from '@/app/seo/sitemap';
import { prerender } from '@/app/prerender';
import { NAV_LINKS } from '@/widgets/site-header/model/nav';
import { HELP_TOPICS, getHelpTopic } from '@/features/help/model/help-content';
import { COURSE, catalogFor, isCatalogLesson } from '@/features/lesson-engine/model/catalog';
import { GALLERY_SCENES } from '@/entities/project/model/gallery-links';
import { PRESET_LINKS } from '@/entities/project/model/preset-links';
import GuidePage from '@/pages/guide';
import TeachPage from '@/pages/teach';
import { TEACH_COPY } from '@/pages/teach/model/copy';
import { searchEntries, searchSite } from '@/widgets/site-header/model/search-index';
import SiteSearch, { SEARCH_COPY } from '@/widgets/site-header/ui/SiteSearch';

const SITE = 'https://example.test';

function mount(page: () => preact.JSX.Element) {
  const host = document.createElement('div');
  render(h(page, {}), host);
  return host;
}

/** Every file a page reaches through runtime imports (type-only imports skipped). */
function reachable(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [resolve(entry)];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    for (const m of source.matchAll(/^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm)) {
      const spec = m[1];
      const base = spec.startsWith('@/') ? resolve('src', spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(file), spec) : null;
      if (!base) continue;
      const hit = [base, `${base}.ts`, `${base}.tsx`, resolve(base, 'index.ts'), resolve(base, 'index.tsx')]
        .find((c) => /\.tsx?$/.test(c) && existsSync(c));
      if (hit) queue.push(hit);
    }
  }
  return [...seen].map((f) => f.replace(/\\/g, '/'));
}

describe('BB-GUIDE-01: /guide and /teach are finished, linked, prerendered pages', () => {
  it('have indexable metadata, sitemap and prerender entries, and links from the header or footer', async () => {
    for (const [path, title, cls] of [['/guide', 'Guide — VAMS', 'class="guide"'], ['/teach', 'Teaching with VAMS', 'class="teach"']]) {
      const meta = findRouteMeta(path);
      expect(meta.path).toBe(path);
      expect(meta.indexable).toBe(true);
      expect(meta.title).toBe(title);
      expect(buildSitemap(SITE)).toContain(`<loc>${SITE}${path}/</loc>`);
      expect(readFileSync('vite.config.ts', 'utf8')).toMatch(new RegExp(`additionalPrerenderRoutes:\\s*\\[[^\\]]*'${path}'`));
      window.history.replaceState(null, '', path);
      const result = await prerender({ url: path });
      expect(result.html).toContain(cls);
      expect(result.head.title).toBe(title);
    }
    expect(NAV_LINKS.some((link) => link.href === '/guide')).toBe(true);
  });
});

describe('BB-GUIDE-02: The guide holds every Help topic, and its links all land on the page', () => {
  it('anchors each topic, lists it in the contents, and points every See also link at an anchor', () => {
    const host = mount(GuidePage);
    for (const topic of HELP_TOPICS) {
      const article = host.querySelector(`article#${topic.id}`);
      expect(article, topic.id).not.toBeNull();
      expect(article!.querySelector('h3')!.textContent).toBe(topic.title);
      expect(host.querySelector(`.guide-contents a[href="#${topic.id}"]`), topic.id).not.toBeNull();
    }
    for (const link of host.querySelectorAll('.guide-topic__related a')) {
      const id = link.getAttribute('href')!.slice(1);
      expect(host.querySelector(`#${id}`), id).not.toBeNull();
      expect(link.textContent).toBe(getHelpTopic(id as Parameters<typeof getHelpTopic>[0]).title);
    }
    // The editor's tour button becomes a link to the editor.
    expect(host.querySelector('.guide-tour a')!.getAttribute('href')).toBe('/app');
    expect(host.querySelector('.help-start-tour')).toBeNull();
    render(null, host);
  });
});

describe('BB-GUIDE-03: The glossary covers the course with one entry per term', () => {
  it('has no repeated term, and defines the terms the sections lean on', () => {
    const glossary = getHelpTopic('glossary').blocks.find((b) => b.kind === 'definitions');
    const terms = glossary && glossary.kind === 'definitions' ? glossary.items.map((i) => i.term) : [];
    expect(new Set(terms).size).toBe(terms.length);
    expect(terms.length).toBeGreaterThanOrEqual(35);
    for (const term of ['Viewport', 'Viewing volume', 'Matrix mode', 'Texture filter', 'Wrap mode', 'Double buffering', 'Reshape callback']) {
      expect(terms).toContain(term);
    }
    // The wrap modes are the ones the generated code writes; GL_CLAMP on its own is a different mode.
    const wrap = glossary && glossary.kind === 'definitions' ? glossary.items.find((i) => i.term === 'Wrap mode')!.description : '';
    expect(wrap).toContain('GL_CLAMP_TO_EDGE');
    expect(wrap).not.toMatch(/GL_CLAMP(?!_TO_EDGE)/);
  });
});

describe('BB-GUIDE-04: The teaching page matches the course and links only to real lessons and scenes', () => {
  it('counts each section from the catalogue, and every link it gives opens something that exists', () => {
    const host = mount(TeachPage);
    const rows = [...host.querySelectorAll('.teach-course__row')];
    expect(rows.map((r) => r.querySelector('h3')!.textContent)).toEqual(COURSE.map((c) => c.section));
    rows.forEach((row, i) => {
      const { demos, exercises } = catalogFor(COURSE[i].section);
      expect(row.querySelector('.teach-course__count')!.textContent).toBe(
        `${TEACH_COPY.course.demos(demos.length)} · ${TEACH_COPY.course.exercises(exercises.length)}`,
      );
    });
    const slugs = new Set<string>([...GALLERY_SCENES.map((s) => s.slug), ...PRESET_LINKS.map((p) => p.slug)]);
    const scenes = [...host.querySelectorAll('.teach-scenes a')].map((a) => a.getAttribute('href')!);
    expect(scenes.length).toBe(slugs.size);
    for (const href of scenes) expect(slugs.has(new URL(href, SITE).searchParams.get('scene')!), href).toBe(true);
    for (const example of host.querySelectorAll('.teach-links__example')) {
      const params = new URL(example.textContent!, SITE).searchParams;
      if (params.has('lesson')) expect(isCatalogLesson(params.get('lesson'))).toBe(true);
      if (params.has('scene')) expect(slugs.has(params.get('scene')!)).toBe(true);
    }
    render(null, host);
  });
});

describe('BB-GUIDE-05: Neither page loads the editor store or the lesson files', () => {
  it('reaches the Help content and the catalogue, but not core/store or any lesson file', () => {
    const guide = reachable('src/pages/guide/index.ts');
    expect(guide.some((f) => f.endsWith('/src/features/help/model/help-content.ts'))).toBe(true);
    const teach = reachable('src/pages/teach/index.ts');
    expect(teach.some((f) => f.endsWith('/src/features/lesson-engine/model/catalog.ts'))).toBe(true);
    for (const files of [guide, teach]) {
      expect(files.filter((f) => f.includes('/src/core/store/'))).toEqual([]);
      expect(files.filter((f) => /(-lessons|lesson-registry)\.ts$/.test(f))).toEqual([]);
    }
  });
});

describe('BB-GUIDE-06: Search ranks by title and needs every word to match', () => {
  it('finds lessons, scenes, guide topics and terms, and lists the pages for an empty box', () => {
    expect(searchSite('').map((e) => e.href)).toContain('/guide');
    const triangle = searchSite('triangle').map((e) => e.title);
    expect(triangle).toEqual(expect.arrayContaining(['Your First Triangle', 'Triangle']));
    expect(searchSite('vbo hand')[0]).toMatchObject({ kind: 'lesson', title: 'Build a VBO by Hand' });
    expect(searchSite('viewport').some((e) => e.kind === 'term' && e.title === 'Viewport')).toBe(true);
    expect(searchSite('jeepney')[0]).toMatchObject({ kind: 'scene', href: '/app?scene=jeepney-street' });
    expect(searchSite('zzzz qqqq')).toEqual([]);
    expect(searchSite('a').length).toBeLessThanOrEqual(8);
  });

  it('points every entry at a lesson, scene, page or guide anchor that exists', () => {
    const slugs = new Set<string>([...GALLERY_SCENES.map((s) => s.slug), ...PRESET_LINKS.map((p) => p.slug)]);
    const topics = new Set<string>(HELP_TOPICS.map((t) => t.id));
    const pages = new Set(['/', '/app', '/learn', '/gallery', '/guide', '/teach', '/about']);
    for (const entry of searchEntries()) {
      const url = new URL(entry.href, SITE);
      if (url.searchParams.has('lesson')) expect(isCatalogLesson(url.searchParams.get('lesson')), entry.href).toBe(true);
      else if (url.searchParams.has('scene')) expect(slugs.has(url.searchParams.get('scene')!), entry.href).toBe(true);
      else if (url.hash) expect(topics.has(url.hash.slice(1)), entry.href).toBe(true);
      else expect(pages.has(url.pathname), entry.href).toBe(true);
    }
  });
});

describe('BB-GUIDE-07: Ctrl+K opens search, and the keyboard alone reaches a result', () => {
  it('opens on Ctrl+K, filters as you type, moves with the arrows and opens on Enter', async () => {
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h(SiteSearch, {}), host);
    // Effects run after paint: let the shortcut listener attach first.
    for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0));
    const input = host.querySelector<HTMLInputElement>('input[role="combobox"]')!;
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
    input.value = 'triangle';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    const options = [...host.querySelectorAll('[role="option"]')];
    expect(options.length).toBeGreaterThan(1);
    expect(options[0].getAttribute('aria-selected')).toBe('true');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    const second = host.querySelectorAll('[role="option"]')[1];
    expect(second.getAttribute('aria-selected')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBe(second.id);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(assign).toHaveBeenCalledWith(second.getAttribute('href'));
    await new Promise((r) => setTimeout(r, 0));
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    input.value = '';
    render(null, host);
    host.remove();
    assign.mockRestore();
    expect(SEARCH_COPY.empty('x')).toBe('Nothing matches “x”.');
  });
});
