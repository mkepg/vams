# VAMS Product Plan

**Document purpose:** Authoritative product plan for the Visual Animation Modeling Simulator (VAMS). This document defines what VAMS is, what it does, and how it should behave — not how it should be implemented. Implementation decisions belong in the codebase and supporting developer documentation.

**Project:** `Panic-TheCisco-VAMS`

---

## Reading Order

1. **Product Overview** — the one-page mental model for the whole system.
2. **Core Constraints** — non-negotiable rules that apply to every stage.
3. **Stage 0 — Foundation** — do this first. Establishes the application shell, infrastructure, and curriculum framework that all subsequent stages build on.
4. **Stages 1–5 — Curriculum Sections** — build in order. Each stage delivers a complete curriculum section.
5. **Appendices** — data model, lesson format, deferred features, risk register, milestones.

---

## Product Overview

VAMS is a **GUI-only, 2D OpenGL teaching simulator**. Students interact with a visual canvas to author scenes, and VAMS shows them the corresponding OpenGL code in real time. There is no code editor, no interpreter, and no runtime — the student never writes or executes code. Everything the student does in the GUI is reflected immediately in a synchronized, read-only code view and a synchronized math panel.

```
┌──────────────────────────────────────────────────┐
│              STUDENT INTERACTION (GUI)            │
│     Tools Rail · Canvas · Lesson Bar              │
└──────────────────────┬───────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
   VIEWPORT        CODE VIEW       MATH VIEW
  (2D Canvas)     (generated)      (derived)
```

All three views are always synchronized. Mutations flow in one direction: student action → application state → views recompute. Views never mutate state.

Two modes:

- **Author** — default. The student freely manipulates the scene via the GUI.
- **Lesson** — a scripted, narrated sequence of scene states. Exercises are lessons that include a success check.

Five curriculum sections, selectable via a tab strip: **Pipeline**, **Primitives**, **Buffers**, **Transforms**, **Textures**. Each section controls which tools and panels are visible. Scene state persists across section switches.

---

## Core Constraints

Non-negotiable. Do not violate without a written amendment to this document.

### Product

- **2D-only rendering.** VAMS renders a 2D canvas. No 3D engine or 3D geometry is ever introduced.
- **GUI-only authoring.** The code panel is always read-only. Students never type OpenGL code. All code is generated from scene state.
- **Internal deferrals (UI-silent):**
  - `gluPerspective` and `glFrustum` are deferred. No GUI controls. Never emitted in generated code.
  - All lighting APIs (`glEnable(GL_LIGHTING)`, `glLightfv`, `glMaterialfv`, `glNormal3f`, etc.) are deferred. No GUI controls. Never emitted in generated code.
- **No visible indication of deferral.** No "coming soon", "not supported", "3D", "future", or "lighting" language anywhere in the student-facing UI, tooltips, lesson narrations, or generated code comments.
- **User-facing section labels:** `Pipeline | Primitives | Buffers | Transforms | Textures`. Never "Lighting". Never "Phase N" in student-facing UI.

### Pedagogical

- **Two modes only: Author and Lesson.** No other mode distinctions.
- **Code panel must be visually compelling.** It occupies a significant portion of workspace width. Lines animate briefly when scene mutations change the generated output. Lessons actively direct students to read the code panel.
- **Math panel sits below the code panel** in the same sidebar column. Both are always read-only projections of state.
- **Each curriculum section ships with 3–6 demos and 3–6 exercises.**
- **Instructor vocabulary wins.** Section labels and in-app terminology match what the instructor uses in lecture.
- **Every GUI control maps to a real OpenGL concept.** No proprietary abstractions or conveniences that don't correspond to actual OpenGL emissions.

### Section Switching Semantics

When the student switches curriculum sections:

| State | Behavior on section change |
|---|---|
| Scene objects, vertices, transforms, textures | **Preserved.** The student's work persists. |
| Current selection | **Preserved.** |
| View settings (pan/zoom, grid, theme, background color) | **Preserved.** |
| Loaded textures | **Preserved.** |
| Active lesson | **Auto-exits with a confirmation dialog** if mid-lesson. If no lesson is active, no dialog. |
| Exercise answers | **Cleared.** Each section's exercises start fresh. |
| Ephemeral tools-rail state (collapsed panels, transient picker states) | **Reset to defaults.** |
| Section-specific view modes | **Reset to defaults.** |

This behavior is enforced at a single, well-defined point in the section-switching flow. It is not scattered across individual components.

---

## Stage 0 — Foundation

**Purpose:** Establish the complete application shell, state architecture, rendering infrastructure, code generation framework, lesson engine skeleton, and section-switching infrastructure that Stages 1–5 build on. At the end of Stage 0, the app is fully functional as an empty-scene authoring tool with one working curriculum section (Pipeline) and one end-to-end demo proving the lesson engine works.

### Goals

1. The application has a stable workspace layout: a tools rail on the left, a 2D canvas in the center, and a right column containing a code panel and a math panel.
2. Application state is organized into clearly owned slices with no overlapping responsibility.
3. The code generator produces deterministic, section-appropriate OpenGL output from scene state.
4. The renderer displays 2D primitives correctly on the canvas.
5. Undo/redo and project save/load work end-to-end and are preserved through all subsequent changes.
6. The lesson engine can run a scripted, narrated, multi-step demo with scene mutations and success checks.
7. The section selector switches between curriculum sections with the correct state semantics defined above.
8. The math panel scaffold exists and can display content specific to the active section.

