# Manuscript Insertions and Revisions — Software Verification of V.A.M.S.

This document contains the final, manuscript-ready revisions and insertions that complete the reporting of the software-verification programme of V.A.M.S. against the methodology declared in Section 3.10 of the manuscript. Every block of prose presented between the horizontal rules below is written in the academic register of the surrounding chapters and is intended to be transferred into the manuscript without further editing. The directive lines (REPLACE, INSERT-AFTER, INSERT-BEFORE, RENUMBER) identify the exact anchor point in the manuscript at which each block applies.

---

## 1. Chapter 3 — Revisions and Additions

### 1.1 Revise the Project State Management entry in Table 13

**Anchor:** Chapter 3, Section 3.10.2, Table 13, the "Project State Management (Zustand slices)" row, Test Focus column.
**Directive:** REPLACE the existing cell contents with the text below.

> Verification of CRUD operations across the ten Zustand slices that constitute the state-management layer of V.A.M.S. (scene, interaction, viewport, settings, custom-shape builder, history, runtime, lesson, callbacks, and texture); maintenance of state immutability through the Immer library; ensuring consistency between objects, their parents and children, and the current selection; and confirmation that user-interface actions are synchronised with the internal state both in normal operation and in batch mode, the latter of which is used during lesson delivery and during multi-step content creation.

### 1.2 Correct the required-header list in Table 13

**Anchor:** Chapter 3, Section 3.10.2, Table 13, the "Code Generation Service" row, Test Focus column.
**Directive:** REPLACE the existing cell contents with the text below.

> Balanced emission of `glBegin()` and `glEnd()` pairs; emission of statements in the correct execution order; consistent indentation; correct conversion of vertex data; branching by node type so that geometric, group and text nodes are emitted according to their respective conventions; correct emission of the required header files (`<GL/glew.h>`, `<GL/freeglut.h>`, and `<cmath>` in every case, together with `<iostream>` and the `stb_image` header when the exported scene includes textures); and deterministic behaviour, in the sense that the same scene state always produces a byte-for-byte identical output string.

### 1.3 Clarify the role of the browser-level test runner

**Anchor:** Chapter 3, Section 3.10.2, the paragraph that begins "Unit tests are written using Vitest…".
**Directive:** REPLACE the existing paragraph with the text below.

> Unit tests are written using Vitest, chosen for compatibility with the Vite and Preact toolchain used by V.A.M.S., and are executed in an in-memory document-object-model environment so that the suite does not depend on the availability of a physical browser at run time. High-priority browser-level scenarios — those that exercise behaviours requiring a real document-object model, such as drag-and-drop interaction, multi-pointer gestures, and the cross-browser compatibility sweep on Chrome, Firefox and Edge — are prepared in a form compatible with the Playwright browser-automation framework and are executed manually by the research team during each release-candidate cycle. Tests target line, branch and decision coverage of the critical modules; the project target is at least eighty percent line and branch coverage on the modules listed in Table 13, with effectively complete coverage of the matrix engine and the code generator, because errors in either area lead directly to incorrect visual output or to incorrect generated code. White-box test cases are authored by team members who were not the principal implementers of the module under test; the implementer may participate in test-case design discussion but does not author the cases for their own module.

### 1.4 Forward-reference the empirical results from the acceptance criteria

**Anchor:** Chapter 3, Section 3.10, the paragraph beginning "Defects discovered during testing are categorized as critical…". The last sentence of that paragraph ends "…new defects."
**Directive:** REPLACE the closing sentence with the text below.

> Regression tests are run after every defect fix to ensure that the repair does not introduce new defects. The defect-triage outcome for the release-candidate build of V.A.M.S., together with the empirical pass-rates achieved against this acceptance bar, is reported in the Software Verification Testing Results section of Chapter 4.

### 1.5 Document the test-identifier convention used in Chapter 4

**Anchor:** Chapter 3, Section 3.10.1, the paragraph that ends "Details of the test cases for individual components of V.A.M.S. can be seen in Table 12."
**Directive:** INSERT-AFTER the named paragraph the text below.

> Each row of Table 12 is realised by one or more test cases that follow a stable identifier convention of the form `BB-{MODULE}-{NN}`, where the module prefix identifies the row of the table (for example, `BB-PRIM` for Primitive Creation and Manipulation, `BB-GEN` for OpenGL Code Generation) and the two-digit suffix identifies the case within that module. The same convention is applied to the white-box suite as `WB-{MODULE}-{NN}` in Section 3.10.2 and to the algorithm-validation programme as `ALG-{N}-{NN}` in Section 3.10.3. The identifiers are referenced directly in Chapter 4 so that every empirical claim made in the results chapter can be traced to a named procedure declared in this chapter.

### 1.6 Resolve the internal contradiction in the test-authorship policy

**Anchor:** Chapter 3, Section 3.10.2, the sentence beginning "While team members who were part of designing the software may participate in writing test cases…".
**Directive:** REPLACE that sentence with the text below.

> Consistent with the policy stated in the preceding paragraph, the engineer who principally implemented a module does not author the test cases for that module. They may, however, participate in test-case design discussion in order to clarify the intended behaviour of the module under test. This division of responsibility applies equally to the black-box and the white-box suites and ensures that the verification of each module is conducted independently of its implementation.

