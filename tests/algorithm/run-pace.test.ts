/**
 * ALGORITHM TEST SUITE — ALG-RUN (Run's pace)
 * Run steps a scene 60 times a second, as the exported _vams_idle does by glutGet(GLUT_ELAPSED_TIME),
 * whatever the display's refresh rate. It catches up at most MAX_CATCH_UP steps at once, and a
 * longer stall gives a single step rather than a jump.
 */
import { describe, expect, it } from 'vitest';
import { MAX_CATCH_UP, STEPS_PER_SECOND, stepPacer } from '@/shared/lib/run-pace';

/** The steps the pacer gives at each of `times` (ms). */
function steps(times: number[]): number[] {
  const due = stepPacer();
  return times.map((t) => due(t));
}

const total = (counts: number[]) => counts.reduce((a, b) => a + b, 0);

/** `count` refreshes at `hz`, from 1000 ms, each moved by up to `jitter` ms either way. */
function refreshes(hz: number, count: number, jitter = 0): number[] {
  return Array.from({ length: count }, (_, i) => 1000 + (i * 1000) / hz + (i % 2 ? jitter : -jitter));
}

describe('ALG-RUN-03: Run steps 60 times a second, whatever the refresh rate', () => {
  it('takes one step at every refresh of a 60 Hz display, even with 4 ms of jitter', () => {
    expect(STEPS_PER_SECOND).toBe(60);
    expect(steps(refreshes(60, 600)).every((n) => n === 1)).toBe(true);
    expect(steps(refreshes(60, 600, 4)).every((n) => n === 1)).toBe(true);
  });

  it('takes 60 steps a second on a 144 Hz display, at most one a refresh', () => {
    const counts = steps(refreshes(144, 1440));
    expect(Math.abs(total(counts) - 600)).toBeLessThanOrEqual(1);
    expect(Math.max(...counts)).toBe(1);
  });

  it('takes two steps a refresh on a 30 Hz display, so it keeps 60 a second', () => {
    const counts = steps(refreshes(30, 300));
    expect(Math.abs(total(counts) - 600)).toBeLessThanOrEqual(1);
    expect(counts.slice(1).every((n) => n === 2)).toBe(true);
  });

  it('catches up a slow frame, but takes a single step after a stall longer than a tenth of a second', () => {
    expect(MAX_CATCH_UP).toBe(6);
    const due = stepPacer();
    expect(due(0)).toBe(1);
    expect(due(70)).toBe(4);
    expect(due(70.1)).toBe(0);
    expect(due(2070)).toBe(1);
    expect(due(2086.7)).toBe(1);
  });
});
