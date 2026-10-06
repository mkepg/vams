import { useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Dialog } from '@/shared/ui/controls';
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
  const tone = options?.tone ?? 'default';

  return (
    <Dialog
      open
      role="alertdialog"
      size="sm"
      labelledBy="confirm-title"
      describedBy={options?.message ? 'confirm-message' : undefined}
      initialFocusRef={confirmRef}
      onClose={handleCancel}
      className="confirm-dialog"
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          handleConfirm();
        }
      }}
    >
      <div className="confirm-header">
        {tone === 'danger' && <AlertTriangle size={18} className="confirm-icon" aria-hidden />}
        <h2 id="confirm-title">{options?.title}</h2>
      </div>
      {options?.message && <p id="confirm-message" className="confirm-message">{options.message}</p>}
      <div className="confirm-actions">
        <Button onClick={handleCancel}>{options?.cancelLabel ?? 'Cancel'}</Button>
        <Button ref={confirmRef} variant={tone === 'danger' ? 'danger' : 'primary'} onClick={handleConfirm}>
          {options?.confirmLabel ?? 'Confirm'}
        </Button>
      </div>
    </Dialog>
  );
}
