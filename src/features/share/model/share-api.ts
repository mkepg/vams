import type { SharePayload } from '@/entities/project/model/share';

export type StoreFailure = 'offline' | 'limited' | 'too-large' | 'invalid' | 'unavailable';
export type FetchFailure = 'missing' | 'offline' | 'unavailable';

const STATUS: Record<number, StoreFailure> = { 400: 'invalid', 413: 'too-large', 429: 'limited' };

export async function createStoredShare(
  p: SharePayload,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; id: string; expiresAt: string } | { ok: false; reason: StoreFailure }> {
  let res: Response;
  try {
    res = await fetchImpl('/api/share', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(p) });
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (res.status !== 201) return { ok: false, reason: STATUS[res.status] ?? 'unavailable' };
  const body = (await res.json().catch(() => null)) as { id?: unknown; expiresAt?: unknown } | null;
  if (body && typeof body.id === 'string' && typeof body.expiresAt === 'string') return { ok: true, id: body.id, expiresAt: body.expiresAt };
  return { ok: false, reason: 'unavailable' };
}

export async function fetchStoredShare(
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; payload: unknown } | { ok: false; reason: FetchFailure }> {
  let res: Response;
  try {
    res = await fetchImpl(`/api/share/${encodeURIComponent(id)}`);
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (res.status === 404) return { ok: false, reason: 'missing' };
  if (!res.ok) return { ok: false, reason: 'unavailable' };
  try {
    return { ok: true, payload: await res.json() };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
