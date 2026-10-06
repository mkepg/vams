import { useEffect, useId, useRef } from 'react';
import { NumberField } from './NumberField';
import './fields.scss';

export interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  onBeginChange?: () => void;
  onCommit?: () => void;
  precision?: number;
  unit?: string;
  id?: string;
  className?: string;
}

const RANGE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']);

export function SliderField({
  label, value, min, max, step, onChange, onBeginChange, onCommit, precision = 2, unit, id, className,
}: SliderFieldProps) {
  const autoId = useId();
  const rangeId = id ?? autoId;
  const rangeRef = useRef<HTMLInputElement>(null);

  // Native change listener: preact/compat rewrites onChange on a range input to oninput,
  // which would fire onCommit on every tick instead of once when the drag ends.
  useEffect(() => {
    const range = rangeRef.current;
    if (!range) return;
    const onNativeChange = () => onCommit?.();
    range.addEventListener('change', onNativeChange);
    return () => range.removeEventListener('change', onNativeChange);
  });

  return (
    <div className={className ? `vslider ${className}` : 'vslider'}>
      <label className="vfield-label" htmlFor={rangeId}>{label}</label>
      <div className="vslider__track">
        <input
          ref={rangeRef}
          id={rangeId}
          type="range"
          className="vslider__range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-valuetext={unit ? `${value.toFixed(precision)} ${unit}` : value.toFixed(precision)}
          onPointerDown={() => onBeginChange?.()}
          onKeyDown={(event) => {
            if (RANGE_KEYS.has(event.key)) onBeginChange?.();
          }}
          onInput={(event) => onChange(Number((event.currentTarget as HTMLInputElement).value))}
        />
        <span className="vslider__ends" aria-hidden="true">
          <span>{min}</span>
          <span>{max}</span>
        </span>
      </div>
      <NumberField
        label={`${label}, exact value`}
        hideTag
        value={value}
        min={min}
        max={max}
        step={step}
        precision={precision}
        unit={unit}
        onChange={onChange}
        onBeginChange={onBeginChange}
        onCommit={onCommit}
      />
    </div>
  );
}
