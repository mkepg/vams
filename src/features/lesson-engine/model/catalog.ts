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
    summary: 'The rendering pipeline, rasterization, normalized device coordinates and the GLUT program structure.',
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
  { id: 'pipeline-demo-1', title: 'From Vertex to Pixel', type: 'demo', section: 'Pipeline', steps: 9 },
  { id: 'pipeline-demo-2', title: 'Vector vs Raster', type: 'demo', section: 'Pipeline', steps: 4 },
  { id: 'pipeline-demo-3', title: 'Normalized Device Coordinates', type: 'demo', section: 'Pipeline', steps: 4 },
  { id: 'pipeline-demo-4', title: 'Anatomy of a GLUT Program', type: 'demo', section: 'Pipeline', steps: 6 },
  { id: 'pipeline-exercise-1', title: 'Place the Point', type: 'exercise', section: 'Pipeline', steps: 3 },
  { id: 'pipeline-exercise-2', title: 'Which Stage?', type: 'exercise', section: 'Pipeline', steps: 9 },
  { id: 'pipeline-exercise-3', title: 'Order the Pipeline', type: 'exercise', section: 'Pipeline', steps: 2 },
  { id: 'poc-demo-1', title: 'Proof of Concept: Drawing a Triangle', type: 'demo', section: 'Primitives', steps: 4 },
  { id: 'primitives-demo-1', title: 'The Geometry Alphabet: Points to Polygons', type: 'demo', section: 'Primitives', steps: 7 },
  { id: 'primitives-demo-2', title: 'Painting with Barycentrics', type: 'demo', section: 'Primitives', steps: 4 },
  { id: 'primitives-demo-3', title: 'Styling Lines (Width & Stipple)', type: 'demo', section: 'Primitives', steps: 4 },
  { id: 'primitives-demo-4', title: 'Rendering Text in OpenGL', type: 'demo', section: 'Primitives', steps: 4 },
  { id: 'primitives-demo-5', title: 'Hooking Up Callbacks', type: 'demo', section: 'Primitives', steps: 4 },
  { id: 'primitives-exercise-1', title: 'Quad Assembly', type: 'exercise', section: 'Primitives', steps: 2 },
  { id: 'primitives-exercise-2', title: 'Neon Gradient', type: 'exercise', section: 'Primitives', steps: 3 },
  { id: 'primitives-exercise-3', title: 'Dotted Outline', type: 'exercise', section: 'Primitives', steps: 3 },
  { id: 'primitives-exercise-4', title: 'Hello World!', type: 'exercise', section: 'Primitives', steps: 2 },
  { id: 'primitives-exercise-5', title: 'Hooking up the Mouse', type: 'exercise', section: 'Primitives', steps: 3 },
  { id: 'buffers-demo-1', title: 'Immediate Mode: Every Frame', type: 'demo', section: 'Buffers', steps: 4 },
  { id: 'buffers-demo-2', title: 'Converting to Vertex Arrays', type: 'demo', section: 'Buffers', steps: 4 },
  { id: 'buffers-demo-3', title: 'VBOs: Send Once', type: 'demo', section: 'Buffers', steps: 6 },
  { id: 'buffers-demo-4', title: 'Buffer Usage Hints', type: 'demo', section: 'Buffers', steps: 7 },
  { id: 'buffers-demo-5', title: 'Updating in Place: glMapBuffer', type: 'demo', section: 'Buffers', steps: 12 },
  { id: 'buffers-exercise-1', title: 'Switch to VBO', type: 'exercise', section: 'Buffers', steps: 2 },
  { id: 'buffers-exercise-2', title: 'Use Static for Unchanging Data', type: 'exercise', section: 'Buffers', steps: 2 },
  { id: 'buffers-exercise-3', title: 'Reduce Memory with Indexed Drawing', type: 'exercise', section: 'Buffers', steps: 2 },
  { id: 'buffers-exercise-4', title: 'Pick the Right Usage Hint', type: 'exercise', section: 'Buffers', steps: 2 },
  { id: 'transforms-demo-1', title: 'Translate, Rotate, Scale', type: 'demo', section: 'Transforms', steps: 5 },
  { id: 'transforms-demo-2', title: 'Matrix Representation', type: 'demo', section: 'Transforms', steps: 6 },
  { id: 'transforms-demo-3', title: 'The Matrix Stack', type: 'demo', section: 'Transforms', steps: 4 },
  { id: 'transforms-demo-4', title: 'glOrtho: Changing the View', type: 'demo', section: 'Transforms', steps: 4 },
  { id: 'transforms-anim-1', title: 'Animation: Transformation Over Time', type: 'demo', section: 'Transforms', steps: 4 },
  { id: 'transforms-exercise-1', title: 'Translate to Position', type: 'exercise', section: 'Transforms', steps: 2 },
  { id: 'transforms-exercise-2', title: 'Rotate to Angle', type: 'exercise', section: 'Transforms', steps: 2 },
  { id: 'transforms-exercise-3', title: 'Build a Hierarchy', type: 'exercise', section: 'Transforms', steps: 2 },
  { id: 'transforms-exercise-4', title: 'Set the Viewport Range', type: 'exercise', section: 'Transforms', steps: 2 },
  { id: 'textures-demo-1', title: 'The Foundation of Textures', type: 'demo', section: 'Textures', steps: 5 },
  { id: 'textures-demo-2', title: 'Unlocking the Texture Atlas', type: 'demo', section: 'Textures', steps: 4 },
  { id: 'textures-demo-3', title: 'The Pixel Art Problem', type: 'demo', section: 'Textures', steps: 4 },
  { id: 'textures-demo-4', title: 'Pushing Boundaries (Wrapping)', type: 'demo', section: 'Textures', steps: 5 },
  { id: 'textures-demo-5', title: 'Texture on a Triangle', type: 'demo', section: 'Textures', steps: 4 },
  { id: 'textures-exercise-1', title: 'First Coat of Paint', type: 'exercise', section: 'Textures', steps: 2 },
  { id: 'textures-exercise-2', title: 'Sprite Extraction', type: 'exercise', section: 'Textures', steps: 2 },
  { id: 'textures-exercise-3', title: 'Retro Crispness', type: 'exercise', section: 'Textures', steps: 2 },
  { id: 'textures-exercise-4', title: 'The Endless Floor', type: 'exercise', section: 'Textures', steps: 3 },
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
