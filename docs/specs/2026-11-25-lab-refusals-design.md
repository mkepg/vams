# Clear when refused

The last of the four pieces that take the Lab out of Experimental (the others are [One reference: Intel FreeGLUT, every pixel](2026-11-24-intel-reference-design.md), [GLUT behaviour](2026-11-24-glut-behaviour-design.md) and [The Lab in a class](2026-11-25-lab-class-design.md)). The brief, from the reference design: "a plain message that names the line and says what to do, when a program uses something outside the 2D set or a header the Lab lacks." When the piece is done, the tag comes off. The owner delegated the calls ("decide for me, I approved up to push"), so each call below is recorded with its reason.

## What was probed

Headless Chromium ran the Lab against the local runtime, with 21 small programs of the kind students write. Each one made a usual mistake:

| Program | The Lab said |
| --- | --- |
| Calls `helper()`, which is declared and never written | It compiled, then stopped at the call: `The program stopped: resolved is not a function`. A lab PC stops the build: ``undefined reference to `helper()'``. |
| `extern int counter;`, never defined | It compiled, then `Could not load dynamic lib: /main.wasm` and `bad export type for 'counter'`. |
| No `main` | It compiled, then `/main.wasm has no main`, exit code 127. |
| `glEnable(GL_DEPTH_TEST)` | `GL_DEPTH_TEST isn't part of VAMS Lab's OpenGL.`, and nothing on what to do. |
| `glVertex2iv(v)` | The same, then a second error about `const GLfloat *`: clang had read on as if it said `glVertex2fv`. |
| `glVertex2ff(0, 0)`, a typo | `glVertex2ff isn't part of VAMS Lab's OpenGL.`; clang's "did you mean 'glVertex2f'" was dropped. |
| `return GLUT_KEY_SHIFT_L;` | Refused, though the Lab sends that key to `glutSpecialFunc` (code 112, as FreeGLUT does). The Lab's `freeglut_ext.h` left the constant out. |
| `#include <bits/stdc++.h>` | Refused. libstdc++ has it on a lab PC. |
| `#include <GL\glut.h>`, `#include <glew.h>`, `#include <GL/glext.h>` | All refused. On a lab PC Windows reads the backslash as a slash, and the toolchain has `glew.h` at the top of its include folder and `GL/glext.h` in MinGW's. |
| `#inlcude <cstdio>` | `#inlcude isn't available in VAMS Lab.`, as if it were a directive the Lab chose to leave out. |
| `#pragma region Shapes` | `Only #pragma once is available in VAMS Lab.` g++ reads past an unknown pragma. |
| `MessageBox(NULL, ...)` with `<windows.h>` | `use of undeclared identifier 'NULL'`. On Windows, `windows.h` brings `NULL`. |
| `#include "shapes.h"`, `#include <graphics.h>` | `isn't one of VAMS Lab's headers.`, and nothing on what to do. |

Of the 567 functions in the reference toolchain's `gl.h`, `glu.h`, `freeglut_std.h` and `freeglut_ext.h`, the Lab declares 136 and refuses 49 by name in `vams_rejected.h`, with what to use. The other 390, and about 700 constants, gave the bare message.

## The calls

1. **A name used and never defined stops the link, as on a lab PC.** The side module was linked with `--unresolved-symbols=import-dynamic`, so a missing name became an import that failed only when the program reached it. It is now linked with `--unresolved-symbols=report-all --allow-undefined-file=/lab/symbols.txt`. `lab/runtime/pack-headers.mjs` writes `symbols.txt` into the headers pack when the runtime is built: every name a side module can find when it loads, which is the main module's exports and the keys of Emscripten's `wasmImports`, 8,883 names. wasm-ld then reports each other name, demangled (`helper()`, `A::f()`, `counter`, `vtable for Shape`). The Lab says it in plain words on the first line that uses the name and doesn't only declare it:
   - `helper() is declared but never defined. Write its body, or check that its name and parameters match the function you wrote.`
   - `counter is declared but never defined. Define it once, outside any class and without extern.`
   - `Shape declares a virtual function it never defines. Write the body of each of Shape's virtual functions.` This goes on the class's line. g++'s ``undefined reference to `vtable for Shape'`` is a known puzzle for students.
2. **A program without `main` stops at the link.** The compile reads the linked module's exports, and with no `main` (or `__main_argc_argv`) it says `The program has no main function. Add int main(), where the program starts.` On a lab PC the linker stops on ``undefined reference to `WinMain@16'``.
3. **Every refused name says what to use.** `src/features/lab-compile/model/refusals.ts` holds the rules, one place. The message keeps the form the original Lab design set: `<name> isn't part of VAMS Lab's OpenGL. <what to do>`. For example:
   - `GL_DEPTH_TEST isn't part of VAMS Lab's OpenGL. Leave it out: each shape is drawn over the ones drawn before it.`
   - `glVertex2iv isn't part of VAMS Lab's OpenGL. Use glVertex2i(v[0], v[1]).` A call in a form the Lab lacks names the nearest form it has, worked out from the forms `gl.h` declares.
   - `gluUnProject isn't part of VAMS Lab's OpenGL. Work out the position from your glOrtho bounds: x = left + mouseX * (right - left) / width.`
   - `glCreateShader isn't part of VAMS Lab's OpenGL. Draw with glBegin and glEnd, or glVertexPointer and glDrawArrays: VAMS Lab's OpenGL is version 1.5, without shaders.`
   - Later OpenGL's suffixed names (`glGenBuffersARB`) say to use the plain call when the Lab has it.
   - The usual Windows calls get the same treatment against `windows.h`: `MessageBox`, `GetAsyncKeyState`, `GetTickCount`, `PlaySound`, `GetSystemMetrics` and a few more. Where the Lab has a way, the advice names it: `glutGet(GLUT_ELAPSED_TIME)`, or the keyboard callbacks.

   `tests/fixtures/lab/reference-names.txt` lists the 1,515 names the reference headers declare (`scripts/lab/reference-names.mjs` writes it from the toolchain). BB-LAB-117 holds that each name the Lab leaves out has advice, and that the advice keeps the Language Discipline and British spelling.
