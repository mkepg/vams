# Editor layout redesign (SP5) — design

Date: 2026-10-06
Roadmap item: 4 (Must), due by the editor freeze on **2026-10-28**
Branch: `feat/editor-redesign`

## 1. Purpose

The editor at `/app` is where the CS Expo demo happens and where students spend their time. Today it has three problems:

- **The canvas is squeezed.** The left rail is 22.5rem and the right column 35rem, with no breakpoints. At 1280 CSS px of width the canvas is about 360 px wide, the narrowest region on screen, though it is what the audience watches.
- **There is no shared control set.** Each of the 14 panels styles its own buttons, fields, swatches and toggles. There are about 40 one-off control classes in roughly 6,500 lines of panel styles, and only two panels use the shared `NumberInput`.
- **Lessons are a strip bolted onto the bottom.** The narration sits in a bar at the bottom of the screen, far from the panel it tells the student to use.

SP5 rebuilds the editor shell and every control on one shared, accessible control set. The changes move, pin, collapse and compact panels. No panel is renamed (one ruling below), split or merged, and no editor behaviour beyond the controls themselves changes. The deeper panel rethink (one inspector, an add-shape toolbar) stays with SP6, after the expo.

Research notes behind these decisions are kept locally, outside the repository. The key findings:

- **Comparable tools give the canvas most of the width at 1280 px.** The three.js editor uses a 350 px sidebar beside a 932 px viewport; Desmos uses a 416 px list beside the graph.
- **Pictures beside the text that explains them help learning,** and the effect is strongest when the two update together.
- **Scrubbing a number needs a non-drag alternative.** WCAG 2.5.7 Dragging Movements requires one.

## 2. Decisions

| Topic | Decision |
| --- | --- |
| Scope | "B+": a shared control set with better interaction, plus a regrouped layout. Every panel keeps its id, its name and its controls |
| Density | Student-first. The editor works fully at **1280 × 720 CSS px** and, without clipping, at **960 CSS px** wide (WCAG 1.4.4 at 200% on a 1920 screen). The presenter picks a browser zoom at rehearsal. There is no extra display mode |
| Structure | Top bar, then three columns: section column, canvas, code over math. No bottom lesson bar |
| Section switch | The section's name is the column's title. Clicking it opens a menu of the five sections. Adding a sixth section later only adds a menu item |
| Lessons | In Lesson mode the section column becomes the lesson. The narration sits at the top, and the panel the step names is open directly underneath |
| GL hints | Every control group that drives one OpenGL 1.x call shows that call, in the exact form the code generator emits |
| Extras | Fix the old editor bugs, one focus trap for every dialog, texture-only scenes count as work in confirms, screenshot regression checks |

## 3. Layout

### 3.1 Grid

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ VAMS                                   Lessons ▾  File ▾ │ ↶ ↷  ◐  ⚙  ?      │ 44 px
├────────────────────┬──────────────────────────────┬──────────────────────────┤
│ SECTION            │                              │ C++ · OpenGL 1.5   Copy  │
│ Transforms ▾       │                              │ …generated code…         │
│ Translate, rotate… │           CANVAS             │                          │
├────────────────────┤      (square GL view)        ├──────────────────────────┤
│ SCENE HIERARCHY    │                              │ MATH & DATA              │
│ …                  │                              │ …                        │
│ ▾ OBJECT TRANSFORM │                              │                          │
│ ▸ ANIMATION        │                              │                          │
│ ▸ VIEWING VOLUME   │                              │                          │
└────────────────────┴──────────────────────────────┴──────────────────────────┘
   300 px              1fr (≈580 px at 1280)           clamp(360px, 30vw, 480px)
