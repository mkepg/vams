import { useVamsStore } from '@/core/store';
import { RunControl } from '@/features/callbacks';
import { fmt, short } from '@/shared/lib/format-number';

/** The canvas column's header: the viewing volume, placement keys, the cursor and Run. */
export default function CanvasHeader() {
  const v = useVamsStore((s) => s.viewportLimits);
  const placing = useVamsStore((s) => s.interactionMode === 'VERTEX_PLACE');
  const tracker = useVamsStore((s) => s.showCoordinateTracker);
  const cursor = useVamsStore((s) => s.cursorWorld);
  return (
    <div className="canvas-header">
      <span className="canvas-header__title">Canvas</span>
      <span className="canvas-header__volume">{`x ${short(v.minX)}…${short(v.maxX)} · y ${short(v.minY)}…${short(v.maxY)}`}</span>
      {placing && (
        <span className="canvas-header__hint" role="status">
          Click to place a vertex · <kbd>Enter</kbd> finish · <kbd>Backspace</kbd> undo · <kbd>Esc</kbd> cancel
        </span>
      )}
      <span className="canvas-header__spacer" />
      {tracker && cursor && (
        <span className="canvas-header__cursor">{`X ${fmt(cursor.x)}  Y ${fmt(cursor.y)}`}</span>
      )}
      <RunControl />
    </div>
  );
}
