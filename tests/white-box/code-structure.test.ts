/**
 * WHITE-BOX TEST SUITE — WB-CODE
 * Reading the generated program's structure: the outline, the folds, changed values and the explanation catalogue.
 */
import { describe, it, expect } from 'vitest';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { outlineCode, findCallLine, stateFieldAt, type CodeOutline } from '@/features/code-generation/model/code-outline';
import { visibleRows } from '@/features/code-generation/model/code-folds';
import { diffChangedValues } from '@/features/code-generation/model/value-diff';
import { diffChangedLines, matchLines } from '@/features/code-generation/model/code-diff';
import { nextMarks, type MarkSnapshot } from '@/features/code-generation/model/use-value-marks';
import { explainLine, noteFor, type ExplainScene } from '@/features/code-generation/model/code-explanations';
import type { CodeRow } from '@/shared/ui/code-viewer/types';
import type { CallbackRule } from '@/core/types/scene';
import { addTriangle, addQuad, addPrimitive, getState } from '../helpers/store';

const program = () => {
  const s = getState();
  return generateCodeFromState(
    { objects: s.objects, canvasBackgroundColor: s.canvasBackgroundColor, callbacks: s.callbacks, viewportLimits: s.viewportLimits, textures: s.getAllTextures() },
    { width: 800, height: 600 },
  );
};
const rule = (objectId: string, over: Partial<CallbackRule> = {}): CallbackRule => ({
  id: `r-${Math.random()}`, objectId, trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'translate', dx: 0.1, dy: 0 }, ...over,
});

/** One triangle in immediate mode. */
export function immediateFixture() {
  const tri = addTriangle(0.4, -0.17, 0.5);
  getState().updateObjectTransform(tri.id, { rotate: 15 });
  return { tri, code: program() };
}
/** Every structure the generator writes: vertex arrays, an indexed textured quad, a dynamic VBO, text, a group, three handlers. */
export function fullFixture() {
  const tri = addTriangle(0.4, -0.17, 0.5);
  const quad = addQuad(-0.3, 0.3, 0.2);
  getState().updateRenderingMode(quad.id, 'VERTEX_ARRAY');
  getState().updateUseIndexed(quad.id, true);
  getState().attachTexture(quad.id, getState().getAllTextures()[0].id);
  getState().updateRenderingMode(tri.id, 'VBO');
  getState().updateBufferUsage(tri.id, 'DYNAMIC');
  getState().addTextObject('Hi', 0.1, 0.2);
  const text = getState().objects[0];
  getState().setCallbackHandler('keyboard', 'onKey');
  getState().addCallbackRule('keyboard', rule(tri.id));
  getState().setCallbackHandler('mouse', 'onMouse');
  getState().setCallbackHandler('idle', 'onIdle');
  return { tri, quad, text, code: program() };
}
/** Two shapes in a group, a text shown and hidden by a rule, and a reshape that keeps proportions. */
export function groupFixture() {
  const a = addTriangle(-0.4, 0, 0.2);
  const b = addQuad(0.4, 0, 0.2);
  getState().createGroup([a.id, b.id]);
  const group = getState().objects.find((o) => o.type === 'GROUP')!;
  getState().addTextObject('Hi', 0, 0.6);
  const text = getState().objects[0];
  getState().setCallbackHandler('keyboard', 'onKey');
  getState().addCallbackRule('keyboard', rule(text.id, { action: { type: 'visibility', mode: 'toggle' } }));
  getState().setCallbackHandler('mouse', 'onMouse');
  getState().addCallbackRule('mouse', rule(a.id, { trigger: { kind: 'mouse', button: 'left', state: 'down' }, action: { type: 'moveToPointer' } }));
  getState().setCallbackHandler('reshape', 'onReshape');
  return { a, b, group, text, code: program() };
}

const kinds = (o: CodeOutline) => o.blocks.map((b) => b.kind);
const lineOf = (o: CodeOutline, needle: string) => o.lines.findIndex((l) => l.text.includes(needle));
const ownerOf = (o: CodeOutline, needle: string) => o.lines[lineOf(o, needle)].object;

describe('WB-CODE-01: An immediate-mode program reads as its blocks in order', () => {
  it('finds includes, the struct, state, declarations, the draw function, draw, display, init and main', () => {
    const { code } = immediateFixture();
    const o = outlineCode(code);
    expect(kinds(o)).toEqual(['includes', 'struct', 'state', 'declarations', 'draw-object', 'draw', 'display', 'init', 'main']);
    expect(o.blocks.find((b) => b.kind === 'draw-object')!.id).toBe('draw:TRIANGLES_1');
    expect(o.objects).toEqual(['TRIANGLES_1']);
  });
});

