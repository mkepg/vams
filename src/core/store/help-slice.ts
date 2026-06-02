import type { StateCreator } from 'zustand';
import type { HelpSlice, VamsState } from '@/core/store/types';

/**
 * Session state for the Help Center. Kept in the global store so Help can be
 * opened from anywhere (top bar, the ?/F1 hotkey, future inline panel hints)
 * without prop-drilling.
 *
 * Only `hasSeenWelcome` is persisted (see partialize in store/index.ts);
 * open/close/navigation are intentionally session-only.
 *
 * The slice stores topic ids as opaque strings to avoid an upward dependency
 * from `core` onto the `help` feature; the UI layer resolves section → topic
 * via the help feature's content helpers.
 */
export const createHelpSlice: StateCreator<VamsState, [], [], HelpSlice> = (set, get) => ({
  isHelpOpen: false,
  activeHelpTopicId: null,
  helpHistory: [],
  hasSeenWelcome: false,

  openHelp: (topicId) =>
    set({
      isHelpOpen: true,
      // When a topic is given we deep-link to it; otherwise the Help Center
      // resolves a sensible default from the active section on mount.
      activeHelpTopicId: topicId ?? get().activeHelpTopicId,
      helpHistory: topicId ? [topicId] : [],
    }),

  closeHelp: () => set({ isHelpOpen: false }),

  navigateHelp: (topicId) =>
    set((state) => ({
      activeHelpTopicId: topicId,
      helpHistory:
        state.activeHelpTopicId && state.activeHelpTopicId !== topicId
          ? [...state.helpHistory, state.activeHelpTopicId]
          : state.helpHistory,
    })),

  helpBack: () =>
    set((state) => {
      if (state.helpHistory.length === 0) return state;
      const history = [...state.helpHistory];
      const previous = history.pop()!;
      return { activeHelpTopicId: previous, helpHistory: history };
    }),

  markWelcomeSeen: () => set({ hasSeenWelcome: true }),
});
