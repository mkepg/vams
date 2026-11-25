/**
 * BLACK-BOX TEST SUITE — BB-LAB (the 2D set)
 * The Lab's bundled headers in lab/include are the definition of what a Lab program may call.
 *
 * Test focus:
 *  - Every GL name the VAMS generator can emit is declared
 *  - Every common 2D lab call and Windows extra named by the spec is declared
 *  - Appendix C's symbols, GLUT's shapes and the projection calls are rejected, never allowed
 *  - The rejection message and every replacement text keep to the Language Discipline
 *  - Every name a lab PC's headers declare and the Lab's leave out has advice on what to use
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { generatorNames } from '../helpers/generator-names';
import { FREEGLUT_EXT, LAB_FORMS, refusalAdvice, windowsAdvice } from '@/features/lab-compile/model/refusals';

const INCLUDE = join(process.cwd(), 'lab/include');

function headerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return headerFiles(p);
    return f.endsWith('.h') ? [p] : [];
  });
}

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

interface Headers {
  files: string[];
  /** Function prototypes, by name. */
  functions: Set<string>;
  /** Object-like #define names that carry a value. */
  constants: Set<string>;
  /** typedef names. */
  types: Set<string>;
  /** VAMS_REJECT(name, "replacement") entries, in order. */
  rejected: { name: string; use: string; file: string }[];
  /** The body of the VAMS_REJECT_MESSAGE macro. */
  template: string;
}

