import { Toaster } from 'sonner';
import Logo from '@/shared/ui/logo';
import { useSiteTheme } from '@/shared/lib/theme';
import { useVamsStore } from '@/core/store';
import HistoryControls from '@/features/history-controls/ui/HistoryControls';
import EditorPreferencesMenu from '@/features/editor-preferences/ui/EditorPreferencesMenu';
import LearnButton from '@/features/lesson-engine/ui/LearnButton';
import { getLessonById } from '@/features/lesson-engine/model/lesson-registry';
import HelpButton from '@/features/help/ui/HelpButton';
import { SceneTitle } from '@/features/scene-library';
import { ShareButton } from '@/features/share';
import { useRunSnapshot } from '@/features/callbacks';
import FileMenu from './FileMenu';
import './top-bar.scss';

/** Layout B: File, Learn and the scene on the left; history, settings, help and Share on the right. */
export default function TopBar() {
  const theme = useSiteTheme();
  const running = useRunSnapshot().running;
  const lessonId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.activeLessonId : null));
  const step = useVamsStore((s) => s.currentStepIndex);
  const lesson = lessonId ? getLessonById(lessonId) : undefined;
  const total = lesson?.steps.length ?? 0;
  const lessonLabel = lesson ? `${lesson.title} · Step ${Math.min(step + 1, total)} of ${total}` : null;
  return (
    <header className="top-bar">
      <Toaster position="bottom-center" theme={theme} />
      <a className="top-bar__home" href="/" aria-label="VAMS home">
        <Logo />
      </a>
      <div className="top-bar__left" inert={running || undefined}>
        <FileMenu />
        <LearnButton />
        <span className="top-bar__sep" aria-hidden="true" />
        <SceneTitle lessonLabel={lessonLabel} />
      </div>
      <div className="top-bar__actions" inert={running || undefined}>
        <HistoryControls />
        <span className="top-bar__sep" aria-hidden="true" />
        <EditorPreferencesMenu />
        <HelpButton />
        <span className="top-bar__share">
          <ShareButton />
        </span>
      </div>
    </header>
  );
}
