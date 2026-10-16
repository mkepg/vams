import { useEffect, useLayoutEffect, useRef } from 'react';
import type { ComponentChildren, JSX } from 'preact';
import { runController, useRunSnapshot } from '@/features/callbacks';
import { PROGRAM_WINDOW_TITLE } from '@/shared/lib/program-window';
import { MIN_WINDOW_SIZE, resizeRect, type Rect, type ResizeEdge } from '../model/program-window';
import { useProgramWindow } from '../model/program-window-store';
import CanvasWindow, { type WindowControls } from './CanvasWindow';

interface ProgramWindowProps {
  size: { width: number; height: number };
  /** Hides the window under an illustration; it stays laid out so the canvas keeps its size. */
  away?: boolean;
  children: ComponentChildren;
}

type Drag =
  | { kind: 'move'; x: number; y: number; from: Rect }
  | { kind: 'size'; edge: ResizeEdge; x: number; y: number; from: Rect };

const capture = (event: PointerEvent) => {
  try {
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  } catch {
    // No active pointer to capture (synthetic events); delivery still works.
  }
};

/** The stage: the program's window floating on it, movable and resizable, and the chip that brings it back. */
export default function ProgramWindow({ size, away = false, children }: ProgramWindowProps) {
  const running = useRunSnapshot().running;
  const mode = useProgramWindow((s) => s.mode);
  const rect = useProgramWindow((s) => s.rect);
  const frameRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<Drag | null>(null);
  const wasHidden = useRef(mode === 'minimised' || mode === 'closed');
  // Set when the student's own Minimise or Close hides the window, so the chip takes focus and nothing else does.
  const focusChip = useRef(false);

  // The frame is the stage. A read with a zero side is ignored by the store.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const read = () => useProgramWindow.getState().setStage({ width: frame.clientWidth, height: frame.clientHeight });
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(read);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // Starting the program shows its window.
  useEffect(() => {
    if (running) useProgramWindow.getState().show();
  }, [running]);

  const hidden = mode === 'minimised' || mode === 'closed';
  useEffect(() => {
    const was = wasHidden.current;
    wasHidden.current = hidden;
    if (hidden && !was && focusChip.current) {
      focusChip.current = false;
      const id = requestAnimationFrame(() => chipRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
    if (!hidden && was && !runController.getSnapshot().running) {
      frameRef.current?.querySelector<HTMLElement>('.canvas-window__btn')?.focus();
    }
  }, [hidden]);

  const begin = (next: Drag, event: PointerEvent) => {
    drag.current = next;
    capture(event);
  };
  const dragTo = (event: PointerEvent) => {
    const d = drag.current;
    const { stage, moveTo, resizeTo } = useProgramWindow.getState();
    if (!d || !stage) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    if (d.kind === 'move') moveTo(d.from.x + dx, d.from.y + dy);
    else resizeTo(resizeRect(d.from, d.edge, dx, dy, stage, MIN_WINDOW_SIZE));
  };
  const end = () => {
    drag.current = null;
  };
  const floatingRect = () => {
    const s = useProgramWindow.getState();
    return s.mode === 'floating' ? s.rect : null;
  };

  const controls: WindowControls = {
    maximised: mode === 'maximised',
    onMinimise: () => {
      focusChip.current = true;
      useProgramWindow.getState().minimise();
    },
    onMaximise: () => useProgramWindow.getState().toggleMaximise(),
    onClose: () => {
      focusChip.current = true;
      runController.stop();
      useProgramWindow.getState().close();
    },
    barProps: {
      onPointerDown: (event) => {
        const from = floatingRect();
        if (event.button !== 0 || (event.target as Element).closest('button') || !from) return;
        begin({ kind: 'move', x: event.clientX, y: event.clientY, from }, event);
      },
      onPointerMove: dragTo,
      onPointerUp: end,
      onPointerCancel: end,
      onDblClick: (event) => {
        if (!(event.target as Element).closest('button')) useProgramWindow.getState().toggleMaximise();
      },
    },
    handleProps: (edge) => ({
      onPointerDown: (event) => {
        const from = floatingRect();
        if (event.button !== 0 || !from) return;
        event.stopPropagation();
        begin({ kind: 'size', edge, x: event.clientX, y: event.clientY, from }, event);
      },
      onPointerMove: dragTo,
      onPointerUp: end,
      onPointerCancel: end,
    }),
  };

  const placed: JSX.CSSProperties | undefined =
    rect && mode !== 'maximised'
      ? { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` }
      : undefined;
  const classes = [`canvas-window--${mode === 'maximised' ? 'maximised' : 'floating'}`, hidden ? 'canvas-window--away' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={frameRef} className={`canvas-stage__frame${away ? ' canvas-stage__frame--away' : ''}`}>
      <CanvasWindow size={size} running={running} controls={controls} className={classes} style={placed}>
        {children}
      </CanvasWindow>
      {hidden && (
        <button ref={chipRef} type="button" className="canvas-chip" onClick={() => useProgramWindow.getState().show()}>
          {mode === 'closed' ? `Open ${PROGRAM_WINDOW_TITLE}` : PROGRAM_WINDOW_TITLE}
        </button>
      )}
    </div>
  );
}
