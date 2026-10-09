import { useVamsStore } from '@/core/store';
import { confirm } from '@/shared/ui/confirm-dialog/confirm-store';
import { getLessonById } from './lesson-registry';
import { recordLessonLeft } from './progress';

/**
 * Start a lesson in its section. If another lesson is running, the student confirms leaving it
 * first; cancelling changes nothing. Resolves to whether the lesson started.
 */
export async function startLesson(id: string): Promise<boolean> {
  const lesson = getLessonById(id);
  if (!lesson) return false;
  const running = useVamsStore.getState();
  if (running.appMode === 'Lesson' && running.activeLessonId) {
    if (running.activeLessonId === id) return true;
    const leave = await confirm({
      title: 'Leave this lesson?',
      message: 'Your place in it is kept in Learn. Your own scene comes back when you finish the next one.',
      confirmLabel: 'Leave lesson',
    });
    if (!leave) return false;
    const now = useVamsStore.getState();
    if (now.activeLessonId) recordLessonLeft(now.activeLessonId, now.currentStepIndex);
    now.clearLessonState();
  }
  const s = useVamsStore.getState();
  s.setActiveSection(lesson.section);
  s.setActiveLesson(lesson.id);
  s.setAppMode('Lesson');
  return true;
}
