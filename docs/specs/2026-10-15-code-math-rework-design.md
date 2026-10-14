# Code and math rework — design

Date: 2026-10-15
Roadmap: "Next projects", item 2 in [the overhaul roadmap](2026-10-04-website-overhaul-roadmap.md), including Could item 16 ("Explain this line")
Builds on: [the editor rail redesign](2026-10-14-editor-rail-design.md), which makes the right column one pane with a Code | Math switch

## Purpose

The editor rail redesign settles where the code and math sit. This project changes what they contain and how they behave. The owner named four problems with the panels (2026-10-14):

1. **The code is a wall.** The student's own part (their shape's draw function and its state) is buried in 60–100 lines of boilerplate.
2. **Lines aren't explained.** A student cannot ask what a line does; the hover notes appear only while the scene is empty.
3. **The math feels disconnected.** The math cards do not clearly relate to what the student just did, or to the code line that uses those numbers.
4. **The math is just numbers.** The cards show results (a matrix, a table) but not the working: how a vertex goes from the student's values to the screen, step by step.

The owner also found the code panel's highlights too loud and too alike (the selected object's lines and the changed lines are both cobalt washes), changes easy to miss (the whole line flashes, not the value), and the panel plain. A first-time student must not be overwhelmed.

The audience is the same as the rail's: students on their own and expo visitors, equally.

## Owner decisions (2026-10-14 and 2026-10-15)

| Question | Decision |
| --- | --- |
| "The full scene is always shown" | Stays a hard rule. The wall is fixed by folding, not by a partial view |
| How a student asks what a line does | Layered: fold headers summarise blocks; short notes sit under key lines; clicking any line opens an explanation strip at the bottom of the pane |
| What the notes are | Panel UI only. The generator and Copy are unchanged |
| What is open by default | Follow the selection: the selected object's code is open and the rest folds. With nothing selected, every object's code is open and only the boilerplate folds |
| Shape of the math | A vertex journey: follow one vertex of the selected object, with the student's numbers, from where it was typed to the pixel it lands on |
| Journey and the five tabs | The journey replaces the tabs. Its six stages cover all five sections; today's cards move into the stage they belong to |
| Which vertex | Vertex 1 by default; a `‹ vertex n of N ›` stepper, or clicking one of the selected object's vertex handles, switches it. A ring marks it on the canvas |
| Journey layout | A track: every stage is a row showing its result; one stage is open with its working ("H2, refined", mock `journey-h2-v3`) |
| Code panel look | "Calm A": no marks on the selected object's lines, folds show only their names, two syntax colours, amber only on the value that just changed, three short notes, a footer hint (mock `code-calm-v2`) |
| How the panel learns the code's structure | It reads the generated text with a pure parser, as `locate-branch.ts` does today. The generator does not change |

## 1. The colour rule

Two colours carry meaning in both panes, and nothing else uses them:

- **Amber: your values.** A value that just changed in the code; the inputs the student set, in the journey's working; the followed vertex's ring.
- **Cobalt: you and the controls.** GL calls in the code, links, the open stage's dot and line, the Code | Math switch.

