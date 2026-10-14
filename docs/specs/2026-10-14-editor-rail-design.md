# Editor rail redesign — design

Date: 2026-10-14
Roadmap items: the editor rethink for first-time users, with 15 (first-visit tour, Could) and the two Run-mode issues most likely to show on stage, in [the overhaul roadmap](2026-10-04-website-overhaul-roadmap.md)
Deadline: merged before the Oct 28 editor freeze

## Purpose

A first-time user finds the editor hard to navigate. The left column is one long scroll that holds the scene list, Multi-Select, a create grid named by OpenGL constants, Create Text and four scene-settings groups, with Callbacks last and collapsed. "Take the tour" opens a long help article. Run is greyed out with its reason only in a tooltip. During a lesson the lesson card sits on top of the left column and pushes the controls below the fold.

This work reorganises the editor around a slim labelled rail on the left, one panel per job, a quiet lesson bar along the bottom of the canvas, and a single code-or-math pane on the right. A short do-it tour teaches the build, see and read loop on the first visit. The two Run issues most likely to show in the Nov 4 demo are fixed on the way.

The audience is both: a student on their own, and an expo visitor trying it for a minute. Success is that either one makes a shape, sees its code change and finds the lessons and Run without help.

Out of scope, each planned as its own project: lesson content (more, deeper and better lessons, including roadmap item 11), and share link with QR code (item 8). Also out: a draggable split in the right column, and remembering the layout between visits.

## Owner decisions (2026-10-13 and 2026-10-14)

| Question | Decision |
| --- | --- |
| Who the design is for | Students on their own and expo visitors, equally |
| How deep | A full layout redesign, delivered by the Oct 28 freeze |
| Layout direction | Keep three regions (build, canvas, code and math). Replace the long left column with a slim labelled rail, one panel open at a time |
| Rail look | Pill: the active icon sits in a soft cobalt pill, label bold; a divider sets Callbacks apart |
| Rail items | Add · Scene · Settings, divider, Callbacks; Hide at the bottom |
| Scene panel | Object list above, the selected object's inspector below |
| Add, Settings, Callbacks panels | As mocked (section 3) |
| Selecting an object | Always switches the rail to Scene |
| Opening panel | Add when the scene is empty, otherwise Scene |
| Lesson steps | Switch the rail to the step's panel and outline its group, as today's focus does |
| Hide | Temporary. Any rail click, selection or lesson step reopens the panel. Not remembered between visits |
| Lesson placement | A bar along the bottom of the canvas |
| Lesson bar look | "Reading line": narration is the loudest thing, Next is the only coloured control |
| Folded lesson bar | A slim strip with the title, the step and Next |
| Code and math | One pane with a Code / Math switch on every screen size, and a Hide for the whole column. No drag handle |
| Tour | A do-it tour: each step waits for the student to do the thing |
| Also in this project | The Running strip covering the program window, and the selection outline staying behind during Run |
| Lesson content | A separate project; lesson data may keep landing until Nov 2 |

## 1. Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ VAMS                                   Learn  File │ ↶ ↷  ☀  ⚙  ?        │  top bar (unchanged)
├──────┬────────────────┬───────────────────────────────┬──────────────────┤
│ Add  │                │                        ▶ Run  │ [Code│Math]  ⌕ ⧉ ⇥│
│ Scene│  open panel    │                               │                  │
│ Sett.│  (272 px)      │          canvas               │  generated C++   │
│ ──── │                │                               │  or the math     │
│ Callb│                ├───────────────────────────────┤  panel           │
│      │                │ lesson bar (only in a lesson) │                  │
│ Hide │                │                               │                  │
└──────┴────────────────┴───────────────────────────────┴──────────────────┘
  64px                                                    clamp(340, 28vw, 460)