function readHeaders(): Headers {
  const files = headerFiles(INCLUDE);
  const h: Headers = { files: files.map((f) => relative(INCLUDE, f).replace(/\\/g, '/')), functions: new Set(), constants: new Set(), types: new Set(), rejected: [], template: '' };
  for (const file of files) {
    const text = stripComments(readFileSync(file, 'utf8'));
    for (const m of text.matchAll(/^\s*VAMS_REJECT\(\s*(\w+)\s*,\s*"([^"]*)"\s*\)/gm)) {
      h.rejected.push({ name: m[1], use: m[2], file: relative(INCLUDE, file) });
    }
    const template = /^\s*#\s*define\s+VAMS_REJECT_MESSAGE\(name,\s*use\)\s+(.+)$/m.exec(text);
    if (template) h.template = template[1].trim();
    const declarations = text.replace(/^\s*VAMS_REJECT\(.*$/gm, '');
    for (const m of declarations.matchAll(/^\s*(?:[A-Z]+API|STBIDEF)\s+[^;(#]*?\b(\w+)\s*\(/gm)) h.functions.add(m[1]);
    for (const m of declarations.matchAll(/^\s*#\s*define\s+(\w+)[ \t]+\S/gm)) h.constants.add(m[1]);
    for (const m of declarations.matchAll(/^\s*typedef\s+[^;(]*?\b(\w+)\s*;/gm)) h.types.add(m[1]);
  }
  return h;
}

/** The message clang shows for a rejected name, built the way VAMS_REJECT_MESSAGE builds it. */
function message(template: string, name: string, use: string): string {
  const parts = template.match(/#name|\buse\b|"(?:[^"\\]|\\.)*"/g) ?? [];
  return parts.map((p) => (p === '#name' ? name : p === 'use' ? use : (JSON.parse(p) as string))).join('');
}

const declared = (h: Headers, name: string) => h.functions.has(name) || h.constants.has(name) || h.types.has(name);

/** The glutSolid* and glutWire* shapes in FreeGLUT's freeglut_std.h (the course setup's copy). */
const FREEGLUT_STD_SHAPES = [
  'glutWireCube', 'glutSolidCube', 'glutWireSphere', 'glutSolidSphere', 'glutWireCone', 'glutSolidCone',
  'glutWireTorus', 'glutSolidTorus', 'glutWireDodecahedron', 'glutSolidDodecahedron', 'glutWireOctahedron',
  'glutSolidOctahedron', 'glutWireTetrahedron', 'glutSolidTetrahedron', 'glutWireIcosahedron',
  'glutSolidIcosahedron', 'glutWireTeapot', 'glutSolidTeapot',
];

/** Appendix C's deferred symbols, read from the product plan's table. */
function appendixC(): { functions: string[]; constants: string[] } {
  const plan = readFileSync(join(process.cwd(), 'docs/product-plan.md'), 'utf8');
  const start = plan.indexOf('### Deferred Symbols');
  const end = plan.indexOf('### Enforcement', start);
  const rows = plan.slice(start, end).split('\n').filter((l) => l.startsWith('| `'));
  const functions: string[] = [];
  const constants: string[] = [];
  for (const row of rows) {
    const cell = row.split('|')[1];
    for (const [, span] of cell.matchAll(/`([^`]+)`/g)) {
      const call = /^\w+\((\w+)\)$/.exec(span);
      if (call) constants.push(call[1]);
      else functions.push(span);
    }
  }
  return { functions: [...new Set(functions)], constants: [...new Set(constants)] };
}

const BANNED = /coming soon|not yet|future|deferred|unsupported|not supported|\b3D\b|lighting/i;

describe('BB-LAB-01: Every name the generator emits is declared in the bundled headers', () => {
  const h = readHeaders();
  const names = generatorNames();

  it('reads the generator source and the headers', () => {
    expect(names.length).toBeGreaterThan(100);
    expect(h.functions.size).toBeGreaterThan(100);
    expect(h.constants.size).toBeGreaterThan(100);
  });

  it('holds exactly the bundled header names', () => {
    expect(h.files.sort()).toEqual([
      'GL/freeglut.h', 'GL/freeglut_ext.h', 'GL/freeglut_std.h', 'GL/gl.h', 'GL/glew.h', 'GL/glext.h', 'GL/glu.h', 'GL/glut.h',
      'bits/stdc++.h', 'conio.h', 'glew.h', 'stb_image.h', 'vams_rejected.h', 'windows.h',
    ]);
  });

  it('declares every generator name', () => {
    expect(names.filter((n) => !declared(h, n))).toEqual([]);
  });
});

describe('BB-LAB-02: Every common 2D lab call and Windows extra is declared', () => {
  const h = readHeaders();
  const COMMON = [
    'gluOrtho2D', 'glRectf', 'glPointSize', 'glLineWidth', 'glLineStipple', 'glPolygonMode', 'glColor4f',
    'glBlendFunc', 'glutTimerFunc', 'glutPostRedisplay', 'glutGet', 'GLUT_ELAPSED_TIME', 'glutSpecialFunc',
    'glutKeyboardUpFunc', 'glutPassiveMotionFunc', 'glutSetWindowTitle', 'glutBitmapCharacter', 'glutBitmapString',
    'glNewList', 'glEndList', 'glCallList', 'glGenLists', 'glutFullScreen', 'glutCreateMenu', 'glutAddMenuEntry',
    'glutAddSubMenu', 'glutAttachMenu', 'GLUT_SINGLE', 'glFlush', 'glewInit', 'GLEW_OK',
    'GLUT_BITMAP_8_BY_13', 'GLUT_BITMAP_9_BY_15', 'GLUT_BITMAP_TIMES_ROMAN_10', 'GLUT_BITMAP_TIMES_ROMAN_24',
    'GLUT_BITMAP_HELVETICA_10', 'GLUT_BITMAP_HELVETICA_12', 'GLUT_BITMAP_HELVETICA_18',
    'Sleep', 'DWORD', 'BOOL', 'getch', 'getche', 'kbhit',
  ];

  it('declares every one', () => {
    expect(COMMON.filter((n) => !declared(h, n))).toEqual([]);
  });
});

describe('BB-LAB-03: Appendix C, GLUT shapes and the projection calls are rejected', () => {
  const h = readHeaders();
  const rejected = new Set(h.rejected.map((r) => r.name));
  const appendix = appendixC();
  const generated = new Set(generatorNames());

  it('reads Appendix C', () => {
    expect(appendix.functions).toContain('gluPerspective');
    expect(appendix.functions).toContain('glMaterialfv');
    expect(appendix.constants).toEqual(['GL_LIGHTING']);
  });

  it('rejects every Appendix C call, every glutSolid* and glutWire*, glFrustum, gluLookAt and gluPerspective', () => {
    // Appendix C lists glShadeModel only "in lighting context"; the generator emits it for FLAT and SMOOTH.
    const calls = appendix.functions.filter((n) => !generated.has(n));
    expect(appendix.functions.filter((n) => generated.has(n))).toEqual(['glShadeModel']);
    const expected = [...calls, ...FREEGLUT_STD_SHAPES, 'glFrustum', 'gluLookAt', 'gluPerspective'];
    expect(expected.filter((n) => !rejected.has(n))).toEqual([]);
  });

  it('declares no rejected name as allowed', () => {
    expect([...rejected].filter((n) => declared(h, n))).toEqual([]);
  });

  it('leaves Appendix C constants undeclared', () => {
    expect(appendix.constants.filter((n) => declared(h, n) || rejected.has(n))).toEqual([]);
  });

  it('lists each rejected name once, in vams_rejected.h', () => {
    expect(h.rejected.length).toBe(rejected.size);
    expect(h.rejected.filter((r) => r.file !== 'vams_rejected.h')).toEqual([]);
  });
});

describe('BB-LAB-04: The rejection message keeps to the Language Discipline', () => {
  const h = readHeaders();

  it('builds the spec message for gluPerspective', () => {
    const r = h.rejected.find((x) => x.name === 'gluPerspective')!;
    expect(message(h.template, r.name, r.use)).toBe("gluPerspective isn't part of VAMS Lab's OpenGL. Use glOrtho or gluOrtho2D.");
  });

  it('uses no banned wording in the template or any replacement', () => {
    expect(BANNED.test(h.template)).toBe(false);
    expect(h.rejected.filter((r) => BANNED.test(r.use) || BANNED.test(message(h.template, r.name, r.use)))).toEqual([]);
  });

  it('names something to use in every replacement', () => {
    expect(h.rejected.filter((r) => !/\bgl\w+/.test(r.use))).toEqual([]);
  });
});

describe('BB-LAB-117: Every name a lab PC declares and the Lab leaves out is refused with what to use', () => {
  const h = readHeaders();
  const reference = readFileSync(join(process.cwd(), 'tests/fixtures/lab/reference-names.txt'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'));
  const rejected = new Set(h.rejected.map((r) => r.name));
  const left = reference.filter((n) => !declared(h, n) && !rejected.has(n));

  it('reads the reference names, and finds the Lab leaves hundreds out', () => {
    expect(reference.length).toBeGreaterThan(1400);
    expect(left.length).toBeGreaterThan(500);
  });

  it('gives each of them advice', () => {
    expect(left.filter((n) => refusalAdvice(n) === null)).toEqual([]);
  });

  it('writes every piece of advice as a sentence in British English, within the Language Discipline', () => {
    const advice = new Set([...left.map((n) => refusalAdvice(n)!), ...['MessageBox', 'GetAsyncKeyState', 'GetTickCount', 'PlaySound', 'GetSystemMetrics', 'SetConsoleTextAttribute', 'ZeroMemory', 'GetCursorPos', 'CreateThread', 'ExitProcess'].map((n) => windowsAdvice(n)!)]);
    for (const a of advice) {
      expect(a, a).toMatch(/^[A-Z].*[.)]$/);
      expect(a, a).not.toMatch(BANNED);
      expect(a, a).not.toMatch(/\bcolor\b|—/i);
    }
  });

  it('names forms the Lab has, for a call in a form it lacks', () => {
    for (const name of Object.values(LAB_FORMS).flat()) expect(declared(h, name), name).toBe(true);
    expect(refusalAdvice('glVertex2iv')).toBe('Use glVertex2i(v[0], v[1]).');
    expect(refusalAdvice('glColor3dv')).toBe('Use glColor3d(v[0], v[1], v[2]).');
    expect(refusalAdvice('glColor3i')).toBe('Use glColor3f.');
    expect(refusalAdvice('glVertex4f')).toBe('Use glVertex3f.');
    expect(refusalAdvice('glTexCoord1f')).toBe('Use glTexCoord2f.');
    expect(refusalAdvice('glRectfv')).toBe('Use glRectf(v1[0], v1[1], v2[0], v2[1]).');
  });

  it('declares the special keys FreeGLUT gives glutSpecialFunc, which the Lab sends', () => {
    for (const key of ['GLUT_KEY_SHIFT_L', 'GLUT_KEY_SHIFT_R', 'GLUT_KEY_CTRL_L', 'GLUT_KEY_CTRL_R', 'GLUT_KEY_ALT_L', 'GLUT_KEY_ALT_R', 'GLUT_KEY_NUM_LOCK', 'GLUT_KEY_BEGIN', 'GLUT_KEY_DELETE']) {
      expect(h.constants.has(key), key).toBe(true);
    }
  });

  it('knows every name freeglut_ext.h declares, to say <GL/freeglut.h> brings it', () => {
    const text = stripComments(readFileSync(join(INCLUDE, 'GL/freeglut_ext.h'), 'utf8'));
    const names = [...text.matchAll(/^\s*#\s*define\s+(GLUT_\w+)[ \t]+\S/gm), ...text.matchAll(/\b(glut[A-Z]\w*)\s*\(/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(15);
    expect(names.filter((n) => !FREEGLUT_EXT.test(n))).toEqual([]);
    expect(['glutInit', 'GLUT_KEY_F1', 'glutSwapBuffers'].filter((n) => FREEGLUT_EXT.test(n))).toEqual([]);
  });
});
