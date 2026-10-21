/**
 * BLACK-BOX TEST SUITE — BB-TEX
 * The built-in sample textures and the lessons that name them.
 */
import { describe, it, expect } from 'vitest';
import { h, render } from 'preact';
import { useVamsStore } from '@/core/store';
import { ATLAS_ICONS, FOX_PALETTE, FOX_SPRITE, SAMPLE_TEXTURE_SPECS } from '@/features/textures/lib/sample-textures';
import { getPreset } from '@/entities/project/model/scene-presets';
import { TEXTURES_LESSONS } from '@/features/lesson-engine/model/textures-lessons';
import { GRADIENT_PRESETS, gradientColours } from '@/features/object-appearance/lib/gradient';
import GradientPreview from '@/features/object-appearance/ui/GradientPreview';
import ObjectAppearancePanel from '@/features/object-appearance/ui/ObjectAppearancePanel';
import { addQuad, addTriangle } from '../helpers/store';

describe('BB-TEX-01: The samples are the teaching set, in order', () => {
  it('lists five samples with these ids, names and sizes', () => {
    expect(SAMPLE_TEXTURE_SPECS.map((s) => [s.id, s.name, s.width, s.height])).toEqual([
      ['sample-uv-grid', 'UV grid', 256, 256], ['sample-atlas', 'Sprite sheet', 256, 256],
      ['sample-pixel', 'Pixel fox', 64, 64], ['sample-bricks', 'Brick wall', 256, 256], ['sample-edges', 'Coloured edges', 256, 256],
    ]);
  });
});

describe('BB-TEX-02: Old sample ids still resolve', () => {
  it('finds the atlas, pixel and bricks samples by id', () => {
    const { getTextureById } = useVamsStore.getState();
    for (const id of ['sample-atlas', 'sample-pixel', 'sample-bricks']) {
      expect(getTextureById(id)?.isSample).toBe(true);
    }
  });

  it('opens the Textured quad preset with the Brick wall sample', () => {
    const preset = getPreset('textured-quad')!;
    const id = preset.data.objects[0].texture?.textureId;
    expect(id).toBe('sample-bricks');
    expect(useVamsStore.getState().getTextureById(id!)?.name).toBe('Brick wall');
  });
});

describe('BB-TEX-03: The fox sprite is a well-formed 16 × 16 grid', () => {
  it('has 16 rows of 16 characters, each a palette key', () => {
    expect(FOX_SPRITE).toHaveLength(16);
    for (const row of FOX_SPRITE) {
      expect(row).toHaveLength(16);
      for (const ch of row) expect(Object.keys(FOX_PALETTE)).toContain(ch);
    }
  });
});

describe('BB-TEX-04: The sprite sheet keeps its corners', () => {
  const text = JSON.stringify(TEXTURES_LESSONS);

  it('orders the icons top-left, top-right, bottom-left, bottom-right', () => {
    expect(ATLAS_ICONS).toEqual(['heart', 'coin', 'gem', 'star']);
  });

  it('names the samples the lessons use by their new names', () => {
    expect(text).toContain('green star');
    expect(text).not.toContain('Crate');
    expect(text).toContain('Brick wall');
    expect(text).not.toContain('Tiling Bricks');
  });
});

const RGB = ['#ff0000', '#00ff00', '#0000ff'];
const v = (x: number, y: number, i = 0) => ({ id: `v${i}`, x, y, color: '#ffffff' });

describe("BB-TEX-05: Gradient colours follow today's rule", () => {
  it('colours a triangle by x: red, blue, green', () => {
    const tri = [v(-0.5, -0.5, 0), v(0.5, -0.5, 1), v(0, 0.5, 2)];
    expect(gradientColours(tri, RGB)).toEqual(['#ff0000', '#0000ff', '#00ff00']);
  });

  it('uses y when the shape is a vertical line', () => {
    expect(gradientColours([v(0.2, -1, 0), v(0.2, 1, 1)], ['#000000', '#ffffff'])).toEqual(['#000000', '#ffffff']);
    expect(gradientColours([v(0.2, 1, 0), v(0.2, -1, 1)], ['#000000', '#ffffff'])).toEqual(['#ffffff', '#000000']);
  });

  it('uses vertex order when the shape is flat, and gives a polygon one colour per vertex', () => {
    const hexagon = [0, 1, 2, 3, 4, 5].map((i) => v(0.1, 0.1, i));
    const out = gradientColours(hexagon, ['#000000', '#ffffff']);
    expect(out).toHaveLength(6);
    expect(out[0]).toBe('#000000');
    expect(out[5]).toBe('#ffffff');
    expect(out[1]).toBe('#333333');
    const poly = [[-1, 0], [-0.5, 0.8], [0.5, 0.8], [1, 0], [0.5, -0.8], [-0.5, -0.8]].map(([x, y], i) => v(x, y, i));
    expect(gradientColours(poly, RGB)).toHaveLength(6);
  });
});

