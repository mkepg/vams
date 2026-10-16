import { create } from 'zustand';
import { STAGE_MARGIN, centredRect, clampRect, type Rect, type Size } from './program-window';

export type WindowMode = 'floating' | 'maximised' | 'minimised' | 'closed';

interface ProgramWindowState {
  mode: WindowMode;
  /** What the window returns to when it is shown again. */
  shownAs: 'floating' | 'maximised';
  /** The floating window's place on the stage; null until the stage has been measured. */
  rect: Rect | null;
  stage: Size | null;
  /** True once the student has moved or resized the window; until then it stays centred. */
  placedByUser: boolean;
  setStage: (stage: Size) => void;
  moveTo: (x: number, y: number) => void;
  resizeTo: (rect: Rect) => void;
  minimise: () => void;
  toggleMaximise: () => void;
  close: () => void;
  show: () => void;
  reset: () => void;
}

const initial = {
  mode: 'floating' as WindowMode,
  shownAs: 'floating' as const,
  rect: null,
  stage: null,
  placedByUser: false,
};

/** The program window's place and state. Runtime only: it is never saved, and the code never reads it. */
export const useProgramWindow = create<ProgramWindowState>((set, get) => ({
  ...initial,
  setStage: (stage) => {
    // A read with a zero side means the stage is not laid out right now; keep what we have.
    if (stage.width <= 0 || stage.height <= 0) return;
    const { rect, placedByUser } = get();
    set({ stage, rect: rect && placedByUser ? clampRect(rect, stage) : centredRect(stage, STAGE_MARGIN) });
  },
  moveTo: (x, y) => {
    const { rect, stage } = get();
    if (!rect || !stage) return;
    set({ rect: clampRect({ ...rect, x, y }, stage), placedByUser: true });
  },
  resizeTo: (next) => {
    const { stage } = get();
    if (!stage) return;
    set({ rect: clampRect(next, stage), placedByUser: true });
  },
  minimise: () => set({ mode: 'minimised' }),
  toggleMaximise: () => set((s) => {
    if (s.mode === 'maximised') return { mode: 'floating', shownAs: 'floating' };
    if (s.mode === 'floating') return { mode: 'maximised', shownAs: 'maximised' };
    return s;
  }),
  close: () => set({ mode: 'closed' }),
  show: () => set((s) => (s.mode === 'minimised' || s.mode === 'closed' ? { mode: s.shownAs } : s)),
  reset: () => set(initial),
}));
