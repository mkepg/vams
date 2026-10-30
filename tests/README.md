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
│   └── image-compare.ts          ← PNG reading and writing, and the render
│                                    fidelity rule (edge pixels may differ,
│                                    the rest within 2 per channel).
├── fixtures/
│   ├── no-callbacks-program.cpp  ← The program generated for a scene with
│   │                                no callbacks, pinned by BB-CB-12.
│   │                                Rewrite it with WRITE_CALLBACK_FIXTURE=1.
│   └── fidelity/                 ← The render fidelity battery: scenes.ts,
│                                    the capture shim and the FreeGLUT
│                                    reference images VIS-FID compares with.
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
│   ├── learn-page.test.ts                (BB-LPAGE-*: the course catalog,
│   │                                        progress after hydration, /learn)
│   ├── crash-recovery.test.ts            (BB-RECOVER-*: lesson reload,
│   │                                        corrupt saves, recovery screen)
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
│   │                                        choosing a link)
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
│   └── lesson-rules.test.ts              (BB-LRULE-*: generator-name coverage,
│                                            wording, hints, recaps, code blanks
│                                            and capstones across the lessons)
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
│   ├── image-compare.test.ts             (WB-FID-*: the battery's image rule)
│   └── british-spelling.test.ts          (WB-SPELL-*: British spelling in every
│                                            string students read)
├── visual/                       ← Not part of `npm test`.
│   ├── editor.spec.ts                    (VIS-EDITOR-*: screenshot checks,
│   │                                        including the rail panels,
│   │                                        the lesson bar, the tour and Run, VIS-EDITOR-14 to 28, bitmap text VIS-EDITOR-36,
│   │                                        no selection outline left during Run VIS-EDITOR-37 and 38,
│   │                                        run with `npm run test:visual`;
│   │                                        per-machine baselines that are
│   │                                        not committed)
│   ├── learn.spec.ts                     (VIS-LEARN-*: the /learn course map)
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
│   └── fidelity.spec.ts                  (VIS-FID-*: the canvas against the exported
│                                            program on the course toolchain)
├── algorithm/                    ← Maps to §3.10.3 Algorithm Validation.
│   ├── algorithm-1-global-matrix.test.ts        (ALG-1-*)
│   ├── algorithm-2-code-generation.test.ts      (ALG-2-*)
│   ├── algorithm-3-lesson-step.test.ts          (ALG-3-*)
│   └── gl-geometry.test.ts                      (ALG-FID-*: points, lines,
│                                                  stipple and FLAT colours by the
│                                                  OpenGL 1.5 multisample rules)
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
  Playwright suite is the screenshot check set (VIS-EDITOR, VIS-LEARN, VIS-ABOUT, VIS-GALLERY), which needs a
  locally created baseline and is not part of `npm test` or CI.

Their results, once collected, are inserted into the corresponding
sections of `reports/chapter-4-testing-results.md`.
