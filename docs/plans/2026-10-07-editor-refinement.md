# Editor Refinement Implementation Plan

**Goal:** Separate the editor from the course. The editor becomes one editor in every section: a scene area, an inspector in pipeline order, and scene settings. Lessons become a guide card over it with fading focus, chosen from a Learn drawer that shows progress.

**Architecture:**
- **Shared vocabulary in `src/core/inspector/`:** inspector group IDs, the lesson focus map, and the "context section" that the math tabs and help follow. `core` is importable from every layer.
- **Transient UI state in the runtime slice:** open groups, the last opened group, the math tab override, and whether the Learn drawer is open. The persisted `partialize` lists its keys explicitly, so none of this is saved.
- **A new widget, `src/widgets/layout/editor-column/`,** replaces `section-column`. Feature panels render inside it unchanged, in an "embedded" mode of the shared `Panel`.
- **The lesson engine gains:**
  - `focusStyleFor` (guidance fading);
  - a progress store under its own localStorage key;
  - course data;
  - `startLesson`;
  - the Learn drawer.

**Tech Stack:** Preact 10 + preact/compat, Zustand 5 + Immer, PixiJS 8, SCSS, Vitest 4 + happy-dom 20, Playwright 1.63 (local visual suite).

**Spec:** [docs/specs/2026-10-07-editor-refinement-design.md](../specs/2026-10-07-editor-refinement-design.md)

## Global Constraints

