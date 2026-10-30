import type { Lesson } from '@/core/types/lesson';
import type { VamsState } from '@/core/store/types';
import type { BufferUsage, PendingVertex, PrimitiveType, RenderingMode, SceneNode } from '@/core/types/scene';
import { useVamsStore } from '@/core/store';

const TRIANGLE: PendingVertex[] = [{ x: -0.5, y: -0.4 }, { x: 0.5, y: -0.4 }, { x: 0, y: 0.5 }];
const SQUARE: PendingVertex[] = [{ x: -0.4, y: -0.4 }, { x: 0.4, y: -0.4 }, { x: 0.4, y: 0.4 }, { x: -0.4, y: 0.4 }];
/** A square as two triangles: six corners, four of them different. */
const TWO_TRIANGLES: PendingVertex[] = [
  { x: -0.4, y: -0.4 }, { x: 0.4, y: -0.4 }, { x: -0.4, y: 0.4 },
  { x: 0.4, y: -0.4 }, { x: 0.4, y: 0.4 }, { x: -0.4, y: 0.4 },
];
const DRAWABLE = new Set<SceneNode['type']>(['POINTS', 'LINES', 'LINE_STRIP', 'LINE_LOOP', 'TRIANGLES', 'TRIANGLE_STRIP', 'TRIANGLE_FAN', 'QUADS', 'QUAD_STRIP', 'POLYGON']);

const now = () => useVamsStore.getState();
const shapes = (state: VamsState) => state.objects.filter((o) => DRAWABLE.has(o.type));
const first = (state: VamsState) => shapes(state)[0];
const modeOf = (o: SceneNode | undefined): RenderingMode => o?.renderingMode ?? 'IMMEDIATE';
const usageOf = (o: SceneNode | undefined): BufferUsage => o?.bufferUsage ?? 'STATIC';

/** Adds a shape, selected, in a rendering mode and usage; returns it. */
function addShape(type: PrimitiveType, vertices: PendingVertex[], mode: RenderingMode = 'IMMEDIATE', usage?: BufferUsage): SceneNode {
  now().addCustomObject(type, vertices);
  const o = now().objects[0];
  if (mode !== 'IMMEDIATE') now().updateRenderingMode(o.id, mode);
  if (usage) now().updateBufferUsage(o.id, usage);
  return now().objects[0];
}

/** The capstone's shape: the first one drawn from a VBO, else the first shape. */
const capstoneShape = (state: VamsState) => shapes(state).find((o) => modeOf(o) === 'VBO') ?? first(state);

