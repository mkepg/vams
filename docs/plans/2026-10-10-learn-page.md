# /learn Page Implementation Plan

**Goal:** A prerendered `/learn` page that shows the course outside the editor: the five sections in pipeline order, each with its summary, key calls, demos and exercises, the student's progress, and a Next up lesson. Every lesson opens in the editor in one click.

**Architecture:**
- **A store-free catalog,** `src/features/lesson-engine/model/catalog.ts`, holds the course sections and one entry per lesson (id, title, type, section, step count). The lesson files import the editor store, so site pages read this instead. A parity test keeps it equal to the lesson registry.
- **Progress becomes store-free** by validating ids against the catalog. Its hook gains an `afterMount` option, so a prerendered page reads progress only after hydration, and it follows `storage` events from other tabs.
- **A new page slice, `src/pages/learn/`,** with pure progress helpers in `model/` and three components in `ui/`. It reuses the site header and footer.
- **The route** joins `ROUTES`, `NAV_LINKS`, `SiteApp` and the prerender list in one task.

**Tech Stack:** Preact 10 + preact/compat, preact-iso, SCSS tokens, lucide-react, Vitest 4 + happy-dom 20, Playwright 1.63 (local visual suite).

**Spec:** [docs/specs/2026-10-10-learn-page-design.md](../specs/2026-10-10-learn-page-design.md)

## Global Constraints

