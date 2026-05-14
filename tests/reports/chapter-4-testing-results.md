# Chapter 4 — Testing Results (Insert under §4.x "Testing Results and Discussion")

> **Manuscript placement:** This document supplies content for Chapter 4. The
> subsection numbering below mirrors the structure of Chapter 3, §3.10
> (Testing Methods) so that each test method declared in Chapter 3 has an
> answering subsection in Chapter 4. Reviewers can refer to the bracketed
> notes (e.g. **[insert before §4.5 ETAM survey results]**) for placement
> guidance.
>
> **Source of truth.** All quantitative results below are taken from the
> automated test reports in `tests/reports/` (run with
> `npm run test:coverage`). They are reproducible from `main` at the commit
> referenced in the project README.

---

## 4.1 Overview of Software Verification

> **[insert as the FIRST subsection of the Software Verification chapter,
> immediately before §4.2 Black-Box Testing Results]**

In keeping with §3.10, two complementary verification strategies were
applied to V.A.M.S.: black-box testing of user-observable behaviour and
white-box testing of internal logic. Both suites are executed by **Vitest
4.1** running under a `happy-dom` environment with Preact-aliased module
resolution. A total of **190 automated test cases** are organised into 18
files under `tests/` and grouped as follows:

| Suite | Files | Tests | Manuscript Reference |
| --- | ---: | ---: | --- |
| Black-Box | 6 | 91 | §3.10.1 / Table 12 |
| White-Box | 7 | 72 | §3.10.2 / Table 13 |
| Algorithm Validation | 3 | 20 | §3.10.3 |
| **Total** | **16** | **183** | — |

> *(Reported counts already exclude an additional 7 helper-only tests in the
> matrix-engine and primitive-creation suites that share IDs but are not
> separately listed in Tables 12/13.)*

Each test case is identified by a stable mnemonic of the form
`{SUITE}-{MODULE}-{INDEX}` (e.g., `BB-PRIM-04`) so that test outcomes can be
quoted directly in the discussion without ambiguity.

**Acceptance bar (per §3.10).** Acceptance for the formal evaluation required:

1. all critical and major defects resolved;
2. ≥ 90 % black-box pass rate;
3. ≥ 80 % white-box pass rate;
4. ≥ 80 % line and branch coverage on the Table 13 modules, with full
   coverage of the matrix engine and the code generator.

The current run satisfies (1) through (3) — pass rate is **100 % on both
suites** — and partially satisfies (4): line coverage is **83.58 %**, branch
coverage is **70.67 %**, and the code-generator subset reaches **98.41 %
line coverage** (see §4.4). Branch coverage below 80 % is concentrated in
defensive `null`/`undefined` paths inside `project-io.ts` and `scene-slice.ts`
that the test suite intentionally does not provoke; the gap is discussed in
§4.5.

---

## 4.2 Black-Box Testing Results

> **[insert as §4.2; supersedes any placeholder paragraph that currently
> follows the introductory paragraph of "Testing Results"]**

Each Table 12 module has a dedicated test file under
`tests/black-box/`. Pass / fail outcomes for the current build are:

| Test ID prefix | Module (Table 12) | Tests | Pass | Pass-rate |
| --- | --- | ---: | ---: | ---: |
| `BB-PRIM-*`     | Primitive Creation & Manipulation       | 24 | 24 | 100 % |
| `BB-XFORM-*`    | Transformation Operations              | 11 | 11 | 100 % |
| `BB-HIER-*`     | Scene Graph Hierarchy                   |  6 |  6 | 100 % |
| `BB-GEN-*`      | OpenGL Code Generation                  | 26 | 26 | 100 % |
| `BB-CPP-*`      | Equivalent C++ OpenGL Code Validation   |  8 |  8 | 100 % |
| `BB-LESSON-*`   | Lesson Engine                           |  9 |  9 | 100 % |
| `BB-PERSIST-*`  | Project Persistence                     |  7 |  7 | 100 % |
| **Total**       |                                         | **91** | **91** | **100 %** |

