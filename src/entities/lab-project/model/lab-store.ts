import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { deleteFileBytes, readFileBytes, writeFileBytes } from './lab-images';
import { TEMPLATE } from './template';

/** One file in the student's file list: an image or a text file, by its name in the list. */
export interface LabFile {
  name: string;
  bytes: Uint8Array;
  /** Its MIME type, from its extension. */
  type: string;
}

/** A file in the list as the browser save keeps it; its bytes are in IndexedDB. */
export interface LabFileMeta {
  name: string;
  type: string;
  /** In bytes. */
  size: number;
}

/** What Save, Open, New and an example hand over: the code and its files. */
export interface LabWork {
  source: string;
  files: LabFile[];
}

/** The browser save's own key; the editor's is `vams-storage`. */
export const LAB_STORAGE_KEY = 'vams-lab';
export const LAB_STORAGE_VERSION = 1;

const FILE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  bmp: 'image/bmp',
  txt: 'text/plain',
};

/** The type of a file the list takes, from its extension, or null for any other file. */
export function labFileType(name: string): string | null {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? null : (FILE_TYPES[name.slice(dot + 1).toLowerCase()] ?? null);
}

/** The type of a file a program wrote that the list would not take, such as `scores.dat`. */
export const OTHER_FILE_TYPE = 'application/octet-stream';

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** An upload that took the place of a file in the list. */
export interface ReplacedFile {
  /** The upload's name, which the list now holds. */
  name: string;
  /** The name it replaced: the same, or the same apart from case. */
  replaced: string;
}

interface LabProjectData {
  source: string;
  files: LabFileMeta[];
  log: { folded: boolean };
  /** The work has changed since the last Save, Open, New or example. */
  unsaved: boolean;
}

interface LabProjectState extends LabProjectData {
  /**
   * The browser couldn't keep part of the work this visit: localStorage refused the code, or
   * IndexedDB a file. Not saved, since it is about this visit.
   */
  browserSaveFailed: boolean;
  setSource: (source: string) => void;
  setLogFolded: (folded: boolean) => void;
  /** Save has written the work to a file. */
  markSaved: () => void;
  /** Replaces the code, and the files too when they are given. */
  replaceWork: (work: { source: string; files?: LabFile[] }) => Promise<void>;
  /**
   * Adds files to the list. The program finds a file by its name in any case, as Windows does, so
   * an upload whose name matches a file in the list apart from case replaces that file.
   */
  addFiles: (files: LabFile[]) => Promise<ReplacedFile[]>;
  removeFile: (name: string) => Promise<void>;
}

export const labProjectDefaults = (): LabProjectData & Pick<LabProjectState, 'browserSaveFailed'> => ({
  source: TEMPLATE,
  files: [],
  log: { folded: false },
  unsaved: false,
  browserSaveFailed: false,
});

/** Notes, once, that the browser couldn't keep the work. */
function saveFailed(): void {
  if (!useLabStore.getState().browserSaveFailed) useLabStore.setState({ browserSaveFailed: true });
}

/** A full or blocked localStorage loses the browser save; it never breaks the edit that made it. */
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // This change is not saved in the browser. It is noted after this write, not inside it.
      queueMicrotask(saveFailed);
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // Nothing to remove.
    }
  },
};

const meta = (file: LabFile): LabFileMeta => ({ name: file.name, type: file.type, size: file.bytes.length });

/** Writes each file's bytes in order. Resolves whether IndexedDB kept every one. */
async function writeAll(files: readonly LabFile[]): Promise<boolean> {
  let kept = true;
  for (const file of files) if (!(await writeFileBytes(file.name, file.bytes))) kept = false;
  return kept;
}

/** One file per name apart from case; a later file takes the place of an earlier one. */
function oneOfEach(files: readonly LabFile[]): LabFile[] {
  const kept: LabFile[] = [];
  for (const file of files) {
    const at = kept.findIndex((k) => sameName(k.name, file.name));
    if (at >= 0) kept[at] = file;
    else kept.push(file);
  }
  return kept;
}

export const useLabStore = create<LabProjectState>()(
  persist(
    (set, get) => ({
      ...labProjectDefaults(),
      setSource: (source) => {
        if (get().source !== source) set({ source, unsaved: true });
      },
      setLogFolded: (folded) => set({ log: { folded } }),
      markSaved: () => set({ unsaved: false }),
      replaceWork: async ({ source, files }) => {
        if (!files) {
          set({ source, unsaved: false });
          return;
        }
        const next = oneOfEach(files);
        const kept = await writeAll(next);
        const stale = get().files.filter((old) => !next.some((file) => file.name === old.name));
        set({ source, files: next.map(meta), unsaved: false });
        if (!kept) saveFailed();
        for (const old of stale) await deleteFileBytes(old.name);
      },
      addFiles: async (files) => {
        // In order, so a later upload replaces an earlier one, in the list and in IndexedDB.
        const kept = await writeAll(files);
        const list = [...get().files];
        const replaced: ReplacedFile[] = [];
        const before = new Set<string>();
        for (const file of files) {
          const at = list.findIndex((m) => sameName(m.name, file.name));
          if (at < 0) {
            list.push(meta(file));
            continue;
          }
          replaced.push({ name: file.name, replaced: list[at].name });
          before.add(list[at].name);
          list[at] = meta(file);
        }
        set({ files: list, unsaved: true });
        if (!kept) saveFailed();
        for (const name of before) if (!list.some((m) => m.name === name)) await deleteFileBytes(name);
        return replaced;
      },
      removeFile: async (name) => {
        set({ files: get().files.filter((m) => m.name !== name), unsaved: true });
        await deleteFileBytes(name);
      },
    }),
    {
      name: LAB_STORAGE_KEY,
      version: LAB_STORAGE_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ source, files, log, unsaved }): LabProjectData => ({ source, files, log, unsaved }),
    },
  ),
);

/** The files in the list with their bytes, ready for Run or Save. A file whose bytes are gone is left out. */
export async function readLabFiles(): Promise<LabFile[]> {
  const files = await Promise.all(
    useLabStore.getState().files.map(async ({ name, type }) => {
      const bytes = await readFileBytes(name);
      return bytes ? { name, bytes, type } : null;
    }),
  );
  return files.filter((f): f is LabFile => f !== null);
}

/**
 * Takes out of the list every file whose bytes this browser no longer holds, as a page load finds
 * it, so the list never shows a file Run or Save can't give. Resolves the names it took out.
 */
export async function dropMissingFiles(): Promise<string[]> {
  const listed = useLabStore.getState().files;
  const found = await Promise.all(listed.map(async ({ name }) => (await readFileBytes(name)) !== undefined));
  const missing = listed.filter((_, i) => !found[i]).map((m) => m.name);
  if (missing.length > 0) useLabStore.setState({ files: useLabStore.getState().files.filter((m) => !missing.includes(m.name)) });
  return missing;
}
