# Pipeline illustrations and texture controls Implementation Plan

**Goal:** Redraw the Pipeline illustrations on the student's own shape (Diagram, Raster vs vector, "Which Stage?") with the mode switch in the canvas header. Replace the texture samples and Quick Gradients. Gather every texture control into the shape's Texture group.

**Architecture:**
- The geometry is pure and testable, and lives in `entities/scene/model`: world corners, primitives, clipping, rasterising and shading. Both the canvas illustrations and the gradient previews use it.
- `widgets/canvas/model` chooses the subject shape, finds each stage's program line and writes each stage's sentence.
- The Preact views render SVG from those results.
- The texture work rewrites `features/textures` around one Texture group, and removes the Settings library.

**Tech Stack:** Preact (preact/compat), Zustand + Immer, SCSS tokens, Vitest + happy-dom, Playwright visual specs.

**Spec:** `docs/specs/2026-10-21-pipeline-illustrations-textures-design.md`

## Global Constraints

- **Look:** build on `src/shared/styles/_tokens.scss`, keeping both themes consistent; new tokens go there.
  - Type does the work: no pills, chips or cards beyond the approved mocks.
  - Icons are drawn. Numbers use tabular figures.
- **Wording:** student-facing text never contains "coming soon", "not supported", "future", "deferred", "3D" or "lighting", and uses British spelling.
- **Accuracy:** every program line an illustration shows is found in the generated code with `outlineCode` (`features/code-generation/model/code-outline.ts`). None is typed by hand.
- **Data flow:** illustrations only read state. Pixels across, the multisample switch and the UV zoom are view state, never persisted with the scene.
- **Scope:** 2D only. The generator's output does not change, except texture names in its comments.
- **Sizes:** works from 1280 down to 960 CSS px wide; rail panels keep their width.
- **Motion:** `prefers-reduced-motion` turns every animation off.
- **Architecture:** FSD layering (`app → pages → widgets → features → entities → shared`, plus `core`). New code imports only downward.
- **Tests:** new tests take the next free ID in their file. Existing IDs stay; when behaviour changes, the test body changes and the ID keeps its number.
- **Commits:** Conventional Commits; no `Co-Authored-By` trailer and no "Generated with" line.
  - Stage paths explicitly. Never stage `.gitignore`, `AGENTS.md` or `manuscript/`.
  - Before every commit, run `npm run lint`, `npm run build` and `npm test`, then `git checkout -- tests/reports`.
- **Committed text** (code, comments, docs, commit messages) never mentions the tools or workflow behind the change, or a local mock path.
- **Port:** the visual suite runs on port 4319; never use 5173.

## Review Focus

1. **A shape partly or wholly outside the viewing volume, or degenerate** (two corners, zero area, collinear). The illustrations still draw, the clip sentence says what happened, and nothing throws. Tests: BB-PFIG-04, BB-PFIG-08.
2. **An extreme or non-square viewing volume** (0.1 wide, or 10 wide by 1 high). The frame keeps its aspect, the grid has at least 1 row and no more than 4 × across, and the drawing fits its box. Test: BB-PFIG-07.
3. **A selection that can't be drawn:** a text node, a group, or a hidden shape. The subject falls through to the next candidate, and finally to the demo triangle. Test: BB-PFIG-11.
4. **Removing an upload that several shapes use, then undoing.** Every shape is detached, the picker shows None for them, and one undo restores the image and the attachments. Test: BB-TEX-13.
5. **A "Which Stage?" step followed by Back or Next to a step without a picture.** The canvas returns to the step's own mode and the switch reappears. Test: BB-PFIG-19.

---

## Step 1: the switch and the Diagram

### Task 1: Pipeline geometry

**Files:**
- Create: `src/entities/scene/model/pipeline-geometry.ts`
- Modify: `src/features/math-panel/model/vertex-journey.ts` (import `chainOf` from the new module; delete its private copy)
- Modify: `src/entities/scene/model/primitive-assembly.ts` (export `provokingOf`; `provokingVertex` calls it)
- Test: `tests/black-box/pipeline-figures.test.ts` (new file, suite `BB-PFIG`)

**Interfaces:**
- Produces:
  - `interface Pt { x: number; y: number }`
  - `chainOf(node: SceneNode, objects: readonly SceneNode[]): SceneNode[]`: moved unchanged from `vertex-journey.ts`; the object, then each enclosing group, innermost first
  - `worldPoint(p: Pt, chain: readonly SceneNode[]): Pt`: scale, then rotate (degrees), then move, for each node in the chain
  - `worldPrimitives(type: PrimitiveType, corners: readonly Pt[]): Pt[][]`: one polygon (or segment, or point) per primitive, using `primitivesOf`
  - `clipPolygon(poly: readonly Pt[], v: ViewportLimits): Pt[]` (Sutherland–Hodgman against the four volume edges)
  - `clipSegment(a: Pt, b: Pt, v: ViewportLimits): [Pt, Pt] | null`
  - `type ClipOutcome = 'inside' | 'partial' | 'outside'`
  - `clipOutcome(type: PrimitiveType, corners: readonly Pt[], v: ViewportLimits): ClipOutcome`
  - `figureFrame(v: ViewportLimits): ViewportLimits`: the volume grown by 20% of its width and height on each side
  - `provokingOf(type: PrimitiveType, members: readonly number[]): number`: GL_POLYGON takes its first member, GL_QUAD_STRIP its highest, every other type its last

- [ ] **Step 1: Write the failing tests**

```ts
describe('BB-PFIG-01: Corners go through the transform chain in OpenGL order', () => {
  it('scales, rotates, then moves', () => {
    const node = { ...quad, transform: { translateX: 0.2, translateY: 0, rotate: 90, scaleX: 2, scaleY: 1 } };
    expect(worldPoint({ x: 0.5, y: 0 }, [node])).toEqual({ x: expect.closeTo(0.2), y: expect.closeTo(1) });
  });
  it('applies an enclosing group after the shape', () => { /* child moved 0.1, group moved 0.3 → x + 0.4 */ });
});
describe('BB-PFIG-02: Primitives follow the GL type', () => {
  // TRIANGLES with 6 corners → 2 triangles; TRIANGLE_FAN with 5 → 3 sharing corner 0;
  // QUADS with 4 → 1 quad; LINE_LOOP with 3 → 3 segments; POINTS with 2 → 2 points
});
describe('BB-PFIG-03: Clipping cuts a polygon at the viewing volume', () => {
  it('cuts the corner past x = 1 and adds two corners on the edge', () => {
    const tri = [{ x: 0, y: 0 }, { x: 1.5, y: 0 }, { x: 0, y: 0.5 }];
    const out = clipPolygon(tri, { minX: -1, maxX: 1, minY: -1, maxY: 1 });
    expect(out).toHaveLength(4);
    expect(out.filter((p) => Math.abs(p.x - 1) < 1e-9)).toHaveLength(2);
  });
  it('keeps a polygon wholly inside unchanged', () => { /* same points back */ });
});
describe('BB-PFIG-04: Clip outcome for inside, partial, outside and degenerate shapes', () => {
  // inside → 'inside'; one corner past the edge → 'partial'; all corners at x > 2 → 'outside';
  // a triangle with two corners and a collinear triangle do not throw
});
describe('BB-PFIG-05: The frame is the viewing volume plus 20% each side', () => {
  expect(figureFrame({ minX: -1, maxX: 1, minY: -2, maxY: 2 })).toEqual({ minX: -1.4, maxX: 1.4, minY: -2.8, maxY: 2.8 });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run tests/black-box/pipeline-figures.test.ts`
