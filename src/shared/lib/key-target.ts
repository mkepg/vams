/** True when a key was pressed in a field the student types into: input, textarea, select or contenteditable. */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  const tag = el?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(el?.isContentEditable);
}

/** True when a key was pressed inside a menu, where the arrow, Enter and Escape keys belong to the menu. */
export function isMenuTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return typeof el?.closest === 'function' && el.closest('[role="menu"]') !== null;
}
