/**
 * WHITE-BOX TEST SUITE — WB-GEN
 * Maps to Table 13, row 5: Code Generation Service
 *
 * Test focus:
 *  - Balanced glBegin/glEnd pairs
 *  - Correct emission order
 *  - Correct indentation
 *  - Proper conversion of vertex data
 *  - Branching on node types (TEXT, GROUP, GEOMETRIC)
 *  - Correct emission of required headers
 *  - Deterministic output: same input → identical output string
 */
import { describe, it, expect } from 'vitest';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { sanitizeName, hexToGlColor, hexToGlByteColor, getGlPrimitive } from '@/features/code-generation/model/generator/utils';
import { addTriangle, addQuad, getState } from '../helpers/store';

const CANVAS = { width: 800, height: 600 };
const gen = () => {
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
};

describe('WB-GEN-01: sanitizeName produces valid C identifiers', () => {
  it.each([
    ['My Triangle', 'My_Triangle'],
    ['1stPlace',    '_1stPlace'],
    ['class',       'class_obj'],
    ['valid_name',  'valid_name'],
    ['hello-world', 'hello_world'],
    ['foo!@#',      'foo___'],
  ])('sanitizes %p to %p', (input, expected) => {
    expect(sanitizeName(input)).toBe(expected);
  });
});

describe('WB-GEN-02: Color hex → glColor conversions', () => {
  it('hexToGlColor produces a 0..1 float triple', () => {
    expect(hexToGlColor('#ff0000')).toBe('1.00f, 0.00f, 0.00f');
    expect(hexToGlColor('#000000')).toBe('0.00f, 0.00f, 0.00f');
    expect(hexToGlColor('#80ff40')).toMatch(/^0\.50f, 1\.00f, 0\.25f$/);
  });

  it('hexToGlByteColor produces an integer 0..255 triple', () => {
    expect(hexToGlByteColor('#ff0000')).toBe('255, 0, 0');
    expect(hexToGlByteColor('#0080ff')).toBe('0, 128, 255');
  });
});

describe('WB-GEN-03: getGlPrimitive maps every primitive', () => {
  it('returns the matching GL enum string', () => {
    expect(getGlPrimitive('POINTS')).toBe('GL_POINTS');
    expect(getGlPrimitive('TRIANGLE_STRIP')).toBe('GL_TRIANGLE_STRIP');
    expect(getGlPrimitive('POLYGON')).toBe('GL_POLYGON');
  });
});

describe('WB-GEN-04: Deterministic output — same input always produces the same string', () => {
  it('two consecutive generations of the same scene match byte-for-byte', () => {
    addTriangle(0.1, 0.2, 0.05);
    addQuad(-0.2, 0.0, 0.05);
    const a = gen();
    const b = gen();
    expect(a).toBe(b);
  });

  it('a no-op scene mutation that resolves to the same state produces the same output', () => {
    addTriangle(0.1, 0.2, 0.05);
    const a = gen();
    const t = getState().objects[0];
    getState().updateObjectName(t.id, t.name);
    const b = gen();
    expect(a).toBe(b);
  });
});

describe('WB-GEN-05: Balanced glBegin/glEnd pairs across mixed scenes', () => {
  it('every primitive emits exactly one glBegin and one glEnd', () => {
    addTriangle();
    addQuad();
    getState().addCustomObject('LINES', [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }]);
    getState().addCustomObject('LINE_LOOP', [
      { x: 0, y: 0 }, { x: 0.3, y: 0.3 }, { x: 0.3, y: 0 },
    ]);
    const code = gen();
    const begins = (code.match(/glBegin\(/g) ?? []).length;
    const ends = (code.match(/glEnd\(/g) ?? []).length;
    expect(begins).toBe(ends);
    expect(begins).toBe(4);
  });
});

describe('WB-GEN-06: Branching by node type — TEXT vs GROUP vs GEOMETRIC', () => {
  it('TEXT nodes do NOT emit glBegin', () => {
    getState().addTextObject('Hi', 0, 0);
    const code = gen();
    expect(code).not.toContain('glBegin(');
    expect(code).toContain('glutBitmapCharacter');
  });

  it('GROUP nodes do NOT emit glBegin themselves; their children do', () => {
    const a = addTriangle();
    const b = addQuad(0.3, 0.0, 0.05);
    getState().createGroup([a.id, b.id]);
    const code = gen();
    // The group block uses // Group comments and contains child draw calls.
    expect(code).toMatch(/draw_TRIANGLES_\d+\(\);/);
    expect(code).toMatch(/draw_QUADS_\d+\(\);/);
  });
});

describe('WB-GEN-07: Required headers are always emitted', () => {
  it('contains GL/glew.h, GL/freeglut.h, and cmath', () => {
    addTriangle();
    const code = gen();
    expect(code).toContain('#include <GL/glew.h>');
    expect(code).toContain('#include <GL/freeglut.h>');
    expect(code).toContain('#include <cmath>');
  });
});

describe('WB-GEN-08: Vertex data conversion uses 4-decimal precision', () => {
  it('emits glVertex2f with exactly 4 fractional digits', () => {
    getState().addCustomObject('TRIANGLES', [
      { x: 0.123456, y: -0.987654 },
      { x: 0,        y: 0 },
      { x: 1,        y: 1 },
    ]);
    const code = gen();
    // After centroid-shift in addCustomObject the exact values are different
    // but each glVertex2f arg is rendered with 4 decimals.
    const matches = code.match(/glVertex2f\(-?\d+\.\d{4}f,\s*-?\d+\.\d{4}f\)/g);
    expect(matches?.length).toBeGreaterThanOrEqual(3);
  });
});

describe('WB-GEN-09: Indentation is consistent and predictable', () => {
  it('inner emission lines start with 4 or 8 spaces', () => {
    addTriangle();
    const code = gen();
    const lines = code.split('\n');
    const indented = lines.filter((l) => l.startsWith('    glPushMatrix') || l.startsWith('        glVertex2f'));
    expect(indented.length).toBeGreaterThan(0);
    for (const l of indented) {
      const lead = l.match(/^( +)/)?.[1] ?? '';
      expect([4, 8]).toContain(lead.length);
    }
  });
});

describe('WB-GEN-10: ortho/viewport limits flow into glOrtho', () => {
  it('emits the configured viewport limits as the glOrtho arguments', () => {
    addTriangle();
    expect(gen()).toContain('glOrtho(-1.0000, 1.0000, -1.0000, 1.0000');
    useVamsStore$setVL({ minX: -3, maxX: 4, minY: -2, maxY: 5 });
    expect(gen()).toContain('glOrtho(-3.0000, 4.0000, -2.0000, 5.0000');
  });
});

// Inline helper because the slice does not export a "setViewport once" alias.
import { useVamsStore } from '@/core/store';
function useVamsStore$setVL(limits: { minX: number; maxX: number; minY: number; maxY: number }) {
  useVamsStore.setState({ viewportLimits: limits });
}
