import './toggles.scss';

export interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Switch({ checked, onChange, label, disabled, id, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      className={className ? `vswitch ${className}` : 'vswitch'}
      onClick={() => onChange(!checked)}
    >
      <span className="vswitch__track" aria-hidden="true">
        <span className="vswitch__thumb" />
      </span>
      <span className="vswitch__label">{label}</span>
    </button>
  );
}
