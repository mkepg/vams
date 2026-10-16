/**
 * WHITE-BOX TEST SUITE — WB-GRID
 * The canvas grid's label placement.
 */
import { describe, it, expect } from 'vitest';
import { insetLabel, tickRange } from '@/shared/engine/pixi/grid-labels';

describe('WB-GRID-01: Axis labels stay inside the canvas', () => {
  const screen = { width: 400, height: 300 };
  it('pushes a label at an edge back inside by the padding, and leaves inner labels alone', () => {
    // A centred x-axis label (anchor 0.5, 0) 20 px wide at the left edge.
    expect(insetLabel({ x: 0, y: 150 }, { width: 20, height: 12 }, { x: 0.5, y: 0 }, screen)).toEqual({ x: 14, y: 150 });
    // At the right edge.
    expect(insetLabel({ x: 400, y: 150 }, { width: 20, height: 12 }, { x: 0.5, y: 0 }, screen)).toEqual({ x: 386, y: 150 });
    // A y-axis label (anchor 1, 0.5) at the top edge.
    expect(insetLabel({ x: 200, y: 0 }, { width: 24, height: 12 }, { x: 1, y: 0.5 }, screen)).toEqual({ x: 200, y: 10 });
    // Bottom edge, top-anchored.
    expect(insetLabel({ x: 200, y: 300 }, { width: 24, height: 12 }, { x: 0.5, y: 0 }, screen)).toEqual({ x: 200, y: 284 });
    expect(insetLabel({ x: 200, y: 150 }, { width: 24, height: 12 }, { x: 0.5, y: 0 }, screen)).toEqual({ x: 200, y: 150 });
  });
});

describe('WB-GRID-02: Grid ticks reach the edges of the view', () => {
  it('keeps the edge ticks when the visible range is a hair inside them', () => {
    // world.toLocal can return -0.9999999999 for the left edge of a -1..1 view.
    expect(tickRange(-0.9999999999, 0.9999999999, 0.5)).toEqual([-1, -0.5, 0, 0.5, 1]);
    expect(tickRange(-1, 1, 0.5)).toEqual([-1, -0.5, 0, 0.5, 1]);
    expect(tickRange(-0.7, 0.7, 0.5)).toEqual([-0.5, 0, 0.5]);
    expect(tickRange(0.1, 2.05, 1)).toEqual([1, 2]);
  });
});
