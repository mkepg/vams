/**
 * BLACK-BOX TEST SUITE — BB-ABOUT
 * The /about page: its copy, the citation tabs, and the prerendered page.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { ABOUT_COPY, APA_PARTS, CITATIONS, THESIS } from '@/pages/about/model/copy';
import CitationTabs, { COPIED_RESET_MS } from '@/pages/about/ui/CitationTabs';
import { TEAM } from '@/pages/home/model/content';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { LESSON_CATALOG } from '@/features/lesson-engine/model/catalog';
import { findRouteMeta } from '@/app/routes/route-meta';
import { buildSitemap } from '@/app/seo/sitemap';
import { prerender } from '@/app/prerender';

const SECTIONS = ['Pipeline', 'Primitives', 'Buffers', 'Transforms', 'Textures'];
const BANNED = ['coming soon', 'not yet', 'future', 'deferred', 'unsupported', 'not supported', '3d', 'lighting'];

describe('BB-ABOUT-03: The story and the facts state the lesson count and the five sections', () => {
  it('puts the count into the story and the What it teaches fact, with the sections in order', () => {
    expect(ABOUT_COPY.story(45).join(' ')).toContain('a guided course of 45 lessons');
    expect(ABOUT_COPY.story(7).join(' ')).toContain('a guided course of 7 lessons');
    const teaches = ABOUT_COPY.facts(45).find((fact) => fact.term === 'What it teaches')!;
    expect(teaches.text).toContain(`${SECTIONS.join(', ')}.`);
    expect(teaches.text).toContain('45 lessons in all.');
    expect(ABOUT_COPY.facts(45).map((fact) => fact.term)).toEqual([
      'What it teaches',
      'Two modes',
      'Where it runs',
      'Offline',
      'Your work',
      'Found a problem?',
    ]);
    expect(ABOUT_COPY.story(45)).toHaveLength(4);
    expect(ABOUT_COPY.facts(45).find((fact) => fact.term === 'Offline')!.text).toBe(
      'After your first visit VAMS works without internet, and in Chrome or Edge you can install it as an app.',
    );
  });
});

describe('BB-ABOUT-04: The thesis credits match the home page team', () => {
  it('lists the three authors and the adviser named on the Team slide', () => {
    const members = TEAM.members.filter((m) => m.role === 'member').map((m) => m.name);
    const adviser = TEAM.members.find((m) => m.role === 'adviser')!.name;
    expect([...THESIS.authors].sort()).toEqual([...members].sort());
    expect(THESIS.adviser).toBe(adviser);
    expect(THESIS.authors).toEqual(['Mikhael Edman P. Gomez', 'Johann Patrick S. Taguiam', 'Justine Jhigz D. Vizco']);
    expect(THESIS.year).toBe(2026);
    expect(THESIS.institution).toBe('FEU Institute of Technology');
  });
});

describe('BB-ABOUT-05: The citations are exact', () => {
  it('formats APA 7 and BibTeX as the spec gives them', () => {
    expect(CITATIONS.apa).toBe(
      'Gomez, M. E. P., Taguiam, J. P. S., & Vizco, J. J. D. (2026). V.A.M.S: A geometric modeling and animation studio for introductory computer graphics courses [Undergraduate thesis, FEU Institute of Technology].',
    );
    expect(`${APA_PARTS.lead}${APA_PARTS.title}${APA_PARTS.tail}`).toBe(CITATIONS.apa);
    expect(APA_PARTS.title).toBe('V.A.M.S: A geometric modeling and animation studio for introductory computer graphics courses');
    expect(CITATIONS.bibtex).toBe(
      [
        '@mastersthesis{gomez2026vams,',
        '  author = {Gomez, Mikhael Edman P. and Taguiam, Johann Patrick S. and Vizco, Justine Jhigz D.},',
        '  title  = {{V.A.M.S}: A Geometric Modeling and Animation Studio for Introductory Computer Graphics Courses},',
        '  school = {FEU Institute of Technology},',
        '  type   = {Undergraduate thesis},',
        '  year   = {2026}',
        '}',
      ].join('\n'),
    );
  });
});

describe('BB-ABOUT-09: Students report problems on GitHub Issues', () => {
  it('links the last fact to the repository issues page', () => {
    const report = ABOUT_COPY.facts(45).at(-1)!;
    expect(report).toEqual({ term: 'Found a problem?', text: 'Open an issue on GitHub', href: 'https://github.com/mkepg/vams/issues' });
    expect(ABOUT_COPY.issuesUrl).toBe('https://github.com/mkepg/vams/issues');
  });
});

describe('BB-ABOUT-10: The About copy follows the student-facing language rules', () => {
  it('contains none of the banned phrases', () => {
    const text = JSON.stringify([ABOUT_COPY, ABOUT_COPY.story(45), ABOUT_COPY.facts(45), THESIS, CITATIONS]).toLowerCase();
    for (const phrase of BANNED) expect(text, phrase).not.toContain(phrase);
  });
});

const hosts: HTMLElement[] = [];
function mount(vnode: VNode) {
  const host = document.createElement('div');
  hosts.push(host);
  document.body.appendChild(host);
  render(vnode, host);
  return host;
}
/** Let pending promises and Preact's batched (microtask) renders run. */
async function tick() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}
/** The same under fake timers, also running any timer due now. */
async function flush() {
  await tick();
  await vi.advanceTimersByTimeAsync(0);
  await tick();
}
function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}
const tab = (host: ParentNode, id: string) => host.querySelector<HTMLButtonElement>(`#citation-tab-${id}`)!;
const panel = (host: ParentNode, id: string) => host.querySelector<HTMLElement>(`#citation-panel-${id}`)!;
const status = (host: ParentNode) => host.querySelector('.citation__status')!.textContent;
async function key(target: HTMLElement, name: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
  await tick();
}