describe('WB-CODE-02: Every structure the generator writes has its block', () => {
  it('finds buffer data, both handle lists, update_buffers, each handler, the idle wrapper and init', () => {
    const o = outlineCode(fullFixture().code);
    for (const kind of ['buffer-data', 'vbo-handles', 'texture-handles', 'update-buffers', 'idle', 'init'] as const) {
      expect(kinds(o), kind).toContain(kind);
    }
    expect(o.blocks.filter((b) => b.kind === 'handler').map((b) => b.id)).toEqual(['handler:onKey', 'handler:onMouse', 'handler:onIdle']);
    const { code } = groupFixture();
    const g = outlineCode(code);
    expect(kinds(g)).toContain('view');
    expect(kinds(g)).toContain('window-to-world');
    expect(g.blocks.map((b) => b.id)).toContain('handler:onReshape');
  });
});

describe('WB-CODE-03: The blocks tile the whole program', () => {
  it('gives every line exactly one block, in order, with no gaps', () => {
    for (const { code } of [immediateFixture(), fullFixture(), groupFixture()]) {
      const o = outlineCode(code);
      expect(o.lines).toHaveLength(code.split('\n').length);
      expect(o.blocks[0].start).toBe(0);
      expect(o.blocks[o.blocks.length - 1].end).toBe(o.lines.length - 1);
      for (let k = 1; k < o.blocks.length; k++) expect(o.blocks[k].start).toBe(o.blocks[k - 1].end + 1);
      for (const block of o.blocks) {
        for (let l = block.start; l <= block.end; l++) expect(o.lines[l].block).toBe(block.id);
      }
    }
  });
});

describe('WB-CODE-04: Each line knows the object it belongs to', () => {
  it('owns state, buffers, draw functions, init and update segments, and inline text; leaves boilerplate unowned', () => {
    const o = outlineCode(fullFixture().code);
    expect(ownerOf(o, 'ObjectState state_QUADS_1')).toBe('QUADS_1');
    expect(ownerOf(o, 'GLfloat verts_QUADS_1[]')).toBe('QUADS_1');
    expect(ownerOf(o, 'GLuint vbo_TRIANGLES_1 = 0;')).toBe('TRIANGLES_1');
    expect(ownerOf(o, 'GLuint tex_QUADS_1 = 0;')).toBe('QUADS_1');
    expect(ownerOf(o, 'glDrawElements(GL_QUADS')).toBe('QUADS_1');
    expect(ownerOf(o, '// TRIANGLES_1 — upload to GPU')).toBe('TRIANGLES_1');
    expect(ownerOf(o, 'glGenBuffers(1, &cbo_TRIANGLES_1)')).toBe('TRIANGLES_1');
    expect(ownerOf(o, '// QUADS_1 — texture object')).toBe('QUADS_1');
    expect(ownerOf(o, 'glTexImage2D(')).toBe('QUADS_1');
    expect(ownerOf(o, 'glBufferSubData(')).toBe('TRIANGLES_1');
    expect(ownerOf(o, 'glRasterPos2f(')).toBe('TEXT_1');
    expect(ownerOf(o, 'glutBitmapCharacter(')).toBe('TEXT_1');
    const call = o.lines.findIndex((l) => l.text === '    draw_TRIANGLES_1();');
    expect(o.lines[call].object).toBeNull();
    expect(ownerOf(o, '// --- Texture setup ---')).toBeNull();
    expect(ownerOf(o, 'state_TRIANGLES_1.x += 0.10f;')).toBeNull();
    expect(ownerOf(o, 'glutMainLoop()')).toBeNull();
  });
});

describe('WB-CODE-05: Only lines that do something are explainable', () => {
  it('marks calls, declarations, state, branches and functions; never braces, blanks or comments', () => {
    const o = outlineCode(fullFixture().code);
    const explainable = (needle: string) => o.lines[lineOf(o, needle)].explainable;
    for (const yes of ['#include <GL/glew.h>', 'struct ObjectState {', 'ObjectState state_TEXT_1', 'GLfloat colors_QUADS_1[]',
      'GLuint cbo_TRIANGLES_1 = 0;', 'void draw_QUADS_1();', 'void draw_QUADS_1()', 'glTranslatef(state_QUADS_1.x', "case 'd':",
      'state_TRIANGLES_1.x += 0.10f;', 'stbi_load(', 'if (glewInit() != GLEW_OK) {', 'void onMouse(int button', '    draw();', 'int main(']) {
      expect(explainable(yes), yes).toBe(true);
    }
    for (const no of ['// --- Global State ---', '    // QUADS_1 — texture object', 'return 0;', 'int width, height, channels;']) {
      expect(explainable(no), no).toBe(false);
    }
    expect(o.lines.filter((l) => /^\s*[{}]\s*$/.test(l.text) || l.text.trim() === '').every((l) => !l.explainable)).toBe(true);
  });
});

