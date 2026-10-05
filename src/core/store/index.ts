import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
import { reportCorruptSave } from '@/core/store/recovery-signal';

enableMapSet();
export const STORAGE_KEY = 'vams-storage';
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
      resetProject: () => {
        localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
      }
    }),
    {
      name: STORAGE_KEY,
      version: 7,
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
export type { VamsState } from '@/core/store/types';