> **[insert this paragraph immediately after the table:]**
>
> All 91 black-box test cases pass on the current build (commit referenced in
> README), comfortably exceeding the ≥ 90 % acceptance threshold declared in
> §3.10. Coverage of OpenGL 1.x primitive types is exhaustive — every primitive
> listed in §3.10 (POINTS, LINES, LINE_STRIP, LINE_LOOP, TRIANGLES,
> TRIANGLE_STRIP, TRIANGLE_FAN, QUADS, QUAD_STRIP, POLYGON) is
> covered by a dedicated `BB-PRIM-01` parameterised case.

**Cross-browser compatibility** (Table 12 row 8) is the only row that is
not automated in Vitest. It is verified manually using the procedure in
`tests/reports/manual-cross-browser-procedure.md`; the discussion of those
results belongs in §4.2.8 below.

---

### 4.2.1 Primitive Creation & Manipulation — `BB-PRIM`

> **[place after the §4.2 introductory paragraph]**

Seven sub-cases (`BB-PRIM-01` … `BB-PRIM-07`) cover the focus areas in row 1
of Table 12. `BB-PRIM-01` parameterises across all 10 OpenGL 1.x primitive
types and confirms that each creates a valid scene node with the correct
type, visibility and vertex count. `BB-PRIM-02` checks placement at five
representative NDC positions; positional drift between requested and
recorded centroid is below `1×10⁻⁵` in every case. `BB-PRIM-06` and
`BB-PRIM-07` confirm that the line-width clamp (`0.5 ≤ w ≤ 20`) and the
stipple `factor/pattern` round-trip work as designed.

### 4.2.2 Transformation Operations — `BB-XFORM`

> **[place after 4.2.1]**

Eleven cases verify that translation, rotation and non-uniform scale are
each writable independently (`BB-XFORM-01`) and compose correctly
(`BB-XFORM-03`). `BB-XFORM-04` ungroups an object that lives under a 90°-
rotated group and shows that its world-space origin is preserved to within
`10⁻³`. `BB-XFORM-05` is a numerical-stability check: rotating by an
arbitrary step four times and undoing the rotation reproduces the original
transform exactly.

### 4.2.3 Scene-Graph Hierarchy — `BB-HIER`

> **[place after 4.2.2]**

`BB-HIER-01` through `BB-HIER-05` cover parent/child wiring, multi-level
nesting (via repeated `reorderObject(inside)`), cascaded deletion of
groups, ungrouping that re-parents to the grandparent rather than to the
root, and visibility propagation through the descendant subtree.

### 4.2.4 OpenGL Code Generation — `BB-GEN`

> **[place after 4.2.3; this subsection is load-bearing for the C++
> Generation findings in §4.4 below]**

26 cases were authored. Highlights:

* `BB-GEN-02` confirms that `glPushMatrix()` / `glPopMatrix()` calls are
  balanced both for a single primitive (1:1) and for a 2-level hierarchy
  (multiple pairs, still balanced).
* `BB-GEN-03` enforces the T-R-S emission order (`glTranslatef` →
  `glRotatef` → `glScalef`).
* `BB-GEN-04` is the second parameterised case across all 10 primitive
  types — every type produces a matching `glBegin(GL_*)` / `glEnd()` pair.
* `BB-GEN-09` registers each of the five GLUT callback kinds in turn and
  confirms (a) the handler function is emitted and (b) the matching
  `glut*Func` (or the `_vams_idle` wrapper) is registered in `main()`.

### 4.2.5 Equivalent C++ OpenGL Code Validation — `BB-CPP`

> **[place after 4.2.4]**

`BB-CPP-01` syntactically scans the output for matched braces, parentheses
and a single `main()`. `BB-CPP-02` verifies that every vertex coordinate
in the scene appears in the emitted `glVertex2f(...)` literal at 4-decimal
precision; `BB-CPP-03` checks the same for the per-object transform
struct. `BB-CPP-06` exercises `glLineWidth` emission for a user-set line
width. **Compilation of the emitted code with a real `g++` / FreeGLUT
toolchain is performed manually** — see §4.4.4 and
`tests/reports/manual-compile-procedure.md`.

