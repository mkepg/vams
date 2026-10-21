/**
 * BLACK-BOX TEST SUITE — BB-TEX
 * The built-in sample textures and the lessons that name them.
 */
import { describe, it, expect, vi } from 'vitest';
import { h, render } from 'preact';
import { useVamsStore } from '@/core/store';
import { ATLAS_ICONS, FOX_PALETTE, FOX_SPRITE, SAMPLE_TEXTURE_SPECS } from '@/features/textures/lib/sample-textures';
import { getPreset } from '@/entities/project/model/scene-presets';
import { TEXTURES_LESSONS } from '@/features/lesson-engine/model/textures-lessons';
import { GRADIENT_PRESETS, gradientColours } from '@/features/object-appearance/lib/gradient';
import GradientPreview from '@/features/object-appearance/ui/GradientPreview';
import ObjectAppearancePanel from '@/features/object-appearance/ui/ObjectAppearancePanel';
import { addQuad, addTriangle } from '../helpers/store';
import { presetUVs } from '@/features/textures/lib/uv-presets';
import { SETTINGS_GROUPS } from '@/core/inspector/groups';
import { resolveFocus } from '@/core/inspector/focus-map';
import TexturePicker from '@/features/textures/ui/TexturePicker';
import TextureParams from '@/features/textures/ui/TextureParams';
import UVEditorPanel from '@/features/textures/ui/UVEditorPanel';

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

const uvsOf = (id: string) => useVamsStore.getState().objects.find((o) => o.id === id)!.uvs;
const FIT = [{ u: 0, v: 0 }, { u: 1, v: 0 }, { u: 1, v: 1 }, { u: 0, v: 1 }];

describe('BB-TEX-08: UV presets on a quad', () => {
  const quad = [v(-0.5, -0.5, 0), v(0.5, -0.5, 1), v(0.5, 0.5, 2), v(-0.5, 0.5, 3)];

  it('fits, tiles and flips', () => {
    expect(presetUVs('fit', quad, null)).toEqual(FIT);
    expect(presetUVs('tile', quad, null)).toEqual(FIT.map(({ u, v: w }) => ({ u: u * 2, v: w * 2 })));
    expect(presetUVs('flip-u', quad, FIT)).toEqual([{ u: 1, v: 0 }, { u: 0, v: 0 }, { u: 0, v: 1 }, { u: 1, v: 1 }]);
    expect(presetUVs('flip-v', quad, FIT)).toEqual([{ u: 0, v: 1 }, { u: 1, v: 1 }, { u: 1, v: 0 }, { u: 0, v: 0 }]);
  });

  it('flips the UVs the shape already has, not the defaults', () => {
    const tiled = presetUVs('tile', quad, null);
    expect(presetUVs('flip-u', quad, tiled).map((uv) => uv.u)).toEqual([1, -1, -1, 1]);
  });
});

