import type { StateCreator } from 'zustand';
import type { VamsState, RuntimeSlice } from '@/core/store/types';
import { DEFAULT_OPEN_GROUPS } from '@/core/inspector/groups';

export const createRuntimeSlice: StateCreator<VamsState, [], [], RuntimeSlice> = (set) => ({
  appMode: 'Author',
  activeSection: 'Pipeline',
  pipelineMode: 'Playground',
  activePipelineStage: null,
  cursorWorld: null,
  openGroups: [...DEFAULT_OPEN_GROUPS],
  lastOpenedGroup: null,
  mathTabOverride: null,
  learnOpen: false,

  setAppMode: (mode) => set({ appMode: mode }),

  // The one place a section change resets state: view modes and transient panel state.
  setActiveSection: (section) => set((state) => {
    if (state.activeSection === section) return {};
    return {
      activeSection: section,
      pipelineMode: 'Playground',
      activePipelineStage: null,
      openGroups: [...DEFAULT_OPEN_GROUPS],
      lastOpenedGroup: null,
      mathTabOverride: null,
    };
  }),

  setPipelineMode: (mode) => set({ pipelineMode: mode }),
  setActivePipelineStage: (stageIndex) => set({ activePipelineStage: stageIndex }),
  setCursorWorld: (pos) => set({ cursorWorld: pos }),

  toggleGroup: (id) => set((state) => (
    state.openGroups.includes(id)
      ? { openGroups: state.openGroups.filter((group) => group !== id) }
      : { openGroups: [...state.openGroups, id], lastOpenedGroup: id, mathTabOverride: null }
  )),
  openGroup: (id) => set((state) => (state.openGroups.includes(id) ? {} : { openGroups: [...state.openGroups, id] })),
  setOpenGroups: (ids) => set({ openGroups: [...ids] }),
  setMathTabOverride: (section) => set({ mathTabOverride: section }),
  setLearnOpen: (open) => set({ learnOpen: open }),
});
