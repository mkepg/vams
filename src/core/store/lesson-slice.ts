import type { StateCreator } from 'zustand';
import type { VamsState, LessonSlice } from '@/core/store/types';
import type { GlutCallbackKind, ViewportLimits } from '@/core/types/scene';
import { DEFAULT_OPEN_GROUPS } from '@/core/inspector/groups';
const EMPTY_CALLBACKS: Record<GlutCallbackKind, string> = {
  keyboard: '',
  mouse: '',
  reshape: '',
  motion: '',
  idle: '',
};
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
  dmaDriverStep: null,
  changedCodeLines: [],
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
        objects: [],
        callbacks: { ...EMPTY_CALLBACKS },
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
  setLessonFocusPanel: (panelId) => set({ lessonFocusPanel: panelId, mathTabOverride: null }),
  setDmaDriverStep: (index) => set({ dmaDriverStep: index }),
  setChangedCodeLines: (lines) => set({ changedCodeLines: lines }),
  clearLessonState: () => {
    const state = get();
    set({
      pipelineMode: 'Playground',
      activePipelineStage: null,
      mathTabOverride: null,
      // Leaving a lesson leaves the plain editor: the demo's collapsed groups open again.
      openGroups: [...DEFAULT_OPEN_GROUPS],
      lastOpenedGroup: null,
      activeLessonId: null,
      currentStepIndex: 0,
      exerciseAnswers: {},
      isSuccess: false,
      objects: state.sceneBackup || [],
      callbacks: state.callbacksBackup || { ...EMPTY_CALLBACKS },
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
      dmaDriverStep: null,
      changedCodeLines: [],
    });
  },
});