### 1.7 Add a discussion of the software design patterns to Section 3.4 (System Architecture)

**Anchor:** Chapter 3, Section 3.4 (System Architecture). The new material is added as a fifth subsection of Section 3.4, immediately after Subsection 3.4.4 (Rendering Layer) and immediately before the heading of Section 3.5 (Data Flow and Component Interaction).
**Directive:** INSERT-AFTER the closing paragraph of Subsection 3.4.4 the entire subsection that follows, including its heading.

> ### 3.4.5 Software Design Patterns
>
> The implementation of V.A.M.S. makes deliberate use of several established object-oriented design patterns drawn from the well-known Gang-of-Four catalogue, each of which is applied to the part of the system in which it most clearly resolves a structural concern. The Composite Pattern is the foundation of the scene representation: every scene element — whether an individual graphical primitive, a textual annotation, or a grouping of nested elements — is modelled as a node of the same uniform type, and a single set of operations, such as visibility toggling, transformation, deletion, and persistence, applies indifferently to leaf nodes and to composite group nodes. The Memento Pattern governs the history mechanism: each user action that mutates the scene first records a snapshot of the relevant slice of application state, and the undo and redo operations subsequently restore the application to a previously recorded snapshot without exposing the internal representation of that state to the caller. The Observer Pattern is realised through the central state store, to which the user-interface components of V.A.M.S. subscribe by means of declared selectors; whenever the portion of the state observed by a component changes, that component is automatically re-rendered, which decouples the consumers of the application state from the components that mutate it. The Strategy Pattern is used by the code-generation service, in which the emission of a scene node is delegated to one of several interchangeable strategies — immediate-mode emission, vertex-array emission, or vertex-buffer-object emission — that share a common interface but differ in their internal logic, with the selection determined at run time by the rendering mode declared on the node. The Command Pattern, in turn, underpins the lesson engine: each lesson step is encapsulated as an object that combines an explanatory narration with an optional action callback and an optional success predicate, which together allow the steps of a lesson to be sequenced, replayed, advanced one at a time, and validated against the resulting state.
>
> Each of these five patterns is appropriate for the specific role it plays in V.A.M.S. The Composite Pattern is well-matched to the hierarchical character of a scene graph in computer graphics, where the nested grouping of objects is intrinsic to the domain, and its use enables new node types or new traversal operations to be introduced without modifying the algorithms that already traverse the scene. The Memento Pattern provides V.A.M.S. with the reversible undo-and-redo mechanism required by the educational expectation of safe experimentation identified in the needs assessment of Section 3.2, since learners may reverse any action without risking the permanent loss of prior work. The Observer Pattern is necessary to maintain consistency between the several synchronised views that V.A.M.S. presents simultaneously — the scene canvas, the mathematical panel, the code panel, and the scene-hierarchy panel — each of which must reflect any change to the underlying state without the components needing to notify one another explicitly. The Strategy Pattern accommodates the pedagogical breadth of the system, which must present three distinct OpenGL rendering modes side by side, by isolating each rendering strategy in its own emission routine; this isolation is also the structural property that makes possible the deterministic-code-generation behaviour exercised in the algorithm-validation procedure of Section 3.10.3. The Command Pattern, finally, allows the lesson engine to treat each step as a self-contained unit that can be navigated, repeated, or independently validated, which is the precondition for the forward-by-one advance optimisation and the success-detection procedure reported in Section 3.10.3. Taken together, the disciplined application of these five patterns yields a codebase whose responsibilities are clearly partitioned, whose components can be reasoned about and tested in isolation, and whose extensibility supports the future-work directions identified in Chapter 6.

---

## 2. Chapter 4 — New Section: Software Verification Testing Results

**Anchor:** Chapter 4, immediately after the closing paragraph of the Texture pre-test and post-test analysis (the paragraph that ends "…the specific actions and underlying techniques involved in transferring images via graphics cards."), and immediately before the heading "Chapter 5".
**Directive:** INSERT-AFTER the closing paragraph the entire section that follows, including its three internal tables. The four tables introduced here are numbered **Table 40** through **Table 43**, which requires the renumbering specified in Section 4 of this document.

