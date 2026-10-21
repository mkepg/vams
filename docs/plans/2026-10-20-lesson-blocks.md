# Lesson Blocks Implementation Plan

**Goal:** Give lessons four new blocks in the lesson bar: a goal checklist with "Stuck?" hints and Skip (with a "skipped" progress state), a recap, predict-then-see, and fill in the code. Also add the rule tests that the lesson content work fills section by section.

**Architecture:** Each block is optional data on `LessonStep` (`core/types/lesson.ts`), read by the step runner (`useLessonRunner`) and drawn by `LessonBar`. Pure rules (what a step waits for, how a blank is checked) live in small model files so tests and the runner share them. Progress gains a `skipped` list. Four sample lessons, built in only when `VITE_LESSON_SAMPLES` is `1`, give the UI tests, the screenshot checks and the rule tests real data before any course lesson uses a block.

**Tech Stack:** Preact (preact/compat), Zustand + Immer, SCSS tokens, lucide-react icons, Vitest + happy-dom, Playwright (visual).

**Spec:** [docs/specs/2026-10-15-lesson-content-design.md](../specs/2026-10-15-lesson-content-design.md), sections 1, 2, 4, 5, 6 and 7 (blocks). Its "Owner decisions" and "Rulings made in this spec" are binding, and so are the owner's answers recorded below.

**Visual reference (local, not committed):** the approved mock `lesson-blocks-v5.html` from the 2026-10-15 design session. Read its CSS before Tasks 4, 6, 8 and 11; the values quoted in those tasks come from it.

## Global Constraints

- Step numbers in this plan count from 1, as the lesson bar shows them ("Step 2 of 3"). Code indexes steps from 0.

- Every rule in AGENTS.md applies.
  - FSD layering: `app → pages → widgets → features → entities → shared`, plus `core`, imported through `@/`. `pages/learn` must keep importing only `catalog.ts` and `progress.ts` from the lesson engine (BB-LPAGE-11).
  - Lesson steps change the scene only through the store actions the GUI uses. `solve` is no exception.
  - The code panel stays read-only and generated. A fill-in answer never edits the program.
- **Student-facing text** (UI labels, lesson and sample text) never says "coming soon", "not supported", "future", "deferred", "3D" or "lighting". British spelling.
- **Order and freeze:** blocks are built in the order 1 → 4, each complete (code, tests, checkpoint sign-off) before the next starts. They must land by the 28 Oct editor freeze. A block that isn't finished by then is left out entirely: its types, runner code and UI are not merged.
- **Styles:**
  - Font sizes come only from `--text-*` tokens (BB-SHELL-22). No `text-transform: uppercase` (BB-SHELL-23).
  - New colours extend `src/shared/styles/_tokens.scss` in both themes (`:root` light, `[data-theme='dark']`).
  - Icons are lucide-react at 14 px with `strokeWidth={1.75}`, never Unicode characters. Numbers use `font-variant-numeric: tabular-nums`.
  - Status colour appears only on status: `--success` on a met goal, a right answer and a right blank; `--warning-text` on a wrong answer or blank; `--accent` on the focused blank.
- **Progress:** the browser key `vams-lesson-progress` keeps `version: 1`. Progress saved before this work, which has no `skipped` field, loads with an empty list.
- **Ids:** existing lesson ids and test IDs never change. Every new test takes the next free ID in its file: grep for the highest, never count.
- **Before every commit:**
  - `npm run lint`, `npm run build` and `npm test` all pass;
  - then `git checkout -- tests/reports`;
  - stage paths explicitly, never `.gitignore` or `AGENTS.md`;
  - read `git diff --staged`.
- **Commits:** Conventional Commits. No `Co-Authored-By`, no "Generated with", and no mention of an assistant, agent or workflow in commits, comments or docs.

## Owner answers (2026-10-20)

| Question | Answer |
| --- | --- |
| Which last steps name the next lesson? | Every lesson's last step names the next lesson in the course. Finish appears only on a section's last lesson. |
| Skip on a question step (multiple choice, ordered list, fill in the code) | Skip fills in the right answer and lights Next. The student presses Next themselves. |
| Skip on a building step | Skip does the step through store actions, so the goals tick and the canvas and code update. Then it lights Next, and the student presses Next themselves. |
| The skipped lesson's mark on /learn and in the Learn drawer | The not-started ring with a short horizontal dash inside, in faint ink. The meta text reads "Skipped". |

The spec says Skip "advances". The owner's answers above replace that: Skip never advances by itself.

## Rulings made in this plan