New tokens in `shared/styles/_tokens.scss`, in both themes: `--value` (amber text: dark `#fbbf77`; light `#9a5800`, about 5:1 on `--code-bg`), `--value-wash` (the amber background behind a changed value) and `--run-fired` (green, for Run's fired branch). `--code-match-rgb` and `--code-match-light` are retired; Find no longer uses colour.

## 2. The code panel

### Outline and folding

A pure function, `outlineCode(code)` in `features/code-generation/model/code-outline.ts`, reads the generated program into **blocks**: the includes, the `ObjectState` struct, the global state (one line per object), the buffer data (per object), the VBO handles, the forward declarations, each `draw_<name>()` function, `display()`, `init()`, `main()` and each callback handler. For every line it records its block, the object it belongs to (by sanitised name, the same patterns the viewer uses to highlight today), and whether it can be explained.

Folding follows the selection:

- **Open:** every line that belongs to the selected object: its state line, its buffer data, its `draw_` function, and the lines of `init()` that create its buffers or texture. A block that holds those lines opens; the other lines of a partly open block (another object's state line, say) fold into a summary row such as `▸ 2 more objects`.
- **Folded:** everything else, shown as one row with a fold arrow and the block's name (`▸ void main()`). Hovering the row or giving it keyboard focus shows its plain summary ("opens the window and starts GLUT").
- **Nothing selected:** every object's lines are open; only the boilerplate folds (includes, struct, declarations, VBO handles, `display()`, `init()`, `main()`, the callback handlers).
- **Always opens:** a fold opens when a lesson highlights a line inside it, a value inside it changes, Find's current match is inside it, or Run fires a branch inside it.
- **By hand:** clicking a fold row, or Enter on it, opens or closes it. A fold opened by hand stays open until the selection changes.
- Line numbers stay the real program's numbers, so a folded range shows as a gap. **Copy** copies the whole program, as today. Folding is never saved.

### Notes

Short notes in dim text sit under the **key lines of the open `draw_` functions** only: `glTranslatef`, `glRotatef`, `glScalef` (when not 1, 1), `glBegin` or `glDrawArrays` / `glDrawElements`, and `glBindTexture`. A note is at most about six words and uses the student's values: "move by your X **0.40**, Y −0.17"; "turn by 15°"; "every 3 vertices make a triangle". It aligns under the code it describes.

A **Notes** switch in the column header (beside Find and Copy) hides and shows them. It starts on and is not remembered between visits. Notes are panel UI: they are not comments, and Copy never includes them.

### The explanation strip

- Clicking an explainable line, or Enter on it, opens a strip along the bottom of the pane. The line gets the panel's only full-line background (`--raised`).
- The strip holds: the call's signature (`glTranslatef(x, y, z)`); one or two sentences on what it does and why it is here; a **your values** table, one row per argument that comes from the scene, naming its value and its control (`x · state_Triangle.x = 0.40 · Translate X`); and up to two links, **See the math: ‹stage›** and **Open ‹control›**.
- **Explainable lines:** every line that calls a `gl*` or `glut*` function, declares or fills object state or a buffer array, declares a VBO handle, opens a function (`void draw_Triangle()`, `display()`, `init()`, `main()`, a handler), or is a `case` or `if` branch in a handler, plus the includes. Braces, blank lines and comments are not explainable and do not react to clicks.
- Esc or the strip's ✕ closes it. While it is open, Arrow Up and Arrow Down move to the previous or next explainable line that is showing.
- With the strip closed, the pane's footer reads "**Click any line** to see what it does."
- The text comes from a catalogue, `features/code-generation/model/code-explanations.ts`, keyed by line pattern, with templates filled from the scene. It replaces `glut-annotations.ts`; the empty-scene underlines and their hover cards go.
- The strip's text is in a polite live region, so a screen reader hears it when it changes.

### Highlights

Each highlight has one job:

| Mark | Meaning |
| --- | --- |
| The changed value in amber on an amber wash, fading over about 2 s; its line number stays amber until the next change | What just changed. Only the token that changed, not the line |
| A full-line `--raised` background | The line being explained |
| A 1 px outline around the match, no fill; the current match's fold opens and it scrolls into view | Find |
| A 3 px `--run-fired` bar and a light green wash, for 700 ms as today | Run's fired branch |

Removed: the cobalt wash and bar on the selected object's lines (the folds already show which code is the student's), the "1 change" badge and the "focus:" label in the header, the empty-scene annotation hint.

**What changed** is found by a pure function, `diffChangedValues(prev, next)` in `features/code-generation/model/value-diff.ts`. It uses `diffChangedLines` to find changed lines, then compares each changed line with its counterpart token by token and returns the changed tokens' ranges. A line with no counterpart (an added object, say) is marked whole. The mark now shows in Author mode as well as in lessons and the tour; the lesson runner keeps its own changed-line list for scrolling.

With `prefers-reduced-motion`, the amber wash does not fade; it is removed after 2 s.

### Syntax colours

Two only: GL and GLUT calls in cobalt (`--code-fn`), comments dim. Keywords, types, numbers and names are plain ink, so amber stands out. Line numbers use a quieter ink than today.

## 3. The math pane: the vertex journey

The math pane becomes one view, the journey. It replaces the five section tabs and `MathPanel.tsx`'s tab list.

### Header

`○ Following Triangle      ‹ vertex 1 of 3 ›`

- The ring is the same amber ring drawn on the canvas.
- The stepper's arrows move through the selected object's vertices. Clicking one of the object's vertex handles on the canvas also chooses that vertex.
- The followed vertex goes back to 1 when the selection changes, and is clamped when vertices are removed.

### The track

The six stages, in the order OpenGL processes a vertex:

| # | Stage | Section | Closed row shows |
| --- | --- | --- | --- |
| 1 | Stored | Buffers | the vertex as typed, `(0.00, 0.50)` |
| 2 | Transformed | Transforms | the world position, `(0.27, 0.31)` |
| 3 | Projected | Transforms | `NDC (0.27, 0.31)` |
| 4 | Assembled | Primitives | `triangle, 1 of 3` (its primitive and corner) |
| 5 | Rasterised | Pipeline | `pixel (372, 328)` |
| 6 | Coloured | Primitives, Textures | `rgb(1.0, 0.4, 0.2)`, or the texel for a textured object |

Each stage is a row with a dot on a vertical line. Stages before the open one have filled dots. Exactly one stage is open. Clicking a closed row opens it; Back and Next in the open stage move to the neighbours.

### The open stage

Every open stage has the same layout, top to bottom:

1. **Heading** with the section as a small chip, then **one sentence** on what happens at this stage.
2. **Working:** a `<table>` in a dark well with column heads **Step · Value · Code**. The first row says where the value came from ("from Stored"); each following row is one operation with the student's inputs in amber and the GL call that performs it; the last row, **Result**, matches the closed row. Clicking a row's GL call switches to Code and opens the strip on that line.
3. **Picture** (optional), with a small label: today's cards, moved here and given the student's numbers where they have them.
4. **Footer:** a link to deeper detail on the left, Back / Next on the right.

### What each stage shows

**1 · Stored.** Where the vertex lives before OpenGL uses it, per rendering mode.
- Immediate: "sent directly by `glVertex2f`; no buffer holds it".
- Vertex array: index and byte offset in `verts_<name>` (client memory), with `glVertexPointer`'s stride.
- VBO: byte offset in `vbo_<name>` on the GPU, copied there by `glBufferData`, with the usage hint.

Pictures: today's Buffers cards (interleaved layout, memory footprint, array vs indexed, CPU → GPU traffic, mapping the buffer with its step-through). The lesson-driven mapping steps (`dmaStep`) keep working here.

**2 · Transformed.** Scale, then rotate, then move, each with the student's numbers. For an object inside groups, each enclosing group's scale, rotate and move follow, innermost group first.
- Picture: "As one matrix", M = T · R · S, with the move column in amber.
- Deeper detail: the full 4×4 and the matrix stack (today's cards).

**3 · Projected.** `glOrtho` maps the viewing volume to −1…1 on each axis.
- Rows for x and y with the volume's bounds.
- Picture: the formula with the student's numbers substituted.
- Deeper detail: today's viewing volume card.

**4 · Assembled.** How the primitive type groups this vertex with its neighbours: "every 3 vertices make one triangle; this is corner 1 of triangle 1".
- The rule for each of the ten primitive types, with the followed vertex ringed in a small drawing of the shape.
- Pictures: today's Vertices card; for lines, the stipple pattern and width; for points, the point size.

**5 · Rasterised.** NDC to window pixels for the current canvas size: x = (x + 1) / 2 · width, y = (y + 1) / 2 · height, counted from the bottom-left as OpenGL does.
- Pictures: today's vector vs raster card and the pointer readout (the cursor's NDC position).

**6 · Coloured.**
- Untextured: the vertex colour (`glColor3f`), the shading model, and how the colour blends across the face. With flat shading, the colour the primitive takes.
- Textured: its UV (`glTexCoord2f`), the texel it maps to for the bound texture's size, the filter and wrap.
- Pictures: today's barycentric interpolation, colour, UV table, filtering, wrap and "across the triangle" cards.

### Objects without ordinary vertices

- **Nothing selected:** the six rows show their names with a one-line description each, and the header reads "Select a shape to follow one of its vertices." The context still opens a stage. Pictures that need no object, such as the pointer readout and the viewing volume, still show.
- **A group:** "A group has no vertices of its own. Select a shape inside it to follow one." The Transformed stage shows the group's own transform, since that is the frame it gives its children.
- **Text:** the journey follows the text's raster position (`glRasterPos2f`). Assembled reads "Text is drawn as bitmap characters at this position, not assembled from vertices."

### Which stage opens

The context opens a stage, as it chose a tab before. `mathTabFor` and `mathTabOverride` become `journeyStageFor` and `journeyStageOverride`. The mapping lives with the rest of the inspector vocabulary in `core/inspector`:

| Context (lesson focus place, else the last opened group) | Stage |
| --- | --- |
| Vertices, Buffers | Stored |
| Transform, the scene list | Transformed |
| Viewing volume | Projected |
| Add (primitives), Create Text | Assembled |
| Pipeline mode controls, Background | Rasterised |
| Appearance, Texture, Texture library | Coloured |
| Callbacks, or nothing | the course section's stage: Pipeline → Rasterised, Primitives → Assembled, Buffers → Stored, Transforms → Transformed, Textures → Coloured |

A stage the student opens by hand holds until the next lesson step or the next group opened, the same rule the tabs had. A lesson step may name a stage directly with a new optional `LessonStep.mathStage`.

### Accessibility

- The track is a list. Each closed row is a button with `aria-expanded="false"`; the open stage's heading carries `aria-expanded="true"`.
- The working is a real `<table>` with header cells.
- The stepper's arrows have the names "Previous vertex" and "Next vertex".
- The header's vertex text is in a polite live region.

## 4. Linking code, math and canvas

- **Code → math:** the strip's "See the math: ‹stage›" switches the column to Math and opens that stage (it sets the override).
- **Math → code:** clicking a GL call in a working row switches to Code, opens the fold if needed, scrolls to the line and opens its strip.
- **Strip → control:** "Open ‹control›" switches the rail to the panel and outlines the control, as a lesson step's focus does.
- **Canvas → math:** clicking a vertex handle of the selected object chooses the followed vertex.
- **Math → canvas:** the amber ring on the canvas marks the followed vertex. It shows only while the column shows Math, so it is not noise while the student reads code. It is a transient overlay, never saved, and hidden during Run like the selection outline.
- **Run:** the math pane stays inert during Run, as the rail specifies.

## 5. Lessons, tour and help

- **Lesson steps that point at the math panel** are updated so their words match the journey. Nine steps name a math card or "the math panel on the right / below the code":
  - Buffers: the CPU → GPU traffic timeline (three steps), the mapping diagram, and Array vs Indexed.
  - Pipeline: the cursor's NDC position.
  - Primitives: barycentric interpolation.
  - Textures: the interpolation formula.
  - Transforms: the matrix and the matrix stack.

  Each gets `pane: 'math'` (the rail's field), a `mathStage` where the context mapping would not open the right stage, and narration that names the stage ("the Stored stage's traffic timeline"). No other lesson text changes; the lesson content project writes the rest.
- **The tour** (rail spec §7, step 4) needs no change: after the student changes X, the context opens Transformed, whose matrix shows the new number.
- **Help Center:** the topics on the code panel and the math panel are rewritten for folds, notes, the strip, the highlights and the journey.
- All new student-facing text follows the product rules and avoids the banned words.

## 6. State and architecture

### Store (runtime slice, not persisted; the persist version stays as it is)

| Field | Purpose |
| --- | --- |
| `journeyStageOverride: JourneyStageId \| null` | Replaces `mathTabOverride` |
| `journeyVertex: number` | The followed vertex index; reset on selection change |
| `codeFoldsOpened: string[]` | Block ids opened by hand; cleared on selection change |
| `explainedLine: number \| null` | The line the strip explains |
| `codeNotes: boolean` | The Notes switch, starting `true` |

`selectObject` and the multi-select actions reset `journeyVertex`, `codeFoldsOpened` and `explainedLine`, following the rail's rule that selection side effects live in the store's selection actions.

### Modules

| Path | Responsibility |
| --- | --- |
| `features/code-generation/model/code-outline.ts` (new) | `outlineCode(code)`: blocks, line kinds, owning object, explainable flag. Pure |
| `features/code-generation/model/code-folds.ts` (new) | `visibleRows(outline, selection, opened, forced)`: the rows to show (lines and fold rows). Pure |
| `features/code-generation/model/value-diff.ts` (new) | `diffChangedValues(prev, next)`. Pure |
| `features/code-generation/model/code-explanations.ts` (new, replaces `glut-annotations.ts`) | The catalogue; `explainLine(line, outline, scene)` returns signature, text, values, stage and control; `noteFor(line, scene)` returns a note or nothing. Pure |
| `shared/ui/code-viewer/` | Renders rows, folds, notes, the strip, the highlight marks and the hint from props. Stays free of scene knowledge |
| `features/code-generation/ui/SceneCodePanel.tsx` | Composes the above from the store |
| `features/math-panel/model/vertex-journey.ts` (new) | `vertexJourney(scene, objectId, vertexIndex, canvasSize)`: the six stages, each with rows (step, inputs, value, GL call) and a result. Pure |
| `core/inspector/journey-stage.ts` (new) | `JourneyStageId`, `stageForPlace`, `stageForSection`, `journeyStageFor` |
| `features/math-panel/ui/` | `JourneyPanel` (header, track, open stage) and one component per stage, reusing today's cards as pictures. `MathPanel.tsx` becomes the journey |
| `shared/engine/selection-overlay.ts` | Draws the followed vertex's ring |

The code-generation feature imports nothing from the math panel. The link between them goes through store state (`codePane`, `journeyStageOverride`, `explainedLine`), so the layering stays within FSD.

### Why the generator does not change

Reading the finished text keeps the generator, the most tested module, untouched before the freeze, and the approach already works for Run's fired branch. The generator is deterministic and its output is pinned by tests. A format change that the parser does not expect fails `outlineCode`'s tests instead of breaking silently.

## 7. Tests

New black-box and white-box tests, with the next free IDs in their suites:

- **Outline:** every block found in the fixture programs (immediate, vertex array, VBO, indexed, textured, text, groups, every callback); owning object per line; explainable flags. Each generator format the parser relies on is pinned.
- **Folds:** the selected object's lines open; nothing selected opens every object; the forced-open rules (lesson highlight, changed value, Find, Run); folds opened by hand are cleared on selection change; Copy returns the full program.
- **Value diff:** one changed number marks one token; an added object marks its lines whole; an identical program marks nothing.
- **Explanations:** every explainable line in the fixtures has an explanation; each value row names the right state field and control; notes appear only on the key lines; no student-facing string contains a banned word.
- **Journey:** each stage's numbers against the independent reference in `tests/helpers/matrix.ts`, extended with the orthographic and viewport mappings, never against `src`; nested groups; every primitive type's assembly rule; flat and smooth colour; textured UV to texel; text and group cases; the vertex clamp.
- **Stage context:** `journeyStageFor` for every focus place, group and section; the override's lifetime.
- **Panels (black box):** clicking a line opens the strip and Esc closes it; arrow keys move between explainable lines; See the math opens the stage; a working row's call opens the code line; the stepper and a canvas handle change the followed vertex; the ring shows only with Math; the math pane is inert during Run.
- **Lessons:** the nine updated steps open Math on the stage their narration names; the `dmaStep` stepper still drives the Stored stage.
- **Existing tests** that assert the old structure (the tab list, the highlight classes, `glut-annotations`, the change badge) are updated to the new structure; their IDs stay.
- **Visual:** new captures of the code pane (folded, notes, strip open, a changed value) and of the journey (each stage open once), in both themes at 1280 px.

## 8. Product plan, roadmap and manuscript

**Product plan amendment** (approved by this design):

- **Workspace Layout:** the math pane is the vertex journey.
- **Code Generation:**
  - "the changed lines briefly animate" becomes "the changed values are marked".
  - "the selected object's corresponding code lines are visually distinguished" becomes "the selected object's code is unfolded and the rest of the program is folded to one line per block".
  - "The full scene is always shown" stays, with a note that a folded block shows as one row and Copy always gives the whole program.
- **Stage sections that name math visualisations** (buffer flow, matrix stack, glOrtho editor) say that each appears inside its journey stage.

**Roadmap:** item 16 is marked complete with this project, and "Next projects" item 2 gets its status.

**Manuscript divergence**, a new entry: "The evaluated build's math panel had one tab per curriculum section, and its code panel tinted the selected object's lines and explained boilerplate only on an empty scene. The math panel is now a vertex journey through six pipeline stages with the student's numbers. The code panel folds everything but the selected object's code and explains any line on request."

## 9. Delivery

- **Branch:** `feat/code-math`, started from `main` after `feat/editor-rail` merges. Lint, build and tests stay green at every step.
- **Freeze:** work that touches the editor lands by the Oct 28 freeze. Whatever is not finished by then waits, and nothing half-built ships.
- **Build order:** every step leaves a complete, working editor.
  1. **The calm code panel.** Outline, folding that follows the selection, the new highlight rules with value-level changes, the two syntax colours, the quieter header and line numbers.
  2. **The journey shell.** Header, stepper, track and the open-stage layout. Stages 2 and 3 get their full working. Stages 1, 4, 5 and 6 show their result row, a sentence and today's cards as their picture. The context mapping, the override and the nine lesson steps are updated. The tabs are removed. After this step every card from the old tabs is still reachable.
  3. **Explanations and links.** The strip, the notes, the footer hint and the catalogue, plus the links both ways, the canvas ring and choosing a vertex on the canvas.
  4. **The remaining stages' working**, one stage at a time: Stored, Assembled, Rasterised, Coloured.
  5. **Help, the product plan, the roadmap and the divergence entry.**

  Steps 1–3 are the core. If time runs short, step 4 stops after whichever stages are done, and each of those stages is complete.
- **Mocks** from the design sessions are kept locally under `.superpowers/brainstorm/` (not committed): `journey-h2-v3.html` and `code-calm-v2.html`.

## Rulings made in this spec

Decisions taken while writing, not asked one by one:

- **Folding:**
  - A partly open block folds the lines that aren't the selected object's into a summary row ("▸ 2 more objects").
  - The lines of `init()` that set up the selected object's buffers or texture open with it.
- **Notes:** the key lines are the transform calls (scale only when it isn't 1, 1), the draw call and the texture bind.
- **Explanation strip:**
  - The empty-scene annotation underlines are retired; the strip covers those lines.
  - Up and Down move between explainable lines while the strip is open.
- **Highlights:** the changed-value mark shows in Author mode too, not only in lessons.
- **Journey:**
  - The followed vertex resets to 1 on every selection change.
  - The canvas ring shows only while the column shows Math.
  - A group shows its own transform and a prompt to select a shape inside it. Text follows its raster position.
- **Which stage opens:** the context-to-stage table in section 3; Callbacks keeps the course section's stage.
- **Lessons:** this project edits only the nine lesson steps that name the math panel, adding the new `LessonStep.mathStage` field where needed.
- **State:** the Notes switch starts on and, like the rest of the column's state, is not remembered between visits.
