import { useId } from 'react';
import './fields.scss';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/** A labelled native select, styled like the other fields. */
export function SelectField<T extends string>({
  label, value, options, onChange, disabled = false, id, className,
}: SelectFieldProps<T>) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={className ? `vselect ${className}` : 'vselect'}>
      <label htmlFor={selectId} className="vfield-label">{label}</label>
      <select
        id={selectId}
        className="vfield-input"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange((event.currentTarget as HTMLSelectElement).value as T)}
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}
