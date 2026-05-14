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
│   └── store.ts                  ← Test helpers around useVamsStore.
├── black-box/                    ← Maps to Table 12.
│   ├── primitive-creation.test.ts        (BB-PRIM-*)
│   ├── transformation-operations.test.ts (BB-XFORM-*)
│   ├── scene-graph-hierarchy.test.ts     (BB-HIER-*)
│   ├── code-generation.test.ts           (BB-GEN-*)
│   ├── cpp-code-validation.test.ts       (BB-CPP-*)
│   ├── lesson-engine.test.ts             (BB-LESSON-*)
│   └── project-persistence.test.ts       (BB-PERSIST-*)
├── white-box/                    ← Maps to Table 13.
│   ├── state-management.test.ts          (WB-STATE-*)
│   ├── matrix-engine.test.ts             (WB-MATRIX-*)
│   ├── scene-graph-traversal.test.ts     (WB-TRAVERSE-*)
│   ├── lesson-engine-internals.test.ts   (WB-LESSON-*)
│   ├── code-generation-service.test.ts   (WB-GEN-*)
│   ├── code-generation-buffers.test.ts   (WB-GEN-BUF-*)
│   ├── persistence-manager.test.ts       (WB-PERSIST-*)
│   └── error-handling.test.ts            (WB-ERR-*)
├── algorithm/                    ← Maps to §3.10.3 Algorithm Validation.
│   ├── algorithm-1-global-matrix.test.ts        (ALG-1-*)
│   ├── algorithm-2-code-generation.test.ts      (ALG-2-*)
│   └── algorithm-3-lesson-step.test.ts          (ALG-3-*)
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
npm test                # run all 190 tests
npm run test:watch      # watch mode for development
npm run test:coverage   # also produce tests/reports/coverage/
```

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
* **Playwright UI scenarios** — out of scope for this iteration.

Their results, once collected, are inserted into the corresponding
sections of `reports/chapter-4-testing-results.md`.
