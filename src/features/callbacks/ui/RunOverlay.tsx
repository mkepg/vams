import './run-overlay.scss';
import { useEffect, useId, useRef, useState } from 'react';
import { MoveDiagonal2, Play, Square } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import { addAShape } from '@/core/store/add-a-shape';
import { Button } from '@/shared/ui/controls';
import { RESIZE_STEP, runBlock, runController, type RunBlock } from '../model/run-controller';
import { useRunSnapshot } from '../model/useRunSnapshot';

export const RUN_HINT = 'Keys, clicks and drags go to your handlers · Esc stops';
export const RUN_SURFACE_LABEL = 'Running program. Keys, clicks and drags go to your handlers. Press Escape to stop.';
export const RUN_EMPTY_REASON = 'Add a shape to run your program.';
export const RUN_NO_CALLBACK_REASON = 'Run needs a callback.';
export const RUN_OPEN_CALLBACKS = 'Open Callbacks';

/** What the dialog says when Run cannot start: a heading, one sentence, and the button that fixes it. */
export const RUN_POPOVER_COPY = {
  'no-callback': {
    heading: 'Run needs a callback',
    body: 'Switch on a callback in Callbacks and give it a rule, then press Run.',
    action: RUN_OPEN_CALLBACKS,
  },
  empty: {
    heading: 'Add a shape first',
    body: 'Your program has nothing to draw yet. Add a shape, then press Run.',
    action: 'Add a shape',
  },
} as const;

const HANDLE_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-RESIZE_STEP, 0], ArrowRight: [RESIZE_STEP, 0], ArrowUp: [0, -RESIZE_STEP], ArrowDown: [0, RESIZE_STEP],
};

/** Run in the canvas header; it becomes Stop while the program runs. When Run cannot start, clicking it says why. */
export function RunControl() {
  const snap = useRunSnapshot();
  const block = useVamsStore((s) => runBlock(s));
  const setRailPanel = useVamsStore((s) => s.setRailPanel);
  const rootRef = useRef<HTMLDivElement>(null);
  const runButtonRef = useRef<HTMLButtonElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const wasRunning = useRef(false);
  const ids = useId();
  // The dialog is open for one reason at a time, so it closes by itself when the reason changes.
  const [openFor, setOpenFor] = useState<RunBlock>(null);
  const reason = block === 'empty' || block === 'no-callback' ? block : null;
  const open = reason !== null && openFor === reason;

  // Forget the reason once it changes, so an undo that brings it back can't reopen the dialog unasked.
  if (openFor !== null && openFor !== reason) setOpenFor(null);

  useEffect(() => {
    if (!snap.running && wasRunning.current) runButtonRef.current?.focus();
    wasRunning.current = snap.running;
  }, [snap.running]);

  useEffect(() => {
    if (!open) return;
    actionRef.current?.focus();
    const dismiss = (refocus: boolean) => {
      setOpenFor(null);
      if (refocus) runButtonRef.current?.focus();
    };
    const onMouseDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) dismiss(true);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      dismiss(true);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  if (snap.running) {
    return (
      <div className="run-control" data-tour-anchor="run">
        <Button variant="danger" className="run-stop" icon={<Square />} onClick={() => runController.stop()}>Stop</Button>
      </div>
    );
  }
  // A Pipeline illustration replaces the canvas; there is nothing to run, so Run steps aside.
  if (block === 'illustration') return null;

  const copy = reason ? RUN_POPOVER_COPY[reason] : null;
  const act = () => {
    setOpenFor(null);
    if (reason === 'empty') addAShape();
    else setRailPanel('callbacks');
  };
  return (
    <div ref={rootRef} className="run-control" data-tour-anchor="run">
      <Button
        ref={runButtonRef}
        variant="primary"
        className="run-button"
        icon={<Play />}
        aria-disabled={reason ? 'true' : undefined}
        aria-describedby={reason ? `${ids}-why` : undefined}
        aria-haspopup={reason ? 'dialog' : undefined}
        aria-expanded={reason ? open : undefined}
        onClick={() => {
          if (reason) setOpenFor(open ? null : reason);
          else runController.start();
        }}
      >
        Run
      </Button>
      {reason && (
        <span id={`${ids}-why`} className="sr-only">
          {reason === 'empty' ? RUN_EMPTY_REASON : RUN_NO_CALLBACK_REASON}
        </span>
      )}
      {open && copy && (
        <div role="dialog" aria-labelledby={`${ids}-title`} className="run-pop">
          <h2 id={`${ids}-title`} className="run-pop__title">{copy.heading}</h2>
          <p className="run-pop__body">{copy.body}</p>
          <Button ref={actionRef} variant="primary" className="run-pop__action" onClick={act}>{copy.action}</Button>
        </div>
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
