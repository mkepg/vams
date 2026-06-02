import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useConfirmStore } from './confirm-store';
import './confirm-dialog.scss';

/**
 * Single host for the imperative confirm() API. Mount once near the app root.
 */
export default function ConfirmDialog() {
  const open = useConfirmStore((s) => s.open);
  if (!open) return null;
  return <ConfirmDialogInner />;
}

function ConfirmDialogInner() {
  const options = useConfirmStore((s) => s.options);
  const handleConfirm = useConfirmStore((s) => s.handleConfirm);
  const handleCancel = useConfirmStore((s) => s.handleCancel);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => confirmRef.current?.focus());
    return () => previouslyFocused.current?.focus?.();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      handleCancel();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  };

  const tone = options?.tone ?? 'default';

  return (
    <div className="confirm-overlay" onMouseDown={handleCancel}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="confirm-header">
          {tone === 'danger' && <AlertTriangle size={18} className="confirm-icon" aria-hidden />}
          <h2 id="confirm-title">{options?.title}</h2>
        </div>
        {options?.message && <p className="confirm-message">{options.message}</p>}
        <div className="confirm-actions">
          <button type="button" className="confirm-btn cancel" onClick={handleCancel}>
            {options?.cancelLabel ?? 'Cancel'}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`confirm-btn confirm ${tone}`}
            onClick={handleConfirm}
          >
            {options?.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
