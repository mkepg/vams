import type { Lesson } from '@/core/types/lesson';

export const PIPELINE_LESSONS: Record<string, Lesson> = {
  'pipeline-demo-1': {
    id: 'pipeline-demo-1',
    title: 'From Vertex to Pixel',
    type: 'demo',
    section: 'Pipeline',
    steps: [
      {
        narration: "Welcome to the rendering pipeline — the assembly line that turns your code into pixels on screen.",
        waitForUser: true,
        focusPanel: 'pipeline-mode-controls',
        action: (state) => {
          state.setPipelineMode('Diagram');
          state.setActivePipelineStage(null);
        },
      },
      {
        narration: "1. Vertex Specification — your code lists the points (vertices) that describe each shape, along with their colors.",
        waitForUser: true,
        action: (state) => state.setActivePipelineStage(0),
      },
      {
        narration: "2. Vertex Processing — each vertex is moved into its final position using transformation matrices.",
        waitForUser: true,
        action: (state) => state.setActivePipelineStage(1),
      },
      {
        narration: "3. Primitive Assembly — vertices are connected into actual shapes: points, lines, or triangles.",
        waitForUser: true,
        action: (state) => state.setActivePipelineStage(2),
      },
      {
        narration: "4. Clipping — anything outside the visible window is cut away. No work is wasted on offscreen pixels.",
        waitForUser: true,
        action: (state) => state.setActivePipelineStage(3),
      },
      {
        narration: "5. Rasterization — the moment vector becomes raster. Smooth shapes are sliced into a grid of square fragments.",
        waitForUser: true,
        action: (state) => state.setActivePipelineStage(4),
      },
      {
        narration: "6. Fragment Processing — each fragment receives its final color. Textures and effects are applied here.",
        waitForUser: true,
        action: (state) => state.setActivePipelineStage(5),
      },
      {
        narration: "7. Per-Sample Operations — final tests decide which fragments survive and become pixels on the screen.",
        waitForUser: true,
        action: (state) => state.setActivePipelineStage(6),
      },
      {
        narration: "That's the journey from vertex to pixel. You've completed the demo!",
        waitForUser: true,
        action: (state) => state.setActivePipelineStage(null),
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
        narration: "Computer graphics has two ways of describing shapes. Let's compare them side by side.",
        waitForUser: true,
        focusPanel: 'pipeline-mode-controls',
        action: (state) => state.setPipelineMode('RasterVector'),
      },
      {
        narration: "On the left: a vector triangle. It's described by three points and exact equations. Zoom in forever — the edges stay crisp.",
        waitForUser: true,
      },
      {
        narration: "On the right: the same triangle as raster. It's been sliced into a grid of square fragments — what your screen actually displays.",
        waitForUser: true,
      },
      {
        narration: "The pipeline's job is to convert vector input into raster output. Every shape you draw goes through this transformation.",
        waitForUser: true,
      },
    ],
  },
  'pipeline-demo-3': {
    id: 'pipeline-demo-3',
    title: 'Normalized Device Coordinates',
    type: 'demo',
    section: 'Pipeline',
    steps: [
      {
        narration: "OpenGL doesn't think in pixels. It uses a clean coordinate system called NDC, ranging from -1 to +1 on each axis.",
        waitForUser: true,
        focusPanel: 'pipeline-mode-controls',
        action: (state) => state.setPipelineMode('Playground'),
      },
      {
        pane: 'math',
        narration: "Move your cursor across the canvas — watch the Rasterised stage in Math. Those decimals are the cursor's NDC position.",
        waitForUser: true,
      },
      {
        narration: "(0, 0) sits at the dead center. (-1, -1) is the bottom-left corner. (+1, +1) is the top-right.",
        waitForUser: true,
      },
      {
        narration: "Why use NDC? Because shapes defined in NDC look identical regardless of window size. The pixel mapping happens automatically.",
        waitForUser: true,
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
        narration: "Every OpenGL program with FreeGLUT follows the same skeleton. Let's walk through what each section does.",
        waitForUser: true,
        focusPanel: 'pipeline-mode-controls',
        action: (state) => state.setPipelineMode('Playground'),
      },
      {
        narration: "At the top: #include directives bring in FreeGLUT — the library that handles windowing and OpenGL setup.",
        waitForUser: true,
      },
      {
        narration: "Next: the display() function. This is your painter. GLUT calls it whenever the window needs redrawing.",
        waitForUser: true,
      },
      {
        narration: "Inside display(): glClear wipes the screen, draw() does the work, and glutSwapBuffers shows the result smoothly.",
        waitForUser: true,
      },
      {
        narration: "Then: main(). It initializes GLUT, opens the window, registers display() as the painter, and starts the event loop.",
        waitForUser: true,
      },
      {
        narration: "Hover any line in the code panel for a closer look. You've completed the demo!",
        waitForUser: true,
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
        narration: "Let's practice working in NDC. We'll add a point at the origin — your job is to move it.",
        waitForUser: true,
        focusPanel: 'pipeline-mode-controls',
        action: (state) => {
          state.setPipelineMode('Playground');
          const exists = state.objects.find((o) => o.type === 'POINTS');
          if (!exists) {
            // RELIES ON NATIVE BEHAVIOR: addCustomObject automatically handles selection.
            state.addCustomObject('POINTS', [{ x: 0, y: 0 }]);
          } else {
            // Select the existing point if the user already had one in the scene
            state.selectObject(exists.id);
          }
        },
      },
      {
        narration: "Drag the point to land on (0.5, 0.5). Just get reasonably close.",
        waitForUser: true,
        successCheck: (state) => {
          // STRUCTURAL FIX: Rely on the selected object ID rather than a generic array search
          const id = state.selectedObjectId;
          if (!id) return false;
          
          const pt = state.objects.find((o) => o.id === id);
          if (!pt) return false;
          
          const dx = pt.transform.translateX - 0.5;
          const dy = pt.transform.translateY - 0.5;
          return Math.abs(dx) < 0.15 && Math.abs(dy) < 0.15;
        },
      },
      {
        narration: "Excellent! Look at the code panel — glVertex2f reflects exactly where you placed the point.",
        waitForUser: true,
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
        narration: "Let's test your visual reasoning. We will go through 7 visual artifacts covering all stages of the graphics pipeline.",
        waitForUser: true,
        action: (state) => state.setPipelineMode('Playground'),
      },
      {
        narration: "Look at the raw data coordinates mapping to a vertex in memory. Which stage handles this initial data intake?",
        waitForUser: true,
        action: (state) => state.setPipelineMode('Playground'),
        exercise: {
          kind: 'multiple-choice',
          prompt: 'Which stage parses raw input into individual points in memory?',
          visualArtifact: 'vertex-specification',
          options: [
            { id: 'vspec', label: 'Vertex Specification' },
            { id: 'prim', label: 'Primitive Assembly' },
            { id: 'clip', label: 'Clipping' },
            { id: 'frag', label: 'Fragment Processing' },
          ],
          correctId: 'vspec',
        },
      },
      {
        narration: "Observe the distorted and moved shape. Which stage applies matrices to transform vertices into their final positions?",
        waitForUser: true,
        action: (state) => state.setPipelineMode('Playground'),
        exercise: {
          kind: 'multiple-choice',
          prompt: 'Which stage applies transformation matrices?',
          visualArtifact: 'vertex-processing',
          options: [
            { id: 'vproc', label: 'Vertex Processing' },
            { id: 'rast', label: 'Rasterization' },
            { id: 'out', label: 'Per-Sample Operations' },
            { id: 'vspec', label: 'Vertex Specification' },
          ],
          correctId: 'vproc',
        },
      },
      {
        narration: "Notice how loose points are connected into a wireframe triangle. Which stage links vertices into geometric primitives?",
        waitForUser: true,
        action: (state) => state.setPipelineMode('Playground'),
        exercise: {
          kind: 'multiple-choice',
          prompt: 'Which stage builds lines and polygons from loose points?',
          visualArtifact: 'primitive-assembly',
          options: [
            { id: 'prim', label: 'Primitive Assembly' },
            { id: 'vproc', label: 'Vertex Processing' },
            { id: 'frag', label: 'Fragment Processing' },
            { id: 'clip', label: 'Clipping' },
          ],
          correctId: 'prim',
        },
      },
      {
        narration: "Look at the geometry extending outside the viewport boundary being cut off. Which stage performs this operation to save GPU work?",
        waitForUser: true,
        action: (state) => state.setPipelineMode('Playground'),
        exercise: {
          kind: 'multiple-choice',
          prompt: 'Which stage cuts away offscreen geometry?',
          visualArtifact: 'clipping',
          options: [
            { id: 'clip', label: 'Clipping' },
            { id: 'rast', label: 'Rasterization' },
            { id: 'vspec', label: 'Vertex Specification' },
            { id: 'prim', label: 'Primitive Assembly' },
          ],
          correctId: 'clip',
        },
      },
      {
        narration: "The triangle is now a grid of squares with staircase edges. Which stage turns smooth vector geometry into a grid of fragments?",
        waitForUser: true,
        action: (state) => state.setPipelineMode('Playground'),
        exercise: {
          kind: 'multiple-choice',
          prompt: 'Which stage binds continuous shapes to a pixel grid?',
          visualArtifact: 'rasterization',
          options: [
            { id: 'rast', label: 'Rasterization' },
            { id: 'vproc', label: 'Vertex Processing' },
            { id: 'out', label: 'Per-Sample Operations' },
            { id: 'frag', label: 'Fragment Processing' },
          ],
          correctId: 'rast',
        },
      },
      {
        narration: "Observe the smooth color interpolation across the surface. Which stage computes the final color of each individual fragment?",
        waitForUser: true,
        action: (state) => state.setPipelineMode('Playground'),
        exercise: {
          kind: 'multiple-choice',
          prompt: 'Which stage determines the texture and color of fragments?',
          visualArtifact: 'fragment-processing',
          options: [
            { id: 'frag', label: 'Fragment Processing' },
            { id: 'clip', label: 'Clipping' },
            { id: 'prim', label: 'Primitive Assembly' },
            { id: 'rast', label: 'Rasterization' },
          ],
          correctId: 'frag',
        },
      },
      {
        narration: "The coloured fragments are written over the cleared background for glutSwapBuffers to show. Which stage does this final write?",
        waitForUser: true,
        action: (state) => state.setPipelineMode('Playground'),
        exercise: {
          kind: 'multiple-choice',
          prompt: 'Which stage performs depth testing and discards hidden fragments?',
          visualArtifact: 'per-sample-operations',
          options: [
            { id: 'out', label: 'Per-Sample Operations' },
            { id: 'vspec', label: 'Vertex Specification' },
            { id: 'vproc', label: 'Vertex Processing' },
            { id: 'clip', label: 'Clipping' },
          ],
          correctId: 'out',
        },
      },
      {
        narration: "Excellent! By connecting visual artifacts directly to pipeline stages, you've leveled up your rendering debugging skills.",
        waitForUser: true,
        action: (state) => state.setPipelineMode('Diagram'),
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
        narration: "Let's see if you can remember the correct order without looking at the diagram.",
        waitForUser: true,
        action: (state) => state.setPipelineMode('Playground'),
        exercise: {
          kind: 'ordered-list',
          prompt: 'Drag stages into the correct execution order:',
          items: [
            { id: 'rast', label: 'Rasterization' },
            { id: 'frag', label: 'Fragment Processing' },
            { id: 'prim', label: 'Primitive Assembly' },
            { id: 'vspec', label: 'Vertex Specification' },
            { id: 'vproc', label: 'Vertex Processing' },
            { id: 'clip', label: 'Clipping' },
            { id: 'out', label: 'Per-Sample Operations' },
          ],
          correctOrder: ['vspec', 'vproc', 'prim', 'clip', 'rast', 'frag', 'out'],
        },
      },
      {
        narration: "Perfect! That's the OpenGL pipeline from start to finish.",
        waitForUser: true,
        action: (state) => state.setPipelineMode('Diagram'),
      },
    ],
  },
};