import type { AnimationMotion, GlutCallbackKind, SceneNode, ViewportLimits } from '@/core/types/scene';
import type { TextureAsset } from '@/core/types/textures';
import {
  generateAppOutput,
  type RegisteredCallback,
} from './code-generator';

interface GenerateInput {
  objects: SceneNode[];
  canvasBackgroundColor: string;
  callbacks: Record<GlutCallbackKind, string>;
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

const CALLBACK_KINDS: GlutCallbackKind[] = [
  'keyboard', 'mouse', 'reshape', 'motion', 'idle',
];

function getRegisteredCallbacks(
  callbacks: Record<GlutCallbackKind, string>
): RegisteredCallback[] {
  return CALLBACK_KINDS
    .filter((k) => callbacks[k] && callbacks[k].trim().length > 0)
    .map((k) => ({ kind: k, handlerName: callbacks[k].trim() }));
}

export function generateCodeFromState(
  input: GenerateInput,
  canvasSize: { width: number; height: number }
): string {
  const { objects, canvasBackgroundColor, callbacks, viewportLimits, previewAnimation } = input;

  const cbs = getRegisteredCallbacks(callbacks);
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
      cbs,
      viewportLimits,
      texMap,
      previewAnimation
    );
  }

  const visible = getEffectivelyVisibleObjects(objects);
  const roots = visible.filter((o) => !o.parentId);

  return generateAppOutput(
    roots,   // rootObjects
    visible, // allObjects
    canvasBackgroundColor,
    canvasSize,
    '    // Empty scene\n',
    cbs,
    viewportLimits,
    texMap,
    previewAnimation
  );
}