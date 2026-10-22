# Editor inspection follow-up: window shape, narrow layout, Buffers panel, spelling, generated code

## Purpose

After the lesson content merge (main `e59fa28`), the editor was inspected for changes that need to be made: 37 screenshots across every sample scene, rail panel, Math stage, one lesson per section, the menus and dialogs, and 960 px, plus the browser console and the code. Five clear bugs were fixed straight away on `fix/polish-leftovers`, which also holds the per-style texture fix and the separate-arrays Math card. This spec covers the five findings the owner decided on, one question at a time, on 2026-10-22.

The editor is used live at the CS Expo talk on Nov 4 and freezes on Oct 28. The audience sees the canvas from a distance, often at 960 to 1280 px on a projector, so what the canvas shows and whether it can be seen matter most.

## Decisions

1. **The program window keeps the viewing volume's shape.** Owner's choice over keeping the stretch or a fixed 4:3 window.
2. **At narrow widths the drawer pushes the canvas aside** instead of covering it. Owner's choice over moving the window into the clear area or leaving the overlay.
3. **The Buffers panel's choices become a stacked list** (mockup B): one full-width row per option with its description beside it. The owner looked at a segmented control (A), A with a key, and two-line buttons, and chose B for its descriptions.
4. **British spelling everywhere students read**, matching the 59 lessons.
5. **The generated code is tidied**: the unused `#include <iostream>` goes, and the numbered stb_image comment is reworded.

The owner confirmed the playback of all five, including the points marked as guesses there; they are written below as decided.

## 1. The window keeps the volume's shape

### Today

`useProgramWindow` (`widgets/canvas/model/program-window-store.ts`) places the floating window with `centredRect(stage, STAGE_MARGIN)`: the whole stage minus a 24 px margin, whatever its shape. The canvas body then maps the viewing volume (`viewportLimits`, −1..1 by default) onto that body, so at 1280 × 800 the body is about 536 × 614 and a square draws taller than wide. The stage's height changes with the lesson bar, so the window, and the distortion, change from step to step. `glutInitWindowSize` in the generated code follows the body's size (`useCanvasSize`, which reads `.canvas-wrapper`).

### Wanted

- **Opening and refitting.** While the student has not placed the window (`placedByUser` false), the floating window is the largest rectangle whose body has the viewing volume's aspect ratio, (maxX − minX) : (maxY − minY), and that fits the stage less the margin, centred on the stage. The body, not the window frame, carries the ratio: the title bar's 28 px and the 1 px borders are added outside it. The window refits whenever the stage changes size (lesson bar, drawer, code column, browser) or the volume changes in Settings.
- **The student's own size wins.** Moving or resizing the window by its edges sets `placedByUser` as today. From then on the window keeps the student's rect (clamped to the stage, as `clampRect` does now) and stretches freely, as a real GLUT window does, so the reshape lessons and Run's Reshape still work. It is not snapped back on the next lesson step.
- **Getting the shape back.** Double-clicking the title bar or Maximise is the reset. Maximised, the window is the largest window of the volume's shape that fits the stage, centred, not a window filling the whole stage, and it keeps refitting while maximised as the stage changes. Restoring from it returns to the shape-fitted floating window and clears `placedByUser`: the student's earlier placement is dropped, because Maximise is how they asked for the shape back. A maximised window has no resize grip, as today, so it cannot be stretched until restored. (Today Maximise fills the stage; with this change a maximised window no longer distorts the scene.)
- **Extreme volumes.** The Viewing volume editor already refuses a left at or past the right, or a bottom at or past the top, so the ratio is always finite and positive. The fitted window never exceeds the stage: for a very wide or tall volume it is limited by the stage, and its shorter side may then fall below `MIN_BODY`, which stays the limit for the student's own resizing only. (My call.)
- **Run.** Run draws in this same program window and the same `useProgramWindow` store since `d2a5fb2`; there is no second window. The shape comes from the scene's `viewportLimits` only. A Reshape rule set to Keep proportions widens the volume at run time (`stage.volume.limits`); that widened volume must not reshape the window, or the window and the volume would chase each other. Resizing during Run still fires Reshape, as it does since `d2a5fb2`.
- **Code.** `glutInitWindowSize` keeps following the body's size, so for −1..1 it reads, for example, `glutInitWindowSize(536, 536)`. Nothing else in the generated code changes.
- **Lessons.** No lesson text depends on the window's old shape. "When the Window Changes Size" (primitives-demo-7) predicts what Stretch does "in a wide window"; with the window now square by default, that step's narration must still hold, or the step must widen the window itself before asking. The builder checks it and adjusts the step if needed.

## 2. At narrow widths the drawer pushes the canvas

### Today

Below 1100 px (`useNarrowLayout`), `.editor--narrow .editor__panel` is absolutely placed over the canvas column at 272 px wide (`pages/editor/ui/editor-app.scss`), with `--editor-panel-width: 0px`, so the open drawer covers the left of the canvas. In a lesson the lesson bar also sits over the bottom of the stage, and in Sprite Extraction at 960 the shape being edited is barely visible.

### Wanted

- Below 1100 px the open drawer takes its 272 px in the grid, beside the rail, and the canvas column narrows to what is left. The canvas, the canvas header and the program window stay fully visible; with decision 1 the window refits, so the scene draws smaller but undistorted.
- Closing the drawer (Hide, a rail tab, Esc) gives the room back to the canvas. The keyboard and focus behaviour of the drawer stays as it is today (BB-LCOL-10, -11, -12, -15).
- At or above 1100 px nothing changes.
- Only the editor panel drawer moves into the grid. The Learn drawer, opened from Learn in the top bar, stays an overlay as it is today.
- The lesson bar keeps its place under the stage. The drawer no longer needs its `padding-bottom` for the bar if the bar no longer overlaps it; the builder keeps whichever is right once the drawer is in the grid.
- Product plan line "Below 1100 px the panel opens as a drawer over the canvas, beside the rail" becomes "beside the canvas, which narrows to make room".