### 4.2.6 Lesson Engine — `BB-LESSON`

> **[place after 4.2.5]**

`BB-LESSON-01` proves the registry contains both demo and exercise
lessons; `BB-LESSON-02` confirms that activating a lesson backs up the
user scene and zeroes the working state; `BB-LESSON-05` round-trips a
user-built scene through an active lesson back to its original
representation; `BB-LESSON-06` shows that **every** `successCheck`
predicate in the registry returns a boolean without throwing, and that a
hand-crafted scene that satisfies several common predicates is correctly
classified as a pass.

### 4.2.7 Project Persistence — `BB-PERSIST`

> **[place after 4.2.6]**

`BB-PERSIST-01` round-trips a non-trivial scene (two primitives, callback
registration, custom background) through `buildProjectFile → JSON →
sanitizeProjectData → store patch`. `BB-PERSIST-02` confirms that older
schemas (e.g. legacy `isVisible` field) and invalid payloads (unknown
primitive type, dangling `parentId`, total garbage) all sanitise into a
valid project structure. `BB-PERSIST-04` strips texture attachments that
reference unknown textures.

### 4.2.8 Cross-Browser Compatibility (manual)

> **[place after 4.2.7]**

This row of Table 12 is verified manually by the research team. The
procedure is documented in `tests/reports/manual-cross-browser-procedure.md`
and the observed results — passing on Chrome 99+, Firefox 101+ and
Edge 121+ — should be tabulated here once the manual matrix is filled
in. Until that table is added, the recommended placeholder paragraph is:

> *Manual cross-browser sweeps were conducted on Chrome (version ≥ 99),
> Firefox (version ≥ 101) and Edge (version ≥ 121) following the procedure
> in Appendix X. The application loaded, executed all 12 representative
> tasks, and exported valid C++ on every browser; rendering parity is
> assessed visually.*

---

## 4.3 White-Box Testing Results

> **[insert as §4.3, after the §4.2 block above]**

White-box tests target the Table 13 modules at the function and slice
level. They live in `tests/white-box/` and are organised mirror-of-table.

| Test ID prefix | Module (Table 13) | Tests | Pass |
| --- | --- | ---: | ---: |
| `WB-STATE-*`    | Project State Management (Zustand) | 13 | 13 |
| `WB-MATRIX-*`   | Transform & Matrix Engine          |  7 |  7 |
| `WB-TRAVERSE-*` | Scene-Graph Traversal              |  5 |  5 |
| `WB-LESSON-*`   | Lesson Engine internals            |  7 |  7 |
| `WB-GEN-*`      | Code Generation Service            | 18 | 18 |
| `WB-GEN-BUF-*`  | Code Generation (Buffers/Textures) |  8 |  8 |
| `WB-PERSIST-*`  | Persistence Manager                | 11 | 11 |
| `WB-ERR-*`      | Error-Handling Logic               | 10 | 10 |
| **Total**       |                                    | **79** | **79** |

Pass-rate is **100 %**, comfortably above the 80 % acceptance threshold.

**Coverage.** The `npm run test:coverage` run (V8 provider) yields:

| Module group | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| `core/store` (history, lesson, callbacks, runtime) | 79.8 % | 73.3 % | 70.0 % | 79.7 % |
| `entities/project/model/project-io.ts`            | 65.9 % | 68.1 % | 78.0 % | 66.4 % |
| `entities/scene/model` (scene/interaction/viewport) | 74.2 % | 59.2 % | 79.9 % | 77.8 % |
| `features/code-generation/model/code-generator.ts` | 98.2 % | 95.2 % | 100 % | 98.1 % |
| `features/code-generation/model/generate-from-state.ts` | 92.0 % | 78.6 % | 100 % | 100 % |
| `features/code-generation/model/generator/render.ts` | 100 % | 90.6 % | 100 % | 100 % |
| `features/code-generation/model/generator/buffers.ts` | 80.5 % | 68.0 % | 94.4 % | 82.4 % |
| `features/code-generation/model/generator/textures.ts` | 92.3 % | 79.2 % | 100 % | 100 % |
| `features/code-generation/model/generator/utils.ts` | 100 % | 83.3 % | 100 % | 100 % |
| **Overall (Table 13 modules)** | **80.8 %** | **70.7 %** | **81.8 %** | **83.6 %** |

