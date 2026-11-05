import { labFileType, type LabFile, type LabWork } from '@/entities/lab-project';
import { storedLink } from '@/entities/project/model/share-codec';
import {
  checkLabShape,
  isShareId,
  LAB_SHARE_KIND,
  LAB_SHARE_VERSION,
  MAX_LAB_SOURCE,
  MAX_STORED_BYTES,
  type LabShareFile,
  type LabSharePayload,
} from '@/shared/lib/share-schema';
import { createStoredShare, fetchStoredShare } from './share-api';
import type { ShareResult } from './share-flow';
import { fitWithin } from './shrink-image';

export { LAB_SHARE_PARAM, labShareUrl } from '@/shared/lib/share-schema';

/** What the Lab's Share dialog says. */
export const LAB_SHARE_COPY = {
  title: 'Share this program',
  lead: 'Anyone with the link opens a copy of this code and its files in the Lab.',
  save: 'Save to a file',
  saveInstead: 'Save to a file instead',
  /** The QR image's file name, before -qr.png. */
  qrName: 'VAMS Lab',
} as const;

/** What the Lab says about a share link it can't open, and about work too large for one. */
export const LAB_SHARE_MESSAGES = {
  missing: "That shared program has expired or can't be found. Ask for a new link.",
  damaged: 'That link is incomplete. Ask for it again.',
  offline: 'Connect to the internet to open this shared program.',
  unavailable: "That shared program couldn't be loaded. Try again in a moment.",
  codeTooLong: 'A link holds up to 200,000 characters of code. Yours is longer, so save it to a file instead.',
  tooLarge: 'A link holds up to 1 MB of code and files. Yours come to more, so save them to a file instead.',
} as const;

/** Draws an image again at a smaller size and gives it back as PNG bytes. */
export type ResizeLabImage = (bytes: Uint8Array, type: string, size: { width: number; height: number }) => Promise<Uint8Array>;

/** The width and height a PNG, JPEG or BMP says it has, read from its header; null for anything else. */
export function imageSize(b: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const png = b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (png) return String.fromCharCode(...b.subarray(12, 16)) === 'IHDR' ? { width: view.getUint32(16), height: view.getUint32(20) } : null;
  if (b.length >= 26 && b[0] === 0x42 && b[1] === 0x4d) {
    const header = view.getUint32(14, true);
    if (header === 12) return { width: view.getUint16(18, true), height: view.getUint16(20, true) };
    // A negative height is a top-down BMP.
    return header >= 40 ? { width: Math.abs(view.getInt32(18, true)), height: Math.abs(view.getInt32(22, true)) } : null;
  }
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let at = 2;
  while (at + 3 < b.length) {
    if (b[at] !== 0xff) return null;
    const marker = b[at + 1];
    if (marker === 0xff) {
      at += 1;
    } else if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      at += 2;
    } else if (marker === 0xd9 || marker === 0xda) {
      return null;
    } else if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      // A start-of-frame segment: length, precision, then height and width.
      return at + 9 <= b.length ? { width: view.getUint16(at + 7), height: view.getUint16(at + 5) } : null;
    } else {
      at += 2 + view.getUint16(at + 2);
    }
  }
  return null;
}

/** Redraws an image smoothly at a smaller size, as PNG, which every image the Lab takes can become. */
export const canvasResizeImage: ResizeLabImage = async (bytes, type, size) => {
  const bitmap = await createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>], { type }));
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D canvas to shrink the image with');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  } finally {
    bitmap.close();
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The image could not be encoded');
  return new Uint8Array(await blob.arrayBuffer());
};

function toBase64(bytes: Uint8Array): string {
  let text = '';
  for (let at = 0; at < bytes.length; at += 0x8000) text += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  return btoa(text);
}

function fromBase64(text: string): Uint8Array {
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** A text file's text, its byte-order mark kept, so it comes back with the same bytes. */
const textOf = (bytes: Uint8Array) => new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);

