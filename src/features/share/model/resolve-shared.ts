import { decodeShare, readSharePayload, type SharedScene } from '@/entities/project/model/share';
import { isShareId } from '@/shared/lib/share-schema';
import { fetchStoredShare } from './share-api';

/** What a shared link points at: a scene carried in the hash, or one stored on the server. */
export type ShareLink = { kind: 'carried'; data: string } | { kind: 'stored'; id: string };

export const SHARE_MESSAGES = {
  missing: 'That shared scene has expired or can’t be found. Ask for a new link.',
  damaged: 'That link is incomplete. Ask for it again.',
  offline: 'Connect to the internet to open this shared scene.',
  unavailable: 'That shared scene couldn’t be loaded. Try again in a moment.',
} as const;

export async function resolveSharedScene(
  link: ShareLink,
  fetchImpl?: typeof fetch,
): Promise<{ ok: true; scene: SharedScene } | { ok: false; message: string }> {
  if (link.kind === 'carried') {
    const raw = decodeShare(link.data);
    const scene = raw === null ? null : readSharePayload(raw);
    return scene ? { ok: true, scene } : { ok: false, message: SHARE_MESSAGES.damaged };
  }
  if (!isShareId(link.id)) return { ok: false, message: SHARE_MESSAGES.missing };
  const res = await fetchStoredShare(link.id, fetchImpl);
  if (!res.ok) return { ok: false, message: SHARE_MESSAGES[res.reason] };
  const scene = readSharePayload(res.payload);
  return scene ? { ok: true, scene } : { ok: false, message: SHARE_MESSAGES.damaged };
}