- **Prerequisite:** `feat/visual-identity` is merged into `main`. Branch `feat/editor-refinement` from `main` after that. It merges by **2026-10-28**, the editor freeze.
- **Commits:**
  - Conventional Commits (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`), with an optional scope.
  - No `Co-Authored-By` trailer and no "Generated with" line.
  - Commit text describes the engineering only.
- **Staging:**
  - Stage explicit paths and read `git diff --staged` before committing. Never `git add -A` or `git add .`.
  - Never stage `.gitignore`.
  - Never `git add -f`.
- **Before every commit:** `npm run lint`, `npm run build` and `npm test` all pass. Then `git checkout -- tests/reports`.
- **Test IDs:**
  - Existing IDs keep their numbers. A test whose behaviour this work removes is rewritten under the same ID for the behaviour that replaces it.
  - New IDs: BB-INSP-01+ (new file `tests/black-box/editor-inspector.test.ts`), BB-LEARN-01+ (new file `tests/black-box/learn-drawer.test.ts`), BB-LCOL-18+, BB-SHELL-22+, BB-PANEL-22+, BB-CTRL-25+, VIS-EDITOR-06+.
- **Student-facing text** never uses "coming soon", "not supported", "future", "deferred", "3D" or "lighting".
- **Section labels are exactly** `Pipeline | Primitives | Buffers | Transforms | Textures`, everywhere they appear (Learn rail, math tabs).
- **Modes:** two only, Author and Lesson.
- **Lessons are data:** no lesson file changes. `focusPanel` IDs, narration and panel titles stay as they are.
- **Persistence:**
  - `vams-storage` stays at `version: 7`, and its `partialize` output keeps exactly its current keys.
  - Lesson progress lives under `vams-lesson-progress` only.
- **Section switching:** `setActiveSection` in `core/store/runtime-slice.ts` stays the single place a section change resets state.
- **Generated code** does not change. The code generator does not read the section.
- **FSD:**
  - Imports only from lower layers, the own slice, or `core`.
  - Widgets may import features; features never import widgets or sibling features. The exceptions that already exist stay as they are.
- **Accent rule** (from the visual identity): the accent marks only active or selected things.
- **Never run `taskkill /IM node.exe`.** Stop only processes you started.

## Review Focus

Five conditions the spec implies but no happy-path test reaches. Each has a test in the task that owns the code:

1. **`vams-lesson-progress` holds hand-edited, old-format, or prototype-key data** (for example `"completed": ["toString"]`). Expected: read as clean progress, never throw, unknown IDs ignored. Test: BB-LEARN-02 (Task 5).
2. **localStorage is full or blocked when a lesson finishes.** Expected: the lesson still finishes and returns to Author mode. Only the progress write is lost. Test: BB-LEARN-03 (Task 5).
3. **A focus step targets a per-object group while nothing is selected and the scene is empty.** Expected: no crash. The inspector shows scene settings, and nothing is auto-selected. Test: BB-LCOL-20 (Task 4).
4. **A saved `vams-storage` from before this change is rehydrated.** Expected: the scene loads, and the new transient fields take their defaults instead of being read from storage. Test: BB-INSP-05 (Task 1).
5. **Starting a lesson from the Learn drawer while another lesson runs, then cancelling the confirmation.** Expected: the running lesson continues at the same step, with the scene unchanged. Test: BB-LEARN-07 (Task 5).

---

## File map

| File | Change | Responsibility |
| --- | --- | --- |
| `src/core/inspector/groups.ts`, `focus-map.ts`, `context-section.ts`, `index.ts` | new | Group IDs, focus map, context section |
| `src/core/store/types.ts`, `runtime-slice.ts`, `lesson-slice.ts` | modify | Transient inspector and drawer state; lesson resets |
| `src/shared/ui/controls/Panel.tsx`, `panel-context.ts`, `panel.scss` | modify | Embedded panel mode |
| `src/features/vertex-editor/ui/VerticesPanel.tsx`, `vertices-panel.scss` | new | Vertex x/y fields |
| `src/features/custom-shapes/ui/CustomShapeBuilderPanel.tsx`, `custom-shape-builder-panel.scss` | modify | Add row with a More menu |
| `src/features/line-style/ui/LineStylePanel.tsx`, `src/features/textures/ui/TextureAttachmentPanel.tsx` | modify | Export `LINE_TYPES`, `TEXTUREABLE_TYPES` |
| `src/features/animation-preview/ui/AnimationPreviewPanel.tsx` | modify | Renders in Lesson mode |
| `src/widgets/layout/editor-column/*` | new | Column, scene area, inspector, groups |
| `src/widgets/layout/section-column/*` | delete | Replaced |
| `src/pages/editor/ui/EditorApp.tsx`, `EditorShell.tsx` | modify | Mount the new column and the drawer |
| `src/features/lesson-engine/model/guidance.ts`, `progress.ts`, `course.ts`, `start-lesson.ts` | new | Fading, progress, course data, starting a lesson |
| `src/features/lesson-engine/model/useLessonRunner.ts` | modify | Fading, auto-select, finish and exit records |
| `src/features/lesson-engine/ui/LessonCard.tsx` | modify | Children slot, focus hand-off, Finish |
| `src/features/lesson-engine/ui/LearnButton.tsx`, `LearnDrawer.tsx`, `learn-drawer.scss` | new | Learn drawer |
| `src/features/lesson-engine/ui/LessonLauncher.tsx` | delete | Replaced by Learn |
| `src/widgets/layout/top-bar/TopBar.tsx` | modify | Learn button |
| `src/widgets/canvas/ViewportRouter.tsx`, `VamsCanvas.tsx`, `ui/CanvasOverlays.tsx` | modify | Illustrations only in Pipeline lessons; empty state |
| `src/features/code-generation/ui/SceneCodePanel.tsx` | modify | Annotations whenever the scene is empty |
| `src/features/math-panel/ui/MathPanel.tsx`, `math-panel.scss` | modify | Section tabs |
| `src/features/help/ui/HelpButton.tsx`, `HelpCenter.tsx` | modify | Topic follows the context section |
| `src/shared/ui/code-viewer/CodeViewer.tsx`, `code-viewer.scss` | modify | Horizontal scroll to highlighted lines; accent change mark |
| `src/shared/styles/_tokens.scss` | modify | `selected-mark` mixin; accent change highlight |
| Editor stylesheets (Task 7 list) | modify | Type scale, sentence case, one selection style |
| `src/shared/engine/pixi/hooks/useGridSystem.ts` | modify | NDC tick marks; JetBrains Mono labels |
| `docs/product-plan.md`, `docs/specs/2026-10-04-website-overhaul-roadmap.md` | modify | Amendment; status |
| `tests/black-box/*.test.ts`, `tests/visual/editor.spec.ts` | modify, new | As listed per task |

---

### Task 1: Inspector vocabulary and transient UI state

**Files:**
- Create: `src/core/inspector/groups.ts`, `src/core/inspector/focus-map.ts`, `src/core/inspector/context-section.ts`, `src/core/inspector/index.ts`
- Modify: `src/core/store/types.ts` (`RuntimeSlice`), `src/core/store/runtime-slice.ts`, `src/core/store/lesson-slice.ts` (`setLessonFocusPanel`, `clearLessonState`)
- Test: `tests/black-box/editor-inspector.test.ts` (new: BB-INSP-01…05)

**Interfaces:**
- Produces (from `@/core/inspector`):
  - `type ObjectGroupId = 'vertices' | 'buffers' | 'transform' | 'appearance' | 'texture' | 'animation'`
  - `type SettingsGroupId = 'background' | 'viewing-volume' | 'texture-library' | 'callbacks'`
  - `type InspectorGroupId = ObjectGroupId | SettingsGroupId`
  - `OBJECT_GROUPS`, `SETTINGS_GROUPS`, `DEFAULT_OPEN_GROUPS: readonly InspectorGroupId[] = ['transform', 'background']`
  - `GROUP_SECTION: Record<InspectorGroupId, CurriculumSection>`
  - `type FocusPlace = { area: 'scene'; target: 'list' | 'add' | 'create-text' } | { area: 'object'; group: ObjectGroupId } | { area: 'settings'; group: SettingsGroupId } | { area: 'lesson-card' }`
  - `FOCUS_PANEL_IDS: readonly string[]`
  - `resolveFocus(panelId: string | null | undefined, hasSelection: boolean): FocusPlace | null`
  - `sectionForPlace(place: FocusPlace): CurriculumSection`
  - `contextSection(s: ContextState): CurriculumSection`, where `ContextState = Pick<VamsState, 'appMode' | 'lessonFocusPanel' | 'selectedObjectId' | 'lastOpenedGroup' | 'activeSection'>`
  - `mathTabFor(s: ContextState & Pick<VamsState, 'mathTabOverride'>): CurriculumSection`
- Produces (store): `openGroups: InspectorGroupId[]`, `lastOpenedGroup: InspectorGroupId | null`, `mathTabOverride: CurriculumSection | null`, `learnOpen: boolean`, `toggleGroup(id)`, `openGroup(id)`, `setOpenGroups(ids)`, `setMathTabOverride(section | null)`, `setLearnOpen(open)`.

- [ ] **Step 1: Write the failing tests**

Create `tests/black-box/editor-inspector.test.ts`:

```ts
/**
 * BLACK-BOX TEST SUITE — BB-INSP
 * The unified editor: inspector groups, lesson focus places, math tabs and help context.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { useVamsStore } from '@/core/store';
import {
  DEFAULT_OPEN_GROUPS,
  FOCUS_PANEL_IDS,
  contextSection,
  mathTabFor,
  resolveFocus,
  sectionForPlace,
} from '@/core/inspector';

afterEach(() => {
  useVamsStore.getState().clearLessonState();
  useVamsStore.setState({
    appMode: 'Author',
    activeSection: 'Pipeline',
    openGroups: [...DEFAULT_OPEN_GROUPS],
    lastOpenedGroup: null,
    mathTabOverride: null,
    learnOpen: false,
  });
});

describe('BB-INSP-01: Every lesson focus target has a place in the editor', () => {
  it('maps panel ids to the scene area, object groups, scene settings or the lesson card', () => {
    expect(resolveFocus('scene-hierarchy', false)).toEqual({ area: 'scene', target: 'list' });
    expect(resolveFocus('primitive-palette', true)).toEqual({ area: 'scene', target: 'add' });
    expect(resolveFocus('text-node-panel', false)).toEqual({ area: 'scene', target: 'create-text' });
    expect(resolveFocus('buffers-panel', true)).toEqual({ area: 'object', group: 'buffers' });
    expect(resolveFocus('object-transform', true)).toEqual({ area: 'object', group: 'transform' });
    expect(resolveFocus('line-style-panel', true)).toEqual({ area: 'object', group: 'appearance' });
    expect(resolveFocus('texture-attach', true)).toEqual({ area: 'object', group: 'texture' });
    expect(resolveFocus('uv-editor', true)).toEqual({ area: 'object', group: 'texture' });
    expect(resolveFocus('animation-preview', true)).toEqual({ area: 'object', group: 'animation' });
    expect(resolveFocus('ortho-editor', true)).toEqual({ area: 'settings', group: 'viewing-volume' });
    expect(resolveFocus('texture-library', true)).toEqual({ area: 'settings', group: 'texture-library' });
    expect(resolveFocus('callbacks-panel', true)).toEqual({ area: 'settings', group: 'callbacks' });
    expect(resolveFocus('pipeline-mode-controls', false)).toEqual({ area: 'lesson-card' });
    expect(resolveFocus('nope', true)).toBeNull();
    expect(resolveFocus(null, true)).toBeNull();
    expect(FOCUS_PANEL_IDS).toContain('object-transform');
  });

  it('sends the appearance panel to the object with a selection and to Background without one', () => {
    expect(resolveFocus('appearance-panel', true)).toEqual({ area: 'object', group: 'appearance' });
    expect(resolveFocus('appearance-panel', false)).toEqual({ area: 'settings', group: 'background' });
  });
});

describe('BB-INSP-02: Each place belongs to a curriculum section', () => {
  it('follows the spec table', () => {
    expect(sectionForPlace({ area: 'scene', target: 'add' })).toBe('Primitives');
    expect(sectionForPlace({ area: 'object', group: 'vertices' })).toBe('Primitives');
    expect(sectionForPlace({ area: 'object', group: 'buffers' })).toBe('Buffers');
    expect(sectionForPlace({ area: 'object', group: 'animation' })).toBe('Transforms');
    expect(sectionForPlace({ area: 'settings', group: 'viewing-volume' })).toBe('Transforms');
    expect(sectionForPlace({ area: 'settings', group: 'texture-library' })).toBe('Textures');
    expect(sectionForPlace({ area: 'settings', group: 'callbacks' })).toBe('Pipeline');
    expect(sectionForPlace({ area: 'lesson-card' })).toBe('Pipeline');
  });
});

describe('BB-INSP-03: The context section follows focus, then the opened group, then the section', () => {
  it('prefers a lesson focus, then the last opened group, then activeSection; a manual tab wins until cleared', () => {
    const base = { appMode: 'Author' as const, lessonFocusPanel: null, selectedObjectId: null, lastOpenedGroup: null, activeSection: 'Pipeline' as const, mathTabOverride: null };
    expect(contextSection(base)).toBe('Pipeline');
    expect(contextSection({ ...base, lastOpenedGroup: 'texture' })).toBe('Textures');
    expect(contextSection({ ...base, appMode: 'Lesson', lessonFocusPanel: 'buffers-panel', selectedObjectId: 'x', lastOpenedGroup: 'texture' })).toBe('Buffers');
    expect(mathTabFor({ ...base, lastOpenedGroup: 'texture', mathTabOverride: 'Transforms' })).toBe('Transforms');
  });
});

describe('BB-INSP-04: Groups toggle, remember the last opened one, and clear a manual tab', () => {
  it('updates the transient state through store actions', () => {
    const s = () => useVamsStore.getState();
    expect(s().openGroups).toEqual(['transform', 'background']);
    s().setMathTabOverride('Textures');
    s().toggleGroup('buffers');
    expect(s().openGroups).toContain('buffers');
    expect(s().lastOpenedGroup).toBe('buffers');
    expect(s().mathTabOverride).toBeNull();
    s().toggleGroup('buffers');
    expect(s().openGroups).not.toContain('buffers');
    s().setOpenGroups(['texture']);
    s().openGroup('texture');
    expect(s().openGroups).toEqual(['texture']);
    s().setMathTabOverride('Buffers');
    s().setLessonFocusPanel('object-transform');
    expect(s().mathTabOverride).toBeNull();
    s().setActiveSection('Textures');
    expect(s().openGroups).toEqual(['transform', 'background']);
    expect(s().lastOpenedGroup).toBeNull();
  });

  it('resets the Pipeline view when a lesson ends', () => {
    useVamsStore.setState({ pipelineMode: 'Diagram', activePipelineStage: 2 });
    useVamsStore.getState().clearLessonState();
    expect(useVamsStore.getState().pipelineMode).toBe('Playground');
    expect(useVamsStore.getState().activePipelineStage).toBeNull();
  });
});

describe('BB-INSP-05: The persisted shape is unchanged and transient state is never saved', () => {
  it('keeps version 7, the same partialize keys, and no inspector fields', () => {
    const options = (useVamsStore as unknown as { persist: { getOptions: () => { version: number; partialize: (s: unknown) => object } } }).persist.getOptions();
    expect(options.version).toBe(7);
    const keys = Object.keys(options.partialize(useVamsStore.getState())).sort();
    expect(keys).toEqual([
      'activeSection', 'axisVisibility', 'callbacks', 'callbacksBackup', 'canvasBackgroundColor',
      'canvasBackgroundColorBackup', 'hasSeenWelcome', 'learningSettings', 'objects', 'sceneBackup',
      'showCoordinateTracker', 'theme', 'uploadedTextures', 'uploadedTexturesBackup', 'viewportLimits',
      'viewportLimitsBackup',
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/editor-inspector.test.ts`
Expected: FAIL. `@/core/inspector` does not exist.

- [ ] **Step 3: Write the vocabulary**

`src/core/inspector/groups.ts`:

```ts
import type { CurriculumSection } from '@/core/store/types';

export type ObjectGroupId = 'vertices' | 'buffers' | 'transform' | 'appearance' | 'texture' | 'animation';
export type SettingsGroupId = 'background' | 'viewing-volume' | 'texture-library' | 'callbacks';
export type InspectorGroupId = ObjectGroupId | SettingsGroupId;

/** Pipeline order: the order the inspector shows them. */
export const OBJECT_GROUPS: readonly ObjectGroupId[] = ['vertices', 'buffers', 'transform', 'appearance', 'texture', 'animation'];
export const SETTINGS_GROUPS: readonly SettingsGroupId[] = ['background', 'viewing-volume', 'texture-library', 'callbacks'];

/** Open by default: Transform for an object, Background for the scene. */
export const DEFAULT_OPEN_GROUPS: readonly InspectorGroupId[] = ['transform', 'background'];

/** The curriculum section whose math and help belong to each group. */
export const GROUP_SECTION: Record<InspectorGroupId, CurriculumSection> = {
  vertices: 'Primitives',
  buffers: 'Buffers',
  transform: 'Transforms',
  appearance: 'Primitives',
  texture: 'Textures',
  animation: 'Transforms',
  background: 'Pipeline',
  'viewing-volume': 'Transforms',
  'texture-library': 'Textures',
  callbacks: 'Pipeline',
};
```

`src/core/inspector/focus-map.ts`:

```ts
import type { CurriculumSection } from '@/core/store/types';
import { GROUP_SECTION, type ObjectGroupId, type SettingsGroupId } from './groups';

export type FocusPlace =
  | { area: 'scene'; target: 'list' | 'add' | 'create-text' }
  | { area: 'object'; group: ObjectGroupId }
  | { area: 'settings'; group: SettingsGroupId }
  | { area: 'lesson-card' };

/** Lesson focusPanel ids (the panels' own panelId values) and where each lives in the editor. */
const FIXED: Record<string, FocusPlace> = {
  'scene-hierarchy': { area: 'scene', target: 'list' },
  'primitive-palette': { area: 'scene', target: 'add' },
  'text-node-panel': { area: 'scene', target: 'create-text' },
  'buffers-panel': { area: 'object', group: 'buffers' },
  'object-transform': { area: 'object', group: 'transform' },
  'line-style-panel': { area: 'object', group: 'appearance' },
  'texture-attach': { area: 'object', group: 'texture' },
  'uv-editor': { area: 'object', group: 'texture' },
  'animation-preview': { area: 'object', group: 'animation' },
  'ortho-editor': { area: 'settings', group: 'viewing-volume' },
  'texture-library': { area: 'settings', group: 'texture-library' },
  'callbacks-panel': { area: 'settings', group: 'callbacks' },
  'pipeline-mode-controls': { area: 'lesson-card' },
};

export const FOCUS_PANEL_IDS: readonly string[] = [...Object.keys(FIXED), 'appearance-panel'];

export function resolveFocus(panelId: string | null | undefined, hasSelection: boolean): FocusPlace | null {
  if (!panelId) return null;
  // The appearance panel is the object's colour with a selection and the background without one.
  if (panelId === 'appearance-panel') {
    return hasSelection ? { area: 'object', group: 'appearance' } : { area: 'settings', group: 'background' };
  }
  return Object.prototype.hasOwnProperty.call(FIXED, panelId) ? FIXED[panelId] : null;
}

export function sectionForPlace(place: FocusPlace): CurriculumSection {
  switch (place.area) {
    case 'scene':
      return 'Primitives';
    case 'lesson-card':
      return 'Pipeline';
    default:
      return GROUP_SECTION[place.group];
  }
}
```

`src/core/inspector/context-section.ts`:

```ts
import type { CurriculumSection, VamsState } from '@/core/store/types';
import { GROUP_SECTION } from './groups';
import { resolveFocus, sectionForPlace } from './focus-map';

export type ContextState = Pick<VamsState, 'appMode' | 'lessonFocusPanel' | 'selectedObjectId' | 'lastOpenedGroup' | 'activeSection'>;

/** The section the student is working in right now: lesson focus, then the last opened group, then the course section. */
export function contextSection(s: ContextState): CurriculumSection {
  if (s.appMode === 'Lesson') {
    const place = resolveFocus(s.lessonFocusPanel, s.selectedObjectId !== null);
    if (place) return sectionForPlace(place);
  }
  if (s.lastOpenedGroup) return GROUP_SECTION[s.lastOpenedGroup];
  return s.activeSection;
}

/** A tab the student picked by hand wins until the next lesson step or opened group clears it. */
export function mathTabFor(s: ContextState & Pick<VamsState, 'mathTabOverride'>): CurriculumSection {
  return s.mathTabOverride ?? contextSection(s);
}
```

`src/core/inspector/index.ts`:

```ts
export * from './groups';
export * from './focus-map';
export * from './context-section';
```

- [ ] **Step 4: Add the transient state**

In `src/core/store/types.ts`:
- add `import type { InspectorGroupId } from '@/core/inspector/groups';` beside the other type imports;
- extend `RuntimeSlice` with:

```ts
  /** Inspector groups that are open. Session only. */
  openGroups: InspectorGroupId[];
  /** The group the student opened most recently; the math tab and help follow it. Session only. */
  lastOpenedGroup: InspectorGroupId | null;
  /** A math tab picked by hand; cleared by the next lesson step or opened group. Session only. */
  mathTabOverride: CurriculumSection | null;
  learnOpen: boolean;
  toggleGroup: (id: InspectorGroupId) => void;
  openGroup: (id: InspectorGroupId) => void;
  setOpenGroups: (ids: readonly InspectorGroupId[]) => void;
  setMathTabOverride: (section: CurriculumSection | null) => void;
  setLearnOpen: (open: boolean) => void;
```

Replace `src/core/store/runtime-slice.ts` with:

```ts
import type { StateCreator } from 'zustand';
import type { VamsState, RuntimeSlice } from '@/core/store/types';
import { DEFAULT_OPEN_GROUPS } from '@/core/inspector/groups';

export const createRuntimeSlice: StateCreator<VamsState, [], [], RuntimeSlice> = (set) => ({
  appMode: 'Author',
  activeSection: 'Pipeline',
  pipelineMode: 'Playground',
  activePipelineStage: null,
  cursorWorld: null,
  openGroups: [...DEFAULT_OPEN_GROUPS],
  lastOpenedGroup: null,
  mathTabOverride: null,
  learnOpen: false,

  setAppMode: (mode) => set({ appMode: mode }),

  // The one place a section change resets state: view modes and transient panel state.
  setActiveSection: (section) => set((state) => {
    if (state.activeSection === section) return {};
    return {
      activeSection: section,
      pipelineMode: 'Playground',
      activePipelineStage: null,
      openGroups: [...DEFAULT_OPEN_GROUPS],
      lastOpenedGroup: null,
      mathTabOverride: null,
    };
  }),

  setPipelineMode: (mode) => set({ pipelineMode: mode }),
  setActivePipelineStage: (stageIndex) => set({ activePipelineStage: stageIndex }),
  setCursorWorld: (pos) => set({ cursorWorld: pos }),

  toggleGroup: (id) => set((state) => (
    state.openGroups.includes(id)
      ? { openGroups: state.openGroups.filter((group) => group !== id) }
      : { openGroups: [...state.openGroups, id], lastOpenedGroup: id, mathTabOverride: null }
  )),
  openGroup: (id) => set((state) => (state.openGroups.includes(id) ? {} : { openGroups: [...state.openGroups, id] })),
  setOpenGroups: (ids) => set({ openGroups: [...ids] }),
  setMathTabOverride: (section) => set({ mathTabOverride: section }),
  setLearnOpen: (open) => set({ learnOpen: open }),
});
```

In `src/core/store/lesson-slice.ts`:
- `setLessonFocusPanel: (panelId) => set({ lessonFocusPanel: panelId, mathTabOverride: null }),`
- in `clearLessonState`'s `set({ … })`, add `pipelineMode: 'Playground', activePipelineStage: null, mathTabOverride: null,`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/editor-inspector.test.ts tests/black-box/lesson-engine.test.ts`
Expected: PASS. If BB-INSP-05's key list differs from `partialize` in `src/core/store/index.ts`, copy the keys from `partialize`. The test pins today's list, and this task must not change it.

- [ ] **Step 6: Full checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/core/inspector src/core/store/types.ts src/core/store/runtime-slice.ts src/core/store/lesson-slice.ts tests/black-box/editor-inspector.test.ts
git diff --staged
git commit -m "feat(editor): inspector vocabulary, lesson focus map and transient panel state"
```

---

### Task 2: Embedded panels, the Vertices panel and the Add row

**Files:**
- Modify: `src/shared/ui/controls/panel-context.ts`, `src/shared/ui/controls/Panel.tsx`, `src/shared/ui/controls/panel.scss`, `src/features/custom-shapes/ui/CustomShapeBuilderPanel.tsx`, `src/features/custom-shapes/ui/custom-shape-builder-panel.scss`, `src/features/line-style/ui/LineStylePanel.tsx:27`, `src/features/textures/ui/TextureAttachmentPanel.tsx:9`, `src/features/animation-preview/ui/AnimationPreviewPanel.tsx:45`
- Create: `src/features/vertex-editor/ui/VerticesPanel.tsx`, `src/features/vertex-editor/ui/vertices-panel.scss`
- Test: `tests/black-box/controls.test.ts` (BB-CTRL-25), `tests/black-box/editor-panels.test.ts` (BB-PANEL-07 rewritten, BB-PANEL-22 new)

**Interfaces:**
- Produces:
  - `PanelLayout` gains `embedded?: boolean`;
  - `export const LINE_TYPES` from `LineStylePanel.tsx`;
  - `export const TEXTUREABLE_TYPES` from `TextureAttachmentPanel.tsx`;
  - `default export VerticesPanel` (panelId `vertices-panel`);
  - the Add row trigger class `add-row__more` and item class `add-row__item`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/black-box/controls.test.ts`:

```ts
describe('BB-CTRL-25: An embedded panel is flat: a titled section, always open, outlined when focused', () => {
  it('renders no toggle and keeps data-panel-id and the lesson focus outline', () => {
    const tree = h(
      PanelLayoutContext.Provider,
      { value: { mode: 'lesson', focusPanelId: 'object-transform', embedded: true } },
      h(Panel, { title: 'Object Transform', panelId: 'object-transform', hint: 'glTranslatef' }, 'fields'),
      h(Panel, { title: 'Scene Hierarchy', panelId: 'scene-hierarchy' }, 'tree'),
    );
    const host = mount(tree);
    expect(host.querySelectorAll('.vpanel__header')).toHaveLength(0);
    const sections = host.querySelectorAll('.vpanel--embedded');
    expect(sections).toHaveLength(2);
    expect(sections[0].getAttribute('data-panel-id')).toBe('object-transform');
    expect(sections[0].classList.contains('is-lesson-focus')).toBe(true);
    expect(sections[0].querySelector('.vpanel__subhead')!.textContent).toContain('Object Transform');
    expect(sections[1].textContent).toContain('tree');
    unmount(host);
  });
});
```

In `tests/black-box/editor-panels.test.ts`, replace BB-PANEL-07 with the version below, and add BB-PANEL-22 after BB-PANEL-21. Add `import VerticesPanel from '@/features/vertex-editor/ui/VerticesPanel';` to the imports.

```ts
describe('BB-PANEL-07: The Add row names every primitive and starts placement', () => {
  it('shows four primitives, keeps the rest in More, and shows the vertex table hint while building', async () => {
    const host = mount(h(CustomShapeBuilderPanel, {}));
    const row = [...host.querySelectorAll('.add-row__item')].map((b) => b.textContent?.trim());
    expect(row).toEqual(['GL_POINTS', 'GL_LINES', 'GL_TRIANGLES', 'GL_QUADS']);
    (host.querySelector('.add-row__more') as HTMLButtonElement).click();
    await settle();
    const more = [...host.querySelectorAll('[role^="menuitem"] .vmenu__label')].map((el) => el.textContent);
    expect(more).toEqual(['GL_LINE_STRIP', 'GL_LINE_LOOP', 'GL_TRIANGLE_STRIP', 'GL_TRIANGLE_FAN', 'GL_QUAD_STRIP', 'GL_POLYGON']);
    key(document.activeElement!, 'Escape');
    await settle();
    ([...host.querySelectorAll('.add-row__item')].find((b) => b.textContent?.trim() === 'GL_TRIANGLES') as HTMLButtonElement).click();
    await settle();
    expect(useVamsStore.getState().pendingShapeType).toBe('TRIANGLES');
    expect(hints(host)).toContain('glVertex2f(x, y)');
    useVamsStore.getState().cancelCustomShape();
    unmount(host);
  });
});

describe('BB-PANEL-22: The Vertices panel edits glVertex2f positions with one undo step', () => {
  it('lists each vertex and moves it through the store', async () => {
    const tri = addTriangle();
    select(tri.id);
    const host = mount(h(VerticesPanel, {}));
    await settle();
    expect(host.querySelectorAll('tbody tr')).toHaveLength(3);
    const before = useVamsStore.getState().past.length;
    typeInto(fieldNamed(host, 'Vertex 0 X')!, '0.25');
    await settle();
    const moved = useVamsStore.getState().objects.find((o) => o.id === tri.id)!;
    expect(moved.vertices[0].x).toBeCloseTo(0.25);
    expect(useVamsStore.getState().past.length).toBe(before + 1);
    unmount(host);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/controls.test.ts tests/black-box/editor-panels.test.ts -t "BB-CTRL-25|BB-PANEL-07|BB-PANEL-22"`
Expected: FAIL. There is no embedded mode, no Add row and no VerticesPanel.

- [ ] **Step 3: Embedded panels**

`src/shared/ui/controls/panel-context.ts`:

```ts
import { createContext } from 'preact';

export interface PanelLayout {
  mode: 'author' | 'lesson';
  focusPanelId: string | null;
  /** Inside an inspector group or the scene area: a flat titled section with no toggle of its own. */
  embedded?: boolean;
}

/** In lesson mode only the step's focus panel starts open; embedded panels are always open. */
export const PanelLayoutContext = createContext<PanelLayout>({ mode: 'author', focusPanelId: null });
```

In `src/shared/ui/controls/Panel.tsx`:
- read `embedded` from the context: `const { mode, focusPanelId, embedded = false } = useContext(PanelLayoutContext);`;
- change the scroll effect's first line to `if (!isFocus || embedded) return;`;
- add `const titleId = useId();` next to `bodyId`;
- directly before the existing `return (`, add:

```tsx
  if (embedded) {
    const flat = ['vpanel', 'vpanel--embedded', isFocus ? 'is-lesson-focus' : '', className ?? ''].filter(Boolean).join(' ');
    return (
      <section ref={sectionRef} className={flat} data-panel-id={panelId} aria-labelledby={titleId}>
        <h4 id={titleId} className="vpanel__subhead">
          <span className="vpanel__title">{title}</span>
          {hint && <code className="vpanel__hint" aria-hidden="true">{hint}</code>}
        </h4>
        <div className="vpanel__body">{children}</div>
      </section>
    );
  }
```

Every hook stays above this early return, so hook order does not change.

Append to `src/shared/ui/controls/panel.scss`:

```scss
.vpanel--embedded {
  border-bottom: 0;
  padding-top: 6px;

  .vpanel__subhead {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 0;
    padding: 0 12px 4px;
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--ink-muted);
  }
  .vpanel__body { padding-top: 0; }
  &.is-lesson-focus {
    outline: 1px solid var(--accent);
    outline-offset: -1px;
    background: var(--accent-tint);
  }
}
```

- [ ] **Step 4: Export the applicability sets, and let the animation preview render in lessons**

- In `src/features/line-style/ui/LineStylePanel.tsx`, change `const LINE_TYPES` to `export const LINE_TYPES`.
- In `src/features/textures/ui/TextureAttachmentPanel.tsx`, change `const TEXTUREABLE_TYPES` to `export const TEXTUREABLE_TYPES`.
- In `src/features/animation-preview/ui/AnimationPreviewPanel.tsx:45`, change `if (appMode !== 'Author' || !selectedObjectId) return null;` to `if (!selectedObjectId) return null;`. Remove the `appMode` selector if it is now unused. The lessons' `animation-preview` steps then reach a rendered panel.

- [ ] **Step 5: The Vertices panel**

`src/features/vertex-editor/ui/VerticesPanel.tsx`:

```tsx
import './vertices-panel.scss';
import type { Vertex } from '@/core/types/scene';
import { useVamsStore } from '@/core/store';
import { DataTable, GlHint, NumberField, Panel, type DataColumn } from '@/shared/ui/controls';

/** The selected object's vertices as glVertex2f positions, editable by typing or scrubbing. */
export default function VerticesPanel() {
  const selected = useVamsStore((s) => s.objects.find((o) => o.id === s.selectedObjectId) ?? null);
  const updateVertexPosition = useVamsStore((s) => s.updateVertexPosition);
  const pushToHistory = useVamsStore((s) => s.pushToHistory);
  if (!selected) return null;

  const columns: DataColumn<Vertex>[] = [
    { key: 'index', header: '#', width: '28px', render: (_v, i) => <span className="vertex-index">{i}</span> },
    {
      key: 'x',
      header: 'X',
      numeric: true,
      render: (v, i) => (
        <NumberField
          label={`Vertex ${i} X`}
          hideTag
          value={v.x}
          step={0.05}
          onBeginChange={pushToHistory}
          onChange={(x) => updateVertexPosition(selected.id, v.id, x, v.y)}
        />
      ),
    },
    {
      key: 'y',
      header: 'Y',
      numeric: true,
      render: (v, i) => (
        <NumberField
          label={`Vertex ${i} Y`}
          hideTag
          value={v.y}
          step={0.05}
          onBeginChange={pushToHistory}
          onChange={(y) => updateVertexPosition(selected.id, v.id, v.x, y)}
        />
      ),
    },
  ];

  return (
    <Panel panelId="vertices-panel" title="Vertices" defaultOpen>
      <div className="vertices-panel">
        <GlHint call="glVertex2f" args="x, y" />
        <DataTable caption={`Vertices of ${selected.name}`} columns={columns} rows={selected.vertices} rowKey={(v) => v.id} />
      </div>
    </Panel>
  );
}
```

`src/features/vertex-editor/ui/vertices-panel.scss`:

```scss
.vertices-panel {
  display: grid;
  gap: 6px;
  .vertex-index { color: var(--ink-faint); font-family: var(--font-mono); }
}
```

- [ ] **Step 6: The Add row**

In `src/features/custom-shapes/ui/CustomShapeBuilderPanel.tsx`:
- add `MenuButton` to the `@/shared/ui/controls` import;
- under `SHAPE_DEFS`, add:

```tsx
/** The four primitives most lessons start from; the rest sit in the More menu. */
const PRIMARY: readonly PrimitiveType[] = ['POINTS', 'LINES', 'TRIANGLES', 'QUADS'];
```

Replace the `if (!pendingShapeType) { return ( … ); }` block with:

```tsx
  if (!pendingShapeType) {
    const start = (def: ShapeDefinition) => startCustomShape(def.type, def.minVertices, def.stride);
    return (
      <CollapsibleSection panelId="primitive-palette" title="Create Primitive" icon={<Edit3 size={12} />} defaultOpen={true}>
        <div className="add-row">
          {SHAPE_DEFS.filter((def) => PRIMARY.includes(def.type)).map((def) => (
            <button key={def.type} type="button" className="add-row__item" title={def.hint} onClick={() => start(def)}>
              <span className="add-row__icon" aria-hidden="true">{def.icon}</span>
              <span>{def.label}</span>
            </button>
          ))}
          <MenuButton
            label="More primitives"
            variant="quiet"
            triggerClassName="add-row__more"
            entries={SHAPE_DEFS.filter((def) => !PRIMARY.includes(def.type)).map((def) => ({
              kind: 'item' as const,
              id: def.type,
              label: def.label,
              description: def.hint,
              icon: def.icon,
              onSelect: () => start(def),
            }))}
          >
            More
          </MenuButton>
        </div>
      </CollapsibleSection>
    );
  }
```

Delete the `breakableLabel` helper if it is now unused.

In `custom-shape-builder-panel.scss`, replace the `.primitive-grid` and `.primitive-tile` rules with:

```scss
.add-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;

  &__item {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: var(--control-h);
    padding: 0 8px;
    border: 1px solid var(--rule);
    border-radius: var(--radius-s);
    background: var(--field-bg);
    color: var(--ink);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-align: left;
    &:hover { border-color: var(--ink-faint); }
  }
  &__icon { display: inline-flex; color: var(--ink-muted); svg { width: 14px; height: 14px; } }
  .add-row__more { grid-column: 1 / -1; justify-content: center; }
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/controls.test.ts tests/black-box/editor-panels.test.ts`
Expected: PASS, including BB-PANEL-11 ("has no unnamed button or input"). Every Add row button has text.

- [ ] **Step 8: Full checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/shared/ui/controls/panel-context.ts src/shared/ui/controls/Panel.tsx src/shared/ui/controls/panel.scss src/features/vertex-editor src/features/custom-shapes/ui/CustomShapeBuilderPanel.tsx src/features/custom-shapes/ui/custom-shape-builder-panel.scss src/features/line-style/ui/LineStylePanel.tsx src/features/textures/ui/TextureAttachmentPanel.tsx src/features/animation-preview/ui/AnimationPreviewPanel.tsx tests/black-box/controls.test.ts tests/black-box/editor-panels.test.ts
git diff --staged
git commit -m "feat(editor): embedded panels, a Vertices panel and the Add row"
```

---

### Task 3: The editor column replaces the section column

**Files:**
- Create: `src/widgets/layout/editor-column/EditorColumn.tsx`, `SceneArea.tsx`, `Inspector.tsx`, `InspectorGroup.tsx`, `inspector-groups.tsx`, `editor-column.scss`, `index.ts`
- Delete: `src/widgets/layout/section-column/` (all files)
- Modify: `src/pages/editor/ui/EditorApp.tsx`, `src/pages/editor/ui/EditorShell.tsx:69` (aside label), `src/features/lesson-engine/ui/LessonLauncher.tsx` (trigger class)
- Test: `tests/black-box/editor-shell.test.ts` (BB-SHELL-14, BB-SHELL-15 rewritten), `tests/black-box/lesson-column.test.ts` (BB-LCOL-06 and BB-LCOL-13 rewritten; the `SectionColumn` and `fakePanels` uses replaced)

**Interfaces:**
- Consumes:
  - Task 1: `useVamsStore` fields `openGroups`, `toggleGroup`, `setOpenGroups`, `openGroup`;
  - `@/core/inspector`;
  - Task 2: `embedded`, `VerticesPanel`, `LINE_TYPES`, `TEXTUREABLE_TYPES`.
- Produces:
  - `EditorColumn({ cardExtra? }: { cardExtra?: ComponentChildren })`, exported from `@/widgets/layout/editor-column`;
  - `Inspector`, `SceneArea`;
  - `InspectorGroup` props `{ id, title, hint, open, onToggle, focused?, dimmed?, children }`;
  - `OBJECT_GROUP_DEFS` and `SETTINGS_GROUP_DEFS` (type `GroupDef[]`);
  - the Learn trigger class `learn-trigger`, which Task 5 keeps.

- [ ] **Step 1: Write the failing tests**

In `tests/black-box/editor-shell.test.ts`:
- replace the import `import { SectionColumn, SectionMenu, type SectionPanels } from '@/widgets/layout/section-column';` with `import { EditorColumn, Inspector } from '@/widgets/layout/editor-column';`;
- replace BB-SHELL-14 and BB-SHELL-15 with:

```ts
describe('BB-SHELL-14: The editor column is the same in every section', () => {
  it('shows the scene area and the inspector whatever the section, with no section menu', async () => {
    const tri = addTriangle();
    useVamsStore.setState({ appMode: 'Author', selectedObjectId: tri.id });
    for (const section of ['Pipeline', 'Primitives', 'Buffers', 'Transforms', 'Textures'] as const) {
      useVamsStore.setState({ activeSection: section });
      const host = mount(h(EditorColumn, {}));
      await settle();
      expect(host.querySelector('.section-menu')).toBeNull();
      expect(host.querySelector('[data-panel-id="scene-hierarchy"]')).not.toBeNull();
      expect(host.querySelector('[data-panel-id="primitive-palette"]')).not.toBeNull();
      expect(host.querySelector('[data-panel-id="text-node-panel"]')).not.toBeNull();
      expect(host.querySelector('.inspector')).not.toBeNull();
      unmount(host);
    }
    useVamsStore.setState({ objects: [], selectedObjectId: null });
  });
});

describe('BB-SHELL-15: The inspector shows the object in pipeline order, or the scene settings', () => {
  it('orders object groups, leaves out ones that do not apply, and switches to settings', async () => {
    const groupTitles = (host: HTMLElement) => [...host.querySelectorAll('.inspector-group__title')].map((t) => t.textContent);
    const tri = addTriangle();
    useVamsStore.setState({ appMode: 'Author', selectedObjectId: tri.id });
    const host = mount(h(Inspector, {}));
    await settle();
    expect(groupTitles(host)).toEqual(['Vertices', 'Buffers', 'Transform', 'Appearance', 'Texture', 'Animation']);
    expect(host.querySelector('[data-group="transform"] .inspector-group__header')!.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('[data-group="vertices"] .inspector-group__header')!.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('[data-group="transform"] .inspector-group__hint')!.textContent).toContain('glTranslatef');
    useVamsStore.setState({ selectedObjectId: null });
    await settle();
    expect(groupTitles(host)).toEqual(['Background', 'Viewing volume', 'Texture library', 'Callbacks']);
    expect(host.querySelector('.inspector__name')!.textContent).toBe('Scene settings');
    unmount(host);
    useVamsStore.setState({ objects: [] });
  });

  it('leaves out Line style for a triangle and the Texture group for a line', async () => {
    const line = addPrimitive('LINES', [{ x: -0.5, y: 0 }, { x: 0.5, y: 0 }]);
    useVamsStore.setState({ appMode: 'Author', selectedObjectId: line.id });
    const host = mount(h(Inspector, {}));
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
    useVamsStore.setState({ objects: [], selectedObjectId: null, openGroups: ['transform', 'background'] });
  });
});
```

Add `addPrimitive` to the `../helpers/store` import in that file.

In `tests/black-box/lesson-column.test.ts`:
- replace the import line for `section-column` with `import { EditorColumn } from '@/widgets/layout/editor-column';`;
- delete the `fakePanels` helper and the `titles` helper, if it exists and nothing else uses it;
- replace every `h(SectionColumn, { panels: fakePanels() })` with `h(EditorColumn, {})`;
- replace BB-LCOL-06 and BB-LCOL-13 with:

```ts
describe('BB-LCOL-06: In Lesson mode the lesson card sits above the live editor', () => {
  it('shows the card, the scene area and the inspector together', async () => {
    startLesson('transforms-exercise-1');
    const host = mount(h(EditorColumn, {}));
    await settle();
    expect(host.querySelector('.lesson-card')).not.toBeNull();
    expect(host.querySelector('.scene-area')).not.toBeNull();
    expect(host.querySelector('.inspector')).not.toBeNull();
    const card = host.querySelector('.lesson-card')!;
    expect(card.compareDocumentPosition(host.querySelector('.inspector')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount(host);
  });
});

describe('BB-LCOL-13: Exit hands focus to the Learn button', () => {
  it('focuses the Learn trigger when the card took focus with it', async () => {
    const learn = document.createElement('button');
    learn.className = 'learn-trigger';
    document.body.appendChild(learn);
    startLesson('transforms-exercise-1');
    const host = mount(h(EditorColumn, {}));
    await settle();
    const exit = buttonNamed(host, 'Exit')!;
    exit.focus();
    exit.click();
    await settle();
    expect(useVamsStore.getState().appMode).toBe('Author');
    expect(document.activeElement).toBe(learn);
    unmount(host);
    learn.remove();
  });

  it('leaves focus alone when it is elsewhere', async () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    startLesson('transforms-exercise-1');
    const host = mount(h(EditorColumn, {}));
    await settle();
    outside.focus();
    useVamsStore.getState().clearLessonState();
    useVamsStore.getState().setAppMode('Author');
    await settle();
    expect(document.activeElement).toBe(outside);
    unmount(host);
    outside.remove();
  });
});
```

BB-LCOL-07 and BB-LCOL-08 are rewritten in Task 4. Until then, mark both `describe.skip` so this task's suite runs green. Task 4 removes the `.skip`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/editor-shell.test.ts tests/black-box/lesson-column.test.ts`
Expected: FAIL. `@/widgets/layout/editor-column` does not exist.

- [ ] **Step 3: Group definitions**

`src/widgets/layout/editor-column/inspector-groups.tsx`:

```tsx
import type { ComponentChildren } from 'preact';
import type { SceneNode } from '@/core/types/scene';
import type { InspectorGroupId } from '@/core/inspector';
import VerticesPanel from '@/features/vertex-editor/ui/VerticesPanel';
import BuffersPanel from '@/features/buffers/ui/BuffersPanel';
import ObjectTransformPanel from '@/features/object-transform/ui/ObjectTransformPanel';
import ObjectAppearancePanel from '@/features/object-appearance/ui/ObjectAppearancePanel';
import LineStylePanel, { LINE_TYPES } from '@/features/line-style/ui/LineStylePanel';
import TextureAttachmentPanel, { TEXTUREABLE_TYPES } from '@/features/textures/ui/TextureAttachmentPanel';
import UVEditorPanel from '@/features/textures/ui/UVEditorPanel';
import AnimationPreviewPanel from '@/features/animation-preview/ui/AnimationPreviewPanel';
import OrthoEditorPanel from '@/features/ortho-editor/ui/OrthoEditorPanel';
import TextureLibraryPanel from '@/features/textures/ui/TextureLibraryPanel';
import CallbacksPanel from '@/features/callbacks/ui/CallbacksPanel';

export interface GroupDef {
  id: InspectorGroupId;
  title: string;
  /** The OpenGL call shown in the header; may depend on the selected object. */
  hint: (object: SceneNode | null) => string;
  applies?: (object: SceneNode) => boolean;
  render: (object: SceneNode | null) => ComponentChildren;
}

const BUFFER_HINT: Record<string, string> = { IMMEDIATE: 'glBegin', VERTEX_ARRAY: 'glDrawArrays', VBO: 'glBufferData' };

/** Pipeline order. */
export const OBJECT_GROUP_DEFS: GroupDef[] = [
  { id: 'vertices', title: 'Vertices', hint: () => 'glVertex2f', applies: (o) => o.type !== 'TEXT', render: () => <VerticesPanel /> },
  {
    id: 'buffers',
    title: 'Buffers',
    hint: (o) => BUFFER_HINT[o?.renderingMode ?? 'IMMEDIATE'] ?? 'glBegin',
    applies: (o) => o.type !== 'TEXT',
    render: () => <BuffersPanel />,
  },
  { id: 'transform', title: 'Transform', hint: () => 'glTranslatef · glRotatef · glScalef', render: () => <ObjectTransformPanel /> },
  {
    id: 'appearance',
    title: 'Appearance',
    hint: () => 'glColor3f',
    render: (o) => (
      <>
        <ObjectAppearancePanel />
        {o && LINE_TYPES.has(o.type) && <LineStylePanel />}
      </>
    ),
  },
  {
    id: 'texture',
    title: 'Texture',
    hint: (o) => (o?.texture ? 'glBindTexture' : 'none'),
    applies: (o) => TEXTUREABLE_TYPES.has(o.type),
    render: () => (
      <>
        <TextureAttachmentPanel />
        <UVEditorPanel />
      </>
    ),
  },
  { id: 'animation', title: 'Animation', hint: () => 'glutIdleFunc', render: () => <AnimationPreviewPanel /> },
];

export const SETTINGS_GROUP_DEFS: GroupDef[] = [
  { id: 'background', title: 'Background', hint: () => 'glClearColor', render: () => <ObjectAppearancePanel /> },
  { id: 'viewing-volume', title: 'Viewing volume', hint: () => 'glOrtho', render: () => <OrthoEditorPanel /> },
  { id: 'texture-library', title: 'Texture library', hint: () => 'glGenTextures', render: () => <TextureLibraryPanel /> },
  { id: 'callbacks', title: 'Callbacks', hint: () => 'glutKeyboardFunc …', render: () => <CallbacksPanel /> },
];
```

Check that `SceneNode` has `renderingMode` and `texture` fields (`grep -n "renderingMode\|texture?" src/core/types/scene.ts`). If `renderingMode` is optional, the `?? 'IMMEDIATE'` covers it.

- [ ] **Step 4: The group and the inspector**

`src/widgets/layout/editor-column/InspectorGroup.tsx`:

```tsx
import { useEffect, useId, useRef } from 'react';
import type { ComponentChildren } from 'preact';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { InspectorGroupId } from '@/core/inspector';

interface InspectorGroupProps {
  id: InspectorGroupId;
  title: string;
  hint: string;
  open: boolean;
  onToggle: () => void;
  /** The lesson step's group: outlined and scrolled into view under the card. */
  focused?: boolean;
  /** Demo steps dim the other groups; they stay operable. */
  dimmed?: boolean;
  children: ComponentChildren;
}

export default function InspectorGroup({ id, title, hint, open, onToggle, focused = false, dimmed = false, children }: InspectorGroupProps) {
  const bodyId = useId();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!focused) return;
    const el = ref.current;
    const root = el?.closest<HTMLElement>('[data-scroll-root]');
    if (!el || !root) return;
    // Scroll the group to just under the sticky lesson card.
    const head = root.querySelector<HTMLElement>('.editor-column__head');
    root.scrollTop = Math.max(0, el.offsetTop - (head?.offsetHeight ?? 0) - 8);
  }, [focused]);

  const classes = ['inspector-group', open ? 'is-open' : '', focused ? 'is-focus' : '', dimmed ? 'is-dimmed' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <section ref={ref} className={classes} data-group={id}>
      <h3 className="inspector-group__heading">
        <button type="button" className="inspector-group__header" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
          {open ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
          <span className="inspector-group__title">{title}</span>
          <code className="inspector-group__hint" aria-hidden="true">{hint}</code>
        </button>
      </h3>
      <div id={bodyId} className="inspector-group__body" hidden={!open}>
        {open && children}
      </div>
    </section>
  );
}
```

`src/widgets/layout/editor-column/Inspector.tsx`. Task 4 adds the lesson focus. For now, open state comes from the store:

```tsx
import { useVamsStore } from '@/core/store';
import { Button, PanelLayoutContext } from '@/shared/ui/controls';
import InspectorGroup from './InspectorGroup';
import { OBJECT_GROUP_DEFS, SETTINGS_GROUP_DEFS } from './inspector-groups';

export default function Inspector() {
  const selected = useVamsStore((s) => s.objects.find((o) => o.id === s.selectedObjectId) ?? null);
  const openGroups = useVamsStore((s) => s.openGroups);
  const toggleGroup = useVamsStore((s) => s.toggleGroup);
  const selectObject = useVamsStore((s) => s.selectObject);
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');

  const showSettings = !selected;
  const defs = showSettings ? SETTINGS_GROUP_DEFS : OBJECT_GROUP_DEFS.filter((def) => !def.applies || def.applies(selected));

  return (
    <PanelLayoutContext.Provider value={{ mode: inLesson ? 'lesson' : 'author', focusPanelId: null, embedded: true }}>
      <div className="inspector">
        <div className="inspector__head">
          {showSettings ? (
            <h2 className="inspector__name">Scene settings</h2>
          ) : (
            <>
              <div className="inspector__id">
                <h2 className="inspector__name">{selected.name}</h2>
                <span className="inspector__meta">
                  {selected.type === 'TEXT' ? 'Bitmap text' : `GL_${selected.type} · ${selected.vertices.length} vertices`}
                </span>
              </div>
              <Button variant="quiet" onClick={() => selectObject(null)}>Scene settings</Button>
            </>
          )}
        </div>
        {defs.map((def) => (
          <InspectorGroup
            key={def.id}
            id={def.id}
            title={def.title}
            hint={def.hint(selected)}
            open={openGroups.includes(def.id)}
            onToggle={() => toggleGroup(def.id)}
          >
            {def.render(selected)}
          </InspectorGroup>
        ))}
      </div>
    </PanelLayoutContext.Provider>
  );
}
```

- [ ] **Step 5: The scene area and the column**

`src/widgets/layout/editor-column/SceneArea.tsx`:

```tsx
import { useVamsStore } from '@/core/store';
import { PanelLayoutContext } from '@/shared/ui/controls';
import SceneHierarchyPanel from '@/features/scene-hierarchy/ui/SceneHierarchyPanel';
import CustomShapeBuilderPanel from '@/features/custom-shapes/ui/CustomShapeBuilderPanel';
import TextNodePanel from '@/features/text-nodes/ui/TextNodePanel';

/** The scene: its objects, the Add row, and Create Text. Always visible, in both modes. */
export default function SceneArea({ focusPanelId = null }: { focusPanelId?: string | null }) {
  const count = useVamsStore((s) => s.objects.length);
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');
  return (
    <PanelLayoutContext.Provider value={{ mode: inLesson ? 'lesson' : 'author', focusPanelId, embedded: true }}>
      <section className="scene-area" aria-labelledby="scene-area-title">
        <h2 id="scene-area-title" className="scene-area__title">
          Scene <span className="scene-area__count">{count === 1 ? '1 object' : `${count} objects`}</span>
        </h2>
        <SceneHierarchyPanel />
        <CustomShapeBuilderPanel />
        <TextNodePanel />
      </section>
    </PanelLayoutContext.Provider>
  );
}
```

`src/widgets/layout/editor-column/EditorColumn.tsx`:

```tsx
import { useLayoutEffect, useRef } from 'react';
import type { ComponentChildren } from 'preact';
import { useVamsStore } from '@/core/store';
import LessonCard from '@/features/lesson-engine/ui/LessonCard';
import SceneArea from './SceneArea';
import Inspector from './Inspector';
import './editor-column.scss';

/** The left column: the lesson card in Lesson mode, then the scene area and the inspector, the same in every section. */
export default function EditorColumn({ cardExtra }: { cardExtra?: ComponentChildren }) {
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');

  // Leaving a lesson removes the card and its focused Exit button. When that drops focus to the
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

  return (
    <div className="editor-column" data-scroll-root>
      {inLesson && (
        <div className="editor-column__head">
          <LessonCard>{cardExtra}</LessonCard>
        </div>
      )}
      <SceneArea />
      <Inspector />
    </div>
  );
}
```

`LessonCard` accepts `children` from Task 4 on. Until then, `<LessonCard>{cardExtra}</LessonCard>` type-checks once you add `{ children }: { children?: ComponentChildren }` to `LessonCard`'s signature and render `{children}` directly after the narration paragraph. Do that in this step. The card is otherwise unchanged.

`src/widgets/layout/editor-column/index.ts`:

```ts
export { default as EditorColumn } from './EditorColumn';
export { default as Inspector } from './Inspector';
export { default as SceneArea } from './SceneArea';
export { OBJECT_GROUP_DEFS, SETTINGS_GROUP_DEFS, type GroupDef } from './inspector-groups';
```

`src/widgets/layout/editor-column/editor-column.scss`:

```scss
@use '../../../shared/styles/tokens' as *;

.editor-column {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  background: var(--paper);
  @include scrollbar;

  &__head {
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--paper-raised);
    border-bottom: 1px solid var(--rule);
  }
  // On short screens a tall lesson card (a quiz) would hide its own buttons if pinned.
  @media (max-height: 640px) {
    &__head { position: static; }
  }
}

.scene-area {
  padding: 8px 0 10px;
  border-bottom: 1px solid var(--rule);

  &__title {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 0;
    padding: 0 12px 4px;
    font-size: var(--text-base);
    font-weight: 600;
  }
  &__count { font-size: var(--text-xs); font-weight: 400; color: var(--ink-faint); }
}

.inspector {
  padding-bottom: 2rem;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--rule);
    background: var(--paper-raised);
  }
  &__name { margin: 0; font-size: var(--text-base); font-weight: 600; }
  &__meta { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--ink-faint); }
}

.inspector-group {
  border-bottom: 1px solid var(--rule);
  transition: opacity 120ms ease;

  &__heading { margin: 0; font: inherit; }
  &__header {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    min-height: 32px;
    padding: 0 12px;
    border: 0;
    background: transparent;
    color: var(--ink-muted);
    font-size: var(--text-base);
    font-weight: 600;
    text-align: left;
    cursor: pointer;
    &:hover { background: var(--paper-sunken); color: var(--ink); }
    &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -2px; }
    svg { flex: none; color: var(--ink-faint); }
  }
  &.is-open &__header { color: var(--ink); }
  &__title { flex: 1 1 auto; min-width: 0; }
  &__hint {
    flex: none;
    max-width: 55%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 400;
    color: var(--gl-hint);
  }
  &__body { padding-bottom: 8px; }

  &.is-focus { box-shadow: inset 2px 0 0 var(--accent); }
  &.is-focus &__header { color: var(--accent-text); }
  &.is-dimmed { opacity: 0.45; }
  &.is-dimmed:hover,
  &.is-dimmed:focus-within { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .inspector-group { transition: none; }
}
```

- [ ] **Step 6: Mount it and remove the section column**

**`src/pages/editor/ui/EditorApp.tsx`:**
- replace `import { SectionColumn } from '@/widgets/layout/section-column';` with `import { EditorColumn } from '@/widgets/layout/editor-column';`;
- replace `column={<SectionColumn />}` with `column={<EditorColumn />}`.

**`src/pages/editor/ui/EditorShell.tsx`:** change the aside's `aria-label="Section panels"` to `aria-label="Scene and inspector"`, and its `id="editor-section-column"` (with the `aria-controls` that names it) to `editor-column`.

**`src/features/lesson-engine/ui/LessonLauncher.tsx`:** add `triggerClassName="learn-trigger"` to its `MenuButton`. The launcher lives until Task 5. The class is the stable hand-off target for focus.

```bash
git rm -r src/widgets/layout/section-column
grep -rn "section-column\|SectionColumn\|SECTION_PANELS\|SectionMenu" src tests
```

Expected: no matches, apart from tests already rewritten in Step 1. Fix any other leftover reference.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/editor-shell.test.ts tests/black-box/lesson-column.test.ts tests/black-box/editor-panels.test.ts`
Expected: PASS. BB-LCOL-07 and BB-LCOL-08 are skipped.

- [ ] **Step 8: Look at it**

Start `npx vite --port 5173 --strictPort` and open `/app?scene=triangle`. Check:
- the Scene list, the Add row and Create Text sit above the inspector;
- selecting the triangle shows its groups in pipeline order with Transform open;
- "Scene settings" (or clicking empty canvas) shows Background, Viewing volume, Texture library and Callbacks;
- below 1100px, the Panels drawer still opens this column.

Stop the server by its PID.

- [ ] **Step 9: Full checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/widgets/layout/editor-column src/pages/editor/ui/EditorApp.tsx src/pages/editor/ui/EditorShell.tsx src/features/lesson-engine/ui/LessonLauncher.tsx src/features/lesson-engine/ui/LessonCard.tsx tests/black-box/editor-shell.test.ts tests/black-box/lesson-column.test.ts
git add -u src/widgets/layout/section-column
git diff --staged --stat
git commit -m "feat(editor): one editor column with a scene area and a pipeline-ordered inspector"
```

---

### Task 4: Lessons guide the real editor, with fading focus

**Files:**
- Create: `src/features/lesson-engine/model/guidance.ts`
- Modify:
  - `src/features/lesson-engine/model/useLessonRunner.ts` (focus and auto-select);
  - `src/features/lesson-engine/ui/LessonCard.tsx` (focus hand-off);
  - `src/widgets/layout/editor-column/EditorColumn.tsx`, `Inspector.tsx`;
  - `src/widgets/canvas/ViewportRouter.tsx`.
- Test: `tests/black-box/lesson-column.test.ts` (BB-LCOL-07, BB-LCOL-08 rewritten and un-skipped; BB-LCOL-18…21 new)

**Interfaces:**
- Produces: `type FocusStyle = 'tight' | 'outline' | 'none'` and `focusStyleFor(lesson: Pick<Lesson, 'id' | 'type' | 'section'>, registry?: Record<string, Lesson>): FocusStyle`, from `@/features/lesson-engine/model/guidance`.
- Behaviour:
  - `lessonFocusPanel` is `null` for a section's last exercise.
  - The runner selects the newest object when a step's focus is a per-object group and nothing is selected.

- [ ] **Step 1: Write the failing tests**

In `tests/black-box/lesson-column.test.ts`, add these imports:

```ts
import { focusStyleFor } from '@/features/lesson-engine/model/guidance';
import { FOCUS_PANEL_IDS } from '@/core/inspector';
import ViewportRouter from '@/widgets/canvas/ViewportRouter';
```

Replace BB-LCOL-07 and BB-LCOL-08, removing `.skip`, with:

```ts
describe('BB-LCOL-07: A demo opens and outlines the step’s group and dims the rest', () => {
  it('focuses Transform in a Transforms demo step', async () => {
    startLesson('transforms-demo-1');
    const host = mount(h(EditorColumn, {}));
    await settle();
    // Step 2 targets object-transform; the demo created and selected its object.
    buttonNamed(host, 'Next')!.click();
    await settle();
    const transform = host.querySelector('[data-group="transform"]')!;
    expect(transform.classList.contains('is-focus')).toBe(true);
    expect(transform.querySelector('.inspector-group__header')!.getAttribute('aria-expanded')).toBe('true');
    expect(transform.querySelector('[data-panel-id="object-transform"]')!.classList.contains('is-lesson-focus')).toBe(true);
    const others = [...host.querySelectorAll('.inspector-group:not([data-group="transform"])')];
    expect(others.length).toBeGreaterThan(0);
    for (const group of others) {
      expect(group.classList.contains('is-dimmed')).toBe(true);
      expect(group.querySelector('.inspector-group__header')!.getAttribute('aria-expanded')).toBe('false');
    }
    unmount(host);
  });
});

describe('BB-LCOL-08: Every lesson focusPanel has a place in the editor', () => {
  it('resolves all ids against the focus map', () => {
    const missing: string[] = [];
    for (const lesson of Object.values(LESSON_REGISTRY)) {
      for (const step of lesson.steps) {
        if (step.focusPanel && !FOCUS_PANEL_IDS.includes(step.focusPanel)) missing.push(`${lesson.id}:${step.focusPanel}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
```

Append:

```ts
describe('BB-LCOL-18: Guidance fades through a section', () => {
  it('is tight for demos, an outline for exercises, and none for each section’s last exercise', () => {
    const lastExercise = new Map<string, string>();
    for (const lesson of Object.values(LESSON_REGISTRY)) if (lesson.type === 'exercise') lastExercise.set(lesson.section, lesson.id);
    for (const lesson of Object.values(LESSON_REGISTRY)) {
      const expected = lesson.type === 'demo' ? 'tight' : lastExercise.get(lesson.section) === lesson.id ? 'none' : 'outline';
      expect(focusStyleFor(lesson), lesson.id).toBe(expected);
    }
    expect(focusStyleFor(LESSON_REGISTRY['transforms-exercise-4'])).toBe('none');
    expect(focusStyleFor(LESSON_REGISTRY['transforms-exercise-1'])).toBe('outline');
  });
});

describe('BB-LCOL-19: An exercise outlines its group and dims nothing; the last exercise focuses nothing', () => {
  it('outlines Transform in transforms-exercise-1 and sets no focus in transforms-exercise-4', async () => {
    startLesson('transforms-exercise-1');
    let host = mount(h(EditorColumn, {}));
    await settle();
    expect(host.querySelector('[data-group="transform"]')!.classList.contains('is-focus')).toBe(true);
    expect(host.querySelectorAll('.inspector-group.is-dimmed')).toHaveLength(0);
    unmount(host);
    useVamsStore.getState().clearLessonState();
    useVamsStore.setState({ appMode: 'Author' });

    startLesson('transforms-exercise-4');
    host = mount(h(EditorColumn, {}));
    await settle();
    expect(useVamsStore.getState().lessonFocusPanel).toBeNull();
    expect(host.querySelectorAll('.is-focus, .is-lesson-focus')).toHaveLength(0);
    unmount(host);
  });
});

describe('BB-LCOL-20: A per-object focus selects the newest object, and never crashes on an empty scene', () => {
  it('selects the lesson’s object when nothing is selected', async () => {
    startLesson('transforms-exercise-1');
    const host = mount(h(EditorColumn, {}));
    await settle();
    const s = useVamsStore.getState();
    expect(s.objects.length).toBeGreaterThan(0);
    expect(s.selectedObjectId).toBe(s.objects[0].id);
    unmount(host);
  });

  it('shows scene settings when there is nothing to select', async () => {
    startLesson('transforms-exercise-1');
    const host = mount(h(EditorColumn, {}));
    await settle();
    useVamsStore.setState({ objects: [], selectedObjectId: null, lessonFocusPanel: 'object-transform' });
    await settle();
    expect(host.querySelector('.inspector__name')!.textContent).toBe('Scene settings');
    unmount(host);
  });
});

describe('BB-LCOL-21: The Pipeline illustrations appear only during Pipeline lessons', () => {
  it('shows the diagram in a Pipeline lesson and the scene canvas otherwise', async () => {
    useVamsStore.setState({ appMode: 'Author', activeSection: 'Pipeline', pipelineMode: 'Diagram' });
    let host = mount(h(ViewportRouter, {}));
    await settle();
    expect(host.querySelector('.canvas-wrapper.hidden')).toBeNull();
    unmount(host);
    startLesson('pipeline-demo-1', 'Pipeline');
    host = mount(h(ViewportRouter, {}));
    await settle();
    useVamsStore.setState({ pipelineMode: 'Diagram' });
    await settle();
    expect(host.querySelector('.canvas-wrapper.hidden')).not.toBeNull();
    unmount(host);
  });
});
```

If mounting `ViewportRouter` in happy-dom fails because PixiJS needs WebGL, replace BB-LCOL-21's body with a unit check of an exported pure function. Extract `export function showsIllustration(s: Pick<VamsState, 'appMode' | 'activeSection' | 'pipelineMode'>): boolean` into `src/widgets/canvas/illustration.ts` and assert:
- `false` for Author mode with `Diagram`;
- `true` for a Lesson in Pipeline with `Diagram`;
- `false` for a Lesson in Pipeline with `Playground`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/lesson-column.test.ts`
Expected: FAIL. `guidance.ts` is missing, and the inspector has no focus.

- [ ] **Step 3: Guidance**

`src/features/lesson-engine/model/guidance.ts`:

```ts
import type { Lesson } from '@/core/types/lesson';
import { LESSON_REGISTRY } from './lesson-registry';

/**
 * Guidance fading through a section: demos focus tightly, exercises only outline the step's
 * control, and the section's last exercise gives no focus at all.
 */
export type FocusStyle = 'tight' | 'outline' | 'none';

export function focusStyleFor(
  lesson: Pick<Lesson, 'id' | 'type' | 'section'>,
  registry: Record<string, Lesson> = LESSON_REGISTRY,
): FocusStyle {
  if (lesson.type === 'demo') return 'tight';
  const exercises = Object.values(registry).filter((l) => l.section === lesson.section && l.type === 'exercise');
  return exercises[exercises.length - 1]?.id === lesson.id ? 'none' : 'outline';
}
```

- [ ] **Step 4: The runner applies focus and selects**

In `src/features/lesson-engine/model/useLessonRunner.ts`:
- add imports `import { resolveFocus } from '@/core/inspector';` and `import { focusStyleFor } from './guidance';`;
- above `useLessonRunner`, add:

```ts
/** The step's focus target, or none for a section's last exercise. */
function effectiveFocus(lesson: Lesson, step: LessonStep): string | null {
  return focusStyleFor(lesson) === 'none' ? null : step.focusPanel ?? null;
}

/** A per-object focus needs an object: pick the newest when nothing is selected. */
function selectForFocus(panelId: string | null) {
  const s = useVamsStore.getState();
  if (!panelId || s.selectedObjectId || s.objects.length === 0) return;
  if (resolveFocus(panelId, false)?.area !== 'object') return;
  s.selectObject(s.objects[0].id);
}
```

In the step-execution effect, both branches contain `store.setLessonFocusPanel(currentStep.focusPanel || null);`. Replace each with:

```ts
      const focus = effectiveFocus(lesson, currentStep);
      store.setLessonFocusPanel(focus);
      selectForFocus(focus);
```

- [ ] **Step 5: The inspector shows the focus**

In `src/widgets/layout/editor-column/Inspector.tsx`:
- add imports `import { useEffect } from 'react';`, `import { resolveFocus } from '@/core/inspector';`, `import { getLessonById } from '@/features/lesson-engine/model/lesson-registry';` and `import { focusStyleFor } from '@/features/lesson-engine/model/guidance';`;
- replace the body up to `return (` with:

```tsx
  const selected = useVamsStore((s) => s.objects.find((o) => o.id === s.selectedObjectId) ?? null);
  const openGroups = useVamsStore((s) => s.openGroups);
  const toggleGroup = useVamsStore((s) => s.toggleGroup);
  const openGroup = useVamsStore((s) => s.openGroup);
  const setOpenGroups = useVamsStore((s) => s.setOpenGroups);
  const selectObject = useVamsStore((s) => s.selectObject);
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');
  const lessonId = useVamsStore((s) => s.activeLessonId);
  const focusPanelId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.lessonFocusPanel : null));
  const stepIndex = useVamsStore((s) => s.currentStepIndex);

  const lesson = inLesson && lessonId ? getLessonById(lessonId) : undefined;
  const style = lesson ? focusStyleFor(lesson) : 'none';
  const place = resolveFocus(focusPanelId, selected !== null);
  const target = place && (place.area === 'object' || place.area === 'settings') ? place.group : null;

  // A settings focus shows the settings even with an object selected.
  const showSettings = !selected || place?.area === 'settings';
  const defs = showSettings ? SETTINGS_GROUP_DEFS : OBJECT_GROUP_DEFS.filter((def) => !def.applies || def.applies(selected!));

  // Each step opens its group. A demo also collapses the others; the student can reopen them.
  useEffect(() => {
    if (!target) return;
    if (style === 'tight') setOpenGroups([target]);
    else openGroup(target);
  }, [target, style, stepIndex, lessonId, setOpenGroups, openGroup]);
```

Then:
- change the Provider's value to `{ mode: inLesson ? 'lesson' : 'author', focusPanelId, embedded: true }`;
- in the `defs.map`, pass `focused={def.id === target}` and `dimmed={style === 'tight' && target !== null && def.id !== target}`;
- change the `showSettings` header branch's `selected.` references to `selected!.` where TypeScript needs them.

In `src/widgets/layout/editor-column/EditorColumn.tsx`, pass the focus to the scene area: `<SceneArea focusPanelId={focusPanelId} />`, where:

```tsx
  const focusPanelId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.lessonFocusPanel : null));
```

Show the Pipeline view toggle in the card during Pipeline lessons. Import `PipelineModeControls` from `@/features/pipeline-controls/ui/PipelineModeControls` and `PanelLayoutContext` from `@/shared/ui/controls`, and compute:

```tsx
  const pipelineLesson = useVamsStore((s) => s.appMode === 'Lesson' && s.activeSection === 'Pipeline');
  const extra = pipelineLesson ? (
    <PanelLayoutContext.Provider value={{ mode: 'lesson', focusPanelId, embedded: true }}>
      <PipelineModeControls />
    </PanelLayoutContext.Provider>
  ) : null;
```

and render `<LessonCard>{cardExtra ?? extra}</LessonCard>`.

- [ ] **Step 6: Card focus hand-off and illustrations**

`src/features/lesson-engine/ui/LessonCard.tsx`: in the focus effect, change the condition so that starting from the Learn drawer, whose button keeps focus, also moves focus to the title:

```tsx
    if (!active || active === document.body || !active.isConnected || active.closest('.learn-trigger')) titleRef.current?.focus();
```

`src/widgets/canvas/ViewportRouter.tsx`:

```tsx
import { useVamsStore } from '@/core/store';
import VamsCanvas from './VamsCanvas';
import PipelineDiagram from './views/PipelineDiagram';
import RasterVectorView from './views/RasterVectorView';

/** The editor always shows the scene; the Pipeline illustrations belong to Pipeline lessons. */
export default function ViewportRouter() {
  const inPipelineLesson = useVamsStore((s) => s.appMode === 'Lesson' && s.activeSection === 'Pipeline');
  const pipelineMode = useVamsStore((s) => s.pipelineMode);
  const illustration = inPipelineLesson ? pipelineMode : 'Playground';
  return (
    <>
      <VamsCanvas isHidden={illustration !== 'Playground'} />
      {illustration === 'Diagram' && <PipelineDiagram />}
      {illustration === 'RasterVector' && <RasterVectorView />}
    </>
  );
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/lesson-column.test.ts tests/black-box/lesson-engine.test.ts tests/black-box/editor-inspector.test.ts`
Expected: PASS.

- [ ] **Step 8: Look at it**

Start the dev server. Run `/app?lesson=transforms-demo-1` and `/app?lesson=transforms-exercise-1` to the end, then `/app?lesson=pipeline-demo-1`, and check:
- a demo step dims and collapses the other groups, and a dimmed group still opens when clicked;
- an exercise outlines its group without dimming anything;
- the Pipeline lesson shows the view toggle in the card and switches the canvas illustration;
- Exit returns your own scene.

Stop the server by its PID.

- [ ] **Step 9: Full checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/features/lesson-engine/model/guidance.ts src/features/lesson-engine/model/useLessonRunner.ts src/features/lesson-engine/ui/LessonCard.tsx src/widgets/layout/editor-column/EditorColumn.tsx src/widgets/layout/editor-column/Inspector.tsx src/widgets/canvas/ViewportRouter.tsx tests/black-box/lesson-column.test.ts
git diff --staged
git commit -m "feat(lessons): guide the real editor with focus that fades through each section"
```

---

### Task 5: The Learn drawer and lesson progress

**Files:**
- Create: `src/features/lesson-engine/model/progress.ts`, `course.ts`, `start-lesson.ts`, `src/features/lesson-engine/ui/LearnButton.tsx`, `LearnDrawer.tsx`, `learn-drawer.scss`
- Modify: `src/features/lesson-engine/model/useLessonRunner.ts` (`finish`, exit records), `src/features/lesson-engine/ui/LessonCard.tsx` (Finish), `src/widgets/layout/top-bar/TopBar.tsx`, `src/pages/editor/ui/EditorApp.tsx`
- Delete: `src/features/lesson-engine/ui/LessonLauncher.tsx`
- Test: `tests/black-box/learn-drawer.test.ts` (new: BB-LEARN-01…08), `tests/black-box/editor-shell.test.ts` (BB-SHELL-13 rewritten)

**Interfaces:**
- Produces:
  - `PROGRESS_KEY = 'vams-lesson-progress'`;
  - `interface LessonProgress { version: 1; completed: string[]; current: { lessonId: string; step: number } | null }`;
  - `readProgress(): LessonProgress`;
  - `markLessonComplete(id: string): void`;
  - `recordLessonLeft(id: string, step: number): void`;
  - `subscribeProgress(l): () => void`;
  - `useLessonProgress(): LessonProgress`;
  - `COURSE: readonly { section: CurriculumSection; description: string }[]`;
  - `lessonsFor(section): { demos: Lesson[]; exercises: Lesson[] }`;
  - `startLesson(id: string): Promise<boolean>`;
  - `LessonRunner.finish: () => void`.

- [ ] **Step 1: Write the failing tests**

Create `tests/black-box/learn-drawer.test.ts`:

```ts
/**
 * BLACK-BOX TEST SUITE — BB-LEARN
 * The course map in the editor: progress, course data, the Learn drawer and starting lessons.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useVamsStore } from '@/core/store';
import { useConfirmStore } from '@/shared/ui/confirm-dialog/confirm-store';
import { LESSON_REGISTRY } from '@/features/lesson-engine/model/lesson-registry';
import {
  PROGRESS_KEY,
  markLessonComplete,
  readProgress,
  recordLessonLeft,
} from '@/features/lesson-engine/model/progress';
import { COURSE, lessonsFor } from '@/features/lesson-engine/model/course';
import { startLesson } from '@/features/lesson-engine/model/start-lesson';
import LearnDrawer from '@/features/lesson-engine/ui/LearnDrawer';
import LessonCard from '@/features/lesson-engine/ui/LessonCard';

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

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.removeItem(PROGRESS_KEY);
  useVamsStore.getState().clearLessonState();
  useVamsStore.setState({ appMode: 'Author', learnOpen: false, activeSection: 'Pipeline' });
});

describe('BB-LEARN-01: Progress records completion and the lesson left mid-way', () => {
  it('marks complete, records current, and clears current when that lesson completes', () => {
    recordLessonLeft('transforms-exercise-1', 1);
    expect(readProgress().current).toEqual({ lessonId: 'transforms-exercise-1', step: 1 });
    markLessonComplete('transforms-exercise-1');
    markLessonComplete('transforms-exercise-1');
    expect(readProgress()).toEqual({ version: 1, completed: ['transforms-exercise-1'], current: null });
  });
});

describe('BB-LEARN-02: Unreadable or foreign progress reads as clean progress', () => {
  it('ignores bad JSON, wrong versions, unknown ids and prototype keys', () => {
    for (const raw of ['{', '"x"', '{"version":2,"completed":[],"current":null}', '{"version":1}']) {
      localStorage.setItem(PROGRESS_KEY, raw);
      expect(readProgress()).toEqual({ version: 1, completed: [], current: null });
    }
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({
      version: 1,
      completed: ['toString', 'pipeline-demo-1', 42, 'pipeline-demo-1'],
      current: { lessonId: '__proto__', step: 1 },
    }));
    expect(readProgress()).toEqual({ version: 1, completed: ['pipeline-demo-1'], current: null });
  });
});

describe('BB-LEARN-03: A failed progress write never blocks finishing a lesson', () => {
  it('finishes and returns to Author mode when storage throws', async () => {
    useVamsStore.setState({ activeSection: 'Transforms' });
    useVamsStore.getState().setActiveLesson('transforms-exercise-4');
    useVamsStore.getState().setAppMode('Lesson');
    const host = mount(h(LessonCard, {}));
    await settle();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    useVamsStore.getState().setCurrentStep(LESSON_REGISTRY['transforms-exercise-4'].steps.length - 1);
    await settle();
    const finish = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Finish') as HTMLButtonElement;
    // Force the last step's check open: the test is about the write, not the exercise.
    finish.disabled = false;
    finish.click();
    await settle();
    expect(useVamsStore.getState().appMode).toBe('Author');
    unmount(host);
  });
});

describe('BB-LEARN-04: The course lists the five sections in pipeline order with their lessons', () => {
  it('uses the exact labels and splits demos from exercises in registry order', () => {
    expect(COURSE.map((c) => c.section)).toEqual(['Pipeline', 'Primitives', 'Buffers', 'Transforms', 'Textures']);
    const { demos, exercises } = lessonsFor('Transforms');
    expect(demos.every((l) => l.type === 'demo' && l.section === 'Transforms')).toBe(true);
    expect(exercises.map((l) => l.id)).toEqual(['transforms-exercise-1', 'transforms-exercise-2', 'transforms-exercise-3', 'transforms-exercise-4']);
  });
});

describe('BB-LEARN-05: The drawer opens on the current section and browsing does not change it', () => {
  it('checks the current stop, switches with arrows, and leaves activeSection alone', async () => {
    useVamsStore.setState({ activeSection: 'Transforms', learnOpen: true });
    const host = mount(h(LearnDrawer, {}));
    await settle();
    const checked = () => document.querySelector('[role="radio"][aria-checked="true"]')!.textContent;
    expect(checked()).toContain('Transforms');
    const radio = document.querySelector('[role="radio"][aria-checked="true"]') as HTMLElement;
    radio.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await settle();
    expect(checked()).toContain('Textures');
    expect(useVamsStore.getState().activeSection).toBe('Transforms');
    expect(document.querySelector('.learn-drawer')!.textContent).toContain('First Coat of Paint');
    unmount(host);
  });
});

describe('BB-LEARN-06: The drawer marks complete and in-progress lessons and starts one', () => {
  it('shows a tick, a step count, and starts the chosen lesson in its section', async () => {
    markLessonComplete('transforms-exercise-1');
    recordLessonLeft('transforms-exercise-2', 0);
    useVamsStore.setState({ activeSection: 'Transforms', learnOpen: true });
    const host = mount(h(LearnDrawer, {}));
    await settle();
    const row = (title: string) => [...document.querySelectorAll('.learn-lesson')].find((el) => el.textContent?.includes(title)) as HTMLButtonElement;
    expect(row('Translate to Position').classList.contains('is-complete')).toBe(true);
    expect(row('Rotate to Angle').textContent).toContain('Step 1 of 2');
    row('Build a Hierarchy').click();
    await settle();
    const s = useVamsStore.getState();
    expect(s.appMode).toBe('Lesson');
    expect(s.activeLessonId).toBe('transforms-exercise-3');
    expect(s.activeSection).toBe('Transforms');
    expect(s.learnOpen).toBe(false);
    unmount(host);
  });
});

describe('BB-LEARN-07: Starting another lesson mid-lesson asks first; cancelling keeps the lesson', () => {
  it('keeps the running lesson and step when the student cancels', async () => {
    await startLesson('transforms-exercise-1');
    useVamsStore.getState().setCurrentStep(1);
    const objectsBefore = useVamsStore.getState().objects;
    const pending = startLesson('textures-exercise-1');
    await settle();
    expect(useConfirmStore.getState().open).toBe(true);
    useConfirmStore.getState().handleCancel();
    expect(await pending).toBe(false);
    const s = useVamsStore.getState();
    expect(s.activeLessonId).toBe('transforms-exercise-1');
    expect(s.currentStepIndex).toBe(1);
    expect(s.objects).toBe(objectsBefore);
  });

  it('records the left lesson and starts the new one when confirmed', async () => {
    await startLesson('transforms-exercise-1');
    const pending = startLesson('textures-exercise-1');
    await settle();
    useConfirmStore.getState().handleConfirm();
    expect(await pending).toBe(true);
    expect(useVamsStore.getState().activeLessonId).toBe('textures-exercise-1');
    expect(useVamsStore.getState().activeSection).toBe('Textures');
    expect(readProgress().current?.lessonId).toBe('transforms-exercise-1');
  });
});

describe('BB-LEARN-08: Escape closes the drawer', () => {
  it('sets learnOpen to false', async () => {
    useVamsStore.setState({ learnOpen: true });
    const host = mount(h(LearnDrawer, {}));
    await settle();
    document.querySelector('.learn-drawer')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await settle();
    expect(useVamsStore.getState().learnOpen).toBe(false);
    unmount(host);
  });
});
```

In `tests/black-box/editor-shell.test.ts`:
- remove the `LessonLauncher` import;
- add `import LearnButton from '@/features/lesson-engine/ui/LearnButton';`;
- replace BB-SHELL-13 with:

```ts
describe('BB-SHELL-13: The Learn button opens the course drawer in both modes', () => {
  it('is a dialog trigger named Learn that sets learnOpen', async () => {
    for (const appMode of ['Author', 'Lesson'] as const) {
      useVamsStore.setState({ appMode, learnOpen: false });
      const host = mount(h(LearnButton, {}));
      const button = host.querySelector('button.learn-trigger') as HTMLButtonElement;
      expect(button.textContent).toContain('Learn');
      expect(button.getAttribute('aria-haspopup')).toBe('dialog');
      button.click();
      await settle();
      expect(useVamsStore.getState().learnOpen).toBe(true);
      unmount(host);
    }
    useVamsStore.setState({ appMode: 'Author', learnOpen: false });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/learn-drawer.test.ts tests/black-box/editor-shell.test.ts`
Expected: FAIL. The modules do not exist.

- [ ] **Step 3: Progress**

`src/features/lesson-engine/model/progress.ts`:

```ts
import { useEffect, useState } from 'react';
import { LESSON_REGISTRY } from './lesson-registry';

/** Lesson progress lives under its own key, so the editor's saved store keeps version 7. */
export const PROGRESS_KEY = 'vams-lesson-progress';

export interface LessonProgress {
  version: 1;
  completed: string[];
  /** The lesson the student left mid-way; shown as "in progress". Starting it again begins at step 1. */
  current: { lessonId: string; step: number } | null;
}

const empty = (): LessonProgress => ({ version: 1, completed: [], current: null });
const isLesson = (id: unknown): id is string =>
  typeof id === 'string' && Object.prototype.hasOwnProperty.call(LESSON_REGISTRY, id);

type Listener = (progress: LessonProgress) => void;
const listeners = new Set<Listener>();

export function readProgress(): LessonProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw) as Partial<LessonProgress> | null;
    if (!data || typeof data !== 'object' || data.version !== 1 || !Array.isArray(data.completed)) return empty();
    const completed = [...new Set(data.completed.filter(isLesson))];
    const c = data.current;
    const current =
      c && typeof c === 'object' && isLesson(c.lessonId) && Number.isInteger(c.step) && c.step >= 0
        ? { lessonId: c.lessonId, step: c.step }
        : null;
    return { version: 1, completed, current };
  } catch {
    return empty();
  }
}

