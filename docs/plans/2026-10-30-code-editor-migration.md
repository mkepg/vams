# The code panel on CodeMirror 6: implementation plan

**Goal:** The editor's code panel and the phone scene view draw generated C++ with CodeMirror 6 in read-only mode, with every current behaviour kept, through a shared module the Lab will reuse.

**Architecture:** A new `src/shared/ui/code-editor/` module holds the CodeMirror setup: language, highlight style, GL-name decoration and theme. `CodeViewer` keeps its props and its Preact header, strip and hint. Its code area becomes one `EditorView`, fed from props through a `StateField` of decorations: fold and "more" rows and notes as block widgets, the ▾ toggles in a gutter, and marks, Find matches, the fired branch and explainable lines as mark and line decorations.

**Tech stack:** CodeMirror 6 (`@codemirror/state`, `@codemirror/view`, `@codemirror/language`, `@codemirror/lang-cpp`, `@lezer/highlight`), Preact, Vitest + happy-dom, Playwright.

**Spec:** [docs/specs/2026-10-30-code-editor-migration-design.md](../specs/2026-10-30-code-editor-migration-design.md)

## Global constraints

- AGENTS.md applies throughout:
  - FSD imports through `@/`, and `shared` imports nothing above it;
  - SCSS on `_tokens.scss` in both themes;
  - CRLF files;
  - British student-facing text;
  - stable test IDs.
- The code panel never accepts an edit: `EditorState.readOnly.of(true)`, and no paste or drop changes the document.
- `CodeViewerProps` in `src/shared/ui/code-viewer/CodeViewer.tsx` does not change. `SceneCodePanel.tsx` and `SceneViewApp.tsx` stay untouched.
- Class names the styles and tests rely on stay the same:
  - `code-viewer-container`, `code-header`, `code-word`, `code-search`, `code-search__count`, `code-strip*`, `code-hint`, `code-live`;
  - `code-fold`, `code-fold__label`, `code-fold__summary`, `code-fold-toggle`;
  - `code-note*`, `code-value`, `code-find`, `is-current`, `is-fired`, `is-fired--again`, `is-explainable`, `is-explained`, `is-changed`;
  - `tk-comment`, `tk-glfn`.
- `tokenize.ts`, `reveal-scroll.ts` and `types.ts` stay. `value-diff.ts` and `CodeBlankWidget.tsx` keep using `tokenizeLine`.
- The editor chunk grows by at most about 120 KB gzipped. Measure it with `npm run build` before and after.

## Review focus

1. A fold opened or closed while the cursor sits inside it: the cursor must land on a visible line, and Enter must not explain a hidden one.
2. Find's current match inside a folded block: the parent opens the fold (`onFindLine`), and the match then scrolls into view and shows as current.
3. The fade on a changed value restarting on two edits in a row to the same value range.
4. The theme switching while the panel is open: colours come from CSS variables, so nothing in the view should need rebuilding.
5. Rapid prop changes during Run (fired branch every frame): decorations update without remounting the view or losing the scroll position.

---

### Task 1: The shared CodeMirror module

**Files:**
- Create:
  - `src/shared/ui/code-editor/index.ts`
  - `src/shared/ui/code-editor/gl-names.ts`
  - `src/shared/ui/code-editor/extensions.ts`
  - `src/shared/ui/code-editor/code-editor.scss`
- Modify: `package.json` and `package-lock.json`, through `npm install`
- Test: `tests/black-box/code-panel.test.ts`, new `BB-CODE-40`

**Produces:**
- `glNameRanges(line: string): Array<{ from: number; to: number }>`: the GL and GLUT call names in one line, by the tokenizer's rule. Use `tokenizeLine`, keeping tokens of kind `glfn`.
- `cppLanguage(): Extension`: `cpp()` from lang-cpp.
- `vamsHighlight(): Extension`: a `HighlightStyle` mapping `tags.comment`, `tags.lineComment` and `tags.blockComment` to class `tk-comment`. Nothing else is coloured.
- `glNameDecorations(): Extension`: a `ViewPlugin` that marks `glNameRanges` in the visible lines with class `tk-glfn`.
- `vamsEditorTheme(): Extension`: an `EditorView.theme` using only CSS variables (`--font-mono`, `--ink`, `--line-number` and the rest), so the theme switches by CSS alone.
- `readOnlyCode(): Extension[]`: `EditorState.readOnly.of(true)` and `EditorView.editable.of(true)` (focusable, so the cursor moves), plus `EditorView.contentAttributes.of({ 'aria-label': 'Generated C++ code', 'aria-readonly': 'true' })`.

- [ ] **Step 1: Install.** Run `npm install @codemirror/state @codemirror/view @codemirror/language @codemirror/lang-cpp @lezer/highlight`. Expected: `package.json` lists the five packages.
- [ ] **Step 2: Write BB-CODE-40, the GL colouring matches the tokenizer.** For every line of `currentProgram()` (the existing helper) after `mockScene()`, the text covered by `glNameRanges(line)` equals the `glfn` tokens of `tokenizeLine(line)`, in order. Also check that `glNameRanges('glBegin(GL_TRIANGLES); // glEnd')` covers `glBegin` only before the comment, and that `glutSwapBuffers()` is covered.
- [ ] **Step 3: Run it.** `npx vitest run tests/black-box/code-panel.test.ts -t BB-CODE-40`. Expected: FAIL, because the module does not exist yet.
- [ ] **Step 4: Implement the module.** Comment bodies must not get GL marks: skip ranges at or after the first `//` outside a string, as the tokenizer does.
- [ ] **Step 5: Run it.** Expected: PASS.
- [ ] **Step 6: Commit** `feat(code): shared CodeMirror setup for generated C++`.

