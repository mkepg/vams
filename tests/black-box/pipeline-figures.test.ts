/**
 * BLACK-BOX TEST SUITE — BB-PFIG
 * The Pipeline illustrations' geometry: the student's corners in world space, the primitives they make, and clipping.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useVamsStore } from '@/core/store';
import { showsIllustration } from '@/core/store/illustration';
import { VISUAL_ARTIFACTS } from '@/core/types/lesson';
import { LESSON_REGISTRY } from '@/features/lesson-engine/model/lesson-registry';
import LessonBar from '@/features/lesson-engine/ui/LessonBar';
import CanvasHeader from '@/widgets/canvas/ui/CanvasHeader';
import PipelineDiagram from '@/widgets/canvas/views/PipelineDiagram';
import RasterVectorView from '@/widgets/canvas/views/RasterVectorView';
import { fmt } from '@/shared/lib/format-number';
import type { SceneNode } from '@/core/types/scene';
import { chainOf, clipOutcome, clipPolygon, clipSegment, figureFrame, worldPoint, worldPrimitives } from '@/entities/scene/model/pipeline-geometry';
import { provokingOf } from '@/entities/scene/model/primitive-assembly';
import { pixelGrid, rasterise, type RasterInput } from '@/entities/scene/model/rasterise';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { outlineCode } from '@/features/code-generation/model/code-outline';
import { DEMO_TRIANGLE, demoSubject, pipelineSubject } from '@/widgets/canvas/model/pipeline-subject';
import { STAGES, stageProgramLine, type StageIndex } from '@/widgets/canvas/model/stage-lines';
import { ASSEMBLY, INTRO, stageSentence } from '@/widgets/canvas/model/stage-copy';
import { getState } from '../helpers/store';

const identity = { translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1 };
const quad: SceneNode = { id: 'q', name: 'Quad', type: 'QUADS', visible: true, shading: 'SMOOTH', vertices: [], transform: identity };
const volume = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
const pt = (x: number, y: number) => ({ x, y });
const corners = (n: number) => Array.from({ length: n }, (_, k) => pt(k, k * k));

describe('BB-PFIG-01: Corners go through the transform chain in OpenGL order', () => {
  it('scales, rotates, then moves', () => {
    const node = { ...quad, transform: { translateX: 0.2, translateY: 0, rotate: 90, scaleX: 2, scaleY: 1 } };
    const p = worldPoint({ x: 0.5, y: 0 }, [node]);
    expect(p.x).toBeCloseTo(0.2);
    expect(p.y).toBeCloseTo(1);
  });
  it('applies an enclosing group after the shape', () => {
    const group: SceneNode = { ...quad, id: 'g', name: 'Group', type: 'GROUP', transform: { ...identity, translateX: 0.3 } };
    const child: SceneNode = { ...quad, parentId: 'g', transform: { ...identity, translateX: 0.1 } };
    const chain = chainOf(child, [group, child]);
    expect(chain.map((n) => n.id)).toEqual(['q', 'g']);
    const p = worldPoint({ x: 0, y: 0 }, chain);
    expect(p.x).toBeCloseTo(0.4);
    expect(p.y).toBeCloseTo(0);
  });
});

describe('BB-PFIG-02: Primitives follow the GL type', () => {
  it('makes two triangles from six corners', () => expect(worldPrimitives('TRIANGLES', corners(6)).map((p) => p.length)).toEqual([3, 3]));
  it('fans three triangles around corner 0', () => {
    const prims = worldPrimitives('TRIANGLE_FAN', corners(5));
    expect(prims).toHaveLength(3);
    prims.forEach((p) => expect(p[0]).toEqual(corners(5)[0]));
  });
  it('makes one quad from four corners', () => expect(worldPrimitives('QUADS', corners(4))).toHaveLength(1));
  it('closes a line loop with three segments', () => {
    const prims = worldPrimitives('LINE_LOOP', corners(3));
    expect(prims).toHaveLength(3);
    expect(prims[2]).toEqual([corners(3)[2], corners(3)[0]]);
  });
  it('makes a point of each corner', () => expect(worldPrimitives('POINTS', corners(2)).map((p) => p.length)).toEqual([1, 1]));
  it('names the provoking corner as OpenGL does', () => {
    expect(provokingOf('POLYGON', [0, 1, 2, 3])).toBe(0);
    expect(provokingOf('QUAD_STRIP', [0, 1, 3, 2])).toBe(3);
    expect(provokingOf('TRIANGLES', [3, 4, 5])).toBe(5);
  });
});

describe('BB-PFIG-03: Clipping cuts a polygon at the viewing volume', () => {
  it('cuts the corner past x = 1 and adds two corners on the edge', () => {
    const tri = [pt(0, 0), pt(1.5, 0), pt(0, 0.5)];
    const out = clipPolygon(tri, volume);
    expect(out).toHaveLength(4);
    expect(out.filter((p) => Math.abs(p.x - 1) < 1e-9)).toHaveLength(2);
  });
  it('keeps a polygon wholly inside unchanged', () => {
    const tri = [pt(0, 0), pt(0.5, 0), pt(0, 0.5)];
    expect(clipPolygon(tri, volume)).toEqual(tri);
  });
  it('cuts a segment at the edge, and drops one wholly outside', () => {
    const cut = clipSegment(pt(0, 0), pt(2, 0), volume);
    expect(cut?.[1].x).toBeCloseTo(1);
    expect(clipSegment(pt(2, 0), pt(3, 0), volume)).toBeNull();
  });
});

describe('BB-PFIG-04: Clip outcome for inside, partial, outside and degenerate shapes', () => {
  it('reads inside, partial and outside', () => {
    expect(clipOutcome('TRIANGLES', [pt(0, 0), pt(0.5, 0), pt(0, 0.5)], volume)).toBe('inside');
    expect(clipOutcome('TRIANGLES', [pt(0, 0), pt(1.5, 0), pt(0, 0.5)], volume)).toBe('partial');
    expect(clipOutcome('TRIANGLES', [pt(2, 0), pt(3, 0), pt(2, 0.5)], volume)).toBe('outside');
  });
  it('judges lines and points too', () => {
    expect(clipOutcome('LINES', [pt(0, 0), pt(2, 0)], volume)).toBe('partial');
    expect(clipOutcome('POINTS', [pt(0, 0), pt(2, 0)], volume)).toBe('partial');
    expect(clipOutcome('POINTS', [pt(2, 0)], volume)).toBe('outside');
  });
  it('does not throw for two corners or a collinear triangle', () => {
    expect(() => clipOutcome('TRIANGLES', [pt(0, 0), pt(1, 1)], volume)).not.toThrow();
    expect(() => clipOutcome('TRIANGLES', [pt(0, 0), pt(0.5, 0.5), pt(1, 1)], volume)).not.toThrow();
    expect(() => clipPolygon([pt(0, 0), pt(2, 2), pt(4, 4)], volume)).not.toThrow();
    expect(clipOutcome('TRIANGLES', [pt(0, 0), pt(0.5, 0.5), pt(0.8, 0.8)], volume)).toBe('inside');
  });
});

describe('BB-PFIG-05: The frame is the viewing volume plus 20% each side', () => {
  it('grows each side by a fifth of the width and height', () => {
    const f = figureFrame({ minX: -1, maxX: 1, minY: -2, maxY: 2 });
    expect(f.minX).toBeCloseTo(-1.4);
    expect(f.maxX).toBeCloseTo(1.4);
    expect(f.minY).toBeCloseTo(-2.8);
    expect(f.maxY).toBeCloseTo(2.8);
  });
});

const grid = (n: number) => pixelGrid(volume, n);
const input = (over: Partial<RasterInput>): RasterInput => ({ type: 'TRIANGLES', corners: [], colours: [], uvs: null, shading: 'SMOOTH', ...over });
const RED = '#ff0000';
const GREEN = '#00ff00';
const BLUE = '#0000ff';

describe('BB-PFIG-06: A covered pixel is one whose centre the shape covers', () => {
  it('covers exactly the four middle pixels of a 4 x 4 grid, each with coverage 1', () => {
    const square = [pt(-0.5, -0.5), pt(0.5, -0.5), pt(0.5, 0.5), pt(-0.5, 0.5)];
    const out = rasterise(input({ type: 'QUADS', corners: square, colours: Array(4).fill(RED) }), grid(4), false);
    expect(out.map((f) => `${f.col},${f.row}`).sort()).toEqual(['1,1', '1,2', '2,1', '2,2']);
    out.forEach((f) => expect(f.coverage).toBe(1));
  });
  it('numbers rows from the top and sets uv only when given', () => {
    const tri = [pt(-1, 0.5), pt(-0.5, 0.5), pt(-1, 1)];
    const out = rasterise(input({ corners: tri, colours: Array(3).fill(RED), uvs: [{ u: 0, v: 0 }, { u: 1, v: 0 }, { u: 0, v: 1 }] }), grid(4), false);
    expect(out.some((f) => f.col === 0 && f.row === 0 && f.uv !== null)).toBe(true);
    expect(rasterise(input({ corners: tri, colours: Array(3).fill(RED) }), grid(4), false)[0].uv).toBeNull();
  });
});

describe('BB-PFIG-07: The grid follows the volume shape and stays bounded', () => {
  it('matches the volume shape and bounds the rows', () => {
    expect(pixelGrid({ minX: -1, maxX: 1, minY: -1, maxY: 1 }, 24)).toMatchObject({ cols: 24, rows: 24 });
    expect(pixelGrid({ minX: 0, maxX: 10, minY: 0, maxY: 1 }, 24).rows).toBe(2);
    expect(pixelGrid({ minX: 0, maxX: 0.1, minY: 0, maxY: 10 }, 24).rows).toBe(96);
    expect(pixelGrid({ minX: 0, maxX: 10, minY: 0, maxY: 0.01 }, 8).rows).toBe(1);
  });
  it('covers pixels for a triangle inside a very small volume', () => {
    const tiny = pixelGrid({ minX: 0, maxX: 0.00001, minY: 0, maxY: 0.00001 }, 8);
    const out = rasterise(input({ corners: [pt(0, 0), pt(0.00001, 0), pt(0, 0.00001)], colours: Array(3).fill(RED) }), tiny, false);
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('BB-PFIG-08: Multisampling gives edge pixels partial coverage', () => {
  const tri = [pt(-1, -1), pt(1, -1), pt(-1, 1)];
  const shape = input({ corners: tri, colours: Array(3).fill(RED) });
  it('gives edge pixels a quarter, half or three quarters with multisampling', () => {
    const out = rasterise(shape, grid(8), true);
    out.forEach((f) => expect([0.25, 0.5, 0.75, 1]).toContain(f.coverage));
    expect(out.some((f) => f.coverage < 1)).toBe(true);
  });
  it('gives whole pixels only without it', () => {
    rasterise(shape, grid(8), false).forEach((f) => expect(f.coverage).toBe(1));
  });
  it('gives nothing for a shape outside the grid or with two corners, and does not throw', () => {
    const away = input({ corners: [pt(2, 2), pt(3, 2), pt(2, 3)], colours: Array(3).fill(RED) });
    expect(rasterise(away, grid(8), true)).toEqual([]);
    const two = input({ corners: [pt(0, 0), pt(1, 1)], colours: [RED, RED] });
    expect(() => rasterise(two, grid(8), true)).not.toThrow();
    expect(rasterise(two, grid(8), true)).toEqual([]);
  });
});

describe('BB-PFIG-09: Smooth shading blends corner colours; flat takes the provoking corner', () => {
  const tri = [pt(-1, -1), pt(1, -1), pt(-1, 1)];
  it('is reddest nearest the red corner when smooth', () => {
    const out = rasterise(input({ corners: tri, colours: [RED, GREEN, BLUE] }), grid(12), false);
    const near = out.find((f) => f.col === 0 && f.row === 11)!;
    expect(near.rgb[0]).toBeGreaterThan(near.rgb[1]);
    expect(near.rgb[0]).toBeGreaterThan(near.rgb[2]);
  });
  it('gives every fragment the last corner colour for flat triangles', () => {
    const out = rasterise(input({ corners: tri, colours: [RED, GREEN, BLUE], shading: 'FLAT' }), grid(12), false);
    expect(out.length).toBeGreaterThan(0);
    out.forEach((f) => expect(f.rgb).toEqual([0, 0, 255]));
  });
  it('gives every fragment the first corner colour for a flat polygon', () => {
    const square = [pt(-1, -1), pt(1, -1), pt(1, 1), pt(-1, 1)];
    const out = rasterise(input({ type: 'POLYGON', corners: square, colours: [RED, GREEN, BLUE, GREEN], shading: 'FLAT' }), grid(6), false);
    expect(out.length).toBe(36);
    out.forEach((f) => expect(f.rgb).toEqual([255, 0, 0]));
  });
  const uvs = [{ u: 0, v: 0 }, { u: 1, v: 0 }, { u: 0, v: 1 }];
  it('still interpolates texture coordinates under flat shading', () => {
    const out = rasterise(input({ corners: tri, colours: [RED, GREEN, BLUE], uvs, shading: 'FLAT' }), grid(12), false);
    const a = out.find((f) => f.col === 0 && f.row === 11)!;
    const b = out.find((f) => f.col === 10 && f.row === 11)!;
    expect(a.uv!.u).not.toBeCloseTo(b.uv!.u);
  });
  it('gives a flat line the provoking corner colour', () => {
    const out = rasterise(input({ type: 'LINES', corners: [pt(-1, 0.125), pt(1, 0.125)], colours: [RED, BLUE], shading: 'FLAT' }), grid(8), false);
    expect(out).toHaveLength(8);
    out.forEach((f) => expect(f.rgb).toEqual([0, 0, 255]));
  });
});

describe('BB-PFIG-10: Lines and points rasterise', () => {
  it('covers one row of eight pixels with a horizontal segment', () => {
    const out = rasterise(input({ type: 'LINES', corners: [pt(-1, 0.125), pt(1, 0.125)], colours: [RED, BLUE] }), grid(8), false);
    expect(out).toHaveLength(8);
    expect(new Set(out.map((f) => f.row))).toEqual(new Set([3]));
    expect(out[0].rgb[0]).toBeGreaterThan(out[7].rgb[0]);
  });
  it('covers the one pixel that contains a point', () => {
    const out = rasterise(input({ type: 'POINTS', corners: [pt(0.1, 0.1)], colours: [RED] }), grid(8), true);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ col: 4, row: 3, coverage: 1 });
  });
});

const v = (id: string, x: number, y: number) => ({ id, x, y, color: '#ff0000' });
const shape = (id: string, name: string, over: Partial<SceneNode> = {}): SceneNode => ({
  id, name, type: 'TRIANGLES', visible: true, shading: 'SMOOTH', transform: identity,
  vertices: [v(`${id}a`, -0.5, -0.5), v(`${id}b`, 0.5, -0.5), v(`${id}c`, 0, 0.5)], ...over,
});
const scene = (objects: SceneNode[], selectedObjectId: string | null = null) =>
  ({ objects, selectedObjectId, viewportLimits: volume, canvasBackgroundColor: '#112233' });
const outlineOf = (objects: SceneNode[]) =>
  outlineCode(generateCodeFromState({ objects, canvasBackgroundColor: '#000000', callbacks: getState().callbacks, viewportLimits: volume }, { width: 800, height: 600 }));
const win = { width: 800, height: 600 };

describe('BB-PFIG-11: The subject is the selection, else the first drawable, else the demo', () => {
  const a = shape('a', 'A');
  const b = shape('b', 'B', { type: 'QUADS', vertices: [v('1', 0, 0), v('2', 1, 0), v('3', 1, 1), v('4', 0, 1)] });
  it('picks the selected shape', () => {
    const s = pipelineSubject(scene([a, b], 'b'));
    expect(s.type).toBe('QUADS');
    expect(s.owner).toBe('B');
    expect(s.isDemo).toBe(false);
    expect(s.background).toBe('#112233');
  });
  it('skips a selected text node for the first drawable shape', () => {
    const text = shape('t', 'Label', { type: 'TEXT', vertices: [] });
    expect(pipelineSubject(scene([text, b], 't')).owner).toBe('B');
  });
  it('takes the first drawable child of a selected group', () => {
    const g = shape('g', 'G', { type: 'GROUP', vertices: [] });
    const child = shape('c', 'Child', { parentId: 'g' });
    expect(pipelineSubject(scene([a, g, child], 'g')).owner).toBe('Child');
  });
  it('skips a hidden shape and a shape inside a hidden group', () => {
    const hidden = shape('h', 'Hidden', { visible: false });
    const g = shape('g', 'G', { type: 'GROUP', vertices: [], visible: false });
    const inGroup = shape('c', 'Inner', { parentId: 'g' });
    expect(pipelineSubject(scene([hidden, g, inGroup, b])).owner).toBe('B');
  });
  it('falls back to the demo for an empty scene', () => {
    const s = pipelineSubject(scene([]));
    expect(s.isDemo).toBe(true);
    expect(s.node).toBeNull();
    expect(s.volume).toEqual({ minX: -1, maxX: 1, minY: -1, maxY: 1 });
  });
});

describe('BB-PFIG-12: The demo triangle crosses the right edge', () => {
  it('is partly clipped', () => {
    expect(clipOutcome('TRIANGLES', demoSubject().world, demoSubject().volume)).toBe('partial');
  });
  it('is the specified triangle', () => {
    expect(DEMO_TRIANGLE.vertices.map((c) => c.color)).toEqual(['#ff0000', '#00ff00', '#0000ff']);
    expect(demoSubject().background).toBe('#000000');
  });
});

describe('BB-PFIG-13: Each stage finds its own line in the generated program', () => {
  const tri = shape('t', 'Tri');
  const subject = pipelineSubject(scene([tri], 't'));
  const outline = outlineOf([tri]);
  const starts = ['glVertex2f(', 'glTranslatef(state_Tri', 'glBegin(GL_TRIANGLES)', 'glOrtho(', 'glutInitWindowSize(', 'glColor3f(', 'glutSwapBuffers()'];
  starts.forEach((start, i) => {
    it(`stage ${i} finds ${start}`, () => {
      const found = stageProgramLine(i as StageIndex, outline, subject);
      expect(found).not.toBeNull();
      expect(found!.text.startsWith(start)).toBe(true);
      expect(outline.lines[found!.line].text.trim()).toBe(found!.text);
    });
  });
  it('asks Code to explain owned lines for their owner only', () => {
    expect(stageProgramLine(0, outline, subject)!.request).toEqual({ call: 'glVertex2f', owner: 'Tri' });
    expect(stageProgramLine(3, outline, subject)!.request).toEqual({ call: 'glOrtho' });
  });
});

describe("BB-PFIG-14: Owned stages never borrow another shape's line", () => {
  const imm = shape('i', 'Imm');
  const vbo = shape('v', 'Vbo', { renderingMode: 'VBO' });
  const objects = [imm, vbo];
  const outline = outlineOf(objects);
  it("finds the VBO shape's own glBufferData", () => {
    const found = stageProgramLine(0, outline, pipelineSubject(scene(objects, 'v')))!;
    expect(found.text.startsWith('glBufferData(')).toBe(true);
    expect(outline.lines[found.line].object).toBe('Vbo');
  });
  it('gives the demo no owned lines but finds the shared ones', () => {
    const demo = demoSubject();
    [0, 1, 2, 5].forEach((i) => expect(stageProgramLine(i as StageIndex, outline, demo)).toBeNull());
    [3, 4, 6].forEach((i) => expect(stageProgramLine(i as StageIndex, outline, demo)).not.toBeNull());
  });
});

describe("BB-PFIG-15: Stage sentences use the shape's own numbers", () => {
  it('says the matrix is the identity', () => {
    expect(stageSentence(1, pipelineSubject(scene([shape('a', 'A')], 'a')), win)).toContain('Yours is the identity');
  });
  it("names the shape's own transform", () => {
    const t = { translateX: 0.2, translateY: 0, rotate: 20, scaleX: 1.5, scaleY: 1.5 };
    expect(stageSentence(1, pipelineSubject(scene([shape('a', 'A', { transform: t })], 'a')), win))
      .toContain('scaled 1.5 × 1.5, turned 20° and moved (0.2, 0).');
  });
  it("describes the demo triangle's own pose", () => {
    expect(stageSentence(1, demoSubject(), win)).toContain('scaled 1.5 × 1.5, turned 20° and moved (0.2, 0).');
  });
  it('counts the corners and the window', () => {
    const s = pipelineSubject(scene([shape('a', 'A')], 'a'));
    expect(stageSentence(0, s, win)).toContain('lists 3 corners');
    expect(stageSentence(4, s, win)).toContain('your 800 × 600 window');
  });
  it('chooses the texture, flat and smooth sentences', () => {
    const tex = { textureId: 't', filter: 'NEAREST', wrap: 'REPEAT' } as const;
    expect(stageSentence(5, pipelineSubject(scene([shape('a', 'A', { texture: tex })], 'a')), win)).toContain('reads its colour from the texture');
    expect(stageSentence(5, pipelineSubject(scene([shape('a', 'A', { shading: 'FLAT' })], 'a')), win)).toContain('With flat shading');
    expect(stageSentence(5, pipelineSubject(scene([shape('a', 'A')], 'a')), win)).toContain('blended from the corner colours');
  });
  it('says what clipping did', () => {
    const away = shape('a', 'A', { transform: { ...identity, translateX: 5 } });
    expect(stageSentence(3, pipelineSubject(scene([away], 'a')), win)).toContain('entirely outside');
    expect(stageSentence(3, pipelineSubject(scene([shape('b', 'B')], 'b')), win)).toContain('inside it');
    expect(stageSentence(3, demoSubject(), win)).toContain('cut off, and new corners');
  });
});

/** Calls the old Diagram listed that VAMS never emits. */
const BANNED_CALLS = ['glVertex3f', 'glCullFace', 'glFrontFace', 'glFogf', 'glBlendFunc', 'glDepthFunc', 'glStencilFunc', 'glFlush', 'glPolygonMode'];

