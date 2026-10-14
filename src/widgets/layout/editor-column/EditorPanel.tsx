import { useLayoutEffect, useRef } from 'react';
import { useVamsStore } from '@/core/store';
import { resolveFocus } from '@/core/inspector';
import AddPanel from './AddPanel';
import ScenePanel from './ScenePanel';
import SettingsPanel from './SettingsPanel';
import CallbacksRailPanel from './CallbacksRailPanel';
import { scrollIntoRoot } from './scroll-into-root';
import './editor-column.scss';

/** The open rail panel. The shell's panel region is the tabpanel; this is what it holds. */
export default function EditorPanel() {
  const railPanel = useVamsStore((s) => s.railPanel);
  const lessonId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.activeLessonId : null));
  const focusPanelId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.lessonFocusPanel : null));
  const stepIndex = useVamsStore((s) => s.currentStepIndex);
  const rootRef = useRef<HTMLDivElement>(null);

  // A new lesson starts with the open panel scrolled to the top.
  const shownLesson = useRef(lessonId);
  useLayoutEffect(() => {
    if (lessonId === shownLesson.current) return;
    shownLesson.current = lessonId;
    if (!lessonId) return;
    rootRef.current?.querySelectorAll<HTMLElement>('[data-scroll-root]').forEach((el) => {
      el.scrollTop = 0;
    });
  }, [lessonId]);

  // A step that focuses the Add row or Create Text scrolls it into view, on every step (Back
  // included). The inspector and Settings scroll their own groups. Wait a frame for the layout.
  const sceneTarget = resolveFocus(focusPanelId, false)?.area === 'scene' ? focusPanelId : null;
  useLayoutEffect(() => {
    if (!sceneTarget) return;
    const frame = requestAnimationFrame(() =>
      scrollIntoRoot(rootRef.current?.querySelector<HTMLElement>(`[data-panel-id="${sceneTarget}"]`)),
    );
    return () => cancelAnimationFrame(frame);
  }, [sceneTarget, stepIndex, lessonId, railPanel]);

  return (
    <div ref={rootRef} className="editor-panel">
      {railPanel === 'add' && <AddPanel />}
      {railPanel === 'scene' && <ScenePanel />}
      {railPanel === 'settings' && <SettingsPanel />}
      {railPanel === 'callbacks' && <CallbacksRailPanel />}
    </div>
  );
}