| # | Ruling | Why | Cost if wrong |
| --- | --- | --- | --- |
| L1 | A **waiting step** is one with `goals`, a `successCheck` or an `exercise` widget. A step with `waitForUser` alone is not one. | 127 of today's 158 `waitForUser` steps have no check and never gate (`canAdvance` is true for them). The spec's rules (hints, `task`, `solve`) are about steps that hold the student. | Content would need hints on some pacing steps; a one-line change to `waitsForStudent` |
| L2 | "Stuck?" shows on a waiting step that has hints or can be skipped, and only until the step passes. | There is nothing to be stuck on once Next lights | One condition |
| L3 | The hint line shows the newest hint only, with "2 of 3". | The spec's "one quiet line" | Showing all would be a list |
| L4 | Once Skip is used in a run of a lesson, that run is recorded as skipped, even if the student undoes the solved state and redoes it by hand. | Simple, and the spec counts a lesson as skipped if any step was skipped | A student who redoes a step by hand still sees "Skipped" until they finish a run without Skip |
| L5 | Status order on /learn and in the drawer: done, then in progress, then skipped, then not started. A done lesson finished again with Skip stays done. | "Done wins" already holds for in progress | One line in `lessonStatus` |
| L6 | Next up is the lesson left mid-way if it isn't done. Otherwise it is the first lesson in the course that is neither done nor skipped. When none is left, it is the first skipped lesson. It is null only when every lesson is done. `firstLessonToStudy` follows the same order. | Without the last fallback, a student with only skipped lessons left would read "Every lesson is done." | None |
| L7 | On a goals step, the task line is hidden while goals remain, and reads "Done", or "Done · task", once all are met. | The mock shows no task line under the goals; the goals are the task | One condition |
| L8 | Goal checks run in a store selector over the whole state, so any change (colour, background, texture, undo) re-checks them. | Today's success check re-runs only on `objects`, `callbacks` and `viewportLimits` | None |
| L9 | Four sample lessons (`sample-goals`, `sample-recap`, `sample-predict`, `sample-code`) live in `features/lesson-engine/model/sample-lessons.ts`. `getLessonById` returns them only when `import.meta.env.VITE_LESSON_SAMPLES === '1'`, which the visual build sets. They are never in the catalog, the registry or the Learn drawer. | No course lesson uses a block until the content work, but the UI tests, the screenshot checks and the rule tests need real data. Vite folds the constant away, so production bundles never contain them. | A test-only module in `src` |
| L10 | The rule tests (`tests/black-box/lesson-rules.test.ts`) apply to the sample lessons and to the sections listed in `SECTIONS_ON_THE_BAR`, which starts empty. The banned-word rule applies to every lesson now. | The content work adds each section as it lands. Today's lessons can't meet the bar yet (no hints, no `solve`). | None |
| L11 | Coverage source: `src/features/code-generation/model/code-generator.ts` and `generator/*.ts`, every match of `\b(gl[A-Z]\w*\|glut[A-Z]\w*\|GL_[A-Z0-9_]+\|GLUT_[A-Z0-9_]+)\b`, minus `GLUT_FUNCS`. That is 115 names on 2026-10-20 (the spec counted 118). A name is taught when it appears as a whole word in a lesson's narration, hints, predict labels or whys, recap calls, or code template. | The spec's definition, made exact | Allowlist size only |
| L12 | The disabled Next uses two new tokens instead of opacity: `--action-off` (light `#dde3f0`, dark `#232b40`) and `--on-action-off` (light `#4a536c`, dark `#9aa3bb`). This applies only to `.lesson-bar__next`. | The mock's values, which keep 4.5:1. Opacity 0.45 on cobalt fails | Two tokens |
| L13 | Recap calls are buttons that call `requestExplain(call)`. `findCallLine` also finds a `GL_`/`GLUT_` constant as a whole word, since constants have no `(` after them. | The spec's "opens its line in the code panel with the explanation strip" | A recap constant opens Code with no line explained |
| L14 | An unanswered predict step's action does not run. Answers are kept for the run, keyed by step index. Rebuilding the scene (Back, a jump) always replays earlier steps' actions; the current step's action replays only if it has been answered. | The spec: the action runs once picked, never twice; Back shows it answered | None |
| L15 | Predict answers are buttons in a `role="group"`, not radios. | A pick is final; the row collapses | None |
| L16 | `solve` runs inside `startBatch`/`endBatch`, so it is one undo step. | One action for the student | None |
| L17 | A blank counts as a number when its answer is a number. Typed text counts as a number if it matches `^[+-]?(\d+\.?\d*\|\.\d+)([eE][+-]?\d+)?[fF]?$` and is within tolerance (default 0.01) of the answer. A name blank compares the trimmed text exactly. Empty text is neither right nor wrong. | The spec's `0.5`, `.5`, `0.50`, `0.5f` | None |
| L18 | A focused blank shows the cobalt underline. A blank's verdict (green, or amber with its reason) shows once it has text and is not focused. The step passes as soon as every blank is right, including the one being typed. | Mock 3b shows a right value in focus without green | None |
| L19 | Skip fills a number blank with `formatBlankNumber(n)`: `n.toFixed(4)` with trailing zeros and a trailing point removed (`0.5`, `-0.25`, `45`). | Plain, and what the student would type | None |
| L20 | Finish on a section's last lesson records progress, leaves the lesson, then goes to `/learn#<section anchor>`. For a lesson outside the course order (the samples), Finish ends the lesson in the editor, as today. | The Learn drawer's "Full course map" link already means /learn | One href |
| L21 | Moving to the next lesson from a last step keeps the student's backed-up scene: it calls `setActiveLesson(nextId)` while a lesson is active (the branch that keeps backups) and then `setCurrentStep(0)`. | Exiting after a chain of lessons must still bring back the student's own scene | None |

## Review Focus

1. **Undo after Skip.** Undo after Skip un-ticks the goals and turns Next off again, and the run still counts as skipped. Task 3 tests it.
2. **Back onto a predict step, then forward again.** The step's action has run exactly once. Task 8 tests it with a counting action.
3. **Progress saved before this work**, and malformed `skipped` data (not an array, unknown ids, duplicates). These load without losing `completed` or `current`. Task 2 tests it.
4. **Partial and odd input in a blank** (`0.`, `-`, `.`, `0.5ff`, `0..5`, spaces). Typing never throws, and none of these counts as right. Task 10 tests it.
5. **A chain of lessons, then Exit.** The student's own scene comes back after going Next from lesson to lesson. Task 6 tests it.

## File map

| File | Change |
| --- | --- |
| `src/core/types/lesson.ts` | New step fields `goals`, `hints`, `solve` (T1), `recap` (T6) and `predict` (T8); a `code` widget (T10) |
| `src/features/lesson-engine/model/step-rules.ts` | New (T1): `waitsForStudent`, `canSkip`, `goalLabelParts` |
| `src/features/lesson-engine/model/code-blanks.ts` | New (T10): `templateParts`, `checkBlank`, `formatBlankNumber` |
| `src/features/lesson-engine/model/sample-lessons.ts` | New (T3), extended in T6, T8 and T11 |
| `src/features/lesson-engine/model/lesson-registry.ts` | `getLessonById` returns samples behind the flag (T3) |
| `src/features/lesson-engine/model/progress.ts` | `skipped`, `markLessonSkipped` (T2) |
| `src/features/lesson-engine/model/catalog.ts` | `nextInCourse`, `isSectionEnd` (T6); `firstLessonToStudy` takes skipped (T2) |
| `src/features/lesson-engine/model/useLessonRunner.ts` | Goals, Skip, skipped finish (T3); next lesson and course map (T6); predict (T8); code answers (T11) |
| `src/features/lesson-engine/ui/LessonBar.tsx`, `lesson-bar.scss` | Goals, Stuck?, hints (T4); recap and the named Next (T6); predict (T8) |
| `src/features/lesson-engine/ui/exercise-widgets/CodeBlankWidget.tsx` | New (T11) |
| `src/features/lesson-engine/ui/LearnDrawer.tsx`, `learn-drawer.scss` | Skipped mark and meta (T2) |
| `src/pages/learn/model/learn-progress.ts`, `ui/LessonRow.tsx`, `ui/learn.scss` | Skipped status, Next up (T2) |
| `src/features/code-generation/model/code-outline.ts` | `findCallLine` finds constants (T6) |
| `src/shared/styles/_tokens.scss` | `--action-off`, `--on-action-off` (T4); `--warning-text` (T8) |
| `tests/black-box/lesson-rules.test.ts` | New suite BB-LRULE (T1), extended in T3, T6, T8 and T11 |
| `tests/visual/lesson-blocks.spec.ts`, `playwright.config.ts` | New VIS-LB suite; the build sets `VITE_LESSON_SAMPLES` (T5) |
| `docs/product-plan.md`, `docs/specs/2026-10-04-website-overhaul-roadmap.md`, `tests/README.md` | T13 |

---

# Block 1: goal checklist, hints and Skip, with skipped progress

