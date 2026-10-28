/**
 * WHITE-BOX TEST SUITE — WB-FID
 * The render fidelity battery's image rule: edge pixels may differ, every other pixel must be
 * within 2 of the reference in each channel. PNGs round-trip through the battery's own codec.
 */
import { describe, expect, it } from 'vitest';
import { compareImages, decodePng, encodePng, type Image } from '../helpers/image-compare';

/** A 12 × 12 black image with a white 6 × 6 square at (3, 3). */
function square(): Image {
  const data = new Uint8Array(12 * 12 * 4);
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      const o = (y * 12 + x) * 4;
      const on = x >= 3 && x < 9 && y >= 3 && y < 9 ? 255 : 0;
      data.set([on, on, on, 255], o);
    }
  }
  return { width: 12, height: 12, data };
}

function set(img: Image, x: number, y: number, value: number): Image {
  const data = img.data.slice();
  data.set([value, value, value], (y * img.width + x) * 4);
  return { ...img, data };
}

describe('WB-FID-01: Edge pixels may differ, others must be within 2', () => {
  it('accepts any difference on the square\'s edge', () => {
    expect(compareImages(set(square(), 3, 5, 64), square()).ok).toBe(true);
  });

  it('accepts 2 and rejects 3 inside the square and in the background', () => {
    expect(compareImages(set(square(), 5, 5, 253), square()).ok).toBe(true);
    const inside = compareImages(set(square(), 5, 5, 252), square());
    expect(inside.ok).toBe(false);
    expect(inside.examples).toEqual([[5, 5, 3]]);
    expect(compareImages(set(square(), 0, 0, 3), square()).failures).toBe(1);
  });

  it('leaves out pixels the caller ignores, and refuses images of another size', () => {
    expect(compareImages(set(square(), 0, 0, 200), square(), (x, y) => x === 0 && y === 0).ok).toBe(true);
    expect(() => compareImages({ width: 1, height: 1, data: new Uint8Array(4) }, square())).toThrow('1 × 1');
  });
});

describe('WB-FID-02: PNGs round-trip', () => {
  it('decodes what it encodes', () => {
    const img = set(square(), 1, 2, 77);
    expect(decodePng(encodePng(img))).toEqual(img);
  });
});
