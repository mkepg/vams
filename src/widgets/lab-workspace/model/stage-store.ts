import { create } from 'zustand';
import type { Size } from './stage-geometry';

interface LabStageState {
  /** The stage's size; null until it has been measured. */
  stage: Size | null;
  /** Where the student put the window's top-left corner; null while it stays where the program put it. */
  place: { x: number; y: number } | null;
  setStage: (stage: Size) => void;
  setPlace: (place: { x: number; y: number } | null) => void;
  reset: () => void;
}

/** The stage's size and the window's place on it. Runtime only: nothing here is saved. */
export const useLabStage = create<LabStageState>((set) => ({
  stage: null,
  place: null,
  setStage: (stage) => {
    // A read with a zero side means the stage is not laid out right now; keep what we have.
    if (stage.width > 0 && stage.height > 0) set({ stage: { width: Math.round(stage.width), height: Math.round(stage.height) } });
  },
  setPlace: (place) => set({ place }),
  reset: () => set({ stage: null, place: null }),
}));