4. **A mistyped name keeps clang's suggestion.** When no rule covers a GL name and clang offers one (`did you mean 'glVertex2f'?`), clang's message stands, as g++ says the same on a lab PC. A name with neither keeps the bare refusal.
5. **One message a line for a refused name.** Clang reads on with its best guess at an undeclared name, which gave a second error about the guess. The Lab already kept only the VAMS message on a line where a `vams_rejected.h` name was refused. That now covers every refused name.
6. **The headers a lab PC has, that a program reaches for, are there.** The runtime gains:
   - `bits/stdc++.h`, with libstdc++ 11's C++17 list. It compiles without warnings, in about twice the time of `<iostream>` alone.
   - `glew.h` at the top, which includes `GL/glew.h`.
   - `GL/glext.h`, which includes `GL/gl.h`. The Lab's `gl.h` already declares the 1.2 to 1.5 calls and constants the Lab has.
   - FreeGLUT's special keys in `freeglut_ext.h`, with the reference values: `GLUT_KEY_NUM_LOCK` to `GLUT_KEY_ALT_R`.
   - `NULL` and `size_t` in `windows.h`.
7. **An include says what to write.**
   - A backslash in a header's name is read as a slash when that spells a header (`<GL\glut.h>`), as Windows reads it.
   - A path names the header to write when its last part is one (`#include "C:\freeglut\include\GL\glut.h"` says `write #include <GL/glut.h>`).
   - A header written without its folder says where it is (`<glut.h>` says `Write #include <GL/glut.h>.`).
   - Headers students bring from elsewhere get a line on what the Lab uses instead: `<iostream.h>`, `<graphics.h>`, GLFW, glad, SDL, `<GL/glaux.h>`, `<unistd.h>` and `<dos.h>` (for `Sleep`), `wglext.h` and the like.
   - A plain file name in quotes (`"shapes.h"`) says the Lab compiles one file, so the header's code goes in `main.cpp`.
   - Any other header lists the ones there are.
8. **A mistyped directive is named as one.** `#inlcude` says `#inlcude isn't a directive. Did you mean #include?`. It matches when one letter is added, missing or changed, or two letters are swapped. A directive the Lab refuses says what to do: `#import` and `#include_next` say to use `#include`, `#embed` says to add the file to the file list and read it, and the rest say to remove the line.
9. **Pragmas g++ reads past are blanked.** `#pragma region`, `endregion`, `mark`, `omp` and `message` become spaces, as `comment(...)` and `warning(...)` already did, so clang never sees them. x.bat has no `-fopenmp`, so OpenMP's pragmas change nothing on a lab PC either. `#pragma GCC` stays refused, because `#pragma GCC dependency` reads a file. Every other refused pragma now says to remove the line.
10. **The source cap says what to do.** `The source is over 200 KB. Make main.cpp smaller: keep large data in a file in the file list, and read it with fopen or std::ifstream.`
11. **The tag comes off.** The Experimental tag leaves the Lab's top bar, with its style and the `--chrome-caution` token, which nothing else used. BB-LAB-101 now holds that the top bar has no tag.

A new runtime version, `4.0.10-e8461e5b`, carries calls 1 and 6, and call 2 checks the module it links. `build.sh` also drops `-Wl,--stack-first`, which did nothing for a main module, and its comment now says where the stack is.

## Named differences

- The Lab says what a lab PC's linker says, in other words, and on a line. A lab PC's link error names the object file and an offset, with no line.
- Calls 6 to 9 accept programs a lab PC accepts. A program that includes `<GL/glext.h>` for a constant the Lab lacks still gets that name's refusal.
- `#pragma GCC` is refused, where g++ honours it. Programs for a GLUT lab rarely carry one, and one form reads a file.

## The checks

- WB-LAB-01 covers the advice on refused names, the kept suggestion, the Windows calls and the one message a line. WB-LAB-26 covers undefined names in plain words on their lines, and the name list reaching wasm-ld. WB-LAB-27 covers a program without `main`. WB-LAB-21 and 22 cover the pack's `symbols.txt`.
- BB-LAB-117: every reference name the Lab leaves out has advice, worded within the Language Discipline; the forms the advice names exist; the special keys are declared.
- SEC-LAB-01 and 02, extended: the advice for paths, unknown headers and directives, the backslash spelling, the mistyped directives, and the blanked pragmas, with a directive on the next line still checked.
- VIS-LAB-17 runs the probe's programs end to end in the Lab with the real compiler. The refusals say what to do, and the programs a lab PC accepts compile and run.
