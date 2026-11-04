import { del, get, set } from 'idb-keyval';

/**
 * The bytes of the student's files (images and text files), kept in IndexedDB under
 * `vams-lab-file:<name>`. Where IndexedDB is missing or refuses a file, the file is kept in memory
 * for the tab instead, so the list still works for this visit; the write reports that it failed.
 */
export const FILE_KEY_PREFIX = 'vams-lab-file:';

export const fileKey = (name: string) => `${FILE_KEY_PREFIX}${name}`;

/** Only the files IndexedDB refused. */
const memory = new Map<string, Uint8Array>();

const hasIndexedDb = () => typeof indexedDB !== 'undefined';

/** Keeps a file's bytes. Resolves false when IndexedDB couldn't keep them, so they last only for this visit. */
export async function writeFileBytes(name: string, bytes: Uint8Array): Promise<boolean> {
  if (hasIndexedDb()) {
    try {
      await set(fileKey(name), bytes);
      memory.delete(name);
      return true;
    } catch {
      // Kept in memory below.
    }
  }
  memory.set(name, bytes);
  return false;
}

export async function readFileBytes(name: string): Promise<Uint8Array | undefined> {
  const kept = memory.get(name);
  if (kept) return kept;
  if (!hasIndexedDb()) return undefined;
  try {
    const stored = await get<Uint8Array>(fileKey(name));
    return stored ? new Uint8Array(stored) : undefined;
  } catch {
    return undefined;
  }
}

export async function deleteFileBytes(name: string): Promise<void> {
  memory.delete(name);
  if (!hasIndexedDb()) return;
  try {
    await del(fileKey(name));
  } catch {
    // Nothing stored to remove.
  }
}