afterEach(() => {
  while (hosts.length) {
    const host = hosts.pop()!;
    render(null, host);
    host.remove();
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
  setClipboard(undefined);
});

describe('BB-ABOUT-06: The citation tabs follow the tabs pattern', () => {
  it('prerenders both panels with APA selected and BibTeX hidden', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToString(h(CitationTabs, {}));
    expect(host.querySelector('[role="tablist"]')!.getAttribute('aria-label')).toBe(ABOUT_COPY.citationLabel);
    expect(tab(host, 'apa').getAttribute('aria-selected')).toBe('true');
    expect(tab(host, 'bibtex').getAttribute('aria-selected')).not.toBe('true');
    expect(panel(host, 'apa').hasAttribute('hidden')).toBe(false);
    expect(panel(host, 'bibtex').hasAttribute('hidden')).toBe(true);
    expect(panel(host, 'apa').textContent).toContain(CITATIONS.apa);
    expect(panel(host, 'apa').querySelector('i')!.textContent).toBe(APA_PARTS.title);
    expect(panel(host, 'bibtex').querySelector('pre')!.textContent).toBe(CITATIONS.bibtex);
    const pre = panel(host, 'bibtex').querySelector('pre')!;
    expect(pre.getAttribute('tabindex')).toBe('0');
    expect(pre.getAttribute('aria-label')).toBe('BibTeX citation');
    expect(host.querySelectorAll('button.citation__copy').length).toBe(2);
    expect(panel(host, 'apa').getAttribute('aria-labelledby')).toBe('citation-tab-apa');
    expect(tab(host, 'apa').getAttribute('aria-controls')).toBe('citation-panel-apa');
  });

  it('moves and selects with the arrow keys, Home and End, keeping one tab in the tab order', async () => {
    const host = mount(h(CitationTabs, {}));
    expect(tab(host, 'apa').tabIndex).toBe(0);
    expect(tab(host, 'bibtex').tabIndex).toBe(-1);
    tab(host, 'apa').focus();
    await key(tab(host, 'apa'), 'ArrowRight');
    expect(tab(host, 'bibtex').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab(host, 'bibtex'));
    expect(panel(host, 'apa').hasAttribute('hidden')).toBe(true);
    expect(tab(host, 'bibtex').tabIndex).toBe(0);
    await key(tab(host, 'bibtex'), 'ArrowRight');
    expect(tab(host, 'apa').getAttribute('aria-selected')).toBe('true');
    await key(tab(host, 'apa'), 'ArrowLeft');
    expect(tab(host, 'bibtex').getAttribute('aria-selected')).toBe('true');
    await key(tab(host, 'bibtex'), 'Home');
    expect(tab(host, 'apa').getAttribute('aria-selected')).toBe('true');
    await key(tab(host, 'apa'), 'End');
    expect(tab(host, 'bibtex').getAttribute('aria-selected')).toBe('true');
    tab(host, 'apa').click();
    await tick();
    expect(tab(host, 'apa').getAttribute('aria-selected')).toBe('true');
  });

  it('ignores arrow keys held with Alt, Ctrl or Meta so browser shortcuts still work', async () => {
    const host = mount(h(CitationTabs, {}));
    tab(host, 'apa').focus();
    for (const modifier of ['altKey', 'ctrlKey', 'metaKey']) {
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true, [modifier]: true });
      const notPrevented = tab(host, 'apa').dispatchEvent(event);
      await tick();
      expect(notPrevented, modifier).toBe(true);
      expect(tab(host, 'apa').getAttribute('aria-selected'), modifier).toBe('true');
    }
  });
});

