# Editor refinement: one editor, lessons as a guide — design

Date: 2026-10-07
Roadmap item: 6 (Must). Due by the editor freeze on 2026-10-28
Branch: `feat/editor-refinement`, started after `feat/visual-identity` merges

## 1. Purpose

In the editor at `/app`, the curriculum section is also an editor mode:

- The section menu at the top of the left column decides which panels exist. Transform controls are only reachable in Transforms, the texture panels only in Textures, the callbacks panel only in Primitives.
- The primitive palette is repeated in three sections. Scene Hierarchy is repeated in all five.
- The Lessons button lists only the current section's lessons, so a student has to switch the editor's mode to find a lesson.
- The Pipeline section replaces the canvas with teaching illustrations (the pipeline diagram and the raster vs vector view). It looks like a canvas mode but is not one.

The editor review of `/app` (24/40) also found:

- a collapsed type scale, with 7.8px labels, 64 distinct font sizes and code set in the browser's default monospace;
- four different selection styles and an overused orange;
- boxed panels nested inside boxed panels, with creation controls shown before the scene;
- the code column clipping long lines;
- the "Use this panel" label at 3.9:1 contrast;
- a 3px horizontal overflow at 960px.

This sub-project separates the editor from the course. **The editor is always the whole editor:** a scene list, an inspector for the selected object in pipeline order, and scene settings. **The course becomes a map:** a Learn drawer with the five sections in pipeline order, each section's demos and exercises, and the student's progress. A lesson runs as a guide card above the real editor, focusing the controls a step needs and loosening that focus as the section goes on.

The visual language (tokens, fonts, themes, wordmark) is specified in [the visual identity spec](2026-10-07-visual-identity-design.md) and is a prerequisite. Functional callbacks are a separate sub-project (section 12).

## 2. Decisions

| Topic | Decision |
| --- | --- |
| Editor structure | One editor with no section modes. The left column holds the Scene list and one Add row, then the inspector |
| Inspector | Groups in pipeline order: Vertices, Buffers, Transform, Appearance, Texture, Animation. With nothing selected the inspector shows scene settings: Background, Viewing volume, Texture library, Callbacks |
| Lessons | A guide card at the top of the left column, over the real editor. The step's group is opened and outlined. Focus fades through a section (section 6) |
| Choosing lessons | The top bar's Lessons button becomes **Learn**, which opens a drawer: a five-stop rail (Pipeline, Primitives, Buffers, Transforms, Textures), then the chosen section's demos and exercises with progress marks |
| `/learn` page | Later, by Nov 2, outside the editor. It reuses the drawer's course data and progress. It replaces the roadmap's SP4 Learn hub and gets its own spec |
| Pipeline illustrations | The pipeline diagram and the raster vs vector view appear only during Pipeline lessons. The editor has no canvas view switch |
| Progress | Stored under its own localStorage key, `vams-lesson-progress`. `vams-storage` stays at version 7 with the same persisted shape |
| Callbacks | Unchanged here: registration and stubs, as the product plan specifies. The panel moves into scene settings. Making handlers run is a separate sub-project |

The product rules hold unchanged: the section labels stay exactly `Pipeline | Primitives | Buffers | Transforms | Textures`, there are still two modes (Author and Lesson), and lessons stay data.

## 3. Layout

```
┌ top bar: wordmark · scene name ·············· undo/redo · Learn · File · theme ┐
├──────────────────────┬───────────────────────────────┬─────────────────────────┤
│ [lesson card]        │                               │ code panel              │
│ Scene  (n objects)   │            canvas             │                         │
│  object list         │                               ├─────────────────────────┤
│  Add: Points Lines … │                               │ math tabs               │
│ ── inspector ──      │                               │ math content            │
│ object header        │                               │                         │
│ ▸ Vertices           │                               │                         │
│ ▸ Buffers            │                               │                         │
│ ▾ Transform          │                               │                         │
│ ▸ Appearance         │                               │                         │
│ ▸ Texture            │                               │                         │
│ ▸ Animation          │                               │                         │
└──────────────────────┴───────────────────────────────┴─────────────────────────┘
```

The three columns, their widths and the code and math column keep SP5's structure. What changes is the left column and the top bar's Lessons button.

### 3.1 Scene list and Add row

The Scene header shows the object count. Below it is the existing hierarchy (`SceneHierarchyPanel`, panel ID `scene-hierarchy`), with its rename, visibility, group, duplicate and delete actions.

The Add row replaces the primitive palette that SP5 repeats in three sections. It shows the most common primitives by OpenGL name (Points, Lines, Triangles, Quads) and a **More** menu with the rest, the convenience presets and Text. It keeps the panel ID `primitive-palette` and reuses the palette's creation logic, including the click-to-place flow for polygon, strip and fan primitives. A preset stays labelled with its underlying primitive type.