function write(progress: LessonProgress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Storage is full or blocked: progress is lost for this visit, the lesson itself is not.
  }
  listeners.forEach((listener) => listener(progress));
}

export function markLessonComplete(id: string): void {
  const progress = readProgress();
  write({
    version: 1,
    completed: progress.completed.includes(id) ? progress.completed : [...progress.completed, id],
    current: progress.current?.lessonId === id ? null : progress.current,
  });
}

export function recordLessonLeft(id: string, step: number): void {
  write({ ...readProgress(), current: { lessonId: id, step } });
}

export function subscribeProgress(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLessonProgress(): LessonProgress {
  const [progress, setProgress] = useState(readProgress);
  useEffect(() => subscribeProgress(setProgress), []);
  return progress;
}
```

- [ ] **Step 4: Course data and starting a lesson**

`src/features/lesson-engine/model/course.ts`:

```ts
import type { Lesson } from '@/core/types/lesson';
import type { CurriculumSection } from '@/core/store/types';
import { LESSON_REGISTRY } from './lesson-registry';

/** The course map: the five sections in pipeline order. The /learn page reuses this. */
export const COURSE: readonly { section: CurriculumSection; description: string }[] = [
  { section: 'Pipeline', description: 'The rendering pipeline, NDC, and rasterization' },
  { section: 'Primitives', description: 'Points, lines, triangles, color, and line style' },
  { section: 'Buffers', description: 'Vertex arrays, VBOs, and memory layout' },
  { section: 'Transforms', description: 'Translate, rotate, scale, and the matrix stack' },
  { section: 'Textures', description: 'Images, UV mapping, filtering, and wrapping' },
];

export function lessonsFor(section: CurriculumSection): { demos: Lesson[]; exercises: Lesson[] } {
  const all = Object.values(LESSON_REGISTRY).filter((lesson) => lesson.section === section);
  return { demos: all.filter((l) => l.type === 'demo'), exercises: all.filter((l) => l.type === 'exercise') };
}
```

`src/features/lesson-engine/model/start-lesson.ts`:

```ts
import { useVamsStore } from '@/core/store';
import { confirm } from '@/shared/ui/confirm-dialog/confirm-store';
import { getLessonById } from './lesson-registry';
import { recordLessonLeft } from './progress';

/**
 * Start a lesson in its section. If another lesson is running, the student confirms leaving it
 * first; cancelling changes nothing. Resolves to whether the lesson started.
 */
export async function startLesson(id: string): Promise<boolean> {
  const lesson = getLessonById(id);
  if (!lesson) return false;
  const running = useVamsStore.getState();
  if (running.appMode === 'Lesson' && running.activeLessonId) {
    if (running.activeLessonId === id) return true;
    const leave = await confirm({
      title: 'Leave this lesson?',
      message: 'Your place in it is kept in Learn. Your own scene comes back when you finish the next one.',
      confirmLabel: 'Leave lesson',
    });
    if (!leave) return false;
    const now = useVamsStore.getState();
    if (now.activeLessonId) recordLessonLeft(now.activeLessonId, now.currentStepIndex);
    now.clearLessonState();
  }
  const s = useVamsStore.getState();
  s.setActiveSection(lesson.section);
  s.setActiveLesson(lesson.id);
  s.setAppMode('Lesson');
  return true;
}
```

- [ ] **Step 5: Finish and exit record progress**

In `src/features/lesson-engine/model/useLessonRunner.ts`:
- import `markLessonComplete` and `recordLessonLeft` from `./progress`;
- add `finish: () => void;` to the `LessonRunner` interface;
- replace `handleExit` with the two callbacks below;
- return `finish: handleFinish` alongside `exit: handleExit`.

```ts
  const leave = useCallback(() => {
    clearLessonState();
    setAppMode('Author');
    lastExecutedStepRef.current = null;
    lastStepIndexRef.current = -1;
  }, [clearLessonState, setAppMode]);

  /** Exit or Esc mid-lesson: remember the place, then return the student's scene. */
  const handleExit = useCallback(() => {
    if (activeLessonId) recordLessonLeft(activeLessonId, currentStepIndex);
    leave();
  }, [activeLessonId, currentStepIndex, leave]);

  /** The last step passed: the lesson is complete. */
  const handleFinish = useCallback(() => {
    if (activeLessonId) markLessonComplete(activeLessonId);
    leave();
  }, [activeLessonId, leave]);
```

In `src/features/lesson-engine/ui/LessonCard.tsx`, the primary button's `onClick` becomes `onClick={isLastStep ? runner.finish : runner.next}`.

- [ ] **Step 6: Button and drawer**

`src/features/lesson-engine/ui/LearnButton.tsx`:

```tsx
import { GraduationCap } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import { Button } from '@/shared/ui/controls';

export default function LearnButton() {
  const setLearnOpen = useVamsStore((s) => s.setLearnOpen);
  return (
    <Button className="learn-trigger" icon={<GraduationCap />} aria-haspopup="dialog" title="Sections and lessons" onClick={() => setLearnOpen(true)}>
      Learn
    </Button>
  );
}
```

`src/features/lesson-engine/ui/LearnDrawer.tsx`:

```tsx
import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import type { CurriculumSection } from '@/core/store/types';
import type { Lesson } from '@/core/types/lesson';
import { Button, Dialog } from '@/shared/ui/controls';
import { COURSE, lessonsFor } from '../model/course';
import { useLessonProgress, type LessonProgress } from '../model/progress';
import { startLesson } from '../model/start-lesson';
import './learn-drawer.scss';

function lessonState(lesson: Lesson, progress: LessonProgress) {
  if (progress.completed.includes(lesson.id)) return { kind: 'complete' as const, meta: 'Done' };
  if (progress.current?.lessonId === lesson.id) {
    return { kind: 'progress' as const, meta: `Step ${progress.current.step + 1} of ${lesson.steps.length}` };
  }
  return { kind: 'new' as const, meta: `${lesson.steps.length} steps` };
}

export default function LearnDrawer() {
  const open = useVamsStore((s) => s.learnOpen);
  const setLearnOpen = useVamsStore((s) => s.setLearnOpen);
  const activeSection = useVamsStore((s) => s.activeSection);
  const progress = useLessonProgress();
  const [shown, setShown] = useState<CurriculumSection>(activeSection);
  // Each opening starts on the student's current section.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setShown(activeSection);
  }

  const close = () => setLearnOpen(false);
  const choose = (id: string) => {
    close();
    void startLesson(id);
  };

  const index = COURSE.findIndex((c) => c.section === shown);
  const onRailKey = (event: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    let next = step === undefined ? -1 : (index + step + COURSE.length) % COURSE.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = COURSE.length - 1;
    if (next < 0) return;
    event.preventDefault();
    setShown(COURSE[next].section);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`.learn-rail [data-section="${COURSE[next].section}"]`)?.focus());
  };

  const { demos, exercises } = lessonsFor(shown);
  const sectionDone = (section: CurriculumSection) => {
    const { demos: d, exercises: e } = lessonsFor(section);
    return [...d, ...e].every((l) => progress.completed.includes(l.id));
  };

  const list = (title: string, lessons: Lesson[]) => (
    <section className="learn-drawer__group" aria-label={title}>
      <h3 className="learn-drawer__group-title">{title}</h3>
      <ul className="learn-drawer__list">
        {lessons.map((lesson) => {
          const state = lessonState(lesson, progress);
          return (
            <li key={lesson.id}>
              <button type="button" className={`learn-lesson is-${state.kind}`} onClick={() => choose(lesson.id)}>
                <span className="learn-lesson__mark" aria-hidden="true">
                  {state.kind === 'complete' ? <Check size={13} /> : state.kind === 'progress' ? '●' : '○'}
                </span>
                <span className="learn-lesson__title">{lesson.title}</span>
                <span className="learn-lesson__meta">{state.meta}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );

  return (
    <Dialog open={open} onClose={close} labelledBy="learn-title" className="learn-drawer">
      <div className="learn-drawer__head">
        <h2 id="learn-title" className="learn-drawer__title">Learn</h2>
        <Button variant="quiet" iconOnly label="Close" icon={<X />} onClick={close} />
      </div>
      <div className="learn-rail" role="radiogroup" aria-label="Sections" onKeyDown={onRailKey}>
        {COURSE.map(({ section }) => {
          const checked = section === shown;
          const done = sectionDone(section);
          return (
            <button
              key={section}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              data-section={section}
              className={['learn-rail__stop', checked ? 'is-current' : '', done ? 'is-done' : ''].filter(Boolean).join(' ')}
              onClick={() => setShown(section)}
            >
              <span className="learn-rail__dot" aria-hidden="true">{done && <Check size={9} />}</span>
              {section}
              {done && <span className="sr-only"> (complete)</span>}
            </button>
          );
        })}
      </div>
      <p className="learn-drawer__desc">{COURSE[index].description}</p>
      {list('Demos', demos)}
      {list('Exercises', exercises)}
    </Dialog>
  );
}
```

Check that `.sr-only` exists in the global styles (`grep -rn "\.sr-only" src`). If it does not, add the standard visually-hidden rule to `learn-drawer.scss`.

`src/features/lesson-engine/ui/learn-drawer.scss`:

```scss
@use '../../../shared/styles/tokens' as *;

.vdialog.learn-drawer {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  width: min(400px, 100vw);
  max-width: none;
  max-height: none;
  margin: 0;
  border-radius: 0;
  border-right: 1px solid var(--rule);
  overflow-y: auto;
  padding: 14px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  @include scrollbar;
}

.learn-drawer {
  &__head { display: flex; align-items: center; justify-content: space-between; }
  &__title { margin: 0; font-size: var(--text-lg); font-weight: 700; }
  &__desc { margin: 0; font-size: var(--text-sm); color: var(--ink-muted); }
  &__group-title { margin: 6px 0 4px; font-size: var(--text-xs); font-weight: 600; color: var(--ink-faint); }
  &__list { margin: 0; padding: 0; list-style: none; display: grid; gap: 2px; }
}

.learn-rail {
  position: relative;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  &::before {
    content: '';
    position: absolute;
    left: 10%;
    right: 10%;
    top: 9px;
    border-top: 1px solid var(--rule);
  }
  &__stop {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 2px 0 4px;
    border: 0;
    background: none;
    color: var(--ink-muted);
    font-size: var(--text-xs);
    cursor: pointer;
    &.is-current { color: var(--ink); font-weight: 600; }
    &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; border-radius: var(--radius-s); }
  }
  &__dot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1px solid var(--ink-faint);
    background: var(--paper-raised);
    color: var(--on-accent);
  }
  &__stop.is-done &__dot { background: var(--success); border-color: var(--success); }
  &__stop.is-current &__dot { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-tint); }
}

