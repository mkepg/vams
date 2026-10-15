# Code and Math Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The code panel folds everything except the selected object's code, marks only the value that changed, and explains any line on request. The math pane becomes a vertex journey that follows one vertex through six pipeline stages with the student's numbers.

**Architecture:**
- **Code panel.** Pure functions read the generated program's text (`outlineCode`), decide which rows show (`visibleRows`), find changed values (`diffChangedValues`) and explain lines (`explainLine`, `noteFor`). The generator does not change. `shared/ui/code-viewer` renders rows from props and knows nothing of the scene; `SceneCodePanel` composes it from the store.
- **Math pane.** A pure `vertexJourney` computes the six stages. `JourneyPanel` renders them, reusing today's math cards as pictures.
- **Shared state.** Code, math and canvas link through store state only (`codePane`, `journeyStageOverride`, `explainedLine`, `explainRequest`, `journeyVertex`).

**Tech Stack:** Preact via `preact/compat`, Zustand with Immer, PixiJS 8, SCSS tokens, Vitest with happy-dom, Playwright (visual checks only).

**Spec:** [docs/specs/2026-10-15-code-math-rework-design.md](../specs/2026-10-15-code-math-rework-design.md). Its "Owner decisions" table and "Rulings made in this spec" list are binding.

**Visual reference (local, git-ignored):**
- `.superpowers/brainstorm/1039-1791996012/content/code-calm-v2.html`: the code panel. Use "Calm A", the left column.
- `.superpowers/brainstorm/1039-1791996012/content/journey-h2-v3.html`: the journey.

Every UI task carries the mocks' spacing, sizes, colour roles and hierarchy, mapped to tokens as below.

## Global Constraints

### Repository rules
- Feature-Sliced Design: `app → pages → widgets → features → entities → shared`, plus `core`. New code imports only from layers below and from its own slice, via `@/`. `features/code-generation` imports nothing from `features/math-panel`. `shared/ui/code-viewer` imports nothing from `features` or `core`.
- Student-facing text never contains "coming soon", "not supported", "future", "deferred", "3D" or "lighting". It follows the product rules in `AGENTS.md`.
- Section labels stay exactly `Pipeline | Primitives | Buffers | Transforms | Textures`.
- The persisted shape does not change: `version: 9` and the same `partialize` keys. Every new store field is runtime-only.
- The generator (`features/code-generation/model/code-generator.ts` and `generator/*`) does not change. Copy always copies the whole program.
- Tests live in `tests/`. Each carries a stable ID `{SUITE}-{MODULE}-{NN}`. Existing IDs stay; new ones take the next free number in their file. New suites:
  - `WB-CODE` in `tests/white-box/code-structure.test.ts`
  - `BB-CODE` in `tests/black-box/code-panel.test.ts`
  - `WB-JOURNEY` in `tests/white-box/vertex-journey.test.ts`
  - `BB-JOURNEY` in `tests/black-box/math-journey.test.ts`
  - `VIS-CM` in `tests/visual/code-math.spec.ts`
- Journey numbers are tested against `tests/helpers/matrix.ts`, the independent reference, never against `src`.
- Before every commit:
  - Run `npm run lint`, `npm run build` and `npm test`; all must pass.
  - Then run `git checkout -- tests/reports`.
  - Stage paths explicitly and read `git diff --staged`.
  - Never stage `.gitignore` or `AGENTS.md`.
- Commits follow Conventional Commits. No `Co-Authored-By` line, no "Generated with" line, and no mention of an assistant, skill or workflow.
- Work happens on branch `feat/code-math`, started from `main`.
- Never `taskkill /IM node.exe`. Stop only processes you started, by PID. Port 5173 belongs to another program: the dev server uses 5174 and the visual suite 4319.
- Spelling: new student-facing text follows the spec and the approved mocks, which use British spelling ("Rasterised", "Coloured", "colour", "normalised"). Quote existing control labels exactly as the UI shows them ("Translate X", "Color emission", "Buffer usage hint").
- Numbers shown to students use a true minus sign (U+2212 "−") and never show "−0.00".
- Code and math work lands by the **Oct 28 editor freeze**:
  - Tasks 1–16 (build steps 1–3) are the core.
  - Tasks 17–20 (step 4) stop wherever time runs out. Every stage that ships is complete.
  - Task 21 (docs) is not editor code and may land after the freeze.

### Tokens: the mocks mapped to `shared/styles/_tokens.scss`

`:root` is the light theme and `[data-theme='dark']` the dark one. The mocks are dark-only. Light values are chosen so every pair keeps the dark theme's contrast role.

| Mock variable | Hex (dark) | Token | Light value |
| --- | --- | --- | --- |
| `--paper` | `#10141f` | `--paper` (exists) | `#e9edf6` (exists) |
| `--raised` | `#171d2b` | `--paper-raised` (exists) | `#f6f8fd` (exists) |
| `--sunken` | `#0b0e16` | `--paper-sunken` (exists) | `#dde3f0` (exists) |
| `--ink` | `#e4e8f2` | `--ink` (exists) | `#121827` |
| `--muted` | `#a2abc2` | `--ink-muted` (exists) | `#47506a` |
| `--faint` | `#8a93ab` | `--ink-faint` (exists) | `#535c76` |
| `--dim` | `#5d6680` | **new `--ink-dim`: `#7a84a0`** (lifted to 4.9:1, owner decision 2026-10-15) | **`#626b85`** (4.5:1 on paper) |
| `--dimmer` | `#454d63` | **new `--line-number`: `#5d6680`** (3.2:1, the quietest text) | **`#7d87a1`** (3.1:1) |
| `--rule` | `#29324a` | `--rule` (exists) | `#c6cfe2` |
| `--rule2` | `#36415e` | `--rule-strong` (exists) | `#aeb9d1` |
| `--accent` | `#4762f5` | `--accent` (exists) | `#2f4de0` |
| `--accent-text` | `#9cadff` | `--accent-text` / `--code-fn` (exist) | `#2f4de0` |
| `--tint` | `rgba(71,98,245,.18)` | `--accent-tint` (exists) | `rgba(47,77,224,.12)` |
| `--amber` | `#fbbf77` | **new `--value`** | **`#8a4f00`** (5.6:1 on paper, 4.8:1 on its wash) |
| `rgba(251,191,119,.16)` | | **new `--value-wash`** | **`rgba(138, 79, 0, 0.12)`** |
| (Run's fired branch) | | **new `--run-fired`: `#4ade80`** | **`#15803d`** |
| | | **new `--run-fired-wash`: `rgba(74, 222, 128, 0.10)`** | **`rgba(21, 128, 61, 0.10)`** |
| (canvas ring) | | **new `--canvas-ring`: `#fbbf77`**, the same in both themes, because the canvas is dark in both | `#fbbf77` |

- Retired: `--code-match-rgb`, `--code-match-light`, `--code-changed-rgb` and `--code-changed-light` (their only users are the old code viewer styles).
- Divergence from the spec: the spec's light `--value` `#9a5800` was measured against `--code-bg`. The panel now sits on `--paper`, the mocks' surface. There `#9a5800` drops to 4.05:1 on its wash, so light `--value` is `#8a4f00`.

### Type and spacing: the mocks mapped to the scale

- The scale has no size below 11 px (`--text-xs`). The mocks' 10 px, 11 px and 11.5 px become `--text-xs`.
- 12 px and 12.5 px become `--text-sm`, 13 px `--text-base`, and 16 px `--text-md` (15 px).
- Code is `--text-sm` at line-height 1.8.
- Pixel paddings, widths and gaps are copied from the mocks as written (36 px headers, the 30 px line-number column with 14 px after it, the journey's 36 px left inset).

## Review Focus

1. **A canvas resize, a lesson starting or ending, or Back in a lesson must not paint the whole program amber.** Only the student's own edit is marked. Task 6 tests the lesson start and the resize rule.
2. **Selecting another object closes what belonged to the old one.** Folds opened by hand close, the strip closes and the followed vertex goes back to 1, whichever path changed the selection (canvas, list, new shape, delete, undo, the lesson runner). Task 1 tests several paths.
3. **Removing vertices while following the last one clamps; it never shows "vertex 4 of 3" or crashes.** Task 9 tests the model and Task 10 the header.
4. **Objects whose names the generator sanitises** ("My Shape" → `My_Shape`, `class` → `class_obj`) still fold, explain and note correctly. The panel matches on `sanitizeName(name)`, never on the raw name. Tasks 2 and 6 test this.
5. **A vertex outside the viewing volume** gives NDC beyond ±1 and a pixel outside the window. The journey shows the real numbers, with no clamping and no NaN. Task 19 tests this.

---

## File map

| Path | Status | Responsibility |
| --- | --- | --- |
| `src/core/store/types.ts` | modify | New runtime fields and actions |
| `src/core/store/runtime-slice.ts` | modify | Defaults and setters; `journeyStageOverride` replaces `mathTabOverride`; `revealGroup` |
| `src/core/store/lesson-slice.ts` | modify | Clears `journeyStageOverride` where it cleared `mathTabOverride` |
| `src/core/store/tour-slice.ts` | modify | Understand step opens Transformed |
| `src/core/store/index.ts` | modify | Selection-change subscription resets the per-object view state |
| `src/core/inspector/journey-stage.ts` | create | `JourneyStageId`, `stageForPlace`, `stageForSection`, `journeyStageFor` |
| `src/core/inspector/context-section.ts` | modify | Drop `mathTabFor` (help keeps `contextSection`) |
| `src/core/inspector/index.ts` | modify | Export `journey-stage` |
| `src/core/types/lesson.ts` | modify | `LessonStep.mathStage` |
| `src/features/code-generation/model/code-outline.ts` | create | `outlineCode`, `findCallLine`, `stateFieldAt` |
| `src/features/code-generation/model/code-folds.ts` | create | `visibleRows` |
| `src/features/code-generation/model/code-diff.ts` | modify | `matchLines`; `diffChangedLines` uses it |
| `src/features/code-generation/model/value-diff.ts` | create | `diffChangedValues` |
| `src/features/code-generation/model/use-value-marks.ts` | create | Tracks the student's last edit as value marks |
| `src/features/code-generation/model/code-explanations.ts` | create | The catalogue: `explainLine`, `noteFor` (replaces `glut-annotations.ts`) |
| `src/features/code-generation/model/glut-annotations.ts` | delete | Replaced |
| `src/features/code-generation/ui/SceneCodePanel.tsx` | modify | Composes outline, folds, marks, notes, strip and links |
| `src/shared/ui/code-viewer/types.ts` | create | `CodeRow`, `CodeMark`, `CodeNote`, `CodeStrip` |
| `src/shared/ui/code-viewer/tokenize.ts` | create | `tokenizeLine`, moved out of `CodeViewer.tsx` |
| `src/shared/ui/code-viewer/CodeViewer.tsx` | rewrite | Rows, folds, marks, Find, notes, strip, hint |
| `src/shared/ui/code-viewer/code-viewer.scss` | rewrite | Calm A |
| `src/shared/styles/_tokens.scss` | modify | New tokens; retire the old code-match and code-changed tokens |
| `src/features/math-panel/model/vertex-journey.ts` | create | `vertexJourney`, `assemblyFor` |
| `src/features/math-panel/ui/MathPanel.tsx` | rewrite | The journey: header, track, open stage |
| `src/features/math-panel/ui/journey/*.tsx`, `journey.scss` | create | `JourneyFollow`, `JourneyTrack`, `WorkingTable`, `stage-pictures` |
| `src/features/math-panel/ui/*MathContent.tsx` | modify | Export their cards; Transforms and Primitives lose their default exports |
| `src/features/lesson-engine/model/useLessonRunner.ts` | modify | Applies `mathStage` |
| `src/features/lesson-engine/model/*-lessons.ts` | modify | Narration names journey stages; one `mathStage` |
| `src/shared/engine/selection-overlay.ts` | modify | `FollowRing`, `ringTarget` |
| `src/shared/engine/pixi/hooks/useSceneRenderer.ts` | modify | Draws the ring; a handle click chooses the vertex |
| `src/widgets/layout/editor-column/use-group-focus.ts` | modify | Outlines a revealed group in Author mode |
| `src/features/help/model/help-content.ts` | modify | Code panel and math panel topics |
| `docs/product-plan.md`, `docs/specs/2026-10-04-website-overhaul-roadmap.md`, `tests/README.md` | modify | Amendment, status, divergence 15, suite map |

---

## Build step 1: the calm code panel

### Task 1: Code-panel state, and resets when the selection changes

**Files:**
- Modify: `src/core/store/types.ts` (the `RuntimeSlice` interface)
- Modify: `src/core/store/runtime-slice.ts`
- Modify: `src/core/store/index.ts` (after the existing selection subscription)
- Modify: `tests/setup.ts` (reset the new fields)
- Create: `tests/black-box/code-panel.test.ts`

**Interfaces:**
- Produces, in `RuntimeSlice`:
  - `codeFoldsOpened: string[]`, `explainedLine: number | null`, `codeNotes: boolean`, `journeyVertex: number`
  - `toggleCodeFold(block: string): void`
  - `setExplainedLine(line: number | null): void`
  - `setCodeNotes(on: boolean): void`
  - `setJourneyVertex(index: number): void`
- Produces: a store subscription. Whenever `selectedObjectId` changes (to another id or to null), it sets `{ journeyVertex: 0, codeFoldsOpened: [], explainedLine: null }`.

Plan ruling: the spec puts these resets in "`selectObject` and the multi-select actions". There are no multi-select actions, and about a dozen paths write `selectedObjectId` directly: add, delete, duplicate, group, text, undo, redo, the tour and the lesson runner. The rail already handles this with one subscription in `core/store/index.ts`, and this task follows that precedent.

- [ ] **Step 1: Create the branch**

```bash
git checkout main
git checkout -b feat/code-math
```

- [ ] **Step 2: Write the failing tests**

Create `tests/black-box/code-panel.test.ts`:

```ts
/**
 * BLACK-BOX TEST SUITE — BB-CODE
 * The code panel: folding that follows the selection, changed values, Find, the explanation strip and notes.
 */
import { describe, it, expect } from 'vitest';
import { useVamsStore } from '@/core/store';
import { addTriangle, addQuad, getState } from '../helpers/store';

describe('BB-CODE-01: The code panel state starts calm and is never saved', () => {
  it('opens no folds, explains nothing, shows notes and follows vertex 1', () => {
    const s = getState();
    expect(s.codeFoldsOpened).toEqual([]);
    expect(s.explainedLine).toBeNull();
    expect(s.codeNotes).toBe(true);
    expect(s.journeyVertex).toBe(0);
    s.toggleCodeFold('main');
    expect(getState().codeFoldsOpened).toEqual(['main']);
    getState().toggleCodeFold('main');
    expect(getState().codeFoldsOpened).toEqual([]);
    getState().setExplainedLine(12);
    getState().setCodeNotes(false);
    getState().setJourneyVertex(2);
    expect([getState().explainedLine, getState().codeNotes, getState().journeyVertex]).toEqual([12, false, 2]);
    const options = (useVamsStore as unknown as { persist: { getOptions: () => { partialize: (s: unknown) => object } } }).persist.getOptions();
    const saved = Object.keys(options.partialize(getState()));
    for (const key of ['codeFoldsOpened', 'explainedLine', 'codeNotes', 'journeyVertex']) expect(saved).not.toContain(key);
  });
});

describe('BB-CODE-02: A new selection closes the old object\'s folds and strip and follows vertex 1', () => {
  const dirty = () => {
    getState().toggleCodeFold('main');
    getState().setExplainedLine(5);
    getState().setJourneyVertex(2);
  };
  const isReset = () => {
    const s = getState();
    return s.codeFoldsOpened.length === 0 && s.explainedLine === null && s.journeyVertex === 0;
  };

  it('resets on selectObject, on a new shape, on delete and on undo', () => {
    const tri = addTriangle();
    const quad = addQuad(0.5, 0.5, 0.2);
    getState().selectObject(tri.id);
    dirty();
    getState().selectObject(quad.id);
    expect(isReset()).toBe(true);
    dirty();
    getState().deleteObject(quad.id);
    expect(isReset()).toBe(true);
    getState().selectObject(tri.id);
    dirty();
    addTriangle(-0.5, -0.5, 0.2);
    expect(isReset()).toBe(true);
    dirty();
    getState().undo();
    expect(isReset()).toBe(true);
  });

  it('keeps them while the selection stays the same', () => {
    const tri = addTriangle();
    getState().selectObject(tri.id);
    dirty();
    getState().updateObjectTransform(tri.id, { translateX: 0.4 });
    getState().selectObject(tri.id);
    expect(getState().codeFoldsOpened).toEqual(['main']);
    expect(getState().explainedLine).toBe(5);
    expect(getState().journeyVertex).toBe(2);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/code-panel.test.ts`
Expected: FAIL. `codeFoldsOpened` is `undefined` and `toggleCodeFold is not a function`.

- [ ] **Step 4: Add the fields and actions**

In `src/core/store/types.ts`, inside `interface RuntimeSlice`, after `codeChangedUnseen: boolean;`:

```ts
  /** Code folds the student opened by hand; cleared when the selection changes. Session only. */
  codeFoldsOpened: string[];
  /** The code line the explanation strip explains. Session only. */
  explainedLine: number | null;
  /** The code panel's Notes switch. Starts on; session only. */
  codeNotes: boolean;
  /** The selected object's vertex the math journey follows, 0-based. Session only. */
  journeyVertex: number;
```

After `markCodeChanged: () => void;`:

```ts
  /** Opens a fold, or closes it if the student opened it. */
  toggleCodeFold: (block: string) => void;
  setExplainedLine: (line: number | null) => void;
  setCodeNotes: (on: boolean) => void;
  setJourneyVertex: (index: number) => void;
```

In `src/core/store/runtime-slice.ts`, after `codeChangedUnseen: false,`:

```ts
  codeFoldsOpened: [],
  explainedLine: null,
  codeNotes: true,
  journeyVertex: 0,
```

After the `markCodeChanged` action:

```ts
  toggleCodeFold: (block) => set((state) => ({
    codeFoldsOpened: state.codeFoldsOpened.includes(block)
      ? state.codeFoldsOpened.filter((id) => id !== block)
      : [...state.codeFoldsOpened, block],
  })),
  setExplainedLine: (line) => set({ explainedLine: line }),
  setCodeNotes: (on) => set({ codeNotes: on }),
  setJourneyVertex: (index) => set({ journeyVertex: Math.max(0, Math.floor(index)) }),
```

- [ ] **Step 5: Add the selection subscription**

In `src/core/store/index.ts`, directly after the existing `useVamsStore.subscribe` that switches the rail to Scene:

```ts
// The code folds, the explanation strip and the followed vertex belong to the selected object.
// Any path that changes the selection (including clearing it) starts the new object fresh.
useVamsStore.subscribe((state, prev) => {
  if (state.selectedObjectId === prev.selectedObjectId) return;
  if (state.codeFoldsOpened.length === 0 && state.explainedLine === null && state.journeyVertex === 0) return;
  useVamsStore.setState({ codeFoldsOpened: [], explainedLine: null, journeyVertex: 0 });
});
```

- [ ] **Step 6: Reset the new fields between tests**

In `tests/setup.ts`, inside the `useVamsStore.setState({ ... })` call in `beforeEach`, after `tourStepBaseline: null,`:

```ts
    codePane: 'code',
    codeHidden: false,
    codeChangedUnseen: false,
    codeFoldsOpened: [],
    explainedLine: null,
    codeNotes: true,
    journeyVertex: 0,
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/code-panel.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Run the whole suite, lint and build, then commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/core/store/types.ts src/core/store/runtime-slice.ts src/core/store/index.ts tests/setup.ts tests/black-box/code-panel.test.ts
git diff --staged
git commit -m "feat(code): code panel state for folds, the explanation strip, notes and the followed vertex"
```

Expected: the existing 698 tests plus 3 new pass.

---

### Task 2: Outline the generated program

**Files:**
- Create: `src/features/code-generation/model/code-outline.ts`
- Create: `tests/white-box/code-structure.test.ts`

**Interfaces:**
- Produces, exported from `code-outline.ts`:

```ts
export type BlockKind =
  | 'includes' | 'struct' | 'state' | 'view' | 'buffer-data' | 'vbo-handles' | 'texture-handles'
  | 'declarations' | 'draw-object' | 'draw' | 'update-buffers' | 'display' | 'window-to-world'
  | 'handler' | 'init' | 'idle' | 'main';
export type LineKind =
  | 'include' | 'struct' | 'state' | 'view' | 'buffer-array' | 'handle' | 'declaration'
  | 'function' | 'branch' | 'assign' | 'call' | 'other';
export interface CodeBlock {
  id: string; kind: BlockKind; label: string; summary: string;
  start: number; end: number; signature: number | null; close: number | null; object: string | null;
}
export interface OutlineLine { text: string; block: string; object: string | null; kind: LineKind; explainable: boolean }
export interface CodeOutline { lines: OutlineLine[]; blocks: CodeBlock[]; objects: string[] }
export function outlineCode(code: string): CodeOutline;
/** The first line calling `call` in the object's own code (its draw function or inline segment), else anywhere. */
export function findCallLine(outline: CodeOutline, object: string | null, call: string): number | null;
/** On a state line, the `state_<name>.<field>` that the character at `column` belongs to. */
export function stateFieldAt(text: string, column: number): string | null;
```

- Block ids:
  - `draw:<name>` for a `draw-object` block.
  - `handler:<functionName>` for a handler.
  - The kind itself for every other block (`main`, `init`, `state` and so on).
- `object` and `OutlineLine.object` are the object's code name, as the generator writes it (`sanitizeName(node.name)`).
- Ownership rules. `OutlineLine.object` is set for:
  - state lines;
  - buffer arrays and handles;
  - every line of a `draw_<name>()` function;
  - an inline text or group segment in `draw()`;
  - an object's setup segment in `init()` and `update_buffers()`.
- It is `null` everywhere else: headers, `draw_X();` calls, handlers and boilerplate.

- [ ] **Step 1: Write the failing tests**

Create `tests/white-box/code-structure.test.ts`:

```ts
/**
 * WHITE-BOX TEST SUITE — WB-CODE
 * Reading the generated program's structure: the outline, the folds, changed values and the explanation catalogue.
 */
import { describe, it, expect } from 'vitest';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { outlineCode, findCallLine, stateFieldAt, type CodeOutline } from '@/features/code-generation/model/code-outline';
import type { CallbackRule } from '@/core/types/scene';
import { addTriangle, addQuad, addPrimitive, getState } from '../helpers/store';

const program = () => {
  const s = getState();
  return generateCodeFromState(
    { objects: s.objects, canvasBackgroundColor: s.canvasBackgroundColor, callbacks: s.callbacks, viewportLimits: s.viewportLimits, textures: s.getAllTextures() },
    { width: 800, height: 600 },
  );
};
const rule = (objectId: string, over: Partial<CallbackRule> = {}): CallbackRule => ({
  id: `r-${Math.random()}`, objectId, trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'translate', dx: 0.1, dy: 0 }, ...over,
});

/** One triangle in immediate mode. */
export function immediateFixture() {
  const tri = addTriangle(0.4, -0.17, 0.5);
  getState().updateObjectTransform(tri.id, { rotate: 15 });
  return { tri, code: program() };
}
/** Every structure the generator writes: vertex arrays, an indexed textured quad, a dynamic VBO, text, a group, three handlers. */
export function fullFixture() {
  const tri = addTriangle(0.4, -0.17, 0.5);
  const quad = addQuad(-0.3, 0.3, 0.2);
  getState().updateRenderingMode(quad.id, 'VERTEX_ARRAY');
  getState().updateUseIndexed(quad.id, true);
  getState().attachTexture(quad.id, getState().getAllTextures()[0].id);
  getState().updateRenderingMode(tri.id, 'VBO');
  getState().updateBufferUsage(tri.id, 'DYNAMIC');
  getState().addTextObject('Hi', 0.1, 0.2);
  const text = getState().objects[0];
  getState().setCallbackHandler('keyboard', 'onKey');
  getState().addCallbackRule('keyboard', rule(tri.id));
  getState().setCallbackHandler('mouse', 'onMouse');
  getState().setCallbackHandler('idle', 'onIdle');
  return { tri, quad, text, code: program() };
}
/** Two shapes in a group, a text shown and hidden by a rule, and a reshape that keeps proportions. */
export function groupFixture() {
  const a = addTriangle(-0.4, 0, 0.2);
  const b = addQuad(0.4, 0, 0.2);
  getState().createGroup([a.id, b.id]);
  const group = getState().objects.find((o) => o.type === 'GROUP')!;
  getState().addTextObject('Hi', 0, 0.6);
  const text = getState().objects[0];
  getState().setCallbackHandler('keyboard', 'onKey');
  getState().addCallbackRule('keyboard', rule(text.id, { action: { type: 'visibility', mode: 'toggle' } }));
  getState().setCallbackHandler('mouse', 'onMouse');
  getState().addCallbackRule('mouse', rule(a.id, { trigger: { kind: 'mouse', button: 'left', state: 'down' }, action: { type: 'moveToPointer' } }));
  getState().setCallbackHandler('reshape', 'onReshape');
  return { a, b, group, text, code: program() };
}

const kinds = (o: CodeOutline) => o.blocks.map((b) => b.kind);
const lineOf = (o: CodeOutline, needle: string) => o.lines.findIndex((l) => l.text.includes(needle));
const ownerOf = (o: CodeOutline, needle: string) => o.lines[lineOf(o, needle)].object;

describe('WB-CODE-01: An immediate-mode program reads as its blocks in order', () => {
  it('finds includes, the struct, state, declarations, the draw function, draw, display, init and main', () => {
    const { code } = immediateFixture();
    const o = outlineCode(code);
    expect(kinds(o)).toEqual(['includes', 'struct', 'state', 'declarations', 'draw-object', 'draw', 'display', 'init', 'main']);
    expect(o.blocks.find((b) => b.kind === 'draw-object')!.id).toBe('draw:TRIANGLES_1');
    expect(o.objects).toEqual(['TRIANGLES_1']);
  });
});

describe('WB-CODE-02: Every structure the generator writes has its block', () => {
  it('finds buffer data, both handle lists, update_buffers, each handler, the idle wrapper and init', () => {
    const o = outlineCode(fullFixture().code);
    for (const kind of ['buffer-data', 'vbo-handles', 'texture-handles', 'update-buffers', 'idle', 'init'] as const) {
      expect(kinds(o), kind).toContain(kind);
    }
    expect(o.blocks.filter((b) => b.kind === 'handler').map((b) => b.id)).toEqual(['handler:onKey', 'handler:onMouse', 'handler:onIdle']);
    const { code } = groupFixture();
    const g = outlineCode(code);
    expect(kinds(g)).toContain('view');
    expect(kinds(g)).toContain('window-to-world');
    expect(g.blocks.map((b) => b.id)).toContain('handler:onReshape');
  });
});

describe('WB-CODE-03: The blocks tile the whole program', () => {
  it('gives every line exactly one block, in order, with no gaps', () => {
    for (const { code } of [immediateFixture(), fullFixture(), groupFixture()]) {
      const o = outlineCode(code);
      expect(o.lines).toHaveLength(code.split('\n').length);
      expect(o.blocks[0].start).toBe(0);
      expect(o.blocks[o.blocks.length - 1].end).toBe(o.lines.length - 1);
      for (let k = 1; k < o.blocks.length; k++) expect(o.blocks[k].start).toBe(o.blocks[k - 1].end + 1);
      for (const block of o.blocks) {
        for (let l = block.start; l <= block.end; l++) expect(o.lines[l].block).toBe(block.id);
      }
    }
  });
});

describe('WB-CODE-04: Each line knows the object it belongs to', () => {
  it('owns state, buffers, draw functions, init and update segments, and inline text; leaves boilerplate unowned', () => {
    const o = outlineCode(fullFixture().code);
    expect(ownerOf(o, 'ObjectState state_QUADS_1')).toBe('QUADS_1');
    expect(ownerOf(o, 'GLfloat verts_QUADS_1[]')).toBe('QUADS_1');
    expect(ownerOf(o, 'GLuint vbo_TRIANGLES_1 = 0;')).toBe('TRIANGLES_1');
    expect(ownerOf(o, 'GLuint tex_QUADS_1 = 0;')).toBe('QUADS_1');
    expect(ownerOf(o, 'glDrawElements(GL_QUADS')).toBe('QUADS_1');
    expect(ownerOf(o, '// TRIANGLES_1 — upload to GPU')).toBe('TRIANGLES_1');
    expect(ownerOf(o, 'glGenBuffers(1, &cbo_TRIANGLES_1)')).toBe('TRIANGLES_1');
    expect(ownerOf(o, '// QUADS_1 — texture object')).toBe('QUADS_1');
    expect(ownerOf(o, 'glTexImage2D(')).toBe('QUADS_1');
    expect(ownerOf(o, 'glBufferSubData(')).toBe('TRIANGLES_1');
    expect(ownerOf(o, 'glRasterPos2f(')).toBe('TEXT_1');
    expect(ownerOf(o, 'glutBitmapCharacter(')).toBe('TEXT_1');
    const call = o.lines.findIndex((l) => l.text === '    draw_TRIANGLES_1();');
    expect(o.lines[call].object).toBeNull();
    expect(ownerOf(o, '// --- Texture setup ---')).toBeNull();
    expect(ownerOf(o, 'state_TRIANGLES_1.x += 0.10f;')).toBeNull();
    expect(ownerOf(o, 'glutMainLoop()')).toBeNull();
  });
});

describe('WB-CODE-05: Only lines that do something are explainable', () => {
  it('marks calls, declarations, state, branches and functions; never braces, blanks or comments', () => {
    const o = outlineCode(fullFixture().code);
    const explainable = (needle: string) => o.lines[lineOf(o, needle)].explainable;
    for (const yes of ['#include <GL/glew.h>', 'struct ObjectState {', 'ObjectState state_TEXT_1', 'GLfloat colors_QUADS_1[]',
      'GLuint cbo_TRIANGLES_1 = 0;', 'void draw_QUADS_1();', 'void draw_QUADS_1()', 'glTranslatef(state_QUADS_1.x', "case 'd':",
      'state_TRIANGLES_1.x += 0.10f;', 'stbi_load(', 'if (glewInit() != GLEW_OK) {', 'void onMouse(int button', '    draw();', 'int main(']) {
      expect(explainable(yes), yes).toBe(true);
    }
    for (const no of ['// --- Global State ---', '    // QUADS_1 — texture object', 'return 0;', 'int width, height, channels;']) {
      expect(explainable(no), no).toBe(false);
    }
    expect(o.lines.filter((l) => /^\s*[{}]\s*$/.test(l.text) || l.text.trim() === '').every((l) => !l.explainable)).toBe(true);
  });
});

describe('WB-CODE-06: Groups and hidden text own their inline segments in draw()', () => {
  it('gives the group its frame and its children\'s calls, and the guarded text its if block', () => {
    const o = outlineCode(groupFixture().code);
    const drawBlock = o.blocks.find((b) => b.kind === 'draw')!;
    const inDraw = o.lines.slice(drawBlock.start, drawBlock.end + 1);
    const groupLines = inDraw.filter((l) => l.object === 'Group_1').map((l) => l.text.trim());
    expect(groupLines).toContain('glTranslatef(state_Group_1.x, state_Group_1.y, 0.0f);');
    expect(groupLines).toContain('draw_TRIANGLES_1();');
    expect(groupLines).toContain('draw_QUADS_1();');
    const textLines = inDraw.filter((l) => l.object === 'TEXT_1').map((l) => l.text.trim());
    expect(textLines[0]).toBe('if (state_TEXT_1.visible) {');
    expect(textLines[textLines.length - 1]).toBe('}');
    expect(o.objects).toEqual(expect.arrayContaining(['Group_1', 'TEXT_1', 'TRIANGLES_1', 'QUADS_1']));
  });
});

describe('WB-CODE-07: Fold labels are names; summaries are plain sentences', () => {
  it('labels functions by signature and data blocks by name, and keeps the banned words out', () => {
    const o = outlineCode(fullFixture().code);
    const label = (id: string) => o.blocks.find((b) => b.id === id)!.label;
    expect(label('includes')).toBe('#include …');
    expect(label('struct')).toBe('struct ObjectState …');
    expect(label('main')).toBe('int main()');
    expect(label('draw:QUADS_1')).toBe('void draw_QUADS_1()');
    expect(label('handler:onKey')).toBe('void onKey()');
    expect(o.blocks.find((b) => b.id === 'main')!.summary).toBe('Opens the window, registers the callbacks and starts GLUT.');
    for (const b of o.blocks) {
      expect(b.summary.length, b.id).toBeGreaterThan(0);
      expect(b.summary).not.toMatch(/coming soon|not supported|future|deferred|\b3D\b|lighting/i);
    }
  });
});

describe('WB-CODE-08: The parser pins the generator formats it relies on', () => {
  it('reads CRLF text the same, and puts every marker line in the block that owns it', () => {
    const { code } = fullFixture();
    expect(outlineCode(code.replace(/\n/g, '\r\n')).blocks).toEqual(outlineCode(code).blocks);
    const o = outlineCode(code);
    const blockOf = (l: number) => o.blocks.find((b) => b.id === o.lines[l].block)!.kind;
    o.lines.forEach((l, i) => {
      if (/^void draw_\w+\(\)$/.test(l.text)) expect(blockOf(i)).toBe('draw-object');
      if (/^ObjectState state_/.test(l.text)) expect(blockOf(i)).toBe('state');
      if (/^GL(float|uint) (verts|colors|uvs|indices)_/.test(l.text)) expect(blockOf(i)).toBe('buffer-data');
      if (l.text.startsWith('    glutMainLoop')) expect(blockOf(i)).toBe('main');
      if (l.text.startsWith('    glGenTextures')) expect(blockOf(i)).toBe('init');
    });
  });
});

describe('WB-CODE-09: Sanitised names still own their lines', () => {
  it('matches "My Shape" as My_Shape and "class" as class_obj', () => {
    const shape = addTriangle();
    getState().updateObjectName(shape.id, 'My Shape');
    const other = addQuad(0.5, 0.5, 0.2);
    getState().updateObjectName(other.id, 'class');
    const o = outlineCode(program());
    expect(o.objects).toEqual(expect.arrayContaining(['My_Shape', 'class_obj']));
    expect(o.blocks.map((b) => b.id)).toEqual(expect.arrayContaining(['draw:My_Shape', 'draw:class_obj']));
    expect(ownerOf(o, 'ObjectState state_My_Shape')).toBe('My_Shape');
  });
});

describe('WB-CODE-10: findCallLine and stateFieldAt', () => {
  it('finds a call in the object\'s own code first, then anywhere; names the state field under a column', () => {
    const { code } = immediateFixture();
    const o = outlineCode(code);
    const translate = findCallLine(o, 'TRIANGLES_1', 'glTranslatef')!;
    expect(o.lines[translate].text).toContain('glTranslatef(state_TRIANGLES_1.x');
    expect(o.lines[findCallLine(o, 'TRIANGLES_1', 'glOrtho')!].text).toContain('glOrtho(');
    expect(findCallLine(o, null, 'glNothing')).toBeNull();
    const state = o.lines[lineOf(o, 'ObjectState state_TRIANGLES_1')].text;
    expect(stateFieldAt(state, state.indexOf('0.4000f'))).toBe('state_TRIANGLES_1.x');
    expect(stateFieldAt(state, state.indexOf('15.0000f'))).toBe('state_TRIANGLES_1.rotation');
    expect(stateFieldAt(state, 0)).toBeNull();
    expect(stateFieldAt('    glEnd();', 4)).toBeNull();
  });
});

void addPrimitive;
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/white-box/code-structure.test.ts`
Expected: FAIL with `Failed to resolve import "@/features/code-generation/model/code-outline"`.

- [ ] **Step 3: Write the outline module**

Create `src/features/code-generation/model/code-outline.ts`:

```ts
/**
 * Reads the generated program's text into blocks and lines, so the code panel can fold, mark and
 * explain it. Pure, and kept in step with generator/*: a format change it does not expect fails
 * the WB-CODE tests instead of breaking silently. The generator itself does not change.
 */

export type BlockKind =
  | 'includes' | 'struct' | 'state' | 'view' | 'buffer-data' | 'vbo-handles' | 'texture-handles'
  | 'declarations' | 'draw-object' | 'draw' | 'update-buffers' | 'display' | 'window-to-world'
  | 'handler' | 'init' | 'idle' | 'main';

export type LineKind =
  | 'include' | 'struct' | 'state' | 'view' | 'buffer-array' | 'handle' | 'declaration'
  | 'function' | 'branch' | 'assign' | 'call' | 'other';

export interface CodeBlock {
  /** Stable across edits: `main`, `draw:Triangle`, `handler:onKey`. */
  id: string;
  kind: BlockKind;
  /** What a folded block shows: its name only. */
  label: string;
  /** One plain sentence, shown when a folded row is hovered or focused. */
  summary: string;
  /** First and last line, 0-based and inclusive. The last includes the blank lines after the block. */
  start: number;
  end: number;
  /** A function's signature line and its closing brace; null for data blocks. */
  signature: number | null;
  close: number | null;
  /** The object a `draw_<name>()` function draws. */
  object: string | null;
}

export interface OutlineLine {
  text: string;
  /** Id of the block the line is in. */
  block: string;
  /** Code name of the object the line belongs to (`state_<name>`), or null for shared code. */
  object: string | null;
  kind: LineKind;
  explainable: boolean;
}

export interface CodeOutline {
  lines: OutlineLine[];
  blocks: CodeBlock[];
  /** Every object's code name, in the order of the state lines. */
  objects: string[];
}

type DataKind = 'includes' | 'struct' | 'state' | 'view' | 'buffer-data' | 'vbo-handles' | 'texture-handles' | 'declarations';

const DATA_LABELS: Record<DataKind, string> = {
  includes: '#include …',
  struct: 'struct ObjectState …',
  state: 'ObjectState …',
  view: 'View bounds …',
  'buffer-data': 'Buffer data …',
  'vbo-handles': 'VBO handles …',
  'texture-handles': 'Texture handles …',
  declarations: 'Declarations …',
};

const SUMMARIES: Record<Exclude<BlockKind, 'draw-object' | 'handler'>, string> = {
  includes: 'Loads OpenGL, GLUT and GLEW so the program can call them.',
  struct: 'Describes what every object keeps: its position, rotation and scale.',
  state: 'One line per object with its starting position, rotation and scale.',
  view: 'The viewing volume’s edges, kept in variables so the reshape callback can change them.',
  'buffer-data': 'Each object’s vertices, colours and indices as C arrays.',
  'vbo-handles': 'Names for the GPU buffers that init() creates.',
  'texture-handles': 'Names for the textures that init() loads.',
  declarations: 'Tells the compiler about functions defined further down.',
  draw: 'Calls each object’s draw function.',
  'update-buffers': 'Runs every frame to refresh the buffers that change.',
  display: 'Clears the window, sets up the view, draws the scene and shows the frame.',
  'window-to-world': 'Turns a mouse position in pixels into scene coordinates.',
  init: 'One-time setup before the main loop: uploads buffers and loads textures.',
  idle: 'Runs every frame: updates buffers, then calls your idle handler.',
  main: 'Opens the window, registers the callbacks and starts GLUT.',
};

/** Handler comments read `// <Label> callback: glut<Name>Func` (generator/handlers.ts). */
const HANDLER_SUMMARIES: Record<string, string> = {
  Keyboard: 'GLUT calls it when a key is pressed.',
  'Special keys': 'GLUT calls it when an arrow key is pressed.',
  Mouse: 'GLUT calls it when a mouse button goes down or up.',
  Motion: 'GLUT calls it when the mouse moves with a button held.',
  Reshape: 'GLUT calls it when the window changes size.',
  Idle: 'GLUT calls it whenever nothing else is happening, about once a frame.',
};

const SECTION_HEADERS: Array<[string, DataKind]> = [
  ['// --- View', 'view'],
  ['// --- Buffer Data ---', 'buffer-data'],
  ['// --- VBO Handles ---', 'vbo-handles'],
  ['// --- Texture Handles ---', 'texture-handles'],
];

const OWNER_REF = /\b(?:state|initial|verts|colors|uvs|indices|vbo|cbo|ebo|uvbo|tex)_(\w+)/;
const STATE_REF = /\bstate_(\w+)\./;
const SETUP_HEADER = /^ {4}\/\/ .+ — /;
const DECLARATION = /^void \w+\(\);$/;
const STATE_LINE = /^(const )?ObjectState /;

function functionKind(name: string): BlockKind {
  if (name.startsWith('draw_')) return 'draw-object';
  switch (name) {
    case 'draw': return 'draw';
    case 'update_buffers': return 'update-buffers';
    case 'display': return 'display';
    case 'windowToWorld': return 'window-to-world';
    case 'init': return 'init';
    case '_vams_idle': return 'idle';
    case 'main': return 'main';
    default: return 'handler';
  }
}

function dataBlock(kind: DataKind, start: number, end: number): CodeBlock {
  return { id: kind, kind, label: DATA_LABELS[kind], summary: SUMMARIES[kind], start, end, signature: null, close: null, object: null };
}

function functionBlock(text: string[], ret: string, name: string, start: number, signature: number, close: number): CodeBlock {
  const kind = functionKind(name);
  const object = kind === 'draw-object' ? name.slice('draw_'.length) : null;
  const id = kind === 'draw-object' ? `draw:${object}` : kind === 'handler' ? `handler:${name}` : kind;
  let summary: string;
  if (kind === 'draw-object') summary = `Draws ${object}: moves it into place, then sends its vertices.`;
  else if (kind === 'handler') {
    const label = /^\/\/ (.+) callback:/.exec(signature > start ? text[start] : '')?.[1] ?? '';
    summary = HANDLER_SUMMARIES[label] ?? 'GLUT calls it when its event happens.';
  } else summary = SUMMARIES[kind as Exclude<BlockKind, 'draw-object' | 'handler'>];
  return { id, kind, label: `${ret} ${name}()`, summary, start, end: close, signature, close, object };
}

/** The last line of the run starting at `from` whose lines all pass `test`. */
function runEnd(text: string[], from: number, test: (line: string) => boolean): number {
  let k = from;
  while (k + 1 < text.length && test(text[k + 1])) k += 1;
  return k;
}

/** The first line from `from` that passes `test`, or the last line. */
function firstFrom(text: string[], from: number, test: (line: string) => boolean): number {
  let k = from;
  while (k < text.length - 1 && !test(text[k])) k += 1;
  return k;
}

function splitBlocks(text: string[]): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  let i = 0;
  const stateHeader = text.indexOf('// --- Global State ---');
  if (stateHeader > 0) {
    blocks.push(dataBlock('includes', 0, stateHeader - 1));
    i = stateHeader;
  }
  while (i < text.length) {
    const line = text[i];
    const last = blocks[blocks.length - 1];
    // Blank lines belong to the block before them.
    if (line === '' && last) {
      last.end = i;
      i += 1;
      continue;
    }
    let block: CodeBlock | null = null;
    const header = SECTION_HEADERS.find(([prefix]) => line.startsWith(prefix));
    if (line === '// --- Global State ---') {
      block = dataBlock('struct', i, firstFrom(text, i, (l) => l === '};'));
    } else if (STATE_LINE.test(line)) {
      block = dataBlock('state', i, runEnd(text, i, (l) => STATE_LINE.test(l)));
    } else if (header) {
      block = dataBlock(header[1], i, runEnd(text, i, (l) => l !== ''));
    } else if (DECLARATION.test(line)) {
      block = dataBlock('declarations', i, runEnd(text, i, (l) => DECLARATION.test(l)));
    } else {
      let signature = i;
      while (signature < text.length && text[signature].startsWith('//')) signature += 1;
      const m = signature < text.length ? /^(void|int) (\w+)\(/.exec(text[signature]) : null;
      if (m) block = functionBlock(text, m[1], m[2], i, signature, firstFrom(text, signature, (l) => l === '}'));
    }
    if (block) {
      blocks.push(block);
      i = block.end + 1;
      continue;
    }
    // A line the parser does not know joins the block before it.
    if (last) last.end = i;
    else blocks.push(dataBlock('includes', 0, i));
    i += 1;
  }
  return blocks;
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/** The object each line of a block belongs to. */
function owners(block: CodeBlock, text: string[]): (string | null)[] {
  const out: (string | null)[] = new Array(block.end - block.start + 1).fill(null);
  const set = (line: number, owner: string | null) => { out[line - block.start] = owner; };
  switch (block.kind) {
    case 'state':
    case 'buffer-data':
    case 'vbo-handles':
    case 'texture-handles':
      for (let l = block.start; l <= block.end; l++) set(l, OWNER_REF.exec(text[l])?.[1] ?? null);
      break;
    case 'draw-object':
      for (let l = block.start; l <= block.end; l++) set(l, block.object);
      break;
    case 'draw': {
      // Groups and text are drawn inline, between `// <name>` and glPopMatrix, or inside `if (state_X.visible) { … }`.
      for (let l = block.signature! + 2; l < block.close!; l++) {
        const trimmed = text[l].trim();
        const guarded = /^if \(state_(\w+)\.visible\) \{$/.exec(trimmed);
        const opens = trimmed.startsWith('// ') && text[l + 1]?.trim() === 'glPushMatrix();';
        if (!guarded && !opens) continue;
        const indent = indentOf(text[l]);
        const last = guarded
          ? firstFrom(text, l + 1, (t) => t === `${' '.repeat(indent)}}`)
          : firstFrom(text, l + 1, (t) => t.trim() === 'glPopMatrix();' && indentOf(t) === indent);
        let owner = guarded ? guarded[1] : null;
        for (let k = l; k <= last && !owner; k++) owner = STATE_REF.exec(text[k])?.[1] ?? null;
        for (let k = l; k <= last; k++) set(k, owner);
        l = last;
      }
      break;
    }
    case 'init':
    case 'update-buffers': {
      // Each object's setup starts with `    // <name> — …` and runs to a blank line or the next one.
      for (let l = block.signature! + 2; l < block.close!; l++) {
        if (!SETUP_HEADER.test(text[l])) continue;
        let last = l;
        while (last + 1 < block.close! && text[last + 1] !== '' && !SETUP_HEADER.test(text[last + 1])) last += 1;
        let owner: string | null = null;
        for (let k = l + 1; k <= last && !owner; k++) owner = OWNER_REF.exec(text[k])?.[1] ?? null;
        for (let k = l; k <= last; k++) set(k, owner);
        l = last;
      }
      break;
    }
    default:
      break;
  }
  return out;
}

const OWN_CALL = /^(?:if \(state_\w+\.visible\) )?[A-Za-z_]\w*\([^;]*\);$/;

function lineKind(raw: string): LineKind {
  const t = raw.trim();
  if (t === '' || t.startsWith('//') || /^[{}]+;?$/.test(t)) return 'other';
  if (t.startsWith('#')) return 'include';
  if (t.startsWith('struct ObjectState')) return 'struct';
  if (/^(const )?ObjectState \w+ = /.test(t)) return 'state';
  if (t.startsWith('float viewMinX')) return 'view';
  if (/^GL(float|uint) (verts|colors|uvs|indices)_\w+\[\] = /.test(t)) return 'buffer-array';
  if (/^GLuint (vbo|cbo|ebo|uvbo|tex)_\w+ = 0;$/.test(t)) return 'handle';
  if (DECLARATION.test(t)) return 'declaration';
  if (/^(void|int) \w+\(.*\)$/.test(t)) return 'function';
  if (/^case .+:$/.test(t) || t.startsWith('if (button == ')) return 'branch';
  if (/^state_\w+(\.\w+)? [+*]?= /.test(t) || t.startsWith('glewExperimental')) return 'assign';
  if (/\b(gl[A-Z]\w*|glut[A-Z]\w*|glew[A-Z]\w*|stbi_\w+)\s*\(/.test(t)) return 'call';
  if (OWN_CALL.test(t) && !t.startsWith('return')) return 'call';
  return 'other';
}

export function outlineCode(code: string): CodeOutline {
  const text = code.replace(/\r\n/g, '\n').split('\n');
  const blocks = splitBlocks(text);
  const lines: OutlineLine[] = [];
  for (const block of blocks) {
    const owned = owners(block, text);
    for (let l = block.start; l <= block.end; l++) {
      const kind = lineKind(text[l]);
      lines.push({ text: text[l], block: block.id, object: owned[l - block.start], kind, explainable: kind !== 'other' });
    }
  }
  const objects = lines
    .filter((l) => l.kind === 'state' && l.text.startsWith('ObjectState '))
    .map((l) => l.object)
    .filter((o): o is string => o !== null);
  return { lines, blocks, objects };
}

export function findCallLine(outline: CodeOutline, object: string | null, call: string): number | null {
  const calls = (l: OutlineLine) => l.text.includes(`${call}(`);
  if (object !== null) {
    const own = outline.lines.findIndex((l) => l.object === object && calls(l));
    if (own >= 0) return own;
  }
  const any = outline.lines.findIndex(calls);
  return any >= 0 ? any : null;
}

/** The ObjectState fields in initialiser order (generator/state.ts). */
const STATE_FIELDS = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'r', 'g', 'b', 'useColor', 'visible'];

export function stateFieldAt(text: string, column: number): string | null {
  const m = /^(?:const )?ObjectState (?:state|initial)_(\w+) = \{/.exec(text);
  if (!m) return null;
  const open = text.indexOf('{');
  if (column <= open) return null;
  const before = text.slice(open + 1, column);
  const field = STATE_FIELDS[(before.match(/,/g) ?? []).length];
  return field ? `state_${m[1]}.${field}` : null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/white-box/code-structure.test.ts`
Expected: PASS (10 tests). If WB-CODE-06 fails on the group's lines, print the program (`console.log(groupFixture().code)`) and compare it with the inline-segment rule in `owners()`. Fix the parser, not the test.

- [ ] **Step 5: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/features/code-generation/model/code-outline.ts tests/white-box/code-structure.test.ts
git diff --staged
git commit -m "feat(code): outline the generated program into blocks, owners and explainable lines"
```

---

### Task 3: Which rows show

**Files:**
- Create: `src/shared/ui/code-viewer/types.ts`
- Create: `src/features/code-generation/model/code-folds.ts`
- Modify: `tests/white-box/code-structure.test.ts` (append)

**Interfaces:**
- Consumes: `CodeOutline` and `CodeBlock` from Task 2.
- Produces, in `src/shared/ui/code-viewer/types.ts`:

```ts
export type CodeRow =
  | { kind: 'line'; line: number; closes?: { block: string; label: string } }
  | { kind: 'fold'; block: string; label: string; summary: string; start: number; end: number }
  | { kind: 'more'; block: string; label: string; start: number; end: number };
```

- Produces, in `code-folds.ts`:

```ts
export function visibleRows(outline: CodeOutline, selection: string | null, opened: readonly string[], forced: readonly number[]): CodeRow[];
```

- Rules (spec §2, "Outline and folding"):
  - **Opened by hand:** a block in `opened` shows every line, and its first row carries `closes`.
  - **Forced:** a block containing a `forced` line shows every line.
  - **Something selected:** lines owned by the selection show in `state`, `buffer-data`, `draw-object`, `draw` and `init` blocks.
  - **Nothing selected:** every owned line shows in `state`, `buffer-data`, `draw-object` and `draw`.
  - **Partly open blocks** keep a frame: a function keeps its comment, signature and `{`, plus its `}` and the blank lines after it; a data block keeps its trailing blank lines. Each run of hidden lines becomes one `more` row, labelled "N more object(s)" when the run holds other objects' lines, else "N more line(s)".
  - **No shown lines:** the block is one `fold` row.

- [ ] **Step 1: Write the failing tests**

Append to `tests/white-box/code-structure.test.ts`:

```ts
import { visibleRows } from '@/features/code-generation/model/code-folds';
import type { CodeRow } from '@/shared/ui/code-viewer/types';

/** Three shapes, the mock's scene: Triangle selected, Square and Dot folded. */
function threeShapes() {
  const tri = addTriangle(0.4, -0.17, 0.5);
  getState().updateObjectName(tri.id, 'Triangle');
  const square = addQuad(-0.5, 0.5, 0.2);
  getState().updateObjectName(square.id, 'Square');
  const dot = addPrimitive('POINTS', [{ x: 0.6, y: 0.6 }]);
  getState().updateObjectName(dot.id, 'Dot');
  return { tri, square, dot, outline: outlineCode(program()) };
}
const shownText = (o: CodeOutline, rows: CodeRow[]) =>
  rows.filter((r): r is Extract<CodeRow, { kind: 'line' }> => r.kind === 'line').map((r) => o.lines[r.line].text);
const folds = (rows: CodeRow[]) => rows.filter((r) => r.kind !== 'line').map((r) => (r as { label: string }).label);

describe('WB-CODE-11: With a shape selected, its code is open and the rest folds', () => {
  it('opens its state line and draw function, folds the others to names, and summarises the other state lines', () => {
    const { outline } = threeShapes();
    const rows = visibleRows(outline, 'Triangle', [], []);
    const shown = shownText(outline, rows);
    expect(shown).toContain('void draw_Triangle()');
    expect(shown.some((t) => t.startsWith('ObjectState state_Triangle'))).toBe(true);
    expect(shown.some((t) => t.startsWith('ObjectState state_Square'))).toBe(false);
    expect(folds(rows)).toEqual(expect.arrayContaining(['#include …', 'struct ObjectState …', 'void draw_Square()', 'void draw_Dot()', 'void display()', 'void init()', 'int main()', '2 more objects']));
    const fold = rows.find((r) => r.kind === 'fold' && r.label === 'int main()') as Extract<CodeRow, { kind: 'fold' }>;
    expect(fold.summary).toBe('Opens the window, registers the callbacks and starts GLUT.');
    expect(outline.lines[fold.start].text).toBe('int main(int argc, char** argv)');
  });
});

describe('WB-CODE-12: With nothing selected, every object\'s code is open and only the boilerplate folds', () => {
  it('opens all draw functions and state lines; folds includes, struct, declarations, display, init and main', () => {
    const { outline } = threeShapes();
    const rows = visibleRows(outline, null, [], []);
    const shown = shownText(outline, rows);
    for (const name of ['Triangle', 'Square', 'Dot']) expect(shown).toContain(`void draw_${name}()`);
    expect(folds(rows)).toEqual(expect.arrayContaining(['#include …', 'struct ObjectState …', 'Declarations …', 'void display()', 'void init()', 'int main()']));
    expect(folds(rows)).not.toContain('2 more objects');
  });
});

describe('WB-CODE-13: A forced line opens its block; a block opened by hand can be closed', () => {
  it('opens main for a forced line, and marks the first row of a hand-opened block', () => {
    const { outline } = threeShapes();
    const clear = outline.lines.findIndex((l) => l.text.includes('glClearColor('));
    const forced = visibleRows(outline, 'Triangle', [], [clear]);
    expect(shownText(outline, forced)).toContain(outline.lines[clear].text);
    expect(folds(forced)).not.toContain('int main()');
    const opened = visibleRows(outline, 'Triangle', ['draw:Square'], []);
    const first = opened.find((r) => r.kind === 'line' && r.closes) as Extract<CodeRow, { kind: 'line' }>;
    expect(first.closes).toEqual({ block: 'draw:Square', label: 'void draw_Square()' });
    expect(outline.lines[first.line].text).toBe('void draw_Square()');
  });
});

describe('WB-CODE-14: init() opens only the selected object\'s setup', () => {
  it('shows the frame and the VBO upload lines, and summarises the rest', () => {
    const { tri, outline: before } = threeShapes();
    void before;
    getState().updateRenderingMode(tri.id, 'VBO');
    const outline = outlineCode(program());
    const rows = visibleRows(outline, 'Triangle', [], []);
    const shown = shownText(outline, rows);
    expect(shown).toContain('void init()');
    expect(shown).toContain('    glGenBuffers(1, &vbo_Triangle);');
    expect(folds(rows)).not.toContain('void init()');
  });
});

describe('WB-CODE-15: Rows cover every line once, in program order', () => {
  it('leaves no line out and repeats none, for every selection', () => {
    const { outline } = threeShapes();
    for (const selection of [null, 'Triangle', 'Square', 'Dot']) {
      const covered: number[] = [];
      for (const r of visibleRows(outline, selection, [], [])) {
        if (r.kind === 'line') covered.push(r.line);
        else for (let l = r.start; l <= r.end; l++) covered.push(l);
      }
      expect(covered).toEqual(outline.lines.map((_, i) => i));
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/white-box/code-structure.test.ts`
Expected: FAIL with `Failed to resolve import "@/features/code-generation/model/code-folds"`.

- [ ] **Step 3: Write the shared row type**

Create `src/shared/ui/code-viewer/types.ts`:

```ts
/** One row of the code panel: a real line, a folded block, or the hidden rest of a partly open block. */
export type CodeRow =
  | { kind: 'line'; line: number; closes?: { block: string; label: string } }
  | { kind: 'fold'; block: string; label: string; summary: string; start: number; end: number }
  | { kind: 'more'; block: string; label: string; start: number; end: number };
```

- [ ] **Step 4: Write the folding module**

Create `src/features/code-generation/model/code-folds.ts`:

```ts
import type { CodeRow } from '@/shared/ui/code-viewer/types';
import type { BlockKind, CodeBlock, CodeOutline } from './code-outline';

/** Blocks that open for the selected object's lines. */
const OPEN_FOR_SELECTION: ReadonlySet<BlockKind> = new Set(['state', 'buffer-data', 'draw-object', 'draw', 'init']);
/** With nothing selected, every object's code opens and only the boilerplate folds. */
const OPEN_FOR_NOTHING: ReadonlySet<BlockKind> = new Set(['state', 'buffer-data', 'draw-object', 'draw']);

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** The lines a partly open block keeps around the object's lines, so it still reads as code. */
function frameLines(block: CodeBlock, outline: CodeOutline): number[] {
  if (block.signature !== null && block.close !== null) {
    return [...range(block.start, block.signature + 1), ...range(block.close, block.end)];
  }
  const blanks: number[] = [];
  for (let l = block.end; l >= block.start && outline.lines[l].text === ''; l--) blanks.push(l);
  return blanks;
}

function moreLabel(hidden: number[], outline: CodeOutline): string {
  const others = new Set(hidden.map((l) => outline.lines[l].object).filter((o): o is string => o !== null));
  if (others.size > 0) return `${others.size} more object${others.size === 1 ? '' : 's'}`;
  return `${hidden.length} more line${hidden.length === 1 ? '' : 's'}`;
}

/**
 * The rows the code panel shows. `selection` is the selected object's code name, `opened` the
 * blocks the student opened by hand, and `forced` lines that must show: a lesson's highlighted
 * lines, changed values, Find's current match, Run's fired branch and the explained line.
 */
export function visibleRows(
  outline: CodeOutline,
  selection: string | null,
  opened: readonly string[],
  forced: readonly number[],
): CodeRow[] {
  const rows: CodeRow[] = [];
  const forcedLines = new Set(forced);
  const openKinds = selection === null ? OPEN_FOR_NOTHING : OPEN_FOR_SELECTION;
  for (const block of outline.blocks) {
    const all = range(block.start, block.end);
    if (opened.includes(block.id)) {
      all.forEach((line, k) => rows.push(k === 0 ? { kind: 'line', line, closes: { block: block.id, label: block.label } } : { kind: 'line', line }));
      continue;
    }
    if (all.some((line) => forcedLines.has(line))) {
      all.forEach((line) => rows.push({ kind: 'line', line }));
      continue;
    }
    const shown = openKinds.has(block.kind)
      ? all.filter((line) => {
          const owner = outline.lines[line].object;
          return owner !== null && (selection === null || owner === selection);
        })
      : [];
    if (shown.length === 0) {
      rows.push({ kind: 'fold', block: block.id, label: block.label, summary: block.summary, start: block.start, end: block.end });
      continue;
    }
    const visible = new Set([...shown, ...frameLines(block, outline)]);
    for (let k = 0; k < all.length; ) {
      if (visible.has(all[k])) {
        rows.push({ kind: 'line', line: all[k] });
        k += 1;
        continue;
      }
      let e = k;
      while (e + 1 < all.length && !visible.has(all[e + 1])) e += 1;
      const hidden = all.slice(k, e + 1);
      rows.push({ kind: 'more', block: block.id, label: moreLabel(hidden, outline), start: hidden[0], end: hidden[hidden.length - 1] });
      k = e + 1;
    }
  }
  return rows;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/white-box/code-structure.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 6: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/shared/ui/code-viewer/types.ts src/features/code-generation/model/code-folds.ts tests/white-box/code-structure.test.ts
git diff --staged
git commit -m "feat(code): fold the program to the selected object's code"
```

---

### Task 4: Find the value that changed

**Files:**
- Create: `src/shared/ui/code-viewer/tokenize.ts` (move `tokenizeLine` out of `CodeViewer.tsx` unchanged)
- Modify: `src/shared/ui/code-viewer/CodeViewer.tsx` (import `tokenizeLine` from `./tokenize`; delete its local copy and `KEYWORDS` / `GL_PREFIXES`)
- Modify: `src/shared/ui/code-viewer/types.ts` (add `CodeMark`)
- Modify: `src/features/code-generation/model/code-diff.ts` (add `matchLines`; `diffChangedLines` uses it)
- Create: `src/features/code-generation/model/value-diff.ts`
- Modify: `tests/white-box/code-structure.test.ts` (append)

**Interfaces:**
- Produces: `export interface CodeMark { line: number; start: number; end: number }` in `types.ts`. Columns are 0-based within the line; `end` is exclusive.
- Produces: `export function tokenizeLine(line: string): Array<{ t: string; k: string }>` in `tokenize.ts`.
- Produces: `export function matchLines(a: readonly string[], b: readonly string[]): Array<[number, number]>` in `code-diff.ts`. These are the LCS-matched line pairs, ascending.
- Produces: `export function diffChangedValues(prev: string, next: string): CodeMark[]` in `value-diff.ts`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/white-box/code-structure.test.ts`:

```ts
import { diffChangedValues } from '@/features/code-generation/model/value-diff';
import { diffChangedLines, matchLines } from '@/features/code-generation/model/code-diff';

const markedText = (code: string, marks: { line: number; start: number; end: number }[]) =>
  marks.map((m) => code.split('\n')[m.line].slice(m.start, m.end));

describe('WB-CODE-16: One changed number marks one token', () => {
  it('marks only the new X on the state line, and a sign change as one token', () => {
    const tri = addTriangle(0.3, -0.17, 0.5);
    const before = program();
    getState().updateObjectTransform(tri.id, { translateX: 0.4 });
    const after = program();
    const marks = diffChangedValues(before, after);
    expect(markedText(after, marks)).toEqual(['0.4000f']);
    expect(after.split('\n')[marks[0].line]).toMatch(/^ObjectState state_TRIANGLES_1/);
    getState().updateObjectTransform(tri.id, { translateX: -0.1 });
    expect(markedText(program(), diffChangedValues(after, program()))).toEqual(['-0.1000f']);
  });
});

describe('WB-CODE-17: Moving a vertex marks its coordinates only', () => {
  it('marks the two numbers of the moved glVertex2f', () => {
    const tri = addTriangle(0, 0, 0.5);
    const before = program();
    const v = getState().objects[0].vertices[0];
    getState().updateVertexPosition(tri.id, v.id, 0.25, -0.75);
    const after = program();
    expect(markedText(after, diffChangedValues(before, after))).toEqual(['0.2500f', '-0.7500f']);
  });
});

describe('WB-CODE-18: A line with no counterpart is marked whole', () => {
  it('marks every line of an added object from its first non-space character', () => {
    addTriangle(0, 0, 0.5);
    const before = program();
    addQuad(0.5, 0.5, 0.2);
    const after = program();
    const marks = diffChangedValues(before, after);
    const lines = after.split('\n');
    for (const m of marks) {
      expect(m.start).toBe(lines[m.line].search(/\S/));
      expect(m.end).toBe(lines[m.line].length);
    }
    expect([...new Set(marks.map((m) => m.line))]).toEqual(diffChangedLines(before, after).filter((l) => lines[l].trim() !== ''));
  });
});

describe('WB-CODE-19: An identical program marks nothing; matchLines keeps diffChangedLines the same', () => {
  it('returns no marks, and the matched pairs leave exactly the changed lines', () => {
    addTriangle();
    const code = program();
    expect(diffChangedValues(code, code)).toEqual([]);
    const a = ['x', 'a', 'b', 'c', 'y'];
    const b = ['x', 'a', 'B', 'c', 'd', 'y'];
    expect(matchLines(a, b)).toEqual([[0, 0], [1, 1], [3, 3], [4, 5]]);
    expect(diffChangedLines(a.join('\n'), b.join('\n'))).toEqual([2, 4]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/white-box/code-structure.test.ts`
Expected: FAIL with `Failed to resolve import "@/features/code-generation/model/value-diff"`.

- [ ] **Step 3: Move the tokenizer**

1. Create `src/shared/ui/code-viewer/tokenize.ts`.
2. Move `KEYWORDS`, `GL_PREFIXES` and `tokenizeLine` from `CodeViewer.tsx` into it, unchanged except that `tokenizeLine` gains `export`.
3. Put this comment at the top:

```ts
/** Splits one line of generated C++ into tokens. The code panel colours them; the value diff compares them. */
```

4. In `CodeViewer.tsx`, delete the moved declarations and add `import { tokenizeLine } from './tokenize';`.

- [ ] **Step 4: Add `CodeMark`**

Append to `src/shared/ui/code-viewer/types.ts`:

```ts
/** A marked range in one line: the value that just changed, or a Find match. `end` is exclusive. */
export interface CodeMark {
  line: number;
  start: number;
  end: number;
}
```

- [ ] **Step 5: Add `matchLines` and route `diffChangedLines` through it**

In `src/features/code-generation/model/code-diff.ts`, replace the body of `diffChangedLines` and add `matchLines` above it:

```ts
/**
 * The pairs of lines `a` and `b` share, by longest common subsequence after trimming the common
 * prefix and suffix. Ascending in both. The backtrack's tie-break is the one diffChangedLines has
 * always used, so its results do not change.
 */
export function matchLines(a: readonly string[], b: readonly string[]): Array<[number, number]> {
  let prefixLen = 0;
  const minLen = Math.min(a.length, b.length);
  while (prefixLen < minLen && a[prefixLen] === b[prefixLen]) prefixLen++;
  let suffixLen = 0;
  while (
    suffixLen < a.length - prefixLen &&
    suffixLen < b.length - prefixLen &&
    a[a.length - 1 - suffixLen] === b[b.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }
  const aMid = a.slice(prefixLen, a.length - suffixLen);
  const bMid = b.slice(prefixLen, b.length - suffixLen);
  const m = aMid.length;
  const n = bMid.length;
  const lcs: number[][] = [];
  for (let i = 0; i <= m; i++) lcs.push(new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (aMid[i - 1] === bMid[j - 1]) lcs[i][j] = lcs[i - 1][j - 1] + 1;
      else lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
    }
  }
  const middle: Array<[number, number]> = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (aMid[i - 1] === bMid[j - 1]) {
      middle.push([prefixLen + i - 1, prefixLen + j - 1]);
      i--;
      j--;
    } else if (lcs[i - 1][j] > lcs[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  const pairs: Array<[number, number]> = [];
  for (let k = 0; k < prefixLen; k++) pairs.push([k, k]);
  pairs.push(...middle.reverse());
  for (let k = 0; k < suffixLen; k++) pairs.push([a.length - suffixLen + k, b.length - suffixLen + k]);
  return pairs;
}

export function diffChangedLines(prev: string, next: string): number[] {
  if (prev === next) return [];
  const a = prev.split('\n');
  const b = next.split('\n');
  const matched = new Set(matchLines(a, b).map(([, j]) => j));
  return b.map((_, j) => j).filter((j) => !matched.has(j));
}
```

Keep the existing doc comment above `diffChangedLines`. The rest of the file (`findLinesByMatch`, `CodeChangeFocus` and `resolveChangedLines`) stays unchanged.

- [ ] **Step 6: Write the value diff**

Create `src/features/code-generation/model/value-diff.ts`:

```ts
import { tokenizeLine } from '@/shared/ui/code-viewer/tokenize';
import type { CodeMark } from '@/shared/ui/code-viewer/types';
import { matchLines } from './code-diff';

interface Piece {
  text: string;
  start: number;
}

/** The viewer's tokens, with a minus sign kept on the number it negates, so 0.30 → −0.10 is one change. */
function pieces(line: string): Piece[] {
  const tokens = tokenizeLine(line);
  const out: Piece[] = [];
  let pos = 0;
  let previous = '';
  for (let k = 0; k < tokens.length; k++) {
    const token = tokens[k];
    const next = tokens[k + 1];
    if (token.t === '-' && token.k === 'op' && next?.k === 'num' && (previous === '' || /^[,({=]$/.test(previous))) {
      out.push({ text: token.t + next.t, start: pos });
      pos += token.t.length + next.t.length;
      previous = next.t;
      k += 1;
      continue;
    }
    out.push({ text: token.t, start: pos });
    pos += token.t.length;
    if (token.k !== 'ws') previous = token.t;
  }
  return out;
}

function lineMarks(old: string | undefined, line: string, index: number): CodeMark[] {
  const whole = (): CodeMark[] => {
    const start = line.search(/\S/);
    return start < 0 ? [] : [{ line: index, start, end: line.length }];
  };
  if (old === undefined) return whole();
  const before = pieces(old);
  const after = pieces(line);
  if (before.length !== after.length) return whole();
  const marks = after
    .filter((piece, k) => piece.text !== before[k].text)
    .map((piece) => ({ line: index, start: piece.start, end: piece.start + piece.text.length }));
  return marks.length > 0 ? marks : whole();
}

/**
 * What changed between two programs, as ranges in `next`. A changed line is compared with the
 * old line it replaced, token by token, and only the differing tokens are marked; a line with no
 * counterpart (an added object, say) is marked whole.
 */
export function diffChangedValues(prev: string, next: string): CodeMark[] {
  if (prev === next) return [];
  const a = prev.replace(/\r\n/g, '\n').split('\n');
  const b = next.replace(/\r\n/g, '\n').split('\n');
  const marks: CodeMark[] = [];
  let ai = 0;
  let bi = 0;
  for (const [ma, mb] of [...matchLines(a, b), [a.length, b.length] as [number, number]]) {
    for (let k = 0; bi + k < mb; k++) {
      marks.push(...lineMarks(ai + k < ma ? a[ai + k] : undefined, b[bi + k], bi + k));
    }
    ai = ma + 1;
    bi = mb + 1;
  }
  return marks;
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/white-box/code-structure.test.ts tests/black-box/lesson-engine.test.ts tests/black-box/first-visit-tour.test.ts`
Expected: PASS. The lesson-engine and tour suites guard `diffChangedLines`'s unchanged behaviour.

- [ ] **Step 8: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/shared/ui/code-viewer/tokenize.ts src/shared/ui/code-viewer/CodeViewer.tsx src/shared/ui/code-viewer/types.ts src/features/code-generation/model/code-diff.ts src/features/code-generation/model/value-diff.ts tests/white-box/code-structure.test.ts
git diff --staged
git commit -m "feat(code): find the values that changed between two programs"
```

---
### Task 5: The calm code viewer

**Files:**
- Modify: `src/shared/styles/_tokens.scss`
- Rewrite: `src/shared/ui/code-viewer/CodeViewer.tsx`
- Rewrite: `src/shared/ui/code-viewer/code-viewer.scss`
- Modify: `src/features/code-generation/ui/SceneCodePanel.tsx` (stop passing the three props the new viewer drops, so the build passes; Task 6 rewrites this file)
- Modify: `tests/black-box/code-panel.test.ts` (append)

**Interfaces:**
- Consumes: `CodeRow` and `CodeMark` from `./types` (Tasks 3–4), and `tokenizeLine` from `./tokenize` (Task 4).
- Produces: the default export `CodeViewer`, with these props (Task 6 passes them; Task 14 adds the strip and notes):

```ts
export interface CodeViewerProps {
  code: string;
  rows?: readonly CodeRow[];
  onToggleFold?: (block: string) => void;
  marks?: readonly CodeMark[];
  marksKey?: number;
  revealLines?: readonly number[];
  firedLines?: readonly number[];
  onFindLine?: (line: number | null) => void;
  isLessonMode?: boolean;
  headerLead?: ComponentChildren;
  headerTrail?: ComponentChildren;
}
```

- Produces: the exported `lineSegments(text, overlays)`, which splits a line's tokens at mark and match edges.
- Produces these DOM hooks for tests:
  - `.code-line` with `data-line`, plus `.is-changed` and `.is-fired`
  - `.code-line__num` and `.code-line__text`
  - `.code-fold`: a button with `aria-expanded="false"` and `aria-describedby` pointing at its `role="tooltip"` summary
  - `.code-fold__label`
  - `.code-fold-close`
  - `.code-value` (a changed value)
  - `.code-find` and `.code-find.is-current`
  - `.code-word` (the header's plain-word buttons Find and Copy)
  - `.code-search`, `.code-search__count`

The look is the mock's "Calm A" column. Mapped values:

| Element | Mock | Here |
| --- | --- | --- |
| Panel | `background: var(--paper)` | `var(--paper)` (was `--code-bg`) |
| Header | 36 px tall, padding 0 10 px, gap 8 px, 1 px `--rule` under | same |
| Header words | 11.5 px, `--faint`; on or hover → `--ink` | `--text-xs`, `--ink-faint` → `--ink` |
| Code | 12 px / 1.8 mono, padding 8 px 0 | `--text-sm` / 1.8, `$font-mono` |
| Line number | inline, 30 px wide, right-aligned, 14 px gap, `--dimmer` | same box, `--line-number` |
| GL and GLUT calls | `--accent-text` | `--code-fn` |
| Comments | `--dim` | `--ink-dim` |
| Everything else | ink | `--code-ink` |
| Fold row | `--faint`, arrow `▸ ` in `--dimmer` | `--ink-faint`, arrow `--ink-dim` (lifted) |
| Changed value | `--amber` on `rgba(251,191,119,.16)`, radius 2 px | `--value` on `--value-wash`, fading over 2 s |
| Changed line number | `--amber` | `--value` |

- [ ] **Step 1: Write the failing tests**

Append to `tests/black-box/code-panel.test.ts`, merging the new imports into the file's import block:

```ts
import { readFileSync } from 'node:fs';
import { vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import CodeViewer, { lineSegments } from '@/shared/ui/code-viewer/CodeViewer';
import type { CodeRow } from '@/shared/ui/code-viewer/types';

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
function key(target: EventTarget, k: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}
function typeInto(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

const SMALL = ['int main(int argc, char** argv)', '{', '    glutInit(&argc, argv);', '    glutMainLoop();', '}'].join('\n');

describe('BB-CODE-03: A folded block shows its name, its real line number and its summary', () => {
  it('renders a fold button that opens on click, and a ▾ that closes a block opened by hand', async () => {
    const onToggleFold = vi.fn();
    const fold: CodeRow = { kind: 'fold', block: 'main', label: 'int main()', summary: 'Opens the window, registers the callbacks and starts GLUT.', start: 0, end: 4 };
    const host = mount(h(CodeViewer, { code: SMALL, rows: [fold], onToggleFold }));
    await settle();
    const button = host.querySelector('.code-fold') as HTMLButtonElement;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.querySelector('.code-line__num')!.textContent).toBe('1');
    expect(button.querySelector('.code-fold__label')!.textContent).toBe('int main()');
    const tip = document.getElementById(button.getAttribute('aria-describedby')!)!;
    expect(tip.getAttribute('role')).toBe('tooltip');
    expect(tip.textContent).toBe(fold.summary);
    button.click();
    expect(onToggleFold).toHaveBeenCalledWith('main');
    const open: CodeRow[] = [0, 1, 2, 3, 4].map((line) =>
      line === 0 ? { kind: 'line', line, closes: { block: 'main', label: 'int main()' } } : { kind: 'line', line });
    render(h(CodeViewer, { code: SMALL, rows: open, onToggleFold }), host);
    await settle();
    expect(host.querySelectorAll('.code-line')).toHaveLength(5);
    const close = host.querySelector('.code-fold-close') as HTMLButtonElement;
    expect(close.getAttribute('aria-label')).toBe('Fold int main()');
    close.click();
    expect(onToggleFold).toHaveBeenLastCalledWith('main');
    unmount(host);
  });
});

describe('BB-CODE-04: A changed value is marked by itself, and its fade restarts on the next edit', () => {
  it('wraps only the value, colours its line number, and replaces the mark when marksKey changes', async () => {
    const code = 'ObjectState state_T = { 0.4000f, -0.1700f, 15.0000f, 1.0000f, 1.0000f };';
    const start = code.indexOf('0.4000f');
    const marks = [{ line: 0, start, end: start + 7 }];
    const host = mount(h(CodeViewer, { code, marks, marksKey: 1 }));
    await settle();
    expect([...host.querySelectorAll('.code-value')].map((el) => el.textContent).join('')).toBe('0.4000f');
    expect(host.querySelector('.code-line')!.classList.contains('is-changed')).toBe(true);
    const before = host.querySelector('.code-value');
    render(h(CodeViewer, { code, marks, marksKey: 2 }), host);
    await settle();
    expect(host.querySelector('.code-value')).not.toBe(before);
    expect(lineSegments('glEnd();', [{ start: 2, end: 5, cls: 'x' }]).map((s) => [s.text, s.cls])).toEqual([
      ['gl', 'tk-glfn'], ['End', 'tk-glfn x'], ['(', 'tk-punct'], [')', 'tk-punct'], [';', 'tk-punct'],
    ]);
    unmount(host);
  });
});

describe('BB-CODE-05: Find outlines matches and steps through them', () => {
  it('counts matches, moves with Enter and Shift+Enter, reports the current line, and clears on Escape', async () => {
    const onFindLine = vi.fn();
    const host = mount(h(CodeViewer, { code: SMALL, onFindLine }));
    await settle();
    const find = [...host.querySelectorAll('.code-word')].find((b) => b.textContent === 'Find') as HTMLButtonElement;
    find.click();
    await settle();
    const input = host.querySelector('.code-search input') as HTMLInputElement;
    typeInto(input, 'glut');
    await settle();
    expect(host.querySelector('.code-search__count')!.textContent).toBe('1/2');
    expect(host.querySelectorAll('.code-find')).toHaveLength(2);
    expect(host.querySelector('.code-find.is-current')!.closest('.code-line')!.getAttribute('data-line')).toBe('2');
    expect(onFindLine).toHaveBeenLastCalledWith(2);
    key(input, 'Enter');
    await settle();
    expect(host.querySelector('.code-search__count')!.textContent).toBe('2/2');
    expect(onFindLine).toHaveBeenLastCalledWith(3);
    key(input, 'Enter', { shiftKey: true });
    await settle();
    expect(onFindLine).toHaveBeenLastCalledWith(2);
    key(input, 'Escape');
    await settle();
    expect(host.querySelector('.code-search')).toBeNull();
    expect(onFindLine).toHaveBeenLastCalledWith(null);
    unmount(host);
  });
});

describe('BB-CODE-06: Copy copies the whole program, however much is folded', () => {
  it('writes the full code to the clipboard and says Copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const host = mount(h(CodeViewer, { code: SMALL, rows: [{ kind: 'fold', block: 'main', label: 'int main()', summary: 's', start: 0, end: 4 }] }));
    await settle();
    const copy = [...host.querySelectorAll('.code-word')].find((b) => b.textContent === 'Copy') as HTMLButtonElement;
    copy.click();
    await settle();
    expect(writeText).toHaveBeenCalledWith(SMALL);
    expect(copy.textContent).toBe('Copied');
    unmount(host);
  });
});

describe('BB-CODE-07: Run\'s fired branch has its own mark', () => {
  it('marks the fired lines and no others', async () => {
    const host = mount(h(CodeViewer, { code: SMALL, firedLines: [2, 3] }));
    await settle();
    expect([...host.querySelectorAll('.code-line.is-fired')].map((el) => el.getAttribute('data-line'))).toEqual(['2', '3']);
    unmount(host);
  });
});

describe('BB-CODE-08: The code uses two syntax colours and the new tokens', () => {
  it('colours only GL calls and comments, and defines the value, line-number and Run tokens in both themes', () => {
    const scss = readFileSync('src/shared/ui/code-viewer/code-viewer.scss', 'utf8').replace(/\r\n/g, '\n');
    const tokenRules = [...scss.matchAll(/\.tk-([a-z]+)\s*\{/g)].map((m) => m[1]).sort();
    expect(tokenRules).toEqual(['comment', 'glfn']);
    const tokens = readFileSync('src/shared/styles/_tokens.scss', 'utf8').replace(/\r\n/g, '\n');
    const [light, dark] = tokens.split("[data-theme='dark']");
    for (const name of ['--value:', '--value-wash:', '--run-fired:', '--run-fired-wash:', '--ink-dim:', '--line-number:', '--canvas-ring:']) {
      expect(light, name).toContain(name);
      expect(dark, name).toContain(name);
    }
    expect(tokens).not.toContain('--code-match-');
    expect(tokens).not.toContain('--code-changed-');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/code-panel.test.ts`
Expected: FAIL. `lineSegments` is not exported, there is no `.code-fold`, and the token assertions fail.

- [ ] **Step 3: Add and retire tokens**

In `src/shared/styles/_tokens.scss`, inside `:root`, replace these four lines:

```scss
  --code-changed-rgb: 47, 77, 224;
  --code-changed-light: var(--accent-text);
  --code-match-rgb: 133, 77, 14;
  --code-match-light: #854d0e;
```

with:

```scss
  /* Amber means "your values": a value that just changed, the inputs in the math working, the followed vertex. */
  --value: #8a4f00;
  --value-wash: rgba(138, 79, 0, 0.12);
  /* Run's fired branch in the code. */
  --run-fired: #15803d;
  --run-fired-wash: rgba(21, 128, 61, 0.10);
  /* The quietest readable text (notes, hints, comments, table heads), and line numbers below it. */
  --ink-dim: #626b85;
  --line-number: #7d87a1;
```

In `[data-theme='dark']`, replace the matching four lines with:

```scss
  --value: #fbbf77;
  --value-wash: rgba(251, 191, 119, 0.16);
  --run-fired: #4ade80;
  --run-fired-wash: rgba(74, 222, 128, 0.10);
  --ink-dim: #7a84a0;
  --line-number: #5d6680;
```

In both blocks, after `--canvas-y: #4ade80;`, add:

```scss
  /* The followed vertex's ring on the canvas: amber, the same in both themes, as the canvas is dark in both. */
  --canvas-ring: #fbbf77;
```

- [ ] **Step 4: Rewrite the viewer**

Replace `src/shared/ui/code-viewer/CodeViewer.tsx` with:

```tsx
import './code-viewer.scss';
import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ComponentChildren } from 'preact';
import { X } from 'lucide-react';
import { tokenizeLine } from './tokenize';
import type { CodeMark, CodeRow } from './types';

export interface CodeViewerProps {
  code: string;
  /** The rows to show; every line when omitted. */
  rows?: readonly CodeRow[];
  /** A fold or "more" row was opened, or a block opened by hand was closed. */
  onToggleFold?: (block: string) => void;
  /** The values that just changed. */
  marks?: readonly CodeMark[];
  /** Changes with every new edit, so the marks' fade starts again. */
  marksKey?: number;
  /** Lines to scroll into view when they change: a lesson's highlighted lines, else the changed values. */
  revealLines?: readonly number[];
  /** Run's fired branch. */
  firedLines?: readonly number[];
  /** Find's current match is on this line; null when Find is empty or closed. */
  onFindLine?: (line: number | null) => void;
  isLessonMode?: boolean;
  /** Replaces the language and line count at the start of the header, such as the column's switch. */
  headerLead?: ComponentChildren;
  /** Rendered at the end of the header, after Copy. */
  headerTrail?: ComponentChildren;
}

interface Overlay {
  start: number;
  end: number;
  cls: string;
}

interface Segment {
  text: string;
  cls: string;
}

/** Splits a line's tokens at the overlay edges, so a mark or a Find match can cover part of a token. */
export function lineSegments(text: string, overlays: readonly Overlay[]): Segment[] {
  const out: Segment[] = [];
  let pos = 0;
  for (const token of tokenizeLine(text)) {
    const start = pos;
    const end = pos + token.t.length;
    const cuts = new Set([start, end]);
    for (const o of overlays) {
      if (o.start > start && o.start < end) cuts.add(o.start);
      if (o.end > start && o.end < end) cuts.add(o.end);
    }
    const edges = [...cuts].sort((a, b) => a - b);
    for (let k = 0; k < edges.length - 1; k++) {
      const a = edges[k];
      const b = edges[k + 1];
      const extra = overlays.filter((o) => o.start <= a && o.end >= b).map((o) => o.cls);
      out.push({ text: text.slice(a, b), cls: [`tk-${token.k}`, ...extra].join(' ') });
    }
    pos = end;
  }
  return out;
}

const LineText = memo(function LineText({ text, overlays }: { text: string; overlays: readonly Overlay[] }) {
  const parts = useMemo(() => lineSegments(text, overlays), [text, overlays]);
  return (
    <>
      {parts.map((p, i) => (
        <span key={i} className={p.cls}>{p.text}</span>
      ))}
    </>
  );
});

const NO_OVERLAYS: readonly Overlay[] = [];

function byLine<T extends { line: number }>(items: readonly T[] | undefined): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const item of items ?? []) map.set(item.line, [...(map.get(item.line) ?? []), item]);
  return map;
}

const CodeViewer = memo(function CodeViewer({
  code, rows, onToggleFold, marks, marksKey = 0, revealLines, firedLines, onFindLine, isLessonMode,
  headerLead, headerTrail,
}: CodeViewerProps) {
  const baseId = useId();
  const [copied, setCopied] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [current, setCurrent] = useState(0);
  const findRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineEls = useRef<Map<number, HTMLDivElement>>(new Map());

  const lines = useMemo(() => code.replace(/\r\n/g, '\n').split('\n'), [code]);
  const rowList = useMemo<readonly CodeRow[]>(() => rows ?? lines.map((_, line) => ({ kind: 'line', line })), [rows, lines]);

  const matches = useMemo<CodeMark[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: CodeMark[] = [];
    lines.forEach((text, line) => {
      const low = text.toLowerCase();
      for (let at = low.indexOf(q); at >= 0; at = low.indexOf(q, at + q.length)) out.push({ line, start: at, end: at + q.length });
    });
    return out;
  }, [lines, query]);
  const index = matches.length === 0 ? -1 : Math.min(current, matches.length - 1);
  const currentMatch = index >= 0 ? matches[index] : null;

  // The parent opens the fold around the current match.
  const findLine = currentMatch?.line ?? null;
  useEffect(() => {
    onFindLine?.(findLine);
  }, [findLine, onFindLine]);

  useEffect(() => {
    if (findOpen) requestAnimationFrame(() => findRef.current?.focus());
  }, [findOpen]);

  // Bring the current match into view once its fold has opened.
  useEffect(() => {
    if (!currentMatch) return;
    const raf = requestAnimationFrame(() => lineEls.current.get(currentMatch.line)?.scrollIntoView?.({ block: 'nearest' }));
    return () => cancelAnimationFrame(raf);
  }, [currentMatch, rowList]);

  // Scroll a lesson's highlighted lines, or the changed values, into view: centred when they fit, else from the top.
  useEffect(() => {
    if (!revealLines || revealLines.length === 0) return;
    const scroller = scrollRef.current;
    if (!scroller) return;
    const top = Math.min(...revealLines);
    const bottom = Math.max(...revealLines);
    const raf = requestAnimationFrame(() => {
      const el = lineEls.current.get(top);
      if (!el || !scroller.contains(el)) return;
      const scrollerRect = scroller.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const elTop = scroller.scrollTop + (elRect.top - scrollerRect.top);
      const endEl = lineEls.current.get(bottom);
      const height = endEl ? endEl.getBoundingClientRect().bottom - elRect.top : elRect.height;
      let target = elTop - scroller.clientHeight / 2 + height / 2;
      const withPadding = elTop - 24;
      if (height > scroller.clientHeight * 0.7 || target > withPadding) target = withPadding;
      const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      scroller.scrollTo({ top: Math.max(0, target), left: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [revealLines, code]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const closeFind = () => {
    setQuery('');
    setCurrent(0);
    setFindOpen(false);
  };

  const marksByLine = useMemo(() => byLine(marks), [marks]);
  const matchesByLine = useMemo(() => byLine(matches), [matches]);
  const fired = useMemo(() => new Set(firedLines ?? []), [firedLines]);

  const overlaysFor = (line: number): readonly Overlay[] => {
    const lineMarks = marksByLine.get(line);
    const lineMatches = matchesByLine.get(line);
    if (!lineMarks && !lineMatches) return NO_OVERLAYS;
    return [
      ...(lineMarks ?? []).map((m) => ({ start: m.start, end: m.end, cls: 'code-value' })),
      ...(lineMatches ?? []).map((m) => ({ start: m.start, end: m.end, cls: m === currentMatch ? 'code-find is-current' : 'code-find' })),
    ];
  };

  const renderLine = (row: Extract<CodeRow, { kind: 'line' }>) => {
    const { line } = row;
    const text = lines[line] ?? '';
    const changed = marksByLine.has(line);
    const classes = ['code-line', changed ? 'is-changed' : '', fired.has(line) ? 'is-fired' : ''].filter(Boolean).join(' ');
    return (
      <div
        // A changed line remounts on each edit, so its fade starts again.
        key={changed ? `${line}:${marksKey}` : `${line}`}
        ref={(el) => {
          if (el) lineEls.current.set(line, el);
          else lineEls.current.delete(line);
        }}
        className={classes}
        data-line={line}
      >
        <span className="code-line__num" aria-hidden="true">{line + 1}</span>
        {row.closes && (
          <button
            type="button"
            className="code-fold-close"
            aria-label={`Fold ${row.closes.label}`}
            onClick={() => onToggleFold?.(row.closes!.block)}
          >
            ▾
          </button>
        )}
        <span className="code-line__text">{text ? <LineText text={text} overlays={overlaysFor(line)} /> : ' '}</span>
      </div>
    );
  };

  const renderFold = (row: Exclude<CodeRow, { kind: 'line' }>) => {
    const tipId = row.kind === 'fold' ? `${baseId}-fold-${row.start}` : undefined;
    return (
      <div key={`${row.kind}:${row.block}:${row.start}`} className={`code-fold-row code-fold-row--${row.kind}`}>
        <button
          type="button"
          className="code-fold"
          aria-expanded="false"
          aria-describedby={tipId}
          onClick={() => onToggleFold?.(row.block)}
        >
          <span className="code-line__num" aria-hidden="true">{row.start + 1}</span>
          <span className="code-fold__arrow" aria-hidden="true">▸ </span>
          <span className="code-fold__label">{row.label}</span>
        </button>
        {row.kind === 'fold' && (
          <span id={tipId} role="tooltip" className="code-fold__summary">{row.summary}</span>
        )}
      </div>
    );
  };

  return (
    <div className={`code-viewer-container${isLessonMode ? ' lesson-mode' : ''}`}>
      <div className="code-header">
        <div className="code-header-left">
          {headerLead ?? (
            <>
              <span className="code-lang">C++</span>
              <span className="code-stat">· OpenGL 1.5 · {lines.length} lines</span>
            </>
          )}
        </div>
        <div className="code-header-right">
          {!isLessonMode && (findOpen ? (
            <div className="code-search" role="search">
              <input
                ref={findRef}
                value={query}
                aria-label="Find in code"
                placeholder="Find in code…"
                onInput={(e) => {
                  setQuery(e.currentTarget.value);
                  setCurrent(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    closeFind();
                  } else if (e.key === 'Enter' && matches.length > 0) {
                    e.preventDefault();
                    setCurrent((index + (e.shiftKey ? matches.length - 1 : 1)) % matches.length);
                  }
                }}
              />
              {query && (
                <span className="code-search__count" aria-live="polite">
                  {matches.length === 0 ? '0' : `${index + 1}/${matches.length}`}
                </span>
              )}
              <button type="button" className="code-search__close" aria-label="Close find" onClick={closeFind}>
                <X size={12} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button type="button" className="code-word" onClick={() => setFindOpen(true)}>Find</button>
          ))}
          <button type="button" className="code-word" onClick={handleCopy}>{copied ? 'Copied' : 'Copy'}</button>
          {headerTrail}
        </div>
      </div>

      <div className="code-content" ref={scrollRef}>
        {rowList.map((row) => (row.kind === 'line' ? renderLine(row) : renderFold(row)))}
      </div>
    </div>
  );
});

export default CodeViewer;
```

- [ ] **Step 5: Rewrite the styles**

Replace `src/shared/ui/code-viewer/code-viewer.scss` with:

```scss
@use '../../styles/tokens' as *;

// A changed value fades from amber on its wash back to plain ink.
@keyframes code-value-fade {
  from { color: var(--value); background-color: var(--value-wash); }
  to { color: var(--code-ink); background-color: transparent; }
}

.code-viewer-container {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--paper);
  color: var(--code-ink);

  &.lesson-mode .code-content { user-select: none; }
}

.code-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: 36px;
  padding: 0 10px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--rule);
  font-size: var(--text-sm);
  color: var(--ink-dim);
}

.code-header-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.code-lang {
  font-family: $font-mono;
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--ink);
}

.code-stat {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: $font-mono;
  font-size: var(--text-xs);
  color: var(--ink-faint);
}

.code-header-right {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

// The header's toggles are plain words: faint until hovered or switched on.
.code-word {
  padding: 1px 5px;
  border: 0;
  border-radius: var(--radius-s);
  background: none;
  font: inherit;
  font-size: var(--text-xs);
  color: var(--ink-faint);
  cursor: pointer;

  &:hover,
  &[aria-pressed='true'] { color: var(--ink); }
  &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 1px; }
}

.code-search {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 180px;
  padding: 1px var(--space-1) 1px var(--space-2);
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-s);
  background: var(--paper-sunken);

  input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    color: var(--ink);
    font-family: $font-mono;
    font-size: var(--text-xs);
    outline: none;

    &::placeholder { color: var(--ink-dim); }
  }
}

.code-search__count {
  font-family: $font-mono;
  font-size: var(--text-xs);
  color: var(--ink-faint);
}

.code-search__close {
  display: inline-flex;
  padding: 2px;
  border: 0;
  border-radius: var(--radius-s);
  background: none;
  color: var(--ink-faint);
  cursor: pointer;

  &:hover { color: var(--ink); }
  &:focus-visible { outline: 2px solid var(--focus-ring); }
}

.code-content {
  @include scrollbar;
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--space-2) 0;
  font-family: $font-mono;
  font-size: var(--text-sm);
  line-height: 1.8;
}

.code-line,
.code-fold {
  display: block;
  position: relative;
  min-width: max-content;
  padding-right: var(--space-4);
  white-space: pre;
}

.code-line__num {
  display: inline-block;
  width: 30px;
  margin-right: 14px;
  text-align: right;
  color: var(--line-number);
  user-select: none;
}

.code-line.is-changed .code-line__num { color: var(--value); }

// Two syntax colours: GL and GLUT calls in cobalt, comments dim. Everything else is plain ink.
.tk-glfn { color: var(--code-fn); }
.tk-comment { color: var(--ink-dim); }

.code-value {
  border-radius: 2px;
  animation: code-value-fade 2s ease-out forwards;
}

// Without motion the wash holds, then goes after 2 s.
@media (prefers-reduced-motion: reduce) {
  .code-value { animation-timing-function: step-end; }
}

// Find draws an outline and no fill, so it never reads as a change.
.code-find {
  border-radius: 2px;
  outline: 1px solid var(--ink-faint);
}

.code-find.is-current { outline-color: var(--ink); }

.code-line.is-fired {
  background: var(--run-fired-wash);
  box-shadow: inset 3px 0 0 var(--run-fired);
}

.code-fold-row { position: relative; }

.code-fold {
  width: 100%;
  border: 0;
  background: none;
  text-align: left;
  font: inherit;
  color: var(--ink-faint);
  cursor: pointer;

  &:hover { color: var(--ink-muted); }
  &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -2px; }
}

.code-fold__arrow { color: var(--ink-dim); }

.code-fold__summary {
  display: none;
  position: absolute;
  top: 100%;
  left: 44px;
  z-index: 2;
  max-width: 300px;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-s);
  background: var(--paper-raised);
  color: var(--ink-muted);
  font-family: $font-ui;
  font-size: var(--text-xs);
  line-height: var(--lh-xs);
  white-space: normal;
}

.code-fold-row:hover .code-fold__summary,
.code-fold:focus-visible + .code-fold__summary { display: block; }

// A block opened by hand shows ▾ in its first line's gutter to fold it again.
.code-fold-close {
  position: absolute;
  top: 0;
  left: 0;
  width: 14px;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: var(--ink-dim);
  cursor: pointer;

  &:hover { color: var(--ink); }
  &:focus-visible { outline: 2px solid var(--focus-ring); }
}
```

- [ ] **Step 6: Keep the old panel compiling until Task 6**

In `src/features/code-generation/ui/SceneCodePanel.tsx`:
1. Make the `<CodeViewer …/>` call pass only `code`, `revealLines={changedLines}`, `firedLines={flashLines}`, `isLessonMode`, `headerLead` and `headerTrail`.
2. Remove the `highlightTarget`, `annotations` and `changedLines` props, along with the variables and the `GLUT_BOILERPLATE_ANNOTATIONS` import they leave unused.

Task 6 replaces the file.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/code-panel.test.ts`
Expected: PASS (8 tests).

BB-TOUR-07 and BB-RUN-12 read `.code-line.changed`, so they fail until Task 6 updates them. Run them now to confirm that is the only failure:

`npx vitest run tests/black-box/first-visit-tour.test.ts tests/black-box/run-mode.test.ts`
Expected: exactly BB-TOUR-07 and BB-RUN-12 fail.

The suite must be green before this commit, so make two test edits now:
- In BB-RUN-12, change `'.code-line.changed'` to `'.code-line.is-fired'`. It passes here, because `firedLines` is already wired.
- Mark BB-TOUR-07 `it.skip`, with the comment `// Rewritten with the value marks in the next commit.`

Task 6 replaces BB-TOUR-07 and removes the skip.

- [ ] **Step 8: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/shared/styles/_tokens.scss src/shared/ui/code-viewer/CodeViewer.tsx src/shared/ui/code-viewer/code-viewer.scss src/features/code-generation/ui/SceneCodePanel.tsx tests/black-box/code-panel.test.ts tests/black-box/first-visit-tour.test.ts tests/black-box/run-mode.test.ts
git diff --staged
git commit -m "feat(code): a calm code viewer with folds, value marks, outline-only Find and two syntax colours"
```

---

### Task 6: The code follows the selection

**Files:**
- Create: `src/features/code-generation/model/use-value-marks.ts`
- Rewrite: `src/features/code-generation/ui/SceneCodePanel.tsx`
- Delete: `src/features/code-generation/model/glut-annotations.ts`
- Modify: `tests/black-box/code-panel.test.ts` (append)
- Modify: `tests/black-box/first-visit-tour.test.ts` (BB-TOUR-07 checks value marks; remove the skip)

**Interfaces:**
- Consumes: `outlineCode` (Task 2), `visibleRows` (Task 3), `diffChangedValues` (Task 4), `CodeViewer` (Task 5), and the store's `codeFoldsOpened` and `toggleCodeFold` (Task 1).
- Produces: `export function useValueMarks(code: string, canvas: { width: number; height: number }, swapKey: string, selectionKey: string | null): { marks: CodeMark[]; key: number }`.
  - The marks are the student's last edit: `diffChangedValues(previousCode, code)`.
  - They clear when the selection changes with no code change.
  - A canvas resize or a change of `swapKey` (a lesson starting or ending) clears them and marks nothing.
- Produces, for Task 14: `SceneCodePanel` holds `outline`, `selection` (the selected object's code name) and `rows`.

Plan rulings for this task:
- **How long a forced fold stays open.** A changed value forces its fold open for as long as its line number stays amber: until the next edit, or until the selection changes with no code change. The spec says a fold "opens when a value inside it changes" but does not say when it closes. Closing it after the 2 s fade would make the code jump.
- **The tour.** It no longer needs its own flash. The value marks now show in every mode, so the tour-only `tourFlash` code is removed and BB-TOUR-07 checks the value mark.
- **The code is the source.** The marks compare generated text, so they also show the edits a lesson step makes. A lesson's own `changedCodeLines` still decides what scrolls into view.

- [ ] **Step 1: Write the failing tests**

Append to `tests/black-box/code-panel.test.ts`, merging imports:

```ts
import SceneCodePanel from '@/features/code-generation/ui/SceneCodePanel';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { addPrimitive } from '../helpers/store';

/** The mocks' scene: Triangle, Square and Dot, with Triangle's state line first. */
function mockScene() {
  const dot = addPrimitive('POINTS', [{ x: 0.6, y: 0.6 }]);
  getState().updateObjectName(dot.id, 'Dot');
  const square = addQuad(-0.5, 0.5, 0.2);
  getState().updateObjectName(square.id, 'Square');
  const tri = addTriangle(0.3, -0.17, 0.5);
  getState().updateObjectName(tri.id, 'Triangle');
  getState().updateObjectTransform(tri.id, { rotate: 15 });
  return { tri, square, dot };
}
const currentProgram = () => {
  const s = getState();
  return generateCodeFromState(
    { objects: s.objects, canvasBackgroundColor: s.canvasBackgroundColor, callbacks: s.callbacks, viewportLimits: s.viewportLimits, textures: s.getAllTextures() },
    { width: 800, height: 600 },
  );
};
const lineTexts = (host: HTMLElement) => [...host.querySelectorAll('.code-line .code-line__text')].map((el) => el.textContent ?? '');
const foldLabels = (host: HTMLElement) => [...host.querySelectorAll('.code-fold__label')].map((el) => el.textContent);

describe('BB-CODE-09: With a shape selected, its code is open and the rest of the program folds', () => {
  it('shows the selected draw function and state line, and folds the others to their names', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    expect(lineTexts(host)).toContain('void draw_Triangle()');
    expect(lineTexts(host).some((t) => t.startsWith('ObjectState state_Triangle'))).toBe(true);
    expect(foldLabels(host)).toEqual(expect.arrayContaining(['#include …', 'void draw_Square()', 'void draw_Dot()', 'void display()', 'int main()', '2 more objects']));
    expect(host.querySelector('.code-focus, .code-change-badge, .code-annot-hint')).toBeNull();
    unmount(host);
  });
});

describe('BB-CODE-10: With nothing selected, every object\'s code is open', () => {
  it('opens all three draw functions and folds the boilerplate', async () => {
    mockScene();
    getState().selectObject(null);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    for (const name of ['Triangle', 'Square', 'Dot']) expect(lineTexts(host)).toContain(`void draw_${name}()`);
    expect(foldLabels(host)).toEqual(expect.arrayContaining(['void display()', 'void init()', 'int main()']));
    unmount(host);
  });
});

describe('BB-CODE-11: An edit marks only the value it changed, in Author mode', () => {
  it('marks the new X on the state line and colours that line number', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    getState().updateObjectTransform(tri.id, { translateX: 0.4 });
    await settle();
    expect([...host.querySelectorAll('.code-value')].map((el) => el.textContent).join('')).toBe('0.4000f');
    const changed = host.querySelector('.code-line.is-changed .code-line__text')!.textContent!;
    expect(changed.startsWith('ObjectState state_Triangle')).toBe(true);
    unmount(host);
  });
});

describe('BB-CODE-12: A value that changes inside a fold opens it', () => {
  it('opens main() when the background colour changes, with the new value marked', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    expect(foldLabels(host)).toContain('int main()');
    getState().setCanvasBackgroundColor('#ff0000');
    await settle();
    expect(foldLabels(host)).not.toContain('int main()');
    expect(lineTexts(host).some((t) => t.includes('glClearColor(1.00f, 0.00f, 0.00f'))).toBe(true);
    expect([...host.querySelectorAll('.code-value')].map((el) => el.textContent)).toEqual(['1.00f']);
    unmount(host);
  });
});

describe('BB-CODE-13: A fold opened by hand stays open until the selection changes', () => {
  it('opens Square\'s draw function on click, folds it with ▾, and folds it again on a new selection', async () => {
    const { tri, square } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    const squareFold = () => [...host.querySelectorAll('.code-fold')].find((b) => b.textContent?.includes('void draw_Square()')) as HTMLButtonElement;
    squareFold().click();
    await settle();
    expect(getState().codeFoldsOpened).toEqual(['draw:Square']);
    expect(lineTexts(host)).toContain('void draw_Square()');
    (host.querySelector('.code-fold-close') as HTMLButtonElement).click();
    await settle();
    expect(foldLabels(host)).toContain('void draw_Square()');
    squareFold().click();
    await settle();
    getState().selectObject(square.id);
    getState().selectObject(tri.id);
    await settle();
    expect(getState().codeFoldsOpened).toEqual([]);
    expect(foldLabels(host)).toContain('void draw_Square()');
    unmount(host);
  });
});

describe('BB-CODE-14: Only the student\'s edit is marked; a lesson\'s highlighted lines open their fold', () => {
  it('marks nothing when a lesson swaps the scene in, and opens the fold around a lesson highlight', async () => {
    mockScene();
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    useVamsStore.setState({ appMode: 'Lesson', activeLessonId: 'transforms-demo-1', objects: [] });
    await settle();
    expect(host.querySelectorAll('.code-value')).toHaveLength(0);
    const tri = addTriangle();
    getState().selectObject(tri.id);
    await settle();
    // A lesson step that highlights main()'s glutMainLoop line, as codeChangeFocus would.
    const mainLoop = currentProgram().split('\n').findIndex((l) => l.includes('glutMainLoop'));
    useVamsStore.setState({ changedCodeLines: [mainLoop] });
    await settle();
    expect(lineTexts(host).some((t) => t.includes('glutMainLoop'))).toBe(true);
    useVamsStore.setState({ appMode: 'Author', activeLessonId: null, changedCodeLines: [] });
    unmount(host);
  });
});

describe('BB-CODE-15: Sanitised names fold and mark like any other', () => {
  it('opens draw_My_Shape for an object named "My Shape"', async () => {
    const tri = addTriangle();
    getState().updateObjectName(tri.id, 'My Shape');
    addQuad(0.5, 0.5, 0.2);
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    expect(lineTexts(host)).toContain('void draw_My_Shape()');
    expect(foldLabels(host)).toContain('void draw_QUADS_1()');
    unmount(host);
  });
});
```

In `tests/black-box/first-visit-tour.test.ts`, replace the whole `describe('BB-TOUR-07: …')` block (including the `it.skip` from Task 5) with:

```ts
describe('BB-TOUR-07: During the tour the code marks the value an edit changes', () => {
  it('marks the new X on the ObjectState line, not the glTranslatef line', async () => {
    const triangle = addTriangle();
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    getState().startTour();
    await settle();
    getState().updateObjectTransform(triangle.id, { translateX: 0.7 });
    await settle();
    const changed = [...host.querySelectorAll('.code-line.is-changed')].map((el) => el.textContent ?? '');
    expect(changed.some((line) => line.includes('ObjectState state_'))).toBe(true);
    expect(changed.some((line) => line.includes('glTranslatef'))).toBe(false);
    expect([...host.querySelectorAll('.code-value')].map((el) => el.textContent)).toEqual(['0.7000f']);
    getState().endTour();
    unmount(host);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/code-panel.test.ts tests/black-box/first-visit-tour.test.ts`
Expected: FAIL. The panel shows no folds (BB-CODE-09 to 15), and BB-TOUR-07 finds no `.code-value`.

- [ ] **Step 3: Write the marks hook**

Create `src/features/code-generation/model/use-value-marks.ts`:

```ts
import { useEffect, useRef, useState } from 'react';
import type { CodeMark } from '@/shared/ui/code-viewer/types';
import { diffChangedValues } from './value-diff';

interface Seen {
  code: string;
  width: number;
  height: number;
  swapKey: string;
  selectionKey: string | null;
}

/**
 * The values the student's last edit changed. A canvas resize (only glutInitWindowSize changes)
 * and a lesson starting or ending (`swapKey`) are not the student's edit: they clear the marks
 * and mark nothing. A new selection with no code change clears them too.
 */
export function useValueMarks(
  code: string,
  canvas: { width: number; height: number },
  swapKey: string,
  selectionKey: string | null,
): { marks: CodeMark[]; key: number } {
  const [state, setState] = useState<{ marks: CodeMark[]; key: number }>({ marks: [], key: 0 });
  const last = useRef<Seen | null>(null);
  useEffect(() => {
    const prev = last.current;
    last.current = { code, width: canvas.width, height: canvas.height, swapKey, selectionKey };
    if (!prev) return;
    const clear = () => setState((s) => (s.marks.length === 0 ? s : { marks: [], key: s.key }));
    if (prev.code === code) {
      if (prev.selectionKey !== selectionKey) clear();
      return;
    }
    if (prev.width !== canvas.width || prev.height !== canvas.height || prev.swapKey !== swapKey) {
      clear();
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ marks: diffChangedValues(prev.code, code), key: s.key + 1 }));
  }, [code, canvas.width, canvas.height, swapKey, selectionKey]);
  return state;
}
```

If lint flags the `clear()` calls with `react-hooks/set-state-in-effect`, add the same disable comment above each flagged line. That is the pattern the old tour flash used.

- [ ] **Step 4: Compose the panel**

Replace `src/features/code-generation/ui/SceneCodePanel.tsx` with:

```tsx
import { useMemo, useState } from 'react';
import type { ComponentChildren } from 'preact';
import { useVamsStore } from '@/core/store';
import CodeViewer from '@/shared/ui/code-viewer/CodeViewer';
import { useCanvasSize } from '@/features/code-generation/model/useCanvasSize';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { sanitizeName } from '@/features/code-generation/model/generator/utils';
import { locateHandlerBranch } from '@/features/code-generation/model/locate-branch';
import { outlineCode } from '@/features/code-generation/model/code-outline';
import { visibleRows } from '@/features/code-generation/model/code-folds';
import { useValueMarks } from '@/features/code-generation/model/use-value-marks';
import type { RuleTrigger } from '@/core/types/scene';

interface SceneCodePanelProps {
  /** The handler branch Run just fired; its lines flash in the code. */
  flashBranch?: { handlerName: string; trigger: RuleTrigger | null; seq: number } | null;
  headerLead?: ComponentChildren;
  headerTrail?: ComponentChildren;
}

const NO_LINES: number[] = [];

export default function SceneCodePanel({ flashBranch, headerLead, headerTrail }: SceneCodePanelProps = {}) {
  const objects = useVamsStore((s) => s.objects);
  const selectedObjectId = useVamsStore((s) => s.selectedObjectId);
  const canvasBackgroundColor = useVamsStore((s) => s.canvasBackgroundColor);
  const appMode = useVamsStore((s) => s.appMode);
  const activeLessonId = useVamsStore((s) => s.activeLessonId);
  const callbacks = useVamsStore((s) => s.callbacks);
  const changedCodeLines = useVamsStore((s) => s.changedCodeLines);
  const viewportLimits = useVamsStore((s) => s.viewportLimits);
  const opened = useVamsStore((s) => s.codeFoldsOpened);
  const toggleCodeFold = useVamsStore((s) => s.toggleCodeFold);
  const getAllTextures = useVamsStore((s) => s.getAllTextures);
  const canvasSize = useCanvasSize();

  // Re-render on uploads:
  useVamsStore((s) => s.uploadedTextures);

  const generatedCode = useMemo(
    () =>
      generateCodeFromState(
        { objects, canvasBackgroundColor, callbacks, viewportLimits, textures: getAllTextures() },
        canvasSize,
      ),
    [objects, canvasBackgroundColor, callbacks, canvasSize, viewportLimits, getAllTextures],
  );
  const outline = useMemo(() => outlineCode(generatedCode), [generatedCode]);

  const selected = objects.find((o) => o.id === selectedObjectId);
  const selection = selected ? sanitizeName(selected.name) : null;
  const isLessonMode = appMode === 'Lesson';

  const flashLines = useMemo(
    () => (flashBranch ? locateHandlerBranch(generatedCode, flashBranch.handlerName, flashBranch.trigger) : NO_LINES),
    [flashBranch, generatedCode],
  );
  const { marks, key: marksKey } = useValueMarks(generatedCode, canvasSize, `${appMode}:${activeLessonId ?? ''}`, selectedObjectId);
  const [findLine, setFindLine] = useState<number | null>(null);
  const lessonLines = isLessonMode ? changedCodeLines : NO_LINES;

  const rows = useMemo(() => {
    const forced = [...lessonLines, ...marks.map((m) => m.line), ...flashLines, ...(findLine === null ? [] : [findLine])];
    return visibleRows(outline, selection, opened, forced);
  }, [outline, selection, opened, lessonLines, marks, flashLines, findLine]);

  const revealLines = useMemo(() => (lessonLines.length > 0 ? lessonLines : marks.map((m) => m.line)), [lessonLines, marks]);

  return (
    <CodeViewer
      code={generatedCode}
      rows={rows}
      onToggleFold={toggleCodeFold}
      marks={marks}
      marksKey={marksKey}
      revealLines={revealLines}
      firedLines={flashLines}
      onFindLine={setFindLine}
      isLessonMode={isLessonMode}
      headerLead={headerLead}
      headerTrail={headerTrail}
    />
  );
}
```

- [ ] **Step 5: Delete the empty-scene annotations**

```bash
git rm src/features/code-generation/model/glut-annotations.ts
```

Folding hides every line those hover cards described. The explanation strip (Task 14) covers them.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/code-panel.test.ts tests/black-box/first-visit-tour.test.ts tests/black-box/run-mode.test.ts tests/black-box/editor-shell.test.ts tests/black-box/lesson-column.test.ts`
Expected: PASS.

- [ ] **Step 7: Check it in the browser**

1. Run `npx vite --port 5174` in the background and record its PID.
2. Open `http://localhost:5174/app` and add three shapes.
3. Select one and confirm that only its code is open and that the other draw functions fold to their names.
4. Change Translate X and confirm that only the number turns amber and fades.
5. Change the background colour and confirm that `int main()` opens with the value marked.
6. Stop the server by its PID: `taskkill //PID <pid> //T //F`.

- [ ] **Step 8: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/features/code-generation/model/use-value-marks.ts src/features/code-generation/ui/SceneCodePanel.tsx tests/black-box/code-panel.test.ts tests/black-box/first-visit-tour.test.ts
git diff --staged
git commit -m "feat(code): fold the code to the selected object and mark only the value that changed"
```

(`git rm` already staged the deletion.)

---

### Task 7: Checkpoint 1: the calm code panel against the mock

**This task is the controller's, not a subagent's.** It ends with the owner's sign-off. Build step 2 does not start until the owner signs off, or until their requested changes are made and re-shown.

**Files:**
- Create: `tests/visual/code-math.spec.ts`
- Modify: `tests/README.md` (the visual suite list)
- Local only, git-ignored: `.superpowers/checkpoints/shoot-mocks.mjs` and `.superpowers/checkpoints/step-1.html`

- [ ] **Step 1: Write the visual spec with the mocks' scene**

Create `tests/visual/code-math.spec.ts`:

```ts
/**
 * VISUAL TEST SUITE — VIS-CM
 * The code panel and the math journey in the approved mocks' scene. Not part of `npm test`.
 */
import { test, expect, type Page } from '@playwright/test';

type Theme = 'light' | 'dark';

const HIDE_TIMED_NOTICES = '.update-notice, [data-sonner-toaster] { display: none !important; }';

const vertex = (id: string, x: number, y: number, color: string) => ({ id, x, y, color });
const shape = (id: string, name: string, type: string, vertices: unknown[], transform: Record<string, number>) => ({
  id, name, type, visible: true, shading: 'SMOOTH', vertices,
  transform: { translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1, ...transform },
  parentId: null, children: [], colorMode: 'FLOAT', lineStipple: null, renderingMode: 'IMMEDIATE',
  bufferUsage: 'STATIC', useIndexed: false, updateMethod: 'BUFFER_SUB_DATA', texture: null, uvs: null,
});

/** The mocks' scene: Triangle moved 0.30, −0.17 and turned 15°, then Square and Dot. Each test sets X to 0.40. */
const MOCK_OBJECTS = [
  shape('triangle', 'Triangle', 'TRIANGLES',
    [vertex('tri-v0', 0, 0.5, '#ff6633'), vertex('tri-v1', -0.5, -0.5, '#3399ff'), vertex('tri-v2', 0.5, -0.5, '#55dd88')],
    { translateX: 0.3, translateY: -0.17, rotate: 15 }),
  shape('square', 'Square', 'QUADS',
    [vertex('sq-v0', -0.2, -0.2, '#5b8def'), vertex('sq-v1', 0.2, -0.2, '#5b8def'), vertex('sq-v2', 0.2, 0.2, '#5b8def'), vertex('sq-v3', -0.2, 0.2, '#5b8def')],
    { translateX: -0.55, translateY: 0.45 }),
  shape('dot', 'Dot', 'POINTS', [vertex('dot-v0', 0, 0, '#ffffff')], { translateX: 0.6, translateY: 0.6 }),
];

/** Opens the editor on the mocks' scene with Triangle selected and its Translate X just changed to 0.40. */
export async function openMockScene(page: Page, theme: Theme) {
  await page.addInitScript(
    ({ t, css, objects }) => {
      window.localStorage.setItem('vams-theme', t);
      window.localStorage.setItem('vams-storage', JSON.stringify({
        state: { objects, hasSeenWelcome: true, activeSection: 'Transforms' },
        version: 9,
      }));
      const inject = () => {
        const style = document.createElement('style');
        style.textContent = css;
        (document.head ?? document.documentElement).appendChild(style);
      };
      if (document.documentElement) inject();
      else document.addEventListener('DOMContentLoaded', inject, { once: true });
    },
    { t: theme, css: HIDE_TIMED_NOTICES, objects: MOCK_OBJECTS },
  );
  await page.goto('/app');
  await page.waitForSelector('.editor');
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.getByRole('treeitem', { name: 'Triangle' }).click();
  const x = page.getByLabel('Translate X').first();
  await x.fill('0.40');
  await x.press('Enter');
}

for (const theme of ['dark', 'light'] as const) {
  test(`VIS-CM-01: Code pane, Triangle selected and X just changed, ${theme}, 1280`, async ({ page }) => {
    await openMockScene(page, theme);
    // Taken inside the 2 s the changed value's wash holds, so the mark shows.
    await expect(page.locator('.code-math-column')).toHaveScreenshot(`cm-code-${theme}-1280.png`, { animations: 'allow' });
    await expect(page).toHaveScreenshot(`cm-editor-code-${theme}-1280.png`, { animations: 'allow' });
  });
}
```

If Enter does not commit Translate X, use `press('Tab')`. Confirm that the screenshot shows `0.4000f` in amber.

- [ ] **Step 2: Take the real screenshots**

```bash
rm -f tests/visual/baseline.local/cm-*.png
npx playwright test tests/visual/code-math.spec.ts --update-snapshots
```

Expected: 2 tests pass, writing `tests/visual/baseline.local/cm-code-{dark,light}-1280.png` and `cm-editor-code-{dark,light}-1280.png`. Delete first: `--update-snapshots` leaves a baseline untouched when it is within the 1 % threshold.

- [ ] **Step 3: Shoot the mocks**

Create `.superpowers/checkpoints/shoot-mocks.mjs` (local only):

```js
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const dir = resolve('.superpowers/brainstorm/1039-1791996012/content');
const out = resolve('.superpowers/checkpoints');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto(pathToFileURL(resolve(dir, 'code-calm-v2.html')).href);
await page.locator('.opt').first().locator('.col').screenshot({ path: resolve(out, 'mock-code-calm-a.png') });
await page.goto(pathToFileURL(resolve(dir, 'journey-h2-v3.html')).href);
const cols = page.locator('.col');
for (const [i, name] of ['transformed', 'projected', 'coloured'].entries()) {
  await cols.nth(i).screenshot({ path: resolve(out, `mock-journey-${name}.png`) });
}
await browser.close();
```

Run: `node .superpowers/checkpoints/shoot-mocks.mjs`

- [ ] **Step 4: Put them side by side and show the owner**

1. Write `.superpowers/checkpoints/step-1.html`. It is a two-column page:
   - Left: `mock-code-calm-a.png`.
   - Right: `../../tests/visual/baseline.local/cm-code-dark-1280.png`.
   - A second row: `cm-code-light-1280.png` and `cm-editor-code-dark-1280.png`.
   - Each image gets a caption naming it.
2. Open it: `start .superpowers/checkpoints/step-1.html`.
3. Ask the owner, in one question, whether the code panel matches the approved look. List what to compare:
   - fold rows with names only;
   - the amber value and its line number;
   - two syntax colours;
   - quiet line numbers;
   - the plain-word header.
4. Record the answer in the ledger.
5. If the owner asks for changes, make them as a fix round on Tasks 5–6 (with tests where behaviour changes). Retake and re-show the screenshots before Task 8.

- [ ] **Step 5: Commit the visual spec**

1. In `tests/README.md`'s layout block, add under `about.spec.ts`:

   ```
   │   ├── code-math.spec.ts                 (VIS-CM-*: the code panel and the math journey in the approved mocks' scene)
   ```

2. Commit:

   ```bash
   npm run lint && npm run build && npm test
   git checkout -- tests/reports
   git add tests/visual/code-math.spec.ts tests/README.md
   git diff --staged
   git commit -m "test(visual): capture the calm code pane in the approved mock's scene"
   ```

---

## Build step 2: the journey shell

### Task 8: Which stage opens

**Files:**
- Create: `src/core/inspector/journey-stage.ts`
- Modify: `src/core/inspector/index.ts`
- Modify: `src/core/store/types.ts`, `src/core/store/runtime-slice.ts`, `src/core/store/lesson-slice.ts`, `src/core/store/tour-slice.ts`
- Modify: `src/core/types/lesson.ts`
- Modify: `src/features/lesson-engine/model/useLessonRunner.ts`
- Modify: `tests/setup.ts`
- Create: `tests/black-box/math-journey.test.ts`

**Interfaces:**
- Produces, from `@/core/inspector`:

```ts
export type JourneyStageId = 'stored' | 'transformed' | 'projected' | 'assembled' | 'rasterised' | 'coloured';
export const JOURNEY_STAGES: readonly JourneyStageId[];   // pipeline order
export function stageForSection(section: CurriculumSection): JourneyStageId;
export function stageForPlace(place: FocusPlace): JourneyStageId | null;   // null: use the section's stage
export function stageForGroup(group: InspectorGroupId): JourneyStageId | null;
export type JourneyContext = Pick<VamsState, 'appMode' | 'lessonFocusPanel' | 'selectedObjectId' | 'lastOpenedGroup' | 'activeSection' | 'journeyStageOverride'>;
export function journeyStageFor(s: JourneyContext): JourneyStageId;
```

- Produces, in the store:
  - `journeyStageOverride: JourneyStageId | null` and `setJourneyStageOverride(stage: JourneyStageId | null): void`.
  - The override is cleared wherever `mathTabOverride` is cleared today: opening a group, a lesson's focus step, a section change and leaving a lesson.
  - `mathTabOverride` stays until Task 10 removes the tabs.
- Produces: `LessonStep.mathStage?: JourneyStageId`. The runner sets the override to `step.mathStage ?? null` after it applies the step's focus.
- Produces: the tour's Understand step (index 3) opens with `journeyStageOverride: 'transformed'`.

Plan ruling, the tour: the spec (§5) says the tour needs no change, because "the context opens Transformed". The Transform group is open by default, so changing X opens no group, `lastOpenedGroup` stays null, and the context is the course section (Pipeline for a new visitor), which opens Rasterised. Step 4's caption promises "the matrix your X just changed", so the Understand step sets the override itself. The cost is one field in `enterStep`.

The mapping (spec §3, "Which stage opens"):

| Context | Stage |
| --- | --- |
| Vertices, Buffers | `stored` |
| Transform, the scene list | `transformed` |
| Viewing volume | `projected` |
| Add (primitives), Create Text | `assembled` |
| Pipeline mode controls (the lesson card), Background | `rasterised` |
| Appearance, Texture, Texture library | `coloured` |
| Callbacks, or nothing | the section's stage: Pipeline → `rasterised`, Primitives → `assembled`, Buffers → `stored`, Transforms → `transformed`, Textures → `coloured` |

- [ ] **Step 1: Write the failing tests**

Create `tests/black-box/math-journey.test.ts`:

```ts
/**
 * BLACK-BOX TEST SUITE — BB-JOURNEY
 * The math pane's vertex journey: which stage opens, the track, the open stage, the stepper and the links.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useVamsStore } from '@/core/store';
import type { Lesson } from '@/core/types/lesson';
import { FOCUS_PANEL_IDS, journeyStageFor, type JourneyContext, type JourneyStageId } from '@/core/inspector';
import { LESSON_REGISTRY } from '@/features/lesson-engine/model/lesson-registry';
import LessonBar from '@/features/lesson-engine/ui/LessonBar';
import { getState } from '../helpers/store';

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
  getState().clearLessonState();
  useVamsStore.setState({ appMode: 'Author', activeSection: 'Pipeline', lastOpenedGroup: null, journeyStageOverride: null, tourStep: null });
});

const base: JourneyContext = {
  appMode: 'Author', lessonFocusPanel: null, selectedObjectId: null, lastOpenedGroup: null, activeSection: 'Pipeline', journeyStageOverride: null,
};

describe('BB-JOURNEY-01: The context opens the stage that belongs to it', () => {
  it('maps every lesson focus place, every group and every section', () => {
    const focus: Record<string, JourneyStageId> = {
      'scene-hierarchy': 'transformed', 'primitive-palette': 'assembled', 'text-node-panel': 'assembled',
      'buffers-panel': 'stored', 'object-transform': 'transformed', 'line-style-panel': 'coloured',
      'texture-attach': 'coloured', 'uv-editor': 'coloured', 'ortho-editor': 'projected',
      'texture-library': 'coloured', 'callbacks-panel': 'stored', 'pipeline-mode-controls': 'rasterised',
      'appearance-panel': 'coloured',
    };
    expect(Object.keys(focus).sort()).toEqual([...FOCUS_PANEL_IDS].sort());
    for (const [panel, stage] of Object.entries(focus)) {
      // Callbacks has no stage of its own: it keeps the section's (Buffers here).
      const ctx = { ...base, appMode: 'Lesson' as const, lessonFocusPanel: panel, selectedObjectId: 'x', activeSection: 'Buffers' as const };
      expect(journeyStageFor(ctx), panel).toBe(stage);
    }
    expect(journeyStageFor({ ...base, appMode: 'Lesson', lessonFocusPanel: 'appearance-panel' })).toBe('rasterised');
    const groups = { vertices: 'stored', buffers: 'stored', transform: 'transformed', appearance: 'coloured', texture: 'coloured',
      background: 'rasterised', 'viewing-volume': 'projected', 'texture-library': 'coloured', callbacks: 'assembled' } as const;
    for (const [group, stage] of Object.entries(groups)) {
      expect(journeyStageFor({ ...base, activeSection: 'Primitives', lastOpenedGroup: group as keyof typeof groups }), group).toBe(stage);
    }
    const sections = { Pipeline: 'rasterised', Primitives: 'assembled', Buffers: 'stored', Transforms: 'transformed', Textures: 'coloured' } as const;
    for (const [section, stage] of Object.entries(sections)) {
      expect(journeyStageFor({ ...base, activeSection: section as keyof typeof sections })).toBe(stage);
    }
  });
});

describe('BB-JOURNEY-02: A stage opened by hand holds until the next lesson step or opened group', () => {
  it('wins over the context, and is cleared by a group, a focus step, a section change and leaving a lesson', () => {
    const s = () => getState();
    expect(journeyStageFor({ ...base, journeyStageOverride: 'projected' })).toBe('projected');
    s().setJourneyStageOverride('projected');
    s().toggleGroup('buffers');
    expect(s().journeyStageOverride).toBeNull();
    s().setJourneyStageOverride('projected');
    s().setLessonFocusPanel('object-transform');
    expect(s().journeyStageOverride).toBeNull();
    s().setJourneyStageOverride('projected');
    s().setActiveSection('Textures');
    expect(s().journeyStageOverride).toBeNull();
    s().setJourneyStageOverride('projected');
    s().clearLessonState();
    expect(s().journeyStageOverride).toBeNull();
  });
});

describe('BB-JOURNEY-03: A lesson step can name its stage', () => {
  const ID = 'test-math-stage';
  it('opens the step\'s mathStage, and the next step without one goes back to the context', async () => {
    const lesson: Lesson = {
      id: ID, title: 'Math stage', type: 'demo', section: 'Primitives',
      steps: [{ narration: 'One', pane: 'math', mathStage: 'coloured' }, { narration: 'Two' }],
    };
    LESSON_REGISTRY[ID] = lesson;
    try {
      useVamsStore.setState({ activeSection: 'Primitives' });
      getState().setActiveLesson(ID);
      getState().setAppMode('Lesson');
      const host = mount(h(LessonBar, {}));
      await settle();
      expect(getState().journeyStageOverride).toBe('coloured');
      expect(journeyStageFor(getState())).toBe('coloured');
      getState().setCurrentStep(1);
      await settle();
      expect(getState().journeyStageOverride).toBeNull();
      expect(journeyStageFor(getState())).toBe('assembled');
      unmount(host);
    } finally {
      getState().clearLessonState();
      delete LESSON_REGISTRY[ID];
    }
  });
});

describe('BB-JOURNEY-04: The tour\'s Understand step opens Transformed', () => {
  it('sets the stage when the step opens, whatever the course section', () => {
    useVamsStore.setState({ activeSection: 'Pipeline' });
    getState().startTour();
    getState().nextTourStep();
    getState().nextTourStep();
    expect(getState().journeyStageOverride).toBeNull();
    getState().nextTourStep();
    expect(getState().tourStep).toBe(3);
    expect(journeyStageFor(getState())).toBe('transformed');
    getState().endTour();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/math-journey.test.ts`
Expected: FAIL. `journeyStageFor` is not exported from `@/core/inspector`.

- [ ] **Step 3: Write the stage mapping**

Create `src/core/inspector/journey-stage.ts`:

```ts
import type { CurriculumSection, VamsState } from '@/core/store/types';
import type { InspectorGroupId } from './groups';
import { resolveFocus, type FocusPlace } from './focus-map';

/** The six stages of the math journey, in the order OpenGL processes a vertex. */
export type JourneyStageId = 'stored' | 'transformed' | 'projected' | 'assembled' | 'rasterised' | 'coloured';

export const JOURNEY_STAGES: readonly JourneyStageId[] = ['stored', 'transformed', 'projected', 'assembled', 'rasterised', 'coloured'];

const SECTION_STAGE: Record<CurriculumSection, JourneyStageId> = {
  Pipeline: 'rasterised',
  Primitives: 'assembled',
  Buffers: 'stored',
  Transforms: 'transformed',
  Textures: 'coloured',
};

/** Callbacks has no stage of its own; it keeps the section's. */
const GROUP_STAGE: Record<InspectorGroupId, JourneyStageId | null> = {
  vertices: 'stored',
  buffers: 'stored',
  transform: 'transformed',
  appearance: 'coloured',
  texture: 'coloured',
  background: 'rasterised',
  'viewing-volume': 'projected',
  'texture-library': 'coloured',
  callbacks: null,
};

export function stageForSection(section: CurriculumSection): JourneyStageId {
  return SECTION_STAGE[section];
}

export function stageForGroup(group: InspectorGroupId): JourneyStageId | null {
  return GROUP_STAGE[group];
}

export function stageForPlace(place: FocusPlace): JourneyStageId | null {
  switch (place.area) {
    case 'scene':
      return place.target === 'list' ? 'transformed' : 'assembled';
    case 'lesson-card':
      return 'rasterised';
    default:
      return GROUP_STAGE[place.group];
  }
}

export type JourneyContext = Pick<
  VamsState,
  'appMode' | 'lessonFocusPanel' | 'selectedObjectId' | 'lastOpenedGroup' | 'activeSection' | 'journeyStageOverride'
>;

/**
 * The stage the math journey opens. A stage the student opened by hand wins until the next lesson
 * step or opened group. Otherwise, in a lesson: the step's focus, else the section. Outside one:
 * the last opened group, else the section.
 */
export function journeyStageFor(s: JourneyContext): JourneyStageId {
  if (s.journeyStageOverride) return s.journeyStageOverride;
  if (s.appMode === 'Lesson') {
    const place = resolveFocus(s.lessonFocusPanel, s.selectedObjectId !== null);
    return (place ? stageForPlace(place) : null) ?? stageForSection(s.activeSection);
  }
  return (s.lastOpenedGroup ? GROUP_STAGE[s.lastOpenedGroup] : null) ?? stageForSection(s.activeSection);
}
```

In `src/core/inspector/index.ts`, add `export * from './journey-stage';`.

- [ ] **Step 4: Add the store field**

In `src/core/store/types.ts`:
1. Add `import type { JourneyStageId } from '@/core/inspector/journey-stage';` beside the existing `InspectorGroupId` import.
2. In `RuntimeSlice`, after `mathTabOverride`, add:

```ts
  /** A journey stage opened by hand; cleared by the next lesson step or opened group. Session only. */
  journeyStageOverride: JourneyStageId | null;
```

3. After `setMathTabOverride`, add:

```ts
  setJourneyStageOverride: (stage: JourneyStageId | null) => void;
```

In `src/core/store/runtime-slice.ts`:
1. Add `journeyStageOverride: null,` after `mathTabOverride: null,` in the defaults.
2. Add `journeyStageOverride: null,` after `mathTabOverride: null,` in `setActiveSection`'s returned object.
3. In `toggleGroup`'s opening branch, write `{ openGroups: [...state.openGroups, id], lastOpenedGroup: id, mathTabOverride: null, journeyStageOverride: null }`.
4. Add the action after `setMathTabOverride`:

```ts
  setJourneyStageOverride: (stage) => set({ journeyStageOverride: stage }),
```

In `src/core/store/lesson-slice.ts`:
1. In `setLessonFocusPanel`, add `journeyStageOverride: null` to both returned objects, next to `mathTabOverride: null`.
2. In `clearLessonState`, add `journeyStageOverride: null,` after `mathTabOverride: null,`.

In `tests/setup.ts`, add `journeyStageOverride: null,` to the reset object.

- [ ] **Step 5: The lesson field and the runner**

In `src/core/types/lesson.ts`:
1. Add `import type { JourneyStageId } from '@/core/inspector/journey-stage';`.
2. After the `pane?` field, add:

```ts
  /** The journey stage the step is about, when the step's focus would open another one. */
  mathStage?: JourneyStageId;
```

In `src/features/lesson-engine/model/useLessonRunner.ts`, in both branches, directly after `store.setLessonFocusPanel(focus);`, add:

```ts
      store.setJourneyStageOverride(currentStep.mathStage ?? null);
```

- [ ] **Step 6: The tour's Understand step**

In `src/core/store/tour-slice.ts`:
1. Add `const UNDERSTAND = 3;` beside `const CHANGE = 2;`.
2. In `enterStep`, before the final `return { tourStep: index, tourStepBaseline: baseline };`, add:

```ts
  // Changing X opens no group (Transform starts open), so the Understand step opens the stage its caption names.
  if (index === UNDERSTAND) return { tourStep: index, tourStepBaseline: baseline, journeyStageOverride: 'transformed' };
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/math-journey.test.ts tests/black-box/first-visit-tour.test.ts tests/black-box/lesson-column.test.ts tests/black-box/editor-inspector.test.ts`
Expected: PASS.

- [ ] **Step 8: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/core/inspector/journey-stage.ts src/core/inspector/index.ts src/core/store/types.ts src/core/store/runtime-slice.ts src/core/store/lesson-slice.ts src/core/store/tour-slice.ts src/core/types/lesson.ts src/features/lesson-engine/model/useLessonRunner.ts tests/setup.ts tests/black-box/math-journey.test.ts
git diff --staged
git commit -m "feat(math): open the journey stage that matches what the student is doing"
```

---

### Task 9: The vertex journey model

**Files:**
- Create: `src/shared/lib/format-number.ts` (`fmt`, `short`: the journey and the code explanations both format numbers this way)
- Create: `src/entities/scene/model/primitive-assembly.ts` (`assemblyFor`, `provokingVertex`: how each primitive type groups vertices, used by the journey and the code notes)
- Create: `src/features/math-panel/model/vertex-journey.ts`
- Modify: `tests/helpers/matrix.ts` (add `orthoToNdc` and `ndcToWindow`; independent of `src`)
- Create: `tests/white-box/vertex-journey.test.ts`

**Interfaces:**
- Consumes: `JourneyStageId` and `JOURNEY_STAGES` from `@/core/inspector`.
- Produces:

```ts
export interface Point { x: number; y: number }
export type StepPart = string | { input: string };
export interface WorkingRow { step: StepPart[]; value: string; call: string | null; from?: boolean }
export interface JourneyStage {
  id: JourneyStageId; title: string; section: CurriculumSection; sentence: string;
  rows: WorkingRow[]; result: string | null; point: Point | null;
}
export type JourneySubject =
  | { kind: 'none' }
  | { kind: 'group'; name: string }
  | { kind: 'text'; name: string }
  | { kind: 'shape'; name: string; vertex: number; count: number };
export interface VertexJourney { subject: JourneySubject; stages: JourneyStage[] }
export interface JourneyScene { objects: readonly SceneNode[]; viewportLimits: ViewportLimits; textures: readonly TextureAsset[] }
export interface CanvasSize { width: number; height: number }
export const STAGE_INFO: Record<JourneyStageId, { title: string; section: CurriculumSection; description: string }>;
export function vertexJourney(scene: JourneyScene, objectId: string | null, vertexIndex: number, canvas: CanvasSize): VertexJourney;
export function texelOf(uv: UV, size: { width: number; height: number }, wrap: TextureWrap): Point;
```

- Produces, in `@/entities/scene/model/primitive-assembly`:

```ts
export interface Assembly { result: string; sentence: string; note: string; primitives: number[]; members: number[][] }
export function assemblyFor(type: PrimitiveType, index: number, count: number): Assembly;
export function provokingVertex(type: PrimitiveType, index: number, count: number): number;
```

- Produces, in `@/shared/lib/format-number`:

```ts
export function fmt(n: number): string;      // two decimals, true minus, no −0.00
export function short(n: number): string;    // up to two decimals: 1, 1.6, 0.85
```

What this task computes:
- **Results for every stage**, which the closed rows show.
- **Working rows for Transformed and Projected only** (build step 2). Tasks 17–20 add rows for the other four.
- **Inputs** are wrapped `{ input }`; they render amber.

Plan ruling, the journey's spelling and numbers: follow the mock. Points show two decimals ("(0.27, 0.31)"). Scale and rotate inputs show as few decimals as they need ("scale 1, 1", "rotate 15°"); move inputs show two ("move 0.40, −0.17").

- [ ] **Step 1: Extend the reference implementation**

Append to `tests/helpers/matrix.ts`:

```ts
/** glOrtho's mapping of a point in the viewing volume to normalised device coordinates. */
export function orthoToNdc(
  p: { x: number; y: number },
  v: { minX: number; maxX: number; minY: number; maxY: number },
): { x: number; y: number } {
  return {
    x: (2 * (p.x - v.minX)) / (v.maxX - v.minX) - 1,
    y: (2 * (p.y - v.minY)) / (v.maxY - v.minY) - 1,
  };
}

/** The default viewport's mapping of NDC to window pixels, counted from the bottom-left as OpenGL does. */
export function ndcToWindow(p: { x: number; y: number }, size: { width: number; height: number }): { x: number; y: number } {
  return { x: Math.floor(((p.x + 1) / 2) * size.width), y: Math.floor(((p.y + 1) / 2) * size.height) };
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/white-box/vertex-journey.test.ts`:

```ts
/**
 * WHITE-BOX TEST SUITE — WB-JOURNEY
 * The vertex journey's numbers, checked against the independent reference in tests/helpers/matrix.ts.
 */
import { describe, it, expect } from 'vitest';
import { vertexJourney, type JourneyScene } from '@/features/math-panel/model/vertex-journey';
import { assemblyFor, provokingVertex } from '@/entities/scene/model/primitive-assembly';
import { fmt, short } from '@/shared/lib/format-number';
import type { PrimitiveType, SceneNode, TransformState } from '@/core/types/scene';
import { makeMatrix, multiply, transformPoint, orthoToNdc, ndcToWindow, IDENTITY } from '../helpers/matrix';

const T = (t: Partial<TransformState> = {}): TransformState => ({ translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1, ...t });
function node(id: string, type: SceneNode['type'], points: [number, number][], transform: Partial<TransformState> = {}, extra: Partial<SceneNode> = {}): SceneNode {
  return {
    id, name: id, type, visible: true, shading: 'SMOOTH', transform: T(transform), parentId: null, children: [],
    vertices: points.map(([x, y], i) => ({ id: `${id}-v${i}`, x, y, color: '#ffffff' })), ...extra,
  };
}
const scene = (objects: SceneNode[], limits = { minX: -1, maxX: 1, minY: -1, maxY: 1 }): JourneyScene => ({ objects, viewportLimits: limits, textures: [] });
const CANVAS = { width: 586, height: 500 };
const stage = (j: ReturnType<typeof vertexJourney>, id: string) => j.stages.find((s) => s.id === id)!;

/** The mocks' triangle: vertex 1 at (0, 0.5), moved 0.40, −0.17 and turned 15°. */
const mockTriangle = () => node('Triangle', 'TRIANGLES', [[0, 0.5], [-0.5, -0.5], [0.5, -0.5]], { translateX: 0.4, translateY: -0.17, rotate: 15 }, {
  vertices: [
    { id: 'v0', x: 0, y: 0.5, color: '#ff6633' }, { id: 'v1', x: -0.5, y: -0.5, color: '#3399ff' }, { id: 'v2', x: 0.5, y: -0.5, color: '#55dd88' },
  ],
});

describe('WB-JOURNEY-01: Each stage\'s numbers match the reference', () => {
  it('transforms, projects and rasterises the mocks\' vertex 1 as the reference does', () => {
    const tri = mockTriangle();
    const j = vertexJourney(scene([tri]), 'Triangle', 0, CANVAS);
    const world = transformPoint(makeMatrix(tri.transform), { x: 0, y: 0.5 });
    const ndc = orthoToNdc(world, scene([]).viewportLimits);
    const px = ndcToWindow(ndc, CANVAS);
    expect(stage(j, 'stored').result).toBe('(0.00, 0.50)');
    expect(stage(j, 'transformed').point!.x).toBeCloseTo(world.x, 10);
    expect(stage(j, 'transformed').point!.y).toBeCloseTo(world.y, 10);
    expect(stage(j, 'transformed').result).toBe('(0.27, 0.31)');
    expect(stage(j, 'projected').result).toBe('NDC (0.27, 0.31)');
    expect(stage(j, 'rasterised').point).toEqual(px);
    expect(stage(j, 'rasterised').result).toBe(`pixel (${px.x}, ${px.y})`);
    expect(stage(j, 'assembled').result).toBe('triangle, 1 of 3');
    expect(stage(j, 'coloured').result).toBe('rgb(1.0, 0.4, 0.2)');
    expect(j.subject).toEqual({ kind: 'shape', name: 'Triangle', vertex: 0, count: 3 });
  });

  it('works the Transformed stage as scale, rotate, move, with the student\'s inputs marked', () => {
    const j = vertexJourney(scene([mockTriangle()]), 'Triangle', 0, CANVAS);
    const rows = stage(j, 'transformed').rows;
    expect(rows.map((r) => r.call)).toEqual(['glVertex2f', 'glScalef', 'glRotatef', 'glTranslatef']);
    expect(rows[0]).toMatchObject({ step: ['from Stored'], value: '(0.00, 0.50)', from: true });
    expect(rows[1].step).toEqual(['scale ', { input: '1' }, ', ', { input: '1' }]);
    expect(rows[2]).toMatchObject({ step: ['rotate ', { input: '15°' }], value: '(−0.13, 0.48)' });
    expect(rows[3]).toMatchObject({ step: ['move ', { input: '0.40' }, ', ', { input: '−0.17' }], value: '(0.27, 0.31)' });
    const proj = stage(j, 'projected').rows;
    expect(proj[0]).toMatchObject({ step: ['from Transformed'], value: '(0.27, 0.31)', call: null, from: true });
    expect(proj[1]).toMatchObject({ step: ['volume x ', { input: '−1' }, '…', { input: '1' }], value: 'x → 0.27', call: 'glOrtho' });
    expect(proj[2]).toMatchObject({ step: ['volume y ', { input: '−1' }, '…', { input: '1' }], value: 'y → 0.31', call: 'glOrtho' });
  });
});

describe('WB-JOURNEY-02: Enclosing groups apply after the object, innermost first', () => {
  it('matches the reference parent · child product and names each group in its rows', () => {
    const outer = node('Outer', 'GROUP', [], { translateX: 0.2, rotate: 30, scaleX: 0.5, scaleY: 0.5 });
    const inner = node('Inner', 'GROUP', [], { translateY: -0.3, rotate: -10 }, { parentId: 'Outer' });
    const quad = node('Quad', 'QUADS', [[0.1, 0.2], [0.3, 0.2], [0.3, 0.4], [0.1, 0.4]], { translateX: 0.05, scaleX: 2, scaleY: 1.5 }, { parentId: 'Inner' });
    const j = vertexJourney(scene([outer, inner, quad]), 'Quad', 2, CANVAS);
    const m = multiply(makeMatrix(outer.transform), multiply(makeMatrix(inner.transform), makeMatrix(quad.transform)));
    const world = transformPoint(m, { x: 0.3, y: 0.4 });
    expect(stage(j, 'transformed').point!.x).toBeCloseTo(world.x, 10);
    expect(stage(j, 'transformed').point!.y).toBeCloseTo(world.y, 10);
    const steps = stage(j, 'transformed').rows.map((r) => (typeof r.step[0] === 'string' ? r.step[0] : ''));
    expect(steps).toEqual(['from Stored', 'scale ', 'rotate ', 'move ', 'Inner: scale ', 'Inner: rotate ', 'Inner: move ', 'Outer: scale ', 'Outer: rotate ', 'Outer: move ']);
    void IDENTITY;
  });
});

describe('WB-JOURNEY-03: A wider viewing volume changes the projection', () => {
  it('projects with the student\'s bounds, as the reference does', () => {
    const limits = { minX: -2, maxX: 4, minY: -1.5, maxY: 0.5 };
    const tri = mockTriangle();
    const j = vertexJourney(scene([tri], limits), 'Triangle', 1, CANVAS);
    const world = transformPoint(makeMatrix(tri.transform), { x: -0.5, y: -0.5 });
    const ndc = orthoToNdc(world, limits);
    expect(stage(j, 'projected').point!.x).toBeCloseTo(ndc.x, 10);
    expect(stage(j, 'projected').point!.y).toBeCloseTo(ndc.y, 10);
    expect(stage(j, 'projected').rows[1].step).toEqual(['volume x ', { input: '−2' }, '…', { input: '4' }]);
  });
});

describe('WB-JOURNEY-04: Every primitive type assembles by its own rule', () => {
  it('places the vertex in its primitive, or says it is not drawn', () => {
    const cases: Array<[PrimitiveType, number, number, string]> = [
      ['POINTS', 1, 3, 'point 2 of 3'],
      ['LINES', 2, 4, 'line 2, end 1 of 2'],
      ['LINES', 2, 3, 'not drawn'],
      ['LINE_STRIP', 1, 3, 'lines 1 and 2'],
      ['LINE_STRIP', 0, 3, 'line 1, end 1 of 2'],
      ['LINE_LOOP', 0, 3, 'lines 1 and 3'],
      ['TRIANGLES', 0, 3, 'triangle, 1 of 3'],
      ['TRIANGLES', 4, 6, 'triangle 2, 2 of 3'],
      ['TRIANGLES', 3, 4, 'not drawn'],
      ['TRIANGLE_STRIP', 2, 5, 'triangles 1–3'],
      ['TRIANGLE_FAN', 0, 5, 'triangles 1–3'],
      ['TRIANGLE_FAN', 1, 5, 'triangle 1, 2 of 3'],
      ['QUADS', 5, 8, 'quad 2, 2 of 4'],
      ['QUAD_STRIP', 2, 6, 'quads 1 and 2'],
      ['POLYGON', 3, 5, 'polygon, 4 of 5'],
    ];
    for (const [type, i, n, result] of cases) expect(assemblyFor(type, i, n).result, `${type} ${i}/${n}`).toBe(result);
    expect(assemblyFor('TRIANGLES', 0, 3).sentence).toBe('Every 3 vertices make one triangle; this is corner 1 of triangle 1.');
    expect(assemblyFor('TRIANGLES', 0, 3).note).toBe('every 3 vertices make a triangle');
  });
});

describe('WB-JOURNEY-05: Flat shading takes the provoking vertex\'s colour', () => {
  it('uses the last vertex of the primitive, or the first for a polygon', () => {
    expect(provokingVertex('TRIANGLES', 0, 6)).toBe(2);
    expect(provokingVertex('TRIANGLES', 4, 6)).toBe(5);
    expect(provokingVertex('TRIANGLE_STRIP', 0, 4)).toBe(2);
    expect(provokingVertex('QUADS', 1, 4)).toBe(3);
    expect(provokingVertex('POLYGON', 3, 5)).toBe(0);
    const tri = mockTriangle();
    const flat = { ...tri, shading: 'FLAT' as const };
    expect(stage(vertexJourney(scene([flat]), 'Triangle', 0, CANVAS), 'coloured').result).toBe('rgb(0.3, 0.9, 0.5)');
    expect(stage(vertexJourney(scene([tri]), 'Triangle', 1, CANVAS), 'coloured').result).toBe('rgb(0.2, 0.6, 1.0)');
  });
});

describe('WB-JOURNEY-06: A textured vertex reads its texel', () => {
  it('maps the UV to a texel for the texture\'s size, with repeat and clamp', () => {
    const quad = node('Quad', 'QUADS', [[0, 0], [1, 0], [1, 1], [0, 1]], {}, {
      texture: { textureId: 'tex', filter: 'NEAREST', wrap: 'REPEAT' },
      uvs: [{ u: 0, v: 0 }, { u: 1.25, v: 0 }, { u: 1, v: 1 }, { u: 0, v: 1 }],
    });
    const textured: JourneyScene = { ...scene([quad]), textures: [{ id: 'tex', name: 'Bricks', dataUrl: '', width: 64, height: 32 }] };
    expect(stage(vertexJourney(textured, 'Quad', 1, CANVAS), 'coloured').result).toBe('texel (16, 0)');
    expect(stage(vertexJourney(textured, 'Quad', 2, CANVAS), 'coloured').result).toBe('texel (0, 0)');
    const clamped = { ...textured, objects: [{ ...quad, texture: { ...quad.texture!, wrap: 'CLAMP_TO_EDGE' as const } }] };
    expect(stage(vertexJourney(clamped, 'Quad', 1, CANVAS), 'coloured').result).toBe('texel (63, 0)');
    expect(stage(vertexJourney(textured, 'Quad', 1, CANVAS), 'coloured').section).toBe('Textures');
  });
});

describe('WB-JOURNEY-07: Text, groups and nothing selected', () => {
  it('follows the text\'s raster position, gives a group its own transform, and leaves results empty with nothing', () => {
    const text = node('Hello', 'TEXT', [[0, 0]], { translateX: 0.1, translateY: 0.2 }, { textContent: 'Hello' });
    const tj = vertexJourney(scene([text]), 'Hello', 0, CANVAS);
    expect(tj.subject).toEqual({ kind: 'text', name: 'Hello' });
    expect(stage(tj, 'stored').result).toBe('(0.00, 0.00)');
    expect(stage(tj, 'transformed').result).toBe('(0.10, 0.20)');
    expect(stage(tj, 'assembled').sentence).toBe('Text is drawn as bitmap characters at this position, not assembled from vertices.');
    const group = node('House', 'GROUP', [], { translateX: 0.2, translateY: 0.1 });
    const gj = vertexJourney(scene([group]), 'House', 0, CANVAS);
    expect(gj.subject).toEqual({ kind: 'group', name: 'House' });
    expect(stage(gj, 'transformed').result).toBe('(0.20, 0.10)');
    expect(stage(gj, 'stored').result).toBeNull();
    const none = vertexJourney(scene([group]), null, 0, CANVAS);
    expect(none.subject).toEqual({ kind: 'none' });
    expect(none.stages.map((s) => s.title)).toEqual(['Stored', 'Transformed', 'Projected', 'Assembled', 'Rasterised', 'Coloured']);
    expect(none.stages.every((s) => s.result === null && s.rows.length === 0 && s.sentence.length > 0)).toBe(true);
  });
});

describe('WB-JOURNEY-08: The followed vertex is clamped to the object', () => {
  it('follows the last vertex when the index is past it', () => {
    const j = vertexJourney(scene([mockTriangle()]), 'Triangle', 9, CANVAS);
    expect(j.subject).toEqual({ kind: 'shape', name: 'Triangle', vertex: 2, count: 3 });
    expect(stage(j, 'stored').result).toBe('(0.50, −0.50)');
  });
});

describe('WB-JOURNEY-09: Numbers read like the mock', () => {
  it('uses a true minus sign, never shows −0.00, and keeps short inputs short', () => {
    expect(fmt(-0.17)).toBe('−0.17');
    expect(fmt(-0.001)).toBe('0.00');
    expect(fmt(0.4)).toBe('0.40');
    expect(short(1)).toBe('1');
    expect(short(1.6)).toBe('1.6');
    expect(short(-0.85)).toBe('−0.85');
    const j = vertexJourney(scene([mockTriangle()]), 'Triangle', 1, CANVAS);
    // Every string a student reads: sentences, results and the working.
    const text = JSON.stringify(j.stages.map((s) => [s.sentence, s.result, s.rows]));
    expect(text).toContain('−0.50');
    expect(text).not.toMatch(/-\d/);
    expect(text).not.toMatch(/coming soon|not supported|future|deferred|\b3D\b|lighting/i);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/white-box/vertex-journey.test.ts`
Expected: FAIL with `Failed to resolve import "@/features/math-panel/model/vertex-journey"`.

- [ ] **Step 4: Write the model**

Create `src/shared/lib/format-number.ts`:

```ts
/** Numbers as students read them: a true minus sign (U+2212), and never "−0.00". */

const minus = (s: string) => s.replace('-', '−');
const zeroed = (n: number) => (Math.abs(n) < 0.005 ? 0 : n);

/** Two decimals with a true minus sign, and no "−0.00". */
export function fmt(n: number): string {
  return minus(zeroed(n).toFixed(2));
}

/** As few decimals as the number needs, up to two: 1, 1.6, 0.85. */
export function short(n: number): string {
  return minus(String(Number(zeroed(n).toFixed(2))));
}
```

Create `src/entities/scene/model/primitive-assembly.ts`:

```ts
import type { PrimitiveType } from '@/core/types/scene';

/** How each primitive type groups its vertices (glBegin's mode). Pure. */

interface Rule {
  noun: string;
  plural: string;
  /** Lines call each vertex of a line an end; shapes call it a corner. */
  part: 'end' | 'corner' | null;
  rule: string;
  note: string;
  total: (n: number) => number;
  members: (j: number, n: number) => number[];
}

const span = (from: number, count: number) => Array.from({ length: count }, (_, k) => from + k);

const RULES: Record<PrimitiveType, Rule> = {
  POINTS: { noun: 'point', plural: 'points', part: null, rule: 'each vertex is drawn as its own point', note: 'each vertex is one point', total: (n) => n, members: (j) => [j] },
  LINES: { noun: 'line', plural: 'lines', part: 'end', rule: 'every 2 vertices make one line', note: 'every 2 vertices make a line', total: (n) => Math.floor(n / 2), members: (j) => span(2 * j, 2) },
  LINE_STRIP: { noun: 'line', plural: 'lines', part: 'end', rule: 'each vertex after the first adds a line from the one before', note: 'each vertex extends the line', total: (n) => Math.max(0, n - 1), members: (j) => [j, j + 1] },
  LINE_LOOP: { noun: 'line', plural: 'lines', part: 'end', rule: 'a line joins each vertex to the next, and the last back to the first', note: 'a closed line through every vertex', total: (n) => (n >= 2 ? n : 0), members: (j, n) => [j, (j + 1) % n] },
  TRIANGLES: { noun: 'triangle', plural: 'triangles', part: 'corner', rule: 'every 3 vertices make one triangle', note: 'every 3 vertices make a triangle', total: (n) => Math.floor(n / 3), members: (j) => span(3 * j, 3) },
  TRIANGLE_STRIP: { noun: 'triangle', plural: 'triangles', part: 'corner', rule: 'each vertex after the second makes a triangle with the two before it', note: 'each new vertex adds a triangle', total: (n) => Math.max(0, n - 2), members: (j) => span(j, 3) },
  TRIANGLE_FAN: { noun: 'triangle', plural: 'triangles', part: 'corner', rule: 'every triangle shares vertex 1, fanning out around it', note: 'triangles fan out from vertex 1', total: (n) => Math.max(0, n - 2), members: (j) => [0, j + 1, j + 2] },
  QUADS: { noun: 'quad', plural: 'quads', part: 'corner', rule: 'every 4 vertices make one quad', note: 'every 4 vertices make a quad', total: (n) => Math.floor(n / 4), members: (j) => span(4 * j, 4) },
  QUAD_STRIP: { noun: 'quad', plural: 'quads', part: 'corner', rule: 'each new pair of vertices makes a quad with the pair before', note: 'each new pair adds a quad', total: (n) => Math.max(0, Math.floor((n - 2) / 2)), members: (j) => [2 * j, 2 * j + 1, 2 * j + 3, 2 * j + 2] },
  POLYGON: { noun: 'polygon', plural: 'polygons', part: 'corner', rule: 'all the vertices make one polygon', note: 'all vertices make one polygon', total: (n) => (n >= 3 ? 1 : 0), members: (_j, n) => span(0, n) },
};

/** "1 and 2", "1–3", "1, 3 and 4". */
function list(numbers: number[]): string {
  const consecutive = numbers.every((v, k) => k === 0 || v === numbers[k - 1] + 1);
  if (numbers.length > 2 && consecutive) return `${numbers[0]}–${numbers[numbers.length - 1]}`;
  if (numbers.length === 1) return `${numbers[0]}`;
  return `${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]}`;
}

export interface Assembly {
  /** What the closed Assembled row shows. */
  result: string;
  /** The open stage's sentence. */
  sentence: string;
  /** The code panel's short note on the draw call. */
  note: string;
  /** The primitives the vertex is part of, 0-based. */
  primitives: number[];
  /** Each of those primitives' vertices, 0-based. */
  members: number[][];
}

export function assemblyFor(type: PrimitiveType, index: number, count: number): Assembly {
  const r = RULES[type];
  const total = r.total(count);
  const primitives = span(0, total).filter((j) => r.members(j, count).includes(index));
  const members = primitives.map((j) => r.members(j, count));
  const capitalised = r.rule[0].toUpperCase() + r.rule.slice(1);
  if (primitives.length === 0) {
    return { result: 'not drawn', sentence: `${capitalised}; this vertex is left over, so it is not drawn.`, note: r.note, primitives, members };
  }
  if (primitives.length === 1) {
    const j = primitives[0];
    const own = members[0];
    if (own.length === 1) {
      return { result: `${r.noun} ${j + 1} of ${total}`, sentence: `${capitalised}; this is ${r.noun} ${j + 1}.`, note: r.note, primitives, members };
    }
    const at = own.indexOf(index) + 1;
    const which = total > 1 ? ` ${j + 1}` : '';
    return {
      result: `${r.noun}${which}, ${r.part === 'end' ? 'end ' : ''}${at} of ${own.length}`,
      sentence: `${capitalised}; this is ${r.part} ${at} of ${r.noun} ${j + 1}.`,
      note: r.note,
      primitives,
      members,
    };
  }
  const numbers = list(primitives.map((j) => j + 1));
  return { result: `${r.plural} ${numbers}`, sentence: `${capitalised}; this vertex is in ${r.plural} ${numbers}.`, note: r.note, primitives, members };
}

/** The vertex whose colour a flat-shaded primitive takes: its last, or a polygon's first. */
export function provokingVertex(type: PrimitiveType, index: number, count: number): number {
  const members = assemblyFor(type, index, count).members[0];
  if (!members) return index;
  return type === 'POLYGON' ? members[0] : members[members.length - 1];
}
```

Create `src/features/math-panel/model/vertex-journey.ts`:

```ts
import type { CurriculumSection } from '@/core/store/types';
import { JOURNEY_STAGES, type JourneyStageId } from '@/core/inspector/journey-stage';
import type { PrimitiveType, SceneNode, TransformState, ViewportLimits } from '@/core/types/scene';
import type { TextureAsset, TextureWrap, UV } from '@/core/types/textures';
import { assemblyFor, provokingVertex } from '@/entities/scene/model/primitive-assembly';
import { fmt, short } from '@/shared/lib/format-number';

export interface Point {
  x: number;
  y: number;
}

/** A step's words; `{ input }` is one of the student's own values, shown in amber. */
export type StepPart = string | { input: string };

export interface WorkingRow {
  step: StepPart[];
  value: string;
  /** The GL call that performs the step, or null. */
  call: string | null;
  /** The first row: where the value came from. */
  from?: boolean;
}

export interface JourneyStage {
  id: JourneyStageId;
  title: string;
  section: CurriculumSection;
  sentence: string;
  rows: WorkingRow[];
  /** What the closed row shows, and the working's last row. Null when there is nothing to follow. */
  result: string | null;
  point: Point | null;
}

export type JourneySubject =
  | { kind: 'none' }
  | { kind: 'group'; name: string }
  | { kind: 'text'; name: string }
  | { kind: 'shape'; name: string; vertex: number; count: number };

export interface VertexJourney {
  subject: JourneySubject;
  stages: JourneyStage[];
}

export interface JourneyScene {
  objects: readonly SceneNode[];
  viewportLimits: ViewportLimits;
  textures: readonly TextureAsset[];
}

export interface CanvasSize {
  width: number;
  height: number;
}

export const STAGE_INFO: Record<JourneyStageId, { title: string; section: CurriculumSection; description: string }> = {
  stored: { title: 'Stored', section: 'Buffers', description: 'Where a vertex is kept before drawing.' },
  transformed: { title: 'Transformed', section: 'Transforms', description: 'Moved, turned and scaled into place.' },
  projected: { title: 'Projected', section: 'Transforms', description: 'Fitted into the −1 to 1 box.' },
  assembled: { title: 'Assembled', section: 'Primitives', description: 'Joined into points, lines or shapes.' },
  rasterised: { title: 'Rasterised', section: 'Pipeline', description: 'Turned into pixels in the window.' },
  coloured: { title: 'Coloured', section: 'Primitives', description: 'Given its final colour.' },
};

const TRANSFORMED = 'Scale, rotate and move act on the vertex in the reverse of the order they appear in the code.';
const PROJECTED = 'Your viewing volume is squeezed into a −1 to 1 box on each axis, called normalised device coordinates (NDC).';
const RASTERISED = 'NDC is stretched to the window’s pixels, counted from the bottom-left corner as OpenGL does.';
const SMOOTH = 'With smooth shading, each pixel inside the shape mixes the vertex colours by how close it is to each one.';
const FLAT = 'With flat shading, the whole shape takes the colour of one vertex.';
const TEXTURED = 'Each pixel reads its colour from the texture, at the UV the vertices carry.';
const TEXT_STORED = 'The text starts at its raster position, set by glRasterPos2f in the text’s own coordinates.';
const TEXT_ASSEMBLED = 'Text is drawn as bitmap characters at this position, not assembled from vertices.';
const GROUP_TRANSFORMED = 'A group moves, turns and scales everything inside it. This is where its origin lands.';

const STORED_BY_MODE = {
  IMMEDIATE: 'Your vertex is sent straight to OpenGL by glVertex2f, one call per vertex.',
  VERTEX_ARRAY: 'Your vertex sits in a C array in the program’s memory; the draw call reads it from there.',
  VBO: 'Your vertex was copied to a buffer on the GPU once, in init(); drawing reads it from there.',
} as const;

const pair = (p: Point) => `(${fmt(p.x)}, ${fmt(p.y)})`;

function stage(id: JourneyStageId, sentence: string, rows: WorkingRow[], result: string | null, point: Point | null): JourneyStage {
  const info = STAGE_INFO[id];
  return { id, title: info.title, section: info.section, sentence, rows, result, point };
}

function blankStages(): JourneyStage[] {
  return JOURNEY_STAGES.map((id) => stage(id, STAGE_INFO[id].description, [], null, null));
}

/** The object, then each enclosing group, innermost first. */
function chainOf(node: SceneNode, objects: readonly SceneNode[]): SceneNode[] {
  const byId = new Map(objects.map((o) => [o.id, o]));
  const chain = [node];
  let parent = node.parentId ? byId.get(node.parentId) : undefined;
  while (parent && !chain.includes(parent)) {
    chain.push(parent);
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return chain;
}

/** Scale, then rotate, then move, for the object and then each enclosing group. */
function transformRows(start: Point, chain: readonly SceneNode[]): { rows: WorkingRow[]; end: Point } {
  let p = start;
  const rows: WorkingRow[] = [];
  chain.forEach((node, depth) => {
    const t: TransformState = node.transform;
    const scope = depth === 0 ? '' : `${node.name}: `;
    p = { x: p.x * t.scaleX, y: p.y * t.scaleY };
    rows.push({ step: [`${scope}scale `, { input: short(t.scaleX) }, ', ', { input: short(t.scaleY) }], value: pair(p), call: 'glScalef' });
    const r = (t.rotate * Math.PI) / 180;
    p = { x: p.x * Math.cos(r) - p.y * Math.sin(r), y: p.x * Math.sin(r) + p.y * Math.cos(r) };
    rows.push({ step: [`${scope}rotate `, { input: `${short(t.rotate)}°` }], value: pair(p), call: 'glRotatef' });
    p = { x: p.x + t.translateX, y: p.y + t.translateY };
    rows.push({ step: [`${scope}move `, { input: fmt(t.translateX) }, ', ', { input: fmt(t.translateY) }], value: pair(p), call: 'glTranslatef' });
  });
  return { rows, end: p };
}

function ndcOf(p: Point, v: ViewportLimits): Point {
  return { x: (2 * (p.x - v.minX)) / (v.maxX - v.minX) - 1, y: (2 * (p.y - v.minY)) / (v.maxY - v.minY) - 1 };
}

function pixelOf(n: Point, c: CanvasSize): Point {
  return { x: Math.floor(((n.x + 1) / 2) * c.width), y: Math.floor(((n.y + 1) / 2) * c.height) };
}

function projectedRows(world: Point, ndc: Point, v: ViewportLimits): WorkingRow[] {
  return [
    { step: ['from Transformed'], value: pair(world), call: null, from: true },
    { step: ['volume x ', { input: short(v.minX) }, '…', { input: short(v.maxX) }], value: `x → ${fmt(ndc.x)}`, call: 'glOrtho' },
    { step: ['volume y ', { input: short(v.minY) }, '…', { input: short(v.maxY) }], value: `y → ${fmt(ndc.y)}`, call: 'glOrtho' },
  ];
}

// --- Colour -----------------------------------------------------------------------------------

function rgbOf(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}

const rgbText = ([r, g, b]: [number, number, number]) => `rgb(${r.toFixed(1)}, ${g.toFixed(1)}, ${b.toFixed(1)})`;

function wrapped(c: number, wrap: TextureWrap): number {
  return wrap === 'REPEAT' ? c - Math.floor(c) : Math.min(1, Math.max(0, c));
}

/** The texel a UV reads, before filtering. */
export function texelOf(uv: UV, size: { width: number; height: number }, wrap: TextureWrap): Point {
  return {
    x: Math.min(size.width - 1, Math.floor(wrapped(uv.u, wrap) * size.width)),
    y: Math.min(size.height - 1, Math.floor(wrapped(uv.v, wrap) * size.height)),
  };
}

function colouredStage(node: SceneNode, index: number, scene: JourneyScene): JourneyStage {
  const uv = node.uvs?.[index];
  if (node.texture && uv && node.uvs!.length === node.vertices.length) {
    const tex = scene.textures.find((t) => t.id === node.texture!.textureId);
    const result = tex ? `texel (${texelOf(uv, tex, node.texture.wrap).x}, ${texelOf(uv, tex, node.texture.wrap).y})` : 'texture missing';
    return { ...stage('coloured', TEXTURED, [], result, null), section: 'Textures' };
  }
  const flat = node.shading === 'FLAT';
  const source = flat ? provokingVertex(node.type as PrimitiveType, index, node.vertices.length) : index;
  return stage('coloured', flat ? FLAT : SMOOTH, [], rgbText(rgbOf(node.vertices[source]?.color ?? '#ffffff')), null);
}

// --- The journey ------------------------------------------------------------------------------

function shapeJourney(node: SceneNode, scene: JourneyScene, vertexIndex: number, canvas: CanvasSize): VertexJourney {
  const count = node.vertices.length;
  if (count === 0) return { subject: { kind: 'shape', name: node.name, vertex: 0, count: 0 }, stages: blankStages() };
  const i = Math.min(Math.max(0, Math.floor(vertexIndex)), count - 1);
  const v = node.vertices[i];
  const stored = { x: v.x, y: v.y };
  const { rows: moves, end: world } = transformRows(stored, chainOf(node, scene.objects));
  const ndc = ndcOf(world, scene.viewportLimits);
  const pixel = pixelOf(ndc, canvas);
  const mode = node.renderingMode ?? 'IMMEDIATE';
  const assembly = assemblyFor(node.type as PrimitiveType, i, count);
  return {
    subject: { kind: 'shape', name: node.name, vertex: i, count },
    stages: [
      stage('stored', STORED_BY_MODE[mode], [], pair(stored), stored),
      stage('transformed', TRANSFORMED, [
        { step: ['from Stored'], value: pair(stored), call: mode === 'IMMEDIATE' ? 'glVertex2f' : 'glVertexPointer', from: true },
        ...moves,
      ], pair(world), world),
      stage('projected', PROJECTED, projectedRows(world, ndc, scene.viewportLimits), `NDC ${pair(ndc)}`, ndc),
      stage('assembled', assembly.sentence, [], assembly.result, null),
      stage('rasterised', RASTERISED, [], `pixel (${pixel.x}, ${pixel.y})`, pixel),
      colouredStage(node, i, scene),
    ],
  };
}

function textJourney(node: SceneNode, scene: JourneyScene, canvas: CanvasSize): VertexJourney {
  // generator/render.ts centres the lines around the origin, 0.07 apart; the first line starts highest.
  const lines = (node.textContent ?? '').split('\n').length;
  const raster = { x: 0, y: ((lines - 1) / 2) * 0.07 };
  const { rows: moves, end: world } = transformRows(raster, chainOf(node, scene.objects));
  const ndc = ndcOf(world, scene.viewportLimits);
  const pixel = pixelOf(ndc, canvas);
  return {
    subject: { kind: 'text', name: node.name },
    stages: [
      stage('stored', TEXT_STORED, [], pair(raster), raster),
      stage('transformed', TRANSFORMED, [{ step: ['from Stored'], value: pair(raster), call: 'glRasterPos2f', from: true }, ...moves], pair(world), world),
      stage('projected', PROJECTED, projectedRows(world, ndc, scene.viewportLimits), `NDC ${pair(ndc)}`, ndc),
      stage('assembled', TEXT_ASSEMBLED, [], 'bitmap text', null),
      stage('rasterised', RASTERISED, [], `pixel (${pixel.x}, ${pixel.y})`, pixel),
      stage('coloured', 'The text takes the colour set by glColor3f just before it.', [], rgbText(rgbOf(node.vertices[0]?.color ?? '#ffffff')), null),
    ],
  };
}

function groupJourney(node: SceneNode, scene: JourneyScene): VertexJourney {
  const origin = { x: 0, y: 0 };
  const { rows: moves, end: world } = transformRows(origin, chainOf(node, scene.objects));
  const stages = blankStages().map((s) =>
    s.id === 'transformed'
      ? stage('transformed', GROUP_TRANSFORMED, [{ step: ['group origin'], value: pair(origin), call: null, from: true }, ...moves], pair(world), world)
      : s,
  );
  return { subject: { kind: 'group', name: node.name }, stages };
}

/**
 * Follows one vertex of the selected object from where it was typed to the pixel it lands on,
 * with the student's own numbers. Text follows its raster position; a group has no vertices, so
 * only its own transform is worked.
 */
export function vertexJourney(scene: JourneyScene, objectId: string | null, vertexIndex: number, canvas: CanvasSize): VertexJourney {
  const node = objectId ? scene.objects.find((o) => o.id === objectId) : undefined;
  if (!node) return { subject: { kind: 'none' }, stages: blankStages() };
  if (node.type === 'GROUP') return groupJourney(node, scene);
  if (node.type === 'TEXT') return textJourney(node, scene, canvas);
  return shapeJourney(node, scene, vertexIndex, canvas);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/white-box/vertex-journey.test.ts`
Expected: PASS (10 tests).

If an expected string in WB-JOURNEY-04 or 05 differs, first check the case against the rule table above (for example, LINE_LOOP vertex 0 of 3 is in lines 1 and 3). Change the code only when the rule is wrong, and never weaken the test.

- [ ] **Step 6: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/shared/lib/format-number.ts src/entities/scene/model/primitive-assembly.ts src/features/math-panel/model/vertex-journey.ts tests/helpers/matrix.ts tests/white-box/vertex-journey.test.ts
git diff --staged
git commit -m "feat(math): compute the six-stage journey of one vertex with the student's numbers"
```

---

### Task 10: The journey panel

**Files:**
- Move: `src/features/code-generation/model/useCanvasSize.ts` → `src/shared/lib/use-canvas-size.ts`. Update its two importers: `SceneCodePanel.tsx` and `useLessonRunner.ts`.
- Rewrite: `src/features/math-panel/ui/MathPanel.tsx`
- Create:
  - `src/features/math-panel/ui/journey/JourneyFollow.tsx`
  - `src/features/math-panel/ui/journey/JourneyTrack.tsx`
  - `src/features/math-panel/ui/journey/WorkingTable.tsx`
  - `src/features/math-panel/ui/journey/stage-pictures.tsx`
  - `src/features/math-panel/ui/journey/journey.scss`
- Modify:
  - `src/features/math-panel/ui/TransformsMathContent.tsx`: export `buildMatrix4`, `getAncestorChain`, `Matrix4`, `TRSCompositionTrace`, `MatrixStack` and `OrthoMapping`; delete the default export.
  - `src/features/math-panel/ui/PrimitivesMathContent.tsx`: export `isLine`, `ColorConversion`, `StippleBits`, `BarycentricMixer` and `VertexTable`; delete the default export.
  - `src/features/math-panel/ui/math-panel.scss`: drop the tab styles and `@use 'journey/journey'`.
  - `src/features/math-panel/ui/_math-layout.scss`: give the header the code panel's 36 px look and drop its sunken fill and top rule.
- Remove the tabs' state:
  - `mathTabOverride` and `setMathTabOverride`, from `src/core/store/types.ts`, `runtime-slice.ts` and `lesson-slice.ts`;
  - `mathTabFor`, from `src/core/inspector/context-section.ts`;
  - `mathTabOverride`, from `tests/setup.ts` if Task 1 added it there.
- Modify tests:
  - `tests/black-box/editor-inspector.test.ts`: BB-INSP-03, 04 and 06, and the `afterEach`.
  - `tests/black-box/lesson-column.test.ts`: the `mathTabFor` import and its one use.
  - `tests/black-box/math-journey.test.ts`: append.

**Interfaces:**
- Consumes: `vertexJourney` and `STAGE_INFO` (Task 9), `fmt` from `@/shared/lib/format-number` (Task 9); `journeyStageFor` and `JOURNEY_STAGES` (Task 8); the store's `journeyVertex`, `setJourneyVertex` (Task 1) and `setJourneyStageOverride` (Task 8).
- Produces: the default export `MathPanel({ headerLead, headerTrail, contentInert })`, the same props as today, so `CodeMathColumn` does not change.
- Produces these DOM hooks:
  - `.journey`, with `inert` during Run
  - `.journey-follow`, `.journey-follow__ring`, `.journey-follow__vertex` (the live region), and the buttons named "Previous vertex" and "Next vertex"
  - `ol.journey-track` with `li.journey-stage`, plus `.is-done` and `.is-open`
  - Closed rows: `button.journey-stage__row[aria-expanded="false"]`, holding `.journey-stage__name` and `.journey-stage__value`
  - The open stage: `.journey-open__title button[aria-expanded="true"]`, `.journey-open__section`, `.journey-open__why`
  - `table.journey-work`, with `th[scope=col]` heads, `tr.is-from`, `tr.is-result` and `.journey-work__in` for inputs
  - `.journey-open__deeper` (the deeper-detail toggle), and `.journey-open__back` and `.journey-open__next`
- Produces, for Task 15: `WorkingTable` takes an optional `onCall(call: string)`. In this task the Code cell is plain `<code>`.

The look is the mock `journey-h2-v3`. Mapped values:

| Element | Mock | Here |
| --- | --- | --- |
| Follow row | padding 8 px 12 px, rule under, 12.5 px `--muted`, name bold `--ink` | same padding, `--text-sm`, `--ink-muted`, `<b>` `--ink` |
| Ring | 10 px, 2 px `--amber` border | 10 px, 2 px `--value` |
| Stepper buttons | mono 12 px, 1 px `--rule2`, radius 3, padding 1 px 6 px | `--text-sm` mono, `--rule-strong`, `--radius-s` |
| Closed row | padding 8 12 8 36, rule under; line at left 17 px, 2 px `--rule2`; dot 12 px at 12 px / 12 px, `--paper` fill, 2 px `--rule2` border; done → filled `--rule2` | same, `--rule-strong` |
| Closed name / value | 13 px `--muted` / mono 11.5 px `--faint`, right-aligned | `--text-base` `--ink-muted` / `--text-xs` mono `--ink-faint` |
| Open stage | `--raised`, padding 12 14 0 36; line `--accent` at .55; dot `--accent` with a 4 px `rgba(71,98,245,.22)` halo, top 17 px | `--paper-raised`; `--accent`; halo `rgba(var(--accent-rgb), 0.22)` |
| Heading / chip | 16 px; chip 11 px `--dim`, 1 px `--rule2`, radius 10, padding 0 7 | `--text-md`; chip `--text-xs` `--ink-dim`, radius 10 px |
| Sentence | 12.5 px `--muted`, 1.5, margin 4 0 10; code mono `--accent-text` | `--text-sm`; `--code-fn` |
| Working well | `--sunken`, 1 px `--rule`, radius 4, mono 12 px; columns 118 px, 1fr, auto, gap 8, padding 0 10 | `--paper-sunken`, `--radius-s`, `--text-sm` mono; the first column at least 118 px |
| Heads | 24 px, 10 px UI caps .06 em `--dim`, rule under | 24 px, `--text-xs` caps .06 em `--ink-dim` |
| Rows | 27 px; step `--muted`, inputs `--amber`, code 11 px `--accent-text`; from-row step `--dim` | 27 px; `--ink-muted`, `--value`, `--text-xs` `--code-fn`; `--ink-dim` |
| Result | rule-strong above, 30 px; step UI 12.5 px 600 `--ink`; value 600 `--amber` | `--text-sm` 600 `--ink`; 600 `--value` |
| Picture label | 10 px UI caps .06 em `--dim`, 6 px below | `--text-xs` caps `--ink-dim` |
| Footer | rule above, padding 8 14 8 36 bleeding to the stage edge, 12.5 px; links `--accent-text`; "more" 12 px `--faint` | same; `--text-sm`; `--accent-text`; `--ink-faint` |

Plan rulings for this task:
- **Matrix stack.** For an object inside a group, the matrix stack shows among Transformed's pictures, not behind "deeper detail". The Transforms lesson's matrix-stack step names it, and the Transformed rows already walk those groups. Deeper detail keeps the full 4×4 and the T · R · S trace.
- **Picture boxes.** Today's cards keep their content. In the journey they lose their raised-box frame, and their `h4` titles take the mock's picture-label style, because the open stage is already `--paper-raised`.
- **Canvas size.** `useCanvasSize` moves to `shared/lib`, so the math panel does not import from `features/code-generation`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/black-box/math-journey.test.ts`, merging imports:

```ts
import MathPanel from '@/features/math-panel/ui/MathPanel';
import { addTriangle } from '../helpers/store';

/** The mocks' triangle, selected: vertex 1 at (0, 0.5), moved 0.40, −0.17 and turned 15°. */
function mockTriangle() {
  getState().addCustomObject('TRIANGLES', [{ x: 0.4, y: 0.33 }, { x: -0.1, y: -0.67 }, { x: 0.9, y: -0.67 }]);
  const tri = getState().objects[0];
  useVamsStore.setState({
    objects: [{
      ...tri, name: 'Triangle',
      vertices: [
        { id: 'v0', x: 0, y: 0.5, color: '#ff6633' }, { id: 'v1', x: -0.5, y: -0.5, color: '#3399ff' }, { id: 'v2', x: 0.5, y: -0.5, color: '#55dd88' },
      ],
      transform: { translateX: 0.4, translateY: -0.17, rotate: 15, scaleX: 1, scaleY: 1 },
    }],
  });
  getState().selectObject(tri.id);
  return tri.id;
}
const openTitle = (host: HTMLElement) => host.querySelector('.journey-open__title')!.textContent;
const row = (host: HTMLElement, name: string) =>
  [...host.querySelectorAll('.journey-stage__row')].find((b) => b.querySelector('.journey-stage__name')!.textContent === name) as HTMLButtonElement;

describe('BB-JOURNEY-05: The math pane is a track of six stages, one open', () => {
  it('lists the stages in pipeline order, as buttons, with the open stage\'s heading expanded and a real table', async () => {
    mockTriangle();
    useVamsStore.setState({ activeSection: 'Transforms' });
    const host = mount(h(MathPanel, {}));
    await settle();
    expect(host.querySelector('[role="tablist"]')).toBeNull();
    const stages = [...host.querySelectorAll('ol.journey-track > li.journey-stage')];
    expect(stages.map((li) => li.querySelector('.journey-stage__name, .journey-open__title')!.textContent)).toEqual(
      ['Stored', 'Transformed', 'Projected', 'Assembled', 'Rasterised', 'Coloured']);
    expect(stages.map((li) => li.classList.contains('is-done'))).toEqual([true, false, false, false, false, false]);
    expect(host.querySelectorAll('button.journey-stage__row[aria-expanded="false"]')).toHaveLength(5);
    expect(host.querySelector('.journey-open__title button')!.getAttribute('aria-expanded')).toBe('true');
    expect([...host.querySelectorAll('table.journey-work thead th')].map((th) => [th.textContent, th.getAttribute('scope')])).toEqual(
      [['Step', 'col'], ['Value', 'col'], ['Code', 'col']]);
    unmount(host);
  });
});

describe('BB-JOURNEY-06: The Transformed stage works the student\'s vertex with their numbers', () => {
  it('shows from Stored, scale, rotate and move with amber inputs, and the result the closed rows continue from', async () => {
    mockTriangle();
    useVamsStore.setState({ activeSection: 'Transforms' });
    const host = mount(h(MathPanel, {}));
    await settle();
    expect(openTitle(host)).toBe('Transformed');
    expect(host.querySelector('.journey-open__section')!.textContent).toBe('Transforms');
    const rows = [...host.querySelectorAll('table.journey-work tbody tr')].map((tr) => [...tr.children].map((c) => c.textContent));
    expect(rows).toEqual([
      ['from Stored', '(0.00, 0.50)', 'glVertex2f'],
      ['scale 1, 1', '(0.00, 0.50)', 'glScalef'],
      ['rotate 15°', '(−0.13, 0.48)', 'glRotatef'],
      ['move 0.40, −0.17', '(0.27, 0.31)', 'glTranslatef'],
      ['Result', '(0.27, 0.31)', ''],
    ]);
    expect([...host.querySelectorAll('.journey-work__in')].map((el) => el.textContent)).toEqual(['1', '1', '15°', '0.40', '−0.17']);
    expect(row(host, 'Stored').querySelector('.journey-stage__value')!.textContent).toBe('(0.00, 0.50)');
    expect(row(host, 'Projected').querySelector('.journey-stage__value')!.textContent).toBe('NDC (0.27, 0.31)');
    expect(row(host, 'Assembled').querySelector('.journey-stage__value')!.textContent).toBe('triangle, 1 of 3');
    expect(row(host, 'Coloured').querySelector('.journey-stage__value')!.textContent).toBe('rgb(1.0, 0.4, 0.2)');
    expect(host.textContent).toContain('As one matrix');
    unmount(host);
  });
});

describe('BB-JOURNEY-07: Stages open by the context, by hand, and with Back and Next', () => {
  it('follows the opened group, holds a clicked stage, and steps to the neighbours', async () => {
    mockTriangle();
    const host = mount(h(MathPanel, {}));
    await settle();
    getState().toggleGroup('buffers');
    await settle();
    expect(openTitle(host)).toBe('Stored');
    row(host, 'Projected').click();
    await settle();
    expect(openTitle(host)).toBe('Projected');
    (host.querySelector('.journey-open__next') as HTMLButtonElement).click();
    await settle();
    expect(openTitle(host)).toBe('Assembled');
    (host.querySelector('.journey-open__back') as HTMLButtonElement).click();
    await settle();
    expect(openTitle(host)).toBe('Projected');
    getState().toggleGroup('texture');
    await settle();
    expect(openTitle(host)).toBe('Coloured');
    expect(host.querySelector('.journey-open__next')).toBeNull();
    unmount(host);
  });
});

describe('BB-JOURNEY-08: The stepper follows another vertex, and a removed vertex clamps', () => {
  it('moves through the vertices, wraps, names them in a live region, and never passes the last', async () => {
    const id = mockTriangle();
    const host = mount(h(MathPanel, {}));
    await settle();
    const vertexText = () => host.querySelector('.journey-follow__vertex')!.textContent;
    expect(host.querySelector('.journey-follow__vertex')!.getAttribute('aria-live')).toBe('polite');
    expect(vertexText()).toBe('vertex 1 of 3');
    (host.querySelector('button[aria-label="Next vertex"]') as HTMLButtonElement).click();
    await settle();
    expect(vertexText()).toBe('vertex 2 of 3');
    expect(getState().journeyVertex).toBe(1);
    (host.querySelector('button[aria-label="Previous vertex"]') as HTMLButtonElement).click();
    (host.querySelector('button[aria-label="Previous vertex"]') as HTMLButtonElement).click();
    await settle();
    expect(vertexText()).toBe('vertex 3 of 3');
    useVamsStore.setState({ objects: getState().objects.map((o) => (o.id === id ? { ...o, vertices: o.vertices.slice(0, 2) } : o)) });
    await settle();
    expect(vertexText()).toBe('vertex 2 of 2');
    unmount(host);
  });
});

describe('BB-JOURNEY-09: Every card from the old tabs is still in its stage', () => {
  it('shows each section\'s cards in the stage they belong to', async () => {
    mockTriangle();
    useVamsStore.setState({ pipelineMode: 'Playground' });
    const host = mount(h(MathPanel, {}));
    await settle();
    const open = async (name: string) => {
      row(host, name)?.click();
      await settle();
    };
    await open('Stored');
    for (const title of ['Memory Footprint', 'Array vs Indexed', 'Layout: Interleaved', 'CPU → GPU Traffic']) expect(host.textContent, title).toContain(title);
    await open('Transformed');
    (host.querySelector('.journey-open__deeper') as HTMLButtonElement).click();
    await settle();
    expect(host.textContent).toContain('Selected Matrix (4×4)');
    await open('Projected');
    (host.querySelector('.journey-open__deeper') as HTMLButtonElement).click();
    await settle();
    expect(host.textContent).toContain('glOrtho — Viewing Volume');
    await open('Assembled');
    expect(host.textContent).toContain('Vertices');
    await open('Rasterised');
    expect(host.textContent).toContain('Cursor (NDC)');
    await open('Coloured');
    expect(host.textContent).toContain('Barycentric Interpolation');
    unmount(host);
  });
});

describe('BB-JOURNEY-10: Nothing selected, a group, and Run', () => {
  it('prompts to select a shape, explains a group, and makes the journey inert during Run', async () => {
    const host = mount(h(MathPanel, {}));
    await settle();
    expect(host.querySelector('.journey-follow')!.textContent).toBe('Select a shape to follow one of its vertices.');
    expect(row(host, 'Stored').querySelector('.journey-stage__value')!.textContent).toBe('Where a vertex is kept before drawing.');
    const a = addTriangle(-0.4, 0, 0.2);
    const b = addTriangle(0.4, 0, 0.2);
    getState().createGroup([a.id, b.id]);
    await settle();
    expect(host.querySelector('.journey-follow')!.textContent).toBe('A group has no vertices of its own. Select a shape inside it to follow one.');
    render(h(MathPanel, { contentInert: true }), host);
    await settle();
    expect(host.querySelector('.journey')!.hasAttribute('inert')).toBe(true);
    unmount(host);
  });
});
```

In `tests/black-box/editor-inspector.test.ts`:
1. Replace `mathTabFor,` in the import with `journeyStageFor,`.
2. Replace `mathTabOverride: null,` in `afterEach` with `journeyStageOverride: null,`.
3. In BB-INSP-03:
   - Replace `mathTabOverride: null` in both `base` and `lesson` with `journeyStageOverride: null`.
   - Replace the `mathTabFor` assertion with `expect(journeyStageFor({ ...base, lastOpenedGroup: 'texture', journeyStageOverride: 'transformed' })).toBe('transformed');`.
   - Replace `expect(mathTabFor(lesson)).toBe('Transforms');` with `expect(journeyStageFor(lesson)).toBe('transformed');`.
4. In BB-INSP-04:
   - Replace `s().setMathTabOverride('Textures')` with `s().setJourneyStageOverride('coloured')`.
   - Replace `s().setMathTabOverride('Buffers')` with `s().setJourneyStageOverride('stored')`.
   - Replace both `expect(s().mathTabOverride).toBeNull()` with `expect(s().journeyStageOverride).toBeNull()`.
5. Replace the body of BB-INSP-06 (keep its ID) with:

```ts
describe('BB-INSP-06: The math panel is the journey and follows the student', () => {
  it('has no section tabs, opens the opened group\'s stage, and holds a stage picked by hand until the next group', async () => {
    const host = mountEl(h(MathPanel, {}));
    try {
      await settle();
      const open = () => host.querySelector('.journey-open__title')!.textContent;
      expect(host.querySelector('[role="tablist"]')).toBeNull();
      expect(host.querySelectorAll('li.journey-stage')).toHaveLength(6);
      expect(open()).toBe('Rasterised');
      useVamsStore.getState().toggleGroup('buffers');
      await settle();
      expect(open()).toBe('Stored');
      ([...host.querySelectorAll('.journey-stage__row')].find((b) => b.textContent?.startsWith('Transformed')) as HTMLButtonElement).click();
      await settle();
      expect(open()).toBe('Transformed');
      useVamsStore.getState().toggleGroup('texture');
      await settle();
      expect(open()).toBe('Coloured');
    } finally {
      unmountEl(host);
    }
  });
});
```

In `tests/black-box/lesson-column.test.ts`:
1. In the `@/core/inspector` import, replace `mathTabFor` with `journeyStageFor`.
2. Replace `expect(mathTabFor(useVamsStore.getState())).toBe('Transforms');` with `expect(journeyStageFor(useVamsStore.getState())).toBe('transformed');`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/math-journey.test.ts tests/black-box/editor-inspector.test.ts tests/black-box/lesson-column.test.ts`
Expected: FAIL. There is no `.journey-track`, and the tab list is still there.

- [ ] **Step 3: Move `useCanvasSize`**

```bash
git mv src/features/code-generation/model/useCanvasSize.ts src/shared/lib/use-canvas-size.ts
```

Change the two imports to `import { useCanvasSize } from '@/shared/lib/use-canvas-size';`.

- [ ] **Step 4: Export the cards**

In `src/features/math-panel/ui/TransformsMathContent.tsx`:
1. Add `export` to `buildMatrix4`, `getAncestorChain`, `Matrix4`, `TRSCompositionTrace`, `MatrixStack` and `OrthoMapping`.
2. Delete `export default function TransformsMathContent` and the `useMemo` and `useVamsStore` imports it alone used. Keep the local `Section`.
3. Add this exported wrapper, which the journey's deeper detail uses:

```tsx
/** A titled card, as the old Transforms tab drew them. */
export function TransformsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <Section title={title}>{children}</Section>;
}
```

In `src/features/math-panel/ui/PrimitivesMathContent.tsx`:
1. Add `export` to `isLine`, `ColorConversion`, `StippleBits`, `BarycentricMixer` and `VertexTable`.
2. Delete `export default function PrimitivesMathContent` and the store import it alone used.
3. Export its `Section` as `PrimitivesSection` in the same way.

`BuffersMathContent`, `PipelineMathContent` and `TexturesMathContent` keep their default exports. The journey shows them whole.

- [ ] **Step 5: Write the working table**

Create `src/features/math-panel/ui/journey/WorkingTable.tsx`:

```tsx
import type { WorkingRow } from '../../model/vertex-journey';

interface WorkingTableProps {
  rows: readonly WorkingRow[];
  result: string;
  /** A row's GL call was chosen: Code opens on that line. Plain text when omitted. */
  onCall?: (call: string) => void;
}

/** The open stage's working: Step · Value · Code, the student's inputs in amber, the result last. */
export default function WorkingTable({ rows, result, onCall }: WorkingTableProps) {
  return (
    <table className="journey-work">
      <thead>
        <tr>
          <th scope="col">Step</th>
          <th scope="col">Value</th>
          <th scope="col">Code</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className={row.from ? 'is-from' : undefined}>
            <td className="journey-work__step">
              {row.step.map((part, k) =>
                typeof part === 'string' ? part : <span key={k} className="journey-work__in">{part.input}</span>,
              )}
            </td>
            <td className="journey-work__value">{row.value}</td>
            <td className="journey-work__call">
              {row.call && (onCall ? (
                <button type="button" className="journey-work__call-link" onClick={() => onCall(row.call!)}>{row.call}</button>
              ) : (
                <code>{row.call}</code>
              ))}
            </td>
          </tr>
        ))}
        <tr className="is-result">
          <th scope="row" className="journey-work__step">Result</th>
          <td className="journey-work__value">{result}</td>
          <td className="journey-work__call" />
        </tr>
      </tbody>
    </table>
  );
}
```

- [ ] **Step 6: Write the pictures**

Create `src/features/math-panel/ui/journey/stage-pictures.tsx`:

```tsx
import type { ComponentChildren } from 'preact';
import { useVamsStore } from '@/core/store';
import type { JourneyStageId } from '@/core/inspector';
import type { SceneNode, ViewportLimits } from '@/core/types/scene';
import BuffersMathContent from '../BuffersMathContent';
import PipelineMathContent from '../PipelineMathContent';
import TexturesMathContent from '../TexturesMathContent';
import { BarycentricMixer, ColorConversion, isLine, PrimitivesSection, StippleBits, VertexTable } from '../PrimitivesMathContent';
import { buildMatrix4, getAncestorChain, Matrix4, MatrixStack, OrthoMapping, TransformsSection, TRSCompositionTrace } from '../TransformsMathContent';
import { fmt } from '@/shared/lib/format-number';
import type { JourneyStage, Point } from '../../model/vertex-journey';

/** A labelled picture under the working. */
export function Picture({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <figure className="journey-picture">
      <figcaption className="journey-picture__label">{label}</figcaption>
      {children}
    </figure>
  );
}

/** The object's own transform as one 3 × 3 matrix, with the move column in amber. */
function MatrixPicture({ node }: { node: SceneNode }) {
  const m = buildMatrix4(node.transform);
  const cells = [
    [m[0][0], m[0][1], m[0][3]],
    [m[1][0], m[1][1], m[1][3]],
    [0, 0, 1],
  ];
  return (
    <Picture label="As one matrix">
      <div className="journey-picture__box">
        <div className="journey-matrix" role="img" aria-label="The transform as one matrix">
          {cells.flatMap((rowCells, r) =>
            rowCells.map((v, c) => (
              <span key={`${r}-${c}`} className={c === 2 && r < 2 ? 'is-value' : undefined}>{fmt(v)}</span>
            )),
          )}
        </div>
        <p className="journey-picture__caption">M = T · R · S. The last column is your move; the rest is your rotate and scale.</p>
      </div>
    </Picture>
  );
}

const signed = (a: string, b: number) => (b < 0 ? `${a} + ${fmt(-b)}` : `${a} − ${fmt(b)}`);

/** glOrtho's formula with the student's numbers in it. */
function OrthoFormula({ world, limits, ndc }: { world: Point; limits: ViewportLimits; ndc: Point }) {
  const line = (axis: 'x' | 'y', v: number, lo: number, hi: number, out: number) => (
    <>
      {axis}' = 2({axis} − {axis === 'x' ? 'l' : 'b'})/({axis === 'x' ? 'r − l' : 't − b'}) − 1
      <br />
      {'   '}= 2({signed(fmt(v), lo)})/({signed(fmt(hi), lo)}) − 1 = <span className="is-value">{fmt(out)}</span>
    </>
  );
  const unit = limits.minX === -1 && limits.maxX === 1 && limits.minY === -1 && limits.maxY === 1;
  return (
    <Picture label="The formula, with your numbers">
      <p className="journey-formula">
        {line('x', world.x, limits.minX, limits.maxX, ndc.x)}
        <br />
        {line('y', world.y, limits.minY, limits.maxY, ndc.y)}
      </p>
      <p className="journey-picture__caption">
        {unit
          ? 'Your volume is already −1 to 1, so the numbers don’t change. Widen it in Settings and they will.'
          : 'Your volume is wider or narrower than −1 to 1, so the numbers change on the way in.'}
      </p>
    </Picture>
  );
}

interface PicturesProps {
  stage: JourneyStage;
  node: SceneNode | undefined;
  /** Deeper detail, shown under the pictures when the student opens it. */
  deeper: boolean;
  /** For Projected: where the vertex was before projection. */
  world: Point | null;
}

/** Deeper detail each stage offers, by label; none for the stages whose cards are all shown. */
export const DEEPER_LABEL: Partial<Record<JourneyStageId, string>> = {
  transformed: 'Full 4×4',
  projected: 'Viewing volume',
};

export function StagePictures({ stage, node, deeper, world }: PicturesProps) {
  const objects = useVamsStore((s) => s.objects);
  const limits = useVamsStore((s) => s.viewportLimits);
  const shape = node && node.type !== 'GROUP' && node.type !== 'TEXT' ? node : undefined;
  switch (stage.id) {
    case 'stored':
      return <BuffersMathContent />;
    case 'transformed': {
      if (!node) return null;
      const chain = getAncestorChain(node.id, objects);
      return (
        <>
          <MatrixPicture node={node} />
          {chain.length > 1 && (
            <Picture label="Matrix stack">
              <MatrixStack chain={chain} />
            </Picture>
          )}
          {deeper && (
            <TransformsSection title="Selected Matrix (4×4)">
              <TRSCompositionTrace t={node.transform} />
              <Matrix4 m={buildMatrix4(node.transform)} />
            </TransformsSection>
          )}
        </>
      );
    }
    case 'projected':
      return (
        <>
          {world && stage.point && <OrthoFormula world={world} limits={limits} ndc={stage.point} />}
          {(deeper || !node) && (
            <TransformsSection title="glOrtho — Viewing Volume">
              <OrthoMapping limits={limits} />
            </TransformsSection>
          )}
        </>
      );
    case 'assembled':
      if (!shape) return null;
      return (
        <>
          <PrimitivesSection title="Vertices">
            <VertexTable vertices={shape.vertices} />
          </PrimitivesSection>
          {isLine(shape.type) && shape.lineStipple && (
            <PrimitivesSection title="Stipple Pattern">
              <StippleBits pattern={shape.lineStipple.pattern} factor={shape.lineStipple.factor} />
            </PrimitivesSection>
          )}
          {shape.type === 'POINTS' && (
            <p className="journey-picture__caption">Each point is drawn 8 pixels wide, set by glPointSize.</p>
          )}
        </>
      );
    case 'rasterised':
      return <PipelineMathContent />;
    case 'coloured': {
      if (!node || node.type === 'GROUP') return null;
      if (node.texture) return <TexturesMathContent />;
      const multi = node.vertices.length > 1 && node.vertices.some((v) => v.color !== node.vertices[0].color);
      return (
        <>
          <PrimitivesSection title="Color">
            <ColorConversion hex={node.vertices[0]?.color ?? '#ffffff'} />
          </PrimitivesSection>
          {node.type !== 'POINTS' && multi && (
            <PrimitivesSection title="Barycentric Interpolation">
              <BarycentricMixer vertices={node.vertices} />
            </PrimitivesSection>
          )}
        </>
      );
    }
  }
}
```

- [ ] **Step 7: Write the header and the track**

Create `src/features/math-panel/ui/journey/JourneyFollow.tsx`:

```tsx
import type { JourneySubject } from '../../model/vertex-journey';

interface JourneyFollowProps {
  subject: JourneySubject;
  onStep: (delta: 1 | -1) => void;
}

/** "○ Following Triangle      ‹ vertex 1 of 3 ›" */
export default function JourneyFollow({ subject, onStep }: JourneyFollowProps) {
  if (subject.kind === 'none') {
    return <div className="journey-follow">Select a shape to follow one of its vertices.</div>;
  }
  if (subject.kind === 'group') {
    return <div className="journey-follow">A group has no vertices of its own. Select a shape inside it to follow one.</div>;
  }
  return (
    <div className="journey-follow">
      <span className="journey-follow__ring" aria-hidden="true" />
      <span>Following <b>{subject.name}</b></span>
      <span className="journey-follow__space" />
      {subject.kind === 'shape' && subject.count > 0 ? (
        <>
          <button type="button" className="journey-follow__step" aria-label="Previous vertex" onClick={() => onStep(-1)}>‹</button>
          <span className="journey-follow__vertex" aria-live="polite">vertex {subject.vertex + 1} of {subject.count}</span>
          <button type="button" className="journey-follow__step" aria-label="Next vertex" onClick={() => onStep(1)}>›</button>
        </>
      ) : (
        <span className="journey-follow__vertex" aria-live="polite">raster position</span>
      )}
    </div>
  );
}
```

Create `src/features/math-panel/ui/journey/JourneyTrack.tsx`:

```tsx
import { useId, useState } from 'react';
import type { JourneyStageId } from '@/core/inspector';
import type { SceneNode } from '@/core/types/scene';
import type { VertexJourney } from '../../model/vertex-journey';
import WorkingTable from './WorkingTable';
import { DEEPER_LABEL, StagePictures } from './stage-pictures';

interface JourneyTrackProps {
  journey: VertexJourney;
  open: JourneyStageId;
  node: SceneNode | undefined;
  onOpen: (stage: JourneyStageId) => void;
  /** A working row's GL call was chosen (Task 15). */
  onCall?: (call: string) => void;
}

/** Every stage is a row on a vertical line; exactly one is open with its working. */
export default function JourneyTrack({ journey, open, node, onOpen, onCall }: JourneyTrackProps) {
  const baseId = useId();
  const [deeperFor, setDeeperFor] = useState<JourneyStageId | null>(null);
  const openIndex = journey.stages.findIndex((s) => s.id === open);
  const following = journey.subject.kind !== 'none';
  return (
    <ol className="journey-track">
      {journey.stages.map((stage, k) => {
        const done = k < openIndex;
        if (k !== openIndex) {
          return (
            <li key={stage.id} className={`journey-stage${done ? ' is-done' : ''}`}>
              <button type="button" className="journey-stage__row" aria-expanded="false" onClick={() => onOpen(stage.id)}>
                <span className="journey-stage__dot" aria-hidden="true" />
                <span className="journey-stage__name">{stage.title}</span>
                <span className="journey-stage__value">{stage.result ?? (following ? '—' : stage.sentence)}</span>
              </button>
            </li>
          );
        }
        const bodyId = `${baseId}-${stage.id}`;
        const prev = journey.stages[k - 1];
        const next = journey.stages[k + 1];
        const deeperLabel = node ? DEEPER_LABEL[stage.id] : undefined;
        const deeper = deeperFor === stage.id;
        return (
          <li key={stage.id} className="journey-stage is-open">
            <span className="journey-stage__dot" aria-hidden="true" />
            <div className="journey-open__head">
              <h3 className="journey-open__title">
                <button type="button" aria-expanded="true" aria-controls={bodyId}>{stage.title}</button>
              </h3>
              <span className="journey-open__section">{stage.section}</span>
            </div>
            <div id={bodyId}>
              <p className="journey-open__why">{stage.sentence}</p>
              {stage.result !== null && <WorkingTable rows={stage.rows} result={stage.result} onCall={onCall} />}
              <div className="journey-open__pictures">
                <StagePictures stage={stage} node={node} deeper={deeper} world={journey.stages[1]?.point ?? null} />
              </div>
              <div className="journey-open__foot">
                {deeperLabel ? (
                  <button
                    type="button"
                    className="journey-open__deeper"
                    aria-expanded={deeper}
                    onClick={() => setDeeperFor(deeper ? null : stage.id)}
                  >
                    {deeperLabel} {deeper ? '‹' : '›'}
                  </button>
                ) : (
                  <span />
                )}
                <span className="journey-open__nav">
                  {prev && (
                    <button type="button" className="journey-open__back" onClick={() => onOpen(prev.id)}>‹ {prev.title}</button>
                  )}
                  {next && (
                    <button type="button" className="journey-open__next" onClick={() => onOpen(next.id)}>{next.title} ›</button>
                  )}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 8: Write the panel**

Replace `src/features/math-panel/ui/MathPanel.tsx` with:

```tsx
import './math-panel.scss';
import { useMemo } from 'react';
import type { ComponentChildren } from 'preact';
import { useVamsStore } from '@/core/store';
import { journeyStageFor } from '@/core/inspector';
import { useCanvasSize } from '@/shared/lib/use-canvas-size';
import { vertexJourney } from '../model/vertex-journey';
import JourneyFollow from './journey/JourneyFollow';
import JourneyTrack from './journey/JourneyTrack';

interface MathPanelProps {
  /** Replaces the "Math & data" title, such as the column's switch. */
  headerLead?: ComponentChildren;
  /** Rendered at the end of the header. */
  headerTrail?: ComponentChildren;
  /** Run makes the journey inert; the lead and trail stay usable. */
  contentInert?: boolean;
}

/** The math pane: one vertex of the selected object, followed through the six pipeline stages. */
export default function MathPanel({ headerLead, headerTrail, contentInert = false }: MathPanelProps = {}) {
  const objects = useVamsStore((s) => s.objects);
  const selectedObjectId = useVamsStore((s) => s.selectedObjectId);
  const viewportLimits = useVamsStore((s) => s.viewportLimits);
  const journeyVertex = useVamsStore((s) => s.journeyVertex);
  const setJourneyVertex = useVamsStore((s) => s.setJourneyVertex);
  const setOverride = useVamsStore((s) => s.setJourneyStageOverride);
  const getAllTextures = useVamsStore((s) => s.getAllTextures);
  const uploaded = useVamsStore((s) => s.uploadedTextures);
  const open = useVamsStore(journeyStageFor);
  const canvas = useCanvasSize();

  const journey = useMemo(
    () => vertexJourney({ objects, viewportLimits, textures: getAllTextures() }, selectedObjectId, journeyVertex, canvas),
    // getAllTextures is stable; uploads change `uploaded`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [objects, viewportLimits, selectedObjectId, journeyVertex, canvas, uploaded],
  );
  const node = objects.find((o) => o.id === selectedObjectId);

  const step = (delta: 1 | -1) => {
    if (journey.subject.kind !== 'shape' || journey.subject.count === 0) return;
    const { vertex, count } = journey.subject;
    setJourneyVertex((vertex + delta + count) % count);
  };

  return (
    <div className="math-panel-container">
      <div className={headerLead ? 'math-header math-header--lead' : 'math-header'}>
        {headerLead ?? <span className="math-title">Math &amp; data</span>}
        {headerTrail && <span className="math-header__trail">{headerTrail}</span>}
      </div>
      <div className="journey" inert={contentInert || undefined}>
        <JourneyFollow subject={journey.subject} onStep={step} />
        <JourneyTrack journey={journey} open={open} node={node} onOpen={setOverride} />
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Write the styles**

Create `src/features/math-panel/ui/journey/journey.scss`:

```scss
@use '../../../../shared/styles/tokens' as *;

.journey {
  @include scrollbar;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  color: var(--ink);
  font-size: var(--text-base);
}

.journey-follow {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--rule);
  font-size: var(--text-sm);
  color: var(--ink-muted);

  b { color: var(--ink); }
}

.journey-follow__ring {
  display: inline-block;
  flex: none;
  width: 10px;
  height: 10px;
  border: 2px solid var(--value);
  border-radius: 50%;
}

.journey-follow__space { flex: 1; }

.journey-follow__step {
  padding: 1px 6px;
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-s);
  background: none;
  font-family: $font-mono;
  font-size: var(--text-sm);
  color: var(--ink);
  cursor: pointer;

  &:hover { background: var(--paper-sunken); }
  &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 1px; }
}

.journey-track {
  margin: 0;
  padding: 0;
  list-style: none;
}

.journey-stage {
  position: relative;
  border-bottom: 1px solid var(--rule);

  // The track: a vertical line through every stage's dot.
  &::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 17px;
    width: 2px;
    background: var(--rule-strong);
  }
}

.journey-stage__dot {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 1;
  width: 12px;
  height: 12px;
  border: 2px solid var(--rule-strong);
  border-radius: 50%;
  background: var(--paper);
}

.journey-stage.is-done .journey-stage__dot { background: var(--rule-strong); }

.journey-stage__row {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  width: 100%;
  padding: 8px 12px 8px 36px;
  border: 0;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover { background: var(--paper-sunken); }
  &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -2px; }
}

.journey-stage__name {
  font-size: var(--text-base);
  color: var(--ink-muted);
}

.journey-stage__value {
  margin-left: auto;
  font-family: $font-mono;
  font-size: var(--text-xs);
  color: var(--ink-faint);
  text-align: right;
}

// The open stage: one layout for every stage.
.journey-stage.is-open {
  padding: 12px 14px 0 36px;
  background: var(--paper-raised);

  &::before {
    background: var(--accent);
    opacity: 0.55;
  }

  .journey-stage__dot {
    top: 17px;
    border: 0;
    background: var(--accent);
    box-shadow: 0 0 0 4px rgba(var(--accent-rgb), 0.22);
  }
}

.journey-open__head {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.journey-open__title {
  margin: 0;
  font-size: var(--text-md);

  button {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    font-weight: 700;
    color: var(--ink);
    cursor: default;

    &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
  }
}

.journey-open__section {
  margin-left: auto;
  padding: 0 7px;
  border: 1px solid var(--rule-strong);
  border-radius: 10px;
  font-size: var(--text-xs);
  color: var(--ink-dim);
}

.journey-open__why {
  margin: 4px 0 10px;
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--ink-muted);

  code {
    font-family: $font-mono;
    font-size: var(--text-xs);
    color: var(--code-fn);
  }
}

// The working: a table in a dark well, so it never reads as part of the sentence.
.journey-work {
  width: 100%;
  border: 1px solid var(--rule);
  border-radius: var(--radius-s);
  border-collapse: separate;
  border-spacing: 0;
  background: var(--paper-sunken);
  font-family: $font-mono;
  font-size: var(--text-sm);
  line-height: 1;

  th,
  td {
    padding: 0 5px;
    white-space: nowrap;
    text-align: left;
    vertical-align: middle;
  }

  th:first-child,
  td:first-child { padding-left: 10px; }

  th:last-child,
  td:last-child { padding-right: 10px; text-align: right; }

  thead th {
    height: 24px;
    border-bottom: 1px solid var(--rule);
    font-family: $font-ui;
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-dim);
  }

  tbody tr { height: 27px; }

  .journey-work__step {
    min-width: 118px;
    color: var(--ink-muted);
  }

  .journey-work__in { color: var(--value); }

  .journey-work__call {
    font-size: var(--text-xs);
    color: var(--code-fn);

    code { font: inherit; }
  }

  .journey-work__call-link {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    color: var(--code-fn);
    cursor: pointer;

    &:hover { text-decoration: underline; }
    &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 1px; }
  }

  tr.is-from .journey-work__step { color: var(--ink-dim); }

  tr.is-result {
    height: 30px;

    th,
    td { border-top: 1px solid var(--rule-strong); }

    .journey-work__step {
      font-family: $font-ui;
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--ink);
    }

    .journey-work__value {
      font-weight: 600;
      color: var(--value);
    }
  }
}

.journey-open__pictures {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
  font-size: var(--text-xs);

  // Today's cards keep their content but lose their box: the open stage is the surface.
  .math-section {
    padding: 0;
    border: 0;
    background: none;
  }

  .math-section-title {
    margin: 0 0 6px;
    font-family: $font-ui;
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-dim);
  }
}

.journey-picture {
  margin: 0;
}

.journey-picture__label {
  margin-bottom: 6px;
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-dim);
}

.journey-picture__box {
  display: flex;
  align-items: center;
  gap: 14px;
}

.journey-picture__caption {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.45;
  color: var(--ink-muted);
}

.journey-matrix {
  display: inline-grid;
  grid-template-columns: repeat(3, auto);
  gap: 3px 10px;
  padding: 2px 7px;
  border-right: 1px solid var(--ink-muted);
  border-left: 1px solid var(--ink-muted);
  font-family: $font-mono;
  font-size: var(--text-xs);
  text-align: right;

  .is-value { color: var(--value); }
}

.journey-formula {
  margin: 0;
  font-family: $font-mono;
  font-size: var(--text-xs);
  line-height: 1.8;
  white-space: pre;
  color: var(--ink);

  .is-value { color: var(--value); }
}

.journey-open__foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 12px -14px 0 -36px;
  padding: 8px 14px 8px 36px;
  border-top: 1px solid var(--rule);
  font-size: var(--text-sm);
}

.journey-open__nav {
  display: flex;
  gap: var(--space-3);
}

.journey-open__deeper,
.journey-open__back,
.journey-open__next {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  cursor: pointer;

  &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
}

.journey-open__deeper { color: var(--ink-faint); }

.journey-open__back,
.journey-open__next {
  color: var(--accent-text);

  &:hover { text-decoration: underline; }
}
```

In `src/features/math-panel/ui/math-panel.scss`:
1. Delete the `.math-tabs`, `.math-tab` and `.math-header--lead .math-tabs` rules.
2. Add `@use 'journey/journey';` after the other `@use` lines.

In `src/features/math-panel/ui/_math-layout.scss`, change `.math-panel-container`:
1. Delete `border-top: 1px solid var(--rule-strong);` and the comment above it.
2. In `.math-header`, use `height: 36px; min-height: 36px; padding: 0 10px; gap: var(--space-2); background: var(--paper); border-bottom: 1px solid var(--rule); flex-wrap: nowrap;`, replacing `min-height: 32px`, `padding: 0 12px`, `gap: 6px`, `flex-wrap: wrap` and the sunken background.

- [ ] **Step 10: Remove the tab state**

Delete `mathTabOverride`, `setMathTabOverride` and `mathTabFor` everywhere. These are the only users:
- In `types.ts`: the field, its doc comment and the setter.
- In `runtime-slice.ts`: the default, the `setActiveSection` reset, the `toggleGroup` reset and the action.
- In `lesson-slice.ts`: the two `setLessonFocusPanel` returns and `clearLessonState`.
- In `context-section.ts`: the function, and `mathTabOverride` from its `Pick`.

Then confirm nothing is left:

```bash
grep -rn "mathTab" src tests --include=*.ts --include=*.tsx
```

Expected: no output.

- [ ] **Step 11: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/math-journey.test.ts tests/black-box/editor-inspector.test.ts tests/black-box/lesson-column.test.ts tests/black-box/editor-shell.test.ts tests/black-box/run-mode.test.ts`
Expected: PASS.

- [ ] **Step 12: Check it in the browser**

1. Run `npx vite --port 5174` in the background and record its PID.
2. Make a triangle, select it, change X and switch to Math.
3. Check against `journey-h2-v3.html`:
   - the dot-and-line track, with filled dots for passed stages;
   - the cobalt line beside the open stage;
   - the dark well behind Step · Value · Code;
   - the amber inputs and result;
   - the "As one matrix" picture;
   - Back and Next.
4. Stop the server by its PID.

- [ ] **Step 13: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/shared/lib/use-canvas-size.ts src/features/code-generation/ui/SceneCodePanel.tsx src/features/lesson-engine/model/useLessonRunner.ts src/features/math-panel src/core/store/types.ts src/core/store/runtime-slice.ts src/core/store/lesson-slice.ts src/core/inspector/context-section.ts tests/setup.ts tests/black-box/math-journey.test.ts tests/black-box/editor-inspector.test.ts tests/black-box/lesson-column.test.ts
git diff --staged
git commit -m "feat(math): the math pane is a vertex journey through six stages, replacing the section tabs"
```

---

### Task 11: Lessons point at journey stages

**Files:**
- Modify:
  - `src/features/lesson-engine/model/buffers-lessons.ts` (5 narrations)
  - `src/features/lesson-engine/model/pipeline-lessons.ts` (1)
  - `src/features/lesson-engine/model/primitives-lessons.ts` (1 narration, plus `mathStage: 'coloured'`)
  - `src/features/lesson-engine/model/textures-lessons.ts` (1)
  - `src/features/lesson-engine/model/transforms-lessons.ts` (2)
- Modify: `tests/black-box/lesson-column.test.ts` (BB-LCOL-33's narration check; BB-LCOL-35 and 36)

**Reconciliation with the rail (commits 93082a2 and ebefdb2).** The rail already added `pane: 'math'` to 15 steps: 5 in Buffers, 1 each in Pipeline, Primitives and Textures, and 7 in Transforms. It reworded the Primitives barycentric narration ("The right column now shows Math: …"). What is left:
- **Ten narrations still name an old card, "the math panel" or "the right column".** They now name a journey stage (table below).
- **Only one step needs `mathStage`:** the Primitives barycentric step. It has no focus in a Primitives lesson, so the context opens Assembled, but the formula is in Coloured. Every other step's context already opens the stage it names:
  - Buffers steps without a focus open Stored.
  - The Pipeline step opens Rasterised.
  - The Textures step opens Coloured.
  - The Transforms steps focus the scene list or the Transform group, which open Transformed.
- **The five Transforms steps about "the matrix"** (identity, translate, scale, rotate, all three) keep their words. Transformed's "As one matrix" picture shows exactly the cells they describe.

| File | Step (current start of narration) | New narration |
| --- | --- | --- |
| buffers | "Look at the math panel's CPU → GPU Traffic timeline. The data still travels…" | "Look at the traffic timeline in Math's Stored stage. The data still travels every frame — but now in one batched send instead of vertex-by-vertex." |
| buffers | "Look at the math panel's CPU → GPU Traffic timeline — only frame 1…" | "Look at the traffic timeline in the Stored stage — only frame 1 lights up green. The GPU keeps the data; subsequent frames are pure draw calls." |
| buffers | "Look at the math panel's traffic timeline to see the difference…" | "Look at the Stored stage's traffic timeline to see the difference. STATIC is one green cell. DYNAMIC is sparse blue. STREAM is solid orange. The hint matches the actual data transfer cost." |
| buffers | "The function body is completely different… The math panel just lit up with a Mapping diagram…" | "The function body is completely different. Instead of pushing bytes, we ask the driver for a raw pointer into GPU memory and write through it. Math's Stored stage now shows a Mapping diagram — that's the lifecycle we'll walk through now." |
| buffers | "Brilliant! Look at Array vs Indexed in the math panel…" | "Brilliant! Look at Array vs Indexed in the Stored stage — the indexed version stores 4 vertices plus 6 indices instead of 6 full vertices. The code panel now uses glDrawElements." |
| pipeline | "Move your cursor across the canvas — watch the math panel on the right…" | "Move your cursor across the canvas — watch the Rasterised stage in Math. Those decimals are the cursor's NDC position." |
| primitives | "This hardware-accelerated blending is called Barycentric Interpolation. The right column now shows Math…" | "This hardware-accelerated blending is called Barycentric Interpolation. Math's Coloured stage now shows the exact formula the GPU uses to calculate every pixel's color." (and add `mathStage: 'coloured',` after `pane: 'math',`) |
| textures | "Look at the math panel for the interpolation formula…" | "Look at the Coloured stage in Math for the interpolation formula. It uses the exact same weights as glColor3f-per-vertex, just applied to a different attribute." |
| transforms | "Every transform is represented as a 4×4 matrix… Watch the math panel on the right…" | "Every transform is represented as a 4×4 matrix. We’ve added a quad to the scene. Watch the Transformed stage in Math to see its matrix update." |
| transforms | "We’ve selected the red quad for you. The math panel’s Matrix Stack shows…" | "We’ve selected the red quad for you. The Transformed stage’s matrix stack shows the stack at draw time: identity at the bottom, the Group’s frame on top of that, then the quad on top." |

Keep each file's existing quote characters (`"…"` or `'…'`) and its typographic apostrophes (’) exactly as the file uses them.

- [ ] **Step 1: Write the failing tests**

In `tests/black-box/lesson-column.test.ts`, BB-LCOL-33, change `toContain('Watch the math panel')` to `toContain('Watch the Transformed stage')`.

Append:

```ts
import MathPanel from '@/features/math-panel/ui/MathPanel';

const STAGE_TITLES = ['Stored', 'Transformed', 'Projected', 'Assembled', 'Rasterised', 'Coloured'] as const;

describe('BB-LCOL-35: Steps about the math name a journey stage, and Math opens on it', () => {
  it('keeps the old card and column words out, and opens each named stage when its step runs', async () => {
    const named: Array<{ lesson: string; index: number; stage: string }> = [];
    for (const lesson of Object.values(LESSON_REGISTRY)) {
      lesson.steps.forEach((step, index) => {
        if (step.pane !== 'math') return;
        expect(step.narration, `${lesson.id} ${index}`).not.toMatch(/math panel|right column|on the right/i);
        const stage = STAGE_TITLES.find((t) => step.narration.includes(`${t} stage`));
        if (stage) named.push({ lesson: lesson.id, index, stage });
      });
    }
    expect(named).toHaveLength(10);
    for (const { lesson, index, stage } of named) {
      expect(await startLessonFromLearn(lesson)).toBe(true);
      const host = mount(h('div', {}, h(LessonBar, {}), h(MathPanel, {})));
      await settle();
      useVamsStore.getState().setCurrentStep(index);
      await settle();
      expect(useVamsStore.getState().codePane, `${lesson} ${index}`).toBe('math');
      expect(host.querySelector('.journey-open__title')!.textContent, `${lesson} ${index}`).toBe(stage);
      unmount(host);
      useVamsStore.getState().clearLessonState();
    }
  });
});

describe('BB-LCOL-36: The mapping steps still drive the Stored stage\'s diagram', () => {
  it('shows the lesson-driven mapping diagram in Stored for each dmaStep', async () => {
    const lesson = LESSON_REGISTRY['buffers-demo-5'];
    const index = lesson.steps.findIndex((s) => s.dmaStep === 0);
    expect(index).toBeGreaterThan(0);
    expect(await startLessonFromLearn('buffers-demo-5')).toBe(true);
    const host = mount(h('div', {}, h(LessonBar, {}), h(MathPanel, {})));
    await settle();
    useVamsStore.getState().setCurrentStep(index);
    await settle();
    expect(host.querySelector('.journey-open__title')!.textContent).toBe('Stored');
    expect(host.querySelector('.bm-dma')).not.toBeNull();
    expect(host.querySelector('.bm-dma-driven-badge')).not.toBeNull();
    unmount(host);
    useVamsStore.getState().clearLessonState();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/lesson-column.test.ts`
Expected: FAIL. BB-LCOL-33 still reads "math panel", BB-LCOL-35 finds narrations naming "math panel", and `named` has 0 entries.

- [ ] **Step 3: Rewrite the ten narrations and add the one `mathStage`**

Make the edits in the table above.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/lesson-column.test.ts tests/black-box/lesson-engine.test.ts tests/black-box/learn-page.test.ts`
Expected: PASS. The catalog parity test still passes, because step counts are unchanged.

- [ ] **Step 5: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/features/lesson-engine/model/buffers-lessons.ts src/features/lesson-engine/model/pipeline-lessons.ts src/features/lesson-engine/model/primitives-lessons.ts src/features/lesson-engine/model/textures-lessons.ts src/features/lesson-engine/model/transforms-lessons.ts tests/black-box/lesson-column.test.ts
git diff --staged
git commit -m "fix(lessons): steps about the math name the journey stage they open"
```

---

### Task 12: Checkpoint 2: the journey against the mock

**This task is the controller's.** Build step 3 does not start until the owner signs off.

**Files:**
- Modify: `tests/visual/code-math.spec.ts` (append VIS-CM-02 to 04)

- [ ] **Step 1: Add the journey captures**

Append to `tests/visual/code-math.spec.ts`:

```ts
for (const theme of ['dark', 'light'] as const) {
  test(`VIS-CM-02: Math pane, Transformed open, following vertex 1, ${theme}, 1280`, async ({ page }) => {
    await openMockScene(page, theme);
    await page.getByRole('radio', { name: 'Math' }).click();
    await expect(page.locator('.journey-open__title')).toHaveText('Transformed');
    await expect(page.locator('.code-math-column')).toHaveScreenshot(`cm-journey-transformed-${theme}-1280.png`);
    await expect(page).toHaveScreenshot(`cm-editor-math-${theme}-1280.png`);
  });
}

for (const stage of ['Projected', 'Coloured'] as const) {
  test(`VIS-CM-03: Math pane, ${stage} open, dark, 1280`, async ({ page }) => {
    await openMockScene(page, 'dark');
    await page.getByRole('radio', { name: 'Math' }).click();
    await page.locator('.journey-stage__row', { hasText: stage }).click();
    await expect(page.locator('.journey-open__title')).toHaveText(stage);
    await expect(page.locator('.code-math-column')).toHaveScreenshot(`cm-journey-${stage.toLowerCase()}-dark-1280.png`);
  });
}
```

The Code | Math switch is a `SegmentedControl`, whose options are `role="radio"`.

- [ ] **Step 2: Take the screenshots and show the owner**

```bash
rm -f tests/visual/baseline.local/cm-journey-*.png tests/visual/baseline.local/cm-editor-math-*.png
npx playwright test tests/visual/code-math.spec.ts --update-snapshots
```

1. Write `.superpowers/checkpoints/step-2.html`. It puts three pairs side by side:
   - `mock-journey-transformed.png` | `cm-journey-transformed-dark-1280.png`
   - `mock-journey-projected.png` | `cm-journey-projected-dark-1280.png`
   - `mock-journey-coloured.png` | `cm-journey-coloured-dark-1280.png`
   - Then the light Transformed capture and the dark full editor.
2. Open it with `start`.
3. Ask the owner whether the journey matches the approved look. List what to compare:
   - the follow header with the ring and the stepper;
   - the track's dots and line, with passed stages filled;
   - the open stage on the raised surface with the cobalt line;
   - the Step · Value · Code well;
   - the amber inputs and result;
   - the labelled picture;
   - the footer.
4. Record the answer in the ledger.
5. Make the requested changes as a fix round on Tasks 9–11, and re-show them before Task 13.

Step 2 shows Stored, Assembled, Rasterised and Coloured with only their result row; their full working arrives in Tasks 17–20. Say this when showing Coloured, since the mock shows its full working.

- [ ] **Step 3: Commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add tests/visual/code-math.spec.ts
git diff --staged
git commit -m "test(visual): capture the journey with three stages open in the approved mock's scene"
```

---

## Build step 3: explanations and links

### Task 13: The explanation catalogue

**Files:**
- Create: `src/features/code-generation/model/code-explanations.ts`
- Modify: `src/core/inspector/journey-stage.ts` (add `JOURNEY_STAGE_TITLES`)
- Modify: `tests/white-box/code-structure.test.ts` (append)

**Interfaces:**
- Consumes:
  - `CodeOutline` and `OutlineLine` (Task 2);
  - `assemblyFor` (Task 9, `@/entities/scene/model/primitive-assembly`);
  - `fmt` and `short` (Task 9, `@/shared/lib/format-number`);
  - `JourneyStageId` and `InspectorGroupId` from `@/core/inspector`.
- Produces, in `core/inspector/journey-stage.ts`: `export const JOURNEY_STAGE_TITLES: Record<JourneyStageId, string>` (`Stored`, `Transformed`, …).
- Produces, in `code-explanations.ts`:

```ts
export interface ValueRow { arg: string; source: string; value: string; control: string | null }
export interface ControlLink { label: string; group: InspectorGroupId; objectId: string | null }
export interface LineExplanation { signature: string; text: string; values: ValueRow[]; stage: JourneyStageId | null; control: ControlLink | null }
export type NotePart = string | { value: string; ref: string };
export interface ExplainScene {
  objects: readonly SceneNode[]; viewportLimits: ViewportLimits; canvasBackgroundColor: string;
  canvas: { width: number; height: number }; textures: readonly TextureAsset[];
}
export function explainLine(index: number, outline: CodeOutline, scene: ExplainScene): LineExplanation | null;
export function noteFor(index: number, outline: CodeOutline, scene: ExplainScene): NotePart[] | null;
```

Rules:
- **The catalogue is a list of `{ test, explain }` entries** matched against the trimmed line; the first match wins. Every line the generator writes as `explainable` has an entry. WB-CODE-20 pins this across a fixture that uses every generator feature.
- **Each `values` row** names an argument that comes from the scene, the state field or literal it reads, its value now, and the control that sets it. For example: `x · state_Triangle.x = 0.40 · Translate X`.
- **Control labels** quote the UI: `Translate X`, `Translate Y`, `Rotate`, `Scale X`, `Scale Y`, `Line width`, `Line stipple`, `Buffer usage hint`, `Filter mode`, `Wrap mode`. Group names are used where the panel has no single field: `Transform`, `Vertices`, `Appearance`, `Texture`, `Buffers`, `Background`, `Viewing volume`, `Callbacks`.
- **Notes** (spec §2) appear only on lines inside `draw_<name>()` blocks:
  - `glTranslatef`: "move by your X **x**, Y y"
  - `glRotatef`: "turn by **θ**°"
  - `glScalef`, only when the scale is not 1, 1: "stretch by sx across, sy up"
  - `glBegin`, `glDrawArrays` and `glDrawElements`: the primitive's short rule
  - `glBindTexture`: "paint with ‹texture›"
- A note's `{ value, ref }` parts let the panel colour a value amber when its `ref` (`state_<name>.<field>`) just changed.

- [ ] **Step 1: Write the failing tests**

Append to `tests/white-box/code-structure.test.ts`:

```ts
import { explainLine, noteFor, type ExplainScene } from '@/features/code-generation/model/code-explanations';

const explainScene = (): ExplainScene => {
  const s = getState();
  return { objects: s.objects, viewportLimits: s.viewportLimits, canvasBackgroundColor: s.canvasBackgroundColor, canvas: { width: 800, height: 600 }, textures: s.getAllTextures() };
};

/** Every generator feature at once: all ten modes of drawing data, every callback kind and every action. */
function everythingFixture() {
  fullFixture();
  const line = addPrimitive('LINE_STRIP', [{ x: -0.8, y: -0.8 }, { x: -0.6, y: -0.6 }, { x: -0.4, y: -0.8 }]);
  getState().updateLineWidth(line.id, 3);
  getState().updateLineStipple(line.id, { factor: 2, pattern: 0xF0F0 });
  const dots = addPrimitive('POINTS', [{ x: 0.8, y: -0.8 }]);
  getState().updateObjectColorMode(dots.id, 'BYTE');
  getState().updateObjectShading(dots.id, 'FLAT');
  const stream = addTriangle(-0.6, 0.6, 0.1);
  getState().updateRenderingMode(stream.id, 'VBO');
  getState().updateBufferUsage(stream.id, 'STREAM');
  const mapped = addQuad(0.6, 0.6, 0.1);
  getState().updateRenderingMode(mapped.id, 'VBO');
  getState().updateBufferUsage(mapped.id, 'DYNAMIC');
  getState().updateUpdateMethod(mapped.id, 'MAP_BUFFER');
  getState().updateUseIndexed(mapped.id, true);
  const a = addTriangle(-0.2, -0.5, 0.1);
  const b = addTriangle(0.2, -0.5, 0.1);
  getState().createGroup([a.id, b.id]);
  getState().setCallbackHandler('special', 'onSpecial');
  getState().addCallbackRule('special', rule(line.id, { trigger: { kind: 'special', key: 'left' }, action: { type: 'rotate', degrees: 5 } }));
  getState().addCallbackRule('keyboard', rule(dots.id, { trigger: { kind: 'keyboard', key: 's' }, action: { type: 'scale', sx: 1.1, sy: 1.1 } }));
  getState().addCallbackRule('keyboard', rule(dots.id, { trigger: { kind: 'keyboard', key: 'r' }, action: { type: 'reset' } }));
  getState().addCallbackRule('keyboard', rule(dots.id, { trigger: { kind: 'keyboard', key: 'c' }, action: { type: 'setColor', color: '#ff0000' } }));
  getState().addCallbackRule('keyboard', rule(dots.id, { trigger: { kind: 'keyboard', key: ' ' }, action: { type: 'visibility', mode: 'toggle' } }));
  getState().addCallbackRule('mouse', rule(line.id, { trigger: { kind: 'mouse', button: 'left', state: 'down' }, action: { type: 'moveToPointer' } }));
  getState().setCallbackHandler('motion', 'onMotion');
  getState().addCallbackRule('motion', rule(line.id, { trigger: { kind: 'motion' }, action: { type: 'moveToPointer' } }));
  getState().setCallbackHandler('reshape', 'onReshape');
  return program();
}

describe('WB-CODE-20: Every explainable line in every generator format has an explanation', () => {
  it.each(['keep', 'stretch'] as const)('explains each explainable line, with reshape set to %s', (reshape) => {
    everythingFixture();
    getState().setReshapeMode(reshape);
    const outline = outlineCode(program());
    const scene = explainScene();
    outline.lines.forEach((line, i) => {
      if (!line.explainable) return;
      const e = explainLine(i, outline, scene);
      expect(e, `line ${i + 1}: ${line.text}`).not.toBeNull();
      expect(e!.signature.length, line.text).toBeGreaterThan(0);
      expect(e!.text, line.text).toMatch(/^[A-Z].*\.$/);
      expect(`${e!.signature} ${e!.text} ${e!.values.map((v) => v.control).join(' ')}`).not.toMatch(/coming soon|not supported|future|deferred|\b3D\b|lighting/i);
    });
  });
});

describe('WB-CODE-21: Value rows name the state field, its value and its control', () => {
  it('explains glTranslatef and the state line with the student\'s numbers', () => {
    const tri = addTriangle(0.4, -0.17, 0.5);
    getState().updateObjectName(tri.id, 'Triangle');
    getState().updateObjectTransform(tri.id, { translateX: 0.4, translateY: -0.17, rotate: 15 });
    const outline = outlineCode(program());
    const translate = explainLine(lineOf(outline, 'glTranslatef('), outline, explainScene())!;
    expect(translate.signature).toBe('glTranslatef(x, y, z)');
    expect(translate.values).toEqual([
      { arg: 'x', source: 'state_Triangle.x', value: '0.40', control: 'Translate X' },
      { arg: 'y', source: 'state_Triangle.y', value: '−0.17', control: 'Translate Y' },
    ]);
    expect(translate.stage).toBe('transformed');
    expect(translate.control).toEqual({ label: 'Translate X', group: 'transform', objectId: tri.id });
    const state = explainLine(lineOf(outline, 'ObjectState state_Triangle'), outline, explainScene())!;
    expect(state.values.map((v) => `${v.arg}=${v.value}·${v.control}`)).toEqual([
      'x=0.40·Translate X', 'y=−0.17·Translate Y', 'rotation=15°·Rotate', 'scaleX=1·Scale X', 'scaleY=1·Scale Y',
    ]);
    const vertex = explainLine(lineOf(outline, 'glVertex2f('), outline, explainScene())!;
    expect(vertex.values.map((v) => v.control)).toEqual(['Vertex 1', 'Vertex 1']);
    expect(vertex.control).toEqual({ label: 'Vertices', group: 'vertices', objectId: tri.id });
    const clear = explainLine(lineOf(outline, 'glClearColor('), outline, explainScene())!;
    expect(clear.control).toEqual({ label: 'Background', group: 'background', objectId: null });
    expect(explainLine(outline.lines.findIndex((l) => l.text === '{'), outline, explainScene())).toBeNull();
  });
});

describe('WB-CODE-22: Notes sit only on the key lines of draw functions', () => {
  it('notes move, turn, the draw call and a bound texture, scale only when it is not 1, 1, and nothing else', () => {
    const tri = addTriangle(0.4, -0.17, 0.5);
    getState().updateObjectName(tri.id, 'Triangle');
    getState().updateObjectTransform(tri.id, { translateX: 0.4, translateY: -0.17, rotate: 15 });
    let outline = outlineCode(program());
    const noted = outline.lines.map((_, i) => noteFor(i, outline, explainScene())).map((n, i) => (n ? `${outline.lines[i].text.trim().split('(')[0]}: ${n.map((p) => (typeof p === 'string' ? p : p.value)).join('')}` : null)).filter(Boolean);
    expect(noted).toEqual([
      'glTranslatef: move by your X 0.40, Y −0.17',
      'glRotatef: turn by 15°',
      'glBegin: every 3 vertices make a triangle',
    ]);
    const note = noteFor(lineOf(outline, 'glTranslatef('), outline, explainScene())!;
    expect(note[1]).toEqual({ value: '0.40', ref: 'state_Triangle.x' });
    getState().updateObjectTransform(tri.id, { scaleX: 1.5 });
    outline = outlineCode(program());
    expect(noteFor(lineOf(outline, 'glScalef('), outline, explainScene())!.map((p) => (typeof p === 'string' ? p : p.value)).join('')).toBe('stretch by 1.5 across, 1 up');
    expect(noteFor(lineOf(outline, 'glClearColor('), outline, explainScene())).toBeNull();
    for (const n of outline.lines.map((_, i) => noteFor(i, outline, explainScene())).filter(Boolean)) {
      const words = n!.map((p) => (typeof p === 'string' ? p : p.value)).join('').split(/\s+/).length;
      expect(words).toBeLessThanOrEqual(8);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/white-box/code-structure.test.ts`
Expected: FAIL with `Failed to resolve import "@/features/code-generation/model/code-explanations"`.

- [ ] **Step 3: Add the stage titles**

Append to `src/core/inspector/journey-stage.ts`:

```ts
export const JOURNEY_STAGE_TITLES: Record<JourneyStageId, string> = {
  stored: 'Stored',
  transformed: 'Transformed',
  projected: 'Projected',
  assembled: 'Assembled',
  rasterised: 'Rasterised',
  coloured: 'Coloured',
};
```

- [ ] **Step 4: Write the catalogue**

Create `src/features/code-generation/model/code-explanations.ts`:

```ts
/**
 * What each line of the generated program does, for the code panel's explanation strip and its
 * notes. Keyed by line pattern; templates are filled from the scene. Pure. Notes and explanations
 * are panel UI: the generator and Copy never include them.
 */
import type { InspectorGroupId } from '@/core/inspector/groups';
import type { JourneyStageId } from '@/core/inspector/journey-stage';
import type { PrimitiveType, SceneNode, ViewportLimits } from '@/core/types/scene';
import type { TextureAsset } from '@/core/types/textures';
import { assemblyFor } from '@/entities/scene/model/primitive-assembly';
import { fmt, short } from '@/shared/lib/format-number';
import { sanitizeName } from './generator/utils';
import type { CodeOutline, OutlineLine } from './code-outline';

export interface ValueRow {
  /** The argument or field, as the strip names it: `x`, `angle`, `usage`. */
  arg: string;
  /** Where the value comes from in the code: `state_Triangle.x`, or the literal's meaning. */
  source: string;
  value: string;
  /** The control that sets it, as the UI labels it. */
  control: string | null;
}

export interface ControlLink {
  label: string;
  group: InspectorGroupId;
  /** The object whose control it is; selected first when it is not the selection. */
  objectId: string | null;
}

export interface LineExplanation {
  signature: string;
  text: string;
  values: ValueRow[];
  /** The journey stage that works this line's numbers. */
  stage: JourneyStageId | null;
  control: ControlLink | null;
}

export type NotePart = string | { value: string; ref: string };

export interface ExplainScene {
  objects: readonly SceneNode[];
  viewportLimits: ViewportLimits;
  canvasBackgroundColor: string;
  canvas: { width: number; height: number };
  textures: readonly TextureAsset[];
}

interface Ctx {
  t: string;
  line: OutlineLine;
  index: number;
  outline: CodeOutline;
  scene: ExplainScene;
}

interface Entry {
  test: RegExp;
  explain: (m: RegExpExecArray, ctx: Ctx) => LineExplanation;
}

const byCode = (scene: ExplainScene, name: string | null | undefined) =>
  name ? scene.objects.find((o) => sanitizeName(o.name) === name) : undefined;
const nameOf = (scene: ExplainScene, code: string) => byCode(scene, code)?.name ?? code;
const objectOf = (ctx: Ctx, code?: string) => byCode(ctx.scene, code ?? ctx.line.object);

const plain = (signature: string, text: string, stage: JourneyStageId | null = null, control: ControlLink | null = null): LineExplanation => ({
  signature, text, values: [], stage, control,
});
const link = (label: string, group: InspectorGroupId, node?: SceneNode): ControlLink => ({ label, group, objectId: node?.id ?? null });

/** The comma-separated arguments of `fn(...)` on this line, without a float's trailing f. */
function argsOf(t: string, fn: string): string[] {
  const open = t.indexOf(`${fn}(`) + fn.length + 1;
  return t.slice(open, t.lastIndexOf(')')).split(',').map((a) => a.trim().replace(/^(-?[\d.]+)f$/, '$1'));
}
const num = (a: string) => fmt(Number(a));

const TRANSFORM_FIELDS = {
  x: { prop: 'translateX', control: 'Translate X' },
  y: { prop: 'translateY', control: 'Translate Y' },
  rotation: { prop: 'rotate', control: 'Rotate' },
  scaleX: { prop: 'scaleX', control: 'Scale X' },
  scaleY: { prop: 'scaleY', control: 'Scale Y' },
} as const;
type TransformField = keyof typeof TRANSFORM_FIELDS;

function fieldRow(arg: string, code: string, field: TransformField, node: SceneNode | undefined): ValueRow {
  const { prop, control } = TRANSFORM_FIELDS[field];
  const raw = node?.transform[prop];
  const value = raw === undefined ? '—' : field === 'rotation' ? `${short(raw)}°` : field.startsWith('scale') ? short(raw) : fmt(raw);
  return { arg, source: `state_${code}.${field}`, value, control };
}

const RULE_OF = (type: string) => assemblyFor(type as PrimitiveType, 0, 1).note;

const ARRAYS: Record<string, { what: string; stage: JourneyStageId; control: [string, InspectorGroupId] }> = {
  VERTEX: { what: 'positions', stage: 'stored', control: ['Buffers', 'buffers'] },
  COLOR: { what: 'colours', stage: 'coloured', control: ['Appearance', 'appearance'] },
  TEXTURE_COORD: { what: 'texture coordinates', stage: 'coloured', control: ['Texture', 'texture'] },
};
const HANDLE_WHAT: Record<string, string> = { vbo: 'positions', cbo: 'colours', uvbo: 'texture coordinates', ebo: 'indices' };
const CALLBACK_KIND: Record<string, string> = { Keyboard: 'keyboard', Special: 'arrow key', Mouse: 'mouse', Motion: 'mouse motion', Reshape: 'reshape', Idle: 'idle' };

function limitRows(scene: ExplainScene, names: [string, string, string, string]): ValueRow[] {
  const v = scene.viewportLimits;
  return (['left', 'right', 'bottom', 'top'] as const).map((arg, k) => ({
    arg, source: names[k], value: fmt([v.minX, v.maxX, v.minY, v.maxY][k]), control: 'Viewing volume',
  }));
}

const ENTRIES: Entry[] = [
  // --- Includes ---
  { test: /^#include <GL\/glew\.h>/, explain: () => plain('#include <GL/glew.h>', 'Loads GLEW, which finds the buffer functions (glGenBuffers, glBufferData, glMapBuffer) in the graphics driver. It must come before freeglut.h.') },
  { test: /^#include <GL\/freeglut\.h>/, explain: () => plain('#include <GL/freeglut.h>', 'Loads FreeGLUT, which opens the window, runs the main loop and calls your callbacks.') },
  { test: /^#include <cmath>/, explain: () => plain('#include <cmath>', 'Loads C++’s maths functions, such as sin and cos.') },
  { test: /^#include <iostream>/, explain: () => plain('#include <iostream>', 'Loads C++ input and output, which the texture loader uses.') },
  { test: /^#define STB_IMAGE_IMPLEMENTATION/, explain: () => plain('#define STB_IMAGE_IMPLEMENTATION', 'Tells stb_image.h to include its code here, not just its declarations.') },
  { test: /^#include "stb_image\.h"/, explain: () => plain('#include "stb_image.h"', 'Loads stb_image, which reads image files for textures.', 'coloured') },

  // --- Data ---
  { test: /^struct ObjectState/, explain: () => plain('struct ObjectState', 'Describes what every object keeps from frame to frame: its position, rotation and scale, and its colour and visibility when a callback changes them.', 'transformed') },
  {
    test: /^ObjectState state_(\w+) = /,
    explain: (m, ctx) => {
      const node = objectOf(ctx, m[1]);
      const drawer = node && (node.type === 'GROUP' || node.type === 'TEXT') ? 'draw()' : `draw_${m[1]}()`;
      return {
        signature: `ObjectState state_${m[1]}`,
        text: `${nameOf(ctx.scene, m[1])}’s starting position, rotation and scale. ${drawer} reads them every frame, and callbacks can change them while the program runs.`,
        values: (Object.keys(TRANSFORM_FIELDS) as TransformField[]).map((f) => fieldRow(f, m[1], f, node)),
        stage: 'transformed',
        control: link('Transform', 'transform', node),
      };
    },
  },
  { test: /^const ObjectState initial_(\w+) = /, explain: (m, ctx) => plain(`const ObjectState initial_${m[1]}`, `A copy of ${nameOf(ctx.scene, m[1])}’s starting values, kept so a Reset rule can put it back.`, 'transformed', link('Callbacks', 'callbacks')) },
  {
    test: /^float viewMinX/,
    explain: (_m, ctx) => ({
      signature: 'float viewMinX, viewMaxX, viewMinY, viewMaxY',
      text: 'The viewing volume’s edges, kept in variables so the reshape callback can widen them when the window changes shape.',
      values: limitRows(ctx.scene, ['viewMinX', 'viewMaxX', 'viewMinY', 'viewMaxY']),
      stage: 'projected',
      control: link('Viewing volume', 'viewing-volume'),
    }),
  },
  {
    test: /^GLfloat verts_(\w+)\[\] = \{(.*)\};$/,
    explain: (m, ctx) => ({
      signature: `GLfloat verts_${m[1]}[]`,
      text: `${nameOf(ctx.scene, m[1])}’s vertex positions, two floats (x, y) per vertex, packed in one C array.`,
      values: [{ arg: 'vertices', source: `verts_${m[1]}`, value: `${m[2].split(',').length / 2}`, control: 'Vertices' }],
      stage: 'stored',
      control: link('Buffers', 'buffers', objectOf(ctx, m[1])),
    }),
  },
  { test: /^GLfloat colors_(\w+)\[\]/, explain: (m, ctx) => plain(`GLfloat colors_${m[1]}[]`, `${nameOf(ctx.scene, m[1])}’s vertex colours, three floats (red, green, blue) per vertex, in the same order as the positions.`, 'coloured', link('Appearance', 'appearance', objectOf(ctx, m[1]))) },
  { test: /^GLfloat uvs_(\w+)\[\]/, explain: (m, ctx) => plain(`GLfloat uvs_${m[1]}[]`, `${nameOf(ctx.scene, m[1])}’s texture coordinates, two floats (u, v) per vertex.`, 'coloured', link('Texture', 'texture', objectOf(ctx, m[1]))) },
  {
    test: /^GLuint indices_(\w+)\[\] = \{(.*)\};$/,
    explain: (m, ctx) => ({
      signature: `GLuint indices_${m[1]}[]`,
      text: 'The order to draw the vertices in. Each number is a position in the arrays above, so a corner two shapes share is stored once.',
      values: [{ arg: 'indices', source: `indices_${m[1]}`, value: `${m[2].split(',').length}`, control: 'Deduplicate vertices' }],
      stage: 'stored',
      control: link('Buffers', 'buffers', objectOf(ctx, m[1])),
    }),
  },
  { test: /^GLuint (vbo|cbo|ebo|uvbo)_(\w+) = 0;$/, explain: (m, ctx) => plain(`GLuint ${m[1]}_${m[2]}`, `A name for the GPU buffer that holds ${nameOf(ctx.scene, m[2])}’s ${HANDLE_WHAT[m[1]]}. It starts at 0; glGenBuffers in init() gives it a real name.`, 'stored', link('Buffers', 'buffers', objectOf(ctx, m[2]))) },
  { test: /^GLuint tex_(\w+) = 0;$/, explain: (m, ctx) => plain(`GLuint tex_${m[1]}`, `A name for ${nameOf(ctx.scene, m[1])}’s texture. It starts at 0; glGenTextures in init() gives it a real name.`, 'coloured', link('Texture', 'texture', objectOf(ctx, m[1]))) },
  { test: /^void (\w+)\(\);$/, explain: (m) => plain(`void ${m[1]}();`, `Tells the compiler that ${m[1]}() exists, so code above its definition can call it.`) },

  // --- Functions ---
  { test: /^void draw_(\w+)\(\)$/, explain: (m, ctx) => plain(`void draw_${m[1]}()`, `Draws ${nameOf(ctx.scene, m[1])}. It saves the matrix, moves the object into place, sends its vertices, and restores the matrix for the next object.`, 'transformed', link('Transform', 'transform', objectOf(ctx, m[1]))) },
  { test: /^void draw\(\)$/, explain: () => plain('void draw()', 'Draws the scene by calling each object’s draw function. Groups and text are drawn here directly.') },
  { test: /^void update_buffers\(\)$/, explain: () => plain('void update_buffers()', 'Runs every frame to refresh the buffers whose usage hint is DYNAMIC or STREAM.', 'stored') },
  { test: /^void display\(\)$/, explain: () => plain('void display()', 'GLUT calls display() whenever the window needs redrawing. It clears the frame, sets up the view, draws the scene and shows the result.', 'rasterised') },
  { test: /^void windowToWorld\(/, explain: () => plain('void windowToWorld(x, y, wx, wy)', 'Turns a mouse position in window pixels into scene coordinates, using the viewing volume. GLUT counts y from the top of the window; the scene counts it from the bottom.', 'projected') },
  { test: /^void init\(\)$/, explain: () => plain('void init()', 'Runs once, before the main loop. It uploads buffers to the GPU and loads textures, so drawing never repeats that work.', 'stored') },
  { test: /^void _vams_idle\(\)$/, explain: () => plain('void _vams_idle()', 'GLUT calls this whenever it has nothing else to do, about once a frame. It refreshes the changing buffers and calls your idle callback.') },
  { test: /^int main\(/, explain: () => plain('int main(argc, argv)', 'Where the program starts. It sets up GLUT, opens the window, registers the callbacks and hands control to the main loop.') },
  { test: /^void (\w+)\(unsigned char key, int x, int y\)$/, explain: (m) => plain(`void ${m[1]}(key, x, y)`, `GLUT calls ${m[1]} when a key is pressed: key is the character, and x and y are where the mouse was.`, null, link('Callbacks', 'callbacks')) },
  { test: /^void (\w+)\(int key, int x, int y\)$/, explain: (m) => plain(`void ${m[1]}(key, x, y)`, `GLUT calls ${m[1]} when an arrow key is pressed; key names the arrow.`, null, link('Callbacks', 'callbacks')) },
  { test: /^void (\w+)\(int button, int state, int x, int y\)$/, explain: (m) => plain(`void ${m[1]}(button, state, x, y)`, `GLUT calls ${m[1]} when a mouse button goes down or up, with the button, its state and the mouse position.`, null, link('Callbacks', 'callbacks')) },
  { test: /^void (\w+)\(int x, int y\)$/, explain: (m) => plain(`void ${m[1]}(x, y)`, `GLUT calls ${m[1]} when the mouse moves with a button held, with the mouse position.`, null, link('Callbacks', 'callbacks')) },
  { test: /^void (\w+)\(int width, int height\)$/, explain: (m) => plain(`void ${m[1]}(width, height)`, `GLUT calls ${m[1]} when the window changes size, with its new width and height.`, 'projected', link('Callbacks', 'callbacks')) },
  { test: /^void (\w+)\(\)$/, explain: (m) => plain(`void ${m[1]}()`, `GLUT calls ${m[1]} whenever nothing else is happening, about once a frame.`, null, link('Callbacks', 'callbacks')) },

  // --- Callback branches and state changes ---
  { test: /^case '(.)':$/, explain: (m) => plain(`case '${m[1]}':`, `The lines below run when the key pressed is ${m[1] === ' ' ? 'Space' : m[1]}.`, null, link('Callbacks', 'callbacks')) },
  { test: /^case GLUT_KEY_(\w+):$/, explain: (m) => plain(`case GLUT_KEY_${m[1]}:`, `The lines below run when the ${m[1].toLowerCase()} arrow key is pressed.`, null, link('Callbacks', 'callbacks')) },
  { test: /^if \(button == GLUT_(\w+)_BUTTON && state == GLUT_(UP|DOWN)\) \{$/, explain: (m) => plain('if (button == … && state == …)', `The lines inside run when the ${m[1].toLowerCase()} mouse button goes ${m[2].toLowerCase()}.`, null, link('Callbacks', 'callbacks')) },
  { test: /^state_(\w+)\.(x|y) \+= (-?[\d.]+)f;$/, explain: (m, ctx) => plain(`state_${m[1]}.${m[2]} +=`, `Moves ${nameOf(ctx.scene, m[1])} by ${num(m[3])} along ${m[2]} each time this runs.`, 'transformed', link('Callbacks', 'callbacks')) },
  { test: /^state_(\w+)\.rotation \+= (-?[\d.]+)f;$/, explain: (m, ctx) => plain(`state_${m[1]}.rotation +=`, `Turns ${nameOf(ctx.scene, m[1])} by ${short(Number(m[2]))}° each time this runs.`, 'transformed', link('Callbacks', 'callbacks')) },
  { test: /^state_(\w+)\.scale(X|Y) \*= (-?[\d.]+)f;$/, explain: (m, ctx) => plain(`state_${m[1]}.scale${m[2]} *=`, `Scales ${nameOf(ctx.scene, m[1])} by ${short(Number(m[3]))} ${m[2] === 'X' ? 'across' : 'up'} each time this runs.`, 'transformed', link('Callbacks', 'callbacks')) },
  { test: /^state_(\w+)\.(x|y) = w(x|y);$/, explain: (m, ctx) => plain(`state_${m[1]}.${m[2]} = w${m[3]}`, `Moves ${nameOf(ctx.scene, m[1])} to the mouse position.`, 'transformed', link('Callbacks', 'callbacks')) },
  { test: /^state_(\w+)\.(r|g|b) = ([\d.]+)f;$/, explain: (m, ctx) => plain(`state_${m[1]}.${m[2]} =`, `Sets the ${{ r: 'red', g: 'green', b: 'blue' }[m[2]]} of the colour ${nameOf(ctx.scene, m[1])} switches to.`, 'coloured', link('Callbacks', 'callbacks')) },
  { test: /^state_(\w+)\.useColor = true;$/, explain: (m, ctx) => plain(`state_${m[1]}.useColor = true`, `Makes ${nameOf(ctx.scene, m[1])} use the colour set just above instead of its own.`, 'coloured', link('Callbacks', 'callbacks')) },
  { test: /^state_(\w+)\.visible = (true|false|!state_\w+\.visible);$/, explain: (m, ctx) => plain(`state_${m[1]}.visible =`, `${m[2] === 'true' ? 'Shows' : m[2] === 'false' ? 'Hides' : 'Shows or hides'} ${nameOf(ctx.scene, m[1])}.`, null, link('Callbacks', 'callbacks')) },
  { test: /^state_(\w+) = initial_\w+;$/, explain: (m, ctx) => plain(`state_${m[1]} = initial_${m[1]}`, `Puts ${nameOf(ctx.scene, m[1])} back to its starting values.`, 'transformed', link('Callbacks', 'callbacks')) },
  { test: /^glewExperimental = GL_TRUE;$/, explain: () => plain('glewExperimental = GL_TRUE', 'Asks GLEW to load every buffer function the driver offers, even ones it would otherwise skip.') },

  // --- The program's own calls ---
  { test: /^if \(state_(\w+)\.visible\) draw_\w+\(\);$/, explain: (m, ctx) => plain(`draw_${m[1]}()`, `Draws ${nameOf(ctx.scene, m[1])} only while it is visible; a visibility rule changes that.`) },
  { test: /^draw_(\w+)\(\);$/, explain: (m, ctx) => plain(`draw_${m[1]}()`, `Draws ${nameOf(ctx.scene, m[1])}.`, 'transformed') },
  { test: /^draw\(\);$/, explain: () => plain('draw()', 'Draws the scene.') },
  { test: /^init\(\);$/, explain: () => plain('init()', 'Runs the one-time setup before the main loop starts.', 'stored') },
  { test: /^update_buffers\(\);$/, explain: () => plain('update_buffers()', 'Refreshes the buffers that change every frame.', 'stored') },
  { test: /^windowToWorld\(x, y, &wx, &wy\);$/, explain: () => plain('windowToWorld(x, y, &wx, &wy)', 'Turns the mouse position into scene coordinates, wx and wy.', 'projected') },

  // --- OpenGL, GLUT, GLEW and stb_image calls ---
  { test: /\bglPushMatrix\(/, explain: () => plain('glPushMatrix()', 'Saves the current matrix, so this object’s moves don’t carry over to the next one.', 'transformed') },
  { test: /\bglPopMatrix\(/, explain: () => plain('glPopMatrix()', 'Restores the matrix that glPushMatrix saved.', 'transformed') },
  {
    test: /\bglTranslatef\(state_(\w+)\.x/,
    explain: (m, ctx) => {
      const node = objectOf(ctx, m[1]);
      return {
        signature: 'glTranslatef(x, y, z)',
        text: `Moves everything drawn after it by (x, y). Here that is ${nameOf(ctx.scene, m[1])}’s position.`,
        values: [fieldRow('x', m[1], 'x', node), fieldRow('y', m[1], 'y', node)],
        stage: 'transformed',
        control: link('Translate X', 'transform', node),
      };
    },
  },
  {
    test: /\bglRotatef\(state_(\w+)\.rotation/,
    explain: (m, ctx) => {
      const node = objectOf(ctx, m[1]);
      return {
        signature: 'glRotatef(angle, x, y, z)',
        text: 'Turns everything drawn after it by angle degrees, counter-clockwise, around the z axis (0, 0, 1).',
        values: [fieldRow('angle', m[1], 'rotation', node)],
        stage: 'transformed',
        control: link('Rotate', 'transform', node),
      };
    },
  },
  {
    test: /\bglScalef\(state_(\w+)\.scaleX/,
    explain: (m, ctx) => {
      const node = objectOf(ctx, m[1]);
      return {
        signature: 'glScalef(x, y, z)',
        text: 'Stretches everything drawn after it by x across and y up.',
        values: [fieldRow('x', m[1], 'scaleX', node), fieldRow('y', m[1], 'scaleY', node)],
        stage: 'transformed',
        control: link('Scale X', 'transform', node),
      };
    },
  },
  { test: /\bglShadeModel\((GL_\w+)\)/, explain: (m, ctx) => ({ ...plain('glShadeModel(mode)', 'Chooses how colour fills the shape: GL_SMOOTH blends the vertex colours across it, GL_FLAT gives it one colour.', 'coloured', link('Appearance', 'appearance', objectOf(ctx))), values: [{ arg: 'mode', source: 'shading', value: m[1], control: 'Appearance' }] }) },
  { test: /\bglLineWidth\(([\d.]+)f\)/, explain: (m, ctx) => ({ ...plain('glLineWidth(width)', Number(m[1]) === 1 && ctx.t.startsWith('glLineWidth(1.0f)') && ctx.outline.lines.slice(0, ctx.index).some((l) => l.object === ctx.line.object && /glLineWidth\(/.test(l.text)) ? 'Puts the line width back to 1 pixel for the next object.' : 'Sets how thick lines are drawn, in pixels.', 'assembled', link('Line width', 'appearance', objectOf(ctx))), values: [{ arg: 'width', source: 'line width', value: short(Number(m[1])), control: 'Line width' }] }) },
  { test: /\bglEnable\(GL_LINE_STIPPLE\)/, explain: (_m, ctx) => plain('glEnable(GL_LINE_STIPPLE)', 'Turns on the dash pattern for the lines that follow.', 'assembled', link('Line stipple', 'appearance', objectOf(ctx))) },
  { test: /\bglLineStipple\((\d+), (0x[0-9A-F]+)\)/, explain: (m, ctx) => ({ ...plain('glLineStipple(factor, pattern)', 'Sets the dash pattern: each of the 16 bits is a dash or a gap, and each bit lasts factor pixels.', 'assembled', link('Line stipple', 'appearance', objectOf(ctx))), values: [{ arg: 'factor', source: 'stipple factor', value: m[1], control: 'Stipple factor' }, { arg: 'pattern', source: 'stipple pattern', value: m[2], control: 'Line stipple' }] }) },
  { test: /\bglDisable\(GL_LINE_STIPPLE\)/, explain: () => plain('glDisable(GL_LINE_STIPPLE)', 'Turns the dash pattern off again for the next object.', 'assembled') },
  { test: /\bglPointSize\(([\d.]+)f\)/, explain: (m) => plain('glPointSize(size)', Number(m[1]) === 1 ? 'Puts the point size back to 1 pixel for the next object.' : `Draws each point ${short(Number(m[1]))} pixels wide; the default of 1 is hard to see.`, 'assembled') },
  { test: /\bglEnable\(GL_TEXTURE_2D\)/, explain: (_m, ctx) => plain('glEnable(GL_TEXTURE_2D)', 'Turns texturing on for what is drawn next.', 'coloured', link('Texture', 'texture', objectOf(ctx))) },
  { test: /\bglDisable\(GL_TEXTURE_2D\)/, explain: () => plain('glDisable(GL_TEXTURE_2D)', 'Turns texturing off again, so the next object is drawn without it.', 'coloured') },
  { test: /\bglBindTexture\(GL_TEXTURE_2D, tex_(\w+)\)/, explain: (m, ctx) => plain('glBindTexture(target, texture)', `Chooses which texture to use: the one init() loaded for ${nameOf(ctx.scene, m[1])}.`, 'coloured', link('Texture', 'texture', objectOf(ctx, m[1]))) },
  { test: /\bglBegin\(GL_(\w+)\)/, explain: (m, ctx) => plain('glBegin(mode)', `Starts a list of vertices that OpenGL joins into shapes: ${RULE_OF(m[1])}.`, 'assembled', link('Vertices', 'vertices', objectOf(ctx))) },
  { test: /\bglEnd\(/, explain: () => plain('glEnd()', 'Ends the list of vertices glBegin started; OpenGL draws the shapes now.', 'assembled') },
  {
    test: /\bglColor3(f|ub)\(([^)]*)\)/,
    explain: (m, ctx) => {
      if (m[2].includes('state_')) return plain('glColor3f(r, g, b)', 'Uses the colour a callback set, while that object’s useColor is on.', 'coloured', link('Callbacks', 'callbacks'));
      const [r, g, b] = argsOf(ctx.t, `glColor3${m[1]}`);
      const range = m[1] === 'f' ? 'each from 0 to 1' : 'each from 0 to 255';
      const value = (a: string) => (m[1] === 'f' ? num(a) : a);
      const block = ctx.outline.blocks.find((x) => x.id === ctx.line.block);
      const isClear = block?.kind === 'main';
      return {
        signature: `glColor3${m[1]}(r, g, b)`,
        text: `Sets the colour for the vertices that follow: red, green and blue, ${range}.`,
        values: [
          { arg: 'r', source: 'red', value: value(r), control: 'Appearance' },
          { arg: 'g', source: 'green', value: value(g), control: 'Appearance' },
          { arg: 'b', source: 'blue', value: value(b), control: 'Appearance' },
        ],
        stage: 'coloured',
        control: isClear ? null : link('Appearance', 'appearance', objectOf(ctx)),
      };
    },
  },
  {
    test: /\bglVertex2f\((-?[\d.]+)f, (-?[\d.]+)f\)/,
    explain: (m, ctx) => {
      const n = ctx.outline.lines.slice(0, ctx.index + 1).filter((l) => l.object === ctx.line.object && l.block === ctx.line.block && l.text.includes('glVertex2f(')).length;
      return {
        signature: 'glVertex2f(x, y)',
        text: 'Sends one vertex at (x, y), in the object’s own coordinates. It takes the colour set just before it.',
        values: [
          { arg: 'x', source: `vertex ${n}`, value: num(m[1]), control: `Vertex ${n}` },
          { arg: 'y', source: `vertex ${n}`, value: num(m[2]), control: `Vertex ${n}` },
        ],
        stage: 'stored',
        control: link('Vertices', 'vertices', objectOf(ctx)),
      };
    },
  },
  { test: /\bglTexCoord2f\(/, explain: (_m, ctx) => plain('glTexCoord2f(u, v)', 'Sets the texture coordinate (u, v) for the next vertex.', 'coloured', link('Texture', 'texture', objectOf(ctx))) },
  { test: /\bglEnableClientState\(GL_(\w+)_ARRAY\)/, explain: (m, ctx) => plain('glEnableClientState(array)', `Tells OpenGL to read the ${ARRAYS[m[1]].what} from an array when drawing.`, ARRAYS[m[1]].stage, link(ARRAYS[m[1]].control[0], ARRAYS[m[1]].control[1], objectOf(ctx))) },
  { test: /\bglDisableClientState\(GL_(\w+)_ARRAY\)/, explain: (m) => plain('glDisableClientState(array)', `Stops reading the ${ARRAYS[m[1]].what} from an array, so the next object starts clean.`, ARRAYS[m[1]].stage) },
  { test: /\bgl(Vertex|Color|TexCoord)Pointer\((\d), GL_FLOAT, 0, (\w+)\)/, explain: (m, ctx) => plain(`gl${m[1]}Pointer(size, type, stride, data)`, `Points OpenGL at the ${{ Vertex: 'positions', Color: 'colours', TexCoord: 'texture coordinates' }[m[1]]}: ${m[2]} floats per vertex, packed with no gap (stride 0), ${m[3] === '0' ? 'in the buffer bound just above, from its start' : `in ${m[3]}`}.`, m[1] === 'Vertex' ? 'stored' : 'coloured', link('Buffers', 'buffers', objectOf(ctx))) },
  { test: /\bglDrawArrays\(GL_(\w+), 0, (\d+)\)/, explain: (m, ctx) => plain('glDrawArrays(mode, first, count)', `Draws ${m[2]} vertices from the arrays, first to last, joined into shapes: ${RULE_OF(m[1])}.`, 'assembled', link('Rendering mode', 'buffers', objectOf(ctx))) },
  { test: /\bglDrawElements\(GL_(\w+), (\d+), GL_UNSIGNED_INT, (\w+)\)/, explain: (m, ctx) => plain('glDrawElements(mode, count, type, indices)', `Draws ${m[2]} vertices in the order the index list gives, joined into shapes: ${RULE_OF(m[1])}.`, 'assembled', link('Deduplicate vertices', 'buffers', objectOf(ctx))) },
  { test: /\bglBindBuffer\((GL_\w+), (\w+)\)/, explain: (m, ctx) => plain('glBindBuffer(target, buffer)', m[2] === '0' ? 'Unbinds the buffer, so later array calls read the program’s own memory again.' : `Makes ${m[2]} the current buffer; the buffer calls after it act on that one.`, 'stored', link('Buffers', 'buffers', objectOf(ctx))) },
  { test: /\bglGenBuffers\(1, &(\w+)\)/, explain: (m, ctx) => plain('glGenBuffers(n, buffers)', `Asks OpenGL for a new buffer name and stores it in ${m[1]}.`, 'stored', link('Buffers', 'buffers', objectOf(ctx))) },
  {
    test: /\bglBufferData\((GL_\w+), sizeof\((\w+)\), (\w+), GL_(\w+)_DRAW\)/,
    explain: (m, ctx) => ({
      ...plain('glBufferData(target, size, data, usage)', `Copies ${m[2]} to the GPU buffer. The usage hint tells the driver how often it will change.`, 'stored', link('Buffer usage hint', 'buffers', objectOf(ctx))),
      values: [{ arg: 'usage', source: 'buffer usage hint', value: `GL_${m[4]}_DRAW`, control: 'Buffer usage hint' }],
    }),
  },
  { test: /\bglBufferSubData\(/, explain: (_m, ctx) => plain('glBufferSubData(target, offset, size, data)', 'Replaces bytes in a buffer already on the GPU, without making a new one.', 'stored', link('Buffer update method', 'buffers', objectOf(ctx))) },
  { test: /\bglMapBuffer\(/, explain: (_m, ctx) => plain('glMapBuffer(target, access)', 'Gives the program a pointer straight into the buffer’s memory, so it can change values in place.', 'stored', link('Buffer update method', 'buffers', objectOf(ctx))) },
  { test: /\bglUnmapBuffer\(/, explain: () => plain('glUnmapBuffer(target)', 'Hands the buffer back to OpenGL after editing it through the pointer.', 'stored') },
  { test: /\bglGenTextures\(1, &(\w+)\)/, explain: (m, ctx) => plain('glGenTextures(n, textures)', `Asks OpenGL for a new texture name and stores it in ${m[1]}.`, 'coloured', link('Texture', 'texture', objectOf(ctx))) },
  { test: /\bglTexParameteri\(GL_TEXTURE_2D, GL_TEXTURE_WRAP_(S|T), (GL_\w+)\)/, explain: (m, ctx) => ({ ...plain('glTexParameteri(target, wrap, mode)', `Chooses what happens when ${m[1] === 'S' ? 'u' : 'v'} goes outside 0 to 1: GL_REPEAT tiles the texture, GL_CLAMP_TO_EDGE stretches its edge.`, 'coloured', link('Wrap mode', 'texture', objectOf(ctx))), values: [{ arg: 'mode', source: 'wrap mode', value: m[2], control: 'Wrap mode' }] }) },
  { test: /\bglTexParameteri\(GL_TEXTURE_2D, GL_TEXTURE_(MIN|MAG)_FILTER, (GL_\w+)\)/, explain: (m, ctx) => ({ ...plain('glTexParameteri(target, filter, mode)', `Chooses how texels are picked when the texture is drawn ${m[1] === 'MIN' ? 'smaller' : 'larger'} than it is: GL_NEAREST takes one, GL_LINEAR blends four.`, 'coloured', link('Filter mode', 'texture', objectOf(ctx))), values: [{ arg: 'mode', source: 'filter mode', value: m[2], control: 'Filter mode' }] }) },
  { test: /\bglTexEnvi\(/, explain: () => plain('glTexEnvi(target, name, mode)', 'Makes the texture replace the vertex colour instead of mixing with it.', 'coloured') },
  { test: /\bstbi_set_flip_vertically_on_load\(/, explain: () => plain('stbi_set_flip_vertically_on_load(flip)', 'Flips images as they load: image files start at the top row, OpenGL textures at the bottom.', 'coloured') },
  { test: /\bstbi_load\(/, explain: () => plain('stbi_load(path, width, height, channels, 4)', 'Reads the image file into memory, four channels (RGBA) per pixel. Put the full path to your image here.', 'coloured') },
  { test: /\bglTexImage2D\(/, explain: () => plain('glTexImage2D(target, level, …, data)', 'Copies the image to the GPU as the texture’s pixels.', 'coloured') },
  { test: /\bstbi_image_free\(/, explain: () => plain('stbi_image_free(data)', 'Frees the image now that the GPU has its own copy.', 'coloured') },
  { test: /\bglClear\(GL_COLOR_BUFFER_BIT\)/, explain: () => plain('glClear(mask)', 'Wipes the frame to the background colour before anything is drawn.', 'rasterised', link('Background', 'background')) },
  { test: /\bglMatrixMode\(GL_PROJECTION\)/, explain: () => plain('glMatrixMode(GL_PROJECTION)', 'Chooses the projection matrix, which maps the viewing volume to the window, for the calls that follow.', 'projected') },
  { test: /\bglMatrixMode\(GL_MODELVIEW\)/, explain: () => plain('glMatrixMode(GL_MODELVIEW)', 'Chooses the modelview matrix, which places objects, for the calls that follow.', 'transformed') },
  { test: /\bglLoadIdentity\(/, explain: () => plain('glLoadIdentity()', 'Resets the current matrix to the identity, undoing what came before.') },
  {
    test: /\bglOrtho\(([^,]+), ([^,]+), ([^,]+), ([^,]+), /,
    explain: (m, ctx) => ({
      signature: 'glOrtho(left, right, bottom, top, near, far)',
      text: 'Sets the viewing volume, the part of the scene the window shows: x from left to right and y from bottom to top become −1 to 1.',
      values: limitRows(ctx.scene, [m[1], m[2], m[3], m[4]].map((a) => (/^-?[\d.]+$/.test(a) ? 'viewing volume' : a)) as [string, string, string, string]),
      stage: 'projected',
      control: link('Viewing volume', 'viewing-volume'),
    }),
  },
  { test: /\bglutSwapBuffers\(/, explain: () => plain('glutSwapBuffers()', 'Shows the frame just drawn. Drawing happens on a hidden frame, so the window never shows one half-finished.', 'rasterised') },
  { test: /\bglutPostRedisplay\(/, explain: () => plain('glutPostRedisplay()', 'Asks GLUT to call display() again soon, so the change shows.') },
  { test: /\bglutInit\(/, explain: () => plain('glutInit(&argc, argv)', 'Starts GLUT and lets it read its command-line options.') },
  { test: /\bglutInitDisplayMode\(/, explain: () => plain('glutInitDisplayMode(mode)', 'Chooses the window’s pixel format: double buffering, RGB colour, and smoothed edges (multisampling).', 'rasterised') },
  { test: /\bglutInitWindowSize\((\d+), (\d+)\)/, explain: (m) => ({ ...plain('glutInitWindowSize(width, height)', 'Sets the window’s size in pixels. VAMS uses the canvas size, so the program looks like the canvas.', 'rasterised'), values: [{ arg: 'width', source: 'canvas width', value: m[1], control: null }, { arg: 'height', source: 'canvas height', value: m[2], control: null }] }) },
  { test: /\bglutCreateWindow\(/, explain: () => plain('glutCreateWindow(title)', 'Opens the window, with the title shown in its title bar.') },
  { test: /\bglewInit\(/, explain: () => plain('glewInit()', 'Finds the buffer functions in the graphics driver. It needs a window first, and must run before any buffer call.') },
  {
    test: /\bglClearColor\(([\d.]+)f, ([\d.]+)f, ([\d.]+)f, 1\.0f\)/,
    explain: (m) => ({
      ...plain('glClearColor(r, g, b, a)', 'Sets the colour glClear wipes the frame to: your background.', 'rasterised', link('Background', 'background')),
      values: [
        { arg: 'r', source: 'red', value: num(m[1]), control: 'Background' },
        { arg: 'g', source: 'green', value: num(m[2]), control: 'Background' },
        { arg: 'b', source: 'blue', value: num(m[3]), control: 'Background' },
      ],
    }),
  },
  { test: /\bglutDisplayFunc\((\w+)\)/, explain: (m) => plain('glutDisplayFunc(function)', `Registers ${m[1]}() as the function GLUT calls to draw a frame.`) },
  { test: /\bglut(Keyboard|Special|Mouse|Motion|Reshape|Idle)Func\((\w+)\)/, explain: (m) => plain(`glut${m[1]}Func(function)`, `Registers ${m[2]} as the ${CALLBACK_KIND[m[1]]} callback.`, null, link('Callbacks', 'callbacks')) },
  { test: /\bglutMainLoop\(/, explain: () => plain('glutMainLoop()', 'Hands control to GLUT, which waits for events and calls your callbacks until the window closes.') },
  { test: /\bglViewport\(/, explain: () => plain('glViewport(x, y, width, height)', 'Uses the whole window for drawing.', 'rasterised') },
  { test: /\bglutGet\(GLUT_WINDOW_(WIDTH|HEIGHT)\)/, explain: (m) => plain('glutGet(what)', `Asks GLUT for the window’s current ${m[1].toLowerCase()}.`) },
  { test: /\bglRasterPos2f\(/, explain: (_m, ctx) => plain('glRasterPos2f(x, y)', 'Sets where the next bitmap text starts, in the text’s own coordinates.', 'stored', link('Transform', 'transform', objectOf(ctx))) },
  { test: /\bglutBitmapCharacter\(/, explain: () => plain('glutBitmapCharacter(font, character)', 'Draws one character of text as a bitmap at the raster position, then moves the position along.', 'rasterised') },
  { test: /^(\w+)\(\);$/, explain: (m) => plain(`${m[1]}()`, `Calls ${m[1]}, your idle callback.`, null, link('Callbacks', 'callbacks')) },
];

export function explainLine(index: number, outline: CodeOutline, scene: ExplainScene): LineExplanation | null {
  const line = outline.lines[index];
  if (!line || !line.explainable) return null;
  const t = line.text.trim();
  for (const entry of ENTRIES) {
    const m = entry.test.exec(t);
    if (m) return entry.explain(m, { t, line, index, outline, scene });
  }
  return null;
}

export function noteFor(index: number, outline: CodeOutline, scene: ExplainScene): NotePart[] | null {
  const line = outline.lines[index];
  if (!line || !line.object) return null;
  const block = outline.blocks.find((b) => b.id === line.block);
  if (!block || block.kind !== 'draw-object') return null;
  const node = byCode(scene, line.object);
  if (!node) return null;
  const t = line.text.trim();
  const code = line.object;
  const tr = node.transform;
  if (t.startsWith('glTranslatef(')) {
    return ['move by your X ', { value: fmt(tr.translateX), ref: `state_${code}.x` }, ', Y ', { value: fmt(tr.translateY), ref: `state_${code}.y` }];
  }
  if (t.startsWith('glRotatef(')) return ['turn by ', { value: `${short(tr.rotate)}°`, ref: `state_${code}.rotation` }];
  if (t.startsWith('glScalef(')) {
    if (tr.scaleX === 1 && tr.scaleY === 1) return null;
    return ['stretch by ', { value: short(tr.scaleX), ref: `state_${code}.scaleX` }, ' across, ', { value: short(tr.scaleY), ref: `state_${code}.scaleY` }, ' up'];
  }
  if (/^gl(Begin|DrawArrays|DrawElements)\(/.test(t)) return [assemblyFor(node.type as PrimitiveType, 0, node.vertices.length).note];
  if (t.startsWith('glBindTexture(')) {
    const name = scene.textures.find((tex) => tex.id === node.texture?.textureId)?.name;
    return name ? ['paint with ', name] : null;
  }
  return null;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/white-box/code-structure.test.ts`
Expected: PASS.

If WB-CODE-20 reports a line with no explanation, add an entry for that exact generator format; never mark the line unexplainable to pass. If the catalogue's `glLineWidth` reset branch misfires (it compares against earlier `glLineWidth` lines of the same object), keep the rule: in a draw function, the second `glLineWidth` is the reset.

- [ ] **Step 6: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/features/code-generation/model/code-explanations.ts src/core/inspector/journey-stage.ts tests/white-box/code-structure.test.ts
git diff --staged
git commit -m "feat(code): a catalogue that explains every line the generator writes, with the student's values"
```

---

### Task 14: The explanation strip, notes and the footer hint

**Files:**
- Modify: `src/shared/ui/code-viewer/types.ts` (add `CodeNote`, `CodeStrip`)
- Modify: `src/shared/ui/code-viewer/CodeViewer.tsx`, `code-viewer.scss`
- Modify: `src/features/code-generation/ui/SceneCodePanel.tsx`
- Modify: `src/core/store/types.ts`, `runtime-slice.ts`, `index.ts` (`revealedGroup`, `revealGroup`; the selection subscription clears it)
- Modify: `src/widgets/layout/editor-column/use-group-focus.ts` (outline a revealed group in Author mode)
- Modify: `tests/setup.ts`, `tests/black-box/code-panel.test.ts` (append)

**Interfaces:**
- Consumes: `explainLine`, `noteFor` and `ExplainScene` (Task 13); `stateFieldAt` (Task 2); `JOURNEY_STAGE_TITLES` (Task 13); the store's `explainedLine`, `setExplainedLine`, `codeNotes` and `setCodeNotes` (Task 1); `setJourneyStageOverride` (Task 8); `setCodePane` and `selectObject`.
- Produces, in `types.ts`:

```ts
/** A note under a code line: plain words, and values that are amber when they just changed. */
export type CodeNote = Array<{ text: string; changed?: boolean }>;
export interface CodeStrip {
  signature: string;
  text: string;
  values: Array<{ arg: string; source: string; value: string; control: string | null }>;
  links: Array<{ label: string; onSelect: () => void }>;
}
```

- Produces, as new `CodeViewer` props:

```ts
explainable?: ReadonlySet<number>;
explainedLine?: number | null;
onExplain?: (line: number | null) => void;
strip?: CodeStrip | null;
notes?: ReadonlyMap<number, CodeNote>;
notesOn?: boolean;
onToggleNotes?: () => void;
```

- Produces, in the store: `revealedGroup: InspectorGroupId | null` and `revealGroup(group: InspectorGroupId): void`. It:
  - switches the rail to the group's panel (Scene for object groups, Callbacks for `callbacks`, else Settings);
  - shows the panel;
  - opens the group without touching `lastOpenedGroup`;
  - sets `revealedGroup`.

  It is cleared by a selection change, `toggleGroup` and `setActiveSection`.
- Produces these DOM hooks:
  - Explainable lines: `.code-line.is-explainable[role="button"]`, with `aria-expanded` and `aria-controls`.
  - `.code-line.is-explained`, `.code-note` and `.code-note__value.is-changed`.
  - `section.code-strip`, with a `[aria-live="polite"]` body, `.code-strip__sig`, `.code-strip__text`, `table.code-strip__values`, `.code-strip__link` and the button named "Close explanation".
  - `p.code-hint`, and the header word `Notes` with `aria-pressed`.

Behaviour (spec §2, "The explanation strip"):
- **Opening.** Clicking an explainable line, or Enter or Space on it, explains it.
- **Moving.** Arrow Up and Arrow Down move focus to the previous or next explainable line that is showing. While the strip is open, they explain that line too.
- **Closing.** Escape, or the ✕, closes the strip and keeps focus on the line.
- **Tab stop.** Only one line is in the tab order: the explained line, else the first explainable line showing.
- **Forced open.** The explained line's fold opens (its line joins `forced`), and the line scrolls into view.
- **Footer.** It shows the strip when one is open, and the hint "**Click any line** to see what it does." otherwise.
- **Notes.** They show under their lines while `notesOn`, aligned under the code (the line's leading spaces in the mono font), in UI type `--text-xs` and `--ink-dim`. A value that just changed is `--value` (the mock's `.note b`).

The strip has no mock; it follows the same system:
- `--paper-raised` surface with `--rule` above, and padding 10 px 14 px;
- signature in mono `--text-sm` `--code-fn`;
- text in `--text-sm` `--ink-muted`;
- the "Your values" label styled like the journey's picture label;
- values in a small mono table, the value amber;
- links in `--accent-text`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/black-box/code-panel.test.ts`:

```ts
import { EditorPanel } from '@/widgets/layout/editor-column';

const lineEl = (host: HTMLElement, starts: string) =>
  [...host.querySelectorAll('.code-line')].find((el) => el.querySelector('.code-line__text')!.textContent!.trim().startsWith(starts)) as HTMLElement;

describe('BB-CODE-16: Clicking a line explains it in the strip; Escape closes it', () => {
  it('shows the signature, the sentence and the student\'s values, in a polite live region', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    getState().updateObjectTransform(tri.id, { translateX: 0.4 });
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    expect(host.querySelector('.code-hint')!.textContent).toBe('Click any line to see what it does.');
    const translate = lineEl(host, 'glTranslatef(');
    expect(translate.getAttribute('role')).toBe('button');
    translate.click();
    await settle();
    expect(getState().explainedLine).toBe(Number(translate.getAttribute('data-line')));
    expect(translate.classList.contains('is-explained')).toBe(true);
    const strip = host.querySelector('section.code-strip')!;
    expect(strip.querySelector('[aria-live="polite"]')).not.toBeNull();
    expect(strip.querySelector('.code-strip__sig')!.textContent).toBe('glTranslatef(x, y, z)');
    expect([...strip.querySelectorAll('.code-strip__values tbody tr')].map((tr) => tr.textContent)).toEqual([
      expect.stringContaining('state_Triangle.x'), expect.stringContaining('state_Triangle.y'),
    ]);
    expect(strip.textContent).toContain('0.40');
    expect(strip.textContent).toContain('Translate X');
    expect(host.querySelector('.code-hint')).toBeNull();
    key(translate, 'Escape');
    await settle();
    expect(getState().explainedLine).toBeNull();
    expect(host.querySelector('section.code-strip')).toBeNull();
    unmount(host);
  });
});

describe('BB-CODE-17: The arrow keys move between explainable lines', () => {
  it('skips braces, blanks and comments, and explains the new line while the strip is open', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    const translate = lineEl(host, 'glTranslatef(');
    translate.click();
    await settle();
    key(translate, 'ArrowDown');
    await settle();
    expect(document.activeElement).toBe(lineEl(host, 'glRotatef('));
    expect(getState().explainedLine).toBe(Number(lineEl(host, 'glRotatef(').getAttribute('data-line')));
    key(lineEl(host, 'glRotatef('), 'ArrowDown');
    key(lineEl(host, 'glScalef('), 'ArrowDown');
    await settle();
    expect(document.activeElement).toBe(lineEl(host, 'glShadeModel('));
    key(lineEl(host, 'glShadeModel('), 'ArrowUp');
    await settle();
    expect(document.activeElement).toBe(lineEl(host, 'glScalef('));
    const brace = [...host.querySelectorAll('.code-line')].find((el) => el.textContent!.trim().endsWith('{')) as HTMLElement;
    expect(brace.getAttribute('role')).toBeNull();
    unmount(host);
  });
});

describe('BB-CODE-18: Three notes sit under the key lines, and the changed value is amber', () => {
  it('notes move, turn and the shape rule; marks the new X; Notes hides them', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    getState().updateObjectTransform(tri.id, { translateX: 0.4 });
    await settle();
    const notes = [...host.querySelectorAll('.code-note')].map((el) => el.textContent!.trim());
    expect(notes).toEqual(['move by your X 0.40, Y −0.17', 'turn by 15°', 'every 3 vertices make a triangle']);
    expect([...host.querySelectorAll('.code-note__value.is-changed')].map((el) => el.textContent)).toEqual(['0.40']);
    const toggle = [...host.querySelectorAll('.code-word')].find((b) => b.textContent === 'Notes') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    toggle.click();
    await settle();
    expect(getState().codeNotes).toBe(false);
    expect(host.querySelectorAll('.code-note')).toHaveLength(0);
    unmount(host);
  });
});

describe('BB-CODE-19: The strip links to the math and to the control', () => {
  it('opens Math on the line\'s stage, and reveals and outlines the control in its panel', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    lineEl(host, 'glTranslatef(').click();
    await settle();
    const links = [...host.querySelectorAll('.code-strip__link')] as HTMLButtonElement[];
    expect(links.map((a) => a.textContent)).toEqual(['See the math: Transformed', 'Open Translate X']);
    links[1].click();
    await settle();
    expect(getState().railPanel).toBe('scene');
    expect(getState().openGroups).toContain('transform');
    expect(getState().revealedGroup).toBe('transform');
    const panel = mount(h(EditorPanel, {}));
    await settle();
    expect(panel.querySelector('[data-group="transform"]')!.classList.contains('is-focus')).toBe(true);
    unmount(panel);
    links[0].click();
    await settle();
    expect(getState().codePane).toBe('math');
    expect(getState().journeyStageOverride).toBe('transformed');
    unmount(host);
  });
});

describe('BB-CODE-20: Explaining a folded line opens its fold; a new selection closes the strip', () => {
  it('opens main() for an explained line inside it, and closes the strip on a new selection', async () => {
    const { tri, square } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    const main = currentProgram().split('\n').findIndex((l) => l.includes('glutMainLoop'));
    getState().setExplainedLine(main);
    await settle();
    expect(lineTexts(host).some((t) => t.includes('glutMainLoop'))).toBe(true);
    expect(host.querySelector('.code-strip__sig')!.textContent).toBe('glutMainLoop()');
    getState().selectObject(square.id);
    await settle();
    expect(host.querySelector('section.code-strip')).toBeNull();
    expect(getState().revealedGroup).toBeNull();
    unmount(host);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/code-panel.test.ts`
Expected: FAIL. There is no `.code-hint`, no `role="button"` on lines, and `revealedGroup` is undefined.

- [ ] **Step 3: Add `revealGroup` to the store**

In `src/core/store/types.ts`, in `RuntimeSlice`:

```ts
  /** A group the student opened from the code's explanation strip; outlined until the selection or the open groups change. Session only. */
  revealedGroup: InspectorGroupId | null;
  /** Shows a group's panel, opens the group and outlines it. */
  revealGroup: (group: InspectorGroupId) => void;
```

In `src/core/store/runtime-slice.ts`:
1. Import `OBJECT_GROUPS` from `@/core/inspector/groups`.
2. Add the default `revealedGroup: null,`.
3. Add `revealedGroup: null` to `setActiveSection`'s returned object and to both branches of `toggleGroup`.
4. Add the action:

```ts
  revealGroup: (group) => set((state) => ({
    railPanel: (OBJECT_GROUPS as readonly string[]).includes(group) ? 'scene' : group === 'callbacks' ? 'callbacks' : 'settings',
    railHidden: false,
    openGroups: state.openGroups.includes(group) ? state.openGroups : [...state.openGroups, group],
    revealedGroup: group,
  })),
```

Note that `toggleGroup`'s close branch currently returns only `openGroups`; give it `revealedGroup: null` too.

In `src/core/store/index.ts`, extend the selection subscription from Task 1 so it also clears `revealedGroup`:

```ts
useVamsStore.subscribe((state, prev) => {
  if (state.selectedObjectId === prev.selectedObjectId) return;
  if (state.codeFoldsOpened.length === 0 && state.explainedLine === null && state.journeyVertex === 0 && state.revealedGroup === null) return;
  useVamsStore.setState({ codeFoldsOpened: [], explainedLine: null, journeyVertex: 0, revealedGroup: null });
});
```

`revealGroup` may select an object first (see Step 6). The subscription then clears `revealedGroup`, so the panel calls `selectObject` before `revealGroup`.

In `tests/setup.ts`, add `revealedGroup: null,`.

- [ ] **Step 4: Outline a revealed group**

In `src/widgets/layout/editor-column/use-group-focus.ts`, after `const place = resolveFocus(focusPanelId, hasSelection);`, replace the `group` line with:

```ts
  // Outside a lesson, a group opened from the code's explanation strip is outlined the same way.
  const revealed = useVamsStore((s) => (s.appMode === 'Author' ? s.revealedGroup : null));
  const group = place && place.area === area ? place.group : revealed;
```

The effect that opens the group and scrolls to it then runs for a revealed group too. The style stays `'none'` outside lessons, so nothing is dimmed or collapsed.

- [ ] **Step 5: Add the strip, notes and hint to the viewer**

In `src/shared/ui/code-viewer/types.ts`, append `CodeNote` and `CodeStrip` exactly as in Interfaces.

In `CodeViewer.tsx`:
1. Add the seven props to `CodeViewerProps`, with the doc comments from Interfaces, and destructure them.
2. Add the helpers below inside the component, after `lineEls`:

```tsx
  const stripId = `${baseId}-strip`;
  const shownLines = useMemo(
    () => rowList.flatMap((r) => (r.kind === 'line' && explainable?.has(r.line) ? [r.line] : [])),
    [rowList, explainable],
  );
  const tabLine = explainedLine != null && shownLines.includes(explainedLine) ? explainedLine : shownLines[0];

  const moveTo = (from: number, delta: 1 | -1) => {
    const at = shownLines.indexOf(from);
    const next = shownLines[at + delta];
    if (next === undefined) return;
    lineEls.current.get(next)?.focus();
    if (explainedLine != null) onExplain?.(next);
  };

  const onLineKey = (line: number) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onExplain?.(line);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      moveTo(line, e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'Escape' && explainedLine != null) {
      e.preventDefault();
      onExplain?.(null);
    }
  };

  // The explained line scrolls into view, as when it was chosen from the math.
  useEffect(() => {
    if (explainedLine == null) return;
    const raf = requestAnimationFrame(() => lineEls.current.get(explainedLine)?.scrollIntoView?.({ block: 'nearest' }));
    return () => cancelAnimationFrame(raf);
  }, [explainedLine]);
```

3. In `renderLine`:
   - Compute `const canExplain = explainable?.has(line) ?? false; const explained = explainedLine === line;`.
   - Add `canExplain ? 'is-explainable' : ''` and `explained ? 'is-explained' : ''` to `classes`.
   - Give the line `div` these attributes when `canExplain`:

```tsx
        role={canExplain ? 'button' : undefined}
        tabIndex={canExplain ? (line === tabLine ? 0 : -1) : undefined}
        aria-expanded={canExplain ? explained : undefined}
        aria-controls={canExplain ? stripId : undefined}
        onClick={canExplain ? () => onExplain?.(line) : undefined}
        onKeyDown={canExplain ? onLineKey(line) : undefined}
```

   - Return the line `div` and, when `notesOn && notes?.get(line)`, its note, inside `<Fragment key={changed ? `${line}:${marksKey}` : `${line}`}>`.
     Import `Fragment` from `preact` and move the `key` off the `div` onto the `Fragment`. The changed-line remount then still restarts the fade. The note:

```tsx
      {notesOn && note && (
        <div key={`${line}-note`} className="code-note">
          <span className="code-line__num" aria-hidden="true" />
          <span className="code-note__indent" aria-hidden="true">{text.match(/^\s*/)![0]}</span>
          <span className="code-note__text">
            {note.map((part, k) =>
              part.changed === undefined ? (
                <span key={k}>{part.text}</span>
              ) : (
                <b key={k} className={`code-note__value${part.changed ? ' is-changed' : ''}`}>{part.text}</b>
              ),
            )}
          </span>
        </div>
      )}
```

   (with `const note = notes?.get(line);`). A `CodeNote` part with `changed` set, true or false, is a value; plain words leave it undefined.

4. In the header's right side, before Find:

```tsx
          {onToggleNotes && (
            <button type="button" className="code-word" aria-pressed={notesOn} onClick={onToggleNotes}>Notes</button>
          )}
```

5. After `.code-content`, add the footer:

```tsx
      {strip ? (
        <section id={stripId} className="code-strip" aria-label="What this line does">
          <div aria-live="polite" className="code-strip__body">
            <div className="code-strip__head">
              <code className="code-strip__sig">{strip.signature}</code>
              <button type="button" className="code-strip__close" aria-label="Close explanation" onClick={() => onExplain?.(null)}>
                <X size={12} aria-hidden="true" />
              </button>
            </div>
            <p className="code-strip__text">{strip.text}</p>
            {strip.values.length > 0 && (
              <table className="code-strip__values">
                <caption>Your values</caption>
                <tbody>
                  {strip.values.map((v) => (
                    <tr key={v.arg}>
                      <th scope="row">{v.arg}</th>
                      <td>{v.source} = <span className="code-strip__value">{v.value}</span></td>
                      <td>{v.control ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {strip.links.length > 0 && (
              <div className="code-strip__links">
                {strip.links.map((l) => (
                  <button key={l.label} type="button" className="code-strip__link" onClick={l.onSelect}>{l.label}</button>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : (
        explainable && <p className="code-hint"><b>Click any line</b> to see what it does.</p>
      )}
```

Append to `code-viewer.scss`:

```scss
.code-line.is-explainable { cursor: pointer; }

.code-line.is-explainable:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}

// The panel's only full-line background: the line being explained.
.code-line.is-explained { background: var(--paper-raised); }

// Notes: dim words aligned under the code they describe, no rule or marker.
.code-note {
  display: block;
  margin: -1px 0 3px;
  white-space: pre;
  font-family: $font-ui;
  font-size: var(--text-xs);
  line-height: 1.5;
  color: var(--ink-dim);
}

.code-note .code-line__num { visibility: hidden; }

.code-note__indent {
  font-family: $font-mono;
  font-size: var(--text-sm);
}

.code-note__value {
  font-weight: 500;

  &.is-changed { color: var(--value); }
}

.code-hint {
  flex-shrink: 0;
  margin: 0;
  padding: 8px 14px;
  border-top: 1px solid var(--rule);
  font-size: var(--text-sm);
  color: var(--ink-dim);

  b { font-weight: 500; color: var(--ink-muted); }
}

.code-strip {
  flex-shrink: 0;
  max-height: 45%;
  overflow-y: auto;
  padding: 10px 14px;
  border-top: 1px solid var(--rule);
  background: var(--paper-raised);
  font-size: var(--text-sm);
}

.code-strip__head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.code-strip__sig {
  flex: 1;
  font-family: $font-mono;
  font-size: var(--text-sm);
  color: var(--code-fn);
}

.code-strip__close {
  display: inline-flex;
  padding: 2px;
  border: 0;
  border-radius: var(--radius-s);
  background: none;
  color: var(--ink-faint);
  cursor: pointer;

  &:hover { color: var(--ink); }
  &:focus-visible { outline: 2px solid var(--focus-ring); }
}

.code-strip__text {
  margin: 4px 0 8px;
  line-height: 1.5;
  color: var(--ink-muted);
}

.code-strip__values {
  border-collapse: collapse;
  font-family: $font-mono;
  font-size: var(--text-xs);

  caption {
    margin-bottom: 4px;
    text-align: left;
    font-family: $font-ui;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-dim);
  }

  th,
  td {
    padding: 2px 10px 2px 0;
    text-align: left;
    font-weight: 400;
    color: var(--ink-muted);
  }

  th { color: var(--ink); }
}

.code-strip__value { color: var(--value); }

.code-strip__links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: 8px;
}

.code-strip__link {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: var(--accent-text);
  cursor: pointer;

  &:hover { text-decoration: underline; }
  &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
}
```

- [ ] **Step 6: Compose the strip and notes in the panel**

In `SceneCodePanel.tsx`:
1. Add the imports:
   - `explainLine`, `noteFor` and `type ExplainScene` from `code-explanations`;
   - `stateFieldAt` from `code-outline`;
   - `JOURNEY_STAGE_TITLES` from `@/core/inspector`;
   - `type CodeNote` and `type CodeStrip` from `@/shared/ui/code-viewer/types`.
2. Add, after `rows`'s inputs:

```tsx
  const explainedLine = useVamsStore((s) => s.explainedLine);
  const setExplainedLine = useVamsStore((s) => s.setExplainedLine);
  const codeNotes = useVamsStore((s) => s.codeNotes);
  const setCodeNotes = useVamsStore((s) => s.setCodeNotes);
  const setCodePane = useVamsStore((s) => s.setCodePane);
  const setJourneyStageOverride = useVamsStore((s) => s.setJourneyStageOverride);
  const revealGroup = useVamsStore((s) => s.revealGroup);
  const selectObject = useVamsStore((s) => s.selectObject);

  const scene = useMemo<ExplainScene>(
    () => ({ objects, viewportLimits, canvasBackgroundColor, canvas: canvasSize, textures: getAllTextures() }),
    [objects, viewportLimits, canvasBackgroundColor, canvasSize, getAllTextures],
  );
  const explainable = useMemo(
    () => new Set(outline.lines.flatMap((l, i) => (l.explainable && explainLine(i, outline, scene) ? [i] : []))),
    [outline, scene],
  );
  const explained = explainedLine !== null && explainable.has(explainedLine) ? explainedLine : null;
```

3. Add `...(explained === null ? [] : [explained])` to the `forced` list in `rows`, and `explained` to its dependencies.
4. Then:

```tsx
  // A note's value is amber when the student's last edit changed the state field it shows.
  const changedRefs = useMemo(
    () => new Set(marks.flatMap((m) => {
      const ref = stateFieldAt(outline.lines[m.line]?.text ?? '', m.start);
      return ref ? [ref] : [];
    })),
    [marks, outline],
  );
  const notes = useMemo(() => {
    const map = new Map<number, CodeNote>();
    for (const row of rows) {
      if (row.kind !== 'line') continue;
      const parts = noteFor(row.line, outline, scene);
      if (parts) map.set(row.line, parts.map((p) => (typeof p === 'string' ? { text: p } : { text: p.value, changed: changedRefs.has(p.ref) })));
    }
    return map;
  }, [rows, outline, scene, changedRefs]);

  const strip = useMemo<CodeStrip | null>(() => {
    if (explained === null) return null;
    const e = explainLine(explained, outline, scene);
    if (!e) return null;
    const links: CodeStrip['links'] = [];
    if (e.stage) {
      const stage = e.stage;
      links.push({ label: `See the math: ${JOURNEY_STAGE_TITLES[stage]}`, onSelect: () => { setJourneyStageOverride(stage); setCodePane('math'); } });
    }
    if (e.control) {
      const { group, objectId, label } = e.control;
      links.push({
        label: `Open ${label}`,
        onSelect: () => {
          // Select the line's object first: a new selection clears the outline, so revealing comes second.
          if (objectId && objectId !== selectedObjectId) selectObject(objectId);
          revealGroup(group);
        },
      });
    }
    return { signature: e.signature, text: e.text, values: e.values, links };
  }, [explained, outline, scene, selectedObjectId, selectObject, revealGroup, setCodePane, setJourneyStageOverride]);
```

5. Pass the new props to `CodeViewer`:

```tsx
      explainable={explainable}
      explainedLine={explained}
      onExplain={setExplainedLine}
      strip={strip}
      notes={notes}
      notesOn={codeNotes}
      onToggleNotes={() => setCodeNotes(!codeNotes)}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/code-panel.test.ts tests/black-box/editor-inspector.test.ts tests/black-box/lesson-column.test.ts`
Expected: PASS.

- [ ] **Step 8: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/shared/ui/code-viewer/types.ts src/shared/ui/code-viewer/CodeViewer.tsx src/shared/ui/code-viewer/code-viewer.scss src/features/code-generation/ui/SceneCodePanel.tsx src/core/store/types.ts src/core/store/runtime-slice.ts src/core/store/index.ts src/widgets/layout/editor-column/use-group-focus.ts tests/setup.ts tests/black-box/code-panel.test.ts
git diff --staged
git commit -m "feat(code): explain any line in a strip, with notes on the key lines and links to the math and the control"
```

---

### Task 15: Math to code, and the canvas ring

**Files:**
- Modify: `src/core/store/types.ts`, `runtime-slice.ts` (`explainRequest`, `requestExplain`)
- Modify: `src/features/code-generation/ui/SceneCodePanel.tsx` (resolve a request to a line)
- Modify: `src/features/math-panel/ui/MathPanel.tsx` (pass `onCall`)
- Modify: `src/shared/engine/selection-overlay.ts` (`FollowRing`, `ringTarget`)
- Modify: `src/shared/engine/pixi/hooks/useSceneRenderer.ts` (draw the ring; a handle click chooses the vertex)
- Modify: `tests/setup.ts`, `tests/black-box/math-journey.test.ts` (append)

**Interfaces:**
- Consumes:
  - `findCallLine` (Task 2);
  - the `onCall` slot in `JourneyTrack` and `WorkingTable` (Task 10);
  - `journeyVertex` and `setJourneyVertex` (Task 1);
  - `codePane` and `codeHidden`.
- Produces, in the store:
  - `explainRequest: string | null`.
  - `requestExplain(call: string): void`, which sets `{ explainRequest: call, codePane: 'code', codeHidden: false, codeChangedUnseen: false }`.
  - `SceneCodePanel` turns the request into `explainedLine` with `findCallLine(outline, selection, call)` and clears it.
- Produces, in `selection-overlay.ts`:

```ts
export type RingTarget = { kind: 'vertex'; index: number } | { kind: 'origin' } | null;
export function ringTarget(node: { type: string; vertices: readonly unknown[] } | undefined, vertex: number, showsMath: boolean): RingTarget;
export class FollowRing extends Graphics { show(x: number, y: number, inverseScale: number): void; hide(): void }
```

Plan ruling: a store request (`explainRequest`), not the math panel computing line numbers. The spec keeps the link between the two features in store state (`codePane`, `journeyStageOverride`, `explainedLine`). The math panel cannot know line numbers without generating and outlining the program. It names the call; the code panel, which already has the outline, finds the line.

- [ ] **Step 1: Write the failing tests**

Append to `tests/black-box/math-journey.test.ts`:

```ts
import CodeMathColumn from '@/widgets/layout/code-math-column';
import { ringTarget, FollowRing } from '@/shared/engine/selection-overlay';

describe('BB-JOURNEY-11: A working row\'s GL call opens Code on that line', () => {
  it('switches to Code, opens the line\'s fold and explains it', async () => {
    mockTriangle();
    useVamsStore.setState({ activeSection: 'Transforms', codePane: 'math', codeHidden: false });
    const host = mount(h(CodeMathColumn, {}));
    await settle();
    const call = [...host.querySelectorAll('.journey-work__call-link')].find((b) => b.textContent === 'glTranslatef') as HTMLButtonElement;
    call.click();
    await settle();
    await settle();
    expect(getState().codePane).toBe('code');
    expect(getState().explainRequest).toBeNull();
    expect(host.querySelector('.code-line.is-explained .code-line__text')!.textContent!.trim()).toMatch(/^glTranslatef\(state_Triangle\.x/);
    expect(host.querySelector('.code-strip__sig')!.textContent).toBe('glTranslatef(x, y, z)');
    unmount(host);
  });
});

describe('BB-JOURNEY-12: The canvas ring marks the followed vertex only while Math shows', () => {
  it('rings a shape\'s clamped vertex, a text\'s origin, nothing for a group, and hides with Code', () => {
    const shape = { type: 'TRIANGLES', vertices: [{}, {}, {}] };
    expect(ringTarget(shape, 1, true)).toEqual({ kind: 'vertex', index: 1 });
    expect(ringTarget(shape, 7, true)).toEqual({ kind: 'vertex', index: 2 });
    expect(ringTarget(shape, 1, false)).toBeNull();
    expect(ringTarget({ type: 'TEXT', vertices: [{}] }, 0, true)).toEqual({ kind: 'origin' });
    expect(ringTarget({ type: 'GROUP', vertices: [] }, 0, true)).toBeNull();
    expect(ringTarget(undefined, 0, true)).toBeNull();
    const ring = new FollowRing();
    expect(ring.visible).toBe(false);
    ring.show(10, 20, 0.5);
    expect([ring.visible, ring.position.x, ring.position.y, ring.scale.x]).toEqual([true, 10, 20, 0.5]);
    ring.hide();
    expect(ring.visible).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/math-journey.test.ts`
Expected: FAIL. `ringTarget` is not exported, and there is no `.journey-work__call-link`.

- [ ] **Step 3: The request in the store**

In `src/core/store/types.ts`, `RuntimeSlice`:

```ts
  /** A GL call the math asked Code to explain; the code panel finds its line and clears this. Session only. */
  explainRequest: string | null;
  /** Shows Code and explains the selected object's line that makes this call. */
  requestExplain: (call: string | null) => void;
```

In `runtime-slice.ts`:
1. Add the default `explainRequest: null,`.
2. Add the action:

```ts
  requestExplain: (call) => set(call === null
    ? { explainRequest: null }
    : { explainRequest: call, codePane: 'code', codeHidden: false, codeChangedUnseen: false }),
```

In `tests/setup.ts`, add `explainRequest: null,`.

- [ ] **Step 4: Resolve the request in the code panel**

In `SceneCodePanel.tsx`:
1. Import `useEffect` and `findCallLine`.
2. Add:

```tsx
  const explainRequest = useVamsStore((s) => s.explainRequest);
  const requestExplain = useVamsStore((s) => s.requestExplain);
  // The math named a GL call; explain the selected object's line that makes it.
  useEffect(() => {
    if (!explainRequest) return;
    const line = findCallLine(outline, selection, explainRequest);
    if (line !== null) setExplainedLine(line);
    requestExplain(null);
  }, [explainRequest, outline, selection, setExplainedLine, requestExplain]);
```

In `MathPanel.tsx`, read `const requestExplain = useVamsStore((s) => s.requestExplain);` and pass `onCall={requestExplain}` to `JourneyTrack`.

- [ ] **Step 5: The ring**

Append to `src/shared/engine/selection-overlay.ts`:

```ts
export type RingTarget = { kind: 'vertex'; index: number } | { kind: 'origin' } | null;

/**
 * Where the followed vertex's ring goes: a shape's vertex (clamped), a text's raster position at
 * its origin, or nowhere for a group or while Code shows.
 */
export function ringTarget(node: { type: string; vertices: readonly unknown[] } | undefined, vertex: number, showsMath: boolean): RingTarget {
  if (!node || !showsMath || node.type === 'GROUP') return null;
  if (node.type === 'TEXT') return { kind: 'origin' };
  if (node.vertices.length === 0) return null;
  return { kind: 'vertex', index: Math.min(Math.max(0, Math.floor(vertex)), node.vertices.length - 1) };
}

/** The amber ring around the vertex the math journey follows. A transient overlay: never saved. */
export class FollowRing extends Graphics {
  constructor() {
    super();
    this.eventMode = 'none';
    this.visible = false;
  }

  /** At a point in its parent's space; `inverseScale` keeps it the same size on screen at any zoom. */
  public show(x: number, y: number, inverseScale: number) {
    this.position.set(x, y);
    this.scale.set(inverseScale);
    this.clear();
    this.circle(0, 0, 9);
    this.stroke({ width: 2, color: readCssColor('--canvas-ring', 0xfbbf77) });
    this.visible = true;
  }

  public hide() {
    this.visible = false;
  }
}
```

In `src/shared/engine/pixi/hooks/useSceneRenderer.ts`:
1. Import `FollowRing` and `ringTarget` from `@/shared/engine/selection-overlay`.
2. Keep refs in step with the store, beside the other refs:

```ts
  const ringRef = useRef<FollowRing | null>(null);
  const showsMath = useVamsStore((s) => s.codePane === 'math' && !s.codeHidden);
  const journeyVertex = useVamsStore((s) => s.journeyVertex);
  const showsMathRef = useRef(showsMath);
  const journeyVertexRef = useRef(journeyVertex);
  useEffect(() => {
    showsMathRef.current = showsMath;
    journeyVertexRef.current = journeyVertex;
  }, [showsMath, journeyVertex]);
```

3. In the overlay effect, after `vertexOverlayRef.current = vertexOverlay;`, add:

```ts
    const ring = new FollowRing();
    ring.zIndex = 1;
    vertexOverlay.addChild(ring);
    ringRef.current = ring;
```

and in its cleanup, `ringRef.current = null;`. The overlay's `destroy({ children: true })` already destroys the ring.

4. In the handle's `pointerdown` handler, directly after `const idx = handleGraphicsRef.current.indexOf(g);`, add:

```ts
              // Clicking a vertex handle also chooses the vertex the math follows.
              useVamsStore.getState().setJourneyVertex(idx);
```

5. Replace the ticker's `if (layer && container && obj && obj.type !== 'GROUP' && obj.type !== 'TEXT') { … } else if (layer) { layer.visible = false; }` block:
   - Keep its handle-drawing body unchanged.
   - Wrap that body as below.
   - Add the text and ring cases.

```ts
        const target = ringTarget(obj, journeyVertexRef.current, showsMathRef.current);
        const worldScale = Math.abs(world.scale.x);
        const inverseScale = worldScale > 0 ? 1 / worldScale : 1;
        if (layer && container && obj && obj.type !== 'GROUP' && obj.type !== 'TEXT') {
          layer.visible = true;
          // … the existing handle loop, unchanged (it already computes inverseScale; reuse this one) …
          if (target?.kind === 'vertex') {
            const v = obj.vertices[target.index];
            const at = world.toLocal(container.toGlobal({ x: v.x, y: v.y }));
            ringRef.current?.show(at.x, at.y, inverseScale);
          } else {
            ringRef.current?.hide();
          }
        } else if (layer && container && obj && target?.kind === 'origin') {
          // Text has no handles; the ring marks its raster position, at the text's origin.
          layer.visible = true;
          handleGraphicsRef.current.forEach((g) => { g.visible = false; });
          const at = world.toLocal(container.toGlobal({ x: 0, y: 0 }));
          ringRef.current?.show(at.x, at.y, inverseScale);
        } else if (layer) {
          ringRef.current?.hide();
          layer.visible = false;
        }
```

Remove the duplicate `worldScale` / `inverseScale` declarations from the old body. Run hides the whole vertex layer already (`runHides`), so the ring hides during Run with no extra code.

- [ ] **Step 6: Run the tests to verify they pass**

If Pixi cannot construct a `Graphics` under happy-dom, keep BB-JOURNEY-12's `ringTarget` assertions and drop its `FollowRing` lines. The ring is then checked in Step 7 and at checkpoint 3 (VIS-CM-05). Say so in the report.

Run: `npx vitest run tests/black-box/math-journey.test.ts tests/black-box/run-mode.test.ts tests/black-box/editor-shell.test.ts`
Expected: PASS.

- [ ] **Step 7: Check it in the browser**

1. Run `npx vite --port 5174` and record its PID.
2. Select a triangle and switch to Math. An amber ring sits on vertex 1.
3. Click another vertex handle. The header reads "vertex 2 of 3" and the ring moves.
4. Switch to Code. The ring goes.
5. Press Run. The ring and the handles hide.
6. In Math, click `glTranslatef` in a working row. Code opens on that line with the strip.
7. Stop the server by its PID.

- [ ] **Step 8: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/core/store/types.ts src/core/store/runtime-slice.ts src/features/code-generation/ui/SceneCodePanel.tsx src/features/math-panel/ui/MathPanel.tsx src/shared/engine/selection-overlay.ts src/shared/engine/pixi/hooks/useSceneRenderer.ts tests/setup.ts tests/black-box/math-journey.test.ts
git diff --staged
git commit -m "feat(math): link the working's GL calls to the code, and ring the followed vertex on the canvas"
```

---

### Task 16: Checkpoint 3: notes, the strip and the ring

**This task is the controller's.** It closes the core (build steps 1–3) and must be signed off before the Oct 28 freeze. Step 4 starts after sign-off.

**Files:**
- Modify: `tests/visual/code-math.spec.ts` (append VIS-CM-04 and 05)

- [ ] **Step 1: Add the captures**

Append to `tests/visual/code-math.spec.ts`:

```ts
for (const theme of ['dark', 'light'] as const) {
  test(`VIS-CM-04: Code pane with notes and the strip open on glTranslatef, ${theme}, 1280`, async ({ page }) => {
    await openMockScene(page, theme);
    await page.locator('.code-line', { hasText: 'glTranslatef(state_Triangle.x' }).click();
    await expect(page.locator('.code-strip__sig')).toHaveText('glTranslatef(x, y, z)');
    await expect(page.locator('.code-math-column')).toHaveScreenshot(`cm-code-strip-${theme}-1280.png`, { animations: 'allow' });
  });
}

test('VIS-CM-05: The followed vertex ringed on the canvas with Math showing, dark, 1280', async ({ page }) => {
  await openMockScene(page, 'dark');
  await page.getByRole('radio', { name: 'Math' }).click();
  await expect(page).toHaveScreenshot('cm-editor-ring-dark-1280.png');
});
```

- [ ] **Step 2: Take the screenshots and show the owner**

```bash
rm -f tests/visual/baseline.local/cm-code-strip-*.png tests/visual/baseline.local/cm-editor-ring-*.png
npx playwright test tests/visual/code-math.spec.ts --update-snapshots
```

1. Write `.superpowers/checkpoints/step-3.html`, with these rows:
   - `mock-code-calm-a.png` beside `cm-code-dark-1280.png`. The three notes should now show.
   - `cm-code-strip-dark-1280.png`.
   - `cm-code-strip-light-1280.png`.
   - `cm-editor-ring-dark-1280.png`.
2. Open it with `start`.
3. Ask the owner whether the notes match Calm A, and whether the strip and the ring fit the approved look. The strip has no mock; it uses the same tokens.
4. Record the answer in the ledger.
5. Make the requested changes as a fix round on Tasks 13–15.

- [ ] **Step 3: Commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add tests/visual/code-math.spec.ts
git diff --staged
git commit -m "test(visual): capture the code notes, the explanation strip and the canvas ring"
```

---

## Build step 4: each remaining stage's working

Each task adds one stage's rows to `vertexJourney`, its picture with the student's numbers, and WB-JOURNEY tests against the reference. The stages ship in this order: Stored, Assembled, Rasterised, Coloured. **If the freeze arrives, stop after the last complete stage.** A stage without its rows still shows its result, its sentence and its cards, as in step 2.

### Task 17: Stored: where the vertex lives

**Files:**
- Modify: `src/features/math-panel/model/vertex-journey.ts`
- Modify: `tests/white-box/vertex-journey.test.ts` (append)

**Interfaces:**
- Consumes:
  - `sanitizeName` from `@/features/code-generation/model/generator/utils`. Its rows name the program's arrays (`verts_<name>`, `vbo_<name>`). The math panel already imports `code-generation`'s model under the repo's known exception; the reverse never happens.
  - `vertexJourney` and its row types (Task 9).
- Produces: the Stored stage's `rows` for every rendering mode (spec §3, "1 · Stored"):
  - **Immediate:** typed, then "sent by glVertex2f", with "no buffer holds it".
  - **Vertex array:** the index in `verts_<name>`, the byte offset (index × 8) and the stride.
  - **VBO:** the copy by `glBufferData` with the usage hint as the student's input, then the index in `vbo_<name>`, the byte offset and the stride.
  - **Indexed:** an extra row that says how many vertices deduplication kept.

  The index is the one the generator writes: deduplicated by position, colour and UV, exactly as `generator/buffers.ts` does.
- The picture stays today's Buffers cards. They already show this object's numbers, and the lesson-driven mapping steps (`dmaStep`) keep driving its diagram.

- [ ] **Step 1: Write the failing tests**

Append to `tests/white-box/vertex-journey.test.ts`:

```ts
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';

const rowsOf = (j: ReturnType<typeof vertexJourney>, id: string) =>
  stage(j, id).rows.map((r) => [r.step.map((p) => (typeof p === 'string' ? p : p.input)).join(''), r.value, r.call]);

describe('WB-JOURNEY-10: Stored says where the vertex lives in each rendering mode', () => {
  it('sends an immediate vertex directly, and names the array, offset and stride otherwise', () => {
    const tri = mockTriangle();
    expect(rowsOf(vertexJourney(scene([tri]), 'Triangle', 0, CANVAS), 'stored')).toEqual([
      ['typed in Vertices', '(0.00, 0.50)', null],
      ['sent by glVertex2f', 'no buffer holds it', 'glVertex2f'],
    ]);
    const array = { ...tri, renderingMode: 'VERTEX_ARRAY' as const };
    expect(rowsOf(vertexJourney(scene([array]), 'Triangle', 2, CANVAS), 'stored')).toEqual([
      ['typed in Vertices', '(0.50, −0.50)', null],
      ['in verts_Triangle', 'index 2', null],
      ['byte offset 2 × 8', '16 bytes', null],
      ['stride 0', 'packed, 8 bytes apart', 'glVertexPointer'],
    ]);
    const vbo = { ...tri, renderingMode: 'VBO' as const, bufferUsage: 'DYNAMIC' as const };
    const j = vertexJourney(scene([vbo]), 'Triangle', 1, CANVAS);
    expect(rowsOf(j, 'stored')[1]).toEqual(['copied once, usage GL_DYNAMIC_DRAW', 'vbo_Triangle on the GPU', 'glBufferData']);
    expect(stage(j, 'stored').rows[1].step).toContainEqual({ input: 'GL_DYNAMIC_DRAW' });
    expect(stage(j, 'stored').result).toBe('(−0.50, −0.50)');
  });
});

describe('WB-JOURNEY-11: An indexed vertex has the index the generator gives it', () => {
  it('matches the position of the vertex in the generated verts_ array', () => {
    // Two triangles sharing an edge: six vertices, four unique.
    const quad = node('Pair', 'TRIANGLES', [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]], {}, { renderingMode: 'VERTEX_ARRAY', useIndexed: true });
    const code = generateCodeFromState({ objects: [quad], canvasBackgroundColor: '#000000', callbacks: emptyCallbacks(), viewportLimits: { minX: -1, maxX: 1, minY: -1, maxY: 1 }, textures: [] }, CANVAS);
    const numbers = /GLfloat verts_Pair\[\] = \{ (.*) \};/.exec(code)![1].split(', ').map((n) => Number(n.replace('f', '')));
    const pairs = Array.from({ length: numbers.length / 2 }, (_, k) => `${numbers[2 * k]},${numbers[2 * k + 1]}`);
    for (let i = 0; i < 6; i++) {
      const j = vertexJourney(scene([quad]), 'Pair', i, CANVAS);
      const v = quad.vertices[i];
      expect(rowsOf(j, 'stored').find((r) => String(r[0]).startsWith('in verts_'))![1]).toBe(`index ${pairs.indexOf(`${v.x},${v.y}`)}`);
    }
    expect(rowsOf(vertexJourney(scene([quad]), 'Pair', 0, CANVAS), 'stored')[1]).toEqual(['deduplicated', '4 of 6 kept', 'glDrawElements']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/white-box/vertex-journey.test.ts`
Expected: FAIL. The Stored rows are empty.

- [ ] **Step 3: Write the rows**

In `vertex-journey.ts`:
1. Import `sanitizeName` from `@/features/code-generation/model/generator/utils`.
2. Add, above `shapeJourney`:

```ts
/** The vertex's place in the program's arrays: deduplicated when indexed, by the key generator/buffers.ts uses. */
function arrayIndex(node: SceneNode, i: number): { index: number; unique: number } {
  if (!node.useIndexed) return { index: i, unique: node.vertices.length };
  const textured = !!(node.texture && node.uvs && node.uvs.length === node.vertices.length);
  const keys: string[] = [];
  let index = 0;
  node.vertices.forEach((v, k) => {
    const uv = textured ? node.uvs![k] : null;
    const key = uv
      ? `${v.x.toFixed(6)}|${v.y.toFixed(6)}|${v.color}|${uv.u.toFixed(6)}|${uv.v.toFixed(6)}`
      : `${v.x.toFixed(6)}|${v.y.toFixed(6)}|${v.color}`;
    let at = keys.indexOf(key);
    if (at < 0) {
      at = keys.length;
      keys.push(key);
    }
    if (k === i) index = at;
  });
  return { index, unique: keys.length };
}

function storedRows(node: SceneNode, i: number, stored: Point): WorkingRow[] {
  const from: WorkingRow = { step: ['typed in Vertices'], value: pair(stored), call: null, from: true };
  const mode = node.renderingMode ?? 'IMMEDIATE';
  if (mode === 'IMMEDIATE') return [from, { step: ['sent by glVertex2f'], value: 'no buffer holds it', call: 'glVertex2f' }];
  const code = sanitizeName(node.name);
  const { index, unique } = arrayIndex(node, i);
  const rows: WorkingRow[] = [from];
  if (node.useIndexed) rows.push({ step: ['deduplicated'], value: `${unique} of ${node.vertices.length} kept`, call: 'glDrawElements' });
  if (mode === 'VBO') {
    rows.push({ step: ['copied once, usage ', { input: `GL_${node.bufferUsage ?? 'STATIC'}_DRAW` }], value: `vbo_${code} on the GPU`, call: 'glBufferData' });
    rows.push({ step: [`in vbo_${code}`], value: `index ${index}`, call: 'glBindBuffer' });
  } else {
    rows.push({ step: [`in verts_${code}`], value: `index ${index}`, call: null });
  }
  rows.push({ step: [`byte offset ${index} × 8`], value: `${index * 8} bytes`, call: null });
  rows.push({ step: ['stride 0'], value: 'packed, 8 bytes apart', call: 'glVertexPointer' });
  return rows;
}
```

3. In `shapeJourney`, change the Stored stage to `stage('stored', STORED_BY_MODE[mode], storedRows(node, i, stored), pair(stored), stored)`.
4. In `textJourney`, give Stored the row `[{ step: ['raster position'], value: pair(raster), call: 'glRasterPos2f', from: true }]`.

- [ ] **Step 4: Run, lint, build, test, commit**

Run: `npx vitest run tests/white-box/vertex-journey.test.ts tests/black-box/math-journey.test.ts`
Expected: PASS.

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/features/math-panel/model/vertex-journey.ts tests/white-box/vertex-journey.test.ts
git diff --staged
git commit -m "feat(math): work the Stored stage: where the vertex lives in each rendering mode"
```

---

### Task 18: Assembled: how the primitive groups the vertex

**Files:**
- Modify: `src/entities/scene/model/primitive-assembly.ts` (add `primitivesOf`)
- Modify: `src/features/math-panel/model/vertex-journey.ts`
- Modify: `src/features/math-panel/ui/journey/stage-pictures.tsx`, `journey.scss`
- Modify: `tests/white-box/vertex-journey.test.ts`, `tests/black-box/math-journey.test.ts` (append)

**Interfaces:**
- Produces: `export function primitivesOf(type: PrimitiveType, count: number): number[][]`, every primitive's vertices, 0-based.
- Produces: the Assembled stage's `rows`:
  - from Projected;
  - the primitive type as the student's input, with the rule, under `glBegin`, `glDrawArrays` or `glDrawElements`;
  - "this vertex" with its place.
- Produces: the picture "Your shape", a small drawing of the object (96 × 80, as the mock's picture) with:
  - each primitive outlined in `--ink-faint`;
  - the primitives holding the vertex shaded with `--accent-tint`;
  - the followed vertex ringed in `--value`.

  DOM hooks: `svg.journey-sketch` and `circle.journey-sketch__ring`. Today's Vertices table, stipple card and point size stay below it.

- [ ] **Step 1: Write the failing tests**

Append to `tests/white-box/vertex-journey.test.ts`:

```ts
import { primitivesOf } from '@/entities/scene/model/primitive-assembly';

describe('WB-JOURNEY-12: Assembled works the rule with the student\'s primitive type', () => {
  it('names the draw call for the mode, the rule and the vertex\'s place', () => {
    const tri = mockTriangle();
    expect(rowsOf(vertexJourney(scene([tri]), 'Triangle', 0, CANVAS), 'assembled')).toEqual([
      ['from Projected', 'NDC (0.27, 0.31)', null],
      ['primitive GL_TRIANGLES', 'every 3 vertices make a triangle', 'glBegin'],
      ['this vertex', 'triangle, 1 of 3', null],
    ]);
    const indexed = { ...tri, renderingMode: 'VERTEX_ARRAY' as const, useIndexed: true };
    expect(rowsOf(vertexJourney(scene([indexed]), 'Triangle', 0, CANVAS), 'assembled')[1][2]).toBe('glDrawElements');
    expect(primitivesOf('TRIANGLE_FAN', 5)).toEqual([[0, 1, 2], [0, 2, 3], [0, 3, 4]]);
    expect(primitivesOf('LINES', 3)).toEqual([[0, 1]]);
  });
});
```

Append to `tests/black-box/math-journey.test.ts`:

```ts
describe('BB-JOURNEY-13: Assembled draws the shape with the followed vertex ringed', () => {
  it('shows the working and a sketch with one ring', async () => {
    mockTriangle();
    getState().setJourneyStageOverride('assembled');
    const host = mount(h(MathPanel, {}));
    await settle();
    expect(openTitle(host)).toBe('Assembled');
    expect([...host.querySelectorAll('table.journey-work tbody tr')].map((tr) => tr.children[0].textContent)).toEqual(
      ['from Projected', 'primitive GL_TRIANGLES', 'this vertex', 'Result']);
    expect(host.querySelectorAll('svg.journey-sketch circle.journey-sketch__ring')).toHaveLength(1);
    unmount(host);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/white-box/vertex-journey.test.ts tests/black-box/math-journey.test.ts`
Expected: FAIL. `primitivesOf` is not exported, and Assembled has no rows.

- [ ] **Step 3: Implement**

In `primitive-assembly.ts`, export:

```ts
export function primitivesOf(type: PrimitiveType, count: number): number[][] {
  const r = RULES[type];
  return span(0, r.total(count)).map((j) => r.members(j, count));
}
```

In `vertex-journey.ts`, add above `shapeJourney`:

```ts
function assembledRows(node: SceneNode, ndc: Point, assembly: ReturnType<typeof assemblyFor>): WorkingRow[] {
  const mode = node.renderingMode ?? 'IMMEDIATE';
  const call = mode === 'IMMEDIATE' ? 'glBegin' : node.useIndexed ? 'glDrawElements' : 'glDrawArrays';
  return [
    { step: ['from Projected'], value: `NDC ${pair(ndc)}`, call: null, from: true },
    { step: ['primitive ', { input: `GL_${node.type}` }], value: assembly.note, call },
    { step: ['this vertex'], value: assembly.result, call: null },
  ];
}
```

In `shapeJourney`, change the Assembled stage to `stage('assembled', assembly.sentence, assembledRows(node, ndc, assembly), assembly.result, null)`.

In `stage-pictures.tsx`, add the sketch. Read the followed vertex in `StagePictures` with `const vertex = useVamsStore((s) => s.journeyVertex);`, and in the `'assembled'` case render `<ShapeSketch node={shape} vertex={vertex} />` before the Vertices card:

```tsx
import { primitivesOf } from '@/entities/scene/model/primitive-assembly';
import type { PrimitiveType } from '@/core/types/scene';

/** The object's shape, small: each primitive outlined, the ones holding the vertex shaded, the vertex ringed. */
function ShapeSketch({ node, vertex }: { node: SceneNode; vertex: number }) {
  const n = node.vertices.length;
  if (n === 0) return null;
  const xs = node.vertices.map((v) => v.x);
  const ys = node.vertices.map((v) => v.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(Math.max(...xs) - minX, 1e-6);
  const h = Math.max(Math.max(...ys) - minY, 1e-6);
  const s = Math.min(84 / w, 68 / h);
  const at = (k: number) => ({
    x: 6 + (node.vertices[k].x - minX) * s + (84 - w * s) / 2,
    y: 74 - (node.vertices[k].y - minY) * s - (68 - h * s) / 2,
  });
  const i = Math.min(Math.max(0, vertex), n - 1);
  const type = node.type as PrimitiveType;
  const prims = primitivesOf(type, n);
  const points = (members: number[]) => members.map((k) => `${at(k).x},${at(k).y}`).join(' ');
  return (
    <Picture label="Your shape">
      <div className="journey-picture__box">
        <svg className="journey-sketch" width="96" height="80" viewBox="0 0 96 80" role="img" aria-label={`${node.name}, with vertex ${i + 1} ringed`}>
          {prims.map((members, j) => {
            const holds = members.includes(i);
            if (type === 'POINTS') return <circle key={j} cx={at(members[0]).x} cy={at(members[0]).y} r="2" className="journey-sketch__point" />;
            if (members.length === 2) {
              const [a, b] = members.map(at);
              return <line key={j} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`journey-sketch__edge${holds ? ' is-held' : ''}`} />;
            }
            return <polygon key={j} points={points(members)} className={`journey-sketch__face${holds ? ' is-held' : ''}`} />;
          })}
          <circle cx={at(i).x} cy={at(i).y} r="4.5" className="journey-sketch__ring" />
        </svg>
        <p className="journey-picture__caption">Your vertex is ringed; the {type === 'POINTS' ? 'point it makes is' : 'shapes it belongs to are'} shaded.</p>
      </div>
    </Picture>
  );
}
```

Append to `journey.scss`:

```scss
.journey-sketch {
  flex: none;

  .journey-sketch__face { fill: none; stroke: var(--ink-faint); stroke-width: 1; }
  .journey-sketch__face.is-held { fill: var(--accent-tint); stroke: var(--accent-text); }
  .journey-sketch__edge { stroke: var(--ink-faint); stroke-width: 1.5; }
  .journey-sketch__edge.is-held { stroke: var(--accent-text); }
  .journey-sketch__point { fill: var(--ink-faint); }
  .journey-sketch__ring { fill: none; stroke: var(--value); stroke-width: 2; }
}
```

- [ ] **Step 4: Run, lint, build, test, commit**

Run: `npx vitest run tests/white-box/vertex-journey.test.ts tests/black-box/math-journey.test.ts`
Expected: PASS.

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/entities/scene/model/primitive-assembly.ts src/features/math-panel/model/vertex-journey.ts src/features/math-panel/ui/journey/stage-pictures.tsx src/features/math-panel/ui/journey/journey.scss tests/white-box/vertex-journey.test.ts tests/black-box/math-journey.test.ts
git diff --staged
git commit -m "feat(math): work the Assembled stage with the primitive's rule and a sketch of the shape"
```

---

### Task 19: Rasterised: NDC to a pixel

**Files:**
- Modify: `src/features/math-panel/model/vertex-journey.ts`
- Modify: `src/features/math-panel/ui/journey/stage-pictures.tsx`
- Modify: `src/features/math-panel/ui/PipelineMathContent.tsx` (show the pointer readout and the vector and raster card in every mode)
- Modify: `tests/white-box/vertex-journey.test.ts`, `tests/black-box/math-journey.test.ts` (append)

**Interfaces:**
- Produces: the Rasterised stage's `rows`:
  - from Projected;
  - width W with "x → px";
  - height H with "y → py".

  Both size rows name `glutInitWindowSize`. When the pixel lands outside the window, the sentence adds "This vertex lands outside the window, so the part of the shape out there is clipped."
- Produces: the picture "The formula, with your numbers": `x = (x + 1) / 2 · width = (0.27 + 1) / 2 · 586 = 372`, and the same for y. Below it sit the pointer readout and "Vector vs Raster" (spec §3, "5 · Rasterised"), in every Pipeline mode; the Diagram mode's stage note still shows in Diagram mode.
- This task owns Review Focus item 5. A vertex outside the volume gives NDC beyond ±1 and a pixel outside the window, the numbers are real, nothing is clamped and nothing is NaN.

- [ ] **Step 1: Write the failing tests**

Append to `tests/white-box/vertex-journey.test.ts`:

```ts
describe('WB-JOURNEY-13: Rasterised maps NDC to the window\'s pixels, as the reference does', () => {
  it('works x and y with the canvas size and matches ndcToWindow', () => {
    const tri = mockTriangle();
    const j = vertexJourney(scene([tri]), 'Triangle', 0, CANVAS);
    const px = ndcToWindow(stage(j, 'projected').point!, CANVAS);
    expect(rowsOf(j, 'rasterised')).toEqual([
      ['from Projected', 'NDC (0.27, 0.31)', null],
      [`width ${CANVAS.width}`, `x → ${px.x}`, 'glutInitWindowSize'],
      [`height ${CANVAS.height}`, `y → ${px.y}`, 'glutInitWindowSize'],
    ]);
  });
});

describe('WB-JOURNEY-14: A vertex outside the viewing volume keeps its real numbers', () => {
  it('goes past ±1 and outside the window with no NaN, and the sentence says it is clipped', () => {
    const far = node('Far', 'TRIANGLES', [[3, 0], [3.5, 0], [3, 0.5]]);
    const j = vertexJourney(scene([far]), 'Far', 0, CANVAS);
    const ndc = stage(j, 'projected').point!;
    expect(ndc.x).toBeCloseTo(3, 10);
    expect(stage(j, 'rasterised').point!.x).toBeGreaterThan(CANVAS.width);
    expect(JSON.stringify(j)).not.toContain('NaN');
    expect(stage(j, 'rasterised').sentence).toContain('outside the window');
  });
});
```

Append to `tests/black-box/math-journey.test.ts`:

```ts
describe('BB-JOURNEY-14: Rasterised keeps the pointer readout in every Pipeline mode', () => {
  it('shows the cursor readout and Vector vs Raster in Diagram mode too', async () => {
    mockTriangle();
    useVamsStore.setState({ pipelineMode: 'Diagram', activePipelineStage: 4 });
    getState().setJourneyStageOverride('rasterised');
    const host = mount(h(MathPanel, {}));
    await settle();
    expect(host.textContent).toContain('Cursor (NDC)');
    expect(host.textContent).toContain('Vector vs Raster');
    expect(host.textContent).toContain('Rasterization');
    expect(host.textContent).toContain('The formula, with your numbers');
    unmount(host);
    useVamsStore.setState({ pipelineMode: 'Playground', activePipelineStage: null });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/white-box/vertex-journey.test.ts tests/black-box/math-journey.test.ts`
Expected: FAIL. Rasterised has no rows, there is no clipped sentence, and Diagram mode hides the readout.

- [ ] **Step 3: Implement**

In `vertex-journey.ts`:

```ts
const OUTSIDE = ' This vertex lands outside the window, so the part of the shape out there is clipped.';

function rasterisedStage(ndc: Point, pixel: Point, canvas: CanvasSize): JourneyStage {
  const outside = pixel.x < 0 || pixel.y < 0 || pixel.x >= canvas.width || pixel.y >= canvas.height;
  return stage('rasterised', RASTERISED + (outside ? OUTSIDE : ''), [
    { step: ['from Projected'], value: `NDC ${pair(ndc)}`, call: null, from: true },
    { step: [`width ${canvas.width}`], value: `x → ${pixel.x}`, call: 'glutInitWindowSize' },
    { step: [`height ${canvas.height}`], value: `y → ${pixel.y}`, call: 'glutInitWindowSize' },
  ], `pixel (${pixel.x}, ${pixel.y})`, pixel);
}
```

In both `shapeJourney` and `textJourney`, use `rasterisedStage(ndc, pixel, canvas)` for the Rasterised stage.

In `stage-pictures.tsx`, add the formula and render it first in the `'rasterised'` case (`StagePictures` gains the canvas size from `useCanvasSize()`):

```tsx
import { useCanvasSize } from '@/shared/lib/use-canvas-size';

function PixelFormula({ ndc, canvas }: { ndc: Point; canvas: { width: number; height: number } }) {
  const line = (axis: 'x' | 'y', v: number, size: number) => (
    <>
      {axis} = ({axis} + 1) / 2 · {axis === 'x' ? 'width' : 'height'}
      <br />
      {'  '}= ({fmt(v)} + 1) / 2 · {size} = <span className="is-value">{Math.floor(((v + 1) / 2) * size)}</span>
    </>
  );
  return (
    <Picture label="The formula, with your numbers">
      <p className="journey-formula">
        {line('x', ndc.x, canvas.width)}
        <br />
        {line('y', ndc.y, canvas.height)}
      </p>
      <p className="journey-picture__caption">Pixels are counted from the bottom-left corner, as OpenGL does.</p>
    </Picture>
  );
}
```

Add `ndc: Point | null` to `PicturesProps`. `JourneyTrack` passes `ndc={journey.stages[2]?.point ?? null}`, the Projected stage's point. Add `const canvas = useCanvasSize();` to `StagePictures`. Then:

```tsx
    case 'rasterised':
      return (
        <>
          {stage.point && ndc && <PixelFormula ndc={ndc} canvas={canvas} />}
          <PipelineMathContent />
        </>
      );
```

In `PipelineMathContent.tsx`:
1. Show the `Cursor (NDC)` section and the `Vector vs Raster` section unconditionally.
2. Keep the Diagram mode's stage note (or its empty state) only when `pipelineMode === 'Diagram'`.
3. Order: cursor, then the Diagram note, then Vector vs Raster.

- [ ] **Step 4: Run, lint, build, test, commit**

Run: `npx vitest run tests/white-box/vertex-journey.test.ts tests/black-box/math-journey.test.ts tests/black-box/lesson-column.test.ts`
Expected: PASS.

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/features/math-panel/model/vertex-journey.ts src/features/math-panel/ui/journey/stage-pictures.tsx src/features/math-panel/ui/journey/JourneyTrack.tsx src/features/math-panel/ui/PipelineMathContent.tsx tests/white-box/vertex-journey.test.ts tests/black-box/math-journey.test.ts
git diff --staged
git commit -m "feat(math): work the Rasterised stage from NDC to the window's pixel"
```

---

### Task 20: Coloured: the vertex's colour or texel

**Files:**
- Modify: `src/features/math-panel/model/vertex-journey.ts`
- Modify: `src/features/math-panel/ui/journey/stage-pictures.tsx`, `journey.scss`
- Modify: `tests/white-box/vertex-journey.test.ts`, `tests/black-box/math-journey.test.ts` (append)

**Interfaces:**
- Produces: the Coloured stage's `rows`. They copy the mock's Coloured column:
  - **Untextured:** "at pixel" (the Rasterised pixel); "vertex colour" `(r, g, b)` under `glColor3f`, `glColor3ub` or `glColorPointer`; "shading smooth" with its weights `1, 0, 0`, or "shading flat" with "vertex k’s colour", under `glShadeModel`.
  - **Textured:** "at pixel", the UV, the wrapped UV with the wrap mode as input, the texel for the texture's size under `glBindTexture`, and the filter as input.
- Produces: the picture "Across the face" (`svg.journey-face`, the mock's 96 × 80 drawing). It is the primitive the vertex belongs to, each corner's colour fading in from that corner, with the followed vertex ringed in `--value`. Flat shading fills it with the one colour. It shows for untextured filled primitives (triangles, quads and polygons). Today's colour, barycentric and texture cards stay below it.

- [ ] **Step 1: Write the failing tests**

Append to `tests/white-box/vertex-journey.test.ts`:

```ts
describe('WB-JOURNEY-15: Coloured works the vertex colour and the shading, as the mock does', () => {
  it('shows the pixel, the colour and the smooth weights; flat names the provoking vertex', () => {
    const tri = mockTriangle();
    const j = vertexJourney(scene([tri]), 'Triangle', 0, CANVAS);
    const px = stage(j, 'rasterised').point!;
    expect(rowsOf(j, 'coloured')).toEqual([
      ['at pixel', `(${px.x}, ${px.y})`, null],
      ['vertex colour', '(1.0, 0.4, 0.2)', 'glColor3f'],
      ['shading smooth', 'weights 1, 0, 0', 'glShadeModel'],
    ]);
    const flat = vertexJourney(scene([{ ...tri, shading: 'FLAT' }]), 'Triangle', 0, CANVAS);
    expect(rowsOf(flat, 'coloured')[2]).toEqual(['shading flat', 'vertex 3’s colour', 'glShadeModel']);
  });

  it('works a textured vertex from UV to texel', () => {
    const quad = node('Quad', 'QUADS', [[0, 0], [1, 0], [1, 1], [0, 1]], {}, {
      texture: { textureId: 'tex', filter: 'LINEAR', wrap: 'REPEAT' },
      uvs: [{ u: 0, v: 0 }, { u: 1.25, v: 0 }, { u: 1, v: 1 }, { u: 0, v: 1 }],
    });
    const textured: JourneyScene = { ...scene([quad]), textures: [{ id: 'tex', name: 'Bricks', dataUrl: '', width: 64, height: 32 }] };
    expect(rowsOf(vertexJourney(textured, 'Quad', 1, CANVAS), 'coloured').slice(1)).toEqual([
      ['UV', '(1.25, 0.00)', 'glTexCoord2f'],
      ['wrap REPEAT', '(0.25, 0.00)', 'glTexParameteri'],
      ['texture 64×32', 'texel (16, 0)', 'glBindTexture'],
      ['filter LINEAR', 'a blend of the 4 around it', 'glTexParameteri'],
    ]);
  });
});
```

Append to `tests/black-box/math-journey.test.ts`:

```ts
describe('BB-JOURNEY-15: Coloured shows the colour across the face with the vertex ringed', () => {
  it('matches the mock\'s working and draws the face', async () => {
    mockTriangle();
    getState().setJourneyStageOverride('coloured');
    const host = mount(h(MathPanel, {}));
    await settle();
    const rows = [...host.querySelectorAll('table.journey-work tbody tr')].map((tr) => [...tr.children].map((c) => c.textContent));
    expect(rows.slice(1)).toEqual([
      ['vertex colour', '(1.0, 0.4, 0.2)', 'glColor3f'],
      ['shading smooth', 'weights 1, 0, 0', 'glShadeModel'],
      ['Result', 'rgb(1.0, 0.4, 0.2)', ''],
    ]);
    expect(host.querySelector('svg.journey-face .journey-face__ring')).not.toBeNull();
    expect(host.textContent).toContain('Across the face');
    unmount(host);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/white-box/vertex-journey.test.ts tests/black-box/math-journey.test.ts`
Expected: FAIL. Coloured has no rows and no face picture.

- [ ] **Step 3: Implement**

In `vertex-journey.ts`:
1. Change `colouredStage(node, index, scene)` to `colouredStage(node, index, scene, pixel)`, and pass `pixel` from `shapeJourney`.
2. Build its rows:

```ts
  const at: WorkingRow = { step: ['at pixel'], value: `(${pixel.x}, ${pixel.y})`, call: null, from: true };
  const mode = node.renderingMode ?? 'IMMEDIATE';
  // textured branch, after computing `tex`:
  const wrap = node.texture.wrap;
  const wu = { u: wrappedCoord(uv.u, wrap), v: wrappedCoord(uv.v, wrap) };
  const rows: WorkingRow[] = [
    at,
    { step: ['UV'], value: `(${fmt(uv.u)}, ${fmt(uv.v)})`, call: mode === 'IMMEDIATE' ? 'glTexCoord2f' : 'glTexCoordPointer' },
    { step: ['wrap ', { input: wrap }], value: `(${fmt(wu.u)}, ${fmt(wu.v)})`, call: 'glTexParameteri' },
    ...(tex ? [{ step: [`texture ${tex.width}×${tex.height}`], value: result, call: 'glBindTexture' } as WorkingRow] : []),
    { step: ['filter ', { input: node.texture.filter }], value: node.texture.filter === 'NEAREST' ? 'that texel alone' : 'a blend of the 4 around it', call: 'glTexParameteri' },
  ];
  // untextured branch:
  const members = assemblyFor(node.type as PrimitiveType, index, node.vertices.length).members[0] ?? [index];
  const rgb = rgbOf(node.vertices[index]?.color ?? '#ffffff');
  const colourCall = mode === 'IMMEDIATE' ? (node.colorMode === 'BYTE' ? 'glColor3ub' : 'glColor3f') : 'glColorPointer';
  const rows: WorkingRow[] = [
    at,
    { step: ['vertex colour'], value: `(${rgb.map((c) => c.toFixed(1)).join(', ')})`, call: colourCall },
    flat
      ? { step: ['shading ', { input: 'flat' }], value: `vertex ${source + 1}’s colour`, call: 'glShadeModel' }
      : { step: ['shading ', { input: 'smooth' }], value: `weights ${members.map((k) => (k === index ? '1' : '0')).join(', ')}`, call: 'glShadeModel' },
  ];
```

`wrappedCoord` is the existing `wrapped`; rename it so its use reads clearly. The "vertex colour" row shows the vertex's own colour. The Result row shows the colour the pixel takes (the provoking vertex's under flat shading), as today's `result`.

3. In `textJourney`, give Coloured the rows `[{ step: ['at pixel'], value: …, call: null, from: true }, { step: ['text colour'], value: '(r, g, b)', call: 'glColor3f' }]`.

In `stage-pictures.tsx`, add the face picture and render it first in the `'coloured'` case, for untextured `TRIANGLES`, `TRIANGLE_STRIP`, `TRIANGLE_FAN`, `QUADS`, `QUAD_STRIP` and `POLYGON`:

```tsx
/** The primitive the vertex belongs to, each corner's colour fading in from its corner, the vertex ringed. */
function FacePicture({ node, vertex }: { node: SceneNode; vertex: number }) {
  const baseId = useId();
  const n = node.vertices.length;
  const i = Math.min(Math.max(0, vertex), n - 1);
  const members = assemblyFor(node.type as PrimitiveType, i, n).members[0];
  if (!members || members.length < 3) return null;
  const xs = members.map((k) => node.vertices[k].x);
  const ys = members.map((k) => node.vertices[k].y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(Math.max(...xs) - minX, 1e-6);
  const h = Math.max(Math.max(...ys) - minY, 1e-6);
  const s = Math.min(84 / w, 72 / h);
  const at = (k: number) => ({ x: 6 + (node.vertices[k].x - minX) * s + (84 - w * s) / 2, y: 76 - (node.vertices[k].y - minY) * s - (72 - h * s) / 2 });
  const points = members.map((k) => `${at(k).x},${at(k).y}`).join(' ');
  const flat = node.shading === 'FLAT';
  const flatColour = node.vertices[provokingVertex(node.type as PrimitiveType, i, n)]?.color ?? '#ffffff';
  const reach = Math.hypot(w * s, h * s);
  return (
    <Picture label="Across the face">
      <div className="journey-picture__box">
        <svg className="journey-face" width="96" height="80" viewBox="0 0 96 80" role="img" aria-label={`The colour across ${node.name}`}>
          <defs>
            {members.map((k) => (
              <radialGradient key={k} id={`${baseId}-${k}`} cx={at(k).x} cy={at(k).y} r={reach} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor={node.vertices[k].color} />
                <stop offset="0.85" stopColor={node.vertices[k].color} stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>
          {flat ? (
            <polygon points={points} fill={flatColour} />
          ) : (
            <>
              <polygon points={points} className="journey-face__base" />
              {members.map((k) => <polygon key={k} points={points} fill={`url(#${baseId}-${k})`} />)}
            </>
          )}
          <circle cx={at(i).x} cy={at(i).y} r="4.5" className="journey-face__ring" />
        </svg>
        <p className="journey-picture__caption">
          {flat
            ? 'With flat shading the whole shape takes one vertex’s colour.'
            : 'Your vertex sits at a corner, so it keeps its own colour. Pixels further in blend toward the others.'}
        </p>
      </div>
    </Picture>
  );
}
```

Import `useId` from `react`, and `assemblyFor` and `provokingVertex` from `@/entities/scene/model/primitive-assembly`. Append to `journey.scss`:

```scss
.journey-face {
  flex: none;

  .journey-face__base { fill: var(--paper-sunken); }
  .journey-face__ring { fill: none; stroke: var(--value); stroke-width: 2; }
}
```

- [ ] **Step 4: Run, lint, build, test, commit**

Run: `npx vitest run tests/white-box/vertex-journey.test.ts tests/black-box/math-journey.test.ts tests/black-box/lesson-column.test.ts`
Expected: PASS. WB-JOURNEY-05's `result` checks are unchanged.

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/features/math-panel/model/vertex-journey.ts src/features/math-panel/ui/journey/stage-pictures.tsx src/features/math-panel/ui/journey/journey.scss tests/white-box/vertex-journey.test.ts tests/black-box/math-journey.test.ts
git diff --staged
git commit -m "feat(math): work the Coloured stage from vertex colour or UV to the pixel's colour"
```

After each of Tasks 17–20, retake VIS-CM-02 and 03:
1. Delete `tests/visual/baseline.local/cm-journey-*.png`.
2. Run `npx playwright test tests/visual/code-math.spec.ts --update-snapshots`.
3. Look at the stage's capture before moving on.

Show the owner the Coloured capture beside `mock-journey-coloured.png` when Task 20 lands.

---

## Build step 5: help, the product plan, the roadmap and the divergence

### Task 21: Documentation

Not editor code; it may land after the freeze. Every string follows the product rules.

**Files:**
- Modify: `src/features/help/model/help-content.ts`
- Modify: `docs/product-plan.md`
- Modify: `docs/specs/2026-10-04-website-overhaul-roadmap.md`
- Modify: `tests/README.md`
- Modify: `tests/black-box/help-center.test.ts` (append BB-HELP-09)

- [ ] **Step 1: Write the failing test**

Append to `tests/black-box/help-center.test.ts`:

```ts
describe('BB-HELP-09: Help describes the folded code and the vertex journey', () => {
  it('explains folds, the strip, notes, the marks and the six stages, and no longer mentions tabs or underlines', () => {
    const code = JSON.stringify(HELP_TOPICS.find((t) => t.id === 'code-panel'));
    for (const word of ['fold', 'strip', 'Notes', 'amber', 'Copy always copies the whole program']) expect(code, word).toContain(word);
    const math = JSON.stringify(HELP_TOPICS.find((t) => t.id === 'math-panel'));
    for (const stage of ['Stored', 'Transformed', 'Projected', 'Assembled', 'Rasterised', 'Coloured']) expect(math, stage).toContain(stage);
    const all = JSON.stringify(HELP_TOPICS);
    expect(all).not.toMatch(/one tab per section|underlined line|the code highlights it/i);
  });
});
```

Run: `npx vitest run tests/black-box/help-center.test.ts`
Expected: FAIL.

- [ ] **Step 2: Rewrite the help topics**

In `help-content.ts`, replace the `code-panel` topic's `summary`, `keywords` and `blocks` with:

```ts
    summary: 'The generated OpenGL C++, folded to the object you are working on, with any line explained on request.',
    keywords: ['code', 'generated', 'c++', 'opengl', 'copy', 'fold', 'notes', 'explain', 'display', 'init'],
    blocks: [
      {
        kind: 'paragraph',
        text: 'The Code side of the right column shows the complete OpenGL 1.5 C++ program for your scene. It updates the moment you edit, so every change you make has a line you can point to.',
      },
      { kind: 'heading', text: 'Folds follow your selection' },
      {
        kind: 'list',
        items: [
          'The selected object’s code is open: its state line, its buffer data, its draw function and its setup in init(). The rest of the program folds to one row per block, such as ▸ int main().',
          'With nothing selected, every object’s code is open and only the setup code folds.',
          'Click a folded row, or press Enter on it, to open it; hover it to read what the block does. A block you open stays open until you select something else.',
          'Line numbers are the real program’s, and Copy always copies the whole program.',
        ],
      },
      { kind: 'heading', text: 'Reading a line' },
      {
        kind: 'list',
        items: [
          'Click any line, or press Enter on it, to see what it does in the strip at the bottom: the call, what it does, your values and the controls that set them.',
          'From the strip, See the math opens the journey stage that works those numbers, and Open shows the control in its panel.',
          'Arrow Up and Arrow Down move between lines while the strip is open; Escape closes it.',
          'Short notes under the key lines of a draw function say what they do with your numbers. Notes in the header hides or shows them.',
        ],
      },
      { kind: 'heading', text: 'What the marks mean' },
      {
        kind: 'table',
        headers: ['Mark', 'Meaning'],
        rows: [
          ['A value in amber, fading', 'The value your last edit changed. Its line number stays amber until the next change.'],
          ['A line on a lighter background', 'The line the strip is explaining.'],
          ['An outline around text', 'A Find match. Enter and Shift+Enter move between matches.'],
          ['A green bar', 'The callback branch Run just fired.'],
        ],
      },
      {
        kind: 'code',
        code: 'void display() {\n    glClear(GL_COLOR_BUFFER_BIT);\n    glBegin(GL_TRIANGLES);\n        glColor3f(1.0f, 0.0f, 0.0f);\n        glVertex2f(-0.5f, -0.5f);\n        glVertex2f( 0.5f, -0.5f);\n        glVertex2f( 0.0f,  0.5f);\n    glEnd();\n    glutSwapBuffers();\n}',
      },
    ],
```

Replace the `math-panel` topic's `summary`, `keywords` and `blocks` with:

```ts
    summary: 'One vertex of your shape, followed with your numbers from where you typed it to the pixel it lands on.',
    keywords: ['math', 'journey', 'vertex', 'matrix', 'ndc', 'pixel', 'barycentric', 'memory', 'interpolation'],
    blocks: [
      {
        kind: 'paragraph',
        text: 'Switch the right column to Math to follow one vertex of the selected shape through the six stages OpenGL takes it through, with your own numbers. An amber ring marks the vertex on the canvas.',
      },
      {
        kind: 'table',
        headers: ['Stage', 'What happens', 'Section'],
        rows: [
          ['Stored', 'Where the vertex is kept: sent directly, in an array, or in a GPU buffer', 'Buffers'],
          ['Transformed', 'Scaled, rotated and moved by your transform, then by each group around it', 'Transforms'],
          ['Projected', 'Fitted into the −1 to 1 box by glOrtho', 'Transforms'],
          ['Assembled', 'Joined with its neighbours by the primitive type', 'Primitives'],
          ['Rasterised', 'Mapped to a pixel in the window', 'Pipeline'],
          ['Coloured', 'Given its colour, or its texel for a textured shape', 'Primitives, Textures'],
        ],
      },
      { kind: 'heading', text: 'Using the journey' },
      {
        kind: 'list',
        items: [
          'Every stage shows its result. One is open with its working: each step, its value and the GL call that does it, with your inputs in amber.',
          'The open stage follows what you are doing: the group you open, or in a lesson the control the step points at. Click any stage to open it yourself; your pick holds until the next lesson step or the next group you open.',
          'Use ‹ and › beside the vertex count, or click one of the shape’s vertex handles on the canvas, to follow another vertex.',
          'Click a GL call in the working to see its line in Code.',
        ],
      },
      {
        kind: 'callout',
        tone: 'tip',
        text: 'Select a shape first. With nothing selected, each stage says what it does, and the viewing volume and the pointer readout still work.',
      },
    ],
```

Then:
1. In the `workspace-tour` topic, replace "Math is the numbers behind it, with one tab per section." with "Math follows one vertex of the selected shape through the pipeline, with your numbers."
2. In the `scene-hierarchy` topic, replace "(the code highlights it too)" with "(its code opens in Code)".

- [ ] **Step 3: Amend the product plan**

In `docs/product-plan.md`:

1. **Stage 0 acceptance criterion 1.** Replace "a right column containing a code panel and a math panel" with "a right column containing a code panel and a math panel, shown one at a time".
2. **Criterion 8.** Replace "The math panel has one tab per curriculum section and follows the control the student is using." with "The math panel is a vertex journey: it follows one vertex of the selected object through six pipeline stages (Stored, Transformed, Projected, Assembled, Rasterised, Coloured) with the student's numbers, and opens the stage that matches the control the student is using."
3. **Workspace Layout, the "Code and math column" bullet.** Append: "The math pane is the vertex journey: a track of the six stages, each showing its result, with one open to its step-by-step working and its pictures. An amber ring marks the followed vertex on the canvas while Math shows."
4. **Code Generation.** Replace the three bullets:
   - "The full scene is always shown. There is no partial or per-object view." → "The full scene is always shown. There is no partial or per-object view. In the code panel a folded block shows as one row, and Copy always gives the whole program."
   - "When a scene mutation changes the generated output, the changed lines briefly animate to draw the student's eye." → "When a scene mutation changes the generated output, the changed values are marked."
   - "The selected object's corresponding code lines are visually distinguished." → "The selected object's code is unfolded and the rest of the program is folded to one line per block. Any line can be explained on request, and short notes sit under the key lines of the selected object's draw function. Folds, notes and explanations are panel UI: the generated program does not contain them."
5. **Buffer Flow Visualization and Direct Memory Access Visualization.** Replace "the math panel displays" with "the math panel's Stored stage displays" in each section's first sentence.
6. **Stage 4 Workspace Configuration.**
   - Change the "Viewport" bullet's last sentence to "The matrix stack appears in the math panel's Transformed stage."
   - Change the "Math Panel" bullet to "**Math Panel:** the Transformed stage works the selected object's transform step by step and shows it as one matrix, with the full 4×4, the composition trace and the matrix stack; the Projected stage shows the glOrtho mapping with the student's numbers."
7. **Matrix Stack Visualization.** Append "It appears in the math panel's Transformed stage."

- [ ] **Step 4: The roadmap and the divergence**

In `docs/specs/2026-10-04-website-overhaul-roadmap.md`:
1. **Could item 16.** Append ". Complete (YYYY-MM-DD) with the code and math rework", using the merge date.
2. **"Next projects", item 2.** Append " Complete (YYYY-MM-DD): [spec](2026-10-15-code-math-rework-design.md), [plan](../plans/2026-10-15-code-math-rework.md)." If build step 4 stopped early, name the stages that shipped their working.
3. **"Divergences from the thesis manuscript".** Add as item 15: "15. The evaluated build's math panel had one tab per curriculum section, and its code panel tinted the selected object's lines and explained boilerplate only on an empty scene. The math panel is now a vertex journey through six pipeline stages with the student's numbers. The code panel folds everything but the selected object's code and explains any line on request (code and math rework)."

- [ ] **Step 5: The tests README**

In `tests/README.md`:
1. Add the new files to the layout block:
   - under black-box: `code-panel.test.ts (BB-CODE-*: folds, value marks, Find, the strip and notes)` and `math-journey.test.ts (BB-JOURNEY-*: the vertex journey, its stages, the stepper and the links)`;
   - under white-box: `code-structure.test.ts (WB-CODE-*: the outline, folds, value diff and explanation catalogue)` and `vertex-journey.test.ts (WB-JOURNEY-*: each stage's numbers against the reference)`.
2. Update "run all N tests" to the count `npm test` prints.

- [ ] **Step 6: Run, lint, build, test, commit**

Run: `npx vitest run tests/black-box/help-center.test.ts`
Expected: PASS.

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/features/help/model/help-content.ts docs/product-plan.md docs/specs/2026-10-04-website-overhaul-roadmap.md tests/README.md tests/black-box/help-center.test.ts
git diff --staged
git commit -m "docs: help, product plan, roadmap and divergence for the folded code and the vertex journey"
```

---

## Plan rulings, collected

Every decision this plan took that the spec did not settle in so many words.

| # | Ruling | Why | Cost if wrong |
| --- | --- | --- | --- |
| P1 | Selection resets live in one store subscription, not in `selectObject` and "the multi-select actions" | There are no multi-select actions; a dozen paths write `selectedObjectId`, and the rail already handles this with a subscription | One subscription to move |
| P2 | The tour's Understand step sets `journeyStageOverride: 'transformed'` | The spec's premise that the context opens Transformed is false: Transform starts open, so changing X opens no group | One field in `enterStep` |
| P3 | Dim greys lifted for contrast: `--ink-dim` dark `#7a84a0`, light `#626b85`; `--line-number` dark `#5d6680`, light `#7d87a1` | Owner decision, 2026-10-15 | Retune two tokens |
| P4 | Light `--value` is `#8a4f00`, not the spec's `#9a5800` | The panel moves to `--paper`, as in the mock, where `#9a5800` drops to 4.05:1 on its wash | One token |
| P5 | The mocks' 10, 11.5, 12.5 and 16 px map to `--text-xs`, `--text-xs`, `--text-sm` and `--text-md` | The type scale has no smaller or in-between sizes | Small size differences at the checkpoints |
| P6 | A changed value keeps its fold open until the next edit or a selection change | The spec does not say when it closes; closing after the 2 s fade makes the code jump | A rule change in `useValueMarks` |
| P7 | Lines in other objects' handlers, `draw_X();` calls in `draw()`, and VBO and texture handles do not unfold with the selection | Spec §2 lists exactly the state line, buffer data, draw function and init lines | A set to edit in `code-folds.ts` |
| P8 | A group opens only its own lines, not its children's draw functions | "Every line that belongs to the selected object" | One rule in `visibleRows` |
| P9 | Partly open blocks: functions keep their signature, `{` and `}`; hidden runs read "N more objects", or "N more lines" when no object owns them | The spec's "▸ 2 more objects" example, extended to runs of boilerplate | Label wording |
| P10 | Forward declarations, the program's own calls (`draw_X();`, `init();`) and stb_image calls are explainable too | They are code a student asks about; the spec's list does not exclude them | More catalogue entries |
| P11 | Find steps through matches with Enter and Shift+Enter, and shows "k/n" | The spec gives Find a "current match", which needs a way to move it | Two key handlers |
| P12 | Math to code goes through a store request (`explainRequest`), and the code panel finds the line | The spec keeps the link in store state; only the code panel has the outline | One transient field |
| P13 | "Open ‹control›" uses `revealedGroup`, read by `useGroupFocus` in Author mode; it selects the line's object first when needed | Outlining a control existed only in lessons | One field and three lines in the hook |
| P14 | For an object in a group, the matrix stack is a Transformed picture, not deeper detail | The Transforms lesson's matrix-stack step names it | Move one picture |
| P15 | The "As one matrix" picture is 3 × 3, as in the mock; the full 4×4 is deeper detail | The approved mock | Show 4 × 4 instead |
| P16 | `useCanvasSize` moves to `shared/lib`; `fmt` and `short` to `shared/lib/format-number`; the assembly rules to `entities/scene/model/primitive-assembly` | Both features need them, and neither may import the other's slice for them | Three file moves |
| P17 | Stored rows name `verts_<name>` and `vbo_<name>` through `sanitizeName` from `code-generation` | The repo's known exception (features import `code-generation`); the reverse never happens | Copy one small function |
| P18 | The stepper wraps around | It is never disabled, and the live region names the vertex | Disable at the ends instead |
| P19 | Rasterised's pointer readout and "Vector vs Raster" show in every Pipeline mode | Spec §3 lists both as Rasterised's pictures | One conditional |
| P20 | New student-facing text uses the spec's and mocks' British spelling; quoted control labels stay as the UI writes them | The approved words; the UI elsewhere spells "color" | A spelling pass |
| P21 | Of the 15 rail `pane: 'math'` steps, 10 narrations change and only one step gets `mathStage` | Every other step's context already opens the stage it names | One field per step |

## Self-review

- **Spec coverage**, each section and its tasks:
  - §1 colour rule: Task 5 (tokens) and Tasks 10 and 14 (roles).
  - §2:
    - outline and folding: Tasks 2, 3 and 6;
    - notes: Tasks 13 and 14;
    - strip: Tasks 13 and 14;
    - highlights: Tasks 4, 5 and 6;
    - syntax: Task 5.
  - §3:
    - header and track: Task 10;
    - the open stage: Tasks 9 and 10;
    - each stage: Tasks 9 and 17–20;
    - objects without vertices: Tasks 9 and 10;
    - which stage opens: Task 8;
    - accessibility: Task 10.
  - §4 links: Tasks 14 and 15.
  - §5:
    - lessons: Task 11;
    - tour: Task 8, ruling P2;
    - help: Task 21.
  - §6 state: Tasks 1, 8, 14 and 15; modules: the file map.
  - §7 tests: every task.
  - §8 documents: Task 21.
  - §9 delivery: the build-step headings and the three checkpoints.
- **Placeholders:** none. The two dates in Task 21 are the merge date, filled in at merge.
- **Type consistency:** these names match across tasks:
  - `CodeRow`, `CodeMark`, `CodeNote`, `CodeStrip`
  - `visibleRows(outline, selection, opened, forced)`
  - `JourneyStageId`
  - `journeyStageOverride` and `setJourneyStageOverride`
  - `journeyVertex` and `setJourneyVertex`
  - `explainRequest` and `requestExplain`
  - `revealedGroup` and `revealGroup`
  - `assemblyFor(type, index, count)`
- **Review Focus:** items 1–5 each have their test in the owning task (Tasks 6, 1, 9 and 10, 2 and 6, and 19).
