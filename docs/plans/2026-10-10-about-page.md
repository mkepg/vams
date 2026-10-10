# About Page Implementation Plan

**Goal:** Ship a prerendered `/about` page (story, student facts, thesis record with copyable APA and BibTeX citations) and link it from the header, footer and home Team slide.

**Architecture:** A new FSD page slice `src/pages/about/` holds an import-free copy module, a band component, a citation-tabs component and the page. The page reads only the lesson count from the store-free catalog. Route metadata, the router and the prerender list gain `/about`. The header switcher, footer and home Team slide gain links.

**Tech Stack:** Preact + preact-iso, TypeScript, SCSS tokens, Vitest + happy-dom (`tests/**/*.test.ts`, written with `h()` and no JSX), Playwright visual suite (`npm run test:visual`, baselines in git-ignored `tests/visual/baseline.local`).

**Spec:** [docs/specs/2026-10-10-about-page-design.md](../specs/2026-10-10-about-page-design.md)

## Global Constraints

- Student-facing text never contains "coming soon", "not yet", "not supported", "unsupported", "future", "deferred", "3D" or "lighting" (case-insensitive).
- Section labels are exactly `Pipeline | Primitives | Buffers | Transforms | Textures`.
- No study results from the thesis manuscript appear anywhere.
- FSD: `src/pages/about` imports only from `widgets`, `features`, `shared` and its own slice. It never imports `pages/home`, `core/store`, the lesson registry or any `*-lessons.ts` file.
- Non-site SCSS font sizes are `var(--text-xs|sm|base|md|lg|xl|2xl)` only (BB-SHELL-22 scans `src/pages/about`). No `text-transform: uppercase` (BB-SHELL-23).
- Colours and spacing come from `src/shared/styles/_tokens.scss` variables. Site pages set `a { color: inherit }`, so links set their colour explicitly (`var(--accent-text)`).
- Tests carry the IDs given below, and existing IDs never change. BB-SITE's next free is 31, BB-HOME's is 24, BB-PWA's is 9, and BB-ABOUT is a new suite.
- Commits use Conventional Commits, with no `Co-Authored-By` and no "Generated with" line. Stage explicit paths only, never `git add -A`, `.` or `-f`. Never stage `.gitignore`.
- `npm run lint`, `npm run build` and `npm test` all pass before each commit. Afterwards run `git checkout -- tests/reports` to drop the rewritten reports.
- Files are CRLF in the working copy (`core.autocrlf=true`). Edit tools handle this, so don't convert line endings.
- Never kill `node.exe` by image name. Port 5173 belongs to someone else, so a manual dev server uses 5174. The visual suite starts its own preview on 4319.

## Review Focus

1. A second Copy click within 2 seconds should restart the 2-second "Copied" window, not let the first timer clear the new message early. BB-ABOUT-07 pins this.
2. Copying while the other tab was just selected should copy the visible tab's citation, not a stale one. BB-ABOUT-07 copies BibTeX after switching.
3. Switching tabs after a failed copy should clear "Press Ctrl+C to copy" so the message never describes a panel the user is not looking at. BB-ABOUT-08 pins this.
4. At 390px the header, now with three segments, must not scroll sideways on `/`, `/learn`, `/about` or `/404`. VIS-LEARN-05 pins this.
5. Before hydration, the prerendered page must show the APA citation with the BibTeX panel `hidden`, and its Copy buttons must be real buttons. BB-ABOUT-06 checks the prerendered HTML.

---

### Task 1: About copy module

**Files:**
- Create: `src/pages/about/model/copy.ts`
- Test: `tests/black-box/about-page.test.ts` (new file)

**Interfaces:**
- Consumes: nothing (the module has no imports).
- Produces:
  - `ABOUT_COPY` with:
    - `title: string` and `lede: string`;
    - `bands: { story: BandCopy; students: BandCopy; thesis: BandCopy }`, where `BandCopy = { id: string; title: string; summary: string }`;
    - `story(lessons: number): string[]` and `facts(lessons: number): AboutFact[]`;
    - `issuesUrl: string`, `citationLabel: string`, `copy: string`, `copied: string`, `copyFallback: string`, and the record labels `authorsLabel`, `adviserLabel`, `degreeLabel`, `institutionLabel`, `yearLabel`.
  - `interface AboutFact { term: string; text: string; href?: string }`
  - `THESIS: { title: string; authors: readonly string[]; adviser: string; degree: string; institution: string; year: number }`
  - `type CitationId = 'apa' | 'bibtex'`
  - `APA_PARTS: { lead: string; title: string; tail: string }`
  - `CITATIONS: Record<CitationId, string>`

