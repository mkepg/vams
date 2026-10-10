import type { Lesson } from '@/core/types/lesson';
import type { CurriculumSection } from '@/core/store/types';
import { LESSON_REGISTRY } from './lesson-registry';

export { COURSE } from './catalog';

/** The full lessons of one section, for the editor's Learn drawer. Site pages use catalogFor instead. */
export function lessonsFor(section: CurriculumSection): { demos: Lesson[]; exercises: Lesson[] } {
  const all = Object.values(LESSON_REGISTRY).filter((lesson) => lesson.section === section);
  return { demos: all.filter((l) => l.type === 'demo'), exercises: all.filter((l) => l.type === 'exercise') };
}
