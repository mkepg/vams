import type { CurriculumSection, VamsState } from '@/core/store/types';
import { GROUP_SECTION } from './groups';
import { resolveFocus, sectionForPlace } from './focus-map';

export type ContextState = Pick<VamsState, 'appMode' | 'lessonFocusPanel' | 'selectedObjectId' | 'lastOpenedGroup' | 'activeSection'>;

/**
 * The section the student is working in right now: a group they opened by hand (in a lesson, during
 * this step), else the step's focus, else the lesson's or course section.
 */
export function contextSection(s: ContextState): CurriculumSection {
  if (s.lastOpenedGroup) return GROUP_SECTION[s.lastOpenedGroup];
  if (s.appMode === 'Lesson') {
    const place = resolveFocus(s.lessonFocusPanel, s.selectedObjectId !== null);
    return place ? sectionForPlace(place) : s.activeSection;
  }
  return s.activeSection;
}