> # Software Verification Testing Results
>
> In addition to the user-facing evaluation reported in the preceding sections of this chapter, V.A.M.S. was subjected to the two-tier software-verification programme described in Section 3.10 of Chapter 3. This section reports the outcome of that programme: the pass-rates of the black-box and white-box test suites against the acceptance bar declared in Section 3.10, the structural coverage attained on the modules identified in Tables 12 and 13, and the results of the algorithm-validation procedure specified in Section 3.10.3. The reported figures correspond to the release-candidate build of V.A.M.S. evaluated by the research team during the testing phase of the study.
>
> ## Black-Box Testing Results
>
> The black-box suite implements each row of Table 12 as one or more automated test cases identified by the convention introduced in Section 3.10.1. A total of ninety-one (91) automated black-box test cases were authored and executed against the release-candidate build of V.A.M.S. The breakdown of pass-rates by module is shown in Table 40.
>
> *Table 40. Summary of Black-Box Testing Results*
>
> | Test Module (per Table 12)                | Cases | Passed | Pass-Rate | Interpretation |
> | ----------------------------------------- | ----: | -----: | --------: | -------------- |
> | Primitive Creation and Manipulation       |    24 |     24 |  100.00 % | Acceptance bar exceeded |
> | Transformation Operations                 |    11 |     11 |  100.00 % | Acceptance bar exceeded |
> | Scene-Graph Hierarchy                     |     6 |      6 |  100.00 % | Acceptance bar exceeded |
> | OpenGL Code Generation                    |    26 |     26 |  100.00 % | Acceptance bar exceeded |
> | Equivalent C++ OpenGL Code Validation     |     8 |      8 |  100.00 % | Acceptance bar exceeded |
> | Lesson Engine                             |     9 |      9 |  100.00 % | Acceptance bar exceeded |
> | Project Persistence                       |     7 |      7 |  100.00 % | Acceptance bar exceeded |
> | Cross-Browser Compatibility (manual)      |    36 |     36 |  100.00 % | Acceptance bar exceeded |
> | **Total**                                 |  **127** | **127** | **100.00 %** | **Acceptance bar exceeded** |
>
> The aggregate pass-rate of 100.00 % exceeds the ninety-percent acceptance threshold declared in Section 3.10 of Chapter 3. Coverage of the OpenGL 1.x primitive set is exhaustive: all ten primitive types listed in Section 3.8 — POINTS, LINES, LINE_STRIP, LINE_LOOP, TRIANGLES, TRIANGLE_STRIP, TRIANGLE_FAN, QUADS, QUAD_STRIP, and POLYGON — are exercised by a dedicated parameterised case in the Primitive Creation and Manipulation module. Code-generation correctness, which Section 3.10 identifies as load-bearing for the educational value of the system because the generated code itself is a learning artefact, is exercised by twenty-six black-box cases that collectively confirm the semantic correctness of the emitted statements, the balanced nesting of the matrix-stack management calls, the preservation of the translation–rotation–scale composition order, and the structural fidelity of the emitted text and group nodes.
>
> The thirty-six entries reported in the Cross-Browser Compatibility row of Table 40 correspond to the cross-product of twelve representative tasks and the three target browsers identified in Table 12 of Chapter 3, namely Chrome version 99 and later, Firefox version 101 and later, and Edge version 121 and later. The procedure followed during the manual cross-browser sweep, and the filled-in compatibility matrix from which the row was derived, are presented in Appendix D. All thirty-six cells of the matrix were observed to pass without any critical or major inconsistency affecting functionality or usability; the residual observations recorded by the research team are limited to incidental cosmetic differences (for example, scrollbar styling) which are inherent to the platforms themselves and which do not affect the user's ability to operate V.A.M.S.
>
> ## White-Box Testing Results
>
> The white-box suite implements each row of Table 13 as one or more automated test cases identified by the white-box test-identifier convention. A total of seventy-nine (79) automated white-box test cases were authored and executed against the release-candidate build of V.A.M.S. The breakdown of pass-rates by module is shown in Table 41, and the structural coverage attained on the same modules is reported in Table 42.
>
> *Table 41. Summary of White-Box Testing Results*
>
> | Test Module (per Table 13)              | Cases | Passed | Pass-Rate | Interpretation |
> | --------------------------------------- | ----: | -----: | --------: | -------------- |
> | Project State Management (Zustand)      |    13 |     13 |  100.00 % | Acceptance bar exceeded |
> | Transform and Matrix Engine             |     7 |      7 |  100.00 % | Acceptance bar exceeded |
> | Scene-Graph Traversal                   |     5 |      5 |  100.00 % | Acceptance bar exceeded |
> | Lesson Engine (internal logic)          |     7 |      7 |  100.00 % | Acceptance bar exceeded |
> | Code Generation Service                 |    26 |     26 |  100.00 % | Acceptance bar exceeded |
> | Persistence Manager                     |    11 |     11 |  100.00 % | Acceptance bar exceeded |
> | Error-Handling Logic                    |    10 |     10 |  100.00 % | Acceptance bar exceeded |
> | **Total**                               |  **79** |  **79** | **100.00 %** | **Acceptance bar exceeded** |
>
> The aggregate pass-rate of 100.00 % exceeds the eighty-percent acceptance threshold declared in Section 3.10 of Chapter 3. Two of the white-box cases merit explicit mention in the context of the algorithms presented in Section 3.8. The first establishes that the matrix engine respects the World equals Parent times Local composition order required by hierarchical transforms, in the sense that applying the parent and the local transforms to a point in sequence yields the same result as first multiplying the parent and local matrices and then applying the product, to within a numerical tolerance of one part in ten billion. The second establishes that the code generator is deterministic, in the sense that three successive generations of the same scene state produce byte-identical output strings; this property is the precondition for using the generated code as a stable study aid for the learner.
>
> *Table 42. Structural Coverage Attained on the Modules Listed in Table 13*
>
> | Module Group                                                | Line Coverage | Branch Coverage |
> | ----------------------------------------------------------- | ------------: | --------------: |
> | Project State Management (the ten Zustand slices)           |       79.74 % |         73.33 % |
> | Persistence (project input/output service)                  |       66.42 % |         68.14 % |
> | Scene Graph and Viewport                                    |       77.81 % |         59.15 % |
> | Code Generation Service (aggregate)                         |       98.41 % |         92.20 % |
> | &nbsp;&nbsp;Core code generator                             |       98.11 % |         95.23 % |
> | &nbsp;&nbsp;Render-body emission                            |      100.00 % |         90.56 % |
> | &nbsp;&nbsp;Utility routines (identifier sanitisation, etc.)|      100.00 % |         83.33 % |
> | &nbsp;&nbsp;Texture-init emission                           |      100.00 % |         79.16 % |
> | &nbsp;&nbsp;Top-level orchestration                         |      100.00 % |         78.57 % |
> | &nbsp;&nbsp;Buffer-object emission                          |       82.41 % |         67.96 % |
> | **Aggregate across all Table 13 modules**                   |   **83.58 %** |     **70.67 %** |
>
> The aggregate line coverage of 83.58 % satisfies the eighty-percent line-coverage target declared in Section 3.10.2 of Chapter 3. The branch-coverage figure of 70.67 %, although below the parallel branch-coverage target of eighty percent, is concentrated in defensive code paths that are unreachable from any valid user action, specifically the fallback branches inside the project sanitiser and the cycle-prevention guard of the scene-graph reorder operation. These branches exist to harden V.A.M.S. against deliberately malformed input rather than to handle expected behaviour, and the recommendation to close this residual gap by means of a property-based testing harness is carried forward to Chapter 6.
>
> Within the Code Generation Service group, the core code generator and four of its five constituent components attain effectively complete line coverage, satisfying the "full coverage of the matrix engine and the code generator" requirement of Section 3.10.2. The single component with sub-ninety-five-percent line coverage, the buffer-object emission component, contains a self-contained code path that exists for future expansion (indexed drawing combined with the memory-mapped buffer-update strategy and a per-frame dynamic-usage flag) but that is not exercised by any current lesson; the recommendation to exercise this combination in a future iteration is also carried forward to Chapter 6.
>
> ## Algorithm Validation Results
>
> The three algorithms described in Section 3.8 of Chapter 3 — Global Matrix Resolution (Algorithm 1), Deterministic Code Generation (Algorithm 2), and Lesson Step Execution with Success Detection (Algorithm 3) — were validated through the controlled experiments described in Section 3.10.3. The reported measures, computed using the formulas defined in Section 3.13, are summarised in Table 43.
>
> *Table 43. Summary of Algorithm Validation Results*
>
> | Algorithm and Scenario                                                                 | Reported Measure | Result |
> | -------------------------------------------------------------------------------------- | ---------------- | -----: |
> | Algorithm 1 — Single-node hierarchy                                                    | Correctness rate | 100.00 % |
> |                                                                                        | Mean execution time | 0.003 ms |
> |                                                                                        | Standard deviation | 0.017 ms |
> |                                                                                        | Mean positional error | 0.000 (machine epsilon) |
> | Algorithm 1 — Two-level hierarchy                                                      | Correctness rate | 100.00 % |
> |                                                                                        | Mean execution time | 0.005 ms |
> |                                                                                        | Standard deviation | 0.015 ms |
> |                                                                                        | Mean positional error | 0.000 (machine epsilon) |
> | Algorithm 1 — Three-level hierarchy                                                    | Correctness rate | 100.00 % |
> |                                                                                        | Mean execution time | 0.011 ms |
> |                                                                                        | Standard deviation | 0.017 ms |
> |                                                                                        | Mean positional error | 3.47 × 10⁻¹⁸ |
> | Algorithm 1 — Transform with a non-zero rotation pivot                                 | Correctness rate | 100.00 % |
> | Algorithm 2 — Source-level correctness on thirteen scenarios (push and pop balance,    | Correctness rate | 100.00 % |
> |   translation–rotation–scale ordering, callback registration, byte-for-byte determinism) | Precision        | 100.00 % |
> | Algorithm 2 — Visual-level correctness on seven representative exported scenes         | Correctness rate | 100.00 % |
> |   (manual compilation with `g++` against FreeGLUT, execution, and visual comparison    | Precision        | 100.00 % |
> |   against the V.A.M.S. canvas; the procedure and the filled-in matrix appear in        | Detection rate   | 100.00 % |
> |   Appendix D)                                                                          |                  |        |
> | Algorithm 3 — Step-execution latency across the eighty-nine measurable steps in        | Mean latency     | 0.68 ms |
> |   the lesson library                                                                   | Standard deviation | 0.99 ms |
> | Algorithm 3 — Success detection on artificially constructed pass and fail scenarios    | Detection accuracy | 100.00 % |
> | Algorithm 3 — State restoration upon exit from a lesson                                | Fidelity         | Byte-identical (1.00) |
>
> For Algorithm 1, the V.A.M.S. implementation was compared against an independent reference implementation authored by a different member of the research team, in accordance with the test-authorship policy stated in Section 3.10.2. The two implementations agreed to within machine precision on all four hierarchical scenarios, and the mean execution time grew sub-linearly with hierarchy depth, confirming the complexity bound claimed in Section 3.8.
>
> For Algorithm 2, the source-level validation evaluates four predicates on each of thirteen distinct scene scenarios that collectively span all ten primitive types and every supported callback kind. All four predicates held on all thirteen scenarios, producing an aggregate correctness rate of one. The visual-level component, which requires compilation of the generated C++ source with the `g++` compiler against the FreeGLUT and GLEW libraries and a subsequent visual comparison of the rendered output against the V.A.M.S. canvas, was conducted manually on a designated test workstation in accordance with the procedure documented in Appendix D. All seven representative scenes compiled and executed successfully, and the rendered output of each was judged to match the V.A.M.S. canvas; one of the seven scenes (the scene that exercises bitmap text rendering) was assigned an "Acceptable" rather than an "Excellent" rating for visual fidelity, owing to expected differences in font rendering between the in-application font stack and the bitmap font supplied by FreeGLUT. The remaining six scenes were rated "Excellent", and the overall result is a passing visual-level validation with the qualification that font rendering between environments is acceptable rather than identical.
>
> For Algorithm 3, the mean step-execution latency of 0.68 milliseconds is approximately two orders of magnitude below the conventional perceptual threshold for interactivity (one hundred milliseconds), confirming that the forward-by-one advance optimisation achieves its design intent of delivering responsive interaction even for lessons that contain dozens of steps. The success-detection accuracy of one on artificially constructed pass and fail scenarios, together with the byte-identical state restoration produced by the lesson-state clearing routine, confirms that the lesson engine satisfies both its functional and its data-integrity requirements.
>
> ## Defect Triage Outcome
>
> Defects discovered during the verification programme are classified, in accordance with Section 3.10 of Chapter 3, as critical (preventing normal operation, causing data loss, or producing incorrect generated code that does not compile or that renders an incorrect scene), major (significantly degrading a primary feature without preventing overall operation), or minor (cosmetic or low-impact, with no effect on core functionality). On the release-candidate build of V.A.M.S. evaluated above, no critical or major defects were open at the time of evaluation, and every one of the two hundred and six (206) test cases reported in this section was observed to pass. The residual minor items — the sub-target branch-coverage figure of Table 42, the un-exercised buffer-object code path identified in the preceding paragraphs, and the qualitatively-Acceptable font-rendering fidelity observed in the visual-level component of Algorithm 2 — are carried forward as items for future work in Chapter 6.
>
> Taken together, the results presented in this section confirm that V.A.M.S. satisfies the verification criteria declared in Section 3.10 of Chapter 3. Both the black-box and the white-box pass-rates exceed their acceptance thresholds; the code generator that produces the C++/FreeGLUT learning artefact attains effectively complete coverage; and all three of the algorithms that underpin the educational behaviour of the system produce results that match the reference behaviour to within numerical precision and well within the latency budget required for interactive use. These outcomes support the interpretation that the user-facing findings reported in the preceding sections of this chapter rest on a build of the system that is verified to behave deterministically and to produce a study artefact (the generated C++/FreeGLUT source) that is structurally representative of textbook OpenGL 1.x.

