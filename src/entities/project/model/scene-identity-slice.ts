import type { StateCreator } from 'zustand';
import type { SceneIdentitySlice, VamsState } from '@/core/store/types';
import { createSceneId, normalizeSceneName, sceneIdentity } from './scene-library';

export const createSceneIdentitySlice: StateCreator<VamsState, [], [], SceneIdentitySlice> = (set, get) => ({
  ...sceneIdentity(),
  renameScene: (name) => set({ sceneName: normalizeSceneName(name) }),
  ensureSceneId: () => {
    if (!get().sceneId) set({ sceneId: createSceneId() });
  },
});