### 3.2 Inspector for a selected object

An object header shows the object's name and a line such as `GL_TRIANGLES · 3 vertices`. Below it, one collapsible group per stage of the pipeline. Each group header names the group and, in mono, the OpenGL call it maps to.

| Group | Contents (existing panel ID) | Header call |
| --- | --- | --- |
| Vertices | One row per vertex with x and y number fields, editing through `updateVertexPosition`. New UI on an existing store action | `glVertex2f` |
| Buffers | The render-mode control (`buffers-panel`) | The current mode: `glBegin`, `glDrawArrays` or the VBO calls |
| Transform | Translate, rotate, scale (`object-transform`) | `glTranslatef · glRotatef · glScalef` |
| Appearance | Colour and shading (`appearance-panel`). Line style (`line-style-panel`) for line primitives. Text settings (`text-node-panel`) for text objects | `glColor3f` |
| Texture | Attach (`texture-attach`) and the UV editor (`uv-editor`) | `glBindTexture`, or "none" |
| Animation | The animation preview (`animation-preview`) | `glutIdleFunc` |

Groups that do not apply are left out, using the rules the panels already hold: Line style appears only for `LINES`, `LINE_STRIP` and `LINE_LOOP` (`LineStylePanel`), and the Texture group only for the fillable primitives in `TEXTUREABLE_TYPES` (`TextureAttachmentPanel`).

**One group is open by default:** Transform. Opening a group does not close the others, and the open set lasts for the session only.

### 3.3 Scene settings, with nothing selected

The object header reads "Scene settings". The groups are:

| Group | Contents (existing panel ID) | Header call |
| --- | --- | --- |
| Background | The background colour control, which is `ObjectAppearancePanel`'s no-selection view (`appearance-panel`) | `glClearColor` |
| Viewing volume | The ortho editor (`ortho-editor`) | `glOrtho` |
| Texture library | Upload and manage textures (`texture-library`) | `glGenTextures` |
| Callbacks | The callbacks panel (`callbacks-panel`), unchanged in behaviour | `glutKeyboardFunc …` |

Background is open by default.

### 3.4 Panels become groups

The existing feature panels render inside the groups. They keep their `panelId` values and their titles, so lesson data and narration stay true. A panel's own collapsible frame is dropped inside a group, so there are no boxes inside boxes. The Pipeline mode controls panel (`pipeline-mode-controls`) leaves the editor and moves into the lesson card (section 5.3).

### 3.5 Removed

- The section menu at the top of the left column (`SectionMenu`).
- `SECTION_PANELS` and the per-section panel lists.
- The "Use this panel" label.
- The section-filtered Lessons menu (`LessonLauncher`).

## 4. The Learn drawer

The **Learn** button in the top bar opens a drawer from the left, over the left column and part of the canvas, with a scrim behind it. It is reachable in both modes.

- **Rail.** Five stops in pipeline order, joined by a line. A stop shows a tick when every lesson in its section is complete. The current section is marked with the accent.
- **Section.** The chosen stop's name and one line of description, then two lists, **Demos** and **Exercises**, in registry order. Each lesson shows its title, its step count and its state: complete (tick), in progress (filled dot, "Step n of m"), or not started.
- **Browsing.** Choosing a stop only changes what the drawer shows. It does not change the editor.
- **Starting a lesson** sets the current section to the lesson's section, then starts it. If another lesson is running, the student first confirms leaving it, as the product plan requires when a lesson is interrupted.
- **Keyboard.** The drawer is a modal dialog: focus moves into it, Escape closes it, and focus returns to the Learn button. The rail is a radio group operated with the arrow keys.

The drawer opens on the current section.

## 5. Lessons over the editor

### 5.1 The lesson card

The card sits at the top of the left column. It shows:

- the lesson type, section and step position ("Exercise · Transforms · 1 of 2");
- a step bar;
- the narration;
- Back and Next;
- a close button that exits the lesson.

SP5's `LessonCard` keeps its behaviour and moves here. The Scene list and inspector stay below it, live.

### 5.2 Focus targets

A step's `focusPanel` names a panel ID, as today. One table in the lesson engine maps each ID to a place in the editor:

| `focusPanel` | Place |
| --- | --- |
| `scene-hierarchy` | Scene list |
| `primitive-palette` | Add row |
| `buffers-panel` | Buffers group |
| `object-transform` | Transform group |
| `appearance-panel` | Appearance group with an object selected. Background setting with nothing selected |
| `line-style-panel`, `text-node-panel` | Appearance group, at that panel |
| `texture-attach`, `uv-editor` | Texture group, at that panel |
| `animation-preview` | Animation group |
| `ortho-editor` | Viewing volume setting |
| `texture-library` | Texture library setting |
| `callbacks-panel` | Callbacks setting |
| `pipeline-mode-controls` | The view toggle in the lesson card (section 5.3) |

