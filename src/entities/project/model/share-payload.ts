import type { VamsState } from '@/core/store/types';
import type { TextureAsset } from '@/core/types/textures';
import { checkShareShape, SHARE_VERSION } from '@/shared/lib/share-schema';
import { sanitizeProjectData, type VamsProjectData } from './project-io';
import { normalizeSceneName } from './scene-library';

export { MAX_STORED_BYTES, SHARE_VERSION } from '@/shared/lib/share-schema';

/** Sample textures are drawn by code, so a share names them; an upload travels as its image. */
export type ShareTexture =
  | { id: string; sample: true }
  | { id: string; name: string; dataUrl: string; width: number; height: number };

/** A shared scene: its content only, never the editor's UI state or axis visibility. */
export interface SharePayload {
  v: typeof SHARE_VERSION;
  name: string;
  objects: VamsState['objects'];
  callbacks: VamsState['callbacks'];
  viewportLimits: VamsState['viewportLimits'];
  canvasBackgroundColor: string;
  textures: ShareTexture[];
}

export type ShareSource = Pick<VamsState, 'sceneName' | 'objects' | 'callbacks' | 'viewportLimits' | 'canvasBackgroundColor'> & {
  textures: readonly TextureAsset[];
};

export interface SharedScene {
  name: string;
  data: VamsProjectData;
}

export function buildSharePayload(src: ShareSource): SharePayload {
  const used = new Set(src.objects.map((o) => o.texture?.textureId).filter((id): id is string => Boolean(id)));
  const textures = src.textures
    .filter((t) => used.has(t.id))
    .map((t): ShareTexture => (t.isSample ? { id: t.id, sample: true } : { id: t.id, name: t.name, dataUrl: t.dataUrl, width: t.width, height: t.height }));
  return {
    v: SHARE_VERSION,
    name: src.sceneName,
    objects: src.objects,
    callbacks: src.callbacks,
    viewportLimits: src.viewportLimits,
    canvasBackgroundColor: src.canvasBackgroundColor,
    textures,
  };
}

export const isUpload = (t: ShareTexture): t is Exclude<ShareTexture, { sample: true }> => (t as { sample?: unknown }).sample !== true;
export const hasUploads = (p: SharePayload): boolean => p.textures.some(isUpload);

/** The payload with its uploaded images left out; objects that used them open untextured. */
export function withoutUploads(p: SharePayload): SharePayload {
  return { ...p, textures: p.textures.filter((t) => !isUpload(t)) };
}

export function payloadBytes(p: SharePayload): number {
  return new TextEncoder().encode(JSON.stringify(p)).length;
}

/** Reads a payload from a link or the server. Malformed input gives null; content is sanitised like a project file. */
export function readSharePayload(raw: unknown): SharedScene | null {
  if (checkShareShape(raw) !== null) return null;
  const r = raw as SharePayload;
  const uploads = r.textures.filter(isUpload);
  const data = sanitizeProjectData({
    objects: r.objects,
    callbacks: r.callbacks,
    viewportLimits: r.viewportLimits,
    canvasBackgroundColor: r.canvasBackgroundColor,
    uploadedTextures: uploads,
  });
  return { name: normalizeSceneName(r.name), data };
}
