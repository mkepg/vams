/**
 * Whether the browser accepted the last autosave. The store's storage adapter reports every write
 * here, and the editor listens so a full or blocked localStorage never loses work in silence.
 */
type Listener = (failing: boolean) => void;

let failing = false;
const listeners = new Set<Listener>();

/** Record one autosave write; listeners hear only when the outcome changes. */
export function reportSaveResult(ok: boolean): void {
  if (failing === !ok) return;
  failing = !ok;
  listeners.forEach((listener) => listener(failing));
}

export function saveFailing(): boolean {
  return failing;
}

export function subscribeSaveHealth(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