```

- **The editor root** is a CSS grid: `grid-template-rows: 44px minmax(0, 1fr)` and `grid-template-columns: 300px minmax(0, 1fr) clamp(360px, 30vw, 480px)`. It fills the viewport (`100dvh`). The page never scrolls; each column scrolls on its own.
- **The section column** is 300 px. It scrolls vertically, and its title or lesson card stays at the top (sticky).
- **The canvas** takes the remaining width. The existing canvas sizing logic keeps working, because the canvas reads its container size.
- **The code and math column** puts code above math, at a fixed 58% / 42% split. Each part scrolls on its own, and long code lines scroll sideways inside the code panel.
- **Toasts** move to `bottom-center`, over the canvas, so they never cover the section column or the math panel.

### 3.2 Narrow screens

Below **1100 CSS px** of viewport width (`@media (max-width: 1099.98px)`):

- The section column leaves the grid, which becomes `minmax(0, 1fr) clamp(320px, 34vw, 400px)`. The column turns into a **drawer**: 300 px wide, sliding over the canvas from its left edge, with a shadow, and above the canvas overlays.
- A **"Panels" button**, a secondary button with an icon and the label "Panels", sits in the canvas's top-left corner and toggles the drawer. It carries `aria-expanded` and `aria-controls`.
- **In Lesson mode the drawer opens by default** whenever a lesson starts or the step changes, because the lesson lives in it.
- **Esc closes the drawer** and returns focus to the Panels button. The drawer is not modal, so the canvas stays usable beside it.
- **At widths of 1100 px and above,** the drawer state is ignored and the column is always shown.
- **The section column is mounted exactly once,** in the grid or in the drawer. Only CSS differs, so the lesson runner in §5 never mounts twice.

### 3.3 Top bar

From left to right:

1. **The logo**, linking to `/`: the full logo, as today.
2. A flexible spacer.
3. **The Lessons ▾ menu button.** It lists the current section's demos and exercises under two group labels, and is hidden in Lesson mode. This is today's `LessonLauncher`, rebuilt on the shared menu.
4. **The File ▾ menu button**, with these items in order:
   - New workspace
   - My scenes…
   - (separator)
   - Open project file…
   - Save project file
   - (separator)
   - Export C++ code
   - Export scene JSON

   Each item runs the action that today's icon button runs, including the backup-before-replace behaviour from SP3.
5. A separator.
6. **The Undo and Redo icon buttons.**
7. **The Theme icon button.**
8. **The Settings menu button**, an icon button holding today's view-settings menu:
   - Coordinate axes
   - Gridlines
   - Coordinate tracker
   - (separator)
   - Keyboard shortcuts

   The three toggles are `menuitemcheckbox` items.
9. **The Help icon button.**

The section switch is not in the top bar (see §3.4).

### 3.4 Section column in Author mode

From top to bottom:

1. **The section header (sticky).**
   - A small mono label, "SECTION".
   - The section name in Newsreader at about 23 px, followed by a chevron.
   - The section's one-line description, from today's `SECTION_TABS` descriptions with the "Name — " prefix removed.

   The name and chevron form a **menu button**. Its menu lists all five sections as `menuitemradio` items, each with an icon, the name and the description; the active section is checked. Choosing one calls `setActiveSection`. The menu is the **only** section switch in the editor.
2. **The pinned Scene Hierarchy.** The Scene Hierarchy panel is rendered once, directly under the header, in every section except Pipeline. Today Pipeline shows it below Viewport Mode, and that position stays.
3. **The section's panels,** in today's order from `LeftSidebar`, without the repeated Scene Hierarchy.

Section labels stay exactly `Pipeline | Primitives | Buffers | Transforms | Textures`.

### 3.5 Section column in Lesson mode

The section header is replaced by the **lesson card** (§5). There is no section switch in Lesson mode. To change section, the student exits the lesson first, through Exit, Esc or Finish, so the "Leave current lesson?" confirm is no longer needed and is removed.

Below the card:

1. **"Use this panel".** If the step has a `focusPanel` and that panel is in the current section's list, a small orange mono label "↓ USE THIS PANEL" appears, with the focused panel right under it, open and outlined in orange.
2. **Every other panel of the section,** collapsed, with Scene Hierarchy among them. The student can still open any of them.

If the step has no `focusPanel`, the card is followed by the section's panels, all collapsed.

### 3.6 Canvas column

The overlays are restyled to the vellum language: mono 11 px labels on a dark translucent plate with a 1 px rule. They keep their current positions:

- the viewport chip, top-left;
- the coordinate tracker, bottom-left;
- the vertex-placement banner, top-centre;
- the empty-canvas hint, centred;
- the animation code overlay;
- the Pipeline diagram and raster/vector views.

They show the same text as today. Below 1100 px the Panels button occupies the top-left corner, and the viewport chip moves to sit after it.

## 4. Shared control set

Location: `src/shared/ui/controls/`. Each control has its own file plus one `controls.scss`, and the folder has an `index.ts` barrel. Tokens are added to `_tokens.scss` for both themes.

### 4.1 Tokens

Add these to `:root` and `[data-theme='blueprint']`:

| Token | Vellum | Blueprint | Use |
| --- | --- | --- | --- |
| `--control-h` | `28px` | same | field and button height |
| `--control-h-lg` | `32px` | same | primary actions, lesson buttons |
| `--field-bg` | `#ffffff` | `#0a2140` | inputs |
| `--field-line` | `#7a8296` | `#6f8bb5` | field and control borders, at least 3:1 against `--field-bg` and the panel |
| `--hairline` | `rgba(29,43,79,.10)` | `rgba(186,214,255,.10)` | dividers inside panels (fainter than `--rule`) |
| `--live` | `var(--accent)` | `var(--accent)` | scrubbing, focused panel, selected row |
| `--live-tint` | `rgba(255,90,31,.10)` | `rgba(255,106,43,.14)` | selected-row and hover tints |
| `--gl-hint` | `var(--gl-fn)` | `var(--gl-fn)` | GL function names in hints |