### Task 1: Step rules for goals, hints and Skip

**Files:**
- Modify: `src/core/types/lesson.ts`
- Create: `src/features/lesson-engine/model/step-rules.ts`
- Create: `tests/black-box/lesson-rules.test.ts`
- Test: `tests/white-box/lesson-engine-internals.test.ts`

**Interfaces:**
- Produces:
  - On `LessonStep`, add these three fields with the spec's doc comments:
    - `goals?: { label: string; check: (state: VamsState) => boolean }[]`
    - `hints?: string[]`
    - `solve?: (state: VamsState) => void`
  - `waitsForStudent(step: LessonStep): boolean`: true when the step has `goals` (non-empty), a `successCheck` or an `exercise`.
  - `canSkip(step: LessonStep): boolean`: true when the step `waitsForStudent` and has `solve` or an `exercise`.
  - `goalLabelParts(label: string): { text: string; num: boolean }[]`: splits out coordinate groups `(a, b)` and numbers, with an optional `°`, as `num: true` parts.
  - In `tests/black-box/lesson-rules.test.ts`:
    - `export const SECTIONS_ON_THE_BAR: CurriculumSection[] = []`;
    - helper `lessonsUnderRules(): Lesson[]`: registry lessons in those sections, plus `SAMPLE_LESSONS` once Task 3 adds it;
    - helper `taughtText(lesson): string`: narration and hints for now, extended by later tasks.

- [ ] **Step 1: Write the failing tests**

In `tests/white-box/lesson-engine-internals.test.ts`, take the next free IDs (WB-LESSON-07 onward):
- `waitsForStudent`:
  - false for `{ narration: 'x', waitForUser: true }`;
  - true for a step with `successCheck`, a step with `goals: [{ label: 'a', check: () => true }]`, and a step with a multiple-choice `exercise`;
  - false for `goals: []`.
- `canSkip`: true for a waiting step with `solve`, and for one with an `exercise`; false for a waiting step with neither; false for `{ narration, solve }`, which doesn't wait.
- `goalLabelParts`:
  - `'At (0.5, 0.2)'` gives `[{ text: 'At ', num: false }, { text: '(0.5, 0.2)', num: true }]`;
  - `'Turned 45°'` gives `[{ text: 'Turned ', num: false }, { text: '45°', num: true }]`;
  - `'Red'` gives `[{ text: 'Red', num: false }]`;
  - `'Width −0.5'` keeps the true minus inside the number part.

In the new `tests/black-box/lesson-rules.test.ts` (header comment `BLACK-BOX TEST SUITE — BB-LRULE`, "The rules every lesson meets: coverage, structure and wording"):
- **BB-LRULE-01, coverage.**
  - Compute the GL name list exactly as ruling L11 says, reading the files with `node:fs`.
  - Assert it has more than 100 names and contains `glBegin` and `GL_TRIANGLES`.
  - Every name not taught in any registry lesson's `taughtText` is in `UNTAUGHT_ALLOWLIST`.
  - Every allowlist entry is in the list and is not taught (the list only shrinks honestly).
  - `UNTAUGHT_ALLOWLIST` starts with exactly the untaught names on this commit: paste them from the failing run's output, sorted.
- **BB-LRULE-02, wording.** No registry lesson's narration, task, hints or exercise text matches `/coming soon|not supported|future|deferred|\b3D\b|lighting/i`.
- **BB-LRULE-03, hints and task.** Every waiting step in `lessonsUnderRules()` has 1–3 non-empty hints and a non-empty `task`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/white-box/lesson-engine-internals.test.ts tests/black-box/lesson-rules.test.ts`
Expected: FAIL. The step-rules module doesn't exist, and BB-LRULE-01 prints the untaught names.

- [ ] **Step 3: Add the type fields and `step-rules.ts`**

- [ ] **Step 4: Run them to see them pass**

Same command. Expected: PASS. BB-LRULE-03 passes with no lessons under rules yet; Task 3 gives it data.

- [ ] **Step 5: Commit**

`feat(lessons): add goals, hints and solve to lesson steps, with the lesson rule tests`

---

### Task 2: Skipped progress on /learn and in the Learn drawer

**Files:**
- Modify: `src/features/lesson-engine/model/progress.ts`, `src/features/lesson-engine/model/catalog.ts` (`firstLessonToStudy`) and its callers
- Modify: `src/pages/learn/model/learn-progress.ts`, `src/pages/learn/ui/LessonRow.tsx`, `src/pages/learn/ui/learn.scss`
- Modify: `src/features/lesson-engine/ui/LearnDrawer.tsx`, `src/features/lesson-engine/ui/learn-drawer.scss`
- Test: `tests/black-box/learn-drawer.test.ts` (BB-LEARN-13 onward), `tests/black-box/learn-page.test.ts` (BB-LPAGE-12 onward)

**Interfaces:**
- Produces:
  - `LessonProgress` gains `skipped: string[]`. `readProgress` filters it like `completed`: lessons in the catalog only, no duplicates, and `[]` when the field is missing or not an array.
  - `markLessonSkipped(id: string): void`: adds the id to `skipped` unless it is in `completed`, and clears `current` when `current` is this lesson.
  - `markLessonComplete(id)` also removes the id from `skipped`.
  - `LessonStatus.kind` gains `'skipped'`, with meta `'Skipped'` and spoken `'skipped'`.
  - `nextUp` follows ruling L6.
  - `firstLessonToStudy(completed: readonly string[], skipped: readonly string[] = []): string` follows L6.

- [ ] **Step 1: Write the failing tests**

- **BB-LEARN-13:**
  - progress stored as `{ version: 1, completed: ['pipeline-demo-1'], current: null }` (no `skipped`) reads with `skipped: []` and keeps `completed`;
  - `skipped: 'x'` reads as `[]`;
  - `skipped: ['pipeline-demo-2', 'pipeline-demo-2', 'nope']` reads as `['pipeline-demo-2']`.
- **BB-LEARN-14:**
  - `markLessonSkipped('pipeline-demo-2')` records it as skipped and clears a `current` that names it;
  - then `markLessonComplete('pipeline-demo-2')` moves it from `skipped` to `completed`;
  - `markLessonSkipped` on a completed lesson leaves it completed and not skipped.
- **BB-LEARN-15:** the drawer shows a skipped lesson with meta "Skipped" and the class `is-skipped`.
- **BB-LPAGE-12:**
  - `lessonStatus` reads a skipped lesson as `{ kind: 'skipped', meta: 'Skipped', spoken: 'skipped' }`;
  - a lesson that is both in `current` and skipped reads as in progress.
- **BB-LPAGE-13:**
  - with the first two course lessons skipped and nothing done, `nextUp` is the third;
  - with every lesson done except one skipped, `nextUp` is that skipped lesson;
  - `firstLessonToStudy` agrees in both cases.
- **BB-LPAGE-14:**
  - the /learn row of a skipped lesson has `is-skipped` and the meta "Skipped";
  - `doneCount` doesn't count it.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/black-box/learn-drawer.test.ts tests/black-box/learn-page.test.ts`
