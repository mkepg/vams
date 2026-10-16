/**
 * WHITE-BOX TEST SUITE — WB-SHAREFN
 * The Pages Function behind stored share links, run against an in-memory KV.
 */
import { describe, it, expect } from 'vitest';
import { onRequestPost } from '../../functions/api/share';
import { onRequestGet } from '../../functions/api/share/[id]';
import { MAX_PAYLOAD_BYTES, newShareId, TTL_SECONDS, type KvLike, type ShareEnv } from '../../functions/_lib/share-store';

class MemoryKv implements KvLike {
  entries = new Map<string, { value: string; ttl?: number }>();
  failPut = false;
  async get(key: string) {
    return this.entries.get(key)?.value ?? null;
  }
  async put(key: string, value: string, options?: { expirationTtl?: number }) {
    if (this.failPut) throw new Error('KV down');
    this.entries.set(key, { value, ttl: options?.expirationTtl });
  }
}

const payload = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({ v: 1, name: 'Solar system', objects: [], callbacks: {}, viewportLimits: {}, canvasBackgroundColor: '#000000', textures: [], ...extra });
const post = (env: ShareEnv, body: string, ip = '203.0.113.7') =>
  onRequestPost({ request: new Request('https://vams.pages.dev/api/share', { method: 'POST', body, headers: { 'CF-Connecting-IP': ip } }), env });
const get = (env: ShareEnv, id: string) => onRequestGet({ params: { id }, env });

describe('WB-SHAREFN-01: A valid share is stored for 90 days and read back', () => {
  it('returns 201 with an 8-character id, and GET returns the same JSON', async () => {
    const kv = new MemoryKv();
    const res = await post({ SHARES: kv }, payload());
    expect(res.status).toBe(201);
    const { id, expiresAt } = (await res.json()) as { id: string; expiresAt: string };
    expect(id).toMatch(/^[0-9A-Za-z]{8}$/);
    expect(kv.entries.get(id)!.ttl).toBe(TTL_SECONDS);
    expect(TTL_SECONDS).toBe(7_776_000);
    expect(Date.parse(expiresAt) - Date.now()).toBeGreaterThan(89 * 86_400_000);
    const back = await get({ SHARES: kv }, id);
    expect(back.status).toBe(200);
    expect(await back.text()).toBe(payload());
  });
});

describe('WB-SHAREFN-02: Malformed payloads are refused with 400', () => {
  it('rejects non-JSON, the wrong version, bad arrays and non-image data URLs', async () => {
    const kv = new MemoryKv();
    for (const body of [
      'not json',
      '[]',
      payload({ v: 2 }),
      payload({ objects: 'x' }),
      payload({ name: 'x'.repeat(81) }),
      payload({ textures: [{ id: 'a', name: 'x', dataUrl: 'data:text/html;base64,PGI+', width: 1, height: 1 }] }),
      payload({ textures: [{ id: 'a' }] }),
    ]) {
      expect((await post({ SHARES: kv }, body)).status).toBe(400);
    }
    expect(kv.entries.size).toBe(0);
    expect((await post({ SHARES: kv }, payload({ textures: [{ id: 'sample-bricks', sample: true }, { id: 'u', name: 'p', dataUrl: 'data:image/webp;base64,AAAA', width: 2, height: 2 }] }))).status).toBe(201);
  });
});

describe('WB-SHAREFN-03: A payload over 1 MB is refused with 413', () => {
  it('counts bytes, not characters', async () => {
    const kv = new MemoryKv();
    const big = payload({ name: 'ok', objects: [{ pad: 'x'.repeat(MAX_PAYLOAD_BYTES) }] });
    expect((await post({ SHARES: kv }, big)).status).toBe(413);
    expect(kv.entries.size).toBe(0);
  });
});

describe('WB-SHAREFN-04: The rate limiter turns a visitor away with 429', () => {
  it('asks the limiter by the visitor address and stores nothing when refused', async () => {
    const kv = new MemoryKv();
    const keys: string[] = [];
    const env: ShareEnv = { SHARES: kv, SHARE_LIMITER: { limit: async ({ key }) => { keys.push(key); return { success: false }; } } };
    expect((await post(env, payload(), '198.51.100.4')).status).toBe(429);
    expect(keys).toEqual(['198.51.100.4']);
    expect(kv.entries.size).toBe(0);
  });
});

describe('WB-SHAREFN-05: Storage failures answer 503', () => {
  it('reports a failed write', async () => {
    const kv = new MemoryKv();
    kv.failPut = true;
    expect((await post({ SHARES: kv }, payload())).status).toBe(503);
  });
});

describe('WB-SHAREFN-06: Unknown and malformed ids are 404', () => {
  it('never reads the store for an id of the wrong shape', async () => {
    const kv = new MemoryKv();
    expect((await get({ SHARES: kv }, 'k3x9q2Ab')).status).toBe(404);
    expect((await get({ SHARES: kv }, '../etc')).status).toBe(404);
    expect((await get({ SHARES: kv }, '')).status).toBe(404);
  });
});

describe('WB-SHAREFN-07: Ids are 8 base62 characters, uniformly drawn', () => {
  it('skips bytes past the last full alphabet cycle', () => {
    const feed = (bytes: number[]) => (out: Uint8Array) => {
      out.set(bytes.slice(0, out.length).concat(Array(Math.max(0, out.length - bytes.length)).fill(0)));
      return out;
    };
    // 255, 254 and 248 are skipped; then 0→0, 1→1, 2→2, 61→z, 62→0, 63→1, 124→0, 247→z.
    expect(newShareId(feed([255, 254, 248, 0, 1, 2, 61, 62, 63, 124, 247]))).toBe('012z010z');
    expect(newShareId()).toMatch(/^[0-9A-Za-z]{8}$/);
  });
});
