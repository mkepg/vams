import { RangeSet, StateEffect, StateField, type EditorState, type Extension, type Range, type Text } from '@codemirror/state';
import {
  Decoration, EditorView, GutterMarker, WidgetType, gutter, gutterLineClass, type DecorationSet,
} from '@codemirror/view';
import type { CodeMark, CodeNote, CodeRow } from './types';

/** Everything the code view draws besides the text, as the props give it. */
export interface ViewerDecorationInput {
  rows: readonly CodeRow[];
  marks: readonly CodeMark[];
  marksKey: number;
  matches: readonly CodeMark[];
  currentMatch: CodeMark | null;
  fired: ReadonlySet<number>;
  firedSeq: number | undefined;
  explainable: ReadonlySet<number>;
  explainedLine: number | null;
  notes: ReadonlyMap<number, CodeNote> | undefined;
  notesOn: boolean;
  changedLines: ReadonlySet<number>;
  /** Starts the ids of the fold summaries. */
  idPrefix: string;
  /** A fold row's button or an open block's ▾ was pressed. */
  onToggleFold: (block: string, pressed: HTMLElement) => void;
}

const EMPTY_INPUT: ViewerDecorationInput = {
  rows: [], marks: [], marksKey: 0, matches: [], currentMatch: null, fired: new Set(), firedSeq: undefined,
  explainable: new Set(), explainedLine: null, notes: undefined, notesOn: false, changedLines: new Set(),
  idPrefix: 'code', onToggleFold: () => {},
};