- [ ] **Step 1: Write the failing tests**

Create `tests/black-box/about-page.test.ts`:

```ts
/**
 * BLACK-BOX TEST SUITE — BB-ABOUT
 * The /about page: its copy, the citation tabs, and the prerendered page.
 */
import { describe, it, expect } from 'vitest';
import { ABOUT_COPY, APA_PARTS, CITATIONS, THESIS } from '@/pages/about/model/copy';
import { TEAM } from '@/pages/home/model/content';

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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/about-page.test.ts`
Expected: FAIL, because the import `@/pages/about/model/copy` can't be resolved.

- [ ] **Step 3: Write the copy module**

Create `src/pages/about/model/copy.ts`:

```ts
/**
 * Copy for the About page. The module has no imports: the lesson count is passed in, so the
 * text can be read and tested without the catalog.
 */
export interface BandCopy {
  id: string;
  title: string;
  summary: string;
}

export interface AboutFact {
  term: string;
  text: string;
  /** When set, the text renders as a link to this address. */
  href?: string;
}

const ISSUES_URL = 'https://github.com/mkepg/vams/issues';

export const ABOUT_COPY = {
  title: 'About VAMS',
  lede: 'A 2D OpenGL 1.5 teaching tool that began as an undergraduate thesis.',
  bands: {
    story: { id: 'story', title: 'Why VAMS exists', summary: 'From a thesis to a tool students use.' },
    students: { id: 'students', title: 'For students', summary: 'What it teaches, where it runs, and where your work is kept.' },
    thesis: { id: 'thesis', title: 'The thesis', summary: 'The record, and how to cite it.' },
  } satisfies Record<string, BandCopy>,
  story: (lessons: number): string[] => [
    'Computer graphics courses ask students to work with vectors, matrices and coordinate systems, and then to picture what those numbers do on screen. Most students can rotate a triangle by 45 degrees on paper. Far fewer can see that rotation before they run the program, and in an OpenGL course running it first means a compiler, a GLUT install and a build script.',
    'VAMS began as our undergraduate thesis at FEU Institute of Technology. The idea was simple: instead of asking students to connect an equation to a picture in their heads, show both at once. You build a scene by hand, and VAMS writes the OpenGL that draws it and shows the math underneath, live.',
    'It is meant as a first step, not a replacement for professional tools. Students learn the pipeline here, then carry the same code and the same math into a real OpenGL project.',
    `After the thesis, we kept building: a guided course of ${lessons} lessons, a redesigned editor, and a site that works offline. VAMS is free and open source under the MIT License.`,
  ],
  facts: (lessons: number): AboutFact[] => [
    {
      term: 'What it teaches',
      text: `OpenGL 1.5 in 2D, in five sections that follow the pipeline: Pipeline, Primitives, Buffers, Transforms, Textures. ${lessons} lessons in all.`,
    },
    { term: 'Two modes', text: 'Author, where you build freely. Lesson, where guided steps play out and exercises check your scene.' },
    { term: 'Where it runs', text: 'A desktop browser: Chrome, Edge or Firefox. Nothing to install.' },
    { term: 'Offline', text: 'After your first visit VAMS works without internet, and you can install it as an app from your browser.' },
    {
      term: 'Your work',
      text: 'Your scene and your lesson progress stay in this browser between visits. My scenes keeps named scenes and your last five backups. To move work to another computer, save a project file.',
    },
    { term: 'Found a problem?', text: 'Open an issue on GitHub', href: ISSUES_URL },
  ],
  issuesUrl: ISSUES_URL,
  authorsLabel: 'Authors',
  adviserLabel: 'Adviser',
  degreeLabel: 'Degree',
  institutionLabel: 'Institution',
  yearLabel: 'Year',
  citationLabel: 'Citation format',
  copy: 'Copy',
  copied: 'Copied',
  copyFallback: 'Press Ctrl+C to copy',
};

export const THESIS = {
  title: 'V.A.M.S: A Geometric Modeling and Animation Studio for Introductory Computer Graphics Courses',
  authors: ['Mikhael Edman P. Gomez', 'Johann Patrick S. Taguiam', 'Justine Jhigz D. Vizco'],
  adviser: 'Elisa V. Malasaga',
  degree: 'BS Computer Science, specialization in Software Engineering',
  institution: 'FEU Institute of Technology',
  year: 2026,
} as const;

export type CitationId = 'apa' | 'bibtex';

/** APA 7 in three parts, so the page can set the title in italics; the copied text is plain. */
export const APA_PARTS = {
  lead: 'Gomez, M. E. P., Taguiam, J. P. S., & Vizco, J. J. D. (2026). ',
  title: 'V.A.M.S: A geometric modeling and animation studio for introductory computer graphics courses',
  tail: ' [Undergraduate thesis, FEU Institute of Technology].',
};

export const CITATIONS: Record<CitationId, string> = {
  apa: `${APA_PARTS.lead}${APA_PARTS.title}${APA_PARTS.tail}`,
  // BibTeX has no undergraduate thesis type; @mastersthesis with a type field is the usual form.
  bibtex: [
    '@mastersthesis{gomez2026vams,',
    '  author = {Gomez, Mikhael Edman P. and Taguiam, Johann Patrick S. and Vizco, Justine Jhigz D.},',
    '  title  = {{V.A.M.S}: A Geometric Modeling and Animation Studio for Introductory Computer Graphics Courses},',
    '  school = {FEU Institute of Technology},',
    '  type   = {Undergraduate thesis},',
    '  year   = {2026}',
    '}',
  ].join('\n'),
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/about-page.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run the checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/pages/about/model/copy.ts tests/black-box/about-page.test.ts
git diff --staged --stat
git commit -m "feat(about): add the About page copy and citations"
```