Expected: FAIL. The module `@/entities/scene/model/pipeline-geometry` doesn't exist.

- [ ] **Step 3: Implement the module and move `chainOf`**

- `vertex-journey.ts` imports `chainOf` and keeps its own `transformRows` (which needs per-step rows).
- `primitive-assembly.ts` keeps `provokingVertex`'s signature and delegates to `provokingOf`.

- [ ] **Step 4: Run the new file and the journey tests**

Run: `npx vitest run tests/black-box/pipeline-figures.test.ts tests/black-box/math-journey.test.ts tests/white-box/vertex-journey.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/entities/scene/model/pipeline-geometry.ts src/entities/scene/model/primitive-assembly.ts src/features/math-panel/model/vertex-journey.ts tests/black-box/pipeline-figures.test.ts
git commit -m "feat(pipeline): add world-space primitives, clipping and framing for the illustrations"
```

### Task 2: Rasterising and shading

**Files:**
- Create: `src/entities/scene/model/rasterise.ts`
- Test: `tests/black-box/pipeline-figures.test.ts`

**Interfaces:**
- Consumes: `Pt`, `worldPrimitives` and `provokingOf` (Task 1)
- Produces:
  - `interface PixelGrid { volume: ViewportLimits; cols: number; rows: number }`
  - `pixelGrid(v: ViewportLimits, across: number): PixelGrid`
    - `cols = across`;
    - `rows = clamp(round(across × height / width), 1, 4 × across)`.
  - `const MULTISAMPLE_OFFSETS: readonly Pt[]`
    - in pixel units: `(-0.375, -0.125), (0.125, -0.375), (0.375, 0.125), (-0.125, 0.375)`.
  - `interface RasterInput { type: PrimitiveType; corners: readonly Pt[]; colours: readonly string[]; uvs: readonly UV[] | null; shading: ShadingModel }`
    - `corners` are in world space;
    - `colours` holds one hex colour per corner.
  - `interface Fragment { col: number; row: number; coverage: number; rgb: [number, number, number]; uv: UV | null }`
    - `row` 0 is the top row;
    - `coverage` is 0..1;
    - `uv` is set only when `uvs` is given.
  - `rasterise(input: RasterInput, grid: PixelGrid, multisample: boolean): Fragment[]`
    - **Fill types:** a sample is covered when it lies inside any primitive. Primitives are fan-triangulated from their first member, and edges count as inside.
    - **Line types:** a sample is covered within half a pixel of a segment.
    - **Points:** a point covers the one pixel that contains it.
    - **Without multisampling,** the pixel centre is the only sample.
    - **Colour:**
      - with smooth shading, barycentric over the covering triangle;
      - with flat shading, the `provokingOf` member's colour;
      - lines blend linearly along the segment.
    - **UV** is interpolated the same way.

- [ ] **Step 1: Write the failing tests**

```ts
describe('BB-PFIG-06: A covered pixel is one whose centre the shape covers', () => {
  // a square from (-0.5,-0.5) to (0.5,0.5) on a 4 × 4 grid over −1..1 covers exactly the 4 middle pixels, each coverage 1
});
describe('BB-PFIG-07: The grid follows the volume shape and stays bounded', () => {
  expect(pixelGrid({ minX: -1, maxX: 1, minY: -1, maxY: 1 }, 24)).toMatchObject({ cols: 24, rows: 24 });
  expect(pixelGrid({ minX: 0, maxX: 10, minY: 0, maxY: 1 }, 24).rows).toBe(2);
  expect(pixelGrid({ minX: 0, maxX: 0.1, minY: 0, maxY: 10 }, 24).rows).toBe(96);
  expect(pixelGrid({ minX: 0, maxX: 10, minY: 0, maxY: 0.01 }, 8).rows).toBe(1);
});
describe('BB-PFIG-08: Multisampling gives edge pixels partial coverage', () => {
  // a triangle's edge pixels: coverage in {0.25, 0.5, 0.75} with multisample, only 0 or 1 without;
  // a shape wholly outside the grid gives no fragments; a two-corner triangle gives none and does not throw
});
describe('BB-PFIG-09: Smooth shading blends corner colours; flat takes the provoking corner', () => {
  // RGB triangle: the fragment nearest the red corner has r > g and r > b;
  // FLAT TRIANGLES: every fragment has the last corner's colour; FLAT POLYGON: the first corner's
});
describe('BB-PFIG-10: Lines and points rasterise', () => {
  // a horizontal LINES segment across a 8 × 8 grid covers one row of 8 pixels; a POINTS corner covers one pixel
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run tests/black-box/pipeline-figures.test.ts -t "BB-PFIG-(06|07|08|09|10)"`
Expected: FAIL, because `rasterise` isn't defined.

- [ ] **Step 3: Implement `rasterise.ts`**

- [ ] **Step 4: Run the file**

Run: `npx vitest run tests/black-box/pipeline-figures.test.ts`
Expected: PASS (BB-PFIG-01..10).

- [ ] **Step 5: Commit**

```bash
git add src/entities/scene/model/rasterise.ts tests/black-box/pipeline-figures.test.ts
git commit -m "feat(pipeline): rasterise and shade shapes on a coarse pixel grid"
```

### Task 3: Subject, program lines and stage sentences

**Files:**
- Create: `src/widgets/canvas/model/pipeline-subject.ts`
- Create: `src/widgets/canvas/model/stage-lines.ts`
- Create: `src/widgets/canvas/model/stage-copy.ts`
- Test: `tests/black-box/pipeline-figures.test.ts`

