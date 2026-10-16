import type { StateCreator } from 'zustand';
import type { SceneNode } from '@/core/types/scene';
import type { TourBaseline, TourSlice, VamsState } from '@/core/store/types';

/** Build, Read, Change, Understand, Run, Learn. */
export const TOUR_STEP_COUNT = 6;
const BUILD = 0;
const CHANGE = 2;
const UNDERSTAND = 3;

/** The object the Change step works on: the selection, else the triangle built in step 1, else the first shape. */
function changeTarget(state: VamsState, buildIds: readonly string[]): SceneNode | undefined {
  const selected = state.objects.find((o) => o.id === state.selectedObjectId);
  if (selected) return selected;
  const built = state.objects.find((o) => o.type === 'TRIANGLES' && !buildIds.includes(o.id));
  return built ?? state.objects.find((o) => o.type !== 'GROUP') ?? state.objects[0];
}

/** The state a step opens with: its baseline, and the panel it shows. */
function enterStep(state: VamsState, index: number): Partial<VamsState> {
  const buildIds = index === BUILD || !state.tourStepBaseline
    ? state.objects.map((o) => o.id)
    : state.tourStepBaseline.buildIds;
  const baseline: TourBaseline = { buildIds, objectId: null, translateX: null };
  if (index === BUILD) return { tourStep: index, tourStepBaseline: baseline, railPanel: 'add', railHidden: false };
  if (index === CHANGE) {
    const target = changeTarget(state, buildIds);
    return {
      tourStep: index,
      tourStepBaseline: { ...baseline, objectId: target?.id ?? null, translateX: target?.transform.translateX ?? null },
      railPanel: 'scene',
      railHidden: false,
      ...(target && target.id !== state.selectedObjectId ? { selectedObjectId: target.id, selectedVertexId: null } : {}),
    };
  }
  // Changing X opens no group (Transform starts open), so the Understand step opens the stage its caption names.
  if (index === UNDERSTAND) return { tourStep: index, tourStepBaseline: baseline, journeyStageOverride: 'transformed' };
  return { tourStep: index, tourStepBaseline: baseline };
}

/** Moving through the tour cancels a half-placed shape, as Esc does. */
function stopPlacing(state: VamsState) {
  if (state.interactionMode === 'VERTEX_PLACE' || state.pendingShapeType !== null) state.cancelCustomShape();
}

export const createTourSlice: StateCreator<VamsState, [], [], TourSlice> = (set, get) => ({
  tourStep: null,
  railBeforeTour: null,
  tourStepBaseline: null,

  // The tour runs on the student's own scene in Author mode, with the panel and the code in view.
  startTour: () => {
    const state = get();
    if (state.appMode === 'Lesson') return;
    set({
      railBeforeTour: state.tourStep === null ? state.railPanel : state.railBeforeTour,
      codeHidden: false,
      codePane: 'code',
      codeChangedUnseen: false,
      tourStepBaseline: null,
    });
    set(enterStep(get(), BUILD));
  },

  nextTourStep: () => {
    const step = get().tourStep;
    if (step === null || step >= TOUR_STEP_COUNT - 1) return;
    stopPlacing(get());
    set(enterStep(get(), step + 1));
  },

  prevTourStep: () => {
    const step = get().tourStep;
    if (step === null || step === 0) return;
    stopPlacing(get());
    set(enterStep(get(), step - 1));
  },

  endTour: ({ restoreRail = true } = {}) => {
    const state = get();
    if (state.tourStep === null) return;
    stopPlacing(state);
    set({
      tourStep: null,
      tourStepBaseline: null,
      railBeforeTour: null,
      journeyStageOverride: null,
      ...(restoreRail && state.railBeforeTour ? { railPanel: state.railBeforeTour } : {}),
    });
  },
});
