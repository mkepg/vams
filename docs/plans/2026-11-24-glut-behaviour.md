# GLUT behaviour: plan

**Goal:** the Lab runs a program as FreeGLUT 3.0.0 runs it on the Intel reference: misuse messages, input, pace, closing and stack depths.

**Spec:** [2026-11-24-glut-behaviour-design.md](../specs/2026-11-24-glut-behaviour-design.md)

**Reference toolchain:** the course `mingw32` folder (`VAMS_GLUT_TOOLCHAIN`), built with `x.bat`'s flags. Probe executables are named `vams-*.exe` so no driver profile moves them to NVIDIA.

## Global constraints

- Stage paths explicitly. Never stage `.gitignore`, AGENTS.md or manuscript/.
- Before each commit run `npm run lint && npm run build && npm test` from PowerShell, then `git checkout -- tests/reports`.
- Files are CRLF except `.sh`.
- Student-facing text is British English, sentence case, with no em dash.
- Test IDs stay stable. New ones continue from BB-LAB-111, VIS-LAB-12, ALG-LAB-40, BB-CB-25 and ALG-RUN-2.

## Task 1: Intel's stack depths

- `src/shared/lib/gl-raster/context.ts`: replace `MAX_STACK_DEPTH` with `MAX_MODELVIEW_STACK_DEPTH = 32` and `MAX_PROJECTION_STACK_DEPTH = 4`. Keep the index export names in step.
- ALG-LAB-41 asserts:
  - the 4th projection push sets `GL_STACK_OVERFLOW` and leaves the top unchanged;
  - the 32nd modelview push overflows;
  - a pop at the bottom sets `GL_STACK_UNDERFLOW`.

## Task 2: Misuse, as FreeGLUT does it

- **The probe.** `tests/fixtures/lab/glut/misuse.cpp` reads a case name with `scanf` and runs it. There is one case for each init check and each window check of the 41 functions, plus the warnings, the second `glutInit`, `glutMainLoop` with no window, the missing display callback, and `glutLeaveMainLoop` with `GLUT_ACTION_GLUTMAINLOOP_RETURNS`.
- **The recorder.** `scripts/lab/capture-glut.mjs misuse` builds the probe and runs each case with the case name on stdin. It writes `{ case: { stdout, stderr, exit } }` to `tests/fixtures/lab/glut/reference.json`, with the program path replaced by `<program>`.
- **The runtime.** `glut-runtime.ts`:
  - `fail()` names the program only after `glutInit`, and `warn()` prints without exiting.
  - `requireInit` and `requireWindow` follow the recorded cases.
  - `vams_main.c` passes `c:\openglcpp\Program.exe` as `argv[0]`, and the runtime takes the name from it. Rebuild the runtime with `lab/runtime/build.sh`, and bump `runtime-version.ts` if the published runtime must change.
- **Tests:**
  - BB-LAB-112 replays every recorded case on `GlutRuntime` with a fake host and compares stdout, stderr and the exit code.
  - VIS-LAB-13 runs a sample of cases end to end in the Lab: no init, no window, the missing display callback, the warning, and leave-returns.

## Task 3: ✕ closes the window

- Add `close` to `LabEvent` (`shared-layout.ts`). The page posts it on ✕, then terminates the worker if no `exit` arrives within 1 s.
- The runtime's dispatch of `close` calls the close callback, destroys the window, and ends the loop by the `GLUT_ACTION_ON_WINDOW_CLOSE` action. When `glutMainLoop` returns, the window is gone.
- Tests:
  - BB-LAB-113: close calls the callback, then `exit(0)`; with `GLUTMAINLOOP_RETURNS`, main carries on and `glutGetWindow()` is 0.
  - BB-LAB-114: the page terminates a worker that doesn't exit within 1 s.

## Task 4: The Lab drops the wait for the screen

- `present()` publishes without waiting for `FRAME_ACK`. A frame is drawn when the page has taken the last one published (`FRAME_ACK` ≥ last frame), and held otherwise. Remove the `TICK` catch-up and `MAX_FRAMES_BEHIND`.
- `showUnshown` stays, so the last frame run before the program waits is the one on screen.
- Tests:
  - BB-LAB-22's pacing cases and the catch-up tests are rewritten: a loop of 1,000 idle frames finishes without the page taking any frame and draws only the frames the page will see.
  - `pace.cpp` and VIS-LAB-14 check the timer means against `reference.json` (within 1 ms) and idle at 4 or more frames per refresh.

## Task 5: Exported code and the editor's Run step 60 times a second

- `code-generator.ts`: `_vams_idle` starts with the 60-step gate from the spec, and the explanation and outline text describe it.
- `run-controller.ts`: step when `floor((t - t0) * 60 / 1000)` moves on, with `t0` half a step before the first frame; at most one step a refresh.
- Change "every frame" to "60 times a second" in the idle text that describes the editor's step: `rule-copy.ts`, `help-content.ts`, `code-outline.ts`, `code-explanations.ts`, and the lessons that narrate it.
- Regenerate the exported gallery programs in `tests/fixtures/lab/programs` and `src/features/lab-files/examples`, and re-record their Intel references. Their first frames don't change, but their hashes do.
- Tests:
  - ALG-RUN-03 uses a fake clock to check the pace: 60 Hz gives one step a refresh; 144 Hz gives 60 steps a second; a 2-second stall gives one step, not 120.
  - The code-generation tests include the gate.
  - VIS-LAB-12 still compares the jeepney's speed in the Lab and the editor.

## Task 6: Input, measured

- **The probe.** `tests/fixtures/lab/glut/events.cpp` prints one line per callback, with its values and `glutGetModifiers()`. It attaches a right-button menu.
- **The script.** `events.script.json` lists:
  - keys: letters, Shift+letter, Ctrl+letter, digits, punctuation, Space, Enter, Escape, Backspace, Delete, F1, F12, the arrows, Page Up, Home, End, Insert, Shift, Ctrl and Alt alone;
  - mouse: left press, drag, release, a drag out of the window, middle, a wheel turn, and a right click that picks the menu's second entry;
  - a resize to 420 × 260, then the close button.
- **The driver.** `drive.cpp` plays the script with `SendInput`, after putting the window in front. The recorder writes the native trace into `reference.json`.
- **The Lab test.** VIS-LAB-15 plays the script with Playwright and compares the traces line for line, apart from the named exceptions.
- Fix `glut-input.ts` and the dispatch until the traces match. List the exceptions in the test and in `docs/lab-operations.md`.

## Task 7: Docs

- `docs/lab-operations.md`:
  - the reference toolchain;
  - how to re-record (`capture-glut.mjs`);
  - the pace;
  - ✕;
  - the named exceptions.
- `tests/README.md`: the new files.
- `docs/specs/2026-10-12-functional-callbacks-design.md`: a note on the 60-steps pace.
