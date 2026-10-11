# Functional Callbacks Implementation Plan

Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Students give each GLUT callback rules built from menus, the generator writes real handler bodies from those rules, and a Run state on the canvas plays the handlers live without ever writing scene state.

**Architecture:** Rules are plain data in the callbacks slice (`core/types/scene.ts`, `core/callbacks/callbacks-model.ts`). Two pure readers consume them: the C++ generator (`features/code-generation/model/generator/handlers.ts`) and the Run runtime (`features/callbacks/model/runtime.ts`). A Run controller singleton, modelled on the animation controller, owns events and the frame loop. It pushes a temporary run state to the canvas through the render bridge and never calls a scene-state setter.

**Tech Stack:** Preact + preact/compat, Zustand (persist), PixiJS 8, SCSS tokens, Vitest + happy-dom (tests use `h()`, no JSX), Playwright for the visual suite.

**Spec:** [docs/specs/2026-10-12-functional-callbacks-design.md](../specs/2026-10-12-functional-callbacks-design.md)

## Global Constraints

- Six callbacks, always in this order: `keyboard`, `special`, `mouse`, `motion`, `reshape`, `idle`. Labels: Keyboard, Special keys, Mouse, Motion, Reshape, Idle.
- Each callback holds at most **8 rules**. Translate is −10 to 10 (step 0.01). Rotate is −360 to 360 (step 1). Scale is 0.10 to 10 (step 0.01). Colour is `#rrggbb`.
- Move to pointer is allowed only for Mouse and Motion, and lists only top-level objects. Set colour lists no groups.
- Reserved handler names: `main`, `init`, `display`, `draw`, `update_buffers`, `windowToWorld`, `_vams_idle`, any name starting with `draw_`, `animate_`, `state_` or `initial_`, and C++ keywords. A name already used by an earlier callback in table order is also invalid.
- Scenes with no registered callbacks must generate exactly the same program as before this work (BB-CB-12 pins it).
- Run never writes scene state. The persisted `vams-storage` value and an exported `.vams` file are identical before, during and after Run.
- Run is not a mode. `appMode` never changes for it, and AGENTS.md's "Two modes only" holds.
- Student-facing text never uses "coming soon", "not yet", "not supported", "unsupported", "future", "deferred", "3D" or "lighting".
- Section labels stay exactly `Pipeline | Primitives | Buffers | Transforms | Textures`.
- SCSS uses `--text-*` font sizes only, never uppercase, and uses existing tokens (`--space-*`, `--radius-s|m`, `--accent`, `--on-accent`, `--paper-*`, `--rule`, `--focus-ring`).
- FSD: `core` and `entities` never import `features`. `code-generation` never imports `callbacks`. Pages and widgets wire features together.
- Tests live in `tests/`, carry stable ids, and normalise `\r\n` when they read source or fixture files, since the working copy is CRLF.
- Commits: Conventional Commits; stage explicit paths only; never stage `.gitignore` or `tests/reports`. Run `npm run lint && npm run build && npm test` before every commit, then `git checkout -- tests/reports`. No `Co-Authored-By` or tool attribution.

## Review Focus

1. **Duplicate handler names.** Two callbacks named `onInput`: Motion and Reshape share the signature `(int, int)`, so the C++ would not compile. The later callback is flagged and left out (Task 1 BB-CB-13, Task 2 BB-CB-13b).
2. **Modifier keys during Run.** Ctrl+Z or Ctrl+D while running must neither undo nor reach a handler, and must not stop the run (Task 5 BB-RUN-8).
3. **Browser resize during Run.** The editor's own resize listener resets the world transform. Run must reapply its view every frame and clamp the program window to a smaller canvas (Task 5 BB-RUN-7).
4. **Run during a lesson.** The lesson card is inert, and a lesson step change stops Run (Task 5 BB-RUN-9, Task 6 BB-RUN-6).
5. **Pointer released outside the canvas.** The run surface captures the pointer, so Mouse Up still reaches the handler (Task 6 BB-RUN-10).

---

## File map

| File | Status | Responsibility |
| --- | --- | --- |
| `src/core/types/scene.ts` | modify | Callback, rule, trigger and action types |
| `src/core/callbacks/cpp-keywords.ts` | create | C++ keyword set, moved out of the generator utils |
| `src/core/callbacks/callbacks-model.ts` | create | Kinds, limits, validity, clamping, sanitising, migration, pruning, `programObjects` |
| `src/core/store/types.ts` | modify | Slice and snapshot types |
| `src/core/store/callbacks-slice.ts` | modify | Rule actions |
| `src/core/store/history-slice.ts` | modify | Snapshots include `callbacks` |
| `src/core/store/persist-migrate.ts` | create | Version 7 → 8 migration |
| `src/core/store/index.ts` | modify | `version: 8`, `migrate` |
| `src/core/store/lesson-slice.ts` | modify | Uses `emptyCallbacks()` |
| `src/entities/scene/model/scene-slice.ts` | modify | Deleting prunes rules |
| `src/entities/project/model/project-io.ts` | modify | Schema 9, new sanitizer |
| `src/entities/project/model/scene-empty.ts` | modify | `hasCallbackContent` |
| `src/features/code-generation/model/generator/handlers.ts` | create | Plan, handler bodies, view globals, `windowToWorld`, registrations |
| `src/features/code-generation/model/generator/{state,render,buffers,utils}.ts` | modify | Extended state, `initial_`, colour and visibility guards |
| `src/features/code-generation/model/{code-generator,generate-from-state}.ts` | modify | Use the plan |
| `src/features/code-generation/model/locate-branch.ts` | create | `locateHandlerBranch` |
| `src/features/code-generation/ui/SceneCodePanel.tsx` | modify | `flashBranch` prop |
| `src/shared/ui/controls/SelectField.tsx` | create | Labelled native select |
| `src/features/callbacks/model/rule-copy.ts` | create | Panel copy, summaries, defaults, options |
| `src/features/callbacks/ui/{CallbacksPanel,CallbackRow,RuleList,RuleForm}.tsx` | create or rewrite | The Callbacks group |
| `src/features/callbacks/model/runtime.ts` | create | Pure run state and dispatch |
| `src/shared/engine/render-bridge.ts` | modify | `setAppearance`, `setView`, `getCanvasSize` |
| `src/shared/engine/pixi/hooks/useSceneRenderer.ts` | modify | Implements the bridge additions |
| `src/features/callbacks/model/run-controller.ts`, `useRunSnapshot.ts`, `index.ts` | create | Run controller and hook |
| `src/features/callbacks/ui/RunOverlay.tsx`, `run-overlay.scss` | create | Run button, strip, readout, window and handle |
| `src/widgets/canvas/ui/CanvasOverlays.tsx`, `src/widgets/canvas/VamsCanvas.tsx` | modify | Place the overlay, clean up |
| `src/widgets/layout/top-bar/TopBar.tsx`, `src/widgets/layout/code-math-column/CodeMathColumn.tsx`, `src/pages/editor/ui/EditorShell.tsx` | modify | Inert while running, code flash |
| `src/features/lesson-engine/model/{primitives-lessons,catalog}.ts`, `src/features/help/model/help-content.ts` | modify | Lessons and help |
| `docs/product-plan.md`, `docs/specs/2026-10-04-website-overhaul-roadmap.md`, `tests/README.md` | modify | Docs |
| `tests/helpers/mini-cpp.ts` | create | An independent interpreter for generated statements |
| `tests/black-box/callbacks.test.ts`, `tests/black-box/run-mode.test.ts`, `tests/white-box/callbacks-runtime.test.ts`, `tests/fixtures/no-callbacks-program.cpp` | create | New suites and the fixture |

---

### Task 1: Rule model, store, history, migration and sanitizer

**Files:**
- Modify: `src/core/types/scene.ts` (the `GlutCallbackKind` / `CallbackRegistration` block)
- Create: `src/core/callbacks/cpp-keywords.ts`, `src/core/callbacks/callbacks-model.ts`, `src/core/store/persist-migrate.ts`
- Modify: `src/features/code-generation/model/generator/utils.ts` (import the keyword set)
- Modify: `src/core/store/types.ts`, `src/core/store/callbacks-slice.ts`, `src/core/store/history-slice.ts`, `src/core/store/index.ts`, `src/core/store/lesson-slice.ts`
- Modify: `src/entities/scene/model/scene-slice.ts` (`deleteObject`, `deleteGroup`)
- Modify: `src/entities/project/model/project-io.ts`, `src/entities/project/model/scene-empty.ts`
- Modify (old shape → new shape only): `src/features/workspace-reset/model/useNewWorkspace.ts`, `src/features/lesson-engine/model/useLessonRunner.ts`, `src/pages/home/model/demo-code.ts`, `src/features/code-generation/model/generate-from-state.ts`, `src/features/callbacks/ui/CallbacksPanel.tsx`, `src/features/lesson-engine/model/primitives-lessons.ts` (exercise 5 `successCheck` only)
- Create: `tests/black-box/callbacks.test.ts`
- Modify tests: `tests/setup.ts`, `tests/black-box/project-persistence.test.ts`, `tests/white-box/persistence-manager.test.ts`, `tests/white-box/lesson-engine-internals.test.ts`, `tests/black-box/lesson-engine.test.ts`, `tests/algorithm/algorithm-2-code-generation.test.ts`, `tests/algorithm/algorithm-3-lesson-step.test.ts`, `tests/black-box/scene-library.test.ts`, `tests/black-box/editor-links.test.ts`

**Interfaces:**
- Produces (types, `@/core/types/scene`): `GlutCallbackKind`, `RuleCallbackKind`, `SpecialKey`, `MouseButton`, `MouseState`, `RuleTrigger`, `RuleAction`, `CallbackRule`, `ResizeMode`, `RuleCallback`, `ReshapeCallback`, `CallbacksState`, `CallbackRegistration`.
- Produces (`@/core/callbacks/callbacks-model`):
  - constants: `CALLBACK_KINDS`, `RULE_KINDS`, `MAX_RULES = 8`, `KEYBOARD_KEYS`, `SPECIAL_KEYS`, `MOUSE_BUTTONS`, `MOUSE_STATES`;
  - `emptyCallbacks(): CallbacksState`, `newRuleId(): string`;
  - validity: `isValidHandlerName(name): boolean`, `isRegistered(cb): boolean`, `isCallbackValid(callbacks, kind): boolean`, `hasCallbackContent(callbacks): boolean`, `actionAllowed(kind, type): boolean`;
  - cleaning: `clampAction(action): RuleAction`, `pruneCallbackRules(callbacks, liveIds): CallbacksState`, `withRuleCallback(callbacks, kind, next): CallbacksState`, `programObjects(objects): SceneNode[]`;
  - loading: `sanitizeCallbacks(raw, liveIds): CallbacksState`, `migrateLegacyCallbacks(raw): CallbacksState`.
- Produces (store actions): `setCallbackHandler(kind, name)`, `clearCallback(kind)`, `addCallbackRule(kind, rule)`, `updateCallbackRule(kind, ruleId, patch, recordHistory = true)`, `removeCallbackRule(kind, ruleId)`, `setReshapeMode(mode)`, `getRegisteredCallbacks(): CallbackRegistration[]` (valid ones, trimmed, table order).
- Produces: `migratePersistedState(persisted: unknown, version: number): unknown` in `@/core/store/persist-migrate`.

- [ ] **Step 1: Write the failing tests**

Create `tests/black-box/callbacks.test.ts`:

```ts
/**
 * BLACK-BOX TEST SUITE — BB-CB
 * Functional callbacks: the rule model, the store actions and the generated handler code.
 */
import { describe, it, expect } from 'vitest';
import { useVamsStore } from '@/core/store';
import {
  emptyCallbacks, isCallbackValid, isValidHandlerName, MAX_RULES,
} from '@/core/callbacks/callbacks-model';
import type { CallbackRule } from '@/core/types/scene';
import { addTriangle, addQuad, getState } from '../helpers/store';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rule = (objectId: string, over: Partial<CallbackRule> = {}): CallbackRule => ({
  id: `r-${Math.random()}`,
  objectId,
  trigger: { kind: 'keyboard', key: 'd' },
  action: { type: 'translate', dx: 0.1, dy: 0 },
  ...over,
});

describe('BB-CB-13: Handler names that would not compile are flagged', () => {
  it('rejects non-identifiers, reserved names, reserved prefixes and C++ keywords', () => {
    for (const bad of ['', '1abc', 'on key', 'main', 'display', 'draw', 'init', 'update_buffers',
      'windowToWorld', '_vams_idle', 'draw_Tri', 'animate_x', 'state_y', 'initial_z', 'switch', 'class']) {
      expect(isValidHandlerName(bad)).toBe(false);
    }
    for (const good of ['onKey', '_handler', 'onMouse2']) expect(isValidHandlerName(good)).toBe(true);
  });

  it('flags a name already used by an earlier callback, and leaves it out of getRegisteredCallbacks', () => {
    getState().setCallbackHandler('motion', 'onInput');
    getState().setCallbackHandler('reshape', 'onInput');
    const cbs = getState().callbacks;
    expect(isCallbackValid(cbs, 'motion')).toBe(true);
    expect(isCallbackValid(cbs, 'reshape')).toBe(false);
    expect(getState().getRegisteredCallbacks()).toEqual([{ kind: 'motion', handlerName: 'onInput' }]);
  });
});

describe('BB-CB-14: Deleting an object removes its rules; undo restores both', () => {
  it('prunes rules on delete and undo brings the object and the rules back', async () => {
    const tri = addTriangle();
    await wait(60);
    getState().setCallbackHandler('keyboard', 'onKey');
    await wait(60);
    getState().addCallbackRule('keyboard', rule(tri.id));
    await wait(60);
    getState().deleteObject(tri.id);
    expect(getState().callbacks.keyboard.rules).toEqual([]);
    getState().undo();
    expect(getState().objects.some((o) => o.id === tri.id)).toBe(true);
    expect(getState().callbacks.keyboard.rules).toHaveLength(1);
  });

  it('deleteGroup prunes rules on the group and its children', async () => {
    const a = addTriangle();
    const b = addQuad(0.4, 0, 0.1);
    getState().createGroup([a.id, b.id]);
    const group = getState().objects.find((o) => o.type === 'GROUP')!;
    getState().setCallbackHandler('keyboard', 'onKey');
    getState().addCallbackRule('keyboard', rule(a.id));
    getState().addCallbackRule('keyboard', rule(group.id, { trigger: { kind: 'keyboard', key: 'a' } }));
    await wait(60);
    getState().deleteGroup(group.id);
    expect(getState().callbacks.keyboard.rules).toEqual([]);
  });

  it('undo restores a cleared callback', async () => {
    getState().setCallbackHandler('mouse', 'onMouse');
    await wait(60);
    getState().clearCallback('mouse');
    expect(getState().callbacks.mouse.handlerName).toBe('');
    getState().undo();
    expect(getState().callbacks.mouse.handlerName).toBe('onMouse');
  });
});

describe('BB-CB-15: The store refuses rules that do not fit their callback', () => {
  it('ignores a 9th rule', () => {
    const tri = addTriangle();
    for (let i = 0; i < MAX_RULES + 1; i++) {
      getState().addCallbackRule('keyboard', rule(tri.id, { id: `k${i}` }));
    }
    expect(getState().callbacks.keyboard.rules).toHaveLength(MAX_RULES);
  });

  it('ignores a trigger of another kind and Move to pointer on a key', () => {
    const tri = addTriangle();
    getState().addCallbackRule('keyboard', rule(tri.id, { trigger: { kind: 'special', key: 'left' } }));
    getState().addCallbackRule('keyboard', rule(tri.id, { action: { type: 'moveToPointer' } }));
    expect(getState().callbacks.keyboard.rules).toEqual([]);
  });

  it('clamps values to the limits', () => {
    const tri = addTriangle();
    getState().addCallbackRule('idle', rule(tri.id, { trigger: { kind: 'idle' }, action: { type: 'scale', sx: 50, sy: 0 } }));
    expect(getState().callbacks.idle.rules[0].action).toEqual({ type: 'scale', sx: 10, sy: 0.1 });
  });

  it('starts empty with Keep proportions for Reshape', () => {
    expect(emptyCallbacks().reshape).toEqual({ handlerName: '', resize: 'keep' });
  });
});
```

Add to `tests/white-box/persistence-manager.test.ts`:

```ts
import { migratePersistedState } from '@/core/store/persist-migrate';

describe('WB-PERSIST-06: Browser storage version 7 migrates to version 8', () => {
  it('keeps handler names, adds empty rules, maps Reshape to Stretch, and migrates the lesson backup', () => {
    const v7 = {
      objects: [],
      callbacks: { keyboard: 'onKey', mouse: '', reshape: 'onResize', motion: '', idle: 'tick' },
      callbacksBackup: { keyboard: '', mouse: 'onClick', reshape: '', motion: '', idle: '' },
      theme: 'light',
    };
    const out = migratePersistedState(v7, 7) as Record<string, any>;
    expect(out.theme).toBe('light');
    expect(out.callbacks.keyboard).toEqual({ handlerName: 'onKey', rules: [] });
    expect(out.callbacks.special).toEqual({ handlerName: '', rules: [] });
    expect(out.callbacks.reshape).toEqual({ handlerName: 'onResize', resize: 'stretch' });
    expect(out.callbacks.idle).toEqual({ handlerName: 'tick', rules: [] });
    expect(out.callbacksBackup.mouse).toEqual({ handlerName: 'onClick', rules: [] });
  });

  it('keeps a null lesson backup null, and starts fresh from versions before 7', () => {
    expect((migratePersistedState({ callbacks: {}, callbacksBackup: null }, 7) as any).callbacksBackup).toBeNull();
    expect(migratePersistedState({ objects: [{ id: 'x' }] }, 6)).toEqual({});
  });
});
```

Add to `tests/black-box/project-persistence.test.ts`:

```ts
describe('BB-PERSIST-05: A schema 8 project file loads into the new callbacks shape', () => {
  it('turns name strings into callbacks with no rules', () => {
    const data = sanitizeProjectData({
      objects: [],
      callbacks: { keyboard: 'onKey', mouse: '', reshape: 'onResize', motion: '', idle: '' },
    });
    expect(data.callbacks.keyboard).toEqual({ handlerName: 'onKey', rules: [] });
    expect(data.callbacks.reshape).toEqual({ handlerName: 'onResize', resize: 'stretch' });
    expect(data.callbacks.special).toEqual({ handlerName: '', rules: [] });
  });
});

describe('BB-PERSIST-06: A schema 9 round trip keeps rules and the reshape choice', () => {
  it('saves and loads rules', () => {
    const t = addTriangle();
    getState().setCallbackHandler('special', 'onSpecial');
    getState().addCallbackRule('special', {
      id: 'r1', objectId: t.id, trigger: { kind: 'special', key: 'right' }, action: { type: 'translate', dx: 0.1, dy: 0 },
    });
    getState().setCallbackHandler('reshape', 'onReshape');
    getState().setReshapeMode('stretch');
    const file = JSON.parse(JSON.stringify(buildProjectFile(getState() as never)));
    expect(file.schemaVersion).toBe(9);
    const data = sanitizeProjectData(file.data);
    expect(data.callbacks.special.rules).toEqual(getState().callbacks.special.rules);
    expect(data.callbacks.reshape).toEqual({ handlerName: 'onReshape', resize: 'stretch' });
  });
});

describe('BB-PERSIST-07: Loading drops broken rules and clamps values', () => {
  it('drops rules for missing objects or bad triggers, clamps, and keeps at most 8', () => {
    const objects = [{ id: 'o1', name: 'T', type: 'TRIANGLES', visible: true, vertices: [], transform: {} }];
    const ok = (i: number) => ({ id: `r${i}`, objectId: 'o1', trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'translate', dx: 99, dy: -99 } });
    const data = sanitizeProjectData({
      objects,
      callbacks: {
        keyboard: {
          handlerName: 'onKey',
          rules: [
            { id: 'gone', objectId: 'missing', trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'reset' } },
            { id: 'bad', objectId: 'o1', trigger: { kind: 'keyboard', key: '%' }, action: { type: 'reset' } },
            { id: 'ptr', objectId: 'o1', trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'moveToPointer' } },
            ...Array.from({ length: 10 }, (_, i) => ok(i)),
          ],
        },
      },
    });
    const rules = data.callbacks.keyboard.rules;
    expect(rules).toHaveLength(8);
    expect(rules[0].action).toEqual({ type: 'translate', dx: 10, dy: -10 });
  });
});
```

`sanitizeObject` must accept the minimal object in BB-PERSIST-07. If it rejects it, build the object with `addTriangle()` and `buildProjectFile`, as BB-PERSIST-06 does, and keep the assertions.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/callbacks.test.ts tests/white-box/persistence-manager.test.ts tests/black-box/project-persistence.test.ts`
Expected: FAIL. `@/core/callbacks/callbacks-model` and `@/core/store/persist-migrate` cannot be resolved.

- [ ] **Step 3: Add the types**

In `src/core/types/scene.ts`, replace the `GlutCallbackKind` and `CallbackRegistration` declarations with:

```ts
export type GlutCallbackKind =
  | 'keyboard'
  | 'special'
  | 'mouse'
  | 'motion'
  | 'reshape'
  | 'idle';
/** The callbacks that hold rules. Reshape holds a resize choice instead. */
export type RuleCallbackKind = Exclude<GlutCallbackKind, 'reshape'>;
export interface CallbackRegistration {
  kind: GlutCallbackKind;
  handlerName: string;
}
export type SpecialKey = 'up' | 'down' | 'left' | 'right';
export type MouseButton = 'left' | 'middle' | 'right';
export type MouseState = 'down' | 'up';
export type RuleTrigger =
  | { kind: 'keyboard'; key: string } // a–z, 0–9 or ' '; letters stored lower case
  | { kind: 'special'; key: SpecialKey }
  | { kind: 'mouse'; button: MouseButton; state: MouseState }
  | { kind: 'motion' }
  | { kind: 'idle' };
export type RuleAction =
  | { type: 'translate'; dx: number; dy: number }
  | { type: 'rotate'; degrees: number }
  | { type: 'scale'; sx: number; sy: number }
  | { type: 'moveToPointer' }
  | { type: 'reset' }
  | { type: 'setColor'; color: string }
  | { type: 'visibility'; mode: 'show' | 'hide' | 'toggle' };
export type RuleActionType = RuleAction['type'];
export interface CallbackRule {
  id: string;
  objectId: string;
  trigger: RuleTrigger;
  action: RuleAction;
}
export type ResizeMode = 'keep' | 'stretch';
export interface RuleCallback {
  handlerName: string;
  rules: CallbackRule[];
}
export interface ReshapeCallback {
  handlerName: string;
  resize: ResizeMode;
}
export interface CallbacksState {
  keyboard: RuleCallback;
  special: RuleCallback;
  mouse: RuleCallback;
  motion: RuleCallback;
  reshape: ReshapeCallback;
  idle: RuleCallback;
}
```

- [ ] **Step 4: Move the C++ keywords into core**

Create `src/core/callbacks/cpp-keywords.ts` with the exact keyword list now in `src/features/code-generation/model/generator/utils.ts` (`CPP_RESERVED`):

```ts
/** C++ keywords. A generated identifier or a handler name must never be one. */
export const CPP_KEYWORDS: ReadonlySet<string> = new Set([
  // the full list moved verbatim from generator/utils.ts CPP_RESERVED
]);
```

In `utils.ts`, delete `CPP_RESERVED`, add `import { CPP_KEYWORDS } from '@/core/callbacks/cpp-keywords';`, and change `CPP_RESERVED.has(sanitized)` to `CPP_KEYWORDS.has(sanitized)`.

- [ ] **Step 5: Write the callbacks model**

Create `src/core/callbacks/callbacks-model.ts`:

```ts
import type {
  CallbackRule, CallbacksState, GlutCallbackKind, MouseButton, MouseState,
  RuleAction, RuleActionType, RuleCallback, RuleCallbackKind, RuleTrigger, SceneNode, SpecialKey,
} from '@/core/types/scene';
import { CPP_KEYWORDS } from './cpp-keywords';

/** Table order: the panel, the generated handlers and main()'s registrations all follow it. */
export const CALLBACK_KINDS: readonly GlutCallbackKind[] = ['keyboard', 'special', 'mouse', 'motion', 'reshape', 'idle'];
export const RULE_KINDS: readonly RuleCallbackKind[] = ['keyboard', 'special', 'mouse', 'motion', 'idle'];
export const MAX_RULES = 8;
export const KEYBOARD_KEYS: readonly string[] = [...'abcdefghijklmnopqrstuvwxyz0123456789', ' '];
export const SPECIAL_KEYS: readonly SpecialKey[] = ['up', 'down', 'left', 'right'];
export const MOUSE_BUTTONS: readonly MouseButton[] = ['left', 'middle', 'right'];
export const MOUSE_STATES: readonly MouseState[] = ['down', 'up'];

export function emptyCallbacks(): CallbacksState {
  const ruleCallback = (): RuleCallback => ({ handlerName: '', rules: [] });
  return {
    keyboard: ruleCallback(),
    special: ruleCallback(),
    mouse: ruleCallback(),
    motion: ruleCallback(),
    reshape: { handlerName: '', resize: 'keep' },
    idle: ruleCallback(),
  };
}

export function newRuleId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try { return crypto.randomUUID(); } catch { /* fall through */ }
  }
  return 'rule-' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED_NAMES: ReadonlySet<string> = new Set([
  'main', 'init', 'display', 'draw', 'update_buffers', 'windowToWorld', '_vams_idle',
]);
const RESERVED_PREFIXES = ['draw_', 'animate_', 'state_', 'initial_'];