At 960 with the drawer open, the canvas column is about 300 px wide, so the window is about 250 px square: small but whole. That is the owner's chosen trade.

## 3. The Buffers panel as a stacked list

### Today

`features/buffers/ui/BuffersPanel.tsx` draws Rendering Mode (Immediate, Vertex Array, VBO), Buffer Usage (Static, Dynamic, Stream, VBO only) and Update Method (Sub Data, Map Buffer, VBO with Dynamic only) as rows of cards in its own radiogroup, with a name and a description in each card. At 1280 the cards wrap words ("Immediate" overflows, "occasional|" is cut).

### Wanted (mockup B)

The mockup lives in local scratch (`.superpowers/brainstorm/1535-1792662549/content/buffers-panel.html`), which git does not keep, so the row is described here in full:

- Each of the three choices is one bordered box, full width, on `--field-bg` with a `--hairline` border and `--radius-m` corners, holding one row per option, divided by hairlines.
- A row is about 30 px tall (6 px padding top and bottom) and laid out in three columns: an 11 px round marker, the option's name (weight 600, `--text-sm`), and its description (`--text-xs`, `--ink-muted`), all on one line.
- The chosen row has the accent tint (`--accent-tint`) and a filled marker in `--accent`; the others have an outline marker in `--field-line`.
- Each block keeps its label above the box on the left and its GL hint on the right, in the mono face, as today (`Rendering Mode` … `glBufferData`, `Buffer Usage` … `GL_STATIC_DRAW`).
- Update Method gets the same treatment, so the panel reads as one design.
- Descriptions are short enough to stay on one line at 272 px, in British spelling, for example: Immediate "re-sent every frame", Vertex Array "sent each frame, in one batch", VBO "uploaded once"; Static "set once", Dynamic "changed now and then", Stream "rebuilt every frame". The builder fits the final wording to the width and keeps the meaning of today's hints.
- The labels and GL hints beside each block (`glBufferData`, `GL_STATIC_DRAW`, `glDrawArrays`) stay. The Indexed Drawing switch and the note under it are unchanged.
- It stays a radiogroup with today's keyboard behaviour (arrow keys move and choose), names and roles, so lessons and tests that pick options by name keep working. Both themes, built from the tokens in `_tokens.scss`.

## 4. British spelling where students read

- Every student-facing string becomes British: Help (`features/help/model/help-content.ts`), the course map lines (`features/lesson-engine/model/catalog.ts` descriptions and summaries, which the Learn drawer, `/learn` and the home page show), the Math panel's prose and labels (`features/math-panel`), panel labels, tooltips, empty states, toasts, the code panel's line explanations (`features/code-generation/model/code-explanations.ts`) and the generated code's comments.
- The words to catch include colour(s), rasterisation/rasterise, normalised/normalise, centre/centred, grey, behaviour, minimise/maximise, visualise, optimise, initialise, and their forms.
- Unchanged: OpenGL and GLUT names and macros (`glColor3f`, `GL_COLOR_ARRAY`, `glutInitDisplayMode`), code identifiers, CSS, file names, store fields, and anything a student never reads.
- A test guards it: it reads the student-facing text sources listed above, removes OpenGL and GLUT names (`gl…`, `glut…`, `GL_…`, `GLUT_…`) and anything in backticks or code spans, and fails on any whole-word American form left. The lessons are already British and are included. The manuscript-linked site pages (home, /learn, /about) are included through the catalog lines they show; their own page copy is checked too. (My call on the mechanism.)

## 5. Tidy generated code

- In `features/code-generation/model/code-generator.ts`, the textured scene's header loses `#include <iostream>`, and "// 1. Define the implementation macro BEFORE including the header" becomes "// stb_image: define its implementation in exactly one file, before including it".
- The code panel's explanation for `#include <iostream>` (`code-explanations.ts`) goes with it.
- The generated program must still compile with the same libraries; nothing it calls came from `<iostream>`.

## Constraints

- Lands by the Oct 28 freeze, on `feat/editor-inspection` (branched from `fix/polish-leftovers`, so the earlier fixes ship with it).
- Product rules in `AGENTS.md`: one-way data flow, generated code from state only, no banned wording, FSD layering, tokens for styles.
- The program window's state stays runtime only, never saved (as `useProgramWindow` is today), so no store version bump or migration.
- Every check passes: `npm run lint`, `npm run build`, `npm test`, and the visual suite (`npm run test:visual`) with baselines re-recorded only where the change is intended. Visual baselines are per machine in `tests/visual/baseline.local/` (ignored by git) and CI does not run the visual suite, so they are recorded on this machine.
- The manuscript is final; any change to what it describes is recorded in the roadmap's divergence list. Decision 2 changes the narrow layout the evaluated build had, and decision 1 changes the canvas's default shape; both go there.

## Non-goals

- No change to how the canvas maps the volume when the student stretches the window: it still stretches, as GLUT does.
- No new controls for window size; the student resizes by the edges as today.
- No change at or above 1100 px apart from decisions 1, 3, 4 and 5.
- No other redesign of the Buffers panel beyond the three choices' layout.

## Left to the builder

- How the fitted rect is computed and where (a pure function beside `centredRect` is the natural place, with unit tests for wide, tall, tiny and non-square volumes).
- The exact description wording in the Buffers list, within the meaning above.
- Whether primitives-demo-7's step needs to widen the window before its prediction.
- Which visual baselines change, and the screenshots that show each decision working at 1280 and 960 in both themes.
