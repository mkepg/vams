import { createStore, del, get, set, values, type UseStore } from 'idb-keyval';
import type { VamsProjectFile } from './project-io';

/**
 * My scenes: named scenes and automatic backups kept in this browser.
 * Entries hold standard project files, so anything here can also be downloaded and reopened with Open.
 */

/** Why a backup was taken. Saved entries have no reason. */
export type BackupReason =
  | 'scene-link'
  | 'library-open'
  | 'open-file'
  | 'new-workspace'
  | 'recovery'
  | 'corrupt-save';

export interface SceneEntry {
  id: string;
  name: string;
  kind: 'saved' | 'backup';
  reason: BackupReason | null;
  createdAt: number;
  updatedAt: number;
  /** The scene as a project file; null only for a corrupt-save backup. */
  file: VamsProjectFile | null;
  /** The unreadable saved text, kept only for a corrupt-save backup. */
  raw: string | null;
}

export interface SceneLibrary {
  /** False when entries live only in memory and vanish with the tab. */
  readonly persistent: boolean;
  /** Newest `updatedAt` first. */
  list(): Promise<SceneEntry[]>;
  get(id: string): Promise<SceneEntry | undefined>;
  /** Insert or replace. Saving a backup prunes backups to the newest BACKUP_LIMIT. */
  save(entry: SceneEntry): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export const BACKUP_LIMIT = 5;
export const MAX_NAME_LENGTH = 80;
export const UNTITLED_SCENE = 'Untitled scene';
export const LIBRARY_DB = 'vams';
export const LIBRARY_STORE = 'scenes';

export function normalizeSceneName(name: string): string {
  return name.trim().slice(0, MAX_NAME_LENGTH).trim() || UNTITLED_SCENE;
}

export function createSceneId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `scene-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function byNewest(a: SceneEntry, b: SceneEntry): number {
  return b.updatedAt - a.updatedAt || b.createdAt - a.createdAt;
}

interface Backend {
  all(): Promise<SceneEntry[]>;
  read(id: string): Promise<SceneEntry | undefined>;
  write(entry: SceneEntry): Promise<void>;
  delete(id: string): Promise<void>;
}

function createLibrary(backend: Backend, persistent: boolean): SceneLibrary {
  return {
    persistent,
    async list() {
      return (await backend.all()).sort(byNewest);
    },
    get: (id) => backend.read(id),
    async save(entry) {
      await backend.write({ ...entry, name: normalizeSceneName(entry.name) });
      if (entry.kind !== 'backup') return;
      const stale = (await backend.all())
        .filter((e) => e.kind === 'backup')
        .sort(byNewest)
        .slice(BACKUP_LIMIT);
      for (const old of stale) await backend.delete(old.id);
    },
    async rename(id, name) {
      const current = await backend.read(id);
      if (!current) return;
      await backend.write({ ...current, name: normalizeSceneName(name), updatedAt: Date.now() });
    },
    remove: (id) => backend.delete(id),
  };
}

export function createMemoryLibrary(): SceneLibrary {
  const entries = new Map<string, SceneEntry>();
  return createLibrary(
    {
      all: async () => [...entries.values()],
      read: async (id) => entries.get(id),
      write: async (entry) => {
        entries.set(entry.id, entry);
      },
      delete: async (id) => {
        entries.delete(id);
      },
    },
    false,
  );
}

export function createIdbLibrary(store: UseStore = createStore(LIBRARY_DB, LIBRARY_STORE)): SceneLibrary {
  return createLibrary(
    {
      all: () => values<SceneEntry>(store),
      read: (id) => get<SceneEntry>(id, store),
      write: (entry) => set(entry.id, entry, store),
      delete: (id) => del(id, store),
    },
    true,
  );
}

const PROBE_KEY = '__vams-probe__';
let shared: Promise<SceneLibrary> | null = null;

async function openSharedLibrary(): Promise<SceneLibrary> {
  if (typeof indexedDB === 'undefined') return createMemoryLibrary();
  try {
    const store = createStore(LIBRARY_DB, LIBRARY_STORE);
    await set(PROBE_KEY, 1, store);
    await del(PROBE_KEY, store);
    return createIdbLibrary(store);
  } catch {
    // Some private-browsing modes refuse IndexedDB writes; keep scenes for this tab instead.
    return createMemoryLibrary();
  }
}

/** One library for the whole app: IndexedDB when it works, otherwise memory for this tab. */
export function getSceneLibrary(): Promise<SceneLibrary> {
  shared ??= openSharedLibrary();
  return shared;
}

/** Replace the shared library (or forget it, with null). Tests only. */
export function setSceneLibraryForTests(library: SceneLibrary | null): void {
  shared = library ? Promise.resolve(library) : null;
}
