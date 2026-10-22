import { useEffect, useLayoutEffect, useRef } from 'react';
import type { ComponentChildren } from 'preact';
import { useVamsStore } from '@/core/store';
import { useRunSnapshot } from '@/features/callbacks';
import { useNarrowLayout } from '@/shared/hooks/useNarrowLayout';
import './editor-app.scss';

export interface EditorShellProps {
  topBar: ComponentChildren;
  /** The rail of panel tabs. */
  rail: ComponentChildren;
  /** The open rail panel. */
  panel: ComponentChildren;
  canvas: ComponentChildren;
  /** The lesson bar, under the canvas. */
  lessonBar?: ComponentChildren;
  codeMath: ComponentChildren;
  /** Dialogs and other overlays rendered after the grid. */
  overlays?: ComponentChildren;
}

/** The editor grid: rail, panel, canvas and code. Below 1100 px the panel is a drawer beside the canvas, which narrows to make room. */
export default function EditorShell({ topBar, rail, panel, canvas, lessonBar, codeMath, overlays }: EditorShellProps) {
  const narrow = useNarrowLayout();
  const railPanel = useVamsStore((s) => s.railPanel);
  const railHidden = useVamsStore((s) => s.railHidden);
  const codeHidden = useVamsStore((s) => s.codeHidden);
  const setRailHidden = useVamsStore((s) => s.setRailHidden);
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');
  const running = useRunSnapshot().running;
  const panelRef = useRef<HTMLElement>(null);

  // A narrow layout starts with the drawer closed; a wide one shows the panel.
  useLayoutEffect(() => {
    setRailHidden(narrow);
  }, [narrow, setRailHidden]);

  // On a narrow screen, Run and the end of a lesson close the drawer to give the canvas its room back.
  useEffect(() => {
    if (narrow && running) setRailHidden(true);
  }, [narrow, running, setRailHidden]);
  const wasInLesson = useRef(inLesson);
  useEffect(() => {
    if (narrow && wasInLesson.current && !inLesson) setRailHidden(true);
    wasInLesson.current = inLesson;
  }, [narrow, inLesson, setRailHidden]);

  // A closed drawer never keeps focus: hand it to the open panel's rail tab.
  useLayoutEffect(() => {
    if (!narrow || !railHidden) return;
    const active = document.activeElement;
    if (active && panelRef.current?.contains(active)) document.getElementById(`rail-tab-${railPanel}`)?.focus();
  }, [narrow, railHidden, railPanel]);

  // While the drawer shows, Esc closes it wherever focus is, and the lesson's window listener
  // never sees that key. The listener sits on document, so it runs after every element handler
  // (a dialog, a menu or a field that used Esc has already called preventDefault) and before window.
  // Text fields keep their own Esc (cancel the edit).
  const drawerOpen = narrow && !railHidden;
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;
      if (target?.closest('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
      event.preventDefault();
      event.stopPropagation();
      setRailHidden(true);
      document.getElementById(`rail-tab-${useVamsStore.getState().railPanel}`)?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, setRailHidden]);

  const classes = [
    'editor',
    narrow ? 'editor--narrow' : '',
    railHidden ? 'is-panel-hidden' : '',
    codeHidden ? 'is-code-hidden' : '',
  ].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      {topBar}
      <div className="editor__rail" inert={running || undefined}>{rail}</div>
      <aside
        ref={panelRef}
        id="editor-panel"
        className="editor__panel"
        role="tabpanel"
        aria-labelledby={`rail-tab-${railPanel}`}
        data-tour-anchor="panel"
        inert={running || undefined}
      >
        {panel}
      </aside>
      <main className="editor__canvas canvas-area">
        <div className="editor__stage" data-tour-anchor="canvas">{canvas}</div>
        {lessonBar}
      </main>
      <aside className="editor__code" aria-label="Code and math" data-tour-anchor="code-column">{codeMath}</aside>
      {overlays}
    </div>
  );
}
