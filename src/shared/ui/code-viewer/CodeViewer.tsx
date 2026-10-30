import './code-viewer.scss';
import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ComponentChildren } from 'preact';
import { X } from 'lucide-react';
import { Compartment, EditorSelection, EditorState, Prec, type ChangeSpec, type StateEffect, type Text } from '@codemirror/state';
import { EditorView, gutters, keymap, lineNumbers } from '@codemirror/view';
import { cppLanguage, glNameDecorations, readOnlyCode, vamsEditorTheme, vamsHighlight } from '@/shared/ui/code-editor';
import { REVEAL_PADDING, revealTop, scrollBehavior } from './reveal-scroll';
import { isLineShown, setViewerInput, viewerDecorations, type ViewerDecorationInput } from './cm-decorations';
import type { CodeMark, CodeNote, CodeRow, CodeStrip } from './types';

export interface CodeViewerProps {
  code: string;
  /** The rows to show; every line when omitted. */
  rows?: readonly CodeRow[];
  /** A fold or "more" row was opened, or an open block's ▾ was pressed. */
  onToggleFold?: (block: string) => void;
  /** The values that just changed. */
  marks?: readonly CodeMark[];
  /** Changes with every new edit, so the marks' fade starts again. */
  marksKey?: number;
  /** Lines to scroll into view when they change: a lesson's highlighted lines, else the changed values. */
  revealLines?: readonly number[];
  /**
   * The selected object's lines. When `key` changes they scroll to the top, unless one is already
   * on screen, `hold` is set, or `revealLines` scrolls in the same update.
   */
  follow?: { key: string; lines: readonly number[]; hold: boolean } | null;
  /** Run's fired branch. */
  firedLines?: readonly number[];
  /** Counts Run's calls, so a repeat of the same branch restarts its flash. */
  firedSeq?: number;
  /** Find's current match is on this line; null when Find is empty or closed. */
  onFindLine?: (line: number | null) => void;
  isLessonMode?: boolean;
  /** Replaces the language and line count at the start of the header, such as the column's switch. */
  headerLead?: ComponentChildren;
  /** Rendered at the end of the header, after Copy. */
  headerTrail?: ComponentChildren;
  /** Lines the student can click to have explained. */
  explainable?: ReadonlySet<number>;
  /** The line the strip explains. */
  explainedLine?: number | null;
  /** A line was chosen to explain; null closes the strip. */
  onExplain?: (line: number | null) => void;
  /** The open explanation, shown under the code. */
  strip?: CodeStrip | null;
  /** Notes under their lines. */
  notes?: ReadonlyMap<number, CodeNote>;
  notesOn?: boolean;
  onToggleNotes?: () => void;
}

const NO_MARKS: readonly CodeMark[] = [];
const NO_LINES: ReadonlySet<number> = new Set();

const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The line the cursor is on, counted from 0. */
const cursorLine = (view: EditorView) => view.state.doc.lineAt(view.state.selection.main.head).number - 1;

/** Where line `line` starts in the scroller, and how tall it is. */
function lineBox(view: EditorView, line: number) {
  const block = view.lineBlockAt(view.state.doc.line(line + 1).from);
  return { top: view.documentPadding.top + block.top, height: block.height };
}

/** The smallest change that turns `doc` into `next`, so the view keeps its scroll and cursor. */
function changeTo(doc: Text, next: string): ChangeSpec | null {
  const prev = doc.toString();
  if (prev === next) return null;
  let start = 0;
  const max = Math.min(prev.length, next.length);
  while (start < max && prev.charCodeAt(start) === next.charCodeAt(start)) start++;
  let end = 0;
  while (end < max - start && prev.charCodeAt(prev.length - 1 - end) === next.charCodeAt(next.length - 1 - end)) end++;
  return { from: start, to: prev.length - end, insert: next.slice(start, next.length - end) };
}

