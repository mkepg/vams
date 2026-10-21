import { useVamsStore } from '@/core/store';
import type { Lesson } from '@/core/types/lesson';
import { replayStepsBefore, resetLessonScene } from '@/features/lesson-engine/model/useLessonRunner';

/**
 * The scene a student reaches on step `index` once they have done it: the runner's reset and its
 * replay of the earlier steps (each action, then its solve), then this step's action and its solve.
 */
export function solvedStepScene(lesson: Lesson, index: number): void {
  const store = useVamsStore.getState();
  store.startBatch();
  try {
    resetLessonScene();
    replayStepsBefore(lesson, index);
    const step = lesson.steps[index];
    step.action?.(useVamsStore.getState());
    step.solve?.(useVamsStore.getState());
  } finally {
    useVamsStore.getState().endBatch();
  }
}
