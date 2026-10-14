import { useVamsStore } from '@/core/store';
import CustomShapeBuilderPanel from '@/features/custom-shapes/ui/CustomShapeBuilderPanel';
import TextNodePanel from '@/features/text-nodes/ui/TextNodePanel';
import { PanelLayoutContext } from '@/shared/ui/controls';

/** Where the student builds: primitives, text, and the prepared scenes. */
export default function AddPanel() {
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');
  const focusPanelId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.lessonFocusPanel : null));
  return (
    <PanelLayoutContext.Provider value={{ mode: inLesson ? 'lesson' : 'author', focusPanelId, embedded: true }}>
      <section className="rail-panel add-panel" aria-labelledby="add-panel-title">
        <header className="rail-panel__head">
          <h2 id="add-panel-title" className="rail-panel__title">Add</h2>
          <p className="rail-panel__hint">Pick a shape, then click the canvas to place its vertices. Enter finishes.</p>
        </header>
        <div className="rail-panel__body" data-scroll-root>
          <CustomShapeBuilderPanel />
          <TextNodePanel />
        </div>
      </section>
    </PanelLayoutContext.Provider>
  );
}
