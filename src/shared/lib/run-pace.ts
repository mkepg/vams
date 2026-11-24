/**
 * The pace of Run's animation: 60 steps a second, whatever the screen's refresh rate. The exported
 * program's _vams_idle keeps the same pace by glutGet(GLUT_ELAPSED_TIME), because on the lab PCs'
 * Intel GPU glutSwapBuffers doesn't wait for the screen and idle runs as often as the PC can. So a
 * scene moves at the same speed in the editor, in the Lab and on a lab PC.
 */

/** Steps a second: the same in Run and in the exported _vams_idle. */
export const STEPS_PER_SECOND = 60;

/**
 * The most steps one call catches up, as in _vams_idle: half a second, so a scene the Lab draws
 * slowly in software (a frame of 400 ms) still keeps its pace. Further behind (the first call, or
 * one after a longer stall) it takes a single step rather than jump.
 */
export const MAX_CATCH_UP = 30;

const STEP_MS = 1000 / STEPS_PER_SECOND;

/**
 * A pacer for Run's display refreshes: given each refresh's time in ms, it says how many steps are
 * due. Its count starts half a step before the first refresh, so a 60 Hz display's jitter never
 * lands on a step boundary.
 */
export function stepPacer(): (time: number) => number {
  let origin: number | null = null;
  let done = -1;
  return (time) => {
    origin ??= time - STEP_MS / 2;
    const step = Math.floor((time - origin) / STEP_MS);
    if (done < 0 || step - done > MAX_CATCH_UP) done = step - 1;
    const due = Math.max(0, step - done);
    done = Math.max(done, step);
    return due;
  };
}