/** Up and Down step through the lines that are drawn, keeping the column where they can. */
function moveLine(view: EditorView, dir: 1 | -1, extend: boolean) {
  const { state } = view;
  const sel = state.selection.main;
  const from = state.doc.lineAt(sel.head);
  const column = sel.goalColumn ?? sel.head - from.from;
  let n = from.number - 1 + dir;
  while (n >= 0 && n < state.doc.lines && !isLineShown(state, n)) n += dir;
  if (n < 0 || n >= state.doc.lines) return true;
  const to = state.doc.line(n + 1);
  const head = to.from + Math.min(column, to.length);
  const range = extend ? EditorSelection.range(sel.anchor, head, column) : EditorSelection.cursor(head, 0, undefined, column);
  view.dispatch({ selection: EditorSelection.create([range]), scrollIntoView: true, userEvent: 'select' });
  return true;
}

/** A cursor left in lines that just folded away moves to the nearest drawn line above them. */
function keepCursorShown(view: EditorView) {
  const { state } = view;
  const line = cursorLine(view);
  if (isLineShown(state, line)) return;
  let n = line;
  while (n >= 0 && !isLineShown(state, n)) n--;
  let head: number;
  if (n >= 0) head = state.doc.line(n + 1).to;
  else {
    n = line;
    while (n < state.doc.lines && !isLineShown(state, n)) n++;
    head = n < state.doc.lines ? state.doc.line(n + 1).from : 0;
  }
  view.dispatch({ selection: { anchor: head } });
}

