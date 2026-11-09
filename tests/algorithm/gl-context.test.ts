/**
 * ALG-LAB: the Lab's OpenGL 1.5 state machine (GLContext) and GLUT's bitmap fonts, against the
 * OpenGL 1.5 specification (2.6, 2.8, 2.9, 2.11, 2.12, 3.7, 3.8, 4.2.3, 5.4), freeglut's fg_font.c
 * and fg_font_data.c, and the editor's own 9×15 text. Matrices are checked against the independent
 * reference in tests/helpers/matrix.ts; every expected pixel is worked out by hand from the rule
 * named beside it.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GL, GLContext, MAX_DRAW_ELEMENTS, MAX_LIST_NESTING, MAX_STACK_DEPTH, type Framebuffer } from '@/shared/lib/gl-raster';
import { polygonPieces } from '@/shared/lib/gl-raster/assembly';
import {
  GLUT_FONTS,
  glutBitmapCharacter,
  glutBitmapHeight,
  glutBitmapLength,
  glutBitmapString,
  glutBitmapWidth,
  type GlutFontName,
} from '@/shared/lib/glut-fonts';
import { GLYPHS } from '@/shared/lib/glut-fonts/font-9x15';
import { lineOrigin, rasterizeLine } from '@/shared/lib/text-raster';
import { decodePng } from '../helpers/image-compare';
import { makeMatrix, matrixDistance, multiply, ndcToWindow, orthoToNdc, transformPoint, type Mat } from '../helpers/matrix';

/** A context whose projection maps object units to window pixels: gluOrtho2D(0, w, 0, h). */
function pixelContext(w: number, h: number, multisample = false): GLContext {
  const gl = new GLContext(w, h, { multisample });
  gl.matrixMode(GL.PROJECTION);
  gl.loadIdentity();
  gl.ortho2D(0, w, 0, h);
  gl.matrixMode(GL.MODELVIEW);
  gl.loadIdentity();
  return gl;
}

function px(fb: Framebuffer, x: number, y: number): number[] {
  const i = (y * fb.width + x) * 4;
  return Array.from(fb.color.slice(i, i + 4));
}

/** Every pixel with any colour in it, as "x,y", in row order from the bottom. */
function covered(fb: Framebuffer): string[] {
  const out: string[] = [];
  for (let y = 0; y < fb.height; y++) {
    for (let x = 0; x < fb.width; x++) if (px(fb, x, y).some((c) => c)) out.push(`${x},${y}`);
  }
  return out;
}

/** The pixels x0..x1 by y0..y1, both ends included, in row order from the bottom. */
function block(x0: number, x1: number, y0: number, y1: number): string[] {
  const out: string[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push(`${x},${y}`);
  return out;
}

/** The 2D affine part [a, b, tx, c, d, ty] of a column-major 4 × 4 matrix, as tests/helpers/matrix.ts holds it. */
function affine(m: Float64Array): Mat {
  return [m[0], m[4], m[12], m[1], m[5], m[13]];
}

describe('ALG-LAB-09: Matrix stacks and the transform commands (2.11.2)', () => {
  it('glTranslatef, glRotatef and glScalef multiply on the right, as the reference T · R · S', () => {
    const gl = new GLContext(10, 10);
    gl.translatef(3, 4, 0);
    gl.rotatef(30, 0, 0, 1);
    gl.scalef(2, 5, 1);
    const expected = makeMatrix({ translateX: 3, translateY: 4, rotate: 30, scaleX: 2, scaleY: 5 });
    expect(matrixDistance(affine(gl.currentMatrix(GL.MODELVIEW)), expected)).toBeLessThan(1e-12);
  });

  it('two transform groups compose as the reference multiply', () => {
    const gl = new GLContext(10, 10);
    gl.translated(10, -2, 0);
    gl.rotated(90, 0, 0, 1);
    gl.translatef(1, 1, 0);
    gl.rotatef(-45, 0, 0, 2);
    gl.scaled(0.5, 3, 1);
    const first = makeMatrix({ translateX: 10, translateY: -2, rotate: 90, scaleX: 1, scaleY: 1 });
    const second = makeMatrix({ translateX: 1, translateY: 1, rotate: -45, scaleX: 0.5, scaleY: 3 });
    expect(matrixDistance(affine(gl.currentMatrix(GL.MODELVIEW)), multiply(first, second))).toBeLessThan(1e-12);
  });

  it('glOrtho and gluOrtho2D map the viewing volume to NDC as the reference does', () => {
    const v = { minX: -3, maxX: 7, minY: 2, maxY: 12 };
    const a = new GLContext(10, 10);
    a.matrixMode(GL.PROJECTION);
    a.ortho(v.minX, v.maxX, v.minY, v.maxY, -1, 1);
    const b = new GLContext(10, 10);
    b.matrixMode(GL.PROJECTION);
    b.ortho2D(v.minX, v.maxX, v.minY, v.maxY);
    // gluOrtho2D is glOrtho with near −1 and far 1.
    expect(Array.from(b.currentMatrix(GL.PROJECTION))).toEqual(Array.from(a.currentMatrix(GL.PROJECTION)));
    const m = affine(a.currentMatrix(GL.PROJECTION));
    for (const p of [
      { x: -3, y: 2 },
      { x: 7, y: 12 },
      { x: 0.25, y: 9.5 },
    ]) {
      const got = transformPoint(m, p);
      const want = orthoToNdc(p, v);
      expect(got.x).toBeCloseTo(want.x, 12);
      expect(got.y).toBeCloseTo(want.y, 12);
    }
    // z = −2/(f − n) = −1 and no z offset for near −1, far 1.
    expect(a.currentMatrix(GL.PROJECTION)[10]).toBe(-1);
    expect(a.currentMatrix(GL.PROJECTION)[14] + 0).toBe(0);
  });

  it('a point lands on the pixel the reference pipeline gives', () => {
    const gl = new GLContext(40, 30);
    gl.matrixMode(GL.PROJECTION);
    gl.ortho2D(-2, 2, -1.5, 1.5);
    gl.matrixMode(GL.MODELVIEW);
    gl.translatef(0.3, -0.2, 0);
    gl.rotatef(20, 0, 0, 1);
    gl.begin(GL.POINTS);
    gl.vertex2f(0.71, 0.33);
    gl.end();
    const model = makeMatrix({ translateX: 0.3, translateY: -0.2, rotate: 20, scaleX: 1, scaleY: 1 });
    const ndc = orthoToNdc(transformPoint(model, { x: 0.71, y: 0.33 }), { minX: -2, maxX: 2, minY: -1.5, maxY: 1.5 });
    const win = ndcToWindow(ndc, { width: 40, height: 30 });
    expect(covered(gl.fb)).toEqual([`${win.x},${win.y}`]);
  });

  it('the model-view and projection stacks are separate', () => {
    const gl = new GLContext(10, 10);
    gl.translatef(5, 0, 0);
    gl.pushMatrix();
    gl.scalef(2, 2, 1);
    gl.matrixMode(GL.PROJECTION);
    gl.pushMatrix();
    gl.ortho2D(0, 4, 0, 4);
    gl.popMatrix();
    expect(affine(gl.currentMatrix(GL.PROJECTION))).toEqual([1, 0, 0, 0, 1, 0]);
    gl.matrixMode(GL.MODELVIEW);
    expect(affine(gl.currentMatrix(GL.MODELVIEW))).toEqual([2, 0, 5, 0, 2, 0]);
    gl.popMatrix();
    expect(affine(gl.currentMatrix(GL.MODELVIEW))).toEqual([1, 0, 5, 0, 1, 0]);
    expect(gl.getError()).toBe(GL.NO_ERROR);
  });

  it.each([GL.MODELVIEW, GL.PROJECTION])('stack %d holds 32 matrices, then overflows and underflows', (mode) => {
    expect(MAX_STACK_DEPTH).toBe(32);
    const gl = new GLContext(10, 10);
    gl.matrixMode(mode);
    for (let i = 1; i < 32; i++) {
      gl.pushMatrix();
      gl.translatef(1, 0, 0);
    }
    expect(gl.getError()).toBe(GL.NO_ERROR);
    expect(affine(gl.currentMatrix(mode))[2]).toBe(31);
    // The 33rd entry doesn't fit: GL_STACK_OVERFLOW, and the stack is unchanged.
    gl.pushMatrix();
    expect(gl.getError()).toBe(GL.STACK_OVERFLOW);
    for (let i = 1; i < 32; i++) gl.popMatrix();
    expect(gl.getError()).toBe(GL.NO_ERROR);
    expect(affine(gl.currentMatrix(mode))[2]).toBe(0);
    gl.popMatrix();
    expect(gl.getError()).toBe(GL.STACK_UNDERFLOW);
  });
});

describe('ALG-LAB-10: Begin/End objects break into the specification’s polygons (2.6.1, Table 2.12)', () => {
  // Vertex A, vertex B, then the new vertex; FLAT takes vertex i + 2 of a strip or fan's triangle i,
  // 3i + 3 of separate triangles, 2i + 4 of a quad strip's quad i and 4i + 4 of a quad (1-based).
  it('splits each mode as 2.6.1 says, with the provoking vertex of Table 2.12', () => {
    const flat = (mode: number, n: number) =>
      polygonPieces(mode, n).map((p) => ({ vertices: p.vertices, provoking: p.vertices[p.provoking], split: p.split }));
    expect(flat(GL.TRIANGLES, 7)).toEqual([
      { vertices: [0, 1, 2], provoking: 2, split: undefined },
      { vertices: [3, 4, 5], provoking: 5, split: undefined },
    ]);
    expect(flat(GL.TRIANGLE_STRIP, 5)).toEqual([
      { vertices: [0, 1, 2], provoking: 2, split: undefined },
      { vertices: [2, 1, 3], provoking: 3, split: undefined },
      { vertices: [2, 3, 4], provoking: 4, split: undefined },
    ]);
    expect(flat(GL.TRIANGLE_FAN, 5)).toEqual([
      { vertices: [0, 1, 2], provoking: 2, split: undefined },
      { vertices: [0, 2, 3], provoking: 3, split: undefined },
      { vertices: [0, 3, 4], provoking: 4, split: undefined },
    ]);
    // The reference driver splits a quad 0-1-2, 0-2-3 (ALG-LAB-33; it was 0-1-3, 1-2-3 when the
    // references came from another GPU).
    expect(flat(GL.QUADS, 9)).toEqual([
      { vertices: [0, 1, 2, 3], provoking: 3, split: [[0, 1, 2], [0, 2, 3]] },
      { vertices: [4, 5, 6, 7], provoking: 7, split: [[0, 1, 2], [0, 2, 3]] },
    ]);
    // Quad i is v2i, v2i+1, v2i+3, v2i+2.
    expect(flat(GL.QUAD_STRIP, 7)).toEqual([
      { vertices: [0, 1, 3, 2], provoking: 3, split: [[0, 1, 2], [0, 2, 3]] },
      { vertices: [2, 3, 5, 4], provoking: 5, split: [[0, 1, 2], [0, 2, 3]] },
    ]);
    expect(flat(GL.POLYGON, 5)).toEqual([{ vertices: [0, 1, 2, 3, 4], provoking: 0, split: undefined }]);
    expect(flat(GL.POLYGON, 2)).toEqual([]);
  });

  const colors: [number, number, number][] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 0],
    [0, 1, 1],
    [1, 0, 1],
  ];
  const byte = (c: [number, number, number]) => [...c.map((v) => v * 255), 255];

  it('FLAT colours each primitive with its provoking vertex', () => {
    // A quad strip of two quads across x 0..20: quad 0 takes vertex 3, quad 1 vertex 5.
    const strip = pixelContext(20, 10);
    strip.shadeModel(GL.FLAT);
    strip.begin(GL.QUAD_STRIP);
    [
      [0, 0],
      [0, 10],
      [10, 0],
      [10, 10],
      [20, 0],
      [20, 10],
    ].forEach(([x, y], i) => {
      strip.color3f(...colors[i]);
      strip.vertex2f(x, y);
    });
    strip.end();
    expect(px(strip.fb, 3, 5)).toEqual(byte(colors[3]));
    expect(px(strip.fb, 15, 5)).toEqual(byte(colors[5]));

    // A fan around (10, 5): triangle i takes vertex i + 2.
    const fan = pixelContext(20, 10);
    fan.shadeModel(GL.FLAT);
    fan.begin(GL.TRIANGLE_FAN);
    [
      [10, 0],
      [20, 0],
      [20, 10],
      [0, 10],
      [0, 0],
    ].forEach(([x, y], i) => {
      fan.color3f(...colors[i]);
      fan.vertex2f(x, y);
    });
    fan.end();
    expect(px(fan.fb, 18, 3)).toEqual(byte(colors[2]));
    expect(px(fan.fb, 10, 8)).toEqual(byte(colors[3]));
    expect(px(fan.fb, 2, 3)).toEqual(byte(colors[4]));

    // A quad takes its last vertex; a polygon its first.
    for (const [mode, which] of [
      [GL.QUADS, 3],
      [GL.POLYGON, 0],
    ]) {
      const gl = pixelContext(10, 10);
      gl.shadeModel(GL.FLAT);
      gl.begin(mode);
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ].forEach(([x, y], i) => {
        gl.color3f(...colors[i]);
        gl.vertex2f(x, y);
      });
      gl.end();
      expect(new Set(covered(gl.fb).map((p) => px(gl.fb, +p.split(',')[0], +p.split(',')[1]).join()))).toEqual(
        new Set([byte(colors[which]).join()]),
      );
    }
  });

  // A counter-clockwise strip over x 0..20, y 0..10: top, bottom, top, bottom...
  const STRIP = [
    [0, 10],
    [0, 0],
    [10, 10],
    [10, 0],
    [20, 10],
    [20, 0],
  ];

  it('every triangle of a counter-clockwise strip faces front, so the back polygon mode never applies', () => {
    const gl = pixelContext(20, 10);
    gl.polygonMode(GL.BACK, GL.POINT);
    gl.begin(GL.TRIANGLE_STRIP);
    for (const [x, y] of STRIP) {
      gl.vertex2f(x, y);
    }
    gl.end();
    const fill = pixelContext(20, 10);
    fill.begin(GL.TRIANGLE_STRIP);
    for (const [x, y] of STRIP) {
      fill.vertex2f(x, y);
    }
    fill.end();
    // A strip drawn with points at its odd triangles would leave holes.
    expect(covered(gl.fb)).toEqual(covered(fill.fb));
    expect(covered(gl.fb)).toEqual(block(0, 19, 0, 9));
  });

  // Stipple 0x00FF with factor 1: counters 0..7 drawn, 8..15 skipped, then again (3.4.2).
  const stippledRow = (mode: number, begins: number[][][]) => {
    const gl = pixelContext(24, 10);
    gl.enable(GL.LINE_STIPPLE);
    gl.lineStipple(1, 0x00ff);
    for (const vertices of begins) {
      gl.begin(mode);
      for (const [x, y] of vertices) gl.vertex2f(x, y);
      gl.end();
    }
    return covered(gl.fb).map((p) => +p.split(',')[0]);
  };
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

  it('the stipple counter runs on between a strip’s segments', () => {
    // Segment 1 is x 0..3 (counters 0..3), segment 2 x 4..19 (counters 4..19): 0..7 and 16..19 drawn.
    expect(
      stippledRow(GL.LINE_STRIP, [
        [
          [0.5, 5.5],
          [4.5, 5.5],
          [20.5, 5.5],
        ],
      ]),
    ).toEqual([...range(0, 7), ...range(16, 19)]);
  });

  it('GL_LINES restarts the counter for every segment', () => {
    // Segment 2 starts at counter 0 again: x 4..11 drawn, 12..19 skipped.
    expect(
      stippledRow(GL.LINES, [
        [
          [0.5, 5.5],
          [4.5, 5.5],
          [4.5, 5.5],
          [20.5, 5.5],
        ],
      ]),
    ).toEqual(range(0, 11));
  });

  it('glBegin restarts the counter', () => {
    // Two strips: the second starts again at counter 0 at x = 4.
    expect(
      stippledRow(GL.LINE_STRIP, [
        [
          [0.5, 5.5],
          [4.5, 5.5],
        ],
        [
          [4.5, 5.5],
          [20.5, 5.5],
        ],
      ]),
    ).toEqual(range(0, 11));
  });
});

