import './code-viewer.scss';
import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ComponentChildren } from 'preact';
import { X } from 'lucide-react';
import { tokenizeLine } from './tokenize';
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

interface Overlay {
  start: number;
  end: number;
  cls: string;
}

interface Segment {
  text: string;
  cls: string;
}

/** Splits a line's tokens at the overlay edges, so a mark or a Find match can cover part of a token. */
export function lineSegments(text: string, overlays: readonly Overlay[]): Segment[] {
  const out: Segment[] = [];
  let pos = 0;
  for (const token of tokenizeLine(text)) {
    const start = pos;
    const end = pos + token.t.length;
    const cuts = new Set([start, end]);
    for (const o of overlays) {
      if (o.start > start && o.start < end) cuts.add(o.start);
      if (o.end > start && o.end < end) cuts.add(o.end);
    }
    const edges = [...cuts].sort((a, b) => a - b);
    for (let k = 0; k < edges.length - 1; k++) {
      const a = edges[k];
      const b = edges[k + 1];
      const extra = overlays.filter((o) => o.start <= a && o.end >= b).map((o) => o.cls);
      out.push({ text: text.slice(a, b), cls: [`tk-${token.k}`, ...extra].join(' ') });
    }
    pos = end;
  }
  return out;
}

const LineText = memo(function LineText({ text, overlays }: { text: string; overlays: readonly Overlay[] }) {
  const parts = useMemo(() => lineSegments(text, overlays), [text, overlays]);
  return (
    <>
      {parts.map((p, i) => (
        <span key={i} className={p.cls}>{p.text}</span>
      ))}
    </>
  );
});

const NO_OVERLAYS: readonly Overlay[] = [];

function byLine<T extends { line: number }>(items: readonly T[] | undefined): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const item of items ?? []) map.set(item.line, [...(map.get(item.line) ?? []), item]);
  return map;
}