describe('WB-CODE-06: Groups and hidden text own their inline segments in draw()', () => {
  it('gives the group its frame and its children\'s calls, and the guarded text its if block', () => {
    const o = outlineCode(groupFixture().code);
    const drawBlock = o.blocks.find((b) => b.kind === 'draw')!;
    const inDraw = o.lines.slice(drawBlock.start, drawBlock.end + 1);
    const groupLines = inDraw.filter((l) => l.object === 'Group_1').map((l) => l.text.trim());
    expect(groupLines).toContain('glTranslatef(state_Group_1.x, state_Group_1.y, 0.0f);');
    expect(groupLines).toContain('draw_TRIANGLES_1();');
    expect(groupLines).toContain('draw_QUADS_1();');
    const textLines = inDraw.filter((l) => l.object === 'TEXT_1').map((l) => l.text.trim());
    expect(textLines[0]).toBe('if (state_TEXT_1.visible) {');
    expect(textLines[textLines.length - 1]).toBe('}');
    expect(o.objects).toEqual(expect.arrayContaining(['Group_1', 'TEXT_1', 'TRIANGLES_1', 'QUADS_1']));
  });
});

describe('WB-CODE-07: Fold labels are names; summaries are plain sentences', () => {
  it('labels functions by signature and data blocks by name, and keeps the banned words out', () => {
    const o = outlineCode(fullFixture().code);
    const label = (id: string) => o.blocks.find((b) => b.id === id)!.label;
    expect(label('includes')).toBe('#include …');
    expect(label('struct')).toBe('struct ObjectState …');
    expect(label('main')).toBe('int main()');
    expect(label('draw:QUADS_1')).toBe('void draw_QUADS_1()');
    expect(label('handler:onKey')).toBe('void onKey()');
    expect(o.blocks.find((b) => b.id === 'main')!.summary).toBe('Opens the window, registers the callbacks and starts GLUT.');
    for (const b of o.blocks) {
      expect(b.summary.length, b.id).toBeGreaterThan(0);
      expect(b.summary).not.toMatch(/coming soon|not supported|future|deferred|\b3D\b|lighting/i);
    }
  });
});

describe('WB-CODE-08: The parser pins the generator formats it relies on', () => {
  it('reads CRLF text the same, and puts every marker line in the block that owns it', () => {
    const { code } = fullFixture();
    expect(outlineCode(code.replace(/\n/g, '\r\n')).blocks).toEqual(outlineCode(code).blocks);
    const o = outlineCode(code);
    const blockOf = (l: number) => o.blocks.find((b) => b.id === o.lines[l].block)!.kind;
    o.lines.forEach((l, i) => {
      if (/^void draw_\w+\(\)$/.test(l.text)) expect(blockOf(i)).toBe('draw-object');
      if (/^ObjectState state_/.test(l.text)) expect(blockOf(i)).toBe('state');
      if (/^GL(float|uint) (verts|colors|uvs|indices)_/.test(l.text)) expect(blockOf(i)).toBe('buffer-data');
      if (l.text.startsWith('    glutMainLoop')) expect(blockOf(i)).toBe('main');
      if (l.text.startsWith('    glGenTextures')) expect(blockOf(i)).toBe('init');
    });
  });
});

describe('WB-CODE-09: Sanitised names still own their lines', () => {
  it('matches "My Shape" as My_Shape and "class" as class_obj', () => {
    const shape = addTriangle();
    getState().updateObjectName(shape.id, 'My Shape');
    const other = addQuad(0.5, 0.5, 0.2);
    getState().updateObjectName(other.id, 'class');
    const o = outlineCode(program());
    expect(o.objects).toEqual(expect.arrayContaining(['My_Shape', 'class_obj']));
    expect(o.blocks.map((b) => b.id)).toEqual(expect.arrayContaining(['draw:My_Shape', 'draw:class_obj']));
    expect(ownerOf(o, 'ObjectState state_My_Shape')).toBe('My_Shape');
  });
});

describe('WB-CODE-10: findCallLine and stateFieldAt', () => {
  it('finds a call in the object\'s own code first, then anywhere; names the state field under a column', () => {
    const { code } = immediateFixture();
    const o = outlineCode(code);
    const translate = findCallLine(o, 'TRIANGLES_1', 'glTranslatef')!;
    expect(o.lines[translate].text).toContain('glTranslatef(state_TRIANGLES_1.x');
    expect(o.lines[findCallLine(o, 'TRIANGLES_1', 'glOrtho')!].text).toContain('glOrtho(');
    expect(findCallLine(o, null, 'glNothing')).toBeNull();
    const state = o.lines[lineOf(o, 'ObjectState state_TRIANGLES_1')].text;
    expect(stateFieldAt(state, state.indexOf('0.4000f'))).toBe('state_TRIANGLES_1.x');
    expect(stateFieldAt(state, state.indexOf('15.0000f'))).toBe('state_TRIANGLES_1.rotation');
    expect(stateFieldAt(state, 0)).toBeNull();
    expect(stateFieldAt('    glEnd();', 4)).toBeNull();
  });
});

