import type { Framebuffer } from './framebuffer';

/** The scissor rectangle of glScissor, in window pixels from the bottom left. */
export interface Scissor {
  enabled: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A half-open pixel rectangle: x0 ≤ x < x1, y0 ≤ y < y1. */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The pixels a fragment may land on: the window, cut down to the scissor when it is on. */
export function fragmentBox(fb: Framebuffer, scissor: Scissor | null): Box {
  const box = { x0: 0, y0: 0, x1: fb.width, y1: fb.height };
  if (!scissor?.enabled) return box;
  return {
    x0: Math.max(box.x0, scissor.x),
    y0: Math.max(box.y0, scissor.y),
    x1: Math.min(box.x1, scissor.x + scissor.width),
    y1: Math.min(box.y1, scissor.y + scissor.height),
  };
}

export function inBox(box: Box, x: number, y: number): boolean {
  return x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1;
}
