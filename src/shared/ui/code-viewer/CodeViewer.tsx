import './code-viewer.scss';
import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ComponentChildren } from 'preact';
import { X } from 'lucide-react';
import { tokenizeLine } from './tokenize';
import type { CodeMark, CodeRow } from './types';

export interface CodeViewerProps {
  code: string;
  /** The rows to show; every line when omitted. */
  rows?: readonly CodeRow[];
  /** A fold or "more" row was opened, or a block opened by hand was closed. */
  onToggleFold?: (block: string) => void;
  /** The values that just changed. */
  marks?: readonly CodeMark[];
  /** Changes with every new edit, so the marks' fade starts again. */
  marksKey?: number;
  /** Lines to scroll into view when they change: a lesson's highlighted lines, else the changed values. */
  revealLines?: readonly number[];
  /** Run's fired branch. */
  firedLines?: readonly number[];
  /** Find's current match is on this line; null when Find is empty or closed. */
  onFindLine?: (line: number | null) => void;
  isLessonMode?: boolean;
  /** Replaces the language and line count at the start of the header, such as the column's switch. */
  headerLead?: ComponentChildren;
  /** Rendered at the end of the header, after Copy. */
  headerTrail?: ComponentChildren;
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
  code, rows, onToggleFold, marks, marksKey = 0, revealLines, firedLines, onFindLine, isLessonMode,
  headerLead, headerTrail,
}: CodeViewerProps) {
  const baseId = useId();
  const [copied, setCopied] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [current, setCurrent] = useState(0);
  const findRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineEls = useRef<Map<number, HTMLDivElement>>(new Map());

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
  }, [findOpen]);

  // Bring the current match into view once its fold has opened.
  useEffect(() => {
    if (!currentMatch) return;
    const raf = requestAnimationFrame(() => lineEls.current.get(currentMatch.line)?.scrollIntoView?.({ block: 'nearest' }));
    return () => cancelAnimationFrame(raf);
  }, [currentMatch, rowList]);

  // Scroll a lesson's highlighted lines, or the changed values, into view: centred when they fit, else from the top.
  useEffect(() => {
    if (!revealLines || revealLines.length === 0) return;
    const scroller = scrollRef.current;
    if (!scroller) return;
    const top = Math.min(...revealLines);
    const bottom = Math.max(...revealLines);
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

  const renderLine = (row: Extract<CodeRow, { kind: 'line' }>) => {
    const { line } = row;
    const text = lines[line] ?? '';
    const changed = marksByLine.has(line);
    const classes = ['code-line', changed ? 'is-changed' : '', fired.has(line) ? 'is-fired' : ''].filter(Boolean).join(' ');
    return (
      // A changed line remounts on each edit, so its fade starts again.
      <div key={changed ? `${line}:${marksKey}` : `${line}`} className="code-row">
        {/* ▾ is the line's sibling, never inside it: Task 14 makes the line itself a button. */}
        {row.closes && (
          <button
            type="button"
            className="code-fold-close"
            aria-label={`Fold ${row.closes.label}`}
            onClick={() => onToggleFold?.(row.closes!.block)}
          >
            ▾
          </button>
        )}
        <div
          ref={(el) => {
            if (el) lineEls.current.set(line, el);
            else lineEls.current.delete(line);
          }}
          className={classes}
          data-line={line}
        >
          <span className="code-line__num" aria-hidden="true">{line + 1}</span>
          <span className="code-line__text">{text ? <LineText text={text} overlays={overlaysFor(line)} /> : ' '}</span>
        </div>
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
          aria-describedby={tipId}
          onClick={() => onToggleFold?.(row.block)}
        >
          <span className="code-line__num" aria-hidden="true">{row.start + 1}</span>
          <span className="code-fold__arrow" aria-hidden="true">▸ </span>
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
          {!isLessonMode && (findOpen ? (
            <div className="code-search" role="search">
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
            <button type="button" className="code-word" onClick={() => setFindOpen(true)}>Find</button>
          ))}
          <button type="button" className="code-word" onClick={handleCopy}>{copied ? 'Copied' : 'Copy'}</button>
          {headerTrail}
        </div>
      </div>

      <div className="code-content" ref={scrollRef}>
        {rowList.map((row) => (row.kind === 'line' ? renderLine(row) : renderFold(row)))}
      </div>
    </div>
  );
});

export default CodeViewer;
