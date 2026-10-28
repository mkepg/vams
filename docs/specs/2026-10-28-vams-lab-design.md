# VAMS Lab: write, compile and run GLUT programs

## Intent

VAMS teaches OpenGL through a GUI and shows the C++ that each action makes. A student's lab work is different: they write a whole GLUT program from a blank file, on a lab PC set up with MinGW g++, GLEW and FreeGLUT (Dev-C++ or Code::Blocks). Today that needs the toolchain installed, and a student without it cannot do the exercise.

The Lab is a separate page of the VAMS site, `/lab`, where a student writes a C++ GLUT program and runs it in the browser with nothing to install. A compile server builds the program with clang, and the program runs on the page in a window of its own.

The owner's bar is that it **must be usable**: a finished tool a student can rely on for a real lab exercise, not a stage demo. It ships after the CS Expo (Nov 4) and is not part of the talk.

## Goals

- A program written for the course's lab setup compiles and runs unchanged, as long as it stays within the 2D set below. It includes `<GL/glew.h>` and `<GL/freeglut.h>` (or `<GL/glut.h>`), uses `stb_image.h` for images, and writes with `std::cout` or `printf`.
- The program draws what FreeGLUT on a lab PC draws for the same code: primitives, colours, transforms, textures, line width and stipple, point size, and bitmap text.
- Compiler errors are clang's own messages, placed on the student's lines.
- The student keeps their work: it saves in the browser, and it saves to and opens from files. They can hand it in as a file or as a link the instructor opens, reads and runs.
- It costs nothing to run: Google Cloud Run's always-free allowance, capped so it cannot charge the owner.

## Non-goals

- 3D projection, lighting, materials, normals and GLUT's 3D shapes. The Lab runs the same 2D subset VAMS teaches.
- More than one source file. There is one `main.cpp` plus images. The design leaves room to add files later.
- Accounts, classes, grading or automatic checking of lab answers.
- Compiling as the student types. Each compile uses the server allowance.
- Compiling offline.
- Changes to the VAMS editor beyond the one "Open in Lab" item below.

## Anti-goals (failure even if it technically works)

- It is rushed into the Nov 4 talk, or anything in it lands in the editor before the expo.
- It ever charges the owner's card.
- A student's `while (true)` or crash freezes the page, or loses their code.
- Code that builds on the lab PC and stays within the 2D set fails here, or draws differently.
- A message the student reads uses the banned wording (Appendix C, Language Discipline): "coming soon", "not yet", "future", "deferred", "unsupported", "not supported", "3D", "lighting".

## Constraints

