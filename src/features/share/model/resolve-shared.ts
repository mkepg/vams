import { decodeShare, readSharePayload, type SharedScene } from '@/entities/project/model/share';
import { LAB_ENABLED } from '@/shared/config/lab';
import type { ShareLink } from '@/shared/lib/scene-view-load';
import { checkLabShape, isLabKind, isShareId, labShareUrl } from '@/shared/lib/share-schema';
import { fetchStoredShare } from './share-api';

export type { ShareLink };

export const SHARE_MESSAGES = {
  missing: 'That shared scene has expired or can’t be found. Ask for a new link.',
  damaged: 'That link is incomplete. Ask for it again.',
  offline: 'Connect to the internet to open this shared scene.',
  unavailable: 'That shared scene couldn’t be loaded. Try again in a moment.',
} as const;

/** Where a stored link to Lab work goes: to /lab, while this build has the Lab. */
export interface LabRoute {
  enabled: boolean;
  /** A full page load, so the Lab starts with its isolation headers. */
  go: (url: string) => void;
}

const LAB_ROUTE: LabRoute = { enabled: LAB_ENABLED, go: (url) => window.location.replace(url) };

/** A scene to open; a message to show; or, for Lab work, the Lab address the page is now loading. */
export type SharedResolution = { ok: true; scene: SharedScene } | { ok: false; message: string } | { ok: false; lab: string };

export async function resolveSharedScene(link: ShareLink, fetchImpl?: typeof fetch, lab: LabRoute = LAB_ROUTE): Promise<SharedResolution> {
  if (link.kind === 'carried') {
    const raw = decodeShare(link.data);
    const scene = raw === null ? null : readSharePayload(raw);
    return scene ? { ok: true, scene } : { ok: false, message: SHARE_MESSAGES.damaged };
  }
  if (!isShareId(link.id)) return { ok: false, message: SHARE_MESSAGES.missing };
  const res = await fetchStoredShare(link.id, fetchImpl);
  if (!res.ok) return { ok: false, message: SHARE_MESSAGES[res.reason] };
  if (isLabKind(res.payload)) {
    // Without the Lab, a Lab link is worded as any link that can't be found.
    if (!lab.enabled) return { ok: false, message: SHARE_MESSAGES.missing };
    if (checkLabShape(res.payload) !== null) return { ok: false, message: SHARE_MESSAGES.damaged };
    const url = labShareUrl(link.id);
    lab.go(url);
    return { ok: false, lab: url };
  }
  const scene = readSharePayload(res.payload);
  return scene ? { ok: true, scene } : { ok: false, message: SHARE_MESSAGES.damaged };
}