describe('ALG-LAB-11: Geometry is clipped to the view volume before rasterising (2.12)', () => {
  it('draws nothing for a point, line or triangle wholly outside the volume', () => {
    const gl = pixelContext(20, 20);
    gl.begin(GL.POINTS);
    gl.vertex2f(-0.5, 10);
    gl.vertex2f(10, 20.5);
    gl.end();
    gl.begin(GL.LINES);
    gl.vertex2f(-10, -5);
    gl.vertex2f(30, -1);
    gl.end();
    gl.begin(GL.TRIANGLES);
    gl.vertex2f(21, 0);
    gl.vertex2f(40, 0);
    gl.vertex2f(30, 20);
    gl.end();
    // z = 2 lies past the far plane of gluOrtho2D's −1..1.
    gl.begin(GL.TRIANGLES);
    gl.vertex3f(0, 0, 2);
    gl.vertex3f(20, 0, 2);
    gl.vertex3f(0, 20, 2);
    gl.end();
    expect(covered(gl.fb)).toEqual([]);
  });

  it('discards a wide point whose centre is outside, though its square would reach the window', () => {
    const gl = pixelContext(20, 20);
    gl.pointSize(9);
    gl.begin(GL.POINTS);
    gl.vertex2f(-0.5, 10.5);
    gl.end();
    expect(covered(gl.fb)).toEqual([]);
    gl.begin(GL.POINTS);
    gl.vertex2f(0.5, 10.5);
    gl.end();
    // Inside: a 9 × 9 square on (0.5, 10.5), cut by the window's left edge (3.3.1).
    expect(covered(gl.fb)).toEqual(block(0, 4, 6, 14));
  });

  it('a line from far outside draws only its part in the window, up to its last pixel', () => {
    const gl = pixelContext(20, 20);
    gl.begin(GL.LINES);
    gl.vertex2f(-100.5, 5.5);
    gl.vertex2f(10.5, 5.5);
    gl.end();
    // Clipped at x = 0; the diamond-exit rule leaves out pixel 10, which holds the end (3.4.1).
    expect(covered(gl.fb)).toEqual(block(0, 9, 5, 5));
  });

  it('a triangle crossing the edges keeps the colour its original vertices interpolate', () => {
    const gl = pixelContext(20, 20);
    const A = { x: -20, y: -10, c: [1, 0, 0] };
    const B = { x: 30, y: -10, c: [0, 1, 0] };
    const C = { x: 5, y: 30, c: [0, 0, 1] };
    gl.begin(GL.TRIANGLES);
    for (const v of [A, B, C]) {
      gl.color3f(v.c[0], v.c[1], v.c[2]);
      gl.vertex2f(v.x, v.y);
    }
    gl.end();
    const area = (B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y);
    let checked = 0;
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        const cx = x + 0.5;
        const cy = y + 0.5;
        // Barycentric weights of B and C at the pixel centre, in the unclipped triangle.
        const wb = ((A.x - C.x) * (cy - C.y) - (A.y - C.y) * (cx - C.x)) / area;
        const wc = ((B.x - A.x) * (cy - A.y) - (B.y - A.y) * (cx - A.x)) / area;
        const wa = 1 - wb - wc;
        const got = px(gl.fb, x, y);
        if (Math.min(wa, wb, wc) < -1e-9) {
          expect(got).toEqual([0, 0, 0, 0]);
          continue;
        }
        if (Math.min(wa, wb, wc) < 1e-9) continue;
        checked++;
        const want = [0, 1, 2].map((k) => Math.round((wa * A.c[k] + wb * B.c[k] + wc * C.c[k]) * 255));
        for (let k = 0; k < 3; k++) expect(Math.abs(got[k] - want[k])).toBeLessThanOrEqual(1);
        expect(got[3]).toBe(255);
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('a triangle far larger than the window covers it all', () => {
    const gl = pixelContext(16, 16);
    gl.begin(GL.TRIANGLES);
    gl.vertex2f(-1e7, -1e7);
    gl.vertex2f(1e7, -1e7);
    gl.vertex2f(0, 1e7);
    gl.end();
    expect(covered(gl.fb)).toEqual(block(0, 15, 0, 15));
  });

  it('huge coordinates stay in the window and the drawing finishes', () => {
    const gl = pixelContext(16, 16);
    gl.begin(GL.TRIANGLES);
    gl.vertex2f(-1e30, -1e30);
    gl.vertex2f(1e30, -1e30);
    gl.vertex2f(0, 1e30);
    gl.end();
    expect(covered(gl.fb).length).toBeLessThanOrEqual(256);
    const far = pixelContext(16, 16);
    far.begin(GL.LINES);
    far.vertex2f(-1e30, 8.5);
    far.vertex2f(1e30, 8.5);
    far.end();
    expect(covered(far.fb).length).toBeLessThanOrEqual(16);
    const line = pixelContext(16, 16);
    line.enable(GL.LINE_STIPPLE);
    line.lineStipple(1, 0x5555);
    line.begin(GL.LINES);
    line.vertex2f(-1e7, 8.5);
    line.vertex2f(1e7, 8.5);
    line.end();
    // Clipped to x 0..16. The counter moves on by the 10⁷ pixels cut off, a whole number of
    // repeats, so pixel 0 takes counter 0 and pixel 15 counter 15 (ALG-LAB-29, ALG-LAB-30). 0x5555
    // draws the even counters: pixels 0, 2 … 14.
    expect(covered(line.fb)).toEqual([0, 2, 4, 6, 8, 10, 12, 14].map((x) => `${x},8`));
  });
});

describe('ALG-LAB-12: glDrawElements from buffer objects draws what glBegin/glEnd draws (2.8, 2.9)', () => {
  // A quad as two triangles sharing vertices 0 and 2, each vertex its own colour.
  const POSITIONS = [2, 1, 14, 3, 13, 12, 1, 10];
  const COLORS = [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 128];
  const INDICES = [0, 1, 2, 0, 2, 3];

  function immediate(): GLContext {
    const gl = pixelContext(16, 16);
    gl.enable(GL.BLEND);
    gl.blendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA);
    gl.begin(GL.TRIANGLES);
    for (const i of INDICES) {
      gl.color4ub(COLORS[i * 4], COLORS[i * 4 + 1], COLORS[i * 4 + 2], COLORS[i * 4 + 3]);
      gl.vertex2f(POSITIONS[i * 2], POSITIONS[i * 2 + 1]);
    }
    gl.end();
    return gl;
  }

  const bytes = (a: ArrayLike<number> & { buffer: ArrayBufferLike }) => new Uint8Array(a.buffer);

  it('indices in a bound GL_ELEMENT_ARRAY_BUFFER, vertices and colours in GL_ARRAY_BUFFERs', () => {
    const gl = pixelContext(16, 16);
    gl.enable(GL.BLEND);
    gl.blendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA);
    const [vbo, cbo, ibo] = gl.genBuffers(3);
    expect([vbo, cbo, ibo]).toEqual([1, 2, 3]);
    gl.bindBuffer(GL.ARRAY_BUFFER, vbo);
    gl.bufferData(GL.ARRAY_BUFFER, bytes(new Float32Array(POSITIONS)), 0x88e4);
    gl.vertexPointer(2, GL.FLOAT, 0, 0);
    gl.bindBuffer(GL.ARRAY_BUFFER, cbo);
    // The colours go in with glBufferSubData, after a store of the right size.
    gl.bufferData(GL.ARRAY_BUFFER, new Uint8Array(COLORS.length), 0x88e4);
    gl.bufferSubData(GL.ARRAY_BUFFER, 0, new Uint8Array(COLORS));
    gl.colorPointer(4, GL.UNSIGNED_BYTE, 0, 0);
    gl.bindBuffer(GL.ARRAY_BUFFER, 0);
    gl.enableClientState(GL.VERTEX_ARRAY);
    gl.enableClientState(GL.COLOR_ARRAY);
    gl.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(GL.ELEMENT_ARRAY_BUFFER, bytes(new Uint16Array(INDICES)), 0x88e4);
    gl.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_SHORT, 0);
    expect(gl.getError()).toBe(GL.NO_ERROR);
    expect(covered(gl.fb).length).toBeGreaterThan(100);
    expect(Array.from(gl.fb.color)).toEqual(Array.from(immediate().fb.color));
  });

  it('client arrays: an interleaved view and client indices draw the same', () => {
    const gl = pixelContext(16, 16);
    gl.enable(GL.BLEND);
    gl.blendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA);
    // x, y as floats, then r, g, b, a as bytes: 12 bytes a vertex.
    const data = new DataView(new ArrayBuffer(4 * 12));
    for (let i = 0; i < 4; i++) {
      data.setFloat32(i * 12, POSITIONS[i * 2], true);
      data.setFloat32(i * 12 + 4, POSITIONS[i * 2 + 1], true);
      for (let k = 0; k < 4; k++) data.setUint8(i * 12 + 8 + k, COLORS[i * 4 + k]);
    }
    const all = new Uint8Array(data.buffer);
    gl.vertexPointer(2, GL.FLOAT, 12, all);
    gl.colorPointer(4, GL.UNSIGNED_BYTE, 12, all.subarray(8));
    gl.enableClientState(GL.VERTEX_ARRAY);
    gl.enableClientState(GL.COLOR_ARRAY);
    gl.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_BYTE, new Uint8Array(INDICES));
    expect(Array.from(gl.fb.color)).toEqual(Array.from(immediate().fb.color));
  });

  it('numeric pointers address program memory when no buffer is bound', () => {
    const heap = new Uint8Array(256);
    heap.set(bytes(new Float32Array(POSITIONS)), 16);
    heap.set(COLORS, 64);
    heap.set(bytes(new Uint32Array(INDICES)), 128);
    const gl = new GLContext(16, 16, { memory: () => heap });
    gl.matrixMode(GL.PROJECTION);
    gl.ortho2D(0, 16, 0, 16);
    gl.matrixMode(GL.MODELVIEW);
    gl.enable(GL.BLEND);
    gl.blendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA);
    gl.vertexPointer(2, GL.FLOAT, 0, 16);
    gl.colorPointer(4, GL.UNSIGNED_BYTE, 0, 64);
    gl.enableClientState(GL.VERTEX_ARRAY);
    gl.enableClientState(GL.COLOR_ARRAY);
    gl.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_INT, 128);
    expect(Array.from(gl.fb.color)).toEqual(Array.from(immediate().fb.color));
  });

  it('glDrawArrays draws the elements in order', () => {
    const gl = pixelContext(16, 16);
    gl.enable(GL.BLEND);
    gl.blendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA);
    const unrolled = INDICES.flatMap((i) => [POSITIONS[i * 2], POSITIONS[i * 2 + 1]]);
    const colours = INDICES.flatMap((i) => COLORS.slice(i * 4, i * 4 + 4));
    gl.vertexPointer(2, GL.FLOAT, 0, bytes(new Float32Array(unrolled)));
    gl.colorPointer(4, GL.UNSIGNED_BYTE, 0, new Uint8Array(colours));
    gl.enableClientState(GL.VERTEX_ARRAY);
    gl.enableClientState(GL.COLOR_ARRAY);
    gl.drawArrays(GL.TRIANGLES, 0, 6);
    expect(Array.from(gl.fb.color)).toEqual(Array.from(immediate().fb.color));
  });

  it('a mapped buffer can’t be drawn from: GL_INVALID_OPERATION, nothing drawn', () => {
    const gl = pixelContext(16, 16);
    const [vbo] = gl.genBuffers(1);
    gl.bindBuffer(GL.ARRAY_BUFFER, vbo);
    gl.bufferData(GL.ARRAY_BUFFER, bytes(new Float32Array(POSITIONS)), 0x88e4);
    gl.vertexPointer(2, GL.FLOAT, 0, 0);
    gl.enableClientState(GL.VERTEX_ARRAY);
    expect(gl.mapBuffer(GL.ARRAY_BUFFER, GL.READ_WRITE)).toHaveLength(32);
    gl.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_BYTE, new Uint8Array(INDICES));
    expect(gl.getError()).toBe(GL.INVALID_OPERATION);
    expect(covered(gl.fb)).toEqual([]);
    expect(gl.unmapBuffer(GL.ARRAY_BUFFER)).toBe(true);
    gl.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_BYTE, new Uint8Array(INDICES));
    expect(covered(gl.fb).length).toBeGreaterThan(100);
  });
});

