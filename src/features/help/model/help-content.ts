import type { CurriculumSection } from '@/core/store/types';
import type { HelpBlock, HelpCategory, HelpTopic, HelpTopicId } from './types';

/** Display order of the left-nav categories. */
export const HELP_CATEGORIES: HelpCategory[] = [
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'workspace', label: 'The Workspace' },
  { id: 'sections', label: 'Section Guides' },
  { id: 'panels', label: 'Panels & Tools' },
  { id: 'reference', label: 'Reference' },
];

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'welcome',
    category: 'getting-started',
    title: 'Welcome to VAMS',
    summary: 'What VAMS is and how it helps you learn OpenGL 1.5.',
    keywords: ['intro', 'introduction', 'start', 'opengl', 'overview', 'fixed function'],
    blocks: [
      {
        kind: 'paragraph',
        text: 'VAMS (Visual Animation Modeling Simulator) is a teaching tool for the OpenGL 1.5 fixed-function pipeline. You build a scene visually and VAMS shows you the exact OpenGL/C++ code and the math behind it, in real time — so you can connect what you see on screen to the code that produces it.',
      },
      {
        kind: 'paragraph',
        text: 'It is built for students meeting OpenGL for the first time. There is nothing to install and no compiler to configure: shape geometry on the canvas, then read across to the generated code to learn how a real GLUT program would draw the same thing.',
      },
      { kind: 'heading', text: 'What you can do' },
      {
        kind: 'list',
        items: [
          'Create every OpenGL 1.5 primitive and edit its vertices, colour, and line style.',
          'Switch geometry between immediate mode, vertex arrays, and VBOs — and see the code change.',
          'Translate, rotate, scale, and group objects, and set the orthographic view.',
          'Give GLUT callbacks rules and press Run to play them, including idle rules that animate a shape every frame.',
          'Upload textures and map them onto shapes with a UV editor.',
          'Follow guided, narrated lessons with built-in exercises.',
        ],
      },
      { kind: 'heading', text: 'Getting started in three steps' },
      {
        kind: 'list',
        ordered: true,
        items: [
          'Add a shape from the Add panel on the rail (or click “Add a shape” on the empty canvas).',
          'Watch the generated OpenGL code appear on the right.',
          'Select the shape and edit its colour or position in the Scene panel — notice the code and math update live.',
        ],
      },
      {
        kind: 'callout',
        tone: 'tip',
        text: 'New here? Take the tour from the Workspace Tour topic: six short steps through the workspace. Press ? or F1 any time to reopen this Help Centre.',
      },
    ],
    related: ['workspace-tour', 'canvas-basics', 'modes', 'shortcuts'],
  },
  {
    id: 'workspace-tour',
    category: 'workspace',
    title: 'Workspace tour',
    summary: 'The rail and its panels on the left, the canvas in the centre, code and math on the right.',
    keywords: ['layout', 'panels', 'rail', 'regions', 'tour', 'top bar', 'add', 'scene', 'settings', 'callbacks', 'inspector', 'hide', 'code', 'math', 'learn', 'lesson bar', 'file menu', 'view settings', 'view menu', 'window', 'run', 'share', 'rename'],
    blocks: [
      { kind: 'start-tour' },
      {
        kind: 'paragraph',
        text: 'The screen has a top bar and three working regions. Each region has a single job, so you always know where to look.',
      },
      { kind: 'heading', text: 'Three regions' },
      {
        kind: 'list',
        items: [
          'Left — Build. A rail of four panels: Add, Scene, Settings and Callbacks. One panel shows at a time.',
          'Centre — See. The canvas, where your scene is drawn and where you place vertices. The canvas is drawn as your program’s window, with the View menu and Run in the header above it.',
          'Right — Read. The generated OpenGL code, or the math behind it, with a Code / Math switch at the top.',
        ],
      },
      {
        kind: 'paragraph',
        text: 'The top bar holds File and Learn, then your scene’s name: click it to rename the scene, and the note beside it says whether the scene is saved. On the right are undo and redo, Settings (the theme and the keyboard shortcuts), Help and Share. The canvas is drawn as your program’s window, titled VAMS Preview with its size, the same title and size the generated main() gives it. The header above it shows the viewing volume, the cursor position when the coordinate tracker is on, the View menu (axes, gridlines, grid numbers and the tracker) and Run. If Run can’t start, click it: it tells you why and offers a button that fixes it.',
      },
      {
        kind: 'paragraph',
        text: 'The window works like a window on your desktop. It opens, and maximises, in the viewing volume’s shape, so a square draws square; dragging an edge stretches it. Drag its title bar to move it; that changes nothing in your drawing or your code. Drag its right edge, bottom edge or corner to resize it: the scene stretches to fill the window, and the size in glutInitWindowSize follows. The — button minimises it and the ▢ button maximises or restores it (double-clicking the title bar does the same). ✕ closes it and stops a running program; the chip at the bottom of the stage, or pressing Run, brings it back.',
      },
      { kind: 'heading', text: 'The rail and its panels' },
      {
        kind: 'definitions',
        items: [
          { term: 'Add', description: 'The ten primitives by their OpenGL names, in three groups, plus Text and a few prepared sample scenes. Pick a primitive, then click its vertices on the canvas.' },
          { term: 'Scene', description: 'The scene list, with Select several, Group, Duplicate and Delete in its toolbar, and below it the selected object’s inspector: Vertices, Buffers, Transform, Appearance and Texture, in pipeline order. Each group header names its OpenGL call. Selecting an object always opens this panel.' },
          { term: 'Settings', description: 'The scene’s own settings: Background and Viewing volume.' },
          { term: 'Callbacks', description: 'The GLUT callbacks your program registers, with their rules. The badge on the rail counts the callbacks that are on.' },
          { term: 'Hide', description: 'Hides the panel to give the canvas more room. Any rail item, a selection or a lesson step shows it again.' },
        ],
      },
      { kind: 'heading', text: 'Code and math' },
      {
        kind: 'paragraph',
        text: 'The right column shows one thing at a time. Code is the C++ program generated from your scene; Math follows one vertex of the selected shape through the pipeline, with your numbers. A dot on Code means the code changed while you were reading Math. Hide code and math folds the column to a thin tab at the edge; click the tab to bring it back.',
      },
      { kind: 'heading', text: 'Learn: the course map' },
      {
        kind: 'paragraph',
        text: 'The Learn button in the top bar opens the course map: the five sections in pipeline order, each section’s demos and exercises, and your progress, stored in this browser. Choosing a section only changes what the map shows; starting a lesson makes its section the current one.',
      },
      {
        kind: 'table',
        headers: ['Section', 'What it covers'],
        rows: [
          ['Pipeline', 'How vertices become pixels: NDC, rasterisation, GLUT structure'],
          ['Primitives', 'Points, lines, triangles, colour, line style, and text'],
          ['Buffers', 'Immediate mode, vertex arrays, VBOs, and memory layout'],
          ['Transforms', 'Translate, rotate, scale, the matrix stack, and glOrtho'],
          ['Textures', 'Images, UV mapping, filtering, and wrapping'],
        ],
      },
      { kind: 'heading', text: 'The lesson bar' },
      {
        kind: 'paragraph',
        text: 'While a lesson runs, the lesson bar sits along the bottom of the canvas with the narration, the step, and Back, Next and Exit. Fold it to a slim strip when you need the room. The editor stays live: each step opens the panel its control lives in and outlines the control.',
      },
      { kind: 'heading', text: 'The top bar' },
      {
        kind: 'list',
        items: [
          'Learn — open the course map and start a demo or an exercise.',
          'File — start a new workspace, open My scenes, open or save a project file, or export the C++ code.',
          'Undo / Redo — step backward and forward through your edits.',
          'Scene name — click it to rename the scene. The note beside it shows whether the scene is saved: Saving…, Saved or Not saved.',
          'Settings — choose the theme and open the shortcut list.',
          'Share — make a link and a QR code for your scene.',
          'Help — open this Help Centre (also ? or F1).',
        ],
      },
      {
        kind: 'callout',
        tone: 'info',
        text: 'The editor’s tools are the same in every section. Select an object to edit it in the Scene panel; the scene’s own settings are in the Settings panel on the rail, and the view options are in the View menu beside Run.',
      },
    ],
    related: ['canvas-basics', 'scene-hierarchy', 'code-panel', 'math-panel', 'saving-loading'],
  },
  {
    id: 'canvas-basics',
    category: 'workspace',
    title: 'Working with the canvas',
    summary: 'Selecting objects, placing vertices, snapping, and the coordinate system.',
    keywords: ['canvas', 'select', 'vertex', 'snap', 'grid', 'coordinates', 'viewport', 'ndc'],
    blocks: [
      { kind: 'heading', text: 'The coordinate system' },
      {
        kind: 'paragraph',
        text: 'The canvas shows your world coordinates. By default the visible window runs from -1 to 1 on both axes — the same Normalised Device Coordinates (NDC) that OpenGL clips against. The origin (0, 0) sits at the centre; X increases to the right and Y increases upward, matching OpenGL (not screen pixels, where Y points down).',
      },
      { kind: 'heading', text: 'Selecting objects' },
      {
        kind: 'paragraph',
        text: 'Click an object to select it; click empty space to deselect. The selected object is highlighted and the inspector on the left shows its groups. You can also select it from the list in the Scene panel.',
      },
      { kind: 'heading', text: 'Placing vertices' },
      {
        kind: 'paragraph',
        text: 'When you start a custom shape, the canvas enters vertex-placement mode and the canvas header shows the keys: Click to place, Enter to finish, Backspace to undo the last vertex and Esc to cancel. Click to drop each vertex in order; the shape needs a minimum number of vertices before it can be finished.',
      },
      { kind: 'heading', text: 'Running your program' },
      {
        kind: 'paragraph',
        text: 'Press Run in the canvas header to play your callbacks. Keys, clicks and drags go to your handlers, and the program window’s title bar shows the last call GLUT made. Drag the window’s edges or corner to resize it. Press Esc or Stop to end the run: your scene is just as you built it.',
      },
      { kind: 'shortcuts' },
      { kind: 'heading', text: 'Grid snapping & coordinates' },
      {
        kind: 'paragraph',
        text: 'Turn on grid snapping so clicks land on tidy increments instead of arbitrary decimals — useful for clean, predictable geometry. The coordinate tracker (switch it on in the View menu beside Run) shows the world X/Y under your cursor as you move.',
      },
      {
        kind: 'callout',
        tone: 'tip',
        text: 'Changing the orthographic window (the Viewing volume group in the Settings panel) zooms and pans what the canvas shows without moving your objects.',
      },
    ],
    related: ['section-primitives', 'section-transforms', 'shortcuts'],
  },
  {
    id: 'modes',
    category: 'getting-started',
    title: 'Author mode vs lessons',
    summary: 'The difference between free building and guided, narrated lessons.',
    keywords: ['lesson', 'author', 'mode', 'guided', 'exercise', 'demo', 'narration'],
    blocks: [
      {
        kind: 'paragraph',
        text: 'VAMS has two modes that share the same workspace.',
      },
      {
        kind: 'definitions',
        items: [
          {
            term: 'Author mode',
            description:
              'The free sandbox. Build anything you like; your scene is saved automatically in the browser and can be exported to a project file.',
          },
          {
            term: 'Lesson mode',
            description:
              'A guided, narrated walk-through that drives the scene step by step and includes short exercises (multiple-choice and ordering tasks) that check your understanding.',
          },
        ],
      },
      { kind: 'heading', text: 'Running a lesson' },
      {
        kind: 'paragraph',
        text: 'Open Learn in the top bar, choose a section, and start one of its demos or exercises. Your sandbox scene is set aside while the lesson runs and restored automatically when you leave, so you never lose your own work.',
      },
      {
        kind: 'paragraph',
        text: 'The lesson bar sits along the bottom of the canvas, and each step opens the panel its control lives in and outlines the control. Demos also dim the other groups, exercises only outline, and a section’s last exercise leaves you to find the controls yourself.',
      },
      { kind: 'callout', tone: 'info', text: 'Learn ticks the lessons you finish and marks a lesson you leave part way as in progress; starting it again begins at step 1. Starting another lesson from Learn asks before leaving the one that is running.' },
    ],
    related: ['welcome', 'workspace-tour'],
  },
  {
    id: 'section-pipeline',
    category: 'sections',
    title: 'Pipeline',
    summary: 'The OpenGL rendering pipeline, NDC, rasterisation, and GLUT program structure.',
    keywords: ['pipeline', 'ndc', 'raster', 'rasterization', 'glut', 'stages', 'display', 'mainloop'],
    section: 'Pipeline',
    blocks: [
      {
        kind: 'paragraph',
        text: 'The Pipeline section explains how vertices travel from your code to pixels on screen. In this section the canvas header has a switch between three views: Playground, Diagram and Raster vs vector. It is there in your own scenes and during lessons.',
      },
      {
        kind: 'definitions',
        items: [
          { term: 'Coordinate Playground', description: 'The live editing canvas, so you can experiment while thinking about the pipeline.' },
          { term: 'Pipeline Diagram', description: 'A strip of the stages in order, each drawn with your selected shape (or a triangle when the scene is empty), with the program line that does that stage. Click a stage, or use the arrow keys, to see it large.' },
          { term: 'Raster vs. Vector', description: 'Your shape as exact vector geometry beside the pixels OpenGL fills for it. Change the pixels across, and turn GLUT_MULTISAMPLE on or off to see the edges soften.' },
        ],
      },
      { kind: 'heading', text: 'From vertex to pixel' },
      {
        kind: 'list',
        ordered: true,
        items: [
          'Vertices are specified in world coordinates.',
          'The projection (glOrtho) maps them into the clip/NDC cube (-1 to 1).',
          'The viewport transform maps NDC to window pixels.',
          'Rasterisation fills the primitive’s pixels (fragments).',
          'Per-vertex colours are interpolated across each fragment.',
        ],
      },
      { kind: 'heading', text: 'A minimal GLUT program' },
      {
        kind: 'paragraph',
        text: 'Every OpenGL 1.5 program VAMS generates is built around GLUT. The skeleton looks like this:',
      },
      {
        kind: 'code',
        code: 'int main(int argc, char** argv) {\n    glutInit(&argc, argv);\n    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB);\n    glutInitWindowSize(800, 800);\n    glutCreateWindow("VAMS");\n    init();                  // one-time setup\n    glutDisplayFunc(display); // draw callback\n    glutMainLoop();          // hand control to GLUT\n    return 0;\n}',
      },
      {
        kind: 'callout',
        tone: 'info',
        text: 'VAMS only ever emits OpenGL 1.5 fixed-function calls for a 2D scene, so the generated code always matches the curriculum.',
      },
    ],
    related: ['code-panel', 'math-panel', 'glossary'],
  },
  {
    id: 'section-primitives',
    category: 'sections',
    title: 'Primitives',
    summary: 'Points, lines, triangles, quads and polygons, plus colour, line style, and text.',
    keywords: ['primitive', 'triangle', 'line', 'quad', 'polygon', 'color', 'stipple', 'text', 'glcolor', 'glvertex'],
    section: 'Primitives',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Build geometry from the ten OpenGL 1.5 primitive types. Add a shape, then edit its vertices, per-vertex colour, and line styling. Each primitive interprets your vertex list differently.',
      },
      {
        kind: 'table',
        headers: ['Primitive', 'Draws'],
        rows: [
          ['GL_POINTS', 'One dot per vertex'],
          ['GL_LINES', 'A separate segment for each pair of vertices'],
          ['GL_LINE_STRIP', 'A connected open path through all vertices'],
          ['GL_LINE_LOOP', 'A line strip that also closes back to the start'],
          ['GL_TRIANGLES', 'A separate triangle for each group of three vertices'],
          ['GL_TRIANGLE_STRIP', 'A strip of triangles sharing edges'],
          ['GL_TRIANGLE_FAN', 'Triangles fanning out from the first vertex'],
          ['GL_QUADS', 'A four-sided shape per group of four vertices'],
          ['GL_QUAD_STRIP', 'A strip of connected quads'],
          ['GL_POLYGON', 'A single convex polygon through all vertices'],
        ],
      },
      { kind: 'heading', text: 'Immediate-mode drawing' },
      {
        kind: 'paragraph',
        text: 'In immediate mode each shape is drawn between glBegin and glEnd, with a colour and position for each vertex:',
      },
      {
        kind: 'code',
        code: 'glBegin(GL_TRIANGLES);\n    glColor3f(1.0f, 0.0f, 0.0f); glVertex2f(-0.5f, -0.5f);\n    glColor3f(0.0f, 1.0f, 0.0f); glVertex2f( 0.5f, -0.5f);\n    glColor3f(0.0f, 0.0f, 1.0f); glVertex2f( 0.0f,  0.5f);\nglEnd();',
      },
      { kind: 'heading', text: 'Colour modes' },
      {
        kind: 'paragraph',
        text: 'Each object can use float colour (glColor3f, components 0.0–1.0) or byte colour (glColor3ub, components 0–255). They describe the same colours; the math panel shows the conversion.',
      },
      {
        kind: 'table',
        headers: ['Float (glColor3f)', 'Byte (glColor3ub)', 'Colour'],
        rows: [
          ['1.0, 0.0, 0.0', '255, 0, 0', 'Red'],
          ['0.0, 1.0, 0.0', '0, 255, 0', 'Green'],
          ['0.5, 0.5, 0.5', '128, 128, 128', 'Grey'],
        ],
      },
      { kind: 'heading', text: 'Line styling & text' },
      {
        kind: 'list',
        items: [
          'Line width — glLineWidth makes lines thicker.',
          'Stipple — glLineStipple dashes a line using a 16-bit on/off pattern and a repeat factor.',
          'Text — bitmap text is drawn with glRasterPos2f to set where each line starts and glutBitmapCharacter for each glyph. The letters are GLUT_BITMAP_9_BY_15: always 9 × 15 window pixels, running right from the raster position, whatever the scale, rotation or viewing volume.',
        ],
      },
      {
        kind: 'callout',
        tone: 'tip',
        text: 'Give a triangle three different vertex colours to see barycentric interpolation: OpenGL blends the corner colours smoothly across the face. The math panel shows the weights.',
      },
      { kind: 'heading', text: 'GLUT callbacks' },
      {
        kind: 'paragraph',
        text: 'The Callbacks panel on the rail is where you register GLUT event handlers (keyboard, mouse, idle, and more) that appear in the generated program. See the GLUT Callbacks guide.',
      },
    ],
    related: ['canvas-basics', 'math-panel', 'section-buffers', 'callbacks', 'glossary'],
  },
  {
    id: 'section-buffers',
    category: 'sections',
    title: 'Buffers',
    summary: 'Immediate mode, vertex arrays, VBOs, usage hints, and indexed drawing.',
    keywords: ['buffer', 'vbo', 'vertex array', 'immediate', 'indexed', 'dma', 'memory', 'gldrawarrays', 'glbufferdata'],
    section: 'Buffers',
    blocks: [
      {
        kind: 'paragraph',
        text: 'The Buffers section covers how geometry is stored and sent to the GPU. Switch an object between three rendering modes and watch the generated code change structurally — not just cosmetically.',
      },
      {
        kind: 'table',
        headers: ['Mode', 'How geometry is sent', 'Key calls'],
        rows: [
          ['Immediate', 'One vertex at a time, every frame', 'glBegin / glVertex / glEnd'],
          ['Vertex Array', 'Client-side arrays, drawn in one call', 'glVertexPointer / glDrawArrays'],
          ['VBO', 'Uploaded once into GPU memory, reused', 'glGenBuffers / glBufferData / glDrawArrays'],
        ],
      },
      { kind: 'heading', text: 'Usage hints (VBOs)' },
      {
        kind: 'paragraph',
        text: 'When you upload a VBO you tell the driver how you intend to use it, so it can place the memory wisely:',
      },
      {
        kind: 'definitions',
        items: [
          { term: 'GL_STATIC_DRAW', description: 'Set the data once and draw it many times. Best for geometry that never changes.' },
          { term: 'GL_DYNAMIC_DRAW', description: 'Update the data occasionally and draw it many times.' },
          { term: 'GL_STREAM_DRAW', description: 'Set the data and use it only a few times — typically once per frame.' },
        ],
      },
      { kind: 'heading', text: 'Indexed drawing' },
      {
        kind: 'paragraph',
        text: 'Indexed drawing stores each unique vertex once and uses an index list to reference them, switching the draw call to glDrawElements. Shapes that reuse vertices (like a quad made of two triangles) save memory this way. The math panel compares the byte cost of array vs indexed.',
      },
      {
        kind: 'code',
        code: '// Upload once, in init():\nglGenBuffers(1, &vbo);\nglBindBuffer(GL_ARRAY_BUFFER, vbo);\nglBufferData(GL_ARRAY_BUFFER, sizeof(verts), verts, GL_STATIC_DRAW);\n\n// Draw every frame:\nglDrawArrays(GL_TRIANGLES, 0, vertexCount);',
      },
      {
        kind: 'callout',
        tone: 'info',
        text: 'VBO uploads are hoisted into a one-time init() function in the generated code, while drawing stays in display() — exactly how a real program separates setup from rendering.',
      },
    ],
    related: ['code-panel', 'math-panel', 'section-primitives', 'glossary'],
  },
  {
    id: 'section-transforms',
    category: 'sections',
    title: 'Transforms',
    summary: 'Translation, rotation, scale, the matrix stack, and orthographic viewing.',
    keywords: ['transform', 'matrix', 'translate', 'rotate', 'scale', 'ortho', 'stack', 'hierarchy', 'pushmatrix'],
    section: 'Transforms',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Move, rotate, and scale objects with the Transform group’s scale pad, rotate dial and numbers, or drag a shape on the canvas to move it. Every transform corresponds to a fixed-function matrix call.',
      },
      {
        kind: 'table',
        headers: ['Action', 'OpenGL call'],
        rows: [
          ['Translate', 'glTranslatef(x, y, 0)'],
          ['Rotate', 'glRotatef(angle, 0, 0, 1)'],
          ['Scale', 'glScalef(sx, sy, 1)'],
          ['Set the view', 'glOrtho(left, right, bottom, top, ...)'],
        ],
      },
      { kind: 'heading', text: 'The matrix stack & hierarchy' },
      {
        kind: 'paragraph',
        text: 'Grouping objects builds a parent-child hierarchy that maps to nested glPushMatrix / glPopMatrix pairs: a child inherits its parent’s transform, then adds its own. Push saves the current matrix, pop restores it.',
      },
      {
        kind: 'code',
        code: 'glPushMatrix();\n    glTranslatef(0.3f, 0.0f, 0.0f); // parent\n    drawParent();\n    glPushMatrix();\n        glRotatef(45.0f, 0, 0, 1);  // child, relative to parent\n        drawChild();\n    glPopMatrix();\nglPopMatrix();',
      },
      { kind: 'heading', text: 'Orthographic viewing' },
      {
        kind: 'paragraph',
        text: 'glOrtho defines the viewing window — the range of world coordinates mapped onto the viewport. Widening the window zooms out; narrowing it zooms in. The math panel shows the window-to-viewport mapping.',
      },
      {
        kind: 'callout',
        tone: 'tip',
        text: 'Non-uniform scale (different X and Y) stretches a shape. Use the aspect-lock toggle to scale both axes together.',
      },
      { kind: 'heading', text: 'Animating a transform' },
      {
        kind: 'paragraph',
        text: 'To animate a transform, switch on the Idle callback in the Callbacks panel and give it a rule such as "rotate Triangle by 2°". GLUT calls it every frame, so the transform changes a little each frame. Press Run to watch it. See the GLUT Callbacks guide for details.',
      },
    ],
    related: ['code-panel', 'math-panel', 'callbacks', 'glossary'],
  },
  {
    id: 'section-textures',
    category: 'sections',
    title: 'Textures',
    summary: 'Uploading textures, attaching them to objects, filtering, wrapping, and UVs.',
    keywords: ['texture', 'uv', 'filter', 'wrap', 'image', 'mapping', 'glteximage2d', 'mipmap'],
    section: 'Textures',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Textures paint an image onto your geometry. Select a shape, pick a sample or upload your own image in its Texture group, then place it with the UV coordinates underneath.',
      },
      { kind: 'heading', text: 'How it works' },
      {
        kind: 'list',
        ordered: true,
        items: [
          'Select a triangle, quad or polygon and open its Texture group.',
          'Pick a sample, or upload your own image with the + tile.',
          'Adjust per-vertex UV coordinates so the image lands where you want.',
          'Choose filtering and wrapping to control sampling.',
        ],
      },
      { kind: 'heading', text: 'Filtering & wrapping' },
      {
        kind: 'definitions',
        items: [
          { term: 'Filtering', description: 'How the texture is sampled when scaled. Nearest is blocky and sharp; linear is smooth and blurred.' },
          { term: 'Wrapping', description: 'What happens outside the 0–1 UV range. Repeat tiles the image; clamp stretches the edge pixels.' },
          { term: 'UV coordinates', description: 'Per-vertex (u, v) values from 0 to 1 that say which part of the image maps to each vertex.' },
        ],
      },
      {
        kind: 'callout',
        tone: 'info',
        text: 'UVs run from (0, 0) at one image corner to (1, 1) at the opposite corner, independent of the image’s pixel size.',
      },
    ],
    related: ['section-primitives', 'math-panel', 'glossary'],
  },
  {
    id: 'scene-hierarchy',
    category: 'panels',
    title: 'Scene hierarchy & grouping',
    summary: 'Organise, rename, group, reorder, and show or hide your objects.',
    keywords: ['hierarchy', 'scene', 'list', 'group', 'ungroup', 'rename', 'duplicate', 'delete', 'visibility', 'reorder', 'drag', 'parent', 'child', 'tree'],
    blocks: [
      {
        kind: 'paragraph',
        text: 'The Scene list sits at the top of the Scene panel and lists every object in your scene. It is where you organise, name, and structure your work.',
      },
      { kind: 'heading', text: 'What you can do' },
      {
        kind: 'list',
        items: [
          'Select — click a row to select that object and edit it in the inspector below the list (its code opens in Code).',
          'Rename — double-click a name, or press F2 with a row selected.',
          'Duplicate or Delete — from the Scene toolbar; a delete can be undone.',
          'Show or hide — toggle an object’s visibility without deleting it.',
          'Group or ungroup — turn on Select several in the Scene toolbar, choose more than one object, and press Group to put them under a parent.',
          'Reorder — drag a row above or below another, or drop it onto a group to nest it inside.',
        ],
      },
      { kind: 'heading', text: 'Groups and the matrix stack' },
      {
        kind: 'paragraph',
        text: 'Grouping builds a parent-child hierarchy: a child inherits its parent’s transform, then adds its own. In the generated code this becomes nested glPushMatrix / glPopMatrix pairs. The Transforms guide covers the matrix stack in detail.',
      },
      {
        kind: 'callout',
        tone: 'tip',
        text: 'A hidden object is skipped in the generated code as well as on the canvas, so hiding is a quick way to compare scenes without deleting anything.',
      },
    ],
    related: ['section-transforms', 'canvas-basics', 'code-panel'],
  },
  {
    id: 'callbacks',
    category: 'panels',
    title: 'GLUT callbacks',
    summary: 'Give keyboard, mouse, idle and other handlers rules, see their code, and run them.',
    keywords: ['callback', 'glut', 'keyboard', 'mouse', 'idle', 'reshape', 'motion', 'event', 'handler', 'input',
      'glutkeyboardfunc', 'glutidlefunc', 'special', 'arrow', 'run', 'rule', 'glutspecialfunc'],
    blocks: [
      {
        kind: 'paragraph',
        text: 'GLUT programs respond to events through callbacks: functions you register so GLUT calls them when something happens. The Callbacks panel on the rail has six.',
      },
      {
        kind: 'table',
        headers: ['Callback', 'Fires on', 'GLUT call'],
        rows: [
          ['Keyboard', 'A key press', 'glutKeyboardFunc'],
          ['Special keys', 'An arrow key', 'glutSpecialFunc'],
          ['Mouse', 'A button press or release', 'glutMouseFunc'],
          ['Motion', 'Dragging the mouse', 'glutMotionFunc'],
          ['Reshape', 'Resizing the window', 'glutReshapeFunc'],
          ['Idle', 'Every frame, when idle', 'glutIdleFunc'],
        ],
      },
      { kind: 'heading', text: 'Rules' },
      {
        kind: 'paragraph',
        text: "Switch a callback on and give it rules, such as \"when D is pressed, translate Triangle by 0.10, 0.00\". Each rule becomes lines in the handler's body that change the object's state, and glutPostRedisplay asks GLUT to draw the next frame. Translate, Rotate and Scale change the transform; Move to pointer (Mouse and Motion) converts the pixel GLUT reports to world coordinates; Reset, Set colour and Visibility change how the object is drawn.",
      },
      { kind: 'heading', text: 'Reshape' },
      {
        kind: 'paragraph',
        text: 'Reshape has a choice instead of rules. Keep proportions widens the viewing volume to match the window, so shapes never distort. Stretch only sets the viewport, so shapes stretch with the window.',
      },
      {
        kind: 'callout',
        tone: 'info',
        text: 'Run plays your handlers on the canvas. The exported program runs the same handlers when you compile it.',
      },
      { kind: 'heading', text: 'Idle and animation' },
      {
        kind: 'paragraph',
        text: 'The idle callback fires every frame and is how motion is driven. An idle rule such as "rotate Sun by 2°" turns the object a little on every call, so it spins while the program runs.',
      },
    ],
    related: ['section-primitives', 'section-transforms', 'code-panel', 'glossary'],
  },
  {
    id: 'code-panel',
    category: 'panels',
    title: 'The code panel',
    summary: 'The generated OpenGL C++, folded to the object you are working on, with any line explained on request.',
    keywords: ['code', 'generated', 'c++', 'opengl', 'copy', 'fold', 'notes', 'explain', 'display', 'init'],
    blocks: [
      {
        kind: 'paragraph',
        text: 'The Code side of the right column shows the complete OpenGL 1.5 C++ program for your scene. It updates the moment you edit, so every change you make has a line you can point to.',
      },
      { kind: 'heading', text: 'Folds follow your selection' },
      {
        kind: 'list',
        items: [
          'The selected object’s code is open: its state line, its buffer data, its draw function and its setup in init(). The rest of the program folds to one row per block, such as ▸ int main().',
          'With nothing selected, every object’s code is open and only the setup code folds.',
          'Click a folded row, or press Enter on it, to open it; hover it to read what the block does. A block you open stays open until you select something else.',
          'Line numbers are the real program’s, and Copy always copies the whole program.',
        ],
      },
      { kind: 'heading', text: 'Reading a line' },
      {
        kind: 'list',
        items: [
          'Click any line, or press Enter on it, to see what it does in the strip at the bottom: the call, what it does, your values and the controls that set them.',
          'From the strip, See the math opens the journey stage that works those numbers, and Open shows the control in its panel.',
          'Arrow Up and Arrow Down move between lines while the strip is open; Escape closes it.',
          'Short notes under the key lines of a draw function say what they do with your numbers. Notes in the header hides or shows them.',
        ],
      },
      { kind: 'heading', text: 'What the marks mean' },
      {
        kind: 'table',
        headers: ['Mark', 'Meaning'],
        rows: [
          ['A value in amber, fading', 'The value your last edit changed. Its line number stays amber until the next change.'],
          ['A line on a lighter background', 'The line the strip is explaining.'],
          ['An outline around text', 'A Find match. Enter and Shift+Enter move between matches.'],
          ['A green bar', 'The callback branch Run just fired.'],
        ],
      },
      {
        kind: 'code',
        code: 'void display() {\n    glClear(GL_COLOR_BUFFER_BIT);\n    glBegin(GL_TRIANGLES);\n        glColor3f(1.0f, 0.0f, 0.0f);\n        glVertex2f(-0.5f, -0.5f);\n        glVertex2f( 0.5f, -0.5f);\n        glVertex2f( 0.0f,  0.5f);\n    glEnd();\n    glutSwapBuffers();\n}',
      },
    ],
    related: ['math-panel', 'section-pipeline', 'callbacks', 'saving-loading'],
  },
  {
    id: 'math-panel',
    category: 'panels',
    title: 'The math panel',
    summary: 'One vertex of your shape, followed with your numbers from where you typed it to the pixel it lands on.',
    keywords: ['math', 'journey', 'vertex', 'matrix', 'ndc', 'pixel', 'barycentric', 'memory', 'interpolation'],
    blocks: [
      {
        kind: 'paragraph',
        text: 'Switch the right column to Math to follow one vertex of the selected shape through the six stages OpenGL takes it through, with your own numbers. An amber ring marks the vertex on the canvas.',
      },
      {
        kind: 'table',
        headers: ['Stage', 'What happens', 'Section'],
        rows: [
          ['Stored', 'Where the vertex is kept: sent directly, in an array, or in a GPU buffer', 'Buffers'],
          ['Transformed', 'Scaled, rotated and moved by your transform, then by each group around it', 'Transforms'],
          ['Projected', 'Fitted into the −1 to 1 box by glOrtho', 'Transforms'],
          ['Assembled', 'Joined with its neighbours by the primitive type', 'Primitives'],
          ['Rasterised', 'Mapped to a pixel in the window', 'Pipeline'],
          ['Coloured', 'Given its colour, or its texel for a textured shape', 'Primitives, Textures'],
        ],
      },
      { kind: 'heading', text: 'Using the journey' },
      {
        kind: 'list',
        items: [
          'Every stage shows its result. One is open with its working: each step, its value and the GL call that does it, with your inputs in amber.',
          'The open stage follows what you are doing: the group you open, or in a lesson the control the step points at. Click any stage to open it yourself; your pick holds until the next lesson step or the next group you open.',
          'Use ‹ and › beside the vertex count, or click one of the shape’s vertex handles on the canvas, to follow another vertex.',
          'Click a GL call in the working to see its line in Code.',
        ],
      },
      {
        kind: 'callout',
        tone: 'tip',
        text: 'Select a shape first. With nothing selected, each stage says what it does, and the viewing volume and the pointer readout still work.',
      },
    ],
    related: ['code-panel', 'section-primitives', 'section-buffers', 'section-transforms'],
  },
  {
    id: 'saving-loading',
    category: 'panels',
    title: 'Saving & loading',
    summary: 'Save your scene to a project file and load it back later.',
    keywords: ['save', 'load', 'project', 'file', 'json', 'import', 'export', 'reset', 'autosave'],
    blocks: [
      {
        kind: 'paragraph',
        text: 'Use the File menu in the top bar to manage your work.',
      },
      {
        kind: 'definitions',
        items: [
          { term: 'Save project file', description: 'Writes the entire scene — objects, colours, transforms, buffers, callbacks, and textures — to a project file you can keep or share.' },
          { term: 'Open project file', description: 'Reads a project file back into the workspace, replacing the current scene.' },
          { term: 'New workspace', description: 'Clears the scene to a blank slate (with a confirmation first).' },
        ],
      },
      {
        kind: 'callout',
        tone: 'tip',
        text: 'Your working scene is saved by name in My scenes a moment after every change. My scenes also keeps a backup whenever another scene replaces it.',
      },
      {
        kind: 'callout',
        tone: 'tip',
        text: 'Your work is also kept in the browser between visits, so reopening VAMS restores your last scene automatically — saving to a file is for backups and sharing.',
      },
      {
        kind: 'callout',
        tone: 'warning',
        text: 'Loading a project or starting a new workspace replaces what is currently on the canvas. Save first if you want to keep it.',
      },
    ],
    related: ['sharing', 'code-panel', 'workspace-tour'],
  },
  {
    id: 'sharing',
    category: 'workspace',
    title: 'Sharing a scene',
    summary: 'Send your scene as a link or a QR code; on a phone it opens as a view.',
    keywords: ['share', 'link', 'qr', 'phone', 'send', 'classmate', 'instructor'],
    blocks: [
      {
        kind: 'paragraph',
        text: 'Share in the top bar makes a link to a copy of your scene, with a QR code beside it. Anyone who opens the link on a computer gets the scene in their own editor; your scene is never changed. On a phone it opens as a view: the scene in its window and its C++.',
      },
      {
        kind: 'list',
        items: [
          'Every scene gets a short link that is kept for 90 days.',
          'An uploaded image is shared at 512 px. Your own copy keeps its full size.',
          'If the short link can’t be made, for example when you are offline, Share gives a longer link that carries the scene itself and never expires. It leaves out any uploaded image.',
          'If no link can be made at all, Share offers Save project file, which sends everything, uploaded images included.',
          'During a lesson, Share gives a link to the lesson.',
        ],
      },
      {
        kind: 'callout',
        tone: 'tip',
        text: 'Opening a shared link keeps your current scene in My scenes first, so nothing is lost.',
      },
    ],
    related: ['saving-loading', 'workspace-tour'],
  },
  {
    id: 'shortcuts',
    category: 'reference',
    title: 'Keyboard shortcuts',
    summary: 'Every keyboard shortcut, grouped by where it applies.',
    keywords: ['keyboard', 'shortcut', 'keys', 'hotkey', 'undo', 'redo', 'delete', 'duplicate', 'rename'],
    blocks: [
      { kind: 'paragraph', text: 'Speed up common actions with the keyboard. Shortcuts are ignored while you are typing in a text field.' },
      { kind: 'shortcuts' },
      {
        kind: 'callout',
        tone: 'info',
        text: 'Backspace no longer deletes a selected object — use Delete — so an accidental Backspace can’t navigate away and lose your work.',
      },
    ],
    related: ['canvas-basics'],
  },
  {
    id: 'glossary',
    category: 'reference',
    title: 'Glossary',
    summary: 'Plain-language definitions of the OpenGL terms used in VAMS.',
    keywords: ['glossary', 'terms', 'definition', 'vbo', 'ndc', 'barycentric', 'stipple', 'ortho', 'glut', 'fragment', 'viewport', 'matrix', 'texture', 'filter', 'wrap', 'shading', 'raster', 'font', 'callback'],
    blocks: [
      { kind: 'paragraph', text: 'Quick definitions for the terms you’ll meet throughout VAMS.' },
      {
        kind: 'definitions',
        items: [
          { term: 'OpenGL 1.5', description: 'A version of the OpenGL graphics API using the fixed-function pipeline (no programmable shaders).' },
          { term: 'Fixed-function pipeline', description: 'The built-in, configurable (but not programmable) sequence of stages that turns geometry into pixels.' },
          { term: 'GLUT', description: 'The OpenGL Utility Toolkit — handles windows, input, and the main loop so you can focus on drawing.' },
          { term: 'Primitive', description: 'A basic drawable shape: point, line, triangle, quad, or polygon.' },
          { term: 'Vertex', description: 'A point with a position (and optionally colour and texture coordinates) that defines a primitive’s corner.' },
          { term: 'NDC', description: 'Normalised Device Coordinates — the -1 to 1 space geometry maps into before the viewport transform.' },
          { term: 'Rasterisation', description: 'Turning vector geometry into the pixels (fragments) that fill it.' },
          { term: 'Fragment', description: 'A candidate pixel produced by rasterisation, before it is written to the screen.' },
          { term: 'Immediate mode', description: 'Drawing one vertex at a time between glBegin and glEnd, every frame.' },
          { term: 'Vertex array', description: 'Client-side arrays of vertex data drawn in a single call with glDrawArrays.' },
          { term: 'VBO', description: 'Vertex Buffer Object — vertex data stored in GPU memory and reused, avoiding per-frame uploads.' },
          { term: 'Indexed drawing', description: 'Reusing shared vertices via an index list with glDrawElements, saving memory.' },
          { term: 'Usage hint', description: 'A flag (STATIC / DYNAMIC / STREAM) telling the driver how often buffer data will change.' },
          { term: 'Barycentric coordinates', description: 'Weights (α, β, γ) that blend a triangle’s three corners — used to interpolate vertex colours across the face.' },
          { term: 'Stipple', description: 'A 16-bit on/off pattern that dashes a line, set with glLineStipple.' },
          { term: 'glOrtho', description: 'Defines the orthographic viewing window mapping world units onto the viewport.' },
          { term: 'Matrix stack', description: 'The glPushMatrix / glPopMatrix stack of transforms used to build object hierarchies.' },
          { term: 'UV coordinates', description: 'Per-vertex (u, v) values from 0 to 1 that map a texture image onto geometry.' },
          { term: 'Callback', description: 'A function you register so GLUT calls it on an event — a key press, mouse click, window resize, or idle frame.' },
          { term: 'Idle callback', description: 'A callback registered with glutIdleFunc that fires every frame when idle; it is how animation advances a transform over time.' },
          { term: 'Animation', description: 'A transform that changes a little each frame, driven by a rule on the idle callback.' },
          { term: 'Group / hierarchy', description: 'A parent object whose transform is inherited by its children, generated as nested glPushMatrix / glPopMatrix pairs.' },
          { term: 'Clear colour', description: 'The colour the window is wiped to before each frame, set with glClearColor and applied by glClear.' },
          { term: 'Double buffering', description: 'Drawing each frame into a hidden back buffer, then showing it all at once with glutSwapBuffers, so you never see a half-drawn frame.' },
          { term: 'Display callback', description: 'The function registered with glutDisplayFunc. GLUT calls it whenever the window needs drawing; glutPostRedisplay asks for another call.' },
          { term: 'Reshape callback', description: 'The function registered with glutReshapeFunc. GLUT calls it with the new size whenever the window changes size, and once when it opens.' },
          { term: 'Viewport', description: 'The rectangle of the window, in pixels, that drawing lands in, set with glViewport.' },
          { term: 'Viewing volume', description: 'The rectangle of the world that glOrtho maps onto the viewport: left, right, bottom and top, in world units.' },
          { term: 'Matrix mode', description: 'Which matrix the transform calls change: GL_PROJECTION for the viewing volume, GL_MODELVIEW for objects. Set with glMatrixMode.' },
          { term: 'glTranslatef, glRotatef, glScalef', description: 'The three transform calls. Each multiplies the current matrix, so the call written last is applied to the vertices first.' },
          { term: 'Shading model', description: 'GL_SMOOTH blends vertex colours across a primitive; GL_FLAT gives the whole primitive one vertex’s colour. Set with glShadeModel.' },
          { term: 'Line width and point size', description: 'How many pixels wide lines are drawn and how big points are, set with glLineWidth and glPointSize. Both are in window pixels.' },
          { term: 'Raster position', description: 'The window position where the next bitmap is drawn, set in world units with glRasterPos2f.' },
          { term: 'Bitmap font', description: 'A font stored as fixed pixel patterns. VAMS uses GLUT’s 9 × 15 font, drawn one character at a time with glutBitmapCharacter.' },
          { term: 'Texture object', description: 'A named image the GPU keeps, made with glGenTextures, filled with glTexImage2D and chosen with glBindTexture.' },
          { term: 'Texture filter', description: 'How a texture is sampled when its texels and the screen’s pixels don’t line up: GL_NEAREST picks one texel, GL_LINEAR blends four.' },
          { term: 'Wrap mode', description: 'What a UV outside 0 to 1 samples: GL_REPEAT tiles the image, GL_CLAMP_TO_EDGE holds its edge.' },
          { term: 'Client state', description: 'Switches such as GL_VERTEX_ARRAY and GL_COLOR_ARRAY, turned on with glEnableClientState, that tell glDrawArrays which arrays to read.' },
          { term: 'Buffer mapping', description: 'glMapBuffer hands your program a pointer into a VBO’s memory so you can write it directly; glUnmapBuffer gives it back.' },
        ],
      },
    ],
    related: ['section-pipeline', 'section-buffers', 'section-transforms', 'section-primitives'],
  },
  {
    id: 'about',
    category: 'reference',
    title: 'About VAMS',
    summary: 'About this project and how to get help.',
    keywords: ['about', 'credits', 'thesis', 'version', 'help'],
    blocks: [
      {
        kind: 'paragraph',
        text: 'VAMS (Visual Animation Modeling Simulator) is an educational tool for the OpenGL 1.5 fixed-function pipeline, developed as a thesis project to help students connect visual results to the code and math that produce them.',
      },
      {
        kind: 'paragraph',
        text: 'It covers the OpenGL 1.5 fixed-function features a 2D scene uses, so the generated code stays focused on the fundamentals.',
      },
      {
        kind: 'callout',
        tone: 'tip',
        text: 'You can reopen this Help Centre any time with the ? or F1 key, or from the Help button in the top bar.',
      },
    ],
    related: ['welcome', 'shortcuts'],
  },
];

