import type { Lesson } from '@/core/types/lesson';
import type { VamsState } from '@/core/store/types';
import { useVamsStore } from '@/core/store';

/*
 * Sample lessons that use each lesson block, for the UI tests, the screenshot checks and the
 * lesson rule tests. getLessonById returns them only when VITE_LESSON_SAMPLES is '1'; they are
 * never in the lesson registry, the catalog or the Learn drawer.
 */

const RED = '#ff0000';

/** A sample's triangle: the only object its scene has. */
const triangle = (state: VamsState) => state.objects.find((o) => o.type === 'TRIANGLES');

export const SAMPLE_LESSONS: Record<string, Lesson> = {
  'sample-goals': {
    id: 'sample-goals',
    title: 'Transforms capstone',
    type: 'exercise',
    section: 'Transforms',
    steps: [
      {
        narration: 'Make the triangle red, move it to (0.5, 0.2), and turn it 45°.',
        action: (state) => {
          state.addCustomObject('TRIANGLES', [{ x: 0, y: 0.5 }, { x: -0.5, y: -0.5 }, { x: 0.5, y: -0.5 }]);
          const id = useVamsStore.getState().objects[0]?.id;
          if (!id) return;
          state.selectObject(id);
          state.setAllVertexColors(id, RED);
        },
        goals: [
          {
            label: 'Red',
            check: (state) => {
              const t = triangle(state);
              return !!t && t.vertices.length > 0 && t.vertices.every((v) => v.color.toLowerCase() === RED);
            },
          },
          {
            label: 'At (0.5, 0.2)',
            check: (state) => {
              const t = triangle(state);
              return (
                !!t &&
                Math.abs(t.transform.translateX - 0.5) <= 0.01 &&
                Math.abs(t.transform.translateY - 0.2) <= 0.01
              );
            },
          },
          {
            label: 'Turned 45°',
            check: (state) => {
              const t = triangle(state);
              return !!t && Math.abs(t.transform.rotate - 45) <= 0.5;
            },
          },
        ],
        task: 'Red, at (0.5, 0.2), turned 45°',
        hints: [
          'Rotate is under Transform in the Scene panel. Drag the dial, or type 45.',
          'Translate X and Y set where the triangle sits.',
          'Colour is under Appearance.',
        ],
        solve: (state) => {
          const t = triangle(state);
          if (!t) return;
          state.updateObjectTransform(t.id, { translateX: 0.5, translateY: 0.2, rotate: 45 });
          if (!t.vertices.every((v) => v.color.toLowerCase() === RED)) state.setAllVertexColors(t.id, RED);
        },
      },
      {
        narration: 'Done.',
        recap: {
          points: ['Goals tick as you meet them, and undo un-ticks them.'],
          calls: ['glTranslatef', 'glRotatef'],
        },
      },
    ],
  },
  'sample-recap': {
    id: 'sample-recap',
    title: 'Translate, Rotate, Scale',
    type: 'demo',
    section: 'Transforms',
    steps: [
      {
        narration: 'Here is a triangle that has been moved, turned and stretched.',
        action: (state) => {
          state.addCustomObject('TRIANGLES', [{ x: 0, y: 0.5 }, { x: -0.5, y: -0.5 }, { x: 0.5, y: -0.5 }]);
          const id = useVamsStore.getState().objects[0]?.id;
          if (!id) return;
          state.updateObjectTransform(id, { translateX: 0.3, translateY: 0.1, rotate: 30, scaleX: 1.5, scaleY: 0.8 });
        },
      },
      {
        narration: "You've met the three transforms.",
        recap: {
          points: [
            'Translate moves, rotate turns, scale stretches.',
            'They apply in reverse code order: scale first, move last.',
          ],
          calls: ['glTranslatef', 'glRotatef', 'glScalef'],
        },
      },
    ],
  },
  'sample-predict': {
    id: 'sample-predict',
    title: 'Translate, Rotate, Scale',
    type: 'demo',
    section: 'Transforms',
    steps: [
      {
        narration: 'Here is a white triangle at the centre.',
        // A new shape's vertices are white.
        action: (state) =>
          state.addCustomObject('TRIANGLES', [{ x: 0, y: 0.5 }, { x: -0.5, y: -0.5 }, { x: 0.5, y: -0.5 }]),
      },
      {
        narration: "We're about to set Translate X to 0.4. Where will the triangle go?",
        predict: {
          options: [
            { id: 'right', label: 'Right', why: 'It slid right. X is the horizontal axis.' },
            { id: 'up', label: 'Up', why: 'It slid right. X is the horizontal axis; up would be Y.' },
            { id: 'wider', label: 'It grows wider', why: 'Translate moves a shape; scale changes its size.' },
            { id: 'run', label: 'Nowhere until Run', why: 'The scene redraws as soon as a value changes.' },
          ],
          correctId: 'right',
        },
        action: (state) => {
          const t = triangle(state);
          if (t) state.updateObjectTransform(t.id, { translateX: 0.4 });
        },
      },
      {
        narration: 'Done.',
        recap: {
          points: ['Translate X moves a shape along the horizontal axis.'],
          calls: ['glTranslatef'],
        },
      },
    ],
  },
};