/** Three shapes, the mock's scene: Triangle selected, Square and Dot folded. */
function threeShapes() {
  const tri = addTriangle(0.4, -0.17, 0.5);
  getState().updateObjectName(tri.id, 'Triangle');
  const square = addQuad(-0.5, 0.5, 0.2);
  getState().updateObjectName(square.id, 'Square');
  const dot = addPrimitive('POINTS', [{ x: 0.6, y: 0.6 }]);
  getState().updateObjectName(dot.id, 'Dot');
  return { tri, square, dot, outline: outlineCode(program()) };
}
const shownText = (o: CodeOutline, rows: CodeRow[]) =>
  rows.filter((r): r is Extract<CodeRow, { kind: 'line' }> => r.kind === 'line').map((r) => o.lines[r.line].text);
const folds = (rows: CodeRow[]) => rows.filter((r) => r.kind !== 'line').map((r) => (r as { label: string }).label);

describe('WB-CODE-11: With a shape selected, its code is open and the rest folds', () => {
  it('opens its state line and draw function, folds the others to names, and summarises the other state lines', () => {
    const { outline } = threeShapes();
    const rows = visibleRows(outline, 'Triangle', [], []);
    const shown = shownText(outline, rows);
    expect(shown).toContain('void draw_Triangle()');
    expect(shown.some((t) => t.startsWith('ObjectState state_Triangle'))).toBe(true);
    expect(shown.some((t) => t.startsWith('ObjectState state_Square'))).toBe(false);
    expect(folds(rows)).toEqual(expect.arrayContaining(['#include …', 'struct ObjectState …', 'void draw_Square()', 'void draw_Dot()', 'void display()', 'void init()', 'int main()', '2 more objects']));
    const fold = rows.find((r) => r.kind === 'fold' && r.label === 'int main()') as Extract<CodeRow, { kind: 'fold' }>;
    expect(fold.summary).toBe('Opens the window, registers the callbacks and starts GLUT.');
    expect(outline.lines[fold.start].text).toBe('int main(int argc, char** argv)');
  });
});

describe('WB-CODE-12: With nothing selected, every object\'s code is open and only the boilerplate folds', () => {
  it('opens all draw functions and state lines; folds includes, struct, declarations, display, init and main', () => {
    const { outline } = threeShapes();
    const rows = visibleRows(outline, null, [], []);
    const shown = shownText(outline, rows);
    for (const name of ['Triangle', 'Square', 'Dot']) expect(shown).toContain(`void draw_${name}()`);
    expect(folds(rows)).toEqual(expect.arrayContaining(['#include …', 'struct ObjectState …', 'Declarations …', 'void display()', 'void init()', 'int main()']));
    expect(folds(rows)).not.toContain('2 more objects');
  });
});

describe('WB-CODE-13: A forced line shows only itself in a folded block; a block opened by hand can be closed', () => {
  it('shows the frame of main() and the forced line behind more rows, and marks the first row of a hand-opened block', () => {
    const { outline } = threeShapes();
    const clear = outline.lines.findIndex((l) => l.text.includes('glClearColor('));
    const forced = visibleRows(outline, 'Triangle', [], [clear]);
    expect(shownText(outline, forced)).toContain(outline.lines[clear].text);
    expect(folds(forced)).not.toContain('int main()');
    expect(shownText(outline, forced)).toContain('int main(int argc, char** argv)');
    const mainBlock = outline.blocks.find((b) => b.id === 'main')!;
    const inMain = (r: CodeRow) => (r.kind === 'line' ? r.line : r.start) >= mainBlock.start && (r.kind === 'line' ? r.line : r.start) <= mainBlock.end;
    const mainRows = forced.filter(inMain);
    expect(mainRows.some((r) => r.kind === 'more')).toBe(true);
    const mainShown = mainRows.filter((r): r is Extract<CodeRow, { kind: 'line' }> => r.kind === 'line').map((r) => r.line);
    expect(mainShown).toContain(clear);
    expect(mainShown.length).toBeLessThan(mainBlock.end - mainBlock.start + 1);
    const opened = visibleRows(outline, 'Triangle', ['draw:Square'], []);
    const first = opened.find((r) => r.kind === 'line' && r.closes) as Extract<CodeRow, { kind: 'line' }>;
    expect(first.closes).toEqual({ block: 'draw:Square', label: 'void draw_Square()' });
    expect(outline.lines[first.line].text).toBe('void draw_Square()');
  });
});