- **Branch:** `feat/learn-page` (it exists and holds the spec commits). Task 4 is the only editor change and merges before **2026-10-28**, the editor freeze. The rest is due by **2026-11-02**.
- **Commits:**
  - Conventional Commits (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`), with an optional scope.
  - No `Co-Authored-By` trailer and no "Generated with" line.
  - Commit text describes the engineering only.
- **Staging:**
  - Stage explicit paths and read `git diff --staged` before committing. Never `git add -A` or `git add .`.
  - Never stage `.gitignore` (it carries a local edit).
  - Never `git add -f`.
- **Before every commit:** `npm run lint`, `npm run build` and `npm test` all pass. Then run `git checkout -- tests/reports`.
- **Line endings:** the working copy is CRLF (`core.autocrlf=true`). Tests that read source files normalise `\r\n` to `\n` before matching line-anchored patterns.
- **Test IDs:**
  - Existing IDs keep their numbers.
  - New IDs: BB-LPAGE-01+ (new file `tests/black-box/learn-page.test.ts`), BB-SITE-29+, BB-PWA-08+, BB-LINK-14+, BB-HOME-22+, VIS-LEARN-01+ (new file `tests/visual/learn.spec.ts`).
  - `BB-LEARN-*` already belongs to the Learn drawer suite. Do not reuse it.
- **Student-facing text** never uses "coming soon", "not supported", "future", "deferred", "3D" or "lighting".
- **Section labels are exactly** `Pipeline | Primitives | Buffers | Transforms | Textures`.
- **Modes:** two only, Author and Lesson.
- **Lessons are data:** no lesson file changes.
- **Persistence:**
  - `vams-storage` stays at `version: 7`, and its `partialize` keys do not change.
  - Lesson progress stays under `vams-lesson-progress` with its current shape (`{ version: 1, completed, current }`).
- **Bundle boundary:** nothing under `src/pages/learn` may import, at runtime and through any chain, `src/core/store/*`, `lesson-registry.ts` or any `*-lessons.ts` file. Type-only imports are fine.
- **FSD:** `app → pages → widgets → features → entities → shared`, plus `core`. Pages never import other pages.
- **Home content file:** `src/pages/home/model/content.ts` keeps zero imports. The Vite config loads it through a relative import chain, and `@/` does not resolve there.
- **Accent rule** (visual identity): cobalt marks only active or selected things. On this page that means the in-progress mark, the Next up row's tint, link hover and focus.
- **Craft rules:** no eyebrow labels above headings, no section numbers, no card grids. Status marks are CSS or Lucide icons, never text glyphs.
- **Never run `taskkill /IM node.exe`.** Stop only processes you started, by PID. Port 5173 belongs to another process; use 5174 for a dev server.

## Review Focus

Five conditions the spec implies but no happy-path test reaches. Each has a test in the task that owns the code:

1. **Stored progress names a step past the lesson's end,** for example after a lesson lost steps. Expected: the meta reads "Left at step {n} of {n}", never past the end. Test: BB-LPAGE-03 (Task 2).
2. **The lesson left mid-way is also marked done,** which happens when a finished lesson is reopened and left. Expected: the lesson shows as done, and Next up moves on to the first lesson not done. Test: BB-LPAGE-04 (Task 2).
3. **localStorage is blocked or holds unreadable JSON when `/learn` opens.** Expected: the first-visit page, with no error. Test: BB-LPAGE-10 (Task 3).
4. **A student leaves a running lesson for `/learn`, then opens a different lesson there.** The lesson stays in memory across client-side navigation. Expected: the replaced lesson is recorded as left at its step. Test: BB-LINK-14 (Task 4).
5. **Another tab clears storage,** which fires a `storage` event with `key === null`. Expected: the page rereads progress and shows the first-visit state. Test: BB-LPAGE-02 (Task 2).

---

### Task 1: A store-free course catalog

**Files:**
- Create: `src/features/lesson-engine/model/catalog.ts`
- Modify: `src/features/lesson-engine/model/course.ts`
- Modify: `src/features/lesson-engine/model/progress.ts:1-16`
- Modify: `src/pages/home/ui/sections/CurriculumSection.tsx`
- Modify: `src/pages/home/model/content.ts:45-78` (the `CURRICULUM` object)
- Modify: `tests/black-box/home-stage.test.ts` (BB-HOME-12)
- Modify: `AGENTS.md` (the "Lessons are data" rule)
- Modify: `docs/product-plan.md` (Appendix B, Structure)
- Test: `tests/black-box/learn-page.test.ts` (new)

**Interfaces:**
- Produces:
  - `interface CourseSection { section: CurriculumSection; description: string; summary: string; calls: readonly string[] }`
  - `interface LessonEntry { id: string; title: string; type: 'demo' | 'exercise'; section: CurriculumSection; steps: number }`
  - `COURSE: readonly CourseSection[]`
  - `LESSON_CATALOG: readonly LessonEntry[]`
  - `catalogFor(section: CurriculumSection): { demos: LessonEntry[]; exercises: LessonEntry[] }`
  - `isCatalogLesson(id: unknown): id is string`
  - `lessonHref(id: string): string`, which returns `/app?lesson=<id>`
- `course.ts` keeps exporting `COURSE` (re-exported) and `lessonsFor`, so the Learn drawer does not change.

- [ ] **Step 1: Write the failing parity test**

Create `tests/black-box/learn-page.test.ts`:

```ts
/**
 * BLACK-BOX TEST SUITE — BB-LPAGE
 * The /learn page: the store-free course catalog, progress on a prerendered page, and the page itself.
 */
import { describe, it, expect } from 'vitest';
import { LESSON_REGISTRY } from '@/features/lesson-engine/model/lesson-registry';
import { COURSE, LESSON_CATALOG, catalogFor, isCatalogLesson, lessonHref } from '@/features/lesson-engine/model/catalog';

const SECTIONS = ['Pipeline', 'Primitives', 'Buffers', 'Transforms', 'Textures'];

describe('BB-LPAGE-01: The catalog matches the lesson registry', () => {
  it('lists every lesson once, in registry order, with its title, type, section and step count', () => {
    const fromRegistry = Object.values(LESSON_REGISTRY).map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      type: lesson.type,
      section: lesson.section,
      steps: lesson.steps.length,
    }));
    expect(LESSON_CATALOG).toEqual(fromRegistry);
    expect(new Set(LESSON_CATALOG.map((lesson) => lesson.id)).size).toBe(LESSON_CATALOG.length);
  });

  it('orders the course in pipeline order and splits each section into demos and exercises', () => {
    expect(COURSE.map((course) => course.section)).toEqual(SECTIONS);
    for (const course of COURSE) {
      expect(course.summary.length).toBeGreaterThan(0);
      expect(course.calls.length).toBe(3);
      const { demos, exercises } = catalogFor(course.section);
      expect(demos.every((lesson) => lesson.type === 'demo' && lesson.section === course.section)).toBe(true);
      expect(exercises.every((lesson) => lesson.type === 'exercise' && lesson.section === course.section)).toBe(true);
      expect(demos.length + exercises.length).toBe(LESSON_CATALOG.filter((l) => l.section === course.section).length);
    }
  });

  it('recognises catalog ids only and builds editor links', () => {
    expect(isCatalogLesson('transforms-demo-1')).toBe(true);
    expect(isCatalogLesson('nope')).toBe(false);
    expect(isCatalogLesson('toString')).toBe(false);
    expect(isCatalogLesson(7)).toBe(false);
    expect(lessonHref('transforms-demo-1')).toBe('/app?lesson=transforms-demo-1');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/black-box/learn-page.test.ts`
Expected: FAIL, because `@/features/lesson-engine/model/catalog` cannot be resolved.

- [ ] **Step 3: Create the catalog**

Create `src/features/lesson-engine/model/catalog.ts`. The lesson entries below were generated from the registry on 2026-10-10. Copy them exactly; the parity test is the check.

```ts
import type { CurriculumSection } from '@/core/store/types';

/*
 * The course without the lessons' code. Lesson files import the editor store, so site pages read
 * this instead. A test keeps it equal to the lesson registry: adding, renaming or changing the
 * steps of a lesson means updating its entry here in the same change.
 */

export interface CourseSection {
  section: CurriculumSection;
  /** One line, shown in the editor's Learn drawer. */
  description: string;
  /** One sentence, shown on the home page and on /learn. */
  summary: string;
  /** Three calls the section teaches. */
  calls: readonly string[];
}

export interface LessonEntry {
  id: string;
  title: string;
  type: 'demo' | 'exercise';
  section: CurriculumSection;
  /** The number of steps. */
  steps: number;
}

/** The course map: the five sections in pipeline order. */
export const COURSE: readonly CourseSection[] = [
  {
    section: 'Pipeline',
    description: 'The rendering pipeline, NDC, and rasterization',
    summary: 'The rendering pipeline, rasterization, normalized device coordinates and the GLUT program structure.',
    calls: ['glutInit', 'glutDisplayFunc', 'glutMainLoop'],
  },
  {
    section: 'Primitives',
    description: 'Points, lines, triangles, color, and line style',
    summary: 'glBegin and glEnd primitives, colour, line styles, bitmap text and GLUT callbacks.',
    calls: ['glBegin', 'glColor3f', 'glLineStipple'],
  },
  {
    section: 'Buffers',
    description: 'Vertex arrays, VBOs, and memory layout',
    summary: 'Immediate mode, vertex arrays and VBOs, side by side.',
    calls: ['glVertexPointer', 'glBufferData', 'glDrawElements'],
  },
  {
    section: 'Transforms',
    description: 'Translate, rotate, scale, and the matrix stack',
    summary: 'Translate, rotate and scale, the matrix stack and glOrtho.',
    calls: ['glTranslatef', 'glRotatef', 'glPushMatrix'],
  },
  {
    section: 'Textures',
    description: 'Images, UV mapping, filtering, and wrapping',
    summary: 'Texture objects, UV coordinates, filtering and wrapping.',
    calls: ['glBindTexture', 'glTexParameteri', 'glTexCoord2f'],
  },
];

/** Every lesson, in registry order. */
export const LESSON_CATALOG: readonly LessonEntry[] = [
  { id: 'pipeline-demo-1', title: 'From Vertex to Pixel', type: 'demo', section: 'Pipeline', steps: 9 },
  { id: 'pipeline-demo-2', title: 'Vector vs Raster', type: 'demo', section: 'Pipeline', steps: 4 },
  { id: 'pipeline-demo-3', title: 'Normalized Device Coordinates', type: 'demo', section: 'Pipeline', steps: 4 },
  { id: 'pipeline-demo-4', title: 'Anatomy of a GLUT Program', type: 'demo', section: 'Pipeline', steps: 6 },
  { id: 'pipeline-exercise-1', title: 'Place the Point', type: 'exercise', section: 'Pipeline', steps: 3 },
  { id: 'pipeline-exercise-2', title: 'Which Stage?', type: 'exercise', section: 'Pipeline', steps: 9 },
  { id: 'pipeline-exercise-3', title: 'Order the Pipeline', type: 'exercise', section: 'Pipeline', steps: 2 },
  { id: 'poc-demo-1', title: 'Proof of Concept: Drawing a Triangle', type: 'demo', section: 'Primitives', steps: 4 },
  { id: 'primitives-demo-1', title: 'The Geometry Alphabet: Points to Polygons', type: 'demo', section: 'Primitives', steps: 7 },
  { id: 'primitives-demo-2', title: 'Painting with Barycentrics', type: 'demo', section: 'Primitives', steps: 4 },
  { id: 'primitives-demo-3', title: 'Styling Lines (Width & Stipple)', type: 'demo', section: 'Primitives', steps: 4 },
  { id: 'primitives-demo-4', title: 'Rendering Text in OpenGL', type: 'demo', section: 'Primitives', steps: 4 },
  { id: 'primitives-demo-5', title: 'Hooking Up Callbacks', type: 'demo', section: 'Primitives', steps: 4 },
  { id: 'primitives-exercise-1', title: 'Quad Assembly', type: 'exercise', section: 'Primitives', steps: 2 },
  { id: 'primitives-exercise-2', title: 'Neon Gradient', type: 'exercise', section: 'Primitives', steps: 3 },
  { id: 'primitives-exercise-3', title: 'Dotted Outline', type: 'exercise', section: 'Primitives', steps: 3 },
  { id: 'primitives-exercise-4', title: 'Hello World!', type: 'exercise', section: 'Primitives', steps: 2 },
  { id: 'primitives-exercise-5', title: 'Hooking up the Mouse', type: 'exercise', section: 'Primitives', steps: 3 },
  { id: 'buffers-demo-1', title: 'Immediate Mode: Every Frame', type: 'demo', section: 'Buffers', steps: 4 },
  { id: 'buffers-demo-2', title: 'Converting to Vertex Arrays', type: 'demo', section: 'Buffers', steps: 4 },
  { id: 'buffers-demo-3', title: 'VBOs: Send Once', type: 'demo', section: 'Buffers', steps: 6 },
  { id: 'buffers-demo-4', title: 'Buffer Usage Hints', type: 'demo', section: 'Buffers', steps: 7 },
  { id: 'buffers-demo-5', title: 'Updating in Place: glMapBuffer', type: 'demo', section: 'Buffers', steps: 12 },
  { id: 'buffers-exercise-1', title: 'Switch to VBO', type: 'exercise', section: 'Buffers', steps: 2 },
  { id: 'buffers-exercise-2', title: 'Use Static for Unchanging Data', type: 'exercise', section: 'Buffers', steps: 2 },
  { id: 'buffers-exercise-3', title: 'Reduce Memory with Indexed Drawing', type: 'exercise', section: 'Buffers', steps: 2 },
  { id: 'buffers-exercise-4', title: 'Pick the Right Usage Hint', type: 'exercise', section: 'Buffers', steps: 2 },
  { id: 'transforms-demo-1', title: 'Translate, Rotate, Scale', type: 'demo', section: 'Transforms', steps: 5 },
  { id: 'transforms-demo-2', title: 'Matrix Representation', type: 'demo', section: 'Transforms', steps: 6 },
  { id: 'transforms-demo-3', title: 'The Matrix Stack', type: 'demo', section: 'Transforms', steps: 4 },
  { id: 'transforms-demo-4', title: 'glOrtho: Changing the View', type: 'demo', section: 'Transforms', steps: 4 },
  { id: 'transforms-anim-1', title: 'Animation: Transformation Over Time', type: 'demo', section: 'Transforms', steps: 4 },
  { id: 'transforms-exercise-1', title: 'Translate to Position', type: 'exercise', section: 'Transforms', steps: 2 },
  { id: 'transforms-exercise-2', title: 'Rotate to Angle', type: 'exercise', section: 'Transforms', steps: 2 },
  { id: 'transforms-exercise-3', title: 'Build a Hierarchy', type: 'exercise', section: 'Transforms', steps: 2 },
  { id: 'transforms-exercise-4', title: 'Set the Viewport Range', type: 'exercise', section: 'Transforms', steps: 2 },
  { id: 'textures-demo-1', title: 'The Foundation of Textures', type: 'demo', section: 'Textures', steps: 5 },
  { id: 'textures-demo-2', title: 'Unlocking the Texture Atlas', type: 'demo', section: 'Textures', steps: 4 },
  { id: 'textures-demo-3', title: 'The Pixel Art Problem', type: 'demo', section: 'Textures', steps: 4 },
  { id: 'textures-demo-4', title: 'Pushing Boundaries (Wrapping)', type: 'demo', section: 'Textures', steps: 5 },
  { id: 'textures-demo-5', title: 'Texture on a Triangle', type: 'demo', section: 'Textures', steps: 4 },
  { id: 'textures-exercise-1', title: 'First Coat of Paint', type: 'exercise', section: 'Textures', steps: 2 },
  { id: 'textures-exercise-2', title: 'Sprite Extraction', type: 'exercise', section: 'Textures', steps: 2 },
  { id: 'textures-exercise-3', title: 'Retro Crispness', type: 'exercise', section: 'Textures', steps: 2 },
  { id: 'textures-exercise-4', title: 'The Endless Floor', type: 'exercise', section: 'Textures', steps: 3 },
];

export function catalogFor(section: CurriculumSection): { demos: LessonEntry[]; exercises: LessonEntry[] } {
  const all = LESSON_CATALOG.filter((lesson) => lesson.section === section);
  return { demos: all.filter((l) => l.type === 'demo'), exercises: all.filter((l) => l.type === 'exercise') };
}

/** An array lookup, so prototype keys such as "toString" never count as lessons. */
export function isCatalogLesson(id: unknown): id is string {
  return typeof id === 'string' && LESSON_CATALOG.some((lesson) => lesson.id === id);
}

/** The editor link that opens a lesson. */
export function lessonHref(id: string): string {
  return `/app?lesson=${encodeURIComponent(id)}`;
}
```

- [ ] **Step 4: Point `course.ts` and `progress.ts` at the catalog**

Replace the whole of `src/features/lesson-engine/model/course.ts` with:

```ts
import type { Lesson } from '@/core/types/lesson';
import type { CurriculumSection } from '@/core/store/types';
import { LESSON_REGISTRY } from './lesson-registry';

export { COURSE } from './catalog';

/** The full lessons of one section, for the editor's Learn drawer. Site pages use catalogFor instead. */
export function lessonsFor(section: CurriculumSection): { demos: Lesson[]; exercises: Lesson[] } {
  const all = Object.values(LESSON_REGISTRY).filter((lesson) => lesson.section === section);
  return { demos: all.filter((l) => l.type === 'demo'), exercises: all.filter((l) => l.type === 'exercise') };
}
```

In `src/features/lesson-engine/model/progress.ts`:
- Replace `import { LESSON_REGISTRY } from './lesson-registry';` with `import { isCatalogLesson as isLesson } from './catalog';`.
- Delete the local `const isLesson = (id: unknown): id is string => ...;` definition (two lines). Every existing `isLesson(...)` call stays as it is.

- [ ] **Step 5: Run the parity test to verify it passes**

Run: `npx vitest run tests/black-box/learn-page.test.ts tests/black-box/learn-drawer.test.ts`
Expected: PASS. BB-LEARN-02 still rejects unknown and prototype ids, now through the catalog.

- [ ] **Step 6: Make the home curriculum slide read `COURSE`**

In `src/pages/home/model/content.ts`, delete the `sections: [ ... ],` array from `CURRICULUM` (the five objects with `name`, `summary` and `calls`). Keep `title` and `modes`. The file keeps zero imports.

Replace `src/pages/home/ui/sections/CurriculumSection.tsx` with:

```tsx
import { COURSE } from '@/features/lesson-engine/model/catalog';
import { CURRICULUM } from '@/pages/home/model/content';
import SectionHeading from './SectionHeading';

export default function CurriculumSection() {
  return (
    <section id="curriculum" className="home-section" data-slide="" aria-labelledby="curriculum-title">
      <SectionHeading id="curriculum" title={CURRICULUM.title} />
      <ol className="pipeline">
        {COURSE.map((course) => (
          <li key={course.section} className="pipeline__stop">
            <span className="pipeline__dot" aria-hidden="true" />
            <h3 className="pipeline__name">{course.section}</h3>
            <p className="pipeline__summary">{course.summary}</p>
            <ul className="pipeline__calls" aria-label={`Key calls in ${course.section}`}>
              {course.calls.map((call) => (
                <li key={call}>
                  <code>{call}</code>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <dl className="mode-list">
        {CURRICULUM.modes.map((mode) => (
          <div key={mode.name}>
            <dt>{mode.name}</dt>
            <dd>{mode.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
```

In `tests/black-box/home-stage.test.ts`, BB-HOME-12:
- Add `import { COURSE } from '@/features/lesson-engine/model/catalog';` beside the existing content import.
- Replace `expect(CURRICULUM.sections.map((s) => s.name)).toEqual([...])` with `expect(COURSE.map((c) => c.section)).toEqual(['Pipeline', 'Primitives', 'Buffers', 'Transforms', 'Textures']);`.
- Add `COURSE` to the object passed to `JSON.stringify` in the banned-word check.

- [ ] **Step 7: Record the catalog rule**

In `AGENTS.md`, replace the "Lessons are data" bullet with:

```markdown
- **Lessons are data.** Lesson steps drive the scene through the same store actions the GUI uses; exercises add a pure `successCheck` over state. Lesson files live in `features/lesson-engine/model/*-lessons.ts`. Each lesson also has an entry (id, title, type, section, step count) in `features/lesson-engine/model/catalog.ts`, which site pages read because lesson files import the store; a test fails when the two disagree.
```

In `docs/product-plan.md`, Appendix B, add this paragraph at the end of "### Structure", after the "Exercises additionally have a success check" paragraph:

```markdown
Each lesson is also listed in a course catalog by id, title, kind, section and step count. The `/learn` page reads the catalog, so it shows the course without loading the editor. A test fails whenever the catalog and the lessons disagree.
```

- [ ] **Step 8: Run all checks**

Run: `npm run lint && npm run build && npm test`, then `git checkout -- tests/reports`.
Expected: all pass. BB-HOME-21 still finds the five `pipeline__name` headings in order.

- [ ] **Step 9: Commit**

```bash
git add src/features/lesson-engine/model/catalog.ts src/features/lesson-engine/model/course.ts src/features/lesson-engine/model/progress.ts src/pages/home/ui/sections/CurriculumSection.tsx src/pages/home/model/content.ts tests/black-box/learn-page.test.ts tests/black-box/home-stage.test.ts AGENTS.md docs/product-plan.md
git diff --staged --stat
git commit -m "feat(lessons): a store-free course catalog shared by the drawer, home and site pages"
```

---

### Task 2: Progress on a prerendered page

**Files:**
- Modify: `src/features/lesson-engine/model/progress.ts` (`useLessonProgress`)
- Create: `src/pages/learn/model/learn-progress.ts`
- Test: `tests/black-box/learn-page.test.ts`

**Interfaces:**
- Consumes: `LESSON_CATALOG`, `LessonEntry` (Task 1); `LessonProgress`, `PROGRESS_KEY`, `readProgress`, `subscribeProgress` (existing).
- Produces:
  - `useLessonProgress(options?: { afterMount?: boolean }): LessonProgress`. With `afterMount: true`, the first render returns empty progress, and progress is read in an effect.
  - `interface LessonStatus { kind: 'new' | 'progress' | 'complete'; meta: string; spoken: string }`
  - `lessonStatus(lesson: LessonEntry, progress: LessonProgress): LessonStatus`
  - `nextUp(progress: LessonProgress): LessonEntry | null`
  - `doneCount(progress: LessonProgress, lessons?: readonly LessonEntry[]): number`

- [ ] **Step 1: Write the failing tests**

Add these imports at the top of `tests/black-box/learn-page.test.ts`. Merge them into the existing `vitest` import line so `afterEach` and `vi` come from it.

```ts
import { afterEach, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { PROGRESS_KEY, useLessonProgress, type LessonProgress } from '@/features/lesson-engine/model/progress';
import { doneCount, lessonStatus, nextUp } from '@/pages/learn/model/learn-progress';

async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}
const hosts: HTMLElement[] = [];
function mount(vnode: VNode) {
  const host = document.createElement('div');
  hosts.push(host);
  document.body.appendChild(host);
  render(vnode, host);
  return host;
}
function store(progress: Partial<LessonProgress>) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, completed: [], current: null, ...progress }));
}
const progressOf = (p: Partial<LessonProgress>): LessonProgress => ({ version: 1, completed: [], current: null, ...p });
const entry = (id: string) => LESSON_CATALOG.find((lesson) => lesson.id === id)!;

afterEach(() => {
  while (hosts.length) {
    const host = hosts.pop()!;
    render(null, host);
    host.remove();
  }
  vi.restoreAllMocks();
  localStorage.removeItem(PROGRESS_KEY);
});

function Probe({ afterMount }: { afterMount?: boolean }) {
  const progress = useLessonProgress({ afterMount });
  return h('output', null, progress.completed.join(','));
}
```

Then append:

```ts
describe('BB-LPAGE-02: A prerendered page reads progress after mount and follows other tabs', () => {
  it('renders empty progress on the server, then reads storage once mounted', async () => {
    store({ completed: ['pipeline-demo-1'] });
    expect(renderToString(h(Probe, { afterMount: true }))).toBe('<output></output>');
    const host = mount(h(Probe, { afterMount: true }));
    await settle();
    expect(host.textContent).toBe('pipeline-demo-1');
  });

  it('keeps reading storage on the first render without the option', () => {
    store({ completed: ['pipeline-demo-1'] });
    expect(renderToString(h(Probe, {}))).toBe('<output>pipeline-demo-1</output>');
  });

  it('rereads on a storage event for its key, and when another tab clears storage', async () => {
    const host = mount(h(Probe, { afterMount: true }));
    await settle();
    store({ completed: ['buffers-demo-1'] });
    window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_KEY }));
    await settle();
    expect(host.textContent).toBe('buffers-demo-1');
    localStorage.removeItem(PROGRESS_KEY);
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    await settle();
    expect(host.textContent).toBe('');
  });
});

describe('BB-LPAGE-03: Each lesson reads as not started, in progress or done', () => {
  it('words the meta and the spoken status, and never counts past the last step', () => {
    const lesson = entry('transforms-demo-2'); // Matrix Representation, 6 steps
    expect(lessonStatus(lesson, progressOf({}))).toEqual({ kind: 'new', meta: '6 steps', spoken: 'not started, 6 steps' });
    expect(lessonStatus(lesson, progressOf({ current: { lessonId: lesson.id, step: 2 } }))).toEqual({
      kind: 'progress',
      meta: 'Left at step 3 of 6',
      spoken: 'in progress, left at step 3 of 6',
    });
    expect(lessonStatus(lesson, progressOf({ current: { lessonId: lesson.id, step: 40 } })).meta).toBe('Left at step 6 of 6');
    expect(lessonStatus(lesson, progressOf({ completed: [lesson.id] }))).toEqual({ kind: 'complete', meta: 'Done', spoken: 'done' });
  });
});

describe('BB-LPAGE-04: Next up is the lesson left mid-way, else the first one not done', () => {
  it('covers a first visit, a lesson left mid-way, some done, a done lesson left again, and all done', () => {
    expect(nextUp(progressOf({}))?.id).toBe('pipeline-demo-1');
    expect(nextUp(progressOf({ current: { lessonId: 'textures-demo-2', step: 1 } }))?.id).toBe('textures-demo-2');
    expect(nextUp(progressOf({ completed: ['pipeline-demo-1', 'pipeline-demo-2'] }))?.id).toBe('pipeline-demo-3');
    expect(
      nextUp(progressOf({ completed: ['pipeline-demo-1', 'textures-demo-2'], current: { lessonId: 'textures-demo-2', step: 1 } }))?.id,
    ).toBe('pipeline-demo-2');
    expect(nextUp(progressOf({ completed: LESSON_CATALOG.map((l) => l.id) }))).toBeNull();
  });
});

describe('BB-LPAGE-05: Done counts cover the course or one section', () => {
  it('counts only catalog lessons that are done', () => {
    const p = progressOf({ completed: ['pipeline-demo-1', 'transforms-demo-1', 'transforms-exercise-1'] });
    expect(doneCount(p)).toBe(3);
    const { demos, exercises } = catalogFor('Transforms');
    expect(doneCount(p, [...demos, ...exercises])).toBe(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/learn-page.test.ts`
Expected: FAIL, because `@/pages/learn/model/learn-progress` cannot be resolved.

- [ ] **Step 3: Extend `useLessonProgress`**

In `src/features/lesson-engine/model/progress.ts`, replace the `useLessonProgress` function with:

```ts
/**
 * The student's progress, kept current. A prerendered page passes afterMount, so its first
 * render matches the build (which has no storage) and progress is read once the page runs.
 * Progress written by another tab arrives through the storage event.
 */
export function useLessonProgress({ afterMount = false }: { afterMount?: boolean } = {}): LessonProgress {
  const [progress, setProgress] = useState<LessonProgress>(() => (afterMount ? empty() : readProgress()));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (afterMount) setProgress(readProgress());
    const onStorage = (event: StorageEvent) => {
      if (event.key === PROGRESS_KEY || event.key === null) setProgress(readProgress());
    };
    window.addEventListener('storage', onStorage);
    const unsubscribe = subscribeProgress(setProgress);
    return () => {
      unsubscribe();
      window.removeEventListener('storage', onStorage);
    };
  }, [afterMount]);
  return progress;
}
```

If lint reports the `eslint-disable` line as unused, delete that line.

- [ ] **Step 4: Create the page's progress helpers**

Create `src/pages/learn/model/learn-progress.ts`:

```ts
import { LESSON_CATALOG, type LessonEntry } from '@/features/lesson-engine/model/catalog';
import type { LessonProgress } from '@/features/lesson-engine/model/progress';

export interface LessonStatus {
  kind: 'new' | 'progress' | 'complete';
  /** Shown beside the title. */
  meta: string;
  /** Follows the title in the link's accessible name. */
  spoken: string;
}

const stepCount = (n: number) => `${n} ${n === 1 ? 'step' : 'steps'}`;

/** Done wins over in progress: a finished lesson opened and left again still counts as done. */
export function lessonStatus(lesson: LessonEntry, progress: LessonProgress): LessonStatus {
  if (progress.completed.includes(lesson.id)) return { kind: 'complete', meta: 'Done', spoken: 'done' };
  if (progress.current?.lessonId === lesson.id) {
    // A lesson that lost steps since the student left it never reads past its end.
    const step = Math.min(progress.current.step + 1, lesson.steps);
    return {
      kind: 'progress',
      meta: `Left at step ${step} of ${lesson.steps}`,
      spoken: `in progress, left at step ${step} of ${lesson.steps}`,
    };
  }
  return { kind: 'new', meta: stepCount(lesson.steps), spoken: `not started, ${stepCount(lesson.steps)}` };
}

/** The lesson the student left mid-way, else the first lesson not done; null when every lesson is done. */
export function nextUp(progress: LessonProgress): LessonEntry | null {
  const left = progress.current ? LESSON_CATALOG.find((l) => l.id === progress.current?.lessonId) : undefined;
  if (left && !progress.completed.includes(left.id)) return left;
  return LESSON_CATALOG.find((l) => !progress.completed.includes(l.id)) ?? null;
}

export function doneCount(progress: LessonProgress, lessons: readonly LessonEntry[] = LESSON_CATALOG): number {
  return lessons.filter((l) => progress.completed.includes(l.id)).length;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/learn-page.test.ts tests/black-box/learn-drawer.test.ts`
Expected: PASS. The drawer tests still pass, because the hook's default behaviour is unchanged.

- [ ] **Step 6: Run all checks**

Run: `npm run lint && npm run build && npm test`, then `git checkout -- tests/reports`.
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/features/lesson-engine/model/progress.ts src/pages/learn/model/learn-progress.ts tests/black-box/learn-page.test.ts
git diff --staged --stat
git commit -m "feat(learn): progress that hydrates after mount and follows other tabs"
```

---

### Task 3: The /learn page, its route and its links

**Files:**
- Create: `src/pages/learn/index.ts`
- Create: `src/pages/learn/model/copy.ts`
- Create: `src/pages/learn/ui/LearnPage.tsx`
- Create: `src/pages/learn/ui/LearnSection.tsx`
- Create: `src/pages/learn/ui/LessonRow.tsx`
- Create: `src/pages/learn/ui/learn.scss`
- Modify: `src/app/SiteApp.tsx`
- Modify: `src/app/routes/route-meta.ts`
- Modify: `src/widgets/site-header/model/nav.ts`
- Modify: `src/widgets/site-header/ui/SiteHeader.tsx`
- Modify: `src/widgets/site-header/ui/site-header.scss:80-84`
- Modify: `vite.config.ts` (`additionalPrerenderRoutes`)
- Modify: `src/pages/home/model/content.ts` (`CURRICULUM.more`)
- Modify: `src/pages/home/ui/sections/CurriculumSection.tsx`
- Modify: `src/pages/home/ui/sections/sections.scss`
- Test: `tests/black-box/learn-page.test.ts`, `tests/black-box/site-shell.test.ts`, `tests/black-box/offline-app.test.ts`, `tests/black-box/home-stage.test.ts`

**Interfaces:**
- Consumes: everything Tasks 1 and 2 produce.
- Produces:
  - default export `LearnPage` from `@/pages/learn`;
  - `SiteHeader` gains an optional `current?: string` prop. The nav link whose `href` equals it gets `aria-current="page"`.
  - `LEARN_COPY` and `sectionAnchor(section: CurriculumSection): string` (lowercase section name) from `src/pages/learn/model/copy.ts`.
- Class names that the tests and the visual suite rely on:
  - `.learn` (main)
  - `.learn__status`
  - `.learn-next` with a `.learn-row` inside, and `.learn-next--done` when every lesson is done
  - `.learn-index__link`, plus `is-done`
  - `.learn-section` (id = section anchor), `.learn-section__title`, `.learn-section__count`
  - `.learn-row`, plus `is-new` / `is-progress` / `is-complete`

- [ ] **Step 1: Write the failing page tests**

Append to `tests/black-box/learn-page.test.ts`. Add these imports at the top, merging the `preact` import with the existing one so the file imports `h, hydrate, render, type VNode` once:

```ts
import { hydrate } from 'preact';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import LearnPage from '@/pages/learn';
import { LEARN_COPY } from '@/pages/learn/model/copy';
```

Then append:

```ts
const BANNED = ['coming soon', 'not yet', 'future', 'deferred', 'unsupported', 'not supported', '3d', 'lighting'];
const rowFor = (root: ParentNode, id: string) => root.querySelector<HTMLAnchorElement>(`a.learn-row[href="/app?lesson=${id}"]`)!;

describe('BB-LPAGE-06: Every lesson appears once, in its section, linking into the editor', () => {
  it('renders five sections in pipeline order with every catalog lesson', async () => {
    const host = mount(h(LearnPage, {}));
    await settle();
    expect([...host.querySelectorAll('.learn-section__title')].map((e) => e.textContent)).toEqual(SECTIONS);
    for (const lesson of LESSON_CATALOG) {
      const section = host.querySelector(`section#${lesson.section.toLowerCase()}`)!;
      expect(section.querySelectorAll(`a[href="/app?lesson=${lesson.id}"]`).length, lesson.id).toBe(1);
    }
    expect(host.querySelectorAll('section.learn-section a.learn-row').length).toBe(LESSON_CATALOG.length);
    expect([...host.querySelectorAll('.learn-index__link')].map((a) => a.getAttribute('href'))).toEqual(
      SECTIONS.map((s) => `#${s.toLowerCase()}`),
    );
  });
});

describe('BB-LPAGE-07: Progress shows on rows, counts, the index and Next up', () => {
  it('marks done and in-progress lessons and names them for screen readers', async () => {
    store({ completed: ['transforms-demo-1'], current: { lessonId: 'transforms-demo-2', step: 2 } });
    const host = mount(h(LearnPage, {}));
    await settle();
    const transforms = host.querySelector('section#transforms')!;
    expect(rowFor(transforms, 'transforms-demo-1').className).toContain('is-complete');
    expect(rowFor(transforms, 'transforms-demo-1').getAttribute('aria-label')).toBe('Translate, Rotate, Scale, done');
    expect(rowFor(transforms, 'transforms-demo-2').getAttribute('aria-label')).toBe(
      'Matrix Representation, in progress, left at step 3 of 6',
    );
    expect(rowFor(transforms, 'transforms-demo-3').getAttribute('aria-label')).toBe('The Matrix Stack, not started, 4 steps');
    expect(transforms.querySelector('.learn-section__count')!.textContent).toBe('1 of 9 done');
    expect(host.querySelector('section#pipeline .learn-section__count')!.textContent).toBe('7 lessons');
    expect(host.querySelector('.learn__status')!.textContent).toBe(`1 of ${LESSON_CATALOG.length} lessons done`);
    expect(host.querySelector('.learn-next a.learn-row')!.getAttribute('href')).toBe('/app?lesson=transforms-demo-2');
  });

  it('says every lesson is done and marks every section in the index', async () => {
    store({ completed: LESSON_CATALOG.map((l) => l.id) });
    const host = mount(h(LearnPage, {}));
    await settle();
    expect(host.querySelector('.learn-next--done')!.textContent).toBe(LEARN_COPY.allDone);
    expect(host.querySelector('.learn-next a')).toBeNull();
    const index = [...host.querySelectorAll('.learn-index__link')];
    expect(index.every((a) => a.classList.contains('is-done'))).toBe(true);
    expect(index[0].getAttribute('aria-label')).toBe('Pipeline, complete');
  });
});

describe('BB-LPAGE-08: The prerendered page is a first visit, and hydration then shows progress', () => {
  it('ignores storage on the server and applies it after hydrating', async () => {
    store({ completed: ['pipeline-demo-1'] });
    const html = renderToString(h(LearnPage, {}));
    expect(html).toContain(`${LESSON_CATALOG.length} lessons in five sections`);
    expect(html).not.toContain('is-complete');
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);
    hosts.push(host);
    hydrate(h(LearnPage, {}), host);
    await settle();
    expect(host.querySelector('.learn__status')!.textContent).toBe(`1 of ${LESSON_CATALOG.length} lessons done`);
    expect(rowFor(host.querySelector('section#pipeline')!, 'pipeline-demo-1').className).toContain('is-complete');
    expect(host.querySelector('.learn-next a.learn-row')!.getAttribute('href')).toBe('/app?lesson=pipeline-demo-2');
  });
});

describe('BB-LPAGE-09: The page text follows the student-facing language rules', () => {
  it('contains none of the banned phrases', () => {
    const text = `${renderToString(h(LearnPage, {}))} ${JSON.stringify(LEARN_COPY)}`.toLowerCase();
    for (const phrase of BANNED) expect(text).not.toContain(phrase);
  });
});

describe('BB-LPAGE-10: Blocked or unreadable storage shows the first-visit page', () => {
  it('renders the first visit when reading throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const host = mount(h(LearnPage, {}));
    await settle();
    expect(host.querySelector('.learn__status')!.textContent).toBe(`${LESSON_CATALOG.length} lessons in five sections`);
    expect(host.querySelector('.learn-next a.learn-row')!.getAttribute('href')).toBe('/app?lesson=pipeline-demo-1');
  });

  it('renders the first visit when the stored JSON is unreadable', async () => {
    localStorage.setItem(PROGRESS_KEY, '{');
    const host = mount(h(LearnPage, {}));
    await settle();
    expect(host.querySelector('.learn__status')!.textContent).toBe(`${LESSON_CATALOG.length} lessons in five sections`);
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

describe('BB-LPAGE-11: The page never loads the editor store or the lesson files', () => {
  it('reaches the catalog but not core/store, the registry or any lesson file', () => {
    const seen = new Set<string>();
    const queue = [resolve('src/pages/learn/index.ts')];
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
  });
});
```

Append to `tests/black-box/site-shell.test.ts`, after BB-SITE-28:

```ts
describe('BB-SITE-29: /learn is a finished, linked, prerendered page', () => {
  it('has indexable metadata, a header link, a sitemap entry and a prerender entry', async () => {
    const meta = findRouteMeta('/learn');
    expect(meta.path).toBe('/learn');
    expect(meta.indexable).toBe(true);
    expect(meta.title).toBe('Learn — VAMS');
    expect(NAV_LINKS).toEqual([{ href: '/learn', label: 'Learn' }]);
    expect(buildSitemap(SITE)).toContain('<loc>https://example.test/learn</loc>');
    expect(readFileSync('vite.config.ts', 'utf8')).toMatch(/additionalPrerenderRoutes:\s*\[[^\]]*'\/learn'/);
    const result = await prerenderAt('/learn');
    expect(result.html).toContain('class="learn"');
    expect(result.html).toMatch(/<a[^>]*aria-current="page"[^>]*>Learn<\/a>/);
    expect(result.head.title).toBe('Learn — VAMS');
  });

  it('marks no header link as current on the home page', async () => {
    const result = await prerenderAt('/');
    expect(result.html).not.toContain('aria-current="page"');
  });
});
```

`SITE`, `buildSitemap`, `readFileSync`, `prerenderAt` and `NAV_LINKS` already exist in that file. Check the names before using them.

Append to `tests/black-box/offline-app.test.ts`:

```ts
describe('BB-PWA-08: The /learn document is cached under its clean URL', () => {
  it('maps learn/index.html to learn', async () => {
    expect(toRouteUrl('learn/index.html')).toBe('learn');
    const { manifest } = await routeDocumentsTransform([{ url: 'learn/index.html', revision: 'r', size: 1 }]);
    expect(manifest.map((entry) => entry.url)).toEqual(['learn/index.html', 'learn']);
  });
});
```

Append to `tests/black-box/home-stage.test.ts`:

```ts
describe('BB-HOME-22: The curriculum slide links to every lesson on /learn', () => {
  it('renders one /learn link inside the curriculum section', async () => {
    window.history.replaceState(null, '', '/');
    const { html } = await prerender({ url: '/' });
    const curriculum = html.slice(html.indexOf('id="curriculum"'), html.indexOf('id="under-the-hood"'));
    expect(curriculum).toContain('<a href="/learn">See every lesson</a>');
  });
});
```

`prerender` is already imported in `home-stage.test.ts` for BB-HOME-21. If it is not, import it from `@/app/prerender`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/learn-page.test.ts tests/black-box/site-shell.test.ts tests/black-box/offline-app.test.ts tests/black-box/home-stage.test.ts`
Expected: FAIL. `@/pages/learn` cannot be resolved, so the whole learn-page file fails, and BB-SITE-29 and BB-HOME-22 fail. BB-PWA-08 may already pass, since the transform is generic. That is expected; it pins the behaviour.

- [ ] **Step 3: Create the page copy**

Create `src/pages/learn/model/copy.ts`:

```ts
import type { CurriculumSection } from '@/core/store/types';

export const LEARN_COPY = {
  title: 'Learn',
  lede: 'The course follows the OpenGL pipeline in five sections. Demos walk through an idea step by step; exercises ask you to build it in the editor.',
  nextLabel: 'Next up',
  allDone: 'Every lesson is done.',
  demos: 'Demos',
  exercises: 'Exercises',
} as const;

/** The section's id on the page, and its index link's target. */
export const sectionAnchor = (section: CurriculumSection): string => section.toLowerCase();
```

- [ ] **Step 4: Create the components**

Create `src/pages/learn/ui/LessonRow.tsx`:

```tsx
import { Check } from 'lucide-react';
import { lessonHref, type LessonEntry } from '@/features/lesson-engine/model/catalog';
import type { LessonStatus } from '../model/learn-progress';

/** One lesson: the whole row opens it in the editor. */
export default function LessonRow({ lesson, status }: { lesson: LessonEntry; status: LessonStatus }) {
  return (
    <a className={`learn-row is-${status.kind}`} href={lessonHref(lesson.id)} aria-label={`${lesson.title}, ${status.spoken}`}>
      <span className="learn-row__mark" aria-hidden="true">
        {status.kind === 'complete' && <Check size={14} strokeWidth={2.5} />}
      </span>
      <span className="learn-row__title">{lesson.title}</span>
      <span className="learn-row__meta">{status.meta}</span>
    </a>
  );
}
```

Create `src/pages/learn/ui/LearnSection.tsx`:

```tsx
import { catalogFor, type CourseSection, type LessonEntry } from '@/features/lesson-engine/model/catalog';
import type { LessonProgress } from '@/features/lesson-engine/model/progress';
import { doneCount, lessonStatus } from '../model/learn-progress';
import { LEARN_COPY, sectionAnchor } from '../model/copy';
import LessonRow from './LessonRow';

/** One course section: what it teaches on the left, its lessons on the right. */
export default function LearnSection({ course, progress }: { course: CourseSection; progress: LessonProgress }) {
  const { demos, exercises } = catalogFor(course.section);
  const lessons = [...demos, ...exercises];
  const done = doneCount(progress, lessons);
  const id = sectionAnchor(course.section);

  const list = (title: string, items: LessonEntry[]) => (
    <div className="learn-section__group">
      <h3 className="learn-section__group-title">{title}</h3>
      <ul className="learn-section__list">
        {items.map((lesson) => (
          <li key={lesson.id}>
            <LessonRow lesson={lesson} status={lessonStatus(lesson, progress)} />
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <section id={id} className="learn-section" aria-labelledby={`${id}-title`}>
      <div className="learn-section__intro">
        <h2 id={`${id}-title`} className="learn-section__title">{course.section}</h2>
        <p className="learn-section__summary">{course.summary}</p>
        <ul className="learn-section__calls" aria-label={`Key calls in ${course.section}`}>
          {course.calls.map((call) => (
            <li key={call}>
              <code>{call}</code>
            </li>
          ))}
        </ul>
        <p className="learn-section__count">{done > 0 ? `${done} of ${lessons.length} done` : `${lessons.length} lessons`}</p>
      </div>
      <div className="learn-section__lessons">
        {list(LEARN_COPY.demos, demos)}
        {list(LEARN_COPY.exercises, exercises)}
      </div>
    </section>
  );
}
```

Create `src/pages/learn/ui/LearnPage.tsx`:

```tsx
import { Check } from 'lucide-react';
import SiteHeader from '@/widgets/site-header';
import SiteFooter from '@/widgets/site-footer';
import { COURSE, LESSON_CATALOG, catalogFor } from '@/features/lesson-engine/model/catalog';
import { useLessonProgress } from '@/features/lesson-engine/model/progress';
import { doneCount, lessonStatus, nextUp } from '../model/learn-progress';
import { LEARN_COPY, sectionAnchor } from '../model/copy';
import LearnSection from './LearnSection';
import LessonRow from './LessonRow';
import './learn.scss';

export default function LearnPage() {
  // Prerendered as a first visit; the student's progress is read once the page runs.
  const progress = useLessonProgress({ afterMount: true });
  const total = LESSON_CATALOG.length;
  const done = doneCount(progress);
  const next = nextUp(progress);

  return (
    <div className="site-page">
      <SiteHeader current="/learn" />
      <main id="main" className="learn">
        <div className="learn__intro">
          <h1 className="learn__title">{LEARN_COPY.title}</h1>
          <p className="learn__lede">{LEARN_COPY.lede}</p>
          {next ? (
            <div className="learn-next">
              <p className="learn-next__label">{LEARN_COPY.nextLabel}</p>
              <LessonRow lesson={next} status={lessonStatus(next, progress)} />
            </div>
          ) : (
            <p className="learn-next learn-next--done">{LEARN_COPY.allDone}</p>
          )}
          <p className="learn__status">{done > 0 ? `${done} of ${total} lessons done` : `${total} lessons in five sections`}</p>
        </div>
        <nav className="learn-index" aria-label="Sections">
          <ul className="learn-index__list">
            {COURSE.map(({ section }) => {
              const { demos, exercises } = catalogFor(section);
              const lessons = [...demos, ...exercises];
              const complete = doneCount(progress, lessons) === lessons.length;
              return (
                <li key={section}>
                  <a
                    className={complete ? 'learn-index__link is-done' : 'learn-index__link'}
                    href={`#${sectionAnchor(section)}`}
                    aria-label={complete ? `${section}, complete` : undefined}
                  >
                    <span className="learn-index__mark" aria-hidden="true">
                      {complete && <Check size={9} strokeWidth={3} />}
                    </span>
                    {section}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        {COURSE.map((course) => (
          <LearnSection key={course.section} course={course} progress={progress} />
        ))}
      </main>
      <SiteFooter />
    </div>
  );
}
```

Create `src/pages/learn/index.ts`:

```ts
export { default } from './ui/LearnPage';
```

- [ ] **Step 5: Style the page**

Create `src/pages/learn/ui/learn.scss`. Use only tokens from `src/shared/styles/_tokens.scss`, so both themes work.

```scss
/* The course map: an introduction, a section index, then one band per section. */
.learn {
  padding: var(--space-7) var(--site-gutter) var(--space-8);

  &__intro { max-width: 760px; }
  &__title {
    margin: 0 0 var(--space-3);
    font-family: var(--font-display);
    font-weight: 400;
    font-size: var(--text-2xl);
    line-height: var(--lh-2xl);
    letter-spacing: -0.01em;
  }
  &__lede {
    margin: 0 0 var(--space-5);
    max-width: 62ch;
    font-size: 1.125rem;
    line-height: 1.55;
    color: var(--ink-muted);
  }
  &__status {
    margin: var(--space-3) 0 0;
    font-size: var(--text-sm);
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
  }
}

.learn-next {
  max-width: 560px;
  margin: 0;
  padding: var(--space-2) var(--space-3) var(--space-1);
  border-radius: var(--radius-m);
  background: var(--accent-tint);

  &__label {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--ink-muted);
  }
  .learn-row { border-bottom: 0; padding-inline: 0; }
  &--done {
    padding: var(--space-3);
    font-weight: 600;
    color: var(--ink);
  }
}

.learn-index {
  margin: var(--space-6) 0 0;
  border-block: 1px solid var(--rule);

  &__list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-5);
    margin: 0;
    padding: var(--space-2) 0;
    list-style: none;
  }
  &__link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 32px;
    color: var(--ink);
    text-decoration: none;
    &:hover { text-decoration: underline; text-underline-offset: 3px; }
  }
  &__mark {
    display: inline-grid;
    place-items: center;
    width: 12px;
    height: 12px;
    border: 1.5px solid var(--ink-faint);
    border-radius: 50%;
    color: var(--paper);
  }
  &__link.is-done &__mark { background: var(--ink); border-color: var(--ink); }
}

.learn-section {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
  gap: var(--space-6);
  padding: var(--space-7) 0;
  border-bottom: 1px solid var(--rule);
  /* The sticky header must not cover a section reached from the index. */
  scroll-margin-top: 72px;

  &:last-of-type { border-bottom: 0; }
  &__title {
    margin: 0 0 var(--space-2);
    font-family: var(--font-display);
    font-weight: 400;
    font-size: var(--text-xl);
    line-height: var(--lh-xl);
  }
  &__summary { margin: 0 0 var(--space-4); font-size: var(--text-md); line-height: var(--lh-md); color: var(--ink-muted); }
  &__calls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin: 0 0 var(--space-4);
    padding: 0;
    list-style: none;
    code {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      padding: 2px 6px;
      border: 1px solid var(--rule);
      border-radius: var(--radius-s);
      background: var(--code-bg);
      color: var(--code-ink);
    }
  }
  &__count { margin: 0; font-size: var(--text-sm); color: var(--ink-faint); font-variant-numeric: tabular-nums; }
  &__group + &__group { margin-top: var(--space-5); }
  &__group-title { margin: 0 0 var(--space-1); font-size: var(--text-sm); font-weight: 600; color: var(--ink-muted); }
  &__list { margin: 0; padding: 0; list-style: none; }
}

.learn-row {
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  min-height: 44px;
  padding: var(--space-2);
  border-bottom: 1px solid var(--rule);
  color: var(--ink);
  text-decoration: none;

  &:hover { background: var(--paper-raised); }
  &:hover &__title { text-decoration: underline; text-underline-offset: 3px; }
  &__mark {
    display: grid;
    place-items: center;
    width: 12px;
    height: 12px;
    border: 1.5px solid var(--ink-faint);
    border-radius: 50%;
  }
  &.is-progress &__mark { background: var(--accent); border-color: var(--accent); }
  &.is-complete &__mark { border: 0; color: var(--ink); }
  &__title { font-size: var(--text-md); line-height: var(--lh-md); }
  &__meta { font-size: var(--text-sm); color: var(--ink-faint); font-variant-numeric: tabular-nums; white-space: nowrap; }
}

.learn-section__list li:last-child .learn-row { border-bottom: 0; }

@media (max-width: 900px) {
  .learn-section { grid-template-columns: minmax(0, 1fr); gap: var(--space-4); padding: var(--space-6) 0; }
}

@media (max-width: 640px) {
  .learn { padding-top: var(--space-6); }
  .learn-row { grid-template-columns: 14px minmax(0, 1fr); }
  .learn-row__meta { grid-column: 2; }
}
```

- [ ] **Step 6: Add the route, the nav link and the prerender entry**

`src/app/routes/route-meta.ts`: add this entry to `ROUTES`, after the `/` entry:

```ts
  {
    path: '/learn',
    title: 'Learn — VAMS',
    description:
      'The VAMS course map: five sections of short OpenGL 1.5 lessons, from the rendering pipeline to textures. Open any lesson in the editor.',
    indexable: true,
  },
```

`src/widgets/site-header/model/nav.ts`: set `export const NAV_LINKS: NavLink[] = [{ href: '/learn', label: 'Learn' }];`.

`src/widgets/site-header/ui/SiteHeader.tsx`: change the signature to `export default function SiteHeader({ current }: { current?: string } = {})`. Give each nav link `aria-current={link.href === current ? 'page' : undefined}`.

`src/widgets/site-header/ui/site-header.scss`: in the `@media (max-width: 640px)` block, replace `.site-header__nav { display: none; }` with `.site-header__nav { gap: var(--space-3); }`. The single Learn link then stays visible on phones.

`src/app/SiteApp.tsx`: add `import LearnPage from '@/pages/learn';` and `<Route path="/learn" component={LearnPage} />` after the `/` route.

`vite.config.ts`: change `additionalPrerenderRoutes: ['/404'],` to `additionalPrerenderRoutes: ['/404', '/learn'],`.

- [ ] **Step 7: Link the home curriculum slide to /learn**

`src/pages/home/model/content.ts`: add `more: { href: '/learn', label: 'See every lesson' },` to `CURRICULUM`, after `modes`.

`src/pages/home/ui/sections/CurriculumSection.tsx`: after the closing `</dl>`, add:

```tsx
      <p className="curriculum-more">
        <a href={CURRICULUM.more.href}>{CURRICULUM.more.label}</a>
      </p>
```

`src/pages/home/ui/sections/sections.scss`: after the `.mode-list` rules, add:

```scss
.curriculum-more {
  margin: var(--space-5) 0 0;
  a {
    color: var(--accent-text);
    font-weight: 600;
    text-underline-offset: 3px;
  }
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/learn-page.test.ts tests/black-box/site-shell.test.ts tests/black-box/offline-app.test.ts tests/black-box/home-stage.test.ts`
Expected: PASS. BB-SITE-18 still passes, because `/learn` is an indexable route. BB-HOME-20 (no eyebrows or separators) still passes.

- [ ] **Step 9: Check the page in a browser**

Run `npm run dev -- --port 5174 --strictPort` in the background and open `http://localhost:5174/learn`. Check each of the following:
- the light and dark themes, at 1280, 960 and 390 CSS px wide;
- no horizontal scroll at 390;
- the header shows Learn at 390;
- index links land below the sticky header;
- clicking a row opens that lesson in the editor;
- returning with the browser's Back button shows the page.

Stop the dev server by its PID: `netstat -ano | grep :5174`, then `taskkill //PID <pid> //F`.

- [ ] **Step 10: Run all checks**

Run: `npm run lint && npm run build && npm test`, then `git checkout -- tests/reports`.
Expected: all pass. `dist/learn/index.html` exists after the build.

- [ ] **Step 11: Commit**

```bash
git add src/pages/learn src/app/SiteApp.tsx src/app/routes/route-meta.ts src/widgets/site-header/model/nav.ts src/widgets/site-header/ui/SiteHeader.tsx src/widgets/site-header/ui/site-header.scss vite.config.ts src/pages/home/model/content.ts src/pages/home/ui/sections/CurriculumSection.tsx src/pages/home/ui/sections/sections.scss tests/black-box/learn-page.test.ts tests/black-box/site-shell.test.ts tests/black-box/offline-app.test.ts tests/black-box/home-stage.test.ts
git diff --staged --stat
git commit -m "feat(learn): the /learn course map, linked from the header and the curriculum slide"
```

---

### Task 4: Lesson links record the lesson they replace

**Files:**
- Modify: `src/pages/editor/model/editor-link.ts` (the `lesson` branch of `applyEditorLink`)
- Test: `tests/black-box/editor-links.test.ts`

**Interfaces:**
- Consumes: `recordLessonLeft(id: string, step: number)`, `readProgress()`, `PROGRESS_KEY` from `@/features/lesson-engine/model/progress`; `currentStepIndex` from the store.

- [ ] **Step 1: Write the failing test**

In `tests/black-box/editor-links.test.ts`, add the import `import { PROGRESS_KEY, readProgress } from '@/features/lesson-engine/model/progress';`. Then append:

```ts
describe('BB-LINK-14: A lesson link records the lesson it replaces as left mid-way', () => {
  afterEach(() => localStorage.removeItem(PROGRESS_KEY));
  it('saves the running lesson and its step before opening the linked one', async () => {
    await applyEditorLink({ kind: 'lesson', id: 'transforms-demo-1' }, noop);
    useVamsStore.setState({ currentStepIndex: 2 });
    await applyEditorLink({ kind: 'lesson', id: 'textures-demo-1' }, noop);
    expect(readProgress().current).toEqual({ lessonId: 'transforms-demo-1', step: 2 });
    const s = useVamsStore.getState();
    expect(s.activeLessonId).toBe('textures-demo-1');
    expect(s.activeSection).toBe('Textures');
    s.clearLessonState();
    s.setAppMode('Author');
  });

  it('records nothing when no lesson is running', async () => {
    await applyEditorLink({ kind: 'lesson', id: 'textures-demo-1' }, noop);
    expect(readProgress().current).toBeNull();
    const s = useVamsStore.getState();
    s.clearLessonState();
    s.setAppMode('Author');
  });
});
```

`noop` already exists in this file (BB-LINK-07 uses it).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/black-box/editor-links.test.ts`
Expected: BB-LINK-14's first case fails: `current` is `null`, but `{ lessonId: 'transforms-demo-1', step: 2 }` was expected.

- [ ] **Step 3: Record the replaced lesson**

In `src/pages/editor/model/editor-link.ts`, add `import { recordLessonLeft } from '@/features/lesson-engine/model/progress';`. Then replace this line in the `lesson` branch:

```ts
    if (useVamsStore.getState().activeLessonId) useVamsStore.getState().clearLessonState();
```

with:

```ts
    const running = useVamsStore.getState();
    if (running.activeLessonId) {
      // As when starting a lesson from Learn, the lesson being replaced is recorded as left mid-way.
      recordLessonLeft(running.activeLessonId, running.currentStepIndex);
      running.clearLessonState();
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/black-box/editor-links.test.ts tests/black-box/learn-drawer.test.ts`
Expected: PASS.

- [ ] **Step 5: Run all checks**

Run: `npm run lint && npm run build && npm test`, then `git checkout -- tests/reports`.
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/editor/model/editor-link.ts tests/black-box/editor-links.test.ts
git diff --staged --stat
git commit -m "fix(editor): a lesson link records the lesson it replaces as in progress"
```

---

### Task 5: Visual checks and documentation

**Files:**
- Create: `tests/visual/learn.spec.ts`
- Modify: `tests/README.md` (suite map)
- Modify: `docs/specs/2026-10-04-website-overhaul-roadmap.md` (item 10 status, divergence 12, the "may also be crossed" list)

- [ ] **Step 1: Write the visual suite**

Create `tests/visual/learn.spec.ts`:

```ts
/**
 * VISUAL TEST SUITE — VIS-LEARN
 * Screenshot checks for the /learn course map. Not part of `npm test`.
 */
import { test, expect, type Page } from '@playwright/test';

type Theme = 'light' | 'dark';

const HIDE_TIMED_NOTICES = '.update-notice, [data-sonner-toaster] { display: none !important; }';
const SOME_PROGRESS = JSON.stringify({
  version: 1,
  completed: ['pipeline-demo-1', 'pipeline-demo-2', 'transforms-demo-1'],
  current: { lessonId: 'transforms-demo-2', step: 2 },
});

async function open(page: Page, theme: Theme, progress: string | null) {
  await page.addInitScript(
    ({ t, css, p }) => {
      window.localStorage.setItem('vams-theme', t);
      if (p) window.localStorage.setItem('vams-lesson-progress', p);
      const inject = () => {
        const style = document.createElement('style');
        style.textContent = css;
        (document.head ?? document.documentElement).appendChild(style);
      };
      if (document.documentElement) inject();
      else document.addEventListener('DOMContentLoaded', inject, { once: true });
    },
    { t: theme, css: HIDE_TIMED_NOTICES, p: progress },
  );
  await page.goto('/learn');
  await page.waitForSelector('.learn');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

test('VIS-LEARN-01: First visit, light, 1280', async ({ page }) => {
  await open(page, 'light', null);
  await expect(page).toHaveScreenshot('learn-first-light-1280.png', { fullPage: true });
});

test('VIS-LEARN-02: Some progress, dark, 1280', async ({ page }) => {
  await open(page, 'dark', SOME_PROGRESS);
  await expect(page.locator('.learn__status')).toHaveText('3 of 45 lessons done');
  await expect(page).toHaveScreenshot('learn-progress-dark-1280.png', { fullPage: true });
});

test('VIS-LEARN-03: Some progress, light, 390, no horizontal scroll and the Learn link visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 'light', SOME_PROGRESS);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.locator('.site-header__link', { hasText: 'Learn' })).toBeVisible();
  await expect(page).toHaveScreenshot('learn-progress-light-390.png', { fullPage: true });
});

test('VIS-LEARN-04: An index link brings its section below the sticky header', async ({ page }) => {
  await open(page, 'light', null);
  await page.click('.learn-index__link[href="#textures"]');
  const top = await page.evaluate(() => document.querySelector('#textures-title')!.getBoundingClientRect().top);
  const headerBottom = await page.evaluate(() => document.querySelector('.site-header')!.getBoundingClientRect().bottom);
  expect(top).toBeGreaterThanOrEqual(headerBottom);
});
```

- [ ] **Step 2: Run the visual suite and create the baselines**

Run: `npx playwright test tests/visual/learn.spec.ts --update-snapshots`, then `npx playwright test tests/visual/learn.spec.ts`.
Expected: 4 passed on the second run. Look at the screenshots in `tests/visual/baseline.local/`. They must show:
- the five sections in pipeline order;
- the in-progress dot as the only cobalt besides the Next up tint;
- readable meta text in both themes.

Baselines stay local; `baseline.local` is ignored.

- [ ] **Step 3: Rerun the existing visual suites**

Run: `npx playwright test tests/visual/home.spec.ts tests/visual/editor.spec.ts`
Expected: VIS-HOME-01 passes. The editor screenshots are unchanged, because the editor's layout did not change. If an editor screenshot differs, inspect it before updating anything.

- [ ] **Step 4: Update the documentation**

`tests/README.md`:
- In the black-box tree, after the `editor-links.test.ts` entry, add: `│   ├── learn-page.test.ts                (BB-LPAGE-*: the course catalog,` with a continuation line `│   │                                        progress after hydration, /learn)`.
- In the visual section, add `learn.spec.ts (VIS-LEARN-*: the /learn course map)` beside `editor.spec.ts`, in the same format.

`docs/specs/2026-10-04-website-overhaul-roadmap.md`:
- Item 10 in "Should": append `Complete (2026-10-10): [spec](2026-10-10-learn-page-design.md), [plan](../plans/2026-10-10-learn-page.md)`.
- Divergences: add item 12:
  `12. The use-case and activity diagrams show lessons reached only inside the editor. The site now has a /learn course map, with progress, that opens any lesson in the editor.`
- Delete the line `- The use-case and activity diagrams.` from the "may also be crossed" list.

- [ ] **Step 5: Run all checks**

Run: `npm run lint && npm run build && npm test`, then `git checkout -- tests/reports`.
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add tests/visual/learn.spec.ts tests/README.md docs/specs/2026-10-04-website-overhaul-roadmap.md
git diff --staged --stat
git commit -m "test(learn): screenshot checks for /learn; record the page in the roadmap"
```
