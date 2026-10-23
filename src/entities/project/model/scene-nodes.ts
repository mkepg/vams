import type { SceneNode, TransformState, Vertex } from '@/core/types/scene';

/** Helpers for writing prepared scenes by hand. */
export const IDENTITY: TransformState = { translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1 };

/** A scene object with the same defaults the editor gives a newly placed shape. */
export function node(fields: Pick<SceneNode, 'id' | 'name' | 'type' | 'vertices'> & Partial<SceneNode>): SceneNode {
  return {
    visible: true,
    shading: 'SMOOTH',
    transform: { ...IDENTITY },
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
    ...fields,
  };
}

export function vertices(prefix: string, points: [number, number][], colors: string | string[]): Vertex[] {
  return points.map(([x, y], i) => ({
    id: `${prefix}-v${i}`,
    x,
    y,
    color: typeof colors === 'string' ? colors : colors[i],
  }));
}

export function at(x: number, y: number): TransformState {
  return { ...IDENTITY, translateX: x, translateY: y };
}
