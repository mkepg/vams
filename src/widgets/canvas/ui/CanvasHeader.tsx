import { useVamsStore } from '@/core/store';
import { RunControl } from '@/features/callbacks';
import { fmt, short } from '@/shared/lib/format-number';
import { Button } from '@/shared/ui/controls';

/** A # for the Grid numbers toggle: two slanted verticals, two horizontals. */
const GridNumbersIcon = (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
    <path d="M5 2 4 14M11 2l-1 12M2 5.5h12M1.6 10.5h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

/** The canvas column's header: the viewing volume, placement keys, the cursor and Run. */
export default function CanvasHeader() {
  const v = useVamsStore((s) => s.viewportLimits);
  const placing = useVamsStore((s) => s.interactionMode === 'VERTEX_PLACE');
  const tracker = useVamsStore((s) => s.showCoordinateTracker);
  const cursor = useVamsStore((s) => s.cursorWorld);
  const axisVisibility = useVamsStore((s) => s.axisVisibility);
  const setAxisVisibility = useVamsStore((s) => s.setAxisVisibility);
  const axesOn = axisVisibility.showOriginMarker;
  return (
    <div className="canvas-header">
      <span className="canvas-header__title">Canvas</span>
      {!placing && (
        <span className="canvas-header__volume">{`x ${short(v.minX)}…${short(v.maxX)} · y ${short(v.minY)}…${short(v.maxY)}`}</span>
      )}
      {placing && (
        <span className="canvas-header__hint" role="status" title="Click to place · Enter finish · Backspace undo · Esc cancel">
          Click to place · <kbd>Enter</kbd> finish · <kbd>Backspace</kbd> undo · <kbd>Esc</kbd> cancel
        </span>
      )}
      <span className="canvas-header__spacer" />
      {tracker && cursor && (
        <span className="canvas-header__cursor">{`X ${fmt(cursor.x)}  Y ${fmt(cursor.y)}`}</span>
      )}
      {!placing && (
        <Button
          variant="quiet"
          iconOnly
          className="canvas-header__numbers"
          label="Grid numbers"
          title={axesOn ? 'Grid numbers' : 'Grid numbers (turn on Coordinate axes first)'}
          icon={GridNumbersIcon}
          aria-pressed={axisVisibility.showGridNumbers}
          disabled={!axesOn}
          onClick={() => setAxisVisibility({ ...axisVisibility, showGridNumbers: !axisVisibility.showGridNumbers })}
        />
      )}
      <RunControl note={false} />
    </div>
  );
}