### Application State

VAMS maintains several distinct areas of state, each with a single clear owner. These are not implementation prescriptions — they are ownership boundaries that must be respected regardless of how the implementation organizes them:

- **Scene state** — the set of objects, vertices, transforms, hierarchy, and selection. The centerpiece of all pedagogy.
- **View state** — viewport configuration, theme, grid settings, background color, and section-specific view modes. UI configuration that is not pedagogically meaningful.
- **History state** — undo/redo stack and checkpoint boundaries. Wraps mutations to scene state.
- **Runtime state** — current mode (Author or Lesson) and the currently-active curriculum section.
- **Lesson state** — active lesson, current step, exercise answer storage, and success state.
- **Texture state** *(Stage 5)* — uploaded texture assets. Separate from scene state because textures are binary assets with their own upload lifecycle.

### Workspace Layout

The workspace has four regions:

- **Top bar** — application-level controls: project actions (new, open, save), undo/redo, mode indicator.
- **Tools rail** — left sidebar. Section-specific tools and panels for authoring the scene. Content changes per active section.
- **Canvas** — central 2D viewport. Displays the scene. Supports mouse interaction for object placement, selection, vertex editing, and navigation.
- **Code + Math column** — right sidebar split vertically. Top portion: the code panel. Bottom portion: the math panel.

A lesson bar appears at the bottom when a lesson is active, showing the narration text and navigation controls (Back, Next, Exit). It is not visible in Author mode.

### Code Generation

The code generator takes the current scene state and produces a complete, valid OpenGL 1.x / GLUT program as text. Key requirements:

- Output is deterministic. The same scene state always produces the same code.
- The full scene is always shown. There is no partial or per-object view.
- When a scene mutation changes the generated output, the changed lines briefly animate to draw the student's eye.
- The selected object's corresponding code lines are visually distinguished.
- The generator never emits deferred symbols (see Appendix C).

The generated program structure includes at minimum: includes/setup, global declarations, an `init()` function for one-time setup, a `display()` callback, and a `main()` function with GLUT initialization.

### Lesson Engine

A lesson is a sequence of steps. Each step may include:

- **Narration text** — displayed in the lesson bar.
- **A scene mutation** — a scripted change to scene state, expressed through the same mutation API the GUI uses.
- **A code highlight** — specific lines in the code panel to visually emphasize.
- **A wait-for-user flag** — whether the student must press Next to advance, or whether the step auto-advances.

An exercise is a lesson with a `successCheck` — a pure function that inspects the current scene state and returns whether the student has met the goal.

Lessons are authored as structured data (not code strings, not a custom DSL). They use the same scene mutation API available to the GUI, so every lesson-driven change is something the student could also do manually.

### Project Save / Load

VAMS supports saving and loading the full scene as a project file. Requirements:

- Save and load are always available via the top bar.
- A loaded project produces an identical rendered scene and generated code as when it was saved.
- The loader is resilient to reasonable schema variations (e.g., field renames from earlier versions).
- All saves emit a normalized, current-format file.

### Acceptance Criteria

- [ ] The workspace renders with tools rail, canvas, code panel, and math panel in the correct layout.
- [ ] Creating, selecting, moving, and deleting objects works.
- [ ] Generated code updates in real time as scene state changes; changed lines animate.
- [ ] Undo and redo work across all scene mutations.
- [ ] Project save and load round-trip without data loss.
- [ ] The section selector switches sections with the correct state semantics.
- [ ] At least one end-to-end demo lesson plays: narration advances, scene mutations fire, code panel reflects changes.
- [ ] The math panel scaffold is present and can display section-specific content.
- [ ] No deferred symbols appear in any generated code.

---

## Stage 1 — Pipeline

**Curriculum:** The OpenGL rendering pipeline, rasterization, normalized device coordinates, the GLUT program structure.

Covers: pipeline stages (vertex specification → vertex processing → primitive assembly → rasterization → fragment processing → per-sample operations), NDC coordinate space, the raster vs. vector distinction, and the anatomy of a minimal GLUT program.

### Goals

1. Students can view and step through a visual diagram of the seven pipeline stages, with each stage explained.
2. Students can explore normalized device coordinates interactively by placing markers and reading their NDC values.
3. Students can see the conceptual difference between raster and vector representations.
4. The code panel shows a complete, annotated GLUT boilerplate for an empty scene when Pipeline is the active section.
5. Each line of the boilerplate can be hovered for an explanatory tooltip.
6. The math panel shows live cursor NDC coordinates and the window-to-viewport mapping equation.

### Workspace Configuration

- **Tools Rail:** section-specific viewport mode controls (pipeline diagram, NDC coordinate playground, raster/vector view), and a mode switch to toggle between them.
- **Viewport:** the active mode determines what's shown:
  - *Pipeline diagram mode* — a visual, step-through diagram of the seven pipeline stages.
  - *Coordinate playground mode* — a coordinate grid where the student can place and move markers, reading their NDC positions.
  - *Raster/vector mode* — a split view illustrating the difference between raster and vector representations.
- **Code Panel:** when the scene is empty, shows the complete GLUT boilerplate with hoverable line annotations.
- **Math Panel:** live cursor NDC position and a contextual note for the currently-highlighted pipeline stage.

