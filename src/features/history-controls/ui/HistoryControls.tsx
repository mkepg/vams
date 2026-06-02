import { Undo, Redo } from 'lucide-react';
import { toast } from 'sonner';
import { useVamsStore } from '@/core/store';

export default function HistoryControls() {
  const undo = useVamsStore((state) => state.undo);
  const redo = useVamsStore((state) => state.redo);
  const canUndo = useVamsStore((state) => state.canUndo);
  const canRedo = useVamsStore((state) => state.canRedo);

  // Keyboard shortcuts (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z) are handled centrally in
  // useKeyboardShortcuts; these buttons are the pointer entry points.

  const handleUndo = () => {
    if (!canUndo()) return;
    undo();
    toast.info('Undo');
  };

  const handleRedo = () => {
    if (!canRedo()) return;
    redo();
    toast.info('Redo');
  };

  return (
    <>
      <button
        className="icon-btn"
        onClick={handleUndo}
        disabled={!canUndo()}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
        style={{ opacity: canUndo() ? 1 : 0.5 }}
      >
        <Undo size={16} />
      </button>
      <button
        className="icon-btn"
        onClick={handleRedo}
        disabled={!canRedo()}
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
        style={{ opacity: canRedo() ? 1 : 0.5 }}
      >
        <Redo size={16} />
      </button>
    </>
  );
}