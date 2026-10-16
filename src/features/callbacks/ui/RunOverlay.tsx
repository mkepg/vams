import './run-overlay.scss';
import { useEffect, useId, useRef } from 'react';
import { MoveDiagonal2, Play, Square } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import { Button } from '@/shared/ui/controls';
import { RESIZE_STEP, runBlock, runController } from '../model/run-controller';
import { useRunSnapshot } from '../model/useRunSnapshot';

export const RUN_HINT = 'Keys, clicks and drags go to your handlers · Esc stops';
export const RUN_SURFACE_LABEL = 'Running program. Keys, clicks and drags go to your handlers. Press Escape to stop.';
export const RUN_EMPTY_REASON = 'Add a shape to run your program.';
export const RUN_NO_CALLBACK_REASON = 'Run needs a callback.';
export const RUN_OPEN_CALLBACKS = 'Open Callbacks';

const HANDLE_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-RESIZE_STEP, 0], ArrowRight: [RESIZE_STEP, 0], ArrowUp: [0, -RESIZE_STEP], ArrowDown: [0, RESIZE_STEP],
};

/** Run in the canvas header; it becomes Stop while the program runs. */
export function RunControl() {
  const snap = useRunSnapshot();
  const block = useVamsStore((s) => runBlock(s));
  const setRailPanel = useVamsStore((s) => s.setRailPanel);
  const plateId = useId();
  const runButtonRef = useRef<HTMLButtonElement>(null);
  const wasRunning = useRef(false);

  useEffect(() => {
    if (!snap.running && wasRunning.current) runButtonRef.current?.focus();
    wasRunning.current = snap.running;
  }, [snap.running]);

  if (snap.running) {
    return (
      <div className="run-control" data-tour-anchor="run">
        <Button variant="danger" className="run-stop" icon={<Square />} onClick={() => runController.stop()}>Stop</Button>
      </div>
    );
  }
  // A Pipeline illustration replaces the canvas; there is nothing to run, so Run steps aside.
  if (block === "illustration") return null;
  return (
    <div className="run-control" data-tour-anchor="run">
      <Button
        ref={runButtonRef}
        variant="primary"
        className="run-button"
        icon={<Play />}
        disabled={block !== null}
        aria-describedby={block ? plateId : undefined}
        onClick={() => runController.start()}
      >
        Run
      </Button>
      {block && (
        <p id={plateId} className="run-plate">
          {block === "empty" ? (
            RUN_EMPTY_REASON
          ) : (
            <>
              {RUN_NO_CALLBACK_REASON}{" "}
              <button type="button" className="run-plate__link" onClick={() => setRailPanel("callbacks")}>
                {RUN_OPEN_CALLBACKS}
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}

/** The running program over the canvas: its window, the Running strip and the last call. */
export function RunLayer() {
  const snap = useRunSnapshot();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const wasRunning = useRef(false);

  useEffect(() => {
    if (snap.running && !wasRunning.current) surfaceRef.current?.focus();
    wasRunning.current = snap.running;
  }, [snap.running]);

  if (!snap.running || !snap.window) return null;

  const win = snap.window;
  const local = (event: PointerEvent) => {
    const rect = surfaceRef.current!.getBoundingClientRect();
    return { x: Math.round(event.clientX - rect.left), y: Math.round(event.clientY - rect.top) };
  };
  const startDrag = (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const start = { x: event.clientX, y: event.clientY, width: win.width, height: win.height };
    const move = (e: PointerEvent) =>
      runController.resizeWindow(start.width + e.clientX - start.x, start.height + e.clientY - start.y);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const onHandleKey = (event: KeyboardEvent) => {
    const step = HANDLE_KEYS[event.key];
    if (!step) return;
    event.preventDefault();
    event.stopPropagation();
    runController.nudgeWindow(step[0], step[1]);
  };

  return (
    <div className="run-layer">
      <p className="sr-only" role="status" aria-live="polite">Running</p>
      <div className="run-window" style={{ width: `${win.width}px`, height: `${win.height}px` }}>
        <div
          ref={surfaceRef}
          className="run-surface"
          tabIndex={0}
          aria-label={RUN_SURFACE_LABEL}
          onPointerDown={(e) => {
            try {
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            } catch {
              // No active pointer to capture (synthetic events); delivery still works.
            }
            const p = local(e);
            runController.pointerDown(e.button, p.x, p.y);
          }}
          onPointerUp={(e) => {
            const p = local(e);
            runController.pointerUp(e.button, p.x, p.y);
          }}
          onPointerMove={(e) => {
            const p = local(e);
            runController.pointerMove(p.x, p.y, e.buttons !== 0);
          }}
          onContextMenu={(e) => e.preventDefault()}
        />
        <button
          type="button"
          className="run-handle"
          aria-label="Resize the program window"
          onPointerDown={startDrag}
          onKeyDown={onHandleKey}
        >
          <MoveDiagonal2 size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="run-strip">
        <span className="run-strip__dot" aria-hidden="true" />
        <span className="run-strip__title">Running</span>
        <span className="run-strip__hint">{RUN_HINT}</span>
      </div>
      <p className="run-readout">{snap.lastCall ?? 'Waiting for an event'}</p>
    </div>
  );
}

export default function RunOverlay() {
  return (
    <>
      <RunControl />
      <RunLayer />
    </>
  );
}
