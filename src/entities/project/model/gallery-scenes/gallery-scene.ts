import type { CurriculumSection } from '@/core/store/types';
import type { CallbackRule, CallbacksState, RuleAction, RuleTrigger, SceneNode, Vertex } from '@/core/types/scene';
import type { TextureAsset } from '@/core/types/textures';

/** A gallery scene as written by hand; scene-presets turns it into project data. */
export interface GalleryScene {
  /** The section the editor makes current when the scene opens. */
  section: CurriculumSection;
  background: string;
  build: () => SceneNode[];
  callbacks: () => CallbacksState;
  /** Uploaded textures the scene's objects use; samples need none. */
  textures?: readonly TextureAsset[];
}

/** Every gallery scene draws in a 16:9 viewing volume, so the window and the card image share a shape. */
export const GALLERY_VIEW = { minX: -1.6, maxX: 1.6, minY: -0.9, maxY: 0.9 } as const;

export function rule(id: string, objectId: string, trigger: RuleTrigger, action: RuleAction): CallbackRule {
  return { id, objectId, trigger, action };
}

/** `n` points evenly round a circle of radius `r`, starting at angle `a0` (radians). */
export function circle(r: number, n: number, a0 = 0): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = a0 + (i / n) * 2 * Math.PI;
    return [r * Math.cos(a), r * Math.sin(a)];
  });
}

/** A fan: a centre vertex in one colour, then a closed ring in another. */
export function disc(prefix: string, r: number, n: number, centre: string, edge: string): Vertex[] {
  const ring = [...circle(r, n), [r, 0] as [number, number]];
  return [{ x: 0, y: 0, color: centre }, ...ring.map(([x, y]) => ({ x, y, color: edge }))].map((v, i) => ({
    id: `${prefix}-v${i}`,
    x: round(v.x),
    y: round(v.y),
    color: v.color,
  }));
}

/** Four decimals, and never -0, which a saved file would turn into 0. */
export const round = (v: number) => Math.round(v * 10000) / 10000 || 0;