Expected: FAIL on the new IDs only.

- [ ] **Step 3: Implement the progress changes, then the two marks**

- **Progress:** every `write` keeps `skipped`.
- **/learn mark (`learn.scss`):** `.learn-row.is-skipped .learn-row__mark` is the same 12 px ring in `--ink-faint`, with a 6 × 1.5 px dash of `--ink-faint` centred inside (a `::after`).
- **Drawer:** the skipped mark replaces the drawer's `○` text mark with the same ring-and-dash, drawn in CSS. Leave the drawer's other marks as they are.
- **Callers:** pass `progress.skipped` to every caller of `firstLessonToStudy`; grep for them.

- [ ] **Step 4: Run them to see them pass**

Same command. Expected: PASS. The rest of the two files still passes.

- [ ] **Step 5: Commit**

`feat(learn): record skipped lessons and show them on /learn and in the Learn drawer`

---

### Task 3: The runner checks goals and runs Skip

**Files:**
- Create: `src/features/lesson-engine/model/sample-lessons.ts`
- Modify: `src/features/lesson-engine/model/lesson-registry.ts`, `src/features/lesson-engine/model/useLessonRunner.ts`
- Test: `tests/black-box/lesson-column.test.ts` (BB-LCOL-37 onward), `tests/black-box/lesson-rules.test.ts`

**Interfaces:**
- Consumes: `waitsForStudent`, `canSkip` (Task 1); `markLessonSkipped` (Task 2).
- Produces:
  - `export const SAMPLE_LESSONS: Record<string, Lesson>`.
  - `getLessonById(id)` returns `LESSON_REGISTRY[id]`, or `SAMPLE_LESSONS[id]` when `import.meta.env.VITE_LESSON_SAMPLES === '1'`.
  - The runner looks lessons up through `getLessonById`, not `LESSON_REGISTRY` directly.
  - `LessonRunner` gains:
    - `goals: { label: string; met: boolean }[] | null`;
    - `canSkip: boolean`: the step's `canSkip` and not yet passed;
    - `skip: () => void`;
    - `skipped: boolean`: Skip was used in this run.
  - `canAdvance` becomes `!waitsForStudent(step) || passes`. A step with goals passes when every check is true. The keyboard's ArrowRight uses the same value.
  - `finish()` calls `markLessonSkipped` when `skipped`, else `markLessonComplete`.
- `sample-goals` (`type: 'exercise'`, section Transforms, title "Transforms capstone"):
  - **Step 1** narration: "Make the triangle red, move it to (0.5, 0.2), and turn it 45°."
    - action: add the triangle `[{x:0,y:0.5},{x:-0.5,y:-0.5},{x:0.5,y:-0.5}]`, select it, and make it red with `setAllVertexColors(id, '#ff0000')`;
    - goals:
      - `Red`: every vertex colour is `#ff0000`, case-insensitive;
      - `At (0.5, 0.2)`: translate within 0.01;
      - `Turned 45°`: rotate within 0.5;
    - `task`: "Red, at (0.5, 0.2), turned 45°";
    - hints:
      - "Rotate is under Transform in the Scene panel. Drag the dial, or type 45."
      - "Translate X and Y set where the triangle sits."
      - "Colour is under Appearance."
    - `solve`: through `updateObjectTransform`.
  - **Step 2**: "Done." as the last step.

- [ ] **Step 1: Write the failing tests**

Stub the flag with `vi.stubEnv('VITE_LESSON_SAMPLES', '1')` and `vi.unstubAllEnvs()` in `afterEach`.
- **BB-LCOL-37:**
  - in `sample-goals`, `goals` reads `[Red met, At not met, Turned not met]`;
  - setting translate (0.5, 0.2) ticks the second goal;
  - `undo()` un-ticks it.
- **BB-LCOL-38:** once all three goals are met, `canAdvance` is true and ArrowRight advances.
- **BB-LCOL-39:**
  - `skip()` solves the step: all goals are met, `canAdvance` is true and the step index is unchanged;
  - one `undo()` un-ticks the solved goals and `canAdvance` is false again, while `skipped` stays true.
- **BB-LCOL-40:**
  - finishing `sample-goals` after a Skip records it in `skipped`, not `completed`;
  - finishing again without Skip records it in `completed`;
  - `readProgress` drops ids outside the catalog, so assert on the raw JSON under `PROGRESS_KEY`, which `markLessonSkipped` and `markLessonComplete` write without filtering the id they are given.
- **BB-LCOL-41:**
  - `getLessonById('sample-goals')` is undefined without the flag;
  - no sample id is in `LESSON_REGISTRY` or `LESSON_CATALOG`.

In `lesson-rules.test.ts`, `lessonsUnderRules()` now includes `Object.values(SAMPLE_LESSONS)`, and these tests are added:
- **BB-LRULE-04, solve.**
  - Every waiting step without an `exercise` has a `solve`.
  - Rebuild the scene as the runner does: reset as the runner does, then for each earlier step run its action, then its `solve` if it has one.
  - Then run the step's action and its `solve`. Its goals and `successCheck` all pass.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/black-box/lesson-column.test.ts tests/black-box/lesson-rules.test.ts`
Expected: FAIL on the new IDs.

- [ ] **Step 3: Implement**

- **Goals:** checked with one `useVamsStore` selector that returns a string of `1`s and `0`s, so the bar re-renders only when a goal flips (ruling L8).
- **`skip()`:**
  - with `solve`: run it inside `startBatch`/`endBatch`;
  - for a multiple-choice step: `setMcAnswer(correctId)`;
  - for an ordered list: `setOrderAnswer([...correctOrder])`;
  - then set `skipped`.
- **Reset:** `skipped` resets when `activeLessonId` changes.

- [ ] **Step 4: Run them to see them pass**

Same command, then `npm test`. Expected: PASS everywhere. BB-LCOL-03 and BB-LCOL-04 still pass, since Finish is unchanged until Task 6.

- [ ] **Step 5: Commit**

`feat(lessons): check goals on every change and let Skip solve a step`

---

### Task 4: The lesson bar shows goals, Stuck?, hints and Skip

**Files:**
- Modify: `src/features/lesson-engine/ui/LessonBar.tsx`, `src/features/lesson-engine/ui/lesson-bar.scss`, `src/shared/styles/_tokens.scss`
- Test: `tests/black-box/lesson-column.test.ts`