```

- The rail is 64 px wide. The panel is 272 px, down from today's 300 px column, to pay for the rail.
- The code and math column becomes `clamp(340px, 28vw, 460px)`, down from `clamp(360px, 30vw, 480px)`.
- At 1280 px the canvas is about 586 px wide (596 today). At 1366 px it is about 648 px; at 1920 px about 1124 px. Hiding the panel gives the canvas 272 px more, and hiding the code column gives it the column's width.
- The top bar is unchanged.
- The `.editor` grid in `pages/editor/ui/editor-app.scss` gains a rail track: `64px var(--editor-panel-width) minmax(0, 1fr) var(--editor-code-width)`, where either variable becomes 0 when its region is hidden. The toaster's centring formula includes the rail.

## 2. The rail

### Items

| Item | Icon (lucide) | Opens | Badge |
| --- | --- | --- | --- |
| Add | `SquarePlus` | Add panel | none |
| Scene | `Layers` | Scene panel | none |
| Settings | `SlidersHorizontal` | Settings panel | none |
| *(divider)* | | | |
| Callbacks | `Zap` | Callbacks panel | the number of registered, valid callbacks (`isCallbackValid`), hidden at 0 |
| Hide / Show | `PanelLeftClose` / `PanelLeftOpen` | folds or unfolds the panel | |

### Look (pill)

- The rail background is `--paper`, with a 1 px `--rule` line on its right.
- Each item: a 52 × 30 px pill holding a 20 px icon, and an 11.5 px label below it.
- Active: the pill fills with `--accent-tint`, the icon takes `--accent-text`, and the label goes `font-weight: 600` in `--ink`.
- Hover: the pill fills with `--paper-sunken`. Keyboard focus: the standard `--focus-ring` outline around the item.
- The badge sits on the pill's top-right corner: `--accent` fill, white 10 px mono digits.
- Hide sits at the bottom. While the panel is hidden, no item is active, and Hide reads Show.
- New tokens go in `_tokens.scss` for both themes: `--rail-pill-hover` (maps to `--paper-sunken`) and `--rail-pill-active` (maps to `--accent-tint`).

### Semantics

- The rail is `role="tablist"` with `aria-orientation="vertical"` and `aria-label="Editor panels"`. Each item is a `role="tab"` controlling the panel, which is `role="tabpanel"`.
- Arrow Up and Down move between tabs and Home and End jump to the ends. Enter or Space activates. Hide is a separate button after the tablist.
- Clicking the active item does nothing. Clicking any item while the panel is hidden opens that panel.
- During Run the rail and panel are `inert`, as the column is today.

## 3. The panels

All four keep today's controls. What changes is where they sit and how they are introduced.

### Add

- Header "Add", with the hint "Pick a shape, then click the canvas to place its vertices. Enter finishes."
- Three groups of tiles, all ten primitives visible, no "More" menu:
  - **Points and lines:** Points, Lines, Line strip, Line loop (2 columns).
  - **Triangles:** Triangles, Triangle strip, Triangle fan (3 columns).
  - **Quads and polygons:** Quads, Quad strip, Polygon (3 columns).
- Each tile shows a small line drawing of what the primitive produces, the plain name, and the `GL_` name in mono below. Tooltips keep today's placement hints ("Click groups of 3 — each triple forms one triangle.").
- Picking a tile starts vertex placement exactly as today. While placing, the tile groups give way to today's placement controls (vertex count, Add Vertex, Remove Last, Cancel, Create Shape) inside the Add panel.
- **Text:** a label field and Add, as today's Create Text.
- **Or start from a sample:** the four prepared scenes (Triangle, Transforms, Primitives tour, Textured quad), loaded through the same `replaceScene` path as `/app?scene=`, which first backs the current scene up to My scenes.
- The empty canvas's "Add a shape" button opens the Add panel (replacing today's `cueAddRow` scroll cue).

### Scene

- Header "Scene" with the object count, and a small toolbar: Select several (today's Multi-Select mode, unchanged in behaviour), Group, Duplicate, Delete.
- The object list as today (show/hide, groups, children). The list is capped at about six rows and scrolls on its own beyond that.
- Below the list, the inspector for the selection: the object's groups in pipeline order (Vertices, Buffers, Transform, Appearance, Texture), each naming its OpenGL call, with today's open, outline and dim behaviour. The inspector scrolls on its own.
- With nothing selected, the inspector area shows "Select an object to edit it" and a link "Scene settings are in Settings".

### Settings

- Header "Settings", hint "These apply to the whole scene."
- The groups that were today's scene settings, minus Callbacks: Background (`glClearColor`), Viewing volume (`glOrtho`), Texture library (`glGenTextures`). Same controls as today. All three start open.

### Callbacks

- Header "Callbacks", hint "Functions GLUT calls when something happens. Switch one on and give it rules."
- Today's Callbacks group content, unchanged in behaviour: six callbacks in table order, each with its switch, handler name, GLUT call, rules and "+ Add rule"; Reshape's Keep proportions or Stretch.
- A footer: "Press Run on the canvas to try your callbacks. Esc stops."

## 4. Flow between panels

| Event | Rail |
| --- | --- |
| The editor opens | Add if the scene has no objects, otherwise Scene |
| An object becomes selected (canvas click, list click, a finished shape, a new text, a sample, undo or redo restoring a selection) | Scene, and the panel unhides |
| Selection is cleared | Stays where it is |
| A lesson step with a `focusPanel` | The step's panel (table below), and the panel unhides |
| The empty canvas's "Add a shape" | Add, and the panel unhides |
| The disabled Run's "Open Callbacks" link | Callbacks, and the panel unhides |
| Run starts | No change; the rail and panel go inert |

Lesson focus targets map onto the rail through `core/inspector/focus-map.ts`. A new pure function, `railPanelFor(place: FocusPlace): RailPanel | null`, does the mapping:

| `FocusPlace` | Rail panel |
| --- | --- |
| `scene / list` | Scene |
| `scene / add`, `scene / create-text` | Add |
| `object / *` | Scene |
| `settings / background`, `viewing-volume`, `texture-library` | Settings |
| `settings / callbacks` | Callbacks |
| `lesson-card` | none (the controls are in the lesson bar) |

`Callbacks` moves out of `SETTINGS_GROUPS`, since it is no longer an inspector group. Its focus id, `callbacks-panel`, maps to the Callbacks panel. `GROUP_SECTION` keeps its section for the math tab.

## 5. The lesson bar

`LessonCard` becomes `LessonBar`, mounted under the canvas inside the canvas area. It renders only in Lesson mode and runs the same lesson engine (`useLessonRunner`).

### Layout ("reading line")

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ← progress hairline (accent, width = step/steps)
Translate, Rotate, Scale · Step 2 of 5                         ⌄  ✕
Translate moves the shape in world space. Watch the X coordinate: the
triangle slides to the right, and in the generated code that becomes a
glTranslatef call.
[task line or quiz, when the step has one]
                                                    ‹ Back   [ Next › ]
```

