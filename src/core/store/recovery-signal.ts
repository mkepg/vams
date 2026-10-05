/**
 * Saved editor data that failed to load. The store hands it here instead of deleting it, and
 * the editor collects it once on mount to keep a copy in My scenes.
 */
let pending: string | null = null;

export function reportCorruptSave(raw: string | null): void {
  if (raw) pending = raw;
}

/** Read the pending text without consuming it, for a recovery path that runs before the editor collects it. */
export function peekCorruptSave(): string | null {
  return pending;
}

export function takeCorruptSave(): string | null {
  const raw = pending;
  pending = null;
  return raw;
}