export const BUFFERS_LESSONS: Record<string, Lesson> = {
  'buffers-demo-1': {
    id: 'buffers-demo-1',
    title: 'Immediate Mode: Every Frame',
    type: 'demo',
    section: 'Buffers',
    steps: [
      {
        narration: 'Where do your corners live while the program runs, and how often are they sent to the graphics card? This section is about that.',
      },
      {
        narration: 'This triangle is drawn in immediate mode: its corners are listed between glBegin and glEnd, as in Primitives.',
        focusPanel: 'buffers-panel',
        action: () => { addShape('TRIANGLES', TRIANGLE); },
        codeChangeFocus: ['glBegin('],
      },
      {
        narration: "Every frame, display() calls draw(), draw() calls the triangle's draw function, and every glColor3f and glVertex2f runs again.",
        pane: 'code',
        codeChangeFocus: ['glVertex2f'],
      },
      {
        narration: 'A shape with 1,000 corners, drawn 60 times a second. How many glVertex2f calls does it make in one second?',
        predict: {
          options: [
            { id: '60000', label: '60,000', why: 'Immediate mode sends every corner again in every frame: 1,000 × 60.' },
            { id: '1000', label: '1,000', why: 'That would be true only if the corners were sent once and kept.' },
            { id: '60', label: '60', why: 'One call per frame would need the corners sent as a single block.' },
          ],
          correctId: '60000',
        },
        action: (state) => state.setCodePane('math'),
      },
      {
        narration: "The traffic row in Math's Stored stage shows it: every frame sends the corners again, one by one.",
        pane: 'math',
        mathStage: 'stored',
      },
      {
        narration: 'For three corners that is nothing. For thousands it adds up, which is what vertex arrays and buffer objects fix.',
        recap: {
          points: [
            'Immediate mode lists the corners between glBegin and glEnd.',
            'Every frame, every corner is sent to the graphics card again.',
          ],
          calls: ['glBegin', 'glVertex2f'],
        },
      },
    ],
  },
  'buffers-demo-2': {
    id: 'buffers-demo-2',
    title: 'Converting to Vertex Arrays',
    type: 'demo',
    section: 'Buffers',
    steps: [
      {
        narration: 'A vertex array keeps the corners in a C array and draws them all with one call. Here is the same triangle in immediate mode.',
        focusPanel: 'buffers-panel',
        action: () => { addShape('TRIANGLES', TRIANGLE); },
      },
      {
        narration: 'Now its Rendering Mode is Vertex Array. The corners move out of the draw function into verts_, a list of x, y pairs at the top of the program.',
        focusPanel: 'buffers-panel',
        action: (state) => {
          const o = first(state);
          if (o) state.updateRenderingMode(o.id, 'VERTEX_ARRAY');
        },
        codeChangeFocus: ['GLfloat verts_', 'GLfloat colors_'],
      },
      {
        narration: 'glEnableClientState(GL_VERTEX_ARRAY) and glEnableClientState(GL_COLOR_ARRAY) tell OpenGL to read positions and colours from arrays.',
        pane: 'code',
        codeChangeFocus: ['glEnableClientState'],
      },
      {
        narration: 'The code says glVertexPointer(2, GL_FLOAT, 0, verts_…). What does the 2 mean?',
        predict: {
          options: [
            { id: 'per', label: 'Two numbers per corner', why: 'Each corner is an x and a y, so OpenGL reads the array two floats at a time.' },
            { id: 'corners', label: 'Two corners', why: 'The number of corners goes to glDrawArrays, not glVertexPointer.' },
            { id: 'bytes', label: 'Two bytes per number', why: 'GL_FLOAT gives the size: each number is a 4-byte float.' },
          ],
          correctId: 'per',
        },
        action: (state) => state.setCodePane('code'),
      },
      {
        narration: 'GL_FLOAT is the type of each number. glColorPointer(3, GL_FLOAT, 0, colors_…) reads three numbers per corner: red, green and blue.',
        pane: 'code',
        codeChangeFocus: ['glColorPointer'],
      },
      {
        narration: 'glDrawArrays(GL_TRIANGLES, 0, 3) draws three corners starting at corner 0, in one call. glDisableClientState switches the arrays off again afterwards.',
        pane: 'code',
        codeChangeFocus: ['glDrawArrays', 'glDisableClientState'],
      },
      {
        narration: "In Math's Stored stage, the traffic row still lights up every frame: the array lives in your program's memory and is sent each time, but in one batch.",
        pane: 'math',
        mathStage: 'stored',
      },
      {
        narration: 'Fewer calls, same traffic. The next step is to keep the corners on the graphics card itself.',
        recap: {
          points: [
            'glVertexPointer and glColorPointer point OpenGL at arrays of numbers.',
            'glDrawArrays draws them in one call, but the arrays are still sent every frame.',
          ],
          calls: ['glVertexPointer', 'glColorPointer', 'glDrawArrays'],
        },
      },
    ],
  },
  'buffers-demo-3': {
    id: 'buffers-demo-3',
    title: 'VBOs: Send Once',
    type: 'demo',
    section: 'Buffers',
    steps: [
      {
        narration: 'A vertex buffer object, or VBO, is memory on the graphics card. Upload the corners once, and every frame after draws from there.',
        focusPanel: 'buffers-panel',
        action: () => { addShape('TRIANGLES', TRIANGLE, 'VERTEX_ARRAY'); },
      },
      {
        narration: 'The Rendering Mode is now VBO. Look at init(), which runs once before the first frame.',
        focusPanel: 'buffers-panel',
        action: (state) => {
          const o = first(state);
          if (o) state.updateRenderingMode(o.id, 'VBO');
        },
        codeChangeFocus: ['glGenBuffers', 'glBufferData'],
      },
      {
        narration: 'glGenBuffers makes a buffer name, glBindBuffer(GL_ARRAY_BUFFER, …) selects it, and glBufferData copies the array into it.',
        pane: 'code',
        codeChangeFocus: ['glGenBuffers', 'glBindBuffer(GL_ARRAY_BUFFER, vbo_', 'glBufferData'],
      },
      {
        narration: 'There are two buffers: vbo_ for the positions and cbo_ for the colours. Each one is uploaded once.',
        pane: 'code',
        codeChangeFocus: ['cbo_'],
      },
      {
        narration: 'In the draw function, glVertexPointer now ends in 0 instead of the array. What does that 0 mean?',
        predict: {
          options: [
            { id: 'offset', label: 'Start of the bound buffer', why: 'With a buffer bound, the last number is an offset into it, and 0 is its start.' },
            { id: 'null', label: 'No data at all', why: 'The data is there, in the buffer glBindBuffer just selected.' },
            { id: 'first', label: 'Draw only the first corner', why: 'How many corners to draw is set by glDrawArrays.' },
          ],
          correctId: 'offset',
        },
        action: (state) => state.setCodePane('code'),
      },
      {
        narration: 'After drawing, glBindBuffer(GL_ARRAY_BUFFER, 0) unbinds it, so the next shape is not drawn from this buffer by mistake.',
        pane: 'code',
        codeChangeFocus: ['glBindBuffer(GL_ARRAY_BUFFER, 0)'],
      },
      {
        narration: "In Math's Stored stage, only frame 1 sends anything. The graphics card keeps the data for every frame after.",
        pane: 'math',
        mathStage: 'stored',
      },
      {
        narration: 'Every shape type works the same way. Here is a quad, also from a VBO, with its own buffers.',
        action: () => { addShape('QUADS', [{ x: -0.7, y: 0.55 }, { x: -0.3, y: 0.55 }, { x: -0.3, y: 0.85 }, { x: -0.7, y: 0.85 }], 'VBO'); },
        codeChangeFocus: ['vbo_QUADS'],
      },
      {
        narration: 'Upload once in init(), bind and draw every frame: that is the whole VBO pattern.',
        recap: {
          points: [
            'glGenBuffers, glBindBuffer and glBufferData put the corners on the graphics card once, in init().',
            'Each frame binds the buffer and draws from it, with no corners sent.',
          ],
          calls: ['glGenBuffers', 'glBindBuffer', 'glBufferData'],
        },
      },
    ],
  },
  'buffers-demo-4': {
    id: 'buffers-demo-4',
    title: 'Buffer Usage Hints',
    type: 'demo',
    section: 'Buffers',
    steps: [
      {
        narration: "glBufferData's last argument tells OpenGL how often the data will change, so the driver can keep it in the best place. Here it is GL_STATIC_DRAW.",
        focusPanel: 'buffers-panel',
        action: () => { addShape('TRIANGLES', TRIANGLE, 'VBO', 'STATIC'); },
        codeChangeFocus: ['GL_STATIC_DRAW'],
      },
      {
        narration: 'Static is for data set once and drawn many times, such as a logo or a level. The program has nothing to refresh.',
        focusPanel: 'buffers-panel',
      },
      {
        narration: 'Next you will see Dynamic, for data that changes now and then. What appears in the code?',
        focusPanel: 'buffers-panel',
        predict: {
          options: [
            { id: 'update', label: 'A function that updates the buffer', why: 'Data that changes must be sent again, so update_buffers() appears with glBufferSubData.' },
            { id: 'nothing', label: 'Only the word in glBufferData', why: 'The hint changes too, but changing data also needs code that sends it.' },
            { id: 'immediate', label: 'glBegin and glEnd come back', why: 'The shape still draws from its VBO; only the uploads change.' },
          ],
          correctId: 'update',
        },
        action: (state) => {
          const o = first(state);
          if (o) state.updateBufferUsage(o.id, 'DYNAMIC');
        },
      },
      {
        narration: 'update_buffers() binds the buffer and calls glBufferSubData, which copies new bytes over part or all of it. The hint is now GL_DYNAMIC_DRAW.',
        pane: 'code',
        codeChangeFocus: ['glBufferSubData', 'GL_DYNAMIC_DRAW'],
      },
      {
        narration: 'Who calls it? main() registers _vams_idle with glutIdleFunc, which GLUT calls whenever it has nothing else to do. Here it updates every frame so you can see where an update goes; a real program sends only when the data has changed.',
        pane: 'code',
        codeChangeFocus: ['glutIdleFunc'],
      },
      {
        narration: 'Stream is for data rebuilt every frame, such as particles. update_buffers() now re-uploads the position buffer with glBufferData and GL_STREAM_DRAW.',
        focusPanel: 'buffers-panel',
        action: (state) => {
          const o = first(state);
          if (o) state.updateBufferUsage(o.id, 'STREAM');
        },
        codeChangeFocus: ['GL_STREAM_DRAW'],
      },
      {
        narration: "In Math's Stored stage, the traffic row now lights up every frame: Stream sends each one. Static would light only frame 1.",
        pane: 'math',
        mathStage: 'stored',
      },
      {
        narration: 'The hint is a promise about your data. Keep it, and the driver can do its best.',
        recap: {
          points: [
            'GL_STATIC_DRAW: set once. GL_DYNAMIC_DRAW: changed now and then. GL_STREAM_DRAW: rebuilt every frame.',
            'Changing data is sent from update_buffers(), which runs from glutIdleFunc.',
          ],
          calls: ['glBufferData', 'glutIdleFunc'],
        },
      },
    ],
  },
  'buffers-demo-5': {
    id: 'buffers-demo-5',
    title: 'Updating in Place: glMapBuffer',
    type: 'demo',
    section: 'Buffers',
    steps: [
      {
        narration: 'A Dynamic buffer can be updated two ways. Sub Data sends bytes from your array; Map Buffer writes straight into the buffer.',
        focusPanel: 'buffers-panel',
        action: () => {
          const o = addShape('TRIANGLES', TRIANGLE, 'VBO', 'DYNAMIC');
          now().updateUpdateMethod(o.id, 'BUFFER_SUB_DATA');
        },
      },
      {
        narration: 'Right now update_buffers() calls glBufferSubData: change the array in your program, then copy it across.',
        focusPanel: 'buffers-panel',
        codeChangeFocus: ['glBufferSubData'],
      },
      {
        narration: 'Here the Update Method is Map Buffer instead. update_buffers() now asks for a pointer into the buffer and writes through it.',
        focusPanel: 'buffers-panel',
        action: (state) => {
          const o = first(state);
          if (o) state.updateUpdateMethod(o.id, 'MAP_BUFFER');
        },
        codeChangeFocus: ['glMapBuffer'],
      },
      {
        narration: 'glMapBuffer(GL_ARRAY_BUFFER, GL_WRITE_ONLY) maps the bound buffer. GL_WRITE_ONLY promises you will only write, so the driver need not copy the old contents to you.',
        pane: 'code',
        codeChangeFocus: ['GL_WRITE_ONLY'],
      },
      {
        narration: "Math's Stored stage walks through it. First, bind: every buffer call now works on this VBO.",
        pane: 'math',
        mathStage: 'stored',
        dmaStep: 0,
      },
      {
        narration: 'Map it: the driver hands back a pointer you can write to. The code checks it is not NULL before using it.',
        pane: 'math',
        mathStage: 'stored',
        dmaStep: 1,
      },
      {
        narration: 'ptr[0] = 0.5f writes the first number in place.',
        pane: 'math',
        mathStage: 'stored',
        dmaStep: 2,
      },
      {
        narration: 'ptr[1] = 0.7f writes the next one. Each index is one float further into the buffer.',
        pane: 'math',
        mathStage: 'stored',
        dmaStep: 3,
      },
      {
        narration: 'Two more writes. The cells you do not touch keep their old values.',
        pane: 'math',
        mathStage: 'stored',
        dmaStep: 4,
      },
      {
        narration: 'Which method changes numbers without keeping a copy of the array in your program?',
        pane: 'math',
        mathStage: 'stored',
        dmaStep: 4,
        predict: {
          options: [
            { id: 'map', label: 'Map Buffer', why: "You write through the driver's pointer; Sub Data copies from your own array." },
            { id: 'sub', label: 'Sub Data', why: 'glBufferSubData copies bytes from an array in your program, so you keep one.' },
            { id: 'neither', label: 'Neither', why: 'Mapping writes straight into the buffer, with no array of your own.' },
          ],
          correctId: 'map',
        },
        action: (state) => state.setDmaDriverStep(4),
      },
      {
        narration: 'Last, glUnmapBuffer finishes the writes. The pointer is no longer valid, and the buffer is ready to draw.',
        pane: 'math',
        mathStage: 'stored',
        dmaStep: 5,
        codeChangeFocus: ['glUnmapBuffer'],
      },
      {
        narration: 'Both methods end with the same buffer. Pick the one that matches how much of it changes.',
        recap: {
          points: [
            'glBufferSubData copies a range of bytes from your array into the buffer.',
            'glMapBuffer gives a pointer into the buffer; glUnmapBuffer finishes the writes.',
          ],
          calls: ['glMapBuffer', 'glUnmapBuffer'],
        },
      },
    ],
  },
  'buffers-exercise-1': {
    id: 'buffers-exercise-1',
    title: 'Switch to VBO',
    type: 'exercise',
    section: 'Buffers',
    steps: [
      {
        narration: 'Here is a triangle in immediate mode. Move its corners onto the graphics card.',
        focusPanel: 'buffers-panel',
        goals: [{ label: 'Drawn from a VBO', check: (state) => modeOf(first(state)) === 'VBO' }],
        task: 'Switch the triangle to VBO',
        hints: ['Select the triangle. Buffers is in its inspector.', 'Under Rendering Mode, pick VBO.'],
        action: () => { addShape('TRIANGLES', TRIANGLE); },
        solve: (state) => {
          const o = first(state);
          if (o) state.updateRenderingMode(o.id, 'VBO');
        },
      },
      {
        narration: 'How your code does it: init() uploads the corners once with glBufferData, and the draw function binds the buffer and calls glDrawArrays.',
        pane: 'code',
        codeChangeFocus: ['glBufferData', 'glDrawArrays'],
      },
      {
        narration: 'Add a quad and draw it from a VBO too.',
        focusPanel: 'buffers-panel',
        goals: [{ label: 'A quad drawn from a VBO', check: (state) => shapes(state).some((o) => o.type === 'QUADS' && modeOf(o) === 'VBO') }],
        task: 'Add a quad and switch it to VBO',
        hints: ['In Add, pick Quads and click four corners, then press Enter.', 'Then, in its Buffers group, pick VBO.'],
        solve: () => { addShape('QUADS', SQUARE, 'VBO'); },
      },
      {
        narration: 'Each shape gets its own buffers, made in init(): look for vbo_ and cbo_ with the quad\'s name.',
        pane: 'code',
        codeChangeFocus: ['glGenBuffers'],
      },
      {
        narration: 'Two shapes, uploaded once each.',
        recap: {
          points: ['A VBO is uploaded once in init() and drawn from every frame.', 'Every shape has its own position and colour buffers.'],
          calls: ['glGenBuffers', 'glDrawArrays'],
        },
      },
    ],
  },
  'buffers-exercise-2': {
    id: 'buffers-exercise-2',
    title: 'Use Static for Unchanging Data',
    type: 'exercise',
    section: 'Buffers',
    steps: [
      {
        narration: 'This logo never moves and never changes shape, but its buffer is marked Dynamic. Choose the right hint.',
        focusPanel: 'buffers-panel',
        goals: [{ label: 'The logo is Static', check: (state) => usageOf(first(state)) === 'STATIC' && modeOf(first(state)) === 'VBO' }],
        task: 'Set the logo to Static',
        hints: ['Select the logo. Buffer Usage is in its Buffers group.', 'Data set once and drawn many times is Static.'],
        action: () => { addShape('QUADS', SQUARE, 'VBO', 'DYNAMIC'); },
        solve: (state) => {
          const o = first(state);
          if (o) state.updateBufferUsage(o.id, 'STATIC');
        },
      },
      {
        narration: 'How your code does it: glBufferData now ends in GL_STATIC_DRAW, and update_buffers() and its glutIdleFunc are gone: there is nothing to refresh.',
        pane: 'code',
        codeChangeFocus: ['GL_STATIC_DRAW'],
      },
      {
        narration: 'This new triangle is a spark that is rebuilt every frame. Give it the hint for that.',
        focusPanel: 'buffers-panel',
        goals: [{ label: 'The spark is Stream', check: (state) => usageOf(first(state)) === 'STREAM' && modeOf(first(state)) === 'VBO' }],
        task: 'Set the spark to Stream',
        hints: ['The spark is the newest shape, at the top of Scene.', 'Data rebuilt every frame is Stream.'],
        action: () => { addShape('TRIANGLES', [{ x: 0.6, y: 0.5 }, { x: 0.8, y: 0.5 }, { x: 0.7, y: 0.7 }], 'VBO', 'STATIC'); },
        solve: (state) => {
          const o = first(state);
          if (o) state.updateBufferUsage(o.id, 'STREAM');
        },
      },
      {
        narration: 'Now update_buffers() re-uploads the spark with glBufferData and GL_STREAM_DRAW every frame, while the logo is left alone.',
        pane: 'code',
        codeChangeFocus: ['GL_STREAM_DRAW'],
      },
      {
        narration: 'Each buffer gets the hint that matches how its data behaves.',
        recap: {
          points: ['GL_STATIC_DRAW for data that never changes.', 'GL_STREAM_DRAW for data rebuilt every frame.'],
          calls: ['glBufferData'],
        },
      },
    ],
  },
  'buffers-exercise-3': {
    id: 'buffers-exercise-3',
    title: 'Reduce Memory with Indexed Drawing',
    type: 'exercise',
    section: 'Buffers',
    steps: [
      {
        narration: 'This square is two triangles: six corners, but only four different ones. Store each corner once.',
        focusPanel: 'buffers-panel',
        goals: [{ label: 'Indexed drawing on', check: (state) => !!first(state)?.useIndexed }],
        task: 'Switch on indexed drawing',
        hints: ['Select the square. Indexed Drawing is at the bottom of its Buffers group.', 'Switch on Deduplicate vertices.'],
        action: () => { addShape('TRIANGLES', TWO_TRIANGLES, 'VERTEX_ARRAY'); },
        solve: (state) => {
          const o = first(state);
          if (o) state.updateUseIndexed(o.id, true);
        },
      },
      {
        narration: 'How your code does it: verts_ now holds four corners, and indices_ lists which corner each of the six slots uses: 0, 1, 2, 1, 3, 2.',
        pane: 'code',
        codeChangeFocus: ['GLuint indices_'],
      },
      {
        narration: 'glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, indices_…) draws six slots, reading each index as an unsigned int.',
        pane: 'code',
        codeChangeFocus: ['glDrawElements'],
      },
      {
        narration: "Array vs indexed in Math's Stored stage compares the memory: four stored corners and six small indices take less than six full corners.",
        pane: 'math',
        mathStage: 'stored',
      },
      {
        narration: 'Now keep the indices on the graphics card too: switch the square to VBO.',
        focusPanel: 'buffers-panel',
        goals: [{ label: 'Drawn from a VBO', check: (state) => modeOf(first(state)) === 'VBO' && !!first(state)?.useIndexed }],
        task: 'Switch the square to VBO',
        hints: ['Under Rendering Mode, pick VBO. Leave indexed drawing on.'],
        solve: (state) => {
          const o = first(state);
          if (!o) return;
          state.updateRenderingMode(o.id, 'VBO');
          if (!now().objects.find((x) => x.id === o.id)?.useIndexed) now().updateUseIndexed(o.id, true);
        },
      },
      {
        narration: 'The indices get a buffer of their own, bound to GL_ELEMENT_ARRAY_BUFFER, and glDrawElements now reads them from it.',
        pane: 'code',
        codeChangeFocus: ['GL_ELEMENT_ARRAY_BUFFER'],
      },
      {
        narration: 'Shared corners are stored once and named by index.',
        recap: {
          points: [
            'An index array lists which stored corner each slot uses.',
            'glDrawElements draws through the indices; with a VBO they live in a GL_ELEMENT_ARRAY_BUFFER.',
          ],
          calls: ['glDrawElements'],
        },
      },
    ],
  },
  'buffers-exercise-4': {
    id: 'buffers-exercise-4',
    title: 'Pick the Right Usage Hint',
    type: 'exercise',
    section: 'Buffers',
    steps: [
      {
        narration: 'Three programs, three kinds of data. Pick the usage hint for each.',
      },
      {
        narration: 'A particle system rebuilds every particle every frame.',
        task: 'Pick the hint',
        hints: ['How often is the data replaced?'],
        exercise: {
          kind: 'multiple-choice',
          prompt: 'Which usage hint fits particles rebuilt every frame?',
          options: [
            { id: 'stream', label: 'GL_STREAM_DRAW' },
            { id: 'static', label: 'GL_STATIC_DRAW' },
            { id: 'dynamic', label: 'GL_DYNAMIC_DRAW' },
          ],
          correctId: 'stream',
        },
      },
      {
        narration: 'A game level is loaded once and drawn for the whole level.',
        task: 'Pick the hint',
        hints: ['Does the data ever change after it is uploaded?'],
        exercise: {
          kind: 'multiple-choice',
          prompt: 'Which usage hint fits a level that never changes?',
          options: [
            { id: 'dynamic', label: 'GL_DYNAMIC_DRAW' },
            { id: 'static', label: 'GL_STATIC_DRAW' },
            { id: 'stream', label: 'GL_STREAM_DRAW' },
          ],
          correctId: 'static',
        },
      },
      {
        narration: 'A drawing program changes a shape only when the user drags one of its corners.',
        task: 'Pick the hint',
        hints: ['The data changes, but not every frame.'],
        exercise: {
          kind: 'multiple-choice',
          prompt: 'Which usage hint fits data changed now and then?',
          options: [
            { id: 'static', label: 'GL_STATIC_DRAW' },
            { id: 'stream', label: 'GL_STREAM_DRAW' },
            { id: 'dynamic', label: 'GL_DYNAMIC_DRAW' },
          ],
          correctId: 'dynamic',
        },
      },
      {
        narration: 'Here is a Stream buffer: its glBufferData runs in init() and again every frame in update_buffers().',
        action: () => { addShape('TRIANGLES', TRIANGLE, 'VBO', 'STREAM'); },
        recap: {
          points: ['Static: set once. Dynamic: changed now and then. Stream: rebuilt every frame.'],
          calls: ['glBufferData'],
        },
      },
    ],
  },
  'buffers-exercise-5': {
    id: 'buffers-exercise-5',
    title: 'Build a VBO by Hand',
    type: 'exercise',
    section: 'Buffers',
    steps: [
      {
        narration: "The section's last exercise: set up a shape's buffer, then write the calls that upload and draw it.",
      },
      {
        narration: 'Add any shape, draw it from a VBO, and mark its data as never changing.',
        focusPanel: 'buffers-panel',
        goals: [
          { label: 'A shape drawn from a VBO', check: (state) => shapes(state).some((o) => modeOf(o) === 'VBO') },
          { label: 'Its usage is Static', check: (state) => modeOf(capstoneShape(state)) === 'VBO' && usageOf(capstoneShape(state)) === 'STATIC' },
          { label: 'Indexed drawing off', check: (state) => modeOf(capstoneShape(state)) === 'VBO' && !capstoneShape(state)?.useIndexed },
        ],
        task: 'Set up a Static VBO shape',
        hints: [
          'Add a shape from Add, then open its Buffers group.',
          'Rendering Mode: VBO. Buffer Usage: Static. Leave Deduplicate vertices off.',
        ],
        solve: (state) => {
          const o = capstoneShape(state);
          if (!o) {
            addShape('TRIANGLES', TRIANGLE, 'VBO', 'STATIC');
            return;
          }
          if (modeOf(o) !== 'VBO') state.updateRenderingMode(o.id, 'VBO');
          now().updateBufferUsage(o.id, 'STATIC');
          if (o.useIndexed) now().updateUseIndexed(o.id, false);
        },
      },
      {
        narration: 'In init(), first make a name for the buffer.',
        task: 'Name the call',
        hints: ['It generates buffer names.'],
        exercise: {
          kind: 'code',
          template: '{0}(1, &vbo);',
          blanks: [{ answer: () => 'glGenBuffers', wrong: 'not the call that makes a buffer name' }],
        },
      },
      {
        narration: 'Select it as the buffer for corner data.',
        task: 'Name the target',
        hints: ['Corner data goes in an array buffer.'],
        exercise: {
          kind: 'code',
          template: 'glBindBuffer({0}, vbo);',
          blanks: [{ answer: () => 'GL_ARRAY_BUFFER', wrong: 'not the target for corner data' }],
        },
      },
      {
        narration: 'Upload the corners with your usage hint.',
        task: 'Fill in the hint',
        hints: ['Your shape is Static.'],
        exercise: {
          kind: 'code',
          template: 'glBufferData(GL_ARRAY_BUFFER, sizeof(verts), verts, {0});',
          blanks: [{ answer: (state) => `GL_${usageOf(capstoneShape(state))}_DRAW`, wrong: "that's not your shape's hint" }],
        },
      },
      {
        narration: 'In the draw function, describe the data: how many numbers per corner, and their type.',
        task: 'Fill in the size and type',
        hints: ['Each corner is an x and a y.', 'They are floats.'],
        exercise: {
          kind: 'code',
          template: 'glVertexPointer({0}, {1}, 0, 0);',
          blanks: [
            { answer: () => 2, wrong: 'not the numbers per corner' },
            { answer: () => 'GL_FLOAT', wrong: 'not the type of each number' },
          ],
        },
      },
      {
        narration: 'Draw it: the mode, the first corner and the number of corners.',
        task: 'Fill in the mode and count',
        hints: ["The mode matches your shape's type.", 'Count its corners, or read the count from the code panel.'],
        exercise: {
          kind: 'code',
          template: 'glDrawArrays({0}, 0, {1});',
          blanks: [
            { answer: (state) => `GL_${capstoneShape(state)?.type ?? 'TRIANGLES'}`, wrong: "that's not your shape's mode" },
            { answer: (state) => capstoneShape(state)?.vertices.length ?? 3, wrong: "that's not its number of corners" },
          ],
        },
      },
      {
        narration: 'You set up a buffer by hand. Next, Transforms: moving, turning and scaling what you draw.',
        recap: {
          points: [
            'Make, bind and fill a buffer once: glGenBuffers, glBindBuffer, glBufferData.',
            'Each frame, glVertexPointer describes it and glDrawArrays draws it.',
            'The usage hint says how often the data will change.',
          ],
          calls: ['glGenBuffers', 'glBufferData', 'glDrawArrays'],
        },
      },
    ],
  },
};