- **Progress hairline:** 2 px, `--accent`, along the bar's top edge; its width is the fraction of steps reached. The bar's own border is a 1 px `--rule`.
- **Meta line:** 12 px. The lesson title in `--ink-muted` (600), "·", and "Step n of N" in `--ink-faint`. No DEMO or EXERCISE chip and no section label. The title stays focusable (`tabIndex=-1`) and takes focus when a lesson starts, as today.
- **Fold and Exit:** two 22 px icon buttons at the right of the meta line, in `--ink-faint`, rising to `--ink` on hover and focus. Exit keeps Esc. Their accessible names are "Fold lesson" and "Exit lesson (Esc)".
- **Narration:** 16 px, line height 1.6, `--ink`, `aria-live="polite"`. Code spans use the mono font in `--accent-text`.
- **Bottom line:** "‹ Back" as a quiet text button (`--ink-faint`, disabled on step 1), then Next as the only filled button. Next reads Finish on the last step. Arrow Left and Right keep their shortcuts.
- **Exercise task line:** shown when a step has `waitForUser`. A 7 px status dot and 12.5 px text. Waiting: an amber dot (`--warning`), and the step's `task` text, or "Waiting for you" when the step has none. Passed: a green dot (`--success`) and "Done", followed by the task text when there is one. No box around it.
- **Quizzes:** multiple-choice options in two columns as plain rows (a faint letter, the option in mono; correct turns green with a check, wrong shakes and stays clickable, as today). Ordered lists lay their chips out left to right with arrows between them and wrap to a second row; drag and arrow-key reordering stay.
- **Pipeline lessons:** the mode buttons (Diagram, Raster vs vector, Playground) sit under the narration, as a segmented control.
- The bar is only as tall as its content. At about 586 px wide, a three-line narration makes it about 150 px tall.