const CodeViewer = memo(function CodeViewer({
  code, rows, onToggleFold, marks, marksKey = 0, revealLines, follow, firedLines, firedSeq, onFindLine, isLessonMode,
  headerLead, headerTrail, explainable, explainedLine, onExplain, strip, notes, notesOn, onToggleNotes,
}: CodeViewerProps) {
  const baseId = useId();
  const [copied, setCopied] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [current, setCurrent] = useState(0);
  const findRef = useRef<HTMLInputElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const findWordRef = useRef<HTMLButtonElement>(null);
  // Focus follows a keyboard toggle: the control that was pressed is replaced, so its twin takes focus.
  const focusAfter = useRef<string | null>(null);
  const refocusFind = useRef(false);

  const lines = useMemo(() => code.replace(/\r\n/g, '\n').split('\n'), [code]);
  const text = useMemo(() => lines.join('\n'), [lines]);
  const rowList = useMemo<readonly CodeRow[]>(() => rows ?? lines.map((_, line) => ({ kind: 'line', line })), [rows, lines]);

  const matches = useMemo<CodeMark[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: CodeMark[] = [];
    lines.forEach((text, line) => {
      const low = text.toLowerCase();
      for (let at = low.indexOf(q); at >= 0; at = low.indexOf(q, at + q.length)) out.push({ line, start: at, end: at + q.length });
    });
    return out;
  }, [lines, query]);
  const index = matches.length === 0 ? -1 : Math.min(current, matches.length - 1);
  const currentMatch = index >= 0 ? matches[index] : null;

  const stripId = `${baseId}-strip`;
  const hintId = `${baseId}-hint`;
  const showHint = !strip && !!explainable && explainable.size > 0;

  // The keys and clicks inside the view read the latest props from here.
  const live = useRef({ explainable, explainedLine, onExplain, onToggleFold });
  useLayoutEffect(() => {
    live.current = { explainable, explainedLine, onExplain, onToggleFold };
  });

  const ariaRef = useRef(new Compartment());
  const ariaFor = (open: boolean, hint: boolean) => EditorView.contentAttributes.of({
    ...(open ? { 'aria-controls': stripId } : {}),
    ...(hint ? { 'aria-describedby': hintId } : {}),
  });

  // One view for the life of the panel; props reach it through transactions below.
  useLayoutEffect(() => {
    const explainCursor = (view: EditorView) => {
      const line = cursorLine(view);
      const { explainable: can, onExplain: explain } = live.current;
      if (isLineShown(view.state, line) && can?.has(line)) explain?.(line);
      return true;
    };
    const view = new EditorView({
      parent: hostRef.current!,
      state: EditorState.create({
        doc: text,
        extensions: [
          lineNumbers(),
          viewerDecorations(),
          gutters({ fixed: false }),
          cppLanguage(),
          vamsHighlight(),
          glNameDecorations(),
          vamsEditorTheme(),
          readOnlyCode(),
          ariaRef.current.of(ariaFor(false, false)),
          // Escape closes the strip before the editor sees the key.
          Prec.highest(keymap.of([{
            key: 'Escape',
            run: () => {
              if (live.current.explainedLine == null) return false;
              live.current.onExplain?.(null);
              return true;
            },
          }])),
          keymap.of([
            { key: 'ArrowDown', run: (v) => moveLine(v, 1, false), shift: (v) => moveLine(v, 1, true) },
            { key: 'ArrowUp', run: (v) => moveLine(v, -1, false), shift: (v) => moveLine(v, -1, true) },
            { key: 'Enter', run: explainCursor },
            { key: 'Space', run: explainCursor },
          ]),
          EditorView.domEventHandlers({
            // A click on a line explains it, as the line buttons did.
            click: (event, view) => {
              const el = (event.target as Element | null)?.closest?.('.cm-line');
              if (!el || !view.state.selection.main.empty) return false;
              const pos = view.posAtDOM(el);
              const line = view.state.doc.lineAt(pos).number - 1;
              if (cursorLine(view) !== line) view.dispatch({ selection: { anchor: pos } });
              if (live.current.explainable?.has(line)) live.current.onExplain?.(line);
              return false;
            },
          }),
          // While the strip is open, the cursor landing on an explainable line explains it.
          EditorView.updateListener.of((update) => {
            if (!update.selectionSet || !update.transactions.some((tr) => tr.isUserEvent('select'))) return;
            const { explainable: can, explainedLine: shown, onExplain: explain } = live.current;
            if (shown == null) return;
            const line = cursorLine(update.view);
            if (line !== shown && isLineShown(update.state, line) && can?.has(line)) explain?.(line);
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // The view is made once; later props arrive through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFold = useCallback((block: string, pressed: HTMLElement) => {
    if (document.activeElement === pressed) focusAfter.current = block;
    live.current.onToggleFold?.(block);
  }, []);

  const input = useMemo<ViewerDecorationInput>(() => ({
    rows: rowList,
    marks: marks ?? NO_MARKS,
    marksKey,
    matches,
    currentMatch,
    fired: new Set(firedLines ?? []),
    firedSeq,
    explainable: explainable ?? NO_LINES,
    explainedLine: explainedLine ?? null,
    notes,
    notesOn: !!notesOn,
    changedLines: new Set((marks ?? NO_MARKS).map((m) => m.line)),
    idPrefix: baseId,
    onToggleFold: toggleFold,
  }), [rowList, marks, marksKey, matches, currentMatch, firedLines, firedSeq, explainable, explainedLine, notes, notesOn, baseId, toggleFold]);

  // The text changes only when the program does; everything drawn around it changes with the props.
  const ariaKey = `${!!strip}:${showHint}`;
  const lastAria = useRef('false:false');
  useLayoutEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const changes = changeTo(view.state.doc, text);
    const effects: StateEffect<unknown>[] = [setViewerInput.of(input)];
    if (lastAria.current !== ariaKey) {
      lastAria.current = ariaKey;
      effects.push(ariaRef.current.reconfigure(ariaFor(!!strip, showHint)));
    }
    view.dispatch({ ...(changes ? { changes } : {}), effects });
    keepCursorShown(view);
    // ariaFor reads only ids that never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, input, ariaKey]);

  // The parent opens the fold around the current match.
  const findLine = currentMatch?.line ?? null;
  useEffect(() => {
    onFindLine?.(findLine);
  }, [findLine, onFindLine]);

  useEffect(() => {
    if (findOpen) requestAnimationFrame(() => findRef.current?.focus());
    else if (refocusFind.current) {
      refocusFind.current = false;
      findWordRef.current?.focus();
    }
  }, [findOpen]);

  // The row that took the place of a pressed fold or ▾ gets the focus the press had.
  useEffect(() => {
    const block = focusAfter.current;
    if (!block) return;
    focusAfter.current = null;
    viewRef.current?.dom.querySelector<HTMLElement>(`.code-fold[data-block="${block}"], .code-fold-toggle[data-block="${block}"]`)?.focus();
  }, [rowList]);

  /** Scrolls line `line` into view by the least distance, once it is drawn. */
  const scrollNearest = (line: number) => requestAnimationFrame(() => {
    const view = viewRef.current;
    if (!view || line >= view.state.doc.lines || !isLineShown(view.state, line)) return;
    view.dispatch({ effects: EditorView.scrollIntoView(view.state.doc.line(line + 1).from, { y: 'nearest' }) });
  });

  // Bring the current match into view once its fold has opened.
  useEffect(() => {
    if (!currentMatch) return;
    const raf = scrollNearest(currentMatch.line);
    return () => cancelAnimationFrame(raf);
  }, [currentMatch, rowList]);

  // Scroll a lesson's highlighted lines, or the changed values, into view: centred when they fit, else from the top.
  // The same lines in the same code scroll once: a key Run repeats does not pull back a student who scrolled away.
  const revealed = useRef<{ range: string; code: string } | null>(null);
  // True from when a reveal is scheduled until it runs, so a follow in the same update yields to it.
  const revealPending = useRef(false);
  useEffect(() => {
    if (!revealLines || revealLines.length === 0 || !viewRef.current) return;
    const top = Math.min(...revealLines);
    const bottom = Math.max(...revealLines);
    const range = `${top}:${bottom}`;
    if (revealed.current?.range === range && revealed.current.code === code) return;
    revealed.current = { range, code };
    revealPending.current = true;
    const raf = requestAnimationFrame(() => {
      revealPending.current = false;
      const view = viewRef.current;
      if (!view || top >= view.state.doc.lines || !isLineShown(view.state, top)) return;
      const scroller = view.scrollDOM;
      const first = lineBox(view, top);
      const last = bottom < view.state.doc.lines && isLineShown(view.state, bottom) ? lineBox(view, bottom) : first;
      const height = last.top + last.height - first.top;
      const target = revealTop(first.top, height, scroller.clientHeight);
      scroller.scrollTo({ top: target, left: 0, behavior: scrollBehavior(scroller.scrollTop, target, scroller.clientHeight, prefersReducedMotion()) });
    });
    return () => {
      cancelAnimationFrame(raf);
      revealPending.current = false;
    };
  }, [revealLines, code]);

  // A new selection brings its lines to the top when none of them is on screen. Only the key
  // starts this, so an edit that moves the lines leaves the student where they are.
  const followKey = follow?.key ?? null;
  const followRef = useRef(follow);
  // Mirror the latest lines before the effect below reads them; it runs only when the key changes.
  useLayoutEffect(() => {
    followRef.current = follow;
  });
  useEffect(() => {
    const target = followRef.current;
    if (!target || target.hold || !viewRef.current || revealPending.current) return;
    const raf = requestAnimationFrame(() => {
      const view = viewRef.current;
      if (!view) return;
      const shown = target.lines.filter((line) => line < view.state.doc.lines && isLineShown(view.state, line));
      if (shown.length === 0) return;
      const scroller = view.scrollDOM;
      const viewTop = scroller.scrollTop;
      const viewBottom = viewTop + scroller.clientHeight;
      const onScreen = shown.some((line) => {
        const box = lineBox(view, line);
        return box.top + box.height > viewTop && box.top < viewBottom;
      });
      if (onScreen) return;
      const top = Math.max(0, lineBox(view, shown[0]).top - REVEAL_PADDING);
      scroller.scrollTo({ top, left: 0, behavior: scrollBehavior(scroller.scrollTop, top, scroller.clientHeight, prefersReducedMotion()) });
    });
    return () => cancelAnimationFrame(raf);
  }, [followKey]);

  // The explained line scrolls into view, as when it was chosen from the math.
  useEffect(() => {
    if (explainedLine == null) return;
    const raf = scrollNearest(explainedLine);
    return () => cancelAnimationFrame(raf);
  }, [explainedLine]);

  const closeStrip = () => {
    const line = explainedLine;
    onExplain?.(null);
    // The close button leaves with the strip; the code takes the focus, with the cursor on the line.
    if (line != null) {
      requestAnimationFrame(() => {
        const view = viewRef.current;
        if (!view || line >= view.state.doc.lines) return;
        if (cursorLine(view) !== line) view.dispatch({ selection: { anchor: view.state.doc.line(line + 1).from } });
        view.focus();
      });
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const closeFind = () => {
    refocusFind.current = !!searchRef.current?.contains(document.activeElement);
    setQuery('');
    setCurrent(0);
    setFindOpen(false);
  };

  return (
    <div className={`code-viewer-container${isLessonMode ? ' lesson-mode' : ''}`}>
      <div className="code-header">
        <div className="code-header-left">
          {headerLead ?? (
            <>
              <span className="code-lang">C++</span>
              <span className="code-stat">· OpenGL 1.5 · {lines.length} lines</span>
            </>
          )}
        </div>
        <div className="code-header-right">
          {onToggleNotes && (
            <button type="button" className="code-word" aria-pressed={!!notesOn} onClick={onToggleNotes}>Notes</button>
          )}
          {!isLessonMode && (findOpen ? (
            <div className="code-search" role="search" ref={searchRef}>
              <input
                ref={findRef}
                value={query}
                aria-label="Find in code"
                placeholder="Find in code…"
                onInput={(e) => {
                  setQuery(e.currentTarget.value);
                  setCurrent(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    closeFind();
                  } else if (e.key === 'Enter' && matches.length > 0) {
                    e.preventDefault();
                    setCurrent((index + (e.shiftKey ? matches.length - 1 : 1)) % matches.length);
                  }
                }}
              />
              {query && (
                <span className="code-search__count" aria-live="polite">
                  {matches.length === 0 ? '0' : `${index + 1}/${matches.length}`}
                </span>
              )}
              <button type="button" className="code-search__close" aria-label="Close find" onClick={closeFind}>
                <X size={12} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button type="button" className="code-word" ref={findWordRef} onClick={() => setFindOpen(true)}>Find</button>
          ))}
          <button type="button" className="code-word" onClick={handleCopy}>{copied ? 'Copied' : 'Copy'}</button>
          {headerTrail}
        </div>
      </div>

      <div className="code-content" ref={hostRef} data-testid="code-view" />

      {/* Always mounted, so the first explanation is announced. */}
      <div className="code-live" aria-live="polite">
        {strip && (
        <section id={stripId} className="code-strip" aria-label="What this line does">
          <div className="code-strip__body">
            <div className="code-strip__head">
              <code className="code-strip__sig">{strip.signature}</code>
              <button type="button" className="code-strip__close" aria-label="Close explanation" onClick={closeStrip}>
                <X size={12} aria-hidden="true" />
              </button>
            </div>
            <p className="code-strip__text">{strip.text}</p>
            {strip.values.length > 0 && (
              <table className="code-strip__values">
                <caption>Your values</caption>
                <tbody>
                  {strip.values.map((v) => (
                    <tr key={v.arg}>
                      <th scope="row">{v.arg}</th>
                      <td>{v.source} = <span className="code-strip__value">{v.value}</span></td>
                      <td>{v.control ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {strip.links.length > 0 && (
              <div className="code-strip__links">
                {strip.links.map((l) => (
                  <button key={l.label} type="button" className="code-strip__link" onClick={l.onSelect}>{l.label}</button>
                ))}
              </div>
            )}
          </div>
        </section>
        )}
      </div>
      {showHint && (
        <p className="code-hint" id={hintId}><b>Click any line</b> to see what it does.</p>
      )}
    </div>
  );
});

export default CodeViewer;
