import { Toaster } from 'sonner';
import Logo from '@/shared/ui/logo';
import { useSiteTheme } from '@/shared/lib/theme';
import HistoryControls from '@/features/history-controls/ui/HistoryControls';
import type { VamsProjectData } from '@/entities/project/model/project-io';
import { MyScenesButton, backupCurrentScene, backupLabel, replaceScene } from '@/features/scene-library';
import ProjectActions from '@/features/project-io/ui/ProjectActions';
import NewWorkspaceButton from '@/features/workspace-reset/ui/NewWorkspaceButton';
import ThemeToggleButton from '@/features/theme-toggle/ui/ThemeToggleButton';
import EditorPreferencesMenu from '@/features/editor-preferences/ui/EditorPreferencesMenu';
import LessonLauncher from '@/features/lesson-engine/ui/LessonLauncher';
import HelpButton from '@/features/help/ui/HelpButton';
import './top-bar.scss';

function loadProject(data: VamsProjectData, fileName: string): Promise<number> {
  return replaceScene(data, { reason: 'open-file', label: backupLabel(fileName) }).then((result) => result.detached);
}

function backupBeforeReset(): Promise<unknown> {
  return backupCurrentScene('new-workspace', 'Before New workspace');
}

export default function TopBar() {
  const theme = useSiteTheme();

  return (
    <header className="top-bar">
      <Toaster position="bottom-right" theme={theme === 'blueprint' ? 'dark' : 'light'} />
      <div className="brand">
        <a className="brand-home" href="/" aria-label="VAMS home">
          <Logo variant="full" title="VAMS" />
        </a>
        <div className="brand-launcher">
          <LessonLauncher />
        </div>
      </div>
      <div className="actions">
        <HistoryControls />
        <div className="separator" />
        <NewWorkspaceButton beforeReset={backupBeforeReset} />
        <MyScenesButton />
        <ProjectActions loadProject={loadProject} />
        <ThemeToggleButton />
        <EditorPreferencesMenu />
        <div className="separator" />
        <HelpButton />
      </div>
    </header>
  );
}
