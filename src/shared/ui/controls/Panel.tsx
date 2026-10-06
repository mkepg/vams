import { useContext, useEffect, useId, useRef, useState } from 'react';
import type { ComponentChildren } from 'preact';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { PanelLayoutContext } from './panel-context';
import './panel.scss';

export interface PanelProps {
  title: string;
  icon?: ComponentChildren;
  children: ComponentChildren;
  defaultOpen?: boolean;
  /** Lesson focusPanel target. */
  panelId?: string;
  /** Mono GL call shown at the right of the header, e.g. `glLineStipple`. */
  hint?: string;
  className?: string;
}

export function Panel({ title, icon, children, defaultOpen = false, panelId, hint, className }: PanelProps) {
  const { mode, focusPanelId } = useContext(PanelLayoutContext);
  const isFocus = mode === 'lesson' && !!panelId && panelId === focusPanelId;
  const [open, setOpen] = useState(() => (mode === 'lesson' ? isFocus : defaultOpen));
  const [wasFocus, setWasFocus] = useState(isFocus);
  if (isFocus !== wasFocus) {
    setWasFocus(isFocus);
    if (isFocus) setOpen(true);
  }

  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!isFocus) return;
    const el = sectionRef.current;
    if (!el) return;
    // The section column puts the focus panel first, under the sticky lesson card and its
    // "Use this panel" label; scrolling the column to the top shows all three. Scrolling the
    // panel itself into view would tuck its header under the sticky card.
    const root = el.closest<HTMLElement>('[data-scroll-root]');
    if (root) root.scrollTop = 0;
    else if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
  }, [isFocus]);

  const bodyId = useId();
  const classes = ['vpanel', open ? 'is-open' : '', isFocus ? 'is-lesson-focus' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <section ref={sectionRef} className={classes} data-panel-id={panelId}>
      <h3 className="vpanel__heading">
        <button
          type="button"
          className="vpanel__header"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
          {icon && <span className="vpanel__icon" aria-hidden="true">{icon}</span>}
          <span className="vpanel__title">{title}</span>
          {hint && <code className="vpanel__hint" aria-hidden="true">{hint}</code>}
        </button>
      </h3>
      <div id={bodyId} className="vpanel__body" hidden={!open}>
        {open && children}
      </div>
    </section>
  );
}
