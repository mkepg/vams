import { Toaster } from 'sonner';
import Logo from '@/shared/ui/logo';
import { useSiteTheme } from '@/shared/lib/theme';
import HistoryControls from '@/features/history-controls/ui/HistoryControls';
import ThemeToggleButton from '@/features/theme-toggle/ui/ThemeToggleButton';
import EditorPreferencesMenu from '@/features/editor-preferences/ui/EditorPreferencesMenu';
import LessonLauncher from '@/features/lesson-engine/ui/LessonLauncher';
import HelpButton from '@/features/help/ui/HelpButton';
import FileMenu from './FileMenu';
import './top-bar.scss';

export default function TopBar() {
  const theme = useSiteTheme();
  return (
    <header className="top-bar">
      <Toaster position="bottom-center" theme={theme} />
      <a className="top-bar__home" href="/" aria-label="VAMS home">
        <Logo />
      </a>
      <div className="top-bar__actions">
        <LessonLauncher />
        <FileMenu />
        <span className="top-bar__sep" aria-hidden="true" />
        <HistoryControls />
        <ThemeToggleButton className="vbtn vbtn--quiet vbtn--md vbtn--icon" />
        <EditorPreferencesMenu />
        <HelpButton />
      </div>
    </header>
  );
}