/** A C++ identifier that the generated program does not already use. */
export function isValidHandlerName(name: string): boolean {
  const n = name.trim();
  if (!IDENTIFIER.test(n)) return false;
  if (RESERVED_NAMES.has(n) || CPP_KEYWORDS.has(n)) return false;
  return !RESERVED_PREFIXES.some((prefix) => n.startsWith(prefix));
}

export const isRegistered = (cb: { handlerName: string }): boolean => cb.handlerName.trim().length > 0;

/** Valid, and not already taken by an earlier callback in table order. */
export function isCallbackValid(callbacks: CallbacksState, kind: GlutCallbackKind): boolean {
  const name = callbacks[kind].handlerName.trim();
  if (!isValidHandlerName(name)) return false;
  const index = CALLBACK_KINDS.indexOf(kind);
  return !CALLBACK_KINDS.slice(0, index).some((k) => callbacks[k].handlerName.trim() === name);
}

export function hasCallbackContent(callbacks: CallbacksState): boolean {
  return CALLBACK_KINDS.some((k) => isRegistered(callbacks[k]))
    || RULE_KINDS.some((k) => callbacks[k].rules.length > 0);
}

export const actionAllowed = (kind: RuleCallbackKind, type: RuleActionType): boolean =>
  type !== 'moveToPointer' || kind === 'mouse' || kind === 'motion';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const toDecimals = (v: number, decimals: number) => Number(v.toFixed(decimals));
const HEX = /^#[0-9a-f]{6}$/i;

export function clampAction(action: RuleAction): RuleAction {
  switch (action.type) {
    case 'translate':
      return { type: 'translate', dx: toDecimals(clamp(action.dx, -10, 10), 2), dy: toDecimals(clamp(action.dy, -10, 10), 2) };
    case 'rotate':
      return { type: 'rotate', degrees: toDecimals(clamp(action.degrees, -360, 360), 0) };
    case 'scale':
      return { type: 'scale', sx: toDecimals(clamp(action.sx, 0.1, 10), 2), sy: toDecimals(clamp(action.sy, 0.1, 10), 2) };
    case 'setColor':
      return { type: 'setColor', color: HEX.test(action.color) ? action.color.toLowerCase() : '#ffffff' };
    default:
      return action;
  }
}

export function withRuleCallback(callbacks: CallbacksState, kind: RuleCallbackKind, next: RuleCallback): CallbacksState {
  return { ...callbacks, [kind]: next } as CallbacksState;
}

/** Drops rules whose object is gone. Returns the same object when nothing changed. */
export function pruneCallbackRules(callbacks: CallbacksState, liveIds: ReadonlySet<string>): CallbacksState {
  let next = callbacks;
  for (const kind of RULE_KINDS) {
    const rules = callbacks[kind].rules.filter((r) => liveIds.has(r.objectId));
    if (rules.length !== callbacks[kind].rules.length) next = withRuleCallback(next, kind, { ...callbacks[kind], rules });
  }
  return next;
}

/** The objects the generated program draws: visible, with every ancestor visible. */
export function programObjects(objects: SceneNode[]): SceneNode[] {
  const byId = new Map(objects.map((o) => [o.id, o]));
  const hidden = (o: SceneNode): boolean => {
    if (!o.visible) return true;
    const parent = o.parentId ? byId.get(o.parentId) : undefined;
    return parent ? hidden(parent) : false;
  };
  return objects.filter((o) => !hidden(o));
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

function sanitizeTrigger(raw: unknown, kind: RuleCallbackKind): RuleTrigger | null {
  if (!isRecord(raw) || raw.kind !== kind) return null;
  switch (kind) {
    case 'keyboard': {
      const key = typeof raw.key === 'string' ? raw.key.toLowerCase() : '';
      return KEYBOARD_KEYS.includes(key) ? { kind, key } : null;
    }
    case 'special':
      return SPECIAL_KEYS.includes(raw.key as SpecialKey) ? { kind, key: raw.key as SpecialKey } : null;
    case 'mouse':
      return MOUSE_BUTTONS.includes(raw.button as MouseButton) && MOUSE_STATES.includes(raw.state as MouseState)
        ? { kind, button: raw.button as MouseButton, state: raw.state as MouseState }
        : null;
    case 'motion':
      return { kind: 'motion' };
    case 'idle':
      return { kind: 'idle' };
  }
}

function sanitizeAction(raw: unknown, kind: RuleCallbackKind): RuleAction | null {
  if (!isRecord(raw)) return null;
  let action: RuleAction;
  switch (raw.type) {
    case 'translate': action = { type: 'translate', dx: num(raw.dx, 0), dy: num(raw.dy, 0) }; break;
    case 'rotate': action = { type: 'rotate', degrees: num(raw.degrees, 0) }; break;
    case 'scale': action = { type: 'scale', sx: num(raw.sx, 1), sy: num(raw.sy, 1) }; break;
    case 'moveToPointer': action = { type: 'moveToPointer' }; break;
    case 'reset': action = { type: 'reset' }; break;
    case 'setColor':
      if (typeof raw.color !== 'string' || !HEX.test(raw.color)) return null;
      action = { type: 'setColor', color: raw.color };
      break;
    case 'visibility':
      if (raw.mode !== 'show' && raw.mode !== 'hide' && raw.mode !== 'toggle') return null;
      action = { type: 'visibility', mode: raw.mode };
      break;
    default:
      return null;
  }
  return actionAllowed(kind, action.type) ? clampAction(action) : null;
}

function sanitizeRule(raw: unknown, kind: RuleCallbackKind, index: number): CallbackRule | null {
  if (!isRecord(raw) || typeof raw.objectId !== 'string') return null;
  const trigger = sanitizeTrigger(raw.trigger, kind);
  const action = sanitizeAction(raw.action, kind);
  if (!trigger || !action) return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : `rule-${kind}-${index}`;
  return { id, objectId: raw.objectId, trigger, action };
}

/**
 * Project files: the schema 9 shape, or schema 8's handler name per kind. Old reshape stubs only
 * set the viewport, which is Stretch. Rules must point at an object in `liveIds`.
 */
export function sanitizeCallbacks(raw: unknown, liveIds: ReadonlySet<string>): CallbacksState {
  const out = emptyCallbacks();
  if (!isRecord(raw)) return out;
  for (const kind of RULE_KINDS) {
    const v = raw[kind];
    if (typeof v === 'string') {
      out[kind] = { handlerName: v, rules: [] };
    } else if (isRecord(v)) {
      const rules = Array.isArray(v.rules)
        ? v.rules
            .map((r, i) => sanitizeRule(r, kind, i))
            .filter((r): r is CallbackRule => r !== null && liveIds.has(r.objectId))
            .slice(0, MAX_RULES)
        : [];
      out[kind] = { handlerName: typeof v.handlerName === 'string' ? v.handlerName : '', rules };
    }
  }
  const reshape = raw.reshape;
  if (typeof reshape === 'string') {
    out.reshape = { handlerName: reshape, resize: 'stretch' };
  } else if (isRecord(reshape)) {
    out.reshape = {
      handlerName: typeof reshape.handlerName === 'string' ? reshape.handlerName : '',
      resize: reshape.resize === 'stretch' ? 'stretch' : 'keep',
    };
  }
  return out;
}

/** Browser storage version 7 kept a handler name per kind. */
export function migrateLegacyCallbacks(raw: unknown): CallbacksState {
  return sanitizeCallbacks(raw, new Set());
}
```

- [ ] **Step 6: Store types, slice, history, migration**

In `src/core/store/types.ts`:
- Import `CallbacksState`, `CallbackRule`, `ResizeMode` and `RuleCallbackKind` from `@/core/types/scene`.
- Add `callbacks: CallbacksState;` to `HistorySnapshot`.
- Set `LessonSlice.callbacksBackup: CallbacksState | null;`.
- Replace `CallbacksSlice` with:

```ts
export interface CallbacksSlice {
  callbacks: CallbacksState;
  setCallbackHandler: (kind: GlutCallbackKind, handlerName: string) => void;
  clearCallback: (kind: GlutCallbackKind) => void;
  addCallbackRule: (kind: RuleCallbackKind, rule: CallbackRule) => void;
  updateCallbackRule: (
    kind: RuleCallbackKind,
    ruleId: string,
    patch: Partial<Pick<CallbackRule, 'objectId' | 'trigger' | 'action'>>,
    recordHistory?: boolean,
  ) => void;
  removeCallbackRule: (kind: RuleCallbackKind, ruleId: string) => void;
  setReshapeMode: (mode: ResizeMode) => void;
  getRegisteredCallbacks: () => CallbackRegistration[];
}
```

Replace `src/core/store/callbacks-slice.ts` with:

```ts
import type { StateCreator } from 'zustand';
import type { VamsState, CallbacksSlice } from '@/core/store/types';
import {
  CALLBACK_KINDS, MAX_RULES, actionAllowed, clampAction, emptyCallbacks, isCallbackValid, withRuleCallback,
} from '@/core/callbacks/callbacks-model';

export const createCallbacksSlice: StateCreator<VamsState, [], [], CallbacksSlice> = (set, get) => ({
  callbacks: emptyCallbacks(),

  setCallbackHandler: (kind, handlerName) => {
    get().pushToHistory();
    set((state) => ({
      callbacks: { ...state.callbacks, [kind]: { ...state.callbacks[kind], handlerName } } as VamsState['callbacks'],
    }));
  },

  // Off removes the callback: its name, its rules and its resize choice.
  clearCallback: (kind) => {
    get().pushToHistory();
    set((state) => ({
      callbacks: { ...state.callbacks, [kind]: emptyCallbacks()[kind] } as VamsState['callbacks'],
    }));
  },

  addCallbackRule: (kind, rule) => {
    const current = get().callbacks[kind];
    if (current.rules.length >= MAX_RULES) return;
    if (rule.trigger.kind !== kind || !actionAllowed(kind, rule.action.type)) return;
    get().pushToHistory();
    set((state) => ({
      callbacks: withRuleCallback(state.callbacks, kind, {
        ...state.callbacks[kind],
        rules: [...state.callbacks[kind].rules, { ...rule, action: clampAction(rule.action) }],
      }),
    }));
  },

  updateCallbackRule: (kind, ruleId, patch, recordHistory = true) => {
    const existing = get().callbacks[kind].rules.find((r) => r.id === ruleId);
    if (!existing) return;
    const next = { ...existing, ...patch };
    if (next.trigger.kind !== kind || !actionAllowed(kind, next.action.type)) return;
    if (recordHistory) get().pushToHistory();
    set((state) => ({
      callbacks: withRuleCallback(state.callbacks, kind, {
        ...state.callbacks[kind],
        rules: state.callbacks[kind].rules.map((r) => (r.id === ruleId ? { ...next, action: clampAction(next.action) } : r)),
      }),
    }));
  },

  removeCallbackRule: (kind, ruleId) => {
    if (!get().callbacks[kind].rules.some((r) => r.id === ruleId)) return;
    get().pushToHistory();
    set((state) => ({
      callbacks: withRuleCallback(state.callbacks, kind, {
        ...state.callbacks[kind],
        rules: state.callbacks[kind].rules.filter((r) => r.id !== ruleId),
      }),
    }));
  },

  setReshapeMode: (mode) => {
    if (get().callbacks.reshape.resize === mode) return;
    get().pushToHistory();
    set((state) => ({ callbacks: { ...state.callbacks, reshape: { ...state.callbacks.reshape, resize: mode } } }));
  },

  getRegisteredCallbacks: () => {
    const cb = get().callbacks;
    return CALLBACK_KINDS
      .filter((k) => isCallbackValid(cb, k))
      .map((k) => ({ kind: k, handlerName: cb[k].handlerName.trim() }));
  },
});
```

In `src/core/store/history-slice.ts`, add `callbacks: state.callbacks,` to `createSnapshot` and to the inline snapshot in `pushToHistory`, and `callbacks: snapshot.callbacks,` to `restoreSnapshot`.

Create `src/core/store/persist-migrate.ts`:

```ts
import { migrateLegacyCallbacks } from '@/core/callbacks/callbacks-model';

/**
 * Persisted store migrations. Version 7 kept a handler name per callback kind; version 8
 * keeps each callback's rules too. Saves older than version 7 were always discarded, and
 * still are: they start from a blank editor.
 */
export function migratePersistedState(persisted: unknown, version: number): unknown {
  if (version < 7) return {};
  if (!persisted || typeof persisted !== 'object') return persisted;
  const state = { ...(persisted as Record<string, unknown>) };
  if (version < 8) {
    state.callbacks = migrateLegacyCallbacks(state.callbacks);
    state.callbacksBackup = state.callbacksBackup == null ? null : migrateLegacyCallbacks(state.callbacksBackup);
  }
  return state;
}
```

In `src/core/store/index.ts`, import `migratePersistedState` and change the persist options to `version: 8,` plus `migrate: (persisted, version) => migratePersistedState(persisted, version) as never,`.

In `src/core/store/lesson-slice.ts`, delete `EMPTY_CALLBACKS`, import `emptyCallbacks`, and use `emptyCallbacks()` at both sites.

- [ ] **Step 7: Prune rules on delete**

In `src/entities/scene/model/scene-slice.ts`, import `pruneCallbackRules` from `@/core/callbacks/callbacks-model`. In both `deleteObject` and `deleteGroup`, add this to the returned patch:

```ts
callbacks: pruneCallbackRules(state.callbacks, new Set(updatedObjects.map((o) => o.id))),
```

- [ ] **Step 8: Project files and the empty-scene check**

In `src/entities/project/model/project-io.ts`:
- Change the version comment and constant to:

```ts
// v9 replaces the handler name per callback kind with callbacks that hold rules, adds the Special
// keys callback and the reshape choice. v8 files load with their names kept and no rules.
export const VAMS_PROJECT_SCHEMA_VERSION = 9;
```

- Type `callbacks: CallbacksState` in `VamsProjectData`.
- Delete `CALLBACK_KINDS`, `DEFAULT_CALLBACKS` and the local `sanitizeCallbacks`.
- Use `callbacks: emptyCallbacks()` in `DEFAULT_DATA`.
- In `sanitizeProjectData`, write `callbacks: sanitizeCallbacks(raw.callbacks, new Set(objects.map((o) => o.id))),`, importing `emptyCallbacks` and `sanitizeCallbacks` from `@/core/callbacks/callbacks-model`.

In `src/entities/project/model/scene-empty.ts`, replace the `Object.values(state.callbacks).every(...)` line with `!hasCallbackContent(state.callbacks) &&`.

- [ ] **Step 9: Move the remaining call sites to the new shape**

- `useNewWorkspace.ts`, `useLessonRunner.ts` (the replay reset) and `demo-code.ts` (`NO_CALLBACKS`) use `emptyCallbacks()`.
- In `generate-from-state.ts`, type `callbacks: CallbacksState`. Until Task 2 replaces it, `getRegisteredCallbacks` keeps today's five kinds and output:

```ts
const LEGACY_KINDS: GlutCallbackKind[] = ['keyboard', 'mouse', 'reshape', 'motion', 'idle'];
function getRegisteredCallbacks(callbacks: CallbacksState): RegisteredCallback[] {
  return LEGACY_KINDS
    .filter((k) => callbacks[k].handlerName.trim().length > 0)
    .map((k) => ({ kind: k, handlerName: callbacks[k].handlerName.trim() }));
}
```

- In `CallbacksPanel.tsx`: `const value = callbacks[def.kind].handlerName;`. The `CALLBACKS` array stays five entries until Task 3.
- In `primitives-lessons.ts`, exercise 5's `successCheck` becomes `const name = state.callbacks.mouse.handlerName.trim();`.

- [ ] **Step 10: Update tests that used the old shape**

Replace every literal `{ keyboard: '', mouse: '', reshape: '', motion: '', idle: '' }` with `emptyCallbacks()`:
- `tests/setup.ts`
- `tests/black-box/lesson-engine.test.ts`
- `tests/algorithm/algorithm-3-lesson-step.test.ts`
- `tests/black-box/editor-links.test.ts` (`NO_CALLBACKS`)

Then:
- `tests/white-box/persistence-manager.test.ts` WB-PERSIST-02: `expect(sanitized.callbacks).toEqual(emptyCallbacks());`.
- `tests/black-box/project-persistence.test.ts` BB-PERSIST-01: `expect(getState().callbacks.mouse.handlerName).toBe('onClick');`.
- `tests/white-box/lesson-engine-internals.test.ts`: `callbacksBackup?.keyboard.handlerName` and `callbacks.keyboard.handlerName`.
- `tests/algorithm/algorithm-2-code-generation.test.ts` (lines 94–99): read `callbacks.keyboard.handlerName` and so on.
- `tests/black-box/scene-library.test.ts`: `{ ...blank.callbacks, idle: { handlerName: 'x', rules: [] } }`.

Keep every test id and intent.

- [ ] **Step 11: Run the checks**

Run: `npm run lint && npm run build && npm test`
Expected: all pass, including BB-CB-13/14/15, WB-PERSIST-06 and BB-PERSIST-05/06/07. The generated programs are unchanged.

- [ ] **Step 12: Commit**

```bash
git checkout -- tests/reports
git add src/core/types/scene.ts src/core/callbacks src/core/store src/entities src/features/code-generation/model/generator/utils.ts src/features/code-generation/model/generate-from-state.ts src/features/workspace-reset/model/useNewWorkspace.ts src/features/lesson-engine/model/useLessonRunner.ts src/features/lesson-engine/model/primitives-lessons.ts src/pages/home/model/demo-code.ts src/features/callbacks/ui/CallbacksPanel.tsx tests/setup.ts tests/black-box tests/white-box tests/algorithm
git diff --staged --stat
git commit -m "feat(callbacks): store rules per callback, with migration and undo"
```

---

### Task 2: Generated handler bodies

**Files:**
- Create: `tests/fixtures/no-callbacks-program.cpp` (captured **before** any generator change)
- Create: `src/features/code-generation/model/generator/handlers.ts`, `src/features/code-generation/model/locate-branch.ts`
- Modify: `src/features/code-generation/model/generator/state.ts`, `render.ts`, `buffers.ts`
- Modify: `src/features/code-generation/model/code-generator.ts`, `generate-from-state.ts`
- Test: `tests/black-box/callbacks.test.ts` (BB-CB-1 to 12, 13b, 16), `tests/black-box/code-generation.test.ts` (BB-GEN-09 gets six kinds)

**Interfaces:**
- Consumes: `CallbacksState`, `isCallbackValid`, `CALLBACK_KINDS` and `RULE_KINDS` from Task 1.
- Produces (`generator/handlers.ts`):
  - `interface CallbackPlan { registered; rules; resize; colorIds; visibilityIds; resetIds; needsPointer; needsView; extendedState; names }`;
  - `planCallbacks(callbacks: CallbacksState, programObjects: SceneNode[]): CallbackPlan`;
  - `actionLines(action: RuleAction, name: string, indent: string): string[]`;
  - `generateHandlers(plan, limits): string`, `generateRegistrations(plan): string`, `generateViewGlobals(plan, limits): string`, `generateWindowToWorld(plan): string`;
  - constants `GLUT_FUNCS`, `SPECIAL_LABELS`, `BUTTON_LABELS`, `STATE_LABELS`.
- Produces (`locate-branch.ts`): `locateHandlerBranch(code: string, handlerName: string, trigger: RuleTrigger | null): number[]` (0-based line numbers).
- Produces (`render.ts`): `interface DrawEffects { colorIds: ReadonlySet<string>; visibilityIds: ReadonlySet<string> }`, `NO_EFFECTS`.

- [ ] **Step 1: Capture the no-callbacks fixture with today's generator**

Add to `tests/black-box/callbacks.test.ts`:

```ts
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { addPrimitive } from '../helpers/store';

const CANVAS = { width: 800, height: 600 };
const gen = () => {
  const s = getState();
  return generateCodeFromState(
    { objects: s.objects, canvasBackgroundColor: s.canvasBackgroundColor, callbacks: s.callbacks, viewportLimits: s.viewportLimits },
    CANVAS,
  );
};
const FIXTURE = resolve(__dirname, '../fixtures/no-callbacks-program.cpp');

/** Immediate, vertex-array and VBO objects, a stippled line, text, a group and an animation. */
function buildRichScene() {
  const tri = addTriangle(0.1, 0.0, 0.2);
  const quad = addQuad(-0.4, 0.2, 0.15);
  getState().updateRenderingMode(quad.id, 'VBO');
  const fan = addPrimitive('TRIANGLE_FAN', [{ x: 0.5, y: 0.5 }, { x: 0.7, y: 0.5 }, { x: 0.6, y: 0.7 }]);
  getState().updateRenderingMode(fan.id, 'VERTEX_ARRAY');
  const line = addPrimitive('LINE_STRIP', [{ x: -0.8, y: -0.8 }, { x: -0.5, y: -0.6 }]);
  getState().updateLineStipple(line.id, { factor: 2, pattern: 0x00ff });
  getState().addTextObject('Hi', -0.2, -0.5);
  getState().createGroup([tri.id, fan.id]);
  getState().setObjectAnimation(quad.id, { motion: 'pulse', speed: 1 });
  return { tri, quad, fan, line };
}

describe('BB-CB-12: A scene with no callbacks generates the same program as before', () => {
  it('matches the stored fixture', () => {
    buildRichScene();
    const code = gen();
    if (process.env.WRITE_CALLBACK_FIXTURE === '1' || !existsSync(FIXTURE)) writeFileSync(FIXTURE, code);
    expect(code).toBe(readFileSync(FIXTURE, 'utf8').replace(/\r\n/g, '\n'));
  });
});
```

Run `npx vitest run tests/black-box/callbacks.test.ts -t "BB-CB-12"` on the Task 1 code.
Expected: PASS. The fixture file is written.

Check that `tests/fixtures/no-callbacks-program.cpp` contains `glOrtho(-1.0000`, `animate_` and `glutMainLoop`. Commit it alone:

```bash
git add tests/fixtures/no-callbacks-program.cpp tests/black-box/callbacks.test.ts
git commit -m "test(callbacks): pin the program generated without callbacks"
```

- [ ] **Step 2: Write the failing generator tests**

Append to `tests/black-box/callbacks.test.ts`:

```ts
import { locateHandlerBranch } from '@/features/code-generation/model/locate-branch';

const add = (kind: Parameters<ReturnType<typeof getState>['addCallbackRule']>[0], r: CallbackRule) =>
  getState().addCallbackRule(kind, r);
const body = (code: string, name: string) => {
  const lines = code.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`void ${name}(`));
  const end = lines.indexOf('}', start);
  return lines.slice(start, end + 1).join('\n');
};

describe('BB-CB-1: Each registered callback is emitted and registered in table order', () => {
  it('emits six handlers with their signatures and registrations', () => {
    addTriangle();
    const names = { keyboard: 'onKey', special: 'onSpecial', mouse: 'onMouse', motion: 'onMotion', reshape: 'onReshape', idle: 'onIdle' } as const;
    (Object.keys(names) as (keyof typeof names)[]).forEach((k) => getState().setCallbackHandler(k, names[k]));
    const code = gen();
    expect(code).toContain('void onKey(unsigned char key, int x, int y)');
    expect(code).toContain('void onSpecial(int key, int x, int y)');
    expect(code).toContain('void onMouse(int button, int state, int x, int y)');
    expect(code).toContain('void onMotion(int x, int y)');
    expect(code).toContain('void onReshape(int width, int height)');
    expect(code).toContain('void onIdle()');
    const regs = code.split('\n').filter((l) => /^ {4}glut(Keyboard|Special|Mouse|Motion|Reshape)Func\(/.test(l)).map((l) => l.trim());
    expect(regs).toEqual([
      'glutKeyboardFunc(onKey);', 'glutSpecialFunc(onSpecial);', 'glutMouseFunc(onMouse);',
      'glutMotionFunc(onMotion);', 'glutReshapeFunc(onReshape);',
    ]);
    expect(code).toContain('    glutIdleFunc(_vams_idle);');
    expect(code).toContain('// Special keys callback: glutSpecialFunc');
  });
});

describe('BB-CB-2: A callback with no rules says so', () => {
  it('generates the "No rules yet" body', () => {
    getState().setCallbackHandler('keyboard', 'onKey');
    expect(body(gen(), 'onKey')).toBe([
      'void onKey(unsigned char key, int x, int y)', '{',
      '    // No rules yet: add them in the Callbacks group', '    glutPostRedisplay();', '}',
    ].join('\n'));
  });
});

describe('BB-CB-3 / BB-CB-4: Keyboard rules become cases, grouped by key in order', () => {
  it('emits both letter cases, a Space case, and one branch per key', () => {
    const t = addTriangle();
    getState().updateObjectName(t.id, 'Tri');
    getState().setCallbackHandler('keyboard', 'onKey');
    add('keyboard', { id: 'a', objectId: t.id, trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'translate', dx: 0.1, dy: 0 } });
    add('keyboard', { id: 'b', objectId: t.id, trigger: { kind: 'keyboard', key: ' ' }, action: { type: 'rotate', degrees: 15 } });
    add('keyboard', { id: 'c', objectId: t.id, trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'rotate', degrees: 5 } });
    expect(body(gen(), 'onKey')).toBe([
      'void onKey(unsigned char key, int x, int y)', '{',
      '    switch (key) {',
      "    case 'd':", "    case 'D':",
      '        state_Tri.x += 0.10f;', '        state_Tri.y += 0.00f;', '        state_Tri.rotation += 5.00f;',
      '        break;',
      "    case ' ':",
      '        state_Tri.rotation += 15.00f;',
      '        break;',
      '    }',
      '    glutPostRedisplay();', '}',
    ].join('\n'));
  });
});

describe('BB-CB-5: Special keys rules use GLUT_KEY_* cases', () => {
  it('emits case GLUT_KEY_RIGHT', () => {
    const t = addTriangle();
    getState().updateObjectName(t.id, 'Tri');
    getState().setCallbackHandler('special', 'onSpecial');
    add('special', { id: 's', objectId: t.id, trigger: { kind: 'special', key: 'right' }, action: { type: 'translate', dx: 0.1, dy: 0 } });
    expect(body(gen(), 'onSpecial')).toContain('    case GLUT_KEY_RIGHT:\n        state_Tri.x += 0.10f;');
  });
});