### Folded

- Fold collapses the bar to a 34 px strip: the progress hairline, the meta line ("Title · Step n of N"), an unfold icon, and Next (or Finish).
- Moving to another step unfolds the bar, so new narration is never missed.
- Folding is per lesson; starting a lesson always shows the bar unfolded.

### Removed from the card

The DEMO/EXERCISE chip, the section label, the segmented progress bar and its count, and the boxes around tasks and quiz options.

## 6. The code and math column

- **One pane, switched:** the column header holds a segmented switch, Code | Math, followed by Find and Copy (when Code shows) and Hide. The body shows the code panel or the math panel, never both. The switch starts on Code.
- **Math tab:** the math panel keeps its five section tabs, and `mathTabFor` keeps choosing the tab from the student's context, as today.
- **Code changed while Math shows:** a 6 px `--accent` dot appears on the Code segment when the generated code changes while Math is showing. It clears when Code is shown. The dot has the accessible text "Code changed".
- **Hide:** tucks the whole column away. A 30 px edge tab on the right, a vertical "Code & math" label with a `PanelRightOpen` icon, brings it back. Hiding is not remembered between visits.
- **Run:** the column stays visible and live during Run (the branch that fired flashes in Code), and the math panel stays inert, as today. If Math is showing when a handler fires, the Code dot appears.

### Lesson steps

| The step | The column |
| --- | --- |
| Has `pane: 'math'` | Shows Math, unhides |
| Has `pane: 'code'` | Shows Code, unhides |
| Has no `pane`, and its action highlights changed code lines | Shows Code, unhides |
| Otherwise | Unchanged |
| The lesson exits or finishes | The switch and Hide return to what the student had before the lesson started |

## 7. The first-visit tour

A new feature slice, `features/first-visit-tour`, with a pure step list and a small controller.

### Start and end

- The welcome dialog's "Take the tour" starts it, as does a "Start the tour" button in the Help Center's Workspace Tour topic.
- "Skip tour" on every step ends it. So do Esc (when no field, menu or dialog has focus), starting a lesson, and finishing the last step.
- The tour runs in Author mode, on the student's real scene; whatever they build stays. It is not saved; reloading ends it.
- Starting the tour while the panel or code column is hidden unhides it.

### Steps

| # | Callout anchored to | Text | Done when |
| --- | --- | --- | --- |
| 1 | Rail · Add | "Everything you build starts here. Open **Add**." | The Add panel is open |
| 2 | Add · Triangles tile | "Pick **Triangles**. Each group of three clicks makes one triangle." | Vertex placement starts with `TRIANGLES` |
| 3 | The canvas | "Click three points on the canvas, then press **Enter**." | A `TRIANGLES` object with at least 3 vertices exists and placement has ended |
| 4 | Scene · Transform · Translate X | "This is your triangle's inspector. Change **X** and watch the `glTranslatef` line in the code." | The new triangle's `translateX` differs from its value when the step began |
| 5 | Rail · Callbacks | "Callbacks make the program react. Open **Callbacks**, switch on **Idle** and add a rule." | The idle callback is valid and has at least one rule |
| 6 | Run | "Press **Run** to play your program, then press **Esc** to stop." | A run has started and then stopped |

- A callout is a small popover: 13 px text, "Step n of 6", and "Skip tour" (and "Finish" on step 6). It points at its anchor with an arrow and never covers the anchor. Anchors are `data-tour-anchor` attributes on the real controls.
- A step advances by itself when its check passes, with no Next button. Checks are pure functions over the store, the same shape as a lesson's `successCheck`.
- If an anchor is not on screen (for example the panel was hidden), the step's first action reopens what it needs.

## 8. Run fixes

