import './code-viewer.scss';
import { memo, useMemo, useState, useEffect, useRef } from 'react';
import type { ComponentChildren } from 'preact';
import { TbCopy, TbCheck } from 'react-icons/tb';
import { Search, X, Info } from 'lucide-react';
import { Button } from '@/shared/ui/controls';
import { tokenizeLine } from './tokenize';
import type { CodeAnnotation } from '@/features/code-generation/model/glut-annotations';

interface CodeViewerProps {
  code: string;
  highlightTarget?: string | null;
  isLessonMode?: boolean;
  annotations?: CodeAnnotation[];
  changedLines?: number[];
  /** Replaces the language and line count at the start of the header, such as the column's switch. */
  headerLead?: ComponentChildren;
  /** Rendered at the end of the header, after Copy. */
  headerTrail?: ComponentChildren;
}

const TokenizedLine = memo(function TokenizedLine({ line }: { line: string }) {
  const tokens = useMemo(() => tokenizeLine(line), [line]);
  return (
    <>
      {tokens.map((tok, i) => (
        <span key={i} className={`tk tk-${tok.k}`}>{tok.t}</span>
      ))}
    </>
  );
});

const CodeViewer = memo(function CodeViewer({
  code, highlightTarget, isLessonMode, annotations, changedLines, headerLead, headerTrail,
}: CodeViewerProps) {
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const lineElsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  const lines = useMemo(() => code.split('\n'), [code]);
  const lineCount = lines.length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) { console.error('Failed to copy text: ', err); }
  };

  useEffect(() => {
    if (searchOpen) requestAnimationFrame(() => searchRef.current?.focus());
  }, [searchOpen]);

  const highlightedLines = useMemo(() => {
    const highlighted = new Set<number>();
    if (!highlightTarget) return highlighted;
    let inDrawBlock = false;
    let inConfigBlock = false;
    
    // Per-object identifier prefixes emitted by the code generator.
    // Keep these in sync with generator/buffers.ts and generator/textures.ts.
    // `uvs_*` is the per-vertex UV array, `uvbo_*` its VBO handle (textured VBO mode).
    const targetRegex = new RegExp(`\\b(draw|state|verts|colors|indices|uvs|vbo|cbo|ebo|uvbo|tex)_${highlightTarget}\\b`);
    const configOpRegex = new RegExp(`\\b(vbo|cbo|ebo|uvbo|verts|colors|indices|uvs|tex)_${highlightTarget}\\b`);
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed === `void draw_${highlightTarget}()`) inDrawBlock = true;
      
      if (inDrawBlock) {
        highlighted.add(index);
        if (trimmed === '}' && line.startsWith('}')) inDrawBlock = false;
      } else if (inConfigBlock) {
        if (trimmed === '') {
          inConfigBlock = false; // Config setups/updates always end with a blank line
        } else {
          highlighted.add(index);
        }
      } else if (targetRegex.test(line)) {
        highlighted.add(index);
        // Include the preceding explanatory comment if it exists
        if (index > 0 && lines[index - 1].trim().startsWith('//')) {
          highlighted.add(index - 1);
        }
        if (line.startsWith('    ') && configOpRegex.test(line)) {
          inConfigBlock = true;
        }
      }
    });
    return highlighted;
  }, [lines, highlightTarget]);

  const searchMatches = useMemo(() => {
    if (!search.trim()) return new Set<number>();
    const q = search.toLowerCase();
    const m = new Set<number>();
    lines.forEach((line, i) => { if (line.toLowerCase().includes(q)) m.add(i); });
    return m;
  }, [lines, search]);

  const changedSet = useMemo(() => {
    if (!changedLines || changedLines.length === 0) return new Set<number>();
    return new Set(changedLines);
  }, [changedLines]);

  const annotationByLine = useMemo(() => {
    const map = new Map<number, CodeAnnotation>();
    if (!annotations || annotations.length === 0) return map;

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      for (const a of annotations) {
        if (a.pattern.test(trimmed)) {
          if (!map.has(idx)) map.set(idx, a);
          break;
        }
      }
    });
    return map;
  }, [lines, annotations]);

  useEffect(() => {
    if (!changedLines || changedLines.length === 0) return;
    const scroller = scrollAreaRef.current;
    if (!scroller) return;

    const topIdx = Math.min(...changedLines);
    const target = lineElsRef.current.get(topIdx);
    if (!target) return;

    const raf = requestAnimationFrame(() => {
      const el = lineElsRef.current.get(topIdx);
      if (!el || !scroller.contains(el)) return;

      const scrollerRect = scroller.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const elTopWithinScroller =
        scroller.scrollTop + (elRect.top - scrollerRect.top);

      const viewportH = scroller.clientHeight;
      const regionEnd = Math.max(...changedLines);
      const regionEndEl = lineElsRef.current.get(regionEnd);
      const regionHeight =
        regionEndEl
          ? regionEndEl.getBoundingClientRect().bottom - elRect.top
          : elRect.height;

      let targetTop = elTopWithinScroller - (viewportH / 2) + (regionHeight / 2);

      const topWithPadding = elTopWithinScroller - 24;
      if (regionHeight > viewportH * 0.7 || targetTop > topWithPadding) {
        targetTop = topWithPadding;
      }

      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // A highlighted line starts at its GL call, so its start is always shown.
      scroller.scrollTo({
        top: Math.max(0, targetTop),
        left: 0,
        behavior: prefersReduced ? 'auto' : 'smooth',
      });
    });

    return () => cancelAnimationFrame(raf);
  }, [changedLines, code]);

  const stats = useMemo(() => {
    const bytes = new Blob([code]).size;
    return { lines: lineCount, bytes };
  }, [code, lineCount]);

  const changeBadgeCount = changedSet.size;
  // The header has room for one chip: the lesson's change count, else the focus target, else the hover hint.
  const showBadge = isLessonMode && changeBadgeCount > 0;
  const showFocus = !showBadge && !!highlightTarget;
  const showHint = !showBadge && !highlightTarget && annotationByLine.size > 0;

  return (
    <div className={`code-viewer-container ${isLessonMode ? 'lesson-mode' : ''}`}>
      <div className="code-header">
        <div className="code-header-left">
          {headerLead ?? (
            <>
              <span className="code-lang">C++</span>
              <span className="code-stat">· OpenGL 1.5 · {stats.lines} lines</span>
            </>
          )}

          {showHint && (
            <span className="code-annot-hint" title="Hover an underlined line for an explanation">
              <Info size={11} />
              <span>hover lines for notes</span>
            </span>
          )}

          {showBadge && (
            <span
              className="code-change-badge"
              title="Lines updated in this step"
              aria-label={`${changeBadgeCount} line${changeBadgeCount === 1 ? '' : 's'} updated in this step`}
            >
              <span className="change-dot" aria-hidden />
              <span>updated · {changeBadgeCount}</span>
            </span>
          )}

          {showFocus && (
            <span className="code-focus" title={`Highlighting: ${highlightTarget}`}>
              focus: <code>{highlightTarget}</code>
            </span>
          )}
        </div>

        <div className="code-header-right">
          {!isLessonMode && (
            <>
              {searchOpen ? (
                <div className="code-search">
                  <Search size={12} />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={(e) => setSearch(e.currentTarget.value)}
                    placeholder="Find in code…"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { setSearch(''); setSearchOpen(false); }
                    }}
                  />
                  {search && <span className="search-count">{searchMatches.size}</span>}
                  <button
                    type="button"
                    className="search-close"
                    onClick={() => { setSearch(''); setSearchOpen(false); }}
                    title="Close search"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <Button variant="quiet" iconOnly label="Find" icon={<Search size={13} />} onClick={() => setSearchOpen(true)} />
              )}
            </>
          )}

          <Button
            variant="quiet"
            className={`copy-button ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            title="Copy code"
            icon={copied ? <TbCheck size={14} /> : <TbCopy size={14} />}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
          {headerTrail}
        </div>
      </div>

      <div className="code-content" ref={scrollAreaRef}>
        <div className="line-numbers" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, i) => (
            <div
              key={i}
              className={`line-num
                ${highlightedLines.has(i) ? 'highlight' : ''}
                ${searchMatches.has(i) ? 'match' : ''}
                ${changedSet.has(i) ? 'changed' : ''}`}
            >
              {i + 1}
            </div>
          ))}
        </div>

        <pre>
          {lines.map((line, i) => {
            const annotation = annotationByLine.get(i);
            const isChanged = changedSet.has(i);

            return (
              <div
                key={i}
                ref={(el) => {
                  if (el) lineElsRef.current.set(i, el);
                  else lineElsRef.current.delete(i);
                }}
                className={`code-line
                  ${highlightedLines.has(i) ? 'highlight' : ''}
                  ${searchMatches.has(i) ? 'match' : ''}
                  ${annotation ? 'has-annot' : ''}
                  ${isChanged ? 'changed' : ''}`}
              >
                {isChanged && <span className="change-marker" aria-hidden />}
                {line ? <TokenizedLine line={line} /> : ' '}
                {annotation && (
                  <span className="code-annot" role="tooltip">
                    <span className="annot-title">{annotation.title}</span>
                    <span className="annot-desc">{annotation.description}</span>
                  </span>
                )}
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
});

export default CodeViewer;