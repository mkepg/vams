/**
 * BLACK-BOX TEST SUITE — BB-HOME
 * Landing page: the live vertex demo, stage mode, home content and structured data.
 */
import { describe, it, expect } from 'vitest';
import {
  INITIAL_TRIANGLE,
  FALLBACK_CODE,
  generateDemoCode,
  generateDemoProgram,
  extractDrawBlock,
  pixelToGl,
  glToPixel,
  snapToGrid,
  type DemoTriangle,
} from '@/pages/home/model/demo-code';

/** The block the editor's generator emits for the initial demo triangle (red, green, blue vertices). */
const INITIAL_BLOCK = [
  'glBegin(GL_TRIANGLES);',
  '    glColor3f(1.00f, 0.00f, 0.00f);',
  '    glVertex2f(-0.5000f, -0.5000f);',
  '    glColor3f(0.00f, 1.00f, 0.00f);',
  '    glVertex2f(0.5000f, -0.5000f);',
  '    glColor3f(0.00f, 0.00f, 1.00f);',
  '    glVertex2f(0.0000f, 0.5000f);',
  'glEnd();',
];

describe('BB-HOME-01: The demo shows the generator draw block for the initial triangle', () => {
  it('returns the glBegin…glEnd block and points at the three glVertex2f lines', () => {
    const code = generateDemoCode(INITIAL_TRIANGLE);
    expect(code.lines).toEqual(INITIAL_BLOCK);
    expect(code.vertexLineIndexes).toEqual([2, 4, 6]);
  });
});

describe('BB-HOME-02: The demo block is taken verbatim from the full generated program', () => {
  it('appears unchanged in the program and follows a moved vertex', () => {
    const moved: DemoTriangle = [{ x: 0.25, y: -0.75 }, INITIAL_TRIANGLE[1], INITIAL_TRIANGLE[2]];
    const program = generateDemoProgram(moved);
    const code = generateDemoCode(moved);
    expect(program).toContain(code.lines.map((line) => `    ${line}`).join('\n'));
    expect(code.lines[code.vertexLineIndexes[0]]).toBe('    glVertex2f(0.2500f, -0.7500f);');
  });
});

describe('BB-HOME-03: Pixel and GL coordinates convert both ways', () => {
  it('maps corners and the centre, and round-trips an arbitrary point', () => {
    expect(pixelToGl(0, 0, 300, 300)).toEqual({ x: -1, y: 1 });
    expect(pixelToGl(300, 300, 300, 300)).toEqual({ x: 1, y: -1 });
    expect(pixelToGl(150, 150, 300, 300)).toEqual({ x: 0, y: 0 });
    expect(glToPixel(0, 0.5, 300, 300)).toEqual({ px: 150, py: 75 });
    const p = glToPixel(-0.35, 0.8, 300, 300);
    const g = pixelToGl(p.px, p.py, 300, 300);
    expect(g.x).toBeCloseTo(-0.35, 10);
    expect(g.y).toBeCloseTo(0.8, 10);
  });
});

describe('BB-HOME-04: Dragged positions clamp to the view and snap to the grid', () => {
  it('clamps to [-1, 1], snaps to 0.05 and never returns negative zero', () => {
    expect(snapToGrid(1.3)).toBe(1);
    expect(snapToGrid(-2)).toBe(-1);
    expect(snapToGrid(0.123)).toBe(0.1);
    expect(snapToGrid(0.126)).toBe(0.15);
    expect(snapToGrid(-0.45 + 0.05)).toBe(-0.4);
    expect(Object.is(snapToGrid(-0.01), 0)).toBe(true);
  });
});

describe('BB-HOME-05: The demo falls back to a static block when extraction fails', () => {
  it('rejects programs without a complete block and keeps a fallback that matches the initial block', () => {
    expect(extractDrawBlock('int main() { return 0; }')).toBeNull();
    expect(extractDrawBlock('    glBegin(GL_TRIANGLES);\n')).toBeNull();
    expect(FALLBACK_CODE.lines).toEqual(INITIAL_BLOCK);
    expect(FALLBACK_CODE.vertexLineIndexes).toEqual([2, 4, 6]);
  });
});
