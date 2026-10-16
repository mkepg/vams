import type { CallbacksState, ViewportLimits } from '@/core/types/scene';
import { isCallbackValid } from './callbacks-model';

/** What the Keep proportions reshape handler starts from: the viewing volume's centre and half sizes. */
export function keepProportionsStart(limits: ViewportLimits): { cx: number; cy: number; halfW: number; halfH: number } {
  return {
    cx: (limits.minX + limits.maxX) / 2,
    cy: (limits.minY + limits.maxY) / 2,
    halfW: (limits.maxX - limits.minX) / 2,
    halfH: (limits.maxY - limits.minY) / 2,
  };
}

/** The program prints the starting values with four decimals, so it widens those. */
const printed = (v: number) => Number(v.toFixed(4));

/**
 * The viewing volume the Keep proportions reshape handler sets for a window of this size: the axis
 * that is too short for the window's shape grows about the centre.
 */
export function keepProportionsView(limits: ViewportLimits, width: number, height: number): ViewportLimits {
  const start = keepProportionsStart(limits);
  const aspect = width / (height > 0 ? height : 1);
  const cx = printed(start.cx);
  const cy = printed(start.cy);
  let halfW = printed(start.halfW);
  let halfH = printed(start.halfH);
  if (aspect >= halfW / halfH) halfW = halfH * aspect;
  else halfH = halfW / aspect;
  return { minX: cx - halfW, maxX: cx + halfW, minY: cy - halfH, maxY: cy + halfH };
}

/** Whether the program's reshape handler widens the viewing volume to the window's shape. */
export function keepsProportions(callbacks: CallbacksState): boolean {
  return isCallbackValid(callbacks, 'reshape') && callbacks.reshape.resize === 'keep';
}