### Task 2: CodeViewer on CodeMirror

**Files:**
- Modify:
  - `src/shared/ui/code-viewer/CodeViewer.tsx`
  - `src/shared/ui/code-viewer/code-viewer.scss`
- Create: `src/shared/ui/code-viewer/cm-decorations.ts`, which builds the decoration set from props
- Test, in place with the same IDs:
  - `tests/black-box/code-panel.test.ts`;
  - the suites that read code markup: `editor-shell`, `lesson-column`, `first-visit-tour`, `run-mode`, `editor-inspector`, `math-journey` (all `.test.ts` under `tests/black-box/`) and `tests/white-box/code-structure.test.ts`.

**Consumes:** Task 1's exports.

**Produces:**
- `buildDecorations(input: ViewerDecorationInput, doc: Text): { blocks: DecorationSet; marks: DecorationSet }`, in `cm-decorations.ts`. `ViewerDecorationInput` holds:
  - `rows`, `marks`, `marksKey`, `matches`, `currentMatch`;
  - `fired`, `firedSeq`, `explainable`, `explainedLine`;
  - `notes`, `notesOn`, `changedLines`;
  - the callbacks the widgets call: `onToggleFold`, from a fold's button and a ▾.
- `lineSegments` stays exported from `CodeViewer.tsx`, because BB-CODE tests use it, until no test needs it. Then it is removed with its tests rewritten. The implementer's choice, recorded in the report.

Behaviour to keep, mapped to tests:
- Folds and ▾: BB-CODE-03, 13, 16, 35–39.
- Marks: BB-CODE-04, 11, 12, 14, 18, 33.
- Find: BB-CODE-05, 16.
- Copy: BB-CODE-06.
- Fired branch: BB-CODE-07, 17.
- Explain and strip: BB-CODE-19, 22, 23, 26, 27, 31, 32, 34.
- Notes: BB-CODE-21.

Keyboard model (spec decision 7), replacing the old per-line buttons:

- **BB-CODE-20, rewritten:** the content element is focused. Arrow Down moves the cursor one line. With the strip open, landing on an explainable line explains it. Landing on a brace or a blank line keeps the strip on the last explainable line.
- **BB-CODE-24, rewritten:** the code content is the single tab stop. `aria-controls` names the strip while it is open.
- **BB-CODE-25, rewritten:** Enter and Space each explain the cursor's line.
- **BB-CODE-26:** the close button returns focus to the content element, with the cursor on the explained line.

New tests:
- **BB-CODE-41:** the view is read-only. Dispatching an input transaction, or a paste event with text, leaves the document equal to `code`.
- **BB-CODE-42:** a click on a folded block's button opens it without moving the cursor into hidden text. With the cursor inside a block that then folds, the cursor ends on the fold row's line or above it, and Enter explains nothing hidden.

- [ ] **Step 1: Rewrite the BB-CODE tests that read the old markup, and add BB-CODE-41 and BB-CODE-42.**
  - Lines are read from `.cm-line` (or `view.state.doc` through a test hook on the container, `data-testid="code-view"`, and `EditorView.findFromDOM`).
  - `lineTexts()` keeps returning the visible line texts, top to bottom.
- [ ] **Step 2: Run them.** `npx vitest run tests/black-box/code-panel.test.ts`. Expected: the rewritten and new tests fail against the old viewer.
- [ ] **Step 3: Replace the line rendering in `CodeViewer` with one `EditorView`.**
  - The view is created once per mount in a layout effect.
  - Props reach it through a `StateEffect` that replaces the decoration input. The document is replaced in the same transaction only when `code` changes.
  - Scrolling keeps the `reveal-scroll.ts` rules, measured with `view.lineBlockAt(view.state.doc.line(n + 1).from)` and `view.scrollDOM`.
- [ ] **Step 4: Run** `npx vitest run tests/black-box/code-panel.test.ts`. Expected: every BB-CODE test passes.
- [ ] **Step 5: Update the other suites' selectors.** Run `npx vitest run`. Expected: every test passes.
- [ ] **Step 6: Run** `npm run lint` and `npm run build`. Expected: both clean. Record the editor chunk's gzipped size before and after in the report.
- [ ] **Step 7: Commit** `feat(code): the code panel draws with CodeMirror, read-only, with folds, marks, notes and explanations kept`.

### Task 3: Visual parity, the phone view and the docs

**Files:**
- Modify:
  - `src/shared/ui/code-viewer/code-viewer.scss`, for any parity fixes;
  - `docs/specs/2026-10-04-website-overhaul-roadmap.md`;
  - `tests/README.md`, if suite contents changed.
- Test: `npm run test:visual`.

- [ ] **Step 1: Run** `npx playwright test tests/visual/code-math.spec.ts tests/visual/editor.spec.ts`. For every code capture that differs, compare the actual image with the baseline. Fix the CSS until only anti-aliasing and the text cursor's absence remain. Known allowed difference: none, because the cursor is hidden at rest.
- [ ] **Step 2: Open `/app?scene=jeepney-street` on a 390 px viewport** (the phone scene view) and check its code reads as before.
- [ ] **Step 3: Re-record only the captures whose remaining difference is anti-aliasing.** `npx playwright test <spec> --update-snapshots`, then run the whole visual suite. Expected: all pass.
- [ ] **Step 4: Add a paragraph to the roadmap** under its status notes. It says the code panel draws with CodeMirror 6, read-only, with every behaviour kept, as the first half of the move to one code editor shared with the Lab.
- [ ] **Step 5:** Run lint, build and `npm test`, then `git checkout -- tests/reports`. Commit `docs: record the code panel's move to CodeMirror`.