Orange (`--live`, `--accent`, `--focus-ring`) is reserved for focus, scrubbing, the selected row, the lesson focus and the primary button. Everything else is ink.

### 4.2 Components

Every control renders a visible label, or, for icon-only buttons, both an `aria-label` and a `title`. Every interactive target is at least 24 × 24 px (WCAG 2.5.8). Focus is shown with a 2 px `--focus-ring` outline offset by 2 px.

| Component | Element and pattern | Behaviour |
| --- | --- | --- |
| `Button` | `<button>`. Variants `primary`, `secondary` (default), `quiet` and `danger`; sizes `md` (28 px) and `lg` (32 px); optional `icon` | `iconOnly` requires `label`, which renders as `aria-label` and `title` |
| `NumberField` | `<input type="text" inputmode="decimal" role="spinbutton">` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` and `aria-label`. A label button on the left (the axis letter or a short name) is the scrub handle | See §4.3 |
| `SliderField` | A label, a native `<input type="range">`, and a `NumberField` beside it, sharing one value. Min and max are printed under the track ends | Both commit through the same `onChange` and `onCommit` |
| `ColorField` | A swatch, which is a native `<input type="color">` styled as a 42 × 28 px swatch with an `aria-label`; a hex text field; a read-only GL readout; and a row of recent colours | See §4.4 |
| `Switch` | `<button role="switch" aria-checked>` with a visible text label | Space and Enter toggle it |
| `SegmentedControl` | `role="radiogroup"` containing `role="radio"` buttons with a roving `tabindex` | Arrow keys move the selection, Home and End jump to the first and last option. Option labels may be GL constant names in mono (`GL_NEAREST`) |
| `TextField` | `<label>` plus `<input type="text">` | Enter commits, Esc reverts |
| `GlHint` | `<p class="gl-hint">` with `<code>`. The function name is coloured `--gl-hint`, and the arguments are `--ink-faint` | Purely visual: `aria-hidden="true"`, because the code panel already carries the same text for assistive technology |
| `Panel` | Replaces `CollapsibleSection`, which stays as a re-export so that features change one import at a time. The header is a `<button aria-expanded aria-controls>` with a chevron, an icon, a mono uppercase title and an optional right-aligned `hint`, a mono GL call such as `glLineStipple` | See §4.5 |
| `DataTable` | `<table>` with `<th scope="col">`. Editable cells hold a compact `NumberField` (with the label button hidden and `aria-label` set to "Vertex 1 X" and so on) | Tab and Shift+Tab move through the cell fields. The row being edited gets `--live-tint` |
| `Dialog` | `role="dialog"`, or `role="alertdialog"` for confirms, with `aria-modal="true"` and `aria-labelledby` | See §4.6 |
| `MenuButton` + `Menu` | The APG menu button pattern: a button with `aria-haspopup="menu"` and `aria-expanded`, and a `role="menu"` list of `menuitem`, `menuitemradio` or `menuitemcheckbox` items plus `separator`s and group labels | Opening the menu focuses the first item, or the checked one. ↑ and ↓ move with wrap-around; Home and End jump; Enter and Space activate; Esc closes and returns focus to the button; Tab closes; a click outside closes. Typing a letter jumps to the next item that starts with it |

### 4.3 NumberField behaviour

**Props:**
- `value: number`, `onChange(v)` (live) and `onCommit?()`;
- `min`, `max`, `step` (default 0.01), `bigStep` (default `step × 10`), `fineStep` (default `step ÷ 10`);
- `precision` (default 2), `unit?` and `label`, `axis?: 'x' | 'y'` (colours the label red or green, as the canvas axes are);
- `scrubPixelsPerStep` (default 4).

**Typing.**
- Clicking the field or tabbing into it selects its text.
- Enter or blur parses the value. Comma decimals are accepted.
- An empty or non-numeric entry shows "Enter a number" under the field (an `aria-describedby` live region) and reverts on blur. It never writes NaN.
- A value outside the range is clamped to `[min, max]`.
- Esc restores the value from before editing.

**Keys.** ↑ and ↓ step the value; with Shift they move by `bigStep`, and with Alt by `fineStep`. Page Up and Page Down move by `bigStep`. Home and End jump to min and max when both are defined.

**Scrubbing.**
- Pressing the pointer on the label button and moving horizontally changes the value by `step` for every `scrubPixelsPerStep` pixels. Shift multiplies the step by 10 and Alt divides it by 10.
- The pointer is captured (`setPointerCapture`).
- While scrubbing, the label fills with `--live` and `document.body` gets `cursor: ew-resize`.
- Esc during a scrub restores the value from the start of the drag and ends it.
- A press and release without movement (under 3 px) focuses the input for typing. That is the non-drag alternative WCAG 2.5.7 asks for.

**History.**
- The field calls `onScrubStart()` once at the start of a drag and `onCommit()` once at the end, so the panel can call `pushToHistory()` at the start and get **one undo step per drag**.
- Typing and key steps call `onCommit()` after each committed change.
- Panels that previously called `pushToHistory()` before each change keep doing so through these hooks.

**Precision.** The displayed value is `value.toFixed(precision)`. While the user is typing, the text they typed is kept.

### 4.4 ColorField behaviour

- **Value:** a hex string, `#rrggbb`. The swatch is a native colour input, and the hex field accepts 3- or 6-digit hex with or without a leading `#`. Invalid hex shows "Enter a hex color like #B91C1C" and reverts.
- **GL readout:** `glColor3f(r, g, b)`, each value rounded to 2 decimals. When the object's emission mode is `glColor3ub` (from the Appearance panel), the readout is `glColor3ub(r, g, b)` with integers 0–255.
  - The background colour field uses `glClearColor(r, g, b, 1.0)`.
  - The field takes a `glCall: 'glColor3f' | 'glColor3ub' | 'glClearColor'` prop.