### Demos (minimum 4)

1. **"From Vertex to Pixel"** — steps through the seven pipeline stages, highlighting each stage in the diagram with narration.
2. **"Raster vs Vector"** — demonstrates the raster/vector split view and narrates the key difference.
3. **"Normalized Device Coordinates"** — places a marker in the coordinate playground at several positions and narrates the coordinate system.
4. **"Anatomy of a GLUT Program"** — steps through the boilerplate line by line, with narration explaining each section.

### Exercises (minimum 3)

1. **"Place the Point"** — the student places a marker at a specified NDC coordinate within a given tolerance.
2. **"Which Stage?"** — given a visual artifact (e.g., visible pixel stepping on a diagonal edge), the student identifies which pipeline stage produced it from a set of labeled choices.
3. **"Order the Pipeline"** — given a scrambled list of pipeline stage names, the student reorders them correctly.

### Acceptance Criteria

- [ ] Selecting the Pipeline section switches the viewport to the pipeline-section layout.
- [ ] The viewport mode switch toggles between diagram, coordinate playground, and raster/vector views.
- [ ] Hovering a line in the boilerplate code panel shows the correct annotation tooltip.
- [ ] The math panel shows live NDC coordinates that update as the cursor moves over the viewport.
- [ ] All demos play end-to-end. All exercises have working success detection.

### Estimated Effort

**~1.5–2 weeks.** Pipeline diagram and coordinate playground are self-contained new views. Most time is lesson content.

---

## Stage 2 — Primitives

**Curriculum:** Geometric primitives, color, line styling, bitmap text, GLUT callbacks.

Covers: `glBegin`/`glEnd` with `GL_POINTS`, `GL_LINES`, `GL_LINE_STRIP`, `GL_LINE_LOOP`, `GL_TRIANGLES`, `GL_TRIANGLE_STRIP`, `GL_TRIANGLE_FAN`, `GL_QUADS`, `GL_QUAD_STRIP`, `GL_POLYGON`; `glColor3f` and `glColor3ub`; `glLineWidth` and `glLineStipple`; `glRasterPos2f` + `glutBitmapCharacter`; GLUT callback registrations (`glutKeyboardFunc`, `glutMouseFunc`, `glutReshapeFunc`).

### Goals

1. Students can place all curriculum primitives onto the canvas via a primitive palette and see the corresponding `glBegin`/`glVertex`/`glEnd` sequences in the code panel.
2. Students can choose between float and byte color representations per object, and see both forms in the code and math panel.
3. Students can style line primitives with width and stipple patterns, with visual feedback in both the canvas and the code panel.
4. Text objects generate correct `glRasterPos2f` + `glutBitmapCharacter` code (not stroke text).
5. Students can register GLUT callback handler names via a dedicated panel and see the corresponding registration calls and empty handler bodies appear in the generated code. The panel clearly communicates that callback execution requires compiling and running the program externally.

### Workspace Configuration

- **Tools Rail:** primitive palette (all curriculum primitives by OpenGL name), color picker with float/byte mode toggle, line style panel (shown only for line primitives), callbacks panel, and existing object hierarchy and properties.
- **Viewport:** 2D authoring canvas. Students click to place vertices and click to select objects.
- **Code Panel:** full generated scene code. Changed lines animate on every scene mutation.
- **Math Panel:** color conversion formulas (float ↔ byte), barycentric color interpolation (for triangles with per-vertex colors), stipple pattern bit display, and a vertex coordinate table for the selected object.

### Primitive Palette Behavior

- Each primitive is listed by its OpenGL name.
- For primitives with a fixed structure (e.g., `GL_TRIANGLES`, `GL_QUADS`), clicking creates an object with default-placed vertices.
- For primitives where placement is ambiguous (e.g., `GL_POLYGON`, `GL_LINE_STRIP`, `GL_TRIANGLE_STRIP`), clicking starts a vertex-placement interaction where the student clicks in the viewport to place each vertex, then confirms.
- Convenience presets (e.g., a circular `GL_TRIANGLE_FAN`, a square as `GL_QUADS`) are permitted. They must be clearly labeled with the underlying primitive type so the student understands exactly what they're creating. They do not introduce fake primitive types.

### Callback Panel Behavior

The callbacks panel allows the student to register handler names for keyboard, mouse, reshape, and related events. Each registration causes the code generator to emit the corresponding `glutXxxFunc(handlerName)` call and an empty handler body stub.

The panel includes a persistent informational note explaining that handler execution requires compiling and running the exported code. This is accurate framing, not a feature disclaimer. The note does not use the words "coming soon", "deferred", "3D", "future", or "not supported".

### Demos (minimum 4)

1. **"Drawing a Triangle"** — adds a triangle vertex by vertex, narrating each step. Both the viewport and code panel update in sync.
2. **"Float vs Byte Colors"** — toggles an object's color mode and narrates the conversion shown in the math panel.
3. **"Barycentric Color Across a Triangle"** — sets per-vertex colors, demonstrates interpolation, narrates the formula in the math panel.
4. **"Line Stippling"** — applies stipple to a line, demonstrates different patterns.
5. **"Keyboard Callback"** — registers a keyboard handler name in the callbacks panel and narrates the emitted code.

