import { useEffect } from 'react';
import { useVamsStore } from '@/core/store';
import { recordLessonLeft } from './progress';

/** Record the running lesson, if any, as left at its current step. */
export function recordRunningLesson(): void {
  const { appMode, activeLessonId, currentStepIndex } = useVamsStore.getState();
  if (appMode === 'Lesson' && activeLessonId) recordLessonLeft(activeLessonId, currentStepIndex);
}

/**
 * The editor can be left mid-lesson by navigating to another page (it unmounts) or by closing or
 * reloading the tab (pagehide). Either way the lesson then shows as in progress on /learn.
 */
export function useRecordLessonOnLeave(): void {
  useEffect(() => {
    window.addEventListener('pagehide', recordRunningLesson);
    return () => {
      window.removeEventListener('pagehide', recordRunningLesson);
      recordRunningLesson();
    };
  }, []);
}
