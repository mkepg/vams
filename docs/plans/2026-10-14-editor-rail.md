# Editor rail redesign Implementation Plan

Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the editor's long left column with a slim labelled rail and one panel at a time, move the lesson to a quiet bar under the canvas, switch the right column between Code and Math, fix the two Run issues most likely to show on stage, and add a six-step first-visit tour.

**Architecture:** New session-only store state (`railPanel`, `railHidden`, `codePane`, `codeHidden`, `codeChangedUnseen`, the tour slice) drives every region; views only read it. The rail is a widget, the four panels are widgets composing today's feature panels, the lesson bar replaces the lesson card inside `lesson-engine`, and the tour is a new feature that finds its regions by `data-tour-anchor` and gets Run and lesson actions from the page by props.

**Tech Stack:** Preact (React-compatible TSX), Zustand with Immer, PixiJS 8, SCSS tokens, Vitest with happy-dom, Playwright for visual checks.

**Spec:** [docs/specs/2026-10-14-editor-rail-design.md](../specs/2026-10-14-editor-rail-design.md)

## Global Constraints

- Rail 64 px; panel 272 px; code column `clamp(340px, 28vw, 460px)`; below 1100 px the code column is `clamp(320px, 34vw, 400px)` and the panel becomes a drawer beside the rail.
- Grid: `64px var(--editor-panel-width) minmax(0, 1fr) var(--editor-code-width)`; a hidden panel makes `--editor-panel-width` 0; a hidden code column leaves a 30 px edge tab.
- None of the new state is persisted. The persisted `version` stays 9 and no migration is added.
- Student-facing text (labels, tooltips, narration, generated-code comments) never uses "coming soon", "not yet", "not supported", "unsupported", "future", "deferred", "3D" or "lighting". Labels are sentence case. Section labels are exactly `Pipeline | Primitives | Buffers | Transforms | Textures`.
- Layering is Feature-Sliced Design: `app → pages → widgets → features → entities → shared`, plus `core`. New code imports only from layers below and its own slice, via `@/`. The tour never imports a widget or another feature; the page passes it Run, lesson and naming functions by props.
- Design tokens live in `src/shared/styles/_tokens.scss`, declared for both themes (`:root` and `[data-theme='dark']`).
- Tests live in `tests/`, carry stable IDs `{SUITE}-{MODULE}-{NN}`, keep existing IDs, and take the next free number in their file. `tests/helpers/matrix.ts` stays independent of `src`.
- Before every commit: `npm run lint`, `npm run build`, `npm test` all pass; then `git checkout -- tests/reports` so the regenerated reports stay out of the commit. Stage explicit paths only (never `git add -A`, `.` or `-f`), read `git diff --staged`, and never stage `.gitignore` or `AGENTS.md`.
- Commit subjects follow Conventional Commits. No `Co-Authored-By` trailer and no "Generated with" line. Committed text never mentions an assistant, a skill or a workflow.
- Work happens on branch `feat/editor-rail` (it already holds the spec). Never push without the owner's approval.
- Never kill Node processes by image name; stop only processes you started, by PID. Port 5173 belongs to another program: the dev server uses 5174 and the visual suite 4319.

## Review Focus

1. **The canvas changes size without a window resize** (panel hidden or shown, code column hidden, lesson bar folded or a new step's narration taller). PixiJS only resizes on window `resize`, so vertex placement and hit tests drift unless the canvas follows its box. Pinned by BB-SHELL-31 in Task 2.
2. **The window crosses 1100 px while the drawer is open or a lesson runs.** The drawer must close when the layout turns narrow, the panel must show again when it turns wide, and focus must never stay inside a hidden drawer. Pinned by BB-SHELL-39 in Task 5.
3. **Undo or redo during a tour step.** Undoing the Build step's triangle must not leave the step "done", and undoing X back to its starting value in the Change step must not count. The checks read the store every time. Pinned by BB-TOUR-06 in Task 10, and at the callout by BB-TOUR-09 in Task 11.
4. **A lesson starts (Learn drawer or a link) while the tour's Build step has a half-placed shape.** Placement is cancelled, the tour ends, and the lesson's focus wins over the rail the tour restores. Pinned by BB-TOUR-11 in Task 11.
5. **Run stops because the store changed** (undo, a lesson step, a selection) rather than by Stop or Esc. The selection outline and vertex handles must come back, and the tour's Run step must still count the run as finished. Pinned by BB-RUN-16 in Task 9 and BB-TOUR-10 in Task 11.

## Rulings made while planning

- **Build order.** The spec lists the lesson bar third. This plan builds it second (Task 2), before the panel host, so the lesson card leaves the left column once instead of being re-homed into the panel host and then moved again. Every task still leaves a working editor.
- **Where "selection switches to Scene" lives.** The spec puts the rule in the store's selection actions. Selections are also set directly by `addCustomObject`, `duplicateObject`, `addTextObject`, `createGroup`, undo, redo and the lesson runner's replay, so the rule is one store subscription in `core/store/index.ts` that reacts to every change of `selectedObjectId`. Same behaviour, one place, no path missed.
- **`markCodeChanged`.** The spec's store lists four setters. A fifth action, `markCodeChanged()`, sets the Code dot only while Math shows, so the column never has to read `codePane` before writing.
- **Editing a text object.** Today the "Edit Selected Text" field sits in Create Text. Selecting a text object now switches the rail to Scene, so the field moves to the top of the Scene panel's inspector for text objects. Its behaviour is unchanged.
- **The sample buttons.** Loading a sample switches the rail to Scene (the scene is no longer empty), matching "Add when the scene is empty, otherwise Scene".
- **Type sizes.** The editor's stylesheets may only use the `--text-*` scale (BB-SHELL-22). The spec's pixel sizes snap to it: narration 15 px (`--text-md`), meta and task lines 12 px (`--text-sm`), rail labels and the badge 11 px (`--text-xs`), the tour caption 13 px (`--text-base`).
- **Ordered-list quizzes.** The spec says "drag and arrow-key reordering stay". The widget has drag reordering only; this plan keeps what exists and adds no keyboard reordering.
- **Lesson narration that names old places.** Three Callbacks narrations say "the Callbacks group" or "click an empty part of the canvas to see the Callbacks group". Task 12 changes only those words to "the Callbacks panel"; focus ids and steps stay as they are.
- **The tour's state lives in `core/store/tour-slice.ts`,** not in the feature, so `core/store/index.ts` gains no new feature import. The feature holds the steps, the checks, Make it spin and the UI.
- **Keys while a shape is being placed.** Enter finishes the shape and Esc cancels it on the canvas, and step 1 asks for Enter. While placing, the tour leaves Enter and Esc to the canvas; Right arrow still goes to the next step and cancels the shape, as Next does. Enter on a focused button keeps its own meaning, and arrow keys inside a tablist, radiogroup, tree, menu, slider or spin button stay with that widget.
- **Moving on by itself.** A finished try-it moves on 1.2 s (`TOUR_ADVANCE_MS`) after the last scene edit, so the student sees the code change and can finish typing a value. A step that is already done when it opens (after Back) waits until it is undone and done again, so Back never bounces forward.
- **Next while the spin plays.** Next, Back, Skip and Explore stop a running program first, so the editor is never left half-locked. While Make it spin's program runs, the scrim lifts and the inert regions are released, so the student watches the spin undimmed; the callout stays.
- **The Learn drawer in step 6.** Opening it from the spotlighted Learn button ends the tour: the student has reached the course, and a dialog under the scrim could not be used.
- **Starting the tour during a lesson.** The tour runs in Author mode only, so `startTour` does nothing in Lesson mode and the Help Center offers no "Start the tour" there. The Help Center's "New to VAMS?" banner starts the tour instead of opening the topic.
- **Spotlight mechanics.** The scrim is an SVG mask, so overlapping regions (the drawer over the canvas on a narrow screen) cut out cleanly. It takes no clicks; everything outside the regions is made `inert` for the step, which blocks both clicks and keyboard focus.
- **Tour tests** are a new suite, BB-TOUR, in `tests/black-box/first-visit-tour.test.ts`.

## File map

| Path | Task | Responsibility |
| --- | --- | --- |
| `src/core/store/types.ts` | 1, 8, 10 | `RailPanel`, `CodePane`, runtime fields and actions, `codeViewBeforeLesson`, `TourSlice` and `TourBaseline` |
| `src/core/store/runtime-slice.ts` | 1 | Rail and code-column state and actions |
| `src/core/store/index.ts` | 1, 10 | Selection → Scene subscription, opening panel on rehydrate, tour slice composition, a lesson start ending the tour |
| `src/core/store/tour-slice.ts` | 10 | The tour's state: start, Next, Back, end, and what each step opens with |
| `src/core/store/lesson-slice.ts` | 1, 8 | Lesson focus switches the rail; the student's Code/Math view saved and restored around a lesson |
| `src/core/inspector/focus-map.ts` | 1 | `railPanelFor` |
| `src/core/inspector/groups.ts` | 1 | Callbacks leaves `SETTINGS_GROUPS`; Settings groups open by default |
| `src/core/types/lesson.ts` | 2 | `task?` and `pane?` on `LessonStep` |
| `src/features/lesson-engine/ui/LessonBar.tsx`, `lesson-bar.scss` | 2 | The lesson bar (replaces `LessonCard.tsx`, `lesson-card.scss`) |
| `src/features/lesson-engine/ui/exercise-widgets/*` | 2 | Quieter quiz rows and left-to-right ordered chips |
| `src/shared/engine/observe-resize.ts` | 2 | Follows the canvas box with a `ResizeObserver` |
| `src/shared/hooks/useNarrowLayout.ts` | 3 | Moved from `pages/editor/model` so the rail can read it |
| `src/widgets/layout/rail/*` | 3 | The rail |
| `src/widgets/layout/editor-column/*` | 4, 5, 6, 7 | The panel host and the four panels (replaces `EditorColumn`, `SceneArea`, `Inspector`) |
| `src/features/text-nodes/ui/TextEditField.tsx` | 4 | The text object's edit field |
| `src/pages/editor/ui/EditorShell.tsx`, `editor-app.scss`, `EditorApp.tsx` | 2, 5, 8, 11 | The four-track grid, drawer, lesson bar slot, edge tab, tour mount |
| `src/features/custom-shapes/ui/PrimitiveTiles.tsx`, `primitive-drawings.tsx`, `primitive-defs.ts` | 6 | The Add panel's tiles |
| `src/features/scene-library/model/open-preset.ts` | 6 | Opening a prepared scene, shared by links and the Add panel |
| `src/features/scene-hierarchy/ui/SceneHierarchyPanel.tsx` | 7 | Scene toolbar and capped list |
| `src/widgets/layout/code-math-column/*`, `src/shared/ui/code-viewer/CodeViewer.tsx`, `src/features/math-panel/ui/MathPanel.tsx`, `src/shared/ui/controls/SegmentedControl.tsx` | 8 | Code / Math switch, change dot, Hide and edge tab |
| `src/features/callbacks/*`, `src/shared/engine/render-bridge.ts`, `selection-overlay.ts`, `pixi/hooks/useSceneRenderer.ts` | 5, 9 | Run strip offset, overlay hiding, reason plate |
| `src/features/first-visit-tour/*` | 10, 11 | Tour steps, checks, Make it spin, callout placement, spotlight and callout |
| `src/features/lesson-engine/model/catalog.ts`, `ui/LearnButton.tsx` | 10 | Course order and the next lesson to study; the Learn button's tour anchor |
| `src/features/code-generation/ui/SceneCodePanel.tsx` | 10 | Changed lines flash during the tour |
| `src/features/lesson-engine/model/primitives-lessons.ts`, `src/features/code-generation/model/generator/handlers.ts` | 12 | "Callbacks panel" wording |
| `src/features/help/*`, `src/features/onboarding/*` | 11, 12 | Starting the tour, rewritten copy, the tour keys in the shortcut list |
| `docs/product-plan.md`, `docs/specs/2026-10-04-website-overhaul-roadmap.md`, `tests/README.md` | 12 | Docs |
| `tests/visual/editor.spec.ts` | 13 | Visual captures |

---

### Task 1: Rail and code-column state

**Files:**
- Modify: `src/core/store/types.ts` (RuntimeSlice), `src/core/store/runtime-slice.ts`, `src/core/store/index.ts`, `src/core/store/lesson-slice.ts`, `src/core/inspector/focus-map.ts`, `src/core/inspector/groups.ts`
- Test: `tests/black-box/editor-shell.test.ts` (BB-SHELL-26 to 30), `tests/black-box/editor-inspector.test.ts` (BB-INSP-11)

**Interfaces:**
- Consumes: nothing new.
- Produces (every later task relies on these exact names):
  - `export type RailPanel = 'add' | 'scene' | 'settings' | 'callbacks';` and `export type CodePane = 'code' | 'math';` in `@/core/store/types`.
  - Store fields `railPanel: RailPanel`, `railHidden: boolean`, `codePane: CodePane`, `codeHidden: boolean`, `codeChangedUnseen: boolean`.
  - Store actions `setRailPanel(panel: RailPanel): void` (also sets `railHidden: false`), `setRailHidden(hidden: boolean): void`, `pickOpeningPanel(): void`, `setCodePane(pane: CodePane): void` (clears `codeChangedUnseen` when `'code'`), `setCodeHidden(hidden: boolean): void`, `markCodeChanged(): void` (sets `codeChangedUnseen` only while `codePane === 'math'`).
  - `railPanelFor(place: FocusPlace): RailPanel | null` exported from `@/core/inspector`.
  - `SETTINGS_GROUPS` is `['background', 'viewing-volume', 'texture-library']`; `SettingsGroupId` still includes `'callbacks'` and `GROUP_SECTION.callbacks` stays `'Pipeline'`.
  - `DEFAULT_OPEN_GROUPS` is `['transform', 'background', 'viewing-volume', 'texture-library']`.

- [ ] **Step 1: Write the failing tests**

In `tests/black-box/editor-shell.test.ts`, change the store import to `import { STORAGE_KEY, useVamsStore } from '@/core/store';` and append:

```ts
describe('BB-SHELL-26: The rail and the code column keep their state in the store', () => {
  it('unhides on a panel change and clears the code dot only when Code shows', () => {
    const s = () => useVamsStore.getState();
    useVamsStore.setState({ railPanel: 'add', railHidden: false, codePane: 'code', codeHidden: false, codeChangedUnseen: false });
    s().setRailHidden(true);
    s().setRailPanel('settings');
    expect(s().railPanel).toBe('settings');
    expect(s().railHidden).toBe(false);
    s().markCodeChanged();
    expect(s().codeChangedUnseen).toBe(false);
    s().setCodePane('math');
    s().markCodeChanged();
    expect(s().codeChangedUnseen).toBe(true);
    s().setCodePane('code');
    expect(s().codeChangedUnseen).toBe(false);
    s().setCodeHidden(true);
    expect(s().codeHidden).toBe(true);
    s().setCodeHidden(false);
  });
});

describe('BB-SHELL-27: The editor opens on Add for an empty scene and on Scene otherwise', () => {
  it('picks the opening panel from the scene', () => {
    const s = () => useVamsStore.getState();
    useVamsStore.setState({ railPanel: 'settings', railHidden: true });
    s().pickOpeningPanel();
    expect(s().railPanel).toBe('add');
    expect(s().railHidden).toBe(false);
    addTriangle();
    useVamsStore.setState({ railPanel: 'add' });
    s().pickOpeningPanel();
    expect(s().railPanel).toBe('scene');
  });

  it('picks it when the saved scene loads', async () => {
    const tri = addTriangle();
    useVamsStore.setState({ objects: [], selectedObjectId: null, railPanel: 'add' });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { objects: [tri] }, version: 9 }));
    await useVamsStore.persist.rehydrate();
    expect(useVamsStore.getState().objects).toHaveLength(1);
    expect(useVamsStore.getState().railPanel).toBe('scene');
  });
});

describe('BB-SHELL-28: Every way an object becomes selected switches the rail to Scene and opens it', () => {
  const away = () => useVamsStore.setState({ railPanel: 'settings', railHidden: true });
  const expectScene = () => {
    expect(useVamsStore.getState().railPanel).toBe('scene');
    expect(useVamsStore.getState().railHidden).toBe(false);
  };

  it('follows selection, creation, duplication, text, grouping and undo', () => {
    const s = () => useVamsStore.getState();
    away();
    const tri = addTriangle();
    expectScene();
    s().selectObject(null);
    away();
    s().selectObject(tri.id);
    expectScene();
    away();
    s().duplicateObject(tri.id);
    expectScene();
    away();
    s().addTextObject('Hi', 0, 0);
    expectScene();
    const shapes = s().objects.filter((o) => o.type !== 'TEXT').map((o) => o.id);
    away();
    s().createGroup(shapes);
    expectScene();
    s().pushToHistory();
    s().selectObject(null);
    away();
    s().undo();
    expect(s().selectedObjectId).not.toBeNull();
    expectScene();
  });

  it('leaves the rail alone when the selection is cleared', () => {
    addTriangle();
    useVamsStore.setState({ railPanel: 'settings', railHidden: false });
    useVamsStore.getState().selectObject(null);
    expect(useVamsStore.getState().railPanel).toBe('settings');
  });
});

describe('BB-SHELL-29: A lesson step switches the rail to its panel and opens it', () => {
  it('maps each focus to its panel and leaves the rail for the lesson bar’s own controls', () => {
    const s = () => useVamsStore.getState();
    const cases: [string, string][] = [
      ['ortho-editor', 'settings'],
      ['texture-library', 'settings'],
      ['callbacks-panel', 'callbacks'],
      ['primitive-palette', 'add'],
      ['text-node-panel', 'add'],
      ['scene-hierarchy', 'scene'],
      ['object-transform', 'scene'],
      ['appearance-panel', 'settings'],
    ];
    for (const [panelId, panel] of cases) {
      useVamsStore.setState({ railPanel: panel === 'add' ? 'scene' : 'add', railHidden: true });
      s().setLessonFocusPanel(panelId);
      expect(s().railPanel).toBe(panel);
      expect(s().railHidden).toBe(false);
    }
    useVamsStore.setState({ railPanel: 'scene', railHidden: true });
    s().setLessonFocusPanel('pipeline-mode-controls');
    expect(s().railPanel).toBe('scene');
    expect(s().railHidden).toBe(true);
    s().setLessonFocusPanel(null);
    expect(s().railPanel).toBe('scene');
    useVamsStore.setState({ railHidden: false });
  });
});

describe('BB-SHELL-30: The rail and the code column are never saved', () => {
  it('keeps them out of the saved editor data, which stays at version 9', () => {
    const s = () => useVamsStore.getState();
    s().setRailPanel('callbacks');
    s().setCodePane('math');
    s().setCodeHidden(true);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(saved.version).toBe(9);
    for (const key of ['railPanel', 'railHidden', 'codePane', 'codeHidden', 'codeChangedUnseen']) {
      expect(saved.state).not.toHaveProperty(key);
    }
    useVamsStore.setState({ codePane: 'code', codeHidden: false });
  });
});
```

In `tests/black-box/editor-inspector.test.ts`, add `railPanelFor`, `OBJECT_GROUPS` and `SETTINGS_GROUPS` to the existing `@/core/inspector` import (add the import if the file has none for those names), and append:

```ts
describe('BB-INSP-11: Every focus place belongs to one rail panel', () => {
  it('maps the list and objects to Scene, the Add row and text to Add, settings to Settings and callbacks to Callbacks', () => {
    expect(railPanelFor({ area: 'scene', target: 'list' })).toBe('scene');
    expect(railPanelFor({ area: 'scene', target: 'add' })).toBe('add');
    expect(railPanelFor({ area: 'scene', target: 'create-text' })).toBe('add');
    for (const group of OBJECT_GROUPS) expect(railPanelFor({ area: 'object', group })).toBe('scene');
    for (const group of SETTINGS_GROUPS) expect(railPanelFor({ area: 'settings', group })).toBe('settings');
    expect(railPanelFor({ area: 'settings', group: 'callbacks' })).toBe('callbacks');
    expect(railPanelFor({ area: 'lesson-card' })).toBeNull();
    expect(SETTINGS_GROUPS).toEqual(['background', 'viewing-volume', 'texture-library']);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/black-box/editor-shell.test.ts tests/black-box/editor-inspector.test.ts`
Expected: FAIL. TypeScript-level failures such as `s().setRailHidden is not a function` and `railPanelFor is not a function`.

- [ ] **Step 3: Add the types**

In `src/core/store/types.ts`, add above `export interface RuntimeSlice`:

```ts
/** The panels the editor rail switches between. */
export type RailPanel = 'add' | 'scene' | 'settings' | 'callbacks';
/** What the right column shows. */
export type CodePane = 'code' | 'math';
```

Inside `RuntimeSlice`, add after `addRowCue: number;`:

```ts
  /** The panel the rail shows. Session only. */
  railPanel: RailPanel;
  /** The panel is tucked away (wide screens) or the drawer is closed (narrow screens). Session only. */
  railHidden: boolean;
  /** Code or Math in the right column. Session only. */
  codePane: CodePane;
  /** The right column is tucked away to its edge tab. Session only. */
  codeHidden: boolean;
  /** The generated code changed while Math was showing. Session only. */
  codeChangedUnseen: boolean;
```

and after `cueAddRow: () => void;`:

```ts
  /** Shows a panel; also opens the panel if it was hidden. */
  setRailPanel: (panel: RailPanel) => void;
  setRailHidden: (hidden: boolean) => void;
  /** Add for an empty scene, otherwise Scene. Runs once the saved scene has loaded. */
  pickOpeningPanel: () => void;
  /** Shows Code or Math; showing Code clears the change dot. */
  setCodePane: (pane: CodePane) => void;
  setCodeHidden: (hidden: boolean) => void;
  /** Marks the code as changed while Math shows; does nothing while Code shows. */
  markCodeChanged: () => void;
```

- [ ] **Step 4: Implement the runtime state**

In `src/core/store/runtime-slice.ts`, add the initial values after `addRowCue: 0,`:

```ts
  railPanel: 'add',
  railHidden: false,
  codePane: 'code',
  codeHidden: false,
  codeChangedUnseen: false,
```

and the actions after `cueAddRow: ...,`:

```ts
  setRailPanel: (panel) => set({ railPanel: panel, railHidden: false }),
  setRailHidden: (hidden) => set({ railHidden: hidden }),
  pickOpeningPanel: () => set((state) => ({ railPanel: state.objects.length > 0 ? 'scene' : 'add', railHidden: false })),
  setCodePane: (pane) => set(pane === 'code' ? { codePane: pane, codeChangedUnseen: false } : { codePane: pane }),
  setCodeHidden: (hidden) => set({ codeHidden: hidden }),
  markCodeChanged: () => set((state) => (state.codePane === 'math' && !state.codeChangedUnseen ? { codeChangedUnseen: true } : {})),
```

- [ ] **Step 5: Map focus places to rail panels and take Callbacks out of the settings groups**

In `src/core/inspector/focus-map.ts`, change the first import to `import type { CurriculumSection, RailPanel } from '@/core/store/types';` and append:

```ts
/** The rail panel that holds a focus place; none for the lesson bar's own controls. */
export function railPanelFor(place: FocusPlace): RailPanel | null {
  switch (place.area) {
    case 'scene':
      return place.target === 'list' ? 'scene' : 'add';
    case 'object':
      return 'scene';
    case 'settings':
      return place.group === 'callbacks' ? 'callbacks' : 'settings';
    case 'lesson-card':
      return null;
  }
}
```

In `src/core/inspector/groups.ts`, replace the `SETTINGS_GROUPS` and `DEFAULT_OPEN_GROUPS` lines with:

```ts
/** The Settings panel's groups. Callbacks has its own rail panel; it keeps a group id for its focus place and math section. */
export const SETTINGS_GROUPS: readonly SettingsGroupId[] = ['background', 'viewing-volume', 'texture-library'];

/** Open by default: Transform for an object, and every Settings group. */
export const DEFAULT_OPEN_GROUPS: readonly InspectorGroupId[] = ['transform', 'background', 'viewing-volume', 'texture-library'];
```

- [ ] **Step 6: Switch the rail on selection, lesson focus and load**

In `src/core/store/lesson-slice.ts`, add `import { railPanelFor, resolveFocus } from '@/core/inspector/focus-map';` and replace `setLessonFocusPanel` with:

```ts
  // A step's control lives in one rail panel: show that panel, and open it if it was hidden.
  setLessonFocusPanel: (panelId) => set((state) => {
    const place = resolveFocus(panelId, state.selectedObjectId !== null);
    const panel = place ? railPanelFor(place) : null;
    return panel
      ? { lessonFocusPanel: panelId, mathTabOverride: null, railPanel: panel, railHidden: false }
      : { lessonFocusPanel: panelId, mathTabOverride: null };
  }),
```

In `src/core/store/index.ts`, change the rehydrate callback's last line to:

```ts
          if (rehydratedState?.sceneBackup) rehydratedState.clearLessonState();
          rehydratedState?.pickOpeningPanel();
```

and append after the `useVamsStore` definition, before the type re-export:

```ts
// Selecting an object always shows it: the rail switches to Scene and the panel opens. Every path
// that selects (the canvas, the list, a new shape or text, duplicate, group, undo, redo and the
// lesson runner) goes through selectedObjectId, so the rule lives here once.
useVamsStore.subscribe((state, prev) => {
  if (!state.selectedObjectId || state.selectedObjectId === prev.selectedObjectId) return;
  if (state.railPanel !== 'scene' || state.railHidden) useVamsStore.setState({ railPanel: 'scene', railHidden: false });
});
```

- [ ] **Step 7: Run the tests to see them pass**

Run: `npx vitest run tests/black-box/editor-shell.test.ts tests/black-box/editor-inspector.test.ts`
Expected: PASS for BB-SHELL-26 to 30 and BB-INSP-11.

- [ ] **Step 8: Run the whole suite and fix tests that asserted the old lists**

Run: `npm test`
Expected: PASS. If a test asserted `SETTINGS_GROUPS` with `'callbacks'` or `DEFAULT_OPEN_GROUPS` as `['transform', 'background']`, update it to the new values; keep its ID. The inspector's settings view still lists Callbacks at this point because `SETTINGS_GROUP_DEFS` is unchanged until Task 5.

- [ ] **Step 9: Lint, build, commit**

```bash
npm run lint && npm run build && npm test && git checkout -- tests/reports
git add src/core/store/types.ts src/core/store/runtime-slice.ts src/core/store/index.ts src/core/store/lesson-slice.ts src/core/inspector/focus-map.ts src/core/inspector/groups.ts tests/black-box/editor-shell.test.ts tests/black-box/editor-inspector.test.ts
git diff --staged --stat
git commit -m "feat(editor): add rail and code column state with the selection and lesson rules"
```

(If Step 8 changed another test file, add it to the `git add` line by name.)

---

### Task 2: The lesson bar under the canvas

**Files:**
- Create: `src/features/lesson-engine/ui/LessonBar.tsx`, `src/features/lesson-engine/ui/lesson-bar.scss`, `src/shared/engine/observe-resize.ts`
- Delete: `src/features/lesson-engine/ui/LessonCard.tsx`, `src/features/lesson-engine/ui/lesson-card.scss`, `src/features/pipeline-controls/ui/PipelineModeControls.tsx` and its `pipeline-mode-controls.scss` (check `src/features/pipeline-controls/` for other files; delete the folder only if nothing else in `src` imports from it)
- Modify: `src/core/types/lesson.ts`, `src/features/lesson-engine/ui/exercise-widgets/MultipleChoiceWidget.tsx`, `exercise-widgets.scss`, `src/widgets/layout/editor-column/EditorColumn.tsx`, `src/pages/editor/ui/EditorShell.tsx`, `src/pages/editor/ui/editor-app.scss`, `src/pages/editor/ui/EditorApp.tsx`, `src/widgets/canvas/VamsCanvas.tsx`
- Test: `tests/black-box/lesson-column.test.ts` (BB-LCOL-01 to 06, 10, 13 to 17, 22 to 24 updated; BB-LCOL-25 to 28 new), `tests/black-box/learn-drawer.test.ts` (the `LessonCard` mount), `tests/black-box/editor-panels.test.ts` (BB-PANEL-14), `tests/black-box/editor-shell.test.ts` (BB-SHELL-31)

**Interfaces:**
- Consumes: Task 1's store (unchanged here).
- Produces:
  - `LessonStep.task?: string` and `LessonStep.pane?: 'code' | 'math'` in `@/core/types/lesson`.
  - `export default function LessonBar()` from `@/features/lesson-engine/ui/LessonBar`: always mountable; renders nothing outside Lesson mode. DOM: `section.lesson-bar[aria-label="Lesson"]`, `.lesson-bar__progress[role="progressbar"] > i` (width = step fraction), `h2.lesson-bar__title[tabindex="-1"]`, `.lesson-bar__step` ("Step n of N"), buttons named "Fold lesson" / "Unfold lesson" and "Exit lesson (Esc)" (aria-label), `p.lesson-bar__narration[aria-live="polite"]`, `p.lesson-bar__task` (with `.is-done` when passed), `.lesson-bar__modes[data-panel-id="pipeline-mode-controls"]` holding a radiogroup named "Viewport mode", buttons "Back" and "Next"/"Finish".
  - `EditorShell` prop `lessonBar?: ComponentChildren`, rendered under the canvas; the canvas content sits in `div.editor__stage`.
  - `observeResize(el: Element, onResize: () => void): () => void` from `@/shared/engine/observe-resize`.
  - `EditorColumn` takes no props and no longer renders the lesson card.

- [ ] **Step 1: Write the failing tests**

In `tests/black-box/lesson-column.test.ts`:

1. Replace `import LessonCard from '@/features/lesson-engine/ui/LessonCard';` with `import LessonBar from '@/features/lesson-engine/ui/LessonBar';`.
2. Add these helpers after `buttonNamed`:

```ts
const exitButton = (host: HTMLElement) => host.querySelector('button[aria-label="Exit lesson (Esc)"]') as HTMLButtonElement;
/** The lesson bar with the editor column, as the editor lays them out. */
const lessonEditor = () => h('div', {}, h(LessonBar, {}), h(EditorColumn, {}));
```

3. Replace every `h(LessonCard, {})` with `h(LessonBar, {})`, every `mount(h(EditorColumn, {}))` in a test that clicks Next, Back or Exit or reads the narration with `mount(lessonEditor())`, and every `buttonNamed(host, 'Exit')` with `exitButton(host)`. Replace selectors: `.lesson-card__narration` → `.lesson-bar__narration`, `.lesson-card__title` → `.lesson-bar__title`, `.lesson-card` → `.lesson-bar`.
4. Replace BB-LCOL-01, 02 and 06 with:

```ts
describe('BB-LCOL-01: The lesson bar renders nothing outside a lesson', () => {
  it('is empty in Author mode', () => {
    const host = mount(h(LessonBar, {}));
    expect(host.innerHTML).toBe('');
    unmount(host);
  });
});

describe('BB-LCOL-02: The bar shows the title, the step, a progress hairline and the narration', () => {
  it('waits for the student on an exercise step', async () => {
    startLesson('transforms-exercise-1');
    const host = mount(h(LessonBar, {}));
    await settle();
    expect(host.querySelector('.lesson-bar__title')!.textContent).toBe('Translate to Position');
    expect(host.querySelector('.lesson-bar__step')!.textContent).toBe('Step 1 of 2');
    expect(host.querySelector('.lesson-card__chip, .lesson-bar__chip')).toBeNull();
    const progress = host.querySelector('[role="progressbar"]') as HTMLElement;
    expect(progress.getAttribute('aria-valuenow')).toBe('1');
    expect(progress.getAttribute('aria-valuemax')).toBe('2');
    expect((progress.firstElementChild as HTMLElement).style.width).toBe('50%');
    expect(host.querySelector('.lesson-bar__narration')!.textContent).toContain('Move the triangle to (0.5,');
    expect(buttonNamed(host, 'Next')!.disabled).toBe(true);
    expect(buttonNamed(host, 'Back')!.disabled).toBe(true);
    expect(host.querySelector('.lesson-bar__task')!.textContent).toContain('Waiting for you');
    unmount(host);
  });
});

describe('BB-LCOL-06: In Lesson mode the editor column has no lesson card', () => {
  it('shows the scene area and the inspector, with the lesson in the bar', async () => {
    startLesson('transforms-exercise-1');
    const host = mount(lessonEditor());
    await settle();
    expect(host.querySelector('.lesson-bar')).not.toBeNull();
    expect(host.querySelector('.editor-column .lesson-bar, .lesson-card')).toBeNull();
    expect(host.querySelector('.scene-area')).not.toBeNull();
    expect(host.querySelector('.inspector')).not.toBeNull();
    unmount(host);
  });
});
```

5. In BB-LCOL-13, the first `it` mounts `lessonEditor()`, focuses `exitButton(host)` and clicks it; keep its assertions. The second `it` mounts `lessonEditor()`.
6. In BB-LCOL-16, expect focus on `host.querySelector('.lesson-bar__title')`.
7. In BB-LCOL-24, the column has no card any more. Replace `const head = host.querySelector<HTMLElement>('.editor-column__head')!;` and its `offsetHeight` override with nothing, and change the final expectation to `expect(writes.at(-1)).toBe(400 - 200 - 8);` with the comment `// The column comes to rest with the list at its top.` Mount `lessonEditor()` in both of its tests.
8. In BB-LCOL-10 and BB-LCOL-15, replace `h(LessonCard, {})` with `h(LessonBar, {})` inside `narrowShell(...)`.
9. Append:

```ts
describe('BB-LCOL-25: The task line waits for the student and says Done when the step passes', () => {
  it('falls back to "Waiting for you", shows the step’s task, and turns to Done', async () => {
    const lesson = LESSON_REGISTRY['transforms-exercise-1'];
    const original = lesson.steps[0].task;
    try {
      startLesson('transforms-exercise-1');
      let host = mount(h(LessonBar, {}));
      await settle();
      expect(host.querySelector('.lesson-bar__task')!.textContent).toBe('Waiting for you');
      expect(host.querySelector('.lesson-bar__task')!.classList.contains('is-done')).toBe(false);
      unmount(host);
      useVamsStore.getState().clearLessonState();
      useVamsStore.setState({ appMode: 'Author' });

      lesson.steps[0].task = 'Move the triangle to (0.5, −0.3)';
      startLesson('transforms-exercise-1');
      host = mount(h(LessonBar, {}));
      await settle();
      expect(host.querySelector('.lesson-bar__task')!.textContent).toBe('Move the triangle to (0.5, −0.3)');
      const id = useVamsStore.getState().objects[0].id;
      useVamsStore.getState().updateObjectTransform(id, { translateX: 0.5, translateY: -0.3 });
      await settle();
      const task = host.querySelector('.lesson-bar__task')!;
      expect(task.classList.contains('is-done')).toBe(true);
      expect(task.textContent).toBe('Done · Move the triangle to (0.5, −0.3)');
      unmount(host);
    } finally {
      lesson.steps[0].task = original;
    }
  });
});

describe('BB-LCOL-26: Folding leaves a strip with the title, the step and Next; a new step unfolds it', () => {
  it('folds, keeps Next working, and unfolds on the next step', async () => {
    startLesson('transforms-demo-1');
    const host = mount(h(LessonBar, {}));
    await settle();
    (host.querySelector('button[aria-label="Fold lesson"]') as HTMLButtonElement).click();
    await settle();
    expect(host.querySelector('.lesson-bar')!.classList.contains('is-folded')).toBe(true);
    expect(host.querySelector('.lesson-bar__narration')).toBeNull();
    expect(host.querySelector('.lesson-bar__step')!.textContent).toBe('Step 1 of 5');
    expect(host.querySelector('button[aria-label="Unfold lesson"]')).not.toBeNull();
    buttonNamed(host, 'Next')!.click();
    await settle();
    expect(host.querySelector('.lesson-bar')!.classList.contains('is-folded')).toBe(false);
    expect(host.querySelector('.lesson-bar__narration')!.textContent).toContain('Translate moves the shape');
    unmount(host);
  });
});

describe('BB-LCOL-27: Pipeline lessons switch the canvas view from the bar', () => {
  it('shows the viewport modes as a radiogroup under the narration', async () => {
    const pipeline = Object.values(LESSON_REGISTRY).find((l) => l.section === 'Pipeline' && l.type === 'demo')!;
    startLesson(pipeline.id, 'Pipeline');
    const host = mount(h(LessonBar, {}));
    await settle();
    const modes = host.querySelector('.lesson-bar__modes [role="radiogroup"]')!;
    expect(modes.getAttribute('aria-label')).toBe('Viewport mode');
    expect([...modes.querySelectorAll('[role="radio"]')].map((r) => r.textContent)).toEqual(['Diagram', 'Raster vs vector', 'Playground']);
    (modes.querySelector('[role="radio"]') as HTMLButtonElement).click();
    expect(useVamsStore.getState().pipelineMode).toBe('Diagram');
    unmount(host);
    useVamsStore.setState({ pipelineMode: 'Playground' });
  });
});

describe('BB-LCOL-28: Quiz rows stay plain and still pass and fail as before', () => {
  it('letters each option, keeps a wrong answer clickable, and enables Next on the right one', async () => {
    // A lesson without a shuffled range, so the registry's step index is the runner's.
    const lesson = Object.values(LESSON_REGISTRY).find(
      (l) => !l.shuffleRange && l.steps.some((s) => s.exercise?.kind === 'multiple-choice'),
    )!;
    const stepIndex = lesson.steps.findIndex((s) => s.exercise?.kind === 'multiple-choice');
    const exercise = lesson.steps[stepIndex].exercise as Extract<NonNullable<typeof lesson.steps[number]['exercise']>, { kind: 'multiple-choice' }>;
    useVamsStore.setState({ activeSection: lesson.section });
    useVamsStore.getState().setActiveLesson(lesson.id);
    useVamsStore.getState().setAppMode('Lesson');
    useVamsStore.getState().setCurrentStep(stepIndex);
    const host = mount(h(LessonBar, {}));
    await settle();
    const options = [...host.querySelectorAll<HTMLButtonElement>('.mc-option')];
    expect(options.map((o) => o.querySelector('.opt-letter')!.textContent)).toEqual(options.map((_, i) => String.fromCharCode(65 + i)));
    const wrong = options.find((o) => o.querySelector('.opt-label')!.textContent !== exercise.options.find((x) => x.id === exercise.correctId)!.label)!;
    wrong.click();
    await settle();
    expect(wrong.classList.contains('wrong')).toBe(true);
    expect(wrong.disabled).toBe(false);
    const right = options.find((o) => o.querySelector('.opt-label')!.textContent === exercise.options.find((x) => x.id === exercise.correctId)!.label)!;
    right.click();
    await settle();
    expect(right.classList.contains('correct')).toBe(true);
    expect((buttonNamed(host, 'Next') ?? buttonNamed(host, 'Finish'))!.disabled).toBe(false);
    unmount(host);
  });
});
```

In `tests/black-box/learn-drawer.test.ts`, replace the `LessonCard` import and mount with `LessonBar` from `@/features/lesson-engine/ui/LessonBar`; keep the test's assertions, mapping any `.lesson-card…` selector to `.lesson-bar…` as in item 3.

In `tests/black-box/editor-panels.test.ts`, remove the `PipelineModeControls` import and rewrite BB-PANEL-14 (keep its ID and title "Viewport mode is an arrow-key radiogroup"):

```ts
describe('BB-PANEL-14: Viewport mode is an arrow-key radiogroup', () => {
  it('moves between modes with the arrow keys in a Pipeline lesson', async () => {
    const pipeline = Object.values(LESSON_REGISTRY).find((l) => l.section === 'Pipeline' && l.type === 'demo')!;
    useVamsStore.setState({ activeSection: 'Pipeline' });
    useVamsStore.getState().setActiveLesson(pipeline.id);
    useVamsStore.getState().setAppMode('Lesson');
    const host = mount(h(LessonBar, {}));
    await settle();
    // The step's own action may set a mode; start from a known one.
    useVamsStore.setState({ pipelineMode: 'Diagram' });
    await settle();
    const group = host.querySelector('.lesson-bar__modes [role="radiogroup"]') as HTMLElement;
    const checked = () => group.querySelector('[aria-checked="true"]')!.textContent;
    expect(checked()).toBe('Diagram');
    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await settle();
    expect(checked()).toBe('Raster vs vector');
    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    await settle();
    expect(checked()).toBe('Playground');
    unmount(host);
    useVamsStore.getState().clearLessonState();
    useVamsStore.setState({ appMode: 'Author', pipelineMode: 'Playground' });
  });
});
```

with `import LessonBar from '@/features/lesson-engine/ui/LessonBar';` and `import { LESSON_REGISTRY } from '@/features/lesson-engine/model/lesson-registry';` added to that file's imports if missing. (Adapt to the file's own `mount`/`settle` helper names.)