describe('ALG-LAB-13: Display lists record, replay and nest to depth 64 (5.4)', () => {
  function square(gl: GLContext, x: number, color: [number, number, number]): void {
    gl.color3f(...color);
    gl.begin(GL.QUADS);
    gl.vertex2f(x, 2);
    gl.vertex2f(x + 4, 2);
    gl.vertex2f(x + 4, 6);
    gl.vertex2f(x, 6);
    gl.end();
  }

  it('GL_COMPILE records without drawing; glCallList draws what drawing it at once draws', () => {
    const gl = pixelContext(16, 8);
    const list = gl.genLists(1);
    expect(list).toBe(1);
    gl.newList(list, GL.COMPILE);
    gl.translatef(2, 0, 0);
    square(gl, 0, [1, 0, 0]);
    gl.endList();
    expect(covered(gl.fb)).toEqual([]);
    // The compiled glTranslatef didn't run either.
    expect(affine(gl.currentMatrix(GL.MODELVIEW))).toEqual([1, 0, 0, 0, 1, 0]);
    gl.callList(list);
    gl.callList(list);
    const direct = pixelContext(16, 8);
    direct.translatef(2, 0, 0);
    square(direct, 0, [1, 0, 0]);
    direct.translatef(2, 0, 0);
    square(direct, 0, [1, 0, 0]);
    expect(Array.from(gl.fb.color)).toEqual(Array.from(direct.fb.color));
    // Squares at x 2..5 and 4..7.
    expect(covered(gl.fb)).toEqual(block(2, 7, 2, 5));
  });

  it('GL_COMPILE_AND_EXECUTE draws as it records', () => {
    const gl = pixelContext(16, 8);
    gl.newList(5, GL.COMPILE_AND_EXECUTE);
    square(gl, 0, [0, 1, 0]);
    gl.endList();
    expect(covered(gl.fb)).toEqual(block(0, 3, 2, 5));
    gl.translatef(8, 0, 0);
    gl.callList(5);
    expect(covered(gl.fb)).toEqual([...block(0, 3, 2, 5), ...block(8, 11, 2, 5)].sort(byRow));
  });

  const byRow = (p: string, q: string) => {
    const [px0, py0] = p.split(',').map(Number);
    const [qx0, qy0] = q.split(',').map(Number);
    return py0 - qy0 || px0 - qx0;
  };

  it('a list reads its arrays when compiled, not when called', () => {
    const gl = pixelContext(16, 8);
    const positions = new Float32Array([0, 2, 4, 2, 4, 6, 0, 6]);
    gl.vertexPointer(2, GL.FLOAT, 0, new Uint8Array(positions.buffer));
    gl.enableClientState(GL.VERTEX_ARRAY);
    gl.newList(1, GL.COMPILE);
    gl.drawArrays(GL.QUADS, 0, 4);
    gl.endList();
    positions.set([10, 2, 14, 2, 14, 6, 10, 6]);
    gl.callList(1);
    expect(covered(gl.fb)).toEqual(block(0, 3, 2, 5));
  });

  it('takes its new contents only at glEndList', () => {
    const gl = pixelContext(16, 8);
    gl.newList(1, GL.COMPILE);
    square(gl, 0, [1, 1, 1]);
    gl.endList();
    gl.newList(1, GL.COMPILE_AND_EXECUTE);
    // Still the old contents while the new ones are compiled.
    gl.callList(1);
    gl.endList();
    expect(covered(gl.fb)).toEqual(block(0, 3, 2, 5));
    gl.clear(GL.COLOR_BUFFER_BIT);
    gl.callList(1);
    // The new list holds only the glCallList of the old one, which is now itself: past the nesting limit, empty.
    expect(covered(gl.fb)).toEqual([]);
  });

  /** Lists 1..n, each calling the next; the last draws a square. */
  function chain(n: number): GLContext {
    const gl = pixelContext(16, 8);
    expect(gl.genLists(n)).toBe(1);
    for (let i = 1; i < n; i++) {
      gl.newList(i, GL.COMPILE);
      gl.callList(i + 1);
      gl.endList();
    }
    gl.newList(n, GL.COMPILE);
    square(gl, 0, [1, 1, 1]);
    gl.endList();
    gl.callList(1);
    return gl;
  }

  it('nests to depth 64, and a call deeper than that does nothing', () => {
    expect(MAX_LIST_NESTING).toBe(64);
    expect(covered(chain(64).fb)).toEqual(block(0, 3, 2, 5));
    expect(covered(chain(65).fb)).toEqual([]);
  });

  it('glCallList is allowed between glBegin and glEnd', () => {
    const gl = pixelContext(16, 8);
    gl.newList(1, GL.COMPILE);
    gl.vertex2f(4, 2);
    gl.vertex2f(4, 6);
    gl.endList();
    gl.begin(GL.QUADS);
    gl.vertex2f(0, 2);
    gl.callList(1);
    gl.vertex2f(0, 6);
    gl.end();
    expect(gl.getError()).toBe(GL.NO_ERROR);
    // 0,2 → 4,2 → 4,6 → 0,6 once the list's two vertices are in.
    expect(covered(gl.fb)).toEqual(block(0, 3, 2, 5));
  });
});

describe('ALG-LAB-14: GL_NEAREST and GL_LINEAR sampling of a 2 × 2 texture under GL_MODULATE (3.8.7 to 3.8.9, 3.8.13)', () => {
  // Texel (i, j): (0, 0) red, (1, 0) green, (0, 1) blue, (1, 1) white; row 0 is t = 0.
  const TEXELS = [
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
    [255, 255, 255, 255],
  ];
  // The fragment colour the texture modulates.
  const FRAGMENT = [1, 0.5, 1, 1];

  /** A 4 × 4 window filled by one quad with s, t from 0 to 1: 2 texels over 4 pixels, ρ = ½, magnified. */
  function texturedQuad(min: number, mag: number, wrap: number, setFilters = true): GLContext {
    const gl = pixelContext(4, 4);
    const [name] = gl.genTextures(1);
    gl.bindTexture(GL.TEXTURE_2D, name);
    gl.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, 2, 2, 0, GL.RGBA, GL.UNSIGNED_BYTE, new Uint8Array(TEXELS.flat()));
    if (setFilters) {
      gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, min);
      gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, mag);
    }
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, wrap);
    gl.texEnvi(GL.TEXTURE_ENV, GL.TEXTURE_ENV_MODE, GL.MODULATE);
    gl.enable(GL.TEXTURE_2D);
    gl.color4f(FRAGMENT[0], FRAGMENT[1], FRAGMENT[2], FRAGMENT[3]);
    gl.begin(GL.QUADS);
    for (const [s, t] of [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]) {
      gl.texCoord2f(s, t);
      gl.vertex2f(s * 4, t * 4);
    }
    gl.end();
    expect(gl.getError()).toBe(GL.NO_ERROR);
    return gl;
  }

  /** Each pixel from per-axis texel weights w[texel index][pixel] (the rest goes to the border, 0, 0, 0, 0), times FRAGMENT. */
  function expected(ws: number[][], wt: number[][]): number[][][] {
    return [0, 1, 2, 3].map((y) =>
      [0, 1, 2, 3].map((x) =>
        [0, 1, 2, 3].map((k) => {
          let v = 0;
          for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) v += ws[i][x] * wt[j][y] * (TEXELS[j * 2 + i][k] / 255);
          return Math.round(v * FRAGMENT[k] * 255);
        }),
      ),
    );
  }

  const image = (gl: GLContext) => [0, 1, 2, 3].map((y) => [0, 1, 2, 3].map((x) => px(gl.fb, x, y)));

  it('GL_NEAREST: each 2 × 2 block of pixels takes one texel (eq. 3.19, 3.20)', () => {
    // u = 2s at the pixel centre s = (x + ½) / 4: pixels 0 and 1 take texel 0, 2 and 3 texel 1.
    const w = [
      [1, 1, 0, 0],
      [0, 0, 1, 1],
    ];
    expect(image(texturedQuad(GL.NEAREST, GL.NEAREST, GL.REPEAT))).toEqual(expected(w, w));
    // Green × ½ = 127.5, which rounds to 128.
    expect(px(texturedQuad(GL.NEAREST, GL.NEAREST, GL.REPEAT).fb, 3, 0)).toEqual([0, 128, 0, 255]);
  });

  it('GL_LINEAR with GL_REPEAT: weights ¾ and ¼, wrapping at the edges (eq. 3.22)', () => {
    // u − ½ = x/2 − ¼: x 0 → i0 = −1 wraps to 1, α ¾; x 1 → i0 0, α ¼; x 2 → i0 0, α ¾; x 3 → i0 1, α ¼, i1 wraps to 0.
    const w = [
      [0.75, 0.75, 0.25, 0.25],
      [0.25, 0.25, 0.75, 0.75],
    ];
    expect(image(texturedQuad(GL.LINEAR, GL.LINEAR, GL.REPEAT))).toEqual(expected(w, w));
  });

  it('GL_LINEAR with GL_CLAMP: the edge pixels take a quarter of the border colour, (0, 0, 0, 0)', () => {
    // As REPEAT, but i = −1 and i = 2 are border texels, not wrapped.
    const w = [
      [0.75, 0.75, 0.25, 0],
      [0, 0.25, 0.75, 0.75],
    ];
    const gl = texturedQuad(GL.LINEAR, GL.LINEAR, GL.CLAMP);
    expect(image(gl)).toEqual(expected(w, w));
    // The corner keeps ¾ × ¾ of its alpha: 0.5625 × 255 = 143.4.
    expect(px(gl.fb, 0, 0)[3]).toBe(143);
  });

  it('a magnified texture uses the magnification filter, whatever the minification filter is', () => {
    const w = [
      [1, 1, 0, 0],
      [0, 0, 1, 1],
    ];
    expect(image(texturedQuad(GL.LINEAR, GL.NEAREST, GL.REPEAT))).toEqual(expected(w, w));
  });

  it('the initial GL_NEAREST_MIPMAP_LINEAR with one level is incomplete: the quad is untextured (3.8.10)', () => {
    const gl = texturedQuad(0, 0, GL.REPEAT, false);
    expect(new Set(image(gl).flat().map((p) => p.join()))).toEqual(new Set(['255,128,255,255']));
  });
});

