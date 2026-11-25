/**
 * BLACK-BOX TEST SUITE — BB-LAB (the Lab's drawing threads)
 * The program's worker draws each frame with helper workers, a band of rows each, through shared
 * memory. These checks stand helpers in that answer on the test's thread, through the same
 * RasterHelper the real ones run, with each message structured-cloned as postMessage clones it.
 */
import { describe, expect, it } from 'vitest';
import { RasterHelper } from '@/features/lab-run/worker/raster-helper';
import { helperCount, startRasterPool, SYNC, type HelperMessage, type HelperWorker } from '@/features/lab-run/worker/raster-pool';
import { GL, GLContext } from '@/shared/lib/gl-raster';

/** A helper that handles each message at once, or not at all until `start`; `broken` makes it fail every job. */
class FakeHelper implements HelperWorker {
  readonly helper = new RasterHelper();
  inbox: HelperMessage[] = [];
  started = false;
  terminated = false;
  jobs = 0;
  bands: { y0: number; y1: number }[] = [];
  silent = false;
  broken = false;
  postMessage(message: HelperMessage) {
    const copy = structuredClone(message);
    if (this.broken && copy.type === 'draw') copy.commands = [{ kind: 'clear', value: null, scissor: null } as never];
    this.inbox.push(copy);
    if (this.started) this.flush();
  }
  start() {
    this.started = true;
    this.flush();
  }
  private flush() {
    for (const message of this.inbox.splice(0)) {
      if (message.type === 'draw') {
        if (this.silent) continue;
        this.jobs++;
        this.bands.push(message.band);
      }
      this.helper.handle(message);
    }
  }
  terminate() {
    this.terminated = true;
  }
}

function scene(gl: GLContext) {
  gl.matrixMode(GL.PROJECTION);
  gl.loadIdentity();
  gl.ortho(0, 40, 0, 30, -1, 1);
  gl.matrixMode(GL.MODELVIEW);
  gl.clearColor(0.2, 0.3, 0.4, 1);
  gl.clear(GL.COLOR_BUFFER_BIT);
  gl.begin(GL.TRIANGLES);
  gl.color3f(1, 0, 0);
  gl.vertex2f(1, 1);
  gl.color3f(0, 1, 0);
  gl.vertex2f(39, 4);
  gl.color3f(0, 0, 1);
  gl.vertex2f(18, 29);
  gl.end();
  gl.enable(GL.BLEND);
  gl.blendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA);
  gl.begin(GL.QUADS);
  gl.color4f(1, 1, 1, 0.5);
  for (const [x, y] of [[5, 5], [35, 6], [33, 25], [6, 24]]) gl.vertex2f(x, y);
  gl.end();
  gl.disable(GL.BLEND);
}

function reference(): number[] {
  const gl = new GLContext(40, 30, { multisample: true });
  scene(gl);
  return Array.from(gl.fb.color);
}

function pooled(helpers: FakeHelper[], now?: () => number) {
  let i = 0;
  const pool = startRasterPool(() => helpers[i++], helpers.length)!;
  if (now) (pool as unknown as { now: () => number }).now = now;
  return { pool, gl: new GLContext(40, 30, { multisample: true, pool }) };
}

describe('BB-LAB-119: The Lab draws each frame a band a thread, and carries on when a helper is missing or fails', () => {
  it('starts one helper a spare core, leaving the page\'s thread and the program\'s, up to three', () => {
    expect(helperCount(undefined)).toBe(0);
    expect(helperCount(2)).toBe(0);
    expect(helperCount(3)).toBe(1);
    expect(helperCount(4)).toBe(2);
    expect(helperCount(16)).toBe(3);
    expect(startRasterPool(() => new FakeHelper(), 0)).toBeNull();
  });

  it('draws with every started helper, each a band, and the frame is the one a single thread draws', () => {
    const helpers = [new FakeHelper(), new FakeHelper(), new FakeHelper()];
    helpers.forEach((h) => h.start());
    const { gl } = pooled(helpers);
    scene(gl);
    expect(Array.from(gl.fb.color)).toEqual(reference());
    expect(helpers.map((h) => h.jobs)).toEqual([1, 1, 1]);
    // Each helper draws a band of its own, above the program's thread's, which starts at row 0.
    expect(helpers.map((h) => h.bands[0])).toEqual([
      { y0: 7, y1: 15 },
      { y0: 15, y1: 22 },
      { y0: 22, y1: 30 },
    ]);
  });

  it('draws on the program\'s thread alone until a helper has started, then uses it', () => {
    const helpers = [new FakeHelper(), new FakeHelper()];
    const { gl } = pooled(helpers);
    scene(gl);
    expect(Array.from(gl.fb.color)).toEqual(reference());
    expect(helpers.map((h) => h.jobs)).toEqual([0, 0]);
    helpers[1].start();
    scene(gl);
    expect(Array.from(gl.fb.color)).toEqual(reference());
    expect(helpers.map((h) => h.jobs)).toEqual([0, 1]);
  });

  it('gives up a helper whose drawing fails, or that never answers, and draws without it from then on', () => {
    const [ok, failing, silent] = [new FakeHelper(), new FakeHelper(), new FakeHelper()];
    for (const h of [ok, failing, silent]) h.start();
    failing.broken = true;
    silent.silent = true;
    let clock = 0;
    // Each look at the clock finds it past the silent helper's deadline, so the test doesn't wait.
    const { gl } = pooled([ok, failing, silent], () => (clock += 20_000));
    scene(gl);
    void gl.fb;
    expect([failing.terminated, silent.terminated, ok.terminated]).toEqual([true, true, false]);
    expect(Atomics.load(new Int32Array((failing.helper as unknown as { sync: Int32Array }).sync.buffer), SYNC.failed(1))).toBe(1);
    // The next frame is drawn by the helper left and the program's thread, every pixel right.
    scene(gl);
    expect(Array.from(gl.fb.color)).toEqual(reference());
    expect(ok.jobs).toBe(2);
    expect(failing.jobs).toBe(1);
  });

  it('puts texture images in shared memory, which the helpers read without a copy each frame', () => {
    const helpers = [new FakeHelper()];
    helpers[0].start();
    const { pool } = pooled(helpers);
    const bytes = Uint8Array.of(1, 2, 3, 4);
    const shared = pool.share(bytes);
    expect(shared.buffer).toBeInstanceOf(SharedArrayBuffer);
    expect(Array.from(shared)).toEqual([1, 2, 3, 4]);
    expect(pool.share(shared)).toBe(shared);
  });
});
