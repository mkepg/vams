/**
 * BLACK-BOX TEST SUITE — BB-LPAGE
 * The /learn page: the store-free course catalog, progress on a prerendered page, and the page itself.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { h, hydrate, render, type VNode } from 'preact';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { renderToString } from 'preact-render-to-string';
import { LESSON_REGISTRY } from '@/features/lesson-engine/model/lesson-registry';
import { COURSE, LESSON_CATALOG, catalogFor, isCatalogLesson, lessonHref } from '@/features/lesson-engine/model/catalog';
import { PROGRESS_KEY, useLessonProgress, type LessonProgress } from '@/features/lesson-engine/model/progress';
import { doneCount, lessonStatus, nextUp } from '@/pages/learn/model/learn-progress';
import LearnPage from '@/pages/learn';
import { LEARN_COPY } from '@/pages/learn/model/copy';

const SECTIONS = ['Pipeline', 'Primitives', 'Buffers', 'Transforms', 'Textures'];

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
