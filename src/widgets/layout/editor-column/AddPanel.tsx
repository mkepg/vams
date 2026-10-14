import { useVamsStore } from '@/core/store';
import { PRESET_LINKS } from '@/entities/project/model/preset-links';
import { openPreset } from '@/features/scene-library';
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
          {!inLesson && (
          <section className="add-samples" aria-labelledby="add-samples-title">
            <h3 id="add-samples-title" className="add-samples__title">Or start from a sample</h3>
            <div className="add-samples__list">
              {PRESET_LINKS.map((preset) => (
                <button key={preset.slug} type="button" className="add-samples__item" onClick={() => void openPreset(preset.slug)}>
                  {preset.title}
                </button>
              ))}
            </div>
          </section>
          )}
        </div>
      </section>
    </PanelLayoutContext.Provider>
  );
}
