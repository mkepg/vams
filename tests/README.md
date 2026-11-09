# V.A.M.S. Automated Test Suite

This directory implements the verification programme described in
**Chapter 3, §3.10 (Testing Methods)** of the V.A.M.S. manuscript. It is
organised so that each row of Tables 12 / 13 maps to one file (and each
test case inside that file carries a stable identifier of the form
`{SUITE}-{MODULE}-{NN}`).

## Layout

```
tests/
├── README.md
├── setup.ts                      ← Vitest setup: deterministic uuids,
│                                    store reset between tests.
├── helpers/
│   ├── matrix.ts                 ← Independent reference impl. of the
│   │                                affine-matrix engine, used as the
│   │                                gold standard for ALG-1.
│   ├── store.ts                  ← Test helpers around useVamsStore.
│   ├── mini-cpp.ts               ← A small interpreter for generated handler
│   │                                bodies, used to check the Run runtime.
│   ├── generator-names.ts        ← Every GL and GLUT name the code
│   │                                generator's source can emit.
│   ├── shell-vars.ts             ← The assignments of a shell script, so a
│   │                                test can read lab/runtime/build.sh.
│   ├── raster-worker.ts          ← Runs raster calls in a worker thread, so
│   │                                ALG-LAB-18 can end one that never returns.
│   ├── lab-console-worker.ts     ← The Lab's Console in a worker thread,
│   │                                blocking on Atomics.wait, for BB-LAB-23.
│   ├── student-text.ts           ← The text students read in a source file,
│   │                                and the British spelling and Language
│   │                                Discipline checks (WB-SPELL, BB-LAB-58).
│   └── image-compare.ts          ← PNG reading and writing, and the image
│                                    rule of the render fidelity and Lab
│                                    batteries (edge pixels may differ, the
│                                    rest within 2 per channel).
├── fixtures/
│   ├── no-callbacks-program.cpp  ← The program generated for a scene with
│   │                                no callbacks, pinned by BB-CB-12.
│   │                                Rewrite it with WRITE_CALLBACK_FIXTURE=1.
│   ├── fidelity/                 ← The render fidelity battery: scenes.ts,
│   │                                the capture shim and the FreeGLUT
│   │                                reference images VIS-FID compares with.
│   └── lab/                      ← The Lab's drawing battery: programs/
│                                    (C++ and the images they load), the
│                                    capture shim and the FreeGLUT reference
│                                    images the Lab is compared with.
├── black-box/                    ← Maps to Table 12.
│   ├── primitive-creation.test.ts        (BB-PRIM-*)
│   ├── transformation-operations.test.ts (BB-XFORM-*)
│   ├── scene-graph-hierarchy.test.ts     (BB-HIER-*)
│   ├── code-generation.test.ts           (BB-GEN-*)
│   ├── cpp-code-validation.test.ts       (BB-CPP-*)
│   ├── lesson-engine.test.ts             (BB-LESSON-*)
│   ├── project-persistence.test.ts       (BB-PERSIST-*)
│   ├── site-shell.test.ts                (BB-SITE-*: theme, route
│                                            metadata, SEO, prerendering)
│   ├── scene-library.test.ts             (BB-LIB-*: My scenes library,
│   │                                        backups, dialog)
│   ├── editor-links.test.ts              (BB-LINK-*: prepared scenes,
│   │                                        /app links, slide 07)
│   ├── gallery.test.ts                   (BB-GALLERY-*: gallery scenes,
│   │                                        their links, the /gallery page)
│   ├── about-page.test.ts                (BB-ABOUT-*: The /about page: copy,
│   │                                        citation tabs, prerendered page,
│   │                                        import boundary)
│   ├── guide-pages.test.ts               (BB-GUIDE-*: /guide, /teach and the
│   │                                        header's Ctrl+K search)
│   ├── learn-page.test.ts                (BB-LPAGE-*: the course catalog,
│   │                                        progress after hydration, /learn)
│   ├── crash-recovery.test.ts            (BB-RECOVER-*: lesson reload,
│   │                                        corrupt saves, recovery screen,
│   │                                        the notice when autosave fails)
│   ├── offline-app.test.ts               (BB-PWA-*: service worker,
│   │                                        manifest, update notice)
│   ├── controls.test.ts                  (BB-CTRL-*: the shared control
│   │                                        set)
│   ├── editor-shell.test.ts              (BB-SHELL-*: the editor shell:
│   │                                        dialogs, menus, the top bar,
│   │                                        the rail, the panels and
│   │                                        overlays)
│   ├── lesson-column.test.ts             (BB-LCOL-*: the lesson bar,
│   │                                        the runner and panel focus)
│   ├── editor-panels.test.ts             (BB-PANEL-*: the panels on the
│   │                                        shared controls)
│   ├── callbacks.test.ts                 (BB-CB-*: callback rules, handler
│   │                                        code, names)
│   ├── run-mode.test.ts                  (BB-RUN-*: the canvas Run state)
│   ├── first-visit-tour.test.ts          (BB-TOUR-*: the first-visit tour's
│   │                                        steps, checks and spotlight)
│   ├── code-panel.test.ts                (BB-CODE-*: folds, value marks, Find,
│   │                                        the strip and notes)
│   ├── math-journey.test.ts              (BB-JOURNEY-*: the vertex journey, its
│   │                                        stages, the stepper and the links)
│   ├── top-bar.test.ts                   (BB-TOP-*: the top bar, the scene
│   │                                        title and its menus)
│   ├── canvas-window.test.ts             (BB-CANVAS-*: the canvas header, the
│   │                                        View menu and Run)
│   ├── program-window.test.ts            (BB-WINDOW-*: the program's window:
│   │                                        move, resize, minimise, close)
│   ├── render-fidelity.test.ts           (BB-FID-*: points and lines in window
│   │                                        pixels, FLAT colours, and the state
│   │                                        the code sets in every mode)
│   ├── share.test.ts                     (BB-SHARE-*: the Share dialog and
│   │                                        choosing a link; Lab links from
│   │                                        /s/<id> to /lab?share=<id>)
│   ├── scene-view.test.ts                (BB-VIEW-*: the read-only scene view
│   │                                        on phones)
│   ├── help-center.test.ts               (BB-HELP-*: the Help Centre's topics
│   │                                        and search)
│   ├── pipeline-figures.test.ts          (BB-PFIG-*: the Pipeline geometry,
│   │                                        rasteriser, stage pictures, Raster
│   │                                        vs vector and Which Stage?)
│   ├── texture-controls.test.ts          (BB-TEX-*: the samples, Quick
│   │                                        Gradients, UV presets and the
│   │                                        Texture group)
│   ├── lesson-rules.test.ts              (BB-LRULE-*: generator-name coverage,
│   │                                        wording, hints, recaps, code blanks
│   │                                        and capstones across the lessons)
│   ├── lab-api.test.ts                   (BB-LAB-*: the Lab's 2D set, as the
│   │                                        bundled headers in lab/include
│   │                                        declare and reject it)
│   ├── lab-functions.test.ts             (BB-LAB-05 to 08: the Pages Functions
│   │                                        that forward compiles and serve the
│   │                                        runtime)
│   ├── lab-runtime.test.ts               (BB-LAB-20 to 31 and 60: the worker
│   │                                        runtime: GLUT's main loop, events,
│   │                                        menus, typed input, system(), files,
│   │                                        the output ring and the Console, and
│   │                                        how a program's end is reported)
│   ├── lab-page.test.ts                  (BB-LAB-32 to 36, 59 and 65: the /lab
│   │                                        route, its header link, isolation
│   │                                        and the dev server)
│   ├── lab-editor.test.ts                (BB-LAB-37 to 42 and 66 to 70: the
│   │                                        code editor, the compile client and
│   │                                        the log)
│   ├── lab-workspace.test.ts             (BB-LAB-43 to 51 and 71 to 77: the
│   │                                        workspace, the stage and the
│   │                                        program's window)
│   ├── lab-shared-layout.test.ts         (BB-LAB-61 to 64: the rings the page
│   │                                        and the program's worker share)
│   ├── lab-files.test.ts                 (BB-LAB-52 to 57, 78 to 86 and 88 to 91:
│   │                                        the browser save, Save, Open, New,
│   │                                        the examples, the file list and the
│   │                                        editor's Open in Lab)
│   └── lab-wording.test.ts               (BB-LAB-58: every message in the Lab's
│                                            sources, its compile and its
│                                            runtime keeps the Language Discipline
│                                            and British spelling)
├── white-box/                    ← Maps to Table 13.
│   ├── state-management.test.ts          (WB-STATE-*)
│   ├── matrix-engine.test.ts             (WB-MATRIX-*)
│   ├── scene-graph-traversal.test.ts     (WB-TRAVERSE-*)
│   ├── lesson-engine-internals.test.ts   (WB-LESSON-*)
│   ├── code-generation-service.test.ts   (WB-GEN-*)
│   ├── code-generation-buffers.test.ts   (WB-GEN-BUF-*)
│   ├── persistence-manager.test.ts       (WB-PERSIST-*)
│   ├── error-handling.test.ts            (WB-ERR-*)
│   ├── callbacks-runtime.test.ts         (WB-CB-*: the Run runtime against
│   │                                        the generated C++)
│   ├── code-structure.test.ts            (WB-CODE-*: the outline, folds, value
│   │                                        diff and explanation catalogue)
│   ├── vertex-journey.test.ts            (WB-JOURNEY-*: each stage's numbers
│   │                                        against the reference)
│   ├── share-payload.test.ts             (WB-SHARE-*: the shared payload,
│   │                                        links, image shrinking, QR codes)
│   ├── share-function.test.ts            (WB-SHAREFN-*: the Pages Function
│   │                                        that stores shares)
│   ├── grid-labels.test.ts               (WB-GRID-*: axis labels inside the
│   │                                        canvas)
│   ├── program-window.test.ts            (WB-WINDOW-*: the window's size and
│   │                                        position rules)
│   ├── bitmap-text.test.ts               (WB-TEXT-*: GLUT's 9×15 glyphs, line
│   │                                        spacing, glBitmap placement and the
│   │                                        canvas layout)
│   ├── image-compare.test.ts             (WB-FID-*, WB-LAB-12: the batteries'
│   │                                        image rule)
│   ├── british-spelling.test.ts          (WB-SPELL-*: British spelling in every
│   │                                        string students read)
│   ├── lab-compile.test.ts               (WB-LAB-01, 02, 13, 23 and 24: the
│   │                                        browser's compile: diagnostics, the
│   │                                        flags build.sh holds, the section
│   │                                        strip and one compile's steps)
│   ├── lab-runtime-build.test.ts         (WB-LAB-21 and 22: the main module
│   │                                        without dynamic execution, and the
│   │                                        headers pack)
│   ├── lab-publish.test.ts               (WB-LAB-15 and 25: the runtime version,
│   │                                        the compressed files, the manifest
│   │                                        and the publish checks, offline)
│   └── lab-battery.test.ts               (WB-LAB-19: each Lab battery program is
│                                            the one its reference was captured
│                                            from)
├── security/                     ← What a Lab program may include, use and reach.
│   ├── lab-includes.test.ts              (SEC-LAB-01, 02 and 11 to 13: include
│   │                                        and directive checks, and inline
│   │                                        assembly refused in the file)
│   └── lab-sandbox.test.ts               (SEC-LAB-16: the program's worker loses
│                                            its storage, network and worker
│                                            globals before main runs)
├── visual/                       ← Not part of `npm test`.
│   ├── editor.spec.ts                    (VIS-EDITOR-*: screenshot checks,
│   │                                        including the rail panels,
│   │                                        the lesson bar, the tour and Run, VIS-EDITOR-14 to 28, bitmap text VIS-EDITOR-36,
│   │                                        no selection outline left during Run VIS-EDITOR-37 and 38,
│   │                                        the canvas header on a narrow canvas VIS-EDITOR-39,
│   │                                        a Run colour kept through a resize and a theme change VIS-EDITOR-40,
│   │                                        run with `npm run test:visual`;
│   │                                        per-machine baselines that are
│   │                                        not committed)
│   ├── learn.spec.ts                     (VIS-LEARN-*: the /learn course map)
│   ├── guide.spec.ts                     (VIS-GUIDE-*: /guide, /teach, search
│   │                                        and the header on phones)
│   ├── about.spec.ts                     (VIS-ABOUT-*: the /about page at
│   │                                        1280 and 390, citation tabs)
│   ├── gallery.spec.ts                   (VIS-GALLERY-*: the /gallery page at
│   │                                        1280 and 390, a card opening its scene)
│   ├── lesson-blocks.spec.ts             (VIS-LB-*: goals, recap, predict and
│   │                                        fill-in steps in both themes; a long
│   │                                        fill-in line keeps Next clickable)
│   ├── code-math.spec.ts                 (VIS-CM-*: the code panel and the math journey in the approved mocks' scene)
│   ├── pipeline-textures.spec.ts         (VIS-PT-*: the Diagram, Raster vs vector,
│   │                                        Which Stage?, Quick Gradients and the
│   │                                        Texture group)
│   ├── share.spec.ts                     (VIS-SHARE-*: the Share dialog at 1280, the phone scene
│   │                                        view at 390 and the closing slide's QR code)
│   ├── fidelity.spec.ts                  (VIS-FID-*: the canvas against the exported
│   │                                        program on the course toolchain)
│   ├── lab.spec.ts                       (VIS-LAB-01 to 04: /lab with the template
│   │                                        running, at 1280 and 390 in both
│   │                                        themes; LAB_RUNTIME_LOCAL=1)
│   ├── lab-drawing.spec.ts               (VIS-LAB-05: each Lab battery program,
│   │                                        compiled and run in the Lab, against
│   │                                        its FreeGLUT reference; LAB_RUNTIME_LOCAL=1)
│   ├── lab-compiler.spec.ts              (VIS-LAB-07 to 11: the compiler's
│   │                                        download, no JavaScript, storage or
│   │                                        worker from a program, and the 2D
│   │                                        set compiled in the page;
│   │                                        LAB_RUNTIME_LOCAL=1)
│   └── helpers/lab.ts                    (the routes that stand in for
│                                            production in front of the preview
│                                            server: the local runtime and the
│                                            compiler)
├── algorithm/                    ← Maps to §3.10.3 Algorithm Validation.
│   ├── algorithm-1-global-matrix.test.ts        (ALG-1-*)
│   ├── algorithm-2-code-generation.test.ts      (ALG-2-*)
│   ├── algorithm-3-lesson-step.test.ts          (ALG-3-*)
│   ├── gl-geometry.test.ts                      (ALG-FID-*: points, lines,
│   │                                              stipple and FLAT colours by the
│   │                                              OpenGL 1.5 multisample rules)
│   ├── gl-raster.test.ts                        (ALG-LAB-01 to 08, 17 and 18: the Lab's
│   │                                              rasteriser, pixel by pixel, by the
│   │                                              OpenGL 1.5 rules with and without
│   │                                              multisampling)
│   └── gl-context.test.ts                       (ALG-LAB-09 to 16 and 19 to 39: the Lab's
│                                                  OpenGL 1.5 state machine, display lists,
│                                                  textures and GLUT's bitmap fonts, and
│                                                  the reference GPU's choices where the
│                                                  rules leave one)
└── reports/                      ← Per-run output; consumed by Chapter 4.
    ├── algorithm-1-results.json
    ├── algorithm-2-results.json
    ├── algorithm-3-results.json
    ├── coverage/                        (v8 HTML + JSON summary)
    ├── chapter-4-testing-results.md     ← drop-in for Chapter 4
    ├── chapter-3-revision-notes.md      ← suggested edits for Chapter 3
    ├── manual-compile-procedure.md      ← g++/FreeGLUT manual harness
    └── manual-cross-browser-procedure.md
```