Focusing a place opens its group, scrolls it into view under the card, and outlines the named panel.

**A per-object focus needs a selection.** When a step's focus is a per-object group and no object is selected, the runner selects the newest object in the scene. Lesson steps create their objects through store actions, so the newest object is the lesson's. Steps that select an object themselves keep doing so.

The three Transforms steps that focus `animation-preview` now reach a rendered panel. In SP5 they pointed at a panel that never rendered in Lesson mode.

### 5.3 Pipeline lessons

Pipeline lessons already set the canvas view through `setPipelineMode('Diagram' | 'RasterVector' | 'Playground')`, and that keeps working. While a Pipeline lesson runs, the lesson card shows a three-way toggle (Scene, Pipeline diagram, Raster vs vector) bound to `pipelineMode`. This is the `pipeline-mode-controls` focus target. Outside a Pipeline lesson the canvas always shows the scene. Leaving any lesson resets `pipelineMode` to `Playground` and `activePipelineStage` to null.

### 5.4 Guidance fading

The focus style comes from data the lessons already carry: `type` and registry order.

| Lesson | Focus |
| --- | --- |
| Demo | The focused group is opened and outlined. Other groups collapse and dim to reduced opacity; they stay operable |
| Exercise, except the last exercise in its section | The focused group is opened and outlined. Nothing is dimmed |
| The last exercise in its section | No focus. The card shows the goal and the check only |

Closing the card leaves the plain editor with the scene as the lesson left it.

A pure function, `focusStyleFor(lesson, registry)`, returns `'tight' | 'outline' | 'none'`. It is tested directly.

### 5.5 The current section

`activeSection` stays in the store and in the persisted state, unchanged in shape. Its meaning becomes "the course section the student is in". It is read by:

- the Learn drawer, for its opening stop;
- the math panel, for its fallback tab (section 7);
- help, for its fallback topic (section 8).

`setActiveSection` in `core/store/runtime-slice.ts` stays the single place where a section change resets state. The two `setActiveSection('Transforms')` calls inside Transforms lessons keep working.

## 6. Progress

A small module in the lesson engine owns the localStorage key `vams-lesson-progress`:

```ts
interface LessonProgress {
  version: 1;
  completed: string[];                               // lesson IDs
  current: { lessonId: string; step: number } | null; // the lesson last left mid-way
}
```

- A lesson is complete when its last step passes.
- Leaving a lesson early records `current`, which the drawer shows as "in progress". Starting that lesson again begins at step 1; `current` is display only.
- Lesson IDs that are no longer in the registry are ignored on read.
- A missing, unreadable or wrong-version value reads as empty progress and never throws.
- Writes are wrapped so that a full or blocked storage only loses the progress write.

`vams-storage` keeps version 7 and its `partialize` shape, so no student loses a saved scene.

## 7. Math panel

The math panel gains tabs named with the five section labels. Each tab shows that section's existing math content (`PipelineMathContent`, `PrimitivesMathContent`, `BuffersMathContent`, `TransformsMathContent`, `TexturesMathContent`).

The tab follows what the student is doing:

| Situation | Tab |
| --- | --- |
| A lesson step with a focus | The tab for the focused place: Scene list, Add row, Vertices or Appearance → Primitives; Buffers → Buffers; Transform, Animation or Viewing volume → Transforms; Texture or Texture library → Textures; Background, Callbacks or the pipeline toggle → Pipeline |
| Outside a lesson, after opening an inspector group | The same mapping, for the group last opened |
| Otherwise | The current section's tab |

The student can pick a tab at any time. A manual pick holds until the next lesson step or the next group the student opens.

## 8. Help and empty state

**Help** opens on the topic for the focused or most recently opened group, and falls back to the current section.

**Empty canvas.** With no objects, the canvas shows two actions:

- **Add a shape** moves focus to the Add row.
- **Start a lesson** opens the Learn drawer on the current section.

Neither depends on the section. The code panel's annotated boilerplate for an empty scene shows in every section, not only Pipeline.

## 9. Layout fixes from the editor review

