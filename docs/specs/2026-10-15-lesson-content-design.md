# Lesson content — design

Date: 2026-10-15
Roadmap: "Next projects", item 4 in [the overhaul roadmap](2026-10-04-website-overhaul-roadmap.md), including Should item 11 (polish the demo lessons)
Builds on: [the editor rail redesign](2026-10-14-editor-rail-design.md) (the lesson bar, the `task` and `pane` fields) and [the code and math rework](2026-10-15-code-math-rework-design.md) (the journey stages, `mathStage`, the explanation strip)

## Purpose

The owner's concern, in their words (2026-10-14): "I want to improve the lessons as a whole currently I feel a lack of content for each lesson, it lacks quantity and quality as well as depth."

The library has 46 lessons. Most demos are 4–5 steps, and most exercises are 2: one task, then a congratulation. Narration names each GL call but rarely says why; nothing asks the student to think before they see; some narration is inaccurate (one step says the T · R · S order is "exactly the order glPushMatrix wraps") or names places the editor no longer has. The generated code can contain 118 OpenGL and GLUT names, and the lessons teach 48 of them.

This project makes the course complete and deep enough that a student who finishes it can read the whole generated program and write a similar one themselves.

## Owner decisions (2026-10-15)

| Question | Decision |
| --- | --- |
| What "lacks quantity, quality and depth" covers | All of: depth inside each lesson, more lessons, the quality of the existing text, harder exercises, and "completion of their knowledge" |
| Completion of their knowledge | Full topic coverage, a capstone at the end of each section, a recap at the end of each lesson, and students able to write the program themselves |
| What coverage is measured against | Every OpenGL and GLUT name the generated code can contain is taught in at least one lesson |
| How gaps are filled | Extend an existing lesson when the name fits; write a new lesson only for a genuinely new topic |
| Order of work | Section by section, in pipeline order. A section is finished completely before the next starts. The expo lessons go first once the owner chooses them (undecided) |
| New lesson blocks | Predict, then see; goal checklist; recap card; fill in the code |
| Lesson shape | The arcs in section 3 are a guideline, not a rule |
| Help in exercises | A hint ladder of up to three hints |
| Skip | Always available as a quiet link. It does the step for the student, then moves on; the lesson counts as skipped, not completed |
| Fill in the code | The student types into blanks; numbers count within a tolerance |
| "Write it themselves" | Every section capstone ends with Fill in the code on that section's key lines |
| Scheduling | The blocks are built after the code and math rework, by the Oct 28 freeze, in the order goal checklist + hints + Skip, recap, predict, fill in the code. Each ships complete or not at all |
| Which new lessons | Decided per section: when the work reaches a section, it proposes that section's list and the owner approves it before writing |
| Hints | Every step that waits for the student has one to three hints |
| Look | The typeset blocks in the mock `lesson-blocks-v5` (approved) |

## 1. The new blocks

All four live in the lesson bar. They follow its rules: the narration is the loudest thing, Next is the only coloured control, and no element is boxed except the code the student types into.

### Goal checklist

- An exercise step can list goals instead of a single success check. They show as one typeset line under the narration: a drawn ring, then a short label ("Red", "At (0.5, 0.2)", "Turned 45°").
- A met goal's ring fills with a green tick and its label recedes to faint ink, so the eye lands on what is left. No current values, no "done".
- The step passes when every goal is met; the task line reads "Done" and Next lights. Goals are re-checked on every store change, as success checks are today, so undo un-ticks a goal.

### Hints and Skip

- **"Stuck?"** is a quiet link with a help icon at the left of the bottom line, on every step that waits for the student.
- Clicking it turns it, in place, into two links: **Show a hint · Skip this step**. There is no menu and no popover.
- **A hint** appears as one quiet line under the step's content, with a lamp icon and "1 of 3". The links then read **Show another hint · Skip this step**, until the last hint is shown.
- **Skip this step** runs the step's `solve` action through the same store actions the GUI uses, so the next step finds the scene it expects, then advances. For a widget step (predict, multiple choice, ordered list, fill in the code), Skip shows the right answer and advances.
- **Progress:** a lesson with any skipped step is recorded as skipped. /learn shows it with its own mark and the meta text "Skipped", and offers it again. Completing it later without skipping replaces the mark with done. "Next up" moves past skipped lessons to the next one the student hasn't started. The done count counts completed lessons only.

### Predict, then see

- A step can ask a prediction before its action runs. The narration poses the question ("We're about to set Translate X to 0.4. Where will the triangle go?"). The answers are a row of underlined words divided by hairlines.
- Picking an answer runs the step's action, collapses the row to the picked answer with a tick (right) or a cross (wrong), and adds one sentence of why. The sentence is written for each answer.
- A prediction never gates: right or wrong, Next lights once an answer is picked.
- Back to a predict step shows it already answered. Its action has run, and is not run twice.

### Fill in the code

- A step shows one line of code, set exactly as the code panel sets it, in a sunken well. It has one or more blanks.
- The student types into the blanks. Blanks are checked as they type:
  - A number counts within a tolerance (default 0.01); `0.5`, `.5`, `0.50` and `0.5f` all count.
  - A name must match exactly.