### Exercises (minimum 4)

1. **"Build a Triangle"** — add a non-degenerate triangle to an empty scene.
2. **"Match the Color"** — match a target color swatch using the color picker, within a defined tolerance.
3. **"Toggle to Byte Color"** — switch a given object from float to byte color mode and match a target byte value.
4. **"Enable Stippling"** — apply a stipple with specified factor and pattern to a given line.
5. **"Register a Mouse Handler"** — register a named mouse handler via the callbacks panel. Success when the correct `glutMouseFunc` call appears in generated code.

### Acceptance Criteria

- [ ] All curriculum primitives can be added via the Primitive Palette.
- [ ] Color mode toggle switches generated code between `glColor3f` and `glColor3ub`.
- [ ] Line style panel appears only for line primitives; stipple shows in both canvas rendering and generated code.
- [ ] Text objects generate `glRasterPos2f` + `glutBitmapCharacter`.
- [ ] Registering a callback inserts the `glut*Func` call and empty handler body into generated code.
- [ ] Callbacks panel includes the required informational framing note.
- [ ] Math panel updates live for color, barycentric, and stipple content.
- [ ] All demos play end-to-end. All exercises have working success detection.
- [ ] Code panel diff-highlight animates on every scene mutation.
- [ ] No deferred symbols appear in generated code.

### Estimated Effort

**~1.5–2.5 weeks.** Content authoring and code-generator extensions are the bulk. Most UI surface already exists from Stage 0.

---

## Stage 3 — Buffers

**Curriculum:** Memory management, vertex arrays, VBOs, buffer usage hints, direct memory access.

Covers: immediate mode vs. vertex arrays vs. VBOs, `glEnableClientState` / `glVertexPointer` / `glDrawArrays`, `glGenBuffers` / `glBindBuffer` / `glBufferData`, `GL_STATIC_DRAW` / `GL_DYNAMIC_DRAW` / `GL_STREAM_DRAW`, `glMapBuffer` / `glUnmapBuffer`, indexed drawing with `glDrawElements`.

### Goals

1. Students can switch any object between three rendering modes (Immediate, Vertex Array, VBO) and see the structural change in generated code immediately.
2. Students can set buffer usage hints on VBO-mode objects and understand the performance semantics via a visualization in the math panel.
3. Students can see a visual representation of direct memory access (`glMapBuffer`) with a pointer diagram.
4. The math panel shows byte-size calculations, array vs. indexed memory savings, and an interleaved layout diagram for combined position + color buffers.

### Workspace Configuration

- **Tools Rail:** all prior tools + a rendering mode selector (Immediate / Vertex Array / VBO) per object + a buffer usage selector (Static / Dynamic / Stream) shown only for VBO-mode objects.
- **Viewport:** same 2D authoring canvas. Visual rendering is identical across all three modes — the mode affects only the generated code, not the visual output.
- **Code Panel:** the structural change between modes is the key teaching moment. The diff animation is especially important in this section.
- **Math Panel:** buffer size formula (byte count from vertex count), array vs. indexed savings (when applicable), interleaved layout diagram (when per-vertex colors are present), and context-specific diagrams during relevant demo steps.

### Rendering Mode Behavior

Switching a rendering mode changes the generated code structure without changing the visual canvas output. The three modes produce structurally distinct code:

- **Immediate** — `glBegin`/`glVertex`/`glEnd` sequence inline in `display()`.
- **Vertex Array** — vertex data declared as an array; drawn via `glDrawArrays` with `glVertexPointer` enabled.
- **VBO** — buffer setup hoisted into `init()`; drawing uses a bound VBO in `display()`.

For indexed primitives (e.g., polygons rendered as triangle fans), the code generator emits `glDrawElements` with an index array.

### Buffer Flow Visualization

During relevant demo steps, the math panel displays a visual diagram showing data transfer between CPU and GPU over a simulated frame timeline. The diagram adapts based on the active usage hint:

- **Static** — one transfer on the first frame; no subsequent transfers.
- **Dynamic** — transfers on occasional frames.
- **Stream** — a transfer every frame.

This diagram is used across multiple demos and is parameterized by the transfer schedule, not built separately per demo.

### Direct Memory Access Visualization

During the `glMapBuffer` demo, the math panel displays a diagram of a buffer as a row of cells representing vertex data, with a pointer arrow indicating the mapped pointer position. The diagram updates step by step as the demo narrates mapping, writing, and unmapping. The vertex update is reflected in the viewport as a real scene mutation — no interpreter is involved.

### Demos (minimum 4)

1. **"Immediate Mode: Every Frame"** — narrates what happens on each frame in immediate mode; the buffer flow diagram shows per-frame transfer.
2. **"Converting to Vertex Arrays"** — switches existing scene objects to Vertex Array mode; the code panel diff is the pedagogical centerpiece.
3. **"VBOs: Send Once"** — switches to VBO mode; narrates the `init()` setup and `display()` drawing separation.
4. **"Buffer Usage Hints"** — toggles a VBO object's usage hint through all three values; the buffer flow diagram and narration explain the performance semantics of each.
5. **"glMapBuffer: Direct Memory Access"** — narrates the mapping lifecycle step by step, with pointer diagram and a real vertex update reflected in the viewport.

### Exercises (minimum 4)

