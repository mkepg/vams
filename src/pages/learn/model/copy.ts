import type { CurriculumSection } from '@/core/store/types';

export const LEARN_COPY = {
  title: 'Learn',
  lede: 'The course follows the OpenGL pipeline in five sections. Demos walk through an idea step by step; exercises ask you to build it in the editor.',
  nextLabel: 'Next up',
  allDone: 'Every lesson is done.',
  demos: 'Demos',
  exercises: 'Exercises',
} as const;

/** The section's id on the page, and its index link's target. */
export const sectionAnchor = (section: CurriculumSection): string => section.toLowerCase();
