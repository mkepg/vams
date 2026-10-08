import { useLayoutEffect, useRef } from 'react';
import type { ComponentChildren } from 'preact';
import { useVamsStore } from '@/core/store';
import LessonCard from '@/features/lesson-engine/ui/LessonCard';
import SceneArea from './SceneArea';
import Inspector from './Inspector';
import './editor-column.scss';

/** The left column: the lesson card in Lesson mode, then the scene area and the inspector, the same in every section. */
export default function EditorColumn({ cardExtra }: { cardExtra?: ComponentChildren }) {
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');

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

  return (
    <div className="editor-column" data-scroll-root>
      {inLesson && (
        <div className="editor-column__head">
          <LessonCard>{cardExtra}</LessonCard>
        </div>
      )}
      <SceneArea />
      <Inspector />
    </div>
  );
}