---

### Task 2: Citation tabs

**Files:**
- Create: `src/pages/about/ui/CitationTabs.tsx`
- Modify: `tests/black-box/about-page.test.ts` (append tests)

**Interfaces:**
- Consumes (Task 1): `ABOUT_COPY.citationLabel`, `ABOUT_COPY.copy`, `ABOUT_COPY.copied`, `ABOUT_COPY.copyFallback`, `APA_PARTS`, `CITATIONS`, and `CitationId` from `../model/copy`.
- Produces:
  - `export default function CitationTabs(): JSX.Element`
  - `export const COPIED_RESET_MS = 2000`
  - DOM contract:
    - `.citation` root, containing a `[role=tablist].citation__tabs`.
    - Two tabs: `button[role=tab].citation__tab`, with ids `citation-tab-apa` and `citation-tab-bibtex`.
    - Two panels: `[role=tabpanel].citation__panel`, with ids `citation-panel-apa` and `citation-panel-bibtex`.
    - Each panel holds a `.citation__text` (a `p` for APA, a `pre` for BibTeX) and a `button.citation__copy`.
    - A `p.citation__status[role=status]` live region.

- [ ] **Step 1: Write the failing tests**

Edit the imports at the top of `tests/black-box/about-page.test.ts` to read:

```ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { ABOUT_COPY, APA_PARTS, CITATIONS, THESIS } from '@/pages/about/model/copy';
import CitationTabs, { COPIED_RESET_MS } from '@/pages/about/ui/CitationTabs';
import { TEAM } from '@/pages/home/model/content';
```

Then append to the end of the file:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/about-page.test.ts`
Expected: FAIL, because `@/pages/about/ui/CitationTabs` can't be resolved.

- [ ] **Step 3: Write the component**

Create `src/pages/about/ui/CitationTabs.tsx`:

```tsx
import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { ABOUT_COPY, APA_PARTS, CITATIONS, type CitationId } from '../model/copy';

export const COPIED_RESET_MS = 2000;

const TABS: readonly { id: CitationId; label: string }[] = [
  { id: 'apa', label: 'APA 7' },
  { id: 'bibtex', label: 'BibTeX' },
];

type Status = 'idle' | 'copied' | 'fallback';

