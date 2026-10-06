import { createContext } from 'preact';

export interface PanelLayout {
  mode: 'author' | 'lesson';
  focusPanelId: string | null;
}

/** Set by the section column: in lesson mode only the step's focus panel starts open. */
export const PanelLayoutContext = createContext<PanelLayout>({ mode: 'author', focusPanelId: null });