## Running

```bash
npm test                # run all 1116 tests
npm run test:watch      # watch mode for development
npm run test:coverage   # also produce tests/reports/coverage/
npm run test:visual     # editor screenshot checks (Playwright, installed Chrome)
```

The screenshot checks compare against baselines kept in
`tests/visual/baseline.local/`, which is ignored by git because rendering
differs from machine to machine. Create the baselines once on a machine with
`npx playwright test --update-snapshots`, then run `npm run test:visual`
after each change. Results are written to `tests/visual/results.local/`.

The render fidelity checks (`VIS-FID-*`) are the exception: their references are
committed in `tests/fixtures/fidelity/reference/`, because they come from the
exported programs, not from the browser. They were recorded on the owner's
development PC (Windows, NVIDIA, 4× multisampling) with the course toolchain
(MinGW g++ 11.3, FreeGLUT, GLEW). To record them again after a deliberate change
to what a scene draws:

```bash
FIDELITY_RECORD=1 VAMS_GLUT_TOOLCHAIN=<path to the toolchain's mingw32 folder> npx playwright test fidelity
```

Each scene's C++ is exported, built with the capture shim, run, and its first
frame saved. `stb_image.h` is read from `VAMS_STB_IMAGE`, or from the
`Application` folder beside `mingw32`. Look at every image that changes before
committing it.