describe('WB-CODE-21: A forced line in an open block shows only itself and folds its neighbours', () => {
  it('shows the Triangle state line and folds the Square and Dot lines into 2 more objects', () => {
    const { outline } = threeShapes();
    const stateLine = outline.lines.findIndex((l) => l.text.startsWith('ObjectState state_Triangle'));
    const rows = visibleRows(outline, 'Triangle', [], [stateLine]);
    const stateBlock = outline.blocks.find((b) => b.start <= stateLine && stateLine <= b.end)!;
    const inBlock = rows.filter((r) => (r.kind === 'line' ? r.line : r.start) >= stateBlock.start && (r.kind === 'line' ? r.line : r.start) <= stateBlock.end);
    const texts = inBlock.filter((r): r is Extract<CodeRow, { kind: 'line' }> => r.kind === 'line').map((r) => outline.lines[r.line].text);
    expect(texts.filter((t) => t.startsWith('ObjectState state_'))).toHaveLength(1);
    expect(texts.some((t) => t.startsWith('ObjectState state_Triangle'))).toBe(true);
    expect(inBlock.filter((r) => r.kind === 'more').map((r) => (r as { label: string }).label)).toEqual(['2 more objects']);
    const covered: number[] = [];
    for (const r of rows) {
      if (r.kind === 'line') covered.push(r.line);
      else for (let l = r.start; l <= r.end; l++) covered.push(l);
    }
    expect(covered).toEqual(outline.lines.map((_, i) => i));
  });
});

describe('WB-CODE-14: init() opens only the selected object\'s setup', () => {
  it('shows the frame and the VBO upload lines, and summarises the rest', () => {
    const { tri, outline: before } = threeShapes();
    void before;
    getState().updateRenderingMode(tri.id, 'VBO');
    const outline = outlineCode(program());
    const rows = visibleRows(outline, 'Triangle', [], []);
    const shown = shownText(outline, rows);
    expect(shown).toContain('void init()');
    expect(shown).toContain('    glGenBuffers(1, &vbo_Triangle);');
    expect(folds(rows)).not.toContain('void init()');
  });
});

describe('WB-CODE-15: Rows cover every line once, in program order', () => {
  it('leaves no line out and repeats none, for every selection', () => {
    const { outline } = threeShapes();
    for (const selection of [null, 'Triangle', 'Square', 'Dot']) {
      const covered: number[] = [];
      for (const r of visibleRows(outline, selection, [], [])) {
        if (r.kind === 'line') covered.push(r.line);
        else for (let l = r.start; l <= r.end; l++) covered.push(l);
      }
      expect(covered).toEqual(outline.lines.map((_, i) => i));
    }
  });
});

const markedText = (code: string, marks: { line: number; start: number; end: number }[]) =>
  marks.map((m) => code.split('\n')[m.line].slice(m.start, m.end));

describe('WB-CODE-16: One changed number marks one token', () => {
  it('marks only the new X on the state line, and a sign change as one token', () => {
    const tri = addTriangle(0.3, -0.17, 0.5);
    const before = program();
    getState().updateObjectTransform(tri.id, { translateX: 0.4 });
    const after = program();
    const marks = diffChangedValues(before, after);
    expect(markedText(after, marks)).toEqual(['0.4000f']);
    expect(after.split('\n')[marks[0].line]).toMatch(/^ObjectState state_TRIANGLES_1/);
    getState().updateObjectTransform(tri.id, { translateX: -0.1 });
    expect(markedText(program(), diffChangedValues(after, program()))).toEqual(['-0.1000f']);
  });
});

describe('WB-CODE-17: Moving a vertex marks its coordinates only', () => {
  it('marks the two numbers of the moved glVertex2f', () => {
    const tri = addTriangle(0, 0, 0.5);
    const before = program();
    const v = getState().objects[0].vertices[0];
    getState().updateVertexPosition(tri.id, v.id, 0.25, -0.75);
    const after = program();
    expect(markedText(after, diffChangedValues(before, after))).toEqual(['0.2500f', '-0.7500f']);
  });
});

describe('WB-CODE-18: A line with no counterpart is marked whole', () => {
  it('marks every line of an added object from its first non-space character', () => {
    addTriangle(0, 0, 0.5);
    const before = program();
    addQuad(0.5, 0.5, 0.2);
    const after = program();
    const marks = diffChangedValues(before, after);
    const lines = after.split('\n');
    for (const m of marks) {
      expect(m.start).toBe(lines[m.line].search(/\S/));
      expect(m.end).toBe(lines[m.line].length);
    }
    expect([...new Set(marks.map((m) => m.line))]).toEqual(diffChangedLines(before, after).filter((l) => lines[l].trim() !== ''));
  });
});

