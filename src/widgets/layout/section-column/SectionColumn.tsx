import { useLayoutEffect, useRef } from 'react';
import { Fragment } from 'preact';
import { ArrowDown } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import LessonCard from '@/features/lesson-engine/ui/LessonCard';
import { PanelLayoutContext } from '@/shared/ui/controls';
import SectionMenu from './SectionMenu';
import { PINNED_PANEL_ID, SECTION_PANELS, type SectionPanels } from './section-panels';
import './section-column.scss';

/**
 * The left column. In Author mode: the section menu, then the section's panels with Scene
 * Hierarchy pinned first (except in Pipeline). In Lesson mode: the lesson card, then the
 * step's focus panel under "Use this panel", then the rest collapsed.
 */
export default function SectionColumn({ panels = SECTION_PANELS }: { panels?: SectionPanels }) {
  const activeSection = useVamsStore((s) => s.activeSection);
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');
  const focusPanelId = useVamsStore((s) => s.lessonFocusPanel);
  const list = panels[activeSection];

  // Leaving a lesson swaps the card (and its focused Exit button) for the section menu.
  // When that drops focus to the page, hand it to the menu trigger; never take it from elsewhere.
  const headRef = useRef<HTMLDivElement>(null);
  const wasInLesson = useRef(inLesson);
  useLayoutEffect(() => {
    const left = wasInLesson.current && !inLesson;
    wasInLesson.current = inLesson;
    if (!left) return;
    const active = document.activeElement;
    if (active && active !== document.body && document.contains(active)) return;
    headRef.current?.querySelector<HTMLElement>('.section-menu__trigger')?.focus();
  }, [inLesson]);

  let ordered = list;
  const focus = inLesson ? list.find((entry) => entry.id === focusPanelId) : undefined;
  if (focus) {
    ordered = [focus, ...list.filter((entry) => entry !== focus)];
  } else if (!inLesson && activeSection !== 'Pipeline') {
    const pinned = list.find((entry) => entry.id === PINNED_PANEL_ID);
    if (pinned) ordered = [pinned, ...list.filter((entry) => entry !== pinned)];
  }

  return (
    <div className="section-column" data-scroll-root>
      <div ref={headRef} className="section-column__head">{inLesson ? <LessonCard /> : <SectionMenu />}</div>
      <PanelLayoutContext.Provider value={{ mode: inLesson ? 'lesson' : 'author', focusPanelId: inLesson ? focusPanelId : null }}>
        <div className="section-column__panels" key={inLesson ? `lesson-${focusPanelId ?? 'none'}` : `author-${activeSection}`}>
          {ordered.map((entry, index) => (
            <Fragment key={entry.id}>
              {focus && index === 0 && (
                <p className="section-column__use">
                  <ArrowDown size={12} aria-hidden="true" />
                  Use this panel
                </p>
              )}
              {entry.render()}
            </Fragment>
          ))}
        </div>
      </PanelLayoutContext.Provider>
    </div>
  );
}
