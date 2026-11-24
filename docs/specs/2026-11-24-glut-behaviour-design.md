# GLUT behaviour: the Lab runs a program as FreeGLUT runs it on a lab PC

The second of the four pieces that take the Lab out of "Experimental" (the first is [2026-11-24-intel-reference-design.md](2026-11-24-intel-reference-design.md)). The owner's order is drawing, then GLUT behaviour, then a class of 40, then refusal messages. On 24 Nov 2026 the owner delegated the calls ("decide for me, I approved up to push"), so every call below is the builder's, recorded here.

## Intent

A program that runs in the Lab should behave as it does on the lab PC: the same callbacks in the same order with the same values, the same speed, the same messages when it misuses GLUT, and the same way of ending. A student who tests in the Lab should meet no surprises in the lab.

## The reference

FreeGLUT 3.0.0 (`glutGet(GLUT_VERSION)` is 30000) from the course toolchain, built with `x.bat`'s flags, running on the development laptop: Windows 11, Intel Iris Xe, driver 31.0.101.4502. This is the same reference as piece 1, for the same reason: there is no access to a lab PC.

## What the measurements found (24 Nov 2026)

Probes built with the course toolchain and run on the reference showed:

- **Idle isn't held to the screen.** A program whose idle callback calls `glutPostRedisplay`, with a double-buffered window, ran about 1,750 frames a second. That's 0.57 ms a frame on a 144 Hz panel, while `wglGetSwapIntervalEXT` reported 1: `SwapBuffers` in a composited window doesn't wait for the refresh. The Lab, the editor's Run and the editor's spec all assumed it does.
  - So an exported VAMS scene that animates in `glutIdleFunc` runs about 25 times as fast on a 60 Hz lab PC as in the editor.
- **Timers keep their time.** `glutTimerFunc(16)` fired every 16.4 ms on average, 10 every 10.4, 33 every 33.05, and 1 every 1.5. They aren't rounded to the 15.6 ms system tick. `Sleep(n)` took n + 0.5 to 1 ms.
- **Matrix stacks:**
  - The modelview stack holds 32 matrices.
  - The projection stack holds 4; gl-raster allows 32.
  - A push past the end sets `GL_STACK_OVERFLOW`, and a pop at the bottom sets `GL_STACK_UNDERFLOW`.
