/**
 * WHITE-BOX TEST SUITE — WB-TEXT
 * Bitmap text as GLUT draws it: the freeglut 9×15 glyphs, the line spacing the generator prints,
 * where glBitmap puts a line, and the canvas layout that keeps letters in window pixels.
 */
import { describe, it, expect } from 'vitest';
import { Container } from 'pixi.js';
import { GLYPHS, GLYPH_HEIGHT, GLYPH_WIDTH } from '@/shared/lib/glut-bitmap-9x15';
import { lineOrigin, printableLine, rasterLineYs, rasterizeLine, textLineStep } from '@/shared/lib/text-raster';
import { BitmapTextLayout } from '@/shared/engine/pixi/primitives/rendering/bitmapText';

describe('WB-TEXT-01: The glyphs are freeglut’s GLUT_BITMAP_9_BY_15', () => {
  it('holds characters 32 to 126, sixteen two-byte rows each', () => {
    expect(GLYPHS).toHaveLength(95);
    GLYPHS.forEach((g) => expect(g).toMatch(/^[0-9a-f]{64}$/));
  });

  it('lays out A from its bottom-first rows, most significant bit leftmost', () => {
    const { width, height, bits } = rasterizeLine('A');
    expect([width, height]).toEqual([GLYPH_WIDTH, GLYPH_HEIGHT]);
    const row = (y: number) => Array.from(bits.slice(y * width, y * width + width)).join('');
    // freeglut row 4 (from the bottom) is 65 = 01000001: the two legs; row 13 is 8: the apex.
    expect(row(GLYPH_HEIGHT - 1 - 4)).toBe('010000010');
    expect(row(GLYPH_HEIGHT - 1 - 7)).toBe('011111110');
    expect(row(GLYPH_HEIGHT - 1 - 13)).toBe('000010000');
    expect(row(GLYPH_HEIGHT - 1)).toBe('000000000');
  });

  it('advances nine pixels per character and draws only printable ASCII', () => {
    expect(rasterizeLine('Hi!').width).toBe(27);
    expect(printableLine('a\tb\rcé~')).toBe('abc~');
  });
});

describe('WB-TEXT-02: Lines start 17 window pixels apart, in the units the code prints', () => {
  it('turns 17 pixels into object units for the window and the text’s scale', () => {
    expect(textLineStep(300, 1)).toBe(0.0567);
    expect(textLineStep(300, -0.5)).toBe(0.1133);
    expect(textLineStep(300, 0)).toBe(0);
  });

  it('puts line 1 at the origin and each later line one step lower', () => {
    expect(rasterLineYs(3, 0.0567)).toEqual([0, -0.0567, -0.1134]);
    expect(rasterLineYs(1, 0.0567)).toEqual([0]);
  });
});

describe('WB-TEXT-03: glBitmap places a line from its raster position, or skips it', () => {
  it('puts the bitmap’s bottom four pixels below the raster position, on whole pixels', () => {
    // Window 200 × 100; raster at (100.4, 50.6) measured from the top, 49.4 from the bottom.
    expect(lineOrigin(100.4, 50.6, 200, 100)).toEqual({ left: 100, top: 39 });
  });

  it('skips the line when the raster position is outside the window', () => {
    expect(lineOrigin(-0.1, 50, 200, 100)).toBeNull();
    expect(lineOrigin(50, 100.1, 200, 100)).toBeNull();
    expect(lineOrigin(200, 100, 200, 100)).not.toBeNull();
  });
});

describe('WB-TEXT-04: The canvas layout keeps letters in window pixels', () => {
  /** An 800 × 600 window over a -1..1 volume, y up, as the editor's world container maps it. */
  function scene(transform: { x: number; y: number; rotate: number; scale: number }, text: string) {
    const world = new Container();
    world.scale.set(400, -300);
    world.position.set(400, 300);
    const container = new Container();
    container.position.set(transform.x, transform.y);
    container.rotation = (transform.rotate * Math.PI) / 180;
    container.scale.set(transform.scale, transform.scale);
    world.addChild(container);
    const layout = new BitmapTextLayout(text.split('\n'), 0xff0000);
    layout.sprites.forEach((s) => s && container.addChild(s));
    return { container, layout };
  }

  it('draws a rotated, scaled text upright at one texel per pixel from its raster position', () => {
    const { container, layout } = scene({ x: 0.5, y: 0, rotate: 90, scale: 3 }, 'Hi');
    layout.place(container, 0.0189, 800, 600);
    const m = layout.sprites[0]!.getGlobalTransform();
    // Raster (0.5, 0) is at pixel (600, 300); the bitmap's top is 16 - 4 = 12 pixels above it.
    expect(m.a).toBeCloseTo(1, 9);
    expect(m.b).toBeCloseTo(0, 9);
    expect(m.c).toBeCloseTo(0, 9);
    expect(m.d).toBeCloseTo(1, 9);
    expect(m.tx).toBeCloseTo(600, 6);
    expect(m.ty).toBeCloseTo(288, 6);
  });

  it('picks the text on its drawn letters and not far from them', () => {
    const { container, layout } = scene({ x: 0, y: 0, rotate: 0, scale: 1 }, 'Hello');
    layout.place(container, 0.0567, 800, 600);
    // The line runs 45 pixels right of (400, 300): about 0.11 units at 400 px per unit.
    expect(layout.contains(0.05, 0.01)).toBe(true);
    expect(layout.contains(0.5, 0.5)).toBe(false);
    expect(layout.screenBounds()).toMatchObject({ x: 400, y: 288, width: 45, height: 16 });
  });

  it('hides a line whose raster position leaves the window, and keeps a pick square at the origin', () => {
    const { container, layout } = scene({ x: 1.2, y: 0, rotate: 0, scale: 1 }, 'Off');
    layout.place(container, 0.0567, 800, 600);
    expect(layout.sprites[0]!.visible).toBe(false);
    expect(layout.screenBounds()).toMatchObject({ x: 874, y: 294, width: 12, height: 12 });
    expect(layout.contains(0, 0)).toBe(true);
  });
});