- **Recent colours:**
  - Up to 8 colours, most recent first, shared by every colour field and kept in memory for the session only (not persisted).
  - Clicking a recent swatch applies it.
  - Recent swatches are buttons labelled with their hex value.
- **History:**
  - The native input fires `onChange` as the user drags inside the picker, and `onCommit()` when it closes.
  - The panel pushes history on the first change of a picking session, as `ObjectAppearancePanel` does today with `startBatch`/`endBatch`.

### 4.5 Panel behaviour and lesson focus

- **Default open state.** `Panel` keeps the `defaultOpen` and `panelId` props.
- **Lesson state from context.** A `PanelLayoutContext` (in `shared/ui/controls/panel-context.ts`) supplies `{ mode: 'author' | 'lesson', focusPanelId: string | null }`.
  - In `'author'` mode a panel starts at `defaultOpen`.
  - In `'lesson'` mode a panel starts collapsed, unless its `panelId === focusPanelId`. Then it opens, gets the `is-lesson-focus` outline, and scrolls into view in its column. The scroll container is the nearest `[data-scroll-root]` ancestor, replacing today's hard-coded `.sidebar-content`.
- **Outside a provider**, for example in tests, the defaults are `'author'` and `null`.
- **Lesson focus comes from context only.** The `lessonFocusPanel` store field stays the source of truth, and the section column passes it into the context. The panel no longer reads the store.