**Interfaces:**
- Consumes: `runner.goals`, `runner.canSkip`, `runner.skip` (Task 3); `goalLabelParts` (Task 1).
- The UI state lives in the bar, reset for each step the same way `folded` is:
  - `stuck: boolean`;
  - `hintsShown: number`.

**Markup and look.** Values come from the mock. Classes are under `lesson-bar__`.
- **Goals:** `ul.lesson-bar__goals`, labelled "Goals".
  - Layout: flex, wrap, gap 4 px 20 px, 13 px type.
  - Each goal is an `li.lesson-bar__goal`:
    - an icon: lucide `Circle` in `--rule-strong`, or `CircleCheck` in `--success` once met;
    - the label parts, where num parts are mono 12 px;
    - a met goal adds `is-met` (label `--ink-faint`) and a visually hidden ", met".
- **Hint:** `p.lesson-bar__hint`.
  - Content: lucide `Lightbulb` in `--ink-faint`, then the newest hint, then `span.lesson-bar__hint-count` with "n of m".
  - Look: 13 px, `--ink-muted`, baseline aligned. The count is 12 px `--ink-faint`, nowrap.
  - It sits after the step's content and before the task line.
- **Nav:** the row becomes Stuck? on the left, a flexible gap, then Back and Next. It gets `margin-top: 4px`.
- **"Stuck?":** a quiet button with lucide `CircleHelp` and the text "Stuck?", 12.5 px, `--ink-faint`.
  - When clicked, it becomes "Show a hint · Skip this step", which reads "Show another hint" once a hint is showing.
  - The links are `--ink-muted`, underlined in `--rule-strong` with a 3 px offset. The separator `·` is `--rule-strong`.
  - "Show …" appears only while hints remain. "Skip this step" appears only when `runner.canSkip`.
  - The whole control appears only under ruling L2.
  - Focus stays on the control that replaces the clicked one: "Stuck?" hands focus to the first link.
- **Task line:** follows ruling L7 on goals steps.
- **Disabled Next:** `.lesson-bar__next:disabled` uses `opacity: 1`, `background: var(--action-off)` and `color: var(--on-action-off)`, with the token values from ruling L12.

- [ ] **Step 1: Write the failing tests**

- **BB-LCOL-42:**
  - `sample-goals` renders three `.lesson-bar__goal` items, the first `is-met` with the text "Red";
  - the num part of "At (0.5, 0.2)" is in its own element;
  - no task line is shown;
  - Next is disabled.
- **BB-LCOL-43:**
  - clicking "Stuck?" shows the buttons "Show a hint" and "Skip this step", and focus is on "Show a hint";
  - "Show a hint" shows the first hint with "1 of 3", and the button reads "Show another hint";
  - after the third hint, only "Skip this step" is left.
- **BB-LCOL-44:**
  - "Skip this step" ticks all goals and enables Next;
  - "Stuck?" and the hint line are gone;
  - the task line reads "Done · Red, at (0.5, 0.2), turned 45°".
