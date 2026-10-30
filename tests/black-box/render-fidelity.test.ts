/**
 * BLACK-BOX TEST SUITE — BB-FID
 * The canvas draws points, lines and flat shading the way the exported program does: widths and
 * sizes in window pixels whatever the object's transform, and one colour per FLAT primitive.
 */
import { describe, expect, it } from 'vitest';
import { Container, Graphics, Matrix, type Mesh } from 'pixi.js';
import type { SceneNode } from '@/core/types/scene';
import { createDrawable } from '@/shared/engine/pixi/primitives';
import { createMesh } from '@/shared/engine/pixi/primitives/rendering/meshRenderer';
import { WindowGeometryMesh } from '@/shared/engine/pixi/primitives/rendering/windowGeometry';
import { POINT_SIZE } from '@/shared/lib/gl-geometry';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { useVamsStore } from '@/core/store';
import { clearContent } from '@/shared/engine/pixi/hooks/useSceneRenderer';

const node = (type: SceneNode['type'], vertices: [number, number, string][], extra: Partial<SceneNode> = {}): SceneNode => ({
  id: 'n', name: 'N', type, visible: true, shading: 'SMOOTH', parentId: null, children: [],
  transform: { translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1 },
  vertices: vertices.map(([x, y, color], i) => ({ id: `v${i}`, x, y, color })),
  lineStipple: null,
  ...extra,
});

/** A 536 × 536 window over glOrtho(-1, 1, -1, 1), as the editor's world container sets it. */
function inWindow(o: SceneNode) {
  const world = new Container();
  world.scale.set(268, -268);
  world.position.set(268, 268);
  const container = createDrawable(o, 268, {});
  world.addChild(container);
  const mesh = container.children.find((c) => c instanceof WindowGeometryMesh) as WindowGeometryMesh;
  return { world, container, mesh };
}

/** The mesh's triangles in window pixels. */
function windowPositions(mesh: Mesh): number[] {
  const m = mesh.parent!.getGlobalTransform(new Matrix(), false);
  const local = mesh.geometry.positions;
  const out: number[] = [];
  for (let i = 0; i < local.length; i += 2) {
    const p = m.apply({ x: local[i], y: local[i + 1] });
    out.push(p.x, p.y);
  }
  return out;
}

function area(positions: number[]): number {
  let sum = 0;
  for (let i = 0; i < positions.length; i += 6) {
    const [ax, ay, bx, by, cx, cy] = positions.slice(i, i + 6);
    sum += Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
  }
  return sum;
}

describe('BB-FID-01: Points and lines are built in window pixels, never as strokes', () => {
  it.each([
    ['POINTS', null],
    ['LINES', null],
    ['LINE_STRIP', { factor: 2, pattern: 0xaaaa }],
    ['LINE_LOOP', null],
  ] as const)('%s', (type, stipple) => {
    const { container } = inWindow(node(type, [[0, 0, '#ff0000'], [0.5, 0, '#00ff00'], [0.5, 0.5, '#0000ff']], { lineStipple: stipple }));
    expect(container.children.some((c) => c instanceof WindowGeometryMesh)).toBe(true);
    expect(container.children.some((c) => c instanceof Graphics)).toBe(false);
  });
});

describe('BB-FID-02: A line keeps its glLineWidth in window pixels under any object transform', () => {
  it('is 3 px wide after scaling 2.5 × 0.6 and turning 20°', () => {
    const o = node('LINES', [[-0.2, 0, '#ffffff'], [0.2, 0, '#ffffff']], {
      lineWidth: 3,
      transform: { translateX: 0.1, translateY: 0.2, rotate: 20, scaleX: 2.5, scaleY: 0.6 },
    });
    const { mesh } = inWindow(o);
    expect(mesh.place()).toBe(true);
    // The segment is 0.4 units long, scaled by 2.5 along x: 1 unit, which is 268 window pixels.
    expect(area(windowPositions(mesh))).toBeCloseTo(268 * 3, 3);
  });

  it('draws two colours across its full width too', () => {
    const { mesh } = inWindow(node('LINES', [[-0.5, 0, '#ff0000'], [0.5, 0, '#00ff00']], { lineWidth: 3 }));
    mesh.place();
    expect(area(windowPositions(mesh))).toBeCloseTo(268 * 3, 3);
  });
});

describe('BB-FID-03: A point is POINT_SIZE window pixels square under any object transform', () => {
  it('stays square after scaling 3 × 0.4', () => {
    const o = node('POINTS', [[0, 0, '#ff0000']], { transform: { translateX: 0, translateY: 0, rotate: 0, scaleX: 3, scaleY: 0.4 } });
    const { mesh } = inWindow(o);
    mesh.place();
    const p = windowPositions(mesh);
    const xs = p.filter((_, i) => i % 2 === 0);
    const ys = p.filter((_, i) => i % 2 === 1);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(POINT_SIZE, 6);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(POINT_SIZE, 6);
  });

  it('matches the size the generated program sets', () => {
    const code = generateCodeFromState(
      {
        objects: [node('POINTS', [[0, 0, '#ffffff']])],
        canvasBackgroundColor: '#000000',
        callbacks: useVamsStore.getState().callbacks,
        viewportLimits: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
        textures: [],
      },
      { width: 500, height: 500 },
    );
    expect(code).toContain(`glPointSize(${POINT_SIZE}.0f)`);
  });
});