class FoldWidget extends WidgetType {
  readonly row: Exclude<CodeRow, { kind: 'line' }>;
  readonly tipId: string | undefined;
  constructor(row: Exclude<CodeRow, { kind: 'line' }>, tipId: string | undefined) {
    super();
    this.row = row;
    this.tipId = tipId;
  }
  eq(other: FoldWidget) {
    const a = this.row;
    const b = other.row;
    return a.kind === b.kind && a.block === b.block && a.label === b.label && a.start === b.start && a.end === b.end
      && (a.kind !== 'fold' || b.kind !== 'fold' || a.summary === b.summary) && this.tipId === other.tipId;
  }
  toDOM(view: EditorView) {
    const { row, tipId } = this;
    const wrap = document.createElement('div');
    wrap.className = `code-fold-row code-fold-row--${row.kind}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'code-fold';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', `Unfold ${row.label}`);
    if (tipId) button.setAttribute('aria-describedby', tipId);
    button.dataset.block = row.block;
    button.append(
      span('code-line__num', String(row.start + 1), true),
      span('code-fold__arrow code-line__fold', '▸', true),
      span('code-fold__label', row.label),
    );
    button.addEventListener('click', () => view.state.field(viewerField).input.onToggleFold(row.block, button));
    wrap.append(button);
    if (row.kind === 'fold' && tipId) {
      const tip = span('code-fold__summary', row.summary);
      tip.id = tipId;
      tip.setAttribute('role', 'tooltip');
      wrap.append(tip);
    }
    return wrap;
  }
  ignoreEvent() {
    return true;
  }
}

class NoteWidget extends WidgetType {
  readonly note: CodeNote;
  readonly indent: string;
  constructor(note: CodeNote, indent: string) {
    super();
    this.note = note;
    this.indent = indent;
  }
  eq(other: NoteWidget) {
    return this.indent === other.indent && this.note.length === other.note.length
      && this.note.every((p, i) => p.text === other.note[i].text && p.changed === other.note[i].changed);
  }
  toDOM() {
    const wrap = document.createElement('div');
    wrap.className = 'code-note';
    const text = span('code-note__text', '');
    for (const part of this.note) {
      if (part.changed === undefined) text.append(span('', part.text));
      else {
        const value = document.createElement('b');
        value.className = `code-note__value${part.changed ? ' is-changed' : ''}`;
        value.textContent = part.text;
        text.append(value);
      }
    }
    wrap.append(span('code-note__indent', this.indent, true), text);
    return wrap;
  }
  ignoreEvent() {
    return true;
  }
}

class FoldToggle extends GutterMarker {
  readonly block: string;
  readonly label: string;
  constructor(block: string, label: string) {
    super();
    this.block = block;
    this.label = label;
  }
  eq(other: FoldToggle) {
    return this.block === other.block && this.label === other.label;
  }
  toDOM(view: EditorView) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'code-fold-toggle';
    button.setAttribute('aria-expanded', 'true');
    button.setAttribute('aria-label', `Fold ${this.label}`);
    button.dataset.block = this.block;
    button.textContent = '▾';
    button.addEventListener('click', () => view.state.field(viewerField).input.onToggleFold(this.block, button));
    return button;
  }
}

class LineClass extends GutterMarker {
  readonly elementClass: string;
  constructor(elementClass: string) {
    super();
    this.elementClass = elementClass;
  }
  eq(other: LineClass) {
    return this.elementClass === other.elementClass;
  }
}

const changedNumber = new LineClass('is-changed');

function span(className: string, text: string, hidden = false) {
  const el = document.createElement('span');
  if (className) el.className = className;
  el.textContent = text;
  if (hidden) el.setAttribute('aria-hidden', 'true');
  return el;
}

/** The doc range that holds lines `start` to `end`, counted from 0. */
const linesRange = (doc: Text, start: number, end: number) => ({ from: doc.line(start + 1).from, to: doc.line(end + 1).to });

/**
 * The decorations for one set of props: `blocks` hides folded lines behind their fold row and
 * places the notes, `marks` styles the lines and values that are shown.
 */
export function buildDecorations(input: ViewerDecorationInput, doc: Text): { blocks: DecorationSet; marks: DecorationSet } {
  const blocks: Range<Decoration>[] = [];
  const marks: Range<Decoration>[] = [];
  const count = doc.lines;
  const shown = shownLines(input.rows);
  const inDoc = (line: number) => line >= 0 && line < count;

  // Each fold or "more" row stands in for its lines; lines no row names are not drawn at all.
  const covered = new Set<number>();
  for (const row of input.rows) {
    if (row.kind === 'line' || !inDoc(row.start)) continue;
    const end = Math.min(row.end, count - 1);
    for (let l = row.start; l <= end; l++) covered.add(l);
    const tipId = row.kind === 'fold' ? `${input.idPrefix}-fold-${row.start}` : undefined;
    const { from, to } = linesRange(doc, row.start, end);
    blocks.push(Decoration.replace({ widget: new FoldWidget(row, tipId), block: true }).range(from, to));
  }
  for (let l = 0; l < count; ) {
    if (shown.has(l) || covered.has(l)) {
      l += 1;
      continue;
    }
    let e = l;
    while (e + 1 < count && !shown.has(e + 1) && !covered.has(e + 1)) e += 1;
    const { from, to } = linesRange(doc, l, e);
    blocks.push(Decoration.replace({ block: true }).range(from, to));
    l = e + 1;
  }

  if (input.notesOn && input.notes) {
    for (const [line, note] of input.notes) {
      if (!shown.has(line) || !inDoc(line)) continue;
      const text = doc.line(line + 1);
      const indent = text.text.match(/^\s*/)![0];
      blocks.push(Decoration.widget({ widget: new NoteWidget(note, indent), block: true, side: 1 }).range(text.to));
    }
  }

  // A repeat of the same branch, or a new edit, swaps the class for its twin, so the animation runs again.
  const firedAgain = input.firedSeq !== undefined && input.firedSeq % 2 === 0;
  for (const line of shown) {
    if (!inDoc(line)) continue;
    const classes = [
      input.changedLines.has(line) ? 'is-changed' : '',
      input.fired.has(line) ? 'is-fired' : '',
      input.fired.has(line) && firedAgain ? 'is-fired--again' : '',
      input.explainable.has(line) ? 'is-explainable' : '',
      input.explainedLine === line ? 'is-explained' : '',
    ].filter(Boolean).join(' ');
    if (classes) marks.push(Decoration.line({ class: classes }).range(doc.line(line + 1).from));
  }
  const valueClass = input.marksKey % 2 === 0 ? 'code-value' : 'code-value code-value--again';
  const markRange = (m: CodeMark, cls: string) => {
    if (!shown.has(m.line) || !inDoc(m.line) || m.end <= m.start) return;
    const line = doc.line(m.line + 1);
    const from = line.from + Math.min(m.start, line.length);
    const to = line.from + Math.min(m.end, line.length);
    if (to > from) marks.push(Decoration.mark({ class: cls }).range(from, to));
  };
  for (const m of input.marks) markRange(m, valueClass);
  for (const m of input.matches) markRange(m, m === input.currentMatch ? 'code-find is-current' : 'code-find');

  return { blocks: Decoration.set(blocks, true), marks: Decoration.set(marks, true) };
}

function shownLines(rows: readonly CodeRow[]): Set<number> {
  return new Set(rows.flatMap((r) => (r.kind === 'line' ? [r.line] : [])));
}

/** The ▾ on the first line of each open block, and the amber line numbers of changed lines. */
export function buildGutterMarkers(input: ViewerDecorationInput, doc: Text): { toggles: RangeSet<GutterMarker>; numbers: RangeSet<GutterMarker> } {
  const toggles: Range<GutterMarker>[] = [];
  const numbers: Range<GutterMarker>[] = [];
  for (const row of input.rows) {
    if (row.kind !== 'line' || row.line >= doc.lines) continue;
    const from = doc.line(row.line + 1).from;
    if (row.closes) toggles.push(new FoldToggle(row.closes.block, row.closes.label).range(from));
    if (input.changedLines.has(row.line)) numbers.push(changedNumber.range(from));
  }
  return { toggles: RangeSet.of(toggles, true), numbers: RangeSet.of(numbers, true) };
}

interface ViewerValue {
  input: ViewerDecorationInput;
  shown: ReadonlySet<number>;
  blocks: DecorationSet;
  marks: DecorationSet;
  toggles: RangeSet<GutterMarker>;
  numbers: RangeSet<GutterMarker>;
}

function compute(input: ViewerDecorationInput, doc: Text): ViewerValue {
  return { input, shown: shownLines(input.rows), ...buildDecorations(input, doc), ...buildGutterMarkers(input, doc) };
}

/** Replaces what the view draws around the text. */
export const setViewerInput = StateEffect.define<ViewerDecorationInput>();

const viewerField = StateField.define<ViewerValue>({
  create: (state) => compute(EMPTY_INPUT, state.doc),
  update(value, tr) {
    let input = value.input;
    for (const effect of tr.effects) if (effect.is(setViewerInput)) input = effect.value;
    if (input === value.input && !tr.docChanged) return value;
    return compute(input, tr.state.doc);
  },
  provide: (field) => [
    EditorView.decorations.from(field, (v) => v.blocks),
    EditorView.decorations.from(field, (v) => v.marks),
    // The cursor steps over a folded block instead of into its hidden lines.
    EditorView.atomicRanges.of((view) => view.state.field(field).blocks),
    gutterLineClass.from(field, (v) => v.numbers),
  ],
});

/** The current props, as the view last received them. */
export const viewerInput = (state: EditorState) => state.field(viewerField).input;

/** Whether line `line` (from 0) is drawn, rather than folded away. */
export const isLineShown = (state: EditorState, line: number) => state.field(viewerField).shown.has(line);

/** The field and the ▾ gutter, which sits beside the line numbers. */
export function viewerDecorations(): Extension {
  return [
    viewerField,
    gutter({
      class: 'code-gutter',
      markers: (view) => view.state.field(viewerField).toggles,
    }),
  ];
}
