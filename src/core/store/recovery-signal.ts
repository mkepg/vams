/**
 * Saved editor data that failed to load. The store hands it here instead of deleting it, and
 * the editor collects it once on mount to keep a copy in My scenes.
 */
let pending: string | null = null;

export function reportCorruptSave(raw: string | null): void {
  if (raw) pending = raw;
}

export function takeCorruptSave(): string | null {
  const raw = pending;
  pending = null;
  return raw;
}
