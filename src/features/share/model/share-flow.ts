import {
  buildSharePayload, carriedLink, lessonLink, MAX_CARRIED_URL, MAX_STORED_BYTES, payloadBytes, planShare, storedLink, withoutUploads,
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

/** Chooses and makes the link: the lesson's, one that carries the scene, or a stored one; with a fallback when storing fails. */
export async function prepareShare(input: ShareInput, deps: ShareDeps = {}): Promise<ShareResult> {
  if (input.lesson) return { kind: 'lesson', url: lessonLink(input.lesson.id), title: input.lesson.title };
  const store = deps.store ?? ((p: SharePayload) => createStoredShare(p));
  const shrink = deps.shrink ?? ((p: SharePayload) => shrinkPayloadImages(p));
  const payload = buildSharePayload(input);
  const plan = planShare(payload);
  if (plan.kind === 'carried') return plan;
  const fallback = (): ShareResult => {
    const url = carriedLink(withoutUploads(payload));
    return url.length <= MAX_CARRIED_URL ? { kind: 'fallback', url } : { kind: 'failed' };
  };
  try {
    const { payload: small, shrunk } = await shrink(payload);
    if (payloadBytes(small) > MAX_STORED_BYTES) return fallback();
    const stored = await store(small);
    return stored.ok ? { kind: 'stored', url: storedLink(stored.id), expiresAt: stored.expiresAt, shrunk } : fallback();
  } catch {
    return fallback();
  }
}
