import { useLayoutEffect, useRef } from 'react';
import { useVamsStore } from '@/core/store';
import { resolveFocus } from '@/core/inspector';
import SceneArea from './SceneArea';
import Inspector from './Inspector';
import { scrollIntoRoot } from './scroll-into-root';
import './editor-column.scss';

/** The left column: the scene area and the inspector, the same in every section. */
export default function EditorColumn() {
  const focusPanelId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.lessonFocusPanel : null));
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
      scrollIntoRoot(rootRef.current?.querySelector<HTMLElement>(`[data-panel-id="${scenePanel}"]`)),
    );
    return () => cancelAnimationFrame(frame);
  }, [scenePanel, stepIndex, lessonId]);

  // "Add a shape" on the empty canvas: bring the Add row into view. The row marks itself.
  const seenCue = useRef(addRowCue);
  useLayoutEffect(() => {
    if (addRowCue === seenCue.current) return;
    seenCue.current = addRowCue;
    const frame = requestAnimationFrame(() =>
      scrollIntoRoot(rootRef.current?.querySelector<HTMLElement>('[data-panel-id="primitive-palette"]')),
    );
    return () => cancelAnimationFrame(frame);
  }, [addRowCue]);

  return (
    <div ref={rootRef} className="editor-column" data-scroll-root>
      <SceneArea focusPanelId={focusPanelId} />
      <Inspector />
    </div>
  );
}