- **Misuse.** FreeGLUT's messages and exit codes differ from the Lab's in these cases:
  - **Before `glutInit`:** FreeGLUT prints `freeglut  ERROR:  Function <glutDisplayFunc> called without first calling 'glutInit'.` and exits with 1. There is no program name, since none is known yet. The Lab prints `freeglut (program): ...`, and some functions, such as `glutDisplayFunc`, don't check at all. `glutGet(GLUT_ELAPSED_TIME)` is the exception: it answers without `glutInit`.
  - **After `glutInit`:** messages name the program, `freeglut (<argv[0]>): `. On a lab PC that is `c:\openglcpp\Program.exe`, the path `x.bat` builds to. In the Lab it is `program`.
  - **No display callback:** FreeGLUT prints `ERROR:  No display callback registered for window 1` after one space. The Lab has two.
  - **`glutMainLoop` with no window:** FreeGLUT stops with `ERROR:  glutMainLoop called with no windows created.` and exits with 1. The Lab exits with 0.
  - **Calls that need a window, made without one:** `glutPostRedisplay`, `glutSwapBuffers`, `glutSetWindowTitle`, `glutReshapeWindow`, `glutPositionWindow` and `glutFullScreen` stop with `ERROR:  Function <name> called with no current window defined.` and exit with 1. The Lab ignores them. Setting a callback, a timer, idle or a menu without a window is silent in both.
  - **A second `glutInit`:** FreeGLUT stops with `illegal glutInit() reinitialization attempt`.
  - **Warnings, after which the program carries on:**
    - `glutGet` with an unknown query prints `glutGet(): missing enum handle <n>` and returns -1.
    - `glutGetModifiers` outside an input callback prints `glutGetModifiers() called outside an input callback` and returns 0.
    - A bitmap function given something that isn't a bitmap font prints `glutBitmapCharacter: bitmap font 0x00001234 not found. Make sure you're not passing a stroke font.`
    - The Lab is silent in all three.
  - **After `glutLeaveMainLoop`:** with `GLUT_ACTION_GLUTMAINLOOP_RETURNS`, the window is gone once `glutMainLoop` returns (`glutGetWindow()` is 0). In the Lab it stays.
- **Closing the window.** On FreeGLUT the close button calls the `glutCloseFunc` callback and destroys the window. `glutMainLoop` then ends, and the program exits with 0 unless `GLUT_ACTION_ON_WINDOW_CLOSE` says otherwise. The Lab's ✕ ends the worker at once, so the close callback never runs, and a file it would write is never saved.

## Calls

1. **The Lab drops the wait for the screen.** `glutSwapBuffers` (and `glFlush` in a `GLUT_SINGLE` window) hands the frame to the page and returns at once. The page shows the newest frame at each refresh, as the compositor does. A frame run while the page is still showing an earlier one is held back from drawing, through the same `GLContext.hold` the catch-up uses today. That keeps a fast loop fast: only the frames the page will show are drawn. An idle loop therefore runs as fast as the program can go, as on the lab PC.
   - The catch-up machinery (`CONTROL.TICK` counting, `MAX_FRAMES_BEHIND`) goes. There is no fixed pace left to catch up with.
2. **Exported VAMS code paces itself, and the editor's Run uses the same pace.** `_vams_idle` steps the scene at most 60 times a second, by `glutGet(GLUT_ELAPSED_TIME)`:
   ```cpp
   static int done = -1;
   int step = glutGet(GLUT_ELAPSED_TIME) * 60 / 1000; // 60 steps a second
   if (step == done) return;
   done = step;
   ```
   The editor's Run takes one step whenever the same count has moved on, whatever the screen's refresh rate. Its time starts half a step before its first frame, so refresh jitter never lands on a step boundary. A scene then moves at the same speed in the editor, in the Lab and on a lab PC.
   - Student-facing text that says idle runs "every frame" now says it steps 60 times a second where it describes the editor's step. The generated code's comment says why.
3. **FreeGLUT's misuse behaviour, exactly.** Every case in the list above takes FreeGLUT's message, return value and exit code. Each function's init and window checks are measured, not guessed: the misuse battery covers all 41 functions of the 2D set.
   - The program's name is `c:\openglcpp\Program.exe`, as `x.bat` builds it on a lab PC. It is passed as `argv[0]`, so a program that prints `argv[0]` sees it too.
   - On a lab PC the program is built as a Windows program, so these messages go nowhere a student can see. The Lab shows them in the Console; that is the one difference, and it helps.
4. **✕ is the window's close button.** The page sends a close event. The runtime calls the close callback, destroys the window and ends `glutMainLoop` as FreeGLUT does. If the program hasn't taken the event within 1 second, because it is busy or waiting for typed input, the page ends the worker as it does now.
5. **Input is measured, not assumed.** The event battery records FreeGLUT's callbacks for a script of keys, mouse actions, a resize and a menu choice. The Lab's mapping (`glut-input.ts`) and dispatch are fixed until the traces match.
   - Named exceptions are keys the browser keeps. Tab stays with the page so the keyboard can always leave the program window. Keys the browser reserves (Ctrl+W, Ctrl+T, Ctrl+N) never reach a page. The battery lists any others it finds.
6. **Intel's stack depths.** The projection stack holds 4 matrices and the modelview stack 32, with the same errors past either end.

## How it is checked

Three batteries, each recorded on the reference by a script and replayed in the Lab, as the drawing battery is:

- **Misuse** (`tests/fixtures/lab/glut/misuse.cpp`). One program reads a case name from standard input and runs that misuse. `scripts/lab/capture-glut.mjs` runs every case natively and records stdout, stderr and the exit code in `tests/fixtures/lab/glut/reference.json`. The Lab test runs each case and compares the Console and the exit code exactly. The program name in FreeGLUT's prefix is the only text normalised.
- **Events** (`events.cpp` and `events.script.json`). The program prints a line for every callback, with its values and `glutGetModifiers()`.
  - Natively, a small driver (`tests/fixtures/lab/glut/drive.cpp`) plays the script with `SendInput` into the focused window, resizes it with `SetWindowPos`, picks a menu entry, and closes the window.
  - In the Lab, Playwright plays the same script with real browser input.
  - The traces must match line for line. Callbacks the window system adds (a display after a menu closes, a second reshape on a resize) are listed as named exceptions when the browser has no such moment.
- **Pace** (`pace.cpp`).
  - On the reference, the probe records timer intervals for 1, 10, 16 and 33 ms, and the idle rate.
  - In the Lab, each timer's mean interval must be within 1 ms of the reference's.
  - Idle must run at least 4 times per page refresh for a trivial frame, which shows the loop isn't held to the screen.
  - The editor's 60-steps-a-second pace is checked in Vitest with a fake clock: one step per refresh at 60 Hz, two refreshes in five with no step at 144 Hz, no burst after a stall.

## Not in this piece

- A second `glutCreateWindow`, and calls outside the 2D set. They are refusals (piece 4).
- The window position `glutGet(GLUT_WINDOW_X)` reports on a lab PC depends on where Windows places the window. The Lab keeps answering with its stage position.
- The size Windows gives a window when `glutInitWindowSize` was refused (FreeGLUT then reports -1 × -1). The Lab reports -1 × -1 too, and opens at 300 × 300, a named exception.
