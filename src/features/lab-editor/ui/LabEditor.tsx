import { useEffect, useRef } from 'react';
import { Annotation, EditorState, Prec, StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, drawSelection, highlightActiveLine, keymap, lineNumbers, type DecorationSet } from '@codemirror/view';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { lintGutter, setDiagnostics } from '@codemirror/lint';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { cppLanguage, vamsHighlight, glNameDecorations, vamsEditorTheme } from '@/shared/ui/code-editor';
import { errorLines, positionOf, toLintDiagnostics, type Diagnostic } from '../model/diagnostics';
import './lab-editor.scss';

export interface LabEditorProps {
  value: string;
  onChange: (value: string) => void;
  diagnostics: readonly Diagnostic[];
  /** Moves the cursor to a 1-based line and column. A new object moves it again, even to the same place. */
  jumpTo?: { line: number; col: number };
  /** Ctrl+Enter, or Cmd+Enter on a Mac. */
  onRun?: () => void;
}

/** Marks a change that came from the `value` prop, so it is not reported back as typing. */
const fromProps = Annotation.define<boolean>();

const setErrorLines = StateEffect.define<number[]>();
const errorLineMark = Decoration.line({ class: 'lab-error-line' });

const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marks, tr) {
    marks = marks.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setErrorLines)) continue;
      const lines = [...effect.value].filter((n) => n >= 1 && n <= tr.state.doc.lines).sort((a, b) => a - b);
      marks = Decoration.set(lines.map((n) => errorLineMark.range(tr.state.doc.line(n).from)));
    }
    return marks;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/** Edits on top of the shared look; every colour is a token, so a theme switch restyles it. */
const labTheme = EditorView.theme({
  '.cm-content': { caretColor: 'var(--ink)' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--ink)' },
  '.cm-activeLine': { backgroundColor: 'var(--accent-tint)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--ink)' },
});

function extensions(callbacks: { current: Pick<LabEditorProps, 'onChange' | 'onRun'> }, sent: { current: string[] }): Extension[] {
  return [
    // Ctrl and Cmd both run, on every platform, ahead of the default "insert blank line".
    Prec.highest(
      keymap.of([
        {
          key: 'Ctrl-Enter',
          run: () => {
            callbacks.current.onRun?.();
            return true;
          },
        },
        {
          key: 'Cmd-Enter',
          run: () => {
            callbacks.current.onRun?.();
            return true;
          },
        },
      ]),
    ),
    lineNumbers(),
    history(),
    drawSelection(),
    highlightActiveLine(),
    indentOnInput(),
    bracketMatching(),
    highlightSelectionMatches(),
    lintGutter(),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
    cppLanguage(),
    vamsHighlight(),
    glNameDecorations(),
    vamsEditorTheme(),
    labTheme,
    errorLineField,
    EditorView.contentAttributes.of({ 'aria-label': 'C++ code, main.cpp', spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off' }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged && !update.transactions.some((tr) => tr.annotation(fromProps))) {
        const text = update.state.doc.toString();
        sent.current = [...sent.current, text].slice(-100);
        callbacks.current.onChange(text);
      }
    }),
  ];
}

export default function LabEditor({ value, onChange, diagnostics, jumpTo, onRun }: LabEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const callbacks = useRef({ onChange, onRun });
  callbacks.current = { onChange, onRun };
  // Texts sent through onChange that the parent has not handed back yet, oldest first.
  const sent = useRef<string[]>([]);

  useEffect(() => {
    const created = new EditorView({
      parent: host.current as HTMLDivElement,
      state: EditorState.create({ doc: value, extensions: extensions(callbacks, sent) }),
    });
    view.current = created;
    return () => {
      created.destroy();
      view.current = null;
    };
    // The editor is made once; later values arrive through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const current = view.current;
    if (!current || current.state.doc.toString() === value) return;
    // A value the editor itself sent is the parent catching up, not new text.
    const at = sent.current.indexOf(value);
    if (at >= 0) {
      sent.current = sent.current.slice(at + 1);
      return;
    }
    sent.current = [];
    current.dispatch({ changes: { from: 0, to: current.state.doc.length, insert: value }, annotations: fromProps.of(true) });
  }, [value]);

  useEffect(() => {
    const current = view.current;
    if (!current) return;
    const spec = setDiagnostics(current.state, toLintDiagnostics(current.state.doc, diagnostics));
    current.dispatch({ ...spec, effects: [...(Array.isArray(spec.effects) ? spec.effects : spec.effects ? [spec.effects] : []), setErrorLines.of(errorLines(diagnostics))] });
  }, [diagnostics]);

  useEffect(() => {
    const current = view.current;
    if (!current || !jumpTo) return;
    current.dispatch({ selection: { anchor: positionOf(current.state.doc, jumpTo.line, jumpTo.col) }, scrollIntoView: true });
    current.focus();
  }, [jumpTo]);

  return <div className="lab-editor" ref={host} />;
}
