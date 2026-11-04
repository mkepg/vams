import { del, get, set } from 'idb-keyval';

/**
 * The bytes of the student's files (images and text files), kept in IndexedDB under
 * `vams-lab-file:<name>`. Where IndexedDB is missing or refuses, they are kept in memory for the
 * tab, so the list still works; they just do not outlast it.
 */
export const FILE_KEY_PREFIX = 'vams-lab-file:';

export const fileKey = (name: string) => `${FILE_KEY_PREFIX}${name}`;

const memory = new Map<string, Uint8Array>();

const hasIndexedDb = () => typeof indexedDB !== 'undefined';

export async function writeFileBytes(name: string, bytes: Uint8Array): Promise<void> {
  memory.set(name, bytes);
  if (!hasIndexedDb()) return;
  try {
    await set(fileKey(name), bytes);
  } catch {
    // Kept in memory only.
  }
}

export async function readFileBytes(name: string): Promise<Uint8Array | undefined> {
  if (hasIndexedDb()) {
    try {
      const stored = await get<Uint8Array>(fileKey(name));
      if (stored) return new Uint8Array(stored);
    } catch {
      // Fall back to the copy in memory.
    }
  }
  return memory.get(name);
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