describe('ALG-LAB-15: glutBitmapCharacter and the GLUT fonts, as freeglut and the editor draw them (3.7)', () => {
  const W = 120;
  const H = 40;

  /** The pixels the editor's text-raster draws for `line` at raster position (x, y), y from the bottom. */
  function editorPixels(line: string, x: number, y: number): string[] {
    const { width, height, bits } = rasterizeLine(line);
    const origin = lineOrigin(x, H - y, W, H)!;
    const out: [number, number][] = [];
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        if (!bits[row * width + col]) continue;
        const gx = origin.left + col;
        const gy = H - 1 - (origin.top + row);
        if (gx >= 0 && gx < W && gy >= 0 && gy < H) out.push([gx, gy]);
      }
    }
    return out.sort((p, q) => p[1] - q[1] || p[0] - q[0]).map(([a, b]) => `${a},${b}`);
  }

  it('GLUT_BITMAP_9_BY_15 draws the editor’s pixels, by character and by string', () => {
    const text = 'Hello, GL {x} ~';
    const byChar = pixelContext(W, H);
    byChar.rasterPos2f(10.4, 20.6);
    for (const ch of text) glutBitmapCharacter(byChar, GLUT_FONTS.GLUT_BITMAP_9_BY_15, ch.charCodeAt(0));
    expect(covered(byChar.fb)).toEqual(editorPixels(text, 10.4, 20.6));
    expect(covered(byChar.fb).length).toBeGreaterThan(100);
    const byString = pixelContext(W, H);
    byString.rasterPos2f(10.4, 20.6);
    glutBitmapString(byString, GLUT_FONTS.GLUT_BITMAP_9_BY_15, text);
    expect(Array.from(byString.fb.color)).toEqual(Array.from(byChar.fb.color));
  });

  it('draws in the colour current at glRasterPos, and skips text whose raster position is outside', () => {
    const gl = pixelContext(W, H);
    gl.color3f(1, 0, 0);
    gl.rasterPos2i(4, 20);
    gl.color3f(0, 1, 0);
    glutBitmapCharacter(gl, GLUT_FONTS.GLUT_BITMAP_9_BY_15, 'A'.charCodeAt(0));
    expect(new Set(covered(gl.fb).map((p) => px(gl.fb, +p.split(',')[0], +p.split(',')[1]).join()))).toEqual(new Set(['255,0,0,255']));
    const outside = pixelContext(W, H);
    outside.rasterPos2f(-0.5, 20);
    glutBitmapString(outside, GLUT_FONTS.GLUT_BITMAP_9_BY_15, 'Hello');
    expect(covered(outside.fb)).toEqual([]);
  });

  it('a newline in glutBitmapString starts the next line one font height down', () => {
    const gl = pixelContext(W, H);
    gl.rasterPos2i(5, 25);
    glutBitmapString(gl, GLUT_FONTS.GLUT_BITMAP_9_BY_15, 'Hi\nHello');
    expect(covered(gl.fb)).toEqual([...editorPixels('Hi', 5, 25), ...editorPixels('Hello', 5, 9)].sort((p, q) => {
      const [a, b] = p.split(',').map(Number);
      const [c, d] = q.split(',').map(Number);
      return b - d || a - c;
    }));
  });

  // Widths of H, e, l, o and the font height and yorig, from fg_font_data.c (each glyph's first byte).
  const FREEGLUT: Record<GlutFontName, { widths: [number, number, number, number]; height: number; yorig: number }> = {
    GLUT_BITMAP_8_BY_13: { widths: [8, 8, 8, 8], height: 14, yorig: 3 },
    GLUT_BITMAP_9_BY_15: { widths: [9, 9, 9, 9], height: 16, yorig: 4 },
    GLUT_BITMAP_HELVETICA_10: { widths: [8, 5, 2, 6], height: 14, yorig: 3 },
    GLUT_BITMAP_HELVETICA_12: { widths: [9, 7, 3, 7], height: 16, yorig: 4 },
    GLUT_BITMAP_HELVETICA_18: { widths: [13, 10, 4, 11], height: 23, yorig: 5 },
    GLUT_BITMAP_TIMES_ROMAN_10: { widths: [8, 4, 4, 5], height: 14, yorig: 4 },
    GLUT_BITMAP_TIMES_ROMAN_24: { widths: [19, 11, 6, 12], height: 29, yorig: 7 },
  };

  it.each(Object.keys(FREEGLUT) as GlutFontName[])('%s has freeglut’s widths for "Hello"', (name) => {
    const font = GLUT_FONTS[name];
    const { widths, height, yorig } = FREEGLUT[name];
    const [H_, e, l, o] = widths;
    expect(['H', 'e', 'l', 'o'].map((c) => glutBitmapWidth(font, c.charCodeAt(0)))).toEqual(widths);
    expect(glutBitmapLength(font, 'Hello')).toBe(H_ + e + 2 * l + o);
    expect(glutBitmapLength(font, 'Hello\nHe')).toBe(H_ + e + 2 * l + o);
    expect(glutBitmapHeight(font)).toBe(height);
    expect(font.yorig).toBe(yorig);
    expect(font.glyphs).toHaveLength(256);
    // Every glyph holds `height` rows of ⌈width / 8⌉ bytes.
    for (const [w, hex] of font.glyphs) expect(hex.length).toBe(Math.ceil(w / 8) * height * 2);
    // glutBitmapCharacter moves the raster position by the width: a character after "Hello" starts there.
    const gl = pixelContext(200, 40);
    gl.rasterPos2i(0, 10);
    glutBitmapString(gl, font, 'Hello');
    const after = pixelContext(200, 40);
    after.rasterPos2i(0, 10);
    glutBitmapString(after, font, 'Hello');
    glutBitmapCharacter(after, font, '|'.charCodeAt(0));
    const before = new Set(covered(gl.fb));
    const extra = covered(after.fb).filter((p) => !before.has(p));
    expect(Math.min(...extra.map((p) => +p.split(',')[0]))).toBeGreaterThanOrEqual(H_ + e + 2 * l + o);
  });

  it('characters outside 1..255 draw nothing and measure 0', () => {
    const gl = pixelContext(W, H);
    gl.rasterPos2i(5, 20);
    glutBitmapCharacter(gl, GLUT_FONTS.GLUT_BITMAP_9_BY_15, 0);
    glutBitmapCharacter(gl, GLUT_FONTS.GLUT_BITMAP_9_BY_15, 256);
    expect(covered(gl.fb)).toEqual([]);
    expect(glutBitmapWidth(GLUT_FONTS.GLUT_BITMAP_9_BY_15, 0)).toBe(0);
  });
});

describe('ALG-LAB-16: glClear fills the scissor box only while GL_SCISSOR_TEST is on (4.2.3, 4.1.2)', () => {
  it('fills the whole window, then only the box', () => {
    const gl = pixelContext(10, 10);
    gl.scissor(2, 3, 4, 5);
    gl.clearColor(1, 0, 0, 1);
    gl.clear(GL.COLOR_BUFFER_BIT);
    expect(covered(gl.fb)).toEqual(block(0, 9, 0, 9));
    gl.enable(GL.SCISSOR_TEST);
    expect(gl.isEnabled(GL.SCISSOR_TEST)).toBe(true);
    gl.clearColor(0, 1, 0, 1);
    gl.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const inBox = x >= 2 && x < 6 && y >= 3 && y < 8;
        expect(px(gl.fb, x, y)).toEqual(inBox ? [0, 255, 0, 255] : [255, 0, 0, 255]);
      }
    }
    gl.disable(GL.SCISSOR_TEST);
    gl.clearColor(0, 0, 1, 1);
    gl.clear(GL.COLOR_BUFFER_BIT);
    expect(new Set(covered(gl.fb).map((p) => px(gl.fb, +p.split(',')[0], +p.split(',')[1]).join()))).toEqual(new Set(['0,0,255,255']));
  });

  it('the scissor box also holds drawing', () => {
    const gl = pixelContext(10, 10);
    gl.scissor(2, 3, 4, 5);
    gl.enable(GL.SCISSOR_TEST);
    gl.rectf(0, 0, 10, 10);
    expect(covered(gl.fb)).toEqual(block(2, 5, 3, 7));
  });

  it('a multisampled clear reaches every sample, so a later half-covered pixel blends with the clear colour', () => {
    const gl = pixelContext(10, 10, true);
    gl.rectf(0, 0, 10, 10);
    gl.clearColor(1, 0, 0, 1);
    gl.clear(GL.COLOR_BUFFER_BIT);
    gl.rectf(0, 0, 4.5, 10);
    // Pixel 4's samples at 4.5 − 2/16 and 4.5 − 6/16 are covered, the two at + 6/16 and + 2/16 are not:
    // half white, half red. Averaged as light in sRGB (ALG-LAB-36), green and blue are 188.
    expect(px(gl.fb, 4, 5)).toEqual([255, 188, 188, 255]);
    expect(px(gl.fb, 3, 5)).toEqual([255, 255, 255, 255]);
    expect(px(gl.fb, 5, 5)).toEqual([255, 0, 0, 255]);
  });
});

