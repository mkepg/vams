/**
 * The shape of a shared scene, checked by the browser when a link opens and by the server when a
 * scene is stored. It has no imports so both sides can load it.
 */
export const SHARE_VERSION = 1;
export const MAX_STORED_BYTES = 1_000_000;
export const MAX_NAME_LENGTH = 80;
export const MAX_OBJECTS = 1000;
export const SHARE_IMAGE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]*$/;

const SHARE_ID = /^[A-Za-z0-9]{8}$/;

export const isShareId = (id: unknown): id is string => typeof id === 'string' && SHARE_ID.test(id);

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function checkTexture(t: unknown): string | null {
  if (!isRecord(t) || typeof t.id !== 'string') return 'a texture is malformed';
  if (t.sample === true) return null;
  if (typeof t.dataUrl !== 'string' || !SHARE_IMAGE.test(t.dataUrl)) return 'a texture image is not a PNG, JPEG or WebP data URL';
  if (!Number.isFinite(t.width) || !Number.isFinite(t.height)) return 'a texture has no size';
  return null;
}

/** Null when the value has the shape of a shared scene, otherwise the reason it does not. */
export function checkShareShape(value: unknown): string | null {
  if (!isRecord(value)) return 'the scene is not an object';
  if (value.v !== SHARE_VERSION) return 'unknown version';
  if (typeof value.name !== 'string' || value.name.length > MAX_NAME_LENGTH) return 'the name is missing or too long';
  if (!Array.isArray(value.objects) || value.objects.length > MAX_OBJECTS) return 'objects are missing or too many';
  if (!Array.isArray(value.textures)) return 'textures are missing';
  for (const t of value.textures) {
    const reason = checkTexture(t);
    if (reason) return reason;
  }
  return null;
}
