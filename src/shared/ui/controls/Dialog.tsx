import { useEffect, useRef } from 'react';
import type { ComponentChildren } from 'preact';
import { focusableWithin, trapTab } from './focus-trap';
import './dialog.scss';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** id of the element that names the dialog */
  labelledBy: string;
  describedBy?: string;
  role?: 'dialog' | 'alertdialog';
  initialFocusRef?: { current: HTMLElement | null };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Runs before the built-in Escape/Tab handling; call preventDefault() to skip it. */
  onKeyDown?: (event: KeyboardEvent) => void;
  children: ComponentChildren;
}

export function Dialog(props: DialogProps) {
  if (!props.open) return null;
  return <DialogSurface {...props} />;
}

function DialogSurface({
  onClose, labelledBy, describedBy, role = 'dialog', initialFocusRef, size = 'md', className, onKeyDown, children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const target = initialFocusRef?.current ?? focusableWithin(panelRef.current)[0] ?? panelRef.current;
    target?.focus();
    return () => {
      if (previous && previous.isConnected) previous.focus();
    };
  }, [initialFocusRef]);

  const handleKeyDown = (event: KeyboardEvent) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (event.key === 'Tab') {
      trapTab(event, panelRef.current);
    }
  };

  return (
    <div
      className="vdialog-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={['vdialog', `vdialog--${size}`, className ?? ''].filter(Boolean).join(' ')}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
