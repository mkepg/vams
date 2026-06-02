import { useEffect } from 'react';
import { toast } from 'sonner';
import { useVamsStore } from '@/core/store';

/**
 * Global keyboard shortcuts. This is the single source of truth for app-level
 * shortcuts; mode-specific keys (vertex placement) live in the canvas
 * interaction hook. Keep this in sync with the help shortcut table
 * ([shortcuts.ts](src/features/help/model/shortcuts.ts)).
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      const state = useVamsStore.getState();

      // Don't hijack typing in form fields.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable;

      // Undo: Ctrl + Z
      if (isCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (state.canUndo()) {
          state.undo();
          toast.info('Undo');
        }
        return;
      }

      // Redo: Ctrl + Y or Ctrl + Shift + Z
      if ((isCtrl && e.key.toLowerCase() === 'y') || (isCtrl && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        if (state.canRedo()) {
          state.redo();
          toast.info('Redo');
        }
        return;
      }

      // Duplicate: Ctrl + D (Ctrl+V is reserved for paste and no longer duplicates)
      if (isCtrl && e.key.toLowerCase() === 'd') {
        if (state.selectedObjectId) {
          e.preventDefault();
          state.duplicateObject(state.selectedObjectId);
        }
        return;
      }

      // Delete: Delete key only (Backspace is left to the browser / text fields
      // to avoid accidental navigation and data loss).
      if (e.key === 'Delete' && !isTyping && state.selectedObjectId) {
        e.preventDefault();
        const obj = state.objects.find((o) => o.id === state.selectedObjectId);
        const name = obj?.textContent || obj?.name || 'Object';
        if (obj?.type === 'GROUP') {
          state.deleteGroup(state.selectedObjectId);
        } else {
          state.deleteObject(state.selectedObjectId);
        }
        toast(`Deleted “${name}”`, {
          action: { label: 'Undo', onClick: () => useVamsStore.getState().undo() },
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