describe('BB-CB-6: Mouse rules and Move to pointer', () => {
  it('emits the button/state branch, windowToWorld, the view globals and glOrtho from them', () => {
    const q = addQuad();
    getState().updateObjectName(q.id, 'Square');
    getState().setCallbackHandler('mouse', 'onMouse');
    add('mouse', { id: 'm', objectId: q.id, trigger: { kind: 'mouse', button: 'left', state: 'down' }, action: { type: 'moveToPointer' } });
    const code = gen();
    expect(body(code, 'onMouse')).toBe([
      'void onMouse(int button, int state, int x, int y)', '{',
      '    if (button == GLUT_LEFT_BUTTON && state == GLUT_DOWN) {',
      '        float wx, wy;', '        windowToWorld(x, y, &wx, &wy);',
      '        state_Square.x = wx;', '        state_Square.y = wy;',
      '    }',
      '    glutPostRedisplay();', '}',
    ].join('\n'));
    expect(code).toContain('float viewMinX = -1.0000f, viewMaxX = 1.0000f, viewMinY = -1.0000f, viewMaxY = 1.0000f;');
    expect(code).toContain('    glOrtho(viewMinX, viewMaxX, viewMinY, viewMaxY, -1.0, 1.0);');
    expect(code).toContain('void windowToWorld(int x, int y, float* wx, float* wy)');
    expect(code.indexOf('void windowToWorld(')).toBeLessThan(code.indexOf('void onMouse('));
  });
});

describe('BB-CB-7: Each action generates its lines', () => {
  it('matches the spec table', async () => {
    const { actionLines } = await import('@/features/code-generation/model/generator/handlers');
    expect(actionLines({ type: 'translate', dx: -0.1, dy: 0.25 }, 'T', '')).toEqual(['state_T.x += -0.10f;', 'state_T.y += 0.25f;']);
    expect(actionLines({ type: 'rotate', degrees: 15 }, 'T', '')).toEqual(['state_T.rotation += 15.00f;']);
    expect(actionLines({ type: 'scale', sx: 1.1, sy: 0.9 }, 'T', '')).toEqual(['state_T.scaleX *= 1.10f;', 'state_T.scaleY *= 0.90f;']);
    expect(actionLines({ type: 'moveToPointer' }, 'T', '')).toEqual(['state_T.x = wx;', 'state_T.y = wy;']);
    expect(actionLines({ type: 'reset' }, 'T', '')).toEqual(['state_T = initial_T;']);
    expect(actionLines({ type: 'setColor', color: '#ff8000' }, 'T', '')).toEqual([
      'state_T.r = 1.00f;', 'state_T.g = 0.50f;', 'state_T.b = 0.00f;', 'state_T.useColor = true;',
    ]);
    expect(actionLines({ type: 'visibility', mode: 'show' }, 'T', '')).toEqual(['state_T.visible = true;']);
    expect(actionLines({ type: 'visibility', mode: 'hide' }, 'T', '')).toEqual(['state_T.visible = false;']);
    expect(actionLines({ type: 'visibility', mode: 'toggle' }, 'T', '')).toEqual(['state_T.visible = !state_T.visible;']);
  });
});

describe('BB-CB-8: Colour or visibility rules extend ObjectState', () => {
  it('adds the fields and initializers only when needed', () => {
    const t = addTriangle();
    getState().updateObjectName(t.id, 'Tri');
    expect(gen()).not.toContain('bool visible;');
    getState().setCallbackHandler('keyboard', 'onKey');
    add('keyboard', { id: 'v', objectId: t.id, trigger: { kind: 'keyboard', key: 'h' }, action: { type: 'visibility', mode: 'toggle' } });
    const code = gen();
    expect(code).toContain('    float r, g, b;\n    bool useColor;\n    bool visible;\n};');
    expect(code).toMatch(/ObjectState state_Tri = \{ [^}]*, 0\.0f, 0\.0f, 0\.0f, false, true \};/);
  });
});

describe('BB-CB-9: Visibility wraps the draw call; colour guards the colour lines', () => {
  it('guards immediate-mode colours and the VBO colour array', () => {
    const t = addTriangle();
    getState().updateObjectName(t.id, 'Tri');
    const q = addQuad();
    getState().updateObjectName(q.id, 'Box');
    getState().updateRenderingMode(q.id, 'VBO');
    getState().setCallbackHandler('keyboard', 'onKey');
    add('keyboard', { id: 'c1', objectId: t.id, trigger: { kind: 'keyboard', key: 'c' }, action: { type: 'setColor', color: '#ff0000' } });
    add('keyboard', { id: 'c2', objectId: q.id, trigger: { kind: 'keyboard', key: 'c' }, action: { type: 'setColor', color: '#00ff00' } });
    add('keyboard', { id: 'v', objectId: t.id, trigger: { kind: 'keyboard', key: 'h' }, action: { type: 'visibility', mode: 'hide' } });
    const code = gen();
    expect(code).toContain('    if (state_Tri.visible) draw_Tri();');
    expect(code).toMatch(/ {8}if \(!state_Tri\.useColor\) glColor3f\(/);
    expect(code).toContain('    if (state_Tri.useColor) glColor3f(state_Tri.r, state_Tri.g, state_Tri.b);\n    glBegin(');
    expect(code).toContain('    if (state_Box.useColor) glColor3f(state_Box.r, state_Box.g, state_Box.b);\n    else glEnableClientState(GL_COLOR_ARRAY);');
  });
});

describe('BB-CB-10: Reset adds initial_<name>', () => {
  it('declares the initial state and assigns it', () => {
    const t = addTriangle();
    getState().updateObjectName(t.id, 'Tri');
    getState().setCallbackHandler('keyboard', 'onKey');
    add('keyboard', { id: 'r', objectId: t.id, trigger: { kind: 'keyboard', key: 'r' }, action: { type: 'reset' } });
    const code = gen();
    expect(code).toMatch(/const ObjectState initial_Tri = \{ /);
    expect(code).toContain('        state_Tri = initial_Tri;');
  });
});

describe('BB-CB-11: Reshape bodies', () => {
  it('Stretch sets the viewport only', () => {
    getState().setCallbackHandler('reshape', 'onReshape');
    getState().setReshapeMode('stretch');
    expect(body(gen(), 'onReshape')).toBe([
      'void onReshape(int width, int height)', '{',
      '    // Stretch: the viewing volume fills the window, whatever its shape',
      '    glViewport(0, 0, width, height);', '    glutPostRedisplay();', '}',
    ].join('\n'));
  });

  it('Keep proportions recomputes the view from the saved viewing volume', () => {
    useVamsStore.setState({ viewportLimits: { minX: -2, maxX: 2, minY: -1, maxY: 1 } });
    getState().setCallbackHandler('reshape', 'onReshape');
    const code = gen();
    expect(body(code, 'onReshape')).toBe([
      'void onReshape(int width, int height)', '{',
      "    // Keep proportions: widen the viewing volume to match the window's shape",
      '    glViewport(0, 0, width, height);',
      '    float aspect = (float)width / (float)(height > 0 ? height : 1);',
      '    float cx = 0.0000f, cy = 0.0000f;',
      '    float halfW = 2.0000f, halfH = 1.0000f;',
      '    if (aspect >= halfW / halfH) halfW = halfH * aspect;',
      '    else halfH = halfW / aspect;',
      '    viewMinX = cx - halfW;', '    viewMaxX = cx + halfW;',
      '    viewMinY = cy - halfH;', '    viewMaxY = cy + halfH;',
      '    glutPostRedisplay();', '}',
    ].join('\n'));
    expect(code).toContain('float viewMinX = -2.0000f, viewMaxX = 2.0000f, viewMinY = -1.0000f, viewMaxY = 1.0000f;');
  });
});

describe('BB-CB-13b: Invalid, reserved or duplicate names are left out of the code', () => {
  it('omits the handler and its registration', () => {
    getState().setCallbackHandler('keyboard', 'display');
    getState().setCallbackHandler('motion', 'onInput');
    getState().setCallbackHandler('reshape', 'onInput');
    const code = gen();
    expect(code).not.toContain('glutKeyboardFunc');
    expect(code).toContain('glutMotionFunc(onInput);');
    expect(code).not.toContain('glutReshapeFunc');
  });

  it('leaves out rules whose target is hidden in the editor', () => {
    const t = addTriangle();
    getState().updateObjectName(t.id, 'Tri');
    getState().setCallbackHandler('keyboard', 'onKey');
    add('keyboard', { id: 'a', objectId: t.id, trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'translate', dx: 0.1, dy: 0 } });
    getState().toggleObjectVisibility(t.id);
    expect(body(gen(), 'onKey')).toContain('// No rules yet');
  });
});

describe('BB-CB-16: locateHandlerBranch finds the lines that ran', () => {
  it('finds a key case, a special case, a mouse branch, and whole handlers', () => {
    const t = addTriangle();
    getState().updateObjectName(t.id, 'Tri');
    getState().setCallbackHandler('keyboard', 'onKey');
    getState().setCallbackHandler('special', 'onSpecial');
    getState().setCallbackHandler('mouse', 'onMouse');
    getState().setCallbackHandler('motion', 'onMotion');
    getState().setCallbackHandler('reshape', 'onReshape');
    add('keyboard', { id: 'k', objectId: t.id, trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'rotate', degrees: 15 } });
    add('special', { id: 's', objectId: t.id, trigger: { kind: 'special', key: 'up' }, action: { type: 'rotate', degrees: 15 } });
    add('mouse', { id: 'm', objectId: t.id, trigger: { kind: 'mouse', button: 'right', state: 'up' }, action: { type: 'reset' } });
    const code = gen();
    const lines = code.split('\n');
    const pick = (nums: number[]) => nums.map((n) => lines[n]);
    expect(pick(locateHandlerBranch(code, 'onKey', { kind: 'keyboard', key: 'd' }))).toEqual([
      "    case 'd':", "    case 'D':", '        state_Tri.rotation += 15.00f;', '        break;',
    ]);
    expect(pick(locateHandlerBranch(code, 'onSpecial', { kind: 'special', key: 'up' }))[0]).toBe('    case GLUT_KEY_UP:');
    expect(pick(locateHandlerBranch(code, 'onMouse', { kind: 'mouse', button: 'right', state: 'up' }))).toEqual([
      '    if (button == GLUT_RIGHT_BUTTON && state == GLUT_UP) {', '        state_Tri = initial_Tri;', '    }',
    ]);
    const motion = pick(locateHandlerBranch(code, 'onMotion', { kind: 'motion' }));
    expect(motion[0]).toBe('void onMotion(int x, int y)');
    expect(motion.at(-1)).toBe('}');
    expect(pick(locateHandlerBranch(code, 'onReshape', null))[0]).toBe('void onReshape(int width, int height)');
    expect(locateHandlerBranch(code, 'nothing', null)).toEqual([]);
  });
});
```

In `tests/black-box/code-generation.test.ts` BB-GEN-09, add `{ kind: 'special', funcCall: 'glutSpecialFunc' },` after the keyboard entry, and rename the describe to `'BB-GEN-09: Registered GLUT callbacks emit handlers AND glutXxxFunc()'`.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/callbacks.test.ts tests/black-box/code-generation.test.ts`
Expected: BB-CB-1 to 11, 13b and 16 FAIL, as does BB-GEN-09's special row. BB-CB-12 passes.

- [ ] **Step 4: Write `generator/handlers.ts`**

```ts
import type {
  CallbackRule, CallbacksState, GlutCallbackKind, MouseButton, MouseState, ResizeMode,
  RuleAction, RuleCallbackKind, RuleTrigger, SceneNode, SpecialKey, ViewportLimits,
} from '@/core/types/scene';
import { CALLBACK_KINDS, RULE_KINDS, isCallbackValid } from '@/core/callbacks/callbacks-model';
import { sanitizeName } from './utils';

/**
 * GLUT callback generation from the rules students build in the Callbacks group. Each rule
 * becomes plain lines that change the target's `state_<name>`; display() then draws the new
 * state. The Run runtime (features/callbacks) applies the same rules the same way.
 */
export interface CallbackPlan {
  /** Valid registered callbacks, in table order. */
  registered: Array<{ kind: GlutCallbackKind; handlerName: string }>;
  /** Rules per kind whose target is in the program, in list order. */
  rules: Record<RuleCallbackKind, CallbackRule[]>;
  resize: ResizeMode;
  colorIds: ReadonlySet<string>;
  visibilityIds: ReadonlySet<string>;
  resetIds: ReadonlySet<string>;
  needsPointer: boolean;
  needsView: boolean;
  extendedState: boolean;
  /** Object id → sanitized C++ name, for the program's objects. */
  names: ReadonlyMap<string, string>;
}

export const GLUT_FUNCS: Record<GlutCallbackKind, string> = {
  keyboard: 'glutKeyboardFunc', special: 'glutSpecialFunc', mouse: 'glutMouseFunc',
  motion: 'glutMotionFunc', reshape: 'glutReshapeFunc', idle: 'glutIdleFunc',
};
const LABELS: Record<GlutCallbackKind, string> = {
  keyboard: 'Keyboard', special: 'Special keys', mouse: 'Mouse', motion: 'Motion', reshape: 'Reshape', idle: 'Idle',
};
const SIGNATURES: Record<GlutCallbackKind, string> = {
  keyboard: '(unsigned char key, int x, int y)', special: '(int key, int x, int y)',
  mouse: '(int button, int state, int x, int y)', motion: '(int x, int y)',
  reshape: '(int width, int height)', idle: '()',
};
export const SPECIAL_LABELS: Record<SpecialKey, string> = {
  up: 'GLUT_KEY_UP', down: 'GLUT_KEY_DOWN', left: 'GLUT_KEY_LEFT', right: 'GLUT_KEY_RIGHT',
};
export const BUTTON_LABELS: Record<MouseButton, string> = {
  left: 'GLUT_LEFT_BUTTON', middle: 'GLUT_MIDDLE_BUTTON', right: 'GLUT_RIGHT_BUTTON',
};
export const STATE_LABELS: Record<MouseState, string> = { down: 'GLUT_DOWN', up: 'GLUT_UP' };

const DEFAULT_LIMITS: ViewportLimits = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
const f2 = (n: number) => `${n.toFixed(2)}f`;
const f4 = (n: number) => `${n.toFixed(4)}f`;

export function planCallbacks(callbacks: CallbacksState, programObjects: SceneNode[]): CallbackPlan {
  const names = new Map(programObjects.map((o) => [o.id, sanitizeName(o.name)]));
  const registered = CALLBACK_KINDS
    .filter((k) => isCallbackValid(callbacks, k))
    .map((k) => ({ kind: k, handlerName: callbacks[k].handlerName.trim() }));
  const on = new Set(registered.map((r) => r.kind));
  const rules = {} as Record<RuleCallbackKind, CallbackRule[]>;
  for (const k of RULE_KINDS) rules[k] = on.has(k) ? callbacks[k].rules.filter((r) => names.has(r.objectId)) : [];
  const all = RULE_KINDS.flatMap((k) => rules[k]);
  const idsFor = (type: RuleAction['type']) => new Set(all.filter((r) => r.action.type === type).map((r) => r.objectId));
  const colorIds = idsFor('setColor');
  const visibilityIds = idsFor('visibility');
  const resetIds = idsFor('reset');
  const needsPointer = all.some((r) => r.action.type === 'moveToPointer');
  const resize = callbacks.reshape.resize;
  return {
    registered, rules, resize, colorIds, visibilityIds, resetIds, needsPointer,
    needsView: needsPointer || (on.has('reshape') && resize === 'keep'),
    extendedState: colorIds.size > 0 || visibilityIds.size > 0,
    names,
  };
}

export function actionLines(action: RuleAction, name: string, indent: string): string[] {
  const s = `state_${name}`;
  switch (action.type) {
    case 'translate': return [`${indent}${s}.x += ${f2(action.dx)};`, `${indent}${s}.y += ${f2(action.dy)};`];
    case 'rotate': return [`${indent}${s}.rotation += ${f2(action.degrees)};`];
    case 'scale': return [`${indent}${s}.scaleX *= ${f2(action.sx)};`, `${indent}${s}.scaleY *= ${f2(action.sy)};`];
    case 'moveToPointer': return [`${indent}${s}.x = wx;`, `${indent}${s}.y = wy;`];
    case 'reset': return [`${indent}${s} = initial_${name};`];
    case 'setColor': {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(action.color.slice(i, i + 2), 16) / 255);
      return [`${indent}${s}.r = ${f2(r)};`, `${indent}${s}.g = ${f2(g)};`, `${indent}${s}.b = ${f2(b)};`, `${indent}${s}.useColor = true;`];
    }
    case 'visibility': {
      const value = action.mode === 'show' ? 'true' : action.mode === 'hide' ? 'false' : `!${s}.visible`;
      return [`${indent}${s}.visible = ${value};`];
    }
  }
}

const triggerKey = (t: RuleTrigger): string =>
  t.kind === 'keyboard' || t.kind === 'special' ? `${t.kind}:${t.key}`
    : t.kind === 'mouse' ? `mouse:${t.button}:${t.state}` : t.kind;

/** Group rules by trigger, in the order each trigger first appears. */
function groupByTrigger(rules: CallbackRule[]): Array<{ trigger: RuleTrigger; rules: CallbackRule[] }> {
  const groups = new Map<string, { trigger: RuleTrigger; rules: CallbackRule[] }>();
  for (const r of rules) {
    const key = triggerKey(r.trigger);
    const group = groups.get(key) ?? { trigger: r.trigger, rules: [] };
    group.rules.push(r);
    groups.set(key, group);
  }
  return [...groups.values()];
}

const usesPointer = (rules: CallbackRule[]) => rules.some((r) => r.action.type === 'moveToPointer');
const pointerLines = (indent: string) => [`${indent}float wx, wy;`, `${indent}windowToWorld(x, y, &wx, &wy);`];
const keyLabels = (key: string) => (/[a-z]/.test(key) ? [`'${key}'`, `'${key.toUpperCase()}'`] : [`'${key}'`]);

function ruleLines(rules: CallbackRule[], plan: CallbackPlan, indent: string): string[] {
  return rules.flatMap((r) => actionLines(r.action, plan.names.get(r.objectId)!, indent));
}

function reshapeBody(resize: ResizeMode, limits: ViewportLimits): string[] {
  if (resize === 'stretch') {
    return [
      '    // Stretch: the viewing volume fills the window, whatever its shape',
      '    glViewport(0, 0, width, height);',
      '    glutPostRedisplay();',
    ];
  }
  const cx = (limits.minX + limits.maxX) / 2;
  const cy = (limits.minY + limits.maxY) / 2;
  const halfW = (limits.maxX - limits.minX) / 2;
  const halfH = (limits.maxY - limits.minY) / 2;
  return [
    "    // Keep proportions: widen the viewing volume to match the window's shape",
    '    glViewport(0, 0, width, height);',
    '    float aspect = (float)width / (float)(height > 0 ? height : 1);',
    `    float cx = ${f4(cx)}, cy = ${f4(cy)};`,
    `    float halfW = ${f4(halfW)}, halfH = ${f4(halfH)};`,
    '    if (aspect >= halfW / halfH) halfW = halfH * aspect;',
    '    else halfH = halfW / aspect;',
    '    viewMinX = cx - halfW;',
    '    viewMaxX = cx + halfW;',
    '    viewMinY = cy - halfH;',
    '    viewMaxY = cy + halfH;',
    '    glutPostRedisplay();',
  ];
}

function handlerBody(kind: GlutCallbackKind, plan: CallbackPlan, limits: ViewportLimits): string[] {
  if (kind === 'reshape') return reshapeBody(plan.resize, limits);
  const rules = plan.rules[kind];
  if (rules.length === 0) return ['    // No rules yet: add them in the Callbacks group', '    glutPostRedisplay();'];
  const out: string[] = [];
  if (kind === 'keyboard' || kind === 'special') {
    out.push('    switch (key) {');
    for (const group of groupByTrigger(rules)) {
      const t = group.trigger as { kind: 'keyboard'; key: string } | { kind: 'special'; key: SpecialKey };
      const labels = t.kind === 'keyboard' ? keyLabels(t.key) : [SPECIAL_LABELS[t.key]];
      labels.forEach((label) => out.push(`    case ${label}:`));
      out.push(...ruleLines(group.rules, plan, '        '), '        break;');
    }
    out.push('    }');
  } else if (kind === 'mouse') {
    for (const group of groupByTrigger(rules)) {
      const t = group.trigger as { kind: 'mouse'; button: MouseButton; state: MouseState };
      out.push(`    if (button == ${BUTTON_LABELS[t.button]} && state == ${STATE_LABELS[t.state]}) {`);
      if (usesPointer(group.rules)) out.push(...pointerLines('        '));
      out.push(...ruleLines(group.rules, plan, '        '), '    }');
    }
  } else {
    if (usesPointer(rules)) out.push(...pointerLines('    '));
    out.push(...ruleLines(rules, plan, '    '));
  }
  out.push('    glutPostRedisplay();');
  return out;
}

export function generateHandlers(plan: CallbackPlan, limits: ViewportLimits = DEFAULT_LIMITS): string {
  return plan.registered
    .map(({ kind, handlerName }) =>
      `// ${LABELS[kind]} callback: ${GLUT_FUNCS[kind]}\n`
      + `void ${handlerName}${SIGNATURES[kind]}\n{\n${handlerBody(kind, plan, limits).join('\n')}\n}\n\n`)
    .join('');
}

/** main()'s registrations. Idle is registered through _vams_idle. */
export function generateRegistrations(plan: CallbackPlan): string {
  return plan.registered
    .filter((r) => r.kind !== 'idle')
    .map((r) => `    ${GLUT_FUNCS[r.kind]}(${r.handlerName});\n`)
    .join('');
}

export function generateViewGlobals(plan: CallbackPlan, limits: ViewportLimits = DEFAULT_LIMITS): string {
  if (!plan.needsView) return '';
  return `// --- View (the glOrtho bounds, updated by the reshape callback) ---\n`
    + `float viewMinX = ${f4(limits.minX)}, viewMaxX = ${f4(limits.maxX)}, viewMinY = ${f4(limits.minY)}, viewMaxY = ${f4(limits.maxY)};\n\n`;
}

export function generateWindowToWorld(plan: CallbackPlan): string {
  if (!plan.needsPointer) return '';
  return [
    "// Convert a window pixel (GLUT's origin is top-left) to world coordinates",
    'void windowToWorld(int x, int y, float* wx, float* wy)',
    '{',
    '    int w = glutGet(GLUT_WINDOW_WIDTH);',
    '    int h = glutGet(GLUT_WINDOW_HEIGHT);',
    '    *wx = viewMinX + (viewMaxX - viewMinX) * x / (float)(w > 0 ? w : 1);',
    '    *wy = viewMaxY - (viewMaxY - viewMinY) * y / (float)(h > 0 ? h : 1);',
    '}',
    '',
    '',
  ].join('\n');
}
```

- [ ] **Step 5: State, draw effects and buffers**

`state.ts`:

```ts
import type { SceneNode } from '@/core/types/scene';
import { sanitizeName } from './utils';

export interface StateOptions {
  /** Add colour and visibility fields (a colour or visibility rule exists). */
  extended?: boolean;
  /** Objects a Reset rule targets: each gets a const initial_<name>. */
  resetIds?: ReadonlySet<string>;
}

