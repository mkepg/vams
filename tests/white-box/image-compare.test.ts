/**
 * WHITE-BOX TEST SUITE — WB-FID, WB-LAB
 * The image rules of the render fidelity battery and the Lab's reference battery. The strict rule:
 * every pixel within 2 of the reference in each channel. The edge rule, for the editor's editing
 * view: a pixel beside a jump of more than 8 in the reference may differ, every other pixel must be
 * within 8. PNGs round-trip through the battery's own codec.
 */
import { describe, expect, it } from 'vitest';
import { compareEdges, compareStrict, decodePng, encodePng, type Image } from '../helpers/image-compare';

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

describe('WB-FID-01: Under the edge rule, edge pixels may differ, others must be within 8', () => {
  it('accepts any difference on the square\'s edge', () => {
    expect(compareEdges(set(square(), 3, 5, 64), square()).ok).toBe(true);
  });

  it('accepts 8 and rejects 9 inside the square and in the background', () => {
    expect(compareEdges(set(square(), 5, 5, 247), square()).ok).toBe(true);
    const inside = compareEdges(set(square(), 5, 5, 246), square());
    expect(inside.ok).toBe(false);
    expect(inside.examples).toEqual([[5, 5, 9]]);
    expect(compareEdges(set(square(), 0, 0, 9), square()).failures).toBe(1);
  });

  it('leaves out pixels the caller ignores, and refuses images of another size', () => {
    expect(compareEdges(set(square(), 0, 0, 200), square(), (x, y) => x === 0 && y === 0).ok).toBe(true);
    expect(() => compareEdges({ width: 1, height: 1, data: new Uint8Array(4) }, square())).toThrow('1 × 1');
  });
});

describe('WB-FID-02: PNGs round-trip', () => {
  it('decodes what it encodes', () => {
    const img = set(square(), 1, 2, 77);
    expect(decodePng(encodePng(img))).toEqual(img);
  });
});

describe('WB-LAB-12: The strict rule: at most 2 at every pixel, edges included', () => {
  it('rejects a difference of 3 on an edge pixel', () => {
    expect(compareStrict(set(square(), 8, 3, 253), square()).ok).toBe(true);
    expect(compareStrict(set(square(), 8, 3, 252), square())).toEqual({ ok: false, failures: 1, examples: [[8, 3, 3]] });
    expect(compareStrict(set(square(), 2, 3, 128), square()).failures).toBe(1);
  });

  it('accepts a difference of 2 inside the polygon and rejects 3', () => {
    expect(compareStrict(set(square(), 6, 6, 253), square())).toEqual({ ok: true, failures: 0, examples: [] });
    expect(compareStrict(set(square(), 6, 6, 252), square())).toEqual({ ok: false, failures: 1, examples: [[6, 6, 3]] });
  });
});

/** A 256 × 4 grey ramp, `shift` added to every value, clamped. */
function ramp(shift = 0): Image {
  const data = new Uint8Array(256 * 4 * 4);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 256; x++) {
      const v = Math.max(0, Math.min(255, x + shift));
      data.set([v, v, v, 255], (y * 256 + x) * 4);
    }
  }
  return { width: 256, height: 4, data };
}

describe('WB-FID-03: A gradient is checked at every pixel by both rules', () => {
  it('rejects a ramp shifted by 3 under the strict rule, and by 9 under the edge rule', () => {
    // A shift of 3 moves 253 of the 256 values (the top three clamp to 255); 4 rows of them.
    expect(compareStrict(ramp(3), ramp()).failures).toBe(253 * 4);
    expect(compareStrict(ramp(2), ramp()).ok).toBe(true);
    // A shift of 9 moves 247 of them.
    expect(compareEdges(ramp(9), ramp()).failures).toBe(247 * 4);
    expect(compareEdges(ramp(8), ramp()).ok).toBe(true);
  });

  it('treats a jump of more than 8 as an edge, and a jump of 8 as not', () => {
    const step = (jump: number): Image => {
      const data = new Uint8Array(8 * 1 * 4);
      for (let x = 0; x < 8; x++) data.set([x < 4 ? 0 : jump, 0, 0, 255], x * 4);
      return { width: 8, height: 1, data };
    };
    expect(compareEdges(set(step(9), 3, 0, 100), step(9)).ok).toBe(true);
    expect(compareEdges(set(step(8), 3, 0, 100), step(8)).ok).toBe(false);
  });
});