- The expected values come from the scene through a function, so a blank can ask for the number the student just set.
- **Right blank:** green underline. **Wrong blank:** amber underline and a reason of a few words under it ("that's not Y"), written per blank. **Focused blank:** a thicker cobalt underline.
- The step passes when every blank is right.
- This is a new exercise answer type, **code**, as Appendix B of the product plan requires. The code panel stays read-only and generated; the student's answer never edits the program.

### Recap

- The last step of a lesson can carry a recap:
  - one narration line that introduces it;
  - up to three takeaways at nearly narration size, each with a small cobalt tick;
  - one line, "You used …", listing the calls the lesson taught.
- Each call is a link that opens its line in the code panel with the explanation strip (from the code and math rework).
- There is no heading or label. The Next button names the next lesson in the course ("Matrix Representation ›"); on a section's last lesson it reads **Finish** and opens the course map.

### Look

The approved mock is `.superpowers/brainstorm/434-1792049295/content/lesson-blocks-v5.html` (local, not committed). It shows every block in both themes, built on the shipped `lesson-bar.scss` and the real tokens. Rules from it:

- Type does the work. There are no pills, chips or cards.
- Icons are drawn (rings, tick, cross, lamp, help) in one stroke weight, never Unicode characters.
- Status colour appears only on status. Green marks a met goal, a right answer and a right blank. Amber marks a wrong answer or blank. Cobalt marks the blank in focus.
- Numbers use tabular figures.
- A new token `--warning-text` (dark `#fbbf24`, light `#92400e`) carries amber text, since `--warning` is too dark for text on the dark theme. The disabled Next uses colours that keep 4.5:1.

## 2. Coverage

- **The list:** every OpenGL and GLUT name in the generator's source (`gl*`, `glut*`, `GL_*`, `GLUT_*`), minus the generator's own TypeScript identifiers that only look like GL names (such as `GLUT_FUNCS`). Today that is 118 names.
- **Taught** means the name appears in at least one lesson's narration, hint, predict answer, recap calls or fill-in line.
- **A coverage test** compares the two and fails when a name is untaught. It starts with an allowlist of today's 70 untaught names. Each section's work removes that section's names from the allowlist, and the project ends with the allowlist empty.
- **Placing a name:** extend an existing lesson when the name fits its topic (`glClearColor` in the first Pipeline demo, `GL_TRIANGLE_FAN` in "The Geometry Alphabet"). Propose a new lesson only for a genuinely new topic, for example:
  - matrix modes and the window (`glMatrixMode`, `glLoadIdentity`, `glViewport`, `glutReshapeFunc`);
  - flat and smooth shading;
  - texture setup (`glGenTextures`, `glTexParameteri`, `glTexEnvi`);
  - the GLUT program's setup calls.

## 3. Lesson shape

These arcs are a guideline. A lesson may skip a part that does not fit, such as no prediction where there is nothing to guess.

