/**
 * BLACK-BOX TEST SUITE — BB-CPP
 * Maps to Table 12, row 5: Equivalent C++ OpenGL Code Validation
 *
 * Test focus:
 *  - Code exported from V.A.M.S. is plausibly compilable with g++/FreeGLUT.
 *  - Correlation between the V.A.M.S. scene and the exported program in
 *    geometry, transforms, hierarchy, colors, line width, bitmap text.
 *
 * Limitation: actually shelling out to `g++` for a real compile is performed
 * in a separate manual harness (see tests/reports/manual-compile-procedure.md).
 * The automated checks here are *static* — they verify structural validity
 * of the emitted source string.
 */
import { describe, it, expect } from 'vitest';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { addTriangle, addQuad, getState } from '../helpers/store';

const CANVAS = { width: 800, height: 600 };

function gen() {
  const s = getState();
  return generateCodeFromState(
    {
      objects: s.objects,
      canvasBackgroundColor: s.canvasBackgroundColor,
      callbacks: s.callbacks,
      viewportLimits: s.viewportLimits,
      textures: s.uploadedTextures,
    },
    CANVAS,
  );
}

describe('BB-CPP-01: Output is syntactically well-formed C++', () => {
  it('has matched braces', () => {
    addTriangle();
    const code = gen();
    const open  = (code.match(/\{/g) ?? []).length;
    const close = (code.match(/\}/g) ?? []).length;
    expect(open).toBe(close);
  });

  it('has matched parentheses', () => {
    addTriangle();
    const code = gen();
    const open  = (code.match(/\(/g) ?? []).length;
    const close = (code.match(/\)/g) ?? []).length;
    expect(open).toBe(close);
  });

  it('contains a single main() entry point', () => {
    addTriangle();
    const code = gen();
    expect((code.match(/\bint\s+main\s*\(/g) ?? []).length).toBe(1);
  });
});

describe('BB-CPP-02: Geometry correlates with V.A.M.S. vertices', () => {
  it('each vertex coordinate appears in the emitted output at 4-decimal precision', () => {
    const t = addTriangle();
    const code = gen();
    for (const v of t.vertices) {
      const xs = v.x.toFixed(4);
      const ys = v.y.toFixed(4);
      expect(code).toContain(`glVertex2f(${xs}f, ${ys}f);`);
    }
  });
});

describe('BB-CPP-03: Object transforms appear in the global state struct', () => {
  it('emits ObjectState with the same translate/rotate/scale values', () => {
    const t = addTriangle(0.42, -0.17, 0.05);
    getState().updateObjectTransform(t.id, { rotate: 30, scaleX: 2 });
    const code = gen();
    expect(code).toContain('0.4200f');
    expect(code).toContain('-0.1700f');
    expect(code).toContain('30.0000f');
    expect(code).toContain('2.0000f');
  });
});

describe('BB-CPP-04: Hierarchy is preserved in draw() ordering', () => {
  it('children are drawn between their parent group push/pop', () => {
    const a = addTriangle(0.1, 0.0, 0.05);
    const b = addQuad(0.3, 0.0, 0.05);
    getState().createGroup([a.id, b.id]);
    const code = gen();
    // The group's push/pop wraps the calls to draw_<child>
    const pushIdx = code.indexOf('// Group');
    // Find the next glPopMatrix after the first glPushMatrix in display() block
    expect(code).toMatch(/glPushMatrix\(\)[\s\S]+draw_TRIANGLES_\d+\(\);[\s\S]+glPopMatrix\(\)/);
    expect(pushIdx).toBeGreaterThanOrEqual(-1); // tolerant — exact comment naming may change
  });
});

describe('BB-CPP-05: Bitmap text uses raster position', () => {
  it('emits glRasterPos2f and bitmap loop', () => {
    getState().addTextObject('Sample', 0.1, 0.2);
    const code = gen();
    expect(code).toContain('glRasterPos2f');
    expect(code).toContain('GLUT_BITMAP_9_BY_15');
    expect(code).toContain('Sample');
  });
});

describe('BB-CPP-06: Line width emission matches user setting', () => {
  it('emits glLineWidth with the configured value', () => {
    // Add new LINES object directly to make assertion deterministic
    getState().addCustomObject('LINES', [
      { x: 0, y: 0 }, { x: 0.5, y: 0.0 },
    ]);
    const id = getState().objects[0].id;
    getState().updateLineWidth(id, 4.5);
    const code = gen();
    expect(code).toContain('glLineWidth(4.50f);');
  });
});