/** Select a node's text so the reader can copy it by hand. */
function selectText(node: HTMLElement | null) {
  const selection = window.getSelection();
  if (!node || !selection) return;
  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** The thesis citation in two formats, as WAI-ARIA tabs, each with a Copy button. */
export default function CitationTabs() {
  const [active, setActive] = useState<CitationId>('apa');
  const [status, setStatus] = useState<Status>('idle');
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const texts = useRef<Partial<Record<CitationId, HTMLElement | null>>>({});
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const show = (next: Status) => {
    window.clearTimeout(timer.current);
    setStatus(next);
    if (next === 'copied') timer.current = window.setTimeout(() => setStatus('idle'), COPIED_RESET_MS);
  };

  const select = (id: CitationId) => {
    setActive(id);
    show('idle');
  };

  const copy = async (id: CitationId) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('No clipboard');
      await navigator.clipboard.writeText(CITATIONS[id]);
      show('copied');
    } catch {
      selectText(texts.current[id] ?? null);
      show('fallback');
    }
  };

  const onKeyDown = (event: JSX.TargetedKeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = TABS.length - 1;
    const keys: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(TABS[next].id);
    tabs.current[next]?.focus();
  };

  const message = status === 'copied' ? ABOUT_COPY.copied : status === 'fallback' ? ABOUT_COPY.copyFallback : '';

  return (
    <div className="citation">
      <div className="citation__tabs" role="tablist" aria-label={ABOUT_COPY.citationLabel}>
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            ref={(el) => {
              tabs.current[index] = el;
            }}
            id={`citation-tab-${tab.id}`}
            type="button"
            role="tab"
            className="citation__tab"
            aria-selected={active === tab.id ? 'true' : 'false'}
            aria-controls={`citation-panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => select(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {TABS.map((tab) => (
        <div
          key={tab.id}
          id={`citation-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`citation-tab-${tab.id}`}
          className="citation__panel"
          hidden={active !== tab.id}
        >
          {tab.id === 'apa' ? (
            <p
              className="citation__text"
              ref={(el) => {
                texts.current.apa = el;
              }}
            >
              {APA_PARTS.lead}
              <i>{APA_PARTS.title}</i>
              {APA_PARTS.tail}
            </p>
          ) : (
            <pre
              className="citation__text citation__text--code"
              ref={(el) => {
                texts.current.bibtex = el;
              }}
            >
              {CITATIONS.bibtex}
            </pre>
          )}
          <button type="button" className="citation__copy" onClick={() => void copy(tab.id)}>
            {active === tab.id && status === 'copied' ? ABOUT_COPY.copied : ABOUT_COPY.copy}
          </button>
        </div>
      ))}
      <p className="citation__status" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/about-page.test.ts`
Expected: PASS, 10 tests.

If happy-dom's `getSelection().toString()` returns an empty string for a range selected with `selectNodeContents`, check the range instead: `window.getSelection()!.getRangeAt(0).toString()`. Record the change as a ruling.

- [ ] **Step 5: Run the checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/pages/about/ui/CitationTabs.tsx tests/black-box/about-page.test.ts
git diff --staged --stat
git commit -m "feat(about): add citation tabs with copy to clipboard"
```

---

### Task 3: The About page, route and prerender

**Files:**
- Create: `src/pages/about/index.ts`, `src/pages/about/ui/AboutBand.tsx`, `src/pages/about/ui/AboutPage.tsx`, `src/pages/about/ui/about.scss`, `tests/visual/about.spec.ts`
- Modify: `src/app/routes/route-meta.ts` (add `/about` after `/learn`), `src/app/SiteApp.tsx` (route), `vite.config.ts:30` (prerender list)
- Test: `tests/black-box/about-page.test.ts` (append), `tests/black-box/offline-app.test.ts` (append BB-PWA-09)

**Interfaces:**
- Consumes:
  - From Task 1: `ABOUT_COPY`, `THESIS`, and `type BandCopy`.
  - From Task 2: `CitationTabs` (default export).
  - From the catalog: `LESSON_CATALOG` from `@/features/lesson-engine/model/catalog`.
  - `SiteHeader` (`@/widgets/site-header`, accepts `current?: string`) and `SiteFooter` (`@/widgets/site-footer`).
- Produces:
  - `src/pages/about/index.ts`, whose default export is `AboutPage`.
  - The DOM:
    - `main#main.about`, containing `h1.about__title` and `p.about__lede`.
    - Three `section.about-band`, with ids `story`, `students` and `thesis`, each with `aria-labelledby="<id>-title"` and an `h2#<id>-title.about-band__title`.
    - The facts are a `dl.about-facts`.
    - The record is a `div.about-record`, which contains `.citation`.
  - The route `/about`, titled "About — VAMS".

- [ ] **Step 1: Write the failing tests**

In `tests/black-box/about-page.test.ts`, add these imports below the existing ones:

```ts
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { LESSON_CATALOG } from '@/features/lesson-engine/model/catalog';
import { findRouteMeta } from '@/app/routes/route-meta';
import { buildSitemap } from '@/app/seo/sitemap';
import { prerender } from '@/app/prerender';
```

Append:

```ts
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
```

Append to `tests/black-box/offline-app.test.ts`:

```ts
describe('BB-PWA-09: The /about document is cached under its clean URL', () => {
  it('maps about/index.html to about', async () => {
    expect(toRouteUrl('about/index.html')).toBe('about');
    const { manifest } = await routeDocumentsTransform([{ url: 'about/index.html', revision: 'r', size: 1 }]);
    expect(manifest.map((entry) => entry.url)).toEqual(['about/index.html', 'about']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/about-page.test.ts tests/black-box/offline-app.test.ts`
