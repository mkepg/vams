import type { Lesson } from '@/core/types/lesson';
import { PIPELINE_LESSONS }   from './pipeline-lessons';
import { PRIMITIVES_LESSONS } from './primitives-lessons';
import { BUFFERS_LESSONS }    from './buffers-lessons';
import { TRANSFORMS_LESSONS } from './transforms-lessons';
import { TEXTURES_LESSONS }   from './textures-lessons';
import { SAMPLE_LESSONS }     from './sample-lessons';

/**
 * Master lesson registry. Keys are lesson IDs.
 * useLessonRunner looks lessons up by ID; the Learn drawer iterates via Object.values.
 */
export const LESSON_REGISTRY: Record<string, Lesson> = {
  ...PIPELINE_LESSONS,
  ...PRIMITIVES_LESSONS,
  ...BUFFERS_LESSONS,
  ...TRANSFORMS_LESSONS,
  ...TEXTURES_LESSONS,
};

/** A course lesson, or a sample lesson when the build includes them (VITE_LESSON_SAMPLES=1). */
export const getLessonById = (id: string): Lesson | undefined =>
  LESSON_REGISTRY[id] ?? (import.meta.env.VITE_LESSON_SAMPLES === '1' ? SAMPLE_LESSONS[id] : undefined);

export const getLessonsForSection = (section: string): Lesson[] =>
  Object.values(LESSON_REGISTRY).filter((l) => l.section === section);
