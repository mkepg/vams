import { useEffect, useRef, useState } from 'react';

interface EditorHelpProps {
  /** The hint's id: the editor names it in aria-describedby, so it is in the page whether shown or not. */
  id: string;
  text: string;
}

/**
 * How the keyboard moves through the editor, behind a small button at the end of the files strip.
 * The text stays in the page, hidden until asked for, so the editor's description always reads it.
 * Escape, a click elsewhere, or the button again closes it.
 */
export default function EditorHelp({ id, text }: EditorHelpProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="editor-help" data-open={open ? 'true' : 'false'}>
      <button
        ref={buttonRef}
        type="button"
        className="editor-help__button"
        aria-expanded={open}
        aria-controls={id}
        title="Keyboard help"
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <rect x="2.5" y="5" width="15" height="10" rx="2" />
          <path d="M5.5 8h1M9.5 8h1M13.5 8h1M5.5 11h1M13.5 11h1M8.5 11h3" />
        </svg>
        <span className="editor-help__label">Keyboard</span>
      </button>
      <p id={id} className="lab-workspace__hint editor-help__text" role="note">
        {text}
      </p>
    </div>
  );
}