describe('BB-TEX-09: Each preset is one undo step', () => {
  it('undoes a tile, and one of two flips', () => {
    // History merges pushes less than 50 ms apart, so step the clock between actions.
    vi.useFakeTimers();
    const later = () => vi.setSystemTime(Date.now() + 100);
    try {
      const quad = addQuad();
      const { setUVs } = useVamsStore.getState();
      const start = uvsOf(quad.id);
      later();
      setUVs(quad.id, presetUVs('tile', quad.vertices, start));
      expect(uvsOf(quad.id)).toEqual(FIT.map(({ u, v: w }) => ({ u: u * 2, v: w * 2 })));
      useVamsStore.getState().undo();
      expect(uvsOf(quad.id)).toEqual(start);

      later();
      setUVs(quad.id, presetUVs('flip-u', quad.vertices, uvsOf(quad.id)));
      const firstFlip = uvsOf(quad.id);
      later();
      setUVs(quad.id, presetUVs('flip-u', quad.vertices, uvsOf(quad.id)));
      expect(uvsOf(quad.id)).not.toEqual(firstFlip);
      useVamsStore.getState().undo();
      expect(uvsOf(quad.id)).toEqual(firstFlip);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores UVs whose count does not match the vertices', () => {
    const quad = addQuad();
    const before = uvsOf(quad.id);
    const depth = useVamsStore.getState().past.length;
    useVamsStore.getState().setUVs(quad.id, [{ u: 0, v: 0 }]);
    expect(uvsOf(quad.id)).toEqual(before);
    expect(useVamsStore.getState().past.length).toBe(depth);
  });
});

describe('BB-TEX-10: A preset on a shape without UVs starts from the defaults', () => {
  it('flips the default UVs', () => {
    const quad = [v(-0.5, -0.5, 0), v(0.5, -0.5, 1), v(0.5, 0.5, 2), v(-0.5, 0.5, 3)];
    expect(presetUVs('flip-v', quad, null)).toEqual(FIT.map(({ u, v: w }) => ({ u, v: 1 - w })));
  });

  it('starts from the defaults when the stored UVs do not match the vertices', () => {
    const quad = [v(-0.5, -0.5, 0), v(0.5, -0.5, 1), v(0.5, 0.5, 2), v(-0.5, 0.5, 3)];
    expect(presetUVs('flip-u', quad, [{ u: 0.3, v: 0.3 }])).toEqual(FIT.map(({ u, v: w }) => ({ u: 1 - u, v: w })));
  });
});

const settle = () => new Promise((r) => setTimeout(r, 0));
function mountIn(node: Parameters<typeof render>[0]) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(node, host);
  return { host, done: () => { render(null, host); host.remove(); } };
}
const objectOf = (id: string) => useVamsStore.getState().objects.find((o) => o.id === id)!;
const UPLOAD = { id: 'up-1', name: 'Holiday photo', isSample: false, dataUrl: 'data:image/png;base64,', width: 300, height: 200 };

describe('BB-TEX-11: Settings has no texture group and the focus lands on the Texture group', () => {
  it('drops the library from Settings and sends its focus to the shape', () => {
    expect(SETTINGS_GROUPS).toEqual(['background', 'viewing-volume']);
    expect(resolveFocus('texture-library', true)).toEqual(resolveFocus('texture-attach', true));
    expect(resolveFocus('texture-attach', true)).toEqual({ area: 'object', group: 'texture' });
  });
});