describe('BB-PFIG-16: No illustration text names a call VAMS never emits', () => {
  const banned = BANNED_CALLS;
  const words = [/coming soon/i, /not supported/i, /future/i, /deferred/i, /3D/, /lighting/i];
  const texts = [
    ...STAGES.map((s) => `${s.short} ${s.title}`),
    ...Object.values(ASSEMBLY),
    INTRO.title, INTRO.text,
    ...([0, 1, 2, 3, 4, 5, 6] as StageIndex[]).map((i) => stageSentence(i, demoSubject(), win)),
  ];
  it('names no unemitted call', () => {
    texts.forEach((t) => banned.forEach((b) => expect(t).not.toContain(b)));
  });
  it('uses no banned student-facing word', () => {
    texts.forEach((t) => words.forEach((w) => expect(t).not.toMatch(w)));
  });
});

async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}
function mount(vnode: VNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(vnode, host);
  return host;
}
function unmount(host: HTMLElement) {
  render(null, host);
  host.remove();
}

describe('switch in the canvas header', () => {
  afterEach(() => {
    useVamsStore.getState().clearLessonState();
    useVamsStore.setState({ appMode: 'Author', activeSection: 'Primitives', pipelineMode: 'Playground', quizPipelineStage: null });
  });

  describe('BB-PFIG-17: The switch shows in the canvas header only in the Pipeline section', () => {
    const switchIn = (host: HTMLElement) => host.querySelector('.canvas-header [data-panel-id="pipeline-mode-controls"] [role="radiogroup"]');
    it('is present in Author and Lesson mode in Pipeline and absent elsewhere', async () => {
      useVamsStore.setState({ appMode: 'Author', activeSection: 'Pipeline' });
      const host = mount(h(CanvasHeader, {}));
      await settle();
      expect(switchIn(host)).not.toBeNull();
      useVamsStore.setState({ appMode: 'Lesson' });
      await settle();
      expect(switchIn(host)).not.toBeNull();
      useVamsStore.setState({ appMode: 'Author', activeSection: 'Primitives' });
      await settle();
      expect(switchIn(host)).toBeNull();
      unmount(host);
    });
    it('is marked when a lesson step focuses it, and the lesson bar no longer holds it', async () => {
      useVamsStore.setState({ activeSection: 'Pipeline', lessonFocusPanel: 'pipeline-mode-controls' });
      const host = mount(h(CanvasHeader, {}));
      await settle();
      expect(host.querySelector('[data-panel-id="pipeline-mode-controls"]')!.classList.contains('is-lesson-focus')).toBe(true);
      unmount(host);
      const demo = Object.values(LESSON_REGISTRY).find((l) => l.section === 'Pipeline' && l.type === 'demo')!;
      useVamsStore.getState().setActiveLesson(demo.id);
      useVamsStore.getState().setAppMode('Lesson');
      const bar = mount(h(LessonBar, {}));
      await settle();
      expect(bar.querySelector('.lesson-bar__modes')).toBeNull();
      expect(bar.querySelector('[data-panel-id="pipeline-mode-controls"]')).toBeNull();
      unmount(bar);
    });
  });

  describe('BB-PFIG-18: A quiz step hides the switch and shows its stage', () => {
    it('hides the switch and keeps the illustration up even in Playground', async () => {
      useVamsStore.setState({ activeSection: 'Pipeline', pipelineMode: 'Playground' });
      const host = mount(h(CanvasHeader, {}));
      await settle();
      expect(host.querySelector('[data-panel-id="pipeline-mode-controls"]')).not.toBeNull();
      useVamsStore.getState().setQuizPipelineStage(3);
      await settle();
      expect(host.querySelector('[data-panel-id="pipeline-mode-controls"]')).toBeNull();
      expect(showsIllustration(useVamsStore.getState())).toBe(true);
      unmount(host);
    });
  });

  describe('BB-PFIG-19: The runner sets the quiz stage per step and clears it', () => {
    it('follows the step: set on a picture, null on a step without one, null after the lesson', async () => {
      const lesson = LESSON_REGISTRY['pipeline-exercise-2'];
      useVamsStore.setState({ activeSection: 'Pipeline' });
      useVamsStore.getState().setActiveLesson(lesson.id);
      useVamsStore.getState().setAppMode('Lesson');
      const host = mount(h('div', {}, h(CanvasHeader, {}), h(LessonBar, {})));
      await settle();
      const switchShown = () => host.querySelector('.canvas-header [data-panel-id="pipeline-mode-controls"]') !== null;
      expect(useVamsStore.getState().quizPipelineStage).toBeNull();
      expect(switchShown()).toBe(true);
      const next = () => [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Next') as HTMLButtonElement;
      next().click();
      await settle();
      // The runner shuffles steps 2 to 8; read the step it landed on.
      const narration = host.querySelector('.lesson-bar__narration')!.textContent;
      const ex = lesson.steps.find((st) => st.narration === narration)?.exercise;
      const artifact = ex?.kind === 'multiple-choice' ? ex.visualArtifact : undefined;
      expect(artifact).toBeDefined();
      expect(useVamsStore.getState().quizPipelineStage).toBe(VISUAL_ARTIFACTS.indexOf(artifact!));
      expect(switchShown()).toBe(false);
      [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Back')!.click();
      await settle();
      expect(useVamsStore.getState().quizPipelineStage).toBeNull();
      expect(switchShown()).toBe(true);
      useVamsStore.getState().setQuizPipelineStage(2);
      useVamsStore.getState().clearLessonState();
      expect(useVamsStore.getState().quizPipelineStage).toBeNull();
      unmount(host);
    });
  });
});

describe('the Diagram', () => {
  afterEach(() => {
    useVamsStore.setState({ activeSection: 'Primitives', pipelineMode: 'Playground', activePipelineStage: null });
  });
  const open = async (stage: number | null, objects: SceneNode[] = []) => {
    useVamsStore.setState({ activeSection: 'Pipeline', pipelineMode: 'Diagram', activePipelineStage: stage, objects });
    const host = mount(h(PipelineDiagram, {}));
    await settle();
    return host;
  };
  const stripOf = (host: HTMLElement) => [...host.querySelectorAll<HTMLButtonElement>('.pipeline-strip button')];
  const press = (el: Element, key: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  const buttonText = (host: HTMLElement, text: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(text));

  describe('BB-PFIG-20: The strip has seven stages and the arrows move between them', () => {
    it('has seven pressable stages, each with a drawing, its number and short name', async () => {
      const host = await open(null);
      const strip = stripOf(host);
      expect(strip).toHaveLength(7);
      strip.forEach((b, i) => {
        expect(b.querySelector('svg')).not.toBeNull();
        expect(b.textContent).toContain(String(i + 1));
        expect(b.textContent).toContain(STAGES[i].short);
        expect(b.getAttribute('aria-pressed')).toBe('false');
      });
      unmount(host);
    });
    it('picks stage 0 on the right arrow from none, then moves on, and keeps a clicked stage', async () => {
      const host = await open(null);
      press(stripOf(host)[3], 'ArrowRight');
      await settle();
      expect(useVamsStore.getState().activePipelineStage).toBe(0);
      press(stripOf(host)[0], 'ArrowRight');
      await settle();
      expect(useVamsStore.getState().activePipelineStage).toBe(1);
      expect(stripOf(host)[1].getAttribute('aria-pressed')).toBe('true');
      stripOf(host)[1].click();
      await settle();
      expect(useVamsStore.getState().activePipelineStage).toBe(1);
      press(stripOf(host)[1], 'ArrowLeft');
      await settle();
      expect(useVamsStore.getState().activePipelineStage).toBe(0);
      press(stripOf(host)[0], 'ArrowLeft');
      await settle();
      expect(useVamsStore.getState().activePipelineStage).toBe(0);
      stripOf(host)[5].click();
      await settle();
      expect(useVamsStore.getState().activePipelineStage).toBe(5);
      unmount(host);
    });
  });

  describe('BB-PFIG-21: With no stage chosen the focus shows the introduction', () => {
    it('shows the introduction and no program line', async () => {
      const host = await open(null, [shape('t', 'Tri')]);
      const text = host.textContent ?? '';
      expect(text).toContain(INTRO.title);
      expect(text).toContain('Pick one to see what it does');
      expect(text).not.toContain('In your program');
      expect(text).not.toContain('See it in Math');
      expect(host.querySelector('.pipeline-focus svg')).not.toBeNull();
      unmount(host);
    });
  });

  describe('BB-PFIG-22: The program line and the Math link act on the subject', () => {
    it('explains the line for its owner, and opens Math on the stage with the shape selected', async () => {
      const tri = shape('t', 'Tri');
      const host = await open(1, [tri]);
      const text = host.textContent ?? '';
      expect(text).toContain('Stage 2 of 7');
      expect(text).toContain(STAGES[1].title);
      expect(text).toContain('In your program');
      buttonText(host, 'glTranslatef(')!.click();
      await settle();
      expect(useVamsStore.getState().explainRequest).toEqual({ call: 'glTranslatef', owner: 'Tri' });
      buttonText(host, 'See it in Math')!.click();
      await settle();
      const s = useVamsStore.getState();
      expect(s.selectedObjectId).toBe('t');
      expect(s.journeyStageOverride).toBe('transformed');
      expect(s.codePane).toBe('math');
      unmount(host);
    });
    it('leaves out the line and its label when the demo has none', async () => {
      const host = await open(0);
      expect(host.textContent).not.toContain('In your program');
      expect(host.textContent).toContain('See it in Math: Stored');
      unmount(host);
    });
  });

  describe('BB-PFIG-23: The Diagram renders without key GL call lists', () => {
    it('shows no call list, no IN or OUT tags and no unemitted call at any stage', async () => {
      for (const objects of [[], [shape('t', 'Tri')]]) {
        for (const stage of [null, 0, 1, 2, 3, 4, 5, 6]) {
          const host = await open(stage, objects);
          const text = host.textContent ?? '';
          expect(text).not.toContain('Key GL calls');
          [...host.querySelectorAll('*')].forEach((el) => expect(['IN', 'OUT']).not.toContain(el.textContent?.trim()));
          BANNED_CALLS.forEach((b) => expect(text).not.toContain(b));
          unmount(host);
        }
      }
    });
  });
});

describe('Raster vs vector', () => {
  afterEach(() => {
    useVamsStore.setState({ activeSection: 'Primitives', pipelineMode: 'Playground', objects: [] });
  });
  const open = async () => {
    useVamsStore.setState({ activeSection: 'Pipeline', pipelineMode: 'RasterVector', objects: [] });
    const host = mount(h(RasterVectorView, {}));
    await settle();
    return host;
  };
  const rasterText = (host: HTMLElement) => host.querySelector('.rv-pane--raster .rv-copy')?.textContent ?? '';
  const pickAcross = async (host: HTMLElement, label: string) => {
    const radio = [...host.querySelectorAll<HTMLButtonElement>('[role="radiogroup"][aria-label="Pixels across"] [role="radio"]')].find(
      (b) => b.textContent === label,
    );
    radio!.click();
    await settle();
  };
  const multisample = (host: HTMLElement) => host.querySelector<HTMLButtonElement>('[role="switch"]')!;

  describe('BB-PFIG-24: Raster vs vector draws the subject on both sides', () => {
    it('lists the demo corners on the left and the pixel grid size on the right', async () => {
      const host = await open();
      const labels = [...host.querySelectorAll('.rv-pane--vector .rv-corner')].map((e) => e.textContent);
      expect(labels).toEqual(demoSubject().world.map((p) => `(${fmt(p.x)}, ${fmt(p.y)})`));
      expect(labels).toHaveLength(3);
      expect(host.querySelector('.rv-pane--vector')?.textContent).toContain(
        'Corners and straight edges. Zoom in as far as you like: the edge stays exact.',
      );
      expect(host.querySelector('.rv-pane--vector h3')?.textContent).toBe('Vectorthe code');
      expect(host.querySelector('.rv-pane--raster h3')?.textContent).toBe('Rasterthe screen');
      expect(rasterText(host)).toContain('The same shape as 24 × 24 pixels.');
      expect(rasterText(host)).toContain('Multisampling tests 4 points per pixel, so edge pixels are partly filled.');
      expect(host.querySelectorAll('.rv-frag').length).toBeGreaterThan(0);
      const control = host.querySelector('[role="radiogroup"][aria-label="Pixels across"]')!;
      expect([...control.querySelectorAll('[role="radio"]')].map((b) => b.textContent)).toEqual(['8', '16', '24', '48']);
      expect(control.querySelector('[aria-checked="true"]')?.textContent).toBe('24');
      expect(multisample(host).getAttribute('aria-checked')).toBe('true');
      expect(multisample(host).textContent).toBe('GLUT_MULTISAMPLE');
      expect(multisample(host).closest('[title]')?.getAttribute('title')).toBe('Your program turns this on in glutInitDisplayMode');
      unmount(host);
    });
  });

  describe('BB-PFIG-25: Pixels across and multisampling redraw only the raster side', () => {
    it('changes the grid and the fragments, leaving the vector side and the scene alone', async () => {
      const host = await open();
      const before = structuredClone(useVamsStore.getState().objects);
      const vectorBefore = host.querySelector('.rv-pane--vector')!.innerHTML;
      await pickAcross(host, '8');
      expect(rasterText(host)).toContain('The same shape as 8 × 8 pixels.');
      multisample(host).click();
      await settle();
      expect(multisample(host).getAttribute('aria-checked')).toBe('false');
      expect(rasterText(host)).toContain('Each pixel is either in or out, so the edges step.');
      expect(rasterText(host).endsWith('so the edges step.')).toBe(true);
      const frags = [...host.querySelectorAll('.rv-frag')];
      expect(frags.length).toBeGreaterThan(0);
      frags.forEach((f) => expect(f.getAttribute('opacity')).toBe('1'));
      expect(host.querySelector('.rv-pane--vector')!.innerHTML).toBe(vectorBefore);
      expect(useVamsStore.getState().objects).toEqual(before);
      unmount(host);
    });
  });

  describe('BB-PFIG-26: The view settings are not saved with the scene', () => {
    it('leaves the persisted state unchanged by either control', async () => {
      const host = await open();
      const partialize = useVamsStore.persist.getOptions().partialize!;
      const before = JSON.stringify(partialize(useVamsStore.getState()));
      await pickAcross(host, '48');
      multisample(host).click();
      await settle();
      const saved = partialize(useVamsStore.getState()) as Record<string, unknown>;
      expect(JSON.stringify(saved)).toBe(before);
      Object.keys(saved).forEach((k) => expect(k).not.toMatch(/across|multisample|raster|pixel/i));
      unmount(host);
    });
  });
});
