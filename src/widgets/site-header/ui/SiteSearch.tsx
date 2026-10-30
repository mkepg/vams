import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Dialog } from '@/shared/ui/controls';
import { KIND_LABEL, searchSite } from '../model/search-index';
import './site-search.scss';

export const SEARCH_COPY = {
  open: 'Search',
  title: 'Search VAMS',
  placeholder: 'Lessons, scenes, guide topics, OpenGL terms',
  empty: (query: string) => `Nothing matches “${query}”.`,
  hint: 'Enter opens it. Arrow keys move.',
} as const;

/** Whether a key press asks for search: Ctrl+K, or ⌘K on a Mac. */
export const isSearchShortcut = (event: KeyboardEvent) =>
  (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k';

const optionId = (i: number) => `site-search-option-${i}`;

/** The header's search: a button and Ctrl+K open one box that finds lessons, scenes, guide topics and terms. */
export default function SiteSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchSite(query), [query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSearchShortcut(event)) return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const close = () => {
    setOpen(false);
    setQuery('');
    setActive(0);
  };
  const go = (href: string) => {
    close();
    window.location.assign(href);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (results.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + results.length) % results.length);
    } else if (event.key === 'Enter' && results[active]) {
      event.preventDefault();
      go(results[active].href);
    }
  };

  return (
    <>
      <button type="button" className="site-search__open" onClick={() => setOpen(true)} aria-keyshortcuts="Control+K Meta+K">
        <Search size={16} aria-hidden="true" />
        <span className="site-search__open-label">{SEARCH_COPY.open}</span>
        <kbd className="site-search__open-key" aria-hidden="true">Ctrl K</kbd>
      </button>
      <Dialog open={open} onClose={close} labelledBy="site-search-title" initialFocusRef={inputRef} className="site-search" onKeyDown={onKeyDown}>
        <h2 id="site-search-title" className="site-search__title">{SEARCH_COPY.title}</h2>
        <div className="site-search__field">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded="true"
            aria-controls="site-search-results"
            aria-activedescendant={results[active] ? optionId(active) : undefined}
            aria-autocomplete="list"
            aria-labelledby="site-search-title"
            placeholder={SEARCH_COPY.placeholder}
            spellcheck={false}
            autoComplete="off"
            value={query}
            onInput={(event) => {
              setQuery(event.currentTarget.value);
              setActive(0);
            }}
          />
        </div>
        <div id="site-search-results" role="listbox" aria-label={SEARCH_COPY.title} className="site-search__results">
          {results.map((entry, i) => (
            <a
              key={entry.href + entry.title}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              href={entry.href}
              className={`site-search__option${i === active ? ' is-active' : ''}`}
              onMouseMove={() => setActive(i)}
              onClick={(event) => {
                event.preventDefault();
                go(entry.href);
              }}
            >
              <span className="site-search__kind">{KIND_LABEL[entry.kind]}</span>
              <span className="site-search__text">
                <span className="site-search__name">{entry.title}</span>
                <span className="site-search__detail">{entry.detail}</span>
              </span>
            </a>
          ))}
          {results.length === 0 && <p className="site-search__empty">{SEARCH_COPY.empty(query.trim())}</p>}
        </div>
        <p className="site-search__hint">{SEARCH_COPY.hint}</p>
      </Dialog>
    </>
  );
}
