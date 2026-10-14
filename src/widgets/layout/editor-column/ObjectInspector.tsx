import { useRef } from 'react';
import { useVamsStore } from '@/core/store';
import type { SceneNode } from '@/core/types/scene';
import TextEditField from '@/features/text-nodes/ui/TextEditField';
import { PanelLayoutContext } from '@/shared/ui/controls';
import InspectorGroup from './InspectorGroup';
import { OBJECT_GROUP_DEFS } from './inspector-groups';
import { useGroupFocus } from './use-group-focus';

function metaLine(object: SceneNode): string {
  if (object.type === 'TEXT') return 'Bitmap text';
  if (object.type === 'GROUP') {
    const n = object.children?.length ?? 0;
    return `Group · ${n === 1 ? '1 object' : `${n} objects`}`;
  }
  return `GL_${object.type} · ${object.vertices.length} vertices`;
}

/** The selected object's groups in pipeline order. Scrolls on its own, under the scene list. */
export default function ObjectInspector() {
  const selected = useVamsStore((s) => s.objects.find((o) => o.id === s.selectedObjectId) ?? null);
  const openGroups = useVamsStore((s) => s.openGroups);
  const toggleGroup = useVamsStore((s) => s.toggleGroup);
  const setRailPanel = useVamsStore((s) => s.setRailPanel);
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');
  const focusPanelId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.lessonFocusPanel : null));
  const rootRef = useRef<HTMLDivElement>(null);

  const defs = selected ? OBJECT_GROUP_DEFS.filter((def) => !def.applies || def.applies(selected)) : [];
  const { target, style } = useGroupFocus(defs, 'object', selected !== null, rootRef);

  if (!selected) {
    return (
      <div className="inspector inspector--empty">
        <p className="inspector__empty">Select an object to edit it</p>
        <button type="button" className="inspector__link" onClick={() => setRailPanel('settings')}>
          Scene settings are in Settings
        </button>
      </div>
    );
  }

  return (
    <PanelLayoutContext.Provider value={{ mode: inLesson ? 'lesson' : 'author', focusPanelId, embedded: true }}>
      <div ref={rootRef} className="inspector" data-scroll-root>
        <div className="inspector__head">
          <h3 className="inspector__name">{selected.name}</h3>
          <span className="inspector__meta">{metaLine(selected)}</span>
        </div>
        <TextEditField />
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
