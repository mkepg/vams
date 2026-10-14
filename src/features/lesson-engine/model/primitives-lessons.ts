import type { Lesson } from '@/core/types/lesson';
import { useVamsStore } from '@/core/store';
import { isCallbackValid, newRuleId } from '@/core/callbacks/callbacks-model';

export const PRIMITIVES_LESSONS: Record<string, Lesson> = {
  'poc-demo-1': {
    id: 'poc-demo-1',
    title: 'Proof of Concept: Drawing a Triangle',
    type: 'demo',
    section: 'Primitives',
    steps: [
      {
        narration: "Welcome to VAMS! In this demo, we'll see how scene actions reflect in the code panel.",
        waitForUser: true,
      },
      {
        narration: "Let's automatically add a triangle to the scene.",
        waitForUser: true,
        action: (state) => {
          state.addCustomObject('TRIANGLES', [
            { x: 0, y: 0.5 },
            { x: -0.5, y: -0.5 },
            { x: 0.5, y: -0.5 },
          ]);
        },
      },
      {
        narration: "Notice how the C++ code updated? Let's hide the triangle.",
        waitForUser: true,
        focusPanel: 'scene-hierarchy',
        action: (state) => {
          const id = state.selectedObjectId;
          if (id) state.toggleObjectVisibility(id);
        },
      },
      {
        narration: "Hidden objects are excluded from the display loop. You've completed the demo!",
        waitForUser: true,
      },
    ],
  },
  'primitives-demo-1': {
    id: 'primitives-demo-1',
    title: 'The Geometry Alphabet: Points to Polygons',
    type: 'demo',
    section: 'Primitives',
    steps: [
      {
        narration: "Welcome to Primitives! Everything in OpenGL 1.x is drawn by sending vertices (points in 2D space) to the GPU.",
        waitForUser: true,
      },
      {
        narration: "How those vertices are connected depends on the primitive mode. Let's look at GL_POINTS.",
        waitForUser: true,
        action: (state) => {
          state.addCustomObject('POINTS', [
            { x: -0.5, y: 0.5 }, { x: 0, y: 0.5 }, { x: 0.5, y: 0.5 }
          ]);
        }
      },
      {
        narration: "Check the Code Panel. Notice how the vertices are wrapped between glBegin(GL_POINTS) and glEnd(). Each vertex is rendered as an independent dot.",
        waitForUser: true,
      },
      {
        narration: "Now, let's see GL_LINE_STRIP using the exact same three vertices.",
        waitForUser: true,
        action: (state) => {
          const prevId = state.selectedObjectId;
          if (prevId) state.deleteObject(prevId);
          state.addCustomObject('LINE_STRIP', [
            { x: -0.5, y: 0 }, { x: 0, y: -0.5 }, { x: 0.5, y: 0 }
          ]);
        }
      },
      {
        narration: "The code changed to glBegin(GL_LINE_STRIP). Instead of independent dots, OpenGL now connects each new vertex to the previous one.",
        waitForUser: true,
      },
      {
        narration: "Finally, let's build a solid surface using GL_TRIANGLES.",
        waitForUser: true,
        action: (state) => {
          const prevId = state.selectedObjectId;
          if (prevId) state.deleteObject(prevId);
          state.addCustomObject('TRIANGLES', [
            { x: 0, y: 0.5 }, { x: -0.5, y: -0.5 }, { x: 0.5, y: -0.5 }
          ]);
        }
      },
      {
        narration: "With GL_TRIANGLES, OpenGL consumes vertices in groups of three to draw filled shapes. This is the absolute foundation of all computer graphics.",
        waitForUser: true,
      }
    ],
  },
  'primitives-demo-2': {
    id: 'primitives-demo-2',
    title: 'Painting with Barycentrics',
    type: 'demo',
    section: 'Primitives',
    steps: [
      {
        narration: "Colors in OpenGL can be applied to a whole object, or to individual vertices. Let's start with a basic triangle.",
        waitForUser: true,
        action: (state) => {
          state.addCustomObject('TRIANGLES', [
            { x: 0, y: 0.5 }, { x: -0.5, y: -0.4 }, { x: 0.5, y: -0.4 }
          ]);
        }
      },
      {
        narration: "Right now, the whole triangle is white. Let's switch to 'Per Vertex' mode and paint the top vertex Red.",
        waitForUser: true,
        focusPanel: 'appearance-panel',
        action: (state) => {
          const id = useVamsStore.getState().selectedObjectId;
          const obj = useVamsStore.getState().objects.find(o => o.id === id);
          if (obj && obj.vertices[0]) {
            state.updateVertexColor(obj.id, obj.vertices[0].id, '#ef4444');
          }
        }
      },
      {
        narration: "Look closely at the canvas. OpenGL automatically blends the red vertex into the white ones. Let's color the bottom two vertices Green and Blue.",
        waitForUser: true,
        focusPanel: 'appearance-panel',
        action: (state) => {
          const id = useVamsStore.getState().selectedObjectId;
          const obj = useVamsStore.getState().objects.find(o => o.id === id);
          if (obj && obj.vertices.length >= 3) {
            state.updateVertexColor(obj.id, obj.vertices[1].id, '#22c55e');
            state.updateVertexColor(obj.id, obj.vertices[2].id, '#3b82f6');
          }
        }
      },
      {
        narration: "This hardware-accelerated blending is called Barycentric Interpolation. Check the Math Panel below the code to see the exact formula the GPU uses to calculate every pixel's color.",
        waitForUser: true,
      }
    ],
  },
  'primitives-demo-3': {
    id: 'primitives-demo-3',
    title: 'Styling Lines (Width & Stipple)',
    type: 'demo',
    section: 'Primitives',
    steps: [
      {
        narration: "Lines don't have to be 1-pixel wide and solid. Let's manipulate a GL_LINE_LOOP.",
        waitForUser: true,
        action: (state) => {
          state.addCustomObject('LINE_LOOP', [
            { x: -0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: -0.5 }, { x: -0.5, y: -0.5 }
          ]);
        }
      },
      {
        narration: "First, let's make it thicker using glLineWidth().",
        waitForUser: true,
        focusPanel: 'line-style-panel',
        action: (state) => {
          const id = useVamsStore.getState().selectedObjectId;
          if (id) state.updateLineWidth(id, 5);
        }
      },
      {
        narration: "Now, let's turn it into a dashed line. This is called 'Stippling'. We apply a 16-bit pattern where 1 draws a pixel and 0 skips it.",
        waitForUser: true,
        focusPanel: 'line-style-panel',
        action: (state) => {
          const id = useVamsStore.getState().selectedObjectId;
          if (id) state.updateLineStipple(id, { factor: 2, pattern: 0x00FF });
        }
      },
      {
        narration: "Look at the Code Panel. Stippling requires us to turn the feature on and off using glEnable(GL_LINE_STIPPLE) and glDisable(GL_LINE_STIPPLE).",
        waitForUser: true,
      }
    ],
  },
  'primitives-demo-4': {
    id: 'primitives-demo-4',
    title: 'Rendering Text in OpenGL',
    type: 'demo',
    section: 'Primitives',
    steps: [
      {
        narration: "Drawing text in pure OpenGL 1.x is notoriously tricky, but GLUT provides a helpful shortcut using bitmap characters.",
        waitForUser: true,
        focusPanel: 'text-node-panel',
        action: (state) => {
          state.addTextObject('Hello\nOpenGL!', -0.3, 0);
        }
      },
      {
        narration: "Take a look at the Code Panel. Notice that text doesn't use glBegin or glEnd.",
        waitForUser: true,
      },
      {
        narration: "Instead, we use glRasterPos2f to move the invisible 'pen' to a specific coordinate, and then we pass characters one by one into glutBitmapCharacter.",
        waitForUser: true,
      },
      {
        narration: "Bitmap fonts always face the camera and stay the same pixel size regardless of your viewport zoom. They are perfect for HUDs and labels.",
        waitForUser: true,
      }
    ],
  },
  'primitives-demo-5': {
    id: 'primitives-demo-5',
    title: 'Hooking Up Callbacks',
    type: 'demo',
    section: 'Primitives',
    steps: [
      {
        narration: "A graphics window isn't much fun if it can't react. GLUT uses callbacks: functions it calls when a key is pressed, the mouse moves or the window changes size.",
        waitForUser: true,
        focusPanel: 'callbacks-panel',
      },
      {
        narration: "Let's register a keyboard handler, onKey, with one rule: when D is pressed, move the triangle 0.10 to the right.",
        waitForUser: true,
        focusPanel: 'callbacks-panel',
        action: (state) => {
          state.addCustomObject('TRIANGLES', [
            { x: 0, y: 0.5 },
            { x: -0.5, y: -0.5 },
            { x: 0.5, y: -0.5 },
          ]);
          const store = useVamsStore.getState();
          const triangle = store.objects[0];
          store.updateObjectName(triangle.id, 'Triangle');
          store.selectObject(null);
          store.setCallbackHandler('keyboard', 'onKey');
          store.addCallbackRule('keyboard', {
            id: newRuleId(),
            objectId: triangle.id,
            trigger: { kind: 'keyboard', key: 'd' },
            action: { type: 'translate', dx: 0.1, dy: 0 },
          });
        },
      },
      {
        narration: 'Find onKey in the Code Panel. The rule became a case in a switch on key, and it changes state_Triangle.x. glutPostRedisplay asks GLUT to draw the next frame.',
        waitForUser: true,
      },
      {
        narration: 'Now find glutKeyboardFunc(onKey) in main(). That line tells GLUT which function to call when a key is pressed.',
        waitForUser: true,
      },
      {
        narration: 'Press Run on the canvas, then press D. The triangle moves and its case lights up in the Code Panel. Press Esc to stop: your scene is just as you built it.',
        waitForUser: true,
      },
    ],
  },
  'primitives-exercise-1': {
    id: 'primitives-exercise-1',
    title: 'Quad Assembly',
    type: 'exercise',
    section: 'Primitives',
    steps: [
      {
        narration: "Let's test your geometry skills. Clear the scene (if it isn't already) and use the Primitive Palette to create a GL_QUADS object.",
        waitForUser: true,
        successCheck: (state) =>
          state.objects.some((o) => o.type === 'QUADS' && o.vertices.length >= 4),
      },
      {
        narration: "Excellent! The draw function now emits a glBegin(GL_QUADS) block. Remember: Quads require vertices in groups of four.",
        waitForUser: true,
      },
    ],
  },
  'primitives-exercise-2': {
    id: 'primitives-exercise-2',
    title: 'Neon Gradient',
    type: 'exercise',
    section: 'Primitives',
    steps: [
      {
        narration: "Let's make a barycentric gradient. I've placed a triangle for you. First, switch its Color Mode from 'Uniform' to 'Per Vertex' and set a color on one of its vertices.",
        waitForUser: true,
        focusPanel: 'appearance-panel',
        action: (state) => {
          const existing = state.objects.find(o => o.type === 'TRIANGLES');
          if (!existing) {
             state.addCustomObject('TRIANGLES', [
               { x: 0, y: 0.5 }, { x: -0.5, y: -0.4 }, { x: 0.5, y: -0.4 }
             ]);
          }
        },
        successCheck: (state) => {
          const obj = state.objects.find(o => o.id === state.selectedObjectId);
          if (!obj || obj.vertices.length < 3) return false;
          const c1 = obj.vertices[0].color;
          return obj.vertices.some(v => v.color !== c1);
        },
      },
      {
        narration: "Great! Now change the colors of the vertices to create a gradient. Make one of them bright green (#00ff00) and another bright magenta (#ff00ff).",
        waitForUser: true,
        focusPanel: 'appearance-panel',
        successCheck: (state) => {
          const obj = state.objects.find(o => o.id === state.selectedObjectId);
          if (!obj) return false;
          let hasGreen = false;
          let hasMagenta = false;
          obj.vertices.forEach(v => {
            const r = parseInt(v.color.slice(1, 3), 16);
            const g = parseInt(v.color.slice(3, 5), 16);
            const b = parseInt(v.color.slice(5, 7), 16);
            if (r < 50 && g > 200 && b < 50) hasGreen = true;
            if (r > 200 && g < 50 && b > 200) hasMagenta = true;
          });
          return hasGreen && hasMagenta;
        },
      },
      {
        narration: "Vibrant! In the Code Panel, you can see that glColor3f is now being called before every individual glVertex2f.",
        waitForUser: true,
      },
    ],
  },
  'primitives-exercise-3': {
    id: 'primitives-exercise-3',
    title: 'Dotted Outline',
    type: 'exercise',
    section: 'Primitives',
    steps: [
      {
        narration: "Time to style some lines. Select the Line Loop I just added to the scene.",
        waitForUser: true,
        action: (state) => {
           state.addCustomObject('LINE_LOOP', [
             { x: -0.6, y: 0.6 }, { x: 0.6, y: 0.6 }, { x: 0.6, y: -0.6 }, { x: -0.6, y: -0.6 }
           ]);
        }
      },
      {
        narration: "Open the Line Style panel. Turn on glLineStipple, and select the 'Dotted' preset.",
        waitForUser: true,
        focusPanel: 'line-style-panel',
        successCheck: (state) => {
          const obj = state.objects.find(o => o.id === state.selectedObjectId);
          if (!obj || !obj.lineStipple) return false;
          return obj.lineStipple.pattern === 0x5555;
        },
      },
      {
        narration: "Nicely done! Notice the glEnable(GL_LINE_STIPPLE) emission in your generated code.",
        waitForUser: true,
      },
    ],
  },
  'primitives-exercise-4': {
    id: 'primitives-exercise-4',
    title: 'Hello World!',
    type: 'exercise',
    section: 'Primitives',
    steps: [
      {
        narration: "Let's label our scene. Open the 'Create Text' panel and add a new text object that says 'Hello World'.",
        waitForUser: true,
        focusPanel: 'text-node-panel',
        successCheck: (state) => {
          return state.objects.some(
            o => o.type === 'TEXT' && o.textContent?.toLowerCase().includes('hello world')
          );
        },
      },
      {
        narration: "Awesome. Look at the Code Panel to see how VAMS converted your string into a loop of glutBitmapCharacter calls.",
        waitForUser: true,
      },
    ],
  },
  'primitives-exercise-5': {
    id: 'primitives-exercise-5',
    title: 'Hooking up the Mouse',
    type: 'exercise',
    section: 'Primitives',
    steps: [
      {
        narration: 'We need the program to respond to mouse clicks. Open the Callbacks panel.',
        waitForUser: true,
        focusPanel: 'callbacks-panel',
      },
      {
        narration: 'Add any shape, then open the Callbacks panel. Register a Mouse callback and give it a rule: when the left button goes down, move the shape to the pointer.',
        waitForUser: true,
        focusPanel: 'callbacks-panel',
        successCheck: (state) =>
          isCallbackValid(state.callbacks, 'mouse') &&
          state.callbacks.mouse.rules.some(
            (r) =>
              r.trigger.kind === 'mouse' && r.trigger.button === 'left' && r.trigger.state === 'down' &&
              r.action.type === 'moveToPointer' && state.objects.some((o) => o.id === r.objectId),
          ),
      },
      {
        narration: 'Press Run and click around the canvas. Each click calls your handler, which converts the pixel to world coordinates with windowToWorld.',
        waitForUser: true,
      },
    ],
  },
  'primitives-exercise-6': {
    id: 'primitives-exercise-6',
    title: 'Drive with the Arrow Keys',
    type: 'exercise',
    section: 'Primitives',
    steps: [
      {
        narration: 'Arrow keys have no ASCII code, so GLUT sends them to a separate callback, glutSpecialFunc. Add any shape, open the Callbacks panel, then switch on Special keys.',
        waitForUser: true,
        focusPanel: 'callbacks-panel',
        successCheck: (state) => state.objects.length > 0 && isCallbackValid(state.callbacks, 'special'),
      },
      {
        narration: 'Add two rules: → translates a shape right (a positive dx) and ← translates it left (a negative dx).',
        waitForUser: true,
        focusPanel: 'callbacks-panel',
        successCheck: (state) => {
          const rules = state.callbacks.special.rules;
          const moves = (key: 'left' | 'right', sign: number) =>
            rules.filter((r) => r.trigger.kind === 'special' && r.trigger.key === key && r.action.type === 'translate' && Math.sign(r.action.dx) === sign);
          const lefts = moves('left', -1);
          return moves('right', 1).some(
            (r) => lefts.some((l) => l.objectId === r.objectId) && state.objects.some((o) => o.id === r.objectId),
          );
        },
      },
      {
        narration: "Press Run and drive it with the arrow keys. You've mastered the Primitives section!",
        waitForUser: true,
      },
    ],
  },
};