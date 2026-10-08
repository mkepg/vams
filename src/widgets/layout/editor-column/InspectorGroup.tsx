import { useEffect, useId, useRef } from 'react';
import type { ComponentChildren } from 'preact';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { InspectorGroupId } from '@/core/inspector';

interface InspectorGroupProps {
  id: InspectorGroupId;
  title: string;
  hint: string;
  open: boolean;
  onToggle: () => void;
  /** The lesson step's group: outlined and scrolled into view under the card. */
  focused?: boolean;
  /** Demo steps dim the other groups; they stay operable. */
  dimmed?: boolean;
  children: ComponentChildren;
}

export default function InspectorGroup({ id, title, hint, open, onToggle, focused = false, dimmed = false, children }: InspectorGroupProps) {
  const bodyId = useId();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!focused) return;
    const el = ref.current;
    const root = el?.closest<HTMLElement>('[data-scroll-root]');
    if (!el || !root) return;
    // Scroll the group to just under the sticky lesson card.
    const head = root.querySelector<HTMLElement>('.editor-column__head');
    root.scrollTop = Math.max(0, el.offsetTop - (head?.offsetHeight ?? 0) - 8);
  }, [focused]);

  const classes = ['inspector-group', open ? 'is-open' : '', focused ? 'is-focus' : '', dimmed ? 'is-dimmed' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <section ref={ref} className={classes} data-group={id}>
      <h3 className="inspector-group__heading">
        <button type="button" className="inspector-group__header" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
          {open ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
          <span className="inspector-group__title">{title}</span>
          <code className="inspector-group__hint" aria-hidden="true">{hint}</code>
        </button>
      </h3>
      <div id={bodyId} className="inspector-group__body" hidden={!open}>
        {open && children}
      </div>
    </section>
  );
}