describe('BB-FID-06: Every rendering mode sets the point size, line width and stipple it draws with', () => {
  const generate = (o: SceneNode) =>
    generateCodeFromState(
      {
        objects: [o],
        canvasBackgroundColor: '#000000',
        callbacks: useVamsStore.getState().callbacks,
        viewportLimits: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
        textures: [],
      },
      { width: 500, height: 500 },
    );

  it.each(['IMMEDIATE', 'VERTEX_ARRAY', 'VBO'] as const)('%s', (renderingMode) => {
    const points = generate(node('POINTS', [[0, 0, '#ffffff'], [0.5, 0, '#ffffff']], { renderingMode }));
    expect(points).toContain(`glPointSize(${POINT_SIZE}.0f)`);
    expect(points).toContain('glPointSize(1.0f); // Reset');
    const line = generate(node('LINE_STRIP', [[0, 0, '#ffffff'], [0.5, 0, '#ffffff']], { renderingMode, lineWidth: 3, lineStipple: { factor: 2, pattern: 0xaaaa } }));
    expect(line).toContain('glLineWidth(3.00f);');
    expect(line).toContain('glLineStipple(2, 0xAAAA);');
    expect(line).toContain('glDisable(GL_LINE_STIPPLE);');
  });
});

describe('BB-FID-07: Texturing is on only while a textured shape draws', () => {
  const plain = node('QUADS', [[-1, -1, '#336699'], [1, -1, '#336699'], [1, 1, '#336699'], [-1, 1, '#336699']]);
  const textured = (renderingMode: SceneNode['renderingMode']) => ({
    ...node('QUADS', [[-0.2, -0.2, '#ffffff'], [0.2, -0.2, '#ffffff'], [0.2, 0.2, '#ffffff'], [-0.2, 0.2, '#ffffff']]),
    id: 'sign', name: 'Sign', renderingMode,
    texture: { textureId: 'tex', filter: 'NEAREST' as const, wrap: 'REPEAT' as const },
    uvs: [{ u: 0, v: 0 }, { u: 1, v: 0 }, { u: 1, v: 1 }, { u: 0, v: 1 }],
  });
  const body = (code: string, fn: string) => {
    const start = code.indexOf(`void ${fn}()\n{`);
    return code.slice(start, code.indexOf('\n}\n', start));
  };

  it.each(['IMMEDIATE', 'VERTEX_ARRAY', 'VBO'] as const)('%s', (renderingMode) => {
    const code = generateCodeFromState(
      {
        // The plain sky is drawn first, as a background is.
        objects: [textured(renderingMode), { ...plain, id: 'sky', name: 'Sky' }],
        canvasBackgroundColor: '#000000',
        callbacks: useVamsStore.getState().callbacks,
        viewportLimits: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
        textures: [{ id: 'tex', name: 'sign', dataUrl: 'data:image/png;base64,', width: 1, height: 1 }],
      },
      { width: 500, height: 500 },
    );
    expect(body(code, 'init')).not.toContain('glEnable(GL_TEXTURE_2D)');
    expect(body(code, 'draw_Sky')).not.toContain('GL_TEXTURE_2D');
    const sign = body(code, 'draw_Sign');
    const enable = sign.indexOf('glEnable(GL_TEXTURE_2D)');
    const draw = Math.max(sign.indexOf('glBegin('), sign.indexOf('glDrawArrays('), sign.indexOf('glDrawElements('));
    const disable = sign.indexOf('glDisable(GL_TEXTURE_2D)');
    expect(enable).toBeGreaterThan(-1);
    expect(enable).toBeLessThan(draw);
    expect(disable).toBeGreaterThan(draw);
  });
});