describe('BB-ABOUT-07: Copy puts the visible citation on the clipboard and says so', () => {
  it('copies, shows Copied for two seconds, and restarts the window on a second copy', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    const host = mount(h(CitationTabs, {}));
    const apaCopy = panel(host, 'apa').querySelector<HTMLButtonElement>('.citation__copy')!;
    apaCopy.click();
    await flush();
    expect(writeText).toHaveBeenLastCalledWith(CITATIONS.apa);
    expect(apaCopy.textContent).toBe(ABOUT_COPY.copied);
    expect(status(host)).toBe(ABOUT_COPY.copied);
    expect(host.querySelector('.citation__status')!.getAttribute('aria-live')).toBe('polite');

    await vi.advanceTimersByTimeAsync(COPIED_RESET_MS - 500);
    apaCopy.click();
    await flush();
    await vi.advanceTimersByTimeAsync(COPIED_RESET_MS - 500);
    expect(apaCopy.textContent).toBe(ABOUT_COPY.copied);
    await vi.advanceTimersByTimeAsync(500);
    await tick();
    expect(apaCopy.textContent).toBe(ABOUT_COPY.copy);
    expect(status(host)).toBe('');
  });

  it('copies BibTeX after switching to its tab', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    const host = mount(h(CitationTabs, {}));
    tab(host, 'bibtex').click();
    await flush();
    panel(host, 'bibtex').querySelector<HTMLButtonElement>('.citation__copy')!.click();
    await flush();
    expect(writeText).toHaveBeenLastCalledWith(CITATIONS.bibtex);
  });

  it('does not show Copied on the other panel when the copy resolves after a tab switch', async () => {
    vi.useFakeTimers();
    let resolveWrite!: () => void;
    const writeText = vi.fn().mockReturnValue(new Promise<void>((done) => (resolveWrite = done)));
    setClipboard({ writeText });
    const host = mount(h(CitationTabs, {}));
    panel(host, 'apa').querySelector<HTMLButtonElement>('.citation__copy')!.click();
    await flush();
    tab(host, 'bibtex').click();
    await flush();
    resolveWrite();
    await flush();
    const bibtexCopy = panel(host, 'bibtex').querySelector<HTMLButtonElement>('.citation__copy')!;
    expect(bibtexCopy.textContent).toBe(ABOUT_COPY.copy);
    expect(status(host)).toBe('');
  });
});

describe('BB-ABOUT-08: When the clipboard is unavailable the citation is selected instead', () => {
  it('selects the text and asks for Ctrl+C when there is no clipboard API', async () => {
    vi.useFakeTimers();
    setClipboard(undefined);
    const host = mount(h(CitationTabs, {}));
    panel(host, 'apa').querySelector<HTMLButtonElement>('.citation__copy')!.click();
    await flush();
    expect(status(host)).toBe(ABOUT_COPY.copyFallback);
    expect(window.getSelection()!.toString()).toBe(CITATIONS.apa);
  });

  it('does the same when the clipboard rejects, and clears the message on a tab change', async () => {
    vi.useFakeTimers();
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    const host = mount(h(CitationTabs, {}));
    tab(host, 'bibtex').click();
    await flush();
    panel(host, 'bibtex').querySelector<HTMLButtonElement>('.citation__copy')!.click();
    await flush();
    expect(status(host)).toBe(ABOUT_COPY.copyFallback);
    expect(window.getSelection()!.toString()).toBe(CITATIONS.bibtex);
    tab(host, 'apa').click();
    await flush();
    expect(status(host)).toBe('');
  });
});

async function prerenderAbout() {
  window.history.replaceState(null, '', '/about');
  const result = await prerender({ url: '/about' });
  const host = document.createElement('div');
  host.innerHTML = result.html;
  return { result, host };
}

