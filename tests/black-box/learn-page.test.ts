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