describe('BB-FID-08: Buffer setup leaves no buffer bound for the client-side arrays drawn after it', () => {
  it('unbinds after init() and after update_buffers()', () => {
    const quad: [number, number, string][] = [[-0.5, -0.5, '#ffffff'], [0.5, -0.5, '#ffffff'], [0.5, 0.5, '#ffffff'], [-0.5, 0.5, '#ffffff']];
    const code = generateCodeFromState(
      {
        objects: [
          { ...node('QUADS', quad, { renderingMode: 'VBO', bufferUsage: 'DYNAMIC' }), id: 'gpu', name: 'Gpu' },
          { ...node('TRIANGLE_STRIP', [...quad, [0, 0.8, '#ffffff']], { renderingMode: 'VBO', useIndexed: true }), id: 'ix', name: 'Ix' },
          { ...node('QUADS', quad, { renderingMode: 'VERTEX_ARRAY' }), id: 'client', name: 'Client' },
        ],
        canvasBackgroundColor: '#000000',
        callbacks: useVamsStore.getState().callbacks,
        viewportLimits: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
        textures: [],
      },
      { width: 500, height: 500 },
    );
    for (const fn of ['init', 'update_buffers']) {
      const start = code.indexOf(`void ${fn}()\n{`);
      const body = code.slice(start, code.indexOf('\n}\n', start));
      const binds = [...body.matchAll(/glBindBuffer\((GL_\w+), (\w+)\)/g)];
      const last = (target: string) => binds.filter((b) => b[1] === target).at(-1)?.[2];
      expect(last('GL_ARRAY_BUFFER'), fn).toBe('0');
      if (binds.some((b) => b[1] === 'GL_ELEMENT_ARRAY_BUFFER')) expect(last('GL_ELEMENT_ARRAY_BUFFER'), fn).toBe('0');
    }
  });
});

describe('BB-FID-04: A FLAT shape carries one colour per primitive', () => {
  it('fills a five-colour FLAT polygon with its first vertex\'s colour', () => {
    const o = node('POLYGON', [[0, 0.7, '#ff0000'], [-0.7, 0.2, '#00ff00'], [-0.4, -0.6, '#0000ff'], [0.4, -0.6, '#ffffff'], [0.7, 0.2, '#ff00ff']], { shading: 'FLAT' });
    const colours = createMesh(o)!.mesh.geometry.getBuffer('aColor').data as Float32Array;
    for (let i = 0; i < colours.length; i += 4) expect([...colours.slice(i, i + 4)]).toEqual([1, 0, 0, 1]);
  });

  it('still blends a SMOOTH one', () => {
    const o = node('TRIANGLES', [[0, 0, '#ff0000'], [1, 0, '#00ff00'], [0, 1, '#0000ff']]);
    const colours = createMesh(o)!.mesh.geometry.getBuffer('aColor').data as Float32Array;
    expect([...colours]).toEqual([1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1]);
  });
});

describe('BB-FID-05: Points and lines are built again only when they move in the window', () => {
  it('rebuilds after a move and not before', () => {
    const { container, mesh, world } = inWindow(node('LINE_STRIP', [[0, 0, '#ffffff'], [0.5, 0.5, '#ffffff']]));
    expect(mesh.place()).toBe(true);
    expect(mesh.place()).toBe(false);
    container.position.set(0.2, 0);
    expect(mesh.place()).toBe(true);
    world.scale.set(300, -300);
    expect(mesh.place()).toBe(true);
    expect(mesh.place()).toBe(false);
  });

  it('keeps drawing a point set scaled to 0 at its origin', () => {
    const o = node('POINTS', [[0.3, 0.3, '#ffffff']], { transform: { translateX: 0, translateY: 0, rotate: 0, scaleX: 0, scaleY: 0 } });
    const { mesh } = inWindow(o);
    mesh.place();
    expect(mesh.visible).toBe(true);
    const p = windowPositions(mesh);
    expect(Math.min(...p.filter((_, i) => i % 2 === 0))).toBeCloseTo(268 - POINT_SIZE / 2, 3);
  });
});

describe("BB-FID-09: A group's outline takes in its text child's glyphs", () => {
  it('reaches as far right as two 9 px glyphs and up to the ascent', () => {
    const group = node('GROUP', [], { id: 'g', name: 'G', vertices: [] });
    const text = node('TEXT', [[0, 0, '#ffffff']], { id: 't', name: 'T', parentId: 'g', textContent: 'Hi' });
    const container = createDrawable(group, 268, { groupChildren: [text], isSelected: true });
    const area = container.hitArea as { x: number; y: number; width: number; height: number };
    const pad = 4 / 268;
    expect(area.x + area.width - pad).toBeCloseTo(18 / 268, 5);
    expect(area.y + area.height - pad).toBeCloseTo(12 / 268, 5);
    expect(area.y + pad).toBeCloseTo(-4 / 268, 5);
  });
});

describe('BB-FID-10: Rebuilding an object frees what it drew and keeps its children', () => {
  it("destroys the old content, and leaves a child object's container whole", () => {
    const group = new Container();
    const outline = new Graphics().rect(0, 0, 1, 1).stroke({ width: 1, color: 0xffffff });
    const child = new Container();
    child.addChild(new Graphics().rect(0, 0, 1, 1).fill(0xffffff));
    group.addChild(outline, child);
    clearContent(group, new Set([child]));
    expect(group.children).toHaveLength(0);
    expect(outline.destroyed).toBe(true);
    expect(child.destroyed).toBe(false);
    expect(child.children[0].destroyed).toBe(false);
  });
});
