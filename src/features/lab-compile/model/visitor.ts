const KEY = 'vams-lab-visitor';

let fallback: string | null = null;

function randomId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/** This browser's random id. The compile service counts a browser's compiles with it. */
export function visitorId(): string {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) return stored;
    const id = randomId();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    // Blocked storage: the id lasts for this page load.
    return (fallback ??= randomId());
  }
}
