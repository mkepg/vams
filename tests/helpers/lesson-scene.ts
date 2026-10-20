import { useVamsStore } from '@/core/store';
import type { Lesson } from '@/core/types/lesson';
import { resetLessonScene } from '@/features/lesson-engine/model/useLessonRunner';

/**
 * The scene a student reaches on step `index` once they have done it: the runner's reset, then every
 * earlier step's action and its solve (the student did those steps), then this step's action and its
 * solve.
 */
export function solvedStepScene(lesson: Lesson, index: number): void {
  const store = useVamsStore.getState();
  store.startBatch();
  try {
    resetLessonScene();
    for (let i = 0; i <= index; i++) {
      const step = lesson.steps[i];
      step.action?.(useVamsStore.getState());
      step.solve?.(useVamsStore.getState());
    }
  } finally {
    useVamsStore.getState().endBatch();
  }
}
