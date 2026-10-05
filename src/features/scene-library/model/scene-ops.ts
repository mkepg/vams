import { useVamsStore } from '@/core/store';
import type { VamsState } from '@/core/store/types';
import {
  buildProjectFile,
  downloadJSON,
  toStorePatchFromProject,
  type VamsProjectData,
} from '@/entities/project/model/project-io';
import {
  createSceneId,
  getSceneLibrary,
  normalizeSceneName,
  type BackupReason,
  type SceneEntry,
} from '@/entities/project/model/scene-library';
import { getActiveTheme, toEditorTheme } from '@/shared/lib/theme';

type SceneFields = Pick<VamsState, 'objects' | 'canvasBackgroundColor' | 'pendingShapeType' | 'callbacks' | 'viewportLimits'>;

/** True when there is nothing on the canvas worth keeping. */
export function isSceneEmpty(state: SceneFields): boolean {
  const { minX, maxX, minY, maxY } = state.viewportLimits;
  return (
    state.objects.length === 0 &&
    state.canvasBackgroundColor === '#000000' &&
    state.pendingShapeType === null &&
    Object.values(state.callbacks).every((body) => body.trim() === '') &&
    minX === -1 &&
    maxX === 1 &&
    minY === -1 &&
    maxY === 1
  );
}

/**
 * Load project data into the editor. The site theme stays authoritative, texture attachments
 * the editor cannot resolve are dropped, and undo history starts over.
 * Returns how many texture attachments were dropped.
 */
export function loadProjectData(data: VamsProjectData): number {
  useVamsStore.setState({ ...toStorePatchFromProject(data), theme: toEditorTheme(getActiveTheme()) }, false);
  const state = useVamsStore.getState();
  const known = new Set(state.getAllTextures().map((t) => t.id));
  let detached = 0;
  const objects = state.objects.map((o) => {
    if (o.texture && !known.has(o.texture.textureId)) {
      detached++;
      return { ...o, texture: null };
    }
    return o;
  });
  if (detached > 0) useVamsStore.setState({ objects });
  state.clearHistory();
  return detached;
}

export function backupLabel(title: string): string {
  return `Before opening ‘${title}’`;
}

function newEntry(fields: Pick<SceneEntry, 'name' | 'kind' | 'reason' | 'file' | 'raw'>): SceneEntry {
  const now = Date.now();
  return { id: createSceneId(), createdAt: now, updatedAt: now, ...fields, name: normalizeSceneName(fields.name) };
}

/** Keep the current scene in My scenes before something replaces it. Returns null for an empty scene. */
export async function backupCurrentScene(reason: BackupReason, label: string): Promise<SceneEntry | null> {
  const state = useVamsStore.getState();
  if (isSceneEmpty(state)) return null;
  const entry = newEntry({ name: label, kind: 'backup', reason, file: buildProjectFile(state), raw: null });
  await (await getSceneLibrary()).save(entry);
  return entry;
}

/** Keep saved editor data that could not be read, so it can still be downloaded. */
export async function backupCorruptSave(raw: string): Promise<SceneEntry> {
  const entry = newEntry({ name: 'Unreadable saved scene', kind: 'backup', reason: 'corrupt-save', file: null, raw });
  await (await getSceneLibrary()).save(entry);
  return entry;
}

export interface ReplaceOptions {
  reason: BackupReason;
  label: string;
}

export interface ReplaceResult {
  backedUp: boolean;
  detached: number;
}

/**
 * Back up the current scene, then load `data`. If the backup fails the scene is left alone and
 * the error propagates, so the caller can say why nothing changed.
 */
export async function replaceScene(data: VamsProjectData, options: ReplaceOptions): Promise<ReplaceResult> {
  const backup = await backupCurrentScene(options.reason, options.label);
  const detached = loadProjectData(data);
  return { backedUp: backup !== null, detached };
}

/** Save the current scene as a named entry in My scenes. */
export async function saveCurrentScene(name: string): Promise<SceneEntry> {
  const entry = newEntry({ name, kind: 'saved', reason: null, file: buildProjectFile(useVamsStore.getState()), raw: null });
  await (await getSceneLibrary()).save(entry);
  return entry;
}

export function entryFileName(entry: SceneEntry): string {
  const base = entry.name
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
  return `${base || 'vams-scene'}.vams`;
}

export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download an entry as a project file that Open can read (or, for a corrupt save, its raw text). */
export function downloadEntry(entry: SceneEntry): void {
  if (entry.file) downloadJSON(entryFileName(entry), entry.file);
  else if (entry.raw !== null) downloadText(entryFileName(entry), entry.raw);
}
