import type { Lesson } from '@/core/types/lesson';
import { useVamsStore } from '@/core/store';

export const BUFFERS_LESSONS: Record<string, Lesson> = {
  'buffers-demo-1': {
    id: 'buffers-demo-1',
    title: 'Immediate Mode: Every Frame',
    type: 'demo',
    section: 'Buffers',
    steps: [
      {
        narration: "Welcome to Buffers! Let's begin with how OpenGL 1.x has worked since the start: immediate mode.",
        waitForUser: true,
        action: (state) => {
          state.addCustomObject('TRIANGLES', [
            { x: -0.5, y: -0.4 }, { x: 0.5, y: -0.4 }, { x: 0, y: 0.5 },
          ]);
          const id = useVamsStore.getState().selectedObjectId;
          if (id) state.updateRenderingMode(id, 'IMMEDIATE');
        },
      },
      {
        narration: "VAMS wraps each object in its own draw_*() function. Find draw_TRIANGLES_1() in the code panel — that's where glBegin and glEnd live.",
        waitForUser: true,
      },
      {
        narration: "Each frame, display() calls draw(), which calls draw_TRIANGLES_1(), which re-issues every glVertex2f. The CPU is doing real work for each vertex, every single frame.",
        waitForUser: true,
      },
      {
        narration: "Three vertices is fine. Three thousand is wasteful — same data, sent 60 times a second. That's what the next two modes solve.",
        waitForUser: true,
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
        narration: "Vertex arrays move the vertex list out of glBegin/glEnd and into a flat C array, drawn with one call.",
        waitForUser: true,
        action: (state) => {
          state.addCustomObject('TRIANGLES', [
            { x: -0.5, y: -0.4 }, { x: 0.5, y: -0.4 }, { x: 0, y: 0.5 },
          ]);
        },
      },
      {
        narration: "Watch the code panel as the rendering mode is switched to Vertex Array.",
        waitForUser: true,
        focusPanel: 'buffers-panel',
        action: (state) => {
          const id = state.selectedObjectId;
          if (id) state.updateRenderingMode(id, 'VERTEX_ARRAY');
        },
      },
      {
        narration: "Two big changes: vertex data is now declared at file scope as verts_TRIANGLES_1[], and the draw function uses one glDrawArrays call instead of N glVertex2f calls.",
        waitForUser: true,
      },
      {
        pane: 'math',
        narration: "Look at the math panel's CPU → GPU Traffic timeline. The data still travels every frame — but now in one batched send instead of vertex-by-vertex.",
        waitForUser: true,
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
        narration: "A Vertex Buffer Object lives on the GPU. Once you upload it, drawing means binding it — no more CPU→GPU traffic for the vertex data.",
        waitForUser: true,
        action: (state) => {
          state.addCustomObject('TRIANGLES', [
            { x: -0.5, y: -0.4 }, { x: 0.5, y: -0.4 }, { x: 0, y: 0.5 },
          ]);
        },
      },
      {
        narration: "Notice where the heavy lifting moves as the rendering mode is switched to VBO.",
        waitForUser: true,
        focusPanel: 'buffers-panel',
        action: (state) => {
          const id = state.selectedObjectId;
          if (id) state.updateRenderingMode(id, 'VBO');
        },
      },
      {
        narration: "Notice how init() now contains glGenBuffers, glBindBuffer, and glBufferData. That setup runs exactly once. After that, the per-object draw function just binds the VBO and draws.",
        waitForUser: true,
      },
      {
        pane: 'math',
        narration: "Look at the math panel's CPU → GPU Traffic timeline — only frame 1 lights up green. The GPU keeps the data; subsequent frames are pure draw calls.",
        waitForUser: true,
      },
      {
        narration: "Buffers aren't just for triangles. Let's add a quad in VBO mode to show the same machinery applies to every primitive type.",
        waitForUser: true,
        action: (state) => {
          state.addCustomObject('QUADS', [
            { x: -0.7, y: 0.55 }, { x: -0.3, y: 0.55 },
            { x: -0.3, y: 0.85 }, { x: -0.7, y: 0.85 },
          ]);
          const id = useVamsStore.getState().selectedObjectId;
          if (id) state.updateRenderingMode(id, 'VBO');
        },
      },
      {
        narration: "Same code shape — verts_QUADS_1, glGenBuffers in init, bind-and-draw at render time. The pattern is uniform across primitive types.",
        waitForUser: true,
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
        narration: "When you upload a VBO, you also tell OpenGL how often the data will change. Different hints produce structurally different programs — let's see how.",
        waitForUser: true,
        action: (state) => {
          state.addCustomObject('TRIANGLES', [
            { x: -0.5, y: -0.4 }, { x: 0.5, y: -0.4 }, { x: 0, y: 0.5 },
          ]);
          const id = useVamsStore.getState().selectedObjectId;
          if (id) {
            state.updateRenderingMode(id, 'VBO');
            state.updateBufferUsage(id, 'STATIC');
          }
        },
      },
      {
        narration: "STATIC is what we have now — for terrain, logos, anything that never changes. Notice the program has no update_buffers() function. There's nothing to refresh, so the generator doesn't emit anything.",
        waitForUser: true,
        focusPanel: 'buffers-panel',
      },
      {
        narration: "Watch the code panel as the hint is changed to DYNAMIC — a whole new function appears.",
        waitForUser: true,
        focusPanel: 'buffers-panel',
        action: (state) => {
          const id = state.selectedObjectId;
          if (id) state.updateBufferUsage(id, 'DYNAMIC');
        },
      },
      {
        narration: "update_buffers() is now defined and registered as the idle callback at the bottom of main(). It runs every frame, calling glBufferSubData to push changed bytes to the GPU.",
        waitForUser: true,
      },
      {
        narration: "Now observe what happens when the hint changes to STREAM. The same function remains, but its body changes.",
        waitForUser: true,
        focusPanel: 'buffers-panel',
        action: (state) => {
          const id = state.selectedObjectId;
          if (id) state.updateBufferUsage(id, 'STREAM');
        },
      },
      {
        narration: "STREAM re-uploads the entire buffer every frame with glBufferData — the same call from init(), but in a hot loop. That's how particle systems or fully-deformed meshes work.",
        waitForUser: true,
      },
      {
        pane: 'math',
        narration: "Look at the math panel's traffic timeline to see the difference. STATIC is one green cell. DYNAMIC is sparse blue. STREAM is solid orange. The hint matches the actual data transfer cost.",
        waitForUser: true,
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
        narration: "DYNAMIC buffers come with two ways to update them. The default — glBufferSubData — pushes a range of bytes from CPU to GPU. There's another path that's worth knowing.",
        waitForUser: true,
        action: (state) => {
          state.addCustomObject('TRIANGLES', [
            { x: -0.5, y: -0.4 }, { x: 0.5, y: -0.4 }, { x: 0, y: 0.5 },
          ]);
          const id = useVamsStore.getState().selectedObjectId;
          if (id) {
            state.updateRenderingMode(id, 'VBO');
            state.updateBufferUsage(id, 'DYNAMIC');
            state.updateUpdateMethod(id, 'BUFFER_SUB_DATA');
          }
        },
      },
      {
        narration: "Look at update_buffers() — right now it calls glBufferSubData. We're going to switch the update method to Map Buffer and watch what happens.",
        waitForUser: true,
        focusPanel: 'buffers-panel',
      },
      {
        narration: "Switching to Map Buffer now.",
        waitForUser: true,
        focusPanel: 'buffers-panel',
        action: (state) => {
          const id = state.selectedObjectId;
          if (id) state.updateUpdateMethod(id, 'MAP_BUFFER');
        },
      },
      {
        pane: 'math',
        narration: "The function body is completely different. Instead of pushing bytes, we ask the driver for a raw pointer into GPU memory and write through it. The math panel just lit up with a Mapping diagram — that's the lifecycle we'll walk through now.",
        waitForUser: true,
      },
      {
        narration: "Step one: bind the buffer. After this, every buffer call talks to this VBO until something else binds.",
        waitForUser: true,
        dmaStep: 0,
      },
      {
        narration: "Step two: map it. The driver hands back a pointer to GPU memory you can write to directly — no upload, no copy.",
        waitForUser: true,
        dmaStep: 1,
      },
      {
        narration: "Step three: ptr[0] = 0.5f. The first slot is updated in place.",
        waitForUser: true,
        dmaStep: 2,
      },
      {
        narration: "Step four: ptr[1] = 0.7f. C pointer arithmetic moves the cursor forward; each write modifies GPU memory directly.",
        waitForUser: true,
        dmaStep: 3,
      },
      {
        narration: "Step five: two more writes at once. The cells you don't touch keep their previous values — this is the whole point of mapping.",
        waitForUser: true,
        dmaStep: 4,
      },
      {
        narration: "Step six: glUnmapBuffer commits the writes and invalidates the pointer. The green cells stay highlighted — only those slots changed.",
        waitForUser: true,
        dmaStep: 5,
      },
      {
        narration: "Now watch what happens as the top vertex of the triangle is moved automatically. Behind the scenes, this is exactly the kind of small, in-place change mapping is designed for.",
        waitForUser: true,
        dmaStep: 5,
        action: (state) => {
          const id = state.selectedObjectId;
          if (!id) return;
          const obj = state.objects.find(o => o.id === id);
          if (obj && obj.vertices[2]) {
            state.updateVertexPosition(id, obj.vertices[2].id, 0, 0.7);
          }
        },
      },
      {
        narration: "Sub-data and Map Buffer reach the same destination — both update the GPU's copy. Pick the one that matches the shape of your update.",
        waitForUser: true,
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
        narration: "I've added a triangle in immediate mode. Switch its rendering mode to VBO.",
        waitForUser: true,
        focusPanel: 'buffers-panel',
        action: (state) => {
          state.addCustomObject('TRIANGLES', [
            { x: -0.5, y: -0.4 }, { x: 0.5, y: -0.4 }, { x: 0, y: 0.5 },
          ]);
        },
        successCheck: (state) => {
          const obj = state.objects.find(o => o.id === state.selectedObjectId);
          return obj?.renderingMode === 'VBO';
        },
      },
      {
        narration: "Excellent! The GPU upload moved into init() and the draw function now just binds the buffer — that's the whole point of a VBO.",
        waitForUser: true,
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
        narration: "This logo never moves and never deforms. Set the right usage hint.",
        waitForUser: true,
        focusPanel: 'buffers-panel',
        action: (state) => {
          state.addCustomObject('QUADS', [
            { x: -0.4, y: -0.4 }, { x: 0.4, y: -0.4 }, { x: 0.4, y: 0.4 }, { x: -0.4, y: 0.4 },
          ]);
          const id = useVamsStore.getState().selectedObjectId;
          if (id) {
            state.updateRenderingMode(id, 'VBO');
            state.updateBufferUsage(id, 'DYNAMIC');
          }
        },
        successCheck: (state) => {
          const obj = state.objects.find(o => o.id === state.selectedObjectId);
          return obj?.renderingMode === 'VBO' && obj?.bufferUsage === 'STATIC';
        },
      },
      {
        narration: "Perfect! GL_STATIC_DRAW is exactly right. Notice update_buffers() disappeared from the code panel; STATIC has nothing to refresh.",
        waitForUser: true,
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
        narration: "Here's a quad drawn as two triangles — six vertices, but only four are unique. Enable indexed drawing to deduplicate.",
        waitForUser: true,
        focusPanel: 'buffers-panel',
        action: (state) => {
          state.addCustomObject('TRIANGLES', [
            { x: -0.4, y: -0.4 }, { x: 0.4, y: -0.4 }, { x: -0.4, y: 0.4 },
            { x: 0.4, y: -0.4 },  { x: 0.4, y: 0.4 },  { x: -0.4, y: 0.4 },
          ]);
          const id = useVamsStore.getState().selectedObjectId;
          if (id) state.updateRenderingMode(id, 'VERTEX_ARRAY');
        },
        successCheck: (state) => {
          const obj = state.objects.find(o => o.id === state.selectedObjectId);
          return !!obj?.useIndexed;
        },
      },
      {
        pane: 'math',
        narration: "Brilliant! Look at Array vs Indexed in the math panel — the indexed version stores 4 vertices plus 6 indices instead of 6 full vertices. The code panel now uses glDrawElements.",
        waitForUser: true,
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
        narration: "A quick check on what you've learned.",
        waitForUser: true,
        exercise: {
          kind: 'multiple-choice',
          prompt: "You're writing a particle system that regenerates every frame. Which usage hint fits best?",
          options: [
            { id: 'stream',  label: 'GL_STREAM_DRAW' },
            { id: 'static',  label: 'GL_STATIC_DRAW' },
            { id: 'dynamic', label: 'GL_DYNAMIC_DRAW' },
            { id: 'none',    label: 'No hint needed' },
          ],
          correctId: 'stream',
        },
      },
      {
        narration: "Spot on! Stream tells the driver this data is short-lived. Anything else and you'd waste memory or stall the GPU.",
        waitForUser: true,
      },
    ],
  },
};