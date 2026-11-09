/**
 * BLACK-BOX TEST SUITE — BB-LAB (the Lab's Pages Function)
 * The shared runtime route, called the way Pages calls it.
 *
 * Test focus:
 *  - The runtime is cached for a year, same-origin only, and keys outside <version>/<file> are 404
 *  - A file stored brotli-compressed goes out as stored, with Content-Encoding: br
 *
 * BB-LAB-05 to 07 checked the compile forward, which went with the compile service.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet } from '../../functions/lab-runtime/[[path]]';

afterEach(() => vi.unstubAllGlobals());

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
