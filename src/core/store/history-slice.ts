import { produce, enableMapSet } from 'immer';
import type { StateCreator } from 'zustand';
import type { VamsState, HistorySlice, HistorySnapshot } from '@/core/store/types';

enableMapSet();

const HISTORY_THROTTLE_MS = 50;

const createSnapshot = (state: VamsState): HistorySnapshot => ({
  objects: state.objects,
  selectedObjectId: state.selectedObjectId,
  interactionMode: state.interactionMode,
  selectedVertexId: state.selectedVertexId,
  pendingShapeType: state.pendingShapeType,
  pendingVertices: state.pendingVertices,
  pendingMinVertices: state.pendingMinVertices,
  pendingVertexStride: state.pendingVertexStride,
  callbacks: state.callbacks,
  uploadedTextures: state.uploadedTextures,
  timestamp: Date.now(),
});

const restoreSnapshot = (snapshot: HistorySnapshot): Partial<VamsState> => ({
  objects: snapshot.objects,
  selectedObjectId: snapshot.selectedObjectId,
  interactionMode: snapshot.interactionMode,
  selectedVertexId: snapshot.selectedVertexId,
  pendingShapeType: snapshot.pendingShapeType,
  pendingVertices: snapshot.pendingVertices,
  pendingMinVertices: snapshot.pendingMinVertices,
  pendingVertexStride: snapshot.pendingVertexStride,
  callbacks: snapshot.callbacks,
  uploadedTextures: snapshot.uploadedTextures,
});

export const createHistorySlice: StateCreator<VamsState, [], [], HistorySlice> = (set, get) => ({
  past: [],
  future: [],
  maxHistorySize: 30,
  isBatchMode: false,

  startBatch: () => {
    set({ isBatchMode: true });
  },
  endBatch: () => {
    set({ isBatchMode: false });
  },

  pushToHistory: () => {
    const state = get();
    if (state.isBatchMode) {
      return;
    }

    const snapshotTimestamp = Date.now();
    const snapshot: HistorySnapshot = {
      objects: state.objects,
      selectedObjectId: state.selectedObjectId,
      interactionMode: state.interactionMode,
      selectedVertexId: state.selectedVertexId,
      pendingShapeType: state.pendingShapeType,
      pendingVertices: state.pendingVertices,
      pendingMinVertices: state.pendingMinVertices,
      pendingVertexStride: state.pendingVertexStride,
      callbacks: state.callbacks,
      uploadedTextures: state.uploadedTextures,
      timestamp: snapshotTimestamp,
    };

    set(
      produce((draft: VamsState) => {
        const lastPast = draft.past[draft.past.length - 1];
        if (lastPast && snapshotTimestamp - lastPast.timestamp < HISTORY_THROTTLE_MS) {
          return;
        }

        draft.past.push(snapshot);
        draft.future = [];

        if (draft.past.length > draft.maxHistorySize) {
          draft.past.shift();
        }
      })
    );
  },

  undo: () => {
    const state = get();
    if (state.past.length === 0) {
      return;
    }

    set(
      produce((draft: VamsState) => {
        const previousSnapshot = draft.past.pop()!;
        const currentSnapshot = createSnapshot(state);

        draft.future.push(currentSnapshot);

        const restoredState = restoreSnapshot(previousSnapshot);
        Object.assign(draft, restoredState);
      })
    );
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) {
      return;
    }

    set(
      produce((draft: VamsState) => {
        const nextSnapshot = draft.future.pop()!;
        const currentSnapshot = createSnapshot(state);

        draft.past.push(currentSnapshot);

        const restoredState = restoreSnapshot(nextSnapshot);
        Object.assign(draft, restoredState);
      })
    );
  },

  canUndo: () => {
    const state = get();
    return state.past.length > 0;
  },
  canRedo: () => {
    const state = get();
    return state.future.length > 0;
  },

  clearHistory: () => {
    set(
      produce((draft: VamsState) => {
        draft.past = [];
        draft.future = [];
      })
    );
  },
});