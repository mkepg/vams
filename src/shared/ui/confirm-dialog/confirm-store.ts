import { create } from 'zustand';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  handleConfirm: () => void;
  handleCancel: () => void;
}

/**
 * Imperative, promise-based confirmation. Call `confirm({...})` from anywhere and
 * await the boolean result; a single <ConfirmDialog /> host (mounted in App)
 * renders the themed modal. Replaces blocking native `window.confirm`.
 */
export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  options: null,
  resolve: null,
  confirm: (options) =>
    new Promise<boolean>((resolve) => {
      set({ open: true, options, resolve });
    }),
  handleConfirm: () => {
    get().resolve?.(true);
    set({ open: false, resolve: null });
  },
  handleCancel: () => {
    get().resolve?.(false);
    set({ open: false, resolve: null });
  },
}));

/** Convenience wrapper so callers don't need the hook. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().confirm(options);
}