- **Type.** Every editor text size comes from the visual identity's type tokens, with nothing smaller than `--text-xs` (11px). Code uses JetBrains Mono at the code size.
- **One selection style.** The selected object in the Scene list, the active math tab, the open group's header, the lesson focus outline and the canvas selection overlay all use the accent tint, accent-text or an accent outline. The orange highlight and the other selection treatments are removed. The code panel's change highlight uses the accent tint with an accent left rule.
- **No boxes in boxes.** Groups are separated by single 1px rules. A panel inside a group has no border or background of its own.
- **Code column.** Long lines scroll horizontally inside the code panel instead of clipping. When a lesson highlights a line, the panel scrolls it into view in both directions.
- **960px.** The editor has no horizontal page overflow at 960 CSS px wide.
- **Contrast.** Every editor text and control meets WCAG 2.2 AA in both themes. The "Use this panel" label, measured at 3.9:1, is removed (section 3.5).
- **Canvas.** The canvas background stays exactly what `glClearColor` sets, because that is what the program would draw. The canvas overlays are restyled: thin axes and NDC tick marks in a neutral ink, and the selection overlay in `--accent`.

## 10. Testing

New tests follow the `{SUITE}-{MODULE}-{NN}` ID scheme in `tests/`.

- **Focus map coverage.** Every `focusPanel` value used in the five lesson files resolves to a place in the focus map. This guards lesson data against editor changes.
- **Fading.** `focusStyleFor` returns `tight` for every demo, `outline` for every exercise except the last in its section, and `none` for each section's last exercise.
- **Auto-select.** A per-object focus with no selection selects the newest object. A selection set by the step is kept.
- **Progress.** The tests cover:
  - completion on the last step;
  - `current` on early exit;
  - unknown IDs ignored;
  - corrupt, missing and wrong-version values reading as empty;
  - a throwing `localStorage.setItem` not breaking the lesson.
- **Persistence.** `vams-storage` stays at version 7, and its `partialize` output has the same keys as before.
- **Inspector.** Groups render for the selected object's type: no Line style for a triangle, no Texture group for a line. Scene settings show with nothing selected. Each group's controls still call the same store actions.
- **Math tabs.** The tab follows the focus, then the opened group, then the section. A manual pick holds until the next step.
- **Learn drawer.** Browsing a stop does not change `activeSection`. Starting a lesson sets it. Starting a lesson mid-lesson asks for confirmation. Escape closes the drawer and returns focus to the Learn button.
- **Existing suites.** The lesson, code-generation and store tests stay green unchanged.
- **Visual suite.** `npm run test:visual` is re-baselined for:
  - the plain editor with an object selected;
  - scene settings;
  - the empty state;
  - a demo step;
  - an exercise step;
  - the Learn drawer, in both themes.

## 11. Product plan amendment

The product plan describes the tools rail as section-specific. This sub-project amends `docs/product-plan.md` in the same branch:

- **Core Constraints → Section Switching Semantics.** The current section is the student's place in the course, set by the Learn drawer and by starting a lesson. The table's rules still apply when it changes: the scene, selection, view and textures are kept; a running lesson exits only after confirmation; exercise answers clear; transient panel state and section view modes reset.
- **Stage 0 → Workspace Layout and Goals 7–8.** The tools rail becomes the Scene list and a pipeline-ordered inspector, the same in every section. The lesson guide sits at the top of that column. The math panel has one tab per section, which follows the student's focus.
- **Stage 1 → Workspace Configuration.** The pipeline diagram and the raster vs vector view are shown during Pipeline lessons, chosen by the lesson or by the toggle in its card. The coordinate playground is the normal canvas.
- **Stages 2–5 → Workspace Configuration.** Each stage's tools are named as inspector groups or scene settings, not as a per-section rail.
- **Stage 2 → Callback Panel Behavior.** Unchanged, apart from the panel's location in scene settings.

## 12. Roadmap and divergences

- Roadmap item 6 links this spec.
- Two items join the list:
  - the `/learn` page, which takes over the SP4 Learn hub entry;
  - **functional callbacks**: behaviours defined in the GUI with generated handler bodies, and a canvas Run mode that never writes scene state. Functional callbacks need their own spec and a product plan amendment, because the plan specifies empty stubs.
- Divergence 11 is recorded. The manuscript describes the tools rail changing with the selected curriculum section, and the Pipeline section's canvas modes as section tools. The editor is now the same in every section, and the Pipeline views appear in Pipeline lessons.

## 13. Delivery

The work happens on `feat/editor-refinement`, branched from `main` after the visual identity merges (planned for Oct 15). It merges by Oct 28.

1. Inspector, Scene list and Add row, replacing the section column.
2. The focus map, auto-select and guidance fading in the lesson card.
3. The Learn drawer and lesson progress.
4. Math tabs, help and the empty state.
5. The layout fixes from section 9, the visual suite re-baseline and the product plan amendment.

Each step leaves the editor working and every check passing.

## 14. Out of scope

- Functional callbacks and the canvas Run mode (their own sub-project).
- The `/learn` page (its own spec, by Nov 2).
- New or rewritten lessons. Lesson narration and steps stay as they are.
- Changes to code generation. The generator does not read the section and does not change.