describe('BB-TEX-12: The picker applies, removes and uploads', () => {
  it('lists None, the samples and Upload, and attaches or detaches on click', async () => {
    const quad = addQuad();
    useVamsStore.setState({ selectedObjectId: quad.id });
    const { host, done } = mountIn(h(TexturePicker, {}));
    await settle();
    const tiles = () => [...host.querySelectorAll('.tx-tile')] as HTMLButtonElement[];
    const names = () => tiles().map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(names()).toEqual(['None', 'UV grid', 'Sprite sheet', 'Pixel fox', 'Brick wall', 'Coloured edges', 'Upload an image']);
    expect(tiles()[0].getAttribute('aria-pressed')).toBe('true');

    (host.querySelector('button[aria-label="Pixel fox"]') as HTMLButtonElement).click();
    await settle();
    expect(objectOf(quad.id).texture?.textureId).toBe('sample-pixel');
    expect(host.querySelector('button[aria-label="Pixel fox"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(tiles()[0].getAttribute('aria-pressed')).toBe('false');
    expect(host.querySelector('.tx-picker-name')!.textContent).toBe('Pixel fox · 64 × 64 · sample');

    tiles()[0].click();
    await settle();
    expect(objectOf(quad.id).texture).toBeNull();
    done();
  });

  it('shows uploads after the samples, each with a remove button', async () => {
    const quad = addQuad();
    useVamsStore.setState({ selectedObjectId: quad.id, uploadedTextures: [UPLOAD] });
    const { host, done } = mountIn(h(TexturePicker, {}));
    await settle();
    const labels = [...host.querySelectorAll('.tx-tile')].map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(labels.slice(-2)).toEqual(['Holiday photo', 'Upload an image']);
    expect(host.querySelectorAll('.tx-tile-remove')).toHaveLength(1);
    (host.querySelector('button[aria-label="Holiday photo"]') as HTMLButtonElement).click();
    await settle();
    expect(host.querySelector('.tx-picker-name')!.textContent).toBe('Holiday photo · 300 × 200 · uploaded');
    done();
  });
});

describe('BB-TEX-13: Removing an upload detaches it everywhere, and one undo restores it', () => {
  it('detaches both shapes, then one undo brings the image and both attachments back', async () => {
    vi.useFakeTimers();
    const later = () => vi.setSystemTime(Date.now() + 100);
    try {
      const a = addQuad(-0.5, 0, 0.3);
      later();
      const b = addQuad(0.5, 0, 0.3);
      later();
      useVamsStore.setState({ uploadedTextures: [UPLOAD] });
      useVamsStore.getState().attachTexture(a.id, UPLOAD.id);
      later();
      useVamsStore.getState().attachTexture(b.id, UPLOAD.id);
      later();
      useVamsStore.setState({ selectedObjectId: a.id });
      const { host, done } = mountIn(h(TexturePicker, {}));
      await vi.advanceTimersByTimeAsync(0);
      (host.querySelector('button[aria-label="Remove Holiday photo"]') as HTMLButtonElement).click();
      await vi.advanceTimersByTimeAsync(0);
      expect(objectOf(a.id).texture).toBeNull();
      expect(objectOf(b.id).texture).toBeNull();
      expect(useVamsStore.getState().uploadedTextures).toEqual([]);

      useVamsStore.getState().undo();
      expect(useVamsStore.getState().uploadedTextures.map((t) => t.id)).toEqual([UPLOAD.id]);
      expect(objectOf(a.id).texture?.textureId).toBe(UPLOAD.id);
      expect(objectOf(b.id).texture?.textureId).toBe(UPLOAD.id);
      done();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('BB-TEX-14: Filter and wrap show one code line for the last change', () => {
  it('starts on the filter line and follows the wrap after a wrap change', async () => {
    const quad = addQuad();
    useVamsStore.getState().attachTexture(quad.id, 'sample-bricks');
    useVamsStore.setState({ selectedObjectId: quad.id });
    const { host, done } = mountIn(h(TextureParams, {}));
    await settle();
    expect(host.querySelector('.tx-params__line')!.textContent).toContain('GL_TEXTURE_MIN_FILTER');
    const clamp = [...host.querySelectorAll('[aria-label="Wrap mode"] [role="radio"]')].find((r) => r.textContent === 'CLAMP') as HTMLElement;
    clamp.click();
    await settle();
    expect(objectOf(quad.id).texture?.wrap).toBe('CLAMP_TO_EDGE');
    expect(host.querySelector('.tx-params__line')!.textContent).toBe('glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);');
    done();
  });
});

describe('BB-TEX-15: The UV editor has presets, zoom buttons and closed exact values', () => {
  it('shows the presets, applies Tile 2 × 2, and keeps the table behind a closed disclosure', async () => {
    const quad = addQuad();
    useVamsStore.getState().attachTexture(quad.id, 'sample-bricks');
    useVamsStore.setState({ selectedObjectId: quad.id });
    const before = objectOf(quad.id).uvs!;
    const { host, done } = mountIn(h(UVEditorPanel, {}));
    await settle();
    const presets = [...host.querySelectorAll('.uve-presets button')] as HTMLButtonElement[];
    expect(presets.map((b) => b.textContent)).toEqual(['Fit', 'Tile 2 × 2', 'Flip U', 'Flip V']);
    expect([...host.querySelectorAll('.uve-zoom button')].map((b) => b.textContent)).toEqual(['−', 'Fit', '+']);
    expect(host.querySelector('.uve-stage')!.getAttribute('title')).toBe('Drag a corner to move its UV. Shift + drag pans, Shift + scroll zooms.');
    presets[1].click();
    await settle();
    expect(objectOf(quad.id).uvs).toEqual(before.map(({ u, v: w }) => ({ u: u * 2, v: w * 2 })));
    const details = host.querySelector('details.uve-exact') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.querySelector('.uve-exact__count')!.textContent).toBe('4 vertices');
    done();
  });
});
