import type { CurriculumSection } from '@/core/store/types';

/*
 * The course without the lessons' code. Lesson files import the editor store, so site pages read
 * this instead. A test keeps it equal to the lesson registry: adding, renaming or changing the
 * steps of a lesson means updating its entry here in the same change.
 */

export interface CourseSection {
  section: CurriculumSection;
  /** One line, shown in the editor's Learn drawer. */
  description: string;
  /** One sentence, shown on the home page and on /learn. */
  summary: string;
  /** Three calls the section teaches. */
  calls: readonly string[];
}

export interface LessonEntry {
  id: string;
  title: string;
  type: 'demo' | 'exercise';
  section: CurriculumSection;
  /** The number of steps. */
  steps: number;
}

/** The course map: the five sections in pipeline order. */
export const COURSE: readonly CourseSection[] = [
  {
    section: 'Pipeline',
    description: 'The rendering pipeline, NDC, and rasterization',
    summary: 'The rendering pipeline, rasterisation, normalised device coordinates and the GLUT program structure.',
    calls: ['glutInit', 'glutDisplayFunc', 'glutMainLoop'],
  },
  {
    section: 'Primitives',
    description: 'Points, lines, triangles, color, and line style',
    summary: 'glBegin and glEnd primitives, colour, line styles, bitmap text and GLUT callbacks.',
    calls: ['glBegin', 'glColor3f', 'glLineStipple'],
  },
  {
    section: 'Buffers',
    description: 'Vertex arrays, VBOs, and memory layout',
    summary: 'Immediate mode, vertex arrays and VBOs, side by side.',
    calls: ['glVertexPointer', 'glBufferData', 'glDrawElements'],
  },
  {
    section: 'Transforms',
    description: 'Translate, rotate, scale, and the matrix stack',
    summary: 'Translate, rotate and scale, the matrix stack and glOrtho.',
    calls: ['glTranslatef', 'glRotatef', 'glPushMatrix'],
  },
  {
    section: 'Textures',
    description: 'Images, UV mapping, filtering, and wrapping',
    summary: 'Texture objects, UV coordinates, filtering and wrapping.',
    calls: ['glBindTexture', 'glTexParameteri', 'glTexCoord2f'],
  },
];

