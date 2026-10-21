import type { StateCreator } from 'zustand';
import type { VamsState, LessonSlice } from '@/core/store/types';
import type { ViewportLimits } from '@/core/types/scene';
import { DEFAULT_OPEN_GROUPS } from '@/core/inspector/groups';
import { railPanelFor, resolveFocus } from '@/core/inspector/focus-map';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
const DEFAULT_VIEWPORT: ViewportLimits = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
export const createLessonSlice: StateCreator<VamsState, [], [], LessonSlice> = (set, get) => ({
  activeLessonId: null,
  currentStepIndex: 0,
  exerciseAnswers: {},
  isSuccess: false,
  sceneBackup: null,
  callbacksBackup: null,
  canvasBackgroundColorBackup: null,
  viewportLimitsBackup: null,
  uploadedTexturesBackup: null,
  lessonFocusPanel: null,
  quizPipelineStage: null,
  dmaDriverStep: null,
  changedCodeLines: [],
  codeViewBeforeLesson: null,
  setActiveLesson: (lessonId) => {
    const state = get();
    if (lessonId && !state.activeLessonId) {
      set({
        activeLessonId: lessonId,
        currentStepIndex: 0,
        exerciseAnswers: {},
        isSuccess: false,
        sceneBackup: state.objects,
        callbacksBackup: state.callbacks,
        canvasBackgroundColorBackup: state.canvasBackgroundColor,
        viewportLimitsBackup: state.viewportLimits,
        uploadedTexturesBackup: state.uploadedTextures,
        codeViewBeforeLesson: { pane: state.codePane, hidden: state.codeHidden },
        objects: [],
        callbacks: emptyCallbacks(),
        canvasBackgroundColor: '#000000',
        viewportLimits: { ...DEFAULT_VIEWPORT },
        selectedObjectId: null,
        interactionMode: 'SELECT',
        lessonFocusPanel: null,
        dmaDriverStep: null,
        changedCodeLines: [],
        // A group opened before the lesson says nothing about the lesson's steps.
        lastOpenedGroup: null,
      });
    } else {
      set({
        activeLessonId: lessonId,
        lessonFocusPanel: null,
        dmaDriverStep: null,
        changedCodeLines: [],
      });
    }
  },
  setCurrentStep: (index) => set({ currentStepIndex: index }),
  setExerciseAnswer: (stepId, answer) => set((state) => ({
    exerciseAnswers: {
      ...state.exerciseAnswers,
      [stepId]: answer,
    },
  })),
  setSuccessState: (success) => set({ isSuccess: success }),
  // A step's control lives in one rail panel: show that panel, and open it if it was hidden.
  setLessonFocusPanel: (panelId) => set((state) => {
    const place = resolveFocus(panelId, state.selectedObjectId !== null);
    const panel = place ? railPanelFor(place) : null;
    return panel
      ? { lessonFocusPanel: panelId, journeyStageOverride: null, railPanel: panel, railHidden: false }
      : { lessonFocusPanel: panelId, journeyStageOverride: null };
  }),
  setQuizPipelineStage: (stage) => set({ quizPipelineStage: stage }),
  setDmaDriverStep: (index) => set({ dmaDriverStep: index }),
  setChangedCodeLines: (lines) => set({ changedCodeLines: lines }),
  clearLessonState: () => {
    const state = get();
    set({
      pipelineMode: 'Playground',
      activePipelineStage: null,
      journeyStageOverride: null,
      // Leaving a lesson leaves the plain editor: the demo's collapsed groups open again.
      openGroups: [...DEFAULT_OPEN_GROUPS],
      lastOpenedGroup: null,
      activeLessonId: null,
      currentStepIndex: 0,
      exerciseAnswers: {},
      isSuccess: false,
      objects: state.sceneBackup || [],
      callbacks: state.callbacksBackup || emptyCallbacks(),
      canvasBackgroundColor: state.canvasBackgroundColorBackup || '#000000',
      viewportLimits: state.viewportLimitsBackup || { ...DEFAULT_VIEWPORT },
      uploadedTextures: state.uploadedTexturesBackup ?? state.uploadedTextures,
      sceneBackup: null,
      callbacksBackup: null,
      canvasBackgroundColorBackup: null,
      viewportLimitsBackup: null,
      uploadedTexturesBackup: null,
      selectedObjectId: null,
      lessonFocusPanel: null,
      quizPipelineStage: null,
      dmaDriverStep: null,
      changedCodeLines: [],
      // The lesson may have switched the right column; give the student back their own view.
      ...(state.codeViewBeforeLesson
        ? { codePane: state.codeViewBeforeLesson.pane, codeHidden: state.codeViewBeforeLesson.hidden, codeChangedUnseen: false }
        : {}),
      codeViewBeforeLesson: null,
      // The student's own scene coming back is not an edit.
      sceneSwapSeq: state.sceneSwapSeq + 1,
    });
  },
});