.learn-lesson {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 32px;
  padding: 4px 8px;
  border: 0;
  border-radius: var(--radius-s);
  background: none;
  color: var(--ink);
  font-size: var(--text-base);
  text-align: left;
  cursor: pointer;
  &:hover { background: var(--paper-sunken); }
  &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -2px; }
  &__mark { color: var(--ink-faint); text-align: center; }
  &.is-complete &__mark { color: var(--success); }
  &.is-progress { background: var(--accent-tint); color: var(--accent-text); }
  &.is-progress &__mark { color: var(--accent-text); }
  &__meta { font-size: var(--text-xs); color: var(--ink-faint); }
}
```

- [ ] **Step 7: Wire it in and remove the launcher**

`src/widgets/layout/top-bar/TopBar.tsx`: replace the `LessonLauncher` import and element with `LearnButton` (`import LearnButton from '@/features/lesson-engine/ui/LearnButton';` and `<LearnButton />`).

`src/pages/editor/ui/EditorApp.tsx`: import `LearnDrawer` from `'@/features/lesson-engine/ui/LearnDrawer'` and render `<LearnDrawer />` in `overlays`, before `<HelpCenter />`.

```bash
git rm src/features/lesson-engine/ui/LessonLauncher.tsx
grep -rn "LessonLauncher" src tests
```

Expected: no matches.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/learn-drawer.test.ts tests/black-box/editor-shell.test.ts tests/black-box/lesson-column.test.ts tests/black-box/editor-links.test.ts`
Expected: PASS. BB-LCOL-04 ("Finish and Exit return to Author mode") must still pass through the new `finish`.