- **BB-LCOL-45:** a waiting step with no hints and no way to skip shows no "Stuck?". Use `transforms-exercise-1` step 0.
- **BB-LCOL-46:** `_tokens.scss` defines `--action-off` and `--on-action-off` in both themes, and `lesson-bar.scss` uses them for the disabled Next.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/black-box/lesson-column.test.ts`
Expected: FAIL on the new IDs.

- [ ] **Step 3: Implement the markup, styles and tokens**

- [ ] **Step 4: Run them to see them pass**

Same command, then `npm test`. Expected: PASS.

- [ ] **Step 5: Commit**

`feat(lessons): show goals, Stuck? hints and Skip in the lesson bar`

---

### Task 5: Checkpoint 1 (goals, hints and Skip)

This task ends with the owner's sign-off. Block 2 does not start until then.

**Files:**
- Modify: `playwright.config.ts`: `webServer.env: { VITE_LESSON_SAMPLES: '1' }`, with a comment that the visual build includes the sample lessons.
- Create: `tests/visual/lesson-blocks.spec.ts` (`VISUAL TEST SUITE — VIS-LB`)
- Local only, git-ignored: the checkpoint captures and a side-by-side page in the local checkpoints folder

- [ ] **Step 1: Add the visual tests**

The theme and first-visit seeding works as `tests/visual/helpers/mock-scene.ts` does it. For dark and light at 1280, starting from `/app?lesson=sample-goals`:
- **VIS-LB-01:** the bar as it opens, with one goal met; screenshot `.lesson-bar`.
- **VIS-LB-02:** Stuck? opened and one hint shown.
- **VIS-LB-03:** after Skip, with every goal met and Next lit.

Run: `npx playwright test tests/visual/lesson-blocks.spec.ts --update-snapshots`, then the same command again without the flag.
Expected: the second run passes. The other VIS suites still pass.

- [ ] **Step 2: Capture for the owner**

Build with `VITE_LESSON_SAMPLES=1`, then serve with `npx vite preview --port 4320 --strictPort`. Kill only that process by PID when done.

Capture at 2× (`deviceScaleFactor: 2`), 1280 wide, in both themes:
- the editor with the sample lesson;
- the `.lesson-bar` crops of the three states above.

Build a local page that shows each crop beside the matching mock panel (1 · Goals, dark and light), with images at half their natural width.

- [ ] **Step 3: Owner sign-off**

Show the page. Make the requested changes and show them again until the owner signs off.

- [ ] **Step 4: Commit**

`test(visual): screenshot the goals, hints and Skip in the lesson bar`

---

# Block 2: recap, and the button on a lesson's last step

### Task 6: Recap, the named Next, and Finish to the course map

**Files:**
- Modify: `src/core/types/lesson.ts`, `src/features/lesson-engine/model/catalog.ts`, `src/features/lesson-engine/model/useLessonRunner.ts`, `src/features/lesson-engine/model/sample-lessons.ts`
- Modify: `src/features/lesson-engine/ui/LessonBar.tsx`, `src/features/lesson-engine/ui/lesson-bar.scss`
- Modify: `src/features/code-generation/model/code-outline.ts`
- Test: `tests/black-box/lesson-column.test.ts`, `tests/white-box/code-structure.test.ts` (WB-CODE-32), `tests/black-box/lesson-rules.test.ts`, `tests/black-box/learn-page.test.ts`

**Interfaces:**
- Produces:
  - On `LessonStep`, `recap?: { points: string[]; calls: string[] }`, with the spec's doc comment.
  - `nextInCourse(id: string): LessonEntry | null`: the next lesson in `courseOrder()` when it is in the same section; null at a section's end or for an id outside the catalog.
  - `isSectionEnd(id: string): boolean`: true for the last lesson of each section in `courseOrder()`.
  - `courseMap` with a `go(href: string): void` method that calls `window.location.assign`. It is an object so tests can spy on it.
  - `LessonRunner` gains:
    - `nextLesson: { id: string; title: string } | null`;
    - `finishGoesToMap: boolean`.
- **`finish()`:**
  1. Records progress (complete or skipped, as in Task 3).
  2. Then:
     - if `nextLesson` exists, moves to it as ruling L21 says;
     - else if `isSectionEnd`, leaves the lesson and calls `courseMap.go('/learn#' + section.toLowerCase())`;
     - else leaves the lesson (ruling L20).
- **The last step's button:**
  - It reads the next lesson's title, with `ChevronRight` and the title "Next lesson: <title>"; otherwise "Finish", also with `ChevronRight`.
  - `CheckCircle2` is no longer used.
- **Recap** on the last step, after the narration:
  - `ul.lesson-bar__learned`: grid, gap 4 px, 14 px, line-height 1.55. Each point has a 13 px lucide `Check` in `--accent-text`.
  - Then `p.lesson-bar__calls`: 12 px `--ink-faint`, "You used", then one `button.lesson-bar__call` per call. Each call is mono 12 px in `--accent-text`, with an underline that appears on hover and focus, and calls `requestExplain(call)`.
- **`findCallLine`:** for a target matching `^GLU?T?_[A-Z0-9_]+$`, it matches lines containing the name as a whole word (ruling L13).
- **Every sample's last step carries a recap from this task on**, because BB-LRULE-05 applies to the samples. Give the last step of `sample-goals` one now:
  - points: "Goals tick as you meet them, and undo un-ticks them."
  - calls: `glTranslatef` and `glRotatef`.
  The samples added in Tasks 8 and 11 end with a recap too.
- **`sample-recap`** (demo, Transforms, "Translate, Rotate, Scale"):
  - **Step 1:** adds the triangle, translated, rotated and scaled.
  - **Step 2:**
    - narration "You've met the three transforms.";
    - points:
      - "Translate moves, rotate turns, scale stretches."
      - "They apply in reverse code order: scale first, move last."
    - calls `glTranslatef`, `glRotatef`, `glScalef`.

- [ ] **Step 1: Write the failing tests**

- **BB-LCOL-47:** on the last step of `pipeline-demo-1`, the button reads the title of the next course lesson. Pressing it:
  - records `pipeline-demo-1` as complete;
  - starts that lesson at step 1 of its steps, still in Lesson mode.
- **BB-LCOL-48:**
  - on the last step of the Transforms section's last lesson, the button reads "Finish";
  - pressing it records completion, returns to Author mode and calls `courseMap.go('/learn#transforms')` (spy).
- **BB-LCOL-49:**
  - start `transforms-demo-1` over a scene with one quad;
  - press Next through two lessons' last steps, then Exit;
  - the quad is back and is the only object (ruling L21).
- **BB-LCOL-50:**
  - `sample-recap` shows two `.lesson-bar__learned` points and three call buttons;
  - clicking `glRotatef` with `SceneCodePanel` mounted shows Code, and `explainedLine` is the line containing `glRotatef(`;
  - the button reads "Finish", since the sample is outside the course;
  - pressing it ends the lesson without calling `courseMap.go`.
- **WB-CODE-32:** `findCallLine(outline, null, 'GL_TRIANGLES')` finds the `glBegin(GL_TRIANGLES)` line of a scene with one triangle.
- **BB-LPAGE-15:**
  - `nextInCourse('pipeline-demo-1')` is the second Pipeline lesson in course order;
  - `nextInCourse` of each section's last lesson is null, and `isSectionEnd` is true for exactly five lessons;
  - `nextInCourse('nope')` is null.
- **Update BB-LCOL-03 and BB-LCOL-04:** their last step now names the next lesson. Keep their IDs. Assert the new label, and that the next lesson starts.
- In `lesson-rules.test.ts`:
  - **BB-LRULE-05, recaps.**
    - Every lesson under rules ends with a step that has a recap with 1–3 points and at least one call.
    - Each call is found by `findCallLine` in the code generated for that step's scene, rebuilt as BB-LRULE-04 does.
    - `taughtText` adds `recap.calls`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/black-box/lesson-column.test.ts tests/white-box/code-structure.test.ts tests/black-box/lesson-rules.test.ts tests/black-box/learn-page.test.ts`
Expected: FAIL on the new and updated IDs.

- [ ] **Step 3: Implement**

`catalog.ts` must stay free of store imports, since `/learn` reads it (BB-LPAGE-11).

- [ ] **Step 4: Run them to see them pass**

Same command, then `npm test`. Expected: PASS.

- [ ] **Step 5: Commit**

`feat(lessons): close lessons with a recap and name the next lesson on the last step`

---

### Task 7: Checkpoint 2 (recap)

Same procedure as Task 5. The owner's sign-off ends it.

- **Tests:**
  - **VIS-LB-04:** `sample-recap` step 2, dark and light, with the bar reading "Finish". This matches mock panel 4b.
  - **VIS-LB-05:** the last step of `pipeline-demo-1`, with the button naming the next lesson. This matches mock panel 4a's button.
- **Owner page:** each crop beside mock panels 4a and 4b.
- **Commit:** `test(visual): screenshot the recap and the named Next`

---

# Block 3: predict, then see

### Task 8: Predict steps

**Files:**
- Modify: `src/core/types/lesson.ts`, `src/features/lesson-engine/model/useLessonRunner.ts`, `src/features/lesson-engine/model/sample-lessons.ts`
- Modify: `src/features/lesson-engine/ui/LessonBar.tsx`, `src/features/lesson-engine/ui/lesson-bar.scss`, `src/shared/styles/_tokens.scss`
- Test: `tests/black-box/lesson-column.test.ts`, `tests/black-box/lesson-rules.test.ts`

**Interfaces:**
- Produces:
  - On `LessonStep`, `predict?: { options: { id: string; label: string; why: string }[]; correctId: string }`, with the spec's doc comment.
  - `LessonRunner` gains:
    - `predictAnswer: string | null`: the current step's;
    - `pick: (optionId: string) => void`.
  - `pick` records the answer and runs the step's action through the same path as stepping forward: code snapshots, the changed lines and the pane, all in one batch. Extract that path from the step effect into one function both use. Ruling L14 governs replay.
  - `canAdvance` is also false on a predict step with no answer. The keyboard's ArrowRight follows it.
  - The `--warning-text` token: light `#92400e`, dark `#fbbf24`.
- **Look, from the mock.**
- **Before a pick:**
  - The answers sit in `div.lesson-bar__choices` with `role="group"` and `aria-label="Your prediction"`.
  - Each answer is a `button.lesson-bar__choice` at 13.5 px, in `--ink-muted`.
  - Answers are underlined in `--rule-strong` with a 4 px offset. On hover and focus, the text turns `--ink` and the underline `--accent`.
  - Answers are divided by 1 × 12 px hairlines of `--rule-strong`, with 14 px either side.
- **After a pick:**
  - The row becomes `p.lesson-bar__verdict`, a live region, at 13.5 px with line-height 1.55, in `--ink-muted`.
  - It shows the pick at 600 weight in `--ink`.
  - Before the pick sits a lucide `Check` in `--success`, or an `X` in `--warning-text` with the class `is-wrong`.
  - Then the answer's `why`.
- **`sample-predict`** (demo, Transforms, "Translate, Rotate, Scale"):
  - **Step 1:** adds a white triangle at the centre.
  - **Step 2:**
    - narration "We're about to set Translate X to 0.4. Where will the triangle go?";
    - options, with `right` correct:
      - `right` "Right", why "It slid right. X is the horizontal axis.";
      - `up` "Up", why "It slid right. X is the horizontal axis; up would be Y.";
      - `wider` "It grows wider", why "Translate moves a shape; scale changes its size.";
      - `run` "Nowhere until Run", why "The scene redraws as soon as a value changes.";
    - action: sets `translateX` to 0.4.
  - **Step 3:** "Done.", with a recap:
    - point "Translate X moves a shape along the horizontal axis.";
    - call `glTranslatef`.

- [ ] **Step 1: Write the failing tests**

- **BB-LCOL-51:**
  - on `sample-predict` step 2, before a pick, the triangle's `translateX` is 0 and Next is disabled;
  - ArrowRight doesn't advance;
  - four choice buttons show.
- **BB-LCOL-52:**
  - clicking "Up" sets `translateX` to 0.4;
  - the verdict shows "Up" with `is-wrong` and the `up` why;
  - Next is enabled.
- **BB-LCOL-53:** the action runs once.
  - Replace the step's action in a copied lesson with a counting spy.
  - Pick an answer, press Next, then Back.
  - The verdict still shows the pick. The spy ran once for the pick and once for the rebuild, and the scene has the action's effect applied once.
- **BB-LCOL-54:** a right pick shows a `Check` with no `is-wrong`.
- **BB-LCOL-55:** `_tokens.scss` defines `--warning-text` in both themes with the values above.
- In `lesson-rules.test.ts`:
  - **BB-LRULE-06, predictions.** Every predict step under rules:
    - has 2–4 options with unique ids;
    - has a non-empty label and why for each option;
    - has a `correctId` among them;
    - has an action.
  - `taughtText` adds the option labels and whys.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/black-box/lesson-column.test.ts tests/black-box/lesson-rules.test.ts`
Expected: FAIL on the new IDs.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run them to see them pass**

Same command, then `npm test`. Expected: PASS.

- [ ] **Step 5: Commit**

`feat(lessons): ask a prediction before a step's action runs`

---

### Task 9: Checkpoint 3 (predict)

Same procedure as Task 5. The owner's sign-off ends it.

- **Tests:**
  - **VIS-LB-06:** `sample-predict` step 2 before a pick, dark and light.
  - **VIS-LB-07:** after picking "Up", dark and light.
- **Owner page:** beside mock panels 2a and 2b.
- **Commit:** `test(visual): screenshot the prediction step`

---

# Block 4: fill in the code

### Task 10: The code blank rules

**Files:**
- Modify: `src/core/types/lesson.ts`, with the spec's `code` widget type exactly as written
- Create: `src/features/lesson-engine/model/code-blanks.ts`
- Test: `tests/white-box/lesson-engine-internals.test.ts`

**Interfaces:**
- Produces:
  - `templateParts(template: string): (string | number)[]`: splits `'glTranslatef({0}, {1}, 0.0f);'` into `['glTranslatef(', 0, ', ', 1, ', 0.0f);']`. A `{n}` with no matching blank is left as text by the widget.
  - `checkBlank(typed: string, answer: number | string, tolerance = 0.01): 'empty' | 'right' | 'wrong'`: ruling L17.
  - `formatBlankNumber(n: number): string`: ruling L19.

- [ ] **Step 1: Write the failing tests** (next free WB-LESSON IDs)

- **`templateParts`:**
  - the example above;
  - a template with no blanks gives one string;
  - `'{0}{1}'` gives `[0, 1]`.
- **`checkBlank`:**
  - with answer 0.5: `'0.5'`, `'.5'`, `'0.50'`, `'0.5f'`, `'0.505'` and `' 0.5 '` are right;
  - `'0.52'` is wrong, as are `'0.'` and `'-'`;
  - `''` and `'   '` are empty;
  - `'0.5ff'`, `'0..5'` and `'abc'` are wrong;
  - with answer −0.25: `'-0.25'` is right;
  - with answer `'GL_TRIANGLES'`: `'GL_TRIANGLES'` is right, and `'gl_triangles'` and `'GL_TRIANGLE'` are wrong.
- **`formatBlankNumber`:** 0.5 → `'0.5'`, −0.25 → `'-0.25'`, 45 → `'45'`, 0.12345 → `'0.1235'`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/white-box/lesson-engine-internals.test.ts`
Expected: FAIL on the new IDs.

- [ ] **Step 3: Implement `code-blanks.ts` and the widget type**

- [ ] **Step 4: Run them to see them pass**

Same command. Expected: PASS.

- [ ] **Step 5: Commit**

`feat(lessons): add the code answer type and its blank rules`

---

### Task 11: The fill-in widget

**Files:**
- Create: `src/features/lesson-engine/ui/exercise-widgets/CodeBlankWidget.tsx`, with its styles in `exercise-widgets.scss`
- Modify: `src/features/lesson-engine/model/useLessonRunner.ts`, `src/features/lesson-engine/ui/LessonBar.tsx`, `src/features/lesson-engine/model/sample-lessons.ts`
- Test: `tests/black-box/lesson-column.test.ts`, `tests/black-box/lesson-rules.test.ts`

**Interfaces:**
- Consumes: `templateParts`, `checkBlank`, `formatBlankNumber` (Task 10); `tokenizeLine` from `@/shared/ui/code-viewer/tokenize`.
- Produces:
  - `LessonRunner` gains:
    - `codeAnswers: string[]`, reset for each step to one `''` per blank;
    - `setCodeAnswer: (index: number, text: string) => void`.
  - A code step passes when `checkBlank` is right for every blank against `blank.answer(state)`, read in a store selector (as in ruling L8).
  - `skip()` on a code step fills each blank with its answer: numbers through `formatBlankNumber`, names as they are (owner answer: Next lights, no advance).
- **Look, from the mock.**
- **The well:** `div.lesson-code`, with `paper-sunken` background, 3 px radius, padding 9 px 12 px 10 px, mono 13 px at line-height 1.9, nowrap and overflow-x auto.
  - The text parts are coloured with the code panel's `tk-*` token classes from `tokenizeLine`.
  - It adds `has-note` (padding-bottom 22 px) while a note shows.
- **Each blank:**
  - an `input.lesson-code__blank` inside `span.lesson-code__slot`;
  - min width 6ch, growing as `max(6, length + 1)` ch;
  - centred, 0 4 px padding, no border except a 1.5 px bottom border in `--rule-strong`;
  - `aria-label` "Blank n of m".
  - `is-right`: border `--success`.
  - `is-wrong`: border and text `--warning-text`, `aria-invalid`, and `span.lesson-code__note` (11.5 px `--warning-text`, under the blank, centred) holding the blank's `wrong` text, linked by `aria-describedby`.
  - Focused: border `--accent`, plus `box-shadow: 0 1px 0 var(--accent)`.
  - Ruling L18 decides when the verdict shows.
- **`sample-code`** (exercise, Transforms, "Transforms capstone"):
  - **Step 1:** adds the triangle and moves it to (0.5, 0.2).
  - **Step 2:**
    - narration "Write the line that puts it there.";
    - `task` "Fill in both numbers";
    - hints:
      - "The first number is X, the second Y."
      - "The Translate values under Transform are the numbers you need.";
    - exercise:
      - `{ kind: 'code', template: 'glTranslatef({0}, {1}, 0.0f);' }`;
      - blanks: the selected object's `translateX` with `wrong` "that's not X", and its `translateY` with `wrong` "that's not Y".
  - **Step 3:** "Done.", with a recap, which gives `sample-code` the capstone shape:
    - point "glTranslatef takes the X and Y the shape moves by.";
    - call `glTranslatef`.

- [ ] **Step 1: Write the failing tests**

- **BB-LCOL-56:**
  - `sample-code` step 2 renders the well with two blanks labelled "Blank 1 of 2" and "Blank 2 of 2";
  - `glTranslatef` carries the class `tk-glfn`;
  - Next is disabled.
- **BB-LCOL-57:**
  - typing `0.5` and `0.3`, then blurring, marks blank 1 `is-right`, and marks blank 2 `is-wrong` with the note "that's not Y";
  - typing `.2f` in blank 2 enables Next while it is still focused.
- **BB-LCOL-58:**
  - the expected values follow the scene: after setting `translateY` to 0.6, `0.6` is right and `0.2` is wrong;
  - typing in a blank, including ArrowLeft and ArrowRight, never changes the step index.
- **BB-LCOL-59:** Skip on the code step fills `0.5` and `0.2`, enables Next and stays on the step.
- In `lesson-rules.test.ts`:
  - **BB-LRULE-07, code blanks.** For every code step under rules, rebuilt as BB-LRULE-04 does:
    - each blank's `answer` returns a finite number or a non-empty string;
    - the template has one `{n}` for each blank;
    - each blank's `wrong` is non-empty.
  - **BB-LRULE-08, capstones.** For every section in `SECTIONS_ON_THE_BAR`, the section's last lesson in `courseOrder()`:
    - is an exercise;
    - has a step with a `code` widget;
    - ends with a recap.
  - **Sample:** BB-LRULE-08's shape check is a function. A second `it` runs it on `sample-code` directly, so the check has one real case while `SECTIONS_ON_THE_BAR` is empty.
  - `taughtText` adds code templates.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/black-box/lesson-column.test.ts tests/black-box/lesson-rules.test.ts`
Expected: FAIL on the new IDs.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run them to see them pass**

Same command, then `npm test`. Expected: PASS.

- [ ] **Step 5: Commit**

`feat(lessons): fill in the code with typed blanks checked against the scene`

---

### Task 12: Checkpoint 4 (fill in the code)

Same procedure as Task 5. The owner's sign-off ends it.

- **Tests:**
  - **VIS-LB-08:** `0.5` right and `0.3` wrong, blurred, dark and light.
  - **VIS-LB-09:** blank 2 focused with `0.2`, dark and light.
- **Owner page:** beside mock panels 3a and 3b.
- **Commit:** `test(visual): screenshot the fill-in step`

---

### Task 13: Documents

**Files:**
- Modify: `docs/product-plan.md` (Appendix B), `docs/specs/2026-10-04-website-overhaul-roadmap.md`, `tests/README.md`

- [ ] **Step 1: Product plan, Appendix B.** Apply the spec's amendment (section 6), covering only the blocks that landed:
  - **Structure:** a step may also hold goals, hints, a Skip action, a prediction and a recap.
  - **Answer types:** add code (typed blanks).
  - **Authoring guidance:** the arcs as a guideline; every waiting step has hints and a Skip action; every generated name is taught somewhere; each section ends with a capstone.
  - **Validation:** the coverage and structure tests (BB-LRULE).
  - Define a waiting step as ruling L1 does.
- [ ] **Step 2: Roadmap.**
  - Add divergence 18, the spec's sentence. If a block didn't land, name only the blocks that did.
  - Under "Next projects" item 4, add a status line: the blocks landed, with the date, and the content follows section by section.
- [ ] **Step 3: `tests/README.md`.**
  - Add `lesson-rules.test.ts` (BB-LRULE-*: coverage, structure and wording) under black-box.
  - Add `lesson-blocks.spec.ts` (VIS-LB-*) wherever the visual suites are listed.
- [ ] **Step 4: Verify and commit**

Run: `npm run lint && npm run build && npm test`, then `git checkout -- tests/reports`.
Expected: all pass.

`docs: record the lesson blocks in the product plan, roadmap and test map`

---

## Self-review

- **Spec coverage:**
  - Section 1 blocks: Tasks 3–4, 6, 8 and 10–11.
  - The look and `--warning-text`: Tasks 4, 6, 8 and 11.
  - Section 2 coverage: Task 1, with its fields extended in Tasks 6, 8 and 11.
  - Section 4 data and progress: Tasks 1, 2, 6, 8 and 10.
  - Section 5 tests:
    - coverage: BB-LRULE-01;
    - structure: BB-LRULE-03 to 08 and BB-LRULE-02;
    - blocks: BB-LCOL-37 to 59;
    - progress: BB-LEARN-13 to 15 and BB-LPAGE-12 to 15;
    - visual: VIS-LB.
  - Section 6 docs: Task 13.
  - Section 7 order and freeze: the Global Constraints and the four blocks.
  - The manuscript's entries 5–7 need no change.
- **Changes from the spec:**
  - Skip doesn't advance (owner, 2026-10-20).
  - "Waiting step" is narrowed (L1).
  - The coverage count is 115, not 118 (L11).
  - Every lesson's last step names the next lesson, not only recap steps (owner, 2026-10-20).
- **Type consistency:** the runner fields are named once in each task's Interfaces block, and later tasks consume those names (`goals`, `canSkip`, `skip`, `skipped`, `nextLesson`, `predictAnswer`, `pick`, `codeAnswers`, `setCodeAnswer`).