/** Every lesson, in registry order. */
export const LESSON_CATALOG: readonly LessonEntry[] = [
  { id: 'pipeline-demo-1', title: 'From Vertex to Pixel', type: 'demo', section: 'Pipeline', steps: 11 },
  { id: 'pipeline-demo-2', title: 'Vector vs Raster', type: 'demo', section: 'Pipeline', steps: 8 },
  { id: 'pipeline-demo-3', title: 'Normalised Device Coordinates', type: 'demo', section: 'Pipeline', steps: 8 },
  { id: 'pipeline-demo-4', title: 'Anatomy of a GLUT Program', type: 'demo', section: 'Pipeline', steps: 13 },
  { id: 'pipeline-exercise-1', title: 'Place the Point', type: 'exercise', section: 'Pipeline', steps: 6 },
  { id: 'pipeline-exercise-4', title: 'Paint the Background', type: 'exercise', section: 'Pipeline', steps: 6 },
  { id: 'pipeline-exercise-2', title: 'Which Stage?', type: 'exercise', section: 'Pipeline', steps: 9 },
  { id: 'pipeline-exercise-3', title: 'Order the Pipeline', type: 'exercise', section: 'Pipeline', steps: 3 },
  { id: 'pipeline-exercise-5', title: 'Write main()', type: 'exercise', section: 'Pipeline', steps: 8 },
  { id: 'poc-demo-1', title: 'Your First Triangle', type: 'demo', section: 'Primitives', steps: 7 },
  { id: 'primitives-demo-1', title: 'The Geometry Alphabet: Points to Polygons', type: 'demo', section: 'Primitives', steps: 11 },
  { id: 'primitives-demo-6', title: 'Strips and Fans', type: 'demo', section: 'Primitives', steps: 8 },
  { id: 'primitives-demo-2', title: 'Painting with Barycentrics', type: 'demo', section: 'Primitives', steps: 10 },
  { id: 'primitives-demo-3', title: 'Styling Lines (Width & Stipple)', type: 'demo', section: 'Primitives', steps: 7 },
  { id: 'primitives-demo-4', title: 'Rendering Text in OpenGL', type: 'demo', section: 'Primitives', steps: 7 },
  { id: 'primitives-demo-5', title: 'Hooking Up Callbacks', type: 'demo', section: 'Primitives', steps: 10 },
  { id: 'primitives-demo-7', title: 'When the Window Changes Size', type: 'demo', section: 'Primitives', steps: 7 },
  { id: 'primitives-exercise-1', title: 'Quad Assembly', type: 'exercise', section: 'Primitives', steps: 6 },
  { id: 'primitives-exercise-2', title: 'Neon Gradient', type: 'exercise', section: 'Primitives', steps: 6 },
  { id: 'primitives-exercise-3', title: 'Dotted Outline', type: 'exercise', section: 'Primitives', steps: 6 },
  { id: 'primitives-exercise-4', title: 'Hello World!', type: 'exercise', section: 'Primitives', steps: 5 },
  { id: 'primitives-exercise-5', title: 'Hooking up the Mouse', type: 'exercise', section: 'Primitives', steps: 6 },
  { id: 'primitives-exercise-6', title: 'Drive with the Arrow Keys', type: 'exercise', section: 'Primitives', steps: 6 },
  { id: 'primitives-exercise-7', title: 'Draw It Yourself', type: 'exercise', section: 'Primitives', steps: 7 },
  { id: 'buffers-demo-1', title: 'Immediate Mode: Every Frame', type: 'demo', section: 'Buffers', steps: 6 },
  { id: 'buffers-demo-2', title: 'Converting to Vertex Arrays', type: 'demo', section: 'Buffers', steps: 8 },
  { id: 'buffers-demo-3', title: 'VBOs: Send Once', type: 'demo', section: 'Buffers', steps: 9 },
  { id: 'buffers-demo-4', title: 'Buffer Usage Hints', type: 'demo', section: 'Buffers', steps: 8 },
  { id: 'buffers-demo-5', title: 'Updating in Place: glMapBuffer', type: 'demo', section: 'Buffers', steps: 12 },
  { id: 'buffers-exercise-1', title: 'Switch to VBO', type: 'exercise', section: 'Buffers', steps: 5 },
  { id: 'buffers-exercise-2', title: 'Use Static for Unchanging Data', type: 'exercise', section: 'Buffers', steps: 5 },
  { id: 'buffers-exercise-3', title: 'Reduce Memory with Indexed Drawing', type: 'exercise', section: 'Buffers', steps: 7 },
  { id: 'buffers-exercise-4', title: 'Pick the Right Usage Hint', type: 'exercise', section: 'Buffers', steps: 5 },
  { id: 'buffers-exercise-5', title: 'Build a VBO by Hand', type: 'exercise', section: 'Buffers', steps: 8 },
  { id: 'transforms-demo-1', title: 'Translate, Rotate, Scale', type: 'demo', section: 'Transforms', steps: 10 },
  { id: 'transforms-demo-2', title: 'Matrix Representation', type: 'demo', section: 'Transforms', steps: 9 },
  { id: 'transforms-demo-3', title: 'The Matrix Stack', type: 'demo', section: 'Transforms', steps: 7 },
  { id: 'transforms-demo-5', title: 'Spin or Orbit: Order Matters', type: 'demo', section: 'Transforms', steps: 7 },
  { id: 'transforms-demo-4', title: 'glOrtho: Changing the View', type: 'demo', section: 'Transforms', steps: 8 },
  { id: 'transforms-anim-1', title: 'Animation: Transformation Over Time', type: 'demo', section: 'Transforms', steps: 7 },
  { id: 'transforms-exercise-1', title: 'Translate to Position', type: 'exercise', section: 'Transforms', steps: 5 },
  { id: 'transforms-exercise-2', title: 'Rotate to Angle', type: 'exercise', section: 'Transforms', steps: 5 },
  { id: 'transforms-exercise-3', title: 'Build a Hierarchy', type: 'exercise', section: 'Transforms', steps: 6 },
  { id: 'transforms-exercise-4', title: 'Set the Viewport Range', type: 'exercise', section: 'Transforms', steps: 5 },
  { id: 'transforms-exercise-5', title: 'Make It Orbit', type: 'exercise', section: 'Transforms', steps: 5 },
  { id: 'transforms-exercise-6', title: 'Write the Transform Calls', type: 'exercise', section: 'Transforms', steps: 9 },
  { id: 'textures-demo-1', title: 'The Foundation of Textures', type: 'demo', section: 'Textures', steps: 10 },
  { id: 'textures-demo-6', title: 'Mapping with UVs', type: 'demo', section: 'Textures', steps: 7 },
  { id: 'textures-demo-2', title: 'Unlocking the Texture Atlas', type: 'demo', section: 'Textures', steps: 7 },
  { id: 'textures-demo-3', title: 'The Pixel Art Problem', type: 'demo', section: 'Textures', steps: 7 },
  { id: 'textures-demo-4', title: 'Pushing Boundaries (Wrapping)', type: 'demo', section: 'Textures', steps: 8 },
  { id: 'textures-demo-5', title: 'Texture on a Triangle', type: 'demo', section: 'Textures', steps: 5 },
  { id: 'textures-demo-7', title: 'Textures from Arrays', type: 'demo', section: 'Textures', steps: 7 },
  { id: 'textures-exercise-1', title: 'First Coat of Paint', type: 'exercise', section: 'Textures', steps: 5 },
  { id: 'textures-exercise-2', title: 'Sprite Extraction', type: 'exercise', section: 'Textures', steps: 5 },
  { id: 'textures-exercise-3', title: 'Retro Crispness', type: 'exercise', section: 'Textures', steps: 5 },
  { id: 'textures-exercise-4', title: 'The Endless Floor', type: 'exercise', section: 'Textures', steps: 6 },
  { id: 'textures-exercise-5', title: 'Clamp the Edges', type: 'exercise', section: 'Textures', steps: 5 },
  { id: 'textures-exercise-6', title: 'Write the Texture Calls', type: 'exercise', section: 'Textures', steps: 10 },
];