- [ ] **Step 9: Look at it**

In the dev server, check:
- **Learn:** opens a drawer from the left with the five stops; arrow keys move along the rail; Esc closes and returns focus to Learn.
- **Starting a lesson** puts focus on the lesson title.
- **Exiting mid-way** shows "Step n of m" in the drawer.
- **Finishing** shows a tick, and the stop ticks when every lesson in its section is done.
- **Starting a lesson mid-lesson** asks first.

Stop the server by its PID.

- [ ] **Step 10: Full checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/features/lesson-engine/model/progress.ts src/features/lesson-engine/model/course.ts src/features/lesson-engine/model/start-lesson.ts src/features/lesson-engine/model/useLessonRunner.ts src/features/lesson-engine/ui/LearnButton.tsx src/features/lesson-engine/ui/LearnDrawer.tsx src/features/lesson-engine/ui/learn-drawer.scss src/features/lesson-engine/ui/LessonCard.tsx src/widgets/layout/top-bar/TopBar.tsx src/pages/editor/ui/EditorApp.tsx tests/black-box/learn-drawer.test.ts tests/black-box/editor-shell.test.ts
git add -u src/features/lesson-engine/ui/LessonLauncher.tsx
git diff --staged --stat
git commit -m "feat(lessons): Learn drawer with the course map and local progress"
```

---

### Task 6: Math tabs, help and the empty state follow the student

**Files:**
- Modify: `src/features/math-panel/ui/MathPanel.tsx`, `src/features/math-panel/ui/math-panel.scss`, `src/features/help/ui/HelpButton.tsx`, `src/features/help/ui/HelpCenter.tsx:31-41`, `src/widgets/canvas/VamsCanvas.tsx:23,76-80`, `src/widgets/canvas/ui/CanvasOverlays.tsx`, `src/features/code-generation/ui/SceneCodePanel.tsx:16,89`
- Test: `tests/black-box/editor-inspector.test.ts` (BB-INSP-06…08), `tests/black-box/editor-shell.test.ts` (BB-SHELL-16 updated)

**Interfaces:**
- Consumes: `mathTabFor` and `contextSection` from Task 1, and `setLearnOpen`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/black-box/editor-inspector.test.ts`. Add `h`, `render` from `'preact'`, plus `MathPanel`, `HelpButton` and `SceneCodePanel`, to the imports.

