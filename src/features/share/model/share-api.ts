import type { SharePayload } from '@/entities/project/model/share';

export type StoreFailure = 'offline' | 'limited' | 'too-large' | 'invalid' | 'unavailable';
export type FetchFailure = 'missing' | 'offline' | 'unavailable';

/** How long a share request may take, reading its answer included, before it counts as offline. */
export const SHARE_REQUEST_TIMEOUT_MS = 8000;

const STATUS: Record<number, StoreFailure> = { 400: 'invalid', 413: 'too-large', 429: 'limited' };

/** Runs `work` with a signal that aborts after the timeout; the timer is cleared once the work settles. */
async function withTimeout<T>(work: (signal: AbortSignal) => Promise<T>, onAbort: T): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SHARE_REQUEST_TIMEOUT_MS);
  try {
    return await work(controller.signal);
  } catch {
    return onAbort;
  } finally {
    clearTimeout(timer);
  }
}

export async function createStoredShare(
  p: SharePayload,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; id: string; expiresAt: string } | { ok: false; reason: StoreFailure }> {
  return withTimeout<{ ok: true; id: string; expiresAt: string } | { ok: false; reason: StoreFailure }>(async (signal) => {
    const res = await fetchImpl('/api/share', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(p), signal });
    if (res.status !== 201) return { ok: false, reason: STATUS[res.status] ?? 'unavailable' };
    const body = (await res.json().catch(() => null)) as { id?: unknown; expiresAt?: unknown } | null;
    if (body && typeof body.id === 'string' && typeof body.expiresAt === 'string') return { ok: true, id: body.id, expiresAt: body.expiresAt };
    return { ok: false, reason: 'unavailable' };
  }, { ok: false, reason: 'offline' });
}

export async function fetchStoredShare(
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; payload: unknown } | { ok: false; reason: FetchFailure }> {
  return withTimeout<{ ok: true; payload: unknown } | { ok: false; reason: FetchFailure }>(async (signal) => {
    const res = await fetchImpl(`/api/share/${encodeURIComponent(id)}`, { signal });
    if (res.status === 404) return { ok: false, reason: 'missing' };
    if (!res.ok) return { ok: false, reason: 'unavailable' };
    try {
      return { ok: true, payload: await res.json() };
    } catch {
      return { ok: false, reason: 'unavailable' };
    }
  }, { ok: false, reason: 'offline' });
}
