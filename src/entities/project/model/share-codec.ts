import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { SHARE_ORIGIN } from '@/shared/lib/share-origin';
import type { SharePayload } from './share-payload';

/** A link that carries its scene stays short enough for a QR code read off a projector. */
export const MAX_CARRIED_URL = 1000;

/** The longest carried data read at all; deflate's ratio limit then bounds what it inflates to. */
export const MAX_CARRIED_DATA = 4000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function encodeShare(p: SharePayload): string {
  return toBase64Url(deflateSync(strToU8(JSON.stringify(p)), { level: 9 }));
}

/** The JSON a link carries, or null when the data is damaged. */
export function decodeShare(data: string): unknown | null {
  if (!data || data.length > MAX_CARRIED_DATA || !/^[A-Za-z0-9_-]+$/.test(data)) return null;
  try {
    return JSON.parse(strFromU8(inflateSync(fromBase64Url(data))));
  } catch {
    return null;
  }
}

export const carriedLink = (p: SharePayload, origin: string = SHARE_ORIGIN): string => `${origin}/app#s=${encodeShare(p)}`;
export const storedLink = (id: string, origin: string = SHARE_ORIGIN): string => `${origin}/s/${id}`;
export const lessonLink = (id: string, origin: string = SHARE_ORIGIN): string => `${origin}/app?lesson=${encodeURIComponent(id)}`;