### 4.6 Dialog behaviour

`Dialog` props: `open`, `onClose`, `labelledBy`, `role?: 'dialog' | 'alertdialog'`, `initialFocusRef?`, `size?: 'sm' | 'md' | 'lg'` (420, 560 and 760 px max width), `className?` and `children`.

- **Rendering.** It renders a scrim (`rgba(var(--shadow-rgb), .45)`) and a panel, with `--paper` background, a `--rule` border, a 6 px radius and a shadow.
- **Opening.** On open it remembers `document.activeElement` and focuses `initialFocusRef`, or else the first focusable element, or else the dialog itself (`tabIndex={-1}`).
- **The focus trap.** Tab and Shift+Tab cycle through the dialog's focusable elements, recomputed on every keypress: `a[href]`, `button:not([disabled])`, `input:not([disabled])`, `select`, `textarea` and `[tabindex]:not([tabindex="-1"])` that are visible.
- **Closing.**
  - Esc calls `onClose`, and stops propagation so the lesson's global Esc doesn't also fire.
  - Pressing the pointer on the scrim calls `onClose`.
  - On close, focus returns to the remembered element if it is still in the document.
- **Callers keep their test hooks.** The existing dialogs keep their own content and class names, such as `my-scenes__*` and `confirm-*`, inside `Dialog`. Their tests keep working.

The dialogs moved onto `Dialog`:
- `ConfirmDialog` (as `alertdialog`; Enter confirms, as today);
- `MyScenesDialog`;
- `WelcomeCard`;
- `HelpCenter`;
- the recovery screen is **not** a dialog and stays as it is.

### 4.7 GL hints

Hints name the call exactly as the code generator emits it, with parameter names in place of values:

| Panel | Group or control | Hint |
| --- | --- | --- |
| Object Transform | Translate row | `glTranslatef(x, y, 0.0f)` |
| Object Transform | Rotate row and dial | `glRotatef(angle, 0.0f, 0.0f, 1.0f)` |
| Object Transform | Scale row and pad | `glScalef(sx, sy, 1.0f)` |
| Viewing Volume | header | `glOrtho` |
| Viewing Volume | bounds group | `glOrtho(left, right, bottom, top, -1.0, 1.0)` |
| Appearance: Scene Color | background | readout `glClearColor(r, g, b, 1.0)` |
| Appearance: Color & Shading | emission toggle | segmented options `glColor3f` / `glColor3ub` |
| Appearance: Color & Shading | fill and vertex colours | readout `glColor3f(…)` or `glColor3ub(…)` (§4.4) |
| Line Style | header | `glLineStipple` |
| Line Style | width | `glLineWidth(width)` |
| Line Style | stipple switch | `glEnable(GL_LINE_STIPPLE)` |
| Line Style | pattern and factor | `glLineStipple(factor, pattern)` |
| Create Primitive | primitive buttons | the button labels already are the GL constants (`GL_TRIANGLES`, …) |
| Create Primitive | vertex rows | `glVertex2f(x, y)` |
| Buffers | storage choice | `glVertexPointer` / `glBufferData` (per option) |
| Buffers | usage hint | `glBufferData(…, usage)` |
| Apply Texture | header | `glBindTexture` |
| Apply Texture | filter | `glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, filter)` |
| Apply Texture | wrap | `glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, wrap)` |
| UV Editor | header and table | `glTexCoord2f(u, v)` |
| Callbacks | each handler row | its GLUT registration: `glutKeyboardFunc(handler)`, `glutMouseFunc(handler)`, `glutReshapeFunc(handler)`, `glutMotionFunc(handler)`; the idle row `glutIdleFunc(handler)` |
| Animation | header | `glutIdleFunc` |

