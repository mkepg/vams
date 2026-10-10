/**
 * BLACK-BOX TEST SUITE — BB-LPAGE
 * The /learn page: the store-free course catalog, progress on a prerendered page, and the page itself.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { LESSON_REGISTRY } from '@/features/lesson-engine/model/lesson-registry';
import { COURSE, LESSON_CATALOG, catalogFor, isCatalogLesson, lessonHref } from '@/features/lesson-engine/model/catalog';
import { PROGRESS_KEY, useLessonProgress, type LessonProgress } from '@/features/lesson-engine/model/progress';
import { doneCount, lessonStatus, nextUp } from '@/pages/learn/model/learn-progress';

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