export const generateState = (allObjects: SceneNode[], options: StateOptions = {}): string => {
  let code = `// --- Global State ---\n`;
  code += `struct ObjectState {\n`;
  code += `    float x, y;\n`;
  code += `    float rotation;\n`;
  code += `    float scaleX, scaleY;\n`;
  if (options.extended) {
    code += `    float r, g, b;\n`;
    code += `    bool useColor;\n`;
    code += `    bool visible;\n`;
  }
  code += `};\n\n`;
  const tail = options.extended ? ', 0.0f, 0.0f, 0.0f, false, true' : '';
  const initializer = (obj: SceneNode) => {
    const t = obj.transform;
    return `{ ${t.translateX.toFixed(4)}f, ${t.translateY.toFixed(4)}f, ${t.rotate.toFixed(4)}f, ${t.scaleX.toFixed(4)}f, ${t.scaleY.toFixed(4)}f${tail} }`;
  };
  allObjects.forEach((obj) => {
    code += `ObjectState state_${sanitizeName(obj.name)} = ${initializer(obj)};\n`;
  });
  allObjects
    .filter((obj) => options.resetIds?.has(obj.id))
    .forEach((obj) => {
      code += `const ObjectState initial_${sanitizeName(obj.name)} = ${initializer(obj)};\n`;
    });
  return code + `\n`;
};
```

`render.ts`:
- Add:

```ts
export interface DrawEffects {
  colorIds: ReadonlySet<string>;
  visibilityIds: ReadonlySet<string>;
}
export const NO_EFFECTS: DrawEffects = { colorIds: new Set(), visibilityIds: new Set() };
```

- Give `generateObjectDrawBody` the parameter `effects: DrawEffects = NO_EFFECTS`. Pass `effects.colorIds.has(object.id)` to `generateVertexArrayDrawBody(object, recolor)` and `generateVBODrawBody(object, recolor)`, and pass `effects` to `generateImmediateDrawBody(object, allObjects, effects)`.
- In `generateImmediateDrawBody`, with `const recolor = effects.colorIds.has(object.id)` and `S = state_${safeName}`:
  - **group children:** for each child, `const childName = sanitizeName(child.name)`. Emit `    if (state_${childName}.visible) draw_${childName}();\n` when `effects.visibilityIds.has(child.id)`, otherwise `    draw_${childName}();\n` as today.
  - **text:** when `recolor`, the existing colour line becomes `    if (!${S}.useColor) glColor3f(...);` (or `glColor3ub`), followed by `    if (${S}.useColor) glColor3f(${S}.r, ${S}.g, ${S}.b);\n`.
  - **primitives:** `emitColor(v, colorMode, indent, guard)`, where `guard` is `recolor ? S : null`, writes `${indent}if (!${guard}.useColor) glColor3f(...);\n` when a guard is given. Before the `glBegin` line, when `recolor`, emit `    if (${S}.useColor) glColor3f(${S}.r, ${S}.g, ${S}.b);\n`. That line sits after the blank line, directly above `    glBegin(`.

`buffers.ts`: give `generateVertexArrayDrawBody` and `generateVBODrawBody` the parameter `recolor = false`. Replace the line `    glEnableClientState(GL_COLOR_ARRAY);\n` with:

```ts
out += recolor
  ? `    if (state_${safe}.useColor) glColor3f(state_${safe}.r, state_${safe}.g, state_${safe}.b);\n    else glEnableClientState(GL_COLOR_ARRAY);\n`
  : `    glEnableClientState(GL_COLOR_ARRAY);\n`;
```

- [ ] **Step 6: Wire the plan into the program**

`code-generator.ts`:
- Replace the `callbacks: RegisteredCallback[]` parameter of `generateAppOutput` with `plan: CallbackPlan`, keeping its position. Delete `RegisteredCallback` if nothing else uses it (`grep -rn RegisteredCallback src`).
- `const limits = viewportLimits ?? { minX: -1, maxX: 1, minY: -1, maxY: 1 };` and `const effects: DrawEffects = { colorIds: plan.colorIds, visibilityIds: plan.visibilityIds };`.
- `code += generateState(allObjects, { extended: plan.extendedState, resetIds: plan.resetIds });`, then `code += generateViewGlobals(plan, limits);` right after it.
- The `draw_<name>()` bodies use `generateObjectDrawBody(obj, allObjects, effects)`.
- In `draw()`, each root:
  - **GROUP or TEXT:** `const block = generateObjectDrawBody(obj, allObjects, effects);`. When `plan.visibilityIds.has(obj.id)`, emit `    if (state_${name}.visible) {\n` + block with four extra spaces on every non-empty line + `    }\n`. Otherwise emit the block as today.
  - **Anything else:** `    if (state_${name}.visible) draw_${name}();\n` when targeted by visibility, otherwise the existing call.
- In `display()`, when `plan.needsView`, emit `    glOrtho(viewMinX, viewMaxX, viewMinY, viewMaxY, -1.0, 1.0);\n\n`. Otherwise keep the existing branches.
- Replace the stub `callbacks.forEach(...)` block with `code += generateWindowToWorld(plan);` and `code += generateHandlers(plan, limits);`.
- Change `const idleCb = callbacks.find(...)` to `const idleCb = plan.registered.find((cb) => cb.kind === 'idle');`.
- Replace the registration `callbacks.forEach(...)` in `main()` with `code += generateRegistrations(plan);`.

`generate-from-state.ts`: delete `LEGACY_KINDS` and `getRegisteredCallbacks`. Build `const plan = planCallbacks(callbacks, visible)`, or `planCallbacks(callbacks, [])` for the empty-scene branch, and pass `plan` where `cbs` went.

Create `src/features/code-generation/model/locate-branch.ts`:

```ts
import type { RuleTrigger } from '@/core/types/scene';
import { BUTTON_LABELS, SPECIAL_LABELS, STATE_LABELS } from './generator/handlers';

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/**
 * The 0-based lines of a handler that ran for `trigger`: its case or if branch, or the whole
 * handler for Motion, Idle, Reshape (`null`) or a trigger without a branch. Empty when the
 * handler is not in `code`.
 */
export function locateHandlerBranch(code: string, handlerName: string, trigger: RuleTrigger | null): number[] {
  const lines = code.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.startsWith(`void ${handlerName}(`));
  if (start < 0) return [];
  let end = start + 1;
  while (end < lines.length - 1 && lines[end] !== '}') end++;
  const whole = range(start, end);
  if (!trigger || trigger.kind === 'motion' || trigger.kind === 'idle') return whole;
  const label = trigger.kind === 'keyboard'
    ? `    case '${trigger.key}':`
    : trigger.kind === 'special'
      ? `    case ${SPECIAL_LABELS[trigger.key]}:`
      : `    if (button == ${BUTTON_LABELS[trigger.button]} && state == ${STATE_LABELS[trigger.state]}) {`;
  const first = lines.findIndex((l, i) => i > start && i < end && l === label);
  if (first < 0) return whole;
  const closer = trigger.kind === 'mouse' ? '    }' : '        break;';
  let last = first + 1;
  while (last < end && lines[last] !== closer) last++;
  return range(first, last);
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/callbacks.test.ts tests/black-box/code-generation.test.ts tests/black-box/cpp-code-validation.test.ts tests/algorithm`
Expected: PASS, including BB-CB-12 against the fixture.

- [ ] **Step 8: Syntax-check the generated C++ by hand**

This check is not part of CI. Build one program with all six callbacks, every action and Keep proportions, then a second with Stretch, and save them to a scratch directory outside the repo, for example `$TEMP/vams-cc/`. In that directory, create stub `GL/glew.h` and `GL/freeglut.h` files. They declare `glutGet`, `glutPostRedisplay`, the `glut*Func` registrations, the `gl*` calls the program uses, and the `GLUT_*` and `GL_*` constants as `#define`s. Run `g++ -std=c++17 -fsyntax-only -I. program.cpp`.
Expected: no errors. Keep the command and its output for the review.

- [ ] **Step 9: Run the checks and commit**

Run: `npm run lint && npm run build && npm test`
Expected: all pass.

```bash
git checkout -- tests/reports
git add src/features/code-generation tests/black-box/callbacks.test.ts tests/black-box/code-generation.test.ts
git commit -m "feat(codegen): generate handler bodies from callback rules"
```

---

### Task 3: The Callbacks group

**Files:**
- Create: `src/shared/ui/controls/SelectField.tsx`; modify `src/shared/ui/controls/index.ts` and `src/shared/ui/controls/fields.scss`
- Create: `src/features/callbacks/model/rule-copy.ts`, `src/features/callbacks/ui/CallbackRow.tsx`, `src/features/callbacks/ui/RuleList.tsx`, `src/features/callbacks/ui/RuleForm.tsx`
- Rewrite: `src/features/callbacks/ui/CallbacksPanel.tsx`; extend `src/features/callbacks/ui/callbacks-panel.scss`
- Test: `tests/black-box/editor-panels.test.ts` (update BB-PANEL-10, add BB-PANEL-23 to 28)

**Interfaces:**
- Consumes: the store actions from Task 1, plus `MAX_RULES`, `isCallbackValid`, `isRegistered` and `newRuleId`.
- Produces:
  - `SelectField<T extends string>({ label, value, options: { value: T; label: string }[], onChange, disabled?, id?, className? })` from `@/shared/ui/controls`.
  - From `@/features/callbacks/model/rule-copy`:
    - panel copy: `CALLBACK_DEFS`, `CALLBACKS_NOTE`, `ACTION_LABELS`, `invalidNameMessage(defaultName)`;
    - triggers: `triggerChip(t)`, `triggerPhrase(t)`, `triggerValue(t)`, `triggerFromValue(kind, v)`, `triggerOptions(kind)`, `triggerOptionLabel(t)`, `nextTrigger(kind, rules)`;
    - actions and rules: `actionSentence(a, name)`, `actionPhrase(a, name)`, `ruleLabel(rule, name)`, `actionTypesFor(kind)`, `eligibleTargets(type, objects)`, `defaultAction(type, kind, target?)`, `newRule(kind, rules, objects, id)`.

- [ ] **Step 1: Write the failing tests**

In `tests/black-box/editor-panels.test.ts`, extend BB-PANEL-10's expected hints with `'glutSpecialFunc(handler)'`, and append:

```ts
import { MAX_RULES } from '@/core/callbacks/callbacks-model';

function openCallbacks() {
  const host = mount(h(CallbacksPanel, {}));
  (host.querySelector('.vpanel__header') as HTMLButtonElement).click();
  return host;
}
const row = (host: HTMLElement, label: string) =>
  [...host.querySelectorAll('.cb-item')].find((el) => el.querySelector('.cb-label')?.textContent === label) as HTMLElement;
const button = (root: HTMLElement, text: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement;

describe('BB-PANEL-23: Add rule writes a summary line and opens its form', () => {
  it('adds → then ← for Special keys', async () => {
    const tri = addTriangle();
    useVamsStore.getState().updateObjectName(tri.id, 'Tri');
    useVamsStore.getState().setCallbackHandler('special', 'onSpecial');
    const host = openCallbacks();
    await settle();
    const special = row(host, 'Special keys');
    button(special, 'Add rule').click();
    await settle();
    expect(special.querySelector('.cb-rule__line')!.getAttribute('aria-label'))
      .toBe('Rule: when → is pressed, translate Tri by 0.10, 0.00. Edit');
    expect(special.querySelector('.cb-rule-form')).not.toBeNull();
    button(special, 'Add rule').click();
    await settle();
    expect([...special.querySelectorAll('.cb-rule__chip')].map((c) => c.textContent)).toEqual(['→', '←']);
    unmount(host);
  });
});

describe('BB-PANEL-24: A rule line opens and closes its form', () => {
  it('Esc closes the form and focuses the line; Delete removes the rule', async () => {
    const tri = addTriangle();
    useVamsStore.getState().setCallbackHandler('keyboard', 'onKey');
    useVamsStore.getState().addCallbackRule('keyboard', {
      id: 'r1', objectId: tri.id, trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'rotate', degrees: 15 },
    });
    const host = openCallbacks();
    await settle();
    const line = host.querySelector('.cb-rule__line') as HTMLButtonElement;
    line.click();
    await settle();
    const form = host.querySelector('.cb-rule-form') as HTMLElement;
    key(form, 'Escape');
    await settle();
    expect(host.querySelector('.cb-rule-form')).toBeNull();
    expect(document.activeElement).toBe(host.querySelector('.cb-rule__line'));
    (host.querySelector('.cb-rule__line') as HTMLButtonElement).click();
    await settle();
    button(host.querySelector('.cb-rule-form') as HTMLElement, 'Delete').click();
    await settle();
    expect(useVamsStore.getState().callbacks.keyboard.rules).toEqual([]);
    unmount(host);
  });
});

describe('BB-PANEL-25: Add rule is disabled with no shapes or at the limit', () => {
  it('reads "Add a shape first", then "8 rules is the limit"', async () => {
    useVamsStore.getState().setCallbackHandler('keyboard', 'onKey');
    let host = openCallbacks();
    await settle();
    const empty = row(host, 'Keyboard').querySelector('.cb-add-rule') as HTMLButtonElement;
    expect(empty.disabled).toBe(true);
    expect(empty.textContent).toContain('Add a shape first');
    unmount(host);
    const tri = addTriangle();
    for (let i = 0; i < MAX_RULES; i++) {
      useVamsStore.getState().addCallbackRule('keyboard', {
        id: `r${i}`, objectId: tri.id, trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'rotate', degrees: 1 },
      });
    }
    host = openCallbacks();
    await settle();
    const full = row(host, 'Keyboard').querySelector('.cb-add-rule') as HTMLButtonElement;
    expect(full.disabled).toBe(true);
    expect(full.textContent).toContain('8 rules is the limit');
    unmount(host);
  });
});

describe('BB-PANEL-26: The Object menu follows the action', () => {
  it('Move to pointer lists top-level objects; Set colour lists no groups', async () => {
    const a = addTriangle();
    const b = addQuad(0.5, 0.5, 0.1);
    useVamsStore.getState().createGroup([a.id, b.id]);
    const solo = addTriangle(-0.5, -0.5, 0.1);
    useVamsStore.getState().setCallbackHandler('mouse', 'onMouse');
    const host = openCallbacks();
    await settle();
    const mouse = row(host, 'Mouse');
    button(mouse, 'Add rule').click();
    await settle();
    const selectNamed = (label: string) =>
      [...mouse.querySelectorAll('.vselect')].find((d) => d.querySelector('label')?.textContent === label)!
        .querySelector('select') as HTMLSelectElement;
    const doSelect = selectNamed('Do');
    doSelect.value = 'moveToPointer';
    doSelect.dispatchEvent(new Event('change', { bubbles: true }));
    doSelect.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    const objectSelect = selectNamed('Object');
    const ids = [...objectSelect.options].map((o) => o.value);
    expect(ids).toContain(solo.id);
    expect(ids).not.toContain(a.id);
    expect(ids).not.toContain(b.id);
    unmount(host);
  });
});

describe('BB-PANEL-27: Reshape choice and name errors', () => {
  it('Keep proportions | Stretch sets the store; a duplicate name shows the error', async () => {
    useVamsStore.getState().setCallbackHandler('reshape', 'onReshape');
    useVamsStore.getState().setCallbackHandler('motion', 'onReshape');
    const host = openCallbacks();
    await settle();
    const reshape = row(host, 'Reshape');
    button(reshape, 'Stretch').click();
    await settle();
    expect(useVamsStore.getState().callbacks.reshape.resize).toBe('stretch');
    expect(reshape.querySelector('.cb-error')?.textContent).toBe("Use a C++ name VAMS doesn't already use, like onReshape.");
    unmount(host);
  });
});

describe('BB-PANEL-28: Off removes the callback and its rules', () => {
  it('clears rules', async () => {
    const tri = addTriangle();
    useVamsStore.getState().setCallbackHandler('idle', 'onIdle');
    useVamsStore.getState().addCallbackRule('idle', {
      id: 'r1', objectId: tri.id, trigger: { kind: 'idle' }, action: { type: 'rotate', degrees: 1 },
    });
    const host = openCallbacks();
    await settle();
    (row(host, 'Idle').querySelector('.cb-toggle') as HTMLButtonElement).click();
    await settle();
    expect(useVamsStore.getState().callbacks.idle).toEqual({ handlerName: '', rules: [] });
    unmount(host);
  });
});
```

Selects are found through the `.vselect` wrapper's label, which `SelectField` renders.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/editor-panels.test.ts`
Expected: BB-PANEL-10 and 23 to 28 FAIL. The panel has no Special keys row and no rule UI.

- [ ] **Step 3: Write `SelectField`**

`src/shared/ui/controls/SelectField.tsx`:

```tsx
import { useId } from 'react';
import './fields.scss';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/** A labelled native select, styled like the other fields. */
export function SelectField<T extends string>({
  label, value, options, onChange, disabled = false, id, className,
}: SelectFieldProps<T>) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={className ? `vselect ${className}` : 'vselect'}>
      <label htmlFor={selectId} className="vfield-label">{label}</label>
      <select
        id={selectId}
        className="vfield-input"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange((event.currentTarget as HTMLSelectElement).value as T)}
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}
```

Export it from `index.ts`: `export { SelectField, type SelectFieldProps, type SelectOption } from './SelectField';`. In `fields.scss`, add `.vselect` with the same rules as `.vtext`. Copy the `.vtext` block's properties under the new selector.

- [ ] **Step 4: Write `rule-copy.ts`**

```ts
import type {
  CallbackRule, GlutCallbackKind, MouseButton, MouseState, RuleAction, RuleActionType,
  RuleCallbackKind, RuleTrigger, SceneNode, SpecialKey,
} from '@/core/types/scene';
import { KEYBOARD_KEYS, MOUSE_BUTTONS, MOUSE_STATES, SPECIAL_KEYS, actionAllowed } from '@/core/callbacks/callbacks-model';

export interface CallbackDef {
  kind: GlutCallbackKind;
  glutFn: string;
  label: string;
  description: string;
  defaultName: string;
}

export const CALLBACK_DEFS: readonly CallbackDef[] = [
  { kind: 'keyboard', glutFn: 'glutKeyboardFunc', label: 'Keyboard', description: 'Fires on key press.', defaultName: 'onKey' },
  { kind: 'special', glutFn: 'glutSpecialFunc', label: 'Special keys', description: 'Fires on arrow keys.', defaultName: 'onSpecial' },
  { kind: 'mouse', glutFn: 'glutMouseFunc', label: 'Mouse', description: 'Fires on button down/up.', defaultName: 'onMouse' },
  { kind: 'motion', glutFn: 'glutMotionFunc', label: 'Motion', description: 'Fires while dragging.', defaultName: 'onMotion' },
  { kind: 'reshape', glutFn: 'glutReshapeFunc', label: 'Reshape', description: 'Fires on window resize.', defaultName: 'onReshape' },
  { kind: 'idle', glutFn: 'glutIdleFunc', label: 'Idle', description: 'Fires every frame when idle.', defaultName: 'onIdle' },
];

export const CALLBACKS_NOTE =
  "Each callback's rules become the body of its handler in the generated code. Press Run on the canvas to try them: keys, clicks and drags go to your handlers, and your scene is unchanged when you stop.";

export const invalidNameMessage = (defaultName: string) =>
  `Use a C++ name VAMS doesn't already use, like ${defaultName}.`;

const ARROWS: Record<SpecialKey, string> = { up: '↑', down: '↓', left: '←', right: '→' };
const ARROW_WORDS: Record<SpecialKey, string> = { up: 'Up', down: 'Down', left: 'Left', right: 'Right' };
const BUTTON_WORDS: Record<MouseButton, string> = { left: 'Left', middle: 'Middle', right: 'Right' };
const MOUSE_ORDER: Array<[MouseButton, MouseState]> = [
  ['left', 'down'], ['left', 'up'], ['right', 'down'], ['right', 'up'], ['middle', 'down'], ['middle', 'up'],
];

export const keyName = (key: string) => (key === ' ' ? 'Space' : key.toUpperCase());
const n2 = (v: number) => v.toFixed(2);

export function triggerChip(t: RuleTrigger): string {
  switch (t.kind) {
    case 'keyboard': return keyName(t.key);
    case 'special': return ARROWS[t.key];
    case 'mouse': return `${BUTTON_WORDS[t.button]} ${t.state}`;
    case 'motion': return 'Drag';
    case 'idle': return 'Frame';
  }
}

export function triggerPhrase(t: RuleTrigger): string {
  switch (t.kind) {
    case 'keyboard': return `when ${keyName(t.key)} is pressed`;
    case 'special': return `when ${ARROWS[t.key]} is pressed`;
    case 'mouse': return `when the ${t.button} button goes ${t.state}`;
    case 'motion': return 'on each drag movement';
    case 'idle': return 'every frame';
  }
}

export function actionSentence(a: RuleAction, name: string): string {
  switch (a.type) {
    case 'translate': return `Translate ${name} (${n2(a.dx)}, ${n2(a.dy)})`;
    case 'rotate': return `Rotate ${name} ${a.degrees}°`;
    case 'scale': return `Scale ${name} (${n2(a.sx)}, ${n2(a.sy)})`;
    case 'moveToPointer': return `Move ${name} to the pointer`;
    case 'reset': return `Reset ${name}`;
    case 'setColor': return `Colour ${name} ${a.color}`;
    case 'visibility': return `${a.mode === 'show' ? 'Show' : a.mode === 'hide' ? 'Hide' : 'Toggle'} ${name}`;
  }
}

export function actionPhrase(a: RuleAction, name: string): string {
  switch (a.type) {
    case 'translate': return `translate ${name} by ${n2(a.dx)}, ${n2(a.dy)}`;
    case 'rotate': return `rotate ${name} by ${a.degrees}°`;
    case 'scale': return `scale ${name} by ${n2(a.sx)}, ${n2(a.sy)}`;
    case 'moveToPointer': return `move ${name} to the pointer`;
    case 'reset': return `reset ${name}`;
    case 'setColor': return `colour ${name} ${a.color}`;
    case 'visibility': return `${a.mode} ${name}`;
  }
}

export const ruleLabel = (rule: CallbackRule, name: string) =>
  `Rule: ${triggerPhrase(rule.trigger)}, ${actionPhrase(rule.action, name)}. Edit`;

export const ACTION_LABELS: Record<RuleActionType, string> = {
  translate: 'Translate', rotate: 'Rotate', scale: 'Scale', moveToPointer: 'Move to pointer',
  reset: 'Reset', setColor: 'Set colour', visibility: 'Visibility',
};

export const actionTypesFor = (kind: RuleCallbackKind): RuleActionType[] =>
  (Object.keys(ACTION_LABELS) as RuleActionType[]).filter((type) => actionAllowed(kind, type));

/** Move to pointer needs a top-level object; Set colour needs something that draws. */
export function eligibleTargets(type: RuleActionType, objects: SceneNode[]): SceneNode[] {
  if (type === 'moveToPointer') return objects.filter((o) => !o.parentId);
  if (type === 'setColor') return objects.filter((o) => o.type !== 'GROUP');
  return objects;
}

export function defaultAction(type: RuleActionType, kind: RuleCallbackKind, target?: SceneNode): RuleAction {
  switch (type) {
    case 'translate': return { type, dx: 0.1, dy: 0 };
    case 'rotate': return { type, degrees: kind === 'idle' ? 1 : 15 };
    case 'scale': return { type, sx: 1.1, sy: 1.1 };
    case 'moveToPointer': return { type };
    case 'reset': return { type };
    case 'setColor': return { type, color: (target?.vertices[0]?.color ?? '#ffffff').toLowerCase() };
    case 'visibility': return { type, mode: 'toggle' };
  }
}

export function triggerValue(t: RuleTrigger): string {
  switch (t.kind) {
    case 'keyboard': return t.key;
    case 'special': return t.key;
    case 'mouse': return `${t.button}-${t.state}`;
    default: return t.kind;
  }
}

export function triggerOptions(kind: RuleCallbackKind): RuleTrigger[] {
  switch (kind) {
    case 'keyboard': return KEYBOARD_KEYS.map((key) => ({ kind, key }));
    case 'special': return SPECIAL_KEYS.map((key) => ({ kind, key }));
    case 'mouse': return MOUSE_BUTTONS.flatMap((button) => MOUSE_STATES.map((state) => ({ kind, button, state })));
    case 'motion': return [{ kind: 'motion' }];
    case 'idle': return [{ kind: 'idle' }];
  }
}

export function triggerFromValue(kind: RuleCallbackKind, value: string): RuleTrigger {
  return triggerOptions(kind).find((t) => triggerValue(t) === value) ?? triggerOptions(kind)[0];
}

export function triggerOptionLabel(t: RuleTrigger): string {
  switch (t.kind) {
    case 'keyboard': return keyName(t.key);
    case 'special': return `${ARROWS[t.key]} ${ARROW_WORDS[t.key]}`;
    case 'mouse': return `${BUTTON_WORDS[t.button]} button ${t.state}`;
    case 'motion': return 'Drag';
    case 'idle': return 'Every frame';
  }
}

/** The first trigger not yet used, in teaching order: D A W S, → ← ↑ ↓, left down first. */
export function nextTrigger(kind: RuleCallbackKind, rules: CallbackRule[]): RuleTrigger {
  const used = new Set(rules.map((r) => triggerValue(r.trigger)));
  const preferred: RuleTrigger[] =
    kind === 'keyboard' ? ['d', 'a', 'w', 's'].map((key) => ({ kind, key }))
      : kind === 'special' ? (['right', 'left', 'up', 'down'] as SpecialKey[]).map((key) => ({ kind, key }))
        : kind === 'mouse' ? MOUSE_ORDER.map(([button, state]) => ({ kind, button, state }))
          : triggerOptions(kind);
  return preferred.find((t) => !used.has(triggerValue(t))) ?? preferred[0];
}

/** A new rule for the first top-level object, or null when the scene is empty. */
export function newRule(kind: RuleCallbackKind, rules: CallbackRule[], objects: SceneNode[], id: string): CallbackRule | null {
  const target = objects.find((o) => !o.parentId);
  if (!target) return null;
  const type: RuleActionType = kind === 'idle' ? 'rotate' : 'translate';
  return { id, objectId: target.id, trigger: nextTrigger(kind, rules), action: defaultAction(type, kind, target) };
}
```

- [ ] **Step 5: Write the components**

`RuleForm.tsx`:

```tsx
import { useVamsStore } from '@/core/store';
import type { CallbackRule, RuleAction, RuleActionType, RuleCallbackKind, SceneNode } from '@/core/types/scene';
import { Button, ColorField, NumberField, SegmentedControl, SelectField } from '@/shared/ui/controls';
import {
  ACTION_LABELS, actionTypesFor, defaultAction, eligibleTargets, triggerFromValue,
  triggerOptionLabel, triggerOptions, triggerValue,
} from '../model/rule-copy';

interface RuleFormProps {
  kind: RuleCallbackKind;
  rule: CallbackRule;
  objects: SceneNode[];
  onClose: () => void;
}

export function RuleForm({ kind, rule, objects, onClose }: RuleFormProps) {
  const update = useVamsStore((s) => s.updateCallbackRule);
  const remove = useVamsStore((s) => s.removeCallbackRule);
  const pushToHistory = useVamsStore((s) => s.pushToHistory);
  const targets = eligibleTargets(rule.action.type, objects);
  const live = (action: RuleAction) => update(kind, rule.id, { action }, false);
  const action = rule.action;

  const changeType = (type: RuleActionType) => {
    const choices = eligibleTargets(type, objects);
    const target = choices.find((o) => o.id === rule.objectId) ?? choices[0];
    if (!target) return;
    update(kind, rule.id, { action: defaultAction(type, kind, target), objectId: target.id });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };

  return (
    <div className="cb-rule-form" role="group" aria-label="Edit rule" onKeyDown={onKeyDown}>
      {kind !== 'motion' && kind !== 'idle' && (
        <SelectField
          label="When"
          value={triggerValue(rule.trigger)}
          options={triggerOptions(kind).map((t) => ({ value: triggerValue(t), label: triggerOptionLabel(t) }))}
          onChange={(value) => update(kind, rule.id, { trigger: triggerFromValue(kind, value) })}
        />
      )}
      <SelectField
        label="Do"
        value={action.type}
        options={actionTypesFor(kind).map((type) => ({ value: type, label: ACTION_LABELS[type] }))}
        onChange={changeType}
      />
      <SelectField
        label="Object"
        value={rule.objectId}
        options={targets.map((o) => ({ value: o.id, label: o.name }))}
        onChange={(objectId) => update(kind, rule.id, { objectId })}
      />
      {action.type === 'translate' && (
        <div className="cb-rule-form__pair">
          <NumberField label="dx" tag="dx" value={action.dx} min={-10} max={10} step={0.01} precision={2}
            onBeginChange={pushToHistory} onChange={(dx) => live({ ...action, dx })} />
          <NumberField label="dy" tag="dy" value={action.dy} min={-10} max={10} step={0.01} precision={2}
            onBeginChange={pushToHistory} onChange={(dy) => live({ ...action, dy })} />
        </div>
      )}
      {action.type === 'rotate' && (
        <NumberField label="Degrees" tag="deg" value={action.degrees} min={-360} max={360} step={1} precision={0} unit="°"
          onBeginChange={pushToHistory} onChange={(degrees) => live({ ...action, degrees })} />
      )}
      {action.type === 'scale' && (
        <div className="cb-rule-form__pair">
          <NumberField label="sx" tag="sx" value={action.sx} min={0.1} max={10} step={0.01} precision={2}
            onBeginChange={pushToHistory} onChange={(sx) => live({ ...action, sx })} />
          <NumberField label="sy" tag="sy" value={action.sy} min={0.1} max={10} step={0.01} precision={2}
            onBeginChange={pushToHistory} onChange={(sy) => live({ ...action, sy })} />
        </div>
      )}
      {action.type === 'setColor' && (
        <ColorField label="Colour" value={action.color} glCall="glColor3f" showRecent={false}
          onBeginChange={pushToHistory} onChange={(color) => live({ type: 'setColor', color })} />
      )}
      {action.type === 'visibility' && (
        <SegmentedControl
          label="Visibility"
          value={action.mode}
          options={[{ value: 'show', label: 'Show' }, { value: 'hide', label: 'Hide' }, { value: 'toggle', label: 'Toggle' }]}
          onChange={(mode) => update(kind, rule.id, { action: { type: 'visibility', mode } })}
        />
      )}
      <div className="cb-rule-form__actions">
        <Button variant="quiet" onClick={() => { remove(kind, rule.id); onClose(); }}>Delete</Button>
        <Button variant="primary" onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}
```

Check `ColorGlCall` in `color-utils.ts` and pass its float value, which is `'glColor3f'` if that member exists. If `ColorField` has no `showRecent` prop, drop it.

`RuleList.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import type { RuleCallbackKind } from '@/core/types/scene';
import { MAX_RULES, newRuleId } from '@/core/callbacks/callbacks-model';
import { Button } from '@/shared/ui/controls';
import { actionSentence, newRule, ruleLabel, triggerChip } from '../model/rule-copy';
import { RuleForm } from './RuleForm';

export function RuleList({ kind, label }: { kind: RuleCallbackKind; label: string }) {
  const rules = useVamsStore((s) => s.callbacks[kind].rules);
  const objects = useVamsStore((s) => s.objects);
  const addRule = useVamsStore((s) => s.addCallbackRule);
  const [openId, setOpenId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const lines = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (!focusId) return;
    lines.current.get(focusId)?.focus();
    setFocusId(null);
  }, [focusId]);

  const names = new Map(objects.map((o) => [o.id, o.name]));
  const full = rules.length >= MAX_RULES;
  const empty = objects.length === 0;
  const close = (id: string) => { setOpenId(null); setFocusId(id); };
  const onAdd = () => {
    const rule = newRule(kind, rules, objects, newRuleId());
    if (!rule) return;
    addRule(kind, rule);
    setOpenId(rule.id);
  };

  return (
    <div className="cb-rules">
      {rules.length > 0 && (
        <ul className="cb-rule-list" aria-label={`${label} rules`}>
          {rules.map((rule) => {
            const name = names.get(rule.objectId) ?? 'an object';
            const open = openId === rule.id;
            return (
              <li key={rule.id} className="cb-rule">
                <button
                  type="button"
                  ref={(el) => { if (el) lines.current.set(rule.id, el); else lines.current.delete(rule.id); }}
                  className={open ? 'cb-rule__line is-open' : 'cb-rule__line'}
                  aria-expanded={open}
                  aria-label={ruleLabel(rule, name)}
                  onClick={() => (open ? close(rule.id) : setOpenId(rule.id))}
                >
                  <span className="cb-rule__chip" aria-hidden="true">{triggerChip(rule.trigger)}</span>
                  <span className="cb-rule__text" aria-hidden="true">
                    {actionSentence(rule.action, name)}
                    {rule.action.type === 'setColor' && (
                      <span className="cb-rule__swatch" style={{ background: rule.action.color }} />
                    )}
                  </span>
                  <Pencil size={12} aria-hidden="true" />
                </button>
                {open && <RuleForm kind={kind} rule={rule} objects={objects} onClose={() => close(rule.id)} />}
              </li>
            );
          })}
        </ul>
      )}
      <Button variant="quiet" className="cb-add-rule" icon={<Plus />} disabled={full || empty} onClick={onAdd}>
        {full ? '8 rules is the limit' : empty ? 'Add a shape first' : 'Add rule'}
      </Button>
    </div>
  );
}
```

`CallbackRow.tsx` moves the existing per-callback `<li>` out of `CallbacksPanel` and extends it:
- Validity uses `isCallbackValid(callbacks, def.kind)`, and the error reads `invalidNameMessage(def.defaultName)`.
- The Reshape row shows the `SegmentedControl` (label "Resize"; options `keep` "Keep proportions" and `stretch` "Stretch"), bound to `setReshapeMode`, while registered.
- Rule callbacks show `<RuleList kind={def.kind} label={def.label} />` while registered.
- Off calls `clearCallback`.

```tsx
import {
  Activity, ArrowRightLeft, Keyboard, Maximize, MousePointer, Move, type LucideIcon,
} from 'lucide-react';
import { useVamsStore } from '@/core/store';
import type { GlutCallbackKind } from '@/core/types/scene';
import { isCallbackValid, isRegistered } from '@/core/callbacks/callbacks-model';
import { Button, GlHint, SegmentedControl } from '@/shared/ui/controls';
import { invalidNameMessage, type CallbackDef } from '../model/rule-copy';
import { RuleList } from './RuleList';

const ICONS: Record<GlutCallbackKind, LucideIcon> = {
  keyboard: Keyboard, special: ArrowRightLeft, mouse: MousePointer, motion: Move, reshape: Maximize, idle: Activity,
};

export function CallbackRow({ def }: { def: CallbackDef }) {
  const callbacks = useVamsStore((s) => s.callbacks);
  const setCallbackHandler = useVamsStore((s) => s.setCallbackHandler);
  const clearCallback = useVamsStore((s) => s.clearCallback);
  const setReshapeMode = useVamsStore((s) => s.setReshapeMode);
  const Icon = ICONS[def.kind];
  const value = callbacks[def.kind].handlerName;
  const isActive = isRegistered(callbacks[def.kind]);
  const isInvalid = isActive && !isCallbackValid(callbacks, def.kind);

  return (
    <li className={`cb-item ${isActive ? 'active' : ''} ${isInvalid ? 'invalid' : ''}`}>
      <div className="cb-head">
        <span className="cb-icon" aria-hidden="true"><Icon size={14} /></span>
        <div className="cb-meta">
          <span className="cb-label">{def.label}</span>
          <span className="cb-desc">{def.description}</span>
        </div>
        <Button
          variant="secondary"
          className="cb-toggle"
          onClick={() => (isActive ? clearCallback(def.kind) : setCallbackHandler(def.kind, def.defaultName))}
          aria-pressed={isActive}
          title={isActive ? 'Clear handler' : `Register with default name "${def.defaultName}"`}
        >
          <span className="cb-dot" aria-hidden="true" />
          <span>{isActive ? 'On' : 'Off'}</span>
        </Button>
      </div>
      <GlHint call={def.glutFn} args="handler" />
      <input
        type="text"
        value={value}
        placeholder={def.defaultName}
        spellcheck={false}
        autoCapitalize="off"
        aria-label={`${def.label} handler`}
        aria-invalid={isInvalid || undefined}
        onChange={(e) => setCallbackHandler(def.kind, e.currentTarget.value)}
        className="vfield-input cb-input"
      />
      {isInvalid && <div className="cb-error">{invalidNameMessage(def.defaultName)}</div>}
      {isActive && def.kind === 'reshape' && (
        <SegmentedControl
          label="Resize"
          value={callbacks.reshape.resize}
          options={[{ value: 'keep', label: 'Keep proportions' }, { value: 'stretch', label: 'Stretch' }]}
          onChange={setReshapeMode}
        />
      )}
      {isActive && def.kind !== 'reshape' && <RuleList kind={def.kind} label={def.label} />}
    </li>
  );
}
```

`CallbacksPanel.tsx`:

```tsx
import './callbacks-panel.scss';
import { Info, Plug } from 'lucide-react';
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';
import { CALLBACK_DEFS, CALLBACKS_NOTE } from '../model/rule-copy';
import { CallbackRow } from './CallbackRow';

export default function CallbacksPanel() {
  return (
    <CollapsibleSection panelId="callbacks-panel" title="Callbacks" icon={<Plug size={14} />} defaultOpen={false}>
      <div className="callbacks-panel">
        <div className="cb-info" role="note">
          <Info size={13} className="cb-info-icon" aria-hidden />
          <p>{CALLBACKS_NOTE}</p>
        </div>
        <ul className="cb-list">
          {CALLBACK_DEFS.map((def) => <CallbackRow key={def.kind} def={def} />)}
        </ul>
      </div>
    </CollapsibleSection>
  );
}
```

In `callbacks-panel.scss`, inside `.callbacks-panel`, add styles that use only tokens and `--text-*` sizes:
- `.cb-rule-list`: a vertical list with no bullets and `gap: var(--space-1)`.
- `.cb-rule__line`: a full-width button with `display: grid; grid-template-columns: auto 1fr auto; gap: var(--space-2); align-items: center;`, `padding: var(--space-1) var(--space-2)`, `background: var(--paper-sunken)`, `border-radius: var(--radius-s)`, `font-size: var(--text-sm)` and `text-align: left`. `&.is-open` gets `outline: 2px solid var(--accent)`.
- `.cb-rule__chip`: a key cap in `--font-mono`, `--text-xs` and `--paper-raised`, with `1px solid var(--rule)` and a 2px bottom border.
- `.cb-rule__swatch`: an inline 10px square with a `1px solid var(--rule)` border.
- `.cb-rule-form`: a raised card with `--paper-raised`, `1px solid var(--accent)`, `--radius-m`, `padding: var(--space-2)` and a column `gap: var(--space-2)`. `&__pair` is a two-column grid. `&__actions` is flex, right-aligned, with `gap: var(--space-2)`.
- `.cb-add-rule`: `align-self: flex-start`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/editor-panels.test.ts tests/black-box/controls.test.ts tests/black-box/editor-shell.test.ts`
Expected: PASS, including BB-PANEL-11 (every control has a name) and the BB-SHELL style scans.

- [ ] **Step 7: Run the checks and commit**

Run: `npm run lint && npm run build && npm test`. Expected: all pass.

```bash
git checkout -- tests/reports
git add src/shared/ui/controls/SelectField.tsx src/shared/ui/controls/index.ts src/shared/ui/controls/fields.scss src/features/callbacks tests/black-box/editor-panels.test.ts
git commit -m "feat(callbacks): build rules in the Callbacks group"
```

---

### Task 4: The Run runtime

**Files:**
- Create: `src/features/callbacks/model/runtime.ts`
- Create: `tests/helpers/mini-cpp.ts`, `tests/white-box/callbacks-runtime.test.ts`

**Interfaces:**
- Consumes: `CallbacksState`, `isCallbackValid`, `programObjects`; `motion-config` constants; `actionLines`, `generateIdleBody` (tests only).
- Produces (`runtime.ts`):
  - types: `RunObjectState`, `RunView`, `RunState`, `RunEvent`, `DispatchResult`;
  - `createRunState(objects: SceneNode[], limits: ViewportLimits, window: { width: number; height: number }): RunState`;
  - `applyAction(s: RunObjectState, action: RuleAction, initial: RunObjectState, pointer: { x: number; y: number } | null): RunObjectState`;
  - `windowToWorld(view: RunView, window, x: number, y: number): { x: number; y: number }`;
  - `keepProportionsView(limits: RunView, width: number, height: number): RunView`;
  - `dispatch(state: RunState, callbacks: CallbacksState, event: RunEvent): DispatchResult`;
  - `stepAnimations(state: RunState, sceneObjects: SceneNode[]): RunState`;
  - `runStateColor(o: RunObjectState): string` (`#rrggbb`).

- [ ] **Step 1: Write the independent interpreter**

`tests/helpers/mini-cpp.ts`:

```ts
/**
 * A tiny interpreter for the statement subset VAMS generates inside handler, reshape and
 * animator bodies. It shares no code with src: the runtime parity tests run the generated
 * C++ through it and compare the result with the Run runtime.
 */
export type Value = number | boolean | { [field: string]: number | boolean };

const PREC: Record<string, number> = {
  '?': 1, '||': 2, '&&': 3, '==': 4, '!=': 4, '<': 5, '<=': 5, '>': 5, '>=': 5, '+': 6, '-': 6, '*': 7, '/': 7,
};
const TOKEN = /\s*(\d+\.?\d*f?|[A-Za-z_]\w*|>=|<=|==|!=|&&|\|\||[-+*/()?:.!<>])/y;

function tokenize(src: string): string[] {
  const text = src.trim();
  const out: string[] = [];
  let pos = 0;
  while (pos < text.length) {
    TOKEN.lastIndex = pos;
    const m = TOKEN.exec(text);
    if (!m) throw new Error(`mini-cpp: cannot read "${src}" at ${pos}`);
    out.push(m[1]);
    pos = TOKEN.lastIndex;
  }
  return out;
}

function matchParen(line: string, open: number): number {
  let depth = 0;
  for (let i = open; i < line.length; i++) {
    if (line[i] === '(') depth++;
    if (line[i] === ')' && --depth === 0) return i;
  }
  throw new Error(`mini-cpp: unbalanced "${line}"`);
}

export class MiniCpp {
  vars = new Map<string, Value>();
  private statics = new Set<string>();
  private lastIf: boolean | null = null;

  run(lines: string[]): void {
    for (const line of lines) this.exec(line.trim());
  }

  private exec(line: string): void {
    if (!line || line.startsWith('//') || line === '{' || line === '}') return;
    if (line.startsWith('else ')) {
      const take = this.lastIf === false;
      this.lastIf = null;
      if (take) this.exec(line.slice(5).trim());
      return;
    }
    if (line.startsWith('if (')) {
      const close = matchParen(line, 3);
      const ok = Boolean(this.eval(line.slice(4, close)));
      if (ok) this.exec(line.slice(close + 1).trim());
      this.lastIf = ok;
      return;
    }
    this.lastIf = null;
    if (/^gl\w*\(/.test(line)) return; // glViewport, glutPostRedisplay: no state to model
    let m = /^static float (\w+) = (.+);$/.exec(line);
    if (m) {
      if (!this.statics.has(m[1])) {
        this.statics.add(m[1]);
        this.vars.set(m[1], this.eval(m[2]));
      }
      return;
    }
    m = /^float (.+);$/.exec(line);
    if (m) {
      for (const part of m[1].split(',')) {
        const [name, expr] = part.split('=').map((s) => s.trim());
        this.vars.set(name, expr === undefined ? 0 : this.eval(expr));
      }
      return;
    }
    m = /^([\w.]+)\s*(=|\+=|-=|\*=)\s*(.+);$/.exec(line);
    if (m) {
      this.assign(m[1], m[2], this.eval(m[3]));
      return;
    }
    throw new Error(`mini-cpp: unsupported statement "${line}"`);
  }

  private assign(target: string, op: string, value: Value): void {
    const [name, field] = target.split('.');
    if (!field) {
      const next = typeof value === 'object' ? { ...value } : value;
      this.vars.set(name, op === '=' ? next : this.combine(op, this.vars.get(name) as number, value as number));
      return;
    }
    const obj = this.vars.get(name) as Record<string, number | boolean>;
    obj[field] = op === '=' ? (value as number | boolean) : this.combine(op, obj[field] as number, value as number);
  }

  private combine(op: string, a: number, b: number): number {
    if (op === '+=') return a + b;
    if (op === '-=') return a - b;
    return a * b;
  }

  eval(src: string): Value {
    const tokens = tokenize(src);
    let i = 0;
    const peek = () => tokens[i];
    const next = () => tokens[i++];
    const expect = (t: string) => {
      if (next() !== t) throw new Error(`mini-cpp: expected ${t} in "${src}"`);
    };
    const primary = (): Value => {
      const t = next();
      if (t === '(') {
        if ((peek() === 'float' || peek() === 'int') && tokens[i + 1] === ')') {
          i += 2;
          return primary();
        }
        const v = expr(0);
        expect(')');
        return v;
      }
      if (t === '-') return -(primary() as number);
      if (t === '!') return !primary();
      if (/^\d/.test(t)) return parseFloat(t);
      if (t === 'true') return true;
      if (t === 'false') return false;
      if (t === 'sinf' || t === 'cosf') {
        expect('(');
        const v = expr(0) as number;
        expect(')');
        return t === 'sinf' ? Math.sin(v) : Math.cos(v);
      }
      let v = this.vars.get(t);
      if (v === undefined) throw new Error(`mini-cpp: unknown name ${t}`);
      while (peek() === '.') {
        i++;
        v = (v as Record<string, number | boolean>)[next()];
      }
      return v as Value;
    };
    const expr = (min: number): Value => {
      let left = primary();
      for (;;) {
        const op = peek();
        const prec = PREC[op];
        if (prec === undefined || prec < min) return left;
        i++;
        if (op === '?') {
          const a = expr(0);
          expect(':');
          const b = expr(1);
          left = left ? a : b;
          continue;
        }
        const right = expr(prec + 1) as number;
        const l = left as number;
        left = op === '+' ? l + right : op === '-' ? l - right : op === '*' ? l * right : op === '/' ? l / right
          : op === '>=' ? l >= right : op === '<=' ? l <= right : op === '>' ? l > right : op === '<' ? l < right
            : op === '==' ? l === right : op === '!=' ? l !== right : op === '&&' ? Boolean(l && right) : Boolean(l || right);
      }
    };
    const value = expr(0);
    if (i !== tokens.length) throw new Error(`mini-cpp: trailing tokens in "${src}"`);
    return value;
  }
}
```

- [ ] **Step 2: Write the failing parity tests**

`tests/white-box/callbacks-runtime.test.ts`:

```ts
/**
 * WHITE-BOX TEST SUITE — WB-CB
 * The Run runtime against the generated C++ (run through tests/helpers/mini-cpp).
 */
import { describe, it, expect } from 'vitest';
import type { RuleAction } from '@/core/types/scene';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { actionLines } from '@/features/code-generation/model/generator/handlers';
import { generateIdleBody } from '@/features/code-generation/model/generator/idle';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { locateHandlerBranch } from '@/features/code-generation/model/locate-branch';
import {
  applyAction, createRunState, dispatch, keepProportionsView, stepAnimations, type RunObjectState,
} from '@/features/callbacks/model/runtime';
import { MiniCpp } from '../helpers/mini-cpp';
import { addTriangle, getState } from '../helpers/store';

const base: RunObjectState = { x: 0.2, y: -0.1, rotation: 30, scaleX: 1.5, scaleY: 0.5, r: 0, g: 0, b: 0, useColor: false, visible: true };
const initial: RunObjectState = { ...base, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };

describe('WB-CB-1: Each action changes the state as its C++ line does', () => {
  const actions: RuleAction[] = [
    { type: 'translate', dx: 0.1, dy: -0.25 }, { type: 'rotate', degrees: 15 }, { type: 'scale', sx: 1.1, sy: 0.9 },
    { type: 'moveToPointer' }, { type: 'reset' }, { type: 'setColor', color: '#ff8000' },
    { type: 'visibility', mode: 'show' }, { type: 'visibility', mode: 'hide' }, { type: 'visibility', mode: 'toggle' },
  ];
  it.each(actions)('$type', (action) => {
    const cpp = new MiniCpp();
    cpp.vars.set('state_T', { ...base });
    cpp.vars.set('initial_T', { ...initial });
    cpp.vars.set('wx', 0.4);
    cpp.vars.set('wy', 0.6);
    cpp.run(actionLines(action, 'T', ''));
    const runtime = applyAction({ ...base }, action, initial, { x: 0.4, y: 0.6 });
    const expected = cpp.vars.get('state_T') as Record<string, number | boolean>;
    for (const field of Object.keys(base) as (keyof RunObjectState)[]) {
      if (typeof expected[field] === 'number') expect(runtime[field]).toBeCloseTo(expected[field] as number, 6);
      else expect(runtime[field]).toBe(expected[field]);
    }
  });
});

describe('WB-CB-2: Keyboard dispatch matches either case', () => {
  it('moves on d and D, ignores other keys', () => {
    const t = addTriangle();
    const cbs = emptyCallbacks();
    cbs.keyboard = { handlerName: 'onKey', rules: [{ id: 'r', objectId: t.id, trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'translate', dx: 0.1, dy: 0 } }] };
    let state = createRunState(getState().objects, getState().viewportLimits, { width: 800, height: 600 });
    const x0 = state.objects[t.id].x;
    state = dispatch(state, cbs, { type: 'key', key: 'D', x: 0, y: 0 }).state;
    state = dispatch(state, cbs, { type: 'key', key: 'd', x: 0, y: 0 }).state;
    const other = dispatch(state, cbs, { type: 'key', key: 'q', x: 0, y: 0 });
    expect(other.state).toBe(state);
    expect(other.call).toBe("onKey('q', 0, 0)");
    expect(state.objects[t.id].x).toBeCloseTo(x0 + 0.2, 6);
  });
});

describe('WB-CB-3: Mouse dispatch converts pixels with the windowToWorld formula', () => {
  it('flips y and matches button and state', () => {
    const t = addTriangle();
    const cbs = emptyCallbacks();
    cbs.mouse = { handlerName: 'onMouse', rules: [{ id: 'r', objectId: t.id, trigger: { kind: 'mouse', button: 'left', state: 'down' }, action: { type: 'moveToPointer' } }] };
    let state = createRunState(getState().objects, { minX: -1, maxX: 1, minY: -1, maxY: 1 }, { width: 800, height: 600 });
    const up = dispatch(state, cbs, { type: 'mouse', button: 'left', state: 'up', x: 600, y: 150 });
    expect(up.state).toBe(state);
    const down = dispatch(state, cbs, { type: 'mouse', button: 'left', state: 'down', x: 600, y: 150 });
    state = down.state;
    expect(state.objects[t.id].x).toBeCloseTo(0.5, 6);
    expect(state.objects[t.id].y).toBeCloseTo(0.5, 6);
    expect(down.call).toBe('onMouse(GLUT_LEFT_BUTTON, GLUT_DOWN, 600, 150)');
  });
});

describe('WB-CB-4: Keep proportions matches the generated reshape body', () => {
  it.each([[1200, 400], [300, 900], [500, 500]])('%i x %i', (width, height) => {
    useVamsStateForReshape();
    const code = generateCodeFromState(
      { objects: getState().objects, canvasBackgroundColor: '#000000', callbacks: getState().callbacks, viewportLimits: getState().viewportLimits },
      { width: 800, height: 600 },
    );
    const lines = code.split('\n');
    const bodyLines = locateHandlerBranch(code, 'onReshape', null).map((n) => lines[n]).slice(2, -1);
    const cpp = new MiniCpp();
    cpp.vars.set('width', width);
    cpp.vars.set('height', height);
    ['viewMinX', 'viewMaxX', 'viewMinY', 'viewMaxY'].forEach((n) => cpp.vars.set(n, 0));
    cpp.run(bodyLines);
    const view = keepProportionsView(getState().viewportLimits, width, height);
    expect(view.minX).toBeCloseTo(cpp.vars.get('viewMinX') as number, 6);
    expect(view.maxX).toBeCloseTo(cpp.vars.get('viewMaxX') as number, 6);
    expect(view.minY).toBeCloseTo(cpp.vars.get('viewMinY') as number, 6);
    expect(view.maxY).toBeCloseTo(cpp.vars.get('viewMaxY') as number, 6);
  });
});

function useVamsStateForReshape() {
  getState().setViewportLimits({ minX: -2, maxX: 3, minY: -1, maxY: 1.5 });
  getState().setCallbackHandler('reshape', 'onReshape');
}

describe('WB-CB-5: stepAnimations matches the generated animator over 120 frames', () => {
  it.each(['rotate', 'pulse', 'slide', 'orbit'] as const)('%s', (motion) => {
    const t = addTriangle(0.2, 0.1, 0.1);
    getState().updateObjectName(t.id, 'T');
    getState().setObjectAnimation(t.id, { motion, speed: 1.5 });
    const obj = getState().objects.find((o) => o.id === t.id)!;
    const cpp = new MiniCpp();
    cpp.vars.set('state_T', { x: obj.transform.translateX, y: obj.transform.translateY, rotation: obj.transform.rotate, scaleX: obj.transform.scaleX, scaleY: obj.transform.scaleY });
    let state = createRunState(getState().objects, getState().viewportLimits, { width: 800, height: 600 });
    const lines = generateIdleBody(motion, 'T', 1.5).lines;
    for (let frame = 0; frame < 120; frame++) {
      cpp.run(lines);
      state = stepAnimations(state, getState().objects);
    }
    const expected = cpp.vars.get('state_T') as Record<string, number>;
    for (const field of ['x', 'y', 'rotation', 'scaleX', 'scaleY'] as const) {
      expect(state.objects[t.id][field]).toBeCloseTo(expected[field], 5);
    }
  });
});

describe('WB-CB-6: A Slide animation overrides a Translate rule on x, as the program does', () => {
  it('loses the key translation on the next frame', () => {
    const t = addTriangle(0.2, 0, 0.1);
    getState().setObjectAnimation(t.id, { motion: 'slide', speed: 1 });
    const cbs = emptyCallbacks();
    cbs.keyboard = { handlerName: 'onKey', rules: [{ id: 'r', objectId: t.id, trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'translate', dx: 0.5, dy: 0 } }] };
    let state = createRunState(getState().objects, getState().viewportLimits, { width: 800, height: 600 });
    state = stepAnimations(state, getState().objects);
    const baseX = state.statics[t.id].baseX!;
    state = dispatch(state, cbs, { type: 'key', key: 'd', x: 0, y: 0 }).state;
    state = stepAnimations(state, getState().objects);
    expect(state.objects[t.id].x).toBeCloseTo(baseX + 0.5 * Math.sin(2 * 0.03), 6);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/white-box/callbacks-runtime.test.ts`
Expected: FAIL. `@/features/callbacks/model/runtime` cannot be resolved.

- [ ] **Step 4: Write the runtime**

`src/features/callbacks/model/runtime.ts`:

```ts
import type {
  CallbacksState, GlutCallbackKind, MouseButton, MouseState, RuleAction, RuleCallbackKind,
  RuleTrigger, SceneNode, SpecialKey, ViewportLimits,
} from '@/core/types/scene';
import { isCallbackValid, programObjects } from '@/core/callbacks/callbacks-model';
import {
  ORBIT_RADIUS, PULSE_AMPLITUDE, ROTATE_STEP_PER_FRAME, SLIDE_AMPLITUDE, TIME_STEP_PER_FRAME,
} from '@/core/animation/motion-config';

/**
 * The Run runtime: pure functions over a temporary copy of each object's program state. Every
 * action changes this copy exactly as its generated C++ line changes `state_<name>`
 * (WB-CB-1 checks each one), and nothing here touches the store.
 */
export interface RunObjectState {
  x: number; y: number; rotation: number; scaleX: number; scaleY: number;
  r: number; g: number; b: number; useColor: boolean; visible: boolean;
}
export interface RunView { minX: number; maxX: number; minY: number; maxY: number }
export interface RunState {
  objects: Record<string, RunObjectState>;
  initial: Record<string, RunObjectState>;
  limits: RunView;
  view: RunView;
  window: { width: number; height: number };
  /** The animators' `static` locals, per object. */
  statics: Record<string, { baseX?: number; baseY?: number; baseSX?: number; baseSY?: number; t: number }>;
}
export type RunEvent =
  | { type: 'key'; key: string; x: number; y: number }
  | { type: 'special'; key: SpecialKey; x: number; y: number }
  | { type: 'mouse'; button: MouseButton; state: MouseState; x: number; y: number }
  | { type: 'motion'; x: number; y: number }
  | { type: 'reshape'; width: number; height: number }
  | { type: 'idle' };
export interface DispatchResult {
  state: RunState;
  /** The handler GLUT called, or null when no valid handler exists (and always for idle). */
  kind: GlutCallbackKind | null;
  handlerName: string | null;
  /** The call as GLUT would make it, for the readout. */
  call: string | null;
  /** The first matched rule's trigger, or null. */
  matched: RuleTrigger | null;
}

const q = (v: number, decimals: number) => Number(v.toFixed(decimals));
const unit = (hex: string, i: number) => q(parseInt(hex.slice(i, i + 2), 16) / 255, 2);
const EVENT_KIND: Record<RunEvent['type'], GlutCallbackKind> = {
  key: 'keyboard', special: 'special', mouse: 'mouse', motion: 'motion', reshape: 'reshape', idle: 'idle',
};
const SPECIAL_ARG: Record<SpecialKey, string> = { up: 'GLUT_KEY_UP', down: 'GLUT_KEY_DOWN', left: 'GLUT_KEY_LEFT', right: 'GLUT_KEY_RIGHT' };
const BUTTON_ARG: Record<MouseButton, string> = { left: 'GLUT_LEFT_BUTTON', middle: 'GLUT_MIDDLE_BUTTON', right: 'GLUT_RIGHT_BUTTON' };
const STATE_ARG: Record<MouseState, string> = { down: 'GLUT_DOWN', up: 'GLUT_UP' };

export function createRunState(objects: SceneNode[], limits: ViewportLimits, window: { width: number; height: number }): RunState {
  const states: Record<string, RunObjectState> = {};
  const initial: Record<string, RunObjectState> = {};
  for (const o of programObjects(objects)) {
    const t = o.transform;
    const s: RunObjectState = {
      x: t.translateX, y: t.translateY, rotation: t.rotate, scaleX: t.scaleX, scaleY: t.scaleY,
      r: 0, g: 0, b: 0, useColor: false, visible: true,
    };
    states[o.id] = s;
    initial[o.id] = { ...s };
  }
  return { objects: states, initial, limits: { ...limits }, view: { ...limits }, window: { ...window }, statics: {} };
}

export function applyAction(
  s: RunObjectState, action: RuleAction, initial: RunObjectState, pointer: { x: number; y: number } | null,
): RunObjectState {
  switch (action.type) {
    case 'translate': return { ...s, x: s.x + q(action.dx, 2), y: s.y + q(action.dy, 2) };
    case 'rotate': return { ...s, rotation: s.rotation + q(action.degrees, 2) };
    case 'scale': return { ...s, scaleX: s.scaleX * q(action.sx, 2), scaleY: s.scaleY * q(action.sy, 2) };
    case 'moveToPointer': return pointer ? { ...s, x: pointer.x, y: pointer.y } : s;
    case 'reset': return { ...initial };
    case 'setColor': return { ...s, r: unit(action.color, 1), g: unit(action.color, 3), b: unit(action.color, 5), useColor: true };
    case 'visibility':
      return { ...s, visible: action.mode === 'show' ? true : action.mode === 'hide' ? false : !s.visible };
  }
}

/** The generated windowToWorld: GLUT's origin is top-left, world y points up. */
export function windowToWorld(view: RunView, window: { width: number; height: number }, x: number, y: number) {
  const w = window.width > 0 ? window.width : 1;
  const h = window.height > 0 ? window.height : 1;
  return { x: view.minX + ((view.maxX - view.minX) * x) / w, y: view.maxY - ((view.maxY - view.minY) * y) / h };
}

/** The generated Keep proportions reshape body. */
export function keepProportionsView(limits: RunView, width: number, height: number): RunView {
  const aspect = width / (height > 0 ? height : 1);
  const cx = q((limits.minX + limits.maxX) / 2, 4);
  const cy = q((limits.minY + limits.maxY) / 2, 4);
  let halfW = q((limits.maxX - limits.minX) / 2, 4);
  let halfH = q((limits.maxY - limits.minY) / 2, 4);
  if (aspect >= halfW / halfH) halfW = halfH * aspect;
  else halfH = halfW / aspect;
  return { minX: cx - halfW, maxX: cx + halfW, minY: cy - halfH, maxY: cy + halfH };
}

function matches(trigger: RuleTrigger, event: RunEvent): boolean {
  switch (event.type) {
    case 'key': return trigger.kind === 'keyboard' && trigger.key === event.key.toLowerCase();
    case 'special': return trigger.kind === 'special' && trigger.key === event.key;
    case 'mouse': return trigger.kind === 'mouse' && trigger.button === event.button && trigger.state === event.state;
    case 'motion': return trigger.kind === 'motion';
    case 'idle': return trigger.kind === 'idle';
    default: return false;
  }
}

function callText(name: string, event: RunEvent): string | null {
  switch (event.type) {
    case 'key': return `${name}('${event.key}', ${event.x}, ${event.y})`;
    case 'special': return `${name}(${SPECIAL_ARG[event.key]}, ${event.x}, ${event.y})`;
    case 'mouse': return `${name}(${BUTTON_ARG[event.button]}, ${STATE_ARG[event.state]}, ${event.x}, ${event.y})`;
    case 'motion': return `${name}(${event.x}, ${event.y})`;
    case 'reshape': return `${name}(${event.width}, ${event.height})`;
    case 'idle': return null;
  }
}

const NONE = (state: RunState): DispatchResult => ({ state, kind: null, handlerName: null, call: null, matched: null });

export function dispatch(state: RunState, callbacks: CallbacksState, event: RunEvent): DispatchResult {
  const kind = EVENT_KIND[event.type];
  const valid = isCallbackValid(callbacks, kind);
  const name = callbacks[kind].handlerName.trim();
  if (event.type === 'reshape') {
    const keep = valid && callbacks.reshape.resize === 'keep';
    const next: RunState = {
      ...state,
      window: { width: event.width, height: event.height },
      view: keep ? keepProportionsView(state.limits, event.width, event.height) : { ...state.limits },
    };
    return valid ? { state: next, kind, handlerName: name, call: callText(name, event), matched: null } : NONE(next);
  }
  if (!valid) return NONE(state);
  const rules = callbacks[kind as RuleCallbackKind].rules.filter((r) => matches(r.trigger, event) && state.objects[r.objectId]);
  const pointer = event.type === 'mouse' || event.type === 'motion'
    ? windowToWorld(state.view, state.window, event.x, event.y)
    : null;
  let next = state;
  if (rules.length > 0) {
    const objects = { ...state.objects };
    for (const r of rules) objects[r.objectId] = applyAction(objects[r.objectId], r.action, state.initial[r.objectId], pointer);
    next = { ...state, objects };
  }
  return { state: next, kind, handlerName: name, call: callText(name, event), matched: rules[0]?.trigger ?? null };
}

/** One `_vams_idle` animator pass, mirroring generateIdleBody, statics included. */
export function stepAnimations(state: RunState, sceneObjects: SceneNode[]): RunState {
  const animated = programObjects(sceneObjects).filter((o) => o.type !== 'GROUP' && o.type !== 'TEXT' && o.animation);
  if (animated.length === 0) return state;
  const objects = { ...state.objects };
  const statics = { ...state.statics };
  for (const o of animated) {
    const current = objects[o.id];
    if (!current) continue;
    const { motion, speed } = o.animation!;
    const s = { ...current };
    const st = { ...(statics[o.id] ?? { t: 0 }) };
    const rotStep = q(ROTATE_STEP_PER_FRAME * speed, 2);
    const dt = q(TIME_STEP_PER_FRAME * speed, 3);
    switch (motion) {
      case 'rotate':
        s.rotation += rotStep;
        if (s.rotation >= 360) s.rotation -= 360;
        break;
      case 'pulse': {
        if (st.baseSX === undefined) st.baseSX = s.scaleX;
        if (st.baseSY === undefined) st.baseSY = s.scaleY;
        st.t += dt;
        const k = 1 + q(PULSE_AMPLITUDE, 2) * Math.sin(st.t);
        s.scaleX = st.baseSX * k;
        s.scaleY = st.baseSY * k;
        break;
      }
      case 'slide':
        if (st.baseX === undefined) st.baseX = s.x;
        st.t += dt;
        s.x = st.baseX + q(SLIDE_AMPLITUDE, 2) * Math.sin(st.t);
        break;
      case 'orbit':
        if (st.baseX === undefined) st.baseX = s.x;
        if (st.baseY === undefined) st.baseY = s.y;
        st.t += dt;
        s.x = st.baseX + q(ORBIT_RADIUS, 2) * Math.sin(st.t);
        s.y = st.baseY + q(ORBIT_RADIUS, 2) * (1 - Math.cos(st.t));
        break;
    }
    objects[o.id] = s;
    statics[o.id] = st;
  }
  return { ...state, objects, statics };
}

export function runStateColor(o: RunObjectState): string {
  return '#' + [o.r, o.g, o.b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}
```

The `TIME_STEP` checked by WB-CB-6 is `0.03` at speed 1, so the test's `2 * 0.03` is two frames.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/white-box/callbacks-runtime.test.ts`
Expected: PASS. If WB-CB-5 fails only on `rotate` near the 360 wrap, check that the runtime wraps after the add, as the C++ does.

- [ ] **Step 6: Run the checks and commit**

Run: `npm run lint && npm run build && npm test`. Expected: all pass.

```bash
git checkout -- tests/reports
git add src/features/callbacks/model/runtime.ts tests/helpers/mini-cpp.ts tests/white-box/callbacks-runtime.test.ts
git commit -m "feat(callbacks): add the pure Run runtime with C++ parity tests"
```

---

### Task 5: Render bridge additions and the Run controller

**Files:**
- Modify: `src/shared/engine/render-bridge.ts`, `src/shared/engine/pixi/hooks/useSceneRenderer.ts`
- Create: `src/features/callbacks/model/run-controller.ts`, `src/features/callbacks/model/useRunSnapshot.ts`, `src/features/callbacks/index.ts`
- Modify: `tests/helpers/fake-renderer.ts`
- Create: `tests/black-box/run-mode.test.ts`

**Interfaces:**
- Consumes: everything in `runtime.ts` (Task 4), `canRun` inputs from the store.
- Produces:
  - `renderBridge.setAppearance(id, { color: string | null; visible: boolean })`;
  - `renderBridge.setView(view: RunView, rect: { x; y; width; height })`;
  - `renderBridge.getCanvasSize(): { width; height } | null`.
- Produces (`run-controller.ts`):
  - `canRun(state: Pick<VamsState, 'objects' | 'callbacks'>): boolean`;
  - `interface RunFired { kind; handlerName; trigger: RuleTrigger | null; seq }`;
  - `interface RunSnapshot { running; lastCall; fired; window; canvas }`;
  - constants `MIN_WINDOW`, `RESIZE_STEP = 10`, `FLASH_MS = 700`;
  - `runController.start(options?: { loop?: boolean }): boolean`, `stop()`, `stepFrame()`;
  - pointer and window input: `pointerDown(button: number, x, y)`, `pointerUp(button, x, y)`, `pointerMove(x, y, dragging: boolean)`, `resizeWindow(width, height)`, `nudgeWindow(dx, dy)`;
  - snapshot access: `subscribe`, `getSnapshot`, `cleanup()`.
- Produces: `useRunSnapshot(): RunSnapshot`, and `features/callbacks/index.ts` re-exporting `runController`, `canRun`, `useRunSnapshot`, `RunSnapshot` and `RunFired`.

- [ ] **Step 1: Extend the fake renderer**

In `tests/helpers/fake-renderer.ts`, give `FakeDisplay` a `visible: boolean` (default `true` in `makeFakeDisplay`). Give `registerFakeRenderer` an optional second parameter, merged into the registration:

```ts
export interface FakeRendererExtras {
  setAppearance?: (id: string, appearance: { color: string | null; visible: boolean }) => void;
  setView?: (view: { minX: number; maxX: number; minY: number; maxY: number }, rect: { x: number; y: number; width: number; height: number }) => void;
  getCanvasSize?: () => { width: number; height: number };
  onResync?: () => void;
}
export function registerFakeRenderer(displays: Map<string, FakeDisplay>, extras: FakeRendererExtras = {}): () => void {
  return renderBridge.register({
    app: {} as never,
    getDisplayObject: (id) => displays.get(id) as never,
    setAppearance: extras.setAppearance,
    setView: extras.setView,
    getCanvasSize: extras.getCanvasSize,
    resync: () => {
      useVamsStore.getState().objects.forEach((obj) => {
        const d = displays.get(obj.id);
        if (!d) return;
        d.position.set(obj.transform.translateX, obj.transform.translateY);
        d.rotation = (obj.transform.rotate * Math.PI) / 180;
        d.scale.set(obj.transform.scaleX, obj.transform.scaleY);
        d.visible = obj.visible;
      });
      extras.onResync?.();
    },
  });
}
```

- [ ] **Step 2: Write the failing tests**

`tests/black-box/run-mode.test.ts`:

```ts
/**
 * BLACK-BOX TEST SUITE — BB-RUN
 * The canvas Run state: events reach handlers, the canvas moves, and scene state never changes.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { useVamsStore, STORAGE_KEY } from '@/core/store';
import { buildProjectFile } from '@/entities/project/model/project-io';
import { canRun, runController, MIN_WINDOW } from '@/features/callbacks/model/run-controller';
import { makeFakeDisplay, registerFakeRenderer, type FakeDisplay } from '../helpers/fake-renderer';
import { addTriangle, getState } from '../helpers/store';

let unregister: (() => void) | null = null;
afterEach(() => {
  runController.stop();
  unregister?.();
  unregister = null;
});

function setup(canvas = { width: 800, height: 600 }) {
  const t = addTriangle(0, 0, 0.2);
  const displays = new Map<string, FakeDisplay>([[t.id, makeFakeDisplay()]]);
  const setView = vi.fn();
  const setAppearance = vi.fn();
  const onResync = vi.fn();
  let size = canvas;
  unregister = registerFakeRenderer(displays, { setView, setAppearance, onResync, getCanvasSize: () => size });
  getState().setCallbackHandler('keyboard', 'onKey');
  getState().addCallbackRule('keyboard', {
    id: 'r', objectId: t.id, trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'translate', dx: 0.1, dy: 0 },
  });
  return { t, display: displays.get(t.id)!, setView, setAppearance, onResync, resize: (s: typeof canvas) => { size = s; } };
}
const press = (key: string, init: KeyboardEventInit = {}) => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  document.body.dispatchEvent(e);
  return e;
};

describe('BB-RUN-1: Run needs an object and a callback or an animation', () => {
  it('is off for an empty scene, a scene with nothing to run, or an invalid name', () => {
    expect(canRun(getState())).toBe(false);
    const t = addTriangle();
    expect(canRun(getState())).toBe(false);
    getState().setCallbackHandler('keyboard', 'main');
    expect(canRun(getState())).toBe(false);
    getState().setCallbackHandler('keyboard', 'onKey');
    expect(canRun(getState())).toBe(true);
    getState().clearCallback('keyboard');
    getState().setObjectAnimation(t.id, { motion: 'rotate', speed: 1 });
    expect(canRun(getState())).toBe(true);
  });
});

describe('BB-RUN-2: Starting Run calls Reshape once with the window size', () => {
  it('shows onReshape(800, 600)', () => {
    setup();
    getState().setCallbackHandler('reshape', 'onReshape');
    expect(runController.start({ loop: false })).toBe(true);
    expect(runController.getSnapshot().lastCall).toBe('onReshape(800, 600)');
    expect(runController.getSnapshot().window).toEqual({ width: 800, height: 600 });
  });
});

describe('BB-RUN-3: A key moves the target and names the branch', () => {
  it('moves the display object and sets fired', () => {
    const { display } = setup();
    runController.start({ loop: false });
    runController.pointerMove(412, 230, false);
    press('d');
    expect(display.position.x).toBeCloseTo(0.1, 6);
    const snap = runController.getSnapshot();
    expect(snap.lastCall).toBe("onKey('d', 412, 230)");
    expect(snap.fired).toMatchObject({ kind: 'keyboard', handlerName: 'onKey', trigger: { kind: 'keyboard', key: 'd' } });
  });
});

describe('BB-RUN-4: Run never writes the store', () => {
  it('keeps the persisted value and the project file identical', () => {
    setup();
    const persisted = () => localStorage.getItem(STORAGE_KEY);
    const file = () => JSON.stringify({ ...buildProjectFile(getState() as never), exportedAt: '' });
    const before = [persisted(), file()];
    runController.start({ loop: false });
    press('d');
    runController.pointerDown(0, 10, 10);
    runController.stepFrame();
    expect([persisted(), file()]).toEqual(before);
    runController.stop();
    expect([persisted(), file()]).toEqual(before);
  });
});

describe('BB-RUN-5: Stop, Esc and undo end Run and restore the canvas', () => {
  it.each(['stop', 'escape', 'undo'] as const)('%s', async (how) => {
    const { display, onResync } = setup();
    await new Promise((r) => setTimeout(r, 60));
    getState().setCallbackHandler('mouse', 'onMouse');
    runController.start({ loop: false });
    press('d');
    expect(display.position.x).toBeCloseTo(0.1, 6);
    if (how === 'stop') runController.stop();
    if (how === 'escape') press('Escape');
    if (how === 'undo') getState().undo();
    expect(runController.getSnapshot().running).toBe(false);
    expect(onResync).toHaveBeenCalled();
    expect(display.position.x).toBeCloseTo(getState().objects[0].transform.translateX, 6);
  });
});

describe('BB-RUN-7: The program window resizes within its limits and follows the canvas', () => {
  it('clamps, fires Reshape on the next frame, and shrinks with the canvas', () => {
    const { resize } = setup();
    getState().setCallbackHandler('reshape', 'onReshape');
    runController.start({ loop: false });
    runController.resizeWindow(50, 5000);
    runController.stepFrame();
    expect(runController.getSnapshot().window).toEqual({ width: MIN_WINDOW.width, height: 600 });
    expect(runController.getSnapshot().lastCall).toBe('onReshape(200, 600)');
    runController.nudgeWindow(10, -10);
    runController.stepFrame();
    expect(runController.getSnapshot().window).toEqual({ width: 210, height: 590 });
    resize({ width: 640, height: 400 });
    runController.resizeWindow(800, 600);
    runController.stepFrame();
    expect(runController.getSnapshot().window).toEqual({ width: 640, height: 400 });
  });

  it('reapplies its view every frame', () => {
    const { setView } = setup();
    runController.start({ loop: false });
    setView.mockClear();
    runController.stepFrame();
    expect(setView).toHaveBeenCalledWith(expect.objectContaining({ minX: -1, maxX: 1 }), { x: 0, y: 0, width: 800, height: 600 });
  });
});

describe('BB-RUN-8: Esc, Tab and modified keys never reach a handler', () => {
  it('keeps the readout and the store unchanged', async () => {
    const { display } = setup();
    await new Promise((r) => setTimeout(r, 60));
    runController.start({ loop: false });
    const tab = press('Tab');
    expect(tab.defaultPrevented).toBe(false);
    press('z', { ctrlKey: true });
    press('d', { ctrlKey: true });
    expect(runController.getSnapshot().running).toBe(true);
    expect(runController.getSnapshot().lastCall).toBeNull();
    expect(display.position.x).toBeCloseTo(0, 6);
    expect(getState().objects).toHaveLength(1);
    press('Escape');
    expect(runController.getSnapshot().lastCall).toBeNull();
  });
});

describe('BB-RUN-9: A lesson step change stops Run', () => {
  it('stops when currentStepIndex changes', () => {
    setup();
    runController.start({ loop: false });
    useVamsStore.setState({ currentStepIndex: 1 });
    expect(runController.getSnapshot().running).toBe(false);
  });
});
```

The keyboard rule's object starts at `translateX = 0` (`addTriangle(0, 0, …)`), so BB-RUN-3 expects `0.1`.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/run-mode.test.ts`
Expected: FAIL. `run-controller` does not exist.

- [ ] **Step 4: Extend the render bridge**

In `src/shared/engine/render-bridge.ts`, add these to `RenderBridgeHandlers`. They are optional, so existing registrations keep compiling:

```ts
  /** Run: draw an object in one flat colour (or its own colours for null), shown or hidden. */
  setAppearance?: (id: string, appearance: { color: string | null; visible: boolean }) => void;
  /** Run: map `view` (world units) onto `rect` (canvas pixels, top-left origin). */
  setView?: (
    view: { minX: number; maxX: number; minY: number; maxY: number },
    rect: { x: number; y: number; width: number; height: number },
  ) => void;
  /** The canvas size in CSS pixels. */
  getCanvasSize?: () => { width: number; height: number };
```

Add to `renderBridge`:

```ts
  setAppearance(id: string, appearance: { color: string | null; visible: boolean }): void {
    handlers?.setAppearance?.(id, appearance);
  },
  setView(
    view: { minX: number; maxX: number; minY: number; maxY: number },
    rect: { x: number; y: number; width: number; height: number },
  ): void {
    handlers?.setView?.(view, rect);
  },
  getCanvasSize(): { width: number; height: number } | null {
    return handlers?.getCanvasSize?.() ?? null;
  },
```

Extend the header comment's rule 2: "`resync()` re-applies the store transforms and visibility, clears Run's appearance overrides and restores the editor's viewport transform."

- [ ] **Step 5: Implement the additions in the renderer**

In `useSceneRenderer.ts`:
- Add `const overriddenRef = useRef<Set<string>>(new Set());`.
- Add a helper inside the hook, reusing the rebuild steps the update effect already uses:

```ts
  const rebuildContent = (container: Container, node: SceneNode) => {
    const world = worldRef.current;
    if (!world || container.destroyed) return;
    container.removeChildren();
    const content = createDrawable(node, world.scale.x, { worldScaleY: world.scale.y });
    while (content.children.length > 0) container.addChild(content.children[0]);
    container.hitArea = content.hitArea;
    content.destroy();
  };
```

- Replace the `renderBridge.register({...})` call with this one, and add `applyViewportTransform` and `worldRef` to the effect's dependencies:

```ts
    const unregister = renderBridge.register({
      app,
      getDisplayObject: (id) => containersRef.current.get(id),
      setAppearance: (id, { color, visible }) => {
        const container = containersRef.current.get(id);
        if (!container || container.destroyed) return;
        container.visible = visible;
        const obj = useVamsStore.getState().objects.find((o) => o.id === id);
        if (!obj || obj.type === 'GROUP') return;
        if (color) {
          rebuildContent(container, { ...obj, vertices: obj.vertices.map((v) => ({ ...v, color })) });
          overriddenRef.current.add(id);
        } else if (overriddenRef.current.has(id)) {
          rebuildContent(container, obj);
          overriddenRef.current.delete(id);
        }
      },
      setView: (view, rect) => {
        const world = worldRef.current;
        if (!world) return;
        const vw = view.maxX - view.minX;
        const vh = view.maxY - view.minY;
        if (vw === 0 || vh === 0) return;
        const sx = rect.width / vw;
        const sy = rect.height / vh;
        world.scale.set(sx, -sy);
        world.position.set(rect.x - view.minX * sx, rect.y + rect.height + view.minY * sy);
      },
      getCanvasSize: () => ({ width: app.screen.width, height: app.screen.height }),
      resync: () => {
        const objects = useVamsStore.getState().objects;
        objects.forEach((obj) => {
          const container = containersRef.current.get(obj.id);
          if (!container || container.destroyed) return;
          const t = obj.transform;
          container.position.set(t.translateX, t.translateY);
          container.rotation = (t.rotate * Math.PI) / 180;
          container.scale.set(t.scaleX, t.scaleY);
          container.visible = obj.visible;
          if (overriddenRef.current.has(obj.id)) rebuildContent(container, obj);
        });
        overriddenRef.current.clear();
        applyViewportTransform();
      },
    });
```

- [ ] **Step 6: Write the Run controller**

`src/features/callbacks/model/run-controller.ts`:

```ts
import { useVamsStore } from '@/core/store';
import type { VamsState } from '@/core/store/types';
import type { GlutCallbackKind, MouseButton, RuleTrigger, SpecialKey } from '@/core/types/scene';
import { CALLBACK_KINDS, isCallbackValid, programObjects } from '@/core/callbacks/callbacks-model';
import { renderBridge } from '@/shared/engine/render-bridge';
import {
  createRunState, dispatch, runStateColor, stepAnimations, type RunEvent, type RunState,
} from './runtime';

/**
 * The canvas Run state. It owns the event listeners and the frame loop, keeps a temporary
 * run state, and draws it through the render bridge. Like the animation preview, it never
 * calls a scene-state setter: stopping resyncs the canvas from the store, which never changed.
 */
export interface RunFired {
  kind: GlutCallbackKind;
  handlerName: string;
  trigger: RuleTrigger | null;
  seq: number;
}
export interface RunSnapshot {
  running: boolean;
  lastCall: string | null;
  fired: RunFired | null;
  window: { width: number; height: number } | null;
  canvas: { width: number; height: number } | null;
}

export const MIN_WINDOW = { width: 200, height: 150 };
export const RESIZE_STEP = 10;
export const FLASH_MS = 700;
const FALLBACK_CANVAS = { width: 800, height: 600 };
const DEGREES_TO_RADIANS = Math.PI / 180;
const SPECIAL: Record<string, SpecialKey> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const KEYBOARD = /^[a-zA-Z0-9 ]$/;
const BUTTONS: MouseButton[] = ['left', 'middle', 'right'];
const STOPPED: RunSnapshot = { running: false, lastCall: null, fired: null, window: null, canvas: null };

export function canRun(state: Pick<VamsState, 'objects' | 'callbacks'>): boolean {
  if (state.objects.length === 0) return false;
  if (CALLBACK_KINDS.some((k) => isCallbackValid(state.callbacks, k))) return true;
  return programObjects(state.objects).some((o) => o.type !== 'GROUP' && o.type !== 'TEXT' && !!o.animation);
}

const clampSize = (size: { width: number; height: number }, canvas: { width: number; height: number }) => ({
  width: Math.round(Math.max(Math.min(MIN_WINDOW.width, canvas.width), Math.min(size.width, canvas.width))),
  height: Math.round(Math.max(Math.min(MIN_WINDOW.height, canvas.height), Math.min(size.height, canvas.height))),
});

class RunController {
  private run: RunState | null = null;
  private rafId: number | null = null;
  private storeUnsub: (() => void) | null = null;
  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  private pointer = { x: 0, y: 0 };
  private pendingMotion: { x: number; y: number } | null = null;
  private pendingSize: { width: number; height: number } | null = null;
  private applied = new Map<string, string>();
  private seq = 0;
  private listeners = new Set<() => void>();
  private snapshot: RunSnapshot = STOPPED;
  private readonly keyHandler = (event: KeyboardEvent) => this.onKey(event);

  start(options: { loop?: boolean } = {}): boolean {
    if (this.snapshot.running) return true;
    const state = useVamsStore.getState();
    if (!canRun(state)) return false;
    const canvas = renderBridge.getCanvasSize() ?? FALLBACK_CANVAS;
    this.run = createRunState(state.objects, state.viewportLimits, canvas);
    this.pointer = { x: 0, y: 0 };
    this.pendingMotion = null;
    this.pendingSize = null;
    this.applied = new Map(Object.keys(this.run.objects).map((id) => [id, 'null|true']));
    this.publish({ running: true, lastCall: null, fired: null, window: { ...canvas }, canvas: { ...canvas } });
    window.addEventListener('keydown', this.keyHandler, true);
    this.watchStore();
    // GLUT calls the reshape handler once when the window opens.
    this.handle({ type: 'reshape', width: canvas.width, height: canvas.height });
    if (options.loop !== false) this.startLoop();
    return true;
  }

  stop(): void {
    if (!this.snapshot.running) return;
    if (this.rafId !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.rafId);
    this.rafId = null;
    window.removeEventListener('keydown', this.keyHandler, true);
    this.storeUnsub?.();
    this.storeUnsub = null;
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.flashTimer = null;
    this.run = null;
    this.applied.clear();
    renderBridge.resync();
    this.publish(STOPPED);
  }

  pointerDown(button: number, x: number, y: number): void {
    const b = BUTTONS[button];
    this.pointer = { x, y };
    if (b) this.handle({ type: 'mouse', button: b, state: 'down', x, y });
  }

  pointerUp(button: number, x: number, y: number): void {
    const b = BUTTONS[button];
    this.pointer = { x, y };
    if (b) this.handle({ type: 'mouse', button: b, state: 'up', x, y });
  }

  /** Motion reaches the handler at most once per frame; the last position wins. */
  pointerMove(x: number, y: number, dragging: boolean): void {
    this.pointer = { x, y };
    if (dragging && this.snapshot.running) this.pendingMotion = { x, y };
  }

  resizeWindow(width: number, height: number): void {
    const canvas = this.snapshot.canvas;
    if (!this.snapshot.running || !canvas) return;
    this.pendingSize = clampSize({ width, height }, canvas);
  }

  nudgeWindow(dx: number, dy: number): void {
    const base = this.pendingSize ?? this.snapshot.window;
    if (base) this.resizeWindow(base.width + dx, base.height + dy);
  }

  /** One frame: canvas size, pending resize and motion, the idle pass, then a draw. */
  stepFrame(): void {
    if (!this.run || !this.snapshot.canvas || !this.snapshot.window) return;
    const canvas = renderBridge.getCanvasSize() ?? this.snapshot.canvas;
    if (canvas.width !== this.snapshot.canvas.width || canvas.height !== this.snapshot.canvas.height) {
      this.publish({ ...this.snapshot, canvas: { ...canvas } });
      this.pendingSize = clampSize(this.pendingSize ?? this.snapshot.window, canvas);
    }
    const size = this.pendingSize;
    this.pendingSize = null;
    const window = this.snapshot.window!;
    if (size && (size.width !== window.width || size.height !== window.height)) {
      this.handle({ type: 'reshape', width: size.width, height: size.height });
    }
    const motion = this.pendingMotion;
    this.pendingMotion = null;
    if (motion) this.handle({ type: 'motion', x: motion.x, y: motion.y });
    if (!this.run) return;
    const state = useVamsStore.getState();
    this.run = stepAnimations(this.run, state.objects);
    this.run = dispatch(this.run, state.callbacks, { type: 'idle' }).state;
    this.draw();
  }

  isRunning(): boolean {
    return this.snapshot.running;
  }

  cleanup(): void {
    this.stop();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): RunSnapshot => this.snapshot;

  private handle(event: RunEvent): void {
    if (!this.run) return;
    const result = dispatch(this.run, useVamsStore.getState().callbacks, event);
    this.run = result.state;
    let next = this.snapshot;
    if (event.type === 'reshape') next = { ...next, window: { ...this.run.window } };
    if (result.call && result.kind && result.handlerName) {
      next = {
        ...next,
        lastCall: result.call,
        fired: { kind: result.kind, handlerName: result.handlerName, trigger: result.matched, seq: ++this.seq },
      };
      this.armFlashClear();
    }
    if (next !== this.snapshot) this.publish(next);
    this.draw();
  }

  private onKey(event: KeyboardEvent): void {
    if (!this.snapshot.running || event.key === 'Tab') return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.stop();
      return;
    }
    // Stop and the window handle keep their own keys (Enter, Space, arrows); nothing is delivered.
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('button')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const { x, y } = this.pointer;
    const special = SPECIAL[event.key];
    if (special) this.handle({ type: 'special', key: special, x, y });
    else if (KEYBOARD.test(event.key)) this.handle({ type: 'key', key: event.key, x, y });
  }

  private draw(): void {
    const run = this.run;
    if (!run) return;
    for (const [id, o] of Object.entries(run.objects)) {
      const display = renderBridge.getDisplayObject(id);
      if (display && !display.destroyed) {
        display.position.set(o.x, o.y);
        display.rotation = o.rotation * DEGREES_TO_RADIANS;
        display.scale.set(o.scaleX, o.scaleY);
      }
      const color = o.useColor ? runStateColor(o) : null;
      const key = `${color}|${o.visible}`;
      if (this.applied.get(id) !== key) {
        this.applied.set(id, key);
        renderBridge.setAppearance(id, { color, visible: o.visible });
      }
    }
    const window = this.snapshot.window;
    if (window) renderBridge.setView(run.view, { x: 0, y: 0, width: window.width, height: window.height });
  }

  private armFlashClear(): void {
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => {
      this.flashTimer = null;
      if (this.snapshot.fired) this.publish({ ...this.snapshot, fired: null });
    }, FLASH_MS);
  }

  private startLoop(): void {
    if (typeof requestAnimationFrame !== 'function') return;
    const frame = () => {
      if (!this.snapshot.running) return;
      this.stepFrame();
      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  /** Any change to the scene, the course position or history ends the run. */
  private watchStore(): void {
    this.storeUnsub = useVamsStore.subscribe((state, prev) => {
      if (
        state.objects !== prev.objects ||
        state.callbacks !== prev.callbacks ||
        state.viewportLimits !== prev.viewportLimits ||
        state.selectedObjectId !== prev.selectedObjectId ||
        state.appMode !== prev.appMode ||
        state.activeSection !== prev.activeSection ||
        state.activeLessonId !== prev.activeLessonId ||
        state.currentStepIndex !== prev.currentStepIndex ||
        state.past !== prev.past ||
        state.future !== prev.future
      ) {
        this.stop();
      }
    });
  }

  private publish(next: RunSnapshot): void {
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }
}

/** App-wide singleton. */
export const runController = new RunController();
```

`useRunSnapshot.ts`:

```ts
import { useSyncExternalStore } from 'react';
import { runController, type RunSnapshot } from './run-controller';

export function useRunSnapshot(): RunSnapshot {
  return useSyncExternalStore(runController.subscribe, runController.getSnapshot);
}
```

`index.ts`:

```ts
export { runController, canRun, type RunSnapshot, type RunFired } from './model/run-controller';
export { useRunSnapshot } from './model/useRunSnapshot';
```

The `display` from `getDisplayObject` is a Pixi `Container`, which has `destroyed`. The fake display has it too.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/run-mode.test.ts tests/black-box/animation-preview.test.ts tests/white-box/animation-preview-internals.test.ts`
Expected: PASS.

- [ ] **Step 8: Run the checks and commit**

Run: `npm run lint && npm run build && npm test`. Expected: all pass.

```bash
git checkout -- tests/reports
git add src/shared/engine/render-bridge.ts src/shared/engine/pixi/hooks/useSceneRenderer.ts src/features/callbacks/model src/features/callbacks/index.ts tests/helpers/fake-renderer.ts tests/black-box/run-mode.test.ts
git commit -m "feat(callbacks): add the Run controller and its render bridge hooks"
```

---

### Task 6: The Run overlay, paused editing and the code flash

**Files:**
- Create: `src/features/callbacks/ui/RunOverlay.tsx`, `src/features/callbacks/ui/run-overlay.scss`
- Modify: `src/features/callbacks/ui/CallbacksPanel.tsx` (Try it)
- Modify: `src/widgets/canvas/ui/CanvasOverlays.tsx`, `src/widgets/canvas/VamsCanvas.tsx`
- Modify: `src/features/animation-preview/ui/animation-code-overlay.scss` (`top: 3.5rem`)
- Modify: `src/widgets/layout/top-bar/TopBar.tsx`, `src/widgets/layout/code-math-column/CodeMathColumn.tsx`, `src/pages/editor/ui/EditorShell.tsx`
- Modify: `src/features/code-generation/ui/SceneCodePanel.tsx`
- Test: `tests/black-box/run-mode.test.ts` (BB-RUN-6, 10, 11, 12)

**Interfaces:**
- Consumes: `runController`, `canRun`, `useRunSnapshot`, `RESIZE_STEP` (Task 5); `locateHandlerBranch` (Task 2).
- Produces:
  - `RunOverlay({ onBeforeStart?: () => void })` (default export), plus the exported strings `RUN_HINT`, `RUN_SURFACE_LABEL` and `RUN_DISABLED_TITLE`;
  - `SceneCodePanel({ flashBranch?: { handlerName: string; trigger: RuleTrigger | null; seq: number } | null })`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/black-box/run-mode.test.ts`:

```ts
import { h, render, type VNode } from 'preact';
import RunOverlay from '@/features/callbacks/ui/RunOverlay';
import SceneCodePanel from '@/features/code-generation/ui/SceneCodePanel';
import EditorShell from '@/pages/editor/ui/EditorShell';

const settle = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); };
function mount(vnode: VNode) {
  const host = document.createElement('div');
  host.style.position = 'relative';
  document.body.appendChild(host);
  render(vnode, host);
  return host;
}
const isInert = (el: Element | null) => !!el && ((el as HTMLElement & { inert?: boolean }).inert === true || el.hasAttribute('inert'));

describe('BB-RUN-6: Editing pauses while running', () => {
  it('makes the column inert, and Delete and Ctrl+Z never reach other listeners', async () => {
    const { t } = setup();
    useVamsStore.setState({ selectedObjectId: t.id });
    const host = mount(h(EditorShell, {
      topBar: h('header', { class: 'top-bar' }, h('div', { class: 'top-bar__actions' }, 'actions')),
      column: h('div', {}, 'column'),
      canvas: h('div', {}, 'canvas'),
      codeMath: h('div', {}, 'code'),
    }));
    runController.start({ loop: false });
    await settle();
    expect(isInert(host.querySelector('#editor-column'))).toBe(true);
    const later = vi.fn();
    window.addEventListener('keydown', later);
    press('Delete');
    press('z', { ctrlKey: true });
    window.removeEventListener('keydown', later);
    expect(later).not.toHaveBeenCalled();
    expect(runController.getSnapshot().running).toBe(true);
    render(null, host);
    host.remove();
  });
});

describe('BB-RUN-10: Pointer events reach the Mouse handler, even released outside', () => {
  it('delivers down and up with window coordinates', async () => {
    const { t } = setup();
    getState().setCallbackHandler('mouse', 'onMouse');
    getState().addCallbackRule('mouse', {
      id: 'm', objectId: t.id, trigger: { kind: 'mouse', button: 'left', state: 'up' }, action: { type: 'rotate', degrees: 15 },
    });
    const host = mount(h(RunOverlay, {}));
    runController.start({ loop: false });
    await settle();
    const surface = host.querySelector('.run-surface') as HTMLElement;
    surface.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 30, clientY: 40, pointerId: 1 }));
    surface.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: 5000, clientY: 40, pointerId: 1 }));
    expect(runController.getSnapshot().lastCall).toMatch(/^onMouse\(GLUT_LEFT_BUTTON, GLUT_UP, \d+, 40\)$/);
    expect(runController.getSnapshot().fired?.trigger).toEqual({ kind: 'mouse', button: 'left', state: 'up' });
    render(null, host);
    host.remove();
  });
});

describe('BB-RUN-11: The overlay shows Run, then the strip, the readout and the handle', () => {
  it('starts, shows "Waiting for an event", resizes by keys in 10px steps, and stops', async () => {
    setup();
    const host = mount(h(RunOverlay, {}));
    await settle();
    const run = host.querySelector('.run-button') as HTMLButtonElement;
    expect(run.disabled).toBe(false);
    run.click();
    await settle();
    expect(host.querySelector('.run-strip')?.textContent).toContain('Running');
    expect(host.querySelector('.run-readout')?.textContent).toBe('Waiting for an event');
    expect(document.activeElement).toBe(host.querySelector('.run-surface'));
    const handle = host.querySelector('.run-handle') as HTMLButtonElement;
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    runController.stepFrame();
    await settle();
    expect(runController.getSnapshot().window).toEqual({ width: 790, height: 600 });
    const stop = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Stop'))!;
    stop.click();
    await settle();
    expect(runController.getSnapshot().running).toBe(false);
    expect(document.activeElement).toBe(host.querySelector('.run-button'));
    render(null, host);
    host.remove();
  });

  it('is disabled with a title when nothing can run', async () => {
    const host = mount(h(RunOverlay, {}));
    await settle();
    const run = host.querySelector('.run-button') as HTMLButtonElement;
    expect(run.disabled).toBe(true);
    expect(run.title).toBe('Add a callback or an animation to run');
    render(null, host);
    host.remove();
  });
});

describe('BB-RUN-12: The code panel flashes the branch that fired', () => {
  it('highlights the case d lines', async () => {
    setup();
    const host = mount(h(SceneCodePanel, { flashBranch: { handlerName: 'onKey', trigger: { kind: 'keyboard', key: 'd' }, seq: 1 } }));
    await settle();
    const changed = [...host.querySelectorAll('.is-changed, [data-changed="true"]')].map((el) => el.textContent?.trim());
    expect(changed).toEqual(expect.arrayContaining(["case 'd':", "case 'D':", 'break;']));
    render(null, host);
    host.remove();
  });
});
```

Before running, read `src/shared/ui/code-viewer/CodeViewer.tsx` to find the class or attribute it puts on lines in `changedLines`, and use that selector in BB-RUN-12. The test asserts the line text, not the class name.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/run-mode.test.ts`
Expected: BB-RUN-6, 10, 11 and 12 FAIL.

- [ ] **Step 3: Write the overlay**

`src/features/callbacks/ui/RunOverlay.tsx`:

```tsx
import './run-overlay.scss';
import { useEffect, useRef } from 'react';
import { MoveDiagonal2, Play, Square } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import { Button } from '@/shared/ui/controls';
import { RESIZE_STEP, canRun, runController } from '../model/run-controller';
import { useRunSnapshot } from '../model/useRunSnapshot';

export const RUN_HINT = 'Keys, clicks and drags go to your handlers · Esc stops';
export const RUN_SURFACE_LABEL = 'Running program. Keys, clicks and drags go to your handlers. Press Escape to stop.';
export const RUN_DISABLED_TITLE = 'Add a callback or an animation to run';

const HANDLE_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-RESIZE_STEP, 0], ArrowRight: [RESIZE_STEP, 0], ArrowUp: [0, -RESIZE_STEP], ArrowDown: [0, RESIZE_STEP],
};

