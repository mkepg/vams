import { isShareId, json, type ShareEnv } from '../../_lib/share-store';

/** GET /api/share/<id>: the stored scene, or 404 once it has expired. */
export async function onRequestGet({ params, env }: { params: { id?: string | string[] }; env: ShareEnv }): Promise<Response> {
  const id = typeof params.id === 'string' ? params.id : '';
  if (!isShareId(id)) return json({ error: 'Not found' }, 404);
  try {
    const text = await env.SHARES.get(id);
    if (text === null) return json({ error: 'Not found' }, 404);
    return new Response(text, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' } });
  } catch {
    return json({ error: 'Shared scenes can’t be read right now.' }, 503);
  }
}
