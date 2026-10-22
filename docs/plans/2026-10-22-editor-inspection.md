# Editor Inspection Follow-up Implementation Plan

**Goal:** Make the program window keep the viewing volume's shape, let the narrow drawer push the canvas aside, turn the Buffers choices into a stacked list, make every student-facing string British with a guard test, and tidy the textured program's header.

**Architecture:** A pure `fittedRect` beside `centredRect` computes the volume-shaped window; the runtime `useProgramWindow` store gains the volume's aspect and refits from it, and `ProgramWindow` places the maximised window too. The narrow layout is a stylesheet change in `editor-app.scss`. The Buffers rows reuse the existing `CardGroup` radiogroup with new row markup. The spelling guard parses the sources with the TypeScript compiler API and checks string literals and JSX text, plus the comments of a generated program.

**Tech Stack:** Preact (preact/compat), Zustand + Immer, SCSS tokens, Vitest + happy-dom, Playwright (visual, per-machine baselines).

**Spec:** [docs/specs/2026-10-22-editor-inspection-design.md](../specs/2026-10-22-editor-inspection-design.md). Its decisions and the calls marked as such are binding.

## Global Constraints

- Every rule in AGENTS.md applies: one-way data flow, generated code from state only, FSD layering through `@/`, tokens from `src/shared/styles/_tokens.scss` in both themes.
- Student-facing text never says "coming soon", "not supported", "future", "deferred", "3D" or "lighting", and uses British spelling.
- Font sizes only from `--text-*` tokens (BB-SHELL-22); no `text-transform: uppercase` (BB-SHELL-23).
- The program window's state stays runtime only, never saved: no store `version` bump, no migration.
- Existing test IDs never change. New tests take the next free number in their file: grep for the highest. Highest today: `BB-WINDOW-08`, `WB-WINDOW-04`, `BB-SHELL-44`, `BB-PANEL-37`, `BB-GEN-10`, `WB-CODE-32`, `VIS-EDITOR-31`.
- Visual tests run on port 4319 (`npm run test:visual`); baselines live in `tests/visual/baseline.local/` (git-ignored) and are re-recorded only where the change is intended, with `--update-snapshots=changed`. Never use port 5173.
- Before every commit: `npm run lint`, `npm run build`, `npm test` all pass; then `git checkout -- tests/reports`; stage paths explicitly (never `git add -A`, never `.gitignore`, `AGENTS.md` or `manuscript/`); read `git diff --staged`.
- Commits: Conventional Commits. No `Co-Authored-By`, no "Generated with", and no mention of an assistant, agent, skill or workflow in commits, comments or docs.
- Lands on `feat/editor-inspection` by the Oct 28 freeze.

## Review Focus