In `tests/black-box/editor-shell.test.ts`, append:

```ts
describe('BB-SHELL-31: The canvas follows its box when the layout around it changes', () => {
  it('reports every size change of the observed element and stops on cleanup', async () => {
    const { observeResize } = await import('@/shared/engine/observe-resize');
    const RealObserver = globalThis.ResizeObserver;
    let callback: ResizeObserverCallback = () => {};
    const disconnect = vi.fn();
    globalThis.ResizeObserver = class {
      constructor(cb: ResizeObserverCallback) { callback = cb; }
      observe() {}
      unobserve() {}
      disconnect() { disconnect(); }
    } as unknown as typeof ResizeObserver;
    try {
      const onResize = vi.fn();
      const stop = observeResize(document.createElement('div'), onResize);
      callback([], {} as ResizeObserver);
      callback([], {} as ResizeObserver);
      expect(onResize).toHaveBeenCalledTimes(2);
      stop();
      expect(disconnect).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.ResizeObserver = RealObserver;
    }
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('src/widgets/canvas/VamsCanvas.tsx', 'utf8')).toContain('observeResize(');
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/black-box/lesson-column.test.ts tests/black-box/learn-drawer.test.ts tests/black-box/editor-panels.test.ts tests/black-box/editor-shell.test.ts`
Expected: FAIL: `Failed to resolve import "@/features/lesson-engine/ui/LessonBar"` and `@/shared/engine/observe-resize`.

- [ ] **Step 3: Add the lesson step fields**

In `src/core/types/lesson.ts`, add inside `LessonStep` after `focusPanel?: string; ...`:

```ts
  /** What an exercise step is waiting for, shown in the lesson bar's task line. */
  task?: string;
  /** Which side of the code column the step is about. Without it, a step that highlights code shows Code. */
  pane?: 'code' | 'math';
```

- [ ] **Step 4: Write the resize helper**

Create `src/shared/engine/observe-resize.ts`:

```ts
/**
 * Calls `onResize` whenever `el` changes size, whatever caused it (a panel hidden, the lesson bar
 * folded), not only when the window resizes. Returns the cleanup.
 */
export function observeResize(el: Element, onResize: () => void): () => void {
  if (typeof ResizeObserver === 'undefined') return () => {};
  const observer = new ResizeObserver(() => onResize());
  observer.observe(el);
  return () => observer.disconnect();
}
```

In `src/widgets/canvas/VamsCanvas.tsx`, add `import { observeResize } from '@/shared/engine/observe-resize';` and, after the existing cleanup `useEffect`, add:

```ts
  // PixiJS, the grid and the viewport transform listen for window resizes. The canvas box also
  // changes when a panel hides or the lesson bar grows, so pass those changes on the same way.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    return observeResize(el, () => window.dispatchEvent(new Event('resize')));
  }, []);
```

- [ ] **Step 5: Write the lesson bar**

Create `src/features/lesson-engine/ui/LessonBar.tsx`:

```tsx
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import type { PipelineMode } from '@/core/store/types';
import { Button, SegmentedControl } from '@/shared/ui/controls';
import { useLessonRunner } from '../model/useLessonRunner';
import MultipleChoiceWidget from './exercise-widgets/MultipleChoiceWidget';
import OrderListWidget from './exercise-widgets/OrderListWidget';
import './lesson-bar.scss';

const PIPELINE_MODES: { value: PipelineMode; label: string }[] = [
  { value: 'Diagram', label: 'Diagram' },
  { value: 'RasterVector', label: 'Raster vs vector' },
  { value: 'Playground', label: 'Playground' },
];

/** The lesson, along the bottom of the canvas. Mount once; it renders only in Lesson mode. */
export default function LessonBar() {
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');

  // Leaving a lesson removes the bar and its focused Exit button. When that drops focus to the
  // page, hand it to the Learn button; never take it from elsewhere.
  const wasInLesson = useRef(inLesson);
  useLayoutEffect(() => {
    const left = wasInLesson.current && !inLesson;
    wasInLesson.current = inLesson;
    if (!left) return;
    const active = document.activeElement;
    if (active && active !== document.body && document.contains(active)) return;
    document.querySelector<HTMLElement>('.learn-trigger')?.focus();
  }, [inLesson]);

  return inLesson ? <LessonBarBody /> : null;
}

/** Runs the step engine; mounted only during a lesson. */
function LessonBarBody() {
  const runner = useLessonRunner();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const pipelineLesson = useVamsStore((s) => s.activeSection === 'Pipeline');
  const pipelineMode = useVamsStore((s) => s.pipelineMode);
  const setPipelineMode = useVamsStore((s) => s.setPipelineMode);
  const focusPanelId = useVamsStore((s) => s.lessonFocusPanel);
  const lessonId = runner.active ? runner.lesson?.id ?? null : null;
  const stepKey = lessonId ? `${lessonId}:${runner.stepIndex}` : null;

  // Folding is per lesson, and a new step always unfolds so its narration is never missed.
  const [folded, setFolded] = useState(false);
  const [foldedFor, setFoldedFor] = useState(stepKey);
  if (stepKey !== foldedFor) {
    setFoldedFor(stepKey);
    if (folded) setFolded(false);
  }

  // Starting a lesson from the Learn drawer closes the drawer, which drops focus to the page or
  // back to the Learn button. Hand it to the lesson title; never take it from elsewhere.
  useEffect(() => {
    if (!lessonId) return;
    const active = document.activeElement;
    if (!active || active === document.body || !active.isConnected || active.closest('.learn-trigger')) titleRef.current?.focus();
  }, [lessonId]);

  if (!runner.active || !runner.lesson || !runner.step) return null;
  const { lesson, step, stepIndex, stepCount, isLastStep, canAdvance } = runner;
  const width = `${((stepIndex + 1) / stepCount) * 100}%`;

  const progress = (
    <div
      className="lesson-bar__progress"
      role="progressbar"
      aria-label="Lesson progress"
      aria-valuemin={1}
      aria-valuemax={stepCount}
      aria-valuenow={stepIndex + 1}
    >
      <i style={{ width }} />
    </div>
  );
  const next = (
    <Button
      variant="primary"
      className="lesson-bar__next"
      icon={isLastStep ? <CheckCircle2 /> : <ChevronRight />}
      title={isLastStep ? 'Finish lesson' : 'Next step (→)'}
      disabled={!canAdvance}
      onClick={isLastStep ? runner.finish : runner.next}
    >
      {isLastStep ? 'Finish' : 'Next'}
    </Button>
  );
  const meta = (
    <div className="lesson-bar__meta">
      <h2 ref={titleRef} className="lesson-bar__title" tabIndex={-1}>{lesson.title}</h2>
      <span className="lesson-bar__sep" aria-hidden="true">·</span>
      <span className="lesson-bar__step">Step {stepIndex + 1} of {stepCount}</span>
      <span className="lesson-bar__tools">
        <Button
          variant="quiet"
          iconOnly
          className="lesson-bar__tool"
          label={folded ? 'Unfold lesson' : 'Fold lesson'}
          icon={folded ? <ChevronUp /> : <ChevronDown />}
          onClick={() => setFolded(!folded)}
        />
        {!folded && (
          <Button variant="quiet" iconOnly className="lesson-bar__tool" label="Exit lesson (Esc)" icon={<X />} onClick={runner.exit} />
        )}
      </span>
      {folded && next}
    </div>
  );

  if (folded) {
    return (
      <section className="lesson-bar is-folded" aria-label="Lesson">
        {progress}
        {meta}
      </section>
    );
  }

  const done = canAdvance;
  return (
    <section className="lesson-bar" aria-label="Lesson">
      {progress}
      {meta}
      <p className="lesson-bar__narration" aria-live="polite">{step.narration}</p>
      {pipelineLesson && (
        <div
          className={focusPanelId === 'pipeline-mode-controls' ? 'lesson-bar__modes is-lesson-focus' : 'lesson-bar__modes'}
          data-panel-id="pipeline-mode-controls"
        >
          <SegmentedControl label="Viewport mode" options={PIPELINE_MODES} value={pipelineMode} onChange={setPipelineMode} />
        </div>
      )}
      {step.exercise && (
        <div className="lesson-bar__exercise" key={`ex-${lesson.id}-${stepIndex}`}>
          {step.exercise.kind === 'multiple-choice' && (
            <MultipleChoiceWidget
              prompt={step.exercise.prompt}
              visualArtifact={step.exercise.visualArtifact}
              options={step.exercise.options}
              selectedId={runner.mcAnswer}
              correctId={step.exercise.correctId}
              onSelect={runner.setMcAnswer}
            />
          )}
          {step.exercise.kind === 'ordered-list' && runner.orderAnswer && (
            <OrderListWidget
              prompt={step.exercise.prompt}
              items={step.exercise.items}
              order={runner.orderAnswer}
              correctOrder={step.exercise.correctOrder}
              onChange={runner.setOrderAnswer}
            />
          )}
        </div>
      )}
      {step.waitForUser && (
        <p className={done ? 'lesson-bar__task is-done' : 'lesson-bar__task'}>
          <span className="lesson-bar__dot" aria-hidden="true" />
          {done ? (step.task ? `Done · ${step.task}` : 'Done') : step.task ?? 'Waiting for you'}
        </p>
      )}
      <div className="lesson-bar__nav">
        <Button
          variant="quiet"
          className="lesson-bar__back"
          icon={<ChevronLeft />}
          title="Previous step (←)"
          disabled={stepIndex === 0}
          onClick={runner.back}
        >
          Back
        </Button>
        {next}
      </div>
    </section>
  );
}
```

Create `src/features/lesson-engine/ui/lesson-bar.scss`:

```scss
// The lesson bar: a reading line along the bottom of the canvas. The narration is the loudest
// thing in it, and Next is its only coloured control.
.lesson-bar {
  position: relative;
  display: grid;
  gap: var(--space-2);
  padding: 14px var(--space-4) var(--space-3);
  border-top: 1px solid var(--rule);
  background: var(--paper-raised);

  &.is-folded {
    gap: 0;
    padding-top: 6px;
    padding-bottom: 6px;
    min-height: 34px;
  }

  &__progress {
    position: absolute;
    top: -1px;
    left: 0;
    right: 0;
    height: 2px;

    i {
      display: block;
      height: 100%;
      background: var(--accent);
    }
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: var(--text-sm);
    line-height: var(--lh-sm);
  }

  &__title {
    margin: 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: inherit;
    font-weight: 600;
    color: var(--ink-muted);

    // Focus lands here by script when a lesson starts; the heading is not a control.
    &:focus { outline: none; }
  }

  &__sep,
  &__step {
    color: var(--ink-faint);
    white-space: nowrap;
  }

  &__tools {
    display: inline-flex;
    gap: 2px;
    margin-left: auto;
  }

  &__tool.vbtn {
    width: 22px;
    height: 22px;
    min-height: 22px;
    padding: 0;
    color: var(--ink-faint);

    &:hover,
    &:focus-visible { color: var(--ink); }
  }

  &.is-folded .lesson-bar__next { margin-left: var(--space-2); }

  &__narration {
    margin: 0;
    max-width: 72ch;
    font-size: var(--text-md);
    line-height: 1.6;
    color: var(--ink);

    code {
      font-family: var(--font-mono);
      font-size: inherit;
      color: var(--accent-text);
    }
  }

  &__modes {
    justify-self: start;

    &.is-lesson-focus {
      outline: 2px solid var(--accent);
      outline-offset: 3px;
      border-radius: var(--radius-m);
    }
  }

  &__task {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }

  &__dot {
    flex: none;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--warning);
  }

  &__task.is-done &__dot { background: var(--success); }

  &__nav {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-2);
  }

  &__back.vbtn {
    color: var(--ink-faint);

    &:hover:not(:disabled) { color: var(--ink); }
  }
}
```

- [ ] **Step 6: Quieter quiz widgets**

In `MultipleChoiceWidget.tsx`, change the options map to take the index and render a letter:

```tsx
        {randomizedOptions.map((opt, index) => {
          const isSelected = selectedId === opt.id;
          const isCorrect = isSelected && opt.id === correctId;
          const isWrong = isSelected && opt.id !== correctId;

          return (
            <button
              key={opt.id}
              type="button"
              className={`mc-option ${isSelected ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`}
              onClick={() => onSelect(opt.id)}
            >
              <span className="opt-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
              <span className="opt-label">{opt.label}</span>
              {isCorrect && <Check size={14} className="opt-icon correct" />}
              {isWrong && <X size={14} className="opt-icon wrong" />}
            </button>
          );
        })}
```

`OrderListWidget.tsx` keeps its markup; only its styles change.

Replace `exercise-widgets.scss` with:

```scss
@use '../../../../shared/styles/tokens' as *;

.exercise-widget {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .artifact-display {
    display: flex;
    justify-content: center;
    margin-bottom: 4px;

    .artifact-svg {
      width: 100%;
      max-width: 160px;
      aspect-ratio: 3 / 2;
      background: rgba(var(--well-rgb), 0.3);
      border: 1px solid var(--field-line);
      border-radius: var(--radius-m);
    }
  }

  .widget-prompt {
    font-size: var(--text-base);
    color: var(--ink);
    line-height: 1.45;
  }

  // Quiz options are plain rows in two columns: a faint letter, then the option in mono.
  &.mc-widget {
    .mc-options {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 2px var(--space-4);
      width: 100%;
    }

    .mc-option {
      display: flex;
      align-items: baseline;
      gap: 8px;
      min-height: 30px;
      padding: 4px 6px;
      border: 0;
      border-radius: var(--radius-s);
      background: none;
      color: var(--ink);
      font-size: var(--text-base);
      text-align: left;
      cursor: pointer;

      .opt-letter {
        flex: none;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--ink-faint);
      }

      .opt-label {
        flex: 1;
        min-width: 0;
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        overflow-wrap: anywhere;
      }

      .opt-icon {
        flex-shrink: 0;
        align-self: center;
      }

      &:hover { background: var(--paper-sunken); }

      // A chosen option is always marked right or wrong, so it needs no selected style of its own.
      &.correct {
        color: var(--accent-green-text);
        .opt-icon.correct { color: var(--accent-green-text); }
      }

      // A wrong answer shakes once and stays clickable.
      &.wrong {
        color: var(--accent-red-text);
        animation: mc-shake 0.3s ease-in-out;
        .opt-icon.wrong { color: var(--accent-red-text); }
      }
    }
  }

  // Ordered lists read left to right, with an arrow between chips, and wrap to a second row.
  &.order-widget {
    .order-list {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 4px;
      margin: 0;
      padding: 0;
      width: 100%;
    }

    .order-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 28px;
      padding: 3px 8px;
      border: 1px solid var(--rule);
      border-radius: 14px;
      background: none;
      cursor: grab;

      &:not(:last-child)::after {
        content: '→';
        margin-left: 6px;
        color: var(--ink-faint);
      }

      .drag-handle { color: var(--ink-faint); }

      .order-num {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--ink-faint);
      }

      .order-label {
        font-size: var(--text-sm);
        color: var(--ink);
      }

      &:hover { background: var(--paper-sunken); }

      &.dragging {
        opacity: 0.5;
        cursor: grabbing;
        border-color: var(--accent);
      }

      &.correct-pos {
        border-color: var(--accent-green-text);
        .order-num { color: var(--accent-green-text); }
      }
    }
  }
}

@keyframes mc-shake {
  25% { transform: translateX(-3px); }
  75% { transform: translateX(3px); }
}

@media (prefers-reduced-motion: reduce) {
  .exercise-widget.mc-widget .mc-option.wrong { animation: none; }
}
```

- [ ] **Step 7: Take the card out of the column and put the bar under the canvas**

In `src/widgets/layout/editor-column/EditorColumn.tsx`:
- Remove the imports of `LessonCard`, `PipelineModeControls`, `PanelLayoutContext` and `ComponentChildren`.
- Remove the `cardExtra` prop (`export default function EditorColumn()`), the `pipelineLesson` selector, the `wasInLesson` focus effect (it now lives in `LessonBar`), the `extra` element and the `{inLesson && (<div className="editor-column__head">…</div>)}` block.
- Change the doc comment to `/** The left column: the scene area and the inspector, the same in every section. */`.

In `src/widgets/layout/editor-column/editor-column.scss`, delete the `&__head { … }` block.

In `src/pages/editor/ui/EditorShell.tsx`, add `lessonBar?: ComponentChildren;` to `EditorShellProps` with the comment `/** The lesson bar, under the canvas. */`, take it in the parameter list, and change `<main …>` to:

```tsx
      <main className="editor__canvas canvas-area">
        <div className="editor__stage">
          {narrow && !running && (
            <Button
              ref={toggleRef}
              className="editor__panels-toggle"
              icon={<PanelLeft />}
              aria-expanded={drawerOpen}
              aria-controls="editor-column"
              onClick={() => setDrawerOpen((open) => !open)}
            >
              Panels
            </Button>
          )}
          {canvas}
        </div>
        {lessonBar}
      </main>
```

In `src/pages/editor/ui/editor-app.scss`, replace the `&__canvas { … }` block with:

```scss
  &__canvas {
    position: relative;
    grid-row: 2;
    grid-column: 2;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    min-width: 0;
    min-height: 0;
    background-color: rgba(var(--well-rgb), 0.5);
  }

  // The canvas and its overlays. Keeps their z-indexes (the pipeline diagram uses 100) inside the
  // canvas, so the drawer, the lesson bar and the menus always sit above them.
  &__stage {
    position: relative;
    min-width: 0;
    min-height: 0;
    isolation: isolate;
  }
```

In `src/pages/editor/ui/EditorApp.tsx`, import `LessonBar from '@/features/lesson-engine/ui/LessonBar'` and pass `lessonBar={<LessonBar />}` to `EditorShell`.

Delete `src/features/lesson-engine/ui/LessonCard.tsx`, `lesson-card.scss` and `src/features/pipeline-controls/ui/PipelineModeControls.tsx` with its stylesheet. Run `grep -rn "LessonCard\|PipelineModeControls\|pipeline-mode-controls.scss" src` and remove any remaining import.

- [ ] **Step 8: Run the tests to see them pass**

Run: `npx vitest run tests/black-box/lesson-column.test.ts tests/black-box/learn-drawer.test.ts tests/black-box/editor-panels.test.ts tests/black-box/editor-shell.test.ts`
Expected: PASS, including BB-LCOL-25 to 28, BB-PANEL-14 and BB-SHELL-31.

- [ ] **Step 9: Run everything, lint, build, commit**

```bash
npm run lint && npm run build && npm test && git checkout -- tests/reports
git add src/core/types/lesson.ts src/features/lesson-engine/ui/LessonBar.tsx src/features/lesson-engine/ui/lesson-bar.scss src/features/lesson-engine/ui/exercise-widgets/MultipleChoiceWidget.tsx src/features/lesson-engine/ui/exercise-widgets/exercise-widgets.scss src/shared/engine/observe-resize.ts src/widgets/canvas/VamsCanvas.tsx src/widgets/layout/editor-column/EditorColumn.tsx src/widgets/layout/editor-column/editor-column.scss src/pages/editor/ui/EditorShell.tsx src/pages/editor/ui/editor-app.scss src/pages/editor/ui/EditorApp.tsx tests/black-box/lesson-column.test.ts tests/black-box/learn-drawer.test.ts tests/black-box/editor-panels.test.ts tests/black-box/editor-shell.test.ts
git rm src/features/lesson-engine/ui/LessonCard.tsx src/features/lesson-engine/ui/lesson-card.scss src/features/pipeline-controls/ui/PipelineModeControls.tsx src/features/pipeline-controls/ui/pipeline-mode-controls.scss
git diff --staged --stat
git commit -m "feat(lessons): move the lesson into a quiet bar under the canvas"
```

(If the deleted files were already removed with `rm`, `git rm` stages the deletion; if `src/features/pipeline-controls/` held other files you left in place, do not remove them.)

---

### Task 3: The rail

**Files:**
- Create: `src/widgets/layout/rail/Rail.tsx`, `src/widgets/layout/rail/rail.scss`, `src/widgets/layout/rail/index.ts`
- Move: `src/pages/editor/model/useNarrowLayout.ts` → `src/shared/hooks/useNarrowLayout.ts`
- Modify: `src/pages/editor/ui/EditorShell.tsx` (import path only), `src/shared/styles/_tokens.scss`
- Test: `tests/black-box/editor-shell.test.ts` (BB-SHELL-32 to 36)

**Interfaces:**
- Consumes: Task 1's `railPanel`, `railHidden`, `setRailPanel`, `setRailHidden`, `RailPanel`.
- Produces:
  - `export default function Rail()` and `export { railTabId, EDITOR_PANEL_ID, RAIL_ORDER }` from `@/widgets/layout/rail`. `railTabId(panel: RailPanel): string` returns `rail-tab-${panel}`; `EDITOR_PANEL_ID = 'editor-panel'`; `RAIL_ORDER = ['add', 'scene', 'settings', 'callbacks']`.
  - DOM: `nav.rail` > `div.rail__tabs[role="tablist"][aria-orientation="vertical"][aria-label="Editor panels"]` holding `button.rail__tab[role="tab"]#rail-tab-<panel>[data-panel=<panel>]` (Add carries `data-tour-anchor="rail-add"`), a `span.rail__divider` before Callbacks, `span.rail__badge` on Callbacks; then `button.rail__hide` (label "Hide" / "Show").
  - `useNarrowLayout()` from `@/shared/hooks/useNarrowLayout`.
  - Tokens `--rail-pill-hover` and `--rail-pill-active` in both themes.

- [ ] **Step 1: Write the failing tests**

In `tests/black-box/editor-shell.test.ts`, add `import Rail from '@/widgets/layout/rail';` to the imports and this helper after `key(...)`. happy-dom's window is 1024 px wide, which matches the narrow-layout query, so every test that mounts the rail or the shell pins the layout it means:

```ts
/** A matchMedia stand-in whose answer can change, notifying the editor like a real resize. */
function mediaQuery(initial: boolean) {
  const real = window.matchMedia;
  let matches = initial;
  const listeners = new Set<() => void>();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() { return matches; },
    media: query,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
  }));
  return {
    set(next: boolean) {
      matches = next;
      listeners.forEach((listener) => listener());
    },
    restore() {
      window.matchMedia = real;
    },
  };
}
```

Then append:

```ts
describe('BB-SHELL-32: The rail lists Add, Scene, Settings and Callbacks as vertical tabs', () => {
  it('names each tab, sets Callbacks apart and marks the open panel', async () => {
    const media = mediaQuery(false);
    try {
      useVamsStore.setState({ railPanel: 'scene', railHidden: false });
      const host = mount(h(Rail, {}));
      await settle();
      const list = host.querySelector('[role="tablist"]')!;
      expect(list.getAttribute('aria-orientation')).toBe('vertical');
      expect(list.getAttribute('aria-label')).toBe('Editor panels');
      const tabs = [...list.querySelectorAll('[role="tab"]')];
      expect(tabs.map((t) => t.querySelector('.rail__label')!.textContent)).toEqual(['Add', 'Scene', 'Settings', 'Callbacks']);
      expect(tabs.map((t) => t.id)).toEqual(['rail-tab-add', 'rail-tab-scene', 'rail-tab-settings', 'rail-tab-callbacks']);
      for (const tab of tabs) expect(tab.getAttribute('aria-controls')).toBe('editor-panel');
      const divider = list.querySelector('.rail__divider')!;
      expect(divider.previousElementSibling).toBe(tabs[2]);
      expect(divider.nextElementSibling).toBe(tabs[3]);
      expect(tabs.map((t) => t.getAttribute('aria-selected') === 'true')).toEqual([false, true, false, false]);
      expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '0', '-1', '-1']);
      expect(tabs[0].getAttribute('data-tour-anchor')).toBe('rail-add');
      (tabs[2] as HTMLButtonElement).click();
      await settle();
      expect(useVamsStore.getState().railPanel).toBe('settings');
      unmount(host);
    } finally {
      media.restore();
    }
  });
});

describe('BB-SHELL-33: Arrow keys move between rail tabs; Enter opens one', () => {
  it('moves focus with Up, Down, Home and End and wraps at the ends', async () => {
    const media = mediaQuery(false);
    try {
      useVamsStore.setState({ railPanel: 'add', railHidden: false });
      const host = mount(h(Rail, {}));
      await settle();
      const tab = (id: string) => host.querySelector(`#rail-tab-${id}`) as HTMLButtonElement;
      tab('add').focus();
      key(tab('add'), 'ArrowDown');
      expect(document.activeElement).toBe(tab('scene'));
      key(tab('scene'), 'End');
      expect(document.activeElement).toBe(tab('callbacks'));
      key(tab('callbacks'), 'ArrowDown');
      expect(document.activeElement).toBe(tab('add'));
      key(tab('add'), 'ArrowUp');
      expect(document.activeElement).toBe(tab('callbacks'));
      key(tab('callbacks'), 'Home');
      expect(document.activeElement).toBe(tab('add'));
      // Moving focus never switches the panel; activating does.
      expect(useVamsStore.getState().railPanel).toBe('add');
      unmount(host);
    } finally {
      media.restore();
    }
  });
});

describe('BB-SHELL-34: The Callbacks badge counts the callbacks that work', () => {
  it('hides at zero and counts only valid handlers', async () => {
    const media = mediaQuery(false);
    try {
      const host = mount(h(Rail, {}));
      await settle();
      expect(host.querySelector('.rail__badge')).toBeNull();
      const s = useVamsStore.getState();
      s.setCallbackHandler('keyboard', 'onKey');
      s.setCallbackHandler('idle', 'onIdle');
      s.setCallbackHandler('mouse', 'onKey');
      await settle();
      expect(host.querySelector('.rail__badge')!.textContent).toBe('2');
      expect(host.querySelector('#rail-tab-callbacks')!.textContent).toContain('2 on');
      unmount(host);
    } finally {
      media.restore();
    }
  });
});

describe('BB-SHELL-35: Hide folds the panel and any rail item brings it back', () => {
  it('toggles Hide and Show, leaves no tab selected while hidden, and ignores a click on the open item', async () => {
    const media = mediaQuery(false);
    try {
      useVamsStore.setState({ railPanel: 'scene', railHidden: false });
      const host = mount(h(Rail, {}));
      await settle();
      const hide = host.querySelector('.rail__hide') as HTMLButtonElement;
      expect(hide.textContent).toContain('Hide');
      expect(hide.getAttribute('aria-expanded')).toBe('true');
      (host.querySelector('#rail-tab-scene') as HTMLButtonElement).click();
      expect(useVamsStore.getState().railHidden).toBe(false);
      hide.click();
      await settle();
      expect(useVamsStore.getState().railHidden).toBe(true);
      expect(hide.textContent).toContain('Show');
      expect(host.querySelectorAll('[role="tab"][aria-selected="true"]')).toHaveLength(0);
      (host.querySelector('#rail-tab-add') as HTMLButtonElement).click();
      await settle();
      expect(useVamsStore.getState().railHidden).toBe(false);
      expect(useVamsStore.getState().railPanel).toBe('add');
      unmount(host);
    } finally {
      media.restore();
    }
  });
});