describe('WB-CODE-19: An identical program marks nothing; matchLines keeps diffChangedLines the same', () => {
  it('returns no marks, and the matched pairs leave exactly the changed lines', () => {
    addTriangle();
    const code = program();
    expect(diffChangedValues(code, code)).toEqual([]);
    const a = ['x', 'a', 'b', 'c', 'y'];
    const b = ['x', 'a', 'B', 'c', 'd', 'y'];
    expect(matchLines(a, b)).toEqual([[0, 0], [1, 1], [3, 3], [4, 5]]);
    expect(diffChangedLines(a.join('\n'), b.join('\n'))).toEqual([2, 4]);
  });
});

describe('WB-CODE-20: Only the student\'s own edit is marked', () => {
  it('diffs an edit, and marks nothing for a canvas resize, a lesson starting or a new selection', () => {
    const tri = addTriangle(0.3, -0.17, 0.5);
    const at = (width: number, height: number) => {
      const s = getState();
      return generateCodeFromState(
        { objects: s.objects, canvasBackgroundColor: s.canvasBackgroundColor, callbacks: s.callbacks, viewportLimits: s.viewportLimits, textures: s.getAllTextures() },
        { width, height },
      );
    };
    const before: MarkSnapshot = { code: at(800, 600), width: 800, height: 600, swapKey: 'Author:', selectionKey: null };
    expect(nextMarks(null, before)).toBe('keep');
    expect(nextMarks(before, { ...before })).toBe('keep');
    // A resize changes glutInitWindowSize: a real difference, but not the student's edit.
    const resized: MarkSnapshot = { ...before, code: at(900, 640), width: 900, height: 640 };
    expect(diffChangedValues(before.code, resized.code).length).toBeGreaterThan(0);
    expect(nextMarks(before, resized)).toBe('clear');
    expect(nextMarks(before, { ...before, code: `${before.code}\n`, swapKey: 'Lesson:transforms-demo-1' })).toBe('clear');
    expect(nextMarks(before, { ...before, selectionKey: tri.id })).toBe('clear');
    getState().updateObjectTransform(tri.id, { translateX: 0.4 });
    expect(nextMarks(before, { ...before, code: at(800, 600) })).toBe('diff');
  });
});

const explainScene = (): ExplainScene => {
  const s = getState();
  return { objects: s.objects, viewportLimits: s.viewportLimits, canvasBackgroundColor: s.canvasBackgroundColor, canvas: { width: 800, height: 600 }, textures: s.getAllTextures() };
};

/** Every generator feature at once: all ten modes of drawing data, every callback kind and every action. */
function everythingFixture() {
  fullFixture();
  const line = addPrimitive('LINE_STRIP', [{ x: -0.8, y: -0.8 }, { x: -0.6, y: -0.6 }, { x: -0.4, y: -0.8 }]);
  getState().updateLineWidth(line.id, 3);
  getState().updateLineStipple(line.id, { factor: 2, pattern: 0xF0F0 });
  const dots = addPrimitive('POINTS', [{ x: 0.8, y: -0.8 }]);
  getState().updateObjectColorMode(dots.id, 'BYTE');
  getState().updateObjectShading(dots.id, 'FLAT');
  const stream = addTriangle(-0.6, 0.6, 0.1);
  getState().updateRenderingMode(stream.id, 'VBO');
  getState().updateBufferUsage(stream.id, 'STREAM');
  const mapped = addQuad(0.6, 0.6, 0.1);
  getState().updateRenderingMode(mapped.id, 'VBO');
  getState().updateBufferUsage(mapped.id, 'DYNAMIC');
  getState().updateUpdateMethod(mapped.id, 'MAP_BUFFER');
  getState().updateUseIndexed(mapped.id, true);
  const a = addTriangle(-0.2, -0.5, 0.1);
  const b = addTriangle(0.2, -0.5, 0.1);
  getState().createGroup([a.id, b.id]);
  getState().setCallbackHandler('special', 'onSpecial');
  getState().addCallbackRule('special', rule(line.id, { trigger: { kind: 'special', key: 'left' }, action: { type: 'rotate', degrees: 5 } }));
  getState().addCallbackRule('keyboard', rule(dots.id, { trigger: { kind: 'keyboard', key: 's' }, action: { type: 'scale', sx: 1.1, sy: 1.1 } }));
  getState().addCallbackRule('keyboard', rule(dots.id, { trigger: { kind: 'keyboard', key: 'r' }, action: { type: 'reset' } }));
  getState().addCallbackRule('keyboard', rule(dots.id, { trigger: { kind: 'keyboard', key: 'c' }, action: { type: 'setColor', color: '#ff0000' } }));
  getState().addCallbackRule('keyboard', rule(dots.id, { trigger: { kind: 'keyboard', key: ' ' }, action: { type: 'visibility', mode: 'toggle' } }));
  getState().addCallbackRule('mouse', rule(line.id, { trigger: { kind: 'mouse', button: 'left', state: 'down' }, action: { type: 'moveToPointer' } }));
  getState().setCallbackHandler('motion', 'onMotion');
  getState().addCallbackRule('motion', rule(line.id, { trigger: { kind: 'motion' }, action: { type: 'moveToPointer' } }));
  getState().setCallbackHandler('reshape', 'onReshape');
  const painted = addQuad(0.1, 0.8, 0.1);
  getState().attachTexture(painted.id, getState().getAllTextures()[0].id);
  getState().addCallbackRule('keyboard', rule(painted.id, { trigger: { kind: 'keyboard', key: 'h' }, action: { type: 'visibility', mode: 'hide' } }));
  getState().addCallbackRule('keyboard', rule(painted.id, { trigger: { kind: 'keyboard', key: 'v' }, action: { type: 'visibility', mode: 'show' } }));
  getState().setCallbackHandler('idle', 'onIdle');
  getState().addCallbackRule('idle', rule(painted.id, { trigger: { kind: 'idle' }, action: { type: 'rotate', degrees: 1 } }));
  return program();
}