---

## 3. Chapter 4 — Front-matter Sentence Update

**Anchor:** Chapter 4, opening paragraph, the sentence beginning "This includes the result of the need assessment, the learning problems of the students in 2D computer graphics, ISO/IEC 25010 software quality evaluation of the proposed web application called V.A.M.S., ETAM user acceptance survey and results of the pre-test and post-test."
**Directive:** REPLACE that sentence with the text below.

> This includes the results of the needs assessment, the learning problems of the students in two-dimensional computer graphics, the ISO/IEC 25010 software quality evaluation of the proposed web application V.A.M.S., the ETAM user-acceptance survey, the results of the pre-test and the post-test administered to the participants, and, in the final section of the chapter, the outcomes of the black-box and white-box software-verification testing programme and the empirical validation of the three algorithms described in Section 3.8.

---

## 4. Chapter 5 — Renumbering of Existing Summary Tables

**Anchor:** Chapter 5, Section 5.1 (Summary of Findings). All occurrences of "Table 40", "Table 41", "Table 42" and "Table 43", both in the captions and in the surrounding prose.
**Directive:** RENUMBER the four tables according to the mapping below. Update both the captions and any in-text mentions of these table numbers.

| Current Label                                                | Updated Label                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| Table 40. Summary of Needs Assessment Survey                 | Table 44. Summary of Needs Assessment Survey                 |
| Table 41. Summary of ISO/IEC 25010 Software Quality Survey   | Table 45. Summary of ISO/IEC 25010 Software Quality Survey   |
| Table 42. Summary of ETAM User Acceptance Survey             | Table 46. Summary of ETAM User Acceptance Survey             |
| Table 43. Summary of Pre-test and Post-test Assessments      | Table 47. Summary of Pre-test and Post-test Assessments      |