The Lab's references in `tests/fixtures/lab/reference/` are recorded the same
way, from the programs in `tests/fixtures/lab/programs/`. Record every reference,
or the ones named:

```bash
VAMS_GLUT_TOOLCHAIN=<path to the toolchain's mingw32 folder> node scripts/lab/capture-reference.mjs [name ...]
```

`VAMS_CAPTURE_FRAME` picks the frame to save (default 1). The capture shim asks
for the discrete GPU, and a program fails unless the renderer it ran on names
`VAMS_CAPTURE_RENDERER` (default `NVIDIA`). The committed references came from an
NVIDIA GeForce RTX 3060 Laptop GPU (OpenGL 4.6, driver 592.82). Each capture
writes the program's SHA-256 and the renderer to
`tests/fixtures/lab/reference/manifest.json`, and `WB-LAB-19` fails when a
program no longer matches its entry.

The programs that come from the editor (S-1 to S-7 and five gallery scenes) are
its export at 500 × 500, with the image paths shortened to the file name. They
are frozen; `LAB_EXPORT_CHECK=1 npx vitest run tests/white-box/lab-battery.test.ts`
checks that they still equal the export, and `LAB_EXPORT=1` rewrites them and
the images they load, after which their references are recorded again.
`checkerboard.png` is an 8 × 8 RGBA image of one-texel cells, white where x + y
is even and red (220, 30, 30) where it is odd, written once with `encodePng`.

