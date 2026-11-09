import { json } from '../_lib/share-store';
import type { LabEnv } from '../_lib/lab-env';

const TYPES: Record<string, string> = {
  wasm: 'application/wasm',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  tar: 'application/x-tar',
};
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * GET /lab-runtime/<version>/<file>: a file of the shared runtime, which holds the main module,
 * the compiler and the headers it reads. A version never changes, so the answer is cached for a
 * year. A file stored brotli-compressed (metadata `{ encoding: 'br' }`) goes out as it is stored,
 * with Content-Encoding: br, and the browser unpacks it as it arrives.
 */
export async function onRequestGet({
  params,
  env,
}: {
  params: { path?: string | string[] };
  env: Pick<LabEnv, 'LAB_RUNTIME'>;
}): Promise<Response> {
  const parts = Array.isArray(params.path) ? params.path : typeof params.path === 'string' ? [params.path] : [];
  if (parts.length !== 2 || !parts.every((p) => SEGMENT.test(p) && !p.includes('..'))) return json({ error: 'Not found' }, 404);
  try {
    const { value, metadata } = await env.LAB_RUNTIME.getWithMetadata<{ encoding?: string }>(parts.join('/'), 'stream');
    if (value === null) return json({ error: 'Not found' }, 404);
    const ext = parts[1].slice(parts[1].lastIndexOf('.') + 1).toLowerCase();
    const headers: Record<string, string> = {
      'content-type': TYPES[ext] ?? 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
      'cross-origin-resource-policy': 'same-origin',
    };
    if (metadata?.encoding === 'br') {
      headers['content-encoding'] = 'br';
      // Workers would compress the body again; manual sends the stored bytes as they are.
      return new Response(value, { status: 200, headers, encodeBody: 'manual' } as ResponseInit);
    }
    return new Response(value, { status: 200, headers });
  } catch {
    return json({ error: 'The runtime can’t be read right now.' }, 503);
  }
}

/** HEAD /lab-runtime/<version>/<file>: GET's status and headers, without the body. */
export async function onRequestHead(context: Parameters<typeof onRequestGet>[0]): Promise<Response> {
  const res = await onRequestGet(context);
  await res.body?.cancel();
  return new Response(null, { status: res.status, headers: res.headers });
}