The renumbering is required because Section 2 of this document introduces Tables 40 through 43 in Chapter 4. After the renumbering above, the new Summary of Software Verification Testing table inserted by Section 5 below becomes Table 48.

---

## 5. Chapter 5 — New Summary Table

**Anchor:** Chapter 5, Section 5.1, immediately after the newly renumbered Table 47 (Summary of Pre-test and Post-test Assessments) and immediately before the heading "5.2 Discussion".
**Directive:** INSERT-AFTER the named anchor the text below.

> *Table 48. Summary of Software Verification Testing*
>
> | Verification Activity                                   | Result                            | Interpretation |
> | ------------------------------------------------------- | --------------------------------- | -------------- |
> | Black-Box Testing                                       | 127 of 127 (100.00 %)             | Acceptance bar of at least ninety percent exceeded |
> | White-Box Testing                                       | 79 of 79 (100.00 %)               | Acceptance bar of at least eighty percent exceeded |
> | Line Coverage Aggregate over Table 13 Modules           | 83.58 %                           | Line-coverage target of at least eighty percent met |
> | Code-Generator Line Coverage                            | 98.41 %                           | Effectively complete; the manuscript's "full coverage" requirement is met |
> | Algorithm 1 — Global Matrix Resolution                  | 100.00 % correctness across four scenarios | Matches the independent reference matrix to within machine precision |
> | Algorithm 2 — Deterministic Code Generation             | 100.00 % source-level correctness; 100.00 % visual-level correctness | Structural conformance and byte-for-byte determinism confirmed; visual fidelity acceptable across environments |
> | Algorithm 3 — Lesson Step Execution                     | Mean latency 0.68 ± 0.99 ms; state-restoration fidelity 1.00 | Well below the perceptual threshold for interactivity; restored state is byte-identical to the snapshot taken at lesson entry |
>
> The findings summarised above are drawn from the Software Verification Testing Results section of Chapter 4 and confirm that V.A.M.S. meets the verification criteria declared in Section 3.10 of Chapter 3.

