import { useEffect } from 'react';
import { create } from 'zustand';
import { useVamsStore, type VamsState } from '@/core/store';
import { buildProjectFile } from '@/entities/project/model/project-io';
import { isSceneEmpty } from '@/entities/project/model/scene-empty';
import { getSceneLibrary, UNTITLED_SCENE, type SceneLibrary } from '@/entities/project/model/scene-library';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** What the top bar shows beside the scene's name. */
export const useSaveStatus = create<{ status: SaveStatus }>(() => ({ status: 'idle' }));

export const AUTOSAVE_DELAY = 1000;

/** The parts of the store a saved scene is made of. */
const WATCHED = ['objects', 'callbacks', 'viewportLimits', 'canvasBackgroundColor', 'uploadedTextures', 'sceneName', 'sceneId'] as const;

const changed = (a: VamsState, b: VamsState) => WATCHED.some((k) => a[k] !== b[k]);
const inLesson = (s: VamsState) => s.activeLessonId !== null || s.appMode === 'Lesson';
// A blank, untitled editor is not worth an entry in My scenes.
const worthSaving = (s: VamsState) => s.sceneId !== '' && !(isSceneEmpty(s) && s.sceneName === UNTITLED_SCENE);

async function write(state: VamsState, library: () => Promise<SceneLibrary>): Promise<void> {
  const lib = await library();
  const existing = await lib.get(state.sceneId);
  const now = Date.now();
  await lib.save({
    id: state.sceneId,
    name: state.sceneName,
    kind: 'saved',
    reason: null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    file: buildProjectFile(state),
    raw: null,
  });
}

export interface AutosaveOptions {
  delay?: number;
  library?: () => Promise<SceneLibrary>;
}

/** Saves the working scene to its own My scenes entry a moment after each change. Returns the stop function. */
export function startSceneAutosave({ delay = AUTOSAVE_DELAY, library = getSceneLibrary }: AutosaveOptions = {}): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: VamsState | null = null;

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const snapshot = pending;
    pending = null;
    if (!snapshot) return;
    write(snapshot, library).then(
      () => {
        if (!pending) useSaveStatus.setState({ status: 'saved' });
      },
      (error) => {
        console.error(error);
        useSaveStatus.setState({ status: 'error' });
      },
    );
  };

  const unsubscribe = useVamsStore.subscribe((state, prev) => {
    if (!changed(state, prev)) return;
    // Another scene opened: the previous scene's last edit goes to its own entry now.
    if (state.sceneId !== prev.sceneId && pending) flush();
    if (inLesson(state)) {
      // What is waiting is the scene from before the lesson: save it now.
      flush();
      return;
    }
    if (!worthSaving(state)) {
      // Nothing worth saving now: drop the snapshot of the edit that was taken back.
      if (timer) clearTimeout(timer);
      timer = null;
      if (pending) useSaveStatus.setState({ status: 'idle' });
      pending = null;
      return;
    }
    pending = state;
    useSaveStatus.setState({ status: 'saving' });
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, delay);
  });

  return () => {
    unsubscribe();
    flush();
  };
}

/** Runs the auto-save while the editor is mounted. */
export function useSceneAutosave(): void {
  useEffect(() => startSceneAutosave(), []);
}
