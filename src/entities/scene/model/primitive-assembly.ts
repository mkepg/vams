import type { PrimitiveType } from '@/core/types/scene';

/** How each primitive type groups its vertices (glBegin's mode). Pure. */

interface Rule {
  noun: string;
  plural: string;
  /** Lines call each vertex of a line an end; shapes call it a corner. */
  part: 'end' | 'corner' | null;
  rule: string;
  note: string;
  total: (n: number) => number;
  members: (j: number, n: number) => number[];
}

const span = (from: number, count: number) => Array.from({ length: count }, (_, k) => from + k);

const RULES: Record<PrimitiveType, Rule> = {
  POINTS: { noun: 'point', plural: 'points', part: null, rule: 'each vertex is drawn as its own point', note: 'each vertex is one point', total: (n) => n, members: (j) => [j] },
  LINES: { noun: 'line', plural: 'lines', part: 'end', rule: 'every 2 vertices make one line', note: 'every 2 vertices make a line', total: (n) => Math.floor(n / 2), members: (j) => span(2 * j, 2) },
  LINE_STRIP: { noun: 'line', plural: 'lines', part: 'end', rule: 'each vertex after the first adds a line from the one before', note: 'each vertex extends the line', total: (n) => Math.max(0, n - 1), members: (j) => [j, j + 1] },
  LINE_LOOP: { noun: 'line', plural: 'lines', part: 'end', rule: 'a line joins each vertex to the next, and the last back to the first', note: 'a closed line through every vertex', total: (n) => (n >= 2 ? n : 0), members: (j, n) => [j, (j + 1) % n] },
  TRIANGLES: { noun: 'triangle', plural: 'triangles', part: 'corner', rule: 'every 3 vertices make one triangle', note: 'every 3 vertices make a triangle', total: (n) => Math.floor(n / 3), members: (j) => span(3 * j, 3) },
  TRIANGLE_STRIP: { noun: 'triangle', plural: 'triangles', part: 'corner', rule: 'each vertex after the second makes a triangle with the two before it', note: 'each new vertex adds a triangle', total: (n) => Math.max(0, n - 2), members: (j) => span(j, 3) },
  TRIANGLE_FAN: { noun: 'triangle', plural: 'triangles', part: 'corner', rule: 'every triangle shares vertex 1, fanning out around it', note: 'triangles fan out from vertex 1', total: (n) => Math.max(0, n - 2), members: (j) => [0, j + 1, j + 2] },
  QUADS: { noun: 'quad', plural: 'quads', part: 'corner', rule: 'every 4 vertices make one quad', note: 'every 4 vertices make a quad', total: (n) => Math.floor(n / 4), members: (j) => span(4 * j, 4) },
  QUAD_STRIP: { noun: 'quad', plural: 'quads', part: 'corner', rule: 'each new pair of vertices makes a quad with the pair before', note: 'each new pair adds a quad', total: (n) => Math.max(0, Math.floor((n - 2) / 2)), members: (j) => [2 * j, 2 * j + 1, 2 * j + 3, 2 * j + 2] },
  POLYGON: { noun: 'polygon', plural: 'polygons', part: 'corner', rule: 'all the vertices make one polygon', note: 'all vertices make one polygon', total: (n) => (n >= 3 ? 1 : 0), members: (_j, n) => span(0, n) },
};

/** "1 and 2", "1–3", "1, 3 and 4". */
function list(numbers: number[]): string {
  const consecutive = numbers.every((v, k) => k === 0 || v === numbers[k - 1] + 1);
  if (numbers.length > 2 && consecutive) return `${numbers[0]}–${numbers[numbers.length - 1]}`;
  if (numbers.length === 1) return `${numbers[0]}`;
  return `${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]}`;
}

export interface Assembly {
  /** The primitive's name: point, line, triangle, quad or polygon. */
  noun: string;
  /** What the closed Assembled row shows. */
  result: string;
  /** The open stage's sentence. */
  sentence: string;
  /** The code panel's short note on the draw call. */
  note: string;
  /** The primitives the vertex is part of, 0-based. */
  primitives: number[];
  /** Each of those primitives' vertices, 0-based. */
  members: number[][];
}

export function assemblyFor(type: PrimitiveType, index: number, count: number): Assembly {
  const r = RULES[type];
  const total = r.total(count);
  const primitives = span(0, total).filter((j) => r.members(j, count).includes(index));
  const members = primitives.map((j) => r.members(j, count));
  const capitalised = r.rule[0].toUpperCase() + r.rule.slice(1);
  if (primitives.length === 0) {
    return { noun: r.noun, result: 'not drawn', sentence: `${capitalised}; this vertex is left over, so it is not drawn.`, note: r.note, primitives, members };
  }
  if (primitives.length === 1) {
    const j = primitives[0];
    const own = members[0];
    if (own.length === 1) {
      return { noun: r.noun, result: `${r.noun} ${j + 1} of ${total}`, sentence: `${capitalised}; this is ${r.noun} ${j + 1}.`, note: r.note, primitives, members };
    }
    const at = own.indexOf(index) + 1;
    const which = total > 1 ? ` ${j + 1}` : '';
    return {
      noun: r.noun,
      result: `${r.noun}${which}, ${r.part === 'end' ? 'end ' : ''}${at} of ${own.length}`,
      sentence: `${capitalised}; this is ${r.part} ${at} of ${r.noun} ${j + 1}.`,
      note: r.note,
      primitives,
      members,
    };
  }
  const numbers = list(primitives.map((j) => j + 1));
  return { noun: r.noun, result: `${r.plural} ${numbers}`, sentence: `${capitalised}; this vertex is in ${r.plural} ${numbers}.`, note: r.note, primitives, members };
}

/**
 * The vertex whose colour a flat-shaded primitive takes, as OpenGL picks it: a polygon's first,
 * a quad strip quad's highest-numbered (2i + 2, counting from 1), otherwise the primitive's last.
 */
export function provokingVertex(type: PrimitiveType, index: number, count: number): number {
  const members = assemblyFor(type, index, count).members[0];
  if (!members) return index;
  if (type === 'POLYGON') return members[0];
  // A quad strip's members are listed in drawing order (2j, 2j+1, 2j+3, 2j+2); OpenGL uses 2j+3.
  if (type === 'QUAD_STRIP') return Math.max(...members);
  return members[members.length - 1];
}