const TOPIC_BY_ID: Record<HelpTopicId, HelpTopic> = HELP_TOPICS.reduce(
  (acc, topic) => {
    acc[topic.id] = topic;
    return acc;
  },
  {} as Record<HelpTopicId, HelpTopic>,
);

/** The topic shown first when Help opens with no explicit target. */
export const DEFAULT_HELP_TOPIC: HelpTopicId = 'welcome';

export function getHelpTopic(id: HelpTopicId): HelpTopic {
  return TOPIC_BY_ID[id];
}

/** Maps a curriculum section to the help topic that documents it. */
export function topicForSection(section: CurriculumSection): HelpTopicId {
  const match = HELP_TOPICS.find((topic) => topic.section === section);
  return match ? match.id : DEFAULT_HELP_TOPIC;
}

function blockText(block: HelpBlock): string {
  switch (block.kind) {
    case 'heading':
    case 'paragraph':
    case 'callout':
      return block.text;
    case 'list':
      return block.items.join(' ');
    case 'code':
      return block.code;
    case 'table':
      return [...block.headers, ...block.rows.flat()].join(' ');
    case 'definitions':
      return block.items.map((i) => `${i.term} ${i.description}`).join(' ');
    case 'shortcuts':
    case 'start-tour':
      return '';
  }
}

/** Case-insensitive search across title, summary, keywords, and body text. */
export function searchHelpTopics(query: string): HelpTopic[] {
  const q = query.trim().toLowerCase();
  if (!q) return HELP_TOPICS;
  return HELP_TOPICS.filter((topic) => {
    const haystack = [
      topic.title,
      topic.summary,
      topic.keywords.join(' '),
      topic.blocks.map(blockText).join(' '),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}
