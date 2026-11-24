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
   // The first call, or one after a long pause, takes a single step
   if (done < 0 || step - done > 6) done = step - 1;
   for (; done < step; done++) {
       update_buffers();
       onIdle();
   }
   ```
   - The editor's Run takes the same steps, whatever the screen's refresh rate (`stepPacer` in `src/shared/lib/run-pace.ts`). Its time starts half a step before its first frame, so refresh jitter never lands on a step boundary.
   - A scene then moves at the same speed in the editor, in the Lab and on a lab PC.
   - Both catch up at most 6 steps, a tenth of a second, so a machine slow to draw keeps the pace and a pause doesn't make the scene jump.
   - The lesson that explains why counting per frame runs faster on a faster computer now says how `_vams_idle` avoids it, and teaches `glutGet(GLUT_ELAPSED_TIME)`. The generated code's comment says why.
3. **FreeGLUT's misuse behaviour, exactly.** Every case in the list above takes FreeGLUT's message, return value and exit code. Each function's init and window checks are measured, not guessed: the misuse battery covers all 41 functions of the 2D set.
   - The program's name is `c:\openglcpp\Program.exe`, as `x.bat` builds it on a lab PC. (Building kept the main module's own `argv[0]` as it was; see "What building found".)
   - On a lab PC the program is built as a Windows program, so these messages go nowhere a student can see. The Lab shows them in the Console; that is the one difference, and it helps.
4. **✕ is the window's close button.** The page sends a close event. The runtime calls the close callback, destroys the window and ends `glutMainLoop` as FreeGLUT does. If the program hasn't taken the event within 1 second, because it is busy or waiting for typed input, the page ends the worker as it does now.
5. **Input is measured, not assumed.** The event battery records FreeGLUT's callbacks for a script of keys, mouse actions, a resize and a menu choice. The Lab's mapping (`glut-input.ts`) and dispatch are fixed until the traces match.
   - Named exceptions are keys the browser keeps. Tab stays with the page so the keyboard can always leave the program window. Keys the browser reserves (Ctrl+W, Ctrl+T, Ctrl+N) never reach a page. The battery lists any others it finds.
6. **Intel's stack depths.** The projection stack holds 4 matrices and the modelview stack 32, with the same errors past either end.

## How it is checked

Three batteries. Misuse and events are recorded on the reference by a script and replayed in the Lab, as the drawing battery is; pace checks against the figures measured here (see "What building found"):

- **Misuse** (`tests/fixtures/lab/glut/misuse.cpp`). One program reads a case name from standard input and runs that misuse. `scripts/lab/capture-glut.mjs` runs every case natively and records stdout, stderr and the exit code in `tests/fixtures/lab/glut/reference.json`. The Lab test runs each case and compares the Console and the exit code exactly. The program name in FreeGLUT's prefix is the only text normalised.
- **Events** (`events.cpp` and `events.script.txt`). The program prints a line for every callback, with its values and `glutGetModifiers()`.
  - Natively, the program plays the script on itself by posting each key and mouse message to its own window, then closes it. Menus and resizing are left to the runtime's own tests.
  - In the Lab, Playwright plays the same script with real browser input.
  - The traces must match line for line. Callbacks the window system adds when the browser has no such moment are listed as named exceptions.
- **Pace** (`pace.cpp`).
  - On the reference, with the window in front, timers of 1, 10, 16 and 33 ms fired every 1.55, 10.4, 16.39 and 33.05 ms.
  - In the Lab, each timer's mean interval must be within 1 ms of the reference's.
  - Idle must run at least 4 times per page refresh for a trivial frame, which shows the loop isn't held to the screen.
  - The editor's 60-steps-a-second pace is checked in Vitest with a fake clock: one step per refresh at 60 Hz, two refreshes in five with no step at 144 Hz, no burst after a stall.

## Not in this piece

- A second `glutCreateWindow`, and calls outside the 2D set. They are refusals (piece 4).
- The window position `glutGet(GLUT_WINDOW_X)` reports on a lab PC depends on where Windows places the window. The Lab keeps answering with its stage position.
- The size Windows gives a window when `glutInitWindowSize` was refused (FreeGLUT then reports -1 × -1). The Lab reports -1 × -1 too, and opens at 300 × 300, a named exception.

## What building found (24 Nov 2026)

Calls made while building, each recorded here as the owner asked.

- **Recording happens on the owner's desktop.** The owner asked that recordings not keep opening and closing windows on their screen. So the native recordings are few, and each keeps one window open:
  - The misuse battery is recorded once; each case is its own short run.
  - Pace is not recorded by a script (next point).
  - The input battery is one window for about three seconds.
- **Timers depend on whether Windows can see the window.** FreeGLUT asks Windows for 1 ms timers (`timeBeginPeriod`). Windows 11 keeps that only while the window can be seen; a covered window's timers fall back to the 15.6 ms tick. Two recordings on the shared desktop gave 10 ms timers every 14.4 ms and 33 ms timers every 42.7 ms.
  - A student's window is in front, so the reference figures are the first probe's, taken with the window in front: 1 ms every 1.55, 10 every 10.4, 16 every 16.39, 33 every 33.05.
  - `pace.cpp` holds them in a comment, and VIS-LAB-14 checks the Lab against them.
- **The browser's own wait wakes late**, by a millisecond or by a whole Windows tick. Left alone, a 16 ms timer fired every 17.4 to 19.4 ms in the Lab. So the runtime sleeps until shortly before a timer is due and spins the rest. The margin grows to the latest late wake it has seen (at most 16 ms) and eases back to 2 ms. The cost is CPU while a timer is pending, no more than an idle loop takes on a lab PC.
- **A frame is drawn only when the page has taken the last one**, even for a scene slow to draw.
  - A trial that drew every frame of a slow program ran the jeepney at 0.22 of the editor's speed. Its 70 ms software frames let `_vams_idle` take only about 14 of its 60 steps a second.
  - With frames held, the jeepney still ran at 0.28: the first gate took at most one step a call and skipped the rest, and a 70 ms software frame skipped about four. So `_vams_idle` and Run catch up the steps due, at most 6, and the jeepney keeps the editor's pace (VIS-LAB-12).
  - The page shows the newest frame drawn.
  - A Sleep, a read from the Console and the loop's own wait each show a held frame first, so a loop paced with `Sleep(16)` still shows its frames. The Console's pause counter became an `onPause` hook for this.
- **`argv[0]` stays `program`** in the main module. Only FreeGLUT's message prefix names `c:\openglcpp\Program.exe`. Changing `vams_main.c` means rebuilding and publishing the runtime, for programs that print their own `argv[0]`, which lab work doesn't do.
- **`glutDestroyWindow` inside the loop isn't in the recording.** FreeGLUT's outcome there depends on when Windows paints: the same program once exited with 0 and once stopped on "No display callback". The Lab takes the clean outcome, close callback then exit 0, and a test of its own pins it.
- **Input is recorded by posting messages, not with `SendInput`.** `SendInput` would move the owner's cursor and type on their desktop while it ran. Instead, `events.cpp` posts each key and mouse message to its own window, one a tick, after setting the keyboard state that message needs. FreeGLUT's window procedure handles them through `TranslateMessage`, as real input. Measured:
  - Shift and Ctrl alone reach the special callback as 112 and 114, with the modifier set on press and clear on release.
  - Ctrl+A is keyboard 1, Shift+1 is 33, and Delete is keyboard 127.
  - Key callbacks get the last mouse position.
  - With no wheel callback, a wheel turn is button 3 (up) or 4 (down), pressed and released.
- **The matrix stack test** joined ALG-LAB-09's existing stack test rather than a new ALG-LAB-41, so the test ID stays stable.
- **The Lab's battery programs keep their copies of the gallery scenes.** Only the Lab's examples are re-exported with the 60-steps pace. The battery checks first frames, which the pace doesn't change, and re-recording them would mean more windows on the owner's screen.
