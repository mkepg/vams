/**
 * ALGORITHM TEST SUITE — ALG-LAB (drawing a window a band of rows a thread)
 * The Lab draws each frame on several threads, a band of rows each, from drawing commands sent as
 * data; the editor's Run view draws each band in a worker of its own. Either way every pixel must be
 * the one drawing the whole window on one thread gives.
 */
import { describe, expect, it } from 'vitest';
import { GALLERY_BUILDERS, GALLERY_VIEW } from '@/entities/project/model/gallery-scenes';
import { drawDisplay, setUpTextures, type GlScene } from '@/features/code-generation/model/gl-draw';
import { balanceRows, GL, GLContext, splitRows, type GLContextOptions } from '@/shared/lib/gl-raster';
import { threadPool } from '../helpers/thread-pool';

const W = 61;
const H = 47;

/**
 * Frame `n` of a program that uses every kind of drawing: whole and scissored clears, one-colour and
 * shaded polygons, a perspective-free fan, blending, wide and stippled lines, points, a line loop
 * in polygon mode, bitmap text that moves the raster position, a mipmapped texture whose image is
 * replaced part way through the frame, and a vertex array.
 */
function frame(gl: GLContext, n: number) {
  if (n === 0) {
    gl.matrixMode(GL.PROJECTION);
    gl.loadIdentity();
    gl.ortho(0, W, 0, H, -1, 1);
    gl.matrixMode(GL.MODELVIEW);
    const [name] = gl.genTextures(1);
    gl.bindTexture(GL.TEXTURE_2D, name);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR);
  }
  if (n % 3 !== 2) {
    gl.clearColor(0.1, 0.05 * (n % 5), 0.3, 1);
    gl.clear(GL.COLOR_BUFFER_BIT);
  }
  gl.loadIdentity();
  gl.translatef(n * 1.3, n * 0.7, 0);
  gl.begin(GL.QUADS);
  gl.color3f(0.9, 0.5, 0.1);
  for (const [x, y] of [[1, 2], [19.5, 2.25], [18.5, 21.75], [1.5, 20]]) gl.vertex2f(x, y);
  gl.end();
  gl.loadIdentity();
  gl.pushMatrix();
  gl.translatef(30, 23, 0);
  gl.rotatef(11 * n, 0, 0, 1);
  gl.begin(GL.TRIANGLE_FAN);
  gl.color3f(1, 1, 1);
  gl.vertex2f(0, 0);
  for (let k = 0; k <= 10; k++) {
    gl.color3f(k / 10, 0.3, 1 - k / 10);
    gl.vertex2f(Math.cos((k / 10) * 2 * Math.PI) * 17, Math.sin((k / 10) * 2 * Math.PI) * 13);
  }
  gl.end();
  gl.popMatrix();
  gl.enable(GL.BLEND);
  gl.blendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA);
  gl.begin(GL.TRIANGLES);
  gl.color4f(0.2, 0.8, 0.9, 0.5);
  gl.vertex2f(20, 4 + n);
  gl.vertex2f(58, 9);
  gl.vertex2f(36, 45);
  gl.end();
  gl.disable(GL.BLEND);
  gl.lineWidth(1 + (n % 3));
  gl.enable(GL.LINE_STIPPLE);
  gl.lineStipple(1 + (n % 2), 0xf0f0 >> n % 4);
  gl.begin(GL.LINE_STRIP);
  gl.color3f(1, 1, 0.2);
  gl.vertex2f(0.5, 46 - n);
  gl.vertex2f(30, 3);
  gl.vertex2f(60, 40 - n);
  gl.end();
  gl.disable(GL.LINE_STIPPLE);
  gl.lineWidth(1);
  gl.polygonMode(GL.FRONT_AND_BACK, GL.LINE);
  gl.begin(GL.POLYGON);
  gl.color3f(0, 1, 0);
  for (const [x, y] of [[40, 30], [55, 33], [50, 44], [41, 41]]) gl.vertex2f(x, y);
  gl.end();
  gl.polygonMode(GL.FRONT_AND_BACK, GL.FILL);
  gl.pointSize(1 + (n % 4));
  gl.begin(GL.POINTS);
  gl.color3f(0, 1, 1);
  for (let k = 0; k < 9; k++) gl.vertex2f(3 + k * 6.6, 23.5 + (k % 3) * 0.4);
  gl.end();
  gl.enable(GL.SCISSOR_TEST);
  gl.scissor(n, 26, 7, 9);
  gl.clear(GL.COLOR_BUFFER_BIT);
  gl.disable(GL.SCISSOR_TEST);
  gl.color3f(1, 0.6, 0);
  gl.rasterPos2f(2, 15.5);
  for (let i = 0; i <= n % 3; i++) gl.bitmap(8, 3, 0, 0, 9, 0, new Uint8Array([0xff, 0x81, 0x5a]));
  gl.enable(GL.TEXTURE_2D);
  const image = (size: number, k: number) => {
    const out = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) out.set([(40 * k + i * 37) % 256, 255 - ((30 * k + i * 11) % 256), 90, 255], i * 4);
    return out;
  };
  for (let level = 0, size = 4; size >= 1; level++, size >>= 1) gl.texImage2D(GL.TEXTURE_2D, level, GL.RGBA, size, size, 0, GL.RGBA, GL.UNSIGNED_BYTE, image(size, n % 6));
  gl.begin(GL.QUADS);
  gl.color3f(1, 1, 1);
  for (const [s, t, x, y] of [[0, 0, 44, 1], [3, 0, 60, 1], [3, 3, 60, 14], [0, 3, 44, 14]]) {
    gl.texCoord2f(s, t);
    gl.vertex2f(x, y);
  }
  gl.end();
  // The next frame's image replaces this one; what was drawn with it must keep it.
  gl.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, 4, 4, 0, GL.RGBA, GL.UNSIGNED_BYTE, image(4, n % 6 + 1));
  gl.disable(GL.TEXTURE_2D);
  gl.enableClientState(GL.VERTEX_ARRAY);
  gl.vertexPointer(2, GL.FLOAT, 0, new Uint8Array(new Float32Array([5, 30, 15, 33, 9, 44]).buffer));
  gl.color3f(0.6, 0.2, 0.9);
  gl.drawArrays(GL.TRIANGLES, 0, 3);
  gl.disableClientState(GL.VERTEX_ARRAY);
}

