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

enableMapSet();
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
        localStorage.removeItem('vams-storage');
        window.location.reload();
      }
    }),
    {
      name: 'vams-storage',
      version: 7,
      onRehydrateStorage: () => {
        return (_rehydratedState, error) => {
          if (error) {
            console.error('Storage hydration failed. State may be corrupt. Triggering automatic reset.', error);
            localStorage.removeItem('vams-storage');
            window.location.reload();
          }
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
      }),
    }
  )
);
export type { VamsState } from '@/core/store/types';