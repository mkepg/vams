# Chapter 3 — Revision Notes (§3.10 Testing Methods)

This document lists small revisions that should be applied to Chapter 3 so
that what is *written* in the manuscript matches what is *actually built* in
the test suite. Each note specifies:

* the existing manuscript text (verbatim, abbreviated where unambiguous);
* the proposed change; and
* the reason.

> **All references below are to the compiled PDF
> `Humanized 3rd Sem Compiled Chapters 1-4.pdf` and to the codebase as of
> the commit that introduced the `tests/` tree.**

---

## R-1 — §3.10.2 (Table 13 introduction) — "9 slices" → "10 slices"

* **Manuscript text (Table 13, "Project State Management" row):**
  > *"Verification of CRUD operations across the 9 slices …"*

* **Codebase reality.** `src/core/store/index.ts` composes ten slices:
  `sceneSlice`, `interactionSlice`, `viewportSlice`, `settingsSlice`,
  `customShapeBuilderSlice`, `historySlice`, `runtimeSlice`, `lessonSlice`,
  `callbacksSlice`, and `textureSlice`.

* **Proposed change.** Replace "**the 9 slices**" with "**the 10 slices**".

* **Reason.** The texture slice was added during Stage 5 (textures &
  UVs) and is now persisted alongside the other nine. Tests `WB-STATE-05`
  and `WB-PERSIST-04` assume the 10-slice topology.

---

## R-2 — §3.10.2 (Vitest + Playwright sentence) — explicit scope clarification

* **Manuscript text:**
  > *"Unit tests are written using Vitest … high-priority browser-level
  > scenarios are automated through a Playwright-compatible runner."*

* **Proposed change.** Add a short footnote (or a parenthetical) after the
  Playwright clause:
  > *"At the time of writing, Playwright scenarios are executed manually
  > using the procedure in Appendix [X]; integration of Playwright into the
  > continuous test run is planned in §5.2 (Recommendations)."*

* **Reason.** The current test runner is Vitest in `happy-dom`. Playwright
  is not part of `npm test`; promising "browser-level scenarios" without
  this caveat would over-state the automation. The manual procedure
  exists in `tests/reports/manual-cross-browser-procedure.md`.

---

## R-3 — §3.10.3 (Algorithm 2, visual-level validation) — toolchain footnote

* **Manuscript text:**
  > *"At the visual level, the generated program is compiled with g++ and
  > FreeGLUT, executed, and its rendered output is compared against the
  > V.A.M.S. on-screen scene."*

* **Proposed change.** Insert at the end of this sentence:
  > *"This step is performed manually following the procedure in
  > Appendix [X] / `tests/reports/manual-compile-procedure.md`; the
  > resulting correctness, precision and detection rates are reported in
  > §4.4.3."*

* **Reason.** The compilation step depends on a local g++/FreeGLUT/GLEW
  toolchain that is not assumed to be present on the CI machine. Pointing
  the reader at the manual procedure prevents misreading the line as
  describing an automated check.

---

## R-4 — §3.10 (Defect-severity sentence) — code-generator definition

* **Manuscript text:**
  > *"… critical (a defect that prevents normal operation, causes data
  > loss, or produces incorrect generated code that does not compile or
  > that renders an incorrect scene) …"*

* **Proposed change.** No textual change. Add a forward reference at the
  end of the bracketed list:
  > *"… (see §4.5 Defect Triage)."*

* **Reason.** Lets readers jump straight to the empirical triage section
  in Chapter 4 (which is created by `chapter-4-testing-results.md`).

---

## R-5 — §3.10.2 (coverage targets) — branch-coverage caveat

* **Manuscript text:**
  > *"… the project target is at least 80 percent line and branch coverage
  > on the modules listed in Table 13, with full coverage of the matrix
  > engine and the code generator …"*

* **Proposed change.** No revision to the target itself; instead, **leave
  the target unchanged** and rely on §4.5 to document that branch coverage
  fell short due to defensive paths. Alternatively, soften "and branch"
  to "and (where reachable) branch", but this is optional.

* **Reason.** The 80 % branch target is aspirational and academically
  defensible. The empirical 70.67 % branch figure is honestly reported in
  Chapter 4 with the reason; lowering the Chapter 3 target would
  weaken the manuscript's verification posture.

---

## R-6 — Tables 12 / 13 — citation to mnemonic test IDs

* **Proposed addition.** At the *end* of the paragraph that introduces
  Table 12 (and again for Table 13), add a parenthetical sentence:

  > *"Each row of the table is realised by one or more test files in the
  > `tests/black-box/` (respectively `tests/white-box/`) directory of the
  > source repository, with stable test identifiers of the form
  > `BB-{MODULE}-{NN}` (respectively `WB-{MODULE}-{NN}`); these
  > identifiers are quoted directly in §4.2 and §4.3 of the results
  > chapter."*

* **Reason.** Makes the Chapter 4 results trivially auditable against
  Chapter 3's plan. Without this paragraph the connection between
  e.g. "Table 12 row 4" and "`BB-GEN-04`" must be inferred.

---

## R-7 — §3.10.2 (test-authorship policy) — small phrasing tightening

* **Manuscript text:**
  > *"those who were part of creating the software do not participate in
  > creating test cases for individual components."*

* **Proposed change.** Reduce to:
  > *"the engineer who principally implemented a module does not author
  > the cases for that module, although they may participate in
  > test-case design discussion."*

* **Reason.** The earlier sentence in the same paragraph already says
  this clearly; the second restatement is mildly contradictory ("does
  not participate in creating" vs. "may participate in test-case design
  discussion" earlier). Removing the duplication cleans the paragraph.

---

## R-8 (optional) — Cross-link from §3.10 to the test directory layout

* **Proposed addition.** A single footnote at the start of §3.10:

  > *"The full directory layout of the automated test suite is
  > documented in `tests/README.md`."*

* **Reason.** Trivially helps the external reviewer follow the
  implementation. Only worth adding if the manuscript convention allows
  footnotes pointing at source files.

---

### What is **not** revised

The following statements in §3.10 are already accurate against the
codebase and require no change:

* The Vitest + happy-dom unit-test toolchain (R-2 only adds context for
  Playwright).
* The defect-severity scheme (critical / major / minor).
* The list of algorithms and their evaluation measures in §3.10.3.
* The acceptance bar of 90 % black-box / 80 % white-box pass — both are
  comfortably exceeded.
* The Table 12 module names (all eight rows match real test files).
* The Table 13 module names (all seven rows match real test files;
  "9 slices" → "10 slices" is the only edit).