describe('ALG-LAB-19: glGetError follows the GL 1.5 rules (2.5, 2.6.3)', () => {
  it('the first error sticks until glGetError reads it, then the flag is clear', () => {
    const gl = new GLContext(8, 8);
    expect(gl.error).toBe(GL.NO_ERROR);
    gl.enable(0x1234);
    expect(gl.error).toBe(GL.INVALID_ENUM);
    gl.pointSize(0);
    gl.popMatrix();
    expect(gl.getError()).toBe(GL.INVALID_ENUM);
    expect(gl.getError()).toBe(GL.NO_ERROR);
    gl.pointSize(-1);
    expect(gl.getError()).toBe(GL.INVALID_VALUE);
  });

  it('a bad enum is GL_INVALID_ENUM and changes nothing', () => {
    const gl = new GLContext(8, 8);
    gl.begin(99);
    expect(gl.getError()).toBe(GL.INVALID_ENUM);
    gl.end();
    expect(gl.getError()).toBe(GL.INVALID_OPERATION);
    // GL 1.1's eleven factors; SRC_ALPHA_SATURATE is a source factor only, and the constant colours aren't in.
    gl.blendFunc(GL.SRC_ALPHA_SATURATE, GL.ONE);
    expect(gl.getError()).toBe(GL.NO_ERROR);
    gl.blendFunc(GL.ONE, GL.SRC_ALPHA_SATURATE);
    expect(gl.getError()).toBe(GL.INVALID_ENUM);
    gl.blendFunc(0x8001, GL.ONE);
    expect(gl.getError()).toBe(GL.INVALID_ENUM);
    gl.matrixMode(0x1702);
    expect(gl.getError()).toBe(GL.INVALID_ENUM);
    gl.texEnvi(GL.TEXTURE_ENV, GL.TEXTURE_ENV_MODE, 0x1234);
    expect(gl.getError()).toBe(GL.INVALID_ENUM);
  });

  it('between glBegin and glEnd only vertices, colours, texture coordinates and glCallList are allowed', () => {
    const gl = pixelContext(8, 8);
    gl.begin(GL.POINTS);
    gl.color3f(1, 1, 1);
    gl.texCoord2f(0, 0);
    gl.vertex2f(2.5, 2.5);
    gl.callList(7);
    expect(gl.getError()).toBe(GL.NO_ERROR);
    gl.translatef(3, 0, 0);
    gl.begin(GL.LINES);
    gl.clear(GL.COLOR_BUFFER_BIT);
    gl.enableClientState(GL.VERTEX_ARRAY);
    expect(gl.genLists(1)).toBe(0);
    // glGetError itself is refused here, and reads nothing.
    expect(gl.getError()).toBe(GL.NO_ERROR);
    gl.vertex2f(5.5, 5.5);
    gl.end();
    expect(gl.getError()).toBe(GL.INVALID_OPERATION);
    // The refused glTranslatef didn't move the second point.
    expect(covered(gl.fb)).toEqual(['2,2', '5,5']);
    expect(affine(gl.currentMatrix(GL.MODELVIEW))).toEqual([1, 0, 0, 0, 1, 0]);
  });

  it('display list misuse: nested glNewList, glEndList without one, list 0', () => {
    const gl = new GLContext(8, 8);
    gl.endList();
    expect(gl.getError()).toBe(GL.INVALID_OPERATION);
    gl.newList(0, GL.COMPILE);
    expect(gl.getError()).toBe(GL.INVALID_VALUE);
    gl.newList(1, GL.COMPILE);
    gl.newList(2, GL.COMPILE);
    expect(gl.getError()).toBe(GL.INVALID_OPERATION);
    gl.endList();
    gl.callList(0);
    expect(gl.getError()).toBe(GL.INVALID_VALUE);
  });

  it('gluErrorString names each error', () => {
    const gl = new GLContext(8, 8);
    expect(
      [GL.NO_ERROR, GL.INVALID_ENUM, GL.INVALID_VALUE, GL.INVALID_OPERATION, GL.STACK_OVERFLOW, GL.STACK_UNDERFLOW, GL.OUT_OF_MEMORY].map((e) =>
        gl.errorString(e),
      ),
    ).toEqual(['no error', 'invalid enumerant', 'invalid value', 'invalid operation', 'stack overflow', 'stack underflow', 'out of memory']);
    expect(gl.errorString(0x1234)).toBeNull();
  });
});

describe('ALG-LAB-20: GLContext has one method per GL and GLU call the Lab allows', () => {
  /** Every gl* and glu* function GL/gl.h and GL/glu.h declare. */
  function allowedCalls(): string[] {
    const names = new Set<string>();
    for (const header of ['gl.h', 'glu.h']) {
      const text = readFileSync(join(process.cwd(), 'lab/include/GL', header), 'utf8');
      for (const m of text.matchAll(/\b(glu?[A-Z]\w*)\s*\(/g)) names.add(m[1]);
    }
    return [...names].sort();
  }

  /** glVertex2f → vertex2f, gluOrtho2D → ortho2D. */
  const methodName = (call: string) => {
    const rest = call.replace(/^glu?/, '');
    return rest[0].toLowerCase() + rest.slice(1);
  };

  it('every allowed call has its method', () => {
    const calls = allowedCalls();
    expect(calls).toContain('gluOrtho2D');
    expect(calls).toContain('glLineStipple');
    expect(calls.length).toBeGreaterThan(90);
    const missing = calls.filter((c) => typeof (GLContext.prototype as unknown as Record<string, unknown>)[methodName(c)] !== 'function');
    expect(missing).toEqual([]);
  });

  it('calls outside the allowed set have none', () => {
    const proto = GLContext.prototype as unknown as Record<string, unknown>;
    for (const name of ['blendColor', 'blendEquation', 'blendFuncSeparate', 'frustum', 'perspective', 'lookAt', 'cullFace', 'frontFace', 'normal3f', 'lightfv', 'materialfv']) {
      expect(proto[name], name).toBeUndefined();
    }
  });
});

describe('ALG-LAB-21: One draw call takes at most MAX_DRAW_ELEMENTS elements', () => {
  /** A context over a 4 MiB program memory with its vertex array at address 0: every element is (1.5, 2.5). */
  function heapContext(): { gl: GLContext; heap: Uint8Array } {
    const heap = new Uint8Array(4 * 1024 * 1024);
    const gl = new GLContext(8, 8, { memory: () => heap });
    gl.matrixMode(GL.PROJECTION);
    gl.ortho2D(0, 8, 0, 8);
    gl.matrixMode(GL.MODELVIEW);
    gl.vertexPointer(2, GL.FLOAT, 0, new Uint8Array(new Float32Array([1.5, 2.5]).buffer));
    gl.enableClientState(GL.VERTEX_ARRAY);
    return { gl, heap };
  }

  it('a count of 2^31 − 1 returns at once, draws nothing and records GL_OUT_OF_MEMORY', () => {
    const { gl } = heapContext();
    let start = performance.now();
    gl.drawElements(GL.POINTS, 2 ** 31 - 1, GL.UNSIGNED_BYTE, 0);
    expect(performance.now() - start).toBeLessThan(100);
    expect(covered(gl.fb)).toEqual([]);
    expect(gl.getError()).toBe(GL.OUT_OF_MEMORY);
    start = performance.now();
    gl.drawArrays(GL.POINTS, 0, 2 ** 31 - 1);
    expect(performance.now() - start).toBeLessThan(100);
    expect(covered(gl.fb)).toEqual([]);
    expect(gl.getError()).toBe(GL.OUT_OF_MEMORY);
  });

  it('a count at the cap still draws', () => {
    expect(MAX_DRAW_ELEMENTS).toBe(1 << 20);
    const { gl } = heapContext();
    // 2^20 zero indices from program memory: every one is element 0, the point (1.5, 2.5).
    gl.drawElements(GL.POINTS, MAX_DRAW_ELEMENTS, GL.UNSIGNED_BYTE, 0);
    expect(gl.getError()).toBe(GL.NO_ERROR);
    expect(covered(gl.fb)).toEqual(['1,2']);
  });
});

describe('ALG-LAB-22: Every font’s glyphs are freeglut’s, by a digest taken from fg_font_data.c', () => {
  // SHA-256 of the 256 entries "width:rows as hex", joined by commas, computed from freeglut master's
  // src/fg_font_data.c (each <Font>_Character_Map resolved by position), not from this repository.
  const FREEGLUT_DIGESTS: Record<GlutFontName, string> = {
    GLUT_BITMAP_8_BY_13: '16a1e3dd0b92c7e13952792e277a538ba293b603f9d802dfd46200850e80487b',
    GLUT_BITMAP_9_BY_15: '5f9ef2249c97a87d232975006ed6dc2b583e2dec541ec0653634ace6da4f7158',
    GLUT_BITMAP_HELVETICA_10: 'fe66b1c244dedec4ebdd3b15ef10724d5b21e545e93a6b1f681ac7d2ed43e2f6',
    GLUT_BITMAP_HELVETICA_12: '6e6165e862f3bb17910171f70ce6e34f40229eb78ce5e0f50c867ff25d11bd83',
    GLUT_BITMAP_HELVETICA_18: 'c275330be37a4095eba856914f5183781938955673b6f013f7fb08087a5c204b',
    GLUT_BITMAP_TIMES_ROMAN_10: '27d129904554d08bb72b0a2fbf664c610efcec951afada314ff9a1c234b39fb4',
    GLUT_BITMAP_TIMES_ROMAN_24: '6e89850958d227bb1a081541ff4382f67632bc8d620afd3ae5076d1cc47199cb',
  };
  const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

  it.each(Object.keys(FREEGLUT_DIGESTS) as GlutFontName[])('%s', (name) => {
    expect(sha256(GLUT_FONTS[name].glyphs.map(([w, hex]) => `${w}:${hex}`).join(','))).toBe(FREEGLUT_DIGESTS[name]);
  });

  it('the editor draws the 9×15 glyphs it drew before the Lab', () => {
    // SHA-256 of the 95 GLYPHS of src/shared/lib/glut-bitmap-9x15.ts at fe7a2e9, joined by commas.
    expect(GLYPHS).toHaveLength(95);
    expect(sha256(GLYPHS.join(','))).toBe('2eba0a047ac8c08d73184d7803e8954988466575ac5fce4fe75421cba5fd5566');
  });
});

describe('ALG-LAB-23: The bundled GL/gl.h and the context agree on every enum, glScissor included', () => {
  const header = () => readFileSync(join(process.cwd(), 'lab/include/GL/gl.h'), 'utf8');

  it('declares glScissor and GL_SCISSOR_TEST with GL 1.5’s signature and value', () => {
    expect(header()).toMatch(/GLAPI void glScissor\(GLint x, GLint y, GLsizei width, GLsizei height\);/);
    expect(header()).toMatch(/#define GL_SCISSOR_TEST 0x0C11\b/);
  });

  it('every #define GL_* that the context’s GL table names has the same value', () => {
    const table = GL as unknown as Record<string, number>;
    const defines = [...header().matchAll(/#define GL_(\w+) (0x[0-9A-Fa-f]+|\d+)\b/g)].map(([, name, value]) => [name, Number(value)] as const);
    const shared = defines.filter(([name]) => name in table);
    expect(shared.map(([name]) => name)).toContain('SCISSOR_TEST');
    expect(shared.filter(([name, value]) => table[name] !== value)).toEqual([]);
    expect(shared.length).toBeGreaterThan(80);
  });
});

describe('ALG-LAB-24: glIsEnabled answers for the client arrays (2.8)', () => {
  it.each([GL.VERTEX_ARRAY, GL.COLOR_ARRAY, GL.TEXTURE_COORD_ARRAY])('array %d', (array) => {
    const gl = new GLContext(8, 8);
    expect(gl.isEnabled(array)).toBe(false);
    gl.enableClientState(array);
    expect(gl.isEnabled(array)).toBe(true);
    gl.disableClientState(array);
    expect(gl.isEnabled(array)).toBe(false);
    expect(gl.getError()).toBe(GL.NO_ERROR);
  });
});

describe('ALG-LAB-25: glTexImage2D takes no level past log2 of the largest texture (3.8.1)', () => {
  it('level 13 is the last a 8192 texture has; level 14 is GL_INVALID_VALUE', () => {
    const gl = new GLContext(8, 8);
    const pixel = new Uint8Array([255, 255, 255, 255]);
    gl.texImage2D(GL.TEXTURE_2D, 13, GL.RGBA, 1, 1, 0, GL.RGBA, GL.UNSIGNED_BYTE, pixel);
    expect(gl.getError()).toBe(GL.NO_ERROR);
    gl.texImage2D(GL.TEXTURE_2D, 14, GL.RGBA, 1, 1, 0, GL.RGBA, GL.UNSIGNED_BYTE, pixel);
    expect(gl.getError()).toBe(GL.INVALID_VALUE);
    gl.texImage2D(GL.TEXTURE_2D, 1e9, GL.RGBA, 1, 1, 0, GL.RGBA, GL.UNSIGNED_BYTE, pixel);
    expect(gl.getError()).toBe(GL.INVALID_VALUE);
  });
});

describe('ALG-LAB-26: Point size and line width stop at 64 and 10 in both sampling modes', () => {
  /** How many pixels of column x the drawing covers, each counted by its alpha, so a half-covered pixel is ½. */
  const columnCover = (fb: Framebuffer, x: number) => {
    let sum = 0;
    for (let y = 0; y < fb.height; y++) sum += px(fb, x, y)[3] / 255;
    return sum;
  };

  it('without multisampling, glPointSize(1e30) draws a 64 × 64 square', () => {
    const gl = pixelContext(100, 100);
    gl.pointSize(1e30);
    gl.begin(GL.POINTS);
    gl.vertex2f(50, 50);
    gl.end();
    expect(gl.getError()).toBe(GL.NO_ERROR);
    // Centred on the pixel corner (50, 50): x and y 18..81 (3.3.1).
    expect(covered(gl.fb)).toEqual(block(18, 81, 18, 81));
  });

  it('with multisampling, glPointSize(1e30) draws a circle 64 wide', () => {
    const gl = pixelContext(100, 100, true);
    gl.pointSize(1e30);
    gl.begin(GL.POINTS);
    gl.vertex2f(50, 50);
    gl.end();
    expect(gl.getError()).toBe(GL.NO_ERROR);
    // A circle of radius 32 about (50, 50) (3.3.3, ALG-LAB-34): it reaches rows and columns 18 and
    // 81 at its middle, and leaves the corners of the 64 × 64 square out.
    const lit = covered(gl.fb);
    expect(lit.every((p) => block(18, 81, 18, 81).includes(p))).toBe(true);
    for (const p of ['18,49', '81,50', '49,18', '50,81', '30,30']) expect(lit).toContain(p);
    for (const p of ['18,18', '81,18', '18,81', '81,81', '24,24']) expect(lit).not.toContain(p);
  });

  it.each([false, true])('multisample %s: glLineWidth(1e9) draws a line 10 pixels wide', (multisample) => {
    const gl = pixelContext(100, 100, multisample);
    gl.lineWidth(1e9);
    gl.begin(GL.LINES);
    gl.vertex2f(10, 50.5);
    gl.vertex2f(90, 50.5);
    gl.end();
    expect(gl.getError()).toBe(GL.NO_ERROR);
    // A multisampled edge row is half covered and resolves to 128 / 255, so allow for 8-bit rounding.
    expect(columnCover(gl.fb, 50)).toBeCloseTo(10, 1);
  });

  it('a multisampled, stippled, widest line to 1e30 stays in the window and finishes within a second', () => {
    const gl = pixelContext(32, 32, true);
    gl.lineWidth(1e9);
    gl.enable(GL.LINE_STIPPLE);
    gl.lineStipple(1, 0x5555);
    const start = performance.now();
    gl.begin(GL.LINES);
    gl.vertex2f(-1e30, 16.5);
    gl.vertex2f(1e30, 16.5);
    gl.vertex2f(-1e15, -1e15);
    gl.vertex2f(1e15, 1e15);
    gl.vertex2f(-1e7, 8.5);
    gl.vertex2f(1e7, 8.5);
    gl.end();
    expect(performance.now() - start).toBeLessThan(1000);
    expect(covered(gl.fb).length).toBeGreaterThan(0);
    expect(covered(gl.fb).length).toBeLessThanOrEqual(32 * 32);
  });
});

/** A 64 × 64 texture whose mipmap levels 0 to 6 are each one colour, bound with `minFilter`. */
function levelTexture(gl: GLContext, minFilter: number, magFilter: number = GL.LINEAR): void {
  const colours = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [255, 0, 255], [0, 255, 255], [255, 255, 255]];
  gl.bindTexture(GL.TEXTURE_2D, gl.genTextures(1)[0]);
  for (let level = 0, size = 64; size >= 1; level++, size /= 2) {
    const texels = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) texels.set([...colours[level], 255], i * 4);
    gl.texImage2D(GL.TEXTURE_2D, level, GL.RGBA, size, size, 0, GL.RGBA, GL.UNSIGNED_BYTE, texels);
  }
  gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, minFilter);
  gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, magFilter);
  gl.enable(GL.TEXTURE_2D);
}

