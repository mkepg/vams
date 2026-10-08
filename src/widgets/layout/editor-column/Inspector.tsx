import { useVamsStore } from '@/core/store';
import type { SceneNode } from '@/core/types/scene';
import { Button, PanelLayoutContext } from '@/shared/ui/controls';
import InspectorGroup from './InspectorGroup';
import { OBJECT_GROUP_DEFS, SETTINGS_GROUP_DEFS } from './inspector-groups';

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
  const selectObject = useVamsStore((s) => s.selectObject);
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');

  const showSettings = !selected;
  const defs = showSettings ? SETTINGS_GROUP_DEFS : OBJECT_GROUP_DEFS.filter((def) => !def.applies || def.applies(selected));

  return (
    <PanelLayoutContext.Provider value={{ mode: inLesson ? 'lesson' : 'author', focusPanelId: null, embedded: true }}>
      <div className="inspector">
        <div className="inspector__head">
          {showSettings ? (
            <h2 className="inspector__name">Scene settings</h2>
          ) : (
            <>
              <div className="inspector__id">
                <h2 className="inspector__name">{selected.name}</h2>
                <span className="inspector__meta">{metaLine(selected)}</span>
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
          >
            {def.render(selected)}
          </InspectorGroup>
        ))}
      </div>
    </PanelLayoutContext.Provider>
  );
}
