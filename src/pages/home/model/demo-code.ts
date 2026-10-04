import type { SceneNode } from '@/core/types/scene';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';

/**
 * The home page's live demo: one triangle run through the editor's own code generator.
 * Everything here is pure, so the page can prerender it and tests can check it.
 */
export interface DemoVertex {
  x: number;
  y: number;
}
export type DemoTriangle = readonly [DemoVertex, DemoVertex, DemoVertex];
export interface DemoCode {
  /** The glBegin…glEnd block, dedented so glBegin starts at column 0. */
  lines: string[];
  /** Indexes into `lines` of the glVertex2f call for each vertex, in vertex order. */
  vertexLineIndexes: [number, number, number];
}

export const GRID_STEP = 0.05;
export const DEMO_COLORS = ['#ff0000', '#00ff00', '#0000ff'] as const;
export const INITIAL_TRIANGLE: DemoTriangle = [
  { x: -0.5, y: -0.5 },
  { x: 0.5, y: -0.5 },
  { x: 0, y: 0.5 },
];

/** Shown only if the generator ever fails; it is the block for INITIAL_TRIANGLE. */
export const FALLBACK_CODE: DemoCode = {
  lines: [
    'glBegin(GL_TRIANGLES);',
    '    glColor3f(1.00f, 0.00f, 0.00f);',
    '    glVertex2f(-0.5000f, -0.5000f);',
    '    glColor3f(0.00f, 1.00f, 0.00f);',
    '    glVertex2f(0.5000f, -0.5000f);',
    '    glColor3f(0.00f, 0.00f, 1.00f);',
    '    glVertex2f(0.0000f, 0.5000f);',
    'glEnd();',
  ],
  vertexLineIndexes: [2, 4, 6],
};

const CANVAS_SIZE = { width: 800, height: 600 };
const NO_CALLBACKS = { keyboard: '', mouse: '', reshape: '', motion: '', idle: '' };

/** Clamp to the default glOrtho range and snap to the demo grid, without float noise or -0. */
export function snapToGrid(value: number): number {
  const clamped = Math.min(1, Math.max(-1, value));
  const snapped = Math.round(clamped / GRID_STEP) * GRID_STEP;
  return Math.round(snapped * 100) / 100 || 0;
}

export function replaceVertex(tri: DemoTriangle, index: number, vertex: DemoVertex): DemoTriangle {
  return [
    index === 0 ? vertex : tri[0],
    index === 1 ? vertex : tri[1],
    index === 2 ? vertex : tri[2],
  ];
}

/** A one-object scene with the same defaults the editor gives a newly placed triangle. */
export function buildDemoScene(tri: DemoTriangle): SceneNode {
  return {
    id: 'demo-triangle',
    name: 'Triangle',
    type: 'TRIANGLES',
    visible: true,
    shading: 'SMOOTH',
    vertices: tri.map((v, i) => ({ id: `v${i}`, x: v.x, y: v.y, color: DEMO_COLORS[i] })),
    transform: { translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1 },
    parentId: null,
    children: [],
    colorMode: 'FLOAT',
    lineStipple: null,
    renderingMode: 'IMMEDIATE',
    bufferUsage: 'STATIC',
    useIndexed: false,
    updateMethod: 'BUFFER_SUB_DATA',
    texture: null,
    uvs: null,
  };
}

export function generateDemoProgram(tri: DemoTriangle): string {
  return generateCodeFromState(
    { objects: [buildDemoScene(tri)], canvasBackgroundColor: '#000000', callbacks: NO_CALLBACKS },
    CANVAS_SIZE,
  );
}

export function extractDrawBlock(program: string): DemoCode | null {
  const all = program.split('\n');
  const start = all.findIndex((line) => line.trim().startsWith('glBegin('));
  if (start < 0) return null;
  const end = all.findIndex((line, i) => i > start && line.trim() === 'glEnd();');
  if (end < 0) return null;
  const block = all.slice(start, end + 1);
  const indent = block[0].length - block[0].trimStart().length;
  const lines = block.map((line) => line.slice(indent));
  const vertexLines = lines.flatMap((line, i) => (line.trim().startsWith('glVertex2f(') ? [i] : []));
  if (vertexLines.length !== 3) return null;
  return { lines, vertexLineIndexes: [vertexLines[0], vertexLines[1], vertexLines[2]] };
}

export function generateDemoCode(tri: DemoTriangle): DemoCode {
  try {
    return extractDrawBlock(generateDemoProgram(tri)) ?? FALLBACK_CODE;
  } catch {
    return FALLBACK_CODE;
  }
}

/** Pixel position in a width × height view to GL coordinates under glOrtho(-1, 1, -1, 1). */
export function pixelToGl(px: number, py: number, width: number, height: number) {
  return { x: (2 * px) / width - 1, y: 1 - (2 * py) / height };
}

export function glToPixel(x: number, y: number, width: number, height: number) {
  return { px: ((x + 1) / 2) * width, py: ((1 - y) / 2) * height };
}