/** An axis-aligned quad from (x, y), `size` pixels wide, with texture coordinates 0..`repeat`. */
function texturedSquare(gl: GLContext, x: number, y: number, size: number, repeat = 1): void {
  gl.begin(GL.QUADS);
  gl.texCoord2f(0, 0);
  gl.vertex2f(x, y);
  gl.texCoord2f(repeat, 0);
  gl.vertex2f(x + size, y);
  gl.texCoord2f(repeat, repeat);
  gl.vertex2f(x + size, y + size);
  gl.texCoord2f(0, repeat);
  gl.vertex2f(x, y + size);
  gl.end();
}

/** Whether colour `got` is within `tolerance` of `want` in red, green and blue. */
const near = (got: number[], want: number[], tolerance: number) => want.every((c, i) => Math.abs(got[i] - c) <= tolerance);

describe('ALG-LAB-27: *_MIPMAP_LINEAR blends levels ⌊λ⌋ and ⌊λ⌋ + 1 by the fraction of λ (3.8.8)', () => {
  // Expected colours are the reference image's: tests/fixtures/lab/reference/textured-quad.png.
  it('a 26-pixel quad (λ ≈ 1.30) is 70 % level 1 and 30 % level 2: 0, 178, 77', () => {
    const gl = pixelContext(100, 100);
    levelTexture(gl, GL.LINEAR_MIPMAP_LINEAR);
    texturedSquare(gl, 10, 10, 26);
    expect(near(px(gl.fb, 23, 23), [0, 178, 77], 1), String(px(gl.fb, 23, 23))).toBe(true);
  });

  it('a 45-pixel quad (λ ≈ 0.51) is half level 0, half level 1: 126, 129, 0', () => {
    const gl = pixelContext(100, 100);
    levelTexture(gl, GL.LINEAR_MIPMAP_LINEAR);
    texturedSquare(gl, 10, 10, 45);
    expect(near(px(gl.fb, 32, 32), [126, 129, 0], 2), String(px(gl.fb, 32, 32))).toBe(true);
  });

  it('NEAREST_MIPMAP_LINEAR blends the same two levels', () => {
    const gl = pixelContext(100, 100);
    levelTexture(gl, GL.NEAREST_MIPMAP_LINEAR, GL.NEAREST);
    texturedSquare(gl, 10, 10, 26);
    expect(near(px(gl.fb, 23, 23), [0, 178, 77], 1), String(px(gl.fb, 23, 23))).toBe(true);
  });

  it('at λ = 6, the last level, and past it, it is level 6 alone', () => {
    const gl = pixelContext(100, 100);
    levelTexture(gl, GL.LINEAR_MIPMAP_LINEAR);
    texturedSquare(gl, 10, 10, 4, 4);
    texturedSquare(gl, 20, 10, 4, 8);
    expect(px(gl.fb, 11, 11)).toEqual([255, 255, 255, 255]);
    expect(px(gl.fb, 21, 11)).toEqual([255, 255, 255, 255]);
  });
});

/** Adds 64 to red for every fragment, so a pixel's red over 64 counts the fragments it took. */
function counting(gl: GLContext): (x: number, y: number) => number {
  gl.enable(GL.BLEND);
  gl.blendFunc(GL.ONE, GL.ONE);
  gl.color4f(64 / 255, 0, 0, 0);
  return (x, y) => px(gl.fb, x, y)[0] / 64;
}

/** A seeded generator (mulberry32), so the property test draws the same triangles every run. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('ALG-LAB-28: A pixel centre on an edge two polygons share is filled exactly once (3.5.1)', () => {
  it('the quad (20, 20)–(84, 84) in a 500-pixel window fills its 4096 pixels once each', () => {
    const gl = pixelContext(500, 500);
    const count = counting(gl);
    gl.begin(GL.QUADS);
    gl.vertex2f(20, 20);
    gl.vertex2f(84, 20);
    gl.vertex2f(84, 84);
    gl.vertex2f(20, 84);
    gl.end();
    const wrong: string[] = [];
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 100; x++) {
        const want = x >= 20 && x < 84 && y >= 20 && y < 84 ? 1 : 0;
        if (count(x, y) !== want) wrong.push(`${x},${y}:${count(x, y)}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('200 seeded triangle pairs: every centre on the shared edge once, no pixel twice', () => {
    const random = seeded(20261103);
    const problems: string[] = [];
    for (let n = 0; n < 200; n++) {
      const gl = pixelContext(500, 500);
      const count = counting(gl);
      // The shared edge p–q runs between pixel centres in a whole-number direction d, so the
      // centres p + j·d between them lie exactly on it.
      const p = [100 + Math.floor(random() * 200) + 0.5, 100 + Math.floor(random() * 200) + 0.5];
      const d = [Math.floor(random() * 7) - 3, Math.floor(random() * 7) - 3];
      if (d[0] === 0 && d[1] === 0) d[0] = 1;
      const k = 2 + Math.floor(random() * 12);
      const q = [p[0] + k * d[0], p[1] + k * d[1]];
      const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      // A third vertex on side s of the edge: out along the normal, and anywhere along the edge.
      const away = (s: number) => {
        const out = 0.3 + random() * 20;
        const along = (random() - 0.5) * 1.5 * k;
        return [mid[0] - s * d[1] * out + along * d[0], mid[1] + s * d[0] * out + along * d[1]];
      };
      const r = away(1);
      const s = away(-1);
      gl.begin(GL.TRIANGLES);
      for (const v of [p, q, r, q, p, s]) gl.vertex2f(v[0], v[1]);
      gl.end();
      for (let j = 1; j < k; j++) {
        const cx = p[0] + j * d[0] - 0.5;
        const cy = p[1] + j * d[1] - 0.5;
        if (count(cx, cy) !== 1) problems.push(`pair ${n}: centre ${cx},${cy} taken ${count(cx, cy)} times`);
      }
      const xs = [p[0], q[0], r[0], s[0]];
      const ys = [p[1], q[1], r[1], s[1]];
      for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
        for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) if (count(x, y) > 1) problems.push(`pair ${n}: ${x},${y} twice`);
      }
    }
    expect(problems.slice(0, 10)).toEqual([]);
  });
});

/** The lit runs of row y, as "first-last". */
function runs(fb: Framebuffer, y: number): string[] {
  const out: string[] = [];
  let start = -1;
  for (let x = 0; x <= fb.width; x++) {
    const lit = x < fb.width && px(fb, x, y)[3] > 0;
    if (lit && start < 0) start = x;
    if (!lit && start >= 0) {
      out.push(`${start}-${x - 1}`);
      start = -1;
    }
  }
  return out;
}

describe('ALG-LAB-29: A clipped line’s stipple counts from its unclipped start, as the reference driver does', () => {
  it('(4, 0x00FF) from (−91, 40.5) to (480, 40.5) lights x where (x + 91) mod 64 < 32', () => {
    // tests/fixtures/lab/reference/lines-stipple.png, row y = 40.
    const gl = pixelContext(500, 500);
    gl.enable(GL.LINE_STIPPLE);
    gl.lineStipple(4, 0x00ff);
    gl.begin(GL.LINES);
    gl.vertex2f(-91, 40.5);
    gl.vertex2f(480, 40.5);
    gl.end();
    expect(runs(gl.fb, 40)).toEqual(['0-4', '37-68', '101-132', '165-196', '229-260', '293-324', '357-388', '421-452']);
  });
});

