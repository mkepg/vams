import type { StateCreator } from 'zustand';
import type { VamsState, RuntimeSlice } from '@/core/store/types';
import { DEFAULT_OPEN_GROUPS, OBJECT_GROUPS } from '@/core/inspector/groups';

export const createRuntimeSlice: StateCreator<VamsState, [], [], RuntimeSlice> = (set) => ({
  appMode: 'Author',
  activeSection: 'Pipeline',
  pipelineMode: 'Playground',
  activePipelineStage: null,
  cursorWorld: null,
  openGroups: [...DEFAULT_OPEN_GROUPS],
  lastOpenedGroup: null,
  revealedGroup: null,
  journeyStageOverride: null,
  learnOpen: false,
  railPanel: 'add',
  railHidden: false,
  codePane: 'code',
  codeHidden: false,
  codeChangedUnseen: false,
  codeFoldsOpened: [],
  codeFoldsClosed: [],
  explainedLine: null,
  codeNotes: true,
  journeyVertex: 0,
  explainRequest: null,
  sceneSwapSeq: 0,

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
      revealedGroup: null,
      journeyStageOverride: null,
    };
  }),

  setPipelineMode: (mode) => set({ pipelineMode: mode }),
  setActivePipelineStage: (stageIndex) => set({ activePipelineStage: stageIndex }),
  setCursorWorld: (pos) => set({ cursorWorld: pos }),

  toggleGroup: (id) => set((state) => (
    state.openGroups.includes(id)
      ? { openGroups: state.openGroups.filter((group) => group !== id), revealedGroup: null }
      : { openGroups: [...state.openGroups, id], lastOpenedGroup: id, journeyStageOverride: null, revealedGroup: null }
  )),
  revealGroup: (group) => set((state) => ({
    railPanel: (OBJECT_GROUPS as readonly string[]).includes(group) ? 'scene' : group === 'callbacks' ? 'callbacks' : 'settings',
    railHidden: false,
    openGroups: state.openGroups.includes(group) ? state.openGroups : [...state.openGroups, group],
    revealedGroup: group,
  })),
  openGroup: (id) => set((state) => (state.openGroups.includes(id) ? {} : { openGroups: [...state.openGroups, id] })),
  setOpenGroups: (ids) => set({ openGroups: [...ids] }),
  setJourneyStageOverride: (stage) => set({ journeyStageOverride: stage }),
  setLearnOpen: (open) => set({ learnOpen: open }),
  setRailPanel: (panel) => set({ railPanel: panel, railHidden: false }),
  setRailHidden: (hidden) => set({ railHidden: hidden }),
  pickOpeningPanel: () => set((state) => ({ railPanel: state.objects.length > 0 ? 'scene' : 'add', railHidden: false })),
  setCodePane: (pane) => set(pane === 'code' ? { codePane: pane, codeChangedUnseen: false } : { codePane: pane }),
  setCodeHidden: (hidden) => set({ codeHidden: hidden }),
  markCodeChanged: () => set((state) => (state.codePane === 'math' && !state.codeChangedUnseen ? { codeChangedUnseen: true } : {})),
  toggleCodeFold: (block) => set((state) => (state.codeFoldsOpened.includes(block)
    ? { codeFoldsOpened: state.codeFoldsOpened.filter((id) => id !== block) }
    : {
      codeFoldsOpened: [...state.codeFoldsOpened, block],
      codeFoldsClosed: state.codeFoldsClosed.filter((id) => id !== block),
    })),
  foldCodeBlock: (block) => set((state) => ({
    codeFoldsOpened: state.codeFoldsOpened.filter((id) => id !== block),
    codeFoldsClosed: state.codeFoldsClosed.includes(block) ? state.codeFoldsClosed : [...state.codeFoldsClosed, block],
  })),
  setExplainedLine: (line) => set({ explainedLine: line }),
  setCodeNotes: (on) => set({ codeNotes: on }),
  requestExplain: (request) => set(request === null
    ? { explainRequest: null }
    : { explainRequest: typeof request === 'string' ? { call: request } : request, codePane: 'code', codeHidden: false, codeChangedUnseen: false }),
  markSceneSwap: () => set((state) => ({ sceneSwapSeq: state.sceneSwapSeq + 1 })),
  setJourneyVertex: (index) => set({ journeyVertex: Math.max(0, Math.floor(index)) }),
});