Rules for hints:
- **Hints never include deferred symbols** (product plan Appendix C).
- **No hint for controls without a single call behind them:** Multi-select, Group, rename, delete, texture upload.
- **Implementers check each hint against the generator's output** (`features/code-generation/model`). Where the generator's wording differs from this table, the generator wins and the table is updated in this spec.

## 5. Lesson column

### 5.1 Runner hook

The step engine moves out of `LessonBar.tsx` into `features/lesson-engine/model/useLessonRunner.ts`. It carries over unchanged:
- shuffling;
- the step-execution and code-diff effect;
- the success check;
- the quiz answer state;
- Next, Back and Exit;
- the global ← / → / Esc keys.

It returns:

```ts
{
  lesson, step, stepIndex, stepCount, isLastStep, canAdvance,
  mcAnswer, setMcAnswer, orderAnswer, setOrderAnswer,
  next, back, exit,
}
```

`lesson` and `step` are `null` when there's no active lesson. The hook is called **once**, by `LessonCard`. `LessonBar.tsx` and `lesson-bar.scss` are deleted.

### 5.2 LessonCard

Location: `features/lesson-engine/ui/LessonCard.tsx`. It is a sticky block at the top of the section column, and contains, in order:

1. **A header row:**
   - a type chip, `DEMO` or `EXERCISE`, mono, in `--accent-text` with a 1 px border;
   - the section name in faint mono;
   - an Exit quiet button on the right, labelled "Exit" with an X icon, `title="Exit lesson (Esc)"`.
2. **The lesson title** in Newsreader at 19 px.
3. **Progress:** one segment per step, done in solid orange and current at 45% orange, then "n / N" in mono. It is exposed as `role="progressbar"` with `aria-valuenow`, `aria-valuemin=1`, `aria-valuemax=N` and `aria-label="Lesson progress"`.
4. **The narration** at 15 px with 1.45 line height, in a `aria-live="polite"` region keyed by step.
5. **The quiz widget,** when the step has `exercise`: the existing `MultipleChoiceWidget` or `OrderListWidget`, restyled for a 300 px column. Options are stacked one per line, at least 34 px tall, and the visual artifact is at most 160 px wide and centred.
6. **The navigation row:**
   - "Waiting for you" (a faint label with a pulsing dot that stops under `prefers-reduced-motion`), shown when `step.waitForUser && !canAdvance`;
   - Back (secondary, disabled on the first step);
   - Next (primary), which reads "Finish" on the last step and is disabled until `canAdvance`.

   Their titles keep today's keyboard hints: "Previous step (←)", "Next step (→)" and "Finish lesson".

### 5.3 Panel focus

- **Focus panel on top.** The section column renders the section's panel list. In Lesson mode, the panel whose `panelId` equals `lessonFocusPanel` is rendered first, after the "↓ USE THIS PANEL" label. The others follow in their usual order.
- **Wrapping.** Panels are wrapped in a `PanelLayoutContext` provider with `mode: 'lesson'`.
- **Pinned panels follow the same rule.** Scene Hierarchy is part of the reordered list in Lesson mode, not pinned.
- **Panel ids.** Two lesson `focusPanel` ids have never matched a panel, so the fix is to add the ids:
  - `ObjectTransformPanel` gets `panelId="object-transform"`;
  - `TextNodePanel` gets `panelId="text-node-panel"`.