Expected:
- BB-ABOUT-01 fails: the `/about` meta resolves to `/404`.
- BB-ABOUT-02 fails: there is no `main.about`.
- BB-ABOUT-11 fails: there is no `src/pages/about/index.ts`, so the catalog is not reached.
- BB-PWA-09 already passes, because the transform is generic. It is a regression guard.

- [ ] **Step 3: Write the band, the page, the index and the styles**

Create `src/pages/about/ui/AboutBand.tsx`:

```tsx
import type { ComponentChildren } from 'preact';
import type { BandCopy } from '../model/copy';

/** One About band: its heading and summary on the left, its content on the right. */
export default function AboutBand({ band, children }: { band: BandCopy; children: ComponentChildren }) {
  return (
    <section id={band.id} className="about-band" aria-labelledby={`${band.id}-title`}>
      <div className="about-band__intro">
        <h2 id={`${band.id}-title`} className="about-band__title">{band.title}</h2>
        <p className="about-band__summary">{band.summary}</p>
      </div>
      <div className="about-band__body">{children}</div>
    </section>
  );
}
```

Create `src/pages/about/ui/AboutPage.tsx`:

```tsx
import SiteHeader from '@/widgets/site-header';
import SiteFooter from '@/widgets/site-footer';
import { LESSON_CATALOG } from '@/features/lesson-engine/model/catalog';
import { ABOUT_COPY, THESIS } from '../model/copy';
import AboutBand from './AboutBand';
import CitationTabs from './CitationTabs';
import './about.scss';

export default function AboutPage() {
  const lessons = LESSON_CATALOG.length;
  const { bands } = ABOUT_COPY;

  return (
    <div className="site-page">
      <SiteHeader current="/about" />
      <main id="main" className="about">
        <div className="about__intro">
          <h1 className="about__title">{ABOUT_COPY.title}</h1>
          <p className="about__lede">{ABOUT_COPY.lede}</p>
        </div>

        <AboutBand band={bands.story}>
          {ABOUT_COPY.story(lessons).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </AboutBand>

        <AboutBand band={bands.students}>
          <dl className="about-facts">
            {ABOUT_COPY.facts(lessons).map((fact) => (
              <div key={fact.term}>
                <dt>{fact.term}</dt>
                <dd>{fact.href ? <a href={fact.href} rel="noopener">{fact.text}</a> : fact.text}</dd>
              </div>
            ))}
          </dl>
        </AboutBand>

        <AboutBand band={bands.thesis}>
          <div className="about-record">
            <p className="about-record__title">{THESIS.title}</p>
            <dl className="about-record__facts">
              <dt>{ABOUT_COPY.authorsLabel}</dt>
              <dd>{THESIS.authors.join(', ')}</dd>
              <dt>{ABOUT_COPY.adviserLabel}</dt>
              <dd>{THESIS.adviser}</dd>
              <dt>{ABOUT_COPY.degreeLabel}</dt>
              <dd>{THESIS.degree}</dd>
              <dt>{ABOUT_COPY.institutionLabel}</dt>
              <dd>{THESIS.institution}</dd>
              <dt>{ABOUT_COPY.yearLabel}</dt>
              <dd>{THESIS.year}</dd>
            </dl>
            <CitationTabs />
          </div>
        </AboutBand>
      </main>
      <SiteFooter />
    </div>
  );
}
```

Create `src/pages/about/index.ts`:

```ts
export { default } from './ui/AboutPage';
```

Create `src/pages/about/ui/about.scss`. It matches `learn.scss`: the same intro type, a 2fr/3fr band, and one column below 900px.