export function catalogFor(section: CurriculumSection): { demos: LessonEntry[]; exercises: LessonEntry[] } {
  const all = LESSON_CATALOG.filter((lesson) => lesson.section === section);
  return { demos: all.filter((l) => l.type === 'demo'), exercises: all.filter((l) => l.type === 'exercise') };
}

/** An array lookup, so prototype keys such as "toString" never count as lessons. */
export function isCatalogLesson(id: unknown): id is string {
  return typeof id === 'string' && LESSON_CATALOG.some((lesson) => lesson.id === id);
}

/** The editor link that opens a lesson. */
export function lessonHref(id: string): string {
  return `/app?lesson=${encodeURIComponent(id)}`;
}

/** Every lesson in course order: the sections in pipeline order, each section's demos before its exercises. */
export function courseOrder(): LessonEntry[] {
  return COURSE.flatMap(({ section }) => {
    const { demos, exercises } = catalogFor(section);
    return [...demos, ...exercises];
  });
}

/** The lesson after `id` in course order, when it is in the same section; null at a section's end or for an unknown id. */
export function nextInCourse(id: string): LessonEntry | null {
  const order = courseOrder();
  const at = order.findIndex((lesson) => lesson.id === id);
  if (at < 0) return null;
  const next = order[at + 1];
  return next && next.section === order[at].section ? next : null;
}

/** The lesson is the last of its section in course order. */
export function isSectionEnd(id: string): boolean {
  return isCatalogLesson(id) && nextInCourse(id) === null;
}

/**
 * The first lesson in course order that is neither done nor skipped; once none is left, the first skipped
 * lesson; once every lesson is done, the course's first lesson.
 */
export function firstLessonToStudy(completed: readonly string[], skipped: readonly string[] = []): string {
  const order = courseOrder();
  const open = order.find((lesson) => !completed.includes(lesson.id) && !skipped.includes(lesson.id));
  const left = order.find((lesson) => !completed.includes(lesson.id));
  return (open ?? left ?? order[0]).id;
}
