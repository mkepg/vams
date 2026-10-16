/** Shared-scene storage for the Pages Functions. Checks structure only; the editor sanitises a scene when it opens it. */
import { checkShareShape, MAX_STORED_BYTES } from '../../src/shared/lib/share-schema';

export { isShareId } from '../../src/shared/lib/share-schema';

export const MAX_PAYLOAD_BYTES = MAX_STORED_BYTES;
export const TTL_SECONDS = 90 * 24 * 60 * 60;
export const ID_LENGTH = 8;
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number; metadata?: unknown }): Promise<void>;
}

export interface LimiterLike {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface ShareEnv {
  SHARES: KvLike;
  SHARE_LIMITER?: LimiterLike;
}

/** Eight base62 characters. Bytes of 248 and above are skipped, so every character is equally likely. */
export function newShareId(random: (bytes: Uint8Array) => Uint8Array = (bytes) => crypto.getRandomValues(bytes)): string {
  let id = '';
  while (id.length < ID_LENGTH) {
    for (const b of random(new Uint8Array(16))) {
      if (b < 248 && id.length < ID_LENGTH) id += ALPHABET[b % 62];
    }
  }
  return id;
}

export type PayloadCheck = { ok: true } | { ok: false; status: 400 | 413; error: string };

export function checkPayload(text: string): PayloadCheck {
  if (new TextEncoder().encode(text).length > MAX_PAYLOAD_BYTES) return { ok: false, status: 413, error: 'The scene is over 1 MB.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, status: 400, error: 'The scene is not JSON.' };
  }
  const reason = checkShareShape(parsed);
  return reason ? { ok: false, status: 400, error: `The scene can’t be stored: ${reason}.` } : { ok: true };
}

export function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}
