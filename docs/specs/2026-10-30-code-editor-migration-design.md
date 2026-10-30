# The code panel on CodeMirror 6

## Intent

The owner asked on 2026-10-30 for VAMS to move to a third-party code editor, in the Lab and in the VAMS editor's code panel. Today the code panel is a hand-built viewer (`src/shared/ui/code-viewer/CodeViewer.tsx`, about 500 lines) that draws every line as its own element and colours it with a small tokenizer. The Lab ([design](2026-10-28-vams-lab-design.md)) already chose CodeMirror 6 for its editor. Building both on one editor means one set of colours, one keyboard model and one accessibility story across the site.

The code panel keeps every product rule. It stays read-only, and its text is still a pure function of scene state (`features/code-generation`). The student still never types OpenGL code in the editor. CodeMirror is used here as a viewer.

## Goals

- The code panel and the phone scene view draw their code with CodeMirror 6, in read-only mode.
- Everything the panel does today still works and looks the same in both themes:
  - focused folding, with a fold row's ▸ and summary, a "more" row, and a ▾ that folds an open block;
  - changed values marked in amber, with the fade restarting on each edit;
  - Run's fired branch flashing, with the scroll that brings it into view;
  - a new selection bringing its lines into view;
  - a lesson's highlighted lines opening their fold and scrolling into view;
  - Find, with its count and stepping, opening the fold around the current match;
  - Copy giving the whole program, however much is folded;
  - clicking a line to explain it in the strip, with the links to the math and to the control;
  - notes under the key lines;
  - the two syntax colours (GL calls and comments) and everything else in ink.
- One shared module holds the CodeMirror setup (language, colours, theme, GL-name colouring), so the Lab's editor builds on it.
- The code is readable by keyboard and screen reader as text. Today each explainable line is a button, and the rest of the code is out of reach of the keyboard.

## Non-goals

- Editing in the code panel. The panel never accepts typing, paste or drop.
- Changing what the generator emits, the fold model in `code-folds.ts`, the explanations, or the notes.
- The Lab page itself. It follows in its own plan and reuses the shared module.

## Anti-goals

- The code panel shows a cursor that suggests the student can type, or accepts a keystroke that changes the text.
- A visual difference a student would notice on stage on Nov 10, beyond the text becoming selectable.
- The editor's first load grows by more than about 120 KB gzipped.

## Decisions (made on the owner's behalf, who delegated them on 2026-10-30)

1. **CodeMirror 6.** It was already the Lab's choice for its smaller bundle and better accessibility than Monaco. Packages: `@codemirror/state`, `@codemirror/view`, `@codemirror/language`, `@codemirror/lang-cpp` and `@lezer/highlight`. The Lab adds `@codemirror/commands`, `@codemirror/autocomplete` and `@codemirror/lint` when it needs them.
2. **The same `CodeViewer` props.** `SceneCodePanel` and `SceneViewApp` do not change. Only the inside of `CodeViewer` moves to CodeMirror. The header (Notes, Find, Copy), the explanation strip and the hint stay as Preact markup outside the editor.
3. **Folding is drawn from the existing rows.** `visibleRows()` still decides what is open. Each `fold` and `more` row becomes a block widget that replaces its lines and holds the same `<button class="code-fold">`. Each line whose row `closes` a block gets the ▾ button as an inline widget at the line's start, drawn in the fold column beside the line numbers; it is not a gutter, because CodeMirror hides its gutters from assistive tech. CodeMirror's own fold service is not used, so the store keeps owning which folds are open.
4. **Highlighting:**
   - `lang-cpp` parses the code.
   - A highlight style colours comments only.
   - A decoration colours GL and GLUT calls with the same rule the tokenizer uses, because the grammar does not know which names are OpenGL's.
   - The classes stay `tk-comment` and `tk-glfn`, so BB-CODE-08's two-colour rule and the token values in `_tokens.scss` hold.
   - `tokenize.ts` stays, for the value diff and the lesson fill-in widget.
5. **Marks, Find matches, the fired branch and explainable lines are decorations,** rebuilt from props. They use the existing classes (`code-value`, `code-find`, `is-current`, `is-fired`, `is-explainable`, `is-explained`, `is-changed`). The fade restarts on a new `marksKey` because the mark's class alternates between two names with identical keyframes, so CodeMirror redraws it.
6. **Notes are block widgets** under their lines, with the same markup and classes as now.
7. **The keyboard model:**
   - The code is one tab stop: CodeMirror's content element, read-only with a visible cursor that moves but types nothing.
   - Up and Down move line by line through all the code.
   - Enter or Space explains the cursor's line when it can be explained.
   - While the strip is open, moving onto an explainable line explains that line, as the arrow keys do today.
   - Escape closes the strip and leaves the cursor where it was. Escape is handled before CodeMirror sees it.
   - Clicking a line puts the cursor there and explains it, as a click does today.
   - The fold buttons stay real buttons, reached by Tab after the code, with the same labels and `aria-expanded`.
   - The content element has an accessible name ("Generated C++ code") and `aria-describedby` pointing at the hint.
   - A screen reader hears the strip through the live region that is always mounted, as now.
8. **Scrolling:** the reveal and follow rules in `reveal-scroll.ts` stay. They measure lines with `view.lineBlockAt()` and scroll `view.scrollDOM`.
9. **The cursor** is drawn only while the code has focus, in the line-number colour, so the panel at rest looks as it does today.
10. **Lesson mode** hides Find as now. Copy and Notes stay.

## Tests

- BB-CODE-01 to BB-CODE-39 keep their IDs and what they check. Where a test reads the old markup (each line a `.code-line` element with `role="button"`), it reads the CodeMirror lines (`.cm-line`) or the view's state instead. Tests whose model changes (BB-CODE-20 arrow keys, BB-CODE-24 tab stop, BB-CODE-25 Enter and Space) check the new keyboard model above.
- New tests:
  - the panel rejects typing and paste;
  - Copy and Find work through the shared module;
  - the shared module's GL colouring matches the tokenizer on every line of a generated program.
- Other suites that read the code panel's markup (editor shell, lesson column, tour, run mode, inspector, math journey, the white-box code-structure test) are updated in the same way.
- The visual suite's code captures (VIS-CM-01 and VIS-CM-04, the editor captures that show code) are re-recorded after a side-by-side check against the current baselines. Differences beyond anti-aliasing are fixed, not re-recorded.
- lint, build and `npm test` pass.

## Left to the builder

- Module layout inside `src/shared/ui/code-editor/`.
- How decorations are fed from props (a `StateField` with effects, or a compartment reconfigured on each change).
- Exact CSS for CodeMirror's own elements, within the tokens in `_tokens.scss`.