describe('BB-SHELL-36: The rail pill tokens exist in both themes', () => {
  it('declares --rail-pill-hover and --rail-pill-active for light and dark', async () => {
    const { readFileSync } = await import('node:fs');
    const scss = readFileSync('src/shared/styles/_tokens.scss', 'utf8');
    for (const token of ['--rail-pill-hover', '--rail-pill-active']) {
      expect(scss.split(`${token}:`).length - 1).toBe(2);
    }
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/black-box/editor-shell.test.ts`
Expected: FAIL: `Failed to resolve import "@/widgets/layout/rail"`.

- [ ] **Step 3: Move the narrow-layout hook to shared**

```bash
git mv src/pages/editor/model/useNarrowLayout.ts src/shared/hooks/useNarrowLayout.ts
```

Change its doc comment to `/** True below 1100 CSS px, where the editor panel becomes a drawer beside the rail. */`. In `src/pages/editor/ui/EditorShell.tsx`, change the import to `import { useNarrowLayout } from '@/shared/hooks/useNarrowLayout';`. Run `grep -rn "useNarrowLayout" src tests` and update any other import.

- [ ] **Step 4: Add the tokens**

In `src/shared/styles/_tokens.scss`, add these two lines in the `:root` block right after `--accent-tint: …;`, and the same two lines in the `[data-theme='dark']` block right after its `--accent-tint: …;`:

```scss
  --rail-pill-hover: var(--paper-sunken);
  --rail-pill-active: var(--accent-tint);
```

- [ ] **Step 5: Write the rail**

Create `src/widgets/layout/rail/Rail.tsx`:

```tsx
import { useRef } from 'react';
import { Layers, PanelLeftClose, PanelLeftOpen, SlidersHorizontal, SquarePlus, Zap, type LucideIcon } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import type { RailPanel } from '@/core/store/types';
import { CALLBACK_KINDS, isCallbackValid } from '@/core/callbacks/callbacks-model';
import { useNarrowLayout } from '@/shared/hooks/useNarrowLayout';
import './rail.scss';

interface RailItem {
  id: RailPanel;
  label: string;
  icon: LucideIcon;
}

/** Building the scene; the divider then sets Callbacks, which runs it, apart. */
const BUILD: readonly RailItem[] = [
  { id: 'add', label: 'Add', icon: SquarePlus },
  { id: 'scene', label: 'Scene', icon: Layers },
  { id: 'settings', label: 'Settings', icon: SlidersHorizontal },
];
const RUN: readonly RailItem[] = [{ id: 'callbacks', label: 'Callbacks', icon: Zap }];

export const RAIL_ORDER: readonly RailPanel[] = ['add', 'scene', 'settings', 'callbacks'];
export const EDITOR_PANEL_ID = 'editor-panel';
export const railTabId = (panel: RailPanel) => `rail-tab-${panel}`;

/** The slim labelled rail: one tab per panel, and Hide. */
export default function Rail() {
  const railPanel = useVamsStore((s) => s.railPanel);
  const railHidden = useVamsStore((s) => s.railHidden);
  const setRailPanel = useVamsStore((s) => s.setRailPanel);
  const setRailHidden = useVamsStore((s) => s.setRailHidden);
  const callbackCount = useVamsStore((s) => CALLBACK_KINDS.filter((kind) => isCallbackValid(s.callbacks, kind)).length);
  const narrow = useNarrowLayout();
  const tabs = useRef<Partial<Record<RailPanel, HTMLButtonElement | null>>>({});

  const choose = (panel: RailPanel) => {
    // On a narrow screen the open panel's own item closes the drawer again.
    if (narrow && panel === railPanel && !railHidden) setRailHidden(true);
    else setRailPanel(panel);
  };

  // Arrow keys move focus between tabs; Enter or Space (the button's own click) opens one.
  const onKeyDown = (event: KeyboardEvent) => {
    const index = RAIL_ORDER.indexOf((event.target as HTMLElement).dataset.panel as RailPanel);
    if (index < 0) return;
    const to = ({ ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: RAIL_ORDER.length - 1 } as Record<string, number>)[event.key];
    if (to === undefined) return;
    event.preventDefault();
    tabs.current[RAIL_ORDER[(to + RAIL_ORDER.length) % RAIL_ORDER.length]]?.focus();
  };

  const tab = (item: RailItem) => {
    const active = !railHidden && item.id === railPanel;
    const Icon = item.icon;
    const badge = item.id === 'callbacks' && callbackCount > 0;
    return (
      <button
        key={item.id}
        ref={(el) => {
          tabs.current[item.id] = el;
        }}
        id={railTabId(item.id)}
        type="button"
        role="tab"
        className={active ? 'rail__tab is-active' : 'rail__tab'}
        aria-selected={active ? 'true' : 'false'}
        aria-controls={EDITOR_PANEL_ID}
        tabIndex={item.id === railPanel ? 0 : -1}
        data-panel={item.id}
        data-tour-anchor={item.id === 'add' ? 'rail-add' : undefined}
        onClick={() => choose(item.id)}
      >
        <span className="rail__pill" aria-hidden="true">
          <Icon size={20} />
          {badge && <span className="rail__badge">{callbackCount}</span>}
        </span>
        <span className="rail__label">{item.label}</span>
        {badge && <span className="sr-only">, {callbackCount} on</span>}
      </button>
    );
  };

  return (
    <nav className="rail" aria-label="Editor">
      <div className="rail__tabs" role="tablist" aria-orientation="vertical" aria-label="Editor panels" onKeyDown={onKeyDown}>
        {BUILD.map(tab)}
        <span className="rail__divider" aria-hidden="true" />
        {RUN.map(tab)}
      </div>
      <button
        type="button"
        className="rail__hide"
        aria-controls={EDITOR_PANEL_ID}
        aria-expanded={!railHidden}
        onClick={() => setRailHidden(!railHidden)}
      >
        <span className="rail__pill" aria-hidden="true">
          {railHidden ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </span>
        <span className="rail__label">{railHidden ? 'Show' : 'Hide'}</span>
      </button>
    </nav>
  );
}
```

Create `src/widgets/layout/rail/rail.scss`:

```scss
// The rail: a 64 px column of pills. The open panel's pill fills with the accent tint.
.rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  min-height: 0;
  padding: var(--space-2) 0;
  border-right: 1px solid var(--rule);
  background: var(--paper);

  &__tabs {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
  }

  &__tab,
  &__hide {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    width: 60px;
    padding: 4px 0;
    border: 0;
    border-radius: var(--radius-m);
    background: none;
    color: var(--ink-muted);
    font: inherit;
    cursor: pointer;

    &:hover .rail__pill { background: var(--rail-pill-hover); }

    &:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 0;
    }
  }

  &__pill {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 30px;
    border-radius: 15px;
    transition: background-color 0.12s ease;
  }

  &__label {
    font-size: var(--text-xs);
    line-height: 1.2;
  }

  &__tab.is-active {
    color: var(--ink);

    .rail__pill,
    &:hover .rail__pill {
      background: var(--rail-pill-active);
      color: var(--accent-text);
    }

    .rail__label { font-weight: 600; }
  }

  &__divider {
    width: 32px;
    height: 1px;
    margin: var(--space-1) 0;
    background: var(--rule);
  }

  &__badge {
    position: absolute;
    top: -3px;
    right: 4px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: var(--accent);
    color: var(--on-accent);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: 16px;
    text-align: center;
  }

  &__hide { margin-top: auto; }
}

@media (prefers-reduced-motion: reduce) {
  .rail__pill { transition: none; }
}
```

Create `src/widgets/layout/rail/index.ts`:

```ts
export { default, RAIL_ORDER, EDITOR_PANEL_ID, railTabId } from './Rail';
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx vitest run tests/black-box/editor-shell.test.ts`
Expected: PASS for BB-SHELL-32 to 36 (and every earlier BB-SHELL test, including 22 to 24 on the new stylesheet).

- [ ] **Step 7: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test && git checkout -- tests/reports
git add src/widgets/layout/rail/Rail.tsx src/widgets/layout/rail/rail.scss src/widgets/layout/rail/index.ts src/shared/hooks/useNarrowLayout.ts src/pages/editor/model/useNarrowLayout.ts src/pages/editor/ui/EditorShell.tsx src/shared/styles/_tokens.scss tests/black-box/editor-shell.test.ts
git diff --staged --stat
git commit -m "feat(editor): add the slim labelled rail"
```

---

### Task 4: The Scene and Settings panels

**Files:**
- Create: `src/widgets/layout/editor-column/ScenePanel.tsx`, `SettingsPanel.tsx`, `ObjectInspector.tsx`, `use-group-focus.ts`, `src/features/text-nodes/ui/TextEditField.tsx`
- Move: `src/widgets/layout/editor-column/scroll-under-card.ts` → `scroll-into-root.ts`
- Modify: `src/widgets/layout/editor-column/EditorColumn.tsx`, `Inspector.tsx` (import of the moved scroll helper only), `index.ts`, `editor-column.scss`, `src/features/text-nodes/ui/TextNodePanel.tsx`
- Test: `tests/black-box/editor-panels.test.ts` (BB-PANEL-29, 30), `tests/black-box/editor-shell.test.ts` (BB-SHELL-15 updated), `tests/black-box/editor-inspector.test.ts` (BB-INSP-09, 10 updated)

**Interfaces:**
- Consumes: Task 1's `setRailPanel`, `DEFAULT_OPEN_GROUPS`.
- Produces:
  - `ScenePanel`, `SettingsPanel`, `ObjectInspector` exported from `@/widgets/layout/editor-column`.
  - DOM shared by every panel: `section.rail-panel` > `header.rail-panel__head` > `h2.rail-panel__title` plus `.rail-panel__count` (Scene) or `p.rail-panel__hint`; a scrolling `div.rail-panel__body[data-scroll-root]` (Settings; Add and Callbacks in Task 5).
  - ObjectInspector: `div.inspector[data-scroll-root]` with `.inspector__name`, `.inspector__meta`, the groups; with nothing selected `div.inspector.inspector--empty` with `p.inspector__empty` ("Select an object to edit it") and `button.inspector__link` ("Scene settings are in Settings").
  - `useGroupFocus(defs, area, hasSelection, rootRef): { target: InspectorGroupId | null; style: FocusStyle }` in `use-group-focus.ts`.
  - `scrollIntoRoot(el)` in `scroll-into-root.ts`.
  - `TextEditField` default export from `@/features/text-nodes/ui/TextEditField`: renders the "Edit text" textarea for a selected text object, nothing otherwise.

- [ ] **Step 1: Write the failing tests**

In `tests/black-box/editor-panels.test.ts`, add the imports `import { ScenePanel, SettingsPanel } from '@/widgets/layout/editor-column';` and `import { DEFAULT_OPEN_GROUPS } from '@/core/inspector';`, and append:

```ts
describe('BB-PANEL-29: The Scene panel lists the scene above the selected object’s groups', () => {
  it('shows the count, the empty state with a way to Settings, and the object’s groups in pipeline order', async () => {
    const host = mount(h(ScenePanel, {}));
    await settle();
    expect(host.querySelector('.rail-panel__title')!.textContent).toBe('Scene');
    expect(host.querySelector('.rail-panel__count')!.textContent).toBe('0 objects');
    expect(host.querySelector('.inspector__empty')!.textContent).toBe('Select an object to edit it');
    useVamsStore.setState({ railPanel: 'scene' });
    (host.querySelector('.inspector__link') as HTMLButtonElement).click();
    expect(useVamsStore.getState().railPanel).toBe('settings');
    const tri = addTriangle();
    await settle();
    expect(host.querySelector('.rail-panel__count')!.textContent).toBe('1 object');
    expect(host.querySelector('[data-panel-id="scene-hierarchy"]')).not.toBeNull();
    expect([...host.querySelectorAll('.inspector-group__title')].map((t) => t.textContent))
      .toEqual(['Vertices', 'Buffers', 'Transform', 'Appearance', 'Texture']);
    expect(host.querySelector('.inspector__name')!.textContent).toBe(tri.name);
    expect(host.querySelector('textarea[aria-label="Edit text"]')).toBeNull();
    useVamsStore.getState().addTextObject('Hello', 0, 0);
    await settle();
    expect((host.querySelector('textarea[aria-label="Edit text"]') as HTMLTextAreaElement).value).toBe('Hello');
    unmount(host);
  });
});

describe('BB-PANEL-30: The Settings panel holds the scene-wide groups, all open', () => {
  it('lists Background, Viewing volume and Texture library, open, with no Callbacks', async () => {
    useVamsStore.setState({ openGroups: [...DEFAULT_OPEN_GROUPS] });
    const host = mount(h(SettingsPanel, {}));
    await settle();
    expect(host.querySelector('.rail-panel__title')!.textContent).toBe('Settings');
    expect(host.querySelector('.rail-panel__hint')!.textContent).toBe('These apply to the whole scene.');
    expect([...host.querySelectorAll('.inspector-group__title')].map((t) => t.textContent))
      .toEqual(['Background', 'Viewing volume', 'Texture library']);
    for (const header of host.querySelectorAll('.inspector-group__header')) expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('[data-group="callbacks"]')).toBeNull();
    expect(host.querySelector('.rail-panel__body')!.hasAttribute('data-scroll-root')).toBe(true);
    unmount(host);
  });
});
```

In `tests/black-box/editor-shell.test.ts`, change the editor-column import to `import { EditorColumn, ObjectInspector, SettingsPanel } from '@/widgets/layout/editor-column';` and replace BB-SHELL-15 with:

```ts
describe('BB-SHELL-15: The inspector shows the object in pipeline order; the scene settings have their own panel', () => {
  const groupTitles = (host: HTMLElement) => [...host.querySelectorAll('.inspector-group__title')].map((t) => t.textContent);

  it('orders object groups, shows an empty state without a selection, and keeps settings in Settings', async () => {
    const tri = addTriangle();
    useVamsStore.setState({ appMode: 'Author', selectedObjectId: tri.id });
    const host = mount(h(ObjectInspector, {}));
    await settle();
    expect(groupTitles(host)).toEqual(['Vertices', 'Buffers', 'Transform', 'Appearance', 'Texture']);
    expect(host.querySelector('[data-group="transform"] .inspector-group__header')!.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('[data-group="vertices"] .inspector-group__header')!.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('[data-group="transform"] .inspector-group__hint')!.textContent).toContain('glTranslatef');
    useVamsStore.setState({ selectedObjectId: null });
    await settle();
    expect(groupTitles(host)).toEqual([]);
    expect(host.querySelector('.inspector__empty')).not.toBeNull();
    unmount(host);
    const settings = mount(h(SettingsPanel, {}));
    await settle();
    expect(groupTitles(settings)).toEqual(['Background', 'Viewing volume', 'Texture library']);
    unmount(settings);
    useVamsStore.setState({ objects: [] });
  });

  it('leaves out Line style for a triangle and the Texture group for a line', async () => {
    const line = addPrimitive('LINES', [{ x: -0.5, y: 0 }, { x: 0.5, y: 0 }]);
    useVamsStore.setState({ appMode: 'Author', selectedObjectId: line.id });
    const host = mount(h(ObjectInspector, {}));
    await settle();
    expect(host.querySelector('[data-group="texture"]')).toBeNull();
    useVamsStore.getState().toggleGroup('appearance');
    await settle();
    expect(host.querySelector('[data-panel-id="line-style-panel"]')).not.toBeNull();
    const tri = addTriangle();
    useVamsStore.setState({ selectedObjectId: tri.id });
    await settle();
    expect(host.querySelector('[data-panel-id="line-style-panel"]')).toBeNull();
    expect(host.querySelector('[data-group="texture"]')).not.toBeNull();
    unmount(host);
    useVamsStore.setState({ objects: [], selectedObjectId: null, openGroups: [...DEFAULT_OPEN_GROUPS] });
  });

  it('shows only Transform for a group, with its child count', async () => {
    const tri = addTriangle();
    const line = addPrimitive('LINES', [{ x: -0.5, y: 0 }, { x: 0.5, y: 0 }]);
    useVamsStore.setState({ appMode: 'Author' });
    useVamsStore.getState().createGroup([tri.id, line.id]);
    const group = useVamsStore.getState().objects.find((o) => o.type === 'GROUP')!;
    expect(useVamsStore.getState().selectedObjectId).toBe(group.id);
    const host = mount(h(ObjectInspector, {}));
    await settle();
    expect(groupTitles(host)).toEqual(['Transform']);
    expect(host.querySelector('.inspector__meta')!.textContent).toBe('Group · 2 objects');
    unmount(host);
    useVamsStore.setState({ objects: [], selectedObjectId: null });
  });
});
```

(Add `import { DEFAULT_OPEN_GROUPS } from '@/core/inspector';` to `editor-shell.test.ts` if it is not imported yet.)

In `tests/black-box/editor-inspector.test.ts`:
- BB-INSP-09: import `SettingsPanel` from `@/widgets/layout/editor-column/SettingsPanel` instead of `Inspector`, mount it, and replace `expect(host.querySelector('.inspector__name')!.textContent).toBe('Scene settings');` with `expect(host.querySelector('.rail-panel__title')!.textContent).toBe('Settings');`. Keep the other assertions.
- BB-INSP-10: import `ObjectInspector` from `@/widgets/layout/editor-column/ObjectInspector` instead of `Inspector` and mount it. Keep the assertions.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/black-box/editor-panels.test.ts tests/black-box/editor-shell.test.ts tests/black-box/editor-inspector.test.ts`
Expected: FAIL: `ScenePanel`, `SettingsPanel` and `ObjectInspector` are not exported.

- [ ] **Step 3: Rename the scroll helper**

```bash
git mv src/widgets/layout/editor-column/scroll-under-card.ts src/widgets/layout/editor-column/scroll-into-root.ts
```

Replace its content with:

```ts
/** Gap left above the place scrolled to. */
const GAP = 8;

/**
 * Scrolls the nearest `[data-scroll-root]` so `el` sits at its top. Measured from the boxes, so it
 * works at any nesting depth.
 */
export function scrollIntoRoot(el: HTMLElement | null | undefined) {
  const root = el?.closest<HTMLElement>('[data-scroll-root]');
  if (!el || !root) return;
  const offset = el.getBoundingClientRect().top - root.getBoundingClientRect().top;
  root.scrollTop = Math.max(0, root.scrollTop + offset - GAP);
}
```

In `EditorColumn.tsx` and `Inspector.tsx`, change `import { scrollUnderCard } from './scroll-under-card';` to `import { scrollIntoRoot } from './scroll-into-root';` and rename the calls.

- [ ] **Step 4: Share the lesson focus between the inspector and Settings**

Create `src/widgets/layout/editor-column/use-group-focus.ts`:

```ts
import { useLayoutEffect, type RefObject } from 'react';
import { useVamsStore } from '@/core/store';
import { resolveFocus, type InspectorGroupId } from '@/core/inspector';
import { getLessonById } from '@/features/lesson-engine/model/lesson-registry';
import { focusStyleFor, type FocusStyle } from '@/features/lesson-engine/model/guidance';
import type { GroupDef } from './inspector-groups';
import { scrollIntoRoot } from './scroll-into-root';

/**
 * The lesson step's group among `defs`, and how tightly the lesson focuses it. Each step opens its
 * group; a demo also collapses the others, which the student can reopen. Only a group the panel
 * shows can be focused: a line has no Texture group, so a step aimed at one changes nothing. The
 * scroll waits a frame, so it measures the layout after the collapse.
 */
export function useGroupFocus(
  defs: readonly GroupDef[],
  area: 'object' | 'settings',
  hasSelection: boolean,
  rootRef: RefObject<HTMLElement>,
): { target: InspectorGroupId | null; style: FocusStyle } {
  const setOpenGroups = useVamsStore((s) => s.setOpenGroups);
  const openGroup = useVamsStore((s) => s.openGroup);
  const lessonId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.activeLessonId : null));
  const focusPanelId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.lessonFocusPanel : null));
  const stepIndex = useVamsStore((s) => s.currentStepIndex);

  const lesson = lessonId ? getLessonById(lessonId) : undefined;
  const style: FocusStyle = lesson ? focusStyleFor(lesson) : 'none';
  const place = resolveFocus(focusPanelId, hasSelection);
  const group = place && place.area === area ? place.group : null;
  const target = group && defs.some((def) => def.id === group) ? group : null;

  useLayoutEffect(() => {
    if (!target) return;
    if (style === 'tight') setOpenGroups([target]);
    else openGroup(target);
    const frame = requestAnimationFrame(() =>
      scrollIntoRoot(rootRef.current?.querySelector<HTMLElement>(`[data-group="${target}"]`)),
    );
    return () => cancelAnimationFrame(frame);
  }, [target, style, stepIndex, lessonId, setOpenGroups, openGroup, rootRef]);

  return { target, style };
}
```

- [ ] **Step 5: Split the text edit field out of Create Text**

Create `src/features/text-nodes/ui/TextEditField.tsx`:

```tsx
import './text-node-panel.scss';
import { Edit3 } from 'lucide-react';
import { useVamsStore } from '@/core/store';

/** The selected text object's text. Renders nothing for other objects. */
export default function TextEditField() {
  const selected = useVamsStore((s) => s.objects.find((o) => o.id === s.selectedObjectId) ?? null);
  const updateTextContent = useVamsStore((s) => s.updateTextContent);
  if (selected?.type !== 'TEXT') return null;
  return (
    <div className="text-edit">
      <span className="vfield-label text-edit__label">
        <Edit3 size={14} aria-hidden="true" />
        <span>Edit Selected Text</span>
      </span>
      <textarea
        value={selected.textContent || ''}
        aria-label="Edit text"
        onChange={(e) => updateTextContent(selected.id, e.currentTarget.value)}
        className="vfield-input text-edit__area"
        rows={3}
      />
    </div>
  );
}
```

In `TextNodePanel.tsx`, replace the whole `{isTextSelected && ( <div className="text-edit"> … </div> )}` block with `<TextEditField />`, import it (`import TextEditField from './TextEditField';`), and remove what becomes unused (`objects`, `selectedObjectId`, `updateTextContent`, `selectedObject`, `isTextSelected`, the `Edit3` icon import).

- [ ] **Step 6: Write the object inspector and the two panels**

Create `src/widgets/layout/editor-column/ObjectInspector.tsx`:

```tsx
import { useRef } from 'react';
import { useVamsStore } from '@/core/store';
import type { SceneNode } from '@/core/types/scene';
import TextEditField from '@/features/text-nodes/ui/TextEditField';
import { PanelLayoutContext } from '@/shared/ui/controls';
import InspectorGroup from './InspectorGroup';
import { OBJECT_GROUP_DEFS } from './inspector-groups';
import { useGroupFocus } from './use-group-focus';

function metaLine(object: SceneNode): string {
  if (object.type === 'TEXT') return 'Bitmap text';
  if (object.type === 'GROUP') {
    const n = object.children?.length ?? 0;
    return `Group · ${n === 1 ? '1 object' : `${n} objects`}`;
  }
  return `GL_${object.type} · ${object.vertices.length} vertices`;
}

/** The selected object's groups in pipeline order. Scrolls on its own, under the scene list. */
export default function ObjectInspector() {
  const selected = useVamsStore((s) => s.objects.find((o) => o.id === s.selectedObjectId) ?? null);
  const openGroups = useVamsStore((s) => s.openGroups);
  const toggleGroup = useVamsStore((s) => s.toggleGroup);
  const setRailPanel = useVamsStore((s) => s.setRailPanel);
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');
  const focusPanelId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.lessonFocusPanel : null));
  const rootRef = useRef<HTMLDivElement>(null);

  const defs = selected ? OBJECT_GROUP_DEFS.filter((def) => !def.applies || def.applies(selected)) : [];
  const { target, style } = useGroupFocus(defs, 'object', selected !== null, rootRef);

  if (!selected) {
    return (
      <div className="inspector inspector--empty">
        <p className="inspector__empty">Select an object to edit it</p>
        <button type="button" className="inspector__link" onClick={() => setRailPanel('settings')}>
          Scene settings are in Settings
        </button>
      </div>
    );
  }

  return (
    <PanelLayoutContext.Provider value={{ mode: inLesson ? 'lesson' : 'author', focusPanelId, embedded: true }}>
      <div ref={rootRef} className="inspector" data-scroll-root>
        <div className="inspector__head">
          <h3 className="inspector__name">{selected.name}</h3>
          <span className="inspector__meta">{metaLine(selected)}</span>
        </div>
        <TextEditField />
        {defs.map((def) => (
          <InspectorGroup
            key={def.id}
            id={def.id}
            title={def.title}
            hint={def.hint(selected)}
            open={openGroups.includes(def.id)}
            onToggle={() => toggleGroup(def.id)}
            focused={def.id === target}
            dimmed={style === 'tight' && target !== null && def.id !== target}
          >
            {def.render(selected)}
          </InspectorGroup>
        ))}
      </div>
    </PanelLayoutContext.Provider>
  );
}
```

Create `src/widgets/layout/editor-column/SettingsPanel.tsx`:

```tsx
import { useRef } from 'react';
import { useVamsStore } from '@/core/store';
import { PanelLayoutContext } from '@/shared/ui/controls';
import InspectorGroup from './InspectorGroup';
import { SETTINGS_GROUP_DEFS } from './inspector-groups';
import { useGroupFocus } from './use-group-focus';

/** Callbacks has its own rail panel; Task 5 removes it from SETTINGS_GROUP_DEFS and this filter. */
const DEFS = SETTINGS_GROUP_DEFS.filter((def) => def.id !== 'callbacks');

/** Settings for the whole scene: Background, Viewing volume and Texture library. */
export default function SettingsPanel() {
  const hasSelection = useVamsStore((s) => s.selectedObjectId !== null);
  const openGroups = useVamsStore((s) => s.openGroups);
  const toggleGroup = useVamsStore((s) => s.toggleGroup);
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');
  const focusPanelId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.lessonFocusPanel : null));
  const rootRef = useRef<HTMLDivElement>(null);
  const { target, style } = useGroupFocus(DEFS, 'settings', hasSelection, rootRef);

  return (
    <PanelLayoutContext.Provider value={{ mode: inLesson ? 'lesson' : 'author', focusPanelId, embedded: true }}>
      <section className="rail-panel settings-panel" aria-labelledby="settings-panel-title">
        <header className="rail-panel__head">
          <h2 id="settings-panel-title" className="rail-panel__title">Settings</h2>
          <p className="rail-panel__hint">These apply to the whole scene.</p>
        </header>
        <div ref={rootRef} className="rail-panel__body" data-scroll-root>
          {DEFS.map((def) => (
            <InspectorGroup
              key={def.id}
              id={def.id}
              title={def.title}
              hint={def.hint(null)}
              open={openGroups.includes(def.id)}
              onToggle={() => toggleGroup(def.id)}
              focused={def.id === target}
              dimmed={style === 'tight' && target !== null && def.id !== target}
            >
              {def.render(null)}
            </InspectorGroup>
          ))}
        </div>
      </section>
    </PanelLayoutContext.Provider>
  );
}
```

Create `src/widgets/layout/editor-column/ScenePanel.tsx`:

```tsx
import { useVamsStore } from '@/core/store';
import SceneHierarchyPanel from '@/features/scene-hierarchy/ui/SceneHierarchyPanel';
import { PanelLayoutContext } from '@/shared/ui/controls';
import ObjectInspector from './ObjectInspector';

/** The scene's objects above the selected object's inspector. */
export default function ScenePanel() {
  const count = useVamsStore((s) => s.objects.length);
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');
  const focusPanelId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.lessonFocusPanel : null));
  return (
    <section className="rail-panel scene-panel" aria-labelledby="scene-panel-title">
      <header className="rail-panel__head">
        <h2 id="scene-panel-title" className="rail-panel__title">Scene</h2>
        <span className="rail-panel__count">{count === 1 ? '1 object' : `${count} objects`}</span>
      </header>
      <PanelLayoutContext.Provider value={{ mode: inLesson ? 'lesson' : 'author', focusPanelId, embedded: true }}>
        <div className="scene-panel__list">
          <SceneHierarchyPanel />
        </div>
      </PanelLayoutContext.Provider>
      <ObjectInspector />
    </section>
  );
}
```

In `src/widgets/layout/editor-column/index.ts`, add:

```ts
export { default as ScenePanel } from './ScenePanel';
export { default as SettingsPanel } from './SettingsPanel';
export { default as ObjectInspector } from './ObjectInspector';
```

- [ ] **Step 7: Style the panels**

Append to `src/widgets/layout/editor-column/editor-column.scss`:

```scss
// A rail panel: a header, then a body that scrolls on its own.
.rail-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;

  &__head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px var(--space-2);
    padding: var(--space-3) var(--space-3) var(--space-2);
  }

  &__title {
    margin: 0;
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--ink);
  }

  &__count {
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  &__hint {
    flex-basis: 100%;
    margin: 0;
    font-size: var(--text-sm);
    line-height: var(--lh-sm);
    color: var(--ink-muted);
  }

  &__body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  }
}

.scene-panel {
  &__list { flex: none; }

  .inspector {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    border-top: 1px solid var(--rule);
  }
}

.inspector--empty {
  display: grid;
  align-content: start;
  gap: var(--space-1);
  padding: var(--space-4) var(--space-3);
}

.inspector__empty {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--ink-muted);
}

.inspector__link {
  justify-self: start;
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent-text);
  font: inherit;
  font-size: var(--text-sm);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
}
```

The `.inspector__name` rule in this file targets the class, so the `h3` keeps its look.

- [ ] **Step 8: Run the tests to see them pass**

Run: `npx vitest run tests/black-box/editor-panels.test.ts tests/black-box/editor-shell.test.ts tests/black-box/editor-inspector.test.ts`
Expected: PASS, including BB-PANEL-29, 30 and the updated BB-SHELL-15, BB-INSP-09 and 10.

- [ ] **Step 9: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test && git checkout -- tests/reports
git add src/widgets/layout/editor-column/ScenePanel.tsx src/widgets/layout/editor-column/SettingsPanel.tsx src/widgets/layout/editor-column/ObjectInspector.tsx src/widgets/layout/editor-column/use-group-focus.ts src/widgets/layout/editor-column/scroll-into-root.ts src/widgets/layout/editor-column/scroll-under-card.ts src/widgets/layout/editor-column/EditorColumn.tsx src/widgets/layout/editor-column/Inspector.tsx src/widgets/layout/editor-column/index.ts src/widgets/layout/editor-column/editor-column.scss src/features/text-nodes/ui/TextEditField.tsx src/features/text-nodes/ui/TextNodePanel.tsx tests/black-box/editor-panels.test.ts tests/black-box/editor-shell.test.ts tests/black-box/editor-inspector.test.ts
git diff --staged --stat
git commit -m "feat(editor): add the Scene and Settings panels"
```

---

### Task 5: The panel host, the Add and Callbacks panels, and the four-track grid

**Files:**
- Create: `src/widgets/layout/editor-column/EditorPanel.tsx`, `AddPanel.tsx`, `CallbacksRailPanel.tsx`
- Delete: `src/widgets/layout/editor-column/EditorColumn.tsx`, `SceneArea.tsx`, `Inspector.tsx`
- Modify: `src/widgets/layout/editor-column/index.ts`, `inspector-groups.tsx`, `SettingsPanel.tsx`, `editor-column.scss`; `src/pages/editor/ui/EditorShell.tsx`, `editor-app.scss`, `EditorApp.tsx`; `src/features/callbacks/ui/CallbacksPanel.tsx`, `src/features/callbacks/model/rule-copy.ts`; `src/widgets/canvas/ui/CanvasOverlays.tsx`; `src/features/custom-shapes/ui/CustomShapeBuilderPanel.tsx` and its stylesheet; `src/features/text-nodes/ui/TextNodePanel.tsx`; `src/core/store/types.ts`, `runtime-slice.ts`
- Test: `tests/black-box/editor-shell.test.ts` (BB-SHELL-14, 25 updated; 37 to 39 new), `tests/black-box/lesson-column.test.ts` (BB-LCOL-06, 10 to 12, 15, 24 updated), `tests/black-box/editor-panels.test.ts` (BB-PANEL-10, 11, 23 to 28 updated; 31 new), `tests/black-box/run-mode.test.ts` (BB-RUN-14's Try it case removed), `tests/black-box/callbacks.test.ts` (`CALLBACKS_NOTE` removed)

**Interfaces:**
- Consumes: Task 1 state; Task 3 `Rail`, `railTabId`, `EDITOR_PANEL_ID`, `useNarrowLayout`; Task 4 panels and `scrollIntoRoot`.
- Produces:
  - `EditorPanel`, `AddPanel`, `CallbacksRailPanel` exported from `@/widgets/layout/editor-column`. `EditorPanel` renders `div.editor-panel` holding the open panel. `AddPanel` renders `section.rail-panel.add-panel` with the body `div.rail-panel__body[data-scroll-root]`. `CallbacksRailPanel` adds `p.rail-panel__foot`.
  - `EditorShellProps`: `{ topBar, rail, panel, canvas, lessonBar?, codeMath, overlays? }`. DOM: `.editor` (with `editor--narrow`, `is-panel-hidden`, `is-code-hidden`), `div.editor__rail`, `aside#editor-panel.editor__panel[role="tabpanel"][data-tour-anchor="panel"]`, `main.editor__canvas > div.editor__stage[data-tour-anchor="canvas"]`, `aside.editor__code[data-tour-anchor="code-column"]`.
  - `CallbacksPanel` (feature) renders `div.callbacks-panel[data-panel-id="callbacks-panel"] > ul.cb-list`, no collapsible, no Try it, no note.
  - `addRowCue` and `cueAddRow` no longer exist.

- [ ] **Step 1: Write the failing tests**

In `tests/black-box/editor-shell.test.ts`:
- Change the editor-column import to `import { EditorPanel, ObjectInspector, SettingsPanel } from '@/widgets/layout/editor-column';`, and add `import { runController } from '@/features/callbacks';` and `import { registerFakeRenderer } from '../helpers/fake-renderer';`.
- Add these helpers after `mediaQuery(...)` (from Task 3):

```ts
async function shell(parts: { panel?: VNode; canvas?: VNode } = {}) {
  const { default: EditorShell } = await import('@/pages/editor/ui/EditorShell');
  return mount(h(EditorShell, {
    topBar: h('header', {}, 'top'),
    rail: h(Rail, {}),
    panel: parts.panel ?? h('div', {}, h('button', { id: 'inside' }, 'inside')),
    canvas: parts.canvas ?? h('div', {}, 'canvas'),
    codeMath: h('div', {}, 'code'),
  }));
}
/** Starts a real Run on a fake renderer; returns the cleanup. */
function startRun() {
  addTriangle();
  useVamsStore.getState().setCallbackHandler('keyboard', 'onKey');
  const unregister = registerFakeRenderer(new Map(), { getCanvasSize: () => ({ width: 800, height: 600 }) });
  expect(runController.start({ loop: false })).toBe(true);
  return () => {
    runController.stop();
    unregister();
  };
}
```

- Replace BB-SHELL-14 with:

```ts
describe('BB-SHELL-14: The rail panels are the same in every section', () => {
  it('shows each panel’s controls whatever the section, with no section menu', async () => {
    const tri = addTriangle();
    useVamsStore.setState({ appMode: 'Author', selectedObjectId: tri.id });
    const panels: [string, string[]][] = [
      ['add', ['[data-panel-id="primitive-palette"]', '[data-panel-id="text-node-panel"]']],
      ['scene', ['[data-panel-id="scene-hierarchy"]', '.inspector']],
      ['settings', ['[data-group="background"]']],
      ['callbacks', ['[data-panel-id="callbacks-panel"]']],
    ];
    for (const section of ['Pipeline', 'Primitives', 'Buffers', 'Transforms', 'Textures'] as const) {
      useVamsStore.setState({ activeSection: section });
      for (const [panel, selectors] of panels) {
        useVamsStore.getState().setRailPanel(panel as 'add');
        const host = mount(h(EditorPanel, {}));
        await settle();
        expect(host.querySelector('.section-menu')).toBeNull();
        for (const selector of selectors) expect(host.querySelector(selector)).not.toBeNull();
        unmount(host);
      }
    }
    useVamsStore.setState({ objects: [], selectedObjectId: null });
  });
});
```

- Replace BB-SHELL-25 with:

```ts
describe('BB-SHELL-25: Add a shape opens the Add panel', () => {
  async function addAShape(narrow: boolean) {
    const media = mediaQuery(narrow);
    useVamsStore.setState({ railPanel: 'settings', railHidden: false });
    const host = await shell({
      panel: h(EditorPanel, {}),
      canvas: h(CanvasOverlays, {
        viewportLimits: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
        interactionMode: 'SELECT',
        coordinates: { x: 0, y: 0 },
        showCoordinateTracker: false,
        showEmptyHint: true,
      }),
    });
    try {
      await settle();
      expect(useVamsStore.getState().railHidden).toBe(narrow);
      const add = [...host.querySelectorAll('.empty-canvas-hint button')].find((b) => b.textContent?.trim() === 'Add a shape') as HTMLButtonElement;
      add.click();
      await settle();
      expect(useVamsStore.getState().railPanel).toBe('add');
      expect(useVamsStore.getState().railHidden).toBe(false);
      expect(host.querySelector('.editor')!.classList.contains('is-panel-hidden')).toBe(false);
      expect(host.querySelector('.add-panel')).not.toBeNull();
    } finally {
      unmount(host);
      media.restore();
    }
  }

  it('opens the closed drawer on a narrow screen', async () => {
    await addAShape(true);
  });

  it('switches the panel in the wide layout', async () => {
    await addAShape(false);
  });
});
```

- Append:

```ts
describe('BB-SHELL-37: The editor grid has a rail, a panel, the canvas and the code column', () => {
  it('lays out four regions, folds the panel and the code column, and makes the rail inert during Run', async () => {
    const media = mediaQuery(false);
    useVamsStore.setState({ railPanel: 'scene', railHidden: false, codeHidden: false });
    const host = await shell();
    try {
      await settle();
      const editor = host.querySelector('.editor')!;
      const panel = host.querySelector('#editor-panel')!;
      expect(panel.getAttribute('role')).toBe('tabpanel');
      expect(panel.getAttribute('aria-labelledby')).toBe('rail-tab-scene');
      expect(host.querySelector('.editor__rail .rail')).not.toBeNull();
      expect(host.querySelector('[data-tour-anchor="panel"]')).toBe(panel);
      expect(host.querySelector('.editor__stage')!.getAttribute('data-tour-anchor')).toBe('canvas');
      expect(host.querySelector('.editor__code')!.getAttribute('data-tour-anchor')).toBe('code-column');
      expect(host.querySelector('.editor__panels-toggle')).toBeNull();
      useVamsStore.getState().setRailHidden(true);
      await settle();
      expect(editor.classList.contains('is-panel-hidden')).toBe(true);
      useVamsStore.getState().setCodeHidden(true);
      await settle();
      expect(editor.classList.contains('is-code-hidden')).toBe(true);
      useVamsStore.setState({ railHidden: false, codeHidden: false });
      const stop = startRun();
      await settle();
      expect(host.querySelector('.editor__rail')!.hasAttribute('inert')).toBe(true);
      expect(panel.hasAttribute('inert')).toBe(true);
      stop();
      await settle();
      expect(host.querySelector('.editor__rail')!.hasAttribute('inert')).toBe(false);
    } finally {
      unmount(host);
      media.restore();
    }
  });
});

describe('BB-SHELL-38: On narrow screens the panel is a drawer beside the rail', () => {
  it('opens from the rail, closes from its own item and Esc, and closes when Run starts', async () => {
    const media = mediaQuery(true);
    useVamsStore.setState({ railPanel: 'scene', railHidden: false });
    const host = await shell();
    try {
      await settle();
      const state = () => useVamsStore.getState();
      expect(host.querySelector('.editor')!.classList.contains('editor--narrow')).toBe(true);
      expect(state().railHidden).toBe(true);
      const tab = (id: string) => host.querySelector(`#rail-tab-${id}`) as HTMLButtonElement;
      tab('scene').click();
      await settle();
      expect(state().railHidden).toBe(false);
      tab('scene').click();
      await settle();
      expect(state().railHidden).toBe(true);
      tab('settings').click();
      await settle();
      expect(state().railPanel).toBe('settings');
      expect(state().railHidden).toBe(false);
      const inside = host.querySelector('#inside') as HTMLElement;
      inside.focus();
      key(inside, 'Escape');
      await settle();
      expect(state().railHidden).toBe(true);
      expect(document.activeElement).toBe(tab('settings'));
      state().setRailPanel('scene');
      await settle();
      const stop = startRun();
      await settle();
      expect(state().railHidden).toBe(true);
      stop();
    } finally {
      unmount(host);
      media.restore();
    }
  });
});

describe('BB-SHELL-39: Crossing 1100 px closes the drawer or shows the panel, and never strands focus', () => {
  it('closes the panel into a drawer when the window narrows and shows it again when it widens', async () => {
    const media = mediaQuery(false);
    useVamsStore.setState({ railPanel: 'scene', railHidden: false });
    const host = await shell();
    try {
      await settle();
      const editor = host.querySelector('.editor')!;
      expect(editor.classList.contains('editor--narrow')).toBe(false);
      expect(useVamsStore.getState().railHidden).toBe(false);
      (host.querySelector('#inside') as HTMLElement).focus();
      media.set(true);
      await settle();
      expect(editor.classList.contains('editor--narrow')).toBe(true);
      expect(useVamsStore.getState().railHidden).toBe(true);
      expect(document.activeElement).toBe(host.querySelector('#rail-tab-scene'));
      (host.querySelector('#rail-tab-scene') as HTMLButtonElement).click();
      await settle();
      expect(useVamsStore.getState().railHidden).toBe(false);
      media.set(false);
      await settle();
      expect(editor.classList.contains('editor--narrow')).toBe(false);
      expect(useVamsStore.getState().railHidden).toBe(false);
    } finally {
      unmount(host);
      media.restore();
    }
  });
});
```

In `tests/black-box/lesson-column.test.ts`:
- Replace the `EditorColumn` import with `import { EditorPanel } from '@/widgets/layout/editor-column';`, change `lessonEditor` to `h('div', {}, h(LessonBar, {}), h(EditorPanel, {}))`, and add `import Rail from '@/widgets/layout/rail';`.
- Replace BB-LCOL-06 with:

```ts
describe('BB-LCOL-06: In Lesson mode the lesson bar sits beside the live panels', () => {
  it('shows the bar and the step’s panel, with no lesson card', async () => {
    startLesson('transforms-exercise-1');
    const host = mount(lessonEditor());
    await settle();
    expect(host.querySelector('.lesson-bar')).not.toBeNull();
    expect(host.querySelector('.editor-panel .rail-panel')).not.toBeNull();
    expect(host.querySelector('.lesson-card')).toBeNull();
    unmount(host);
  });
});
```

- Replace `narrowShell` and `panelsToggle` with:

```ts
async function narrowShell(panel: VNode) {
  const { default: Shell } = await import('@/pages/editor/ui/EditorShell');
  return mount(h(Shell, {
    topBar: h('header', {}, 'top'),
    rail: h(Rail, {}),
    panel,
    canvas: h('div', {}, 'canvas'),
    lessonBar: h(LessonBar, {}),
    codeMath: h('div', {}, 'code'),
  }));
}
const drawerOpen = () => !useVamsStore.getState().railHidden;
```

(Keep the static `EditorShell` import only if another test still uses it; otherwise remove it.)

- Replace BB-LCOL-10, 11, 12 and 15 with:

```ts
describe('BB-LCOL-10: On narrow screens Esc in the open drawer closes only the drawer', () => {
  it('keeps the lesson running and returns focus to the rail', async () => {
    const restore = mockNarrow();
    try {
      startLesson('transforms-exercise-1');
      const host = await narrowShell(h('button', { id: 'inside' }, 'inside'));
      await settle();
      useVamsStore.getState().setRailPanel('scene');
      await settle();
      expect(drawerOpen()).toBe(true);
      (host.querySelector('#inside') as HTMLElement).focus();
      key(host.querySelector('#inside')!, 'Escape');
      await settle();
      expect(drawerOpen()).toBe(false);
      expect(document.activeElement).toBe(host.querySelector('#rail-tab-scene'));
      expect(useVamsStore.getState().appMode).toBe('Lesson');
      unmount(host);
    } finally {
      restore();
    }
  });
});