- **Ruling: one title changes.** `ObjectTransformPanel`'s title changes from "Position, Rotation, & Scale" to **"Object Transform"**, the name the lesson narration already uses ("Use the Translate row in the Object Transform panel"). No other title changes.
- **The Translate row label stays "Translate".**

### 5.4 Narration

The lesson narration that names screen positions stays true in this layout, so no lesson text changes:
- "math panel on the right" (×2);
- "Math Panel below the code".

## 6. Bugs and extras folded in

1. **Undo and Redo never re-enable.** `HistoryControls` subscribes to `state.past.length > 0` and `state.future.length > 0` as values, not to the `canUndo` and `canRedo` functions. The inline `opacity` styles go; the `Button` disabled style handles it.
2. **The number-input focus crash.** `shared/ui/number-input/NumberInput.tsx` is deleted once its two users move to `NumberField`. `NumberField` selects text through its own ref, never through `e.currentTarget` inside a timeout.
3. **Unlabelled inputs.** Every transform and ortho input gets an accessible name through `NumberField` (for example "Translate X").
4. **Scene tree list structure.** `SceneHierarchyPanel` renders a proper `<ul role="tree">`, with `<li role="treeitem" aria-level aria-selected aria-expanded>`. A group's children sit in a nested `<ul role="group">`. Keyboard focus moves between rows with ↑ and ↓; Enter selects; F2 renames, as the existing rename does.
5. **The icon-only add-text button.** It gets the label "Add text".
6. **Texture-only scenes count as work.**
   - `isSceneEmpty` moves from `features/scene-library/model/scene-ops.ts` to `entities/project/model/scene-empty.ts`, and scene-library re-exports it.
   - The New workspace and Open project file confirms use it, so a scene with only uploaded textures asks before it's cleared or replaced.
7. **The shared focus trap.** All four dialogs use `Dialog` (§4.6).

## 7. Screenshot regression checks

- **Tooling.** `@playwright/test` is added as a devDependency. It uses the installed Chrome (`channel: 'chrome'`), so no browser download is needed.
- **Config.** `playwright.config.ts` sits at the repository root:
  - `testDir: 'tests/visual'`;
  - `snapshotPathTemplate: '{testDir}/baseline.local/{arg}{ext}'`;
  - `outputDir: 'tests/visual/results.local'`;
  - reporter `list`;
  - `webServer`: `npm run build && npx vite preview --port 4319 --strictPort`, with `reuseExistingServer: false`;
  - `use: { baseURL: 'http://localhost:4319', viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce', colorScheme: 'light' }`;
  - `expect.toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' }`.
- **Baselines stay out of git.** Rendering differs per machine, so they are per-machine files. The existing `*.local` ignore pattern already covers both directories, so `.gitignore` doesn't change.
- **Script:** `"test:visual": "playwright test"`. It isn't part of `npm test` or CI.
- **Test file.** `tests/visual/editor.spec.ts`, IDs `VIS-EDITOR-01` onwards. Each check opens a state in a fresh context, with `localStorage` seeded for the theme and the welcome card marked as seen. It waits for fonts (`document.fonts.ready`) and for two animation frames, then takes a screenshot:
  1. `/app?scene=transforms` in vellum and in blueprint, at 1280 × 720.
  2. `/app?scene=primitives` at 1280 × 720 (Primitives section).
  3. `/app?scene=textured-quad` at 1280 × 720 (Textures section).
  4. `/app?lesson=transforms-exercise-1`, in vellum and in blueprint.
  5. `/app?lesson=pipeline-exercise-2`, at a quiz step. The test clicks Next once to reach step 2.
  6. `/app?scene=transforms` at 960 × 720: drawer closed, then drawer open.
  7. The File menu open, the section menu open, and the My scenes dialog open.
- **Usage.** Baselines are created with `npx playwright test --update-snapshots` once SP5 is merged. The check then runs before each later editor change, and before the Nov 3 rehearsal.

## 8. Tests

New Vitest suites follow `{SUITE}-{MODULE}-{NN}`. Existing IDs stay stable.

