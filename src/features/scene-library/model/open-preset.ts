import { toast } from 'sonner';
import { useVamsStore } from '@/core/store';
import { getPreset } from '@/entities/project/model/scene-presets';
import { backupLabel, replaceScene } from './scene-ops';
import { useMyScenesDialog } from './dialog-store';

/**
 * Opens a prepared scene: backs the current scene up to My scenes, loads the preset, makes its
 * section current and shows the Scene panel. Says what happened in a toast. Resolves to whether
 * the scene opened; a scene that could not be backed up is never replaced.
 */
export async function openPreset(slug: string, deps: { openLibrary?: () => void } = {}): Promise<boolean> {
  const preset = getPreset(slug);
  if (!preset) return false;
  const openLibrary = deps.openLibrary ?? (() => useMyScenesDialog.getState().open());
  try {
    const { backedUp } = await replaceScene(preset.data, { reason: 'scene-link', label: backupLabel(preset.title), name: preset.title });
    const state = useVamsStore.getState();
    state.setActiveSection(preset.section);
    state.setRailPanel('scene');
    if (backedUp) {
      toast.success(`Opened ‘${preset.title}’`, {
        description: 'Your previous scene is in My scenes.',
        action: { label: 'My scenes', onClick: openLibrary },
      });
    } else {
      toast.success(`Opened ‘${preset.title}’`);
    }
    return true;
  } catch (error) {
    console.error(error);
    toast.error(`Couldn't keep a backup of your current scene, so ‘${preset.title}’ was not opened.`);
    return false;
  }
}
