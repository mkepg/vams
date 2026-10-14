import { useEffect, useLayoutEffect } from 'react';
import TopBar from '@/widgets/layout/top-bar';
import { EditorPanel } from '@/widgets/layout/editor-column';
import Rail from '@/widgets/layout/rail';
import CodeMathColumn from '@/widgets/layout/code-math-column';
import ViewportRouter from '@/widgets/canvas/ViewportRouter';
import { MyScenesDialog } from '@/features/scene-library';
import LessonBar from '@/features/lesson-engine/ui/LessonBar';
import LearnDrawer from '@/features/lesson-engine/ui/LearnDrawer';
import { useRecordLessonOnLeave } from '@/features/lesson-engine/model/record-on-leave';
import HelpCenter from '@/features/help/ui/HelpCenter';
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog';
import WelcomeCard from '@/features/onboarding/ui/WelcomeCard';
import FirstVisitTour from '@/features/first-visit-tour';
import { runController } from '@/features/callbacks/model/run-controller';
import { sanitizeName } from '@/features/code-generation/model/generator/utils';
import { startLesson } from '@/features/lesson-engine/model/start-lesson';
import { readProgress } from '@/features/lesson-engine/model/progress';
import { firstLessonToStudy } from '@/features/lesson-engine/model/catalog';
import { useVamsStore } from '@/core/store';
import { getActiveTheme, subscribeTheme, toEditorTheme, type SiteTheme } from '@/shared/lib/theme';
import { useKeyboardShortcuts } from '@/shared/hooks/useKeyboardShortcuts';
import { useEditorLink } from '../model/useEditorLink';
import { useCorruptSaveNotice } from '../model/recovery';
import EditorShell from './EditorShell';

/** The tour's "Start learning": the first lesson in course order the student has not completed. */
const startLearning = () => void startLesson(firstLessonToStudy(readProgress().completed));

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
      rail={<Rail />}
      panel={<EditorPanel />}
      canvas={<ViewportRouter />}
      lessonBar={<LessonBar />}
      codeMath={<CodeMathColumn />}
      overlays={
        <>
          <LearnDrawer />
          <HelpCenter />
          <MyScenesDialog />
          <ConfirmDialog />
          <WelcomeCard />
          <FirstVisitTour run={runController} codeName={sanitizeName} startLearning={startLearning} />
        </>
      }
    />
  );
}
