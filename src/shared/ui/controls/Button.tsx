import { forwardRef } from 'react';
import type { ComponentChildren } from 'preact';
import './button.scss';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  icon?: ComponentChildren;
  /** Renders only the icon; `label` becomes the accessible name and the tooltip. */
  iconOnly?: boolean;
  label?: string;
  children?: ComponentChildren;
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  title?: string;
  id?: string;
  onClick?: (event: MouseEvent) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  'aria-label'?: string;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: 'menu' | 'dialog';
  'aria-controls'?: string;
  'aria-pressed'?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconOnly = false, label, children, className, type = 'button', title, ...rest },
  ref,
) {
  const classes = ['vbtn', `vbtn--${variant}`, `vbtn--${size}`, iconOnly ? 'vbtn--icon' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={classes}
      aria-label={iconOnly ? label : rest['aria-label']}
      title={title ?? (iconOnly ? label : undefined)}
    >
      {icon && <span className="vbtn__icon" aria-hidden="true">{icon}</span>}
      {!iconOnly && children}
    </button>
  );
});