```ts
import { h, render, type VNode } from 'preact';
import MathPanel from '@/features/math-panel/ui/MathPanel';
import HelpButton from '@/features/help/ui/HelpButton';
import SceneCodePanel from '@/features/code-generation/ui/SceneCodePanel';

async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}
function mountEl(vnode: VNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(vnode, host);
  return host;
}

describe('BB-INSP-06: The math panel has one tab per section and follows the student', () => {
  it('names the five tabs, follows the opened group, and holds a manual pick until the next group', async () => {
    const host = mountEl(h(MathPanel, {}));
    await settle();
    const tabs = () => [...host.querySelectorAll('[role="tab"]')];
    const selected = () => host.querySelector('[role="tab"][aria-selected="true"]')!.textContent;
    expect(tabs().map((t) => t.textContent)).toEqual(['Pipeline', 'Primitives', 'Buffers', 'Transforms', 'Textures']);
    expect(selected()).toBe('Pipeline');
    useVamsStore.getState().toggleGroup('buffers');
    await settle();
    expect(selected()).toBe('Buffers');
    (tabs()[3] as HTMLButtonElement).click();
    await settle();
    expect(selected()).toBe('Transforms');
    useVamsStore.getState().toggleGroup('texture');
    await settle();
    expect(selected()).toBe('Textures');
    render(null, host);
    host.remove();
  });
});

describe('BB-INSP-07: Help opens on the topic for what the student is doing', () => {
  it('uses the opened group’s section before the course section', async () => {
    useVamsStore.setState({ activeSection: 'Pipeline', lastOpenedGroup: 'texture', isHelpOpen: false, activeHelpTopicId: null });
    const host = mountEl(h(HelpButton, {}));
    (host.querySelector('button') as HTMLButtonElement).click();
    await settle();
    const { topicForSection } = await import('@/features/help/model/help-content');
    expect(useVamsStore.getState().activeHelpTopicId).toBe(topicForSection('Textures'));
    useVamsStore.getState().closeHelp();
    render(null, host);
    host.remove();
  });
});

describe('BB-INSP-08: An empty scene shows the annotated program in every section', () => {
  it('annotates the boilerplate outside Pipeline too', async () => {
    useVamsStore.setState({ activeSection: 'Textures', objects: [] });
    const host = mountEl(h(SceneCodePanel, {}));
    await settle();
    expect(host.querySelector('.annotation, [data-annotation], .code-annotation')).not.toBeNull();
    render(null, host);
    host.remove();
  });
});
```

