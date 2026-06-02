import './styles/app-shell.scss';
import TopBar from '@/widgets/layout/top-bar';
import LeftSidebar from '@/widgets/layout/left-sidebar';
import RightSidebar from '@/widgets/layout/right-sidebar';
import ViewportRouter from '@/widgets/canvas/ViewportRouter';
import LessonBar from '@/features/lesson-engine/ui/LessonBar';
import HelpCenter from '@/features/help/ui/HelpCenter';
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog';
import WelcomeCard from '@/features/onboarding/ui/WelcomeCard';
import { useVamsStore } from '@/core/store';
import { useKeyboardShortcuts } from '@/shared/hooks/useKeyboardShortcuts';

export default function App() {
  useKeyboardShortcuts();
  const theme = useVamsStore((state) => state.theme);
  const appMode = useVamsStore((state) => state.appMode);

  return (
    <div className="app-container" data-theme={theme}>
      <TopBar />
      <div className="main-workspace">
        <LeftSidebar />
        <main className="canvas-area">
          <ViewportRouter />
        </main>
        <RightSidebar />
      </div>
      
      {appMode === 'Lesson' && <LessonBar />}
      <HelpCenter />
      <ConfirmDialog />
      <WelcomeCard />
    </div>
  );
}