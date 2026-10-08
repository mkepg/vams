import { useLayoutEffect, useRef } from 'react';
import type { ComponentChildren } from 'preact';
import { useVamsStore } from '@/core/store';
import LessonCard from '@/features/lesson-engine/ui/LessonCard';
import PipelineModeControls from '@/features/pipeline-controls/ui/PipelineModeControls';
import { PanelLayoutContext } from '@/shared/ui/controls';
import SceneArea from './SceneArea';
import Inspector from './Inspector';
import './editor-column.scss';

/** The left column: the lesson card in Lesson mode, then the scene area and the inspector, the same in every section. */
export default function EditorColumn({ cardExtra }: { cardExtra?: ComponentChildren }) {
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');
  const focusPanelId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.lessonFocusPanel : null));
  const pipelineLesson = useVamsStore((s) => s.appMode === 'Lesson' && s.activeSection === 'Pipeline');

  // Leaving a lesson removes the card and its focused Exit button. When that drops focus to the
  // page, hand it to the Learn button; never take it from elsewhere.
  const wasInLesson = useRef(inLesson);
  useLayoutEffect(() => {
    const left = wasInLesson.current && !inLesson;
    wasInLesson.current = inLesson;
    if (!left) return;
    const active = document.activeElement;
    if (active && active !== document.body && document.contains(active)) return;
    document.querySelector<HTMLElement>('.learn-trigger')?.focus();
  }, [inLesson]);

  // Pipeline lessons switch the canvas between the scene and its illustrations from the card.
  const extra = pipelineLesson ? (
    <PanelLayoutContext.Provider value={{ mode: 'lesson', focusPanelId, embedded: true }}>
      <PipelineModeControls />
    </PanelLayoutContext.Provider>
  ) : null;

  return (
    <div className="editor-column" data-scroll-root>
      {inLesson && (
        <div className="editor-column__head">
          <LessonCard>{cardExtra ?? extra}</LessonCard>
        </div>
      )}
      <SceneArea focusPanelId={focusPanelId} />
      <Inspector />
    </div>
  );
}