1. **"Switch to VBO"** — given an immediate-mode scene, switch all objects to VBO mode.
2. **"Use Static for Unchanging Data"** — given a VBO-mode object, select the appropriate usage hint.
3. **"Reduce Memory with Indexed Drawing"** — switch a naive vertex-repeated quad to an indexed primitive.
4. **"Pick the Right Usage Hint"** — given a described scenario, select the appropriate usage hint from the three choices.

### Acceptance Criteria

- [ ] Toggling rendering mode changes the generated code structure without changing the visual render.
- [ ] VBO mode produces both `init()` setup and `display()` drawing code.
- [ ] Buffer usage selector appears only for VBO-mode objects.
- [ ] Math panel shows correct byte-size calculations.
- [ ] Code panel diff animation clearly shows the structural change on mode toggle.
- [ ] Buffer flow diagram appears correctly during relevant demo steps.
- [ ] All demos play end-to-end. All exercises have working success detection.
- [ ] No deferred symbols appear in generated code.

### Estimated Effort

**~1.5–2.5 weeks.** Code-generator extensions are the bulk. No new subsystems beyond the buffer visualization components.

---

## Stage 4 — Transforms

**Curriculum:** Matrix math, transformations, the matrix stack, orthographic viewing.

Covers: `glTranslatef`, `glRotatef`, `glScalef`, `glPushMatrix`/`glPopMatrix`, `glMatrixMode`, `glLoadIdentity`, `glOrtho`.

**Internal deferrals (UI-silent):** `gluPerspective`, `glFrustum`. No controls. No mentions.

### Goals

1. Students can apply translate, rotate, and scale to objects via a transform gizmo on the canvas and see the corresponding OpenGL calls appear in the code panel.
2. Students can see the matrix representation of their transforms in the math panel, including the composed matrix for the selected object.
3. Students can see a compact matrix stack visualization reflecting the selected object's ancestor chain.
4. Students can adjust the orthographic viewport limits via a dedicated editor and see the `glOrtho(...)` call update in generated code.
5. Parent-child hierarchies produce correctly nested `glPushMatrix`/`glPopMatrix` sequences in generated code.

### Workspace Configuration

- **Tools Rail:** all prior tools + transform gizmo mode toggle (translate / rotate / scale) + numeric transform inputs for the selected object + glOrtho editor (left, right, bottom, top).
- **Viewport:** selected object shows a transform gizmo appropriate to the current mode (translate arrows, rotate ring, scale handles). A matrix stack panel appears as a compact overlay when in the Transforms section.
- **Code Panel:** generated code includes `glMatrixMode`, `glLoadIdentity`, and per-object `glPushMatrix`/transform calls/`glPopMatrix` sequences. The `glOrtho` call appears at the top of `display()`.
- **Math Panel:** 4×4 matrix display of the selected object's transform, matrix composition trace, and the glOrtho mapping equation.

### Transform Gizmo Behavior

The transform gizmo is a canvas overlay attached to the selected object. It has three modes:

- **Translate** — two axis-constrained arrows. Dragging constrains to the chosen axis. Dragging the origin handle allows free 2D motion.
- **Rotate** — a circular ring around the object. Dragging rotates around the center.
- **Scale** — corner and edge handles. Corner dragging scales both axes (with optional aspect-ratio lock); edge dragging scales a single axis.

The gizmo is only shown in the Transforms section. Other sections use the existing simple drag-to-translate behavior.

### Non-Uniform Scale

The transform model exposes independent X and Y scale. The transform inputs panel shows separate scaleX and scaleY fields with an aspect-ratio lock toggle (default locked). Unlocking allows independent non-uniform scaling.

### Matrix Stack Visualization

The matrix stack panel is a compact vertical list of matrices derived from the selected object's ancestor chain. It shows what the `glPushMatrix`/`glPopMatrix` calls in the generated code would produce at the point where the selected object is drawn. The stack is synthetic — it reflects the scene hierarchy, not a running interpreter.

### glOrtho Editor

A dedicated panel with four numeric inputs (left, right, bottom, top) that control the viewport's visible coordinate range. Changing these values updates the canvas viewport and causes the `glOrtho(...)` call in generated code to update.

### Code Generation for Transforms

The generated code emits transforms in the conventional T-R-S order (translate, then rotate, then scale). For grouped objects, nested `glPushMatrix`/`glPopMatrix` reflects the parent-child structure.

### Demos (minimum 4)

1. **"Translate, Rotate, Scale"** — applies each transform operation in sequence with narration, pointing to the generated code at each step.
2. **"Matrix Representation"** — shows the math panel matrix updating as transforms are applied.
3. **"The Matrix Stack"** — creates a parent-child group and narrates how `glPushMatrix`/`glPopMatrix` produce local transforms.
4. **"glOrtho: Changing the View"** — adjusts glOrtho values and narrates how the viewport coordinate range changes.

### Exercises (minimum 4)

1. **"Translate to Position"** — move an object to a specified coordinate using the gizmo or numeric inputs.
2. **"Rotate to Angle"** — rotate an object to a specified angle.
3. **"Build a Hierarchy"** — create a parent-child group and produce a specified nested transform sequence in generated code.
4. **"Set the Viewport Range"** — configure `glOrtho` parameters to match a target visible coordinate range.

### Acceptance Criteria

