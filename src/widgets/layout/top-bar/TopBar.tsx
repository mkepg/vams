import { Toaster } from 'sonner';
import { useVamsStore } from '@/core/store';
import HistoryControls from '@/features/history-controls/ui/HistoryControls';
import ProjectActions from '@/features/project-io/ui/ProjectActions';
import NewWorkspaceButton from '@/features/workspace-reset/ui/NewWorkspaceButton';
import ThemeToggleButton from '@/features/theme-toggle/ui/ThemeToggleButton';
import EditorPreferencesMenu from '@/features/editor-preferences/ui/EditorPreferencesMenu';
import LessonLauncher from '@/features/lesson-engine/ui/LessonLauncher';
import HelpButton from '@/features/help/ui/HelpButton';
import './top-bar.scss';

export default function TopBar() {
  const theme = useVamsStore((state) => state.theme);

  return (
    <header className="top-bar">
      <Toaster position="bottom-right" theme={theme === 'dark' ? 'dark' : 'light'} />
      <div className="brand">
        <div className="logo-container">
          <h1>VAMS</h1>
        </div>
        <div className="brand-launcher">
          <LessonLauncher />
        </div>
      </div>
      <div className="actions">
        <HistoryControls />
        <div className="separator" />
        <NewWorkspaceButton />
        <ProjectActions />
        <ThemeToggleButton />
        <EditorPreferencesMenu />
        <div className="separator" />
        <HelpButton />
      </div>
    </header>
  );
}