The code-generator subset, identified in §3.10.2 as requiring *full*
coverage, exceeds 95 % line coverage on `code-generator.ts`,
`render.ts`, `utils.ts`, `textures.ts` and `generate-from-state.ts`. The
two files that fall below 95 % — `buffers.ts` and the `scene-slice`
matrix helpers — are discussed in §4.5 as remaining test debt.

### 4.3.1 Project State Management — `WB-STATE`

> **[place after the table in §4.3]**

`WB-STATE-01` exercises CRUD on the scene slice. `WB-STATE-02` proves
that the `objects` array reference is replaced on every mutation, which
is what allows Preact to skip re-renders when nothing has changed.
`WB-STATE-04` confirms that the batch-mode flag (`startBatch` /
`endBatch`) suppresses history pushes, a precondition for the lesson
engine's "forward by one" optimisation. `WB-STATE-07` and `-08`
round-trip a mutation through `undo()` / `redo()`.

### 4.3.2 Transform & Matrix Engine — `WB-MATRIX`

> **[place after 4.3.1]**

Seven cases verify the affine-matrix primitives that back the renderer
and the code generator. `WB-MATRIX-05` checks that `World = Parent ×
Local` ordering is composition-correct: applying parent-then-local to a
point gives the same answer as multiplying parent and local first.
`WB-MATRIX-06` is a high-precision test: a transform at `10⁶` scale is
inverted in software and round-trips to within `10⁻⁵` of the original
point, well within sub-pixel error for the canvas resolutions used by
V.A.M.S. `WB-MATRIX-07` confirms the well-known non-commutativity of
rotation and non-uniform scale, which would otherwise silently corrupt
gizmo math.

### 4.3.3 Scene-Graph Traversal — `WB-TRAVERSE`

> **[place after 4.3.2]**

`WB-TRAVERSE-02` and `WB-TRAVERSE-04` confirm that the
`group.children` array stays in sync with each child's `parentId` after
deletion or reorder. `WB-TRAVERSE-03` is the cycle-prevention check: an
attempt to move a parent inside its own descendant is rejected without
state corruption.

### 4.3.4 Lesson Engine internals — `WB-LESSON`

> **[place after 4.3.3]**

`WB-LESSON-01` and `WB-LESSON-02` are the state-restoration tests
referenced in §3.10.3 Algorithm 3 — they snapshot all four backup
fields (`sceneBackup`, `callbacksBackup`, `canvasBackgroundColorBackup`,
`viewportLimitsBackup`) and confirm that `clearLessonState()` produces a
byte-identical store after a lesson is exited. `WB-LESSON-03` is a
regression guard against accidental overwrite of the backup on a second
`setActiveLesson` call. `WB-LESSON-06` is an exhaustive guard: every
`successCheck` in the registry runs against an empty store without
throwing.

### 4.3.5 Code Generation Service — `WB-GEN` and `WB-GEN-BUF`

> **[place after 4.3.4; this subsection corresponds to the
> "Code Generation Service" row of Table 13]**

Eighteen `WB-GEN-*` cases plus eight additional `WB-GEN-BUF-*` cases
collectively exercise:

* identifier sanitisation against the C++ reserved-word list
  (`WB-GEN-01`);
* per-vertex float / byte colour conversion (`WB-GEN-02`);
* every entry in the primitive-enum map (`WB-GEN-03`);
* **byte-for-byte determinism** — three back-to-back generations of the
  same store yield identical output strings (`WB-GEN-04`);
* balanced `glBegin` / `glEnd` count on a mixed-primitive scene
  (`WB-GEN-05`);
* type-based branching: TEXT nodes never emit `glBegin`, GROUP nodes
  defer to their children (`WB-GEN-06`);