const CodeViewer = memo(function CodeViewer({
  code, rows, onToggleFold, marks, marksKey = 0, revealLines, firedLines, firedSeq, onFindLine, isLessonMode,
  headerLead, headerTrail, explainable, explainedLine, onExplain, strip, notes, notesOn, onToggleNotes,
}: CodeViewerProps) {
  const baseId = useId();
  const [copied, setCopied] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [current, setCurrent] = useState(0);
  const findRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineEls = useRef<Map<number, HTMLDivElement>>(new Map());
  const searchRef = useRef<HTMLDivElement>(null);
  const findWordRef = useRef<HTMLButtonElement>(null);
  // Focus follows a keyboard toggle: the control that was pressed is replaced, so its twin takes focus.
  const focusAfter = useRef<{ selector: string } | null>(null);
  const refocusFind = useRef(false);

  const lines = useMemo(() => code.replace(/\r\n/g, '\n').split('\n'), [code]);
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
    const pending = focusAfter.current;
    if (!pending) return;
    focusAfter.current = null;
    scrollRef.current?.querySelector<HTMLElement>(pending.selector)?.focus();
  }, [rowList]);

  // Bring the current match into view once its fold has opened.
  useEffect(() => {
    if (!currentMatch) return;
    const raf = requestAnimationFrame(() => lineEls.current.get(currentMatch.line)?.scrollIntoView?.({ block: 'nearest' }));
    return () => cancelAnimationFrame(raf);
  }, [currentMatch, rowList]);

  // Scroll a lesson's highlighted lines, or the changed values, into view: centred when they fit, else from the top.
  // The same lines in the same code scroll once: a key Run repeats does not pull back a student who scrolled away.
  const revealed = useRef<{ range: string; code: string } | null>(null);
  useEffect(() => {
    if (!revealLines || revealLines.length === 0) return;
    const scroller = scrollRef.current;
    if (!scroller) return;
    const top = Math.min(...revealLines);
    const bottom = Math.max(...revealLines);
    const range = `${top}:${bottom}`;
    if (revealed.current?.range === range && revealed.current.code === code) return;
    revealed.current = { range, code };
    const raf = requestAnimationFrame(() => {
      const el = lineEls.current.get(top);
      if (!el || !scroller.contains(el)) return;
      const scrollerRect = scroller.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const elTop = scroller.scrollTop + (elRect.top - scrollerRect.top);
      const endEl = lineEls.current.get(bottom);
      const height = endEl ? endEl.getBoundingClientRect().bottom - elRect.top : elRect.height;
      let target = elTop - scroller.clientHeight / 2 + height / 2;
      const withPadding = elTop - 24;
      if (height > scroller.clientHeight * 0.7 || target > withPadding) target = withPadding;
      const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      scroller.scrollTo({ top: Math.max(0, target), left: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [revealLines, code]);

  const stripId = `${baseId}-strip`;
  const shownLines = useMemo(
    () => rowList.flatMap((r) => (r.kind === 'line' && explainable?.has(r.line) ? [r.line] : [])),
    [rowList, explainable],
  );
  const tabLine = explainedLine != null && shownLines.includes(explainedLine) ? explainedLine : shownLines[0];

  const moveTo = (from: number, delta: 1 | -1) => {
    const next = shownLines[shownLines.indexOf(from) + delta];
    if (next === undefined) return;
    lineEls.current.get(next)?.focus();
    if (explainedLine != null) onExplain?.(next);
  };

  const onLineKey = (line: number) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onExplain?.(line);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      moveTo(line, e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'Escape' && explainedLine != null) {
      e.preventDefault();
      onExplain?.(null);
    }
  };

  // The explained line scrolls into view, as when it was chosen from the math.
  useEffect(() => {
    if (explainedLine == null) return;
    const raf = requestAnimationFrame(() => lineEls.current.get(explainedLine)?.scrollIntoView?.({ block: 'nearest' }));
    return () => cancelAnimationFrame(raf);
  }, [explainedLine]);

  const closeStrip = () => {
    const line = explainedLine;
    onExplain?.(null);
    // The close button leaves with the strip; the line keeps the focus.
    if (line != null) requestAnimationFrame(() => lineEls.current.get(line)?.focus());
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

  const marksByLine = useMemo(() => byLine(marks), [marks]);
  const matchesByLine = useMemo(() => byLine(matches), [matches]);
  const fired = useMemo(() => new Set(firedLines ?? []), [firedLines]);

  const overlaysFor = (line: number): readonly Overlay[] => {
    const lineMarks = marksByLine.get(line);
    const lineMatches = matchesByLine.get(line);
    if (!lineMarks && !lineMatches) return NO_OVERLAYS;
    return [
      ...(lineMarks ?? []).map((m) => ({ start: m.start, end: m.end, cls: 'code-value' })),
      ...(lineMatches ?? []).map((m) => ({ start: m.start, end: m.end, cls: m === currentMatch ? 'code-find is-current' : 'code-find' })),
    ];
  };

  // The toggle is replaced by its twin in the same column, so the twin takes the focus the press had.
  const toggleFromKey = (block: string, pressed: HTMLElement) => {
    if (document.activeElement === pressed) {
      focusAfter.current = { selector: `.code-fold[data-block="${block}"], .code-fold-toggle[data-block="${block}"]` };
    }
    onToggleFold?.(block);
  };

  const renderLine = (row: Extract<CodeRow, { kind: 'line' }>) => {
    const { line } = row;
    const text = lines[line] ?? '';
    const changed = marksByLine.has(line);
    const canExplain = explainable?.has(line) ?? false;
    const explained = explainedLine === line;
    const note = notes?.get(line);
    const classes = [
      'code-line', changed ? 'is-changed' : '', fired.has(line) ? 'is-fired' : '',
      fired.has(line) && firedSeq !== undefined && firedSeq % 2 === 0 ? 'is-fired--again' : '',
      canExplain ? 'is-explainable' : '', explained ? 'is-explained' : '',
    ].filter(Boolean).join(' ');
    return (
      // A changed line remounts on each edit, so its fade starts again.
      <div key={changed ? `${line}:${marksKey}` : `${line}`} className="code-row">
        {/* The gutter is the line's sibling, never inside it: the line itself is a button. It sits over the line's reserved fold column. */}
        {row.closes && (
          <div className="code-gutter">
            <button
              type="button"
              className="code-fold-toggle"
              aria-expanded="true"
              aria-label={`Fold ${row.closes.label}`}
              data-block={row.closes.block}
              onClick={(e) => toggleFromKey(row.closes!.block, e.currentTarget)}
            >
              ▾
            </button>
          </div>
        )}
        <div
          ref={(el) => {
            if (el) lineEls.current.set(line, el);
            else lineEls.current.delete(line);
          }}
          className={classes}
          data-line={line}
          role={canExplain ? 'button' : undefined}
          tabIndex={canExplain ? (line === tabLine ? 0 : -1) : undefined}
          aria-expanded={canExplain ? explained : undefined}
          aria-controls={explained ? stripId : undefined}
          onClick={canExplain ? () => onExplain?.(line) : undefined}
          onKeyDown={canExplain ? onLineKey(line) : undefined}
        >
          <span className="code-line__num" aria-hidden="true">{line + 1}</span>
          <span className="code-line__fold" aria-hidden="true" />
          <span className="code-line__text">{text ? <LineText text={text} overlays={overlaysFor(line)} /> : ' '}</span>
        </div>
        {notesOn && note && (
          <div className="code-note">
            <span className="code-line__num" aria-hidden="true" />
            <span className="code-line__fold" aria-hidden="true" />
            <span className="code-note__indent" aria-hidden="true">{text.match(/^\s*/)![0]}</span>
            <span className="code-note__text">
              {note.map((part, k) =>
                part.changed === undefined ? (
                  <span key={k}>{part.text}</span>
                ) : (
                  <b key={k} className={`code-note__value${part.changed ? ' is-changed' : ''}`}>{part.text}</b>
                ),
              )}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderFold = (row: Exclude<CodeRow, { kind: 'line' }>) => {
    const tipId = row.kind === 'fold' ? `${baseId}-fold-${row.start}` : undefined;
    return (
      <div key={`${row.kind}:${row.block}:${row.start}`} className={`code-fold-row code-fold-row--${row.kind}`}>
        <button
          type="button"
          className="code-fold"
          aria-expanded="false"
          aria-label={`Unfold ${row.label}`}
          aria-describedby={tipId}
          data-block={row.block}
          onClick={(e) => toggleFromKey(row.block, e.currentTarget)}
        >
          <span className="code-line__num" aria-hidden="true">{row.start + 1}</span>
          <span className="code-fold__arrow code-line__fold" aria-hidden="true">▸</span>
          <span className="code-fold__label">{row.label}</span>
        </button>
        {row.kind === 'fold' && (
          <span id={tipId} role="tooltip" className="code-fold__summary">{row.summary}</span>
        )}
      </div>
    );
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

      <div className="code-content" ref={scrollRef}>
        {rowList.map((row) => (row.kind === 'line' ? renderLine(row) : renderFold(row)))}
      </div>

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
      {!strip && explainable && explainable.size > 0 && (
        <p className="code-hint"><b>Click any line</b> to see what it does.</p>
      )}
    </div>
  );
});

export default CodeViewer;