describe('ALG-LAB-30: Lines on a pixel edge or a diamond corner take the pixels the reference driver takes (3.4.1)', () => {
  // Each case is what the reference GPU drew, in tests/fixtures/lab/reference/lines-stipple.png
  // and line-ties.png.
  const line = (w: number, h: number, ...v: number[]) => {
    const gl = pixelContext(w, h);
    gl.begin(GL.LINES);
    for (let i = 0; i < v.length; i += 2) gl.vertex2f(v[i], v[i + 1]);
    gl.end();
    return covered(gl.fb);
  };
  const diagonal = (f: (k: number) => [number, number]) =>
    Array.from({ length: 20 }, (_, i) => f(10 + i))
      .sort((a, b) => a[1] - b[1] || a[0] - b[0])
      .map(([x, y]) => `${x},${y}`);

  it('(4, 0x00FF) from (0, 20.5) to (480, 20.5) lights 0-31, 64-95 … 448-479', () => {
    const gl = pixelContext(500, 500);
    gl.enable(GL.LINE_STIPPLE);
    gl.lineStipple(4, 0x00ff);
    gl.begin(GL.LINES);
    gl.vertex2f(0, 20.5);
    gl.vertex2f(480, 20.5);
    gl.end();
    expect(runs(gl.fb, 20)).toEqual(['0-31', '64-95', '128-159', '192-223', '256-287', '320-351', '384-415', '448-479']);
  });

  it('a horizontal line on the boundary y = 460 takes row 459', () => {
    expect(line(500, 500, 20, 460, 230, 460)).toEqual(block(20, 229, 459, 459));
  });

  it('a vertical line on the boundary x = 20 takes column 19, either way', () => {
    expect(line(40, 40, 20, 10, 20, 30)).toEqual(block(19, 19, 10, 29));
    expect(line(40, 40, 20, 30, 20, 10)).toEqual(block(19, 19, 10, 29));
  });

  it('a horizontal line through pixel centres from x = 10 to x = 30 takes 10..29 either way', () => {
    expect(line(40, 40, 10, 20.5, 30, 20.5)).toEqual(block(10, 29, 20, 20));
    expect(line(40, 40, 30, 20.5, 10, 20.5)).toEqual(block(10, 29, 20, 20));
  });

  it('a vertical line through pixel centres from y = 10 to y = 30 takes 10..29 going up and 11..30 going down', () => {
    expect(line(40, 40, 20.5, 10, 20.5, 30)).toEqual(block(20, 20, 10, 29));
    expect(line(40, 40, 20.5, 30, 20.5, 10)).toEqual(block(20, 20, 11, 30));
  });

  it('45° lines through pixel corners, and through edge midpoints', () => {
    expect(line(40, 40, 10, 10, 30, 30)).toEqual(diagonal((k) => [k, k]));
    expect(line(40, 40, 30, 30, 10, 10)).toEqual(diagonal((k) => [k, k]));
    expect(line(40, 40, 10, 30, 30, 10)).toEqual(diagonal((k) => [k, 39 - k]));
    expect(line(40, 40, 10.5, 10, 30.5, 30)).toEqual(diagonal((k) => [k, k - 1]));
  });
});

describe('ALG-LAB-31: glTexParameterfv sets GL_TEXTURE_BORDER_COLOR, which GL_CLAMP blends in (3.8.4, 3.8.7)', () => {
  it('a blue border makes the clamped band half edge texel and half blue', () => {
    const gl = pixelContext(40, 40);
    gl.bindTexture(GL.TEXTURE_2D, gl.genTextures(1)[0]);
    gl.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, 1, 1, 0, GL.RGBA, GL.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    gl.texParameterfv(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, [GL.LINEAR]);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP);
    gl.texParameterfv(GL.TEXTURE_2D, GL.TEXTURE_BORDER_COLOR, [0, 0, 1, 1]);
    expect(gl.getError()).toBe(GL.NO_ERROR);
    gl.enable(GL.TEXTURE_2D);
    // s runs 0 to 2 and t stays 0.5, the texel's centre.
    gl.begin(GL.QUADS);
    for (const [s, x, y] of [[0, 0, 0], [2, 40, 0], [2, 40, 40], [0, 0, 40]]) {
      gl.texCoord2f(s, 0.5);
      gl.vertex2f(x, y);
    }
    gl.end();
    // Past s = 1 the clamp leaves s = 1, half way between the texel and the border.
    expect(px(gl.fb, 39, 20)).toEqual([128, 128, 255, 255]);
    // At s = 0.475 (pixel 9) 2.5 % of the border: 0.975 × 255 rounds to 249.
    expect(px(gl.fb, 9, 20)).toEqual([249, 249, 255, 255]);
  });

  it('GL/gl.h declares the call and the names it takes, with GL 1.5’s values', () => {
    const header = readFileSync(join(process.cwd(), 'lab/include/GL/gl.h'), 'utf8');
    expect(header).toMatch(/GLAPI void glTexParameterfv\(GLenum target, GLenum pname, const GLfloat \*params\);/);
    const names: [string, string][] = [
      ['NEAREST_MIPMAP_NEAREST', '0x2700'],
      ['LINEAR_MIPMAP_NEAREST', '0x2701'],
      ['NEAREST_MIPMAP_LINEAR', '0x2702'],
      ['LINEAR_MIPMAP_LINEAR', '0x2703'],
      ['TEXTURE_BORDER_COLOR', '0x1004'],
    ];
    for (const [name, value] of names) expect(header).toMatch(new RegExp(`#define GL_${name} ${value}\\b`));
  });
});

describe('ALG-LAB-32: An aliased line width rounds half to even, as the reference driver rounds it (3.4.2)', () => {
  it('width 4.5 is 4 pixels: lines-wide.png column 62 takes rows 148 to 151', () => {
    const gl = pixelContext(500, 500);
    gl.lineWidth(4.5);
    gl.begin(GL.LINES);
    gl.vertex2f(22.5, 150);
    gl.vertex2f(102.5, 150);
    gl.end();
    expect(covered(gl.fb).filter((p) => p.startsWith('62,'))).toEqual(['62,148', '62,149', '62,150', '62,151']);
  });

  it.each([[1.5, 2], [2.5, 2], [3.5, 4], [5.5, 6], [6.5, 6], [2.7, 3], [3.3, 3]])('width %s is %s pixels', (width, pixels) => {
    const gl = pixelContext(40, 40);
    gl.lineWidth(width);
    gl.begin(GL.LINES);
    gl.vertex2f(10, 20.5);
    gl.vertex2f(30, 20.5);
    gl.end();
    expect(covered(gl.fb).filter((p) => p.startsWith('15,'))).toHaveLength(pixels);
  });
});

describe('ALG-LAB-33: A quad is filled as triangles 0-1-2 and 0-2-3, as the reference driver splits it', () => {
  // The smooth ramp of tests/fixtures/lab/programs/blend.cpp; expected colours are
  // tests/fixtures/lab/reference/blend.png's, at pixels well away from the 0-2 diagonal and the edges.
  it('the ramp from blend.cpp takes the reference colours on both sides of the 0-2 diagonal', () => {
    const gl = pixelContext(500, 500);
    gl.shadeModel(GL.SMOOTH);
    gl.begin(GL.QUADS);
    gl.color3f(1, 1, 0);
    gl.vertex2f(360, 150);
    gl.color3f(0, 1, 1);
    gl.vertex2f(480, 150);
    gl.color3f(1, 0, 1);
    gl.vertex2f(480, 370);
    gl.color3f(1, 1, 1);
    gl.vertex2f(360, 370);
    gl.end();
    const reference: [number, number, number[]][] = [
      [370, 339, [255, 233, 220]],
      [365, 250, [255, 243, 116]],
      [380, 300, [255, 211, 174]],
      [470, 159, [31, 244, 235]],
      [475, 350, [242, 23, 245]],
      [460, 170, [65, 231, 214]],
    ];
    for (const [x, y, want] of reference) expect(near(px(gl.fb, x, y), want, 1), `${x},${y}: ${px(gl.fb, x, y)}`).toBe(true);
  });
});

describe('ALG-LAB-34: A multisampled point covers the samples inside a circle as wide as its size (3.3.3)', () => {
  // A size-8 star of tests/fixtures/lab/programs/gallery-solar-system.cpp, white on black, so a
  // pixel's red, back in linear light (ALG-LAB-36) and times 4, counts its covered samples. The
  // counts are the reference image's.
  function star(): (x: number, y: number) => number {
    const gl = new GLContext(500, 500, { multisample: true });
    gl.matrixMode(GL.PROJECTION);
    gl.ortho(-1.6, 1.6, -0.9, 0.9, -1, 1);
    gl.matrixMode(GL.MODELVIEW);
    gl.pointSize(8);
    gl.begin(GL.POINTS);
    gl.vertex2f(-1.0362, -0.8099);
    gl.end();
    const linear = (v: number) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
    return (x, y) => Math.round(linear(px(gl.fb, x, y)[0]) * 4);
  }

  it('leaves out the corners of the 8 × 8 square around (88.09, 25.03), and fills the middle', () => {
    const samples = star();
    for (const [x, y] of [[84, 28], [91, 28], [84, 21], [91, 21]]) expect(samples(x, y), `${x},${y}`).toBe(0);
    for (const [x, y] of [[88, 25], [86, 26], [89, 23]]) expect(samples(x, y), `${x},${y}`).toBe(4);
  });

  it('half covers the edge pixels the reference half covers', () => {
    const samples = star();
    expect(samples(84, 23)).toBe(2);
    expect(samples(86, 28)).toBe(2);
  });

  it('a point without multisampling stays a square', () => {
    const gl = pixelContext(20, 20);
    gl.pointSize(4);
    gl.begin(GL.POINTS);
    gl.vertex2f(10, 10);
    gl.end();
    expect(covered(gl.fb)).toEqual(block(8, 11, 8, 11));
  });
});

