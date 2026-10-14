/**
 * Makes everything on the page inert except the `open` elements (with what they contain) and the
 * `keep` elements. Elements that were inert already are left as they were. Returns the undo.
 */
export function inertOutside(open: readonly Element[], keep: readonly Element[]): () => void {
  const spared = [...open, ...keep];
  const changed: Element[] = [];
  const visit = (parent: Element) => {
    for (const child of Array.from(parent.children)) {
      if (spared.includes(child)) continue;
      if (spared.some((el) => child.contains(el))) {
        visit(child);
        continue;
      }
      if (child.hasAttribute('inert')) continue;
      child.setAttribute('inert', '');
      changed.push(child);
    }
  };
  visit(document.body);
  return () => changed.forEach((el) => el.removeAttribute('inert'));
}
