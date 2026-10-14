/** Gap left above the place scrolled to. */
const GAP = 8;

/**
 * Scrolls the editor column so `el` sits at the top of the column. Measured from the boxes, so it
 * works at any nesting depth.
 */
export function scrollUnderCard(el: HTMLElement | null | undefined) {
  const root = el?.closest<HTMLElement>('[data-scroll-root]');
  if (!el || !root) return;
  const offset = el.getBoundingClientRect().top - root.getBoundingClientRect().top;
  root.scrollTop = Math.max(0, root.scrollTop + offset - GAP);
}
