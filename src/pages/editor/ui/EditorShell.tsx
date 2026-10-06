import { useLayoutEffect, useRef, useState } from 'react';
import type { ComponentChildren } from 'preact';
import { PanelLeft } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import { Button } from '@/shared/ui/controls';
import { useNarrowLayout } from '../model/useNarrowLayout';
import './editor-app.scss';

export interface EditorShellProps {
  topBar: ComponentChildren;
  column: ComponentChildren;
  canvas: ComponentChildren;
  codeMath: ComponentChildren;
  /** Dialogs and other overlays rendered after the grid. */
  overlays?: ComponentChildren;
}

/** The editor grid. Below 1100 px the section column becomes a drawer over the canvas. */
export default function EditorShell({ topBar, column, canvas, codeMath, overlays }: EditorShellProps) {
  const narrow = useNarrowLayout();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const columnRef = useRef<HTMLElement>(null);

  // Open the drawer whenever a lesson starts or moves to another step, so the narration is visible,
  // and close it when the lesson ends.
  const stepKey = useVamsStore((s) => (s.appMode === 'Lesson' ? `${s.activeLessonId}:${s.currentStepIndex}` : null));
  const [lastStepKey, setLastStepKey] = useState<string | null>(null);
  if (stepKey !== lastStepKey) {
    setLastStepKey(stepKey);
    if (stepKey) setDrawerOpen(true);
    else if (lastStepKey) setDrawerOpen(false);
  }

  // A closed drawer never keeps focus: move it to the Panels button (for example after Exit).
  const showDrawer = narrow && drawerOpen;
  useLayoutEffect(() => {
    if (!narrow || drawerOpen) return;
    const active = document.activeElement;
    if (active && columnRef.current?.contains(active)) toggleRef.current?.focus();
  }, [narrow, drawerOpen]);

  // Esc inside the open drawer closes only the drawer; the lesson's window listener never sees it.
  // Text fields keep their own Esc (cancel the edit), so the drawer leaves those alone.
  const onColumnKeyDown = (event: KeyboardEvent) => {
    if (!showDrawer || event.key !== 'Escape' || event.defaultPrevented) return;
    const target = event.target as HTMLElement | null;
    if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;
    event.preventDefault();
    event.stopPropagation();
    setDrawerOpen(false);
    toggleRef.current?.focus();
  };

  const classes = ['editor', narrow ? 'editor--narrow' : '', showDrawer ? 'is-drawer-open' : ''].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      {topBar}
      <aside ref={columnRef} id="editor-section-column" className="editor__column" aria-label="Section panels" onKeyDown={onColumnKeyDown}>
        {column}
      </aside>
      <main className="editor__canvas canvas-area">
        {narrow && (
          <Button
            ref={toggleRef}
            className="editor__panels-toggle"
            icon={<PanelLeft />}
            aria-expanded={drawerOpen}
            aria-controls="editor-section-column"
            onClick={() => setDrawerOpen((open) => !open)}
          >
            Panels
          </Button>
        )}
        {canvas}
      </main>
      <aside className="editor__code" aria-label="Code and math">{codeMath}</aside>
      {overlays}
    </div>
  );
}
