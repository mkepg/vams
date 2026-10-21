import { useVamsStore } from '@/core/store';
import { RunControl } from '@/features/callbacks';
import ViewMenu from '@/features/editor-preferences/ui/ViewMenu';
import { fmt, short } from '@/shared/lib/format-number';
import PipelineModeSwitch from './PipelineModeSwitch';

/** The canvas column's header: the viewing volume, placement keys, the cursor and Run. */
export default function CanvasHeader() {
  const v = useVamsStore((s) => s.viewportLimits);
  const placing = useVamsStore((s) => s.interactionMode === 'VERTEX_PLACE');
  const tracker = useVamsStore((s) => s.showCoordinateTracker);
  const cursor = useVamsStore((s) => s.cursorWorld);
  // A "Which Stage?" picture fixes the canvas, so the choice of view waits until it is answered.
  const switchShown = useVamsStore((s) => s.activeSection === 'Pipeline' && s.quizPipelineStage === null);
  return (
    <div className={`canvas-header${placing ? ' canvas-header--placing' : ''}`}>
      <span className="canvas-header__title">Canvas</span>
      {!placing && (
        <span className="canvas-header__volume">{`x ${short(v.minX)}…${short(v.maxX)} · y ${short(v.minY)}…${short(v.maxY)}`}</span>
      )}
      {placing && (
        <span className="canvas-header__hint" role="status" title="Click to place · Enter finish · Backspace undo · Esc cancel">
          Click to place · <kbd>Enter</kbd> finish · <kbd>Backspace</kbd> undo · <kbd>Esc</kbd> cancel
        </span>
      )}
      {!placing && <span className="canvas-header__spacer" />}
      {tracker && cursor && (
        <span className="canvas-header__cursor">{`X ${fmt(cursor.x)}  Y ${fmt(cursor.y)}`}</span>
      )}
      {switchShown && <PipelineModeSwitch />}
      <ViewMenu iconOnly={placing} />
      <RunControl />
    </div>
  );
}
