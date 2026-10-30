import { EditorState, RangeSetBuilder, Transaction, type Extension } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { cpp } from '@codemirror/lang-cpp';
import { tags } from '@lezer/highlight';
import { glNameRanges } from './gl-names';

/** The C++ grammar. It shapes the text; the colours come from the two rules below. */
export function cppLanguage(): Extension {
  return cpp();
}

/** Comments are the only thing the grammar colours. Everything else stays in ink. */
export function vamsHighlight(): Extension {
  return syntaxHighlighting(
    HighlightStyle.define([{ tag: [tags.comment, tags.lineComment, tags.blockComment], class: 'tk-comment' }]),
  );
}

const glName = Decoration.mark({ class: 'tk-glfn' });

function glMarks(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const { doc } = view.state;
  // Two visible ranges can meet inside one line; each line is marked once.
  let next = 0;
  for (const { from, to } of view.visibleRanges) {
    for (let pos = Math.max(from, next); pos <= to; ) {
      const line = doc.lineAt(pos);
      for (const r of glNameRanges(line.text)) builder.add(line.from + r.from, line.from + r.to, glName);
      pos = next = line.to + 1;
    }
  }
  return builder.finish();
}

/** GL and GLUT calls in cobalt. The grammar cannot tell OpenGL's names from others, so the tokenizer's rule does. */
export function glNameDecorations(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = glMarks(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) this.decorations = glMarks(update.view);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}

/** The editor's look, from CSS variables only, so a theme switch restyles it with no rebuild. */
export function vamsEditorTheme(): Extension {
  return EditorView.theme({
    '&': {
      height: '100%',
      color: 'var(--code-ink)',
      backgroundColor: 'transparent',
      fontSize: 'var(--text-sm)',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': {
      fontFamily: 'var(--font-mono)',
      lineHeight: '1.8',
    },
    '.cm-content': {
      padding: 'var(--space-2) 0',
      // The cursor is drawn only while the code has focus, in the line-number colour.
      caretColor: 'var(--line-number)',
    },
    '.cm-line': { padding: '0 var(--space-4) 0 0' },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      border: 'none',
      color: 'var(--line-number)',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      minWidth: '30px',
      padding: '0 14px 0 0',
      textAlign: 'right',
    },
  });
}

/**
 * Code the student reads and never edits. The content stays focusable, so the cursor moves with
 * the arrow keys, but no keystroke, paste or drop changes the text.
 */
export function readOnlyCode(): Extension[] {
  return [
    EditorState.readOnly.of(true),
    EditorView.editable.of(true),
    // A change that comes from the student is dropped; only the program itself replaces the text.
    EditorState.changeFilter.of((tr) => tr.annotation(Transaction.userEvent) === undefined),
    EditorView.contentAttributes.of({ 'aria-label': 'Generated C++ code', 'aria-readonly': 'true' }),
  ];
}
