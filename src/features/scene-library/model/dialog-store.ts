import { create } from 'zustand';

interface MyScenesDialogState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

/** Open state for My scenes, kept in a store so a toast action can open the dialog too. */
export const useMyScenesDialog = create<MyScenesDialogState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