describe('BB-LCOL-11: Esc in a rename field inside the drawer cancels the rename only', () => {
  it('keeps the old name and the drawer open', async () => {
    const restore = mockNarrow();
    try {
      startLesson('transforms-exercise-1');
      const triangle = addTriangle();
      const originalName = triangle.name;
      const host = await narrowShell(h(SceneHierarchyPanel, {}));
      await settle();
      useVamsStore.getState().setRailPanel('scene');
      await settle();
      (host.querySelector('button[aria-label^="Rename"]') as HTMLButtonElement).click();
      await settle();
      const input = host.querySelector('.rename-input') as HTMLInputElement;
      input.focus();
      input.value = 'Typed but cancelled';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
      key(input, 'Escape');
      await settle();
      expect(findById(triangle.id)!.name).toBe(originalName);
      expect(drawerOpen()).toBe(true);
      unmount(host);
    } finally {
      restore();
    }
  });
});

describe('BB-LCOL-12: The drawer closes when the lesson ends', () => {
  it('opens for a step’s panel and closes on exit', async () => {
    const restore = mockNarrow();
    try {
      startLesson('transforms-demo-1');
      const host = await narrowShell(h('div', {}, 'panel'));
      await settle();
      buttonNamed(host, 'Next')!.click();
      await settle();
      expect(useVamsStore.getState().lessonFocusPanel).toBe('object-transform');
      expect(drawerOpen()).toBe(true);
      useVamsStore.getState().clearLessonState();
      useVamsStore.getState().setAppMode('Author');
      await settle();
      expect(drawerOpen()).toBe(false);
      expect(host.querySelector('.editor')!.classList.contains('is-panel-hidden')).toBe(true);
      unmount(host);
    } finally {
      restore();
    }
  });
});

describe('BB-LCOL-15: On narrow screens Esc outside the open drawer closes the drawer first', () => {
  it('closes the drawer from the rail and keeps the lesson running', async () => {
    const restore = mockNarrow();
    try {
      startLesson('transforms-exercise-1');
      const host = await narrowShell(h('div', {}, 'panel'));
      await settle();
      useVamsStore.getState().setRailPanel('scene');
      await settle();
      const tab = host.querySelector('#rail-tab-scene') as HTMLButtonElement;
      tab.focus();
      key(tab, 'Escape');
      await settle();
      expect(drawerOpen()).toBe(false);
      expect(document.activeElement).toBe(tab);
      expect(useVamsStore.getState().appMode).toBe('Lesson');
      // With the drawer closed, Esc exits the lesson again.
      key(tab, 'Escape');
      await settle();
      expect(useVamsStore.getState().appMode).toBe('Author');
      unmount(host);
    } finally {
      restore();
    }
  });
});
```

- Replace BB-LCOL-24 with:

```ts
describe('BB-LCOL-24: Focus on the Scene list shows the Scene panel, and a new lesson starts at the top', () => {
  it('shows and outlines the Scene list when Back returns to its step', async () => {
    startLesson('transforms-demo-1');
    const host = mount(lessonEditor());
    try {
      await settle();
      buttonNamed(host, 'Next')!.click();
      await settle();
      expect(useVamsStore.getState().lessonFocusPanel).toBe('object-transform');
      useVamsStore.setState({ railPanel: 'settings' });
      buttonNamed(host, 'Back')!.click();
      await settle();
      expect(useVamsStore.getState().lessonFocusPanel).toBe('scene-hierarchy');
      expect(useVamsStore.getState().railPanel).toBe('scene');
      expect(host.querySelector('[data-panel-id="scene-hierarchy"]')!.classList.contains('is-lesson-focus')).toBe(true);
    } finally {
      unmount(host);
    }
  });

  it('resets the open panel to the top when a lesson starts', async () => {
    useVamsStore.setState({ railPanel: 'settings', railHidden: false });
    const host = mount(lessonEditor());
    try {
      await settle();
      const root = host.querySelector<HTMLElement>('[data-scroll-root]')!;
      const writes: number[] = [];
      Object.defineProperty(root, 'scrollTop', { configurable: true, get: () => 400, set: (v: number) => writes.push(v) });
      // The section's last exercise has no focus, so nothing else scrolls the panel.
      startLesson('transforms-exercise-4');
      await settle();
      expect(writes).toEqual([0]);
    } finally {
      unmount(host);
    }
  });
});
```

In `tests/black-box/editor-panels.test.ts`:
- In BB-PANEL-10, delete the line that clicks `.vpanel__header`. In `openCallbacks()`, delete the same click so it only mounts.
- Add `import { CallbacksRailPanel } from '@/widgets/layout/editor-column';` (merge with the Task 4 import) and append:

```ts
describe('BB-PANEL-31: The Callbacks panel lists the six callbacks and points to Run', () => {
  it('has its header, hint and footer, and no Run control of its own', async () => {
    const host = mount(h(CallbacksRailPanel, {}));
    await settle();
    expect(host.querySelector('.rail-panel__title')!.textContent).toBe('Callbacks');
    expect(host.querySelector('.rail-panel__hint')!.textContent)
      .toBe('Functions GLUT calls when something happens. Switch one on and give it rules.');
    expect(host.querySelectorAll('.cb-item')).toHaveLength(6);
    expect(host.querySelector('.rail-panel__foot')!.textContent).toBe('Press Run on the canvas to try your callbacks. Esc stops.');
    expect(host.querySelector('.cb-try')).toBeNull();
    expect(host.querySelector('[data-panel-id="callbacks-panel"]')).not.toBeNull();
    unmount(host);
  });
});
```

In `tests/black-box/run-mode.test.ts`, delete the `it('the Try it button is disabled in the illustration state', …)` case from BB-RUN-14 and the now-unused `CallbacksPanel` import (Task 9 adds the canvas-side case to BB-RUN-14).

In `tests/black-box/callbacks.test.ts`, remove `CALLBACKS_NOTE` from the `rule-copy` import and from the list of copy strings checked near line 408.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/black-box/editor-shell.test.ts tests/black-box/lesson-column.test.ts tests/black-box/editor-panels.test.ts`
Expected: FAIL: `EditorPanel` and `CallbacksRailPanel` are not exported, and the shell has no `rail` prop.

- [ ] **Step 3: Strip the Callbacks feature panel to its list**

Replace `src/features/callbacks/ui/CallbacksPanel.tsx` with:

```tsx
import './callbacks-panel.scss';
import { CALLBACK_DEFS } from '../model/rule-copy';
import { CallbackRow } from './CallbackRow';

/** The six GLUT callbacks in table order, each with its switch, handler name, GLUT call and rules. */
export default function CallbacksPanel() {
  return (
    <div className="callbacks-panel" data-panel-id="callbacks-panel">
      <ul className="cb-list">
        {CALLBACK_DEFS.map((def) => <CallbackRow key={def.kind} def={def} />)}
      </ul>
    </div>
  );
}
```

In `src/features/callbacks/model/rule-copy.ts`, delete the `CALLBACKS_NOTE` export. In `callbacks-panel.scss`, delete the `.cb-info`, `.cb-info-icon` and `.cb-try` rules.

- [ ] **Step 4: Write the Add and Callbacks panels and the host**

Create `src/widgets/layout/editor-column/AddPanel.tsx`:

```tsx
import { useVamsStore } from '@/core/store';
import CustomShapeBuilderPanel from '@/features/custom-shapes/ui/CustomShapeBuilderPanel';
import TextNodePanel from '@/features/text-nodes/ui/TextNodePanel';
import { PanelLayoutContext } from '@/shared/ui/controls';

/** Where the student builds: primitives, text, and the prepared scenes. */
export default function AddPanel() {
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');
  const focusPanelId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.lessonFocusPanel : null));
  return (
    <PanelLayoutContext.Provider value={{ mode: inLesson ? 'lesson' : 'author', focusPanelId, embedded: true }}>
      <section className="rail-panel add-panel" aria-labelledby="add-panel-title">
        <header className="rail-panel__head">
          <h2 id="add-panel-title" className="rail-panel__title">Add</h2>
          <p className="rail-panel__hint">Pick a shape, then click the canvas to place its vertices. Enter finishes.</p>
        </header>
        <div className="rail-panel__body" data-scroll-root>
          <CustomShapeBuilderPanel />
          <TextNodePanel />
        </div>
      </section>
    </PanelLayoutContext.Provider>
  );
}
```

Create `src/widgets/layout/editor-column/CallbacksRailPanel.tsx`:

```tsx
import CallbacksPanel from '@/features/callbacks/ui/CallbacksPanel';

/** The Callbacks panel: the six GLUT callbacks and their rules. Run lives on the canvas. */
export default function CallbacksRailPanel() {
  return (
    <section className="rail-panel callbacks-rail-panel" aria-labelledby="callbacks-panel-title">
      <header className="rail-panel__head">
        <h2 id="callbacks-panel-title" className="rail-panel__title">Callbacks</h2>
        <p className="rail-panel__hint">Functions GLUT calls when something happens. Switch one on and give it rules.</p>
      </header>
      <div className="rail-panel__body" data-scroll-root>
        <CallbacksPanel />
      </div>
      <p className="rail-panel__foot">Press Run on the canvas to try your callbacks. Esc stops.</p>
    </section>
  );
}
```

Create `src/widgets/layout/editor-column/EditorPanel.tsx`:

```tsx
import { useLayoutEffect, useRef } from 'react';
import { useVamsStore } from '@/core/store';
import { resolveFocus } from '@/core/inspector';
import AddPanel from './AddPanel';
import ScenePanel from './ScenePanel';
import SettingsPanel from './SettingsPanel';
import CallbacksRailPanel from './CallbacksRailPanel';
import { scrollIntoRoot } from './scroll-into-root';
import './editor-column.scss';

/** The open rail panel. The shell's panel region is the tabpanel; this is what it holds. */
export default function EditorPanel() {
  const railPanel = useVamsStore((s) => s.railPanel);
  const lessonId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.activeLessonId : null));
  const focusPanelId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.lessonFocusPanel : null));
  const stepIndex = useVamsStore((s) => s.currentStepIndex);
  const rootRef = useRef<HTMLDivElement>(null);

  // A new lesson starts with the open panel scrolled to the top.
  const shownLesson = useRef(lessonId);
  useLayoutEffect(() => {
    if (lessonId === shownLesson.current) return;
    shownLesson.current = lessonId;
    if (!lessonId) return;
    rootRef.current?.querySelectorAll<HTMLElement>('[data-scroll-root]').forEach((el) => {
      el.scrollTop = 0;
    });
  }, [lessonId]);

  // A step that focuses the Add row or Create Text scrolls it into view, on every step (Back
  // included). The inspector and Settings scroll their own groups. Wait a frame for the layout.
  const sceneTarget = resolveFocus(focusPanelId, false)?.area === 'scene' ? focusPanelId : null;
  useLayoutEffect(() => {
    if (!sceneTarget) return;
    const frame = requestAnimationFrame(() =>
      scrollIntoRoot(rootRef.current?.querySelector<HTMLElement>(`[data-panel-id="${sceneTarget}"]`)),
    );
    return () => cancelAnimationFrame(frame);
  }, [sceneTarget, stepIndex, lessonId, railPanel]);

  return (
    <div ref={rootRef} className="editor-panel">
      {railPanel === 'add' && <AddPanel />}
      {railPanel === 'scene' && <ScenePanel />}
      {railPanel === 'settings' && <SettingsPanel />}
      {railPanel === 'callbacks' && <CallbacksRailPanel />}
    </div>
  );
}
```

Replace `src/widgets/layout/editor-column/index.ts` with:

```ts
export { default as EditorPanel } from './EditorPanel';
export { default as AddPanel } from './AddPanel';
export { default as ScenePanel } from './ScenePanel';
export { default as SettingsPanel } from './SettingsPanel';
export { default as CallbacksRailPanel } from './CallbacksRailPanel';
export { default as ObjectInspector } from './ObjectInspector';
export { OBJECT_GROUP_DEFS, SETTINGS_GROUP_DEFS, type GroupDef } from './inspector-groups';
```

In `inspector-groups.tsx`, delete the `callbacks` entry from `SETTINGS_GROUP_DEFS` and the `CallbacksPanel` import. In `SettingsPanel.tsx`, delete the `DEFS` filter and its comment and use `SETTINGS_GROUP_DEFS` directly (both places).

Delete `EditorColumn.tsx`, `SceneArea.tsx` and `Inspector.tsx`. In `editor-column.scss`, delete the `.editor-column { … }` and `.scene-area { … }` blocks and append:

```scss
.editor-panel {
  height: 100%;
  min-height: 0;
  background: var(--paper);
}

.rail-panel__foot {
  flex: none;
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--rule);
  font-size: var(--text-sm);
  color: var(--ink-muted);
}
```

- [ ] **Step 5: Retire the Add-row cue**

In `src/core/store/types.ts`, delete `addRowCue` (with its comment) and `cueAddRow`. In `runtime-slice.ts`, delete `addRowCue: 0,` and the `cueAddRow` action.

In `src/widgets/canvas/ui/CanvasOverlays.tsx`, replace `const cueAddRow = useVamsStore((s) => s.cueAddRow);` with `const setRailPanel = useVamsStore((s) => s.setRailPanel);` and the Add a shape button's handler with `onClick={() => setRailPanel('add')}`.

In `src/features/custom-shapes/ui/CustomShapeBuilderPanel.tsx`, delete `CUE_MS`, the `addRowCue` selector, `rowRef`, `fadedCue`, `cued` and the cue `useEffect`, and render the row as `<div className="add-row">`. Remove `useEffect`, `useRef` and `useState` from the React import if they become unused. In its stylesheet, delete the `.is-cued` rules and any keyframes only they used.

In `src/features/text-nodes/ui/TextNodePanel.tsx`, delete `<TextEditField />` and its import: the Scene panel shows that field now.

- [ ] **Step 6: Rebuild the shell on four tracks**

Replace `src/pages/editor/ui/EditorShell.tsx` with:

```tsx
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { ComponentChildren } from 'preact';
import { useVamsStore } from '@/core/store';
import { useRunSnapshot } from '@/features/callbacks';
import { useNarrowLayout } from '@/shared/hooks/useNarrowLayout';
import './editor-app.scss';

export interface EditorShellProps {
  topBar: ComponentChildren;
  /** The rail of panel tabs. */
  rail: ComponentChildren;
  /** The open rail panel. */
  panel: ComponentChildren;
  canvas: ComponentChildren;
  /** The lesson bar, under the canvas. */
  lessonBar?: ComponentChildren;
  codeMath: ComponentChildren;
  /** Dialogs and other overlays rendered after the grid. */
  overlays?: ComponentChildren;
}

/** The editor grid: rail, panel, canvas and code. Below 1100 px the panel is a drawer beside the rail. */
export default function EditorShell({ topBar, rail, panel, canvas, lessonBar, codeMath, overlays }: EditorShellProps) {
  const narrow = useNarrowLayout();
  const railPanel = useVamsStore((s) => s.railPanel);
  const railHidden = useVamsStore((s) => s.railHidden);
  const codeHidden = useVamsStore((s) => s.codeHidden);
  const setRailHidden = useVamsStore((s) => s.setRailHidden);
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');
  const running = useRunSnapshot().running;
  const panelRef = useRef<HTMLElement>(null);

  // A narrow layout starts with the drawer closed; a wide one shows the panel.
  useLayoutEffect(() => {
    setRailHidden(narrow);
  }, [narrow, setRailHidden]);

  // On a narrow screen, Run and the end of a lesson close the drawer so it never covers the canvas.
  useEffect(() => {
    if (narrow && running) setRailHidden(true);
  }, [narrow, running, setRailHidden]);
  const wasInLesson = useRef(inLesson);
  useEffect(() => {
    if (narrow && wasInLesson.current && !inLesson) setRailHidden(true);
    wasInLesson.current = inLesson;
  }, [narrow, inLesson, setRailHidden]);

  // A closed drawer never keeps focus: hand it to the open panel's rail tab.
  useLayoutEffect(() => {
    if (!narrow || !railHidden) return;
    const active = document.activeElement;
    if (active && panelRef.current?.contains(active)) document.getElementById(`rail-tab-${railPanel}`)?.focus();
  }, [narrow, railHidden, railPanel]);

  // While the drawer shows, Esc closes it wherever focus is, and the lesson's window listener
  // never sees that key. The listener sits on document, so it runs after every element handler
  // (a dialog, a menu or a field that used Esc has already called preventDefault) and before window.
  // Text fields keep their own Esc (cancel the edit).
  const drawerOpen = narrow && !railHidden;
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;
      if (target?.closest('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
      event.preventDefault();
      event.stopPropagation();
      setRailHidden(true);
      document.getElementById(`rail-tab-${useVamsStore.getState().railPanel}`)?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, setRailHidden]);

  const classes = [
    'editor',
    narrow ? 'editor--narrow' : '',
    railHidden ? 'is-panel-hidden' : '',
    codeHidden ? 'is-code-hidden' : '',
  ].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      {topBar}
      <div className="editor__rail" inert={running || undefined}>{rail}</div>
      <aside
        ref={panelRef}
        id="editor-panel"
        className="editor__panel"
        role="tabpanel"
        aria-labelledby={`rail-tab-${railPanel}`}
        data-tour-anchor="panel"
        inert={running || undefined}
      >
        {panel}
      </aside>
      <main className="editor__canvas canvas-area">
        <div className="editor__stage" data-tour-anchor="canvas">{canvas}</div>
        {lessonBar}
      </main>
      <aside className="editor__code" aria-label="Code and math" data-tour-anchor="code-column">{codeMath}</aside>
      {overlays}
    </div>
  );
}
```

Replace `src/pages/editor/ui/editor-app.scss` with:

```scss
.editor {
  position: relative;
  display: grid;
  grid-template-rows: 44px minmax(0, 1fr);
  // Track widths as variables, so overlays such as the toaster can centre on the canvas.
  --editor-rail-width: 64px;
  --editor-panel-width: 272px;
  --editor-code-width: clamp(340px, 28vw, 460px);
  grid-template-columns: var(--editor-rail-width) var(--editor-panel-width) minmax(0, 1fr) var(--editor-code-width);
  height: 100vh;
  height: 100dvh;
  width: 100vw;
  overflow: hidden;
  background: var(--paper);

  &__rail {
    position: relative;
    z-index: 31;
    grid-row: 2;
    grid-column: 1;
    min-height: 0;
  }

  &__panel {
    grid-row: 2;
    grid-column: 2;
    min-width: 0;
    min-height: 0;
    border-right: 1px solid var(--rule);
    background: var(--paper);
  }

  &__canvas {
    position: relative;
    grid-row: 2;
    grid-column: 3;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    min-width: 0;
    min-height: 0;
    background-color: rgba(var(--well-rgb), 0.5);
  }

  // The canvas and its overlays. Keeps their z-indexes (the pipeline diagram uses 100) inside the
  // canvas, so the drawer, the lesson bar and the menus always sit above them.
  &__stage {
    position: relative;
    min-width: 0;
    min-height: 0;
    isolation: isolate;
  }

  &__code {
    grid-row: 2;
    grid-column: 4;
    min-width: 0;
    min-height: 0;
  }

  &.is-panel-hidden { --editor-panel-width: 0px; }
  &.is-panel-hidden:not(.editor--narrow) .editor__panel { display: none; }

  &--narrow {
    --editor-panel-width: 0px;
    --editor-code-width: clamp(320px, 34vw, 400px);

    .editor__panel {
      // An absolutely placed grid item is positioned against its grid area: row 2, column 2,
      // which starts right after the rail.
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      z-index: 30;
      width: 272px;
      box-shadow: 8px 0 28px rgba(var(--shadow-rgb), 0.22);
      transform: translateX(-100%);
      visibility: hidden;
      transition: transform 0.2s ease, visibility 0.2s;
    }

    &:not(.is-panel-hidden) .editor__panel {
      transform: none;
      visibility: visible;
    }
  }

  // The hidden code column leaves its 30 px edge tab.
  &.is-code-hidden { --editor-code-width: 30px; }

  // Toasts centre on the canvas column at every width, so they never cover the code and math column.
  [data-sonner-toaster][data-x-position='center'] {
    left: calc(
      var(--editor-rail-width) + var(--editor-panel-width)
      + (100vw - var(--editor-rail-width) - var(--editor-panel-width) - var(--editor-code-width)) / 2
    );
  }
}

@media (prefers-reduced-motion: reduce) {
  .editor--narrow .editor__panel { transition: none; }
}
```

In `src/pages/editor/ui/EditorApp.tsx`, replace the `EditorColumn` import with `import { EditorPanel } from '@/widgets/layout/editor-column';`, add `import Rail from '@/widgets/layout/rail';`, and pass `rail={<Rail />}` and `panel={<EditorPanel />}` (instead of `column={<EditorColumn />}`).

- [ ] **Step 7: Run the tests to see them pass**

Run: `npx vitest run tests/black-box/editor-shell.test.ts tests/black-box/lesson-column.test.ts tests/black-box/editor-panels.test.ts tests/black-box/run-mode.test.ts tests/black-box/callbacks.test.ts`
Expected: PASS, including BB-SHELL-14, 25, 37 to 39, BB-LCOL-06, 10 to 12, 15, 24 and BB-PANEL-31.

- [ ] **Step 8: Search for leftovers**

Run: `grep -rn "EditorColumn\|SceneArea\|cueAddRow\|addRowCue\|editor__panels-toggle\|scrollUnderCard\|CALLBACKS_NOTE" src tests`
Expected: no output. Fix anything it finds.

- [ ] **Step 9: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test && git checkout -- tests/reports
git add src/widgets/layout/editor-column src/pages/editor/ui/EditorShell.tsx src/pages/editor/ui/editor-app.scss src/pages/editor/ui/EditorApp.tsx src/features/callbacks/ui/CallbacksPanel.tsx src/features/callbacks/ui/callbacks-panel.scss src/features/callbacks/model/rule-copy.ts src/widgets/canvas/ui/CanvasOverlays.tsx src/features/custom-shapes/ui/CustomShapeBuilderPanel.tsx src/features/custom-shapes/ui/custom-shape-builder-panel.scss src/features/text-nodes/ui/TextNodePanel.tsx src/core/store/types.ts src/core/store/runtime-slice.ts tests/black-box/editor-shell.test.ts tests/black-box/lesson-column.test.ts tests/black-box/editor-panels.test.ts tests/black-box/run-mode.test.ts tests/black-box/callbacks.test.ts
git diff --staged --stat
git commit -m "feat(editor): show one rail panel at a time on a four-track grid"
```

(`git add` on the `editor-column` folder stages its deletions too; check `git diff --staged --stat` lists exactly the files this task touched.)

---

### Task 6: The Add panel's tiles and samples

**Files:**
- Create: `src/features/custom-shapes/model/primitive-defs.ts`, `src/features/custom-shapes/ui/PrimitiveTiles.tsx`, `src/features/custom-shapes/ui/primitive-drawings.tsx`, `src/features/custom-shapes/ui/primitive-tiles.scss`, `src/features/scene-library/model/open-preset.ts`
- Modify: `src/features/custom-shapes/ui/CustomShapeBuilderPanel.tsx`, its stylesheet (drop the `.add-row` rules), `src/features/text-nodes/ui/TextNodePanel.tsx` (title), `src/shared/ui/controls/Panel.tsx` (`titleHidden`), `src/features/scene-library/index.ts`, `src/pages/editor/model/editor-link.ts`, `src/widgets/layout/editor-column/AddPanel.tsx`, `editor-column.scss`
- Test: `tests/black-box/editor-panels.test.ts` (BB-PANEL-07 updated; 32, 33 new)

**Interfaces:**
- Consumes: Task 5 `AddPanel`; Task 1 `setRailPanel`.
- Produces:
  - `PRIMITIVE_DEFS: readonly PrimitiveDef[]`, `PRIMITIVE_GROUPS: readonly PrimitiveGroup[]`, `primitiveDef(type: PrimitiveType): PrimitiveDef` from `@/features/custom-shapes/model/primitive-defs`, where `PrimitiveDef = { type: PrimitiveType; name: string; glName: string; minVertices: number; stride: number | null; hint: string }`.
  - DOM: `div.primitive-tiles` > `section.primitive-tiles__group` > `h3.primitive-tiles__title` + `div.primitive-tiles__grid` > `button.primitive-tile[title=<hint>]` holding an `svg`, `span.primitive-tile__name`, `code.primitive-tile__gl`.
  - `openPreset(slug: string, deps?: { openLibrary?: () => void }): Promise<boolean>` from `@/features/scene-library`.
  - `Panel` prop `titleHidden?: boolean` (embedded panels keep their heading for screen readers only).
  - Add panel DOM: `section.add-samples` with `h3.add-samples__title` ("Or start from a sample") and `button.add-samples__item` per prepared scene.

- [ ] **Step 1: Write the failing tests**

In `tests/black-box/editor-panels.test.ts`, add `import { AddPanel } from '@/widgets/layout/editor-column';` (merge into the existing import), `import { createMemoryLibrary, getSceneLibrary, setSceneLibraryForTests } from '@/entities/project/model/scene-library';`, replace BB-PANEL-07 with:

```ts
describe('BB-PANEL-07: The Add tiles name every primitive and start placement', () => {
  it('shows ten tiles with GL names and no More menu, and a tile starts placing its primitive', async () => {
    const host = mount(h(CustomShapeBuilderPanel, {}));
    await settle();
    const tiles = [...host.querySelectorAll<HTMLButtonElement>('.primitive-tile')];
    expect(tiles.map((t) => t.querySelector('.primitive-tile__gl')!.textContent)).toEqual([
      'GL_POINTS', 'GL_LINES', 'GL_LINE_STRIP', 'GL_LINE_LOOP',
      'GL_TRIANGLES', 'GL_TRIANGLE_STRIP', 'GL_TRIANGLE_FAN',
      'GL_QUADS', 'GL_QUAD_STRIP', 'GL_POLYGON',
    ]);
    expect(host.querySelector('[aria-haspopup="menu"]')).toBeNull();
    tiles[4].click();
    await settle();
    const s = useVamsStore.getState();
    expect(s.pendingShapeType).toBe('TRIANGLES');
    expect(s.interactionMode).toBe('VERTEX_PLACE');
    expect(host.querySelector('.primitive-tile')).toBeNull();
    expect(host.querySelector('.vertex-shape-builder')).not.toBeNull();
    s.cancelCustomShape();
    unmount(host);
  });
});
```

and append:

```ts
describe('BB-PANEL-32: The Add panel groups the primitives, then Text, then the samples', () => {
  it('lays out three groups of drawn tiles with their hints, Text, and four samples', async () => {
    const host = mount(h(AddPanel, {}));
    await settle();
    expect(host.querySelector('.rail-panel__hint')!.textContent)
      .toBe('Pick a shape, then click the canvas to place its vertices. Enter finishes.');
    const groups = [...host.querySelectorAll('.primitive-tiles__group')];
    expect(groups.map((g) => g.querySelector('.primitive-tiles__title')!.textContent))
      .toEqual(['Points and lines', 'Triangles', 'Quads and polygons']);
    expect(groups.map((g) => [...g.querySelectorAll('.primitive-tile__name')].map((n) => n.textContent))).toEqual([
      ['Points', 'Lines', 'Line strip', 'Line loop'],
      ['Triangles', 'Triangle strip', 'Triangle fan'],
      ['Quads', 'Quad strip', 'Polygon'],
    ]);
    const triangles = [...host.querySelectorAll('.primitive-tile')].find((t) => t.querySelector('.primitive-tile__name')!.textContent === 'Triangles')!;
    expect(triangles.getAttribute('title')).toBe('Click groups of 3 — each triple forms one triangle.');
    for (const tile of host.querySelectorAll('.primitive-tile')) expect(tile.querySelector('svg')).not.toBeNull();
    expect(host.querySelector('[data-panel-id="text-node-panel"]')).not.toBeNull();
    expect(host.querySelector('.add-samples__title')!.textContent).toBe('Or start from a sample');
    expect([...host.querySelectorAll('.add-samples__item')].map((b) => b.textContent))
      .toEqual(['Triangle', 'Transforms', 'Primitives tour', 'Textured quad']);
    (host.querySelector('.primitive-tile') as HTMLButtonElement).click();
    await settle();
    expect(host.querySelector('.primitive-tiles')).toBeNull();
    expect(host.querySelector('.vertex-shape-builder')).not.toBeNull();
    useVamsStore.getState().cancelCustomShape();
    unmount(host);
  });
});

