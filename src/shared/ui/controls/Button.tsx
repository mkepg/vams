import { forwardRef } from 'react';
import type { ComponentChildren } from 'preact';
import './button.scss';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  icon?: ComponentChildren;
  /** Puts the icon after the label, for a forward action. */
  iconAfter?: boolean;
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
  'aria-describedby'?: string;
  /** Looks off but stays focusable and clickable, so it can still explain itself. */
  'aria-disabled'?: 'true' | 'false';
  /** Lets the first-visit tour find this control. */
  'data-tour-anchor'?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconAfter = false, iconOnly = false, label, children, className, type = 'button', title, ...rest },
  ref,
) {
  const classes = ['vbtn', `vbtn--${variant}`, `vbtn--${size}`, iconOnly ? 'vbtn--icon' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  const iconSpan = icon ? <span className="vbtn__icon" aria-hidden="true">{icon}</span> : null;
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={classes}
      aria-label={iconOnly ? label : rest['aria-label']}
      title={title ?? (iconOnly ? label : undefined)}
    >
      {icon && !iconAfter && iconSpan}
      {!iconOnly && children}
      {icon && iconAfter && iconSpan}
    </button>
  );
});
