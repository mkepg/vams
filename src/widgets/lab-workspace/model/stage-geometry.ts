/**
 * Where the program's window sits on the stage. The stage stands for the lab PC's screen: a window
 * opens at the size and place the program asks for, and is shown smaller, keeping its shape, only
 * when the stage cannot hold it. All values are CSS pixels in stage coordinates, apart from the
 * program's own size, which is in its pixels.
 */
import type { ResizeEdge } from '@/shared/ui/floating-window';

export interface Size {
  width: number;
  height: number;
}
export interface Rect extends Size {
  x: number;
  y: number;
}

/** The title bar's height, and the window frame's border on each side (canvas-window.scss). */
export const BAR_HEIGHT = 28;
export const FRAME_BORDER = 1;
/** What the frame adds to the program's pixels. */
export const CHROME: Size = { width: 2 * FRAME_BORDER, height: BAR_HEIGHT + 2 * FRAME_BORDER };
/** How much of the title bar must stay on the stage, so the window can always be grabbed. */
export const REACH = 80;
/** The gap a window shown smaller leaves around itself. */
export const STAGE_GAP = 16;
/** The smallest window the grip makes, in the program's pixels. */
export const MIN_PROGRAM: Size = { width: 80, height: 40 };

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** The window centred on the stage, leaving `margin` on every side. (Copied from the editor's program window.) */
export function centredRect(stage: Size, margin: number): Rect {
  return {
    x: margin,
    y: margin,
    width: Math.max(0, stage.width - 2 * margin),
    height: Math.max(0, stage.height - 2 * margin),
  };
}

/** Shrinks the window to the stage if need be, and keeps its title bar reachable. (Copied from the editor's program window.) */
export function clampRect(rect: Rect, stage: Size): Rect {
  const width = Math.min(rect.width, stage.width);
  const height = Math.min(rect.height, stage.height);
  const x = clamp(rect.x, Math.min(0, REACH - width), Math.max(0, stage.width - REACH));
  const y = clamp(rect.y, 0, Math.max(0, stage.height - BAR_HEIGHT));
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

/**
 * The scale the program's pixels are shown at: 1 when the window fits on the stage, and otherwise
 * the largest that fits it, with a gap around it, keeping the window's shape. Never above 1.
 */
export function windowScale(stage: Size, program: Size): number {
  if (program.width <= 0 || program.height <= 0) return 1;
  const fit = (gap: number) =>
    Math.min((stage.width - 2 * gap - CHROME.width) / program.width, (stage.height - 2 * gap - CHROME.height) / program.height);
  if (fit(0) >= 1) return 1;
  return clamp(fit(STAGE_GAP), 0.01, 1);
}

/**
 * The window on the stage: the program's pixels at `scale` plus the frame, at `place` once the
 * student has moved it, else where the program put it (centred when it named no place, or when
 * it is shown smaller), kept on the stage.
 */
export function windowRect(stage: Size, program: Size & { x: number; y: number }, scale: number, place: { x: number; y: number } | null): Rect {
  const width = Math.round(program.width * scale) + CHROME.width;
  const height = Math.round(program.height * scale) + CHROME.height;
  const centred = { x: Math.round((stage.width - width) / 2), y: Math.round((stage.height - height) / 2) };
  const at = place ?? (scale === 1 && program.x >= 0 && program.y >= 0 ? { x: program.x, y: program.y } : centred);
  return clampRect({ ...at, width, height }, stage);
}

/** The full-screen window: the whole stage, with the bar kept so ✕ stays in reach. */
export function fullscreenRect(stage: Size): Rect {
  return centredRect(stage, 0);
}

/**
 * The program's new size after dragging `edge` of the window at `from` by (dx, dy): shown at
 * scale 1 from then on, never below MIN_PROGRAM, and never past the stage's right or bottom edge.
 */
export function resizedProgram(from: Rect, edge: ResizeEdge, dx: number, dy: number, stage: Size): Size {
  const maxWidth = Math.max(MIN_PROGRAM.width, stage.width - Math.max(0, from.x) - CHROME.width);
  const maxHeight = Math.max(MIN_PROGRAM.height, stage.height - Math.max(0, from.y) - CHROME.height);
  const bodyW = from.width - CHROME.width;
  const bodyH = from.height - CHROME.height;
  return {
    width: Math.round(edge === 's' ? bodyW : clamp(bodyW + dx, MIN_PROGRAM.width, maxWidth)),
    height: Math.round(edge === 'e' ? bodyH : clamp(bodyH + dy, MIN_PROGRAM.height, maxHeight)),
  };
}