describe('BB-PANEL-33: A sample replaces the scene after backing it up, and shows Scene', () => {
  it('keeps the current scene in My scenes, loads the sample and switches the rail', async () => {
    setSceneLibraryForTests(createMemoryLibrary());
    try {
      addTriangle();
      useVamsStore.setState({ railPanel: 'add' });
      const host = mount(h(AddPanel, {}));
      await settle();
      const sample = [...host.querySelectorAll<HTMLButtonElement>('.add-samples__item')].find((b) => b.textContent === 'Primitives tour')!;
      sample.click();
      for (let i = 0; i < 10 && useVamsStore.getState().railPanel !== 'scene'; i++) await settle();
      expect(useVamsStore.getState().railPanel).toBe('scene');
      expect(useVamsStore.getState().objects).toHaveLength(getPreset('primitives')!.data.objects.length);
      expect(useVamsStore.getState().activeSection).toBe('Primitives');
      const entries = await (await getSceneLibrary()).list();
      expect(entries.some((e) => e.kind === 'backup' && e.name === 'Before opening ‘Primitives tour’')).toBe(true);
      unmount(host);
    } finally {
      setSceneLibraryForTests(null);
    }
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/black-box/editor-panels.test.ts`
Expected: FAIL: no `.primitive-tile` elements and no `.add-samples`.

- [ ] **Step 3: Describe the primitives once**

Create `src/features/custom-shapes/model/primitive-defs.ts`:

```ts
import type { PrimitiveType } from '@/core/types/scene';

export interface PrimitiveDef {
  type: PrimitiveType;
  /** The plain name on the tile. */
  name: string;
  /** The OpenGL constant, in mono under the name. */
  glName: string;
  minVertices: number;
  /** Vertices per complete piece (3 for GL_TRIANGLES); null when any count past the minimum works. */
  stride: number | null;
  /** The placement hint, shown as the tile's tooltip and while placing. */
  hint: string;
}

const def = (type: PrimitiveType, name: string, minVertices: number, stride: number | null, hint: string): PrimitiveDef => ({
  type, name, glName: `GL_${type}`, minVertices, stride, hint,
});

export const PRIMITIVE_DEFS: readonly PrimitiveDef[] = [
  def('POINTS', 'Points', 1, null, 'Each click places an independent point.'),
  def('LINES', 'Lines', 2, 2, 'Click pairs of vertices — each pair forms one segment.'),
  def('LINE_STRIP', 'Line strip', 2, null, 'Each new vertex connects to the previous one.'),
  def('LINE_LOOP', 'Line loop', 3, null, 'Like Line Strip, but the last vertex connects back to the first.'),
  def('TRIANGLES', 'Triangles', 3, 3, 'Click groups of 3 — each triple forms one triangle.'),
  def('TRIANGLE_STRIP', 'Triangle strip', 3, null, 'Each new vertex forms a triangle with the previous two.'),
  def('TRIANGLE_FAN', 'Triangle fan', 3, null, 'First vertex is the center — all triangles fan outward from it.'),
  def('QUADS', 'Quads', 4, 4, 'Click groups of 4 — each quad is split into two triangles.'),
  def('QUAD_STRIP', 'Quad strip', 4, 2, 'Click pairs of vertices forming columns of quads.'),
  def('POLYGON', 'Polygon', 3, null, 'Vertices of a single convex polygon — order matters.'),
];

export function primitiveDef(type: PrimitiveType): PrimitiveDef {
  return PRIMITIVE_DEFS.find((d) => d.type === type)!;
}

export interface PrimitiveGroup {
  title: string;
  columns: 2 | 3;
  types: readonly PrimitiveType[];
}

export const PRIMITIVE_GROUPS: readonly PrimitiveGroup[] = [
  { title: 'Points and lines', columns: 2, types: ['POINTS', 'LINES', 'LINE_STRIP', 'LINE_LOOP'] },
  { title: 'Triangles', columns: 3, types: ['TRIANGLES', 'TRIANGLE_STRIP', 'TRIANGLE_FAN'] },
  { title: 'Quads and polygons', columns: 3, types: ['QUADS', 'QUAD_STRIP', 'POLYGON'] },
];
```

(The hints are today's `SHAPE_DEFS` hints, unchanged.)

- [ ] **Step 4: Draw each primitive**

Create `src/features/custom-shapes/ui/primitive-drawings.tsx`:

```tsx
import type { PrimitiveType } from '@/core/types/scene';

/** Small line drawings of what each primitive produces, in the current text colour. */
const PATHS: Record<PrimitiveType, { d: string; fill?: boolean; dots?: [number, number][] }> = {
  POINTS: { d: '', dots: [[7, 21], [15, 8], [25, 17], [34, 7]] },
  LINES: { d: 'M4 22 L16 6 M22 22 L36 10', dots: [[4, 22], [16, 6], [22, 22], [36, 10]] },
  LINE_STRIP: { d: 'M4 22 L14 7 L24 20 L36 6' },
  LINE_LOOP: { d: 'M6 22 L13 6 L31 8 L35 22 Z' },
  TRIANGLES: { d: 'M3 24 L11 6 L19 24 Z M21 24 L29 6 L37 24 Z', fill: true },
  TRIANGLE_STRIP: { d: 'M4 24 L10 6 L16 24 L22 6 L28 24 L34 6 M10 6 H34 M4 24 H28', fill: false },
  TRIANGLE_FAN: { d: 'M20 25 L4 14 L10 5 L20 3 L30 5 L36 14 Z M20 25 L10 5 M20 25 L20 3 M20 25 L30 5' },
  QUADS: { d: 'M3 8 H17 V22 H3 Z M23 8 H37 V22 H23 Z', fill: true },
  QUAD_STRIP: { d: 'M4 6 H36 M4 24 H36 M4 6 V24 M14 6 V24 M25 6 V24 M36 6 V24' },
  POLYGON: { d: 'M20 3 L36 13 L30 25 L10 25 L4 13 Z', fill: true },
};

export function PrimitiveDrawing({ type }: { type: PrimitiveType }) {
  const { d, fill, dots } = PATHS[type];
  return (
    <svg className="primitive-drawing" viewBox="0 0 40 28" width="40" height="28" aria-hidden="true">
      {d && (
        <path
          d={d}
          fill={fill ? 'currentColor' : 'none'}
          fillOpacity={fill ? 0.14 : undefined}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {dots?.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2" fill="currentColor" />)}
    </svg>
  );
}
```

- [ ] **Step 5: Write the tiles**

Create `src/features/custom-shapes/ui/PrimitiveTiles.tsx`:

```tsx
import './primitive-tiles.scss';
import { useId } from 'react';
import { PRIMITIVE_GROUPS, primitiveDef, type PrimitiveDef } from '../model/primitive-defs';
import { PrimitiveDrawing } from './primitive-drawings';

/** All ten primitives in three groups, each tile drawn, named plainly and by its GL constant. */
export default function PrimitiveTiles({ onPick }: { onPick: (def: PrimitiveDef) => void }) {
  const baseId = useId();
  return (
    <div className="primitive-tiles">
      {PRIMITIVE_GROUPS.map((group, index) => (
        <section key={group.title} className="primitive-tiles__group" aria-labelledby={`${baseId}-${index}`}>
          <h3 id={`${baseId}-${index}`} className="primitive-tiles__title">{group.title}</h3>
          <div className={`primitive-tiles__grid primitive-tiles__grid--${group.columns}`}>
            {group.types.map((type) => {
              const def = primitiveDef(type);
              return (
                <button key={type} type="button" className="primitive-tile" title={def.hint} onClick={() => onPick(def)}>
                  <PrimitiveDrawing type={type} />
                  <span className="primitive-tile__name">{def.name}</span>
                  <code className="primitive-tile__gl">{def.glName}</code>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
```

Create `src/features/custom-shapes/ui/primitive-tiles.scss`:

```scss
.primitive-tiles {
  display: grid;
  gap: var(--space-3);

  &__title {
    margin: 0 0 var(--space-1);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--ink-muted);
  }

  &__grid {
    display: grid;
    gap: var(--space-1);

    &--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    &--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
}

.primitive-tile {
  display: grid;
  justify-items: center;
  gap: 2px;
  min-width: 0;
  padding: 6px 4px;
  border: 1px solid var(--rule);
  border-radius: var(--radius-m);
  background: var(--paper-raised);
  color: var(--ink);
  font: inherit;
  cursor: pointer;

  &:hover {
    border-color: var(--rule-strong);
    background: var(--paper-sunken);
  }

  &:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }

  .primitive-drawing { color: var(--accent-text); }

  &__name {
    font-size: var(--text-xs);
    line-height: 1.2;
    text-align: center;
  }

  &__gl {
    max-width: 100%;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: 1.2;
    color: var(--ink-faint);
    overflow-wrap: anywhere;
    text-align: center;
  }
}
```

- [ ] **Step 6: Use the tiles in the builder and hide the palette's subheading**

In `src/shared/ui/controls/Panel.tsx`, add to `PanelProps`:

```ts
  /** Embedded only: keep the heading for screen readers, but do not show it (the panel around it already names it). */
  titleHidden?: boolean;
```

take `titleHidden = false` in the parameter list, and in the embedded branch change the heading to `<h4 id={titleId} className={titleHidden ? 'vpanel__subhead sr-only' : 'vpanel__subhead'}>`.

In `src/features/custom-shapes/ui/CustomShapeBuilderPanel.tsx`:
- Delete `ShapeDefinition`, `SHAPE_DEFS`, `PRIMARY` and the icon imports (`CirclePile`, `Triangle`, `Square`, `Spline`, `MdShowChart`, `TbTriangles`, `TbHexagons`, `TbCarFanFilled`, `BsBoxes`), plus `MenuButton` and `ComponentChildren` if unused.
- Import `PrimitiveTiles from './PrimitiveTiles'` and `{ primitiveDef, type PrimitiveDef } from '../model/primitive-defs'`.
- Set `const activeDef = pendingShapeType ? primitiveDef(pendingShapeType) : undefined;` and use `activeDef?.glName` where the builder showed `activeDef?.label`.
- Replace the palette branch with:

```tsx
  if (!pendingShapeType) {
    const start = (def: PrimitiveDef) => startCustomShape(def.type, def.minVertices, def.stride);
    return (
      <CollapsibleSection panelId="primitive-palette" title="Primitives" titleHidden icon={<Edit3 size={12} />} defaultOpen={true}>
        <PrimitiveTiles onPick={start} />
      </CollapsibleSection>
    );
  }
```

- Change the placing branch's `CollapsibleSection` the same way (`title="Primitives" titleHidden`).
- In the stylesheet, delete the `.add-row` rules (the tiles have their own stylesheet).

In `src/features/text-nodes/ui/TextNodePanel.tsx`, change `title="Create Text"` to `title="Text"`.

- [ ] **Step 7: Share opening a prepared scene**

Create `src/features/scene-library/model/open-preset.ts`:

```ts
import { toast } from 'sonner';
import { useVamsStore } from '@/core/store';
import { getPreset } from '@/entities/project/model/scene-presets';
import { backupLabel, replaceScene } from './scene-ops';
import { useMyScenesDialog } from './dialog-store';

/**
 * Opens a prepared scene: backs the current scene up to My scenes, loads the preset, makes its
 * section current and shows the Scene panel. Says what happened in a toast. Resolves to whether
 * the scene opened; a scene that could not be backed up is never replaced.
 */
export async function openPreset(slug: string, deps: { openLibrary?: () => void } = {}): Promise<boolean> {
  const preset = getPreset(slug);
  if (!preset) return false;
  const openLibrary = deps.openLibrary ?? (() => useMyScenesDialog.getState().open());
  try {
    const { backedUp } = await replaceScene(preset.data, { reason: 'scene-link', label: backupLabel(preset.title) });
    const state = useVamsStore.getState();
    state.setActiveSection(preset.section);
    state.setRailPanel('scene');
    if (backedUp) {
      toast.success(`Opened ‘${preset.title}’`, {
        description: 'Your previous scene is in My scenes.',
        action: { label: 'My scenes', onClick: openLibrary },
      });
    } else {
      toast.success(`Opened ‘${preset.title}’`);
    }
    return true;
  } catch (error) {
    console.error(error);
    toast.error(`Couldn't keep a backup of your current scene, so ‘${preset.title}’ was not opened.`);
    return false;
  }
}
```

Add `export { openPreset } from './model/open-preset';` to `src/features/scene-library/index.ts`.

In `src/pages/editor/model/editor-link.ts`, replace everything after the lesson branch's `return;` (from `const preset = getPreset(link.slug);` to the end of `applyEditorLink`) with:

```ts
  await openPreset(link.slug, { openLibrary: deps.openLibrary });
}
```

and change the imports: drop `getPreset` (keep `isPresetSlug`), drop `backupLabel` and `replaceScene`, add `openPreset` from `@/features/scene-library`. Remove the `toast` import only if nothing else in the file uses it (the invalid-link branch still does).

- [ ] **Step 8: Add the samples to the Add panel**

In `src/widgets/layout/editor-column/AddPanel.tsx`, add the imports `import { PRESET_LINKS } from '@/entities/project/model/preset-links';` and `import { openPreset } from '@/features/scene-library';`, and after `<TextNodePanel />` add:

```tsx
          <section className="add-samples" aria-labelledby="add-samples-title">
            <h3 id="add-samples-title" className="add-samples__title">Or start from a sample</h3>
            <div className="add-samples__list">
              {PRESET_LINKS.map((preset) => (
                <button key={preset.slug} type="button" className="add-samples__item" onClick={() => void openPreset(preset.slug)}>
                  {preset.title}
                </button>
              ))}
            </div>
          </section>
```

Append to `editor-column.scss`:

```scss
.add-panel .rail-panel__body {
  display: grid;
  align-content: start;
  gap: var(--space-3);
  padding: 0 var(--space-3) var(--space-4);
}

.add-samples {
  &__title {
    margin: 0 0 var(--space-1);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--ink-muted);
  }

  &__list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  &__item {
    padding: 3px 10px;
    border: 1px solid var(--rule);
    border-radius: 12px;
    background: none;
    color: var(--ink);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;

    &:hover { background: var(--paper-sunken); }

    &:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 1px;
    }
  }
}
```

- [ ] **Step 9: Run the tests to see them pass**

Run: `npx vitest run tests/black-box/editor-panels.test.ts tests/black-box/editor-links.test.ts`
Expected: PASS, including BB-PANEL-07, 32, 33 and every BB-LINK test.

- [ ] **Step 10: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test && git checkout -- tests/reports
git add src/features/custom-shapes/model/primitive-defs.ts src/features/custom-shapes/ui/PrimitiveTiles.tsx src/features/custom-shapes/ui/primitive-drawings.tsx src/features/custom-shapes/ui/primitive-tiles.scss src/features/custom-shapes/ui/CustomShapeBuilderPanel.tsx src/features/custom-shapes/ui/custom-shape-builder-panel.scss src/features/text-nodes/ui/TextNodePanel.tsx src/shared/ui/controls/Panel.tsx src/features/scene-library/model/open-preset.ts src/features/scene-library/index.ts src/pages/editor/model/editor-link.ts src/widgets/layout/editor-column/AddPanel.tsx src/widgets/layout/editor-column/editor-column.scss tests/black-box/editor-panels.test.ts
git diff --staged --stat
git commit -m "feat(editor): draw the primitives as tiles and offer the samples in Add"
```

---

### Task 7: The Scene toolbar and the capped list

**Files:**
- Modify: `src/features/scene-hierarchy/ui/SceneHierarchyPanel.tsx`, `src/features/scene-hierarchy/ui/scene-hierarchy-groups.scss` (or whichever of its two stylesheets holds `.group-controls`), `src/widgets/layout/editor-column/editor-column.scss`
- Test: `tests/black-box/editor-panels.test.ts` (BB-PANEL-34, 35)

**Interfaces:**
- Consumes: Task 6 `Panel` `titleHidden`; the scene slice's `duplicateObject`, `createGroup`; the panel's own `deleteWithUndo`.
- Produces: DOM `div.scene-toolbar[role="toolbar"][aria-label="Scene"]` with buttons "Select several" (`aria-pressed`), "Group", "Duplicate" and "Delete" (the last two icon-only, named by `aria-label`); the tree list `ul.tree-root` is capped inside `.scene-panel__list`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/black-box/editor-panels.test.ts`:

```ts
describe('BB-PANEL-34: The Scene toolbar selects several, groups, duplicates and deletes', () => {
  it('names its four actions and enables each when it can act', async () => {
    const a = addTriangle();
    const b = addQuad();
    const host = mount(h(SceneHierarchyPanel, {}));
    await settle();
    const toolbar = host.querySelector('[role="toolbar"]')!;
    expect(toolbar.getAttribute('aria-label')).toBe('Scene');
    const named = (name: string) =>
      [...toolbar.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') ?? x.textContent?.trim()) === name) as HTMLButtonElement;
    expect(named('Select several').getAttribute('aria-pressed')).toBe('false');
    expect(named('Group').disabled).toBe(true);
    select(b.id);
    await settle();
    expect(named('Duplicate').disabled).toBe(false);
    named('Duplicate').click();
    await settle();
    expect(useVamsStore.getState().objects).toHaveLength(3);
    const copy = useVamsStore.getState().selectedObjectId!;
    named('Delete').click();
    await settle();
    expect(useVamsStore.getState().objects.some((o) => o.id === copy)).toBe(false);
    named('Select several').click();
    await settle();
    expect(named('Select several').getAttribute('aria-pressed')).toBe('true');
    expect(named('Duplicate').disabled).toBe(true);
    for (const id of [a.id, b.id]) (host.querySelector(`[data-object-id="${id}"] .tree-item`) as HTMLElement).click();
    await settle();
    expect(named('Group').disabled).toBe(false);
    named('Group').click();
    await settle();
    expect(useVamsStore.getState().objects.some((o) => o.type === 'GROUP')).toBe(true);
    expect(named('Select several').getAttribute('aria-pressed')).toBe('false');
    unmount(host);
  });
});

describe('BB-PANEL-35: The scene list stops at about six rows and scrolls on its own', () => {
  it('caps the tree’s height inside the Scene panel', async () => {
    const { readFileSync } = await import('node:fs');
    const scss = readFileSync('src/widgets/layout/editor-column/editor-column.scss', 'utf8');
    const start = scss.indexOf('.scene-panel__list .tree-root');
    expect(start).toBeGreaterThan(-1);
    const rule = scss.slice(start, scss.indexOf('}', start));
    expect(rule).toMatch(/max-height:\s*calc\(6 \* 31px\)/);
    expect(rule).toMatch(/overflow-y:\s*auto/);
  });
});
```

(If the tree's rows carry `data-object-id` on another element than the `role="treeitem"` `li`, adapt the row selector to the one the component renders; the click must go to the element whose handler selects the row.)

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/black-box/editor-panels.test.ts`
Expected: FAIL: no `[role="toolbar"]`, and no `.scene-panel__list .tree-root` rule.

- [ ] **Step 3: Replace Multi-Select with the toolbar**

In `SceneHierarchyPanel.tsx`, add `ListChecks` to the `lucide-react` import, and replace the `<div className="group-controls"> … </div>` block with:

```tsx
      <div className="scene-toolbar" role="toolbar" aria-label="Scene">
        <Button
          variant="quiet"
          className="scene-toolbar__several"
          icon={<ListChecks size={14} />}
          aria-pressed={isMultiSelectMode}
          title="Pick several objects to group them"
          onClick={() => {
            setIsMultiSelectMode(!isMultiSelectMode);
            setSelectedObjects(new Set());
          }}
        >
          Select several
        </Button>
        <Button
          variant="quiet"
          icon={<Folder size={14} />}
          disabled={!isMultiSelectMode || selectedObjects.size < 2}
          title={isMultiSelectMode ? `Group ${selectedObjects.size} objects` : 'Select several objects to group them'}
          onClick={handleCreateGroup}
        >
          Group
        </Button>
        <Button
          variant="quiet"
          iconOnly
          label="Duplicate"
          icon={<Copy size={14} />}
          disabled={isMultiSelectMode || !selectedObjectId}
          onClick={() => selectedObjectId && duplicateObject(selectedObjectId)}
        />
        <Button
          variant="quiet"
          iconOnly
          label="Delete"
          icon={<Trash2 size={14} />}
          disabled={isMultiSelectMode || !selectedObjectId}
          onClick={() => {
            const target = objects.find((o) => o.id === selectedObjectId);
            if (target) deleteWithUndo(target.id, target.type === 'GROUP');
          }}
        />
      </div>
```

Change the panel's wrapper to `<CollapsibleSection panelId="scene-hierarchy" title="Scene Hierarchy" titleHidden icon={<Layers size={14} />} defaultOpen={true}>` (the Scene panel's header already names it).

In the stylesheet that styles `.group-controls`, rename the selector to `.scene-toolbar`, make it `display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1); padding: 0 var(--space-3) var(--space-2);`, and replace any `&.active { … }` rule for the toggle with:

```scss
  &__several[aria-pressed='true'] {
    @include selected-mark;
  }
```

(Add `@use '…/shared/styles/tokens' as *;` at the top of that stylesheet if it does not have it, with the relative path the file needs.)

- [ ] **Step 4: Cap the list**

Append to `src/widgets/layout/editor-column/editor-column.scss`:

```scss
// About six rows; a longer scene scrolls inside the list, so the inspector stays in view.
.scene-panel__list .tree-root {
  max-height: calc(6 * 31px);
  overflow-y: auto;
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run tests/black-box/editor-panels.test.ts tests/black-box/scene-graph-hierarchy.test.ts tests/black-box/editor-shell.test.ts`
Expected: PASS, including BB-PANEL-34, 35 and BB-SHELL-24 (selected-mark).

- [ ] **Step 6: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test && git checkout -- tests/reports
git add src/features/scene-hierarchy/ui/SceneHierarchyPanel.tsx src/features/scene-hierarchy/ui/scene-hierarchy-panel.scss src/features/scene-hierarchy/ui/scene-hierarchy-groups.scss src/widgets/layout/editor-column/editor-column.scss tests/black-box/editor-panels.test.ts
git diff --staged --stat
git commit -m "feat(editor): give the Scene panel a toolbar and a capped list"
```

(Stage only the stylesheet you changed; `git add` of an unchanged file stages nothing.)

---

### Task 8: The Code / Math switch

**Files:**
- Modify: `src/widgets/layout/code-math-column/CodeMathColumn.tsx`, `code-math-column.scss`; `src/shared/ui/controls/SegmentedControl.tsx`; `src/shared/ui/code-viewer/CodeViewer.tsx`, `code-viewer.scss`; `src/features/code-generation/ui/SceneCodePanel.tsx`; `src/features/math-panel/ui/MathPanel.tsx`, `math-panel.scss`; `src/core/store/types.ts`, `src/core/store/lesson-slice.ts`; `src/features/lesson-engine/model/useLessonRunner.ts`; `tests/setup.ts`
- Test: `tests/black-box/editor-shell.test.ts` (BB-SHELL-40, 41), `tests/black-box/lesson-column.test.ts` (BB-LCOL-29, 30)

**Interfaces:**
- Consumes: Task 1 `codePane`, `codeHidden`, `codeChangedUnseen`, `setCodePane`, `setCodeHidden`, `markCodeChanged`; Task 2 `LessonStep.pane`; Task 5 shell class `is-code-hidden`.
- Produces:
  - `LessonSlice.codeViewBeforeLesson: { pane: CodePane; hidden: boolean } | null`.
  - `SegmentOption.adornment?: ComponentChildren`, rendered after the label.
  - `CodeViewer` props `headerLead?: ComponentChildren; headerTrail?: ComponentChildren`; `SceneCodePanel` passes both through.
  - `MathPanel` props `headerLead?`, `headerTrail?`, `contentInert?: boolean`.
  - DOM: `div.code-math-switch[data-tour-anchor="code-switch"]` holding a radiogroup named "Code or math" with radios Code and Math; `span.code-math-switch__dot` (text "Code changed" for screen readers); a button named "Hide code and math"; when hidden, `button.code-math-edge[aria-label="Show code and math"]`.

- [ ] **Step 1: Write the failing tests**

In `tests/setup.ts`, add to the `useVamsStore.setState({ … })` reset (Task 1 added the rail fields; add this one): `codeViewBeforeLesson: null,`.

In `tests/black-box/editor-shell.test.ts`, add `import CodeMathColumn from '@/widgets/layout/code-math-column';` and append:

```ts
describe('BB-SHELL-40: The right column switches between Code and Math and marks code that changed out of sight', () => {
  it('starts on Code, shows Math, and shows the dot until Code is shown again', async () => {
    useVamsStore.setState({ codePane: 'code', codeHidden: false, codeChangedUnseen: false });
    const host = mount(h(CodeMathColumn, {}));
    await settle();
    const radios = () => [...host.querySelectorAll<HTMLButtonElement>('[data-tour-anchor="code-switch"] [role="radio"]')];
    expect(host.querySelector('[data-tour-anchor="code-switch"] [role="radiogroup"]')!.getAttribute('aria-label')).toBe('Code or math');
    expect(radios().map((r) => r.textContent)).toEqual(['Code', 'Math']);
    expect(host.querySelector('.code-viewer-container')).not.toBeNull();
    expect(host.querySelector('.math-panel-container')).toBeNull();
    radios()[1].click();
    await settle();
    expect(host.querySelector('.math-panel-container')).not.toBeNull();
    expect(host.querySelector('.code-viewer-container')).toBeNull();
    expect(host.querySelector('.code-math-switch__dot')).toBeNull();
    addTriangle();
    await settle();
    expect(host.querySelector('.code-math-switch__dot')!.textContent).toBe('Code changed');
    radios()[0].click();
    await settle();
    expect(host.querySelector('.code-math-switch__dot')).toBeNull();
    expect(useVamsStore.getState().codeChangedUnseen).toBe(false);
    unmount(host);
  });
});

describe('BB-SHELL-41: Hide tucks the code column to an edge tab that brings it back', () => {
  it('hides from Code or Math and shows again from the edge tab', async () => {
    useVamsStore.setState({ codePane: 'code', codeHidden: false });
    const host = mount(h(CodeMathColumn, {}));
    await settle();
    (host.querySelector('button[aria-label="Hide code and math"]') as HTMLButtonElement).click();
    await settle();
    expect(useVamsStore.getState().codeHidden).toBe(true);
    const edge = host.querySelector('.code-math-edge') as HTMLButtonElement;
    expect(edge.getAttribute('aria-label')).toBe('Show code and math');
    expect(edge.textContent).toContain('Code & math');
    expect(host.querySelector('.code-viewer-container')).toBeNull();
    edge.click();
    await settle();
    expect(useVamsStore.getState().codeHidden).toBe(false);
    expect(host.querySelector('.code-viewer-container')).not.toBeNull();
    useVamsStore.getState().setCodePane('math');
    await settle();
    expect(host.querySelector('button[aria-label="Hide code and math"]')).not.toBeNull();
    useVamsStore.getState().setCodePane('code');
    unmount(host);
  });
});
```

In `tests/black-box/lesson-column.test.ts`, add `import type { Lesson } from '@/core/types/lesson';` and append:

```ts
describe('BB-LCOL-29: A lesson step picks the side of the code column it is about', () => {
  const ID = 'test-pane-lesson';
  it('shows Math for pane math, Code for pane code or a code change, and leaves the column otherwise', async () => {
    const lesson: Lesson = {
      id: ID,
      title: 'Panes',
      type: 'demo',
      section: 'Transforms',
      steps: [
        { narration: 'Nothing changes.' },
        { narration: 'The math.', pane: 'math' },
        { narration: 'A triangle.', action: (s) => s.addCustomObject('TRIANGLES', [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0, y: 0.5 }]) },
        { narration: 'Quiet.' },
        { narration: 'The code.', pane: 'code' },
      ],
    };
    LESSON_REGISTRY[ID] = lesson;
    try {
      useVamsStore.setState({ codePane: 'code', codeHidden: true });
      startLesson(ID);
      const host = mount(h(LessonBar, {}));
      await settle();
      const s = () => useVamsStore.getState();
      expect([s().codePane, s().codeHidden]).toEqual(['code', true]);
      buttonNamed(host, 'Next')!.click();
      await settle();
      expect([s().codePane, s().codeHidden]).toEqual(['math', false]);
      buttonNamed(host, 'Next')!.click();
      await settle();
      expect(s().codePane).toBe('code');
      s().setCodePane('math');
      buttonNamed(host, 'Next')!.click();
      await settle();
      expect(s().codePane).toBe('math');
      buttonNamed(host, 'Next')!.click();
      await settle();
      expect(s().codePane).toBe('code');
      unmount(host);
    } finally {
      useVamsStore.getState().clearLessonState();
      useVamsStore.setState({ appMode: 'Author', codePane: 'code', codeHidden: false });
      delete LESSON_REGISTRY[ID];
    }
  });
});

describe('BB-LCOL-30: Leaving a lesson gives the student back their Code / Math view', () => {
  it('restores the switch and Hide from before the lesson', async () => {
    useVamsStore.setState({ codePane: 'math', codeHidden: true });
    startLesson('transforms-demo-1');
    const host = mount(h(LessonBar, {}));
    await settle();
    useVamsStore.getState().setCodePane('code');
    useVamsStore.getState().setCodeHidden(false);
    exitButton(host).click();
    await settle();
    expect(useVamsStore.getState().codePane).toBe('math');
    expect(useVamsStore.getState().codeHidden).toBe(true);
    expect(useVamsStore.getState().codeViewBeforeLesson).toBeNull();
    useVamsStore.setState({ codePane: 'code', codeHidden: false });
    unmount(host);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/black-box/editor-shell.test.ts tests/black-box/lesson-column.test.ts`
Expected: FAIL: no `[data-tour-anchor="code-switch"]`; the lesson leaves `codePane` alone.

- [ ] **Step 3: Remember the student's view around a lesson**

In `src/core/store/types.ts`, import `CodePane` where `LessonSlice` is declared (same file) and add to `LessonSlice` after `changedCodeLines: number[]`:

```ts
  /** The student's Code / Math switch and Hide from before the lesson; restored when it ends. */
  codeViewBeforeLesson: { pane: CodePane; hidden: boolean } | null;
```

In `src/core/store/lesson-slice.ts`, add `codeViewBeforeLesson: null,` to the initial values; in `setActiveLesson`'s first branch (a lesson starting from none) add `codeViewBeforeLesson: { pane: state.codePane, hidden: state.codeHidden },`; and in `clearLessonState` add:

```ts
      // The lesson may have switched the right column; give the student back their own view.
      ...(state.codeViewBeforeLesson
        ? { codePane: state.codeViewBeforeLesson.pane, codeHidden: state.codeViewBeforeLesson.hidden, codeChangedUnseen: false }
        : {}),
      codeViewBeforeLesson: null,
```

- [ ] **Step 4: Let a step pick the pane**

In `src/features/lesson-engine/model/useLessonRunner.ts`, right after `store.setChangedCodeLines(changed);` add:

```ts
    // A step about the math shows Math; one about the code, or one that changed it, shows Code.
    const pane = currentStep.pane ?? (changed.length > 0 ? 'code' : null);
    if (pane) {
      store.setCodePane(pane);
      store.setCodeHidden(false);
    }
```

- [ ] **Step 5: Let the headers take a lead and a trail**

In `src/shared/ui/controls/SegmentedControl.tsx`, add `import type { ComponentChildren } from 'preact';`, add `adornment?: ComponentChildren;` (comment: `/** Rendered after the label, such as a status dot. */`) to `SegmentOption`, and render `{option.label}{option.adornment}` inside the button.

In `src/shared/ui/code-viewer/CodeViewer.tsx`, add to `CodeViewerProps`:

```ts
  /** Replaces the language and line count at the start of the header, such as the column's switch. */
  headerLead?: ComponentChildren;
  /** Rendered at the end of the header, after Copy. */
  headerTrail?: ComponentChildren;
```

(import `ComponentChildren` from `preact` if needed), take them in the parameter list, and change the header so `.code-header-left` starts with `{headerLead ?? (<><span className="code-lang">C++</span><span className="code-stat">· OpenGL 1.5 · {stats.lines} lines</span></>)}` and `.code-header-right` ends with `{headerTrail}`. Append to `code-viewer.scss`:

```scss
.code-header-left {
  min-width: 0;
  overflow: hidden;
}
```

In `SceneCodePanel.tsx`, add `headerLead?: ComponentChildren; headerTrail?: ComponentChildren;` to its props and pass both to `CodeViewer`.

In `src/features/math-panel/ui/MathPanel.tsx`, give the component props:

```tsx
interface MathPanelProps {
  /** Replaces the "Math & data" title, such as the column's switch. */
  headerLead?: ComponentChildren;
  /** Rendered at the end of the header's first line. */
  headerTrail?: ComponentChildren;
  /** Run makes the tabs and content inert; the lead and trail stay usable. */
  contentInert?: boolean;
}

export default function MathPanel({ headerLead, headerTrail, contentInert = false }: MathPanelProps = {}) {
```

and change the header and content to:

```tsx
      <div className={headerLead ? 'math-header math-header--lead' : 'math-header'}>
        {headerLead ?? <span className="math-title">Math &amp; data</span>}
        {headerTrail && <span className="math-header__trail">{headerTrail}</span>}
        <div className="math-tabs" role="tablist" aria-label="Math by section" onKeyDown={onKeyDown} inert={contentInert || undefined}>
          {/* …the existing tab buttons, unchanged… */}
        </div>
      </div>
      <div
        className="math-content"
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${index}`}
        inert={contentInert || undefined}
      >
        {TABS[index].content()}
      </div>
```

Append to `math-panel.scss`:

```scss
// With the column's switch in front, the section tabs take a second line.
.math-header--lead {
  flex-wrap: wrap;

  .math-tabs {
    order: 3;
    flex-basis: 100%;
  }
}

.math-header__trail { margin-left: auto; }
```

- [ ] **Step 6: Write the switched column**

Replace `src/widgets/layout/code-math-column/CodeMathColumn.tsx` with:

```tsx
import { useEffect, useRef } from 'react';
import type { ComponentChildren } from 'preact';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import type { CodePane } from '@/core/store/types';
import SceneCodePanel from '@/features/code-generation/ui/SceneCodePanel';
import MathPanel from '@/features/math-panel/ui/MathPanel';
import { useRunSnapshot } from '@/features/callbacks';
import { Button, SegmentedControl } from '@/shared/ui/controls';
import './code-math-column.scss';

/** The right column: the generated code or the math behind it, one at a time, and Hide. */
export default function CodeMathColumn() {
  const { running, fired } = useRunSnapshot();
  const pane = useVamsStore((s) => s.codePane);
  const hidden = useVamsStore((s) => s.codeHidden);
  const unseen = useVamsStore((s) => s.codeChangedUnseen);
  const setCodePane = useVamsStore((s) => s.setCodePane);
  const setCodeHidden = useVamsStore((s) => s.setCodeHidden);
  const markCodeChanged = useVamsStore((s) => s.markCodeChanged);

  // The code is a pure function of these; when one changes while Math shows, Code gets its dot.
  const objects = useVamsStore((s) => s.objects);
  const callbacks = useVamsStore((s) => s.callbacks);
  const background = useVamsStore((s) => s.canvasBackgroundColor);
  const viewport = useVamsStore((s) => s.viewportLimits);
  const textures = useVamsStore((s) => s.uploadedTextures);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    markCodeChanged();
  }, [objects, callbacks, background, viewport, textures, markCodeChanged]);

  // A handler that fires during Run flashes its branch in Code; with Math showing, Code gets the dot.
  const firedSeq = fired?.seq;
  useEffect(() => {
    if (firedSeq !== undefined) markCodeChanged();
  }, [firedSeq, markCodeChanged]);

  if (hidden) {
    return (
      <button type="button" className="code-math-edge" aria-label="Show code and math" onClick={() => setCodeHidden(false)}>
        <PanelRightOpen size={16} aria-hidden="true" />
        <span className="code-math-edge__label">Code &amp; math</span>
      </button>
    );
  }

  const options: { value: CodePane; label: string; adornment?: ComponentChildren }[] = [
    {
      value: 'code',
      label: 'Code',
      adornment: unseen ? (
        <span className="code-math-switch__dot">
          <span className="sr-only">Code changed</span>
        </span>
      ) : undefined,
    },
    { value: 'math', label: 'Math' },
  ];
  const lead = (
    <div className="code-math-switch" data-tour-anchor="code-switch">
      <SegmentedControl label="Code or math" options={options} value={pane} onChange={setCodePane} />
    </div>
  );
  const hide = (
    <Button variant="quiet" iconOnly label="Hide code and math" icon={<PanelRightClose size={14} />} onClick={() => setCodeHidden(true)} />
  );
  const flashBranch = fired ? { handlerName: fired.handlerName, trigger: fired.trigger, seq: fired.seq } : null;

  return (
    <div className="code-math-column">
      {pane === 'code' ? (
        <SceneCodePanel flashBranch={flashBranch} headerLead={lead} headerTrail={hide} />
      ) : (
        <MathPanel headerLead={lead} headerTrail={hide} contentInert={running} />
      )}
    </div>
  );
}
```


Replace `code-math-column.scss` with:

```scss
.code-math-column {
  position: relative;
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  border-left: 1px solid var(--rule);
  background: var(--paper);
}

.code-math-switch {
  position: relative;
  flex: none;

  &__dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-left: 5px;
    border-radius: 50%;
    background: var(--accent);
    vertical-align: middle;
  }
}

// The hidden column's 30 px edge tab, with its label running down the edge.
.code-math-edge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  height: 100%;
  padding: var(--space-3) 0;
  border: 0;
  border-left: 1px solid var(--rule);
  background: var(--paper);
  color: var(--ink-muted);
  font: inherit;
  cursor: pointer;

  &:hover { color: var(--ink); background: var(--paper-sunken); }

  &:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
  }

  &__label {
    writing-mode: vertical-rl;
    font-size: var(--text-xs);
  }
}
```

- [ ] **Step 7: Run the tests to see them pass**

Run: `npx vitest run tests/black-box/editor-shell.test.ts tests/black-box/lesson-column.test.ts tests/black-box/editor-inspector.test.ts tests/black-box/run-mode.test.ts`
Expected: PASS, including BB-SHELL-40, 41, BB-LCOL-29, 30, the math panel's BB-INSP-06 and the branch flash BB-RUN-12.

- [ ] **Step 8: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test && git checkout -- tests/reports
git add src/widgets/layout/code-math-column/CodeMathColumn.tsx src/widgets/layout/code-math-column/code-math-column.scss src/shared/ui/controls/SegmentedControl.tsx src/shared/ui/code-viewer/CodeViewer.tsx src/shared/ui/code-viewer/code-viewer.scss src/features/code-generation/ui/SceneCodePanel.tsx src/features/math-panel/ui/MathPanel.tsx src/features/math-panel/ui/math-panel.scss src/core/store/types.ts src/core/store/lesson-slice.ts src/features/lesson-engine/model/useLessonRunner.ts tests/setup.ts tests/black-box/editor-shell.test.ts tests/black-box/lesson-column.test.ts
git diff --staged --stat
git commit -m "feat(editor): switch the right column between Code and Math"
```

---

### Task 9: Run fixes

**Files:**
- Modify: `src/features/callbacks/model/run-controller.ts`, `src/features/callbacks/ui/RunOverlay.tsx`, `src/features/callbacks/ui/run-overlay.scss`, `src/features/callbacks/index.ts`, `src/shared/engine/render-bridge.ts`, `src/shared/engine/selection-overlay.ts`, `src/shared/engine/pixi/hooks/useSceneRenderer.ts`, `src/shared/ui/controls/Button.tsx`
- Test: `tests/black-box/run-mode.test.ts` (BB-RUN-2, 7, 14 updated; 15 to 17 new), `tests/black-box/callbacks.test.ts` (copy list)

**Interfaces:**
- Consumes: Task 1 `setRailPanel`.
- Produces:
  - `RUN_STRIP_HEIGHT = 32`, `runBlock(state): 'illustration' | 'empty' | 'no-callback' | null` from `@/features/callbacks/model/run-controller` (also re-exported from `@/features/callbacks`). `canRun(state)` is `runBlock(state) === null`.
  - `RUN_EMPTY_REASON = 'Add a shape to run your program.'`, `RUN_NO_CALLBACK_REASON = 'Run needs a callback.'`, `RUN_OPEN_CALLBACKS = 'Open Callbacks'` from `RunOverlay.tsx`; `RUN_DISABLED_TITLE` is removed.
  - DOM: when stopped, `div.run-control[data-tour-anchor="run"]` holding `button.run-button` and, when disabled, `p.run-plate` (its id is the button's `aria-describedby`). Nothing renders over an illustration.
  - `renderBridge.setEditorOverlaysHidden(hidden: boolean)` and `renderBridge.editorOverlaysHidden(): boolean`; `SelectionOverlay.setSuppressed(suppressed: boolean)`.
  - `ButtonProps` gains `'aria-describedby'?: string` and `'data-tour-anchor'?: string`.

- [ ] **Step 1: Write the failing tests**

In `tests/black-box/run-mode.test.ts`:
- Import `RUN_STRIP_HEIGHT` with the other run-controller names, `{ RUN_EMPTY_REASON, RUN_NO_CALLBACK_REASON, RUN_OPEN_CALLBACKS }` from `@/features/callbacks/ui/RunOverlay`, `{ renderBridge }` from `@/shared/engine/render-bridge`, `{ SelectionOverlay }` from `@/shared/engine/selection-overlay` and `{ Container }` from `pixi.js`.
- BB-RUN-2: rename the case to `'shows onReshape(800, 568)'` and expect `'onReshape(800, 568)'` and `{ width: 800, height: 568 }`.
- BB-RUN-7 first case: expect `{ width: MIN_WINDOW.width, height: 568 }` and `'onReshape(200, 568)'`, then `{ width: 210, height: 558 }`, then after `resize({ width: 640, height: 400 })` expect `{ width: 640, height: 368 }`. Second case: expect `setView` with `{ x: 0, y: RUN_STRIP_HEIGHT, width: 800, height: 568 }`.
- Add to BB-RUN-14:

```ts
  it('hides Run and its plate over an illustration', async () => {
    setup();
    showIllustration();
    const host = mount(h(RunOverlay, {}));
    await settle();
    expect(host.querySelector('.run-button')).toBeNull();
    expect(host.querySelector('.run-plate')).toBeNull();
    useVamsStore.setState({ pipelineMode: 'Playground' });
    await settle();
    expect(host.querySelector('.run-button')).not.toBeNull();
    render(null, host);
    host.remove();
  });
```

- Append:

```ts
describe('BB-RUN-15: The program window starts below the Running strip', () => {
  it('reports the height below the strip to Reshape and maps the view below it', () => {
    const { setView } = setup();
    getState().setCallbackHandler('reshape', 'onReshape');
    runController.start({ loop: false });
    expect(RUN_STRIP_HEIGHT).toBe(32);
    expect(runController.getSnapshot().lastCall).toBe(`onReshape(800, ${600 - RUN_STRIP_HEIGHT})`);
    setView.mockClear();
    runController.stepFrame();
    expect(setView).toHaveBeenCalledWith(expect.anything(), { x: 0, y: RUN_STRIP_HEIGHT, width: 800, height: 600 - RUN_STRIP_HEIGHT });
  });

  it('draws the window under the strip', async () => {
    setup();
    const host = mount(h(RunOverlay, {}));
    runController.start({ loop: false });
    await settle();
    expect((host.querySelector('.run-window') as HTMLElement).style.height).toBe(`${600 - RUN_STRIP_HEIGHT}px`);
    const { readFileSync } = await import('node:fs');
    const scss = readFileSync('src/features/callbacks/ui/run-overlay.scss', 'utf8');
    expect(scss).toMatch(/--run-strip-height:\s*32px/);
    const windowRule = scss.slice(scss.indexOf('.run-window {'), scss.indexOf('}', scss.indexOf('.run-window {')));
    expect(windowRule).toMatch(/top:\s*var\(--run-strip-height\)/);
    render(null, host);
    host.remove();
  });
});

describe('BB-RUN-16: The selection outline and handles hide during Run and come back after', () => {
  it.each(['stop', 'undo', 'selection'] as const)('hides them while running and shows them after %s', (how) => {
    setup();
    expect(renderBridge.editorOverlaysHidden()).toBe(false);
    runController.start({ loop: false });
    expect(renderBridge.editorOverlaysHidden()).toBe(true);
    if (how === 'stop') runController.stop();
    if (how === 'undo') getState().undo();
    if (how === 'selection') getState().selectObject(null);
    expect(runController.getSnapshot().running).toBe(false);
    expect(renderBridge.editorOverlaysHidden()).toBe(false);
  });

  it('keeps the outline hidden while suppressed, even when its target is set again', () => {
    const parent = new Container();
    const overlay = new SelectionOverlay();
    const target = new Container();
    parent.addChild(overlay);
    parent.addChild(target);
    overlay.setTarget(target);
    expect(overlay.visible).toBe(true);
    overlay.setSuppressed(true);
    expect(overlay.visible).toBe(false);
    overlay.setTarget(target);
    expect(overlay.visible).toBe(false);
    overlay.setSuppressed(false);
    expect(overlay.visible).toBe(true);
  });
});

describe('BB-RUN-17: Run off says why on the canvas', () => {
  it('asks for a shape, then a callback with a link to Callbacks, then gets out of the way', async () => {
    const host = mount(h(RunOverlay, {}));
    await settle();
    const run = () => host.querySelector('.run-button') as HTMLButtonElement;
    const plate = () => host.querySelector('.run-plate');
    expect(run().disabled).toBe(true);
    expect(plate()!.textContent).toBe(RUN_EMPTY_REASON);
    expect(run().getAttribute('aria-describedby')).toBe(plate()!.id);
    addTriangle();
    await settle();
    expect(plate()!.textContent).toBe(`${RUN_NO_CALLBACK_REASON} ${RUN_OPEN_CALLBACKS}`);
    getState().setRailPanel('scene');
    (plate()!.querySelector('button') as HTMLButtonElement).click();
    expect(getState().railPanel).toBe('callbacks');
    getState().setCallbackHandler('keyboard', 'onKey');
    await settle();
    expect(run().disabled).toBe(false);
    expect(plate()).toBeNull();
    expect(host.querySelector('[data-tour-anchor="run"]')).not.toBeNull();
    render(null, host);
    host.remove();
  });
});
```

(Use the file's own `mount` and `settle` helpers; add a `settle` like the other suites' if the file has none.)

In `tests/black-box/callbacks.test.ts`, replace `RUN_DISABLED_TITLE` in the copy list (and its import) with `RUN_EMPTY_REASON, RUN_NO_CALLBACK_REASON, RUN_OPEN_CALLBACKS` imported from `@/features/callbacks/ui/RunOverlay`.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/black-box/run-mode.test.ts tests/black-box/callbacks.test.ts`
Expected: FAIL: `RUN_STRIP_HEIGHT` and the reason constants are not exported; Reshape reports 600.

- [ ] **Step 3: Start the program window below the strip**

In `src/features/callbacks/model/run-controller.ts`:

```ts
/** The Running strip's height; the program window starts below it. Matches `--run-strip-height`. */
export const RUN_STRIP_HEIGHT = 32;

/** The part of the canvas the program window may use: everything below the strip. */
const programArea = (canvas: { width: number; height: number }) => ({
  width: canvas.width,
  height: Math.max(0, canvas.height - RUN_STRIP_HEIGHT),
});

export type RunBlock = 'illustration' | 'empty' | 'no-callback' | null;

/** Why Run is off, in the order the canvas explains it; null when it can run. */
export function runBlock(
  state: Pick<VamsState, 'objects' | 'callbacks' | 'appMode' | 'activeSection' | 'pipelineMode'>,
): RunBlock {
  // A Pipeline illustration hides the canvas, so there is nothing to run on.
  if (showsIllustration(state)) return 'illustration';
  if (state.objects.length === 0) return 'empty';
  if (!CALLBACK_KINDS.some((k) => isCallbackValid(state.callbacks, k))) return 'no-callback';
  return null;
}

export function canRun(
  state: Pick<VamsState, 'objects' | 'callbacks' | 'appMode' | 'activeSection' | 'pipelineMode'>,
): boolean {
  return runBlock(state) === null;
}
```

(replacing the old `canRun`). In `start`, change the canvas line to `const canvas = programArea(renderBridge.getCanvasSize() ?? FALLBACK_CANVAS);` and add `renderBridge.setEditorOverlaysHidden(true);` right after the `this.publish({ running: true, … })` call. In `stop`, add `renderBridge.setEditorOverlaysHidden(false);` right after `renderBridge.resync();`. In `stepFrame`, replace `const canvas = renderBridge.getCanvasSize() ?? this.snapshot.canvas;` with:

```ts
    const measured = renderBridge.getCanvasSize();
    const canvas = measured ? programArea(measured) : this.snapshot.canvas;
```

In `draw`, change the `setView` rectangle to `{ x: 0, y: RUN_STRIP_HEIGHT, width: window.width, height: window.height }`.

In `src/features/callbacks/index.ts`, export `runBlock`, `RUN_STRIP_HEIGHT` and `type RunBlock` alongside `canRun`.

- [ ] **Step 4: Hide the selection outline and handles during Run**

In `src/shared/engine/render-bridge.ts`, add `let editorOverlaysHidden = false;` next to `let handlers…`, and to the `renderBridge` object:

```ts
  /** Run hides the selection outline and vertex handles while it moves objects; the renderer reads this every frame. */
  setEditorOverlaysHidden(hidden: boolean): void {
    editorOverlaysHidden = hidden;
  },

  editorOverlaysHidden(): boolean {
    return editorOverlaysHidden;
  },
```

In `src/shared/engine/selection-overlay.ts`, add a `private suppressed = false;` field, change `setTarget`'s non-null branch to set `this.visible = !this.suppressed;`, and add:

```ts
    /** Run hides the outline while it moves objects; the target is kept for when Run stops. */
    public setSuppressed(suppressed: boolean) {
        if (this.suppressed === suppressed) return;
        this.suppressed = suppressed;
        this.visible = !suppressed && this.target !== null;
        if (!suppressed && this.target) this.update();
    }
```

In `src/shared/engine/pixi/hooks/useSceneRenderer.ts`, change the start of `tickerFn` from `if (overlay) overlay.update();` to:

```ts
      const runHides = renderBridge.editorOverlaysHidden();
      overlay.setSuppressed(runHides);
      if (runHides) {
        if (vertexOverlayRef.current) vertexOverlayRef.current.visible = false;
        return;
      }
      overlay.update();
```

- [ ] **Step 5: Explain Run off on the canvas**

In `src/shared/ui/controls/Button.tsx`, add to `ButtonProps`:

```ts
  'aria-describedby'?: string;
  /** Lets the first-visit tour find this control. */
  'data-tour-anchor'?: string;
```

In `src/features/callbacks/ui/RunOverlay.tsx`:
- Replace `RUN_DISABLED_TITLE` with:

```ts
export const RUN_EMPTY_REASON = 'Add a shape to run your program.';
export const RUN_NO_CALLBACK_REASON = 'Run needs a callback.';
export const RUN_OPEN_CALLBACKS = 'Open Callbacks';
```

- Import `useId` from `react` and `runBlock` instead of `canRun`, replace `const runnable = …` with `const block = useVamsStore((s) => runBlock(s));`, add `const setRailPanel = useVamsStore((s) => s.setRailPanel);` and `const plateId = useId();`, and replace the stopped branch with:

```tsx
  if (!snap.running || !snap.window) {
    // A Pipeline illustration replaces the canvas; there is nothing to run, so Run steps aside.
    if (block === 'illustration') return null;
    return (
      <div className="run-control" data-tour-anchor="run">
        <Button
          ref={runButtonRef}
          variant="primary"
          className="run-button"
          icon={<Play />}
          disabled={block !== null}
          aria-describedby={block ? plateId : undefined}
          onClick={() => runController.start()}
        >
          Run
        </Button>
        {block && (
          <p id={plateId} className="run-plate">
            {block === 'empty' ? (
              RUN_EMPTY_REASON
            ) : (
              <>
                {RUN_NO_CALLBACK_REASON}{' '}
                <button type="button" className="run-plate__link" onClick={() => setRailPanel('callbacks')}>
                  {RUN_OPEN_CALLBACKS}
                </button>
              </>
            )}
          </p>
        )}
      </div>
    );
  }
```

In `run-overlay.scss`, replace the `.run-button { … }` rule with:

```scss
.run-control {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  z-index: 25;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-1);
}

// Why Run is off, on the canvas plate under the button.
.run-plate {
  max-width: 220px;
  margin: 0;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--canvas-plate-line);
  border-radius: var(--radius-s);
  background: var(--canvas-plate);
  color: var(--canvas-plate-text);
  font-size: var(--text-xs);
  line-height: 1.4;
  text-align: right;

  &__link {
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 2px;
    }
  }
}
```

and change `.run-layer` to declare the strip height, the window to start below it, and the strip to its fixed height:

```scss
.run-layer {
  --run-strip-height: 32px;
  /* …existing declarations… */
}

.run-window {
  position: absolute;
  top: var(--run-strip-height);
  left: 0;
  box-shadow: 0 0 0 9999px var(--paper-sunken);
}
```

and in `.run-strip` add `height: var(--run-strip-height); box-sizing: border-box;`.

Run `grep -rn "RUN_DISABLED_TITLE\|canRun" src` and update anything left (the Callbacks panel no longer uses either since Task 5).

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx vitest run tests/black-box/run-mode.test.ts tests/black-box/callbacks.test.ts tests/black-box/editor-shell.test.ts`
Expected: PASS, including BB-RUN-2, 7, 14 to 17 and BB-SHELL-21 (the selection outline colour).

- [ ] **Step 7: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test && git checkout -- tests/reports
git add src/features/callbacks/model/run-controller.ts src/features/callbacks/ui/RunOverlay.tsx src/features/callbacks/ui/run-overlay.scss src/features/callbacks/index.ts src/shared/engine/render-bridge.ts src/shared/engine/selection-overlay.ts src/shared/engine/pixi/hooks/useSceneRenderer.ts src/shared/ui/controls/Button.tsx tests/black-box/run-mode.test.ts tests/black-box/callbacks.test.ts
git diff --staged --stat
git commit -m "fix(run): start the program window below the strip, hide the outline, and say why Run is off"
```

---

### Task 10: Tour state, steps and checks

**Files:**
- Create: `src/core/store/tour-slice.ts`, `src/features/first-visit-tour/model/steps.ts`, `src/features/first-visit-tour/model/spin.ts`, `tests/black-box/first-visit-tour.test.ts`
- Modify: `src/core/store/types.ts`, `src/core/store/index.ts`, `tests/setup.ts`, `src/features/lesson-engine/model/catalog.ts`, `src/features/code-generation/ui/SceneCodePanel.tsx`, `src/features/lesson-engine/ui/LearnButton.tsx`
- Test: `tests/black-box/first-visit-tour.test.ts` (BB-TOUR-01 to 07, a new suite)

**Interfaces:**
- Consumes: Task 1's `railPanel`, `railHidden`, `codePane`, `codeHidden`, `codeChangedUnseen`, `RailPanel`, `setLessonFocusPanel` (switches the rail); Task 8's `codePane`; Task 9's `ButtonProps['data-tour-anchor']`; the anchors `rail-add` (Task 3), `panel`, `canvas`, `code-column` (Task 5), `code-switch` (Task 8), `run` (Task 9).
- Produces:
  - In `@/core/store/types`: `interface TourBaseline { buildIds: string[]; objectId: string | null; translateX: number | null }` and `interface TourSlice { tourStep: number | null; railBeforeTour: RailPanel | null; tourStepBaseline: TourBaseline | null; startTour(): void; nextTourStep(): void; prevTourStep(): void; endTour(options?: { restoreRail?: boolean }): void }`, joined into `VamsState`.
  - `TOUR_STEP_COUNT = 6` from `@/core/store/tour-slice`.
  - From `@/features/first-visit-tour/model/steps`: `TOUR_STEPS: readonly TourStep[]`, `builtTriangle(state, baseline)`, and the types `TourStepId`, `TourState`, `TourRunState { startedThisStep: boolean; running: boolean }`, `TourCaptionContext { state; baseline; codeName; spun }`, `TourStep { id; title; anchors; drawer; caption(ctx): string; tryIt?(ctx): string | null; done?(state, baseline, run): boolean }`. Captions mark bold with `**…**` and code with `` `…` ``.
  - From `@/features/first-visit-tour/model/spin`: `SPIN_HANDLER = 'onIdle'`, `SPIN_DEGREES = 2`, `spinTarget(state): SceneNode | null`, `makeItSpin(state: VamsState): string | null`.
  - From `@/features/lesson-engine/model/catalog`: `courseOrder(): LessonEntry[]` and `firstLessonToStudy(completed: readonly string[]): string`.
  - `LearnButton` carries `data-tour-anchor="learn"`.

- [ ] **Step 1: Write the failing tests**

Create `tests/black-box/first-visit-tour.test.ts`:

```ts
/**
 * BLACK-BOX TEST SUITE — BB-TOUR
 * The first-visit tour: its steps and checks, the tour state, Make it spin, and the spotlight and callout.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { h, render, type VNode } from 'preact';
import { useVamsStore } from '@/core/store';
import { TOUR_STEP_COUNT } from '@/core/store/tour-slice';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { TOUR_STEPS, builtTriangle, type TourCaptionContext } from '@/features/first-visit-tour/model/steps';
import { SPIN_HANDLER, makeItSpin, spinTarget } from '@/features/first-visit-tour/model/spin';
import { COURSE, LESSON_CATALOG, courseOrder, firstLessonToStudy } from '@/features/lesson-engine/model/catalog';
import SceneCodePanel from '@/features/code-generation/ui/SceneCodePanel';
import { addPrimitive, addQuad, addTriangle, getState } from '../helpers/store';

async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}
function mount(vnode: VNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(vnode, host);
  return host;
}
function unmount(host: HTMLElement) {
  render(null, host);
  host.remove();
}
const step = (id: string) => TOUR_STEPS.find((s) => s.id === id)!;
const noRun = { startedThisStep: false, running: false };
const ctx = (spun = false): TourCaptionContext => ({
  state: getState(),
  baseline: getState().tourStepBaseline,
  codeName: (name) => name,
  spun,
});
/** Moves the running tour to step `index`. */
const goTo = (index: number) => {
  for (let i = getState().tourStep ?? index; i < index; i++) getState().nextTourStep();
};

describe('BB-TOUR-01: Six steps, in the order VAMS teaches, pointing at regions the editor marks', () => {
  it('lists Build, Read, Change, Understand, Run and Learn with their regions', () => {
    expect(TOUR_STEPS.map((s) => s.title)).toEqual(['Build', 'Read', 'Change', 'Understand', 'Run', 'Learn']);
    expect(TOUR_STEPS).toHaveLength(TOUR_STEP_COUNT);
    expect(TOUR_STEPS.map((s) => s.anchors)).toEqual([
      ['rail-add', 'panel', 'canvas'],
      ['code-column'],
      ['panel', 'code-column'],
      ['code-switch', 'code-column'],
      ['run'],
      ['learn'],
    ]);
    expect(TOUR_STEPS.map((s) => s.drawer)).toEqual([true, false, true, false, false, false]);
  });

  it('finds every anchor on a real element in the editor source', () => {
    const files = (readdirSync('src', { recursive: true }) as string[]).filter((f) => f.endsWith('.tsx'));
    const lines = files
      .flatMap((f) => readFileSync(join('src', f), 'utf8').split('\n'))
      .filter((line) => line.includes('data-tour-anchor'));
    for (const id of new Set(TOUR_STEPS.flatMap((s) => s.anchors))) {
      expect(lines.some((line) => line.includes(`"${id}"`) || line.includes(`'${id}'`)), id).toBe(true);
    }
  });
});

describe('BB-TOUR-02: Starting, moving through and ending the tour', () => {
  it('opens the panel and the code column on Code, starts on Add and gives the rail back at the end', () => {
    useVamsStore.setState({ railPanel: 'settings', railHidden: true, codeHidden: true, codePane: 'math', codeChangedUnseen: true });
    getState().startTour();
    let s = getState();
    expect(s.tourStep).toBe(0);
    expect([s.railPanel, s.railHidden, s.codeHidden, s.codePane, s.codeChangedUnseen]).toEqual(['add', false, false, 'code', false]);
    expect(s.railBeforeTour).toBe('settings');
    getState().endTour();
    s = getState();
    expect([s.tourStep, s.railPanel, s.railBeforeTour, s.tourStepBaseline]).toEqual([null, 'settings', null, null]);
  });

  it('does not start during a lesson', () => {
    useVamsStore.setState({ appMode: 'Lesson' });
    getState().startTour();
    expect(getState().tourStep).toBeNull();
    useVamsStore.setState({ appMode: 'Author' });
  });

  it('stops at both ends, and Next and Back cancel a half-placed shape', () => {
    getState().startTour();
    getState().prevTourStep();
    expect(getState().tourStep).toBe(0);
    getState().startCustomShape('TRIANGLES', 3, 3);
    getState().addPendingVertex(0, 0);
    getState().nextTourStep();
    let s = getState();
    expect(s.tourStep).toBe(1);
    expect([s.interactionMode, s.pendingShapeType, s.pendingVertices]).toEqual(['SELECT', null, []]);
    getState().startCustomShape('QUADS', 4, 4);
    getState().prevTourStep();
    s = getState();
    expect(s.tourStep).toBe(0);
    expect(s.interactionMode).toBe('SELECT');
    for (let i = 0; i < 10; i++) getState().nextTourStep();
    expect(getState().tourStep).toBe(TOUR_STEP_COUNT - 1);
    getState().endTour();
  });

  it('changes nothing in the scene when the student only presses Next', () => {
    addTriangle();
    getState().selectObject(null);
    const { objects, callbacks, past } = getState();
    getState().startTour();
    for (let i = 0; i < TOUR_STEP_COUNT; i++) getState().nextTourStep();
    getState().endTour();
    const s = getState();
    expect(s.objects).toBe(objects);
    expect(s.callbacks).toBe(callbacks);
    expect(s.past.length).toBe(past.length);
  });

  it('opens Scene on the Change step with the triangle built in step 1, or keeps a selection', () => {
    addQuad();
    getState().selectObject(null);
    getState().startTour();
    const triangle = addTriangle();
    getState().selectObject(null);
    goTo(2);
    let s = getState();
    expect(s.railPanel).toBe('scene');
    expect(s.selectedObjectId).toBe(triangle.id);
    expect(s.tourStepBaseline).toMatchObject({ objectId: triangle.id, translateX: triangle.transform.translateX });
    getState().prevTourStep();
    const quad = getState().objects.find((o) => o.type === 'QUADS')!;
    getState().selectObject(quad.id);
    getState().nextTourStep();
    s = getState();
    expect(s.selectedObjectId).toBe(quad.id);
    expect(s.tourStepBaseline!.objectId).toBe(quad.id);
    getState().endTour();
  });
});

describe('BB-TOUR-03: Each step’s check and caption', () => {
  it('Build passes only for a finished triangle made during the step', () => {
    addTriangle();
    getState().startTour();
    const done = () => step('build').done!(getState(), getState().tourStepBaseline, noRun);
    expect(done()).toBe(false);
    addQuad();
    addPrimitive('LINES', [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }]);
    expect(done()).toBe(false);
    getState().startCustomShape('TRIANGLES', 3, 3);
    for (const [x, y] of [[0, 0], [0.5, 0], [0, 0.5]]) getState().addPendingVertex(x, y);
    expect(done()).toBe(false);
    getState().addCustomObject('TRIANGLES', getState().pendingVertices);
    expect(done()).toBe(true);
    expect(builtTriangle(getState(), getState().tourStepBaseline)!.id).toBe(getState().objects[0].id);
    getState().endTour();
  });

  it('Change passes once the watched object’s X differs from where it started', () => {
    const triangle = addTriangle();
    getState().startTour();
    goTo(2);
    const done = () => step('change').done!(getState(), getState().tourStepBaseline, noRun);
    expect(done()).toBe(false);
    getState().updateObjectTransform(triangle.id, { translateX: triangle.transform.translateX + 0.25 });
    expect(done()).toBe(true);
    getState().updateObjectTransform(triangle.id, { translateX: triangle.transform.translateX });
    expect(done()).toBe(false);
    getState().endTour();
  });

  it('Understand passes when Math shows, and Run when a run started in the step has stopped', () => {
    getState().startTour();
    goTo(3);
    expect(step('understand').done!(getState(), getState().tourStepBaseline, noRun)).toBe(false);
    getState().setCodePane('math');
    expect(step('understand').done!(getState(), getState().tourStepBaseline, noRun)).toBe(true);
    const run = step('run').done!;
    expect(run(getState(), null, { startedThisStep: false, running: false })).toBe(false);
    expect(run(getState(), null, { startedThisStep: true, running: true })).toBe(false);
    expect(run(getState(), null, { startedThisStep: true, running: false })).toBe(true);
    expect(step('read').done).toBeUndefined();
    expect(step('learn').done).toBeUndefined();
    getState().endTour();
  });

  it('captions name the shape and fall back when there is none', () => {
    getState().startTour();
    expect(step('read').caption(ctx())).toBe('Every shape you make becomes real OpenGL code.');
    goTo(2);
    expect(step('change').caption(ctx())).toBe('Selecting an object opens its settings.');
    expect(step('change').tryIt!(ctx())).toBeNull();
    getState().endTour();

    const triangle = addTriangle();
    getState().startTour();
    expect(step('build').caption(ctx())).toBe('The rail switches what this panel shows. **Add** is where you build.');
    expect(step('build').tryIt!(ctx())).toBe('Pick **Triangles**, click three points on the canvas, then press **Enter**.');
    expect(step('read').caption(ctx())).toBe(
      `Every shape you make becomes real OpenGL code. Your triangle is drawn by \`draw_${triangle.name}()\`.`,
    );
    goTo(2);
    expect(step('change').caption(ctx())).toBe('Selecting an object opens its settings. Change **X** and watch the code.');
    expect(step('change').tryIt!(ctx())).toBe('Change the selected object’s **Translate X**.');
    expect(step('understand').tryIt!(ctx())).toBe('Click **Math**.');
    expect(step('run').caption(ctx(true))).toContain('Your Idle callback stays in **Callbacks**.');
    expect(step('run').caption(ctx(false))).not.toContain('Idle callback');
    expect(step('learn').caption(ctx())).toBe('**Learn** opens the course: five sections of demos and exercises.');
    getState().endTour();
  });
});

describe('BB-TOUR-04: Make it spin registers an Idle rule through the Callbacks actions', () => {
  it('names the handler onIdle and adds one rotate rule on the selected object, as one undo step', () => {
    const triangle = addTriangle();
    addQuad();
    getState().selectObject(triangle.id);
    useVamsStore.setState({ past: [], future: [] });
    expect(makeItSpin(getState())).toBe(triangle.id);
    const idle = getState().callbacks.idle;
    expect(idle.handlerName).toBe(SPIN_HANDLER);
    expect(idle.rules).toEqual([
      { id: expect.any(String), objectId: triangle.id, trigger: { kind: 'idle' }, action: { type: 'rotate', degrees: 2 } },
    ]);
    expect(getState().past).toHaveLength(1);
    getState().undo();
    expect(getState().callbacks.idle).toEqual(emptyCallbacks().idle);
  });

  it('keeps a valid Idle handler, falls back to the first drawn shape, and does nothing without one', () => {
    expect(spinTarget(getState())).toBeNull();
    expect(makeItSpin(getState())).toBeNull();
    expect(getState().callbacks).toEqual(emptyCallbacks());
    const quad = addQuad();
    getState().selectObject(null);
    getState().setCallbackHandler('idle', 'tick');
    expect(spinTarget(getState())!.id).toBe(quad.id);
    makeItSpin(getState());
    expect(getState().callbacks.idle.handlerName).toBe('tick');
    expect(getState().callbacks.idle.rules[0].objectId).toBe(quad.id);
  });
});

describe('BB-TOUR-05: Start learning picks the next lesson in course order', () => {
  it('orders the course by section, demos before exercises', () => {
    const order = courseOrder();
    expect(order).toHaveLength(LESSON_CATALOG.length);
    expect([...new Set(order.map((l) => l.section))]).toEqual(COURSE.map((c) => c.section));
    for (const { section } of COURSE) {
      const types = order.filter((l) => l.section === section).map((l) => l.type);
      expect(types).toEqual([...types].sort());
    }
  });

  it('picks the first lesson not completed, or the first lesson once all are done', () => {
    const ids = courseOrder().map((l) => l.id);
    expect(firstLessonToStudy([])).toBe(ids[0]);
    expect(firstLessonToStudy([ids[0], ids[1]])).toBe(ids[2]);
    expect(firstLessonToStudy([ids[1]])).toBe(ids[0]);
    expect(firstLessonToStudy(ids)).toBe(ids[0]);
  });
});

describe('BB-TOUR-06: Undo and redo never leave a step done', () => {
  it('undoing the Build triangle makes the step undone, and redo makes it done again', () => {
    getState().startTour();
    useVamsStore.setState({ past: [], future: [] });
    addTriangle();
    const done = () => step('build').done!(getState(), getState().tourStepBaseline, noRun);
    expect(done()).toBe(true);
    getState().undo();
    expect(done()).toBe(false);
    getState().redo();
    expect(done()).toBe(true);
    getState().endTour();
  });

  it('undoing X back to its starting value in the Change step does not count', () => {
    const triangle = addTriangle();
    getState().startTour();
    goTo(2);
    useVamsStore.setState({ past: [], future: [] });
    getState().pushToHistory();
    getState().updateObjectTransform(triangle.id, { translateX: triangle.transform.translateX + 0.3 });
    const done = () => step('change').done!(getState(), getState().tourStepBaseline, noRun);
    expect(done()).toBe(true);
    getState().undo();
    expect(done()).toBe(false);
    getState().endTour();
  });
});

describe('BB-TOUR-07: During the tour the code flashes the lines an edit changes', () => {
  it('marks the ObjectState line when X changes, and nothing outside the tour', async () => {
    const triangle = addTriangle();
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    getState().updateObjectTransform(triangle.id, { translateX: 0.4 });
    await settle();
    expect(host.querySelectorAll('.code-line.changed')).toHaveLength(0);
    getState().startTour();
    await settle();
    getState().updateObjectTransform(triangle.id, { translateX: 0.7 });
    await settle();
    const changed = [...host.querySelectorAll('.code-line.changed')].map((el) => el.textContent ?? '');
    expect(changed.some((line) => line.includes('ObjectState state_'))).toBe(true);
    expect(changed.some((line) => line.includes('glTranslatef'))).toBe(false);
    getState().endTour();
    await settle();
    expect(host.querySelectorAll('.code-line.changed')).toHaveLength(0);
    unmount(host);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/black-box/first-visit-tour.test.ts`
Expected: FAIL: `Failed to resolve import "@/core/store/tour-slice"`.

- [ ] **Step 3: Add the tour types**

In `src/core/store/types.ts`, add after the `HelpSlice` interface:

```ts
/** What a tour step's check compares against, captured when the step opens. */
export interface TourBaseline {
  /** The objects that existed when the Build step opened; a shape not in this list was built during the tour. */
  buildIds: string[];
  /** The object the Change step watches, and its Translate X when that step opened. */
  objectId: string | null;
  translateX: number | null;
}

/** The first-visit tour. Session-only: none of it is saved, so a reload ends the tour. */
export interface TourSlice {
  /** The open step, 0 to 5, or null when no tour runs. */
  tourStep: number | null;
  /** The rail panel shown before the tour, given back when it ends. */
  railBeforeTour: RailPanel | null;
  tourStepBaseline: TourBaseline | null;
  startTour: () => void;
  nextTourStep: () => void;
  prevTourStep: () => void;
  /** Ends the tour. The rail returns to its panel from before the tour unless `restoreRail` is false. */
  endTour: (options?: { restoreRail?: boolean }) => void;
}
```

and add `TourSlice &` to the `VamsState` intersection, after `HelpSlice &`.

- [ ] **Step 4: Write the tour slice and compose it**

Create `src/core/store/tour-slice.ts`:

```ts
import type { StateCreator } from 'zustand';
import type { SceneNode } from '@/core/types/scene';
import type { TourBaseline, TourSlice, VamsState } from '@/core/store/types';

/** Build, Read, Change, Understand, Run, Learn. */
export const TOUR_STEP_COUNT = 6;
const BUILD = 0;
const CHANGE = 2;

/** The object the Change step works on: the selection, else the triangle built in step 1, else the first shape. */
function changeTarget(state: VamsState, buildIds: readonly string[]): SceneNode | undefined {
  const selected = state.objects.find((o) => o.id === state.selectedObjectId);
  if (selected) return selected;
  const built = state.objects.find((o) => o.type === 'TRIANGLES' && !buildIds.includes(o.id));
  return built ?? state.objects.find((o) => o.type !== 'GROUP') ?? state.objects[0];
}

/** The state a step opens with: its baseline, and the panel it shows. */
function enterStep(state: VamsState, index: number): Partial<VamsState> {
  const buildIds = index === BUILD || !state.tourStepBaseline
    ? state.objects.map((o) => o.id)
    : state.tourStepBaseline.buildIds;
  const baseline: TourBaseline = { buildIds, objectId: null, translateX: null };
  if (index === BUILD) return { tourStep: index, tourStepBaseline: baseline, railPanel: 'add', railHidden: false };
  if (index === CHANGE) {
    const target = changeTarget(state, buildIds);
    return {
      tourStep: index,
      tourStepBaseline: { ...baseline, objectId: target?.id ?? null, translateX: target?.transform.translateX ?? null },
      railPanel: 'scene',
      railHidden: false,
      ...(target && target.id !== state.selectedObjectId ? { selectedObjectId: target.id, selectedVertexId: null } : {}),
    };
  }
  return { tourStep: index, tourStepBaseline: baseline };
}

/** Moving through the tour cancels a half-placed shape, as Esc does. */
function stopPlacing(state: VamsState) {
  if (state.interactionMode === 'VERTEX_PLACE') state.cancelCustomShape();
}

export const createTourSlice: StateCreator<VamsState, [], [], TourSlice> = (set, get) => ({
  tourStep: null,
  railBeforeTour: null,
  tourStepBaseline: null,

  // The tour runs on the student's own scene in Author mode, with the panel and the code in view.
  startTour: () => {
    const state = get();
    if (state.appMode === 'Lesson') return;
    set({
      railBeforeTour: state.tourStep === null ? state.railPanel : state.railBeforeTour,
      codeHidden: false,
      codePane: 'code',
      codeChangedUnseen: false,
      tourStepBaseline: null,
    });
    set(enterStep(get(), BUILD));
  },

  nextTourStep: () => {
    const step = get().tourStep;
    if (step === null || step >= TOUR_STEP_COUNT - 1) return;
    stopPlacing(get());
    set(enterStep(get(), step + 1));
  },

  prevTourStep: () => {
    const step = get().tourStep;
    if (step === null || step === 0) return;
    stopPlacing(get());
    set(enterStep(get(), step - 1));
  },

  endTour: ({ restoreRail = true } = {}) => {
    const state = get();
    if (state.tourStep === null) return;
    stopPlacing(state);
    set({
      tourStep: null,
      tourStepBaseline: null,
      railBeforeTour: null,
      ...(restoreRail && state.railBeforeTour ? { railPanel: state.railBeforeTour } : {}),
    });
  },
});
```

In `src/core/store/index.ts`, add `import { createTourSlice } from '@/core/store/tour-slice';`, add `...createTourSlice(...a),` after `...createHelpSlice(...a),`, and append after the selection subscription from Task 1:

```ts
// Starting a lesson ends the tour. The lesson's focus decides the rail, so the tour leaves it alone.
useVamsStore.subscribe((state, prev) => {
  if (state.tourStep !== null && state.appMode === 'Lesson' && prev.appMode !== 'Lesson') state.endTour({ restoreRail: false });
});
```

`partialize` lists saved keys explicitly, so the tour fields stay out of the save without further change.

In `tests/setup.ts`, add to the `useVamsStore.setState({...})` reset: `tourStep: null, railBeforeTour: null, tourStepBaseline: null,` and `appMode: 'Author',` if `appMode` is not already reset there.

- [ ] **Step 5: Write the steps and Make it spin**

Create `src/features/first-visit-tour/model/steps.ts`:

```ts
import type { TourBaseline, VamsState } from '@/core/store/types';
import type { SceneNode } from '@/core/types/scene';

export type TourStepId = 'build' | 'read' | 'change' | 'understand' | 'run' | 'learn';

/** The store fields the steps read. */
export type TourState = Pick<VamsState, 'objects' | 'selectedObjectId' | 'interactionMode' | 'codePane'>;

/** What the Run step knows about Run: whether a run started during the step, and whether one is on. */
export interface TourRunState {
  startedThisStep: boolean;
  running: boolean;
}

export interface TourCaptionContext {
  state: TourState;
  baseline: TourBaseline | null;
  /** The C++ name the generator gives an object, as in `draw_<name>()`. */
  codeName: (name: string) => string;
  /** Make it spin has run during this tour. */
  spun: boolean;
}

/**
 * One tour step. Captions and try-it lines mark bold with **…** and code with `…`; the callout renders them.
 * `done` is pure: it reads the store each time, so undo and redo can make a step undone again.
 */
export interface TourStep {
  id: TourStepId;
  title: string;
  /** The `data-tour-anchor` values of the regions the step spotlights. */
  anchors: readonly string[];
  /** On a narrow screen, the panel drawer is open while this step shows. */
  drawer: boolean;
  caption: (ctx: TourCaptionContext) => string;
  tryIt?: (ctx: TourCaptionContext) => string | null;
  /** True once the student has done what the step invites; the tour then moves on by itself. */
  done?: (state: TourState, baseline: TourBaseline | null, run: TourRunState) => boolean;
}

/** The triangle the Build step asks for: made during the step, with at least 3 vertices, its placement finished. */
export function builtTriangle(state: TourState, baseline: TourBaseline | null): SceneNode | undefined {
  if (!baseline || state.interactionMode === 'VERTEX_PLACE') return undefined;
  return state.objects.find((o) => o.type === 'TRIANGLES' && o.vertices.length >= 3 && !baseline.buildIds.includes(o.id));
}

/** The object the Change step watches, while it still exists. */
function watched(state: TourState, baseline: TourBaseline | null): SceneNode | undefined {
  return baseline?.objectId ? state.objects.find((o) => o.id === baseline.objectId) : undefined;
}

/** The selected object when it has a draw function of its own (groups and text do not). */
function selectedShape(state: TourState): SceneNode | undefined {
  const selected = state.objects.find((o) => o.id === state.selectedObjectId);
  return selected && selected.type !== 'GROUP' && selected.type !== 'TEXT' ? selected : undefined;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'build',
    title: 'Build',
    anchors: ['rail-add', 'panel', 'canvas'],
    drawer: true,
    caption: () => 'The rail switches what this panel shows. **Add** is where you build.',
    tryIt: () => 'Pick **Triangles**, click three points on the canvas, then press **Enter**.',
    done: (state, baseline) => builtTriangle(state, baseline) !== undefined,
  },
  {
    id: 'read',
    title: 'Read',
    anchors: ['code-column'],
    drawer: false,
    caption: ({ state, codeName }) => {
      const shape = selectedShape(state);
      const lead = 'Every shape you make becomes real OpenGL code.';
      if (!shape) return lead;
      const noun = shape.type === 'TRIANGLES' ? 'triangle' : 'shape';
      return `${lead} Your ${noun} is drawn by \`draw_${codeName(shape.name)}()\`.`;
    },
  },
  {
    id: 'change',
    title: 'Change',
    anchors: ['panel', 'code-column'],
    drawer: true,
    caption: ({ state, baseline }) =>
      watched(state, baseline)
        ? 'Selecting an object opens its settings. Change **X** and watch the code.'
        : 'Selecting an object opens its settings.',
    tryIt: ({ state, baseline }) => (watched(state, baseline) ? 'Change the selected object’s **Translate X**.' : null),
    done: (state, baseline) => {
      const object = watched(state, baseline);
      return !!object && baseline?.translateX !== null && object.transform.translateX !== baseline?.translateX;
    },
  },
  {
    id: 'understand',
    title: 'Understand',
    anchors: ['code-switch', 'code-column'],
    drawer: false,
    caption: () => '**Math** shows the numbers behind the code, like the matrix your X just changed.',
    tryIt: () => 'Click **Math**.',
    done: (state) => state.codePane === 'math',
  },
  {
    id: 'run',
    title: 'Run',
    anchors: ['run'],
    drawer: false,
    caption: ({ spun }) =>
      '**Run** plays your program like a real GLUT window. **Esc** stops it, and your scene stays as you built it.' +
      (spun ? ' Your Idle callback stays in **Callbacks**.' : ''),
    done: (_state, _baseline, run) => run.startedThisStep && !run.running,
  },
  {
    id: 'learn',
    title: 'Learn',
    anchors: ['learn'],
    drawer: false,
    caption: () => '**Learn** opens the course: five sections of demos and exercises.',
  },
];
```

Create `src/features/first-visit-tour/model/spin.ts`:

```ts
import type { VamsState } from '@/core/store/types';
import type { SceneNode } from '@/core/types/scene';
import { isCallbackValid, newRuleId, programObjects } from '@/core/callbacks/callbacks-model';

/** The Idle handler name Make it spin registers when the scene has no valid one. */
export const SPIN_HANDLER = 'onIdle';
export const SPIN_DEGREES = 2;

/** The object Make it spin turns: the selection when the program draws it, else the first shape it draws. */
export function spinTarget(state: Pick<VamsState, 'objects' | 'selectedObjectId'>): SceneNode | null {
  const drawn = programObjects(state.objects);
  return drawn.find((o) => o.id === state.selectedObjectId) ?? drawn.find((o) => o.type !== 'GROUP') ?? null;
}

/**
 * Registers the Idle callback (unless a valid one exists) and adds "every frame, rotate the target by
 * 2 degrees" through the actions the Callbacks panel uses, as one undo step. Returns the target's id,
 * or null when the program draws nothing. Starting Run is the caller's job.
 */
export function makeItSpin(state: VamsState): string | null {
  const target = spinTarget(state);
  if (!target) return null;
  state.pushToHistory();
  state.startBatch();
  try {
    if (!isCallbackValid(state.callbacks, 'idle')) state.setCallbackHandler('idle', SPIN_HANDLER);
    state.addCallbackRule('idle', {
      id: newRuleId(),
      objectId: target.id,
      trigger: { kind: 'idle' },
      action: { type: 'rotate', degrees: SPIN_DEGREES },
    });
  } finally {
    state.endBatch();
  }
  return target.id;
}
```

- [ ] **Step 6: Add course order to the catalog**

Append to `src/features/lesson-engine/model/catalog.ts`:

```ts
/** Every lesson in course order: the sections in pipeline order, each section's demos before its exercises. */
export function courseOrder(): LessonEntry[] {
  return COURSE.flatMap(({ section }) => {
    const { demos, exercises } = catalogFor(section);
    return [...demos, ...exercises];
  });
}

/** The first lesson in course order the student has not completed, or the course's first lesson once all are done. */
export function firstLessonToStudy(completed: readonly string[]): string {
  const order = courseOrder();
  return (order.find((lesson) => !completed.includes(lesson.id)) ?? order[0]).id;
}
```

- [ ] **Step 7: Flash changed lines during the tour**

In `src/features/code-generation/ui/SceneCodePanel.tsx`, change the React import to `import { useEffect, useMemo, useRef, useState } from 'react';`, add `import { resolveChangedLines } from '@/features/code-generation/model/code-diff';`, and after the `flashLines` memo add:

```ts
  // While the tour runs, the lines an edit changes flash as they do in a lesson.
  const tourStep = useVamsStore((s) => s.tourStep);
  const [tourFlash, setTourFlash] = useState<number[]>([]);
  const lastTourCode = useRef<{ code: string; width: number; height: number } | null>(null);
  useEffect(() => {
    const last = lastTourCode.current;
    lastTourCode.current = tourStep === null ? null : { code: generatedCode, width: canvasSize.width, height: canvasSize.height };
    if (tourStep === null || !last) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTourFlash([]);
      return;
    }
    // A canvas resize changes only glutInitWindowSize; that is not the student's edit.
    if (last.code === generatedCode || last.width !== canvasSize.width || last.height !== canvasSize.height) return;
    setTourFlash(resolveChangedLines(last.code, generatedCode));
  }, [generatedCode, canvasSize, tourStep]);
```

and replace the `changedLines` line with:

```ts
  const changedLines = flashLines.length > 0
    ? flashLines
    : isLessonMode ? changedCodeLines : tourStep !== null ? tourFlash : undefined;
```

If lint flags the second `setTourFlash` call with `react-hooks/set-state-in-effect`, put the same disable comment on the line above it.

- [ ] **Step 8: Mark the Learn button for the tour**

In `src/features/lesson-engine/ui/LearnButton.tsx`, add `data-tour-anchor="learn"` to the `Button`.

- [ ] **Step 9: Run the tests to see them pass**

Run: `npx vitest run tests/black-box/first-visit-tour.test.ts`
Expected: PASS, BB-TOUR-01 to 07.

- [ ] **Step 10: Run everything, lint, build, commit**

Run `npm test`. A test that asserts the full store shape or the `VamsState` keys may need the three tour fields; add them there and nowhere else.

```bash
npm run lint && npm run build && npm test && git checkout -- tests/reports
git add src/core/store/tour-slice.ts src/core/store/types.ts src/core/store/index.ts tests/setup.ts src/features/first-visit-tour/model/steps.ts src/features/first-visit-tour/model/spin.ts src/features/lesson-engine/model/catalog.ts src/features/code-generation/ui/SceneCodePanel.tsx src/features/lesson-engine/ui/LearnButton.tsx tests/black-box/first-visit-tour.test.ts
git diff --staged --stat
git commit -m "feat(tour): add the first-visit tour's steps, checks and state"
```

---

### Task 11: The tour's spotlight and callout

**Files:**
- Create: `src/features/first-visit-tour/model/geometry.ts`, `src/features/first-visit-tour/lib/inert-outside.ts`, `src/features/first-visit-tour/ui/RichText.tsx`, `src/features/first-visit-tour/ui/FirstVisitTour.tsx`, `src/features/first-visit-tour/ui/first-visit-tour.scss`, `src/features/first-visit-tour/index.ts`
- Modify: `src/shared/styles/_tokens.scss`, `src/pages/editor/ui/EditorApp.tsx`, `src/features/onboarding/ui/WelcomeCard.tsx`, `src/features/help/model/types.ts`, `src/features/help/model/help-content.ts`, `src/features/help/ui/HelpContent.tsx`, `src/features/help/ui/HelpCenter.tsx`, `src/features/help/ui/help-center.scss`
- Test: `tests/black-box/first-visit-tour.test.ts` (BB-TOUR-08 to 14), `tests/black-box/help-center.test.ts` (BB-HELP-07)

**Interfaces:**
- Consumes: Task 10's store tour actions, `TOUR_STEP_COUNT`, `TOUR_STEPS`, `TourCaptionContext`, `TourRunState`, `makeItSpin`, `spinTarget`, `firstLessonToStudy`; Task 2's `observeResize`; Task 3's `useNarrowLayout` from `@/shared/hooks/useNarrowLayout`; `runController` (`start`, `stop`, `subscribe`, `getSnapshot`) from `@/features/callbacks/model/run-controller`; `sanitizeName` from `@/features/code-generation/model/generator/utils`; `startLesson` and `readProgress` from `lesson-engine`.
- Produces:
  - `export default function FirstVisitTour(props: FirstVisitTourProps)` from `@/features/first-visit-tour`, with `interface TourRun { start(): boolean; stop(): void; subscribe(listener: () => void): () => void; getSnapshot(): { running: boolean } }`, `interface FirstVisitTourProps { run: TourRun; codeName: (name: string) => string; startLearning: () => void }` and `TOUR_ADVANCE_MS = 1200`. DOM: `div.tour` (`.is-lifted` while the spin runs) holding `svg.tour__scrim`, one `div.tour__outline` per region, and `div.tour-callout[role="dialog"][aria-modal="false"][tabindex="-1"]` with `.tour-callout__step`, `.tour-callout__caption`, `.tour-callout__try`, a polite live region, and buttons "Skip tour", "Back", "Next" (last step: "Explore on my own", "Start learning"), and "Make it spin" on the Run step.
  - `placeCallout(regions: readonly Box[], viewport: Size, callout: Size, gap?: number): { left: number; top: number }` and `inertOutside(open: readonly Element[], keep: readonly Element[]): () => void`.
  - HelpBlock `{ kind: 'start-tour' }`, rendered as `button.help-start-tour` "Start the tour".
  - Token `--tour-scrim` in both themes.

- [ ] **Step 1: Write the failing tests**

In `tests/black-box/first-visit-tour.test.ts`, add `vi` to the vitest import, and add these imports:

```ts
import FirstVisitTour, { TOUR_ADVANCE_MS, type TourRun } from '@/features/first-visit-tour';
import { placeCallout } from '@/features/first-visit-tour/model/geometry';
import { runController } from '@/features/callbacks/model/run-controller';
import { startLesson } from '@/features/lesson-engine/model/start-lesson';
```

Then append:

```ts
const ANCHORS = ['rail-add', 'panel', 'canvas', 'code-column', 'code-switch', 'run', 'learn'];

/** A stand-in for the editor: one element per anchor, plus a button elsewhere and one already inert. */
function fakeEditor() {
  const root = document.createElement('div');
  for (const id of ANCHORS) {
    const el = document.createElement('button');
    el.setAttribute('data-tour-anchor', id);
    el.textContent = id;
    root.appendChild(el);
  }
  const elsewhere = document.createElement('button');
  elsewhere.id = 'elsewhere';
  root.appendChild(elsewhere);
  const wasInert = document.createElement('div');
  wasInert.id = 'was-inert';
  wasInert.setAttribute('inert', '');
  root.appendChild(wasInert);
  document.body.appendChild(root);
  return root;
}

function fakeRun() {
  let snapshot = { running: false };
  const listeners = new Set<() => void>();
  const publish = (running: boolean) => {
    snapshot = { running };
    listeners.forEach((listener) => listener());
  };
  return {
    start: vi.fn(() => {
      publish(true);
      return true;
    }),
    stop: vi.fn(() => publish(false)),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
  };
}

function mountTour(run: TourRun = fakeRun(), startLearning = vi.fn()) {
  const host = mount(h(FirstVisitTour, { run, codeName: (name: string) => name, startLearning }));
  return { host, run, startLearning };
}
const callout = () => document.querySelector<HTMLElement>('.tour-callout');
const tourButton = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('.tour-callout button')].find((b) => b.textContent?.trim() === name);
const press = (key: string, target: EventTarget = document.body) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
/** With fake timers, lets renders and effects run. */
const flush = () => vi.advanceTimersByTimeAsync(40);

function mediaQuery(initial: boolean) {
  const real = window.matchMedia;
  let matches = initial;
  const listeners = new Set<() => void>();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() { return matches; },
    media: query,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
  }));
  return {
    set(next: boolean) {
      matches = next;
      listeners.forEach((listener) => listener());
    },
    restore() {
      window.matchMedia = real;
    },
  };
}

describe('BB-TOUR-08: The callout shows the step and moves with its buttons and keys', () => {
  it('shows the step, the caption and the try-it line, and Back, Next and Skip work', async () => {
    const editor = fakeEditor();
    getState().startTour();
    const { host } = mountTour();
    await settle();
    const dialog = callout()!;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('false');
    expect(dialog.querySelector('.tour-callout__step')!.textContent).toBe('Step 1 of 6');
    expect(dialog.querySelector('.tour-callout__caption strong')!.textContent).toBe('Add');
    expect(dialog.querySelector('.tour-callout__try')!.textContent).toContain('Pick Triangles');
    expect(dialog.querySelector('[aria-live="polite"]')!.textContent).toBe('Tour step 1 of 6: Build');
    expect(tourButton('Back')!.disabled).toBe(true);
    expect(document.activeElement).toBe(dialog);
    tourButton('Next')!.click();
    await settle();
    expect(getState().tourStep).toBe(1);
    expect(callout()!.querySelector('.tour-callout__step')!.textContent).toBe('Step 2 of 6');
    tourButton('Back')!.click();
    await settle();
    expect(getState().tourStep).toBe(0);
    tourButton('Skip tour')!.click();
    await settle();
    expect(getState().tourStep).toBeNull();
    expect(callout()).toBeNull();
    unmount(host);
    editor.remove();
  });

  it('goes forward with Right or Enter, back with Left, and ends with Esc', async () => {
    const editor = fakeEditor();
    getState().startTour();
    const { host } = mountTour();
    await settle();
    press('ArrowRight');
    expect(getState().tourStep).toBe(1);
    press('Enter');
    expect(getState().tourStep).toBe(2);
    press('ArrowLeft');
    expect(getState().tourStep).toBe(1);
    press('Escape');
    expect(getState().tourStep).toBeNull();
    unmount(host);
    editor.remove();
  });

  it('leaves keys to fields and arrow widgets, and Enter and Esc to a shape being placed', async () => {
    const editor = fakeEditor();
    const input = document.createElement('input');
    const group = document.createElement('div');
    group.setAttribute('role', 'radiogroup');
    const radio = document.createElement('button');
    group.appendChild(radio);
    editor.append(input, group);
    getState().startTour();
    const { host } = mountTour();
    await settle();
    press('ArrowRight', input);
    press('Escape', input);
    press('ArrowRight', radio);
    expect(getState().tourStep).toBe(0);
    getState().startCustomShape('TRIANGLES', 3, 3);
    press('Enter');
    press('Escape');
    expect(getState().tourStep).toBe(0);
    expect(getState().interactionMode).toBe('VERTEX_PLACE');
    press('ArrowRight');
    expect(getState().tourStep).toBe(1);
    expect(getState().interactionMode).toBe('SELECT');
    getState().endTour();
    unmount(host);
    editor.remove();
  });

  it('ends with Start learning and Explore on my own instead of Next', async () => {
    const editor = fakeEditor();
    getState().startTour();
    goTo(5);
    const { host } = mountTour();
    await settle();
    expect(tourButton('Next')).toBeUndefined();
    expect(tourButton('Skip tour')).toBeUndefined();
    expect(tourButton('Start learning')).toBeDefined();
    press('ArrowRight');
    expect(getState().tourStep).toBe(5);
    tourButton('Explore on my own')!.click();
    await settle();
    expect(getState().tourStep).toBeNull();
    unmount(host);
    editor.remove();
  });
});

describe('BB-TOUR-09: Doing a step moves the tour on by itself', () => {
  it('moves on a moment after the Build triangle is finished; an undo in that moment holds it', async () => {
    vi.useFakeTimers();
    const editor = fakeEditor();
    try {
      getState().startTour();
      const { host } = mountTour();
      await flush();
      useVamsStore.setState({ past: [], future: [] });
      addTriangle();
      await vi.advanceTimersByTimeAsync(TOUR_ADVANCE_MS / 2);
      getState().undo();
      await vi.advanceTimersByTimeAsync(TOUR_ADVANCE_MS);
      expect(getState().tourStep).toBe(0);
      getState().redo();
      await vi.advanceTimersByTimeAsync(TOUR_ADVANCE_MS - 100);
      expect(getState().tourStep).toBe(0);
      await vi.advanceTimersByTimeAsync(200);
      expect(getState().tourStep).toBe(1);
      getState().endTour();
      unmount(host);
    } finally {
      editor.remove();
      vi.useRealTimers();
    }
  });

  it('waits on a step that was already done when the student came Back to it', async () => {
    vi.useFakeTimers();
    const editor = fakeEditor();
    try {
      getState().startTour();
      goTo(3);
      const { host } = mountTour();
      await flush();
      getState().setCodePane('math');
      await vi.advanceTimersByTimeAsync(TOUR_ADVANCE_MS + 100);
      expect(getState().tourStep).toBe(4);
      getState().prevTourStep();
      await flush();
      await vi.advanceTimersByTimeAsync(TOUR_ADVANCE_MS * 2);
      expect(getState().tourStep).toBe(3);
      getState().setCodePane('code');
      getState().setCodePane('math');
      await vi.advanceTimersByTimeAsync(TOUR_ADVANCE_MS + 100);
      expect(getState().tourStep).toBe(4);
      getState().endTour();
      unmount(host);
    } finally {
      editor.remove();
      vi.useRealTimers();
    }
  });
});

describe('BB-TOUR-10: The Run step', () => {
  it('Make it spin starts Run without ending the tour, and the stopped run moves on to Learn', async () => {
    vi.useFakeTimers();
    const editor = fakeEditor();
    try {
      addTriangle();
      getState().startTour();
      goTo(4);
      const run = fakeRun();
      const { host } = mountTour(run);
      await flush();
      tourButton('Make it spin')!.click();
      await flush();
      expect(run.start).toHaveBeenCalledTimes(1);
      expect(getState().tourStep).toBe(4);
      expect(getState().callbacks.idle.rules).toHaveLength(1);
      expect(document.querySelector('.tour')!.classList.contains('is-lifted')).toBe(true);
      expect(document.querySelector('[inert]:not(#was-inert)')).toBeNull();
      expect(tourButton('Make it spin')).toBeUndefined();
      expect(callout()!.textContent).toContain('Your Idle callback stays in Callbacks.');
      run.stop();
      await vi.advanceTimersByTimeAsync(TOUR_ADVANCE_MS + 100);
      expect(getState().tourStep).toBe(5);
      getState().endTour();
      unmount(host);
    } finally {
      editor.remove();
      vi.useRealTimers();
    }
  });

  it('counts a run that stopped because the scene changed', async () => {
    vi.useFakeTimers();
    const editor = fakeEditor();
    const run: TourRun = {
      start: () => runController.start({ loop: false }),
      stop: () => runController.stop(),
      subscribe: runController.subscribe,
      getSnapshot: runController.getSnapshot,
    };
    try {
      addTriangle();
      useVamsStore.setState({ past: [], future: [] });
      getState().startTour();
      goTo(4);
      const { host } = mountTour(run);
      await flush();
      tourButton('Make it spin')!.click();
      await flush();
      expect(runController.getSnapshot().running).toBe(true);
      getState().undo();
      expect(runController.getSnapshot().running).toBe(false);
      await vi.advanceTimersByTimeAsync(TOUR_ADVANCE_MS + 100);
      expect(getState().tourStep).toBe(5);
      getState().endTour();
      unmount(host);
    } finally {
      runController.stop();
      editor.remove();
      vi.useRealTimers();
    }
  });

  it('ends the tour when Run starts on any other step, and offers no spin without a shape', async () => {
    const editor = fakeEditor();
    getState().startTour();
    const run = fakeRun();
    let { host } = mountTour(run);
    await settle();
    run.start();
    await settle();
    expect(getState().tourStep).toBeNull();
    unmount(host);
    run.stop();
    getState().startTour();
    goTo(4);
    ({ host } = mountTour(run));
    await settle();
    expect(tourButton('Make it spin')).toBeUndefined();
    expect(callout()!.querySelector('.tour-callout__try')).toBeNull();
    getState().endTour();
    unmount(host);
    editor.remove();
  });
});

describe('BB-TOUR-11: Starting a lesson ends the tour', () => {
  it('cancels a half-placed shape and leaves the rail to the lesson', async () => {
    useVamsStore.setState({ railPanel: 'settings' });
    getState().startTour();
    getState().startCustomShape('TRIANGLES', 3, 3);
    getState().addPendingVertex(0, 0);
    expect(await startLesson('transforms-demo-1')).toBe(true);
    const s = getState();
    expect(s.tourStep).toBeNull();
    expect([s.interactionMode, s.pendingShapeType]).toEqual(['SELECT', null]);
    expect(s.railPanel).toBe('add');
    getState().setLessonFocusPanel('callbacks-panel');
    expect(getState().railPanel).toBe('callbacks');
    getState().clearLessonState();
    useVamsStore.setState({ appMode: 'Author' });
  });
});

describe('BB-TOUR-12: The tour hands over to the lessons', () => {
  it('Start learning asks the page for the next lesson and ends the tour', async () => {
    const editor = fakeEditor();
    getState().startTour();
    goTo(5);
    const { host, startLearning } = mountTour();
    await settle();
    tourButton('Start learning')!.click();
    await settle();
    expect(startLearning).toHaveBeenCalledTimes(1);
    expect(getState().tourStep).toBeNull();
    unmount(host);
    editor.remove();
  });

  it('opening the Learn drawer ends the tour', async () => {
    const editor = fakeEditor();
    getState().startTour();
    goTo(5);
    const { host } = mountTour();
    await settle();
    getState().setLearnOpen(true);
    await settle();
    expect(getState().tourStep).toBeNull();
    getState().setLearnOpen(false);
    unmount(host);
    editor.remove();
  });
});

describe('BB-TOUR-13: The spotlight', () => {
  it('makes everything but the step’s regions inert, and gives it all back at the end', async () => {
    const editor = fakeEditor();
    const anchor = (id: string) => editor.querySelector(`[data-tour-anchor="${id}"]`)!;
    getState().startTour();
    const { host } = mountTour();
    await settle();
    for (const id of ['rail-add', 'panel', 'canvas']) expect(anchor(id).hasAttribute('inert'), id).toBe(false);
    for (const id of ['code-column', 'run', 'learn']) expect(anchor(id).hasAttribute('inert'), id).toBe(true);
    expect(editor.querySelector('#elsewhere')!.hasAttribute('inert')).toBe(true);
    expect(callout()!.closest('[inert]')).toBeNull();
    expect(document.querySelectorAll('.tour__outline')).toHaveLength(3);
    getState().nextTourStep();
    await settle();
    expect(anchor('code-column').hasAttribute('inert')).toBe(false);
    expect(anchor('canvas').hasAttribute('inert')).toBe(true);
    expect(document.querySelectorAll('.tour__outline')).toHaveLength(1);
    getState().endTour();
    await settle();
    expect([...document.querySelectorAll('[inert]')].map((el) => el.id)).toEqual(['was-inert']);
    unmount(host);
    editor.remove();
  });

  it('takes focus on each step and gives it back when the tour ends', async () => {
    const editor = fakeEditor();
    const before = editor.querySelector<HTMLButtonElement>('#elsewhere')!;
    before.focus();
    getState().startTour();
    const { host } = mountTour();
    await settle();
    expect(document.activeElement).toBe(callout());
    getState().endTour();
    await settle();
    expect(document.activeElement).toBe(before);
    unmount(host);
    editor.remove();
  });

  it('opens the narrow-screen drawer for Build and Change only', async () => {
    const media = mediaQuery(true);
    const editor = fakeEditor();
    try {
      getState().startTour();
      const { host } = mountTour();
      await settle();
      const hidden = [getState().railHidden];
      for (let i = 1; i < 4; i++) {
        getState().nextTourStep();
        await settle();
        hidden.push(getState().railHidden);
      }
      expect(hidden).toEqual([false, true, false, true]);
      getState().endTour();
      unmount(host);
    } finally {
      editor.remove();
      media.restore();
    }
  });

  it('declares the scrim colour for both themes', () => {
    const scss = readFileSync('src/shared/styles/_tokens.scss', 'utf8');
    expect(scss.split('--tour-scrim: rgba(0, 0, 0, 0.55);').length - 1).toBe(2);
  });
});

describe('BB-TOUR-14: The callout sits beside the regions, never on them', () => {
  const viewport = { width: 1280, height: 800 };
  const size = { width: 320, height: 200 };

  it('takes the first side with room', () => {
    // The Build step at 1280 px: the Add pill, the panel and the canvas. The room is right of the canvas.
    const build = [
      { left: 0, top: 52, width: 64, height: 60 },
      { left: 64, top: 44, width: 272, height: 756 },
      { left: 336, top: 44, width: 520, height: 756 },
    ];
    expect(placeCallout(build, viewport, size)).toEqual({ left: 868, top: 44 });
    // The Read step: the code column on the right, so the callout goes to its left.
    expect(placeCallout([{ left: 820, top: 44, width: 460, height: 756 }], viewport, size)).toEqual({ left: 488, top: 44 });
  });

  it('covers the regions as little as it can when there is no room, and stays in the window', () => {
    expect(placeCallout([{ left: 0, top: 0, width: 1280, height: 800 }], viewport, size)).toEqual({ left: 948, top: 12 });
    expect(placeCallout([], viewport, size)).toEqual({ left: 480, top: 588 });
  });
});
```

In `tests/black-box/help-center.test.ts`, add `import HelpCenter from '@/features/help/ui/HelpCenter';` and append:

```ts
describe('BB-HELP-07: The welcome card and the Help Center start the tour', () => {
  async function settle() {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  function mountEl(vnode: ReturnType<typeof h>) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(vnode, host);
    return host;
  }
  function unmount(host: HTMLElement) {
    render(null, host);
    host.remove();
  }
  const buttonNamed = (name: string) =>
    [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === name);

  it('Take the tour closes the welcome card and starts the tour', async () => {
    useVamsStore.setState({ hasSeenWelcome: false, appMode: 'Author' });
    const host = mountEl(h(WelcomeCard, {}));
    await settle();
    buttonNamed('Take the tour')!.click();
    await settle();
    expect(getState().hasSeenWelcome).toBe(true);
    expect(getState().tourStep).toBe(0);
    expect(getState().isHelpOpen).toBe(false);
    getState().endTour();
    unmount(host);
  });

  it('Start the tour in the Workspace Tour topic, and in the first-visit banner, closes Help and starts it', async () => {
    useVamsStore.setState({ hasSeenWelcome: true, appMode: 'Author' });
    getState().openHelp('workspace-tour');
    let host = mountEl(h(HelpCenter, {}));
    await settle();
    document.querySelector<HTMLButtonElement>('.help-start-tour')!.click();
    await settle();
    expect(getState().isHelpOpen).toBe(false);
    expect(getState().tourStep).toBe(0);
    getState().endTour();
    unmount(host);

    useVamsStore.setState({ hasSeenWelcome: false });
    getState().openHelp('shortcuts');
    host = mountEl(h(HelpCenter, {}));
    await settle();
    document.querySelector<HTMLButtonElement>('.help-welcome-banner button')!.click();
    await settle();
    expect(getState().isHelpOpen).toBe(false);
    expect(getState().hasSeenWelcome).toBe(true);
    expect(getState().tourStep).toBe(0);
    getState().endTour();
    unmount(host);
  });

  it('offers no Start the tour during a lesson', async () => {
    useVamsStore.setState({ hasSeenWelcome: false, appMode: 'Lesson' });
    getState().openHelp('workspace-tour');
    const host = mountEl(h(HelpCenter, {}));
    await settle();
    expect(document.querySelector('.help-start-tour')).toBeNull();
    expect(document.querySelector('.help-welcome-banner')).toBeNull();
    getState().closeHelp();
    await settle();
    unmount(host);
    useVamsStore.setState({ hasSeenWelcome: true, appMode: 'Author' });
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/black-box/first-visit-tour.test.ts tests/black-box/help-center.test.ts`
Expected: FAIL: `Failed to resolve import "@/features/first-visit-tour"`.

- [ ] **Step 3: Write the geometry and the inert helper**

Create `src/features/first-visit-tour/model/geometry.ts`:

```ts
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}
export interface Size {
  width: number;
  height: number;
}

/** Space kept between the callout, the regions and the window edge. */
export const CALLOUT_GAP = 12;

const overlapArea = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));

/**
 * Where the callout goes: beside a spotlighted region, never covering any region, inside the window.
 * Each region's right, left, bottom and top are tried in turn and the first spot that covers no region
 * wins. With no such spot, the one covering the regions least wins; with no regions, the bottom centre.
 */
export function placeCallout(
  regions: readonly Box[],
  viewport: Size,
  callout: Size,
  gap = CALLOUT_GAP,
): { left: number; top: number } {
  if (regions.length === 0) {
    return {
      left: Math.max(gap, (viewport.width - callout.width) / 2),
      top: Math.max(gap, viewport.height - gap - callout.height),
    };
  }
  const clampLeft = (left: number) => Math.max(gap, Math.min(left, viewport.width - gap - callout.width));
  const clampTop = (top: number) => Math.max(gap, Math.min(top, viewport.height - gap - callout.height));
  const at = (left: number, top: number): Box => ({ left: clampLeft(left), top: clampTop(top), ...callout });
  const candidates = regions.flatMap((r) => [
    at(r.left + r.width + gap, r.top),
    at(r.left - gap - callout.width, r.top),
    at(r.left, r.top + r.height + gap),
    at(r.left, r.top - gap - callout.height),
  ]);
  let best = candidates[0];
  let bestCost = Infinity;
  for (const box of candidates) {
    const cost = regions.reduce((sum, r) => sum + overlapArea(box, r), 0);
    if (cost < bestCost) {
      best = box;
      bestCost = cost;
    }
    if (cost === 0) break;
  }
  return { left: best.left, top: best.top };
}
```

Create `src/features/first-visit-tour/lib/inert-outside.ts`:

```ts
/**
 * Makes everything on the page inert except the `open` elements (with what they contain) and the
 * `keep` elements. Elements that were inert already are left as they were. Returns the undo.
 */
export function inertOutside(open: readonly Element[], keep: readonly Element[]): () => void {
  const spared = [...open, ...keep];
  const changed: Element[] = [];
  const visit = (parent: Element) => {
    for (const child of Array.from(parent.children)) {
      if (spared.includes(child)) continue;
      if (spared.some((el) => child.contains(el))) {
        visit(child);
        continue;
      }
      if (child.hasAttribute('inert')) continue;
      child.setAttribute('inert', '');
      changed.push(child);
    }
  };
  visit(document.body);
  return () => changed.forEach((el) => el.removeAttribute('inert'));
}
```

- [ ] **Step 4: Add the scrim token**

In `src/shared/styles/_tokens.scss`, add `--tour-scrim: rgba(0, 0, 0, 0.55);` in the `:root` block after `--rail-pill-active: …;` and the same line in the `[data-theme='dark']` block after its `--rail-pill-active: …;`. The spec keeps the scrim the same in both themes.

- [ ] **Step 5: Write the callout and the spotlight**

Create `src/features/first-visit-tour/ui/RichText.tsx`:

```tsx
/** Renders a tour caption's **bold** and `code` marks. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
        return part;
      })}
    </>
  );
}
```

Create `src/features/first-visit-tour/ui/FirstVisitTour.tsx`:

```tsx
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Hand } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import { TOUR_STEP_COUNT } from '@/core/store/tour-slice';
import { Button } from '@/shared/ui/controls';
import { useNarrowLayout } from '@/shared/hooks/useNarrowLayout';
import { observeResize } from '@/shared/engine/observe-resize';
import { TOUR_STEPS, type TourCaptionContext, type TourRunState } from '../model/steps';
import { makeItSpin, spinTarget } from '../model/spin';
import { placeCallout, type Box, type Size } from '../model/geometry';
import { inertOutside } from '../lib/inert-outside';
import { RichText } from './RichText';
import './first-visit-tour.scss';

/** What the tour needs from Run. The editor page passes the canvas's run controller. */
export interface TourRun {
  start: () => boolean;
  stop: () => void;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => { running: boolean };
}

export interface FirstVisitTourProps {
  run: TourRun;
  /** The C++ name the generator gives an object, as in `draw_<name>()`. */
  codeName: (name: string) => string;
  /** Opens the lesson the student should study next. */
  startLearning: () => void;
}

/** How long a finished try-it stays on screen before the tour moves on, so the student sees the result. */
export const TOUR_ADVANCE_MS = 1200;

const RUN_STEP = TOUR_STEPS.findIndex((s) => s.id === 'run');
const LAST_STEP = TOUR_STEP_COUNT - 1;
const CALLOUT_SIZE: Size = { width: 320, height: 200 };
/** Arrow keys inside these widgets move within the widget, never the tour. */
const ARROW_KEY_OWNERS = [
  '[role="menu"]', '[role="menuitem"]', '[role="radiogroup"]', '[role="tree"]',
  '[role="tablist"]', '[role="slider"]', '[role="spinbutton"]',
].join(', ');

const isField = (el: HTMLElement | null) =>
  !!el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);
const findAnchors = (ids: readonly string[]) =>
  ids
    .map((id) => document.querySelector<HTMLElement>(`[data-tour-anchor="${id}"]`))
    .filter((el): el is HTMLElement => el !== null);
const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};

/** The first-visit tour: a spotlight on one region of the editor at a time, with a callout beside it. */
export default function FirstVisitTour(props: FirstVisitTourProps) {
  const tourStep = useVamsStore((s) => s.tourStep);
  if (tourStep === null) return null;
  return <TourLayer {...props} index={tourStep} />;
}

function TourLayer({ run, codeName, startLearning, index }: FirstVisitTourProps & { index: number }) {
  const step = TOUR_STEPS[index];
  const id = useId();
  const layerRef = useRef<HTMLDivElement>(null);
  const calloutRef = useRef<HTMLDivElement>(null);
  const running = useSyncExternalStore(run.subscribe, () => run.getSnapshot().running);
  const narrow = useNarrowLayout();
  const objects = useVamsStore((s) => s.objects);
  const selectedObjectId = useVamsStore((s) => s.selectedObjectId);
  const interactionMode = useVamsStore((s) => s.interactionMode);
  const codePane = useVamsStore((s) => s.codePane);
  const baseline = useVamsStore((s) => s.tourStepBaseline);
  const setRailHidden = useVamsStore((s) => s.setRailHidden);
  const [spun, setSpun] = useState(false);
  const [layout, setLayout] = useState<{ boxes: Box[]; viewport: Size }>({ boxes: [], viewport: { width: 0, height: 0 } });
  const [calloutSize, setCalloutSize] = useState<Size>(CALLOUT_SIZE);
  // Where focus was when the tour started; it goes back there when the tour ends.
  const [returnFocus] = useState(() => document.activeElement as HTMLElement | null);
  // While Make it spin's program runs, the scrim lifts so the student watches it undimmed.
  const lifted = running && index === RUN_STEP;

  // Next, Back and ending first stop a running program, so the editor is never left half-locked.
  const actions = useMemo(() => {
    const stopRun = () => {
      if (run.getSnapshot().running) run.stop();
    };
    return {
      next: () => {
        stopRun();
        useVamsStore.getState().nextTourStep();
      },
      back: () => {
        stopRun();
        useVamsStore.getState().prevTourStep();
      },
      end: () => {
        stopRun();
        useVamsStore.getState().endTour();
      },
    };
  }, [run]);

  const learn = () => {
    startLearning();
    // Starting a lesson ends the tour already; this covers a lesson that did not start.
    if (useVamsStore.getState().tourStep !== null) useVamsStore.getState().endTour();
  };

  const spin = () => {
    if (makeItSpin(useVamsStore.getState()) === null) return;
    setSpun(true);
    run.start();
  };

  // Only the step's regions take clicks and keys.
  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (lifted || !layer) return;
    return inertOutside(findAnchors(step.anchors), [layer]);
  }, [step, lifted]);

  // The cut-outs follow the regions as they move or change size.
  useLayoutEffect(() => {
    const els = findAnchors(step.anchors);
    const measure = () =>
      setLayout({ boxes: els.map(boxOf), viewport: { width: window.innerWidth, height: window.innerHeight } });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measure();
    const stops = els.map((el) => observeResize(el, measure));
    window.addEventListener('resize', measure);
    return () => {
      stops.forEach((stop) => stop());
      window.removeEventListener('resize', measure);
    };
  }, [step, running]);

  useLayoutEffect(() => {
    const el = calloutRef.current;
    if (!el) return;
    const measure = () =>
      setCalloutSize({ width: el.offsetWidth || CALLOUT_SIZE.width, height: el.offsetHeight || CALLOUT_SIZE.height });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measure();
    return observeResize(el, measure);
  }, []);

  // The callout takes focus as the tour starts and on every step.
  useEffect(() => {
    calloutRef.current?.focus({ preventScroll: true });
  }, [index]);

  // When the tour ends, focus goes back where it was, unless a lesson took over. The microtask runs
  // after the unmount has given the page back its interactivity.
  useEffect(
    () => () => {
      queueMicrotask(() => {
        if (returnFocus?.isConnected && useVamsStore.getState().appMode !== 'Lesson') returnFocus.focus();
      });
    },
    [returnFocus],
  );

  // On a narrow screen the panel is a drawer: the steps about it open it, the others close it.
  useEffect(() => {
    if (narrow) setRailHidden(!step.drawer);
  }, [narrow, step, setRailHidden]);

  // Opening the Learn drawer from the last step ends the tour: the student has reached the course.
  useEffect(
    () =>
      useVamsStore.subscribe((state, prev) => {
        if (state.learnOpen && !prev.learnOpen) state.endTour();
      }),
    [],
  );

  // A step whose try-it is done moves on by itself, TOUR_ADVANCE_MS after the last scene edit. A step that
  // was done already when it opened (after Back) waits until the student undoes and does it again.
  // Run started on any step but Run ends the tour.
  useEffect(() => {
    const check = step.done;
    let runStarted = false;
    let lastRunning = run.getSnapshot().running;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const runState = (): TourRunState => ({ startedThisStep: runStarted, running: run.getSnapshot().running });
    const evaluate = () => {
      const state = useVamsStore.getState();
      return !!check && check(state, state.tourStepBaseline, runState());
    };
    const cancel = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    const schedule = () => {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        if (evaluate()) useVamsStore.getState().nextTourStep();
      }, TOUR_ADVANCE_MS);
    };
    let armed = !evaluate();
    const reevaluate = (edited: boolean) => {
      if (!evaluate()) {
        armed = true;
        cancel();
        return;
      }
      if (armed && (timer === null || edited)) schedule();
    };
    const offStore = useVamsStore.subscribe((state, prev) => reevaluate(state.objects !== prev.objects));
    const offRun = run.subscribe(() => {
      const nowRunning = run.getSnapshot().running;
      if (nowRunning && !lastRunning) {
        if (index === RUN_STEP) runStarted = true;
        else useVamsStore.getState().endTour();
      }
      lastRunning = nowRunning;
      reevaluate(false);
    });
    return () => {
      offStore();
      offRun();
      cancel();
    };
  }, [index, step, run]);

  // Right or Enter go on, Left goes back, Esc ends the tour. Fields keep every key; widgets that use
  // arrows keep them; a shape being placed keeps Enter (finish) and Esc (cancel); a focused button keeps Enter.
  // The listener captures on document, so it runs before the editor's own key handlers.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (isField(target)) return;
      const placing = useVamsStore.getState().interactionMode === 'VERTEX_PLACE';
      let act: (() => void) | null = null;
      if (event.key === 'ArrowRight' && !target?.closest(ARROW_KEY_OWNERS)) act = index < LAST_STEP ? actions.next : null;
      else if (event.key === 'Enter' && !placing && !target?.closest('button, a, [role="button"]')) act = index < LAST_STEP ? actions.next : null;
      else if (event.key === 'ArrowLeft' && !target?.closest(ARROW_KEY_OWNERS)) act = actions.back;
      else if (event.key === 'Escape' && !placing && !target?.closest('[role="menu"], [role="alertdialog"]')) {
        const otherDialog = target?.closest('[role="dialog"]');
        if (!otherDialog || otherDialog === calloutRef.current) act = actions.end;
      }
      if (!act) return;
      event.preventDefault();
      event.stopPropagation();
      act();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [index, actions]);

  const ctx: TourCaptionContext = {
    state: { objects, selectedObjectId, interactionMode, codePane },
    baseline,
    codeName,
    spun,
  };
  const tryIt = step.tryIt?.(ctx) ?? null;
  const canSpin = index === RUN_STEP && !running && spinTarget({ objects, selectedObjectId }) !== null;
  const position = placeCallout(layout.boxes, layout.viewport, calloutSize);

  return (
    <div ref={layerRef} className={lifted ? 'tour is-lifted' : 'tour'}>
      {!lifted && (
        <svg className="tour__scrim" aria-hidden="true">
          <defs>
            <mask id={`${id}-mask`}>
              <rect width="100%" height="100%" fill="white" />
              {layout.boxes.map((box, i) => (
                <rect key={i} x={box.left} y={box.top} width={box.width} height={box.height} fill="black" />
              ))}
            </mask>
          </defs>
          <rect className="tour__shade" width="100%" height="100%" mask={`url(#${id}-mask)`} />
        </svg>
      )}
      {!lifted &&
        layout.boxes.map((box, i) => (
          <div key={i} className="tour__outline" style={{ left: box.left, top: box.top, width: box.width, height: box.height }} />
        ))}
      <div
        ref={calloutRef}
        className="tour-callout"
        role="dialog"
        aria-modal="false"
        aria-labelledby={`${id}-step`}
        aria-describedby={`${id}-caption`}
        tabIndex={-1}
        style={{ left: position.left, top: position.top }}
      >
        <p id={`${id}-step`} className="tour-callout__step">Step {index + 1} of {TOUR_STEP_COUNT}</p>
        <p id={`${id}-caption`} className="tour-callout__caption">
          <RichText text={step.caption(ctx)} />
        </p>
        {tryIt && (
          <p className="tour-callout__try">
            <Hand size={14} aria-hidden="true" />
            <span><RichText text={tryIt} /></span>
          </p>
        )}
        {canSpin && (
          <div className="tour-callout__try">
            <Hand size={14} aria-hidden="true" />
            <Button onClick={spin}>Make it spin</Button>
          </div>
        )}
        <p className="sr-only" aria-live="polite">{`Tour step ${index + 1} of ${TOUR_STEP_COUNT}: ${step.title}`}</p>
        <div className="tour-callout__actions">
          {index < LAST_STEP ? (
            <button type="button" className="tour-callout__skip" onClick={actions.end}>Skip tour</button>
          ) : (
            <span />
          )}
          <span className="tour-callout__nav">
            <Button disabled={index === 0} onClick={actions.back}>Back</Button>
            {index < LAST_STEP ? (
              <Button variant="primary" onClick={actions.next}>Next</Button>
            ) : (
              <>
                <Button onClick={actions.end}>Explore on my own</Button>
                <Button variant="primary" onClick={learn}>Start learning</Button>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
```

Create `src/features/first-visit-tour/ui/first-visit-tour.scss`:

```scss
// The first-visit tour: a scrim with cut-outs over the editor, outlines on the regions, and the callout.
// The layer takes no clicks itself: the spotlighted regions underneath take them, and the rest is inert.
.tour {
  position: fixed;
  inset: 0;
  z-index: 1000; // above the editor and its drawer, below menus (1040) and dialogs (1050)
  pointer-events: none;

  &__scrim {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  &__shade {
    fill: var(--tour-scrim);
  }

  &__outline {
    position: absolute;
    border-radius: var(--radius-m);
    box-shadow: 0 0 0 2px var(--accent);
  }
}

.tour-callout {
  position: absolute;
  box-sizing: border-box;
  width: 320px;
  max-width: calc(100vw - 24px);
  padding: var(--space-4);
  pointer-events: auto;
  color: var(--ink);
  background: var(--paper-raised);
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-m);
  box-shadow: 0 8px 24px rgba(var(--shadow-rgb), 0.28);

  &:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  &__step {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    color: var(--ink-muted);
  }

  &__caption {
    margin: 0;
    font-size: var(--text-base);
    line-height: var(--lh-base);

    code {
      font-family: var(--font-mono);
    }
  }

  &__try {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: var(--space-3) 0 0;
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    margin-top: var(--space-4);
  }

  &__nav {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  &__skip {
    padding: 0;
    font: inherit;
    font-size: var(--text-sm);
    color: var(--ink-muted);
    text-decoration: underline;
    background: none;
    border: none;
    cursor: pointer;

    &:hover {
      color: var(--ink);
    }

    &:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 2px;
    }
  }
}

// The spotlight moves with a short slide, or at once for reduced motion.
@media (prefers-reduced-motion: no-preference) {
  .tour__outline {
    transition: left 160ms ease, top 160ms ease, width 160ms ease, height 160ms ease;
  }

  .tour-callout {
    transition: left 160ms ease, top 160ms ease;
  }
}
```

Create `src/features/first-visit-tour/index.ts`:

```ts
export { default, TOUR_ADVANCE_MS, type FirstVisitTourProps, type TourRun } from './ui/FirstVisitTour';
```

- [ ] **Step 6: Start the tour from the welcome card and the Help Center**

In `src/features/onboarding/ui/WelcomeCard.tsx`, replace the `openHelp` selector with `const startTour = useVamsStore((state) => state.startTour);`, make `takeTour` call `markWelcomeSeen();` then `startTour();`, and change the doc comment's last line to "with a shortcut into the first-visit tour."

In `src/features/help/model/types.ts`, add to `HelpBlock`:

```ts
  /** The "Start the tour" button, which closes Help and starts the first-visit tour. */
  | { kind: 'start-tour' }
```

In `src/features/help/model/help-content.ts`, add `{ kind: 'start-tour' },` as the first block of the `workspace-tour` topic, and add `case 'start-tour':` beside `case 'shortcuts':` in `blockText` (both return `''`).

In `src/features/help/ui/HelpContent.tsx`, add `import { useVamsStore } from '@/core/store';`, add `case 'start-tour': return <StartTourButton />;` to `Block`, and add above `Block`:

```tsx
/** Closes Help and starts the first-visit tour, marking the welcome as seen. */
export function startTourFromHelp() {
  const state = useVamsStore.getState();
  state.markWelcomeSeen();
  state.closeHelp();
  state.startTour();
}

/** Not offered during a lesson, which the tour would end. */
function StartTourButton() {
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');
  if (inLesson) return null;
  return (
    <button type="button" className="help-start-tour" onClick={startTourFromHelp}>
      Start the tour
    </button>
  );
}
```

In `src/features/help/ui/HelpCenter.tsx`, change the import to `import HelpContent, { startTourFromHelp } from './HelpContent';`, add `const inLesson = useVamsStore((state) => state.appMode === 'Lesson');`, show the banner only when `!hasSeenWelcome && !inLesson`, and make its button's `onClick={startTourFromHelp}`. Remove the `markWelcomeSeen` selector if nothing else in the file uses it.

In `src/features/help/ui/help-center.scss`, add at the top level:

```scss
.help-start-tour {
  margin: 0 0 var(--space-4);
  padding: var(--space-2) var(--space-4);
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--on-accent);
  background: var(--accent);
  border: none;
  border-radius: var(--radius-m);
  cursor: pointer;

  &:hover {
    filter: brightness(1.08);
  }

  &:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
}
```

- [ ] **Step 7: Mount the tour in the editor**

In `src/pages/editor/ui/EditorApp.tsx`, add:

```ts
import FirstVisitTour from '@/features/first-visit-tour';
import { runController } from '@/features/callbacks/model/run-controller';
import { sanitizeName } from '@/features/code-generation/model/generator/utils';
import { startLesson } from '@/features/lesson-engine/model/start-lesson';
import { readProgress } from '@/features/lesson-engine/model/progress';
import { firstLessonToStudy } from '@/features/lesson-engine/model/catalog';

/** The tour's "Start learning": the first lesson in course order the student has not completed. */
const startLearning = () => void startLesson(firstLessonToStudy(readProgress().completed));
```

and add `<FirstVisitTour run={runController} codeName={sanitizeName} startLearning={startLearning} />` as the last child of the `overlays` fragment.

- [ ] **Step 8: Run the tests to see them pass**

Run: `npx vitest run tests/black-box/first-visit-tour.test.ts tests/black-box/help-center.test.ts`
Expected: PASS, BB-TOUR-01 to 14 and BB-HELP-01 to 07.

- [ ] **Step 9: Check it in the browser**

Start the dev server on port 5174 in the background (`npx vite --port 5174 --strictPort`), note its PID, and open `http://localhost:5174/app` at 1280 × 800 in Chrome. Clear `localStorage`, reload, press "Take the tour", and walk all six steps once by doing each try-it (pick Triangles, click three points, Enter; change Translate X; click Math; Make it spin, then Esc). Confirm: the callout never covers a spotlighted region; the canvas takes clicks in step 1; the Run step lifts the scrim while spinning; Start learning opens Pipeline's first lesson. Repeat once at 960 px wide to see the drawer open in steps 1 and 3. Stop the server by its PID.

- [ ] **Step 10: Run everything, lint, build, commit**

```bash
npm run lint && npm run build && npm test && git checkout -- tests/reports
git add src/features/first-visit-tour src/shared/styles/_tokens.scss src/pages/editor/ui/EditorApp.tsx src/features/onboarding/ui/WelcomeCard.tsx src/features/help/model/types.ts src/features/help/model/help-content.ts src/features/help/ui/HelpContent.tsx src/features/help/ui/HelpCenter.tsx src/features/help/ui/help-center.scss tests/black-box/first-visit-tour.test.ts tests/black-box/help-center.test.ts
git diff --staged --stat
git commit -m "feat(tour): spotlight the editor's regions with a callout and start it from welcome and Help"
```

---

### Task 12: Help, welcome copy, lesson wording, the product plan and the roadmap

**Files:**
- Modify: `src/features/onboarding/ui/WelcomeCard.tsx`, `src/features/help/model/help-content.ts`, `src/features/help/model/shortcuts.ts`, `src/features/lesson-engine/model/primitives-lessons.ts`, `src/features/code-generation/model/generator/handlers.ts`, `docs/product-plan.md`, `docs/specs/2026-10-04-website-overhaul-roadmap.md`, `tests/README.md`
- Test: `tests/black-box/help-center.test.ts` (BB-HELP-05 rewritten, BB-HELP-08 new), `tests/black-box/callbacks.test.ts` (the "No rules yet" body)

**Interfaces:**
- Consumes: Task 11's `{ kind: 'start-tour' }` block, already first in the `workspace-tour` topic.
- Produces: copy only. No names change.

- [ ] **Step 1: Write the failing tests**

In `tests/black-box/help-center.test.ts`, add `import { SHORTCUT_GROUPS } from '@/features/help/model/shortcuts';`, and replace the whole `BB-HELP-05` describe block with:

```ts
describe('BB-HELP-05: Help describes the rail, the Learn drawer and the lesson bar', () => {
  const text = (id: Parameters<typeof getHelpTopic>[0]) => JSON.stringify(getHelpTopic(id));

  it('never mentions the removed section menu or Lessons menu, nor words student text avoids', () => {
    const all = JSON.stringify(HELP_TOPICS);
    expect(all).not.toMatch(/section menu|Lessons menu|pick a section|in the (Pipeline|Primitives|Buffers|Transforms|Textures) section/i);
    expect(all).not.toMatch(/coming soon|not yet|not supported|unsupported|future|deferred|\b3D\b|lighting/i);
  });

  it('tours the rail and its four panels, Code and Math, Learn and the lesson bar, and starts the tour', () => {
    const tour = text('workspace-tour');
    for (const phrase of ['rail', 'Add', 'Scene', 'Settings', 'Callbacks', 'Select several', 'Code / Math', 'Hide', 'Learn', 'lesson bar']) {
      expect(tour, phrase).toContain(phrase);
    }
    expect(getHelpTopic('workspace-tour').blocks[0]).toEqual({ kind: 'start-tour' });
    expect(text('modes')).toContain('Learn');
    expect(text('modes')).toContain('lesson bar');
  });

  it('keeps the Welcome card to the editor that exists', () => {
    useVamsStore.setState({ hasSeenWelcome: false, appMode: 'Author' });
    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      render(h(WelcomeCard, {}), host);
      const welcome = document.body.textContent ?? '';
      expect(welcome).toContain('Welcome to VAMS');
      expect(welcome).toContain('The rail on the left: Add, Scene, Settings and Callbacks.');
      expect(welcome).toContain('Code and Math on the right');
      expect(welcome).not.toMatch(/pick a section|left column/i);
    } finally {
      render(null, host);
      host.remove();
      useVamsStore.setState({ hasSeenWelcome: true });
    }
  });
});
```

and append:

```ts
describe('BB-HELP-08: Help names only places the editor has', () => {
  it('never names the old left column, Add row, scene settings, lesson card or Callbacks group', () => {
    const all = JSON.stringify(HELP_TOPICS);
    expect(all).not.toMatch(/left column|Add row|scene settings|lesson card|Multi-Select|Callbacks group|top-right panel|Below the code|Panels button/i);
  });

  it('lists the tour keys with the other shortcuts', () => {
    const tour = SHORTCUT_GROUPS.find((g) => g.group === 'Tour');
    expect(tour?.items.map((i) => `${i.keys}: ${i.label}`)).toEqual([
      'Right arrow: Next tour step',
      'Enter: Next tour step',
      'Left arrow: Previous tour step',
      'Esc: End the tour',
    ]);
  });
});
```

In `tests/black-box/callbacks.test.ts`, change the expected line in "generates the "No rules yet" body" (about line 199) to `'    // No rules yet: add them in the Callbacks panel',`.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/black-box/help-center.test.ts tests/black-box/callbacks.test.ts`
Expected: FAIL in BB-HELP-05 (no "Select several" in the tour), BB-HELP-08 (the old place names, no Tour shortcuts) and the callbacks body test.

- [ ] **Step 3: Rewrite the welcome card's regions**

In `src/features/onboarding/ui/WelcomeCard.tsx`, change the three region lines to:

```tsx
              <span>The rail on the left: Add, Scene, Settings and Callbacks.</span>
```

```tsx
              <span>The center canvas: your scene, drawn live.</span>
```

```tsx
              <span>Code and Math on the right: the generated OpenGL code and the math behind it.</span>
```

- [ ] **Step 4: Rewrite the Workspace Tour topic**

In `src/features/help/model/help-content.ts`, replace the whole `workspace-tour` topic object with:

```ts
  {
    id: 'workspace-tour',
    category: 'workspace',
    title: 'Workspace Tour',
    summary: 'The rail and its panels on the left, the canvas in the center, code and math on the right.',
    keywords: ['layout', 'panels', 'rail', 'regions', 'tour', 'top bar', 'add', 'scene', 'settings', 'callbacks', 'inspector', 'hide', 'code', 'math', 'learn', 'lesson bar', 'file menu'],
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
          'Center — See. The canvas, where your scene is drawn and where you place vertices. Run sits in its top-right corner.',
          'Right — Read. The generated OpenGL code, or the math behind it, with a Code / Math switch at the top.',
        ],
      },
      { kind: 'heading', text: 'The rail and its panels' },
      {
        kind: 'definitions',
        items: [
          { term: 'Add', description: 'The ten primitives by their OpenGL names, in three groups, plus Text and a few prepared sample scenes. Pick a primitive, then click its vertices on the canvas.' },
          { term: 'Scene', description: 'The scene list, with Select several, Group, Duplicate and Delete in its toolbar, and below it the selected object’s inspector: Vertices, Buffers, Transform, Appearance and Texture, in pipeline order. Each group header names its OpenGL call. Selecting an object always opens this panel.' },
          { term: 'Settings', description: 'The scene’s own settings: Background, Viewing volume and Texture library.' },
          { term: 'Callbacks', description: 'The GLUT callbacks your program registers, with their rules. The badge on the rail counts the callbacks that are on.' },
          { term: 'Hide', description: 'Hides the panel to give the canvas more room. Any rail item, a selection or a lesson step shows it again.' },
        ],
      },
      { kind: 'heading', text: 'Code and math' },
      {
        kind: 'paragraph',
        text: 'The right column shows one thing at a time. Code is the C++ program generated from your scene; Math is the numbers behind it, with one tab per section. A dot on Code means the code changed while you were reading Math. Hide code and math folds the column to a thin tab at the edge; click the tab to bring it back.',
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
          ['Pipeline', 'How vertices become pixels: NDC, rasterization, GLUT structure'],
          ['Primitives', 'Points, lines, triangles, color, line style, and text'],
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
          'Theme — switch between dark and light.',
          'View settings — toggle axes, gridlines, the coordinate tracker, and open the shortcut list.',
          'Help — open this Help Center (also ? or F1).',
        ],
      },
      {
        kind: 'callout',
        tone: 'info',
        text: 'The editor’s tools are the same in every section. Select an object to edit it in the Scene panel; the scene’s own settings are in Settings.',
      },
    ],
    related: ['canvas-basics', 'scene-hierarchy', 'code-panel', 'math-panel', 'saving-loading'],
  },
```

- [ ] **Step 5: Update the other topics that name old places**

In the same file, make these replacements (each `text` or list item is replaced whole):

| Topic | Old text starts | New text |
| --- | --- | --- |
| `welcome`, steps list item 1 | `Add a shape from the Add row` | `Add a shape from the Add panel on the rail (or click “Add a shape” on the empty canvas).` |
| `welcome`, steps list item 2 | `Watch the generated OpenGL code appear` | `Watch the generated OpenGL code appear on the right.` |
| `welcome`, steps list item 3 | `Select the shape and edit its color` | `Select the shape and edit its color or position in the Scene panel — notice the code and math update live.` |
| `welcome`, tip callout | `New here? Read the Workspace Tour next` | `New here? Take the tour from the Workspace Tour topic: six short steps through the workspace. Press ? or F1 any time to reopen this Help Center.` |
| `canvas-basics`, tip callout | `Changing the orthographic window (the Viewing volume group in scene settings)` | `Changing the orthographic window (the Viewing volume group in the Settings panel) zooms and pans what the canvas shows without moving your objects.` |
| `modes`, second paragraph under "Running a lesson" | `The lesson card sits at the top of the left column` | `The lesson bar sits along the bottom of the canvas, and each step opens the panel its control lives in and outlines the control. Demos also dim the other groups, exercises only outline, and a section’s last exercise leaves you to find the controls yourself.` |
| `section-pipeline`, first paragraph | `The Pipeline section explains how vertices travel` | `The Pipeline section explains how vertices travel from your code to pixels on screen. Its lessons show the canvas in three views, and while a Pipeline lesson runs the lesson bar has a switch between them.` |
| `section-primitives`, paragraph under "GLUT callbacks" | `The Callbacks group in scene settings is where` | `The Callbacks panel on the rail is where you register GLUT event handlers (keyboard, mouse, idle, and more) that appear in the generated program. See the GLUT Callbacks guide.` |
| `section-transforms`, paragraph under "Animating a transform" | `To animate a transform, switch on the Idle callback` | `To animate a transform, switch on the Idle callback in the Callbacks panel and give it a rule such as "rotate Triangle by 2°". GLUT calls it every frame, so the transform changes a little each frame. Press Run to watch it. See the GLUT Callbacks guide for details.` |
| `scene-hierarchy`, first paragraph | `The Scene list sits at the top of the left column` | `The Scene list sits at the top of the Scene panel and lists every object in your scene. It is where you organize, name, and structure your work.` |
| `scene-hierarchy`, list item "Select" | `Select — click a row` | `Select — click a row to select that object and edit it in the inspector below the list (the code highlights it too).` |
| `scene-hierarchy`, list item "Duplicate or Delete" | `Duplicate or Delete — from the row actions` | `Duplicate or Delete — from the Scene toolbar; a delete can be undone.` |
| `scene-hierarchy`, list item "Group or ungroup" | `Group or ungroup — select more than one object` | `Group or ungroup — turn on Select several in the Scene toolbar, choose more than one object, and press Group to put them under a parent.` |
| `callbacks`, first paragraph | `GLUT programs respond to events through callbacks` | `GLUT programs respond to events through callbacks: functions you register so GLUT calls them when something happens. The Callbacks panel on the rail has six.` |
| `code-panel`, first paragraph | `The top-right panel shows complete` | `The Code side of the right column shows complete, valid OpenGL 1.5 C++ generated from your scene. It updates instantly as you edit, so you can connect each visual change to the code that produces it.` |
| `math-panel`, first paragraph | `Below the code, the math panel shows` | `Switch the right column to Math to see the numbers behind what you see. It has one tab per section, and the tab follows what you are doing: during a lesson, the control the step opens, otherwise the current section; outside a lesson, the inspector group you opened last, otherwise the current section. Pick a tab yourself at any time; your pick holds until the next lesson step or the next group you open.` |

Then run `grep -n "left column\|Add row\|scene settings\|lesson card\|Callbacks group\|top-right panel\|Below the code" src/features/help/model/help-content.ts` and fix anything the table missed in the same way.

- [ ] **Step 6: Add the tour keys to the shortcut list**

In `src/features/help/model/shortcuts.ts`, add before the `General` group:

```ts
  {
    group: 'Tour',
    items: [
      { keys: 'Right arrow', label: 'Next tour step' },
      { keys: 'Enter', label: 'Next tour step' },
      { keys: 'Left arrow', label: 'Previous tour step' },
      { keys: 'Esc', label: 'End the tour' },
    ],
  },
```

- [ ] **Step 7: Name the Callbacks panel in lessons and generated code**

In `src/features/lesson-engine/model/primitives-lessons.ts`, change only these narrations (focus ids and steps stay):

- `'We need the program to respond to mouse clicks. Open the Callbacks group.'` → `'We need the program to respond to mouse clicks. Open the Callbacks panel.'`
- `'Add any shape, then click an empty part of the canvas to see the Callbacks group. Register a Mouse callback …'` → `'Add any shape, then open the Callbacks panel. Register a Mouse callback and give it a rule: when the left button goes down, move the shape to the pointer.'`
- `'… Add any shape, click an empty part of the canvas to see the Callbacks group, then switch on Special keys.'` → `'Arrow keys have no ASCII code, so GLUT sends them to a separate callback, glutSpecialFunc. Add any shape, open the Callbacks panel, then switch on Special keys.'`

In `src/features/code-generation/model/generator/handlers.ts`, change the comment string on line 150 to `'    // No rules yet: add them in the Callbacks panel'` and the doc comment on line 9 to "…from the rules students build in the Callbacks panel…".

Run `grep -rn "Callbacks group\|empty part of the canvas" src` and expect no output.

- [ ] **Step 8: Run the tests to see them pass**

Run: `npx vitest run tests/black-box/help-center.test.ts tests/black-box/callbacks.test.ts tests/black-box/lesson-engine.test.ts`
Expected: PASS. If a lesson-catalog or narration test compares the old narration text, update its expected string to the new one.

- [ ] **Step 9: Amend the product plan**

In `docs/product-plan.md`:

1. Line 26, inside the diagram, replace `│  Scene + Inspector · Canvas · Lesson card         │` with `│  Rail and panel · Canvas · Lesson bar             │` (the same width, so the box stays closed).
2. Replace the whole `### Workspace Layout` section (from its heading to the paragraph that ends "stored in the browser.") with:

```markdown
### Workspace Layout

The workspace has a top bar and three working regions:

- **Top bar**: application-level controls: Learn (the course map), the File menu (new, open, save, My scenes, export), undo and redo, theme, view settings and Help.
- **Rail and panel**: a slim labelled rail on the left with Add, Scene and Settings, a divider, then Callbacks, and Hide at the bottom. One panel shows beside it at a time:
  - *Add*: the ten primitives by OpenGL name in three groups (points and lines, triangles, quads and polygons), Text, and the prepared sample scenes.
  - *Scene*: the object hierarchy with its toolbar (Select several, Group, Duplicate, Delete), and below it the selected object's inspector with groups in pipeline order (Vertices, Buffers, Transform, Appearance, Texture), each naming its OpenGL call.
  - *Settings*: the scene's settings (Background, Viewing volume, Texture library).
  - *Callbacks*: the GLUT callbacks and their rules. The rail item's badge counts the valid callbacks.

  The rail opens on Add for an empty scene and on Scene otherwise, and selecting an object always switches it to Scene. Hide is temporary: any rail click, selection or lesson step shows the panel again. Below 1100 px the panel opens as a drawer over the canvas, beside the rail.
- **Canvas**: central 2D viewport. Displays the scene. Supports mouse interaction for object placement, selection, vertex editing, and navigation. Run sits in its top-right corner and, when it is off, says why on the canvas.
- **Code and math column**: right sidebar showing one pane at a time, switched by a Code / Math control. A dot on Code marks a code change made while Math shows. The whole column can be hidden to a thin edge tab.

While a lesson is active, a lesson bar runs along the bottom of the canvas with the title, the step, the narration, what an exercise is waiting for, and Back, Next and Exit; it folds to a slim strip. The step's control is opened in its rail panel and outlined in the live editor; demos also dim the other groups, exercises only outline, and a section's last exercise gives no focus. The top bar's Learn button opens the course map: the five sections in pipeline order, each section's demos and exercises, and the student's progress, stored in the browser.

A first-visit tour, started from the welcome dialog or the Help Center, spotlights the regions in the order VAMS teaches (build a shape, read its code, change it, see the math, run it, then go on to the lessons) and invites the student to try each one.
```

3. Line 143: `displayed in the lesson card` → `displayed in the lesson bar`.
4. Line 192: replace `- **Lesson card (Pipeline lessons):** a view toggle (scene, pipeline diagram, raster vs vector) shown during Pipeline lessons.` with `- **Lesson bar (Pipeline lessons):** a view switch (pipeline diagram, raster vs vector, playground) shown during Pipeline lessons.` and keep the rest of that bullet.
5. Line 584: `(displayed in the lesson card)` → `(displayed in the lesson bar)`.

Run `grep -n "lesson card\|Lesson card\|Add row" docs/product-plan.md` and expect no output.

- [ ] **Step 10: Update the roadmap**

In `docs/specs/2026-10-04-website-overhaul-roadmap.md` (use today's date from `date +%F` wherever `DATE` appears):

1. Under `### Should`, after item 13, add one unnumbered line, so items 14 to 18 keep their numbers:

```markdown
- **Editor rail redesign:** a labelled rail of four panels (Add, Scene, Settings, Callbacks) in place of the long left column, the lesson as a bar under the canvas, one Code / Math pane, the two Run fixes most likely to show on stage, and the first-visit tour (item 15). Due by Oct 28. Complete (DATE): [spec](2026-10-14-editor-rail-design.md), [plan](../plans/2026-10-14-editor-rail.md)
```

2. Item 15 becomes `15. First-visit editor tour (by Oct 28). Complete (DATE) with the editor rail redesign`.
3. In "Functional callbacks (2026-10-12)", prefix Run-mode items 1, 2 and 12 with `Fixed DATE (editor rail redesign): ` and leave their text after it.
4. Replace divergence 10 with:

```markdown
10. §3.4.2's five layout regions and its top-bar actions. The lesson bar sits under the canvas, the left column is a rail of four panels (Add, Scene, Settings, Callbacks) that shows one at a time, the code and math column shows code or math with a switch, and the file actions move into a File menu in the top bar (SP5, editor rail redesign).
```

5. Replace divergence 11 with:

```markdown
11. The manuscript describes a tools rail whose panels change with the selected curriculum section, with the Pipeline section's canvas modes as section tools. The editor is now the same in every section: a rail of four panels whose Scene panel holds the scene list and the selected object's pipeline-ordered inspector. Sections become the course map in a Learn drawer, and the Pipeline views appear in the lesson bar during Pipeline lessons (editor refinement, editor rail redesign).
```

- [ ] **Step 11: Update the test map**

In `tests/README.md`:

1. Change the `run-mode.test.ts` line's `└──` to `├──` and add after it:

```
│   └── first-visit-tour.test.ts          (BB-TOUR-*: the first-visit tour's
│                                            steps, checks and spotlight)
```

2. In the `editor-shell.test.ts` entry, replace "the editor column and" with "the rail, the panels and"; in the `lesson-column.test.ts` entry, replace "the lesson card," with "the lesson bar,"; in the `editor.spec.ts` entry, replace "including the Callbacks group and Run, VIS-EDITOR-14 to 16," with "including the rail panels, the lesson bar, the tour and Run, VIS-EDITOR-14 to 28,".
3. Run `npm test`, read the total from its summary line, and put that number in `npm test                # run all N tests`. Leave the acceptance-bar table alone; it reports the evaluated build.

- [ ] **Step 12: Run everything, lint, build, commit**

```bash
npm run lint && npm run build && npm test && git checkout -- tests/reports
git add src/features/onboarding/ui/WelcomeCard.tsx src/features/help/model/help-content.ts src/features/help/model/shortcuts.ts src/features/lesson-engine/model/primitives-lessons.ts src/features/code-generation/model/generator/handlers.ts docs/product-plan.md docs/specs/2026-10-04-website-overhaul-roadmap.md tests/README.md tests/black-box/help-center.test.ts tests/black-box/callbacks.test.ts
git diff --staged --stat
git commit -m "docs: describe the rail, the lesson bar and the tour in Help, the product plan and the roadmap"
```

If Step 8 changed another test file, add it to the `git add` line.

---

### Task 13: Screenshot checks for the new layout

**Files:**
- Modify: `tests/visual/editor.spec.ts`
- Test: `npm run test:visual` (not part of `npm test`; baselines in `tests/visual/baseline.local/`, never committed)

**Interfaces:**
- Consumes: the DOM names from Tasks 2 to 11: rail tabs (`role="tab"`, named Add, Scene, Settings, Callbacks…), the rail's Hide button, "Hide code and math", the Code / Math radios, "Fold lesson", the welcome card's "Take the tour", `.tour-callout`.
- Produces: VIS-EDITOR-17 to 28; VIS-EDITOR-07, 10 and 14 and the `callbacksWithRules` helper updated.

- [ ] **Step 1: Update the checks that used the old layout**

In `tests/visual/editor.spec.ts`:

1. VIS-EDITOR-07: replace `await page.getByRole('button', { name: 'Panels' }).click();` with `await page.getByRole('tab', { name: 'Scene' }).click();`.
2. VIS-EDITOR-10: rename to `'VIS-EDITOR-10: An empty scene opens the Add panel, light, 1280'` and change its comment to `// A first visit opens the welcome card over the editor; dismiss it so the capture shows the Add panel.`. Keep the snapshot name `settings-light-1280.png` so the ID's baseline history stays together, or rename it to `add-empty-light-1280.png` and delete the old local baseline file; either way, record which in the commit body.
3. In `callbacksWithRules`, replace the first two lines (the canvas click and its comment, and the `Callbacks` button click) with:

```ts
  await page.getByRole('tab', { name: /^Callbacks/ }).click();
```

4. VIS-EDITOR-14: rename to `'VIS-EDITOR-14: Callbacks panel with rules and an open form, light, 1280'`.

- [ ] **Step 2: Add the new captures**

Append:

```ts
const THEMES = ['light', 'dark'] as const;

/** Opens an empty editor and closes the first-visit welcome card. */
async function openEmpty(page: Page, theme: Theme) {
  await open(page, '/app', theme);
  await page.getByRole('button', { name: 'Start building' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

/** Opens the Transforms scene with its first leaf object selected. */
async function openSelected(page: Page, theme: Theme) {
  await open(page, '/app?scene=transforms', theme);
  await page.locator('[data-panel-id="scene-hierarchy"] [role="treeitem"]:not([aria-expanded]) .tree-item').first().click();
  await expect(page.locator('.inspector__meta')).toContainText('GL_');
}

/** Quiz order is drawn at random; fix the generator so the bar is the same on every run. */
async function seedRandom(page: Page) {
  await page.addInitScript(() => {
    let seed = 1;
    Math.random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  });
}

for (const theme of THEMES) {
  test(`VIS-EDITOR-17: Add panel, ${theme}, 1280`, async ({ page }) => {
    await openEmpty(page, theme);
    await expect(page.getByRole('tab', { name: 'Add' })).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveScreenshot(`panel-add-${theme}-1280.png`);
  });

  test(`VIS-EDITOR-18: Scene panel with a selection, ${theme}, 1280`, async ({ page }) => {
    await openSelected(page, theme);
    await expect(page).toHaveScreenshot(`panel-scene-${theme}-1280.png`);
  });

  test(`VIS-EDITOR-19: Settings panel, ${theme}, 1280`, async ({ page }) => {
    await open(page, '/app?scene=transforms', theme);
    await page.getByRole('tab', { name: 'Settings' }).click();
    await expect(page).toHaveScreenshot(`panel-settings-${theme}-1280.png`);
  });

  test(`VIS-EDITOR-20: Callbacks panel, ${theme}, 1280`, async ({ page }) => {
    await open(page, '/app?scene=primitives', theme);
    await page.getByRole('tab', { name: /^Callbacks/ }).click();
    await expect(page).toHaveScreenshot(`panel-callbacks-${theme}-1280.png`);
  });

  test(`VIS-EDITOR-21: Lesson bar on a demo step, ${theme}, 1280`, async ({ page }) => {
    await open(page, '/app?lesson=transforms-demo-1', theme);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.locator('.lesson-bar__step')).toContainText('Step 2');
    await expect(page).toHaveScreenshot(`lesson-bar-demo-${theme}-1280.png`);
  });

  test(`VIS-EDITOR-22: Lesson bar waiting on an exercise, ${theme}, 1280`, async ({ page }) => {
    await open(page, '/app?lesson=transforms-exercise-1', theme);
    await expect(page.locator('.lesson-bar__task')).toContainText('Waiting for you');
    await expect(page).toHaveScreenshot(`lesson-bar-exercise-${theme}-1280.png`);
  });

  test(`VIS-EDITOR-23: Lesson bar quiz, ${theme}, 1280`, async ({ page }) => {
    await seedRandom(page);
    await open(page, '/app?lesson=pipeline-exercise-2', theme);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page).toHaveScreenshot(`lesson-bar-quiz-${theme}-1280.png`);
  });

  test(`VIS-EDITOR-24: Lesson bar folded, ${theme}, 1280`, async ({ page }) => {
    await open(page, '/app?lesson=transforms-demo-1', theme);
    await page.getByRole('button', { name: 'Fold lesson' }).click();
    await expect(page.getByRole('button', { name: 'Unfold lesson' })).toBeVisible();
    await expect(page).toHaveScreenshot(`lesson-bar-folded-${theme}-1280.png`);
  });

  test(`VIS-EDITOR-25: Math pane, ${theme}, 1280`, async ({ page }) => {
    await openSelected(page, theme);
    await page.getByRole('radio', { name: 'Math' }).click();
    await expect(page.getByRole('radio', { name: 'Math' })).toHaveAttribute('aria-checked', 'true');
    await expect(page).toHaveScreenshot(`math-pane-${theme}-1280.png`);
  });

  test(`VIS-EDITOR-26: Panel hidden, ${theme}, 1280`, async ({ page }) => {
    await open(page, '/app?scene=transforms', theme);
    await page.getByRole('button', { name: 'Hide', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Show', exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot(`panel-hidden-${theme}-1280.png`);
  });

  test(`VIS-EDITOR-27: Code and math hidden, ${theme}, 1280`, async ({ page }) => {
    await open(page, '/app?scene=transforms', theme);
    await page.getByRole('button', { name: 'Hide code and math' }).click();
    await expect(page.getByRole('button', { name: 'Show code and math' })).toBeVisible();
    await expect(page).toHaveScreenshot(`code-hidden-${theme}-1280.png`);
  });

  test(`VIS-EDITOR-28: First-visit tour, Build step, ${theme}, 1280`, async ({ page }) => {
    await open(page, '/app', theme);
    await page.getByRole('button', { name: 'Take the tour' }).click();
    await expect(page.locator('.tour-callout')).toContainText('Step 1 of 6');
    await expect(page).toHaveScreenshot(`tour-build-${theme}-1280.png`, { animations: 'disabled' });
  });
}
```

If a radio's accessible name is "Code changed" plus "Code" or similar, the Math radio is still named exactly "Math"; if Playwright reports more than one match for `{ name: 'Math' }` (the math tabs), scope it: `page.locator('.code-math-switch').getByRole('radio', { name: 'Math' })`.

- [ ] **Step 3: Retake the baselines and look at them**

The redesign changes every editor capture, so the local baselines are retaken once:

```bash
npx playwright test tests/visual/editor.spec.ts --update-snapshots
```

Expected: every VIS-EDITOR test passes and writes a baseline. Then open the PNGs in `tests/visual/baseline.local/` for VIS-EDITOR-05, 07, 13, 17 to 28 and check each against the spec: the rail's active pill and the Callbacks divider; one panel at a time; the lesson bar along the bottom with Next the only coloured control; the Code / Math switch; the 30 px edge tab when the column is hidden; in the tour capture, the scrim with the Add pill, the panel and the canvas cut out and outlined, and the callout over the code column. Anything that looks wrong is a defect in the task that built it: fix it there, rerun the affected unit tests, and retake only the affected baselines.

- [ ] **Step 4: Run the checks again against the new baselines**

Run: `npm run test:visual`
Expected: all VIS-EDITOR, VIS-LEARN and VIS-ABOUT checks pass. A VIS-LEARN or VIS-ABOUT difference means a shared style changed outside the editor; find the cause before retaking those baselines.

- [ ] **Step 5: Commit**

```bash
npm run lint && npm run build && npm test && git checkout -- tests/reports
git add tests/visual/editor.spec.ts
git diff --staged --stat
git commit -m "test(visual): capture the rail panels, the lesson bar, both hidden states and the tour"
```

The baselines stay in `tests/visual/baseline.local/`, which git ignores.