- **The Running strip no longer covers the program window.** The program window starts below the strip: its top offset and its maximum height both account for the strip's height. The handle and the readout move with it. The initial window size GLUT reports to Reshape is the area below the strip.
- **The selection outline hides during Run.** The selection overlay and vertex handles are hidden while Run is on and redrawn when it stops.
- **Run off says why, on the canvas.** Under the disabled Run button, a small plate gives the reason, from the first that applies:
  - The scene is empty: "Add a shape to run your program."
  - No valid callback: "Run needs a callback." followed by an "Open Callbacks" link.
- While a Pipeline illustration replaces the canvas, the Run button and its plate are hidden. This also clears roadmap known issue 12.

## 9. Narrow screens

Below 1100 px, as today, the panel stops taking grid space: it opens as a drawer over the canvas, beside the rail, which always stays. A rail click opens or switches the drawer, the same item again closes it, and Esc closes it (today's rules for the Panels drawer carry over). Today's "Panels" button goes away. The code column is `clamp(320px, 34vw, 400px)` as today. The lesson bar spans the canvas.

## 10. State and architecture

### Store (runtime slice, not persisted)

```ts
export type RailPanel = 'add' | 'scene' | 'settings' | 'callbacks';
export type CodePane = 'code' | 'math';

railPanel: RailPanel;
railHidden: boolean;
codePane: CodePane;
codeHidden: boolean;
codeChangedUnseen: boolean;
/** The student's switch and Hide from before the current lesson, restored when it ends. */
codeViewBeforeLesson: { pane: CodePane; hidden: boolean } | null;

setRailPanel(panel: RailPanel): void;   // also unhides
setRailHidden(hidden: boolean): void;
setCodePane(pane: CodePane): void;      // clears codeChangedUnseen when 'code'
setCodeHidden(hidden: boolean): void;
```

- None of this is persisted, so the persisted `version` stays at 9 and no migration is needed.
- `railPanel`'s initial value is decided when the store rehydrates: Add for an empty scene, otherwise Scene.
- Selection switching to Scene happens in the store's selection actions (`selectObject` and the multi-select variants), so canvas, list and lesson actions all follow one rule.
- `addRowCue` and `cueAddRow` are replaced by `setRailPanel('add')`.
- The tour's state lives in its own slice: `tourStep: number | null`, with `startTour`, `endTour` and an internal advance.

### Components

| Where | What |
| --- | --- |
| `widgets/layout/rail/` (new) | `Rail`: the tablist, badge and Hide |
| `widgets/layout/editor-column/` | Becomes the panel host: `AddPanel`, `ScenePanel` (list and inspector), `SettingsPanel`, `CallbacksPanel` wrapper. `SceneArea` and the settings part of `Inspector` are split across them |
| `features/custom-shapes/` | The primitive tiles and their drawings, replacing the palette grid and More menu |
| `features/lesson-engine/ui/LessonBar.tsx` | Replaces `LessonCard.tsx`; the exercise widgets get the quieter styles |
| `widgets/layout/code-math-column/` | The Code / Math switch, the change dot, Hide and the edge tab |
| `features/first-visit-tour/` (new) | Steps, checks, controller and the callout |
| `features/callbacks/ui/RunOverlay.tsx`, `model/run-controller.ts` | The strip offset and the reason plate |
| `shared/engine/pixi/` | Hides the selection overlay while Run is on |
| `pages/editor/ui/EditorShell.tsx`, `editor-app.scss` | The four-track grid, narrow drawer beside the rail, lesson bar under the canvas |

The layering stays within FSD: the rail and panels are widgets composing features; the tour is a feature that reads the store and anchors by DOM attribute, so it imports no widget.

## 11. Lesson data

Two optional fields join `LessonStep` in `core/types/lesson.ts`:

```ts
/** What an exercise step is waiting for, shown in the lesson bar's task line. */
task?: string;
/** Which side of the code column the step is about. Without it, a step that highlights code shows Code. */
pane?: 'code' | 'math';
```

This project adds the fields and their behaviour only. Writing `task` text for the exercise steps and setting `pane` on the steps that discuss the math panel belongs to the lesson content project, which may land until Nov 2. Every lesson keeps working without them.

`focusPanel` ids stay as they are, so no lesson data changes in this project.

## 12. Help and copy

- **Welcome dialog:** Build is "the rail on the left: Add, Scene, Settings and Callbacks"; See is the canvas; Read is "Code and Math on the right". "Take the tour" starts the do-it tour.
- **Help Center:** the Workspace Tour topic is rewritten for the rail, the panels, the lesson bar and the Code / Math switch, and gains "Start the tour". Topics that name the old places are updated: the scene list and grouping ("Multi-Select" is now "Select several" in the Scene toolbar), the Add row, the Callbacks group ("in scene settings" becomes "the Callbacks panel"), and the lesson card (now the lesson bar).
- All new copy follows the product rules: it describes what VAMS does and avoids the banned words.

## 13. Product plan amendment

The Workspace Layout section of `docs/product-plan.md` is rewritten to describe: the top bar; the rail with Add, Scene, Settings and Callbacks; the open panel; the canvas with Run and the lesson bar; and the code column with its Code / Math switch. The lesson card paragraph and the other "lesson card" references (narration, Pipeline view toggle) become the lesson bar, The amendment is approved by this design.

## 14. Manuscript divergences

Entries 10 and 11 in the roadmap's divergence list are updated: the lesson card becomes a bar under the canvas; the left column becomes a rail of four panels; the code and math column shows one at a time. No new entry is needed; both already record that the layout differs from §3.4.2 and the tools rail.

## 15. Tests

New black-box tests, in the existing suites with the next free IDs:

- **Rail:** four tabs in order with the divider; Arrow and Home/End keyboard movement; the badge counts valid callbacks and hides at 0; Hide and Show; inert during Run.
- **Flow:** the opening panel for empty and non-empty scenes; every selection path switches to Scene and unhides; clearing selection keeps the panel; "Add a shape" opens Add; the Run plate's link opens Callbacks.
- **Focus mapping:** `railPanelFor` for every `FocusPlace`; a lesson step switches and unhides the panel.
- **Panels:** Add shows all ten primitives in three groups and starts placement; a sample backs up and replaces the scene; Settings holds the three groups and no Callbacks; the Scene panel's empty-selection state.
- **Lesson bar:** meta line, hairline width, Next/Finish, Back disabled on step 1; the task line falls back to "Waiting for you" and shows `task` when present; fold, unfold on step change; Exit and arrow shortcuts; quiz widgets still pass and fail as before.
- **Code column:** the switch, the change dot appearing and clearing, Hide and the edge tab; `pane` and code-highlight steps switching panes; the student's choice restored when a lesson ends.
- **Tour:** each step's check passes and fails correctly; Skip, Esc and starting a lesson end it; anchors exist for every step.
- **Run fixes:** the program window starts below the strip and reports the reduced height to Reshape; the selection overlay is hidden during Run and back after; the reason plate's two messages; Run hidden over an illustration.

Existing tests that assert the old structure (group titles, the settings list including Callbacks, `cueAddRow`, the lesson card's DOM, the Panels button) are updated to the new structure; their IDs stay.

Visual tests: the editor and lesson baselines are retaken after the redesign, and new captures cover the four panels, the lesson bar (demo, exercise waiting, quiz, folded), the Math pane, both hidden states and a tour step, in both themes at 1280 px.

## 16. Docs

- The product plan amendment (section 13).
- The roadmap: a new Should entry for this redesign with its status, item 15 marked complete with it, known issue 12 and the Running-strip issue (callbacks issue 1) and outline issue (callbacks issue 2) marked fixed, and the divergence entries updated (section 14).
- `tests/README.md` test count.

## 17. Delivery

- Branch `feat/editor-rail`, merged to `main` by Oct 28 with lint, build and tests green.
- Build order, so a partial result is never shipped:
  1. Store state, `railPanelFor`, and the rail with the four panels holding today's controls.
  2. The Add panel's tiles, the Scene panel's toolbar and list cap, and the narrow drawer.
  3. The lesson bar.
  4. The code column switch.
  5. The Run fixes.
  6. The tour.
  7. Help, welcome copy, the product plan and the roadmap.
- Share link and QR follow on their own branch after this merges. Lesson content follows as its own project.
