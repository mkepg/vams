/** Gap left between the sticky lesson card and the place scrolled under it. */
const GAP = 8;

/**
 * Scrolls the editor column so `el` sits just under the sticky lesson card, or at the top of the
 * column outside a lesson. Measured from the boxes, so it works at any nesting depth.
 */
export function scrollUnderCard(el: HTMLElement | null | undefined) {
  const root = el?.closest<HTMLElement>('[data-scroll-root]');
  if (!el || !root) return;
  const head = root.querySelector<HTMLElement>('.editor-column__head');
  const offset = el.getBoundingClientRect().top - root.getBoundingClientRect().top;
  root.scrollTop = Math.max(0, root.scrollTop + offset - (head?.offsetHeight ?? 0) - GAP);
}
