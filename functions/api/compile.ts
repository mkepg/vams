import { json } from '../_lib/share-store';
import { MAX_COMPILE_BODY_BYTES, type LabEnv } from '../_lib/lab-env';

const PASS_HEADERS = ['content-type', 'content-encoding', 'x-lab-diagnostics', 'retry-after'];

/** POST /api/compile: forward the source to the compile service and return its answer unchanged. */
export async function onRequestPost({
  request,
  env,
}: {
  request: Request;
  env: Pick<LabEnv, 'LAB_COMPILE_URL' | 'LAB_COMPILE_SECRET'>;
}): Promise<Response> {
  const base = env.LAB_COMPILE_URL;
  const secret = env.LAB_COMPILE_SECRET;
  if (!base || !secret) return json({ offline: true }, 503);
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_COMPILE_BODY_BYTES) return json({ error: 'The source is over 200 KB.' }, 413);
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_COMPILE_BODY_BYTES) return json({ error: 'The source is over 200 KB.' }, 413);
  let upstream: Response;
  try {
    upstream = await fetch(`${base.replace(/\/+$/, '')}/compile`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Lab-Secret': secret,
        'X-Lab-Client-IP': request.headers.get('CF-Connecting-IP') ?? '',
      },
      body,
    });
  } catch {
    return json({ offline: true }, 503);
  }
  const headers = new Headers();
  for (const name of PASS_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  // The service gzips the wasm itself; encodeBody keeps the runtime from encoding it a second time.
  return new Response(upstream.body, { status: upstream.status, headers, encodeBody: 'manual' } as ResponseInit);
}