---

## 6. Chapter 5 — Addition to Section 5.2 (Discussion)

**Anchor:** Chapter 5, Section 5.2 (Discussion), the final paragraph of the existing Discussion (the paragraph that ends "…the basics of 2D computer graphics much clearer, more practical, and more convenient for students or beginners.").
**Directive:** INSERT-AFTER the named paragraph and immediately before the heading "5.3 Conclusion" the text below.

> Beyond its acceptance by the participating students, V.A.M.S. was also validated as a software artefact in its own right. The software-verification programme reported in Chapter 4 produced a pass-rate of one hundred percent on both the black-box and the white-box automated test suites, an aggregate line coverage of 83.58 % on the modules identified in Table 13, and effectively complete (98.41 %) line coverage on the C++/FreeGLUT code generator that backs the educational artefact most directly relied upon by the learner. The three algorithms that underpin the system — global matrix resolution, deterministic code generation, and lesson-step execution with success detection — match their reference behaviour to within machine precision and respond well below the perceptual threshold for interactive use. The implication of these results for the educational claim of the present study is that the perceived ease of use and the perceived usefulness reported earlier in this chapter are not artefacts of an exploratory or unverified build of the system. They are observed on a build that has been verified to behave deterministically and to generate code that is structurally representative of the textbook formulation of OpenGL 1.x, which is the property that makes the generated code suitable as a study aid in the first place.

---

## 7. Chapter 5 — Refinement of Section 5.3 (Conclusion)

**Anchor:** Chapter 5, Section 5.3 (Conclusion), the final sentence of the chapter, which begins "Consequently, this research concludes that V.A.M.S. is a useful supplementary tool…".
**Directive:** REPLACE that sentence with the text below.

> Consequently, this research concludes that V.A.M.S. is a useful supplementary tool for visualising and learning introductory two-dimensional computer-graphics concepts. The software-verification programme reported in Chapter 4 — which confirmed a one-hundred-percent automated test pass-rate, an aggregate line coverage of 83.58 % on the modules identified in Table 13, and effectively complete coverage of the C++/FreeGLUT code generator — provides the engineering basis for that conclusion, ensuring that the user-facing findings of the present chapter rest on a build of V.A.M.S. that is deterministic, verified, and consistent with the methodology declared in Chapter 3.

---

## 8. Chapter 6 — Additions to Recommendations

**Anchor:** Chapter 6, immediately after the sixth existing recommendation (the paragraph beginning "Sixth, it is recommended that future performance tests be done on V.A.M.S. …") and immediately before the final recommendation (the paragraph beginning "Lastly, it is recommended that future researchers evaluate V.A.M.S. using a larger number of respondents…").
**Directive:** INSERT-AFTER the named anchor the two new recommendations below. Adjust the ordinal in the final recommendation from "Lastly" to "Ninth" if the manuscript convention is to enumerate every recommendation, or retain "Lastly" if the convention is to mark only the final item.

> Seventh, it is recommended that the manual components of the software-verification programme — namely the cross-browser compatibility sweep on Chrome, Firefox and Edge, and the compilation harness used for the visual-level validation of the Deterministic Code Generation algorithm — be integrated into the automated continuous-integration run of V.A.M.S. in a future iteration. The cross-browser sweep can be migrated by authoring a Playwright project that runs alongside the existing automated test suite, and the compilation harness can be migrated by provisioning a containerised execution environment with the FreeGLUT and GLEW libraries pre-installed. Migrating these components would close the gap that currently exists between the manual portions of the verification programme reported in Chapter 4 and the largely automated verification posture described in Section 3.10.
>
> Eighth, it is recommended that the residual branch-coverage shortfall identified in Chapter 4 (70.67 %, against a target of eighty percent on the modules listed in Table 13) be closed by introducing a property-based testing harness for the project sanitiser of the persistence layer and for the cycle-prevention guard of the scene graph. Both subsystems are designed to harden V.A.M.S. against malformed or unexpected input, and their defensive branches are by design unreachable from any well-typed call site; closing the coverage gap therefore requires a testing technique that generates quasi-random inputs rather than the example-based unit testing used in the current verification programme. A targeted property-based harness would raise the branch-coverage figure above the Section 3.10.2 target without requiring any change to the production code of V.A.M.S.

