/**
 * BLACK-BOX TEST SUITE — BB-GEN
 * Maps to Table 12, row 4: OpenGL Code Generation
 *
 * Test focus:
 *  - Generated code is semantically meaningful for OpenGL 1.x
 *  - glPushMatrix / glPopMatrix calls are balanced
 *  - Transformation calls appear in the correct order (T-R-S)
 *  - Vertex data is emitted correctly
 *  - All primitive types and shading modes are handled
 *  - TEXT and GROUP nodes are emitted correctly
 *  - Stored callbacks are emitted & registered via glut*Func
 */
import { describe, it, expect } from 'vitest';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { addPrimitive, addTriangle, addQuad, getState } from '../helpers/store';
import type { PrimitiveType, GlutCallbackKind } from '@/core/types/scene';

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

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('BB-GEN-01: Empty scenes produce a runnable shell', () => {
  it('contains main(), display(), and an `// Empty scene` comment', () => {
    const code = gen();
    expect(code).toContain('int main(int argc, char** argv)');
    expect(code).toContain('void display()');
    expect(code).toContain('// Empty scene');
    expect(code).toContain('glutMainLoop()');
  });
});

describe('BB-GEN-02: glPushMatrix and glPopMatrix calls are balanced', () => {
  it('matches push/pop count for a single primitive', () => {
    addTriangle();
    const code = gen();
    expect(countOccurrences(code, 'glPushMatrix()'))
      .toBe(countOccurrences(code, 'glPopMatrix()'));
  });

  it('matches push/pop count for a 2-level hierarchy', () => {
    const a = addTriangle(0.1, 0.0, 0.05);
    const b = addQuad(0.3, 0.0, 0.05);
    getState().createGroup([a.id, b.id]);
    const code = gen();
    expect(countOccurrences(code, 'glPushMatrix()'))
      .toBe(countOccurrences(code, 'glPopMatrix()'));
  });
});

describe('BB-GEN-03: Transformation calls appear in T-R-S order', () => {
  it('emits glTranslatef, glRotatef, glScalef in that order', () => {
    addTriangle(0.2, 0.3, 0.05);
    const code = gen();
    const t = code.indexOf('glTranslatef(');
    const r = code.indexOf('glRotatef(');
    const s = code.indexOf('glScalef(');
    expect(t).toBeGreaterThan(-1);
    expect(r).toBeGreaterThan(t);
    expect(s).toBeGreaterThan(r);
  });
});

describe('BB-GEN-04: glBegin/glEnd are balanced and use correct primitives', () => {
  const PRIMITIVES: PrimitiveType[] = [
    'POINTS', 'LINES', 'LINE_STRIP', 'LINE_LOOP',
    'TRIANGLES', 'TRIANGLE_STRIP', 'TRIANGLE_FAN',
    'QUADS', 'QUAD_STRIP', 'POLYGON',
  ];

  it.each(PRIMITIVES)('emits glBegin(GL_%s) for a %s object', (type) => {
    addPrimitive(type, [
      { x: -0.1, y: -0.1 }, { x: 0.1, y: -0.1 }, { x: 0.0, y: 0.1 },
    ]);
    const code = gen();
    expect(code).toContain(`glBegin(GL_${type})`);
    expect(countOccurrences(code, 'glBegin(')).toBe(countOccurrences(code, 'glEnd()'));
  });
});

describe('BB-GEN-05: Per-vertex emission of position & color', () => {
  it('emits glColor3f and glVertex2f for each vertex (FLOAT mode)', () => {
    const obj = addTriangle();
    getState().updateObjectColorMode(obj.id, 'FLOAT');
    const code = gen();
    expect(countOccurrences(code, 'glColor3f(')).toBeGreaterThanOrEqual(3);
    expect(countOccurrences(code, 'glVertex2f(')).toBe(3);
  });

  it('switches to glColor3ub in BYTE mode', () => {
    const obj = addTriangle();
    getState().updateObjectColorMode(obj.id, 'BYTE');
    const code = gen();
    expect(code).toContain('glColor3ub(');
    expect(code).not.toContain('glColor3f(');
  });
});

describe('BB-GEN-06: Shading mode emission', () => {
  it('emits GL_FLAT when shading is FLAT', () => {
    const obj = addTriangle();
    getState().updateObjectShading(obj.id, 'FLAT');
    expect(gen()).toContain('glShadeModel(GL_FLAT)');
  });

  it('emits GL_SMOOTH when shading is SMOOTH', () => {
    addTriangle(); // defaults to SMOOTH
    expect(gen()).toContain('glShadeModel(GL_SMOOTH)');
  });
});