interface RunOverlayProps {
  /** Called before Run starts, for example to stop the animation preview. */
  onBeforeStart?: () => void;
}

export default function RunOverlay({ onBeforeStart }: RunOverlayProps) {
  const snap = useRunSnapshot();
  const runnable = useVamsStore((s) => canRun(s));
  const runButtonRef = useRef<HTMLButtonElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const wasRunning = useRef(false);

  useEffect(() => {
    if (snap.running && !wasRunning.current) surfaceRef.current?.focus();
    if (!snap.running && wasRunning.current) runButtonRef.current?.focus();
    wasRunning.current = snap.running;
  }, [snap.running]);

  if (!snap.running || !snap.window) {
    return (
      <Button
        ref={runButtonRef}
        variant="primary"
        className="run-button"
        icon={<Play />}
        disabled={!runnable}
        title={runnable ? undefined : RUN_DISABLED_TITLE}
        onClick={() => {
          onBeforeStart?.();
          runController.start();
        }}
      >
        Run
      </Button>
    );
  }

  const win = snap.window;
  const local = (event: PointerEvent) => {
    const rect = surfaceRef.current!.getBoundingClientRect();
    return { x: Math.round(event.clientX - rect.left), y: Math.round(event.clientY - rect.top) };
  };
  const startDrag = (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const start = { x: event.clientX, y: event.clientY, width: win.width, height: win.height };
    const move = (e: PointerEvent) =>
      runController.resizeWindow(start.width + e.clientX - start.x, start.height + e.clientY - start.y);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const onHandleKey = (event: KeyboardEvent) => {
    const step = HANDLE_KEYS[event.key];
    if (!step) return;
    event.preventDefault();
    runController.nudgeWindow(step[0], step[1]);
  };

  return (
    <div className="run-layer">
      <p className="sr-only" role="status" aria-live="polite">Running</p>
      <div className="run-window" style={{ width: `${win.width}px`, height: `${win.height}px` }}>
        <div
          ref={surfaceRef}
          className="run-surface"
          tabIndex={0}
          aria-label={RUN_SURFACE_LABEL}
          onPointerDown={(e) => {
            try {
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            } catch {
              // No active pointer to capture (synthetic events); delivery still works.
            }
            const p = local(e);
            runController.pointerDown(e.button, p.x, p.y);
          }}
          onPointerUp={(e) => {
            const p = local(e);
            runController.pointerUp(e.button, p.x, p.y);
          }}
          onPointerMove={(e) => {
            const p = local(e);
            runController.pointerMove(p.x, p.y, e.buttons !== 0);
          }}
          onContextMenu={(e) => e.preventDefault()}
        />
        <button
          type="button"
          className="run-handle"
          aria-label="Resize the program window"
          onPointerDown={startDrag}
          onKeyDown={onHandleKey}
        >
          <MoveDiagonal2 size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="run-strip">
        <span className="run-strip__dot" aria-hidden="true" />
        <span className="run-strip__title">Running</span>
        <span className="run-strip__hint">{RUN_HINT}</span>
        <Button className="run-strip__stop" icon={<Square />} onClick={() => runController.stop()}>Stop</Button>
      </div>
      <p className="run-readout">{snap.lastCall ?? 'Waiting for an event'}</p>
    </div>
  );
}
```

`run-overlay.scss`:

```scss
@use '../../../shared/styles/tokens' as *;

.run-button {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  z-index: 25;
}

.run-layer {
  position: absolute;
  inset: 0;
  z-index: 30;
  overflow: hidden;

  // The cobalt ring around the running canvas.
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    box-shadow: inset 0 0 0 3px var(--accent);
    pointer-events: none;
  }
}

