import type { PrimitiveType, SceneNode, ShadingModel, ViewportLimits } from '@/core/types/scene';
import type { TextureAttachment, UV } from '@/core/types/textures';
import type { VamsState } from '@/core/store/types';
import { isEffectivelyHidden } from '@/features/code-generation/model/generate-from-state';
import { chainOf, worldPoint, type Pt } from '@/entities/scene/model/pipeline-geometry';
import { sanitizeName } from '@/shared/lib/sanitize-name';

/** The shape the Pipeline illustrations draw: its corners as stored and in world space, and what shades them. */
export interface Subject {
  /** Null for the demo. */
  node: SceneNode | null;
  /** The shape's code name; null for the demo. */
  owner: string | null;
  type: PrimitiveType;
  stored: Pt[];
  world: Pt[];
  colours: string[];
  uvs: UV[] | null;
  texture: TextureAttachment | null;
  shading: ShadingModel;
  volume: ViewportLimits;
  background: string;
  isDemo: boolean;
}

export const DEMO_TRIANGLE: SceneNode = {
  id: 'demo-triangle',
  name: 'Triangle',
  type: 'TRIANGLES',
  visible: true,
  shading: 'SMOOTH',
  vertices: [
    { id: 'demo-v0', x: -0.5, y: -0.5, color: '#ff0000' },
    { id: 'demo-v1', x: 0.5, y: -0.5, color: '#00ff00' },
    { id: 'demo-v2', x: 0, y: 0.5, color: '#0000ff' },
  ],
  transform: { translateX: 0.2, translateY: 0, rotate: 20, scaleX: 1.5, scaleY: 1.5 },
};

const DEMO_VOLUME: ViewportLimits = { minX: -1, maxX: 1, minY: -1, maxY: 1 };

function build(node: SceneNode, objects: readonly SceneNode[], volume: ViewportLimits, background: string, isDemo: boolean): Subject {
  const chain = chainOf(node, objects);
  const stored = node.vertices.map((v) => ({ x: v.x, y: v.y }));
  return {
    node: isDemo ? null : node,
    owner: isDemo ? null : sanitizeName(node.name),
    type: node.type as PrimitiveType,
    stored,
    world: stored.map((p) => worldPoint(p, chain)),
    colours: node.vertices.map((v) => v.color),
    uvs: node.uvs ?? null,
    texture: node.texture ?? null,
    shading: node.shading,
    volume,
    background,
    isDemo,
  };
}

/** The demo triangle against the default viewing volume. */
export function demoSubject(): Subject {
  return build(DEMO_TRIANGLE, [DEMO_TRIANGLE], DEMO_VOLUME, '#000000', true);
}

/** The selected shape if it can be drawn, else the first that can, else the demo. */
export function pipelineSubject(
  s: Pick<VamsState, 'objects' | 'selectedObjectId' | 'viewportLimits' | 'canvasBackgroundColor'>,
): Subject {
  const byId = new Map(s.objects.map((o) => [o.id, o]));
  const drawable = (o: SceneNode) =>
    o.type !== 'TEXT' && o.type !== 'GROUP' && o.vertices.length > 0 && !isEffectivelyHidden(o, byId);
  const isUnder = (o: SceneNode, ancestor: string) => {
    let p = o.parentId ? byId.get(o.parentId) : undefined;
    for (let n = 0; p && n < s.objects.length; n++) {
      if (p.id === ancestor) return true;
      p = p.parentId ? byId.get(p.parentId) : undefined;
    }
    return false;
  };
  const selected = s.selectedObjectId ? byId.get(s.selectedObjectId) : undefined;
  const pick =
    (selected && drawable(selected) ? selected : undefined) ??
    (selected?.type === 'GROUP' ? s.objects.find((o) => isUnder(o, selected.id) && drawable(o)) : undefined) ??
    s.objects.find(drawable);
  if (!pick) return demoSubject();
  return build(pick, s.objects, s.viewportLimits, s.canvasBackgroundColor, false);
}
