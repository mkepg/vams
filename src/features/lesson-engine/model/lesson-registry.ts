import type { Lesson } from '@/core/types/lesson';
import { PIPELINE_LESSONS }   from './pipeline-lessons';
import { PRIMITIVES_LESSONS } from './primitives-lessons';
import { BUFFERS_LESSONS }    from './buffers-lessons';
import { TRANSFORMS_LESSONS } from './transforms-lessons';
import { TEXTURES_LESSONS }   from './textures-lessons';

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

export const getLessonById = (id: string): Lesson | undefined =>
  LESSON_REGISTRY[id];

export const getLessonsForSection = (section: string): Lesson[] =>
  Object.values(LESSON_REGISTRY).filter((l) => l.section === section);
