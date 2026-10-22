import { create } from 'zustand';
import { STAGE_MARGIN, clampRect, fittedRect, type Rect, type Size } from './program-window';

export type WindowMode = 'floating' | 'maximised' | 'minimised' | 'closed';

interface ProgramWindowState {
  mode: WindowMode;
  /** What the window returns to when it is shown again. */
  shownAs: 'floating' | 'maximised';
  /** The floating window's place on the stage; null until the stage has been measured. */
  rect: Rect | null;
  stage: Size | null;
  /** True once the student has moved or resized the window; until then it stays fitted to the viewing volume. */
  placedByUser: boolean;
  /** The viewing volume's width over height; the window's body takes this shape. */
  aspect: number;
  setStage: (stage: Size) => void;
  setAspect: (aspect: number) => void;
  moveTo: (x: number, y: number) => void;
  resizeTo: (rect: Rect) => void;
  minimise: () => void;
  toggleMaximise: () => void;
  close: () => void;
  show: () => void;
  reset: () => void;
}

const sameRect = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

const initial = {
  mode: 'floating' as WindowMode,
  shownAs: 'floating' as const,
  rect: null,
  stage: null,
  placedByUser: false,
  aspect: 1,
};

/** The program window's place and state. Runtime only: it is never saved, and the code never reads it. */
export const useProgramWindow = create<ProgramWindowState>((set, get) => ({
  ...initial,
  setStage: (stage) => {
    // A read with a zero side means the stage is not laid out right now; keep what we have.
    if (stage.width <= 0 || stage.height <= 0) return;
    const { rect, placedByUser, aspect } = get();
    set({ stage, rect: rect && placedByUser ? clampRect(rect, stage) : fittedRect(stage, STAGE_MARGIN, aspect) });
  },
  setAspect: (aspect) => {
    const { stage, placedByUser } = get();
    if (!stage || placedByUser) return set({ aspect });
    set({ aspect, rect: fittedRect(stage, STAGE_MARGIN, aspect) });
  },
  moveTo: (x, y) => {
    const { rect, stage } = get();
    if (!rect || !stage) return;
    const next = clampRect({ ...rect, x, y }, stage);
    if (sameRect(next, rect)) return;
    set({ rect: next, placedByUser: true });
  },
  resizeTo: (next) => {
    const { rect, stage } = get();
    if (!stage) return;
    const clamped = clampRect(next, stage);
    if (rect && sameRect(clamped, rect)) return;
    set({ rect: clamped, placedByUser: true });
  },
  minimise: () => set({ mode: 'minimised' }),
  toggleMaximise: () => set((s) => {
    if (s.mode === 'maximised') {
      const refit = s.stage ? { rect: fittedRect(s.stage, STAGE_MARGIN, s.aspect) } : {};
      return { mode: 'floating', shownAs: 'floating', placedByUser: false, ...refit };
    }
    if (s.mode === 'floating') return { mode: 'maximised', shownAs: 'maximised' };
    return s;
  }),
  close: () => set({ mode: 'closed' }),
  show: () => set((s) => (s.mode === 'minimised' || s.mode === 'closed' ? { mode: s.shownAs } : s)),
  reset: () => set(initial),
}));
