import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { ABOUT_COPY, APA_PARTS, CITATIONS, type CitationId } from '../model/copy';

export const COPIED_RESET_MS = 2000;

const TABS: readonly { id: CitationId; label: string }[] = [
  { id: 'apa', label: 'APA 7' },
  { id: 'bibtex', label: 'BibTeX' },
];

type Status = 'idle' | 'copied' | 'fallback';

/** Select a node's text so the reader can copy it by hand. */
function selectText(node: HTMLElement | null) {
  const selection = window.getSelection();
  if (!node || !selection) return;
  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** The thesis citation in two formats, as WAI-ARIA tabs, each with a Copy button. */
export default function CitationTabs() {
  const [active, setActive] = useState<CitationId>('apa');
  const [status, setStatus] = useState<Status>('idle');
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const texts = useRef<Partial<Record<CitationId, HTMLElement | null>>>({});
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const show = (next: Status) => {
    window.clearTimeout(timer.current);
    setStatus(next);
    if (next === 'copied') timer.current = window.setTimeout(() => setStatus('idle'), COPIED_RESET_MS);
  };

  const select = (id: CitationId) => {
    setActive(id);
    show('idle');
  };

  const copy = async (id: CitationId) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('No clipboard');
      await navigator.clipboard.writeText(CITATIONS[id]);
      show('copied');
    } catch {
      selectText(texts.current[id] ?? null);
      show('fallback');
    }
  };

  const onKeyDown = (event: JSX.TargetedKeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = TABS.length - 1;
    const keys: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(TABS[next].id);
    tabs.current[next]?.focus();
  };

  const message = status === 'copied' ? ABOUT_COPY.copied : status === 'fallback' ? ABOUT_COPY.copyFallback : '';

  return (
    <div className="citation">
      <div className="citation__tabs" role="tablist" aria-label={ABOUT_COPY.citationLabel}>
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            ref={(el) => {
              tabs.current[index] = el;
            }}
            id={`citation-tab-${tab.id}`}
            type="button"
            role="tab"
            className="citation__tab"
            aria-selected={active === tab.id ? 'true' : 'false'}
            aria-controls={`citation-panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => select(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {TABS.map((tab) => (
        <div
          key={tab.id}
          id={`citation-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`citation-tab-${tab.id}`}
          className="citation__panel"
          hidden={active !== tab.id}
        >
          {tab.id === 'apa' ? (
            <p
              className="citation__text"
              ref={(el) => {
                texts.current.apa = el;
              }}
            >
              {APA_PARTS.lead}
              <i>{APA_PARTS.title}</i>
              {APA_PARTS.tail}
            </p>
          ) : (
            <pre
              className="citation__text citation__text--code"
              ref={(el) => {
                texts.current.bibtex = el;
              }}
            >
              {CITATIONS.bibtex}
            </pre>
          )}
          <button type="button" className="citation__copy" onClick={() => void copy(tab.id)}>
            {active === tab.id && status === 'copied' ? ABOUT_COPY.copied : ABOUT_COPY.copy}
          </button>
        </div>
      ))}
      <p className="citation__status" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
