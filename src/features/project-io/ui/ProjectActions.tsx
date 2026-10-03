import { useEffect, useRef, useState } from 'react';
import { Download, Save, FolderOpen, Code, FileJson } from 'lucide-react';
import { toast } from 'sonner';
import { useVamsStore } from '@/core/store';
import {
  buildProjectFile,
  createDefaultProjectFilename,
  downloadJSON,
  parseProjectFromFile,
  toStorePatchFromProject,
} from '@/entities/project/model/project-io';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { getActiveTheme, toEditorTheme } from '@/shared/lib/theme';

export default function ProjectActions() {
  const clearHistory = useVamsStore((state) => state.clearHistory);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasWorkInProgress = () => {
    const state = useVamsStore.getState();
    const hasObjects = state.objects.length > 0;
    const hasCustomBackground = state.canvasBackgroundColor !== '#000000';
    const isBuildingShape = state.pendingShapeType !== null;
    return hasObjects || hasCustomBackground || isBuildingShape;
  };

  const saveProjectToDownload = (filename?: string) => {
    try {
      const state = useVamsStore.getState();
      const projectFile = buildProjectFile(state);
      downloadJSON(filename ?? createDefaultProjectFilename(), projectFile);
      toast.success('Project saved');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save project');
    }
  };

  const handleExport = (type: 'cpp' | 'json') => {
    const state = useVamsStore.getState();
    if (type === 'json') {
      saveProjectToDownload();
      setShowExportMenu(false);
      return;
    }

    if (type === 'cpp') {
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
          { width, height }
        );
        const filename = createDefaultProjectFilename('vams-code').replace('.vams', '.cpp');
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
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
      setShowExportMenu(false);
      return;
    }
  };

  const handleLoad = () => {
    if (hasWorkInProgress()) {
      const shouldContinue = window.confirm(
        'Load a project? Unsaved changes will be lost.'
      );
      if (!shouldContinue) return;
    }
    fileInputRef.current?.click();
  };

  const handleProjectFileSelected = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const projectData = await parseProjectFromFile(file);
      const patch = toStorePatchFromProject(projectData);
      // The site theme stays authoritative: the store keeps mirroring it rather
      // than taking the theme saved in the project file.
      useVamsStore.setState(
        {
          ...patch,
          theme: toEditorTheme(getActiveTheme()),
        },
        false
      );
      const stateAfter = useVamsStore.getState();
      const knownIds = new Set(stateAfter.getAllTextures().map((t) => t.id));
      let detached = 0;
      const cleaned = stateAfter.objects.map((o) => {
        if (o.texture && !knownIds.has(o.texture.textureId)) {
          detached++;
          return { ...o, texture: null };
        }
        return o;
      });
      if (detached > 0) {
        useVamsStore.setState({ objects: cleaned });
        toast.message('Some textures could not be loaded and were detached.');
      }
      clearHistory();
      toast.success(`Project loaded: ${file.name}`);
    } catch (error) {
      console.error(error);
      toast.error('Invalid project file');
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.vams,.vams.json,application/json"
        onChange={handleProjectFileSelected}
        style={{ display: 'none' }}
      />
      <button className="icon-btn" onClick={() => saveProjectToDownload()} title="Save Project">
        <Save size={16} />
      </button>
      <button className="icon-btn" onClick={handleLoad} title="Load Project">
        <FolderOpen size={16} />
      </button>
      <div className="dropdown-container" ref={exportMenuRef}>
        <button
          className="icon-btn"
          onClick={() => setShowExportMenu((value) => !value)}
          title="Export Project"
        >
          <Download size={16} />
        </button>
        {showExportMenu && (
          <div className="dropdown-menu">
            <div className="menu-header">Export As</div>
            <button className="menu-item" onClick={() => handleExport('cpp')}>
              <Code size={14} /> C++ Code
            </button>
            <button className="menu-item" onClick={() => handleExport('json')}>
              <FileJson size={14} /> JSON Scene Data
            </button>
          </div>
        )}
      </div>
    </>
  );
}