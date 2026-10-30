import { useVamsStore } from '@/core/store';
import { resolveFocus } from '@/core/inspector';
import CallbacksPanel from '@/features/callbacks/ui/CallbacksPanel';

/** The Callbacks panel: the six GLUT callbacks and their rules. Run lives on the canvas. */
export default function CallbacksRailPanel() {
  // Marked like a focused inspector group when a lesson step aims here or the code strip opened it.
  const focused = useVamsStore((s) => {
    if (s.appMode === 'Author') return s.revealedGroup === 'callbacks';
    const place = resolveFocus(s.lessonFocusPanel, false);
    return place?.area === 'settings' && place.group === 'callbacks';
  });
  return (
    <section className={focused ? 'rail-panel callbacks-rail-panel is-focus' : 'rail-panel callbacks-rail-panel'} aria-labelledby="callbacks-panel-title">
      <header className="rail-panel__head">
        <h2 id="callbacks-panel-title" className="rail-panel__title">Callbacks</h2>
        <p className="rail-panel__hint">Functions GLUT calls when something happens. Switch one on and give it rules.</p>
      </header>
      <div className="rail-panel__body" data-scroll-root>
        <CallbacksPanel />
      </div>
      <p className="rail-panel__foot">Press Run on the canvas to try your callbacks. Esc stops.</p>
    </section>
  );
}
