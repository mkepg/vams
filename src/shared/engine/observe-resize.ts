/**
 * Calls `onResize` whenever `el` changes size, whatever caused it (a panel hidden, the lesson bar
 * folded), not only when the window resizes. Returns the cleanup.
 */
export function observeResize(el: Element, onResize: () => void): () => void {
  if (typeof ResizeObserver === 'undefined') return () => {};
  const observer = new ResizeObserver(() => onResize());
  observer.observe(el);
  return () => observer.disconnect();
}