```scss
/* The About page: an introduction, then three bands (story, student facts, thesis record). */
.about {
  padding: var(--space-7) var(--site-gutter) var(--space-8);

  &__intro { max-width: 760px; margin-bottom: var(--space-6); }
  &__title {
    margin: 0 0 var(--space-3);
    font-family: var(--font-display);
    font-weight: 400;
    font-size: var(--text-2xl);
    line-height: var(--lh-2xl);
    letter-spacing: -0.01em;
  }
  &__lede {
    margin: 0;
    max-width: 62ch;
    font-size: var(--text-lg);
    line-height: 1.55;
    color: var(--ink-muted);
  }
}

.about-band {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
  gap: var(--space-6);
  padding: var(--space-7) 0;
  border-top: 1px solid var(--rule);

  &__title {
    margin: 0 0 var(--space-2);
    font-family: var(--font-display);
    font-weight: 400;
    font-size: var(--text-xl);
    line-height: var(--lh-xl);
  }
  &__summary { margin: 0; font-size: var(--text-md); line-height: var(--lh-md); color: var(--ink-muted); }
  &__body {
    font-size: var(--text-md);
    line-height: var(--lh-md);
    > p { max-width: 62ch; margin: 0 0 var(--space-4); }
    > p:last-child { margin-bottom: 0; }
  }
}

.about-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-5) var(--space-6);
  margin: 0;

  dt { font-weight: 600; margin-bottom: var(--space-1); }
  dd { margin: 0; color: var(--ink-muted); }
  a {
    color: var(--accent-text);
    font-weight: 600;
    text-underline-offset: 3px;
  }
}

.about-record {
  padding: var(--space-5);
  background: var(--paper-raised);
  border: 1px solid var(--rule);
  border-radius: var(--radius-m);

  &__title {
    margin: 0 0 var(--space-4);
    font-size: var(--text-lg);
    line-height: var(--lh-lg);
    font-weight: 600;
  }
  &__facts {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: var(--space-1) var(--space-4);
    margin: 0 0 var(--space-5);
    dt { color: var(--ink-faint); }
    dd { margin: 0; }
  }
}

.citation {
  &__tabs {
    display: flex;
    gap: var(--space-1);
    border-bottom: 1px solid var(--rule);
    margin-bottom: var(--space-3);
  }
  &__tab {
    min-height: 32px;
    padding: 0 var(--space-3);
    border: 0;
    background: none;
    color: var(--ink-muted);
    font: inherit;
    font-size: var(--text-base);
    font-weight: 600;
    cursor: pointer;
    &:hover { color: var(--ink); }
    &[aria-selected='true'] { color: var(--ink); box-shadow: inset 0 -2px 0 var(--accent-text); }
  }
  &__panel {
    position: relative;
    padding: var(--space-3) 84px var(--space-3) var(--space-3);
    border-radius: var(--radius-m);
    background: var(--code-bg);
    border: 1px solid var(--rule);
    &[hidden] { display: none; }
  }
  &__text {
    margin: 0;
    font-size: var(--text-base);
    line-height: var(--lh-base);
    overflow-wrap: anywhere;
    &--code {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      white-space: pre;
      overflow-x: auto;
      overflow-wrap: normal;
    }
  }
  &__copy {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    min-height: 28px;
    min-width: 68px;
    padding: 0 var(--space-3);
    border: 1px solid var(--rule);
    border-radius: var(--radius-m);
    background: var(--paper-raised);
    color: var(--ink);
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
    &:hover { border-color: var(--ink-faint); }
  }
  &__status {
    min-height: 1lh;
    margin: var(--space-2) 0 0;
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }
}

@media (max-width: 900px) {
  .about-band { grid-template-columns: minmax(0, 1fr); gap: var(--space-4); padding: var(--space-6) 0; }
}

@media (max-width: 640px) {
  .about { padding-top: var(--space-6); }
  .about-facts { grid-template-columns: minmax(0, 1fr); }
  .about-record { padding: var(--space-4); }
  .about-record__facts { grid-template-columns: minmax(0, 1fr); dd { margin-bottom: var(--space-2); } }
  .citation__panel { padding: var(--space-3); }
  .citation__copy { position: static; margin-top: var(--space-3); }
}
```

- [ ] **Step 4: Wire the route**

In `src/app/routes/route-meta.ts`, insert after the `/learn` entry:

```ts
  {
    path: '/about',
    title: 'About — VAMS',
    description:
      'Why VAMS exists, what it teaches, where your work is kept, and the undergraduate thesis behind it, with a citation to copy.',
    indexable: true,
  },
```

In `src/app/SiteApp.tsx`, add `import AboutPage from '@/pages/about';` after the `LearnPage` import, and add `<Route path="/about" component={AboutPage} />` after the `/learn` route.

In `vite.config.ts`, change `additionalPrerenderRoutes: ['/404', '/learn'],` to `additionalPrerenderRoutes: ['/404', '/learn', '/about'],`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/about-page.test.ts tests/black-box/offline-app.test.ts tests/black-box/site-shell.test.ts tests/black-box/editor-shell.test.ts`
Expected: PASS. Two suites are included on purpose:
- `editor-shell` covers BB-SHELL-22, 23 and 24, which scan `about.scss`.
- `site-shell`'s BB-SITE-06 requires every route to have a unique path and metadata.

- [ ] **Step 6: Add the visual checks**

Create `tests/visual/about.spec.ts`:

```ts
/**
 * VISUAL TEST SUITE — VIS-ABOUT
 * Screenshot checks for the About page. Not part of `npm test`.
 */
