import { useCallback } from 'react';
import { toast } from 'sonner';
import { useVamsStore } from '@/core/store';
import { isSceneEmpty } from '@/entities/project/model/scene-empty';
import { confirm } from '@/shared/ui/confirm-dialog/confirm-store';

/**
 * Returns the New workspace action. `beforeReset` keeps the current scene in
 * My scenes; a rejection cancels the reset.
 */
export function useNewWorkspace(beforeReset: () => Promise<unknown>): () => Promise<void> {
  return useCallback(async () => {
    if (isSceneEmpty(useVamsStore.getState())) return;
    const proceed = await confirm({
      title: 'Start a new workspace?',
      message: 'Your current scene will be kept in My scenes as a backup.',
      confirmLabel: 'New workspace',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!proceed) return;
    try {
      await beforeReset();
    } catch (error) {
      console.error(error);
      toast.error("Couldn't keep a backup of the current scene, so the workspace was not cleared.");
      return;
    }
    useVamsStore.setState({
      objects: [],
      selectedObjectId: null,
      pendingShapeType: null,
      pendingVertices: [],
      interactionMode: 'SELECT',
      selectedVertexId: null,
      callbacks: { keyboard: '', mouse: '', reshape: '', motion: '', idle: '' },
      viewportLimits: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
      uploadedTextures: [],
    });
    const state = useVamsStore.getState();
    state.setCanvasBackgroundColor('#000000');
    state.clearHistory();
    toast.success('New workspace created');
  }, [beforeReset]);
}
