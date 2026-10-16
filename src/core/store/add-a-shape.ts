import { useVamsStore } from '@/core/store';

/** Brings the Add panel up and puts focus on its first tile; the empty-scene card and Run both use it. */
export function addAShape() {
  useVamsStore.getState().setRailPanel('add');
  requestAnimationFrame(() => document.querySelector<HTMLElement>('#editor-panel .primitive-tile')?.focus());
}