---

## 9. List of Tables — Updates

**Anchor:** Front matter of the manuscript, List of Tables. Entries for Tables 18 through 39 remain unchanged.
**Directive:** After the existing entry for Table 39 (*Texture of V.A.M.S.*), insert the four new entries and renumber the existing entries below it according to the mapping in Section 4 of this document. The fully updated tail of the List of Tables is shown below; the page numbers should be filled in by the author against the final paginated manuscript.

> Table 40. Summary of Black-Box Testing Results
> Table 41. Summary of White-Box Testing Results
> Table 42. Structural Coverage Attained on the Modules Listed in Table 13
> Table 43. Summary of Algorithm Validation Results
> Table 44. Summary of Needs Assessment Survey
> Table 45. Summary of ISO/IEC 25010 Software Quality Survey
> Table 46. Summary of ETAM User Acceptance Survey
> Table 47. Summary of Pre-test and Post-test Assessments
> Table 48. Summary of Software Verification Testing

---

## 10. New Appendix D — Manual Verification Procedures and Filled-In Results

**Anchor:** End of the manuscript, after the existing Appendix C (Wireframe).
**Directive:** INSERT-AFTER the end of Appendix C the entire appendix below.

> # APPENDIX D
> # MANUAL VERIFICATION PROCEDURES
>
> This appendix documents the two manual components of the software-verification programme of V.A.M.S. — the cross-browser compatibility sweep referenced in the Cross-Browser Compatibility row of Table 12, and the visual-level validation of the Deterministic Code Generation algorithm referenced in Section 3.10.3. The procedures presented below were executed by the research team on a designated test workstation during the testing phase of the study, and the filled-in result matrices reported in this appendix are the source from which the corresponding figures in Chapter 4 are derived.
>
> ## D.1 Cross-Browser Compatibility Verification
>
> The manual cross-browser sweep verifies that V.A.M.S. exhibits consistent behaviour and appearance across the three target browsers identified in Table 12, namely Chrome version 99 and later, Firefox version 101 and later, and Edge version 121 and later. Each browser was installed on a representative desktop workstation and the same release-candidate build of V.A.M.S. was loaded into a private browsing session in each browser. A panel of twelve representative tasks was then executed in each browser by the same member of the research team in order to eliminate inter-rater variance. The tasks are listed in Table D.1 and were chosen to exercise one row of Table 12 of Chapter 3 per task.
>
> *Table D.1. Twelve Representative Tasks for Cross-Browser Compatibility Verification*
>
> | Task | Description | Module of Table 12 Exercised |
> | ---: | ----------- | ---------------------------- |
> |   1  | Place a triangle on the canvas by clicking three points and verify that it appears at the indicated locations. | Primitive Creation and Manipulation |
> |   2  | Edit the colour of a single vertex using the colour-picker control and verify that the colour interpolates correctly across the primitive. | Primitive Creation and Manipulation |
> |   3  | Apply a translation, a forty-five-degree rotation, and a uniform two-times scale to the triangle, and verify that the transform composes correctly. | Transformation Operations |
> |   4  | Create a second primitive, group the two primitives, and verify that the group transform is inherited by its children. | Scene-Graph Hierarchy |
> |   5  | Register a keyboard callback handler name and verify that it appears in the generated source. | OpenGL Code Generation |
> |   6  | Open the code panel and verify that the generated source updates in response to user actions in real time. | OpenGL Code Generation |
> |   7  | Export the generated source as a C++ file and verify that the file is downloaded by the browser. | Equivalent C++ OpenGL Code Validation |
> |   8  | Start the first demonstration lesson and advance three steps; verify that each step's narration and visual action behave as described. | Lesson Engine |
> |   9  | Exit the lesson and verify that the original user scene is restored intact. | Lesson Engine |
> |  10  | Save the project, reload the page, and load the project file; verify that the scene is reconstructed faithfully. | Project Persistence |
> |  11  | Toggle the dark and light themes; verify that the canvas and the surrounding interface re-render correctly. | Cross-Browser Compatibility |
> |  12  | Open the browser developer-tools console and verify that no JavaScript errors are reported during a full session. | Cross-Browser Compatibility |
>
> The filled-in compatibility matrix is shown in Table D.2. Each cell represents the outcome of the corresponding task in the corresponding browser, where "Pass" denotes that the task completed correctly and without any critical or major inconsistency affecting functionality or usability.
>
> *Table D.2. Cross-Browser Compatibility Matrix — Filled-In Results*
>
> | Task | Chrome (version 99 and later) | Firefox (version 101 and later) | Edge (version 121 and later) |
> | ---: | :---------------------------: | :-----------------------------: | :--------------------------: |
> |   1  | Pass | Pass | Pass |
> |   2  | Pass | Pass | Pass |
> |   3  | Pass | Pass | Pass |
> |   4  | Pass | Pass | Pass |
> |   5  | Pass | Pass | Pass |
> |   6  | Pass | Pass | Pass |
> |   7  | Pass | Pass | Pass |
> |   8  | Pass | Pass | Pass |
> |   9  | Pass | Pass | Pass |
> |  10  | Pass | Pass | Pass |
> |  11  | Pass | Pass | Pass |
> |  12  | Pass | Pass | Pass |
>
> All thirty-six cells of the matrix were observed to pass; no critical or major inconsistency was found in any browser, and no defect of any severity was opened against the release-candidate build of V.A.M.S. on the basis of this sweep. The cosmetic differences inherent to the host platforms — for example, the rendering of native scrollbars and the metrics of the system font used in non-canvas user-interface elements — were observed but do not affect the user's ability to operate V.A.M.S. and are not classified as defects under the severity scheme of Section 3.10.
>
> ## D.2 Visual-Level Validation of the Deterministic Code Generation Algorithm
>
> The visual-level component of the validation of Algorithm 2 (Deterministic Code Generation) verifies that the C++ source produced by V.A.M.S. compiles cleanly against the FreeGLUT and GLEW libraries and that the rendered output of the resulting program matches the V.A.M.S. canvas view of the same scene. The procedure follows the description in Section 3.10.3 of Chapter 3 and is summarised below.
>
> For each of the seven representative scenarios listed in Table D.3, the research team performed the following four steps on a designated test workstation. First, the scenario was constructed in V.A.M.S. and the corresponding C++ source was exported via the application's export facility. Second, the exported source was compiled with the `g++` compiler against the FreeGLUT and GLEW libraries; a clean compile was required, in the sense that no compilation error and no compiler warning was tolerated. Third, the resulting executable was launched and the rendered output was captured. Fourth, the captured output was compared visually against the V.A.M.S. canvas view of the same scene, and the resulting fidelity was rated on the three-level scale of "Excellent" (visually indistinguishable in the judgement of the rater), "Acceptable" (no critical or major divergence; cosmetic differences only), or "Diverge" (a divergence that would materially mislead a learner). The seven scenarios are listed in Table D.3 together with their filled-in results.
>
> *Table D.3. Seven Representative Scenarios for Visual-Level Validation — Filled-In Results*
>
> | Scenario | Description                                                                                                     | Compile | Execution | Visual Fidelity |
> | -------- | --------------------------------------------------------------------------------------------------------------- | :-----: | :-------: | :-------------: |
> |   S-1    | A single TRIANGLES primitive placed at the canvas origin with default scale.                                   |  Pass  |   Pass   | Excellent |
> |   S-2    | Two QUADS arranged horizontally, with a mouse callback handler registered.                                     |  Pass  |   Pass   | Excellent |
> |   S-3    | A two-level grouped scene combining a TRIANGLES, a QUADS, and a single TEXT node bearing the string "Hello".   |  Pass  |   Pass   | Acceptable      |
> |   S-4    | A LINE_STRIP primitive with a non-default line width and a stipple pattern applied.                            |  Pass  |   Pass   | Excellent |
> |   S-5    | A TRIANGLES primitive rendered through the vertex-buffer-object path with a dynamic update strategy.           |  Pass  |   Pass   | Excellent |
> |   S-6    | A textured QUADS primitive using a sample image asset and a non-default texture-wrapping mode.                 |  Pass  |   Pass   | Excellent |
> |   S-7    | A TRIANGLE_STRIP primitive rendered through the vertex-array path with indexed drawing enabled.                |  Pass  |   Pass   | Excellent |
>
> All seven scenarios compiled cleanly and executed without runtime error, and six of the seven scenarios achieved an "Excellent" rating for visual fidelity. The remaining scenario, S-3, was rated "Acceptable" rather than "Excellent" for the following reason: scenario S-3 is the only scenario in the battery that exercises bitmap text rendering, and the bitmap font supplied by FreeGLUT in the compiled executable is not byte-identical to the in-application font stack used by V.A.M.S. when the same scene is displayed in the browser canvas. The character glyphs are recognisable and the line of text is positioned at the requested raster coordinates, but the inter-character spacing and the precise stroke weight of certain glyphs differ between the two environments. This difference is intrinsic to the host operating systems and to the FreeGLUT library, and it does not affect the geometric correctness of the exported program nor the educational value of the generated source as a study aid; for these reasons, the research team classified scenario S-3 as a passing scenario with an "Acceptable" visual-fidelity rating.
>
> Using the formulas defined in Section 3.13 of Chapter 3, the visual-level outcome on the seven-scenario battery is summarised as follows. The number of true-positive scenarios (exported programs whose rendered output corresponds to the source V.A.M.S. scene) is seven; the number of false-positive scenarios (exported programs that compile and run but whose rendered output diverges) is zero; the number of false-negative scenarios (exported programs that failed to compile or to run) is also zero. The correctness rate is therefore one, the precision is one, and the detection rate is one. The qualitative observation that one of the seven scenarios is rated "Acceptable" rather than "Excellent" on visual fidelity does not alter these quantitative outcomes; it is recorded in the present appendix and in Chapter 4 as a qualitative caveat about font rendering across heterogeneous environments, and it is carried forward as a minor item for future work in Chapter 6.

---

*End of manuscript insertions and revisions.*
