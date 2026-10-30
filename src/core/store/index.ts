import { toHexColor } from '@/shared/lib/hex-color';
import { migratePersistedState } from '@/core/store/persist-migrate';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { enableMapSet } from 'immer';
import type { VamsState } from '@/core/store/types';
import { createSceneSlice } from '@/entities/scene/model/scene-slice';
import { createInteractionSlice } from '@/entities/scene/model/interaction-slice';
import { createViewportSlice } from '@/entities/scene/model/viewport-slice';
import { createSettingsSlice } from '@/core/store/settings-slice';
import { createCustomShapeBuilderSlice } from '@/features/custom-shapes/model/custom-shape-builder-slice';
import { createHistorySlice } from '@/core/store/history-slice';
import { createRuntimeSlice } from '@/core/store/runtime-slice';
import { createLessonSlice } from '@/core/store/lesson-slice';
import { createCallbacksSlice } from '@/core/store/callbacks-slice';
import { createTextureSlice } from '@/core/store/texture-slice';
import { createHelpSlice } from '@/core/store/help-slice';
import { createTourSlice } from '@/core/store/tour-slice';
import { createSceneIdentitySlice } from '@/entities/project/model/scene-identity-slice';
import { reportCorruptSave } from '@/core/store/recovery-signal';
import { reportSaveResult } from '@/core/store/save-health';
import { isSceneViewLoad } from '@/shared/lib/scene-view-load';

enableMapSet();
export const STORAGE_KEY = 'vams-storage';

/**
 * A full or blocked localStorage loses the autosave; it never breaks the action that triggered it.
 * Each write's outcome goes to save-health, so the editor can tell the student.
 */
const safeStorage: StateStorage = {
  getItem: (name) => localStorage.getItem(name),
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
      reportSaveResult(true);
    } catch {
      // Autosave is skipped for this change.
      reportSaveResult(false);
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // Nothing to remove if storage is blocked.
    }
  },
};

/** The phone scene view only shows a shared scene: it neither reads nor writes the visitor's saved editor. */
const NO_STORAGE: StateStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const pageStorage: StateStorage = isSceneViewLoad() ? NO_STORAGE : safeStorage;

export const useVamsStore = create<VamsState>()(
  persist(
    (...a) => ({
      ...createSceneSlice(...a),
      ...createInteractionSlice(...a),
      ...createViewportSlice(...a),
      ...createSettingsSlice(...a),
      ...createCustomShapeBuilderSlice(...a),
      ...createHistorySlice(...a),
      ...createRuntimeSlice(...a),
      ...createLessonSlice(...a),
      ...createCallbacksSlice(...a),
      ...createTextureSlice(...a),
      ...createHelpSlice(...a),
      ...createTourSlice(...a),
      ...createSceneIdentitySlice(...a),
      resetProject: () => {
        localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
      }
    }),
    {
      name: STORAGE_KEY,
      version: 11,
      migrate: (persisted, version) => migratePersistedState(persisted, version) as never,
      storage: createJSONStorage(() => pageStorage),
      onRehydrateStorage: () => {
        return (rehydratedState, error) => {
          if (error) {
            // Keep the unreadable text for the editor to back up, then start from a blank scene.
            console.error('Saved editor data could not be read; starting fresh and keeping a copy.', error);
            let raw: string | null = null;
            try {
              raw = localStorage.getItem(STORAGE_KEY);
              localStorage.removeItem(STORAGE_KEY);
            } catch {
              // Storage is unavailable; there is nothing to keep.
            }
            reportCorruptSave(raw);
            return;
          }
          // A lesson backup that survived a reload means the page reloaded mid-lesson:
          // put the student's own scene back and leave the lesson.
          if (rehydratedState?.sceneBackup) rehydratedState.clearLessonState();
          // A saved colour PixiJS cannot read would leave the canvas blank on every load.
          if (rehydratedState && toHexColor(rehydratedState.canvasBackgroundColor) !== rehydratedState.canvasBackgroundColor) {
            rehydratedState.setCanvasBackgroundColor('#000000');
          }
          rehydratedState?.ensureSceneId();
          rehydratedState?.pickOpeningPanel();
        };
      },
      partialize: (state) => ({
        theme: state.theme,
        learningSettings: state.learningSettings,
        axisVisibility: state.axisVisibility,
        showCoordinateTracker: state.showCoordinateTracker,
        objects: state.objects,
        viewportLimits: state.viewportLimits,
        canvasBackgroundColor: state.canvasBackgroundColor,
        activeSection: state.activeSection,
        callbacks: state.callbacks,
        uploadedTextures: state.uploadedTextures,
        hasSeenWelcome: state.hasSeenWelcome,
        sceneId: state.sceneId,
        sceneName: state.sceneName,
        sceneBackup: state.sceneBackup,
        callbacksBackup: state.callbacksBackup,
        canvasBackgroundColorBackup: state.canvasBackgroundColorBackup,
        viewportLimitsBackup: state.viewportLimitsBackup,
        // During a lesson the backup is the same array as uploadedTextures; saving it twice would double the stored images.
        uploadedTexturesBackup: state.uploadedTexturesBackup === state.uploadedTextures ? null : state.uploadedTexturesBackup,
      }),
    }
  )
);
// Selecting an object always shows it: the rail switches to Scene and the panel opens. Every path
// that selects (the canvas, the list, a new shape or text, duplicate, group, undo, redo and the
// lesson runner) goes through selectedObjectId, so the rule lives here once.
useVamsStore.subscribe((state, prev) => {
  if (!state.selectedObjectId || state.selectedObjectId === prev.selectedObjectId) return;
  if (state.railPanel !== 'scene' || state.railHidden) useVamsStore.setState({ railPanel: 'scene', railHidden: false });
});

// The code folds, the explanation strip and the followed vertex belong to the selected object.
// Any path that changes the selection (including clearing it) starts the new object fresh.
useVamsStore.subscribe((state, prev) => {
  if (state.selectedObjectId === prev.selectedObjectId) return;
  if (state.codeFoldsOpened.length === 0 && state.codeFoldsClosed.length === 0 && state.explainedLine === null && state.journeyVertex === 0 && state.revealedGroup === null) return;
  useVamsStore.setState({ codeFoldsOpened: [], codeFoldsClosed: [], explainedLine: null, journeyVertex: 0, revealedGroup: null });
});

// Starting a lesson ends the tour. The lesson's focus decides the rail, so the tour leaves it alone.
useVamsStore.subscribe((state, prev) => {
  if (state.tourStep !== null && state.appMode === 'Lesson' && prev.appMode !== 'Lesson') state.endTour({ restoreRail: false });
});

export type { VamsState } from '@/core/store/types';