### The Lab (`*-LAB-*`)

The Lab's checks carry the module `LAB` in every suite: `BB-LAB` (the page, the
workspace, the runtime, the 2D set and the wording), `WB-LAB` (the
browser's compile, the runtime build, the publish script and the battery),
`ALG-LAB` (the rasteriser and the OpenGL 1.5 state machine), `SEC-LAB` (what a
program may include, use and reach) and `VIS-LAB` (the page in the browser).

The checks that run the real compiler need the runtime built in
`lab/runtime/out/`, and skip without `LAB_RUNTIME_LOCAL=1`:

```bash
LAB_RUNTIME_LOCAL=1 npm run test:visual -- lab.spec lab-drawing lab-compiler   # VIS-LAB-01 to 11
```

The IDs the compile service's checks held (BB-LAB-05 to 07, WB-LAB-03 to 11,
WB-LAB-14, 16 to 18 and 20, and SEC-LAB-03 to 10, 14 and 15) went with it and
are not reused.

Playwright matches its filters against the whole path, so in a checkout whose
folder name holds `lab`, the filter `lab` alone runs every spec.

The runtime is built by `lab/runtime/build.sh`, run in the pinned
`emscripten/emsdk` image. The preview server has nothing of what production
puts in front of `/lab`, so `tests/visual/helpers/lab.ts` adds the isolation
headers, and serves the runtime from `lab/runtime/out/`, the compiler from
`node_modules/@yowasp/clang/gen/`, and the compiler's manifest made from the
files on disk. Every browser context starts with an empty cache, so each check
downloads the compiler, from this machine.
VIS-LAB-01 to 04 are screenshot checks with local baselines, like the others.
VIS-LAB-05 opens each battery program in the Lab as a `.zip` with the images it
loads, runs it, and compares the first frame the page takes from the shared
framebuffer with the program's reference by the battery's rule. `lines-wide`
keeps 2 parked pixels, the ends of its 45° width-4 lines; every other program
must match. A failure writes the frame and a diff image to
`tests/visual/results.local/lab-drawing/`.

