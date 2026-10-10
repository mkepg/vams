import { useEffect, useLayoutEffect } from 'react';
import TopBar from '@/widgets/layout/top-bar';
import { EditorColumn } from '@/widgets/layout/editor-column';
import CodeMathColumn from '@/widgets/layout/code-math-column';
import ViewportRouter from '@/widgets/canvas/ViewportRouter';
import { MyScenesDialog } from '@/features/scene-library';
import LearnDrawer from '@/features/lesson-engine/ui/LearnDrawer';
import { useRecordLessonOnLeave } from '@/features/lesson-engine/model/record-on-leave';
import HelpCenter from '@/features/help/ui/HelpCenter';
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog';
import WelcomeCard from '@/features/onboarding/ui/WelcomeCard';
import { useVamsStore } from '@/core/store';
import { getActiveTheme, subscribeTheme, toEditorTheme, type SiteTheme } from '@/shared/lib/theme';
import { useKeyboardShortcuts } from '@/shared/hooks/useKeyboardShortcuts';
import { useEditorLink } from '../model/useEditorLink';
import { useCorruptSaveNotice } from '../model/recovery';
import EditorShell from './EditorShell';

export default function EditorApp() {
  useKeyboardShortcuts();
  useEditorLink();
  useCorruptSaveNotice();
  useRecordLessonOnLeave();
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

  return (
    <EditorShell
      topBar={<TopBar />}
      column={<EditorColumn />}
      canvas={<ViewportRouter />}
      codeMath={<CodeMathColumn />}
      overlays={
        <>
          <LearnDrawer />
          <HelpCenter />
          <MyScenesDialog />
          <ConfirmDialog />
          <WelcomeCard />
        </>
      }
    />
  );
}
