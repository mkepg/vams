import { useLayoutEffect, useRef } from 'react';
import { useVamsStore } from '@/core/store';
import { resolveFocus } from '@/core/inspector';
import type { SceneNode } from '@/core/types/scene';
import { getLessonById } from '@/features/lesson-engine/model/lesson-registry';
import { focusStyleFor } from '@/features/lesson-engine/model/guidance';
import { Button, PanelLayoutContext } from '@/shared/ui/controls';
import InspectorGroup from './InspectorGroup';
import { OBJECT_GROUP_DEFS, SETTINGS_GROUP_DEFS } from './inspector-groups';
import { scrollUnderCard } from './scroll-under-card';

function metaLine(object: SceneNode): string {
  if (object.type === 'TEXT') return 'Bitmap text';
  if (object.type === 'GROUP') {
    const n = object.children?.length ?? 0;
    return `Group · ${n === 1 ? '1 object' : `${n} objects`}`;
  }
  return `GL_${object.type} · ${object.vertices.length} vertices`;
}

/** The selected object's groups in pipeline order, or the scene settings when nothing is selected. */
export default function Inspector() {
  const selected = useVamsStore((s) => s.objects.find((o) => o.id === s.selectedObjectId) ?? null);
  const openGroups = useVamsStore((s) => s.openGroups);
  const toggleGroup = useVamsStore((s) => s.toggleGroup);
  const openGroup = useVamsStore((s) => s.openGroup);
  const setOpenGroups = useVamsStore((s) => s.setOpenGroups);
  const selectObject = useVamsStore((s) => s.selectObject);
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');
  const lessonId = useVamsStore((s) => s.activeLessonId);
  const focusPanelId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.lessonFocusPanel : null));
  const stepIndex = useVamsStore((s) => s.currentStepIndex);

  const lesson = inLesson && lessonId ? getLessonById(lessonId) : undefined;
  const style = lesson ? focusStyleFor(lesson) : 'none';
  const place = resolveFocus(focusPanelId, selected !== null);

  // A settings focus shows the settings even with an object selected.
  const showSettings = !selected || place?.area === 'settings';
  const defs = showSettings ? SETTINGS_GROUP_DEFS : OBJECT_GROUP_DEFS.filter((def) => !def.applies || def.applies(selected!));
  // Only a group the inspector shows can be focused: a line has no Texture group to open, so a
  // step aimed at one collapses and dims nothing.
  const group = place && (place.area === 'object' || place.area === 'settings') ? place.group : null;
  const target = group && defs.some((def) => def.id === group) ? group : null;

  // Each step opens its group. A demo also collapses the others; the student can reopen them.
  // The scroll waits a frame: the collapse and the card's new narration render after this
  // effect, and measuring before them leaves the group under the card.
  const rootRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!target) return;
    if (style === 'tight') setOpenGroups([target]);
    else openGroup(target);
    const frame = requestAnimationFrame(() =>
      scrollUnderCard(rootRef.current?.querySelector<HTMLElement>(`[data-group="${target}"]`) ?? null),
    );
    return () => cancelAnimationFrame(frame);
  }, [target, style, stepIndex, lessonId, setOpenGroups, openGroup]);

  return (
    <PanelLayoutContext.Provider value={{ mode: inLesson ? 'lesson' : 'author', focusPanelId, embedded: true }}>
      <div ref={rootRef} className="inspector">
        <div className="inspector__head">
          {showSettings ? (
            <h2 className="inspector__name">Scene settings</h2>
          ) : (
            <>
              <div className="inspector__id">
                <h2 className="inspector__name">{selected!.name}</h2>
                <span className="inspector__meta">{metaLine(selected!)}</span>
              </div>
              <Button variant="quiet" onClick={() => selectObject(null)}>Scene settings</Button>
            </>
          )}
        </div>
        {defs.map((def) => (
          <InspectorGroup
            key={def.id}
            id={def.id}
            title={def.title}
            hint={def.hint(selected)}
            open={openGroups.includes(def.id)}
            onToggle={() => toggleGroup(def.id)}
            focused={def.id === target}
            dimmed={style === 'tight' && target !== null && def.id !== target}
          >
            {def.render(selected)}
          </InspectorGroup>
        ))}
      </div>
    </PanelLayoutContext.Provider>
  );
}
