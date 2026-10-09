import type { CurriculumSection, VamsState } from '@/core/store/types';
import { GROUP_SECTION } from './groups';
import { resolveFocus, sectionForPlace } from './focus-map';

export type ContextState = Pick<VamsState, 'appMode' | 'lessonFocusPanel' | 'selectedObjectId' | 'lastOpenedGroup' | 'activeSection'>;

/**
 * The section the student is working in right now. In a lesson: the step's focus, else the
 * lesson's section. Outside one: the last opened group, else the course section.
 */
export function contextSection(s: ContextState): CurriculumSection {
  if (s.appMode === 'Lesson') {
    const place = resolveFocus(s.lessonFocusPanel, s.selectedObjectId !== null);
    return place ? sectionForPlace(place) : s.activeSection;
  }
  if (s.lastOpenedGroup) return GROUP_SECTION[s.lastOpenedGroup];
  return s.activeSection;
}

/** A tab the student picked by hand wins until the next lesson step or opened group clears it. */
export function mathTabFor(s: ContextState & Pick<VamsState, 'mathTabOverride'>): CurriculumSection {
  return s.mathTabOverride ?? contextSection(s);
}