1. A stage smaller than its margins, or one read as 0 × 0 while hidden: the fitted window never has a negative size and the store keeps its last rect (pinned in Task 1).
2. The volume changed in Settings after the student placed the window: the window keeps the student's rect; while maximised it refits (pinned in Task 1).
3. Run with Reshape set to Keep proportions, then the window resized during Run: the window keeps the student's size and does not chase the run-time widened volume (pinned in Task 2).
4. Crossing 1100 px with the drawer open or closed: the panel and the canvas never overlap at either width (pinned in Task 3's visual test).
5. Buffers keyboard: arrows, Home and End still move and choose in the new rows, and Update Method still shows only for VBO with Dynamic (pinned in Task 4).

---

### Task 1: Volume-shaped window geometry and store

**Files:**
- Modify: `src/widgets/canvas/model/program-window.ts`
- Modify: `src/widgets/canvas/model/program-window-store.ts`
- Test: `tests/white-box/program-window.test.ts`

**Interfaces:**
- Produces:
  - `fittedRect(stage: Size, margin: number, aspect: number): Rect` in `program-window.ts`. `aspect` is the body's width ÷ height.
  - `volumeAspect(limits: { minX: number; maxX: number; minY: number; maxY: number }): number` in `program-window.ts`: `(maxX − minX) / (maxY − minY)`, returning `1` when the result is not finite and positive.
  - Store state `aspect: number` (initial `1`) and action `setAspect(aspect: number): void`.

- [ ] **Step 1: Write the failing tests** (append to `tests/white-box/program-window.test.ts`, stage `{ width: 1000, height: 600 }`)

```ts
describe('WB-WINDOW-05: fittedRect gives the body the volume\'s shape, centred', () => {
  const body = (r: Rect) => ({ width: r.width - 2 * FRAME_BORDER, height: r.height - BAR_HEIGHT - 2 * FRAME_BORDER });
  it('fits a square body to the stage height on a wide stage', () => {
    expect(fittedRect(stage, 24, 1)).toEqual({ x: 238, y: 24, width: 524, height: 552 });
  });
  it('fits a wide volume to the stage width on a tall stage', () => {
    const r = fittedRect({ width: 600, height: 1000 }, 24, 2);
    expect(body(r)).toEqual({ width: 550, height: 275 });
    expect(r.x).toBe(24);
    expect(r.y).toBe(Math.round((1000 - r.height) / 2));
  });
  it('keeps a 4:3 volume\'s ratio within a pixel', () => {
    const b = body(fittedRect(stage, 24, 4 / 3));
    expect(Math.abs(b.width / b.height - 4 / 3)).toBeLessThan(0.01);
  });
  it('lets an extreme volume fall below MIN_BODY rather than leave the stage', () => {
    const r = fittedRect(stage, 24, 20);
    expect(r.width).toBeLessThanOrEqual(1000 - 48);
    expect(body(r).height).toBeLessThan(MIN_BODY.height);
  });
  it('never goes negative on a stage smaller than the margins', () => {
    const r = fittedRect({ width: 30, height: 10 }, 24, 1);
    expect(r.width).toBeGreaterThanOrEqual(0);
    expect(r.height).toBeGreaterThanOrEqual(0);
  });
  it('fills a stage of the right shape edge to edge with no margin', () => {
    expect(fittedRect({ width: 502, height: 530 }, 0, 1)).toEqual({ x: 0, y: 0, width: 502, height: 530 });
  });
});

describe('WB-WINDOW-06: volumeAspect reads the viewing volume', () => {
  it('is width over height', () => {
    expect(volumeAspect({ minX: -1, maxX: 1, minY: -1, maxY: 1 })).toBe(1);
    expect(volumeAspect({ minX: 0, maxX: 4, minY: 0, maxY: 3 })).toBeCloseTo(4 / 3);
  });
  it('falls back to 1 for an empty volume', () => {
    expect(volumeAspect({ minX: 0, maxX: 0, minY: 0, maxY: 1 })).toBe(1);
  });
});

describe('WB-WINDOW-07: The store refits to the volume until the student places the window', () => {
  // reset, setStage(stage) before each
  it('opens volume-shaped and refits when the volume changes', () => {
    expect(s().rect).toEqual(fittedRect(stage, STAGE_MARGIN, 1));
    s().setAspect(2);
    expect(s().rect).toEqual(fittedRect(stage, STAGE_MARGIN, 2));
  });
  it('keeps the student\'s rect when the volume changes after a move', () => {
    s().moveTo(s().rect!.x + 10, s().rect!.y);
    const placed = s().rect;
    s().setAspect(2);
    expect(s().rect).toEqual(placed);
  });
  it('restoring from maximised clears the placement and refits', () => {
    s().resizeTo({ x: 10, y: 10, width: 700, height: 300 });
    s().toggleMaximise();
    s().toggleMaximise();
    expect(s().placedByUser).toBe(false);
    expect(s().rect).toEqual(fittedRect(stage, STAGE_MARGIN, 1));
  });
  it('ignores a 0 by 0 stage read and keeps the rect', () => {
    const before = s().rect;
    s().setStage({ width: 0, height: 0 });
    expect(s().rect).toEqual(before);
  });
});
```

(`s` is `() => useProgramWindow.getState()`; import `FRAME_BORDER`, `MIN_BODY`, `fittedRect`, `volumeAspect`, `type Rect`.)

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run tests/white-box/program-window.test.ts`
Expected: FAIL, `fittedRect` and `volumeAspect` are not exported.

- [ ] **Step 3: Implement**

- `fittedRect`: the window space is the stage less `margin` on each side; the body space is that less `2 * FRAME_BORDER` across and `BAR_HEIGHT + 2 * FRAME_BORDER` down (each floored at 0). The body is the largest rect of `aspect` inside the body space; the window adds the chrome back; it is centred on the stage (`x = (stage.width − width) / 2`, same for y). Round every value.
- Store: `setStage` uses `fittedRect(stage, STAGE_MARGIN, aspect)` where it used `centredRect` (placed rects still go through `clampRect`). `setAspect` stores the aspect and, when the stage is known and `placedByUser` is false, refits. `toggleMaximise` from `maximised` returns `{ mode: 'floating', shownAs: 'floating', placedByUser: false, rect: fittedRect(stage, STAGE_MARGIN, aspect) }` (keep `rect` if no stage yet). `aspect: 1` is in `initial`, so `reset` restores it. Keep `centredRect` exported; its tests stay.
- Update the doc comment on `placedByUser`: "until then it stays fitted to the viewing volume".

- [ ] **Step 4: Run the file and the window suites**

Run: `npx vitest run tests/white-box/program-window.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/canvas/model/program-window.ts src/widgets/canvas/model/program-window-store.ts tests/white-box/program-window.test.ts
git commit -m "feat(canvas): fit the program window to the viewing volume's shape"
```

(Black-box window tests that pin the old full-stage rect are updated in Task 2, which wires the aspect in; if they fail here because of the store change, update them in this task instead and say so in the report.)

---

### Task 2: The window follows the volume, maximised included

**Files:**
- Modify: `src/widgets/canvas/ui/ProgramWindow.tsx`
- Modify: `src/widgets/canvas/ui/canvas-window.scss:24-31`
- Modify: `src/features/lesson-engine/model/primitives-lessons.ts` (primitives-demo-7, step 4 narration)
- Modify: `docs/product-plan.md:128`
- Test: `tests/black-box/program-window.test.ts`, `tests/visual/editor.spec.ts`

**Interfaces:**
- Consumes: `fittedRect`, `volumeAspect`, store `aspect` / `setAspect` from Task 1.

- [ ] **Step 1: Write the failing tests**

In `tests/black-box/program-window.test.ts` (stage 1000 × 600 as today):
- Update BB-WINDOW-01 and every test that expects `952px` / `{ x: 24, y: 24, width: 952, height: 552 }` to the fitted window for the default −1..1 volume: `{ x: 238, y: 24, width: 524, height: 552 }`.
- Add:

```ts
describe('BB-WINDOW-09: The window keeps the viewing volume\'s shape', () => {
  it('reshapes when the volume changes in Settings', async () => {
    const host = mountWindow();
    await settle();
    useVamsStore.getState().setViewportLimits({ minX: 0, maxX: 2, minY: -0.5, maxY: 0.5 });
    await settle();
    const el = windowEl(host);
    const w = parseFloat(el.style.width) - 2;
    const h = parseFloat(el.style.height) - 30;
    expect(Math.abs(w / h - 2)).toBeLessThan(0.01);
    unmount(host);
  });
  it('maximised, takes the largest window of that shape on the stage, centred, and keeps refitting', async () => {
    const host = mountWindow();
    await settle();
    button(host, 'Maximise').click();
    await settle();
    expect(windowEl(host).style.width).toBe(`${fittedRect(STAGE, 0, 1).width}px`);
    windowState().setStage({ width: 800, height: 500 });
    await settle();
    expect(windowEl(host).style.height).toBe(`${fittedRect({ width: 800, height: 500 }, 0, 1).height}px`);
    unmount(host);
  });
  it('a window resized during a Keep proportions run keeps the student\'s size', async () => {
    // Pattern of BB-WINDOW-05: addTriangle, a keyboard handler, registerFakeRenderer, then:
    // setReshapeMode('keep'); runController.start(...); resizeTo({ x: 10, y: 10, width: 900, height: 300 });
    // await settle(); expect(windowState().rect).toEqual({ x: 10, y: 10, width: 900, height: 300 });
    // expect(windowState().aspect).toBe(1);
  });
});
```

Use the real action names the store has for the viewing volume and for starting Run (grep `setViewportLimits` / `updateViewportLimits` and BB-WINDOW-05's start call; write the third test in full from that pattern).

- Update BB-WINDOW's "maximise fills the stage" test title and assertions: maximised is the fitted window with no margin; Restore gives the fitted floating window.

In `tests/visual/editor.spec.ts`, add for `width` of 1280 and 960 (height 800, `openEmpty(page, 'light')`):

```ts
test(`VIS-EDITOR-32: The program window is the viewing volume's shape, ${width}`, async ({ page }) => {
  const body = (await page.locator('.canvas-window__body').boundingBox())!;
  expect(Math.abs(body.width / body.height - 1)).toBeLessThan(0.02);
  await page.getByRole('button', { name: 'Maximise' }).click();
  const max = (await page.locator('.canvas-window__body').boundingBox())!;
  expect(Math.abs(max.width / max.height - 1)).toBeLessThan(0.02);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run tests/black-box/program-window.test.ts`
Expected: FAIL on the new rect values and BB-WINDOW-09.

- [ ] **Step 3: Implement**

- `ProgramWindow`: read `viewportLimits` from `useVamsStore` and, in an effect, call `useProgramWindow.getState().setAspect(volumeAspect(viewportLimits))`. Read only `viewportLimits`, never the run's `stage.volume.limits`, so a Keep proportions run never reshapes the window.
- Placement: floating uses `rect` as today; maximised uses `fittedRect(stage, 0, aspect)` (read `stage` and `aspect` from the store), so it refits as the stage changes. Hidden windows keep today's behaviour.
- `canvas-window.scss`: the maximised window is now placed inline like the floating one; remove `&--maximised { inset: 0; }` and the rule that drops the maximised frame's border, radius and shadow, since it no longer fills the stage. Update the comments to say so. The handles stay off while maximised (CanvasWindow already does this).
- primitives-demo-7, step 4: the window now opens square, so reword the narration to: "Stretch keeps the viewing volume as it is and fills the window with it. If you drag the window wider, what happens to the triangle?" Options, `why` lines and `correctId` stay.
- `docs/product-plan.md:128`: "It opens floating and centred" becomes "It opens floating and centred, shaped like the viewing volume so a square draws square"; "minimise, maximise and restore it" gains ", where maximise gives the largest window of the volume's shape and restore returns to the fitted window".

- [ ] **Step 4: Run the suites**

Run: `npx vitest run tests/black-box/program-window.test.ts tests/black-box/canvas-window.test.ts tests/white-box/program-window.test.ts tests/black-box/lesson-rules.test.ts`
Expected: PASS. Then `npm run lint`, `npm run build`, `npm test`: PASS.
Run: `npx playwright test tests/visual/editor.spec.ts -g "VIS-EDITOR-32"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/canvas/ui/ProgramWindow.tsx src/widgets/canvas/ui/canvas-window.scss src/features/lesson-engine/model/primitives-lessons.ts docs/product-plan.md tests/black-box/program-window.test.ts tests/visual/editor.spec.ts
git commit -m "feat(canvas): keep the program window the viewing volume's shape, maximised too"
```

---

### Task 3: The narrow drawer takes its place beside the canvas

**Files:**
- Modify: `src/pages/editor/ui/editor-app.scss:60-107`
- Modify: `src/pages/editor/ui/EditorShell.tsx` (comments only)
- Modify: `src/shared/hooks/useNarrowLayout.ts` (doc comment only)
- Modify: `docs/product-plan.md:127`
- Test: `tests/visual/editor.spec.ts`

- [ ] **Step 1: Write the failing visual test** (in `tests/visual/editor.spec.ts`)

```ts
test('VIS-EDITOR-33: At 960 the open drawer sits beside the canvas, never over it', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await open(page, '/app?lesson=transforms-demo-1');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.editor__panel')).toBeVisible();
  const panel = (await page.locator('.editor__panel').boundingBox())!;
  const canvas = (await page.locator('.editor__canvas').boundingBox())!;
  const win = (await page.locator('.canvas-window').boundingBox())!;
  expect(panel.x + panel.width).toBeLessThanOrEqual(canvas.x + 0.5);
  expect(win.x).toBeGreaterThanOrEqual(canvas.x);
  expect(win.x + win.width).toBeLessThanOrEqual(canvas.x + canvas.width + 0.5);
  // Closing the drawer gives the room back.
  await page.keyboard.press('Escape');
  await expect(page.locator('.editor__panel')).toBeHidden();
  expect((await page.locator('.editor__canvas').boundingBox())!.width).toBeGreaterThan(canvas.width + 200);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx playwright test tests/visual/editor.spec.ts -g "VIS-EDITOR-33"`
Expected: FAIL, the panel's right edge is past the canvas's left edge.

- [ ] **Step 3: Implement**

- In `.editor--narrow`, drop `--editor-panel-width: 0px` so the open drawer takes its 272 px track; `.is-panel-hidden` still sets it to `0px`.
- Make `.is-panel-hidden .editor__panel { display: none; }` apply at every width (drop `:not(.editor--narrow)`).
- Remove the narrow drawer's absolute placement, its transform/visibility slide, its transition and the reduced-motion rule for it, and its `padding-bottom: var(--lesson-bar-height)`: the lesson bar sits in the canvas column and no longer overlaps the panel. Keep a narrow-only shadow only if it still reads right beside the canvas; otherwise drop it (the wide layout's `border-right` stays).
- Remove `.lesson-bar { z-index: 31; }` in the narrow block if nothing overlaps it any more.
- The Learn drawer is untouched.
- Comments: EditorShell's "Below 1100 px the panel is a drawer beside the rail" → "Below 1100 px the panel is a drawer beside the canvas, which narrows to make room"; the Run/lesson-end comment says it gives the canvas its room back. `useNarrowLayout`'s doc comment likewise.
- `docs/product-plan.md:127`: "Below 1100 px the panel opens as a drawer over the canvas, beside the rail." → "Below 1100 px the panel opens as a drawer beside the canvas, which narrows to make room."

- [ ] **Step 4: Run the suites**

Run: `npx vitest run tests/black-box/editor-shell.test.ts tests/black-box/lesson-column.test.ts tests/black-box/first-visit-tour.test.ts`
Expected: PASS (BB-LCOL-10, -11, -12, -15 and BB-SHELL-38 unchanged).
Run: `npx playwright test tests/visual/editor.spec.ts -g "VIS-EDITOR-33|VIS-EDITOR-29"`
Expected: VIS-EDITOR-33 PASS; VIS-EDITOR-29's screenshot differs as intended (re-recorded in Task 7).
Then `npm run lint`, `npm run build`, `npm test`: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/editor/ui/editor-app.scss src/pages/editor/ui/EditorShell.tsx src/shared/hooks/useNarrowLayout.ts docs/product-plan.md tests/visual/editor.spec.ts
git commit -m "feat(editor): below 1100 px the panel drawer narrows the canvas instead of covering it"
```

---

### Task 4: Buffers choices as a stacked list

**Files:**
- Modify: `src/features/buffers/ui/BuffersPanel.tsx`
- Modify: `src/features/buffers/ui/buffers-panel.scss`
- Test: `tests/black-box/editor-panels.test.ts`, `tests/visual/editor.spec.ts`

**Interfaces:**
- Keeps: `CardGroup`'s radiogroup contract (roles, `aria-label`s "Rendering mode", "Buffer usage hint", "Buffer update method", roving `tabIndex`, arrows/Home/End).

- [ ] **Step 1: Write the failing tests**

In `tests/black-box/editor-panels.test.ts`, mount the Buffers panel with a selected triangle in VBO mode the way BB-PANEL-15 does, then:

```ts
describe('BB-PANEL-38: Buffers lists each choice as a row with its description', () => {
  it('gives every option a marker, a name and a one-line description, and marks the chosen row', () => {
    const rows = [...group('Rendering mode').querySelectorAll('[role="radio"]')];
    expect(rows.map((r) => r.querySelector('.bp-row__name')!.textContent)).toEqual(['Immediate', 'Vertex Array', 'VBO']);
    expect(rows.map((r) => r.querySelector('.bp-row__desc')!.textContent)).toEqual(['re-sent every frame', 'sent each frame, in one batch', 'uploaded once']);
    expect(rows.every((r) => r.querySelector('.bp-row__mark'))).toBe(true);
    expect(rows.find((r) => r.getAttribute('aria-checked') === 'true')!.classList.contains('active')).toBe(true);
  });
  it('describes the usage hints the same way', () => {
    const rows = [...group('Buffer usage hint').querySelectorAll('[role="radio"]')];
    expect(rows.map((r) => r.querySelector('.bp-row__desc')!.textContent)).toEqual(['set once', 'changed now and then', 'rebuilt every frame']);
  });
  it('labels each block on the left and names its GL call on the right', () => {
    const heads = [...host.querySelectorAll('.bp-block-head')].map((h) => h.textContent);
    expect(heads[0]).toBe('Rendering ModeglBufferData');
    expect(heads[1]).toBe('Buffer UsageGL_STATIC_DRAW');
  });
  it('keeps Home, End and the arrows, and shows Update Method only for VBO with Dynamic', () => {
    // End on Rendering mode chooses VBO; Home chooses Immediate; ArrowDown moves on.
    // With VBO + Static there is no "Buffer update method" group; choosing Dynamic shows it with rows
    // 'Sub Data' / 'Map Buffer' and descriptions 'replaces a range of bytes' / 'writes through a pointer'.
  });
});
```

(`group(label)` returns `host.querySelector(`[role="radiogroup"][aria-label="${label}"]`)`; write the fourth test in full with the `key` helper BB-PANEL-15 uses.)

In `tests/visual/editor.spec.ts`, for 1280 and 960, select a shape in VBO mode with Dynamic usage (use the existing `openSelected` helper and the panel's own controls), then:

```ts
test(`VIS-EDITOR-34: Every Buffers row stays on one line, ${width}`, async ({ page }) => {
  const rows = page.locator('[data-panel-id="buffers-panel"] .bp-row');
  await expect(rows.first()).toBeVisible();
  const tall = await rows.evaluateAll((els) => els.filter((el) => el.getBoundingClientRect().height > 32).map((el) => el.textContent));
  const cut = await page.locator('.bp-row__desc').evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth).map((el) => el.textContent));
  expect(tall).toEqual([]);
  expect(cut).toEqual([]);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run tests/black-box/editor-panels.test.ts`
Expected: FAIL, no `.bp-row__name`.

- [ ] **Step 3: Implement**

- Option data: `hint` becomes the row description. Rendering mode: Immediate "re-sent every frame", Vertex Array "sent each frame, in one batch", VBO "uploaded once". Usage: Static "set once", Dynamic "changed now and then", Stream "rebuilt every frame". Update method: Sub Data "replaces a range of bytes", Map Buffer "writes through a pointer". Drop the per-option icons and their imports.
- Each `CardGroup` gets the container class `bp-list`; each option button is `bp-row` with `<span class="bp-row__mark" aria-hidden="true" />`, `<span class="bp-row__name">`, `<span class="bp-row__desc">`. The `title` attribute keeps the GL name.
- Block heads: Rendering Mode shows `modeOption.api` as its `bp-block-hint`; Buffer Usage keeps its macro; Update Method shows `methodOption.api`. The `GlHint` call lines, the Indexed Drawing switch and its note stay.
- Styles (spec section 3): `.bp-list` is one box: `background: var(--field-bg)`, `1px solid var(--hairline)`, `border-radius: var(--radius-m)`, rows divided by `1px solid var(--hairline)`. `.bp-row` is a full-width button, grid columns `11px auto 1fr` with `gap: 6px`, `padding: 6px 8px`, aligned centre, text-align left, no wrapping (`white-space: nowrap`, description `min-width: 0; overflow: hidden; text-overflow: ellipsis`). Name: weight 600, `--text-sm`. Description: `--text-xs`, `--ink-muted`. Marker: 11 px circle, `1.5px solid var(--field-line)`; chosen row (`.active`) gets `background: var(--accent-tint)` and a filled `--accent` marker. A visible `:focus-visible` outline with the accent. Remove the old card grid rules.

- [ ] **Step 4: Run the suites**

Run: `npx vitest run tests/black-box/editor-panels.test.ts`
Expected: PASS (BB-PANEL-15 unchanged).
Run: `npx playwright test tests/visual/editor.spec.ts -g "VIS-EDITOR-34"`
Expected: PASS. Shorten a description if a row wraps or cuts at 960, keeping its meaning, and update the test values with it.
Then `npm run lint`, `npm run build`, `npm test`: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/buffers/ui/BuffersPanel.tsx src/features/buffers/ui/buffers-panel.scss tests/black-box/editor-panels.test.ts tests/visual/editor.spec.ts
git commit -m "feat(buffers): list each buffer choice as a row with its description"
```

---

### Task 5: Tidy the textured program's header

**Files:**
- Modify: `src/features/code-generation/model/code-generator.ts:43-47`
- Modify: `src/features/code-generation/model/code-explanations.ts:132`
- Test: `tests/black-box/code-generation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('BB-GEN-11: A textured program includes only what it uses', () => {
  it('has no iostream and explains why stb_image is defined first', () => {
    // A quad with a texture attached (as in WB-CODE-22's fixture), then generate the program.
    expect(code).not.toContain('#include <iostream>');
    expect(code).toContain('// stb_image: define its implementation in exactly one file, before including it\n#define STB_IMAGE_IMPLEMENTATION\n#include "stb_image.h"\n');
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run tests/black-box/code-generation.test.ts -t "BB-GEN-11"`
Expected: FAIL, the code contains `#include <iostream>`.

- [ ] **Step 3: Implement**

Remove the `#include <iostream>` line (keep one blank line before the stb block so the header reads as today) and replace the comment with `// stb_image: define its implementation in exactly one file, before including it`. Delete the `#include <iostream>` entry from `code-explanations.ts`. Grep `tests/` and `tests/fixtures/` for `iostream` and the old comment, and update any pinned program.

- [ ] **Step 4: Run the suites**

Run: `npx vitest run tests/black-box/code-generation.test.ts tests/white-box/code-structure.test.ts tests/white-box/code-generation-buffers.test.ts tests/black-box/cpp-code-validation.test.ts`
Expected: PASS (WB-CODE-22 still finds an explanation for every explainable line).

- [ ] **Step 5: Commit**

```bash
git add src/features/code-generation/model/code-generator.ts src/features/code-generation/model/code-explanations.ts tests/black-box/code-generation.test.ts
git commit -m "fix(codegen): drop the unused iostream include and reword the stb_image comment"
```

---

### Task 6: British spelling everywhere students read, with a guard

**Files:**
- Create: `tests/white-box/british-spelling.test.ts`
- Modify: every `src/` file the guard flags (today: help-content, ObjectAppearancePanel, ObjectTransformPanel, ColorField, the math panel, code-explanations, the generator's comment templates, shortcuts, HelpCenter, scene-library sample names and others; grep found about 40 files)
- Modify: tests that pin a changed string (for example `aria-label="Color emission"` in `tests/black-box/editor-panels.test.ts:200`)
- Modify: `tests/README.md` (add the new file to the white-box list)

**Interfaces:**
- Consumes: Task 5's header comment (the generated program's comments are checked).

- [ ] **Step 1: Write the guard**

```ts
/**
 * WHITE-BOX TEST SUITE — WB-SPELL
 * Students read British spelling everywhere: labels, tooltips, Help, lessons, the course map,
 * the Math panel, line explanations, site pages and the generated program's comments.
 */
const AMERICAN = /\b(colors?|colored|coloring|colorful|rasteriz(?:e|ed|es|ing|ation)|normaliz(?:e|ed|es|ing|ation)|centers?|centered|centering|gray|grayscale|behaviors?|minimiz(?:e|ed|es|ing)|maximiz(?:e|ed|es|ing)|visualiz(?:e|ed|es|ing|ation)|optimiz(?:e|ed|es|ing|ation)|initializ(?:e|ed|es|ing|ation))\b/i;

describe('WB-SPELL-01: Text in the sources is British', () => {
  it.each(sourceFiles())('%s', (file) => {
    expect(americanIn(file)).toEqual([]);
  });
});
describe('WB-SPELL-02: The generated program\'s comments are British', () => {
  it('has no American spelling in any // comment', () => {
    // Build the everything scene (textures, callbacks, VBOs, groups, text, reshape) and generate it.
    const comments = program.split('\n').map((l) => l.split('//')[1]).filter(Boolean);
    expect(comments.filter((c) => AMERICAN.test(stripCode(c)))).toEqual([]);
  });
});
describe('WB-SPELL-03: The guard catches what it should and leaves code alone', () => {
  it('flags prose and passes names', () => {
    expect(americanInText('Pick a color')).toEqual(['color']);
    expect(americanInText('Colour the corner; glColor3f and GL_COLOR_ARRAY stay; `color` in code')).toEqual([]);
  });
});
```

Decisions the guard encodes:
- `sourceFiles()`: every `src/**/*.ts` and `src/**/*.tsx`, except `*.d.ts`, `src/features/code-generation/model/code-generator.ts` and `src/features/code-generation/model/generator/**` (their C++ text is checked through the generated program instead, WB-SPELL-02).
- `americanIn(file)` parses with `ts.createSourceFile` (the `typescript` package is installed) and checks `StringLiteral`, `NoSubstitutionTemplateLiteral`, template head/middle/tail text and `JsxText`. It skips: import and export specifiers; JSX attributes `className`, `class`, `id`, `key`, `role`, `type`, `href`, `src`, `htmlFor`, `panelId`, `focusPanel` and `data-*`; and any literal that is a single code-like token: matching `/^[a-z_$][\w$./-]*$/` (identifiers, store values, CSS classes, paths, Help keywords) or `/^[A-Z0-9_]+$/` (constants). Source comments are not checked.
- `stripCode(text)` removes backtick spans, `<code>…</code>`, and GL and GLUT names (`/\bglu?t?[A-Z]\w*/g`, `/\bGL(?:UT)?_\w+/g`) before matching. `americanInText` returns the matched words.
- No allowlist. If a real code identifier is flagged, tighten a skip rule above rather than listing the word, and say so in the report.

- [ ] **Step 2: Run it and read the failures**

Run: `npx vitest run tests/white-box/british-spelling.test.ts > <scratch>/spell.txt; tail -80 <scratch>/spell.txt`
Expected: WB-SPELL-03 PASS; WB-SPELL-01 and -02 FAIL, listing the American words per file.

- [ ] **Step 3: Make the text British**

Change each flagged string to British (colour, rasterise, normalise, centre, grey, behaviour, minimise, maximise, visualise, optimise, initialise and their forms). Never rename identifiers, store fields, CSS classes, file names, GL or GLUT names, persisted values or lesson and test IDs. Then grep `tests/` for each changed string and update the tests that select or pin it.

- [ ] **Step 4: Run everything**

Run: `npx vitest run tests/white-box/british-spelling.test.ts`
Expected: PASS.
Then `npm run lint`, `npm run build`, `npm test`: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/white-box/british-spelling.test.ts tests/README.md <each changed src and test file>
git commit -m "fix(copy): use British spelling in every string students read, with a guard test"
```

---

### Task 7: Divergences, baselines and the full visual run

**Files:**
- Modify: `docs/specs/2026-10-04-website-overhaul-roadmap.md` (divergence list, after item 18)

- [ ] **Step 1: Record the divergences**

Add:
- "19. The evaluated canvas filled the space it was given, so its shape followed the layout. The program window now opens, refits and maximises to the viewing volume's shape, so a square draws square; the student's own resize still stretches it, as GLUT does."
- "20. In the evaluated build the panel drawer below 1100 px covered the left of the canvas. It now takes its place beside the canvas, which narrows to make room."

- [ ] **Step 2: Run the visual suite and re-record the intended changes**

Run: `npm run test:visual > <scratch>/vis.txt; tail -60 <scratch>/vis.txt`
Expected: the new VIS-EDITOR-32, -33, -34 pass; screenshot tests that show the program window, the narrow drawer or the Buffers panel differ. Open each diff in `tests/visual/results.local/` and confirm it differs only because of decisions 1–5. Then run `npx playwright test --update-snapshots=changed` and run the suite again.
Expected: every visual test passes.

- [ ] **Step 3: Final checks and commit**

`npm run lint`, `npm run build`, `npm test`: PASS; `git checkout -- tests/reports`.

```bash
git add docs/specs/2026-10-04-website-overhaul-roadmap.md
git commit -m "docs(roadmap): record the volume-shaped window and the narrow drawer as divergences"
```
