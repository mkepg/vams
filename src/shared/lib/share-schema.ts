/**
 * The shape of a shared scene or of shared Lab work, checked by the browser when a link opens and by
 * the server when a share is stored. It has no imports so both sides can load it.
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

/** Shared Lab work: its code and its file list. */
export const LAB_SHARE_KIND = 'lab';
export const LAB_SHARE_VERSION = 1;
/** The longest code a Lab link holds, in characters. */
export const MAX_LAB_SOURCE = 200_000;
export const MAX_LAB_FILE_NAME = 255;
/** The images the Lab's runtime reads (stb_image): PNG, JPEG and BMP. */
export const LAB_SHARE_IMAGE = /^data:image\/(png|jpeg|bmp);base64,[A-Za-z0-9+/=]*$/;
/** The names the Lab's file list takes, by kind. An image keeps its name when it is shrunk to PNG. */
const LAB_IMAGE_NAME = /\.(png|jpe?g|bmp)$/i;
const LAB_TEXT_NAME = /\.txt$/i;

/** One file of shared Lab work: an image as a data URL, or a .txt file as its text. */
export type LabShareFile = { name: string; dataUrl: string } | { name: string; text: string };

export interface LabSharePayload {
  kind: typeof LAB_SHARE_KIND;
  v: typeof LAB_SHARE_VERSION;
  source: string;
  files: LabShareFile[];
}

/** Whether the value says it is Lab work. Its shape is checked by checkLabShape. */
export const isLabKind = (value: unknown): boolean => isRecord(value) && value.kind === LAB_SHARE_KIND;

function checkLabFile(f: unknown): string | null {
  if (!isRecord(f) || typeof f.name !== 'string') return 'a file is malformed';
  if (f.name.length === 0 || f.name.length > MAX_LAB_FILE_NAME || /[\\/]/.test(f.name)) return 'a file name is missing, too long or a path';
  if (typeof f.text === 'string') return LAB_TEXT_NAME.test(f.name) ? null : 'a text file is not a .txt file';
  if (typeof f.dataUrl !== 'string' || !LAB_SHARE_IMAGE.test(f.dataUrl)) return 'an image is not a PNG, JPEG or BMP data URL';
  return LAB_IMAGE_NAME.test(f.name) ? null : 'an image is not named .png, .jpg, .jpeg or .bmp';
}

/** Null when the value has the shape of shared Lab work, otherwise the reason it does not. */
export function checkLabShape(value: unknown): string | null {
  if (!isRecord(value) || value.kind !== LAB_SHARE_KIND) return 'the work is not Lab work';
  if (value.v !== LAB_SHARE_VERSION) return 'unknown version';
  if (typeof value.source !== 'string' || value.source.length > MAX_LAB_SOURCE) return 'the code is missing or too long';
  if (!Array.isArray(value.files)) return 'files are missing';
  for (const f of value.files) {
    const reason = checkLabFile(f);
    if (reason) return reason;
  }
  return null;
}