- [ ] Transform gizmo appears on the selected object in all three modes when in the Transforms section.
- [ ] Dragging gizmo handles updates the transform and the generated code in real time.
- [ ] Math panel shows the 4×4 matrix for the selected object's transform.
- [ ] Matrix stack panel reflects the ancestor chain correctly.
- [ ] glOrtho editor updates both the canvas viewport and the generated code.
- [ ] Nested groups produce correctly nested `glPushMatrix`/`glPopMatrix` in generated code.
- [ ] Non-uniform scale inputs work with the aspect-ratio lock toggle.
- [ ] All demos play end-to-end. All exercises have working success detection.
- [ ] No deferred symbols appear in generated code.

### Estimated Effort

**~2–3 weeks.** Transform gizmo, matrix visualization, and lesson content are the bulk.

---

## Stage 5 — Textures

**Curriculum:** Texture mapping, image loading, UV coordinates, filtering, wrapping.

Covers: `glGenTextures`, `glBindTexture`, `glTexImage2D`, `glTexParameteri` (filter and wrap modes), `glTexCoord2f`, UV mapping, `GL_NEAREST`/`GL_LINEAR`, `GL_REPEAT`/`GL_CLAMP_TO_EDGE`, indexed drawing with textures.

**Internal deferrals (UI-silent):** All lighting APIs. No controls. No mentions anywhere in the UI, lesson content, or generated code.

### Goals

1. Students can upload images and apply them as textures to scene objects, with the texture rendering live on the canvas.
2. Students can edit UV coordinates via draggable handles on a texture preview, with immediate visual feedback in the canvas.
3. Students can toggle filtering and wrapping modes and see the visual difference on the canvas.
4. The generated code includes the full texture setup in `init()` and per-object bind + `glTexCoord2f` + `glVertex2f` calls in `display()`.
5. Projects with textures save and load correctly, including the texture image data.

### Workspace Configuration

- **Tools Rail:** all prior tools + texture library (upload button, thumbnail list, delete) + texture attachment control (apply a loaded texture to the selected object) + filter mode toggle (Nearest / Linear) + wrap mode toggle (Repeat / Clamp).
- **Viewport:** textured objects render with the applied texture. The canvas reflects filter and wrap settings visually.
- **UV Editor:** a compact inline panel in the tools rail showing the attached texture at small scale with draggable UV handles, one per vertex. Handles can be dragged outside `[0, 1]` to demonstrate wrap behavior.
- **Code Panel:** texture setup in `init()`; per-object bind + `glTexCoord2f` + `glVertex2f` in `display()`.
- **Math Panel:** UV coordinate table, texel sampling equations (based on active filter mode), wrap equations (based on active wrap mode), UV barycentric interpolation for triangles.

### Texture Storage

Loaded textures are a distinct category of application state, separate from scene objects, because they have their own upload lifecycle and are referenced by scene objects. Projects include texture image data so they are fully self-contained.

### Project Load Behavior for Textures

When loading a project, if a scene object references a texture that is not present in the loaded texture data, VAMS handles this explicitly:

- The missing texture is detached from the object.
- A single, calm toast message informs the student that some textures could not be loaded and were detached. No specifics about which objects or which textures are surfaced.
- This is not a silent failure — it is always surfaced to the student.

### Sample Textures

VAMS ships with a small set of sample textures available directly from the texture library without uploading, including at minimum a seamless pattern, a checker pattern useful for UV debugging, and a UV test pattern.

### Demos (minimum 4)

1. **"From Image to Texture"** — uploads a sample texture, applies it to a quad, and narrates each section of the generated setup code.
2. **"UV Coordinates"** — starts with default UV mapping, adjusts coordinates, and narrates the effect.
3. **"Filtering"** — zooms in on a textured object and toggles between Nearest and Linear filtering, narrating the visual difference.
4. **"Wrapping"** — pushes UVs outside `[0, 1]` and toggles between Repeat and Clamp, narrating the visual difference.
5. **"Texture on a Triangle"** — applies a texture to a triangle, drags UV handles, and narrates how barycentric interpolation samples the texture.

### Exercises (minimum 4)

1. **"Apply a Texture"** — upload a sample texture and apply it to a created quad.
2. **"Tile the Texture"** — produce a 3×3 tile by setting UVs to `(0,0)–(3,3)` with Repeat wrapping.
3. **"Pixelate"** — switch a zoomed textured quad to Nearest filtering to make it appear pixelated.
4. **"Map UVs to Match Target"** — adjust UV coordinates to match a target rendered result, within a defined tolerance.

### Acceptance Criteria

- [ ] Uploading an image adds it to the texture library with a thumbnail.
- [ ] Attaching a texture renders it correctly on the canvas.
- [ ] Toggling filter mode changes the rendered result (blocky vs smooth on zoom).
- [ ] Toggling wrap mode changes the rendered result for out-of-bounds UVs.
- [ ] UV handles can be dragged; the canvas updates live.
- [ ] Generated code contains full texture setup in `init()` and per-object bind + `glTexCoord2f` in `display()`.
- [ ] No lighting-related symbols appear anywhere in the UI or generated code.
- [ ] Saving a project with textures and reloading preserves them correctly.
- [ ] Loading a project with a missing texture detaches it cleanly and shows a single toast.
- [ ] All demos play end-to-end. All exercises have working success detection.

### Estimated Effort

