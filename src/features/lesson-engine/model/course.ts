import type { Lesson } from '@/core/types/lesson';
import type { CurriculumSection } from '@/core/store/types';
import { LESSON_REGISTRY } from './lesson-registry';

/** The course map: the five sections in pipeline order. The /learn page reuses this. */
export const COURSE: readonly { section: CurriculumSection; description: string }[] = [
  { section: 'Pipeline', description: 'The rendering pipeline, NDC, and rasterization' },
  { section: 'Primitives', description: 'Points, lines, triangles, color, and line style' },
  { section: 'Buffers', description: 'Vertex arrays, VBOs, and memory layout' },
  { section: 'Transforms', description: 'Translate, rotate, scale, and the matrix stack' },
  { section: 'Textures', description: 'Images, UV mapping, filtering, and wrapping' },
];

export function lessonsFor(section: CurriculumSection): { demos: Lesson[]; exercises: Lesson[] } {
  const all = Object.values(LESSON_REGISTRY).filter((lesson) => lesson.section === section);
  return { demos: all.filter((l) => l.type === 'demo'), exercises: all.filter((l) => l.type === 'exercise') };
}
