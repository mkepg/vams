import { useRef } from 'react';
import type { RefObject } from 'preact';
import { clampSplit, SPLIT_PAGE, SPLIT_STEP, type SplitLimits } from '../model/split';

interface HandleProps {
  /** A vertical handle sits between the panes and moves left and right; a horizontal one moves up and down. */
  orientation: 'vertical' | 'horizontal';
  label: string;
  /** The share of the box before the handle, 0 to 1. */
  value: number;
  limits: SplitLimits;
  onChange: (value: number) => void;
  /** The box the share is of. */
  boxRef: RefObject<HTMLElement>;
  /** The id of the pane the handle sizes. */
  controls?: string;
  className?: string;
}

/** A focusable separator: arrows move it a step (Shift a larger one), Home and End go to the limits, and it drags. */
export default function Handle({ orientation, label, value, limits, onChange, boxRef, controls, className }: HandleProps) {
  const dragging = useRef(false);
  const vertical = orientation === 'vertical';

  const fromPointer = (event: PointerEvent) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    const size = vertical ? box.width : box.height;
    if (size <= 0) return;
    onChange(clampSplit(vertical ? (event.clientX - box.left) / size : (event.clientY - box.top) / size, limits));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.shiftKey ? SPLIT_PAGE : SPLIT_STEP;
    const back = vertical ? 'ArrowLeft' : 'ArrowUp';
    const on = vertical ? 'ArrowRight' : 'ArrowDown';
    let next: number | null = null;
    if (event.key === back) next = value - step;
    else if (event.key === on) next = value + step;
    else if (event.key === 'Home') next = limits.min;
    else if (event.key === 'End') next = limits.max;
    if (next === null) return;
    event.preventDefault();
    onChange(clampSplit(next, limits));
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={orientation}
      aria-label={label}
      aria-controls={controls}
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={Math.round(limits.min * 100)}
      aria-valuemax={Math.round(limits.max * 100)}
      className={`lab-handle lab-handle--${orientation}${className ? ` ${className}` : ''}`}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        dragging.current = true;
        try {
          (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
        } catch {
          // No active pointer to capture (synthetic events); delivery still works.
        }
      }}
      onPointerMove={(event) => {
        if (dragging.current) fromPointer(event);
      }}
      onPointerUp={(event) => {
        if (!dragging.current) return;
        fromPointer(event);
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    />
  );
}
