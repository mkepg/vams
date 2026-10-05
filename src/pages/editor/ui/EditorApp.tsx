import { useEffect, useLayoutEffect } from 'react';
import './editor-app.scss';
import TopBar from '@/widgets/layout/top-bar';
import LeftSidebar from '@/widgets/layout/left-sidebar';
import RightSidebar from '@/widgets/layout/right-sidebar';
import ViewportRouter from '@/widgets/canvas/ViewportRouter';
import LessonBar from '@/features/lesson-engine/ui/LessonBar';
import { MyScenesDialog } from '@/features/scene-library';
import HelpCenter from '@/features/help/ui/HelpCenter';
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog';
import WelcomeCard from '@/features/onboarding/ui/WelcomeCard';
import { useVamsStore } from '@/core/store';
import { getActiveTheme, subscribeTheme, toEditorTheme, type SiteTheme } from '@/shared/lib/theme';
import { useKeyboardShortcuts } from '@/shared/hooks/useKeyboardShortcuts';
import { useEditorLink } from '../model/useEditorLink';
import { useCorruptSaveNotice } from '../model/recovery';

export default function EditorApp() {
  useKeyboardShortcuts();
  useEditorLink();
  useCorruptSaveNotice();
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add('route-editor');
    return () => root.classList.remove('route-editor');
  }, []);
  useEffect(() => {
    const mirror = (theme: SiteTheme) => useVamsStore.setState({ theme: toEditorTheme(theme) });
    mirror(getActiveTheme());
    return subscribeTheme(mirror);
  }, []);
  const appMode = useVamsStore((state) => state.appMode);

  return (
    <div className="app-container">
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
      <MyScenesDialog />
      <ConfirmDialog />
      <WelcomeCard />
    </div>
  );
}