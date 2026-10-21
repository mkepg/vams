import { LESSON_CATALOG, courseOrder, type LessonEntry } from '@/features/lesson-engine/model/catalog';
import type { LessonProgress } from '@/features/lesson-engine/model/progress';

export interface LessonStatus {
  kind: 'new' | 'progress' | 'skipped' | 'complete';
  /** Shown beside the title. */
  meta: string;
  /** Follows the title in the link's accessible name. */
  spoken: string;
}

const stepCount = (n: number) => `${n} ${n === 1 ? 'step' : 'steps'}`;

/** Done wins over in progress, which wins over skipped: a finished lesson opened and left again still counts as done. */
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
  if (progress.skipped.includes(lesson.id)) return { kind: 'skipped', meta: 'Skipped', spoken: 'skipped' };
  return { kind: 'new', meta: stepCount(lesson.steps), spoken: `not started, ${stepCount(lesson.steps)}` };
}

/**
 * The lesson the student left mid-way, else the first lesson neither done nor skipped, else the first
 * skipped lesson; null when every lesson is done.
 */
export function nextUp(progress: LessonProgress): LessonEntry | null {
  const left = progress.current ? LESSON_CATALOG.find((l) => l.id === progress.current?.lessonId) : undefined;
  if (left && !progress.completed.includes(left.id)) return left;
  const open = courseOrder().filter((l) => !progress.completed.includes(l.id));
  return open.find((l) => !progress.skipped.includes(l.id)) ?? open[0] ?? null;
}

export function doneCount(progress: LessonProgress, lessons: readonly LessonEntry[] = LESSON_CATALOG): number {
  return lessons.filter((l) => progress.completed.includes(l.id)).length;
}