- **`tests/black-box/controls.test.ts`** (BB-CTRL-01…):
  - NumberField typing, clamping, invalid entry, Esc, and keys (with Shift and Alt);
  - scrubbing via pointer events (the step per pixel, Esc restoring the value, a click focusing the input);
  - scrub history (one `onScrubStart` and one `onCommit` per drag);
  - Switch and SegmentedControl keyboard behaviour;
  - ColorField hex parsing, the GL readout (`3f` and `3ub`) and recent colours;
  - GlHint markup.
- **`tests/black-box/editor-shell.test.ts`** (BB-SHELL-01…):
  - Menu keyboard behaviour (open, arrows with wrap, Home and End, Esc returning focus, typeahead);
  - Dialog focus trap and focus return;
  - the section menu calling `setActiveSection` and being absent in Lesson mode;
  - the File menu items calling their actions;
  - Undo and Redo enabling after an edit;
  - texture-only scenes making New workspace ask first.
- **`tests/black-box/lesson-column.test.ts`** (BB-LCOL-01…):
  - the runner hook through `LessonCard` (Next disabled until success, Finish on the last step, Esc exiting);
  - the focus panel rendered first and open, with the others collapsed;
  - the `object-transform` and `text-node-panel` ids resolving to panels;
  - the progressbar values.
- **Existing tests.** Tests that render `MyScenesDialog`, `NewWorkspaceButton` and `ConfirmDialog` keep passing. Where markup must change, the test is updated in the same commit, and its ID stays.
- **Algorithm 3 tests** don't depend on the UI and must keep passing unchanged.

`npm run lint`, `npm run build` and `npm test` pass after every task. `tests/README.md` gets rows for the three new suites and the visual suite.

## 9. Acceptance criteria

- **At 1280 × 720,** in both themes, in Author and Lesson mode, in every section: no region clips or overlaps, the canvas is at least 540 px wide, and the code and math panels are both visible.
- **At 960 × 720:** nothing clips. The drawer opens and closes with the button and with Esc, and code and math stay visible.
- **Every control** has a visible label or an accessible name, a 3:1 border and focus ring, a 24 px target, and a full keyboard path. Every scrubbable field accepts a typed value.
- **Lesson focus.** Every lesson step with a `focusPanel` shows that panel open, directly under the narration.
- **Untouched behaviour.** The generated code, store shape, persistence version (7) and lesson data are unchanged, apart from the two `panelId`s, which are UI.
- **The visual suite** runs green against its own fresh baseline.
- **Lighthouse accessibility on `/app`** is at least today's score, and no new violations appear.

## 10. Rollout

Work happens on `feat/editor-redesign`, in tasks ordered so that the editor builds and works after every task: controls, then shell pieces, then each section's panels, then overlays, then visual checks. The branch is merged into `main` once the whole redesign is complete and reviewed, and before 2026-10-28.

**Fallback.** If the panels aren't all migrated by 2026-10-26, merge the completed tasks only if the editor looks consistent. Otherwise the branch waits until after the expo, and the demo uses the current editor.

## 11. Documentation and divergences

- **Roadmap:** item 4 is marked complete, with links to this spec and the plan. The rehearsal checklist gains "pick the browser zoom on the projector" and "run `npm run test:visual` on the demo machine after the last change".
- **Divergence 8** is reworded. SP5 keeps the narration that names positions, renames one panel title to match the narration, and wires two `focusPanel` ids that never matched a panel.
- **New divergence:** §3.4.2's five regions and its top-bar action list. The lesson bar becomes the lesson card in the section column, the section tabs become a menu in the section column, and the top bar's file actions move into a File menu.
- **`tests/README.md`:** rows for the new suites.

## 12. Out of scope

- A single inspector, an add-shape toolbar, merged panels (SP6).
- A large-display or presentation setting.
- Draggable resizing of columns or of the code/math split.
- Changing the default canvas colour (`glClearColor` stays `#000000`).
- New lesson content, and new editor behaviour beyond the controls' own interaction.
