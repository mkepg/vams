/**
 * BLACK-BOX TEST SUITE — BB-LAB (the Pages Functions)
 * The compile forward and the shared runtime route, called the way Pages calls them.
 *
 * Test focus:
 *  - An oversized body is refused before anything is forwarded
 *  - The secret and client IP reach the service; its answer comes back byte for byte
 *  - A service that cannot be reached, or is not configured, reads as offline
 *  - The runtime is cached for a year, same-origin only, and keys outside <version>/<file> are 404
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost } from '../../functions/api/compile';
import { onRequestGet } from '../../functions/lab-runtime/[[path]]';

const ENV = { LAB_COMPILE_URL: 'https://lab.example.run.app', LAB_COMPILE_SECRET: 's3cret' };

function compileRequest(source: string, ip = '203.0.113.9'): Request {
  return new Request('https://vams.example/api/compile', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify({ source, visitor: 'v1' }),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('BB-LAB-05: the compile body limit', () => {
  it('refuses a body over 200 KB with 413 and forwards nothing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await onRequestPost({ request: compileRequest('x'.repeat(200_001)), env: ENV });
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('BB-LAB-06: the forward', () => {
  it('carries the secret and client IP and passes status, headers and bytes through', async () => {
    const wasm = new Uint8Array([0x1f, 0x8b, 8, 0, 0xff, 0x00, 0x61, 0x73, 0x6d]);
    const fetchMock = vi.fn(
      async () =>
        new Response(wasm, {
          status: 200,
          headers: { 'content-type': 'application/wasm', 'content-encoding': 'gzip', 'x-lab-diagnostics': 'e30=' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const res = await onRequestPost({ request: compileRequest('int main(){}'), env: ENV });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://lab.example.run.app/compile');
    const sent = new Headers(init.headers);
    expect(sent.get('X-Lab-Secret')).toBe('s3cret');
    expect(sent.get('X-Lab-Client-IP')).toBe('203.0.113.9');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/wasm');
    expect(res.headers.get('content-encoding')).toBe('gzip');
    expect(res.headers.get('x-lab-diagnostics')).toBe('e30=');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(wasm);
  });

  it('passes a 422, 429 and 503 answer through with its body', async () => {
    for (const [status, body] of [
      [422, { diagnostics: [] }],
      [429, { limit: 'ip' }],
      [503, { resting: 'day' }],
    ] as const) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })));
      const res = await onRequestPost({ request: compileRequest('x'), env: ENV });
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual(body);
    }
  });
});

describe('BB-LAB-07: offline', () => {
  it('answers 503 { offline: true } when the fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network');
      }),
    );
    const res = await onRequestPost({ request: compileRequest('x'), env: ENV });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ offline: true });
  });

  it('answers 503 { offline: true } without fetching when the URL or secret is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    for (const env of [{ LAB_COMPILE_URL: '', LAB_COMPILE_SECRET: 's3cret' }, { LAB_COMPILE_URL: ENV.LAB_COMPILE_URL }, {}]) {
      const res = await onRequestPost({ request: compileRequest('x'), env });
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ offline: true });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('BB-LAB-08: the shared runtime', () => {
  const bytes = new Uint8Array([0, 0x61, 0x73, 0x6d]);
  const stored: Record<string, { bytes: Uint8Array; metadata: { encoding?: string } | null }> = {
    'v1/main.wasm': { bytes, metadata: null },
    'v1/llvm.core.wasm': { bytes: new Uint8Array([9, 9]), metadata: { encoding: 'br' } },
    'v1/llvm-resources.tar': { bytes: new Uint8Array([1]), metadata: null },
  };
  const kvGet = vi.fn(async (key: string) => {
    const file = stored[key];
    return file ? { value: new Response(file.bytes).body, metadata: file.metadata } : { value: null, metadata: null };
  });
  const env = { LAB_RUNTIME: { getWithMetadata: kvGet } } as unknown as Parameters<typeof onRequestGet>[0]['env'];
  const get = (path: string[]) => onRequestGet({ params: { path }, env });

  it('serves a file with the immutable cache header, CORP and its content type', async () => {
    const res = await get(['v1', 'main.wasm']);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(res.headers.get('cross-origin-resource-policy')).toBe('same-origin');
    expect(res.headers.get('content-type')).toBe('application/wasm');
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
    expect((await get(['v1', 'llvm-resources.tar'])).headers.get('content-type')).toBe('application/x-tar');
  });

  it('sends a file stored brotli-compressed as it is stored, with Content-Encoding: br', async () => {
    const res = await get(['v1', 'llvm.core.wasm']);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-encoding')).toBe('br');
    expect(res.headers.get('content-type')).toBe('application/wasm');
    expect(kvGet).toHaveBeenCalledWith('v1/llvm.core.wasm', 'stream');
  });

  it('answers 404 for a missing file, and 503 when the store fails', async () => {
    expect((await get(['v1', 'gone.wasm'])).status).toBe(404);
    kvGet.mockRejectedValueOnce(new Error('down'));
    expect((await get(['v1', 'main.wasm'])).status).toBe(503);
  });

  it('answers 404 for traversal and keys outside <version>/<file>', async () => {
    kvGet.mockClear();
    const bad = [['..', 'main.wasm'], ['v1', '..'], ['v1', '..', 'main.wasm'], ['v1'], ['v1', 'a', 'b'], ['v1', ''], ['', 'main.wasm'], ['v1', '.hidden'], ['v1/..', 'x'], []];
    for (const path of bad) expect((await get(path)).status).toBe(404);
    expect(kvGet).not.toHaveBeenCalled();
  });
});
