import {
  buildSharePayload, carriedLink, hasUploads, lessonLink, MAX_CARRIED_URL, MAX_STORED_BYTES, payloadBytes, storedLink, withoutUploads,
  type SharePayload, type ShareSource,
} from '@/entities/project/model/share';
import { createStoredShare } from './share-api';
import { shrinkPayloadImages } from './shrink-image';

export type ShareResult =
  | { kind: 'lesson'; url: string; title: string }
  | { kind: 'carried'; url: string }
  | { kind: 'stored'; url: string; expiresAt: string; shrunk: number }
  | { kind: 'fallback'; url: string }
  | { kind: 'failed' };

export type ShareInput = ShareSource & { lesson: { id: string; title: string } | null };

export interface ShareDeps {
  store?: (p: SharePayload) => ReturnType<typeof createStoredShare>;
  shrink?: (p: SharePayload) => ReturnType<typeof shrinkPayloadImages>;
}

/** The last stored link of this page session, keyed by the exact payload. Memory only, so a reload starts clean. */
let lastStored: { key: string; result: Extract<ShareResult, { kind: 'stored' }> } | null = null;

export function clearShareMemory(): void {
  lastStored = null;
}

/** Chooses and makes the link: the lesson's, or a short stored one for any scene; a link that carries the scene when storing fails. */
export async function prepareShare(input: ShareInput, deps: ShareDeps = {}): Promise<ShareResult> {
  if (input.lesson) return { kind: 'lesson', url: lessonLink(input.lesson.id), title: input.lesson.title };
  const store = deps.store ?? ((p: SharePayload) => createStoredShare(p));
  const shrink = deps.shrink ?? ((p: SharePayload) => shrinkPayloadImages(p));
  const payload = buildSharePayload(input);
  const fallback = (): ShareResult => {
    const uploads = hasUploads(payload);
    const url = carriedLink(uploads ? withoutUploads(payload) : payload);
    if (url.length > MAX_CARRIED_URL) return { kind: 'failed' };
    return uploads ? { kind: 'fallback', url } : { kind: 'carried', url };
  };
  const key = JSON.stringify(payload);
  if (lastStored?.key === key) return lastStored.result;
  try {
    const { payload: small, shrunk } = await shrink(payload);
    if (payloadBytes(small) > MAX_STORED_BYTES) return fallback();
    const stored = await store(small);
    if (!stored.ok) return fallback();
    const result: Extract<ShareResult, { kind: 'stored' }> = { kind: 'stored', url: storedLink(stored.id), expiresAt: stored.expiresAt, shrunk };
    lastStored = { key, result };
    return result;
  } catch {
    return fallback();
  }
}