const bytes = (gl: GLContext) => Array.from(gl.fb.color);

/** The rows of a band context into `out`, as the Run view worker puts its band workers' rows together. */
function stitch(out: Uint8Array, gl: GLContext, band: { y0: number; y1: number }) {
  const row = gl.width * 4;
  out.set(gl.fb.color.subarray(band.y0 * row, band.y1 * row), band.y0 * row);
}

describe('ALG-LAB-42: A window drawn a band of rows a thread has the pixels drawing it whole gives', () => {
  it('splits the rows into bands that cover every row once, bottom up', () => {
    expect(splitRows(10, 3)).toEqual([{ y0: 0, y1: 3 }, { y0: 3, y1: 6 }, { y0: 6, y1: 10 }]);
    expect(splitRows(2, 4)).toEqual([{ y0: 0, y1: 1 }, { y0: 1, y1: 2 }]);
    expect(splitRows(5, 0)).toEqual([{ y0: 0, y1: 5 }]);
  });

  it('moves the rows towards bands that cost the same, half way a frame, and starts even when the last split doesn\'t fit', () => {
    const even = splitRows(100, 4);
    // The top band took three times as long as each of the others: the cuts that cost the same are
    // at rows 37.5, 75 and 87.5, and each cut moves half way there from 25, 50 and 75.
    const next = balanceRows(100, even, [1, 1, 1, 3], 4);
    expect(next.map((b) => b.y1 - b.y0)).toEqual([31, 32, 18, 19]);
    // Repeated, with every row of a band costing the same, the bands settle where they cost the same.
    let bands = even;
    const rowCost = (y: number) => (y >= 75 ? 3 : 1);
    for (let k = 0; k < 12; k++) {
      const times = bands.map((b) => Array.from({ length: b.y1 - b.y0 }, (_, i) => rowCost(b.y0 + i)).reduce((a, c) => a + c, 0));
      bands = balanceRows(100, bands, times, 4);
    }
    const costs = bands.map((b) => Array.from({ length: b.y1 - b.y0 }, (_, i) => rowCost(b.y0 + i)).reduce((a, c) => a + c, 0));
    expect(Math.max(...costs) - Math.min(...costs)).toBeLessThanOrEqual(4);
    // Every split covers each row once, a row a band at least.
    for (const split of [next, bands, balanceRows(5, splitRows(5, 4), [0, 0, 0, 9], 4)]) {
      expect(split[0].y0).toBe(0);
      split.forEach((b, i) => {
        expect(b.y1).toBeGreaterThan(b.y0);
        if (i) expect(b.y0).toBe(split[i - 1].y1);
      });
    }
    expect(balanceRows(100, even, [1, 1, 1], 4)).toEqual(even);
    expect(balanceRows(100, splitRows(80, 4), [1, 1, 1, 1], 4)).toEqual(even);
    expect(balanceRows(100, even, [0, 0, 0, 0], 4)).toEqual(even);
    expect(balanceRows(100, even, [1, NaN, 1, 1], 4)).toEqual(even);
    expect(balanceRows(100, even, [1, 1, 1, 1], 3)).toEqual(splitRows(100, 3));
  });

  it('as one context whose band moves from frame to frame, each frame clearing the window first, as the editor\'s Run view draws', () => {
    const whole = new GLContext(W, H, { multisample: true });
    const part = new GLContext(W, H, { multisample: true });
    for (let n = 0; n < 6; n++) {
      if (n % 3 === 2) continue;
      frame(whole, n);
      const band = { y0: 3 + n * 5, y1: 20 + n * 4 };
      part.drawRows(band);
      frame(part, n);
      const row = W * 4;
      expect(Array.from(part.fb.color.subarray(band.y0 * row, band.y1 * row)), `frame ${n}`).toEqual(Array.from(whole.fb.color.subarray(band.y0 * row, band.y1 * row)));
    }
    part.drawRows(null);
    frame(whole, 6);
    frame(part, 6);
    expect(bytes(part)).toEqual(bytes(whole));
  });

  it('through the pool, each band from its own copy of the commands, with frames held and read, multisampled or not', () => {
    for (const multisample of [false, true]) {
      for (const bands of [1, 2, 3, 4, 7]) {
        const whole = new GLContext(W, H, { multisample });
        const pool = threadPool(bands);
        const split = new GLContext(W, H, { multisample, pool });
        for (let n = 0; n < 9; n++) {
          // Held frames, which the next whole clear drops, are queued for the pool with the rest when
          // shown. Frames 2, 5 and 8 don't clear, and follow a frame shown, so their batches start
          // without a clear: a band drawn twice, or outside its rows, would show.
          const held = n % 4 === 3;
          frame(whole, n);
          split.hold(held);
          frame(split, n);
          split.hold(false);
          if (!held) expect(bytes(split), `${bands} bands, frame ${n}, multisample ${multisample}`).toEqual(bytes(whole));
        }
        expect(pool.draws).toBeGreaterThan(0);
      }
    }
    // Something of every kind was drawn: many colours, the averaged edges between them among them.
    const gl = new GLContext(W, H, { multisample: true });
    frame(gl, 0);
    expect(new Set(bytes(gl).map((_, i, a) => (i % 4 === 0 ? a.slice(i, i + 3).join() : ''))).size).toBeGreaterThan(100);
  });

  it('as band contexts, each drawing the whole program and keeping its own rows, as the editor\'s band workers do', () => {
    for (const multisample of [false, true]) {
      for (const bands of [2, 3, 5]) {
        const whole = new GLContext(W, H, { multisample });
        const rows = splitRows(H, bands);
        const parts = rows.map((band) => new GLContext(W, H, { multisample, band } satisfies GLContextOptions));
        for (let n = 0; n < 6; n++) {
          frame(whole, n);
          parts.forEach((gl) => frame(gl, n));
          const out = new Uint8Array(W * H * 4);
          parts.forEach((gl, i) => stitch(out, gl, rows[i]));
          expect(Array.from(out), `${bands} bands, frame ${n}, multisample ${multisample}`).toEqual(bytes(whole));
        }
      }
    }
  });

  it.each(Object.entries(GALLERY_BUILDERS))('the gallery\'s %s, as the editor\'s Run view draws it, in bands and through the pool', (_slug, g) => {
    const scene: GlScene = { objects: g.build(), callbacks: g.callbacks(), canvasBackgroundColor: g.background, canvasSize: { width: 800, height: 450 }, viewportLimits: { ...GALLERY_VIEW } };
    const [w, h] = [200, 113];
    const draw = (options: GLContextOptions) => {
      const gl = new GLContext(w, h, { multisample: true, ...options });
      drawDisplay(gl, scene, { state: {}, view: null }, setUpTextures(gl, scene.objects, new Map()));
      return gl;
    };
    const whole = bytes(draw({}));
    expect(bytes(draw({ pool: threadPool(4) }))).toEqual(whole);
    const rows = splitRows(h, 3);
    const out = new Uint8Array(w * h * 4);
    rows.forEach((band) => stitch(out, draw({ band }), band));
    expect(Array.from(out)).toEqual(whole);
  });
});
