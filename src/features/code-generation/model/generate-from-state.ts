import type { AnimationMotion, CallbacksState, SceneNode, ViewportLimits } from '@/core/types/scene';
import type { TextureAsset } from '@/core/types/textures';
import { generateAppOutput } from './code-generator';
import { planCallbacks } from './generator/handlers';

interface GenerateInput {
  objects: SceneNode[];
  canvasBackgroundColor: string;
  callbacks: CallbacksState;
  viewportLimits?: ViewportLimits;
  textures?: TextureAsset[];
  /**
   * Transient Animation-Preview override. While the UI previews a motion, this
   * makes the generated code reflect it for that one object. Saved animations
   * come from each object's own `animation` field; this is never persisted.
   */
  previewAnimation?: { objectId: string; motion: AnimationMotion; speed: number };
}

function isEffectivelyHidden(
  obj: SceneNode,
  byId: Map<string, SceneNode>
): boolean {
  if (!obj.visible) return true;
  if (obj.parentId) {
    const parent = byId.get(obj.parentId);
    if (parent && isEffectivelyHidden(parent, byId)) return true;
  }
  return false;
}

function getEffectivelyVisibleObjects(objects: SceneNode[]): SceneNode[] {
  const byId = new Map(objects.map((o) => [o.id, o]));
  return objects.filter((o) => !isEffectivelyHidden(o, byId));
}

export function generateCodeFromState(
  input: GenerateInput,
  canvasSize: { width: number; height: number }
): string {
  const { objects, canvasBackgroundColor, callbacks, viewportLimits, previewAnimation } = input;

  const texMap = new Map<string, TextureAsset>(
    (input.textures ?? []).map((t) => [t.id, t]),
  );

  if (objects.length === 0) {
    return generateAppOutput(
      [], // rootObjects
      [], // allObjects
      canvasBackgroundColor,
      canvasSize,
      '    // Empty scene\n',
      planCallbacks(callbacks, []),
      viewportLimits,
      texMap,
      previewAnimation
    );
  }

  const visible = getEffectivelyVisibleObjects(objects);
  const roots = visible.filter((o) => !o.parentId);
  const plan = planCallbacks(callbacks, visible);

  return generateAppOutput(
    roots,   // rootObjects
    visible, // allObjects
    canvasBackgroundColor,
    canvasSize,
    '    // Empty scene\n',
    plan,
    viewportLimits,
    texMap,
    previewAnimation
  );
}