import { useVamsStore } from '@/core/store';
import { PanelLayoutContext } from '@/shared/ui/controls';
import SceneHierarchyPanel from '@/features/scene-hierarchy/ui/SceneHierarchyPanel';
import CustomShapeBuilderPanel from '@/features/custom-shapes/ui/CustomShapeBuilderPanel';
import TextNodePanel from '@/features/text-nodes/ui/TextNodePanel';

/** The scene: its objects, the Add row, and Create Text. Always visible, in both modes. */
export default function SceneArea({ focusPanelId = null }: { focusPanelId?: string | null }) {
  const count = useVamsStore((s) => s.objects.length);
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');
  return (
    <PanelLayoutContext.Provider value={{ mode: inLesson ? 'lesson' : 'author', focusPanelId, embedded: true }}>
      <section className="scene-area" aria-labelledby="scene-area-title">
        <h2 id="scene-area-title" className="scene-area__title">
          Scene <span className="scene-area__count">{count === 1 ? '1 object' : `${count} objects`}</span>
        </h2>
        <SceneHierarchyPanel />
        <CustomShapeBuilderPanel />
        <TextNodePanel />
      </section>
    </PanelLayoutContext.Provider>
  );
}