**~2–3 weeks.** Textured canvas rendering and UV editing are new; texture persistence requires careful handling.

---

## Appendix A — Data Model

The final shape of the core application data after all stages are complete. This appendix describes *what* the data represents, not how it is stored or typed in code.

### Scene Objects

Each scene object has:

- **Identity** — a unique identifier and a display name.
- **Type** — one of the OpenGL primitive types (`POINTS`, `LINES`, `LINE_STRIP`, `LINE_LOOP`, `TRIANGLES`, `TRIANGLE_STRIP`, `TRIANGLE_FAN`, `QUADS`, `QUAD_STRIP`, `POLYGON`), or `TEXT`, or `GROUP`.
- **Visibility** — whether the object is shown in the canvas and emitted in generated code.
- **Vertices** — an ordered list of vertex positions with optional per-vertex color.
- **Transform** — translation (x, y), rotation (degrees), and independent x and y scale.
- **Hierarchy** — optional parent reference and an ordered list of child references.
- **Color mode** *(Stage 2+)* — float or byte color representation.
- **Line style** *(Stage 2+)* — width and optional stipple (factor + 16-bit pattern), relevant for line primitives.
- **Rendering mode** *(Stage 3+)* — Immediate, Vertex Array, or VBO.
- **Buffer usage** *(Stage 3+)* — Static, Dynamic, or Stream; relevant only for VBO mode.
- **Texture attachment** *(Stage 5+)* — reference to a loaded texture, with filter mode and wrap mode.
- **UV coordinates** *(Stage 5+)* — one UV pair per vertex; defaults to a unit-square mapping.

### State Ownership Summary

| Area | What it owns |
|---|---|
| Scene | All objects, selection, vertex data, hierarchy, and mutations thereof |
| View | Viewport configuration, theme, grid settings, background color, interaction mode, section-specific view settings, registered callback names |
| History | Undo/redo stack and checkpoint boundaries |
| Runtime | Current mode (Author/Lesson) and active curriculum section |
| Lesson | Active lesson, current step, exercise answers, success state |
| Textures *(Stage 5)* | Uploaded texture assets, their image data, and cached rendering handles |

### Persisted vs. Session State

Scene objects are not persisted to browser storage — they are saved and loaded via explicit project file I/O. Texture image data is included in the project file for self-containment. UI configuration (theme, grid preferences, background color) may be persisted to browser storage for convenience across sessions. Lesson progress is session-only and does not persist across page loads.

### Project File

The project file is a self-contained snapshot of scene objects and texture assets. The format is versioned. Loading a project always produces a scene identical in visual output and generated code to when it was saved. Future schema changes are additive where possible; breaking changes require an explicit migration path.

---

## Appendix B — Lesson Format

### Structure

A lesson is a named, section-associated sequence of steps. Lessons are one of two kinds:

- **Demo** — narrated, scripted scene walkthrough. Students advance at their own pace.
- **Exercise** — narrated walkthrough plus a success condition. The condition is checked continuously as the student interacts with the scene.

Each step may include:

- Narration text (displayed in the lesson bar)
- A scene mutation (executed via the same API the GUI uses — nothing a lesson does bypasses normal state management)
- A code panel highlight (specific lines to visually emphasize)
- A wait-for-user flag

Exercises additionally have a success check — a pure function that reads current scene state and returns whether the student has met the goal.

### Exercise Answer Types

Exercises record student answers as structured data. The supported answer types are: multiple choice (a selected option from a fixed set), ordered list (a ranked sequence of items), numeric (a number), and position (an x,y coordinate). New exercise formats add a new answer type rather than using an untyped catch-all.

### Authoring Guidance

- Keep narration short. One or two sentences per step.
- Prefer user-paced steps. Use wait-for-user unless the step is purely visual.
- Every scene mutation in a lesson must correspond to something a student could do via the GUI. If a needed mutation isn't exposed by the GUI, extend the GUI (and the underlying mutation capability) rather than adding a lesson-only backdoor.
- Success checks must be pure and fast. They run after every scene mutation.
- Prefer many small steps over few large ones. Students benefit from finer-grained pacing control.

### Validation

Lessons are validated at development time. Warnings are issued for: non-unique lesson IDs, empty step arrays, exercises without success checks, and code-line highlights referencing lines that don't exist in the generated output.

---

## Appendix C — Deferred Features (Internal)

**This appendix is not visible to students.** It exists to document what is intentionally absent from VAMS, and why.

### Deferred Symbols

VAMS never exposes these in the UI and never emits them in generated code:

| Symbol | Reason |
|---|---|
| `gluPerspective` | 3D projection; VAMS is 2D-only |
| `glFrustum` | 3D projection; VAMS is 2D-only |
| `glEnable(GL_LIGHTING)` / `glDisable(GL_LIGHTING)` | Lighting is out of scope |
| `glLightfv`, `glLightf`, `glLightiv`, `glLighti` | Lighting parameter APIs |
| `glMaterialfv`, `glMaterialf`, `glMaterialiv`, `glMateriali` | Material APIs (lighting-adjacent) |
| `glColorMaterial` | Lighting-adjacent |
| `glNormal3f`, `glNormal3fv` | 3D normals; lighting-adjacent |
| `glShadeModel` (in lighting context) | Lighting-adjacent |

### Enforcement