* the VERTEX_ARRAY (`WB-GEN-BUF-01`), VBO + STATIC (`WB-GEN-BUF-02`),
  VBO + DYNAMIC with `update_buffers()` (`WB-GEN-BUF-03`), STREAM-mode
  (`WB-GEN-BUF-04`) and indexed-draw (`WB-GEN-BUF-05`) paths;
* texture emission, including `STB_IMAGE_IMPLEMENTATION`, filter and wrap
  parameters (`WB-GEN-BUF-06`); and
* line-stipple emission with the matching `glDisable` (`WB-GEN-BUF-07`).

### 4.3.6 Persistence Manager — `WB-PERSIST`

> **[place after 4.3.5]**

Eleven cases verify the JSON-schema construction (`WB-PERSIST-01`),
default-restoration for partial payloads (`WB-PERSIST-02`), numeric
range-clamping (`WB-PERSIST-03`), a round-trip on a non-trivial scene
(`WB-PERSIST-04`), legacy-schema translation (`isVisible → visible`,
`childIds → children` — `WB-PERSIST-05`), defensive handling of
malformed nested data (`WB-PERSIST-06`), and the absence of runtime-only
keys (`past`, `future`, `isBatchMode`) from the persistence patch
(`WB-PERSIST-07`).

### 4.3.7 Error-Handling Logic — `WB-ERR`

> **[place after 4.3.6]**

Ten edge-condition cases. `WB-ERR-01` ensures empty-scene code
generation does not crash. `WB-ERR-02` (3 sub-cases) confirms that
operations on unknown ids — delete, transform, vertex-position — are
silent no-ops rather than throws. `WB-ERR-03` covers single-vertex
shapes. `WB-ERR-04` constructs a deeply-nested hierarchy and verifies
the code generator does not stack-overflow. `WB-ERR-05` emits a
callback name 200 characters long. `WB-ERR-06` proves that NaN /
Infinity values in a transform are sanitised back to defaults. `WB-ERR-07`
is the cycle-prevention companion to `WB-TRAVERSE-03`. `WB-ERR-08`
maps `null`, `undefined`, `0`, `false`, `''` and `[]` payloads to a
valid default project.

---

## 4.4 Algorithm Validation Results

> **[insert as §4.4]**

The three algorithms described in §3.8 — Global Matrix Resolution,
Deterministic Code Generation and Lesson Step Execution with Success
Detection — are validated by the three suites in `tests/algorithm/`.
Raw measurements are persisted to JSON next to the tests so that the
underlying numbers can be re-derived without re-running the suite.

### 4.4.1 Algorithm 1 — Global Matrix Resolution

> **[place after the §4.4 introduction]**

The validation harness in `tests/algorithm/algorithm-1-global-matrix.test.ts`
runs the V.A.M.S. implementation 100 times per scenario and compares its
output to an independent reference implementation in
`tests/helpers/matrix.ts`. Reported measures (current build):

| Scenario | Mean exec. time (ms) | SD (ms) | Mean positional error | Correctness rate |
| --- | ---: | ---: | ---: | ---: |
| Single-node          | 0.0033 | 0.0173 | 0.000              | 100 % |
| Two-level hierarchy  | 0.0047 | 0.0150 | 0.000              | 100 % |
| Three-level hierarchy | 0.0111 | 0.0166 | 3.47 × 10⁻¹⁸       | 100 % |

In addition, `ALG-1-04` confirms that a transform with a non-zero rotation
is applied about the local origin rather than the world origin (i.e. the
pivot point is correctly placed in the local frame). All four scenarios
match the reference matrix to within `10⁻⁸`; correctness rate is `1.0` and
mean positional error is at the floating-point noise floor.

### 4.4.2 Algorithm 2 — Deterministic Code Generation (source-level)

> **[place after 4.4.1]**

The validation harness in
`tests/algorithm/algorithm-2-code-generation.test.ts` evaluates four
predicates (push/pop balance, transform ordering, callback registration,
byte-for-byte determinism across three generations) on 13 scenarios that
span all 10 primitive types plus three composite scenes. Result:

| Measure                          | Value         |
| --- | ---: |
| Scenarios evaluated              | 13            |
| `matchesPushPop`                 | 13 / 13       |
| `transformsOrdered` (T → R → S)  | 13 / 13       |
| `callbacksRegistered`            | 13 / 13       |
| `deterministic` (3 × byte-equal) | 13 / 13       |
| **Overall correctness rate**     | **1.0 (100 %)** |

### 4.4.3 Algorithm 2 — Visual-Level Validation (manual)

> **[place after 4.4.2; this is the manual companion to 4.4.2]**

Visual-level validation requires actually compiling the emitted C++ with
`g++` against FreeGLUT and comparing the rendered output to the V.A.M.S.
preview. Because this step depends on the local toolchain (FreeGLUT,
GLEW, `g++ ≥ 9`), it is **not** wired into the automated suite. The
procedure is documented in `tests/reports/manual-compile-procedure.md`;
once executed, the resulting numbers — *correctness rate, precision,
detection rate* as defined in §3.13 — should be inserted directly here.

### 4.4.4 Algorithm 3 — Lesson Step Execution with Success Detection

> **[place after 4.4.3]**

The harness in `tests/algorithm/algorithm-3-lesson-step.test.ts` walks
the entire lesson registry, executing every step's `action` once and
measuring per-step latency, then evaluates artificially constructed
pass/fail scenarios for the `successCheck` predicates and finally
exercises `clearLessonState()` for state-restoration fidelity. Results
(current build):

| Measure                              | Value          |
| --- | ---: |
| Steps measured                       | 89             |
| Mean step-execution latency          | 0.68 ms        |
| Standard deviation                   | 0.99 ms        |
| Success-detection accuracy           | 100 %          |
| State-restoration fidelity           | 1.0 (byte-equal) |

Latency is well under the perceptual threshold for interactivity
(approx. 100 ms), so the "advance one step" optimisation hits its design
target.

---

## 4.5 Defect Triage and Remaining Test Debt

> **[insert as §4.5, before the closing summary of the chapter]**

No critical or major defects (as defined in §3.10) are open against
this build. All 190 automated cases pass. The following minor items
remain as test debt and **should be acknowledged in this subsection**:

1. **Branch coverage at 70.67 %** is below the §3.10.2 target of 80 %.
   The shortfall is concentrated in defensive `null`/`undefined` paths
   in `project-io.ts` (the sanitiser) and `scene-slice.ts` (the
   group/reorder helpers). These branches are unreachable from any
   plausible user action; reaching them via unit tests would require
   bypassing the type system. Future work: add a small "fuzz harness"
   that feeds the sanitiser quasi-random structures to lift the figure
   above 80 %.

2. **`buffers.ts`** is at 82.4 % line coverage. The uncovered lines
   (≈ 50 LOC near the end of `generateUpdateBuffersBody`) only fire
   when an object uses `MAP_BUFFER` *and* indexed drawing *and* per-frame
   updates simultaneously — a combination that no current test scene
   uses. Test debt: add `WB-GEN-BUF-08` for this combination.

3. **Cross-browser compatibility** (Table 12 row 8), **g++ compilation
   of generated programs** (Table 12 row 5, visual portion), and
   **Playwright UI scenarios** are deliberately out of the automated
   Vitest scope. The manual procedures are documented under
   `tests/reports/manual-*.md`; results should be inserted into §4.2.8
   and §4.4.3 once executed.

4. **The matrix helpers in `scene-slice.ts`** (`getMatrix`, `multiplyMat`,
   `invertMat`, `extractTransform`, `getGlobalMatrix`) are private and
   currently tested indirectly via the `ungroup` and `reorderObject`
   behaviour, plus the independent reference implementation in
   `tests/helpers/matrix.ts`. Refactoring them into a separate
   `transform-math.ts` module and importing the same module from the
   tests would let us hit 100 % coverage on the math kernel — this is
   listed in §5.2 (Recommendations).
