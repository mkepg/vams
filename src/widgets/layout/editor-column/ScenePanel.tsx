import { useVamsStore } from '@/core/store';
import SceneHierarchyPanel from '@/features/scene-hierarchy/ui/SceneHierarchyPanel';
import { PanelLayoutContext } from '@/shared/ui/controls';
import ObjectInspector from './ObjectInspector';

/** The scene's objects above the selected object's inspector. */
export default function ScenePanel() {
  const count = useVamsStore((s) => s.objects.length);
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');
  const focusPanelId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.lessonFocusPanel : null));
  return (
    <section className="rail-panel scene-panel" aria-labelledby="scene-panel-title">
      <header className="rail-panel__head">
        <h2 id="scene-panel-title" className="rail-panel__title">Scene</h2>
        <span className="rail-panel__count">{count === 1 ? '1 object' : `${count} objects`}</span>
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
