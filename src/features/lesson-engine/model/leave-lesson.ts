import { useVamsStore } from '@/core/store';
import { recordLessonLeft } from './progress';

/**
 * End a running lesson as the student leaving it mid-way: record where they stopped and clear the
 * lesson state, which restores the scene the lesson backed up. Does nothing when no lesson runs.
 */
export function leaveRunningLesson(): void {
  const running = useVamsStore.getState();
  if (!running.activeLessonId) return;
  recordLessonLeft(running.activeLessonId, running.currentStepIndex);
  running.clearLessonState();
}