describe('BB-GEN-07: TEXT nodes emit glRasterPos + glutBitmapCharacter', () => {
  it('renders a one-line text node via the bitmap glyph loop', () => {
    getState().addTextObject('Hello', 0.0, 0.0);
    const code = gen();
    expect(code).toContain('glRasterPos2f(');
    expect(code).toContain('glutBitmapCharacter(GLUT_BITMAP_9_BY_15');
    expect(code).toContain('Hello');
  });
});

describe('BB-GEN-08: GROUP nodes emit draw calls for their children', () => {
  it('children of a group are drawn between push/pop of the group', () => {
    const a = addTriangle(0.0, 0.0, 0.05);
    const b = addQuad(0.2, 0.0, 0.05);
    getState().createGroup([a.id, b.id]);
    const code = gen();
    // Two draw_<safeName> forward declarations should appear (excluding the group).
    expect(/void draw_TRIANGLES_\d+\(\)/.test(code)).toBe(true);
    expect(/void draw_QUADS_\d+\(\)/.test(code)).toBe(true);
  });
});

describe('BB-GEN-09: Registered GLUT callbacks emit handlers AND glutXxxFunc()', () => {
  const KINDS: Array<{
    kind: GlutCallbackKind;
    funcCall: string;
  }> = [
    { kind: 'keyboard', funcCall: 'glutKeyboardFunc' },
    { kind: 'special',  funcCall: 'glutSpecialFunc'  },
    { kind: 'mouse',    funcCall: 'glutMouseFunc'    },
    { kind: 'motion',   funcCall: 'glutMotionFunc'   },
    { kind: 'reshape',  funcCall: 'glutReshapeFunc'  },
    { kind: 'idle',     funcCall: 'glutIdleFunc'     }, // registered via _vams_idle wrapper
  ];

  it.each(KINDS)('emits the $kind handler and registers it', ({ kind, funcCall }) => {
    addTriangle();
    getState().setCallbackHandler(kind, `myHandler_${kind}`);
    const code = gen();
    expect(code).toContain(`void myHandler_${kind}(`);
    expect(code).toContain(funcCall);
  });
});

describe('BB-GEN-10: Required headers are present', () => {
  it('always includes <GL/glew.h> and <GL/freeglut.h>', () => {
    const code = gen();
    expect(code).toContain('#include <GL/glew.h>');
    expect(code).toContain('#include <GL/freeglut.h>');
    expect(code).toContain('#include <cmath>');
  });
});

describe('BB-GEN-11: A textured program includes only what it uses', () => {
  it('has no iostream and explains why stb_image is defined first', () => {
    const painted = addQuad(-0.3, 0.3, 0.2);
    getState().attachTexture(painted.id, getState().getAllTextures()[0].id);
    const code = gen();
    expect(code).not.toContain('#include <iostream>');
    expect(code).toContain('// stb_image: define its implementation in exactly one file, before including it\n#define STB_IMAGE_IMPLEMENTATION\n#include "stb_image.h"\n');
  });
});

describe('BB-GEN-12: Text lines start 17 window pixels apart', () => {
  const text = () => getState().objects.find((o) => o.type === 'TEXT')!;

  it('starts line 1 at the origin and steps down in units worth 17 pixels', () => {
    // 600 px tall window over a -1..1 volume: 300 px per unit, so a line is 17/300 = 0.0567.
    getState().addTextObject('a\nb\nc', 0, 0);
    const code = gen();
    expect(code).toContain('glRasterPos2f(0.0f, 0.0000f);');
    expect(code).toContain('glRasterPos2f(0.0f, -0.0567f);');
    expect(code).toContain('glRasterPos2f(0.0f, -0.1134f);');
  });

  it('widens the step when the text, or a group around it, scales it down', () => {
    getState().addTextObject('a\nb', 0, 0);
    getState().updateObjectTransform(text().id, { scaleY: 0.5 });
    expect(gen()).toContain('glRasterPos2f(0.0f, -0.1133f);');
    const tri = addTriangle(0.5, 0.5, 0.1);
    getState().createGroup([text().id, tri.id]);
    const group = getState().objects.find((o) => o.type === 'GROUP')!;
    getState().updateObjectTransform(group.id, { scaleY: 2 });
    // 0.5 × 2: back to one unit per unit, 17/300.
    expect(gen()).toContain('glRasterPos2f(0.0f, -0.0567f);');
  });

  it('keeps every line on its spot when the scale is zero', () => {
    getState().addTextObject('a\nb', 0, 0);
    getState().updateObjectTransform(text().id, { scaleY: 0 });
    expect(gen().match(/glRasterPos2f\(0\.0f, 0\.0000f\);/g)).toHaveLength(2);
  });
});
