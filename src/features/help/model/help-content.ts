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
          'Create every OpenGL 1.5 primitive and edit its vertices, color, and line style.',
          'Switch geometry between immediate mode, vertex arrays, and VBOs — and see the code change.',
          'Translate, rotate, scale, and group objects, and set the orthographic view.',
          'Upload textures and map them onto shapes with a UV editor.',
          'Follow guided, narrated lessons with built-in exercises.',
        ],
      },
      { kind: 'heading', text: 'Getting started in three steps' },
      {
        kind: 'list',
        ordered: true,
        items: [
          'Open the Primitives section on the left and add a shape (or click “Add your first shape” on the empty canvas).',
          'Watch the generated OpenGL code appear in the right panel.',
          'Select the shape and edit its color or position — notice the code and math update live.',
        ],
      },
      {
        kind: 'callout',
        tone: 'tip',
        text: 'New here? Read the Workspace Tour next — it explains the three regions of the screen in under a minute. Press ? or F1 any time to reopen this Help Center.',
      },
    ],
    related: ['workspace-tour', 'canvas-basics', 'modes', 'shortcuts'],
  },
  {
    id: 'workspace-tour',
    category: 'workspace',
    title: 'Workspace Tour',
    summary: 'The three regions: build on the left, see in the center, read on the right.',
    keywords: ['layout', 'panels', 'sidebar', 'regions', 'tour', 'top bar'],
    blocks: [
      {
        kind: 'paragraph',
        text: 'The screen is split into three working regions plus a top bar. Each region has a single job, so you always know where to look.',
      },
      { kind: 'heading', text: 'Three regions' },
      {
        kind: 'list',
        items: [
          'Left — Build. The section tabs and the panels for creating and editing scene objects.',
          'Center — See. The canvas, where your scene is drawn and where you place vertices.',
          'Right — Read. The generated OpenGL code (top) and the contextual math breakdown (bottom).',
        ],
      },
      { kind: 'heading', text: 'The section tabs' },
      {
        kind: 'paragraph',
        text: 'The five tabs on the left follow the OpenGL curriculum. Switching tabs changes which build tools appear and what the math panel explains.',
      },
      {
        kind: 'table',
        headers: ['Tab', 'What it covers'],
        rows: [
          ['Pipeline', 'How vertices become pixels: NDC, rasterization, GLUT structure'],
          ['Primitives', 'Points, lines, triangles, color, line style, and text'],
          ['Buffers', 'Immediate mode, vertex arrays, VBOs, and memory layout'],
          ['Transforms', 'Translate, rotate, scale, the matrix stack, and glOrtho'],
          ['Textures', 'Images, UV mapping, filtering, and wrapping'],
        ],
      },
      { kind: 'heading', text: 'The top bar' },
      {
        kind: 'list',
        items: [
          'Undo / Redo — step backward and forward through your edits.',
          'New Workspace — clear the scene and start fresh.',
          'Save / Load — write the scene to a project file and read it back.',
          'Theme — switch between dark and light.',
          'View Settings — toggle axes, gridlines, the coordinate tracker, and open the shortcut list.',
          'Lessons — launch a guided, narrated lesson.',
          'Help — open this Help Center (also ? or F1).',
        ],
      },
      {
        kind: 'callout',
        tone: 'info',
        text: 'The layout stays put as you work. Panels that need a selected object show a short prompt instead of disappearing, so nothing “vanishes” unexpectedly.',
      },
    ],
    related: ['canvas-basics', 'code-panel', 'math-panel', 'saving-loading'],
  },
  {
    id: 'canvas-basics',
    category: 'workspace',
    title: 'Working with the Canvas',
    summary: 'Selecting objects, placing vertices, snapping, and the coordinate system.',
    keywords: ['canvas', 'select', 'vertex', 'snap', 'grid', 'coordinates', 'viewport', 'ndc'],
    blocks: [
      { kind: 'heading', text: 'The coordinate system' },
      {
        kind: 'paragraph',
        text: 'The canvas shows your world coordinates. By default the visible window runs from -1 to 1 on both axes — the same Normalized Device Coordinates (NDC) that OpenGL clips against. The origin (0, 0) sits at the center; X increases to the right and Y increases upward, matching OpenGL (not screen pixels, where Y points down).',
      },
      { kind: 'heading', text: 'Selecting objects' },
      {
        kind: 'paragraph',
        text: 'Click an object to select it; click empty space to deselect. The selected object is highlighted and becomes the target of the edit panels on the left. You can also select from the Scene Hierarchy list.',
      },
      { kind: 'heading', text: 'Placing vertices' },
      {
        kind: 'paragraph',
        text: 'When you start a custom shape, the canvas enters vertex-placement mode and a banner appears. Click to drop each vertex in order; the shape needs a minimum number of vertices before it can be finished.',
      },
      { kind: 'shortcuts' },
      { kind: 'heading', text: 'Grid snapping & coordinates' },
      {
        kind: 'paragraph',
        text: 'Turn on grid snapping so clicks land on tidy increments instead of arbitrary decimals — useful for clean, predictable geometry. The coordinate tracker (toggle it in View Settings) shows the world X/Y under your cursor as you move.',
      },
      {
        kind: 'callout',
        tone: 'tip',
        text: 'Changing the orthographic window (the Transforms section’s glOrtho editor) zooms and pans what the canvas shows without moving your objects.',
      },
    ],
    related: ['section-primitives', 'section-transforms', 'shortcuts'],
  },
  {
    id: 'modes',
    category: 'getting-started',
    title: 'Author Mode vs Lessons',
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
        text: 'Launch a lesson from the launcher in the top bar. Your sandbox scene is set aside while the lesson runs and restored automatically when you leave, so you never lose your own work.',
      },
      {
        kind: 'callout',
        tone: 'warning',
        text: 'Switching section tabs during a lesson asks you to confirm first, because leaving ends the lesson and returns you to Author mode.',
      },
    ],
    related: ['welcome', 'workspace-tour'],
  },
  {
    id: 'section-pipeline',
    category: 'sections',
    title: 'Pipeline',
    summary: 'The OpenGL rendering pipeline, NDC, rasterization, and GLUT program structure.',
    keywords: ['pipeline', 'ndc', 'raster', 'rasterization', 'glut', 'stages', 'display', 'mainloop'],
    section: 'Pipeline',
    blocks: [
      {
        kind: 'paragraph',
        text: 'The Pipeline section explains how vertices travel from your code to pixels on screen. It has three views you can switch between.',
      },
      {
        kind: 'definitions',
        items: [
          { term: 'Diagram', description: 'The fixed-function pipeline stages laid out in order; click a stage to focus it.' },
          { term: 'Playground', description: 'The live editing canvas, so you can experiment while thinking about the pipeline.' },
          { term: 'Raster / Vector', description: 'Compares the ideal vector geometry against the rasterized (pixelated) result.' },
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
          'Rasterization fills the primitive’s pixels (fragments).',
          'Per-vertex colors are interpolated across each fragment.',
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
        text: 'VAMS only ever emits OpenGL 1.5 fixed-function calls — no shaders, lighting, or 3D projection — so the generated code always matches the curriculum.',
      },
    ],
    related: ['code-panel', 'math-panel', 'glossary'],
  },
  {
    id: 'section-primitives',
    category: 'sections',
    title: 'Primitives',
    summary: 'Points, lines, triangles, quads and polygons, plus color, line style, and text.',
    keywords: ['primitive', 'triangle', 'line', 'quad', 'polygon', 'color', 'stipple', 'text', 'glcolor', 'glvertex'],
    section: 'Primitives',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Build geometry from the ten OpenGL 1.5 primitive types. Add a shape, then edit its vertices, per-vertex color, and line styling. Each primitive interprets your vertex list differently.',
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
        text: 'In immediate mode each shape is drawn between glBegin and glEnd, with a color and position for each vertex:',
      },
      {
        kind: 'code',
        code: 'glBegin(GL_TRIANGLES);\n    glColor3f(1.0f, 0.0f, 0.0f); glVertex2f(-0.5f, -0.5f);\n    glColor3f(0.0f, 1.0f, 0.0f); glVertex2f( 0.5f, -0.5f);\n    glColor3f(0.0f, 0.0f, 1.0f); glVertex2f( 0.0f,  0.5f);\nglEnd();',
      },
      { kind: 'heading', text: 'Color modes' },
      {
        kind: 'paragraph',
        text: 'Each object can use float color (glColor3f, components 0.0–1.0) or byte color (glColor3ub, components 0–255). They describe the same colors; the math panel shows the conversion.',
      },
      {
        kind: 'table',
        headers: ['Float (glColor3f)', 'Byte (glColor3ub)', 'Color'],
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
          'Text — bitmap text is drawn with glRasterPos2f to set the position and glutBitmapCharacter for each glyph.',
        ],
      },
      {
        kind: 'callout',
        tone: 'tip',
        text: 'Give a triangle three different vertex colors to see barycentric interpolation: OpenGL blends the corner colors smoothly across the face. The math panel shows the weights.',
      },
    ],
    related: ['canvas-basics', 'math-panel', 'section-buffers', 'glossary'],
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
        text: 'Move, rotate, and scale objects using the on-canvas gizmo or the numeric inputs. Every transform corresponds to a fixed-function matrix call.',
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
    ],
    related: ['code-panel', 'math-panel', 'glossary'],
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
        text: 'Textures paint an image onto your geometry. Upload an image to the texture library, attach it to an object, then control how it maps with the UV editor.',
      },
      { kind: 'heading', text: 'How it works' },
      {
        kind: 'list',
        ordered: true,
        items: [
          'Upload an image into the texture library.',
          'Select an object and attach the texture to it.',
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
    id: 'code-panel',
    category: 'panels',
    title: 'The Code Panel',
    summary: 'How the generated OpenGL/C++ reflects your scene.',
    keywords: ['code', 'generated', 'c++', 'opengl', 'copy', 'highlight', 'display', 'init'],
    blocks: [
      {
        kind: 'paragraph',
        text: 'The top-right panel shows complete, valid OpenGL 1.5 C++ generated from your scene. It updates instantly as you edit, so you can connect each visual change to the code that produces it.',
      },
      { kind: 'heading', text: 'Reading the structure' },
      {
        kind: 'definitions',
        items: [
          { term: 'init()', description: 'One-time setup: VBO uploads and texture loading are hoisted here.' },
          { term: 'display()', description: 'The draw callback, re-run every frame; this is where your geometry is rendered.' },
          { term: 'main()', description: 'GLUT setup: create the window, register callbacks, enter the main loop.' },
        ],
      },
      { kind: 'heading', text: 'Working with the panel' },
      {
        kind: 'list',
        items: [
          'Select an object — the lines responsible for it are highlighted.',
          'Use the find box to search within the code.',
          'Hover an underlined line for a short explanation of the call.',
          'Click Copy to copy the whole program.',
        ],
      },
      {
        kind: 'code',
        code: 'void display() {\n    glClear(GL_COLOR_BUFFER_BIT);\n    glBegin(GL_TRIANGLES);\n        glColor3f(1.0f, 0.0f, 0.0f);\n        glVertex2f(-0.5f, -0.5f);\n        glVertex2f( 0.5f, -0.5f);\n        glVertex2f( 0.0f,  0.5f);\n    glEnd();\n    glutSwapBuffers();\n}',
      },
    ],
    related: ['math-panel', 'section-pipeline', 'saving-loading'],
  },
  {
    id: 'math-panel',
    category: 'panels',
    title: 'The Math Panel',
    summary: 'Live mathematical breakdowns tied to the active section and selection.',
    keywords: ['math', 'formula', 'breakdown', 'barycentric', 'matrix', 'memory', 'interpolation'],
    blocks: [
      {
        kind: 'paragraph',
        text: 'Below the code, the math panel shows the numbers behind what you see. Its content follows the active section and your current selection, so it always explains what you are working on right now.',
      },
      { kind: 'heading', text: 'What it shows, by section' },
      {
        kind: 'table',
        headers: ['Section', 'Math shown'],
        rows: [
          ['Primitives', 'Color float ↔ byte conversion; barycentric color interpolation; stipple pattern; vertex table'],
          ['Buffers', 'Memory footprint; array vs indexed byte comparison; interleaved layout; buffer flow timeline'],
          ['Transforms', 'The selected object’s transform matrix; the matrix stack; the glOrtho mapping'],
        ],
      },
      {
        kind: 'callout',
        tone: 'tip',
        text: 'Select an object first — most breakdowns describe the current selection, so they update the moment you pick a different shape or edit a value.',
      },
    ],
    related: ['code-panel', 'section-primitives', 'section-buffers', 'section-transforms'],
  },
  {
    id: 'saving-loading',
    category: 'panels',
    title: 'Saving & Loading',
    summary: 'Save your scene to a project file and load it back later.',
    keywords: ['save', 'load', 'project', 'file', 'json', 'import', 'export', 'reset', 'autosave'],
    blocks: [
      {
        kind: 'paragraph',
        text: 'Use the project actions in the top bar to manage your work.',
      },
      {
        kind: 'definitions',
        items: [
          { term: 'Save', description: 'Writes the entire scene — objects, colors, transforms, buffers, callbacks, and textures — to a project file you can keep or share.' },
          { term: 'Load', description: 'Reads a project file back into the workspace, replacing the current scene.' },
          { term: 'New Workspace', description: 'Clears the scene to a blank slate (with a confirmation first).' },
        ],
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
    related: ['code-panel', 'workspace-tour'],
  },
  {
    id: 'shortcuts',
    category: 'reference',
    title: 'Keyboard Shortcuts',
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
    keywords: ['glossary', 'terms', 'definition', 'vbo', 'ndc', 'barycentric', 'stipple', 'ortho', 'glut', 'fragment'],
    blocks: [
      { kind: 'paragraph', text: 'Quick definitions for the terms you’ll meet throughout VAMS.' },
      {
        kind: 'definitions',
        items: [
          { term: 'OpenGL 1.5', description: 'A version of the OpenGL graphics API using the fixed-function pipeline (no programmable shaders).' },
          { term: 'Fixed-function pipeline', description: 'The built-in, configurable (but not programmable) sequence of stages that turns geometry into pixels.' },
          { term: 'GLUT', description: 'The OpenGL Utility Toolkit — handles windows, input, and the main loop so you can focus on drawing.' },
          { term: 'Primitive', description: 'A basic drawable shape: point, line, triangle, quad, or polygon.' },
          { term: 'Vertex', description: 'A point with a position (and optionally color and texture coordinates) that defines a primitive’s corner.' },
          { term: 'NDC', description: 'Normalized Device Coordinates — the -1 to 1 space geometry maps into before the viewport transform.' },
          { term: 'Rasterization', description: 'Turning vector geometry into the pixels (fragments) that fill it.' },
          { term: 'Fragment', description: 'A candidate pixel produced by rasterization, before it is written to the screen.' },
          { term: 'Immediate mode', description: 'Drawing one vertex at a time between glBegin and glEnd, every frame.' },
          { term: 'Vertex array', description: 'Client-side arrays of vertex data drawn in a single call with glDrawArrays.' },
          { term: 'VBO', description: 'Vertex Buffer Object — vertex data stored in GPU memory and reused, avoiding per-frame uploads.' },
          { term: 'Indexed drawing', description: 'Reusing shared vertices via an index list with glDrawElements, saving memory.' },
          { term: 'Usage hint', description: 'A flag (STATIC / DYNAMIC / STREAM) telling the driver how often buffer data will change.' },
          { term: 'Barycentric coordinates', description: 'Weights (α, β, γ) that blend a triangle’s three corners — used to interpolate vertex colors across the face.' },
          { term: 'Stipple', description: 'A 16-bit on/off pattern that dashes a line, set with glLineStipple.' },
          { term: 'glOrtho', description: 'Defines the orthographic viewing window mapping world units onto the viewport.' },
          { term: 'Matrix stack', description: 'The glPushMatrix / glPopMatrix stack of transforms used to build object hierarchies.' },
          { term: 'UV coordinates', description: 'Per-vertex (u, v) values from 0 to 1 that map a texture image onto geometry.' },
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
        text: 'It deliberately covers only OpenGL 1.5 fixed-function features — no shaders, lighting, or 3D projection — so the generated code stays focused on the fundamentals.',
      },
      {
        kind: 'callout',
        tone: 'tip',
        text: 'You can reopen this Help Center any time with the ? or F1 key, or from the Help button in the top bar.',
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
