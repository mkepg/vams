import { useEffect } from 'react';
import { toast } from 'sonner';
import { STORAGE_KEY, useVamsStore } from '@/core/store';
import { takeCorruptSave } from '@/core/store/recovery-signal';
import { buildProjectFile, createDefaultProjectFilename, downloadJSON } from '@/entities/project/model/project-io';
import { backupCorruptSave, backupCurrentScene, downloadText, useMyScenesDialog } from '@/features/scene-library';

function readSavedText(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Mid-lesson the visible scene is the lesson's; put the student's own scene back before keeping anything. */
function leaveLesson(): void {
  const state = useVamsStore.getState();
  if (state.sceneBackup) state.clearLessonState();
}

/** Download the editor's scene; if the scene itself cannot be read, download the saved text instead. */
export function downloadWork(): void {
  leaveLesson();
  const filename = createDefaultProjectFilename('vams-recovered');
  try {
    downloadJSON(filename, buildProjectFile(useVamsStore.getState()));
  } catch (error) {
    console.error(error);
    const raw = readSavedText();
    if (raw !== null) downloadText('vams-recovered-save.json', raw);
  }
}

/** Keep the scene (in My scenes, or as a download when that fails), clear the save, and reload. */
export async function startFresh(): Promise<void> {
  leaveLesson();
  try {
    await backupCurrentScene('recovery', 'Before Start fresh');
  } catch (error) {
    console.error(error);
    downloadWork();
  }
  useVamsStore.persist.clearStorage();
  window.location.reload();
}

const openLibrary = () => useMyScenesDialog.getState().open();

/** Keep an unreadable save in My scenes and tell the student; offer a download if that fails. */
export async function keepCorruptSave(raw: string, open: () => void = openLibrary): Promise<void> {
  try {
    await backupCorruptSave(raw);
    toast.warning("Your saved scene couldn't be read, so VAMS started fresh. A copy is in My scenes.", {
      action: { label: 'My scenes', onClick: open },
      duration: 15000,
    });
  } catch (error) {
    console.error(error);
    toast.warning("Your saved scene couldn't be read, so VAMS started fresh.", {
      action: { label: 'Download', onClick: () => downloadText('vams-unreadable-save.json', raw) },
      duration: Infinity,
    });
  }
}

/** Collect a corrupt save reported during hydration, once per editor mount. */
export function useCorruptSaveNotice(): void {
  useEffect(() => {
    const raw = takeCorruptSave();
    if (raw) void keepCorruptSave(raw);
  }, []);
}