describe('BB-ABOUT-01: /about is a finished, indexable, prerendered route', () => {
  it('has metadata, a sitemap entry and a prerender entry', async () => {
    const meta = findRouteMeta('/about');
    expect(meta.path).toBe('/about');
    expect(meta.indexable).toBe(true);
    expect(meta.title).toBe('About — VAMS');
    expect(meta.description).toBe(
      'Why VAMS exists, what it teaches, where your work is kept, and the undergraduate thesis behind it, with a citation to copy.',
    );
    expect(buildSitemap('https://example.test')).toContain('<loc>https://example.test/about</loc>');
    expect(readFileSync('vite.config.ts', 'utf8')).toMatch(/additionalPrerenderRoutes:\s*\[[^\]]*'\/about'/);
    const { result } = await prerenderAbout();
    expect(result.head.title).toBe('About — VAMS');
  });
});

describe('BB-ABOUT-02: The page is an intro and three labelled bands in order', () => {
  it('renders the story, the student facts and the thesis record', async () => {
    const { host } = await prerenderAbout();
    const main = host.querySelector('main#main.about')!;
    expect(main.querySelector('h1')!.textContent).toBe(ABOUT_COPY.title);
    expect(main.querySelector('.about__lede')!.textContent).toBe(ABOUT_COPY.lede);
    const bands = [...main.querySelectorAll('section.about-band')];
    expect(bands.map((b) => b.id)).toEqual(['story', 'students', 'thesis']);
    for (const band of bands) {
      const heading = band.querySelector('h2')!;
      expect(band.getAttribute('aria-labelledby')).toBe(heading.id);
    }
    expect(bands.map((b) => b.querySelector('h2')!.textContent)).toEqual(['Why VAMS exists', 'For students', 'The thesis']);
    expect([...bands[0].querySelectorAll('.about-band__body p')].map((p) => p.textContent)).toEqual(
      ABOUT_COPY.story(LESSON_CATALOG.length),
    );
    expect([...bands[1].querySelectorAll('.about-facts dt')].map((dt) => dt.textContent)).toEqual(
      ABOUT_COPY.facts(LESSON_CATALOG.length).map((f) => f.term),
    );
    expect(bands[1].querySelector('.about-facts dd')!.textContent).toContain(`${LESSON_CATALOG.length} lessons in all.`);
    const issues = bands[1].querySelector<HTMLAnchorElement>(`a[href="${ABOUT_COPY.issuesUrl}"]`)!;
    expect(issues.textContent).toBe('Open an issue on GitHub');
    const record = bands[2].querySelector('.about-record')!;
    expect(record.querySelector('.about-record__title')!.textContent).toBe(THESIS.title);
    expect(record.textContent).toContain(THESIS.authors.join(', '));
    expect(record.textContent).toContain(THESIS.adviser);
    expect(record.textContent).toContain('2026');
    expect(record.querySelector('.citation [role="tablist"]')).not.toBeNull();
  });
});

/** Runtime imports of one source file: type-only imports and re-exports are skipped. */
function runtimeImports(file: string): string[] {
  const source = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const pattern = /^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;
  return [...source.matchAll(pattern)].map((m) => m[1]);
}
/** A source file for an import, or null for packages, styles and assets. */
function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = resolve('src', spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec);
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, resolve(base, 'index.ts'), resolve(base, 'index.tsx')]) {
    if (/\.tsx?$/.test(candidate) && existsSync(candidate)) return candidate;
  }
  return null;
}

describe('BB-ABOUT-11: The page never loads the editor store, the lesson files or another page', () => {
  it('reaches the catalog but not core/store, the registry, a lesson file or pages/home', () => {
    const seen = new Set<string>();
    const queue = [resolve('src/pages/about/index.ts')];
    while (queue.length) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      for (const spec of runtimeImports(file)) {
        const next = resolveImport(file, spec);
        if (next) queue.push(next);
      }
    }
    const files = [...seen].map((f) => f.replace(/\\/g, '/'));
    expect(files.some((f) => f.endsWith('/src/features/lesson-engine/model/catalog.ts'))).toBe(true);
    expect(files.filter((f) => f.includes('/src/core/store/'))).toEqual([]);
    expect(files.filter((f) => /(-lessons|lesson-registry)\.ts$/.test(f))).toEqual([]);
    expect(files.filter((f) => f.includes('/src/pages/') && !f.includes('/src/pages/about/'))).toEqual([]);
  });
});
