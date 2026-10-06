import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useVamsStore } from '@/core/store';
import {
  buildProjectFile,
  createDefaultProjectFilename,
  downloadJSON,
  parseProjectFromFile,
  type VamsProjectData,
} from '@/entities/project/model/project-io';
import { isSceneEmpty } from '@/entities/project/model/scene-empty';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { confirm } from '@/shared/ui/confirm-dialog/confirm-store';

export interface ProjectFileActions {
  /** Asks first when the scene has work in it, then opens the file picker. */
  requestOpen: () => Promise<void>;
  /** Downloads the scene as a project file. */
  save: () => void;
  /** Downloads the generated C++ program. */
  exportCpp: () => void;
  /** Spread onto a hidden <input>; FileMenu renders it. */
  inputProps: {
    ref: { current: HTMLInputElement | null };
    type: 'file';
    accept: string;
    hidden: true;
    tabIndex: -1;
    'aria-hidden': 'true';
    onChange: (event: Event) => void;
  };
}

export function useProjectFile(
  loadProject: (data: VamsProjectData, fileName: string) => Promise<number>,
): ProjectFileActions {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const save = useCallback(() => {
    try {
      downloadJSON(createDefaultProjectFilename(), buildProjectFile(useVamsStore.getState()));
      toast.success('Project saved');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save project');
    }
  }, []);

  const exportCpp = useCallback(() => {
    const state = useVamsStore.getState();
    try {
      let width = 800;
      let height = 600;
      const el = document.querySelector('.canvas-wrapper');
      if (el) {
        width = Math.floor(el.clientWidth);
        height = Math.floor(el.clientHeight);
      }
      const code = generateCodeFromState(
        {
          objects: state.objects,
          canvasBackgroundColor: state.canvasBackgroundColor,
          callbacks: state.callbacks,
          viewportLimits: state.viewportLimits,
          textures: state.getAllTextures(),
        },
        { width, height },
      );
      const filename = createDefaultProjectFilename('vams-code').replace('.vams', '.cpp');
      const url = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('C++ code exported successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to export C++ code');
    }
  }, []);

  const requestOpen = useCallback(async () => {
    if (!isSceneEmpty(useVamsStore.getState())) {
      const proceed = await confirm({
        title: 'Open a project file?',
        message: 'Your current scene will be kept in My scenes as a backup.',
        confirmLabel: 'Open file',
        cancelLabel: 'Cancel',
      });
      if (!proceed) return;
    }
    fileInputRef.current?.click();
  }, []);

  const onChange = useCallback(
    async (event: Event) => {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      let projectData: VamsProjectData;
      try {
        projectData = await parseProjectFromFile(file);
      } catch (error) {
        console.error(error);
        toast.error('Invalid project file');
        return;
      }
      try {
        const detached = await loadProject(projectData, file.name);
        if (detached > 0) toast.message('Some textures could not be loaded and were detached.');
        toast.success(`Project loaded: ${file.name}`);
      } catch (error) {
        console.error(error);
        toast.error("Couldn't keep a backup of the current scene, so the project was not opened.");
      }
    },
    [loadProject],
  );

  return {
    requestOpen,
    save,
    exportCpp,
    inputProps: {
      ref: fileInputRef,
      type: 'file',
      accept: '.json,.vams,.vams.json,application/json',
      hidden: true,
      tabIndex: -1,
      'aria-hidden': 'true',
      onChange: (event: Event) => void onChange(event),
    },
  };
}