/**
 * The work as a share carries it: .txt files as text, images as data URLs. An image with a side
 * over 512 px is shrunk to fit and re-encoded as PNG under its own name, since the program finds
 * files by name and stb_image reads the format from the bytes. A smaller image keeps its bytes.
 */
export async function buildLabSharePayload(work: LabWork, resize: ResizeLabImage = canvasResizeImage): Promise<{ payload: LabSharePayload; shrunk: number }> {
  let shrunk = 0;
  const files: LabShareFile[] = [];
  for (const file of work.files) {
    if (!file.type.startsWith('image/')) {
      files.push({ name: file.name, text: textOf(file.bytes) });
      continue;
    }
    const size = imageSize(file.bytes);
    const fit = size ? fitWithin(size.width, size.height) : null;
    if (size && fit && (fit.width !== size.width || fit.height !== size.height)) {
      try {
        files.push({ name: file.name, dataUrl: `data:image/png;base64,${toBase64(await resize(file.bytes, file.type, fit))}` });
        shrunk++;
        continue;
      } catch {
        // An image the browser can't redraw goes as it is.
      }
    }
    files.push({ name: file.name, dataUrl: `data:${file.type};base64,${toBase64(file.bytes)}` });
  }
  return { payload: { kind: LAB_SHARE_KIND, v: LAB_SHARE_VERSION, source: work.source, files }, shrunk };
}

const payloadBytes = (p: LabSharePayload) => new TextEncoder().encode(JSON.stringify(p)).length;

export interface LabShareDeps {
  store?: (p: LabSharePayload) => ReturnType<typeof createStoredShare>;
  resize?: ResizeLabImage;
}

/** Stores the work and gives its /s/<id> link, or says what a link holds when the work is over it. */
export async function prepareLabShare(work: LabWork, deps: LabShareDeps = {}): Promise<ShareResult> {
  if (work.source.length > MAX_LAB_SOURCE) return { kind: 'over-limit', message: LAB_SHARE_MESSAGES.codeTooLong };
  const store = deps.store ?? ((p: LabSharePayload) => createStoredShare(p));
  const { payload, shrunk } = await buildLabSharePayload(work, deps.resize);
  if (payloadBytes(payload) > MAX_STORED_BYTES) return { kind: 'over-limit', message: LAB_SHARE_MESSAGES.tooLarge };
  const stored = await store(payload);
  if (!stored.ok) return stored.reason === 'too-large' ? { kind: 'over-limit', message: LAB_SHARE_MESSAGES.tooLarge } : { kind: 'failed' };
  return { kind: 'stored', url: storedLink(stored.id), expiresAt: stored.expiresAt, shrunk };
}

/** The work a Lab share carries, ready for the store; null when the payload isn't Lab work or a file won't decode. */
export function readLabShare(raw: unknown): LabWork | null {
  if (checkLabShape(raw) !== null) return null;
  const files: LabFile[] = [];
  try {
    for (const file of (raw as LabSharePayload).files) {
      const type = labFileType(file.name);
      if (!type) continue;
      const text = (file as { text?: unknown }).text;
      const bytes = typeof text === 'string' ? new TextEncoder().encode(text) : fromBase64((file as { dataUrl: string }).dataUrl.split(',')[1]);
      files.push({ name: file.name, bytes, type });
    }
  } catch {
    return null;
  }
  return { source: (raw as LabSharePayload).source, files };
}

/** Fetches the work behind /lab?share=<id>, or the sentence that says why it can't be opened. */
export async function openLabShare(id: string, fetchImpl?: typeof fetch): Promise<{ ok: true; work: LabWork } | { ok: false; message: string }> {
  if (!isShareId(id)) return { ok: false, message: LAB_SHARE_MESSAGES.missing };
  const res = await fetchStoredShare(id, fetchImpl);
  if (!res.ok) return { ok: false, message: LAB_SHARE_MESSAGES[res.reason] };
  const work = readLabShare(res.payload);
  return work ? { ok: true, work } : { ok: false, message: LAB_SHARE_MESSAGES.damaged };
}
