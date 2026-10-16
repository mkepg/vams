import { checkPayload, json, MAX_PAYLOAD_BYTES, newShareId, TTL_SECONDS, type ShareEnv } from '../_lib/share-store';

/** POST /api/share: store a shared scene for 90 days and return its id. Nothing about the visitor is stored. */
export async function onRequestPost({ request, env }: { request: Request; env: ShareEnv }): Promise<Response> {
  if (env.SHARE_LIMITER) {
    const key = request.headers.get('CF-Connecting-IP') ?? 'anonymous';
    const { success } = await env.SHARE_LIMITER.limit({ key });
    if (!success) return json({ error: 'Too many shares. Try again in a minute.' }, 429);
  }
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_PAYLOAD_BYTES) return json({ error: 'The scene is over 1 MB.' }, 413);
  const text = await request.text();
  const check = checkPayload(text);
  if (!check.ok) return json({ error: check.error }, check.status);
  try {
    let id = newShareId();
    for (let i = 0; i < 3 && (await env.SHARES.get(id)) !== null; i++) id = newShareId();
    await env.SHARES.put(id, text, { expirationTtl: TTL_SECONDS, metadata: { createdAt: Date.now() } });
    return json({ id, expiresAt: new Date(Date.now() + TTL_SECONDS * 1000).toISOString() }, 201);
  } catch {
    return json({ error: 'Shared scenes can’t be stored right now.' }, 503);
  }
}
