import { Code, FilePlus, FlaskConical, FolderOpen, Library, Save } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import type { VamsProjectData } from '@/entities/project/model/project-io';
import { sceneNameFromFile } from '@/entities/project/model/scene-library';
import { backupCurrentScene, backupLabel, replaceScene, useMyScenesDialog } from '@/features/scene-library';
import { useNewWorkspace } from '@/features/workspace-reset/model/useNewWorkspace';
import { useProjectFile } from '@/features/project-io/model/useProjectFile';
import { LAB_ENABLED } from '@/shared/config/lab';
import { MenuButton, type MenuEntry } from '@/shared/ui/controls';

function loadProject(data: VamsProjectData, fileName: string): Promise<number> {
  return replaceScene(data, { reason: 'open-file', label: backupLabel(fileName), name: sceneNameFromFile(fileName) }).then((result) => result.detached);
}

function backupBeforeReset(): Promise<unknown> {
  return backupCurrentScene('new-workspace', 'Before New workspace');
}

interface FileMenuProps {
  /** Whether this build has the Lab, which Open in Lab opens; the tests turn it off. */
  labOn?: boolean;
}

export default function FileMenu({ labOn = LAB_ENABLED }: FileMenuProps = {}) {
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');
  const openMyScenes = useMyScenesDialog((s) => s.open);
  const newWorkspace = useNewWorkspace(backupBeforeReset);
  const file = useProjectFile(loadProject);

  const openInLab: MenuEntry[] = labOn ? [{ kind: 'item', id: 'lab', label: 'Open in Lab', icon: <FlaskConical />, onSelect: file.openInLab }] : [];
  const saveAndExport: MenuEntry[] = [
    { kind: 'item', id: 'save', label: 'Save project file', icon: <Save />, onSelect: file.save },
    { kind: 'separator', id: 'sep-export' },
    { kind: 'item', id: 'cpp', label: 'Export C++ code', icon: <Code />, onSelect: file.exportCpp },
    ...openInLab,
  ];
  const entries: MenuEntry[] = inLesson
    ? saveAndExport
    : [
        { kind: 'item', id: 'new', label: 'New workspace', icon: <FilePlus />, onSelect: () => void newWorkspace() },
        { kind: 'item', id: 'scenes', label: 'My scenes…', icon: <Library />, onSelect: openMyScenes },
        { kind: 'separator', id: 'sep-file' },
        { kind: 'item', id: 'open', label: 'Open project file…', icon: <FolderOpen />, onSelect: () => void file.requestOpen() },
        ...saveAndExport,
      ];

  return (
    <>
      <input {...file.inputProps} />
      <MenuButton label="File" variant="quiet" entries={entries}>File</MenuButton>
    </>
  );
}