import { test, expect, type Page } from '@playwright/test';

type Theme = 'light' | 'dark';

const HIDE_TIMED_NOTICES = '.update-notice, [data-sonner-toaster] { display: none !important; }';

async function open(page: Page, theme: Theme) {
  await page.addInitScript(
    ({ t, css }) => {
      window.localStorage.setItem('vams-theme', t);
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
  await page.goto('/about');
  await page.waitForSelector('.about');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

test('VIS-ABOUT-01: Light, 1280', async ({ page }) => {
  await open(page, 'light');
  await expect(page).toHaveScreenshot('about-light-1280.png', { fullPage: true });
});

test('VIS-ABOUT-02: Dark, 1280', async ({ page }) => {
  await open(page, 'dark');
  await expect(page).toHaveScreenshot('about-dark-1280.png', { fullPage: true });
});

test('VIS-ABOUT-03: Light, 390, no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 'light');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page).toHaveScreenshot('about-light-390.png', { fullPage: true });
});
```

Run: `npx playwright test tests/visual/about.spec.ts --update-snapshots`
Expected: 3 passed, and three new baselines written to `tests/visual/baseline.local/`, which is git-ignored.

Open the three PNGs in `tests/visual/baseline.local/` and look at them. Check that:
- the bands line up;
- the record card and the citation panel do not overflow at 390px;
- the BibTeX panel scrolls sideways inside itself rather than widening the page;
- both themes are legible.

Fix any defect in `about.scss` and rerun with `--update-snapshots`. Stop after one fix round.

- [ ] **Step 7: Run the checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/pages/about/index.ts src/pages/about/ui/AboutBand.tsx src/pages/about/ui/AboutPage.tsx src/pages/about/ui/about.scss src/app/routes/route-meta.ts src/app/SiteApp.tsx vite.config.ts tests/black-box/about-page.test.ts tests/black-box/offline-app.test.ts tests/visual/about.spec.ts
git diff --staged --stat
git commit -m "feat(about): add the prerendered About page"
```

---

### Task 4: Entry points, phone header and docs

**Files:**
- Modify:
  - `src/widgets/site-header/model/nav.ts`
  - `src/widgets/site-header/ui/SiteHeader.tsx`
  - `src/widgets/site-header/ui/site-header.scss` (the ≤480px block)
  - `src/widgets/site-footer/ui/SiteFooter.tsx`
  - `src/pages/home/model/content.ts`
  - `src/pages/home/ui/sections/TeamSection.tsx`
  - `src/pages/home/ui/sections/sections.scss`
  - `tests/visual/learn.spec.ts` (VIS-LEARN-05)
  - `docs/specs/2026-10-04-website-overhaul-roadmap.md`
  - `tests/README.md`
- Test: `tests/black-box/site-shell.test.ts` (BB-SITE-29 update; add 31, 32, 33), `tests/black-box/home-stage.test.ts` (add BB-HOME-24)

**Interfaces:**
- Consumes (Task 3): the `/about` route and its prerendered page with `SiteHeader current="/about"`.
- Produces:
  - `NAV_LINKS` is Home, Learn, About.
  - `TEAM_MORE = { href: '/about', label: 'The full story' }` in `content.ts`.
  - The `.site-header__cta-the` span.
  - `.team-more` paragraph on the home Team slide.

- [ ] **Step 1: Write the failing tests**

In `tests/black-box/site-shell.test.ts`, inside BB-SITE-29's first `it`, change the `NAV_LINKS` expectation to:

```ts
    expect(NAV_LINKS.map(({ href, label }) => ({ href, label }))).toEqual([
      { href: '/', label: 'Home' },
      { href: '/learn', label: 'Learn' },
      { href: '/about', label: 'About' },
    ]);
```

Append to the end of `tests/black-box/site-shell.test.ts`:

```ts
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
```

(`readFileSync`, `render`, `h`, `prerenderAt`, `currentNavHref`, `NAV_LINKS` and `SiteFooter` are already imported or defined in this file. Check the top of the file, and add `readFileSync` from `node:fs` only if it is missing.)

Append to `tests/black-box/home-stage.test.ts`:

```ts
describe('BB-HOME-24: The Team slide links to the full story on /about', () => {
  it('renders one /about link inside the team section', async () => {
    window.history.replaceState(null, '', '/');
    const { html } = await prerender({ url: '/' });
    const team = html.slice(html.indexOf('id="team"'), html.indexOf('id="try"'));
    expect(team).toContain('<p class="team-more"><a href="/about">The full story</a></p>');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/site-shell.test.ts tests/black-box/home-stage.test.ts`
Expected: FAIL in BB-SITE-29 (no About link), 31, 32, 33 and BB-HOME-24.

- [ ] **Step 3: Implement the links**

`src/widgets/site-header/model/nav.ts`: add the About link last.

```ts
export const NAV_LINKS: NavLink[] = [
  { href: '/', label: 'Home' },
  { href: '/learn', label: 'Learn', icon: GraduationCap },
  { href: '/about', label: 'About' },
];
```

`src/widgets/site-header/ui/SiteHeader.tsx`: replace the CTA line with:

```tsx
          <a className="site-header__cta" href="/app">
            Open <span className="site-header__cta-the">the </span>app
          </a>
```

`src/widgets/site-header/ui/site-header.scss`: inside the existing `@media (max-width: 480px)` block, add:

```scss
  .site-header__cta-the { display: none; }
```

`src/widgets/site-footer/ui/SiteFooter.tsx`: after `<a href="/learn">Learn</a>`, add `<a href="/about">About</a>`.

`src/pages/home/model/content.ts`: after the `TEAM` constant, add:

```ts
export const TEAM_MORE = { href: '/about', label: 'The full story' };
```

`src/pages/home/ui/sections/TeamSection.tsx`: import `TEAM_MORE` alongside `TEAM`, and after the closing `</dl>` add:

```tsx
      <p className="team-more">
        <a href={TEAM_MORE.href}>{TEAM_MORE.label}</a>
      </p>
```

`src/pages/home/ui/sections/sections.scss`: make the curriculum link rule serve both, changing `.curriculum-more {` to `.curriculum-more, .team-more {`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/site-shell.test.ts tests/black-box/home-stage.test.ts`
Expected: PASS.

- [ ] **Step 5: Fit the header on a 390px phone**

In `tests/visual/learn.spec.ts` VIS-LEARN-05:
- change the path list to `['/', '/learn', '/about', '/404']`;
- after the Learn visibility check, add:

```ts
    await expect(page.locator('.site-header__link', { hasText: 'About' }), path).toBeVisible();
    await expect(page.locator('.site-header__cta'), path).toHaveText('Open app');
```

Run: `npx playwright test tests/visual/learn.spec.ts -g "VIS-LEARN-05"`
Expected: PASS. If a page overflows, tighten only inside the `@media (max-width: 480px)` block of `site-header.scss`. Apply these one at a time, in this order, and rerun after each:

1. `.site-header__link { padding: 0 6px; }`
2. `.site-header { gap: 6px; }`
3. `.site-header__theme { width: 32px; height: 32px; }`
4. `.site-header__home { font-size: 0.72rem; }`

Stop at the first one that passes. Record which ones were needed as a ruling.

- [ ] **Step 6: Refresh the baselines the header and footer change**

Run: `npx playwright test tests/visual/home.spec.ts tests/visual/learn.spec.ts tests/visual/about.spec.ts --update-snapshots`
Expected: all pass. Look at the refreshed home, learn and about PNGs for the header at both widths:
- the switcher reads Home | Learn | About;
- on 390px captures the CTA reads "Open app";
- the footer shows the About link.

Then run `npm run test:visual` once without the flag. Expected: all pass.

- [ ] **Step 7: Update the docs**

In `docs/specs/2026-10-04-website-overhaul-roadmap.md`, change Must row 7's status from `Not started` to:

```
Complete (2026-10-10): [spec](2026-10-10-about-page-design.md), [plan](../plans/2026-10-10-about-page.md)
```

In `tests/README.md`:
- add a BB-ABOUT row for `tests/black-box/about-page.test.ts`, described as "The /about page: copy, citation tabs, prerendered page, import boundary";
- add a VIS-ABOUT row for `tests/visual/about.spec.ts`;
- follow the table's existing column format; read the file first.

- [ ] **Step 8: Run the checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/widgets/site-header/model/nav.ts src/widgets/site-header/ui/SiteHeader.tsx src/widgets/site-header/ui/site-header.scss src/widgets/site-footer/ui/SiteFooter.tsx src/pages/home/model/content.ts src/pages/home/ui/sections/TeamSection.tsx src/pages/home/ui/sections/sections.scss tests/black-box/site-shell.test.ts tests/black-box/home-stage.test.ts tests/visual/learn.spec.ts docs/specs/2026-10-04-website-overhaul-roadmap.md tests/README.md
git diff --staged --stat
git commit -m "feat(site): link the About page from the header, footer and home Team slide"
```