No GUI control should map to any deferred symbol. Generated code output should be verified against this list before each release. The test suite should assert that representative scenes produce no deferred symbols.

### Language Discipline

User-facing text — UI labels, tooltips, lesson narrations, error messages — must not contain: "coming soon", "not yet", "future", "deferred", "unsupported", "3D" (as a missing-feature explanation), or "lighting" in any section label or tab. These words appear only in internal documentation, code comments, and this plan.

---

## Appendix D — Risk Register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | Code panel becomes decorative; students stop reading it | High | Keep it visually prominent. Animate diffs on every change. Lessons actively direct students to read it. |
| 2 | GUI adds conveniences that don't map to real OpenGL | High | Every GUI control must correspond to specific OpenGL code emission. No proprietary abstractions. |
| 3 | Lesson engine scope creeps (custom DSLs, authoring UI) | Medium | Keep the step type compact. Lessons use structured data over the standard mutation API. Instructor-authored content is out of scope. |
| 4 | Deferred symbols leak into generated code | High | Verify generated output against the deferred symbol list on every build and before every release. |
| 5 | "Lighting" or "3D" language leaks into UI text | High | Review all UI strings and lesson narrations before release. |
| 6 | Future schema changes lose saved data | Medium | Version the project file format. Require an explicit migration function for breaking changes. Test round-trips with real project files. |
| 7 | Math panel re-render lag | Medium | Use efficient reactive subscriptions. Simplify content if a specific panel proves slow in practice. |
| 8 | Texture project files exceed reasonable size | Medium | Warn the student when the project file exceeds a defined size threshold. |
| 9 | All stages built with no student feedback | High | Ship through Milestone M2 and put it in front of students before continuing. |
| 10 | Scope creep on refinements within stages | Medium | Treat stage acceptance criteria as the definition of done. New refinements become future work. |
| 11 | Code panel correct but not visually compelling | High | Budget explicit design review after Stage 2. Treat code panel aesthetics as a Stage 2 exit criterion. |
| 12 | Lesson content bottlenecks or gets deprioritized | High | Write the first two lessons per stage before marking the stage's engineering complete. Lessons surface engineering gaps. |
| 13 | Section labels don't match instructor vocabulary | Medium | Confirm each section label against the instructor's actual syllabus before Stage 1 ships. Change early if mismatched. |
| 14 | View state grows into an unrelated catch-all | Medium | Enforce ownership discipline. If a new piece of state doesn't clearly belong in any existing owner, introduce a new named owner rather than dumping into view state. |
| 15 | Exercises feel rigid; single hint is insufficient | Low | Do not add a multi-hint mechanism preemptively. Revisit only if Stage 2 lesson authoring reveals a concrete need. |

---

## Appendix E — Release Milestones

Incremental releases aligned with the FEU Tech course:

| Milestone | Contents | Suitable For |
|---|---|---|
| **M0** | Stage 0 (Foundation) | Internal only. Stabilize the application architecture before shipping curriculum to students. |
| **M1** | M0 + Stage 1 (Pipeline) | Course weeks covering graphics fundamentals and the rendering pipeline. |
| **M2** | M1 + Stage 2 (Primitives) | Course weeks covering drawing primitives, colors, callbacks. Major release; validate with students. |
| **M3** | M2 + Stage 3 (Buffers) | Course weeks covering memory management and VBOs. |
| **M4** | M3 + Stage 4 (Transforms) | Course weeks covering transforms and orthographic viewing. |
| **M5** | M4 + Stage 5 (Textures) | Final release. Full VAMS. |

**Gate:** do not advance past M2 without collecting feedback from at least 5 students and the instructor. M2 is the earliest milestone where students do meaningful work in VAMS; feedback at this point is maximally actionable.

---

## Appendix F — Checklists

### Before Starting Stage 0

- [ ] Read this plan end-to-end, including all appendices.
- [ ] Confirm Core Constraints with the project owner.
- [ ] Capture the current working baseline (what works, what doesn't, what needs to change) before making structural changes.
- [ ] Verify the current repository installs and runs cleanly before any changes.
- [ ] Confirm the section labels match the instructor's actual terminology.

### Per-Stage Exit Checklist

- [ ] All stage goals are met.
- [ ] All stage acceptance criteria are satisfied.
- [ ] Build passes with no errors or warnings.
- [ ] No deferred symbols appear in any generated code.
- [ ] No prohibited language ("coming soon", "3D", "lighting", "deferred") appears in any student-facing text.
- [ ] All demos play end-to-end without errors.
- [ ] All exercises have working success detection.
- [ ] Project save/load round-trip verified: save a project, reload, confirm identical render and generated code.

### Before Each Release

- [ ] Only sections intended for this milestone are visible to students.
- [ ] Every demo plays end-to-end without errors.
- [ ] Every exercise's success check fires correctly.
- [ ] Project save/load tested with a complex scene using all features of the release.
- [ ] Deferred symbol list verified against all generated code paths.
- [ ] All student-facing strings reviewed for prohibited language.

---

## End

This document is the source of truth for what VAMS is and what it does. Amend it before changing scope. When implementation reveals a gap in the plan, update the plan first, then implement.

If a section becomes stale, add a dated note rather than silently editing. History helps future contributors.

---

*Document version: 4.0 (codebase-agnostic)*
*Last updated: 2026-04-23*

### Changelog