describe('BB-TEX-06: The five presets show as previews and apply in one step', () => {
  it('lists the five presets in order', () => {
    expect(GRADIENT_PRESETS.map((p) => p.label)).toEqual(['RGB corners', 'Black to white', 'Sunset', 'Ocean', 'Neon']);
    expect(GRADIENT_PRESETS[2].colors).toEqual(['#ff5e3a', '#ffd166', '#c9184a']);
  });

  it('shows five labelled buttons in Per vertex mode; a click applies the colours as one undo step', async () => {
    const tri = addTriangle();
    useVamsStore.setState({ selectedObjectId: tri.id });
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h(ObjectAppearancePanel, {}), host);
    const wait = () => new Promise((r) => setTimeout(r, 0));
    await wait();
    const perVertex = [...host.querySelectorAll('[role="radio"]')].find((r) => r.textContent === 'Per vertex') as HTMLElement;
    perVertex.click();
    await wait();
    const buttons = [...host.querySelectorAll('button.gradient-preview')] as HTMLButtonElement[];
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['RGB corners', 'Black to white', 'Sunset', 'Ocean', 'Neon']);
    await new Promise((r) => setTimeout(r, 80));
    const before = useVamsStore.getState().objects.find((o) => o.id === tri.id)!.vertices.map((x) => x.color);
    const undoDepth = useVamsStore.getState().past.length;
    buttons[2].click();
    await wait();
    const after = useVamsStore.getState().objects.find((o) => o.id === tri.id)!;
    expect(after.vertices.map((x) => x.color)).toEqual(gradientColours(after.vertices, GRADIENT_PRESETS[2].colors));
    expect(useVamsStore.getState().past.length).toBe(undoDepth + 1);
    useVamsStore.getState().undo();
    expect(useVamsStore.getState().objects.find((o) => o.id === tri.id)!.vertices.map((x) => x.color)).toEqual(before);
    render(null, host);
    host.remove();
  });
});

describe("BB-TEX-07: A preview paints the selected shape's own outline", () => {
  const draw = (type: Parameters<typeof GradientPreview>[0]['type'], vertices: ReturnType<typeof v>[]) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h(GradientPreview, { vertices, type, colors: RGB }), host);
    const rects = host.querySelectorAll('svg rect').length;
    render(null, host);
    host.remove();
    return rects;
  };

  it('draws rects for a quad', () => {
    const quad = addQuad();
    expect(draw('QUADS', quad.vertices)).toBeGreaterThan(100);
  });

  it('renders a 2-vertex triangle shape without throwing', () => {
    expect(() => draw('TRIANGLES', [v(0, 0, 0), v(1, 1, 1)])).not.toThrow();
    expect(() => draw('LINES', [v(0.3, -1, 0), v(0.3, 1, 1)])).not.toThrow();
    expect(() => draw('POINTS', [v(0, 0, 0)])).not.toThrow();
    expect(() => draw('LINES', [v(0, 0, 0), v(0, 0, 1)])).not.toThrow();
  });

  it('renders a shape with a non-finite corner without throwing', () => {
    expect(gradientColours([v(Number.NaN, 0, 0), v(1, 1, 1), v(0, 1, 2)], RGB)).toHaveLength(3);
    expect(() => draw('TRIANGLES', [v(Number.NaN, 0, 0), v(1, 1, 1), v(0, 1, 2)])).not.toThrow();
  });

  it("follows the shape's shading: Flat paints one colour, Smooth blends", () => {
    const tri = [v(-0.5, -0.5, 0), v(0.5, -0.5, 1), v(0, 0.5, 2)];
    const fills = (shading: 'FLAT' | 'SMOOTH') => {
      const host = document.createElement('div');
      render(h(GradientPreview, { vertices: tri, type: 'TRIANGLES', colors: RGB, shading }), host);
      const set = new Set([...host.querySelectorAll('svg rect')].map((r) => r.getAttribute('fill')));
      render(null, host);
      return set.size;
    };
    expect(fills('FLAT')).toBe(1);
    expect(fills('SMOOTH')).toBeGreaterThan(10);
  });
});
