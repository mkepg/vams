import type { Lesson } from '@/core/types/lesson';
import type { VamsState } from '@/core/store/types';
import type { SceneNode } from '@/core/types/scene';
import { useVamsStore } from '@/core/store';

/** The section's example triangle: red, green and blue corners. */
const TRIANGLE = [{ x: -0.5, y: -0.5 }, { x: 0.5, y: -0.5 }, { x: 0, y: 0.5 }];
const CORNER_COLOURS = ['#ff0000', '#00ff00', '#0000ff'];

/** Adds the example triangle, colours its corners and selects it; returns its id. */
function addColouredTriangle(state: VamsState): string | null {
  state.addCustomObject('TRIANGLES', TRIANGLE);
  const t = useVamsStore.getState().objects[0];
  if (!t) return null;
  t.vertices.forEach((v, i) => useVamsStore.getState().updateVertexColor(t.id, v.id, CORNER_COLOURS[i % 3]));
  useVamsStore.getState().selectObject(t.id);
  return t.id;
}

const firstOfType = (state: VamsState, type: SceneNode['type']) => state.objects.find((o) => o.type === type);
const drawable = (o: SceneNode) => o.type !== 'TEXT' && o.type !== 'GROUP';

/** The point a Place the Point step moves. */
const point = (state: VamsState) => firstOfType(state, 'POINTS');
const pointAt = (state: VamsState, x: number, y: number) => {
  const p = point(state);
  return !!p && Math.abs(p.transform.translateX - x) <= 0.05 && Math.abs(p.transform.translateY - y) <= 0.05;
};

/** The background as red, green and blue from 0 to 1. */
function background(state: VamsState): [number, number, number] {
  const hex = state.canvasBackgroundColor.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex.padEnd(6, '0');
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number];
}
/** A channel as glClearColor prints it: two decimals. */
const printed = (value: number) => Math.round(value * 100) / 100;

const isDarkBlue = (state: VamsState) => {
  const [r, g, b] = background(state);
  return b >= 0.35 && r <= 0.25 && g <= 0.35 && b > r + 0.15 && b > g + 0.15;
};
const isWhite = (state: VamsState) => background(state).every((c) => c >= 0.97);

const STAGE_OPTIONS = {
  vspec: { id: 'vspec', label: 'Vertex specification' },
  vproc: { id: 'vproc', label: 'Vertex processing' },
  prim: { id: 'prim', label: 'Primitive assembly' },
  clip: { id: 'clip', label: 'Clipping' },
  rast: { id: 'rast', label: 'Rasterisation' },
  frag: { id: 'frag', label: 'Fragment processing' },
  out: { id: 'out', label: 'Per-sample operations' },
} as const;

