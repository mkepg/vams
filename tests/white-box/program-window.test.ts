/**
 * WHITE-BOX TEST SUITE — WB-WINDOW
 * The program window's geometry: centring, keeping the title bar reachable, and resizing.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  BAR_HEIGHT, FRAME_BORDER, MIN_BODY, MIN_FITTED_HEIGHT, MIN_FITTED_WIDTH, MIN_WINDOW_SIZE, REACH, STAGE_MARGIN, centredRect,
  clampRect, fittedRect,
  resizeRect, volumeAspect, type Rect,
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

describe("WB-WINDOW-05: fittedRect gives the body the volume's shape, centred", () => {
  const body = (r: Rect) => ({ width: r.width - 2 * FRAME_BORDER, height: r.height - BAR_HEIGHT - 2 * FRAME_BORDER });
  it('fits a square body to the stage height on a wide stage', () => {
    expect(fittedRect(stage, 24, 1)).toEqual({ x: 238, y: 24, width: 524, height: 552 });
  });
  it('fits a wide volume to the stage width on a tall stage', () => {
    const r = fittedRect({ width: 600, height: 1000 }, 24, 2);
    expect(body(r)).toEqual({ width: 550, height: 275 });
    expect(r.x).toBe(24);
    expect(r.y).toBe(Math.round((1000 - r.height) / 2));
  });
  it("keeps a 4:3 volume's ratio within a pixel", () => {
    const b = body(fittedRect(stage, 24, 4 / 3));
    expect(Math.abs(b.width / b.height - 4 / 3)).toBeLessThan(0.01);
  });
  it('lets an extreme volume fall below MIN_BODY rather than leave the stage', () => {
    const r = fittedRect(stage, 24, 20);
    expect(r.width).toBeLessThanOrEqual(1000 - 48);
    expect(body(r).height).toBeLessThan(MIN_BODY.height);
  });
  it('never goes negative on a stage smaller than the margins', () => {
    const r = fittedRect({ width: 30, height: 10 }, 24, 1);
    expect(r.width).toBeGreaterThanOrEqual(0);
    expect(r.height).toBeGreaterThanOrEqual(0);
  });
  it('fills a stage of the right shape edge to edge with no margin', () => {
    expect(fittedRect({ width: 502, height: 530 }, 0, 1)).toEqual({ x: 0, y: 0, width: 502, height: 530 });
  });
});

describe('WB-WINDOW-06: volumeAspect reads the viewing volume', () => {
  it('is width over height', () => {
    expect(volumeAspect({ minX: -1, maxX: 1, minY: -1, maxY: 1 })).toBe(1);
    expect(volumeAspect({ minX: 0, maxX: 4, minY: 0, maxY: 3 })).toBeCloseTo(4 / 3);
  });
  it('falls back to 1 for an empty volume', () => {
    expect(volumeAspect({ minX: 0, maxX: 0, minY: 0, maxY: 1 })).toBe(1);
  });
});

describe('WB-WINDOW-07: The store refits to the volume until the student places the window', () => {
  const s = () => useProgramWindow.getState();
  beforeEach(() => {
    s().reset();
    s().setStage(stage);
  });
  it('opens volume-shaped and refits when the volume changes', () => {
    expect(s().rect).toEqual(fittedRect(stage, STAGE_MARGIN, 1));
    s().setAspect(2);
    expect(s().rect).toEqual(fittedRect(stage, STAGE_MARGIN, 2));
  });
  it("keeps the student's rect when the volume changes after a move", () => {
    s().moveTo(s().rect!.x + 10, s().rect!.y);
    const placed = s().rect;
    s().setAspect(2);
    expect(s().rect).toEqual(placed);
  });
  it('restoring from maximised clears the placement and refits', () => {
    s().resizeTo({ x: 10, y: 10, width: 700, height: 300 });
    s().toggleMaximise();
    s().toggleMaximise();
    expect(s().placedByUser).toBe(false);
    expect(s().rect).toEqual(fittedRect(stage, STAGE_MARGIN, 1));
  });
  it('ignores a 0 by 0 stage read and keeps the rect', () => {
    const before = s().rect;
    s().setStage({ width: 0, height: 0 });
    expect(s().rect).toEqual(before);
  });
});

describe('WB-WINDOW-08: The fitted window is never narrower than its bar, nor shorter than its minimum, while the stage allows', () => {
  it('sets the minimums from the bar and the frame', () => {
    expect(MIN_FITTED_WIDTH).toBe(150);
    expect(MIN_FITTED_HEIGHT).toBe(BAR_HEIGHT + 2 * FRAME_BORDER + 60);
  });
  it('keeps a tall volume at least 150 px wide', () => {
    const r = fittedRect(stage, 24, volumeAspect({ minX: -1, maxX: 1, minY: -4, maxY: 4 }));
    expect(r.width).toBeGreaterThanOrEqual(MIN_FITTED_WIDTH);
    expect(r.height).toBeLessThanOrEqual(600 - 48);
    expect(r.x).toBe(Math.round((1000 - r.width) / 2));
  });
  it('keeps a very wide volume at least MIN_FITTED_HEIGHT tall', () => {
    const r = fittedRect(stage, 24, 20);
    expect(r.height).toBeGreaterThanOrEqual(MIN_FITTED_HEIGHT);
    expect(r.width).toBeLessThanOrEqual(1000 - 48);
  });
  it('stays within a stage too small for the minimums, and never negative', () => {
    const tiny = { width: 100, height: 80 };
    for (const aspect of [0.25, 1, 20]) {
      const r = fittedRect(tiny, 24, aspect);
      expect(r.width).toBeGreaterThanOrEqual(0);
      expect(r.height).toBeGreaterThanOrEqual(0);
      expect(r.width).toBeLessThanOrEqual(tiny.width);
      expect(r.height).toBeLessThanOrEqual(tiny.height);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
    }
  });
});