## Acceptance bar (per §3.10)

| Criterion | Target | Current |
| --- | --- | --- |
| Black-box pass rate | ≥ 90 % | **100 % (91 / 91)** |
| White-box pass rate | ≥ 80 % | **100 % (79 / 79)** |
| Line coverage (Table 13 modules) | ≥ 80 % | **83.6 %** |
| Branch coverage (Table 13 modules) | ≥ 80 % | 70.7 % (see §4.5 for caveat) |
| Code-generator line coverage | full | **98.4 % (code-generator.ts)** |

## What is NOT in the automated suite

These items are described in Chapter 3 but are deliberately executed
manually because they depend on external tooling (g++ / FreeGLUT, real
browsers) that the developer's CI machine cannot be assumed to have:

* **Compilation of generated C++** — see `reports/manual-compile-procedure.md`.
* **Cross-browser execution** — see `reports/manual-cross-browser-procedure.md`.
* **Playwright UI scenarios** — out of scope for this iteration. The only
  Playwright suite is the screenshot check set (VIS-EDITOR, VIS-LEARN, VIS-ABOUT, VIS-GALLERY, VIS-LAB), which needs a
  locally created baseline and is not part of `npm test` or CI.

Their results, once collected, are inserted into the corresponding
sections of `reports/chapter-4-testing-results.md`.
