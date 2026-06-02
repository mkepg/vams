import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ArrowLeft, BookOpen } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import type { HelpTopicId } from '@/features/help/model/types';
import {
  HELP_CATEGORIES,
  HELP_TOPICS,
  DEFAULT_HELP_TOPIC,
  getHelpTopic,
  searchHelpTopics,
  topicForSection,
} from '@/features/help/model/help-content';
import HelpContent from './HelpContent';
import './help-center.scss';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Always mounted in the app shell. Renders nothing until Help is opened, then
 * mounts a fresh dialog instance so transient UI (search box, scroll position,
 * focus) starts clean on every open.
 */
export default function HelpCenter() {
  const isHelpOpen = useVamsStore((state) => state.isHelpOpen);
  if (!isHelpOpen) return null;
  return <HelpDialog />;
}

function HelpDialog() {
  const activeHelpTopicId = useVamsStore((state) => state.activeHelpTopicId);
  const helpHistory = useVamsStore((state) => state.helpHistory);
  const activeSection = useVamsStore((state) => state.activeSection);
  const hasSeenWelcome = useVamsStore((state) => state.hasSeenWelcome);
  const navigateHelp = useVamsStore((state) => state.navigateHelp);
  const closeHelp = useVamsStore((state) => state.closeHelp);
  const helpBack = useVamsStore((state) => state.helpBack);
  const markWelcomeSeen = useVamsStore((state) => state.markWelcomeSeen);

  const [query, setQuery] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const currentTopicId = (activeHelpTopicId as HelpTopicId | null) ?? topicForSection(activeSection);
  const currentTopic = getHelpTopic(currentTopicId) ?? getHelpTopic(DEFAULT_HELP_TOPIC);

  const results = useMemo(() => searchHelpTopics(query), [query]);

  // Lock body scroll, and capture/restore focus around the dialog's lifetime.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, []);

  // Scroll the article back to the top whenever the topic changes.
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [currentTopicId]);

  const handleNavigate = (topicId: HelpTopicId) => {
    navigateHelp(topicId);
    setQuery('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeHelp();
      return;
    }
    if (event.key !== 'Tab') return;
    // Focus trap.
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="help-overlay" onMouseDown={closeHelp}>
      <div
        className="help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-center-title"
        tabIndex={-1}
        ref={dialogRef}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <header className="help-dialog-header">
          <div className="help-title">
            <BookOpen size={18} />
            <span>Help Center</span>
          </div>
          <div className="help-search">
            <Search size={14} />
            <input
              type="text"
              value={query}
              placeholder="Search help…"
              aria-label="Search help"
              onChange={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && query) {
                  e.stopPropagation();
                  setQuery('');
                }
              }}
            />
            {query && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setQuery('')}
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <button type="button" className="help-close" onClick={closeHelp} aria-label="Close Help Center">
            <X size={18} />
          </button>
        </header>

        <div className="help-body">
          <nav className="help-nav" aria-label="Help topics">
            {!hasSeenWelcome && (
              <div className="help-welcome-banner">
                <p>New to VAMS?</p>
                <button
                  type="button"
                  onClick={() => {
                    handleNavigate('workspace-tour');
                    markWelcomeSeen();
                  }}
                >
                  Start the tour
                </button>
              </div>
            )}

            {query ? (
              <div className="help-nav-results">
                <span className="help-nav-count">
                  {results.length} result{results.length === 1 ? '' : 's'}
                </span>
                {results.map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    className={`help-nav-item ${topic.id === currentTopicId ? 'active' : ''}`}
                    aria-current={topic.id === currentTopicId ? 'true' : undefined}
                    onClick={() => handleNavigate(topic.id)}
                  >
                    <span className="nav-item-title">{topic.title}</span>
                    <span className="nav-item-summary">{topic.summary}</span>
                  </button>
                ))}
                {results.length === 0 && <p className="help-nav-empty">No topics match “{query}”.</p>}
              </div>
            ) : (
              HELP_CATEGORIES.map((category) => {
                const topics = HELP_TOPICS.filter((t) => t.category === category.id);
                if (topics.length === 0) return null;
                return (
                  <div key={category.id} className="help-nav-group">
                    <span className="help-nav-group-label">{category.label}</span>
                    {topics.map((topic) => (
                      <button
                        key={topic.id}
                        type="button"
                        className={`help-nav-item ${topic.id === currentTopicId ? 'active' : ''}`}
                        aria-current={topic.id === currentTopicId ? 'true' : undefined}
                        onClick={() => handleNavigate(topic.id)}
                      >
                        <span className="nav-item-title">{topic.title}</span>
                      </button>
                    ))}
                  </div>
                );
              })
            )}
          </nav>

          <div className="help-content-pane" ref={contentRef}>
            {helpHistory.length > 0 && (
              <button type="button" className="help-back" onClick={helpBack}>
                <ArrowLeft size={14} />
                Back
              </button>
            )}
            <HelpContent topic={currentTopic} onNavigate={handleNavigate} />
          </div>
        </div>
      </div>
    </div>
  );
}
