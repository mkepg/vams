/** Geometry for the program window on the stage. All values are in CSS pixels, in stage coordinates. */
export interface Size {
  width: number;
  height: number;
}
export interface Rect extends Size {
  x: number;
  y: number;
}
export type ResizeEdge = 'e' | 's' | 'se';

/** The gap the floating window leaves around itself on the stage. */
export const STAGE_MARGIN = 24;
/** The title bar's height, and the window frame's border on each side. */
export const BAR_HEIGHT = 28;
export const FRAME_BORDER = 1;
/** How much of the title bar must stay on the stage, so the window can always be grabbed. */
export const REACH = 80;
/** The smallest canvas body, and the window that holds it. */
export const MIN_BODY: Size = { width: 240, height: 180 };
export const MIN_WINDOW_SIZE: Size = {
  width: MIN_BODY.width + 2 * FRAME_BORDER,
  height: MIN_BODY.height + BAR_HEIGHT + 2 * FRAME_BORDER,
};

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** The window centred on the stage, leaving `margin` on every side. */
export function centredRect(stage: Size, margin: number): Rect {
  return {
    x: margin,
    y: margin,
    width: Math.max(0, stage.width - 2 * margin),
    height: Math.max(0, stage.height - 2 * margin),
  };
}

/** Shrinks the window to the stage if need be, and keeps its title bar reachable. */
export function clampRect(rect: Rect, stage: Size): Rect {
  const width = Math.min(rect.width, stage.width);
  const height = Math.min(rect.height, stage.height);
  const x = clamp(rect.x, Math.min(0, REACH - width), Math.max(0, stage.width - REACH));
  const y = clamp(rect.y, 0, Math.max(0, stage.height - BAR_HEIGHT));
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

/**
 * The window after dragging `edge` by (dx, dy) from `rect`: never below `min`, and never past the
 * stage's right or bottom edge.
 */
export function resizeRect(rect: Rect, edge: ResizeEdge, dx: number, dy: number, stage: Size, min: Size): Rect {
  const maxWidth = Math.max(min.width, Math.min(stage.width, stage.width - rect.x));
  const maxHeight = Math.max(min.height, Math.min(stage.height, stage.height - rect.y));
  const width = edge === 's' ? rect.width : Math.round(clamp(rect.width + dx, min.width, maxWidth));
  const height = edge === 'e' ? rect.height : Math.round(clamp(rect.height + dy, min.height, maxHeight));
  return { ...rect, width, height };
}