// The program window. Outside it the canvas reads as empty paper.
.run-window {
  position: absolute;
  top: 0;
  left: 0;
  box-shadow: 0 0 0 9999px var(--paper-sunken);
}

.run-surface {
  position: absolute;
  inset: 0;
  cursor: crosshair;
  touch-action: none;

  &:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: -6px;
  }
}

.run-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--accent);
  border-radius: var(--radius-s) 0 0 0;
  background: var(--paper-raised);
  color: var(--accent);
  cursor: nwse-resize;
  z-index: 2;

  &:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }
}

.run-strip {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  background: var(--accent);
  color: var(--on-accent);
  font-size: var(--text-sm);

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
  }

  &__title {
    font-weight: 600;
  }

  &__hint {
    opacity: 0.85;
  }

  &__stop {
    margin-left: auto;
  }
}

.run-readout {
  position: absolute;
  left: var(--space-2);
  right: var(--space-2);
  bottom: var(--space-2);
  z-index: 3;
  margin: 0;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--rule);
  border-radius: var(--radius-s);
  background: var(--paper-raised);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  pointer-events: none;
}
```

- [ ] **Step 4: Wire it in**

- **`CanvasOverlays.tsx`:** import `RunOverlay` from `@/features/callbacks/ui/RunOverlay` and `animationController` from `@/features/animation-preview/model/animation-controller`. Render `<RunOverlay onBeforeStart={() => animationController.stop()} />` after `<AnimationCodeOverlay />`.
- **`VamsCanvas.tsx`:** in the unmount cleanup effect, add `runController.cleanup();`, imported from `@/features/callbacks`.
- **`animation-code-overlay.scss`:** in `.anim-code-overlay`, change `top: 1rem;` to `top: 3.5rem;`, which clears the Run button.
- **`TopBar.tsx`:** `const running = useRunSnapshot().running;` and `<div className="top-bar__actions" inert={running || undefined}>`.
- **`CodeMathColumn.tsx`:**

```tsx
import SceneCodePanel from '@/features/code-generation/ui/SceneCodePanel';
import MathPanel from '@/features/math-panel/ui/MathPanel';
import { useRunSnapshot } from '@/features/callbacks';
import './code-math-column.scss';

