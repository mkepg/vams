import { useVamsStore } from '@/core/store';
import SceneHierarchyPanel from '@/features/scene-hierarchy/ui/SceneHierarchyPanel';
import { PanelLayoutContext } from '@/shared/ui/controls';
import ObjectInspector from './ObjectInspector';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The scene's objects above the selected object's inspector. */
export default function ScenePanel() {
  // A group draws nothing of its own, so it is counted apart from the objects.
  const groups = useVamsStore((s) => s.objects.filter((o) => o.type === 'GROUP').length);
  const count = useVamsStore((s) => s.objects.length) - groups;
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');
  const focusPanelId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.lessonFocusPanel : null));
  return (
    <section className="rail-panel scene-panel" aria-labelledby="scene-panel-title">
      <header className="rail-panel__head">
        <h2 id="scene-panel-title" className="rail-panel__title">Scene</h2>
        <span className="rail-panel__count">{groups ? `${plural(count, 'object')} · ${plural(groups, 'group')}` : plural(count, 'object')}</span>
      </header>
      <PanelLayoutContext.Provider value={{ mode: inLesson ? 'lesson' : 'author', focusPanelId, embedded: true }}>
        <div className="scene-panel__list">
          <SceneHierarchyPanel />
        </div>
      </PanelLayoutContext.Provider>
      <ObjectInspector />
    </section>
  );
}
