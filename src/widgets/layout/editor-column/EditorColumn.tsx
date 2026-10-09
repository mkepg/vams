import { useLayoutEffect, useRef } from 'react';
import type { ComponentChildren } from 'preact';
import { useVamsStore } from '@/core/store';
import { resolveFocus } from '@/core/inspector';
import LessonCard from '@/features/lesson-engine/ui/LessonCard';
import PipelineModeControls from '@/features/pipeline-controls/ui/PipelineModeControls';
import { PanelLayoutContext } from '@/shared/ui/controls';
import SceneArea from './SceneArea';
import Inspector from './Inspector';
import { scrollUnderCard } from './scroll-under-card';
import './editor-column.scss';

/** The left column: the lesson card in Lesson mode, then the scene area and the inspector, the same in every section. */
export default function EditorColumn({ cardExtra }: { cardExtra?: ComponentChildren }) {
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');
  const focusPanelId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.lessonFocusPanel : null));
  const pipelineLesson = useVamsStore((s) => s.appMode === 'Lesson' && s.activeSection === 'Pipeline');
  const lessonId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.activeLessonId : null));
  const stepIndex = useVamsStore((s) => s.currentStepIndex);
  const addRowCue = useVamsStore((s) => s.addRowCue);
  const rootRef = useRef<HTMLDivElement>(null);

  // A new lesson starts with the column at the top, under its card. The inspector's own focus
  // scroll runs a frame later, so it still lands on the step's group.
  const shownLesson = useRef(lessonId);
  useLayoutEffect(() => {
    if (lessonId === shownLesson.current) return;
    shownLesson.current = lessonId;
    if (lessonId && rootRef.current) rootRef.current.scrollTop = 0;
  }, [lessonId]);

  // A step that focuses the Scene list, the Add row or Create Text scrolls it under the card, on
  // every step (Back included). The inspector scrolls its own groups. Like the inspector, wait a
  // frame so the card's new narration has rendered before measuring.
  const scenePanel = resolveFocus(focusPanelId, false)?.area === 'scene' ? focusPanelId : null;
  useLayoutEffect(() => {
    if (!scenePanel) return;
    const frame = requestAnimationFrame(() =>
      scrollUnderCard(rootRef.current?.querySelector<HTMLElement>(`[data-panel-id="${scenePanel}"]`)),
    );
    return () => cancelAnimationFrame(frame);
  }, [scenePanel, stepIndex, lessonId]);

  // "Add a shape" on the empty canvas: bring the Add row into view. The row marks itself.
  const seenCue = useRef(addRowCue);
  useLayoutEffect(() => {
    if (addRowCue === seenCue.current) return;
    seenCue.current = addRowCue;
    const frame = requestAnimationFrame(() =>
      scrollUnderCard(rootRef.current?.querySelector<HTMLElement>('[data-panel-id="primitive-palette"]')),
    );
    return () => cancelAnimationFrame(frame);
  }, [addRowCue]);

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
    <div ref={rootRef} className="editor-column" data-scroll-root>
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
