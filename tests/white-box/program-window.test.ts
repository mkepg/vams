/**
 * WHITE-BOX TEST SUITE — WB-WINDOW
 * The program window's geometry: centring, keeping the title bar reachable, and resizing.
 */
import { describe, it, expect } from 'vitest';
import {
  BAR_HEIGHT, MIN_WINDOW_SIZE, REACH, STAGE_MARGIN, centredRect, clampRect, resizeRect,
} from '@/widgets/canvas/model/program-window';
import { useProgramWindow } from '@/widgets/canvas/model/program-window-store';

const stage = { width: 1000, height: 600 };

describe('WB-WINDOW-01: centredRect leaves the margin on every side', () => {
  it('insets the stage by the margin', () => {
    expect(centredRect(stage, 24)).toEqual({ x: 24, y: 24, width: 952, height: 552 });
  });
  it('never goes negative on a stage smaller than the margins', () => {
    expect(centredRect({ width: 30, height: 10 }, 24)).toEqual({ x: 24, y: 24, width: 0, height: 0 });
  });
  it('uses a 24 px margin and keeps 80 px of the bar reachable', () => {
    expect(STAGE_MARGIN).toBe(24);
    expect(REACH).toBe(80);
  });
});

describe('WB-WINDOW-02: clampRect keeps the title bar reachable', () => {
  const rect = { x: 100, y: 80, width: 400, height: 300 };
  it('leaves a window that is already reachable alone', () => {
    expect(clampRect(rect, stage)).toEqual(rect);
  });
  it('keeps 80 px of the bar inside on the left', () => {
    expect(clampRect({ ...rect, x: -900 }, stage).x).toBe(80 - 400);
  });
  it('keeps 80 px of the bar inside on the right', () => {
    expect(clampRect({ ...rect, x: 5000 }, stage).x).toBe(1000 - 80);
  });
  it('keeps the top no higher than the stage', () => {
    expect(clampRect({ ...rect, y: -50 }, stage).y).toBe(0);
  });
  it('keeps the bar no lower than the stage bottom', () => {
    expect(clampRect({ ...rect, y: 9000 }, stage).y).toBe(600 - BAR_HEIGHT);
  });
  it('shrinks a window that is bigger than the stage', () => {
    expect(clampRect({ x: 0, y: 0, width: 1400, height: 900 }, stage)).toEqual({ x: 0, y: 0, width: 1000, height: 600 });
  });
});

describe('WB-WINDOW-03: resizeRect drags an edge, within the minimum and the stage', () => {
  const rect = { x: 100, y: 50, width: 400, height: 300 };
  const min = MIN_WINDOW_SIZE;
  it('moves the right edge only', () => {
    expect(resizeRect(rect, 'e', 60, 40, stage, min)).toEqual({ ...rect, width: 460 });
  });
  it('moves the bottom edge only', () => {
    expect(resizeRect(rect, 's', 60, 40, stage, min)).toEqual({ ...rect, height: 340 });
  });
  it('moves both from the corner', () => {
    expect(resizeRect(rect, 'se', -50, 25, stage, min)).toEqual({ ...rect, width: 350, height: 325 });
  });
  it('stops at the minimum size', () => {
    expect(resizeRect(rect, 'se', -900, -900, stage, min)).toEqual({ ...rect, ...min });
  });
  it('stops at the stage edges', () => {
    expect(resizeRect(rect, 'se', 5000, 5000, stage, min)).toEqual({ ...rect, width: 900, height: 550 });
  });
  it('holds the stage width when the window sits partly off the left', () => {
    expect(resizeRect({ ...rect, x: -200 }, 'e', 5000, 0, stage, min).width).toBe(1000);
  });
  it('sets the minimum to 240 by 180 for the canvas body', () => {
    expect(min.width).toBe(240 + 2);
    expect(min.height).toBe(180 + BAR_HEIGHT + 2);
  });
});

describe('WB-WINDOW-04: The store marks a window as placed only when its rect changes', () => {
  const place = () => {
    useProgramWindow.getState().reset();
    useProgramWindow.getState().setStage(stage);
  };
  it('leaves placedByUser false for a zero-distance move', () => {
    place();
    const { rect } = useProgramWindow.getState();
    useProgramWindow.getState().moveTo(rect!.x, rect!.y);
    expect(useProgramWindow.getState().placedByUser).toBe(false);
  });
  it('leaves placedByUser false for a resize to the same rect', () => {
    place();
    useProgramWindow.getState().resizeTo({ ...useProgramWindow.getState().rect! });
    expect(useProgramWindow.getState().placedByUser).toBe(false);
  });
  it('sets placedByUser once the rect moves', () => {
    place();
    const { rect } = useProgramWindow.getState();
    useProgramWindow.getState().moveTo(rect!.x + 10, rect!.y);
    expect(useProgramWindow.getState().placedByUser).toBe(true);
    useProgramWindow.getState().reset();
  });
});