Before relying on BB-INSP-08's selector, check how the CodeViewer marks an annotated line: `grep -n "annotation" src/shared/ui/code-viewer/CodeViewer.tsx`. Use the class it renders.

In `tests/black-box/editor-shell.test.ts`, in BB-SHELL-16:
- replace the "Add your first shape" lookup and its two following assertions with the lines below;
- delete the `useVamsStore.setState({ activeSection: 'Transforms' });` line at the top of that test, if nothing else needs it.

```ts
    const buttons = [...host.querySelectorAll('.empty-canvas-hint button')].map((b) => b.textContent?.trim());
    expect(buttons).toEqual(['Add a shape', 'Start a lesson']);
    ([...host.querySelectorAll('.empty-canvas-hint button')][1] as HTMLButtonElement).click();
    expect(useVamsStore.getState().learnOpen).toBe(true);
    useVamsStore.setState({ learnOpen: false });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/editor-inspector.test.ts tests/black-box/editor-shell.test.ts -t "BB-INSP-0[678]|BB-SHELL-16"`
Expected: FAIL.

- [ ] **Step 3: Math tabs**

Replace `src/features/math-panel/ui/MathPanel.tsx` with:

```tsx
import './math-panel.scss';
import { useId } from 'react';
import type { ComponentChildren } from 'preact';
import { useVamsStore } from '@/core/store';
import type { CurriculumSection } from '@/core/store/types';
import { mathTabFor } from '@/core/inspector';
import PipelineMathContent from './PipelineMathContent';
import PrimitivesMathContent from './PrimitivesMathContent';
import BuffersMathContent from './BuffersMathContent';
import TransformsMathContent from './TransformsMathContent';
import TexturesMathContent from './TexturesMathContent';

const TABS: { section: CurriculumSection; content: () => ComponentChildren }[] = [
  { section: 'Pipeline', content: () => <PipelineMathContent /> },
  { section: 'Primitives', content: () => <PrimitivesMathContent /> },
  { section: 'Buffers', content: () => <BuffersMathContent /> },
  { section: 'Transforms', content: () => <TransformsMathContent /> },
  { section: 'Textures', content: () => <TexturesMathContent /> },
];

export default function MathPanel() {
  const tab = useVamsStore(mathTabFor);
  const setMathTabOverride = useVamsStore((s) => s.setMathTabOverride);
  const baseId = useId();
  const index = TABS.findIndex((t) => t.section === tab);

  const onKeyDown = (event: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    let next = step === undefined ? -1 : (index + step + TABS.length) % TABS.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = TABS.length - 1;
    if (next < 0) return;
    event.preventDefault();
    setMathTabOverride(TABS[next].section);
    requestAnimationFrame(() => document.getElementById(`${baseId}-tab-${next}`)?.focus());
  };

  return (
    <div className="math-panel-container">
      <div className="math-header">
        <span className="math-title">Math &amp; data</span>
        <div className="math-tabs" role="tablist" aria-label="Math by section" onKeyDown={onKeyDown}>
          {TABS.map((t, i) => (
            <button
              key={t.section}
              id={`${baseId}-tab-${i}`}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-controls={`${baseId}-panel`}
              tabIndex={i === index ? 0 : -1}
              className="math-tab"
              onClick={() => setMathTabOverride(t.section)}
            >
              {t.section}
            </button>
          ))}
        </div>
      </div>
      <div className="math-content" id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${index}`}>
        {TABS[index].content()}
      </div>
    </div>
  );
}
```

`useVamsStore(mathTabFor)` passes the whole state into a pure selector that returns a string, so re-renders only happen when the tab changes.

In `math-panel.scss`:
- remove the `.math-section-tag` rule;
- make `.math-header` wrap (`flex-wrap: wrap; gap: 6px;`);
- add:

```scss
.math-tabs { display: flex; gap: 2px; }
.math-tab {
  padding: 3px 7px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--ink-muted);
  font-size: var(--text-xs);
  cursor: pointer;
  &[aria-selected='true'] { color: var(--ink); border-bottom-color: var(--accent); }
  &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -2px; }
}
```

- [ ] **Step 4: Help, empty state, annotations**

**`src/features/help/ui/HelpButton.tsx`:**
- import `contextSection` from `@/core/inspector`;
- in both places, replace `const { activeSection } = useVamsStore.getState(); openHelp(topicForSection(activeSection));` with `openHelp(topicForSection(contextSection(useVamsStore.getState())));`;
- update the doc comment to say the topic follows what the student is working on.

**`src/features/help/ui/HelpCenter.tsx`:** replace the `activeSection` selector with `const section = useVamsStore(contextSection);`, and use `topicForSection(section)` in the fallback.

**`src/widgets/canvas/VamsCanvas.tsx`:**
- remove the `activeSection` selector;
- `const effectiveShowCoordinateTracker = showCoordinateTracker && !isHidden;`
- `const showEmptyHint = !isHidden && appMode === 'Author' && objectCount === 0;`
- update the comments to match.

**`src/widgets/canvas/ui/CanvasOverlays.tsx`:**
- replace `setActiveSection` with `const setLearnOpen = useVamsStore((s) => s.setLearnOpen);`;
- the empty hint's body becomes:

```tsx
        <div className="empty-canvas-hint">
          <Shapes size={32} aria-hidden />
          <p>Your scene is empty.</p>
          <div className="empty-canvas-hint__actions">
            <Button variant="primary" onClick={() => document.querySelector<HTMLElement>('.add-row__item')?.focus()}>
              Add a shape
            </Button>
            <Button onClick={() => setLearnOpen(true)}>Start a lesson</Button>
          </div>
        </div>
```

Add `.empty-canvas-hint__actions { display: flex; gap: 8px; justify-content: center; }` to `src/widgets/canvas/vams-canvas.scss`.

**`src/features/code-generation/ui/SceneCodePanel.tsx`:**
- remove the `activeSection` selector;
- `const showAnnotations = objects.length === 0;`

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/editor-inspector.test.ts tests/black-box/editor-shell.test.ts tests/black-box/help-center.test.ts`
Expected: PASS.