- **Hosting:** the site stays on Cloudflare Pages. The compiler runs on Google Cloud Run's always-free tier: 2M requests, 180,000 vCPU-seconds and 360,000 GiB-seconds a month, plus about 1 GiB of North America egress, checked 2026-10-28. Maximum instances 3, minimum 0. Google can change the allowance with 30 days' notice.
- **Never a cent (owner's answer).** Running out of the free allowance stops Run. It never charges the card. A budget alert only sends an email, so it isn't enough by itself, and the Lab has three hard stops:
  1. **A monthly compile counter** in Firestore, which has its own always-free allowance. The compile service checks it on every request. At 80% of the month's tightest allowance (in practice egress, or vCPU-seconds), Run turns off until the 1st, and the page says "Run is resting until the 1st. Your code is saved in this browser." Editing and saving keep working.
  2. **Billing switches off by itself if the $1 budget is ever reached**, using Google's documented budget notification to a Cloud Run function that turns off billing for the project. This shuts the Lab down, and that is the intended result.
  3. **Each compile's download stays small.** The runtime, libc++ and any other shared parts are served from Cloudflare Pages, whose bandwidth is free, and are cached by the browser. A compile returns only what the student's code produced, aiming at 100 KB or less compressed. That makes egress last for well over 10,000 compiles a month. The container image is kept where storing it is free (under Artifact Registry's 0.5 GB free storage, or a public registry Cloud Run can pull from).
- **A class of about 40 on one campus network (owner's answer).** A lab room can press Run within the same minute, from one public IP address. Limits therefore never count per IP address alone (see Builder's calls). Note that Cloudflare Pages has no rate-limit binding: the share function's `SHARE_LIMITER` is not bound in production ([editor chrome and sharing](2026-10-16-editor-chrome-share-design.md), "No rate-limit binding"), so the Lab can't borrow it.
- **Free means always-free, not a trial.** Hosts that were checked and rejected: Render free sleeps after 15 minutes and wakes in about a minute. Hugging Face Docker Spaces need a paid plan. Cloudflare Containers are paid only. Oracle Always Free also needs a card and is a whole server to keep patched.
- **The product rules** in `AGENTS.md` hold for the rest of the site. The editor stays GUI-only.
- Feature-Sliced Design, Preact, SCSS on the tokens in `_tokens.scss`, both themes, and WCAG 2.2 AA.
- **Student-facing text** is British English and follows the Language Discipline above, including compiler messages that VAMS writes itself. Clang's own diagnostics are passed through as they are.

## Product plan amendments

The Lab changes three statements in [docs/product-plan.md](../product-plan.md). They are amended in the same change that ships the Lab:

1. "There is no code editor, no interpreter, and no runtime — the student never writes or executes code." becomes true **of the editor**. The Lab is the one page where students write and run code.
2. "The site has no server beyond that one Pages Function and its one KV namespace." now also covers the compile service on Cloud Run, which is reached through a second Pages Function.
3. Appendix C's deferred symbols are also what the Lab rejects at compile time.

Also add an entry to the roadmap's list of differences from the manuscript: the site gains a Lab page where students write and run their own GLUT programs.

## What the owner decided

**Layout: Marey's split** (the owner's own site, <https://marey.pages.dev/>, source in `PROGRAMMING_LANGUAGE/marey/src/components/App.tsx`).

- **Top bar:** the VAMS wordmark and "Lab", a status line (for example "main.cpp · 1 error"), Examples, New, Open, Save, Share and ▶ Run (Ctrl+Enter).
- **Left pane:** the code editor over a log the student can fold. The log has two tabs, **Compiler** and **Console**. A drag handle sits between the editor and the log.
- **Right pane:** a stage on which the running program is a **floating window**:
  - It opens at the size the program asks for (`glutInitWindowSize`, `glutInitWindowPosition`) and is scaled down only when the stage is smaller.
  - The title bar shows the program's `glutCreateWindow` title and drags the window.
  - A grip resizes it and calls the program's reshape callback, as FreeGLUT does.
  - ✕ ends the program.
  - Reuse the VAMS editor's movable program window where it fits.
- A drag handle sits between the panes. On narrow screens (below Marey's breakpoint) the panes stack with no handles: window, code, log.
- **Compile on Run only.**

**Files.** One `main.cpp`, plus images the student adds to a small list. Stated as "not sure" by the owner. One file is the builder's starting point, and storage and the share payload keep room for more.

**Handing in: all of these.**
- Saving in the browser.
- Save and Open of the code as a file.
- Share links: Share makes a link through the existing share function, the instructor opens it, and the Lab loads the code and images, ready to Run.

**Outside the 2D set: a compile error.** A call outside the 2D set stops the build at that line with a VAMS message that names what to use instead, for example:

> `main.cpp:12:5: gluPerspective isn't part of VAMS Lab's OpenGL. Use glOrtho or gluOrtho2D.`

**Open in Lab.** The VAMS editor's File menu gains "Open in Lab", which carries the scene's generated C++ and its texture images into the Lab. It is built with the Lab, after the expo.

**Compiler location.** A server (the owner's preference), within the free allowance only.

## The 2D set

The Lab accepts exactly what a 2D lab needs:

- Every OpenGL, GLU and GLUT name the VAMS generator can emit. `generatorNames()` in `tests/black-box/lesson-rules.test.ts` reads that list from the generator source, and the Lab's list should come from the same place.
- These common 2D lab calls:
  - `gluOrtho2D` and `glRect*`.
  - `glPointSize`, `glLineWidth`, `glLineStipple` and `glPolygonMode`.
  - `glColor4*`, `glEnable(GL_BLEND)` and `glBlendFunc`.
  - `glutTimerFunc`, `glutPostRedisplay` and `glutGet(GLUT_ELAPSED_TIME)`.
  - `glutSpecialFunc`, `glutKeyboardUpFunc` and `glutPassiveMotionFunc`.
  - `glutSetWindowTitle` and `glutBitmapCharacter` with the GLUT bitmap fonts.
- Standard C and C++: `<cmath>`, `<cstdio>`, `<cstdlib>`, `<cstring>`, `<ctime>`, `<iostream>`, `<sstream>`, `<fstream>`, `<string>`, `<vector>` and `<algorithm>`, plus `stb_image.h`.
- **Typed input (owner's answer: lab programs need it).** `std::cin`, `scanf`, `getchar` and `std::getline` work. The Console tab shows an input line while the program waits, and the program blocks until the student presses Enter, as it would in a console window on the lab PC.
- **The Windows extras common in Dev-C++ GLUT labs (owner's answer: handle the common ones):**
  - A small `<windows.h>` with `Sleep` and the basic types (`DWORD`, `BOOL` and the like).
  - `<conio.h>` with `getch`, `getche` and `kbhit`, which read from the Console input.
  - `system("pause")` waits for a key in the Console. `system("cls")` clears the Console. Any other `system` command prints a Console line naming the command and returns non-zero.
  - GLUT right-click menus (`glutCreateMenu`, `glutAddMenuEntry`, `glutAddSubMenu`, `glutAttachMenu`), drawn as a menu over the program window.
  - `glutBitmapString`, display lists (`glNewList`, `glEndList`, `glCallList`, `glGenLists`), `glutFullScreen` (the window fills the stage), and `GLUT_SINGLE` with `glFlush`.

It rejects, with the message above:

- Appendix C's deferred symbols.
- `glutSolid*` and `glutWire*`.
- `glFrustum`, `gluLookAt` and `gluPerspective`.

Anything else outside the set is also rejected, with a message in the same form. The builder writes the final list and keeps it in one place with a test.

## Builder's calls already made (the owner can overrule)

- **Name and route:** `/lab`, linked in the site header as "Lab", after Gallery.
- **New file:** starts from the course template: `glew.h` and `freeglut.h` includes, `init()`, `display()` and `main()` with `glutInitWindowSize(500, 500)`, drawing one triangle.
- **Examples:**
  - A triangle.
  - Moving a shape with the keyboard.
  - An idle animation.
  - A textured quad using a bundled image.
  - Bitmap text.
  - The five gallery scenes, exported from VAMS.
- **Images and text files:**
  - The file list takes images and `.txt` files. The lab setup keeps an `Input.txt` beside the program, and `<fstream>` and `fopen` read from the list.
  - The program finds a file by its file name, wherever the path in the code points. `C:\...\skibidi.png` finds the uploaded `skibidi.png`.
  - When a file isn't in the list, the Console says which name it looked for.
  - A file the program writes appears in the list, where it can be downloaded.
- **Saving:**
  - Work saves automatically in the browser, in its own key (not `vams-storage`), with images in IndexedDB.
  - Save downloads `main.cpp`, or a `.zip` of `main.cpp` and its images when there are images.
  - Open accepts either.
- **Sharing:**
  - It reuses the existing share function and KV namespace, with a new payload kind for Lab work. Images are shrunk to 512 px in the shared copy, as scenes' are.
  - Links keep the 90-day lifetime and the existing rate limit.
  - The builder decides whether the link is `/s/<id>`, routed by kind, or a Lab route.
- **The program runs in a Web Worker** with an OffscreenCanvas, so a runaway loop or a crash cannot freeze the page. ✕ terminates the worker, and Run starts a fresh one.
  - Keyboard and mouse events are forwarded to the worker.
  - `printf` and `std::cout` go to the Console tab.
  - A crash shows in the Console, and the code is untouched.
- **The compile service sits behind a Pages Function**, for example `/api/compile`. That function caps the source at 200 KB, then forwards to Cloud Run with a shared secret. Cloud Run refuses requests without the secret, so its address is never public.
- **Limits sized for a class:**
  - **Instances:** each instance has 2 vCPUs and runs 2 compiles at once, and there are at most 3 instances. That's 6 compiles at a time, so 40 compiles of about 5 seconds each clear in under a minute.
  - **When it's busy:** Cloud Run holds requests briefly when every instance is in use. If one is still refused, the page retries with backoff for up to 60 seconds and shows "Compiling… the Lab is busy, this can take a few seconds". It doesn't show a place in line, because there is no real queue to count.
  - **Abuse limits** live in the same Firestore store as the monthly counter. Each browser gets a random visitor id in local storage and may compile at most 30 times a minute. Each IP address has a ceiling of 600 compiles an hour, high enough for a whole lab room behind one address. The limits cost one or two Firestore writes per compile, well inside its free daily allowance.
- **Typed input in the worker:** the worker blocks on input with `SharedArrayBuffer` and `Atomics.wait`, or with Asyncify. The builder chooses. `SharedArrayBuffer` needs cross-origin isolation headers, which `_headers` sets on `/lab` only. With them, `/lab` can load only same-origin or CORP-marked resources, so its fonts and scripts have to be self-hosted.
- **Inside the compile service:**
  - Each compile runs in a fresh temporary directory with no network.
  - The time limit is 10 seconds of wall clock, with a memory cap and an output size cap.
  - Includes are allowed only from the bundled headers and the student's own file. The service never returns the content of any other file on the server.
  - The service compiles only. The program never runs on the server.
- **Offline:** editing and saving work offline. Run says "Run needs the internet. Your code is saved in this browser."
- **The code editor:** CodeMirror 6, for its smaller bundle and better accessibility than Monaco. It has C++ highlighting, error marks on lines, and clicking an error in the log jumps to its line.

## Left to the builder

- **The toolchain:** Emscripten, or wasi-sdk with libc++. It must give clang's diagnostics, C++17, and the standard headers listed above.
- **How the GL and GLUT runtime is built:** fixed-function emulation in WebGL, or a software rasteriser on the canvas. Whichever is chosen, it has to pass the drawing checks under Testing. Emscripten's own legacy GL emulation and its GLUT are not enough by themselves: wide lines, stipple and bitmap fonts must match FreeGLUT. VAMS already draws GLUT's 9×15 bitmap font with 17 px lines, so reuse that.
- **How `glutMainLoop` hands control back to the browser.** For example, the runtime registers the callbacks, unwinds, and then calls them from the JavaScript side.
- Exact error mapping, file formats, storage keys and slice structure.

## Testing

Test IDs follow the repo's `{SUITE}-{MODULE}-{NN}` form, using a new LAB module.

- **2D set:** every generator name compiles, and every rejected name gives the VAMS message on its line.
- **Drawing:** a battery of programs is built with MSYS2 g++ and FreeGLUT on the owner's development PC (NVIDIA graphics), following [manual-compile-procedure.md](../../tests/reports/manual-compile-procedure.md), and those reference images are committed. Lab PCs may have other graphics hardware, so the comparison allows a few pixels of difference at line ends, point edges and the start of a stipple pattern, and is exact elsewhere. The Lab's output for the same programs has to match them within that tolerance. The battery covers:
  - the seven manual-compile scenes and the five gallery scenes;
  - wide and stippled lines, point sizes, bitmap text, and a textured quad.
- **Running:**
  - `cin`, `scanf`, `getch` and `system("pause")` wait for Console input and resume on it.
  - Right-click menus call their callbacks, display lists draw, and `glutBitmapString` writes text.
  - A file the program reads is found by its name from the list.
  - The reshape callback fires on resize.
  - Keyboard, special keys, mouse and motion callbacks reach the program.
  - The idle and timer callbacks run.
  - An infinite loop is stopped by ✕ without freezing the page.
- **The compile service:**
  - Reading a file outside the bundled headers fails without showing its content.
  - The time limit and size cap hold.
  - The per-browser and per-IP limits hold, and 40 compiles from one IP address in a minute all succeed.
  - The monthly counter turns Run off at its threshold.
  - A request without the secret is refused.
  - A compile's download stays at or under 100 KB compressed for the battery.
- **Saving:** the browser save, Save, Open and Share each round-trip the code and its images.
- **Wording:** every message the Lab writes is checked against the Language Discipline list.
- lint, build, `npm test` and the visual suite (new Lab captures in both themes at 1280 and 390 px) all pass.

## Size and order

About 4 weeks, starting after Nov 4. Typed input and the Windows extras add about half a week to the first estimate of 3–4 weeks. There is no date students need it by, so the order puts a usable Lab first:

**First release, about 2½ weeks in.** A student can do a lab exercise end to end. It covers:
1. The compile service with its limits and hard stops, plus the 2D set and the Windows extras.
2. The runtime: drawing, callbacks, typed input and menus, with the drawing checks.
3. The page, with browser saving, Save and Open. The header link appears with this release.

**Second release:**
4. Share links.
5. Open in Lab in the editor.
6. The product plan and roadmap amendments. They go into the first release if it ships alone.

**Owner-only step:** create the Google Cloud billing account and add the card. Everything after that is set up with `gcloud` once the owner has signed in: the project, the service, Firestore, the limits, the budget and its billing switch-off, and the secret.

## Decision record

Answers from the owner (2026-10-28):
- It's for students and must be usable.
- It's for lab work from scratch.
- 2D only.
- The compiler runs on a server, on free tiers only, using Cloud Run with a card on file.
- Marey's layout with a floating program window, compiling on Run only.
- Every way of handing work in.
- A compile error for calls outside the 2D set.
- Open in Lab, after the expo.
- Not a single cent: a hard stop.
- A class of about 40.
- Typed input is needed.
- Handle the common Windows extras.

Decided on the owner's behalf, after they delegated the rest of the design on 2026-10-28:
- **References:** the reference images come from the owner's development PC, compared with a tolerance.
- **Limits:**
  - The numbers for instances and concurrency.
  - Limits per browser and a ceiling per IP address.
  - Retrying when busy, with no queue position.
  - The 80% stopping threshold.
  - The 100 KB download target.
- **Files:** `.txt` files are allowed in the file list.
- **Delivery:** a usable first release comes ahead of Share and Open in Lab.
- Everything listed under "Builder's calls already made".