export const PIPELINE_LESSONS: Record<string, Lesson> = {
  'pipeline-demo-1': {
    id: 'pipeline-demo-1',
    title: 'From Vertex to Pixel',
    type: 'demo',
    section: 'Pipeline',
    steps: [
      {
        narration:
          'How does a list of numbers in your code become coloured pixels? OpenGL sends every shape through the same seven stages, called the pipeline.',
        focusPanel: 'pipeline-mode-controls',
        action: (state) => {
          const id = addColouredTriangle(state);
          // Scaled, turned and moved so that it crosses the right edge of the window.
          if (id) useVamsStore.getState().updateObjectTransform(id, { translateX: 0.2, rotate: 20, scaleX: 1.5, scaleY: 1.5 });
          useVamsStore.getState().setPipelineMode('Diagram');
          useVamsStore.getState().setActivePipelineStage(null);
        },
      },
      {
        narration: 'Here is a triangle with a red, a green and a blue corner. Before we follow it: at which stage does it stop being three exact corners and become squares?',
        predict: {
          options: [
            { id: 'clip', label: 'Clipping', why: 'Clipping cuts shapes at the window edge, but they are still exact corners and edges.' },
            { id: 'rast', label: 'Rasterisation', why: 'Rasterisation is where the exact shape is covered with pixel-sized squares.' },
            { id: 'frag', label: 'Fragment processing', why: 'By fragment processing the squares already exist; this stage only colours them.' },
          ],
          correctId: 'rast',
        },
        action: (state) => state.setActivePipelineStage(4),
      },
      {
        narration: 'Back to the start. 1, Specify: your program lists the corners, each with a colour, between glBegin and glEnd. Nothing is drawn yet.',
        action: (state) => state.setActivePipelineStage(0),
        codeChangeFocus: ['glVertex2f'],
      },
      {
        narration: '2, Transform: each corner is moved by the modelview matrix, which glTranslatef, glRotatef and glScalef build. This triangle is scaled, turned and moved right.',
        action: (state) => state.setActivePipelineStage(1),
        codeChangeFocus: ['glTranslatef', 'glRotatef', 'glScalef'],
      },
      {
        narration: '3, Assemble: GL_TRIANGLES joins every three corners into a triangle. The same corners could make lines or points instead.',
        action: (state) => state.setActivePipelineStage(2),
        codeChangeFocus: ['glBegin(GL_TRIANGLES)'],
      },
      {
        narration: '4, Clip: glOrtho sets the visible box. The part past the right edge is cut off, and new corners appear where the edge crosses it.',
        action: (state) => state.setActivePipelineStage(3),
        codeChangeFocus: ['glOrtho'],
      },
      {
        narration: '5, Rasterise: the stage you predicted. The triangle becomes squares, one fragment for every pixel whose centre it covers.',
        action: (state) => state.setActivePipelineStage(4),
        codeChangeFocus: 'none',
      },
      {
        narration: '6, Shade: each fragment gets its colour, blended from the three corner colours by how close it is to each corner.',
        action: (state) => state.setActivePipelineStage(5),
        codeChangeFocus: ['glShadeModel', 'glColor3f'],
      },
      {
        narration: '7, Output: the fragments are written over the background that glClear filled, and glutSwapBuffers shows the finished frame.',
        action: (state) => state.setActivePipelineStage(6),
        codeChangeFocus: ['glClear(', 'glutSwapBuffers'],
      },
      {
        narration: 'Math follows one corner through these stages with the real numbers. The Transformed stage shows where the matrix moved it.',
        pane: 'math',
        mathStage: 'transformed',
        action: (state) => state.setActivePipelineStage(1),
      },
      {
        narration: "That's the whole journey. Click any stage in the strip to look again, or use See it in Math under the drawing.",
        action: (state) => state.setActivePipelineStage(null),
        recap: {
          points: [
            'Your code only lists corners; OpenGL takes them through seven stages in a fixed order.',
            'Rasterisation is where an exact shape becomes pixel-sized fragments.',
            'The frame starts from glClear and appears with glutSwapBuffers.',
          ],
          calls: ['glVertex2f', 'glClear', 'glutSwapBuffers'],
        },
      },
    ],
  },
  'pipeline-demo-2': {
    id: 'pipeline-demo-2',
    title: 'Vector vs Raster',
    type: 'demo',
    section: 'Pipeline',
    steps: [
      {
        narration: 'A shape can be described two ways: as exact corners and edges, or as a grid of coloured squares. Here is one triangle both ways.',
        focusPanel: 'pipeline-mode-controls',
        action: (state) => {
          addColouredTriangle(state);
          useVamsStore.getState().setPipelineMode('RasterVector');
        },
      },
      {
        narration: 'On the left, vector: three corners and straight edges between them. However far you zoom in, an edge stays a perfect line.',
      },
      {
        narration: 'On the right, raster: the pixels OpenGL fills. A pixel is filled when its centre is inside the triangle, which gives the edges their stair steps.',
      },
      {
        narration: "We're about to stretch the triangle to twice its width. What happens to the stair steps on the raster side?",
        predict: {
          options: [
            { id: 'same', label: 'Same size, more of them', why: 'The pixels stay the same size, so a longer edge just crosses more of them.' },
            { id: 'bigger', label: 'They get bigger', why: 'The steps are set by the pixel size, not the shape; the pixels did not change.' },
            { id: 'gone', label: 'They disappear', why: 'Any edge that is not perfectly level or upright still crosses pixels in steps.' },
          ],
          correctId: 'same',
        },
        action: (state) => {
          const t = firstOfType(state, 'TRIANGLES');
          if (t) state.updateObjectTransform(t.id, { scaleX: 2 });
        },
      },
      {
        narration: 'Now change Pixels across under the drawing: try 8, then 48. Fewer, bigger pixels make bigger steps; more pixels make them finer, but never smooth.',
      },
      {
        narration: 'Turn GLUT_MULTISAMPLE off and on. With it on, each pixel tests several points inside itself, four in this picture, and an edge pixel is only partly filled.',
      },
      {
        narration: "Your program asks for this in main(): glutInitDisplayMode lists GLUT_MULTISAMPLE among the window's options.",
        pane: 'code',
        codeChangeFocus: ['glutInitDisplayMode'],
      },
      {
        narration: 'Every shape you draw is vector going in and raster coming out. Rasterisation is the stage that does the change.',
        recap: {
          points: [
            'A vector shape is exact; a raster image is a grid of pixels.',
            'A pixel is filled when its centre is inside the shape, which makes stair-step edges.',
            'GLUT_MULTISAMPLE samples several points per pixel to soften them.',
          ],
          calls: ['glutInitDisplayMode'],
        },
      },
    ],
  },
  'pipeline-demo-3': {
    id: 'pipeline-demo-3',
    title: 'Normalised Device Coordinates',
    type: 'demo',
    section: 'Pipeline',
    steps: [
      {
        narration: 'OpenGL does not place shapes in pixels. With the default glOrtho, every position is in a box from −1 to 1 on each axis: normalised device coordinates, or NDC.',
        focusPanel: 'pipeline-mode-controls',
        action: (state) => state.setPipelineMode('Playground'),
      },
      {
        narration: 'Move your cursor across the canvas and watch Cursor (NDC) in the Rasterised stage in Math. In the very centre it reads (0, 0).',
        pane: 'math',
        mathStage: 'rasterised',
      },
      {
        narration: 'The left edge is x = −1 and the right edge x = 1. The bottom is y = −1 and the top y = 1, so y grows upwards, unlike screen pixels.',
        pane: 'math',
        mathStage: 'rasterised',
      },
      {
        narration: "We're about to add a point at (0.5, −0.5). Where will it appear?",
        predict: {
          options: [
            { id: 'right-below', label: 'Right of centre, below it', why: 'x = 0.5 is halfway to the right edge, and y = −0.5 is halfway to the bottom.' },
            { id: 'left-above', label: 'Left of centre, above it', why: 'Positive x is to the right, and negative y is below the centre.' },
            { id: 'corner', label: 'In the bottom-right corner', why: 'The corner is (1, −1); 0.5 is only halfway there.' },
          ],
          correctId: 'right-below',
        },
        action: (state) => state.addCustomObject('POINTS', [{ x: 0.5, y: -0.5 }]),
      },
      {
        narration: 'In the code, the point is a vertex at (0, 0), moved to (0.5, −0.5) by glTranslatef. VAMS keeps each shape around its own centre and moves it into place.',
        pane: 'code',
        codeChangeFocus: ['glTranslatef', 'glVertex2f'],
      },
      {
        narration: 'Now drag the corner of the canvas window to resize it. The point stays halfway to the right edge and halfway down, at any size.',
      },
      {
        narration: 'Pixels only come in at the very end, when NDC is stretched to the window. The Rasterised stage in Math shows that sum for the point.',
        pane: 'math',
        mathStage: 'rasterised',
      },
      {
        narration: "That's why OpenGL works in NDC: the same numbers fit any window, and only the last step knows its size.",
        recap: {
          points: [
            'NDC runs from −1 to 1 on both axes, with (0, 0) in the centre and y growing upwards.',
            'An NDC position lands in the same place in a window of any size.',
            'Pixels only appear when NDC is stretched to the window at the end.',
          ],
          calls: ['glOrtho', 'glTranslatef'],
        },
      },
    ],
  },
  'pipeline-demo-4': {
    id: 'pipeline-demo-4',
    title: 'Anatomy of a GLUT Program',
    type: 'demo',
    section: 'Pipeline',
    steps: [
      {
        narration: 'Every program VAMS writes has the same skeleton: main() sets up a window once, and display() draws each frame. We start at main().',
        focusPanel: 'pipeline-mode-controls',
        pane: 'code',
        action: (state) => {
          state.setPipelineMode('Playground');
          addColouredTriangle(state);
        },
        codeChangeFocus: ['int main('],
      },
      {
        narration: 'glutInit starts FreeGLUT, the library that opens windows and passes on keyboard and mouse events. It always comes first.',
        pane: 'code',
        codeChangeFocus: ['glutInit('],
      },
      {
        narration: 'glutInitDisplayMode chooses what the window keeps: GLUT_RGB stores red, green and blue per pixel, and GLUT_DOUBLE asks for two copies of the picture.',
        pane: 'code',
        codeChangeFocus: ['glutInitDisplayMode'],
      },
      {
        narration: 'With GLUT_DOUBLE, OpenGL draws into a hidden back copy. What would you see if it drew straight onto the window instead?',
        predict: {
          options: [
            { id: 'flicker', label: 'The frame being drawn, flickering', why: 'You would watch each frame being cleared and drawn, which flickers. The hidden copy avoids that.' },
            { id: 'nothing', label: 'Nothing at all', why: 'The drawing would still show; you would just see it happen piece by piece.' },
            { id: 'same', label: 'Exactly the same', why: 'Only for a still picture. Anything that moves would flicker as each frame is cleared and redrawn.' },
          ],
          correctId: 'flicker',
        },
        action: (state) => state.setCodePane('code'),
        codeChangeFocus: ['GLUT_DOUBLE'],
      },
      {
        narration: 'That is why display() ends with glutSwapBuffers: the finished back copy swaps to the front in one go.',
        pane: 'code',
        codeChangeFocus: ['glutSwapBuffers'],
      },
      {
        narration: "glutInitWindowSize sets the window's size in pixels; VAMS uses your canvas window's size. glutCreateWindow then opens the window with its title.",
        pane: 'code',
        codeChangeFocus: ['glutInitWindowSize', 'glutCreateWindow'],
      },
      {
        narration: 'glewExperimental = GL_TRUE and glewInit() load the OpenGL functions your graphics driver provides. If loading fails, the program stops there.',
        pane: 'code',
        codeChangeFocus: ['glewExperimental', 'glewInit'],
      },
      {
        narration: 'glClearColor sets the colour the window is cleared to. You will choose it yourself in Paint the Background.',
        pane: 'code',
        codeChangeFocus: ['glClearColor'],
      },
      {
        narration: 'glutDisplayFunc(display) tells GLUT which function draws a frame. GLUT calls it whenever the window needs drawing.',
        pane: 'code',
        codeChangeFocus: ['glutDisplayFunc'],
      },
      {
        narration: 'main() ends with glutMainLoop(). What happens if that line is left out?',
        predict: {
          options: [
            { id: 'closes', label: 'The window opens and closes at once', why: 'main() would reach return 0 and the program would end before anything is drawn.' },
            { id: 'once', label: 'The triangle is drawn once and stays', why: 'Nothing would call display(); main() returns and the program ends.' },
            { id: 'nothing', label: 'Nothing changes', why: 'Without the loop no events are handled and main() returns straight away.' },
          ],
          correctId: 'closes',
        },
        action: (state) => state.setCodePane('code'),
        codeChangeFocus: ['glutMainLoop'],
      },
      {
        narration: 'glutMainLoop hands the program to GLUT: it waits for events and calls display() when needed. It never returns, so return 0 is never reached.',
        pane: 'code',
        codeChangeFocus: ['glutMainLoop'],
      },
      {
        narration: 'Each frame, display() runs glClear(GL_COLOR_BUFFER_BIT) to fill the window with the clear colour, draw() to draw your shapes, then glutSwapBuffers.',
        pane: 'code',
        codeChangeFocus: ['glClear(', 'draw();', 'glutSwapBuffers'],
      },
      {
        narration: "That's the skeleton every program shares. Click any line in the code to read what it does.",
        recap: {
          points: [
            'main() starts FreeGLUT, opens the window, registers display() and hands over to glutMainLoop.',
            'display() clears, draws and swaps, every frame.',
            'GLUT_DOUBLE draws out of sight; glutSwapBuffers shows the finished frame.',
          ],
          calls: ['glutInit', 'glutInitDisplayMode', 'glutCreateWindow', 'glutDisplayFunc', 'glutMainLoop'],
        },
      },
    ],
  },
  'pipeline-exercise-1': {
    id: 'pipeline-exercise-1',
    title: 'Place the Point',
    type: 'exercise',
    section: 'Pipeline',
    steps: [
      {
        narration: "Here is a point at the centre, (0, 0). You'll move it to two places in NDC.",
        focusPanel: 'pipeline-mode-controls',
        action: (state) => {
          state.setPipelineMode('Playground');
          const existing = point(state);
          if (existing) state.selectObject(existing.id);
          else state.addCustomObject('POINTS', [{ x: 0, y: 0 }]);
        },
      },
      {
        narration: 'Move the point to (0.5, 0.5), halfway to the top-right corner.',
        focusPanel: 'object-transform',
        goals: [{ label: 'At (0.5, 0.5)', check: (state) => pointAt(state, 0.5, 0.5) }],
        task: 'Move the point to (0.5, 0.5)',
        hints: [
          'Drag the point on the canvas. Cursor (NDC) in Math shows where you are.',
          'Or type 0.5 into Translate X and Translate Y under Transform.',
        ],
        solve: (state) => {
          const p = point(state);
          if (p) state.updateObjectTransform(p.id, { translateX: 0.5, translateY: 0.5 });
        },
      },
      {
        narration: 'Look at the code: the vertex is still glVertex2f(0, 0). Moving the point changed glTranslatef, which moves the whole shape.',
        pane: 'code',
        codeChangeFocus: ['glTranslatef', 'glVertex2f'],
      },
      {
        narration: 'Now move it to (−0.5, 0.25): left of centre, a quarter of the way up.',
        focusPanel: 'object-transform',
        goals: [{ label: 'At (−0.5, 0.25)', check: (state) => pointAt(state, -0.5, 0.25) }],
        task: 'Move the point to (−0.5, 0.25)',
        hints: [
          'Negative x is left of centre; positive y is above it.',
          'Type −0.5 into Translate X and 0.25 into Translate Y.',
        ],
        solve: (state) => {
          const p = point(state);
          if (p) state.updateObjectTransform(p.id, { translateX: -0.5, translateY: 0.25 });
        },
      },
      {
        narration: 'How your code does it: OpenGL takes the vertex (0, 0), applies glTranslatef, and the point lands on your target.',
        pane: 'code',
        codeChangeFocus: ['glTranslatef'],
      },
      {
        narration: 'You placed a point by its NDC position twice.',
        recap: {
          points: [
            'NDC positions run from −1 to 1, left to right and bottom to top.',
            'Moving a shape changes its glTranslatef, not its glVertex2f.',
          ],
          calls: ['glTranslatef', 'glVertex2f'],
        },
      },
    ],
  },
  'pipeline-exercise-4': {
    id: 'pipeline-exercise-4',
    title: 'Paint the Background',
    type: 'exercise',
    section: 'Pipeline',
    steps: [
      {
        narration: 'Every frame starts by filling the window with one colour. You set it in Settings, under Background.',
        focusPanel: 'appearance-panel',
        action: (state) => {
          state.setPipelineMode('Playground');
          state.addCustomObject('TRIANGLES', TRIANGLE);
          useVamsStore.getState().selectObject(null);
        },
      },
      {
        narration: 'Make the background a dark blue, so the white triangle stands out.',
        focusPanel: 'appearance-panel',
        goals: [{ label: 'Dark blue', check: isDarkBlue }],
        task: 'Make the background dark blue',
        hints: [
          'Settings is on the rail, below Scene. Background is its first group.',
          'Pick a dark blue in the colour picker, or type 1E3A8A into the hex field.',
        ],
        solve: (state) => state.setCanvasBackgroundColor('#1e3a8a'),
      },
      {
        narration: 'How your code does it: main() calls glClearColor once with your colour, as red, green and blue from 0 to 1. The last number is alpha.',
        pane: 'code',
        codeChangeFocus: ['glClearColor'],
      },
      {
        narration: 'Then, every frame, display() starts with glClear(GL_COLOR_BUFFER_BIT), which fills the window with that colour before anything is drawn.',
        pane: 'code',
        codeChangeFocus: ['glClear('],
      },
      {
        narration: 'Now make the background white. What happens to the white triangle?',
        focusPanel: 'appearance-panel',
        goals: [{ label: 'White', check: isWhite }],
        task: 'Make the background white',
        hints: ['Type FFFFFF into the background hex field.'],
        solve: (state) => state.setCanvasBackgroundColor('#ffffff'),
      },
      {
        narration: 'The triangle is still drawn, white on white. glClear paints first and shapes go on top, so the background never covers them.',
        recap: {
          points: [
            'glClearColor sets the clear colour once, in main().',
            'glClear(GL_COLOR_BUFFER_BIT) fills the window with it at the start of every frame.',
          ],
          calls: ['glClearColor', 'glClear'],
        },
      },
    ],
  },
  'pipeline-exercise-2': {
    id: 'pipeline-exercise-2',
    title: 'Which Stage?',
    type: 'exercise',
    section: 'Pipeline',
    shuffleRange: [1, 7],
    steps: [
      {
        narration: "Seven pictures, one for each stage of the pipeline, in a random order. Name the stage each one shows.",
        action: (state) => state.setPipelineMode('Playground'),
      },
      {
        narration: 'Only corners, each with a colour, as the program lists them. Which stage is this?',
        action: (state) => state.setPipelineMode('Playground'),
        task: 'Pick the stage',
        hints: ['Nothing has been moved, joined or filled yet. This is where the data comes in.'],
        exercise: {
          kind: 'multiple-choice',
          prompt: 'Which stage takes in the corners your code lists?',
          visualArtifact: 'vertex-specification',
          options: [STAGE_OPTIONS.vspec, STAGE_OPTIONS.prim, STAGE_OPTIONS.clip, STAGE_OPTIONS.frag],
          correctId: 'vspec',
        },
      },
      {
        narration: 'The corners have moved from where they started. Which stage moves them with a matrix?',
        action: (state) => state.setPipelineMode('Playground'),
        task: 'Pick the stage',
        hints: ['glTranslatef, glRotatef and glScalef build the matrix that does this, one corner at a time.'],
        exercise: {
          kind: 'multiple-choice',
          prompt: 'Which stage applies the transform matrix?',
          visualArtifact: 'vertex-processing',
          options: [STAGE_OPTIONS.vproc, STAGE_OPTIONS.rast, STAGE_OPTIONS.out, STAGE_OPTIONS.vspec],
          correctId: 'vproc',
        },
      },
      {
        narration: 'Loose corners are now joined into a triangle outline. Which stage does the joining?',
        action: (state) => state.setPipelineMode('Playground'),
        task: 'Pick the stage',
        hints: ['GL_TRIANGLES decides how the corners are joined: every three make one triangle.'],
        exercise: {
          kind: 'multiple-choice',
          prompt: 'Which stage builds lines and polygons from loose points?',
          visualArtifact: 'primitive-assembly',
          options: [STAGE_OPTIONS.prim, STAGE_OPTIONS.vproc, STAGE_OPTIONS.frag, STAGE_OPTIONS.clip],
          correctId: 'prim',
        },
      },
      {
        narration: 'The part of the triangle outside the visible box is cut off. Which stage does that?',
        action: (state) => state.setPipelineMode('Playground'),
        task: 'Pick the stage',
        hints: ['glOrtho sets the box; anything outside it is cut away before pixels are made.'],
        exercise: {
          kind: 'multiple-choice',
          prompt: 'Which stage cuts away offscreen geometry?',
          visualArtifact: 'clipping',
          options: [STAGE_OPTIONS.clip, STAGE_OPTIONS.rast, STAGE_OPTIONS.vspec, STAGE_OPTIONS.prim],
          correctId: 'clip',
        },
      },
      {
        narration: 'The triangle is now a grid of squares with staircase edges. Which stage turns smooth vector geometry into a grid of fragments?',
        action: (state) => state.setPipelineMode('Playground'),
        task: 'Pick the stage',
        hints: ['This is the stage where vector becomes raster.'],
        exercise: {
          kind: 'multiple-choice',
          prompt: 'Which stage turns exact shapes into pixel-sized fragments?',
          visualArtifact: 'rasterization',
          options: [STAGE_OPTIONS.rast, STAGE_OPTIONS.vproc, STAGE_OPTIONS.out, STAGE_OPTIONS.frag],
          correctId: 'rast',
        },
      },
      {
        narration: 'Each square now has its own colour, blended from the corner colours. Which stage colours the fragments?',
        action: (state) => state.setPipelineMode('Playground'),
        task: 'Pick the stage',
        hints: ['The squares already exist; this stage only decides what colour each one is.'],
        exercise: {
          kind: 'multiple-choice',
          prompt: 'Which stage determines the texture and colour of fragments?',
          visualArtifact: 'fragment-processing',
          options: [STAGE_OPTIONS.frag, STAGE_OPTIONS.clip, STAGE_OPTIONS.prim, STAGE_OPTIONS.rast],
          correctId: 'frag',
        },
      },
      {
        narration: 'The coloured fragments are written over the cleared background for glutSwapBuffers to show. Which stage does this final write?',
        action: (state) => state.setPipelineMode('Playground'),
        task: 'Pick the stage',
        hints: ['It is the last stage of all: what is left becomes the pixels in the window.'],
        exercise: {
          kind: 'multiple-choice',
          prompt: 'Which stage writes the fragments into the window?',
          visualArtifact: 'per-sample-operations',
          options: [STAGE_OPTIONS.out, STAGE_OPTIONS.vspec, STAGE_OPTIONS.vproc, STAGE_OPTIONS.clip],
          correctId: 'out',
        },
      },
      {
        narration: 'All seven named. When a picture looks wrong, knowing its stage tells you which part of the code to look at.',
        action: (state) => state.setPipelineMode('Diagram'),
        recap: {
          points: [
            'Corners are listed, moved, joined and clipped while they are still exact.',
            'Rasterisation turns them into fragments, which are coloured and then written to the window.',
          ],
          calls: ['glOrtho', 'glutSwapBuffers'],
        },
      },
    ],
  },
  'pipeline-exercise-3': {
    id: 'pipeline-exercise-3',
    title: 'Order the Pipeline',
    type: 'exercise',
    section: 'Pipeline',
    steps: [
      {
        narration: 'Put the seven stages in the order every shape passes through them, without looking at the Diagram.',
        action: (state) => state.setPipelineMode('Playground'),
        task: 'Order the seven stages',
        hints: [
          'It starts with the corners your code lists and ends with pixels in the window.',
          'Clipping needs whole shapes, so it comes after assembly. Colouring needs fragments, so it comes after rasterisation.',
        ],
        exercise: {
          kind: 'ordered-list',
          prompt: 'Drag the stages into the order they run:',
          items: [
            STAGE_OPTIONS.rast,
            STAGE_OPTIONS.frag,
            STAGE_OPTIONS.prim,
            STAGE_OPTIONS.vspec,
            STAGE_OPTIONS.vproc,
            STAGE_OPTIONS.clip,
            STAGE_OPTIONS.out,
          ],
          correctOrder: ['vspec', 'vproc', 'prim', 'clip', 'rast', 'frag', 'out'],
        },
      },
      {
        narration: "Now the program. Put these calls from main() in the order they have to run.",
        task: "Order main()'s calls",
        hints: [
          'GLUT has to start before anything else, and the window has to exist before an OpenGL call such as glClearColor.',
          'glutMainLoop never returns, so it must be last.',
        ],
        exercise: {
          kind: 'ordered-list',
          prompt: "Drag main()'s calls into the order they run:",
          items: [
            { id: 'loop', label: 'glutMainLoop()' },
            { id: 'clear', label: 'glClearColor(…)' },
            { id: 'init', label: 'glutInit(&argc, argv)' },
            { id: 'create', label: 'glutCreateWindow(…)' },
            { id: 'mode', label: 'glutInitDisplayMode(…)' },
          ],
          correctOrder: ['init', 'mode', 'create', 'clear', 'loop'],
        },
      },
      {
        narration: 'Both orders right. The stages run for every shape, every frame; main() runs once, then the loop takes over.',
        action: (state) => state.setPipelineMode('Diagram'),
        recap: {
          points: [
            'Specify, transform, assemble, clip, rasterise, shade, output.',
            'main() starts GLUT, sets the display mode, creates the window, then calls OpenGL, and ends in glutMainLoop.',
          ],
          calls: ['glutInit', 'glutCreateWindow', 'glutMainLoop'],
        },
      },
    ],
  },
  'pipeline-exercise-5': {
    id: 'pipeline-exercise-5',
    title: 'Write main()',
    type: 'exercise',
    section: 'Pipeline',
    steps: [
      {
        narration: "The section's last exercise: build a small scene, then write the main() that shows it.",
        action: (state) => state.setPipelineMode('Playground'),
      },
      {
        narration: 'Add any shape you like, and give the scene a background that is not black.',
        goals: [
          { label: 'A shape', check: (state) => state.objects.some(drawable) },
          { label: 'A coloured background', check: (state) => background(state).some((c) => c > 0.02) },
        ],
        task: 'Add a shape and colour the background',
        hints: [
          'Add is on the rail: pick a shape, click the canvas for each corner, then press Enter.',
          'Background is in Settings.',
        ],
        solve: (state) => {
          if (!state.objects.some(drawable)) addColouredTriangle(state);
          if (!background(useVamsStore.getState()).some((c) => c > 0.02)) useVamsStore.getState().setCanvasBackgroundColor('#1e3a8a');
        },
      },
      {
        narration: 'Write the display mode: a window with two copies of the picture, storing red, green and blue.',
        task: 'Fill in both flags',
        hints: ['One flag asks for a hidden back copy, the other for red, green and blue per pixel.', 'GLUT_DOUBLE, then GLUT_RGB.'],
        exercise: {
          kind: 'code',
          template: 'glutInitDisplayMode({0} | {1} | GLUT_MULTISAMPLE);',
          blanks: [
            { answer: () => 'GLUT_DOUBLE', wrong: 'not the two-copy flag' },
            { answer: () => 'GLUT_RGB', wrong: 'not the colour flag' },
          ],
        },
      },
      {
        narration: 'Open the window with its title.',
        task: 'Name the call',
        hints: ['It comes right after glutInitWindowSize, and creates the window.'],
        exercise: {
          kind: 'code',
          template: '{0}("VAMS Preview");',
          blanks: [{ answer: () => 'glutCreateWindow', wrong: 'not the call that opens it' }],
        },
      },
      {
        narration: 'Set the clear colour to your background, as red, green and blue from 0 to 1.',
        task: 'Fill in your background colour',
        hints: [
          'Each channel is the colour value divided by 255.',
          "The code panel's glClearColor line shows your three numbers.",
        ],
        exercise: {
          kind: 'code',
          template: 'glClearColor({0}, {1}, {2}, 1.0f);',
          blanks: [
            { answer: (state) => printed(background(state)[0]), wrong: "that's not your red" },
            { answer: (state) => printed(background(state)[1]), wrong: "that's not your green" },
            { answer: (state) => printed(background(state)[2]), wrong: "that's not your blue" },
          ],
        },
      },
      {
        narration: 'Tell GLUT which function draws each frame.',
        task: 'Name the display function',
        hints: ['It is the function that calls glClear, draw() and glutSwapBuffers.'],
        exercise: {
          kind: 'code',
          template: 'glutDisplayFunc({0});',
          blanks: [{ answer: () => 'display', wrong: 'not the function that draws' }],
        },
      },
      {
        narration: 'Last line: hand the program over to GLUT for good.',
        task: 'Name the call',
        hints: ['It waits for events and never returns.'],
        exercise: {
          kind: 'code',
          template: '{0}();',
          blanks: [{ answer: () => 'glutMainLoop', wrong: 'not the call that runs the loop' }],
        },
      },
      {
        narration: "You wrote main() yourself. Next, Primitives: the shapes it draws.",
        recap: {
          points: [
            'main() starts GLUT, opens a double-buffered RGB window, sets the clear colour, registers display() and hands over to glutMainLoop.',
            'display() runs every frame: glClear, draw, glutSwapBuffers.',
            'Between the two, every shape takes the same seven stages to the screen.',
          ],
          calls: ['glutInitDisplayMode', 'glutCreateWindow', 'glClearColor', 'glutDisplayFunc', 'glutMainLoop'],
        },
      },
    ],
  },
};
