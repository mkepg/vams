import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { decimalsFor, parseNumberInput, roundToStep } from './number-utils';
import './fields.scss';

export interface NumberFieldProps {
  label: string;
  tag?: string;
  axis?: 'x' | 'y';
  value: number;
  onChange: (value: number) => void;
  onBeginChange?: () => void;
  onCommit?: () => void;
  min?: number;
  max?: number;
  step?: number;
  bigStep?: number;
  fineStep?: number;
  precision?: number;
  unit?: string;
  scrubPixelsPerStep?: number;
  hideTag?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

interface ScrubState {
  startX: number;
  startValue: number;
  lastValue: number;
  moved: boolean;
}

const DRAG_THRESHOLD = 3;

export function NumberField({
  label, tag, axis, value, onChange, onBeginChange, onCommit,
  min, max, step = 0.01, bigStep, fineStep, precision = 2, unit,
  scrubPixelsPerStep = 4, hideTag = false, disabled = false, id, className,
}: NumberFieldProps) {
  const big = bigStep ?? step * 10;
  const fine = fineStep ?? step / 10;
  const decimals = Math.max(precision, decimalsFor(fine));
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const scrubRef = useRef<ScrubState | null>(null);
  // Mirrors `draft` so handlers see edits made before the next render. Non-null only after an input event.
  const draftRef = useRef<string | null>(null);
  const [draft, setDraftState] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);

  const setDraft = (next: string | null) => {
    draftRef.current = next;
    setDraftState(next);
  };

  const clamp = (next: number) => {
    let result = next;
    if (min !== undefined) result = Math.max(min, result);
    if (max !== undefined) result = Math.min(max, result);
    return roundToStep(result, decimals);
  };

  const applyDiscrete = (next: number) => {
    const clamped = clamp(next);
    if (clamped === value) return;
    onBeginChange?.();
    onChange(clamped);
    onCommit?.();
  };

  const commitDraft = (fromBlur: boolean) => {
    const pending = draftRef.current;
    if (pending === null) return;
    const parsed = parseNumberInput(pending);
    if (parsed === null) {
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
    applyDiscrete(parsed);
  };

  const stepBy = (delta: number) => {
    const pending = draftRef.current;
    const base = pending !== null ? parseNumberInput(pending) ?? value : value;
    setDraft(null);
    setInvalid(false);
    applyDiscrete(base + delta);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const unitStep = event.shiftKey ? big : event.altKey ? fine : step;
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        commitDraft(false);
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        if (draftRef.current !== null) {
          setDraft(null);
          setInvalid(false);
          // Restore the DOM value directly: no render may run between typing and Escape.
          if (inputRef.current) inputRef.current.value = value.toFixed(precision);
        } else {
          inputRef.current?.blur();
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        stepBy(unitStep);
        break;
      case 'ArrowDown':
        event.preventDefault();
        stepBy(-unitStep);
        break;
      case 'PageUp':
        event.preventDefault();
        stepBy(big);
        break;
      case 'PageDown':
        event.preventDefault();
        stepBy(-big);
        break;
      case 'Home':
        if (min !== undefined) {
          event.preventDefault();
          applyDiscrete(min);
        }
        break;
      case 'End':
        if (max !== undefined) {
          event.preventDefault();
          applyDiscrete(max);
        }
        break;
    }
  };

  const endScrub = () => {
    scrubRef.current = null;
    setScrubbing(false);
    document.body.classList.remove('is-scrubbing');
  };

  // While a drag is live, Esc restores the starting value. The listener runs in the
  // capture phase on window so lesson-level Esc handlers never see the key.
  useEffect(() => {
    if (!scrubbing) return;
    const onWindowKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const scrub = scrubRef.current;
      if (!scrub) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();
      onChange(scrub.startValue);
      endScrub();
      onCommit?.();
    };
    window.addEventListener('keydown', onWindowKey, true);
    return () => window.removeEventListener('keydown', onWindowKey, true);
  }, [scrubbing, onChange, onCommit]);

  // A field removed mid-drag (a lesson step, a deselect) must not leave the page in scrub mode.
  useEffect(() => {
    if (!scrubbing) return;
    return () => document.body.classList.remove('is-scrubbing');
  }, [scrubbing]);

  // Native blur listener: preact/compat maps onBlur to focusout, which a plain blur event never reaches.
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const onBlur = () => commitDraft(true);
    input.addEventListener('blur', onBlur);
    return () => input.removeEventListener('blur', onBlur);
  });

  const onTagPointerDown = (event: PointerEvent) => {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget as Element | null;
    target?.setPointerCapture?.(event.pointerId);
    // A typed value that was never committed is dropped, so the blur after the scrub cannot undo it.
    if (draftRef.current !== null) {
      setDraft(null);
      setInvalid(false);
    }
    scrubRef.current = { startX: event.clientX, startValue: value, lastValue: value, moved: false };
  };

  const onTagPointerMove = (event: PointerEvent) => {
    const scrub = scrubRef.current;
    if (!scrub) return;
    const dx = event.clientX - scrub.startX;
    if (!scrub.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      scrub.moved = true;
      onBeginChange?.();
      setScrubbing(true);
      document.body.classList.add('is-scrubbing');
    }
    const unitStep = event.shiftKey ? big : event.altKey ? fine : step;
    const next = clamp(scrub.startValue + Math.trunc(dx / scrubPixelsPerStep) * unitStep);
    if (next !== scrub.lastValue) {
      scrub.lastValue = next;
      onChange(next);
    }
  };

  const onTagPointerUp = (event: PointerEvent) => {
    const scrub = scrubRef.current;
    const target = event.currentTarget as Element | null;
    if (target?.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId);
    if (!scrub) return;
    if (scrub.moved) {
      endScrub();
      onCommit?.();
    } else {
      scrubRef.current = null;
      inputRef.current?.focus();
    }
  };

  const shown = draft ?? value.toFixed(precision);
  const classes = [
    'vnum',
    axis ? `vnum--${axis}` : '',
    scrubbing ? 'is-scrubbing' : '',
    invalid ? 'is-invalid' : '',
    hideTag ? 'vnum--bare' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="vnum__box">
        {!hideTag && (
          <button
            type="button"
            className="vnum__tag"
            tabIndex={-1}
            aria-hidden="true"
            title="Drag to change, click to type"
            disabled={disabled}
            onPointerDown={onTagPointerDown}
            onPointerMove={onTagPointerMove}
            onPointerUp={onTagPointerUp}
            onPointerCancel={onTagPointerUp}
          >
            {tag ?? label}
          </button>
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="decimal"
          role="spinbutton"
          className="vnum__input"
          aria-label={label}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuetext={unit ? `${value.toFixed(precision)} ${unit}` : value.toFixed(precision)}
          aria-invalid={invalid ? 'true' : undefined}
          aria-describedby={invalid ? errorId : undefined}
          value={shown}
          disabled={disabled}
          onFocus={() => {
            requestAnimationFrame(() => inputRef.current?.select());
          }}
          onInput={(event) => {
            setDraft((event.currentTarget as HTMLInputElement).value);
            setInvalid(false);
          }}
          onKeyDown={onKeyDown}
        />
        {unit && <span className="vnum__unit" aria-hidden="true">{unit}</span>}
      </div>
      {invalid && (
        <span id={errorId} className="vnum__error" role="alert">Enter a number</span>
      )}
    </div>
  );
}