describe('WB-CODE-22: Every explainable line in every generator format has an explanation', () => {
  it.each(['keep', 'stretch'] as const)('explains each explainable line, with reshape set to %s', (reshape) => {
    everythingFixture();
    getState().setReshapeMode(reshape);
    const outline = outlineCode(program());
    const scene = explainScene();
    outline.lines.forEach((line, i) => {
      if (!line.explainable) return;
      const e = explainLine(i, outline, scene);
      expect(e, `line ${i + 1}: ${line.text}`).not.toBeNull();
      expect(e!.signature.length, line.text).toBeGreaterThan(0);
      expect(e!.text, line.text).toMatch(/^[A-Z].*\.$/);
      expect(`${e!.signature} ${e!.text} ${e!.values.map((v) => v.control).join(' ')}`).not.toMatch(/coming soon|not supported|future|deferred|\b3D\b|lighting/i);
    });
  });
});

describe('WB-CODE-23: Value rows name the state field, its value and its control', () => {
  it('explains glTranslatef and the state line with the student\'s numbers', () => {
    const tri = addTriangle(0.4, -0.17, 0.5);
    getState().updateObjectName(tri.id, 'Triangle');
    getState().updateObjectTransform(tri.id, { translateX: 0.4, translateY: -0.17, rotate: 15 });
    const outline = outlineCode(program());
    const translate = explainLine(lineOf(outline, 'glTranslatef('), outline, explainScene())!;
    expect(translate.signature).toBe('glTranslatef(x, y, z)');
    expect(translate.values).toEqual([
      { arg: 'x', source: 'state_Triangle.x', value: '0.40', control: 'Translate X' },
      { arg: 'y', source: 'state_Triangle.y', value: '−0.17', control: 'Translate Y' },
    ]);
    expect(translate.stage).toBe('transformed');
    expect(translate.control).toEqual({ label: 'Translate X', group: 'transform', objectId: tri.id });
    const state = explainLine(lineOf(outline, 'ObjectState state_Triangle'), outline, explainScene())!;
    expect(state.values.map((v) => `${v.arg}=${v.value}·${v.control}`)).toEqual([
      'x=0.40·Translate X', 'y=−0.17·Translate Y', 'rotation=15°·Rotate', 'scaleX=1·Scale X', 'scaleY=1·Scale Y',
    ]);
    const vertex = explainLine(lineOf(outline, 'glVertex2f('), outline, explainScene())!;
    expect(vertex.values.map((v) => v.control)).toEqual(['Vertex 1 X', 'Vertex 1 Y']);
    expect(vertex.control).toEqual({ label: 'Vertices', group: 'vertices', objectId: tri.id });
    const clear = explainLine(lineOf(outline, 'glClearColor('), outline, explainScene())!;
    expect(clear.control).toEqual({ label: 'Background', group: 'background', objectId: null });
    expect(explainLine(outline.lines.findIndex((l) => l.text === '{'), outline, explainScene())).toBeNull();
  });
});