- [ ] **Step 6: Full checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/features/math-panel/ui/MathPanel.tsx src/features/math-panel/ui/math-panel.scss src/features/help/ui/HelpButton.tsx src/features/help/ui/HelpCenter.tsx src/widgets/canvas/VamsCanvas.tsx src/widgets/canvas/ui/CanvasOverlays.tsx src/widgets/canvas/vams-canvas.scss src/features/code-generation/ui/SceneCodePanel.tsx tests/black-box/editor-inspector.test.ts tests/black-box/editor-shell.test.ts
git diff --staged
git commit -m "feat(editor): math tabs, help and the empty state follow what the student is doing"
```

---

### Task 7: Layout fixes from the editor review

**Files:**
- Modify: every editor stylesheet in the scope below (type sweep); `src/shared/styles/_tokens.scss` (mixin, change-highlight tokens); the selected-state blocks listed in Step 4; `src/shared/ui/code-viewer/CodeViewer.tsx:224-228`; `src/shared/ui/code-viewer/code-viewer.scss`; `src/shared/engine/pixi/hooks/useGridSystem.ts`
- Test: `tests/black-box/editor-shell.test.ts` (BB-SHELL-22…24), `tests/visual/editor.spec.ts` (VIS-EDITOR-06)

**Editor stylesheet scope:** every `src/**/*.scss` tracked by git, except files under these paths:
- `src/pages/home/`, `src/pages/not-found/`;
- `src/widgets/site-header/`, `src/widgets/site-footer/`;
- `src/app/`, `src/shared/styles/`, `src/shared/ui/logo/`;
- `src/features/stage-mode/`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/black-box/editor-shell.test.ts`:

```ts
import { execSync } from 'node:child_process';
import { readFileSync as readSource } from 'node:fs';

const EDITOR_SCSS = execSync('git ls-files "src/**/*.scss"', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((f) => !/^src\/(pages\/home|pages\/not-found|widgets\/site-header|widgets\/site-footer|app\/|shared\/styles|shared\/ui\/logo|features\/stage-mode)/.test(f));

describe('BB-SHELL-22: Editor text sizes come from the type scale', () => {
  it('uses only --text-* tokens or inherit for font-size', () => {
    const offenders: string[] = [];
    for (const file of EDITOR_SCSS) {
      for (const m of readSource(file, 'utf8').matchAll(/font-size:\s*([^;]+);/g)) {
        if (!/^(var\(--text-(xs|sm|base|md|lg|xl|2xl)\)|inherit)(\s*!important)?$/.test(m[1].trim())) offenders.push(`${file}: ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('BB-SHELL-23: Editor labels are sentence case', () => {
  it('has no uppercase text-transform in editor styles', () => {
    const offenders = EDITOR_SCSS.filter((file) => /text-transform:\s*uppercase/.test(readSource(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

describe('BB-SHELL-24: Selected items share one selection style', () => {
  it('marks each selected-state rule with the selected-mark mixin', () => {
    // Only the selected item's own rule; descendant rules such as `&.active .icon` style its parts.
    const SELECTED = /&\.(active|selected)\s*\{|&\[aria-checked='true'\]\s*\{|tr\.is-active td/;
    const offenders: string[] = [];
    for (const file of EDITOR_SCSS) {
      const lines = readSource(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!SELECTED.test(line) || line.includes('&__')) return;
        const block = lines.slice(i, i + 12).join('\n');
        if (!block.includes('@include selected-mark')) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
```

Add to `tests/visual/editor.spec.ts`:

```ts
test('VIS-EDITOR-06: No horizontal page overflow at 960 px', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await open(page, '/app?scene=transforms');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/editor-shell.test.ts -t "BB-SHELL-2[234]"`
Expected: FAIL, with long offender lists.

- [ ] **Step 3: Type sweep and sentence case**

Run this one-off script from a scratch directory. It maps every `px` or `rem` font size in the editor scope to the nearest token. The editor root is 13px, so `1rem` = 13px. It also removes uppercase transforms and their wide letter-spacing.

```bash
SCRATCH="$TEMP/vams-type-sweep"; mkdir -p "$SCRATCH"
cat > "$SCRATCH/sweep.mjs" <<'EOF'
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const root = process.argv[2];
const skip = /^src\/(pages\/home|pages\/not-found|widgets\/site-header|widgets\/site-footer|app\/|shared\/styles|shared\/ui\/logo|features\/stage-mode)/;
const files = execSync('git ls-files "src/**/*.scss"', { cwd: root, encoding: 'utf8' }).split('\n').filter((f) => f && !skip.test(f));
const token = (px) => (px < 11.5 ? 'xs' : px < 12.5 ? 'sm' : px < 14 ? 'base' : px < 16.5 ? 'md' : px < 21 ? 'lg' : 'xl');
for (const f of files) {
  const path = `${root}/${f}`;
  const src = readFileSync(path, 'utf8');
  const out = src
    .replace(/font-size:\s*([0-9.]+)(px|rem)\s*(!important)?\s*;/g, (_m, n, unit, imp) => {
      const px = unit === 'rem' ? parseFloat(n) * 13 : parseFloat(n);
      return `font-size: var(--text-${token(px)})${imp ? ' !important' : ''};`;
    })
    .replace(/^\s*text-transform:\s*uppercase;\s*\n/gm, '')
    .replace(/^\s*letter-spacing:\s*0?\.(0[4-9]|1\d?)\d*em;\s*\n/gm, '');
  if (out !== src) {
    writeFileSync(path, out);
    console.log(f);
  }
}
EOF
node "$SCRATCH/sweep.mjs" "$(pwd)"
git diff --stat
```

Then fix by hand anything BB-SHELL-22 still lists, for example sizes written as `em` or `calc()`. Use the nearest token, or `inherit`.

- [ ] **Step 4: One selection style**

Add to `src/shared/styles/_tokens.scss`, after the `scrollbar` mixin:

```scss
/* The one selection style: accent tint behind, accent-coloured text. */
@mixin selected-mark {
  background: var(--accent-tint);
  color: var(--accent-text);
  border-color: var(--accent);
}
```

For each rule BB-SHELL-24 lists (from the earlier survey):
- `animation-preview-panel.scss:37`, `buffers-panel.scss:85`, `callbacks-panel.scss:54`, `custom-shape-builder-panel.scss:84`, `help-center.scss:145`;
- `exercise-widgets.scss:56`, `line-style-panel.scss:139`, `ortho-editor-panel.scss:88`, `pipeline-mode-controls.scss:29`;
- `scene-hierarchy-groups.scss:31`, `scene-hierarchy-panel.scss:121`, `textures-panels.scss:60`;
- `table.scss:35`, `pedagogical-views.scss:120`, `pedagogical-views.scss:315`.

Do this to each:
- delete its `background`, `background-color`, `color` and `border-color` declarations;
- add `@include selected-mark;`;
- keep layout, size and position declarations;
- make sure each file `@use`s the tokens partial (`@use '<relative>/shared/styles/tokens' as *;`).

`toggles.scss:38` is a switch's track. Keep its fill, and exempt it in the test's regex if needed, since a switch's on state is a value, not a selection. Do that by matching `&[aria-checked='true'] &__track` with `&__` and skipping it, which the test already does.

**Change highlight:** in `_tokens.scss`, set:
- `--code-changed-rgb` to the accent triplet (`47, 77, 224` light, `71, 98, 245` dark);
- `--code-changed-light` to `var(--accent-text)` in both blocks.

In `code-viewer.scss`, inside the `.code-line` `&.changed` block, add `box-shadow: inset 2px 0 0 var(--accent);` and remove `font-weight: bold;`.

**Lesson focus outline** in `panel.scss`: make `&.is-lesson-focus` `outline: 1px solid var(--accent); outline-offset: -1px; background: var(--accent-tint);`, removing any orange or amber treatment.

- [ ] **Step 5: Code column and canvas**

`src/shared/ui/code-viewer/CodeViewer.tsx`: in the highlight scroll effect, replace `const preservedLeft = scroller.scrollLeft;` and `left: preservedLeft,` with `left: 0,`. A highlighted line starts at its GL call, so its start is always shown.

`src/shared/engine/pixi/hooks/useGridSystem.ts`:
- in the `TextStyle`, set `fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace"` and `fontSize: 11`;
- after the axes `g.stroke();` inside `if (axisVisibility.showOriginMarker)`, draw NDC tick marks:

```ts
        g.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.45 });
        for (let x = startTickX; x <= endTickX; x += niceStep) {
          const sx = world.toGlobal({ x, y: 0 }).x;
          g.moveTo(sx, originScreen.y - 3);
          g.lineTo(sx, originScreen.y + 3);
        }
        for (let y = startTickY; y <= endTickY; y += niceStep) {
          const sy = world.toGlobal({ x: 0, y }).y;
          g.moveTo(originScreen.x - 3, sy);
          g.lineTo(originScreen.x + 3, sy);
        }
        g.stroke();
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/editor-shell.test.ts`
Expected: PASS.

Run: `npx playwright test tests/visual/editor.spec.ts -g "VIS-EDITOR-06"`
Expected: PASS. If it fails, find the overflowing element:

```js
[...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > innerWidth)
```

Then give that element `min-width: 0` or `overflow: hidden` in its own stylesheet.

- [ ] **Step 7: Look at it**

Open `/app?scene=transforms` at 1280 and 960 in both themes. Check:
- no text below 11px (DevTools, Computed);
- labels are sentence case;
- the selected tree row, active tabs and segmented choices all use the same cobalt tint;
- no orange or amber remains;
- a long code line scrolls inside the code panel.

The math diagrams with SVG text may need small layout nudges after the sweep. Fix any clipping you see in that diagram's stylesheet, using a token size.

- [ ] **Step 8: Full checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git status --short
```

Stage every modified stylesheet by path. Take them from `git status --short`, and include the `_tokens.scss` change.

```bash
git add <each modified .scss path> src/shared/ui/code-viewer/CodeViewer.tsx src/shared/engine/pixi/hooks/useGridSystem.ts tests/black-box/editor-shell.test.ts tests/visual/editor.spec.ts
git diff --staged --stat
git commit -m "fix(editor): one type scale, sentence-case labels, one selection style and NDC ticks"
```

---

### Task 8: Product plan amendment, visual baselines, roadmap and merge

**Files:**
- Modify: `docs/product-plan.md`, `docs/specs/2026-10-04-website-overhaul-roadmap.md`, `tests/visual/editor.spec.ts`

- [ ] **Step 1: Amend the product plan**

Edit `docs/product-plan.md` as follows. Keep the surrounding structure.

- **Line 26 (the layout sketch):** `Tools Rail · Canvas · Lesson Bar` becomes `Scene + Inspector · Canvas · Lesson card`.
- **Core Constraints → Section Switching Semantics:** before the table, add this sentence:

  > The current section is the student's place in the course. It is set by choosing a lesson in the Learn drawer (or opening a lesson link). The editor's tools are the same in every section.

  In the table, the row "Ephemeral tools-rail state …" becomes `Transient panel state (open inspector groups, the last opened group, a hand-picked math tab)`.
- **Stage 0 → Goals:**
  - Goal 1: "a tools rail on the left" becomes "a scene and inspector column on the left".
  - Goal 7 becomes "The Learn drawer moves between curriculum sections with the correct state semantics defined above."
  - Goal 8 becomes "The math panel has one tab per curriculum section and follows the control the student is using."
- **Stage 0 → Workspace Layout:** replace the Tools rail bullet with:

  > - **Scene and inspector column**: left sidebar, the same in every section. On top, the scene: the object hierarchy, an Add row of primitives by OpenGL name, and Create Text. Below, an inspector for the selected object with groups in pipeline order (Vertices, Buffers, Transform, Appearance, Texture, Animation), each naming its OpenGL call; with nothing selected, the scene's settings (Background, Viewing volume, Texture library, Callbacks).

  Replace the lesson-bar paragraph with:

  > A lesson card appears at the top of that column when a lesson is active, showing the narration and Back, Next and Exit. The step's control is opened and outlined in the live editor; demos also dim the other groups, exercises only outline, and a section's last exercise gives no focus. The top bar's Learn button opens the course map: the five sections in pipeline order, each section's demos and exercises, and the student's progress, stored in the browser.

- **Stage 0 → Lesson Engine** "displayed in the lesson bar" and **Appendix B** "(displayed in the lesson bar)": "lesson bar" becomes "lesson card".
- **Stage 0 → Acceptance Criteria:** "with tools rail, canvas, code panel, and math panel" becomes "with the scene and inspector column, canvas, code panel, and math panel". "The section selector switches sections" becomes "The Learn drawer switches sections".
- **Stage 1 → Workspace Configuration → Tools Rail** becomes:

  > - **Lesson card (Pipeline lessons):** a view toggle (scene, pipeline diagram, raster vs vector) shown during Pipeline lessons. Outside Pipeline lessons the canvas always shows the scene, and the coordinate playground is the normal canvas.

- **Stages 2–5 → Workspace Configuration → Tools Rail bullets:** rename each to **Inspector**. Reword each list as the groups that hold those tools:
  - Primitives: the Add row and Create Text in the scene area; colour and line style in Appearance; callbacks in scene settings.
  - Buffers: the Buffers group.
  - Transforms: the Transform group, Animation, and Viewing volume in scene settings.
  - Textures: the Texture library in scene settings; attach, filter, wrap and the UV editor in the Texture group.

  Keep every capability named. Only the location wording changes. In Stage 5, "a compact inline panel in the tools rail" becomes "a compact inline panel in the Texture group".
- **Stage 2 → Callback Panel Behavior:** add one sentence: "The panel sits in the inspector's scene settings."

Then check that no stale wording is left:

```bash
grep -n "tools rail\|Tools Rail\|lesson bar\|section selector" docs/product-plan.md
```

Expected: no matches.

- [ ] **Step 2: Visual baselines**

In `tests/visual/editor.spec.ts`, update any VIS-EDITOR test that waits for or names the section menu or the Lessons menu to the new column and Learn. Add two tests:

```ts
test('VIS-EDITOR-07: Scene settings with nothing selected, light, 1280', async ({ page }) => {
  await open(page, '/app');
  await expect(page).toHaveScreenshot('settings-light-1280.png');
});

test('VIS-EDITOR-08: Learn drawer, dark, 1280', async ({ page }) => {
  await open(page, '/app?scene=transforms', 'dark');
  await page.getByRole('button', { name: 'Learn' }).click();
  await expect(page).toHaveScreenshot('learn-dark-1280.png');
});
```

Then:

```bash
npx playwright test --update-snapshots
npx playwright test
```

Expected: the second run passes. Open the new baselines and check them against the spec:
- plain editor with a selection;
- scene settings;
- empty state;
- a demo step and an exercise step;
- the Learn drawer, in both themes.

- [ ] **Step 3: Roadmap status**

In `docs/specs/2026-10-04-website-overhaul-roadmap.md`, set item 6's status to:

`Complete (YYYY-MM-DD): [spec](2026-10-07-editor-refinement-design.md), [plan](../plans/2026-10-07-editor-refinement.md)`

Use the actual date.

- [ ] **Step 4: Full checks, commit, merge**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add docs/product-plan.md docs/specs/2026-10-04-website-overhaul-roadmap.md tests/visual/editor.spec.ts
git diff --staged
git commit -m "docs(plan): amend the product plan for the unified editor and the Learn drawer"
git checkout main
git merge --no-ff feat/editor-refinement -m "Merge branch 'feat/editor-refinement'"
npm run lint && npm run build && npm test
git checkout -- tests/reports
git branch -d feat/editor-refinement
```

Pushing to `origin` is the owner's call. Ask before pushing.
