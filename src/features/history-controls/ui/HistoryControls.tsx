import { Undo, Redo } from 'lucide-react';
import { toast } from 'sonner';
import { useVamsStore } from '@/core/store';
import { Button } from '@/shared/ui/controls';

export default function HistoryControls() {
  const undo = useVamsStore((state) => state.undo);
  const redo = useVamsStore((state) => state.redo);
  // Subscribe to values, not to the canUndo/canRedo functions, so the buttons re-render.
  const canUndo = useVamsStore((state) => state.past.length > 0);
  const canRedo = useVamsStore((state) => state.future.length > 0);

  // Keyboard shortcuts (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z) are handled centrally in
  // useKeyboardShortcuts; these buttons are the pointer entry points.
  return (
    <>
      <Button
        variant="quiet"
        iconOnly
        label="Undo"
        title="Undo (Ctrl+Z)"
        icon={<Undo />}
        disabled={!canUndo}
        onClick={() => {
          undo();
          toast.info('Undo');
        }}
      />
      <Button
        variant="quiet"
        iconOnly
        label="Redo"
        title="Redo (Ctrl+Shift+Z)"
        icon={<Redo />}
        disabled={!canRedo}
        onClick={() => {
          redo();
          toast.info('Redo');
        }}
      />
    </>
  );
}
