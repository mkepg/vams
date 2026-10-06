import { useId, useLayoutEffect, useRef, useState } from 'react';
import { glColorArgs, normalizeHex, type ColorGlCall } from './color-utils';
import { pushRecentColor, useRecentColors } from './recent-colors';
import './color.scss';

export interface ColorFieldProps {
  label: string;
  /** Hex colour, `#rrggbb`. */
  value: string;
  onChange: (hex: string) => void;
  /** Once before a typed or recent-swatch change, and once at the start of a picking session. */
  onBeginChange?: () => void;
  /** After a typed or recent-swatch change, and when the picker closes. */
  onCommit?: () => void;
  glCall: ColorGlCall;
  showRecent?: boolean;
  id?: string;
  className?: string;
}

export function ColorField({
  label, value, onChange, onBeginChange, onCommit, glCall, showRecent = true, id, className,
}: ColorFieldProps) {
  const autoId = useId();
  const baseId = id ?? autoId;
  const errorId = `${baseId}-error`;
  const hexRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  // Mirrors `draft` so handlers see edits made before the next render. Non-null only after an input event.
  const draftRef = useRef<string | null>(null);
  const [draft, setDraftState] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const pickingRef = useRef(false);
  const recent = useRecentColors();
  const current = normalizeHex(value) ?? '#000000';
  const currentText = current.slice(1).toUpperCase();

  const setDraft = (next: string | null) => {
    draftRef.current = next;
    setDraftState(next);
  };

  const applyCommitted = (hex: string) => {
    if (hex !== current) {
      onBeginChange?.();
      onChange(hex);
      onCommit?.();
    }
    pushRecentColor(hex);
  };

  const commitHex = (fromBlur: boolean) => {
    const pending = draftRef.current;
    if (pending === null) return;
    const hex = normalizeHex(pending);
    if (!hex) {
      if (fromBlur) {
        setDraft(null);
        setInvalid(false);
      } else {
        setInvalid(true);
      }
      return;
    }
    setDraft(null);
    setInvalid(false);
    applyCommitted(hex);
  };

  // Native listeners: preact/compat maps onBlur to focusout and rewrites onChange on a
  // text-like input to oninput, so neither would see the plain blur and change events.
  useLayoutEffect(() => {
    const input = hexRef.current;
    if (!input) return;
    const onBlur = () => commitHex(true);
    input.addEventListener('blur', onBlur);
    return () => input.removeEventListener('blur', onBlur);
  });

  useLayoutEffect(() => {
    const picker = pickerRef.current;
    if (!picker) return;
    const onPickerClosed = () => {
      const hex = normalizeHex(picker.value);
      pickingRef.current = false;
      if (hex) pushRecentColor(hex);
      onCommit?.();
    };
    picker.addEventListener('change', onPickerClosed);
    return () => picker.removeEventListener('change', onPickerClosed);
  });

  return (
    <div className={className ? `vcolor ${className}` : 'vcolor'}>
      <span className="vfield-label vcolor__label">{label}</span>
      <div className="vcolor__row">
        <input
          ref={pickerRef}
          type="color"
          className="vcolor__swatch"
          aria-label={`${label} picker`}
          value={current}
          onInput={(event) => {
            const hex = normalizeHex((event.currentTarget as HTMLInputElement).value);
            if (!hex) return;
            if (!pickingRef.current) {
              pickingRef.current = true;
              onBeginChange?.();
            }
            onChange(hex);
          }}
        />
        <span className="vcolor__hex">
          <span aria-hidden="true">#</span>
          <input
            ref={hexRef}
            id={baseId}
            type="text"
            className="vcolor__hex-input"
            aria-label={`${label} hex value`}
            aria-invalid={invalid ? 'true' : undefined}
            aria-describedby={invalid ? errorId : undefined}
            spellcheck={false}
            maxLength={7}
            value={draft ?? currentText}
            onInput={(event) => {
              setDraft((event.currentTarget as HTMLInputElement).value);
              setInvalid(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitHex(false);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                if (draftRef.current !== null) {
                  setDraft(null);
                  setInvalid(false);
                  // Restore the DOM value directly: no render may run between typing and Escape.
                  if (hexRef.current) hexRef.current.value = currentText;
                }
              }
            }}
          />
        </span>
        <code className="vcolor__gl" aria-hidden="true">
          <span className="vcolor__fn">{glCall}</span>({glColorArgs(current, glCall)})
        </code>
      </div>
      {invalid && (
        <span id={errorId} className="vcolor__error" role="alert">Enter a hex color like #B91C1C</span>
      )}
      {showRecent && recent.length > 0 && (
        <div className="vcolor__recent" role="group" aria-label="Recent colors">
          {recent.map((hex) => (
            <button
              key={hex}
              type="button"
              className="vcolor__chip"
              style={{ background: hex }}
              aria-label={`Use ${hex.toUpperCase()}`}
              title={hex.toUpperCase()}
              onClick={() => applyCommitted(hex)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
