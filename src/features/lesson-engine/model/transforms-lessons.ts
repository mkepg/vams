import type { Lesson } from '@/core/types/lesson';
import { useVamsStore } from '@/core/store';
import type { VamsState } from '@/core/store/types';
import { animationController } from '@/features/animation-preview/model/animation-controller';

const DEFAULT_VIEWPORT = { minX: -1, maxX: 1, minY: -1, maxY: 1 };

function patchSelectedTransform(
  state: VamsState,
  patch: Partial<{
    translateX: number;
    translateY: number;
    rotate: number;
    scaleX: number;
    scaleY: number;
  }>,
) {
  const id = state.selectedObjectId;
  if (!id) return;
  const obj = state.objects.find((o) => o.id === id);
  if (!obj) return;
  state.updateObjectTransform(id, { ...obj.transform, ...patch });
}

export const TRANSFORMS_LESSONS: Record<string, Lesson> = {
  'transforms-demo-1': {
    id: 'transforms-demo-1',
    type: 'demo',
    title: 'Translate, Rotate, Scale',
    section: 'Transforms',
    steps: [
      {
        narration:
          'Welcome to Transforms! Three operations sit between every shape and the screen: translate, rotate, and scale. We’ve added a triangle to the scene so we can watch each one in turn.',
        focusPanel: 'scene-hierarchy',
        action: (state) => {
          state.addCustomObject('TRIANGLES', [{x: 0, y: 0.5}, {x: -0.5, y: -0.5}, {x: 0.5, y: -0.5}]);
        },
      },
      {
        narration:
          'Translate moves the shape in world space. Watch the X coordinate — the triangle slides to the right. In the generated code, that becomes a glTranslatef call.',
        focusPanel: 'object-transform',
        action: (state) => {
          patchSelectedTransform(state, { translateX: 0.4 });
        },
      },
      {
        narration:
          'Rotate spins the shape around its origin. Thirty degrees counter-clockwise is enough to see clearly. The angle becomes the first argument to glRotatef.',
        focusPanel: 'object-transform',
        action: (state) => {
          patchSelectedTransform(state, { rotate: 30 });
        },
      },
      {
        narration:
          'Scale stretches the shape on each axis. We’ll grow it 1.5× in both X and Y. glScalef takes the two factors directly.',
        focusPanel: 'object-transform',
        action: (state) => {
          patchSelectedTransform(state, { scaleX: 1.5, scaleY: 1.5 });
        },
      },
      {
        narration:
          'The order matters: T · R · S. Scale runs first against the local geometry, then rotate, then translate — which is exactly the order glPushMatrix wraps in the generated draw function.',
        focusPanel: 'object-transform',
      },
    ],
  },

  'transforms-demo-2': {
    id: 'transforms-demo-2',
    type: 'demo',
    title: 'Matrix Representation',
    section: 'Transforms',
    steps: [
      {
        narration:
          'Every transform is represented as a 4×4 matrix. We’ve added a quad to the scene. Watch the math panel on the right to see its matrix update.',
        focusPanel: 'scene-hierarchy',
        action: (state) => {
          state.addCustomObject('QUADS', [{x: -0.4, y: -0.4}, {x: 0.4, y: -0.4}, {x: 0.4, y: 0.4}, {x: -0.4, y: 0.4}]);
          state.setActiveSection('Transforms');
        },
      },
      {
        narration:
          'With no transform applied, the matrix is the "Identity" matrix — 1s on the diagonal, 0s elsewhere. It leaves the vertices exactly where they are.',
        focusPanel: 'object-transform',
      },
      {
        narration:
          'First, we’ll translate the quad. Notice the matrix: the translation distances (0.3 on X, 0.4 on Y) slot perfectly into the rightmost column.',
        focusPanel: 'object-transform',
        action: (state) => {
          patchSelectedTransform(state, { translateX: 0.3, translateY: 0.4 });
        },
      },
      {
        narration:
          'Next, we’ll reset the position and apply a scale instead. The scale factors (1.6x and 0.8x) multiply directly into the diagonal cells.',
        focusPanel: 'object-transform',
        action: (state) => {
          patchSelectedTransform(state, { translateX: 0, translateY: 0, scaleX: 1.6, scaleY: 0.8 });
        },
      },
      {
        narration:
          'Rotation is more complex—it mixes X and Y coordinates. We’ll reset the scale and spin the shape 45°. The top-left 2×2 block fills with the sine and cosine of 45°.',
        focusPanel: 'object-transform',
        action: (state) => {
          patchSelectedTransform(state, { scaleX: 1, scaleY: 1, rotate: 45 });
        },
      },
      {
        narration:
          'Finally, we’ll apply all three: Translate, Rotate, AND Scale. OpenGL multiplies these together in order (T · R · S) into a single composite matrix used to draw the shape.',
        focusPanel: 'object-transform',
        action: (state) => {
          patchSelectedTransform(state, { translateX: 0.3, translateY: 0.4, rotate: 45, scaleX: 1.6, scaleY: 0.8 });
        },
      },
    ],
  },

  'transforms-demo-3': {
    id: 'transforms-demo-3',
    type: 'demo',
    title: 'The Matrix Stack',
    section: 'Transforms',
    steps: [
      {
        narration:
          'When you group objects together, OpenGL stacks their matrices. We’ll build a hierarchy: a Group container holding a white triangle and a red quad.',
        focusPanel: 'scene-hierarchy',
        action: (state) => {
          state.addCustomObject('TRIANGLES', [{x: 0, y: 0.5}, {x: -0.5, y: -0.5}, {x: 0.5, y: -0.5}]);
          const triangleId = useVamsStore.getState().selectedObjectId;
          useVamsStore.getState().addCustomObject('QUADS', [
            {x: -0.15, y: -0.15}, {x: 0.15, y: -0.15},
            {x: 0.15, y: 0.15}, {x: -0.15, y: 0.15}
          ]);
          const quadId = useVamsStore.getState().selectedObjectId;
          if (quadId) {
            useVamsStore.getState().setAllVertexColors(quadId, '#ef4444');
          }
          if (triangleId && quadId) {
            useVamsStore.getState().createGroup([triangleId, quadId]);
          }
        },
      },
      {
        narration:
          'We’ve selected the red quad for you. The math panel’s Matrix Stack shows the stack at draw time: identity at the bottom, the Group’s frame on top of that, then the quad on top.',
        focusPanel: 'scene-hierarchy',
        action: (state) => {
          const quad = state.objects.find((o) => o.type === 'QUADS');
          if (quad) state.selectObject(quad.id);
          state.setActiveSection('Transforms');
        },
      },
      {
        narration:
          'Rotate the Group container 30°. Because the quad sits on top of the Group’s matrix, the quad rotates with it — even though the quad’s own rotate value never changed.',
        focusPanel: 'object-transform',
        action: (state) => {
          const group = state.objects.find((o) => o.type === 'GROUP');
          if (group) {
            state.selectObject(group.id);
            state.updateObjectTransform(group.id, { ...group.transform, rotate: 30 });
          }
        },
      },
      {
        narration:
          'In the generated code, glPushMatrix saves the Group’s frame before the child draws, and glPopMatrix restores it afterward. That’s the stack at work.',
        focusPanel: 'object-transform',
      },
    ],
  },

  'transforms-demo-4': {
    id: 'transforms-demo-4',
    type: 'demo',
    title: 'glOrtho: Changing the View',
    section: 'Transforms',
    steps: [
      {
        narration:
          'glOrtho defines the rectangle of world space the canvas shows. By default it’s the unit square: x and y from −1 to 1. Let’s drop a triangle inside it.',
        focusPanel: 'ortho-editor',
        action: (state) => {
          state.addCustomObject('TRIANGLES', [{x: 0, y: 0.5}, {x: -0.5, y: -0.5}, {x: 0.5, y: -0.5}]);
        },
      },
      {
        narration:
          'Widen the view to (−2, 2, −2, 2). The world rectangle doubles, so the triangle looks half its old size — we’re zooming OUT, not shrinking the shape.',
        focusPanel: 'ortho-editor',
        codeChangeFocus: ['glOrtho'],
        action: (state) => {
          state.setViewportLimits({ minX: -2, maxX: 2, minY: -2, maxY: 2 });
        },
      },
      {
        narration:
          'Now tighten it to (−0.5, 0.5, −0.5, 0.5). The visible window shrinks, the triangle fills more of the canvas — a zoom IN. Nothing about the triangle changed.',
        focusPanel: 'ortho-editor',
        codeChangeFocus: ['glOrtho'],
        action: (state) => {
          state.setViewportLimits({ minX: -0.5, maxX: 0.5, minY: -0.5, maxY: 0.5 });
        },
      },
      {
        narration:
          'Back to the default unit square. Notice the glOrtho call at the top of display() in the code panel — those four numbers are exactly what you just edited.',
        focusPanel: 'ortho-editor',
        codeChangeFocus: ['glOrtho'],
        action: (state) => {
          state.setViewportLimits({ ...DEFAULT_VIEWPORT });
        },
      },
    ],
  },

  'transforms-anim-1': {
    id: 'transforms-anim-1',
    type: 'demo',
    title: 'Animation: Transformation Over Time',
    section: 'Transforms',
    steps: [
      {
        narration:
          'Animation in graphics is nothing exotic — it is just transformation that changes a little each frame. We have dropped a triangle into the scene to animate.',
        focusPanel: 'scene-hierarchy',
        action: (state) => {
          state.addCustomObject('TRIANGLES', [{ x: 0, y: 0.5 }, { x: -0.5, y: -0.5 }, { x: 0.5, y: -0.5 }]);
        },
      },
      {
        narration:
          'Watch the canvas: the triangle now spins. This is a transient preview — a visual-only overlay. The saved scene never changes, so stopping snaps it straight back to its saved pose. A panel beside the canvas shows the GLUT idle callback that would produce the very same motion in a compiled program.',
        focusPanel: 'animation-preview',
        action: (state) => {
          if (state.selectedObjectId) {
            animationController.play(state.selectedObjectId, 'rotate', 1);
          }
        },
      },
      {
        narration:
          'Each frame, the idle callback adds a small angle to the rotation and asks GLUT to redraw — glutPostRedisplay. The highlighted line in the snippet is the one transform call that drives the spin. Same idea as glRotatef, repeated over time.',
        focusPanel: 'animation-preview',
      },
      {
        narration:
          'One quick check: in the idle callback below, which line is the one that actually makes the triangle move?',
        focusPanel: 'animation-preview',
        waitForUser: true,
        exercise: {
          kind: 'multiple-choice',
          prompt: 'Which line makes the object move each frame?',
          options: [
            { id: 'a', label: 'state.rotation += 1.50f;' },
            { id: 'b', label: 'void idle() {' },
            { id: 'c', label: 'glutPostRedisplay();' },
            { id: 'd', label: 'if (state.rotation >= 360.0f) state.rotation -= 360.0f;' },
          ],
          correctId: 'a',
        },
      },
    ],
  },

  'transforms-exercise-1': {
    id: 'transforms-exercise-1',
    type: 'exercise',
    title: 'Translate to Position',
    section: 'Transforms',
    steps: [
      {
        narration:
          'Move the triangle to (0.5, −0.3). Use the Translate row in the Object Transform panel — or drag it on the canvas.',
        focusPanel: 'object-transform',
        waitForUser: true,
        action: (state) => {
          state.addCustomObject('TRIANGLES', [{x: 0, y: 0.5}, {x: -0.5, y: -0.5}, {x: 0.5, y: -0.5}]);
        },
        successCheck: (state) => {
          const id = state.selectedObjectId;
          if (!id) return false;
          const obj = state.objects.find((o) => o.id === id);
          if (!obj) return false;
          const tol = 0.08;
          return (
            Math.abs(obj.transform.translateX - 0.5) < tol &&
            Math.abs(obj.transform.translateY - (-0.3)) < tol
          );
        },
      },
      {
        narration:
          'Spot on! In the generated code, those numbers became the arguments to glTranslatef — the call sits inside the triangle’s draw function.',
        codeChangeFocus: ['glTranslatef'],
      },
    ],
  },

  'transforms-exercise-2': {
    id: 'transforms-exercise-2',
    type: 'exercise',
    title: 'Rotate to Angle',
    section: 'Transforms',
    steps: [
      {
        narration:
          'Rotate the quad to about 45°. Use the rotate dial or type the value directly. The numeric input accepts a few degrees of slack.',
        focusPanel: 'object-transform',
        waitForUser: true,
        action: (state) => {
          state.addCustomObject('QUADS', [{x: -0.4, y: -0.4}, {x: 0.4, y: -0.4}, {x: 0.4, y: 0.4}, {x: -0.4, y: 0.4}]);
        },
        successCheck: (state) => {
          const id = state.selectedObjectId;
          if (!id) return false;
          const obj = state.objects.find((o) => o.id === id);
          if (!obj) return false;
          const angle = obj.transform.rotate;
          return Math.abs(angle - 45) <= 5;
        },
      },
      {
        narration:
          'Perfect. That value flows into glRotatef as the angle, with (0, 0, 1) as the rotation axis — spinning around the Z axis is what gives a 2D shape its in-plane rotation.',
        codeChangeFocus: ['glRotatef'],
      },
    ],
  },

  'transforms-exercise-3': {
    id: 'transforms-exercise-3',
    type: 'exercise',
    title: 'Build a Hierarchy',
    section: 'Transforms',
    steps: [
      {
        narration:
          'Two triangles in the scene. Multi-select them in the Hierarchy panel and group them — a parent transform applied to the group will then drive both children.',
        focusPanel: 'scene-hierarchy',
        waitForUser: true,
        action: (state) => {
          state.addCustomObject('TRIANGLES', [{x: -0.5, y: 0.5}, {x: -1.0, y: -0.5}, {x: 0.0, y: -0.5}]);
          state.addCustomObject('TRIANGLES', [{x: 0.5, y: 0.5}, {x: 0.0, y: -0.5}, {x: 1.0, y: -0.5}]);
        },
        successCheck: (state) => {
          return state.objects.some(
            (o) =>
              o.type === 'GROUP' &&
              Array.isArray(o.children) &&
              o.children.length >= 2,
          );
        },
      },
      {
        narration:
          'Nicely done! A group node turns into a draw function in the generated code that wraps each child in glPushMatrix / glPopMatrix — the matrix stack in action.',
        focusPanel: 'scene-hierarchy',
      },
    ],
  },

  'transforms-exercise-4': {
    id: 'transforms-exercise-4',
    type: 'exercise',
    title: 'Set the Viewport Range',
    section: 'Transforms',
    steps: [
      {
        narration:
          'Open the Viewing Volume panel and set the ortho range to (−2, 2) on both axes. The triangle should appear smaller as the world window widens.',
        focusPanel: 'ortho-editor',
        waitForUser: true,
        action: (state) => {
          state.addCustomObject('TRIANGLES', [{x: 0, y: 0.5}, {x: -0.5, y: -0.5}, {x: 0.5, y: -0.5}]);
        },
        successCheck: (state) => {
          const v = state.viewportLimits;
          const tol = 0.1;
          return (
            Math.abs(v.minX - (-2)) < tol &&
            Math.abs(v.maxX - 2) < tol &&
            Math.abs(v.minY - (-2)) < tol &&
            Math.abs(v.maxY - 2) < tol
          );
        },
      },
      {
        narration:
          'Excellent! Look at display() in the code panel — the four numbers in glOrtho match exactly what you just typed. That single call defines the entire visible world.',
        codeChangeFocus: ['glOrtho'],
      },
    ],
  },
};