**Interfaces:**
- Consumes: Tasks 1 and 2; `outlineCode` and `CodeOutline` (code-outline.ts); `generateCodeFromState`; `sanitizeName`
- Produces:
  - `interface Subject`, with these fields:
    - `node: SceneNode | null` (null for the demo);
    - `owner: string | null`, the shape's code name;
    - `type: PrimitiveType`;
    - `stored: Pt[]`;
    - `world: Pt[]`;
    - `colours: string[]`;
    - `uvs: UV[] | null`;
    - `texture: TextureAttachment | null`;
    - `shading: ShadingModel`;
    - `volume: ViewportLimits`;
    - `background: string`;
    - `isDemo: boolean`.
  - `DEMO_TRIANGLE: SceneNode`
    - corners (−0.5,−0.5), (0.5,−0.5), (0,0.5);
    - colours `#ff0000`, `#00ff00`, `#0000ff`;
    - transform translate (0.2, 0), rotate 20, scale 1.5 × 1.5;
    - name "Triangle", type TRIANGLES, smooth shading.
  - `demoSubject(): Subject`: the demo against volume −1..1 and background `#000000`.
  - `pipelineSubject(s: Pick<VamsState, 'objects' | 'selectedObjectId' | 'viewportLimits' | 'canvasBackgroundColor'>): Subject`
    - the selected node if drawable;
    - else the first drawable in `objects` order;
    - else `demoSubject()`.
    - "Drawable" means not TEXT, not GROUP, at least one vertex, and effectively visible (it and every ancestor `visible`).
  - `type StageIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6`
  - `interface StageLine { line: number; text: string; request: ExplainRequest }`
  - `stageProgramLine(stage: StageIndex, outline: CodeOutline, subject: Subject): StageLine | null`
    - **Candidate calls,** first match wins:

      | Stage | Candidate calls |
      | --- | --- |
      | 0 | `glVertex2f` (IMMEDIATE), `glVertexPointer` (VERTEX_ARRAY), `glBufferData` (VBO) |
      | 1 | `glTranslatef` |
      | 2 | `glBegin` (IMMEDIATE), `glDrawElements` if `useIndexed`, else `glDrawArrays` |
      | 3 | `glOrtho` |
      | 4 | `glutInitWindowSize` |
      | 5 | `glBindTexture` if textured, else `glColor3f`, then `glColor3ub` |
      | 6 | `glutSwapBuffers` |

    - **Where it looks:**
      - Stages 0, 1, 2 and 5 match only lines whose `object === subject.owner`. They return null for the demo and when nothing matches.
      - Stages 3, 4 and 6 search the whole program.
    - **What it returns:** `text` is the line trimmed. `request` is `{ call, owner }` for owned lines and `{ call }` otherwise.
  - `STAGES: readonly { short: string; title: string; math: JourneyStageId }[]`
    - short names: Specify, Transform, Assemble, Clip, Raster, Shade, Output;
    - titles: Vertex specification, Vertex processing, Primitive assembly, Clipping, Rasterisation, Fragment processing, Per-sample operations;
    - math stages: stored, transformed, assembled, projected, rasterised, coloured, coloured.
  - `stageSentence(stage: StageIndex, subject: Subject, window: { width: number; height: number }): string`
    - Exact copy; `{…}` is formatted with `short()` from `shared/lib/format-number`:

      | Stage | Copy |
      | --- | --- |
      | 0 | `Your program lists {n} corners, each with a colour. Nothing is drawn yet: these are just numbers.` |
      | 1, identity transform | `Each corner is multiplied by the modelview matrix. Yours is the identity, so the corners stay where they are.` |
      | 1, otherwise | `Each corner is multiplied by the modelview matrix: scaled {sx} × {sy}, turned {r}° and moved ({tx}, {ty}).` (the shape's own transform) |
      | 2 | the `ASSEMBLY` sentence for the type (below) |
      | 3, inside | `glOrtho sets the visible box. Your shape is inside it, so nothing is cut off.` |
      | 3, partial | `glOrtho sets the visible box. The parts outside it are cut off, and new corners appear where the edges cross it.` |
      | 3, outside | `glOrtho sets the visible box. Your shape is entirely outside it, so nothing reaches the screen.` |
      | 4 | `The shape becomes squares: one fragment for every pixel whose centre it covers. Shown 24 across; your {w} × {h} window has many more.` |
      | 5, textured | `Each fragment reads its colour from the texture, at the UV the corners carry.` |
      | 5, flat | `With flat shading, every fragment of a primitive takes one corner's colour.` |
      | 5, otherwise | `Each fragment gets a colour, blended from the corner colours by how close it is to each.` |
      | 6 | `The fragments are written over the cleared background, then glutSwapBuffers shows the finished frame.` |

  - `ASSEMBLY: Record<PrimitiveType, string>`:
    - POINTS `GL_POINTS keeps each corner as its own point.`
    - LINES `GL_LINES joins each pair of corners into a line.`
    - LINE_STRIP `GL_LINE_STRIP joins each corner to the next.`
    - LINE_LOOP `GL_LINE_LOOP joins each corner to the next, and the last back to the first.`
    - TRIANGLES `GL_TRIANGLES joins every three corners into a triangle.`
    - TRIANGLE_STRIP `GL_TRIANGLE_STRIP makes a triangle from each corner and the two before it.`
    - TRIANGLE_FAN `GL_TRIANGLE_FAN makes triangles that all share the first corner.`
    - QUADS `GL_QUADS joins every four corners into a quad.`
    - QUAD_STRIP `GL_QUAD_STRIP makes a quad from each new pair of corners and the pair before.`
    - POLYGON `GL_POLYGON joins all the corners into one polygon.`
  - `INTRO = { title: 'From vertex to pixel', text: 'Seven stages turn your shape into pixels. Pick one to see what it does.' }`

- [ ] **Step 1: Write the failing tests**

```ts
describe('BB-PFIG-11: The subject is the selection, else the first drawable, else the demo', () => {
  // selected quad → quad; selected TEXT with a quad in the scene → quad; selected GROUP → its first drawable child or next drawable;
  // a hidden shape and a shape inside a hidden group are skipped; empty scene → isDemo true with volume −1..1
});
describe('BB-PFIG-12: The demo triangle crosses the right edge', () => {
  expect(clipOutcome('TRIANGLES', demoSubject().world, demoSubject().volume)).toBe('partial');
});
describe('BB-PFIG-13: Each stage finds its own line in the generated program', () => {
  // build a state with one IMMEDIATE triangle named "Tri"; generate; outline; then
  // stage 0 text starts with 'glVertex2f(', stage 1 'glTranslatef(state_Tri', stage 2 'glBegin(GL_TRIANGLES)',
  // stage 3 'glOrtho(', stage 4 'glutInitWindowSize(', stage 5 'glColor3f(', stage 6 'glutSwapBuffers()'
});
describe('BB-PFIG-14: Owned stages never borrow another shape\'s line', () => {
  // two shapes; subject is the VBO one → stage 0 text starts 'glBufferData(' and its line's object is the VBO shape;
  // demo subject → stages 0, 1, 2, 5 return null and 3, 4, 6 do not
});
describe('BB-PFIG-15: Stage sentences use the shape\'s own numbers', () => {
  // identity transform → the identity sentence; translate 0.2 rotate 20 scale 1.5 →
  // 'scaled 1.5 × 1.5, turned 20° and moved (0.2, 0).'; textured → texture sentence; FLAT → flat sentence
});
describe('BB-PFIG-16: No illustration text names a call VAMS never emits', () => {
  const banned = ['glVertex3f', 'glCullFace', 'glFrontFace', 'glFogf', 'glBlendFunc', 'glDepthFunc', 'glStencilFunc', 'glFlush', 'glPolygonMode'];
  // every STAGES title, ASSEMBLY sentence, INTRO and every stageSentence for the demo contains none of these,
  // and none of the student-facing banned words
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run tests/black-box/pipeline-figures.test.ts -t "BB-PFIG-1[1-6]"`
Expected: FAIL, because the modules are missing.

- [ ] **Step 3: Implement the three modules**

- [ ] **Step 4: Run the file**

Run: `npx vitest run tests/black-box/pipeline-figures.test.ts`
Expected: PASS (BB-PFIG-01..16).

- [ ] **Step 5: Commit**

```bash
git add src/widgets/canvas/model/pipeline-subject.ts src/widgets/canvas/model/stage-lines.ts src/widgets/canvas/model/stage-copy.ts tests/black-box/pipeline-figures.test.ts
git commit -m "feat(pipeline): choose the illustrated shape and find each stage's program line"
```

### Task 4: The switch in the canvas header, in both modes

**Files:**
- Modify: `src/core/store/illustration.ts`
- Modify: `src/core/store/types.ts`
- Modify: `src/core/store/lesson-slice.ts`
- Modify: `src/core/types/lesson.ts`
- Modify: `src/features/lesson-engine/model/useLessonRunner.ts` (in `showStep`)
- Modify: `src/features/lesson-engine/ui/LessonBar.tsx` and `lesson-bar.scss` (remove `lesson-bar__modes`)
- Create: `src/widgets/canvas/ui/PipelineModeSwitch.tsx`
- Modify: `src/widgets/canvas/ui/CanvasHeader.tsx` and `canvas-pane.scss`
- Modify: `src/core/inspector/focus-map.ts` and `journey-stage.ts` (rename area `lesson-card` to `canvas-header`)
- Test: `tests/black-box/pipeline-figures.test.ts`; update BB-LCOL-21 (`lesson-column.test.ts`), BB-PANEL-14 (`editor-panels.test.ts`), BB-RUN-14 (`run-mode.test.ts`) and the `pipeline-mode-controls` expectation in `editor-inspector.test.ts`

**Interfaces:**
- Consumes: `StageIndex` (Task 3)
- Produces:
  - `VISUAL_ARTIFACTS` in `core/types/lesson.ts`: the seven `visualArtifact` values in stage order. The index is the `StageIndex`. Export `type VisualArtifact`.
  - In the store (lesson slice):
    - `quizPipelineStage: StageIndex | null`;
    - `setQuizPipelineStage(stage: StageIndex | null): void`.
  - `clearLessonState` resets `quizPipelineStage` to null.
  - `showStep` sets it from `step.exercise?.kind === 'multiple-choice' && step.exercise.visualArtifact`, else null.
  - `showsIllustration(s: Pick<VamsState, 'activeSection' | 'pipelineMode' | 'quizPipelineStage'>): boolean` is true when `activeSection === 'Pipeline'` and either `quizPipelineStage !== null` or `pipelineMode !== 'Playground'`. It no longer reads `appMode`.
  - `<PipelineModeSwitch />`:
    - the shared `SegmentedControl`, labelled "Viewport mode", with options Diagram · Raster vs vector · Playground;
    - wrapped in `data-panel-id="pipeline-mode-controls"`, with `is-lesson-focus` when `lessonFocusPanel` names it.
  - `CanvasHeader` renders the switch before `ViewMenu`, only while `activeSection === 'Pipeline'` and `quizPipelineStage === null`.
  - `FocusPlace` area `'canvas-header'` replaces `'lesson-card'`. `railPanelFor` returns null and `stageForPlace` returns `'rasterised'` for it, as before.

- [ ] **Step 1: Update the existing tests to the new behaviour, and add the new ones**

```ts
// BB-LCOL-21 (title becomes "The Pipeline illustrations appear in the Pipeline section, in both modes")
expect(showsIllustration({ activeSection: 'Pipeline', pipelineMode: 'Diagram', quizPipelineStage: null })).toBe(true);
expect(showsIllustration({ activeSection: 'Transforms', pipelineMode: 'Diagram', quizPipelineStage: null })).toBe(false);
expect(showsIllustration({ activeSection: 'Pipeline', pipelineMode: 'Playground', quizPipelineStage: 3 })).toBe(true);
// BB-PANEL-14 mounts CanvasHeader with activeSection 'Pipeline' and drives `.canvas-header [role="radiogroup"]`
// BB-RUN-14 gains: canRun is false in Author mode with pipelineMode 'Diagram' in Pipeline
// editor-inspector: resolveFocus('pipeline-mode-controls', false) → { area: 'canvas-header' }

describe('BB-PFIG-17: The switch shows in the canvas header only in the Pipeline section', () => {
  // Author + Pipeline → present; Lesson + Pipeline → present; Author + Primitives → absent; the lesson bar has no `.lesson-bar__modes`
});
describe('BB-PFIG-18: A quiz step hides the switch and shows its stage', () => {
  // setQuizPipelineStage(3) → switch absent, showsIllustration true even with pipelineMode 'Playground'
});
describe('BB-PFIG-19: The runner sets the quiz stage per step and clears it', () => {
  // open pipeline-exercise-2, go to step 2 → quizPipelineStage 0 (vertex-specification);
  // back to step 1 → null and the switch is present; clearLessonState → null
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run tests/black-box/pipeline-figures.test.ts tests/black-box/lesson-column.test.ts tests/black-box/editor-panels.test.ts tests/black-box/run-mode.test.ts tests/black-box/editor-inspector.test.ts`
Expected: FAIL in BB-LCOL-21, BB-PANEL-14, BB-RUN-14, the focus expectation and BB-PFIG-17..19.

- [ ] **Step 3: Implement the store field, the gate, the runner hook, the switch and the area rename**

- [ ] **Step 4: Run the same command**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/store/illustration.ts src/core/store/types.ts src/core/store/lesson-slice.ts src/core/types/lesson.ts src/features/lesson-engine/model/useLessonRunner.ts src/features/lesson-engine/ui/LessonBar.tsx src/features/lesson-engine/ui/lesson-bar.scss src/widgets/canvas/ui/PipelineModeSwitch.tsx src/widgets/canvas/ui/CanvasHeader.tsx src/widgets/canvas/canvas-pane.scss src/core/inspector/focus-map.ts src/core/inspector/journey-stage.ts tests/black-box/pipeline-figures.test.ts tests/black-box/lesson-column.test.ts tests/black-box/editor-panels.test.ts tests/black-box/run-mode.test.ts tests/black-box/editor-inspector.test.ts
git commit -m "feat(pipeline): move the illustration switch to the canvas header for both modes"
```

### Task 5: The Diagram, strip and focus

**Files:**
- Create: `src/widgets/canvas/views/StageFigure.tsx`
- Rewrite: `src/widgets/canvas/views/PipelineDiagram.tsx` and `pedagogical-views.scss`
- Modify: `src/widgets/canvas/CanvasPane.tsx` (the quiz stage renders `<StageFigure>` alone; Task 8 finishes it)
- Test: `tests/black-box/pipeline-figures.test.ts`; `tests/visual/pipeline-textures.spec.ts` (new, suite `VIS-PT`)

**Interfaces:**
- Consumes: Tasks 1–4; `requestExplain`, `setJourneyStageOverride`, `setCodePane`, `selectObject`, `setActivePipelineStage`
- Produces:
  - `<StageFigure stage={StageIndex} subject={Subject} size={number} animate={boolean} />`, an SVG drawing of one stage, framed by `figureFrame(subject.volume)`, as the spec's stage table describes:
    - dashed volume for stages 0–2, solid volume for stage 3;
    - the 24-across grid for stages 4–6;
    - the background colour under stage 6.
  - Textured fragments are drawn from the texture image, sampled through an offscreen canvas. Without a 2D context (tests), they fall back to `--ink-muted`.
  - The animation runs once, about 0.5 s, between the previous and the current stage. It is off under reduced motion.
  - **PipelineDiagram:**
    - **The strip:** seven `<button>`s, each with a 62 px `StageFigure`, the number and the short name.
      - `aria-pressed` marks the chosen one.
      - Left and right arrows move between stages; from null, the right arrow picks stage 0.
      - Clicking the chosen stage keeps it.
    - **The focus:** a 270 px `StageFigure`, then "Stage N of 7", the title, `stageSentence(…)`, "In your program" with the line, and "See it in Math: ‹title› ›".
      - The line and its label are omitted when `stageProgramLine` returns null.
      - With `activePipelineStage === null`, the focus shows stage 6's drawing under `INTRO` and no line.
    - **The line** is a button that calls `requestExplain(line.request)`.
    - **The Math link** first selects the subject's node if it isn't selected and isn't the demo, then calls `setJourneyStageOverride(STAGES[i].math)` and `setCodePane('math')`.

- [ ] **Step 1: Write the failing tests**

```ts
describe('BB-PFIG-20: The strip has seven stages and the arrows move between them', () => {
  // mount PipelineDiagram with activeSection Pipeline; 7 buttons; ArrowRight from null → stage 0; ArrowRight → 1; clicking 1 again keeps 1
});
describe('BB-PFIG-21: With no stage chosen the focus shows the introduction', () => {
  // text contains 'From vertex to pixel' and 'Pick one to see what it does'; no "In your program"
});
describe('BB-PFIG-22: The program line and the Math link act on the subject', () => {
  // one triangle named Tri, unselected, stage 1: clicking the line → explainRequest { call: 'glTranslatef', owner: 'Tri' };
  // clicking the Math link → selectedObjectId is Tri's id, journeyStageOverride 'transformed', codePane 'math'
});
describe('BB-PFIG-23: The Diagram renders without key GL call lists', () => {
  // no element text contains 'Key GL calls', 'IN', 'OUT' tags, or any BB-PFIG-16 banned name
});
```

Visual, in `tests/visual/pipeline-textures.spec.ts`:
- `VIS-PT-01` (dark) and `VIS-PT-02` (light) open `pipeline-demo-1` at step 6 (Rasterisation chosen) at 1280 × 800, using `openLesson` from `tests/visual/helpers/open-lesson.ts`;
- they wait for the animation to finish, or emulate reduced motion;
- they screenshot the canvas pane.

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run tests/black-box/pipeline-figures.test.ts -t "BB-PFIG-2[0-3]"`
Expected: FAIL.

- [ ] **Step 3: Implement StageFigure and the new Diagram**

Delete the old `PIPELINE_STAGES` data and its lucide icon set from `PipelineDiagram.tsx`.

- [ ] **Step 4: Run the whole suite and create the visual baselines**

Run: `npm test`
Expected: all PASS.

Run: `npx playwright test tests/visual/pipeline-textures.spec.ts --update-snapshots`
Expected: two baselines written in `tests/visual/baseline.local`, which is git-ignored.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/canvas/views/StageFigure.tsx src/widgets/canvas/views/PipelineDiagram.tsx src/widgets/canvas/views/pedagogical-views.scss src/widgets/canvas/CanvasPane.tsx tests/black-box/pipeline-figures.test.ts tests/visual/pipeline-textures.spec.ts
git commit -m "feat(pipeline): redraw the Diagram as a strip of stages over the student's shape"
```

### Task 6: Checkpoint 1

- [ ] **Step 1: Screenshots.** Using a dev server on port 4320, take 1280 px screenshots in both themes:
  - the Diagram with no stage, with stage 2 (Assemble) and with stage 5 (Raster), on the Textured quad scene and on an empty scene;
  - the canvas header in Author mode in the Pipeline section.

  Put them beside the approved `pipeline-directions.html` (option A) on one local comparison page, and open it for the owner.
- [ ] **Step 2: Owner sign-off.** The owner signs off or names changes; changes are made and re-shown before the next delivery step begins.

---

## Step 2: Raster vs vector, and "Which Stage?"

### Task 7: Raster vs vector, side by side

**Files:**
- Rewrite: `src/widgets/canvas/views/RasterVectorView.tsx` (styles in `pedagogical-views.scss`)
- Test: `tests/black-box/pipeline-figures.test.ts`; `tests/visual/pipeline-textures.spec.ts`

**Interfaces:**
- Consumes: `pipelineSubject`, `figureFrame`, `pixelGrid`, `rasterise`, `MULTISAMPLE_OFFSETS`
- Produces: the view.
  - **Left:** "Vector", tag "the code", and the copy `Corners and straight edges. Zoom in as far as you like: the edge stays exact.` Below it, the world outline with each corner's coordinates as `(x, y)` from `fmt()`.
  - **Right:** "Raster", tag "the screen".
    - The copy is `The same shape as {cols} × {rows} pixels.`, followed by one of:
      - multisampling on: ` Multisampling tests 4 points per pixel, so edge pixels are partly filled.`
      - multisampling off: ` Each pixel is either in or out, so the edges step.`
    - The coverage shows as fill opacity.
  - **Controls:**
    - "Pixels across" is a SegmentedControl of 8 · 16 · 24 · 48, default 24.
    - A switch labelled `GLUT_MULTISAMPLE`, default on, with the title `Your program turns this on in glutInitDisplayMode`.
    - Both live in component state only.

- [ ] **Step 1: Write the failing tests**

```ts
describe('BB-PFIG-24: Raster vs vector draws the subject on both sides', () => {
  // demo subject: the left lists three '(x, y)' labels matching demoSubject().world via fmt; the right reads 'The same shape as 24 × 24 pixels.'
});
describe('BB-PFIG-25: Pixels across and multisampling redraw only the raster side', () => {
  // choose 8 → text '8 × 8'; switch off → sentence ends 'so the edges step.' and every fragment rect has opacity 1;
  // the store's objects are unchanged (deep equal before and after)
});
describe('BB-PFIG-26: The view settings are not saved with the scene', () => {
  // after changing both controls, the persisted partialize output has no key for them
});
```

Visual: `VIS-PT-03` (dark) and `VIS-PT-04` (light), `pipeline-demo-2` step 1, canvas pane.

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run tests/black-box/pipeline-figures.test.ts -t "BB-PFIG-2[4-6]"`
Expected: FAIL.

- [ ] **Step 3: Implement the view**

- [ ] **Step 4: Run the tests, then the visual baselines**

Run: `npm test`, then `npx playwright test tests/visual/pipeline-textures.spec.ts --update-snapshots`
Expected: PASS; VIS-PT-03 and VIS-PT-04 written.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/canvas/views/RasterVectorView.tsx src/widgets/canvas/views/pedagogical-views.scss tests/black-box/pipeline-figures.test.ts tests/visual/pipeline-textures.spec.ts
git commit -m "feat(pipeline): show vector and raster side by side with pixel size and multisampling"
```

### Task 8: "Which Stage?" on the canvas

**Files:**
- Create: `src/widgets/canvas/views/QuizFigure.tsx`
- Modify: `src/widgets/canvas/CanvasPane.tsx`
- Modify: `src/features/lesson-engine/ui/exercise-widgets/MultipleChoiceWidget.tsx` (remove `VisualArtifactRenderer` and the `visualArtifact` prop)
- Modify: `src/features/lesson-engine/ui/LessonBar.tsx` (stop passing the prop)
- Delete: `src/widgets/canvas/views/pipeline-stage-visuals.tsx`, and any styles used only by it or by the old artifact box
- Test: `tests/black-box/pipeline-figures.test.ts`; `tests/visual/pipeline-textures.spec.ts`

**Interfaces:**
- Consumes: `quizPipelineStage` (Task 4), `StageFigure` (Task 5), `demoSubject()`
- Produces: `<QuizFigure stage={StageIndex} />`, a `StageFigure` of `demoSubject()` sized to fill the canvas stage, with no title, sentence or line, and `animate={false}`. `CanvasPane` renders it whenever `quizPipelineStage !== null` in the Pipeline section, ahead of `pipelineMode`.

- [ ] **Step 1: Write the failing tests**

```ts
describe('BB-PFIG-27: A quiz step shows its stage drawing on the canvas without its name', () => {
  // set quizPipelineStage 3 and pipelineMode 'Diagram' → CanvasPane shows one svg figure, no strip,
  // and no text matching any STAGES title or short name
});
describe('BB-PFIG-28: The lesson bar no longer draws a picture for the question', () => {
  // mount LessonBar on pipeline-exercise-2 step 2: no '.visual-artifact' (or the old box's class), the prompt and 4 options are present
});
```

Visual: `VIS-PT-05` (dark) and `VIS-PT-06` (light), `pipeline-exercise-2` step 6 (rasterization), the full editor.

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run tests/black-box/pipeline-figures.test.ts -t "BB-PFIG-2[78]"`
Expected: FAIL.

- [ ] **Step 3: Implement QuizFigure and remove the old artifact box**

- [ ] **Step 4: Run the tests, then the visual baselines**

Run: `npm test`, then `npx playwright test tests/visual/pipeline-textures.spec.ts --update-snapshots`
Expected: PASS, including the lesson rule tests (BB-LRULE); VIS-PT-05 and VIS-PT-06 written.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/canvas/views/QuizFigure.tsx src/widgets/canvas/CanvasPane.tsx src/features/lesson-engine/ui/exercise-widgets/MultipleChoiceWidget.tsx src/features/lesson-engine/ui/LessonBar.tsx tests/black-box/pipeline-figures.test.ts tests/visual/pipeline-textures.spec.ts
git rm src/widgets/canvas/views/pipeline-stage-visuals.tsx
git commit -m "feat(pipeline): show the Which Stage pictures large on the canvas"
```

### Task 9: Checkpoint 2

- [ ] **Step 1: Screenshots.** In both themes at 1280 px:
  - Raster vs vector at 24 with multisampling on, and at 8 with it off;
  - three "Which Stage?" steps (Assemble, Clip, Shade).

  Put them beside the approved `raster-vector.html` (option A) and open the page for the owner.
- [ ] **Step 2: Owner sign-off.** The owner signs off or names changes; changes are made and re-shown before moving on.

---

## Step 3: samples and Quick Gradients

### Task 10: The teaching set of samples

**Files:**
- Rewrite: `src/features/textures/lib/sample-textures.ts`
- Modify: `tests/setup.ts` (build the sample mock from `SAMPLE_TEXTURE_SPECS`)
- Modify: `src/features/lesson-engine/model/textures-lessons.ts`:
  - "'Tiling Bricks'" becomes "the 'Brick wall' sample";
  - "Green Crate (the bottom-right item)" becomes "green star (the bottom-right item)";
  - the gold coin stays top-right.
- Test: `tests/black-box/texture-controls.test.ts` (new file, suite `BB-TEX`)

**Interfaces:**
- Produces:
  - `SAMPLE_TEXTURE_SPECS: readonly { id: string; name: string; width: number; height: number }[]`, in this order:
    1. `sample-uv-grid` UV grid 256×256
    2. `sample-atlas` Sprite sheet 256×256
    3. `sample-pixel` Pixel fox 64×64
    4. `sample-bricks` Brick wall 256×256
    5. `sample-edges` Coloured edges 256×256
  - `ATLAS_ICONS = ['heart', 'coin', 'gem', 'star'] as const`: the order is top-left, top-right, bottom-left, bottom-right.
  - `FOX_SPRITE: readonly string[]`: 16 rows of 16 characters, drawn at 4 × 4 px per character.
  - `FOX_PALETTE: Record<string, string>`, with these characters:
    - `k` `#221e3a`
    - `o` `#f58b3d`
    - `w` `#ffffff`
    - `p` `#ec668c`
    - `c` `#ffd6aa`
    - `.` `#78c8eb`
  - `getSampleTextures(): TextureAsset[]`: as today, cached, one asset per spec with `isSample: true`.
- **Drawing,** to match the approved `texture-samples.html` set A:
  - **UV grid:** an 8 × 8 checker tinted from (u, v). The F is built from rectangles, not text. The corner labels use `bold 17px monospace` on dark plates.
  - **Sprite sheet:** a light 2 × 2 sheet: red heart, gold coin, blue gem, green star.
  - **Pixel fox:** `FOX_SPRITE`.
  - **Brick wall:** 8 rows with half-brick offsets and mortar. It must tile with no seam (the left column matches the right, the top row the bottom).
  - **Coloured edges:** a light field with an 18 px band on each edge: red left, blue right, green top, amber bottom.

- [ ] **Step 1: Write the failing tests**

```ts
describe('BB-TEX-01: The samples are the teaching set, in order', () => {
  expect(SAMPLE_TEXTURE_SPECS.map((s) => [s.id, s.name, s.width, s.height])).toEqual([
    ['sample-uv-grid', 'UV grid', 256, 256], ['sample-atlas', 'Sprite sheet', 256, 256],
    ['sample-pixel', 'Pixel fox', 64, 64], ['sample-bricks', 'Brick wall', 256, 256], ['sample-edges', 'Coloured edges', 256, 256],
  ]);
});
describe('BB-TEX-02: Old sample ids still resolve', () => {
  // getTextureById('sample-atlas' | 'sample-pixel' | 'sample-bricks') each returns an asset; the Textured quad preset opens with Brick wall
});
describe('BB-TEX-03: The fox sprite is a well-formed 16 × 16 grid', () => {
  // 16 rows, each 16 chars, every char a FOX_PALETTE key
});
describe('BB-TEX-04: The sprite sheet keeps its corners', () => {
  expect(ATLAS_ICONS).toEqual(['heart', 'coin', 'gem', 'star']);
  // textures-lessons text mentions 'green star' and not 'Crate'; mentions 'Brick wall' and not 'Tiling Bricks'
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run tests/black-box/texture-controls.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the samples, the setup mock and the lesson wording**

- [ ] **Step 4: Run all the tests**

Run: `npm test`
Expected: PASS, including BB-LRULE and the share and preset tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/textures/lib/sample-textures.ts tests/setup.ts src/features/lesson-engine/model/textures-lessons.ts tests/black-box/texture-controls.test.ts
git commit -m "feat(textures): replace the samples with a set that each teach one idea"
```

### Task 11: Quick Gradients as painted previews

**Files:**
- Create: `src/features/object-appearance/lib/gradient.ts`
- Create: `src/features/object-appearance/ui/GradientPreview.tsx`
- Modify: `src/features/object-appearance/ui/ObjectAppearancePanel.tsx`, and its styles
- Test: `tests/black-box/texture-controls.test.ts`; `tests/visual/pipeline-textures.spec.ts`

**Interfaces:**
- Consumes: `pixelGrid`, `rasterise` (Task 2)
- Produces:
  - `GRADIENT_PRESETS: readonly { label: string; colors: readonly string[] }[]`:
    - RGB corners `#ff0000 #00ff00 #0000ff`
    - Black to white `#000000 #ffffff`
    - Sunset `#ff5e3a #ffd166 #c9184a`
    - Ocean `#03045e #0077b6 #90e0ef`
    - Neon `#f72585 #7209b7 #4cc9f0`
  - `gradientColours(vertices: readonly Vertex[], colors: readonly string[]): string[]`. This is today's rule, moved out of the panel unchanged: the position along the wider axis of the bounding box, or the vertex order when the box is flat, run through the existing `getGradientColor` interpolation.
  - `<GradientPreview vertices type colors />` draws the shape's own vertices, framed to their bounding box, rasterised 28 across with `gradientColours`, as SVG rects, with the preset's label underneath.
  - In Per vertex mode, the panel shows the five previews as buttons. Clicking one applies `gradientColours` in one undo step, as today.

- [ ] **Step 1: Write the failing tests**

```ts
describe('BB-TEX-05: Gradient colours follow today\'s rule', () => {
  // triangle (-0.5,-0.5),(0.5,-0.5),(0,0.5) with RGB corners → red, blue, green (x positions 0, 1, 0.5), in getGradientColor's hex format;
  // a vertical line (same x) uses y; a 6-vertex polygon gets 6 colours
});
describe('BB-TEX-06: The five presets show as previews and apply in one step', () => {
  // mount the panel with a selected triangle in Per vertex mode: 5 buttons labelled
  // RGB corners, Black to white, Sunset, Ocean, Neon; click Sunset → vertex colours equal gradientColours; one undo restores
});
describe('BB-TEX-07: A preview paints the selected shape\'s own outline', () => {
  // a quad's preview has rects; a 2-vertex degenerate shape renders without throwing
});
```

Visual: `VIS-PT-07` (light): the Appearance group with a triangle in Per vertex mode.

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run tests/black-box/texture-controls.test.ts -t "BB-TEX-0[5-7]"`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests, then the visual baselines**

Run: `npm test`, then `npx playwright test tests/visual/pipeline-textures.spec.ts --update-snapshots`
Expected: PASS; VIS-PT-07 written.

- [ ] **Step 5: Commit**

```bash
git add src/features/object-appearance/lib/gradient.ts src/features/object-appearance/ui/GradientPreview.tsx src/features/object-appearance/ui/ObjectAppearancePanel.tsx src/features/object-appearance/ui tests/black-box/texture-controls.test.ts tests/visual/pipeline-textures.spec.ts
git commit -m "feat(appearance): show Quick Gradients as previews of the selected shape"
```

### Task 12: Checkpoint 3

- [ ] **Step 1: Screenshots.** In both themes at 1280 px:
  - the five samples, each on a quad in the editor;
  - the Quick Gradients on a triangle and on a quad.

  Put them beside the approved `texture-samples.html` (sets A and C) and open the page for the owner.
- [ ] **Step 2: Owner sign-off.** The owner signs off or names changes; changes are made and re-shown before moving on.

---

## Step 4: the Texture group

### Task 13: UV presets as single undo steps

**Files:**
- Modify: `src/entities/scene/model/scene-slice.ts` (export `defaultUVsFor`; add `setUVs`)
- Modify: `src/core/store/types.ts`
- Create: `src/features/textures/lib/uv-presets.ts`
- Test: `tests/black-box/texture-controls.test.ts`

**Interfaces:**
- Produces:
  - `setUVs(objectId: string, uvs: UV[]): void`: one `pushToHistory()`, then replace the UVs. It ignores a length mismatch with the vertices.
  - `defaultUVsFor(vertices): UV[]` (exported).
  - `type UVPreset = 'fit' | 'tile' | 'flip-u' | 'flip-v'`
  - `presetUVs(preset: UVPreset, vertices: readonly Vertex[], current: readonly UV[] | null): UV[]`
    - **fit** gives `defaultUVsFor`;
    - **tile** gives the default UVs times 2;
    - **flip-u** maps `u → 1 − u` on the current UVs (or the defaults);
    - **flip-v** does the same for `v`.

- [ ] **Step 1: Write the failing tests**

```ts
describe('BB-TEX-08: UV presets on a quad', () => {
  // quad (-0.5,-0.5)…(0.5,0.5): fit → (0,0),(1,0),(1,1),(0,1); tile → ×2; flip-u of fit → (1,0),(0,0),(0,1),(1,1); flip-v likewise
});
describe('BB-TEX-09: Each preset is one undo step', () => {
  // setUVs(tile) then undo → previous UVs; setUVs(flip-u) twice then undo once → the first flip
});
describe('BB-TEX-10: A preset on a shape without UVs starts from the defaults', () => {
  // uvs null → flip-v gives defaults with v flipped
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run tests/black-box/texture-controls.test.ts -t "BB-TEX-(08|09|10)"`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the file**

Run: `npx vitest run tests/black-box/texture-controls.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/entities/scene/model/scene-slice.ts src/core/store/types.ts src/features/textures/lib/uv-presets.ts tests/black-box/texture-controls.test.ts
git commit -m "feat(textures): add Fit, Tile, Flip U and Flip V UV presets"
```

### Task 14: One Texture group; Settings loses the library

**Files:**
- Create: `src/features/textures/lib/read-image-file.ts` (moved from `TextureLibraryPanel.tsx`; 4 MB limit and messages unchanged)
- Create: `src/features/textures/ui/TexturePicker.tsx`
- Create: `src/features/textures/ui/TextureParams.tsx`
- Rewrite: `src/features/textures/ui/UVEditorPanel.tsx`
- Delete: `src/features/textures/ui/TextureAttachmentPanel.tsx` and `TextureLibraryPanel.tsx`. Move `TEXTUREABLE_TYPES` to `src/features/textures/lib/textureable.ts`.
- Modify:
  - `src/features/textures/ui/textures-panels.scss`
  - `src/widgets/layout/editor-column/inspector-groups.tsx`
  - `src/widgets/layout/editor-column/SettingsPanel.tsx`
  - `src/core/inspector/groups.ts`
  - `src/core/inspector/focus-map.ts`
  - `src/core/inspector/journey-stage.ts`
  - `src/features/lesson-engine/model/textures-lessons.ts`: "Apply Texture panel" becomes "Texture group".
- Test: `tests/black-box/texture-controls.test.ts`. Update the existing tests that name `texture-library` or mount the deleted panels:
  - `editor-inspector.test.ts`: lines 47, 68, 95, 110, 264;
  - `editor-shell.test.ts`: line 749;
  - `lesson-column.test.ts`: lines 604–606 use `viewing-volume`;
  - `math-journey.test.ts`: lines 48, 59;
  - `editor-panels.test.ts`: the `TextureLibraryPanel` and `UVEditorPanel` tests mount the new picker and UV panel.
- Visual: `tests/visual/pipeline-textures.spec.ts`

**Interfaces:**
- Consumes: `presetUVs` and `setUVs` (Task 13); `SAMPLE_TEXTURE_SPECS` (Task 10); the store's `attachTexture`, `detachTexture`, `addUploadedTexture`, `removeUploadedTexture`, `updateTextureFilter`, `updateTextureWrap` and `updateUV`
- Produces:
  - **Group ids:**
    - `SettingsGroupId` drops `'texture-library'`;
    - `SETTINGS_GROUPS = ['background', 'viewing-volume']`;
    - `DEFAULT_OPEN_GROUPS = ['transform', 'background', 'viewing-volume']`;
    - `GROUP_SECTION` and `GROUP_STAGE` lose the key.
  - **Focus:** `resolveFocus('texture-library', …)` returns the same place as `'texture-attach'`, which is `{ area: 'object', group: 'texture' }`. `'texture-library'` stays in `FOCUS_PANEL_IDS`.
  - **The Texture group** renders two blocks:
    - `<TexturePicker />` and `<TextureParams />`, in a block with `data-panel-id="texture-attach"`;
    - `<UVEditorPanel />`, with `data-panel-id="uv-editor"`.
    - There are no inner collapsible sections.
  - **TexturePicker:**
    - **The tiles:** a 4-column grid of buttons: None, the samples in spec order, uploads oldest first, and Upload.
      - `aria-pressed` marks the attached one, or None.
      - Each upload has a remove button labelled `Remove ‹name›`.
    - **Clicking a tile:**
      - None calls `detachTexture`;
      - an image calls `attachTexture`;
      - Upload opens the file input, then attaches the new image to the selected shape. Errors show as toasts, as today.
    - **The name line:** `‹name› · ‹w› × ‹h› · sample|uploaded`, with no truncation.
  - **TextureParams** (only when textured):
    - **The switches:** Filter (`NEAREST`, `LINEAR`) and Wrap (`REPEAT`, `CLAMP`), side by side, with mono labels. CLAMP stores `CLAMP_TO_EDGE`.
    - **The code line** shows one of these, for whichever was changed last (filter by default):
      - `glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_‹filter›);`
      - `glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_‹wrap›);`
  - **UVEditorPanel:**
    - **The stage:** the texture tiled when REPEAT, the 0..1 square dashed in amber, and a dark overlay at 38% opacity.
    - **The shape:** its outline in white, with numbered handles for dragging.
    - **Zoom:** the buttons `−` `Fit` `+` scale the zoom by 1/1.25 or 1.25, or reset the camera. Shift + drag and Shift + scroll keep working.
    - **Presets:** buttons Fit, Tile 2 × 2, Flip U and Flip V call `setUVs(id, presetUVs(…))`.
    - **Exact values:** a `<details>` disclosure, closed by default, with the vertex count at the right. Opened, it shows today's `DataTable` of u, v.
    - **The hint:** the "Drag handles…" paragraph is removed. The stage's `title` reads `Drag a corner to move its UV. Shift + drag pans, Shift + scroll zooms.`

- [ ] **Step 1: Write the failing tests, and update the existing ones to the new groups**

```ts
describe('BB-TEX-11: Settings has no texture group and the focus lands on the Texture group', () => {
  expect(SETTINGS_GROUPS).toEqual(['background', 'viewing-volume']);
  expect(resolveFocus('texture-library', true)).toEqual(resolveFocus('texture-attach', true));
});
describe('BB-TEX-12: The picker applies, removes and uploads', () => {
  // select a quad; tiles: None + 5 samples + Upload; click Pixel fox → texture.textureId 'sample-pixel' and aria-pressed;
  // click None → texture null; name line reads 'Pixel fox · 64 × 64 · sample' while attached
});
describe('BB-TEX-13: Removing an upload detaches it everywhere, and one undo restores it', () => {
  // add upload U; attach to quads A and B; remove U from A's picker → A and B untextured, U gone; undo → U back, both attached
});
describe('BB-TEX-14: Filter and wrap show one code line for the last change', () => {
  // default line has GL_TEXTURE_MIN_FILTER; choose CLAMP → wrap stored 'CLAMP_TO_EDGE' and line 'glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);'
});
describe('BB-TEX-15: The UV editor has presets, zoom buttons and closed exact values', () => {
  // buttons Fit, Tile 2 × 2, Flip U, Flip V; clicking Tile 2 × 2 doubles the UVs; the details element is closed and its summary shows '4 vertices'
});
```

Visual: `VIS-PT-08` (dark) and `VIS-PT-09` (light). They open `/app?scene=textured-quad`, select Bricks and open the Texture group, then screenshot the rail panel.

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run tests/black-box/texture-controls.test.ts tests/black-box/editor-inspector.test.ts tests/black-box/editor-shell.test.ts tests/black-box/lesson-column.test.ts tests/black-box/math-journey.test.ts tests/black-box/editor-panels.test.ts`
Expected: FAIL in BB-TEX-11..15 and the updated expectations.

- [ ] **Step 3: Implement the group, remove the library, reword the lessons**

- [ ] **Step 4: Run every test, then the visual baselines**

Run: `npm test`, then `npx playwright test tests/visual/pipeline-textures.spec.ts --update-snapshots`
Expected: PASS, including BB-LRULE for the Textures lessons; VIS-PT-08 and VIS-PT-09 written.

- [ ] **Step 5: Commit**

```bash
git add src/features/textures src/widgets/layout/editor-column/inspector-groups.tsx src/widgets/layout/editor-column/SettingsPanel.tsx src/core/inspector/groups.ts src/core/inspector/focus-map.ts src/core/inspector/journey-stage.ts src/features/lesson-engine/model/textures-lessons.ts tests/black-box/texture-controls.test.ts tests/black-box/editor-inspector.test.ts tests/black-box/editor-shell.test.ts tests/black-box/lesson-column.test.ts tests/black-box/math-journey.test.ts tests/black-box/editor-panels.test.ts tests/visual/pipeline-textures.spec.ts
git commit -m "feat(textures): gather picking, filtering, wrapping and UVs into the Texture group"
```

### Task 15: Docs

**Files:**
- Modify: `docs/product-plan.md`:
  - line 124: Settings is Background and Viewing volume;
  - lines 487, 507, 526: images are picked and uploaded in the shape's Texture group;
  - the five samples by name.
- Modify: `src/features/help/model/help-content.ts`:
  - line 94: the Settings description;
  - lines 458 and 465: upload in the Texture group;
  - name the Diagram switch in the canvas header if the help describes it.
- Modify: `tests/README.md`: add `pipeline-figures.test.ts (BB-PFIG-*)`, `texture-controls.test.ts (BB-TEX-*)` and `pipeline-textures.spec.ts (VIS-PT-*)`.
- Modify: `docs/specs/2026-10-04-website-overhaul-roadmap.md`: one line under the lesson content item recording this editor work.

- [ ] **Step 1: Edit the docs.** Run `npm run lint`, `npm run build` and `npm test`. Expected: PASS. Run `git checkout -- tests/reports`.
- [ ] **Step 2: Commit**

```bash
git add docs/product-plan.md src/features/help/model/help-content.ts tests/README.md docs/specs/2026-10-04-website-overhaul-roadmap.md
git commit -m "docs: describe the new Pipeline illustrations and the Texture group"
```

### Task 16: Checkpoint 4

- [ ] **Step 1: Screenshots.** In both themes at 1280 px: the Texture group on the Textured quad scene, with Exact values closed and open, and the Settings panel. Put them beside the approved `texture-group.html` and open the page for the owner.
- [ ] **Step 2: Owner sign-off.** The owner signs off or names changes; changes are made and re-shown before moving on.

After Task 16: the final whole-branch review. Then ask the owner before merging into `main`, pushing and deleting `feat/pipeline-textures-ui`, all by Oct 28.