- **Demo:** a question → a prediction → see it happen → why, pointing at the code line and the math stage → a recap.
- **Exercise:** goals → hints if stuck → "how your code does it" → a recap.
- **Section capstone** (one per section, the section's last lesson):
  - goals that combine the section's skills, without step-by-step help;
  - then Fill in the code on the section's key lines;
  - then the section recap.

  The key lines are: Pipeline, the GLUT setup in `main()`; Primitives, `glBegin`, `glColor3f` and `glVertex2f`; Buffers, the VBO calls; Transforms, the transform calls; Textures, the texture setup and `glTexCoord2f`. By the last section, a student has written every part of a program once.

The product plan's authoring guidance still holds: one or two sentences per step, and many small steps rather than a few large ones. Depth comes from more steps, not longer narration.

A **waiting step** is one with `waitForUser`, `goals` or an exercise widget (multiple choice, ordered list or code). A predict step is not a waiting step, since it never gates.

### Quality bar for every lesson, new or rewritten

- **Accurate.** Each claim about OpenGL is checked against the generated code and the OpenGL 1.x behaviour VAMS models.
- **Current.** It names places as the editor has them now: the rail's Add, Scene, Settings and Callbacks panels, the lesson bar, Code and Math, and the journey's stages.
- **One voice.** Second person, plain words, short sentences, and the product's own terms.
- **Silent about gaps.** No banned words.
- **The new fields filled:**
  - every waiting step has a `task` line and one to three `hints`;
  - every step that discusses the math has `pane: 'math'`, plus `mathStage` where the context would open the wrong stage;
  - every waiting step has a `solve`.

## 4. Data

New optional fields on `LessonStep` in `core/types/lesson.ts`:

```ts
/** Goals that must all be met; replaces successCheck on the step that has them. */
goals?: { label: string; check: (state: VamsState) => boolean }[];
/** One to three hints, shown one at a time from "Stuck?". */
hints?: string[];
/** What Skip does: the same store actions the GUI uses. Required on every step that waits for the student and has no widget. */
solve?: (state: VamsState) => void;
/** Ask before the step's action runs; the action runs once an answer is picked. */
predict?: { options: { id: string; label: string; why: string }[]; correctId: string };
/** The lesson's closing points and the calls it taught. */
recap?: { points: string[]; calls: string[] };
```

`ExerciseWidget` gains a third kind:

```ts
| {
    kind: 'code';
    /** The line, with {0}, {1}, … where the blanks go. */
    template: string;
    blanks: {
      answer: (state: VamsState) => number | string;
      tolerance?: number; // numbers only, default 0.01
      wrong: string;      // the few words shown under a wrong blank
    }[];
  }
```

**Progress** (`features/lesson-engine/model/progress.ts`, browser key `vams-lesson-progress`): it gains `skipped: string[]`. Reading old progress without the field gives an empty list, so no student loses progress. `LessonStatus` gains `kind: 'skipped'`.

**Ids:** existing lesson ids stay, so links (`/app?lesson=`) and saved progress keep working. New lessons get new ids in the same pattern. The catalog lists lessons in course order, and its parity test continues to hold.

## 5. Tests

New tests, with the next free IDs in their suites:

- **Coverage:** the coverage test from section 2.
- **Structure:**
  - every waiting step has one to three hints and a `task`;
  - every waiting step without a widget has a `solve`, and running it makes the step pass;
  - every predict step has a `why` for each answer;
  - every code blank's `answer` resolves against the step's scene;
  - every section's last lesson is a capstone that ends in a `code` widget and a recap;
  - no student-facing string contains a banned word.
- **Blocks:**
  - goals tick and un-tick with undo, and the step passes when all are met;
  - Stuck? → hint → next hint → Skip;
  - Skip advances with the scene in the solved state and records the lesson as skipped;
  - completing a skipped lesson later marks it done;
  - a predict step runs its action once, including after Back;
  - a fill-in blank accepts `0.5`, `.5`, `0.50` and `0.5f`, and rejects a value outside the tolerance;
  - the recap's calls open the code line;
  - Next names the next lesson, and Finish appears on a section's last lesson.
- **Progress:** old progress without `skipped` loads; /learn shows skipped lessons and "Next up" moves past them.
- **Visual:** captures of each block in both themes at 1280 px.

## 6. Product plan, roadmap and manuscript

**Product plan amendment** (approved by this design), to Appendix B:

- **Structure:** a step may also hold goals, hints, a Skip action, a prediction and a recap.
- **Answer types:** **code** (typed blanks) joins multiple choice, ordered list, numeric and position.
- **Authoring guidance:**
  - the arcs above, as a guideline;
  - every waiting step has hints and a Skip action;
  - every generated name is taught somewhere;
  - each section ends with a capstone.
- **Validation:** the coverage and structure tests.

**Roadmap:**

- Item 11 is marked complete when the expo lessons are polished.
- "Next projects" item 4 gets its status as each section lands.

**Manuscript divergences:**

- Entries 5–7 already record that changing the lesson library changes the evaluated step count and that the learning results do not cover new lessons.
- A new entry: "The evaluated lessons were narrated steps with scene actions and two exercise kinds (multiple choice and ordered list). Lessons now also have goal checklists, hints, Skip, predictions, recaps and typed code blanks, and each section ends with a capstone."

## 7. Delivery

**Blocks (editor code):**

- Branch `feat/lesson-blocks`, started after the code and math rework merges.
- Built in this order, each complete before the next:
  1. goal checklist, hints and Skip, with the skipped progress state;
  2. recap;
  3. predict, then see;
  4. fill in the code.
- They land by the Oct 28 freeze. A block not finished by then waits, and lessons do not use it.

**Content (lesson data):**

- Branch `feat/lesson-content`. It starts once the first block lands, or earlier using only today's step types where a section needs no new block.
- Work runs section by section in pipeline order: Pipeline, Primitives, Buffers, Transforms, Textures.
- **For each section:**
  1. Propose the section's lesson list to the owner: rewrites, extensions, new lessons and the capstone, with the names each one teaches. Get approval.
  2. Write the section to the quality bar.
  3. Remove its names from the coverage allowlist.
  4. Run lint, build and tests.
  5. Merge.
- If the owner names the expo lessons, they are polished first.
- Content may land until Nov 2. A section not finished by then keeps its current lessons, which still work. Nothing half-rewritten ships.

## Rulings made in this spec

Decisions taken while writing, not asked one by one:

- **Skip and progress:**
  - A lesson with any skipped step counts as skipped.
  - "Next up" moves past skipped lessons.
  - The done count counts completed lessons only.
- **Predict:** the action runs once, and Back shows the answered state.
- **Fill in the code:**
  - The default tolerance is 0.01.
  - A blank's expected answer can come from the scene.
- **Recap and capstones:**
  - The recap has no heading.
  - Its calls link into the code panel.
  - Next names the next lesson.
  - Capstones are ordinary exercises placed last in each section.
- **Tokens:** a new `--warning-text` token.
- **Ids and progress:** existing lesson ids stay, and old progress loads without loss.
- **Coverage:** an allowlist that empties section by section.
