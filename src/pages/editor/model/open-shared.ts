import { toast } from 'sonner';
import { useVamsStore } from '@/core/store';
import { resolveSharedScene, type ShareLink } from '@/features/share';
import { leaveRunningLesson } from '@/features/lesson-engine/model/leave-lesson';
import { backupLabel, replaceScene } from '@/features/scene-library';

export interface OpenSharedDeps {
  openLibrary: () => void;
  fetchImpl?: typeof fetch;
}

/** Opens a shared scene as the working scene, as a prepared scene link does. Returns whether it opened. */
export async function openSharedScene(link: ShareLink, deps: OpenSharedDeps): Promise<boolean> {
  const resolved = await resolveSharedScene(link, deps.fetchImpl);
  if (!resolved.ok) {
    toast.error(resolved.message);
    return false;
  }
  const { name, data } = resolved.scene;
  // Leave the lesson first; its backup of the student's scene would otherwise come back over the shared one.
  if (useVamsStore.getState().activeLessonId) {
    leaveRunningLesson();
    useVamsStore.getState().setAppMode('Author');
  }
  const now = useVamsStore.getState();
  // The visitor's own view preferences stay theirs.
  const merged = { ...data, axisVisibility: now.axisVisibility, showCoordinateTracker: now.showCoordinateTracker, learningSettings: now.learningSettings };
  try {
    const { backedUp } = await replaceScene(merged, { reason: 'shared-link', label: backupLabel(name), name });
    if (backedUp) {
      toast.success(`Opened ‘${name}’`, {
        description: 'Your previous scene is in My scenes.',
        action: { label: 'My scenes', onClick: deps.openLibrary },
      });
    } else {
      toast.success(`Opened ‘${name}’`);
    }
    return true;
  } catch (error) {
    console.error(error);
    toast.error(`Couldn’t keep a backup of your current scene, so ‘${name}’ was not opened.`);
    return false;
  }
}
