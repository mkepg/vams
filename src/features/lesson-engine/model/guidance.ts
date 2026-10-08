import type { Lesson } from '@/core/types/lesson';
import { LESSON_REGISTRY } from './lesson-registry';

/**
 * Guidance fading through a section: demos focus tightly, exercises only outline the step's
 * control, and the section's last exercise gives no focus at all.
 */
export type FocusStyle = 'tight' | 'outline' | 'none';

export function focusStyleFor(
  lesson: Pick<Lesson, 'id' | 'type' | 'section'>,
  registry: Record<string, Lesson> = LESSON_REGISTRY,
): FocusStyle {
  if (lesson.type === 'demo') return 'tight';
  const exercises = Object.values(registry).filter((l) => l.section === lesson.section && l.type === 'exercise');
  return exercises[exercises.length - 1]?.id === lesson.id ? 'none' : 'outline';
}