describe('ALG-LAB-35: A multisampled stipple counts distance along the line, on through a strip or loop', () => {
  // The reference driver measures a multisampled line's stipple in window units along the line,
  // carried on through every segment of a strip or loop, not one count per pixel column.

  it('the dashed Mars orbit of gallery-solar-system.cpp lights the pixels the reference lights', () => {
    const program = readFileSync(join(process.cwd(), 'tests/fixtures/lab/programs/gallery-solar-system.cpp'), 'utf8');
    const block = program.split('void draw_Mars_path()').pop()!.split('glEnd();')[0];
    const vertices = [...block.matchAll(/glVertex2f\((-?[\d.]+)f, (-?[\d.]+)f\)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(vertices).toHaveLength(64);
    const gl = new GLContext(500, 500, { multisample: true });
    gl.clearColor(0.02, 0.03, 0.1, 1);
    gl.clear(GL.COLOR_BUFFER_BIT);
    gl.matrixMode(GL.PROJECTION);
    gl.ortho(-1.6, 1.6, -0.9, 0.9, -1, 1);
    gl.matrixMode(GL.MODELVIEW);
    gl.enable(GL.LINE_STIPPLE);
    gl.lineStipple(2, 0x0f0f);
    gl.color3f(0.24, 0.29, 0.48);
    gl.begin(GL.LINE_LOOP);
    for (const [x, y] of vertices) gl.vertex2f(x, y);
    gl.end();
    // The top of the orbit, window rows 466 to 474: every pixel the reference shows clearly lit
    // (blue over 100) or clearly dark (blue under 30) must be the same here.
    const reference = decodePng(readFileSync(join(process.cwd(), 'tests/fixtures/lab/reference/gallery-solar-system.png')));
    const wrong: string[] = [];
    let checked = 0;
    for (let y = 466; y <= 474; y++) {
      for (let x = 200; x < 300; x++) {
        const want = reference.data[((499 - y) * 500 + x) * 4 + 2];
        if (want > 30 && want < 100) continue;
        checked++;
        const lit = px(gl.fb, x, y)[2] > 60;
        if (lit !== want >= 100) wrong.push(`${x},${y}`);
      }
    }
    expect(checked).toBeGreaterThan(800);
    expect(wrong).toEqual([]);
  });

  it('a 45° line takes 16 units of (1, 0x00FF) for every 11.3 pixels of x, the same split into pieces', () => {
    const draw = (pieces: number) => {
      const gl = pixelContext(200, 200, true);
      gl.enable(GL.LINE_STIPPLE);
      gl.lineStipple(1, 0x00ff);
      gl.begin(GL.LINE_STRIP);
      for (let i = 0; i <= pieces; i++) gl.vertex2f(10.3 + (140 * i) / pieces, 10.3 + (140 * i) / pieces);
      gl.end();
      return Array.from({ length: 140 }, (_, k) => (px(gl.fb, 10 + k, 10 + k)[3] > 128 ? '#' : ' ')).join('');
    };
    // Along the diagonal the dashes repeat every 16 / √2 ≈ 11.3 pixels, as the reference driver draws them.
    // On for 0 to 5.66 pixels of x from 10.3, off to 11.31, on to 16.97, off to 22.63, on to 28.28.
    const one = draw(1);
    expect([2, 8, 13, 19, 24].map((k) => one[k]).join('')).toBe('# # #');
    expect(draw(53)).toBe(one);
  });
});

describe('ALG-LAB-36: The 4 samples of a pixel resolve as the reference driver resolves them, averaged in sRGB', () => {
  // White on black: the reference image's partly covered pixels are 137, 188 and 225 for 1, 2 and 3
  // samples, the sRGB encoding of a quarter, a half and three quarters of full light
  // (tests/fixtures/lab/reference/gallery-solar-system.png's stars).
  it.each([
    [10.7, 1, 137],
    [10.5, 2, 188],
    [10.25, 3, 225],
  ])('a rectangle from x = %s covers %s of pixel 10’s samples and resolves to %s', (left, _samples, value) => {
    const gl = pixelContext(24, 24, true);
    gl.rectf(left, 0, 20, 20);
    // Pixel 10's samples sit at x 10.375, 10.875, 10.125 and 10.625.
    expect(Math.abs(px(gl.fb, 10, 5)[0] - value)).toBeLessThanOrEqual(1);
    expect(px(gl.fb, 11, 5)[0]).toBe(255);
    expect(px(gl.fb, 9, 5)[0]).toBe(0);
  });

  it('a covered pixel keeps its colour exactly, and alpha averages as coverage', () => {
    const gl = pixelContext(24, 24, true);
    gl.color4f(0.2, 0.6, 1, 1);
    gl.rectf(10.5, 0, 20, 20);
    expect(px(gl.fb, 15, 5)).toEqual([51, 153, 255, 255]);
    expect(px(gl.fb, 10, 5)[3]).toBe(128);
  });
});

describe('ALG-LAB-37: The raster position sits on a 1/256-pixel grid, as the reference driver keeps it (2.13)', () => {
  // tests/fixtures/lab/programs/bitmap-text.cpp's Helvetica 18 line at glRasterPos2i(8, 104) under
  // glOrtho(0, 720, 0, 640): worked out exactly the position is 103.99999999999999, which would put
  // the glyphs a row low; the reference draws them from row 104.
  it('glRasterPos2i(8, 104) under glOrtho(0, 720, 0, 640) puts a glyph’s origin at (8, 104)', () => {
    const gl = new GLContext(720, 640);
    gl.matrixMode(GL.PROJECTION);
    gl.ortho(0, 720, 0, 640, -1, 1);
    gl.matrixMode(GL.MODELVIEW);
    gl.rasterPos2i(8, 104);
    // A 1 × 1 bitmap with its one bit set lands on the raster position's pixel.
    gl.bitmap(1, 1, 0, 0, 0, 0, new Uint8Array([0x80]));
    expect(covered(gl.fb)).toEqual(['8,104']);
  });
});

describe('ALG-LAB-38: An open glBegin or glNewList holds at most MAX_DRAW_ELEMENTS, and drops the rest', () => {
  it('a vertex past the cap is dropped and records GL_OUT_OF_MEMORY; glEnd draws the rest', () => {
    const gl = pixelContext(8, 8);
    gl.begin(GL.POINTS);
    for (let i = 0; i < MAX_DRAW_ELEMENTS; i++) gl.vertex2f(1.5, 2.5);
    gl.vertex2f(5.5, 5.5);
    gl.end();
    expect(gl.getError()).toBe(GL.OUT_OF_MEMORY);
    expect(covered(gl.fb)).toEqual(['1,2']);
  });

  it('a command past a full display list is dropped and records GL_OUT_OF_MEMORY; the list keeps the rest', () => {
    const gl = pixelContext(8, 8);
    gl.newList(1, GL.COMPILE);
    // glBegin, MAX_DRAW_ELEMENTS − 2 vertices and glEnd fill the list.
    gl.begin(GL.POINTS);
    for (let i = 0; i < MAX_DRAW_ELEMENTS - 2; i++) gl.vertex2f(1.5, 2.5);
    gl.end();
    expect(gl.error).toBe(GL.NO_ERROR);
    gl.begin(GL.POINTS);
    gl.vertex2f(5.5, 5.5);
    gl.end();
    gl.endList();
    expect(gl.getError()).toBe(GL.OUT_OF_MEMORY);
    gl.callList(1);
    expect(gl.getError()).toBe(GL.NO_ERROR);
    expect(covered(gl.fb)).toEqual(['1,2']);
  });
});

describe('ALG-LAB-39: A multisampled frame is the same whether each pixel is averaged per fragment or when the frame is read', () => {
  /** Shapes over shapes in one colour and in gradients, blended and not, with a scissored clear, lines, points and a read part way. */
  function scene(gl: GLContext, midway: () => void) {
    gl.matrixMode(GL.PROJECTION);
    gl.loadIdentity();
    gl.ortho(0, 64, 0, 48, -1, 1);
    gl.matrixMode(GL.MODELVIEW);
    gl.clearColor(0.1, 0.2, 0.3, 1);
    gl.clear(GL.COLOR_BUFFER_BIT);
    gl.begin(GL.QUADS);
    gl.color3f(0.9, 0.6, 0.1);
    for (const [x, y] of [[3, 2], [40, 5], [37.5, 30.25], [6, 28]]) gl.vertex2f(x, y);
    gl.end();
    gl.pushMatrix();
    gl.translatef(32, 24, 0);
    gl.rotatef(17, 0, 0, 1);
    gl.begin(GL.TRIANGLE_FAN);
    gl.color3f(1, 1, 1);
    gl.vertex2f(0, 0);
    for (let k = 0; k <= 12; k++) {
      gl.color3f(k / 12, 0.3, 1 - k / 12);
      gl.vertex2f(Math.cos((k / 12) * 2 * Math.PI) * 14, Math.sin((k / 12) * 2 * Math.PI) * 9);
    }
    gl.end();
    gl.popMatrix();
    midway();
    gl.enable(GL.BLEND);
    gl.blendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA);
    gl.begin(GL.TRIANGLES);
    gl.color4f(0.2, 0.9, 0.4, 0.5);
    gl.vertex2f(10, 40);
    gl.vertex2f(60.3, 12.7);
    gl.vertex2f(50, 46);
    gl.end();
    gl.disable(GL.BLEND);
    gl.enable(GL.SCISSOR_TEST);
    gl.scissor(20, 10, 9, 7);
    gl.clear(GL.COLOR_BUFFER_BIT);
    gl.disable(GL.SCISSOR_TEST);
    gl.lineWidth(2);
    gl.begin(GL.LINES);
    gl.color3f(1, 0, 0);
    gl.vertex2f(1, 1);
    gl.vertex2f(62, 45);
    gl.end();
    gl.pointSize(3);
    gl.begin(GL.POINTS);
    gl.color3f(0, 1, 1);
    gl.vertex2f(12.3, 33.6);
    gl.end();
  }

  it('gives the same bytes, with the colour buffer read part way through or not', () => {
    const deferred = new GLContext(64, 48, { multisample: true });
    scene(deferred, () => void deferred.fb);
    const once = new GLContext(64, 48, { multisample: true });
    scene(once, () => {});
    // The same drawing with each fragment's pixel averaged at once, as a framebuffer without pending does.
    const immediate = new GLContext(64, 48, { multisample: true });
    (immediate as unknown as { frame: Framebuffer }).frame.pending = null;
    scene(immediate, () => {});
    const bytes = (gl: GLContext) => Array.from(gl.fb.color);
    expect(bytes(deferred)).toEqual(bytes(immediate));
    expect(bytes(once)).toEqual(bytes(immediate));
    // Something of every kind was drawn: the clear, the shapes and the averaged edges between them.
    expect(new Set(bytes(immediate).map((_, i, a) => (i % 4 === 0 ? a.slice(i, i + 3).join() : ''))).size).toBeGreaterThan(50);
  });
});

describe('ALG-LAB-40: Drawing held back for unshown frames leaves every frame read with the pixels drawing it all gives', () => {
  /**
   * Frame `n` of a program: a clear of the whole window on some frames only, shapes that move with
   * n, a stippled line, a blended triangle, a scissored clear, bitmap text that moves the raster
   * position, and a texture whose image is replaced part way through the frame.
   */
  function frame(gl: GLContext, n: number, clears: boolean) {
    if (n === 0) {
      gl.matrixMode(GL.PROJECTION);
      gl.loadIdentity();
      gl.ortho(0, 48, 0, 32, -1, 1);
      gl.matrixMode(GL.MODELVIEW);
      const [name] = gl.genTextures(1);
      gl.bindTexture(GL.TEXTURE_2D, name);
      gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
      gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
    }
    if (clears) {
      gl.clearColor(0.1, 0.1 * (n % 5), 0.3, 1);
      gl.clear(GL.COLOR_BUFFER_BIT);
    }
    gl.loadIdentity();
    gl.translatef(n * 1.7, 0, 0);
    gl.begin(GL.QUADS);
    gl.color3f(0.9, 0.5, 0.1);
    for (const [x, y] of [[1, 2], [9.5, 2], [9.5, 11.25], [1, 11.25]]) gl.vertex2f(x, y);
    gl.end();
    gl.loadIdentity();
    gl.enable(GL.LINE_STIPPLE);
    gl.lineStipple(1, 0xf0f0 >> n % 4);
    gl.begin(GL.LINES);
    gl.color3f(1, 1, 1);
    gl.vertex2f(0, 31 - n);
    gl.vertex2f(47, 20 + n);
    gl.end();
    gl.disable(GL.LINE_STIPPLE);
    gl.enable(GL.BLEND);
    gl.blendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA);
    gl.begin(GL.TRIANGLES);
    gl.color4f(0.2, 0.8, 0.9, 0.5);
    gl.vertex2f(20, 4 + n);
    gl.vertex2f(44, 8);
    gl.vertex2f(30, 30);
    gl.end();
    gl.disable(GL.BLEND);
    gl.enable(GL.SCISSOR_TEST);
    gl.scissor(n, 24, 5, 5);
    gl.clear(GL.COLOR_BUFFER_BIT);
    gl.disable(GL.SCISSOR_TEST);
    gl.color3f(1, 1, 0);
    gl.rasterPos2f(2, 14);
    for (let i = 0; i <= n % 3; i++) gl.bitmap(8, 2, 0, 0, 9, 0, new Uint8Array([0xff, 0x81]));
    gl.enable(GL.TEXTURE_2D);
    const texel = (k: number) => new Uint8Array([40 * k, 255 - 30 * k, 90, 255]);
    gl.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, 1, 1, 0, GL.RGBA, GL.UNSIGNED_BYTE, texel(n % 6));
    gl.begin(GL.QUADS);
    gl.color3f(1, 1, 1);
    gl.texCoord2f(0, 0);
    gl.vertex2f(36, 1);
    gl.texCoord2f(1, 0);
    gl.vertex2f(46, 1);
    gl.texCoord2f(1, 1);
    gl.vertex2f(46, 9);
    gl.texCoord2f(0, 1);
    gl.vertex2f(36, 9);
    gl.end();
    // The next frame's image replaces this one; what was drawn with it must keep it.
    gl.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, 1, 1, 0, GL.RGBA, GL.UNSIGNED_BYTE, texel(n % 6 + 1));
    gl.disable(GL.TEXTURE_2D);
  }

  /** Every frame's pixels drawing all of it, against a run that holds back the frames `held` picks and reads the rest. */
  function compare(multisample: boolean, clears: (n: number) => boolean, held: (n: number) => boolean) {
    const all = new GLContext(48, 32, { multisample });
    const holding = new GLContext(48, 32, { multisample });
    for (let n = 0; n < 24; n++) {
      frame(all, n, clears(n));
      holding.hold(held(n));
      frame(holding, n, clears(n));
      holding.hold(false);
      if (!held(n)) expect(Array.from(holding.fb.color), `frame ${n}`).toEqual(Array.from(all.fb.color));
    }
    expect(Array.from(holding.fb.color)).toEqual(Array.from(all.fb.color));
  }

  it('a program that clears the whole window every frame, with two frames in three held', () => {
    for (const multisample of [false, true]) compare(multisample, () => true, (n) => n % 3 !== 0);
  });

  it('a program that never clears, or clears only some frames, so held drawing shows through', () => {
    for (const multisample of [false, true]) {
      compare(multisample, () => false, (n) => n % 3 !== 0);
      compare(multisample, (n) => n % 4 === 0, (n) => n % 2 === 1 || n % 5 === 0);
    }
  });

  it('runs of held frames of any length, and a resize while drawing is held', () => {
    compare(true, (n) => n % 7 !== 3, (n) => n > 2 && n < 11);
    const gl = new GLContext(8, 8);
    gl.hold(true);
    gl.clearColor(1, 0, 0, 1);
    gl.clear(GL.COLOR_BUFFER_BIT);
    gl.resize(6, 4);
    gl.hold(false);
    // A new window starts cleared to 0, whatever was held for the old one.
    expect(Array.from(gl.fb.color).every((v) => v === 0)).toBe(true);
  });
});
