import { useLayoutEffect, type RefObject } from 'react';
import { useVamsStore } from '@/core/store';
import { resolveFocus, type InspectorGroupId } from '@/core/inspector';
import { getLessonById } from '@/features/lesson-engine/model/lesson-registry';
import { focusStyleFor, type FocusStyle } from '@/features/lesson-engine/model/guidance';
import type { GroupDef } from './inspector-groups';
import { scrollIntoRoot } from './scroll-into-root';

/**
 * The lesson step's group among `defs`, and how tightly the lesson focuses it. Each step opens its
 * group; a demo also collapses the others, which the student can reopen. Only a group the panel
 * shows can be focused: a line has no Texture group, so a step aimed at one changes nothing. The
 * scroll waits a frame, so it measures the layout after the collapse.
 */
export function useGroupFocus(
  defs: readonly GroupDef[],
  area: 'object' | 'settings',
  hasSelection: boolean,
  rootRef: RefObject<HTMLElement>,
): { target: InspectorGroupId | null; style: FocusStyle } {
  const setOpenGroups = useVamsStore((s) => s.setOpenGroups);
  const openGroup = useVamsStore((s) => s.openGroup);
  const lessonId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.activeLessonId : null));
  const focusPanelId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.lessonFocusPanel : null));
  const stepIndex = useVamsStore((s) => s.currentStepIndex);

  const lesson = lessonId ? getLessonById(lessonId) : undefined;
  const style: FocusStyle = lesson ? focusStyleFor(lesson) : 'none';
  const place = resolveFocus(focusPanelId, hasSelection);
  // Outside a lesson, a group opened from the code's explanation strip is outlined the same way.
  const revealed = useVamsStore((s) => (s.appMode === 'Author' ? s.revealedGroup : null));
  const group = place && place.area === area ? place.group : revealed;
  const target = group && defs.some((def) => def.id === group) ? group : null;

  useLayoutEffect(() => {
    if (!target) return;
    if (style === 'tight') setOpenGroups([target]);
    else openGroup(target);
    const frame = requestAnimationFrame(() =>
      scrollIntoRoot(rootRef.current?.querySelector<HTMLElement>(`[data-group="${target}"]`)),
    );
    return () => cancelAnimationFrame(frame);
  }, [target, style, stepIndex, lessonId, setOpenGroups, openGroup, rootRef]);

  return { target, style };
}