describe('WB-CODE-24: Notes sit only on the key lines of draw functions', () => {
  it('notes move, turn, the draw call and a bound texture, scale only when it is not 1, 1, and nothing else', () => {
    const tri = addTriangle(0.4, -0.17, 0.5);
    getState().updateObjectName(tri.id, 'Triangle');
    getState().updateObjectTransform(tri.id, { translateX: 0.4, translateY: -0.17, rotate: 15 });
    let outline = outlineCode(program());
    const noted = outline.lines.map((_, i) => noteFor(i, outline, explainScene())).map((n, i) => (n ? `${outline.lines[i].text.trim().split('(')[0]}: ${n.map((p) => (typeof p === 'string' ? p : p.value)).join('')}` : null)).filter(Boolean);
    expect(noted).toEqual([
      'glTranslatef: moves Triangle 0.40 right, 0.17 down',
      'glRotatef: turns Triangle 15° anticlockwise',
      'glBegin: every 3 vertices make a triangle',
    ]);
    const note = noteFor(lineOf(outline, 'glTranslatef('), outline, explainScene())!;
    expect(note[1]).toEqual({ value: '0.40', ref: 'state_Triangle.x' });
    getState().updateObjectTransform(tri.id, { scaleX: 1.5 });
    outline = outlineCode(program());
    expect(noteFor(lineOf(outline, 'glScalef('), outline, explainScene())!.map((p) => (typeof p === 'string' ? p : p.value)).join('')).toBe('stretches Triangle 1.5× across, 1× up');
    expect(noteFor(lineOf(outline, 'glClearColor('), outline, explainScene())).toBeNull();
    for (const n of outline.lines.map((_, i) => noteFor(i, outline, explainScene())).filter(Boolean)) {
      const words = n!.map((p) => (typeof p === 'string' ? p : p.value)).join('').split(/\s+/).length;
      expect(words).toBeLessThanOrEqual(8);
    }
  });
});

describe('WB-CODE-25: Textured and buffered draw calls are noted, and a line width reads differently from its reset', () => {
  it('notes the bound texture and the array draw call, and tells a width of 1 from its reset', () => {
    const quad = addQuad(0, 0, 0.3);
    getState().attachTexture(quad.id, getState().getAllTextures()[0].id);
    const tex = getState().getAllTextures()[0].name;
    const vbo = addTriangle(0.5, 0.5, 0.2);
    getState().updateRenderingMode(vbo.id, 'VBO');
    const stripLine = addPrimitive('LINE_STRIP', [{ x: -0.8, y: -0.8 }, { x: -0.6, y: -0.6 }]);
    getState().updateLineWidth(stripLine.id, 1);
    const outline = outlineCode(program());
    const scene = explainScene();
    const text = (n: ReturnType<typeof noteFor>) => n!.map((p) => (typeof p === 'string' ? p : p.value)).join('');
    expect(text(noteFor(lineOf(outline, 'glBindTexture('), outline, scene))).toBe(`paint with ${tex}`);
    expect(text(noteFor(lineOf(outline, 'glDrawArrays('), outline, scene))).toBe('every 3 vertices make a triangle');
    const set = outline.lines.findIndex((l) => l.text.includes('glLineWidth(1.00f)'));
    const reset = outline.lines.findIndex((l) => l.text.includes('glLineWidth(1.0f)'));
    expect(explainLine(set, outline, scene)!.text).toMatch(/^Sets how thick/);
    expect(explainLine(reset, outline, scene)!.text).toMatch(/^Puts the line width back/);
  });
});

describe('WB-CODE-26: Notes read in plain directions', () => {
  it('names left, down and clockwise for negatives, drops a zero axis, and returns null for no move or turn', () => {
    const tri = addTriangle(0, 0, 0.5);
    getState().updateObjectName(tri.id, 'Triangle');
    const text = (n: ReturnType<typeof noteFor>) => (n ? n.map((p) => (typeof p === 'string' ? p : p.value)).join('') : null);
    const read = (needle: string) => {
      const outline = outlineCode(program());
      return text(noteFor(lineOf(outline, needle), outline, explainScene()));
    };
    expect(read('glTranslatef(')).toBeNull();
    expect(read('glRotatef(')).toBeNull();
    getState().updateObjectTransform(tri.id, { translateX: -0.4, translateY: 0.25, rotate: -30 });
    expect(read('glTranslatef(')).toBe('moves Triangle 0.40 left, 0.25 up');
    expect(read('glRotatef(')).toBe('turns Triangle 30° clockwise');
    getState().updateObjectTransform(tri.id, { translateX: 0, translateY: -0.17 });
    expect(read('glTranslatef(')).toBe('moves Triangle 0.17 down');
    getState().updateObjectTransform(tri.id, { translateX: 0.4, translateY: 0 });
    expect(read('glTranslatef(')).toBe('moves Triangle 0.40 right');
    getState().updateObjectTransform(tri.id, { translateX: 0.003, translateY: 0.25 });
    expect(read('glTranslatef(')).toBe('moves Triangle 0.25 up');
    getState().updateObjectTransform(tri.id, { translateX: 0.003, translateY: -0.004, rotate: 0.001, scaleX: 1.001, scaleY: 1 });
    expect(read('glTranslatef(')).toBeNull();
    expect(read('glRotatef(')).toBeNull();
    expect(read('glScalef(')).toBeNull();
  });
});
