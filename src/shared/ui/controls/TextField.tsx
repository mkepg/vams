import { useId, useRef, useState } from 'react';
import './fields.scss';

export interface TextFieldProps {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  hideLabel?: boolean;
  maxLength?: number;
  id?: string;
  className?: string;
}

/** Text input that commits on Enter or blur and reverts on Escape. */
export function TextField({ label, value, onCommit, placeholder, hideLabel = false, maxLength, id, className }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [draft, setDraftState] = useState<string | null>(null);
  // Mirrors `draft` so handlers see edits made before the next render.
  const draftRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const setDraft = (next: string | null) => {
    draftRef.current = next;
    setDraftState(next);
  };

  const commit = () => {
    const pending = draftRef.current;
    setDraft(null);
    if (pending !== null && pending !== value) onCommit(pending);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setDraft(null);
      // Restore the DOM value directly: no render may run between typing and Escape.
      if (inputRef.current) inputRef.current.value = value;
      inputRef.current?.blur();
    }
  };

  return (
    <div className={className ? `vtext ${className}` : 'vtext'}>
      <label htmlFor={inputId} className={hideLabel ? 'vfield-label sr-only' : 'vfield-label'}>{label}</label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        className="vfield-input"
        value={draft ?? value}
        placeholder={placeholder}
        maxLength={maxLength}
        onFocus={() => setDraft(value)}
        onInput={(event) => setDraft((event.currentTarget as HTMLInputElement).value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