/** The right column: generated code above, the math behind it below, each scrolling on its own. */
export default function CodeMathColumn() {
  const { running, fired } = useRunSnapshot();
  const flashBranch = fired ? { handlerName: fired.handlerName, trigger: fired.trigger, seq: fired.seq } : null;
  return (
    <div className="code-math-column">
      <div className="code-math-column__code">
        <SceneCodePanel flashBranch={flashBranch} />
      </div>
      <div className="code-math-column__math" inert={running || undefined}>
        <MathPanel />
      </div>
    </div>
  );
}
```

- **`EditorShell.tsx`:**
  - `const running = useRunSnapshot().running;`, then `<aside ... id="editor-column" inert={running || undefined}>`.
  - Close the narrow-screen drawer when Run starts, so it never covers the canvas. Next to the other state-compare blocks:

```tsx
  const [wasRunning, setWasRunning] = useState(running);
  if (running !== wasRunning) {
    setWasRunning(running);
    if (running) setDrawerOpen(false);
  }
```

- **`SceneCodePanel.tsx`:**
  - Accept `{ flashBranch }: { flashBranch?: { handlerName: string; trigger: RuleTrigger | null; seq: number } | null }`.
  - Compute:

```tsx
  const flashLines = useMemo(
    () => (flashBranch ? locateHandlerBranch(generatedCode, flashBranch.handlerName, flashBranch.trigger) : []),
    [flashBranch, generatedCode],
  );
  const changedLines = flashLines.length > 0 ? flashLines : isLessonMode ? changedCodeLines : previewChanged;
```

- **`CallbacksPanel.tsx`:** inside `.cb-info`, after the `<p>`, add the Try it button:

```tsx
<Button
  variant="quiet"
  className="cb-try"
  icon={<Play />}
  disabled={!runnable}
  title={runnable ? undefined : 'Add a callback or an animation to run'}
  onClick={() => runController.start()}
>
  Try it
</Button>
```

Here `const runnable = useVamsStore((s) => canRun(s));`, with `runController` and `canRun` imported from `../model/run-controller`. Give `.cb-info` a third grid row for the button: `grid-column: 2; justify-self: start;`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/run-mode.test.ts tests/black-box/editor-shell.test.ts tests/black-box/editor-panels.test.ts tests/black-box/animation-preview.test.ts`
Expected: PASS.

- [ ] **Step 6: Check it in the browser**

Start `npm run dev -- --port 5174` (never port 5173). Open `/app?scene=primitives` and run through:
- Deselect, open Callbacks, switch Special keys On and add → and ← rules.
- Press Run. Check the strip, the ring, the readout, the handle and the cobalt fill outside the window.
- Press → and ←. The shape moves, and the `case GLUT_KEY_RIGHT:` lines flash in the code panel.
- Drag the handle with Reshape on in each mode.
- Press Esc. The shape snaps back, and focus returns to Run.

Do this in both themes. Stop the dev server by PID: `netstat -ano | grep :5174`, then `taskkill //PID <pid> //F`.

- [ ] **Step 7: Run the checks and commit**

Run: `npm run lint && npm run build && npm test`. Expected: all pass.

```bash
git checkout -- tests/reports
git add src/features/callbacks src/widgets/canvas src/features/animation-preview/ui/animation-code-overlay.scss src/widgets/layout/top-bar/TopBar.tsx src/widgets/layout/code-math-column/CodeMathColumn.tsx src/pages/editor/ui/EditorShell.tsx src/features/code-generation/ui/SceneCodePanel.tsx tests/black-box/run-mode.test.ts
git commit -m "feat(callbacks): run handlers on the canvas and flash the code that ran"
```

---

### Task 7: Lessons, help and the copy scan

**Files:**
- Modify: `src/features/lesson-engine/model/primitives-lessons.ts`, `src/features/lesson-engine/model/catalog.ts`
- Modify: `src/features/help/model/help-content.ts`
- Test: `tests/black-box/lesson-engine.test.ts` (BB-LESSON-07/08/09), `tests/black-box/callbacks.test.ts` (BB-CB-17)

**Interfaces:**
- Consumes: the store actions (Task 1), `isCallbackValid`, `newRuleId`, `CALLBACK_DEFS`, `CALLBACKS_NOTE`, the rule copy functions (Task 3), `RUN_HINT`, `RUN_SURFACE_LABEL`, `RUN_DISABLED_TITLE` (Task 6).
- Produces: lesson `primitives-exercise-6`, with catalog entry `{ id: 'primitives-exercise-6', title: 'Drive with the Arrow Keys', type: 'exercise', section: 'Primitives', steps: 3 }`; `primitives-demo-5` has 5 steps.

- [ ] **Step 1: Write the failing tests**

Append to `tests/black-box/lesson-engine.test.ts`:

```ts
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';

const lessonStep = (id: string, i: number) => LESSON_REGISTRY[id].steps[i];

describe('BB-LESSON-07: The callbacks demo builds onKey with a D case', () => {
  it('step 2 registers onKey and a D rule on Triangle', () => {
    lessonStep('primitives-demo-5', 1).action!(useVamsStore.getState());
    const s = getState();
    const code = generateCodeFromState(
      { objects: s.objects, canvasBackgroundColor: s.canvasBackgroundColor, callbacks: s.callbacks, viewportLimits: s.viewportLimits },
      { width: 800, height: 600 },
    );
    expect(code).toContain("void onKey(unsigned char key, int x, int y)");
    expect(code).toContain("    case 'd':\n    case 'D':\n        state_Triangle.x += 0.10f;");
    expect(code).toContain('glutKeyboardFunc(onKey);');
  });
});

describe('BB-LESSON-08: The mouse exercise needs a left-down Move to pointer rule', () => {
  it('fails without the rule and passes with it', () => {
    const check = lessonStep('primitives-exercise-5', 1).successCheck!;
    const t = addTriangle();
    getState().setCallbackHandler('mouse', 'onMouse');
    expect(check(useVamsStore.getState())).toBe(false);
    getState().addCallbackRule('mouse', { id: 'a', objectId: t.id, trigger: { kind: 'mouse', button: 'left', state: 'up' }, action: { type: 'moveToPointer' } });
    expect(check(useVamsStore.getState())).toBe(false);
    getState().addCallbackRule('mouse', { id: 'b', objectId: t.id, trigger: { kind: 'mouse', button: 'left', state: 'down' }, action: { type: 'moveToPointer' } });
    expect(check(useVamsStore.getState())).toBe(true);
  });
});

describe('BB-LESSON-09: Drive with the Arrow Keys', () => {
  it('needs Special keys, then → and ← translates on one object', () => {
    const first = lessonStep('primitives-exercise-6', 0).successCheck!;
    const second = lessonStep('primitives-exercise-6', 1).successCheck!;
    getState().setCallbackHandler('special', 'onSpecial');
    expect(first(useVamsStore.getState())).toBe(false);
    const t = addTriangle();
    expect(first(useVamsStore.getState())).toBe(true);
    getState().addCallbackRule('special', { id: 'r', objectId: t.id, trigger: { kind: 'special', key: 'right' }, action: { type: 'translate', dx: 0.1, dy: 0 } });
    expect(second(useVamsStore.getState())).toBe(false);
    getState().addCallbackRule('special', { id: 'l', objectId: t.id, trigger: { kind: 'special', key: 'left' }, action: { type: 'translate', dx: -0.1, dy: 0 } });
    expect(second(useVamsStore.getState())).toBe(true);
  });
});
```

The file already imports `LESSON_REGISTRY`; reuse that import.

Append to `tests/black-box/callbacks.test.ts`:

```ts
import { CALLBACK_DEFS, CALLBACKS_NOTE, actionSentence, triggerChip, triggerPhrase, invalidNameMessage } from '@/features/callbacks/model/rule-copy';
import { RUN_HINT, RUN_SURFACE_LABEL, RUN_DISABLED_TITLE } from '@/features/callbacks/ui/RunOverlay';
import { HELP_TOPICS } from '@/features/help/model/help-content';
import { PRIMITIVES_LESSONS } from '@/features/lesson-engine/model/primitives-lessons';

describe('BB-CB-17: No banned word in callbacks copy, help, narration or generated comments', () => {
  it('scans every string', () => {
    const banned = /coming soon|not yet|not supported|unsupported|future|deferred|\b3d\b|lighting/i;
    const t = addTriangle();
    const copy = [
      JSON.stringify(CALLBACK_DEFS), CALLBACKS_NOTE, RUN_HINT, RUN_SURFACE_LABEL, RUN_DISABLED_TITLE, invalidNameMessage('onKey'),
      triggerChip({ kind: 'idle' }), triggerPhrase({ kind: 'motion' }), actionSentence({ type: 'reset' }, 'T'),
      JSON.stringify(HELP_TOPICS.filter((topic) => topic.id === 'callbacks' || topic.id === 'canvas-basics')),
      JSON.stringify(['primitives-demo-5', 'primitives-exercise-5', 'primitives-exercise-6'].map((id) => PRIMITIVES_LESSONS[id].steps.map((s) => s.narration))),
    ];
    (['keyboard', 'special', 'mouse', 'motion', 'idle'] as const).forEach((k) => getState().setCallbackHandler(k, `h_${k}`));
    getState().setCallbackHandler('reshape', 'onReshape');
    const comments = (code: string) => code.split('\n').filter((l) => l.trim().startsWith('//')).join('\n');
    copy.push(comments(gen()));
    getState().setReshapeMode('stretch');
    getState().addCallbackRule('mouse', { id: 'p', objectId: t.id, trigger: { kind: 'mouse', button: 'left', state: 'down' }, action: { type: 'moveToPointer' } });
    copy.push(comments(gen()));
    for (const text of copy) expect(text).not.toMatch(banned);
  });
});
```

`help-content.ts` exports the topic list as `HELP_TOPICS`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/lesson-engine.test.ts tests/black-box/callbacks.test.ts`
Expected: BB-LESSON-07/08/09 FAIL. BB-CB-17 may pass or fail, depending on the old help text.

- [ ] **Step 3: Rewrite the lessons**

In `primitives-lessons.ts`, import `isCallbackValid` and `newRuleId` from `@/core/callbacks/callbacks-model`. Replace `primitives-demo-5` and `primitives-exercise-5`, and add `primitives-exercise-6` after exercise 5:

```ts
  'primitives-demo-5': {
    id: 'primitives-demo-5',
    title: 'Hooking Up Callbacks',
    type: 'demo',
    section: 'Primitives',
    steps: [
      {
        narration: "A graphics window isn't much fun if it can't react. GLUT uses callbacks: functions it calls when a key is pressed, the mouse moves or the window changes size.",
        waitForUser: true,
        focusPanel: 'callbacks-panel',
      },
      {
        narration: "Let's register a keyboard handler, onKey, with one rule: when D is pressed, move the triangle 0.10 to the right.",
        waitForUser: true,
        focusPanel: 'callbacks-panel',
        action: (state) => {
          state.addCustomObject('TRIANGLES', [
            { x: 0, y: 0.5 },
            { x: -0.5, y: -0.5 },
            { x: 0.5, y: -0.5 },
          ]);
          const store = useVamsStore.getState();
          const triangle = store.objects[0];
          store.updateObjectName(triangle.id, 'Triangle');
          store.selectObject(null);
          store.setCallbackHandler('keyboard', 'onKey');
          store.addCallbackRule('keyboard', {
            id: newRuleId(),
            objectId: triangle.id,
            trigger: { kind: 'keyboard', key: 'd' },
            action: { type: 'translate', dx: 0.1, dy: 0 },
          });
        },
      },
      {
        narration: 'Find onKey in the Code Panel. The rule became a case in a switch on key, and it changes state_Triangle.x. glutPostRedisplay asks GLUT to draw the next frame.',
        waitForUser: true,
      },
      {
        narration: 'Now find glutKeyboardFunc(onKey) in main(). That line tells GLUT which function to call when a key is pressed.',
        waitForUser: true,
      },
      {
        narration: 'Press Run on the canvas, then press D. The triangle moves and its case lights up in the Code Panel. Press Esc to stop: your scene is just as you built it.',
        waitForUser: true,
      },
    ],
  },
```

```ts
  'primitives-exercise-5': {
    id: 'primitives-exercise-5',
    title: 'Hooking up the Mouse',
    type: 'exercise',
    section: 'Primitives',
    steps: [
      {
        narration: 'We need the program to respond to mouse clicks. Open the Callbacks group.',
        waitForUser: true,
        focusPanel: 'callbacks-panel',
      },
      {
        narration: 'Add any shape, then click an empty part of the canvas to see the Callbacks group. Register a Mouse callback and give it a rule: when the left button goes down, move the shape to the pointer.',
        waitForUser: true,
        focusPanel: 'callbacks-panel',
        successCheck: (state) =>
          isCallbackValid(state.callbacks, 'mouse') &&
          state.callbacks.mouse.rules.some(
            (r) =>
              r.trigger.kind === 'mouse' && r.trigger.button === 'left' && r.trigger.state === 'down' &&
              r.action.type === 'moveToPointer' && state.objects.some((o) => o.id === r.objectId),
          ),
      },
      {
        narration: 'Press Run and click around the canvas. Each click calls your handler, which converts the pixel to world coordinates with windowToWorld.',
        waitForUser: true,
      },
    ],
  },
  'primitives-exercise-6': {
    id: 'primitives-exercise-6',
    title: 'Drive with the Arrow Keys',
    type: 'exercise',
    section: 'Primitives',
    steps: [
      {
        narration: 'Arrow keys have no ASCII code, so GLUT sends them to a separate callback, glutSpecialFunc. Add any shape, click an empty part of the canvas to see the Callbacks group, then switch on Special keys.',
        waitForUser: true,
        focusPanel: 'callbacks-panel',
        successCheck: (state) => state.objects.length > 0 && isCallbackValid(state.callbacks, 'special'),
      },
      {
        narration: 'Add two rules: → translates a shape right (a positive dx) and ← translates it left (a negative dx).',
        waitForUser: true,
        focusPanel: 'callbacks-panel',
        successCheck: (state) => {
          const rules = state.callbacks.special.rules;
          const moves = (key: 'left' | 'right', sign: number) =>
            rules.filter((r) => r.trigger.kind === 'special' && r.trigger.key === key && r.action.type === 'translate' && Math.sign(r.action.dx) === sign);
          const lefts = moves('left', -1);
          return moves('right', 1).some(
            (r) => lefts.some((l) => l.objectId === r.objectId) && state.objects.some((o) => o.id === r.objectId),
          );
        },
      },
      {
        narration: "Press Run and drive it with the arrow keys. You've mastered the Primitives section!",
        waitForUser: true,
      },
    ],
  },
```

The exercises' second narration differs from the spec's wording. A new shape is selected, and the Callbacks group only shows in scene settings, so the narration tells the student to click an empty part of the canvas.

In `catalog.ts`, change primitives-demo-5 to `steps: 5`, and insert after primitives-exercise-5:

```ts
  { id: 'primitives-exercise-6', title: 'Drive with the Arrow Keys', type: 'exercise', section: 'Primitives', steps: 3 },
```

If the lesson registry lists ids or an order explicitly (check `lesson-registry.ts` and any `LESSON_ORDER`), add `primitives-exercise-6` after `primitives-exercise-5` there too.

- [ ] **Step 4: Rewrite the help**

In `help-content.ts`, replace the `callbacks` topic:

```ts
  {
    id: 'callbacks',
    category: 'panels',
    title: 'GLUT Callbacks',
    summary: 'Give keyboard, mouse, idle and other handlers rules, see their code, and run them.',
    keywords: ['callback', 'glut', 'keyboard', 'mouse', 'idle', 'reshape', 'motion', 'event', 'handler', 'input',
      'glutkeyboardfunc', 'glutidlefunc', 'special', 'arrow', 'run', 'rule', 'glutspecialfunc'],
    blocks: [
      {
        kind: 'paragraph',
        text: 'GLUT programs respond to events through callbacks: functions you register so GLUT calls them when something happens. The Callbacks group in scene settings (select nothing to see it) has six.',
      },
      {
        kind: 'table',
        headers: ['Callback', 'Fires on', 'GLUT call'],
        rows: [
          ['Keyboard', 'A key press', 'glutKeyboardFunc'],
          ['Special keys', 'An arrow key', 'glutSpecialFunc'],
          ['Mouse', 'A button press or release', 'glutMouseFunc'],
          ['Motion', 'Dragging the mouse', 'glutMotionFunc'],
          ['Reshape', 'Resizing the window', 'glutReshapeFunc'],
          ['Idle', 'Every frame, when idle', 'glutIdleFunc'],
        ],
      },
      { kind: 'heading', text: 'Rules' },
      {
        kind: 'paragraph',
        text: "Switch a callback on and give it rules, such as \"when D is pressed, translate Triangle by 0.10, 0.00\". Each rule becomes lines in the handler's body that change the object's state, and glutPostRedisplay asks GLUT to draw the next frame. Translate, Rotate and Scale change the transform; Move to pointer (Mouse and Motion) converts the pixel GLUT reports to world coordinates; Reset, Set colour and Visibility change how the object is drawn.",
      },
      { kind: 'heading', text: 'Reshape' },
      {
        kind: 'paragraph',
        text: 'Reshape has a choice instead of rules. Keep proportions widens the viewing volume to match the window, so shapes never distort. Stretch only sets the viewport, so shapes stretch with the window.',
      },
      {
        kind: 'callout',
        tone: 'info',
        text: 'Run plays your handlers on the canvas. The exported program runs the same handlers when you compile it.',
      },
      { kind: 'heading', text: 'Idle and animation' },
      {
        kind: 'paragraph',
        text: 'The idle callback fires every frame and is how motion is driven. Saved object animations use the same idle mechanism, and your idle rules run right after them.',
      },
    ],
    related: ['section-primitives', 'animation', 'code-panel', 'glossary'],
  },
```

In the `canvas-basics` topic, add before its `{ kind: 'shortcuts' }` block:

```ts
      { kind: 'heading', text: 'Running your program' },
      {
        kind: 'paragraph',
        text: 'Press Run in the top-right corner of the canvas to play your callbacks and animations. Keys, clicks and drags go to your handlers, and the bar at the bottom shows the last call GLUT made. Drag the handle in the bottom-right corner to resize the program window. Press Esc or Stop to end the run: your scene is just as you built it.',
      },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/lesson-engine.test.ts tests/black-box/callbacks.test.ts tests/black-box/help-center.test.ts tests/black-box/learn-page.test.ts tests/black-box/learn-drawer.test.ts tests/algorithm/algorithm-3-lesson-step.test.ts`
Expected: PASS, including the catalog parity test.

- [ ] **Step 6: Run the checks and commit**

Run: `npm run lint && npm run build && npm test`. Expected: all pass.

```bash
git checkout -- tests/reports
git add src/features/lesson-engine/model/primitives-lessons.ts src/features/lesson-engine/model/catalog.ts src/features/help/model/help-content.ts tests/black-box/lesson-engine.test.ts tests/black-box/callbacks.test.ts
git commit -m "feat(lessons): teach callback rules and Run, and add Drive with the Arrow Keys"
```

Also stage `src/features/lesson-engine/model/lesson-registry.ts` if Step 3 touched it.

---

### Task 8: Docs and visual checks

**Files:**
- Modify: `docs/product-plan.md`, `docs/specs/2026-10-04-website-overhaul-roadmap.md`, `tests/README.md`
- Modify: `tests/visual/editor.spec.ts` (VIS-EDITOR-14/15/16)

**Interfaces:**
- Consumes: everything shipped in Tasks 1 to 7.
- Produces: no code.

- [ ] **Step 1: Amend the product plan (spec §7)**

In `docs/product-plan.md`, Stage 2:
- **Covers:** after `glutReshapeFunc`, add `glutSpecialFunc`.
- **Goal 5** becomes: "Students can register GLUT callbacks, give them rules built from menus, see the handler bodies those rules produce in the generated code, and play the handlers on the canvas with Run."
- **"Callback Panel Behavior"** is replaced with:

> The callbacks panel sits in the inspector's scene settings and lists six callbacks: Keyboard (`glutKeyboardFunc`), Special keys (`glutSpecialFunc`), Mouse (`glutMouseFunc`), Motion (`glutMotionFunc`), Reshape (`glutReshapeFunc`) and Idle (`glutIdleFunc`). Each has a handler name. Every callback except Reshape holds up to eight rules built from menus: a trigger (a key, an arrow key, a mouse button and state, each drag movement, or each frame), an action (translate, rotate, scale, move to pointer, reset, set colour, show, hide or toggle), and a target object. Reshape offers a choice instead: Keep proportions or Stretch. The code generator turns each rule into lines in the handler's body that change the target's `state_<name>`.
>
> The panel includes a persistent note: "Each callback's rules become the body of its handler in the generated code. Press Run on the canvas to try them: keys, clicks and drags go to your handlers, and your scene is unchanged when you stop." This is accurate framing, not a feature disclaimer.
>
> Run is a transient canvas state, not a mode. While it runs, keys, clicks, drags, window resizes and idle frames reach the handlers, editing pauses, the last GLUT call is shown, and the code that ran flashes in the code panel. Run never writes scene state: stopping returns the canvas to the scene as built.

- **Demos item 5** becomes: "**"Hooking Up Callbacks"**: registers a keyboard handler with a rule, narrates the generated switch case and its registration, and runs it."
- **Exercises item 5** becomes: "**"Hooking up the Mouse"**: register a Mouse callback with a rule that moves a shape to the pointer on a left-button press. Success when that rule exists on a valid handler." Then add item 6: "**"Drive with the Arrow Keys"**: register Special keys with a → rule that translates a shape right and a ← rule that translates the same shape left."
- **Acceptance Criteria:** change "Registering a callback inserts the `glut*Func` call and empty handler body into generated code." to "Registering a callback inserts the `glut*Func` call and a handler whose body is generated from its rules." Keep the note criterion, and add "Run plays keyboard, special key, mouse, motion, reshape and idle handlers on the canvas and restores the saved scene when it stops."
- **Persisted state table, View row:** "registered callback names" becomes "callbacks: handler names, rules and the reshape mode".

- [ ] **Step 2: Roadmap and divergences**

In `docs/specs/2026-10-04-website-overhaul-roadmap.md`:
- Should item 13 gains: ` Complete (2026-10-XX): [spec](2026-10-12-functional-callbacks-design.md), [plan](../plans/2026-10-12-functional-callbacks.md)`, using the merge date.
- Divergences 13 and 14 go after item 12, with the spec §8 text verbatim.

- [ ] **Step 3: Test map**

In `tests/README.md`, add to the tree:
- `callbacks.test.ts (BB-CB-*: callback rules, handler code, names)` and `run-mode.test.ts (BB-RUN-*: the canvas Run state)` under black-box;
- `callbacks-runtime.test.ts (WB-CB-*: the Run runtime against the generated C++)` under white-box;
- `fixtures/no-callbacks-program.cpp` and `helpers/mini-cpp.ts`, each with a one-line purpose.

Also mention VIS-EDITOR-14 to 16 where the visual suite is described.

- [ ] **Step 4: Visual checks**

Append to `tests/visual/editor.spec.ts`:

```ts
async function callbacksWithRules(page: Page) {
  // An empty spot selects nothing, which shows scene settings.
  await page.locator('.canvas-wrapper').click({ position: { x: 20, y: 300 } });
  await page.getByRole('button', { name: 'Callbacks' }).click();
  const special = page.locator('.cb-item', { has: page.locator('.cb-label', { hasText: 'Special keys' }) });
  await special.locator('.cb-toggle').click();
  await special.getByRole('button', { name: 'Add rule' }).click();
  await special.getByRole('button', { name: 'Done' }).click();
  await special.getByRole('button', { name: 'Add rule' }).click();
  return special;
}

test('VIS-EDITOR-14: Callbacks group with rules and an open form, light, 1280', async ({ page }) => {
  await open(page, '/app?scene=primitives');
  const special = await callbacksWithRules(page);
  await expect(special.locator('.cb-rule-form')).toBeVisible();
  await expect(page).toHaveScreenshot('callbacks-rules-light-1280.png');
});

for (const theme of ['light', 'dark'] as const) {
  test(`VIS-EDITOR-${theme === 'light' ? '15' : '16'}: Run after pressing →, ${theme}, 1280`, async ({ page }) => {
    await open(page, '/app?scene=primitives', theme);
    const special = await callbacksWithRules(page);
    await special.getByRole('button', { name: 'Done' }).click();
    await page.locator('.run-button').click();
    await expect(page.locator('.run-strip')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.run-readout')).toContainText('GLUT_KEY_RIGHT');
    await expect(page).toHaveScreenshot(`run-${theme}-1280.png`, { animations: 'disabled' });
  });
}
```

The panel header's accessible name may differ from "Callbacks" (check `CollapsibleSection`). If it does, locate it by `.vpanel[data-panel-id="callbacks-panel"] .vpanel__header`. The primitives preset may already select an object. The empty-canvas click deselects it; if it does not, press Escape or call the scene list's deselect.

Run: `npm run test:visual -- -g "VIS-EDITOR-1[456]" --update-snapshots`, then run it again without the flag.
Expected: the first run writes baselines into `tests/visual/baseline.local` (git-ignored). The second run passes. Look at the three PNGs and confirm the strip, ring, readout, handle, fill and flashed lines.

- [ ] **Step 5: Run the checks and commit**

Run: `npm run lint && npm run build && npm test`. Expected: all pass.

```bash
git checkout -- tests/reports
git add docs/product-plan.md docs/specs/2026-10-04-website-overhaul-roadmap.md tests/README.md tests/visual/editor.spec.ts
git commit -m "docs: amend the product plan for functional callbacks and record two divergences"
```

---

## Self-review notes

- **Spec coverage.** §1 → Task 1, §2 → Task 2, §3 → Task 3, §4 → Tasks 4–6, §5–6 → Task 7, §7–10 → Task 8. Spec §9's compile check is Task 2 Step 8.
- **Deviations from the spec text:**
  - **The Run button.** It uses `disabled` plus `title`, as the spec now says. `Button` has no `aria-disabled` prop.
  - **The exercise narration.** It tells students to click an empty part of the canvas to see the Callbacks group, because a new shape is selected and the group only shows in scene settings.
  - **The name error.** It names each callback's own default name. For Keyboard, that is exactly the spec's text.
- **Id numbering.**
  - BB-CB-13b extends BB-CB-13's intent into code generation.
  - BB-RUN-9 to 12 are new ids for the Review Focus items and the code flash.
  - BB-PANEL-23 to 28 are the next free numbers in `editor-panels.test.ts`.
