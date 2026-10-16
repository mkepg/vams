/**
 * WHITE-BOX TEST SUITE — WB-SHARE
 * The shared scene payload: what it carries, how it is packed into a link, and how it is read back.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  buildSharePayload, carriedLink, decodeShare, encodeShare, hasUploads, lessonLink, MAX_CARRIED_URL,
  payloadBytes, planShare, readSharePayload, storedLink, withoutUploads, type SharePayload,
} from '@/entities/project/model/share';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { SHARE_ORIGIN } from '@/shared/lib/share-origin';
import { checkShareShape, isShareId, MAX_NAME_LENGTH, MAX_OBJECTS } from '@/shared/lib/share-schema';
import { fitWithin, shrinkPayloadImages, SHARE_IMAGE_MAX } from '@/features/share/model/shrink-image';
import { createStoredShare, fetchStoredShare } from '@/features/share/model/share-api';
import { qrSvg } from '@/shared/lib/qr';
import { addTriangle, getState } from '../helpers/store';

const LIMITS = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
const upload = { id: 'up-1', name: 'Photo', dataUrl: 'data:image/png;base64,AAAA', width: 800, height: 600 };
const sample = { id: 'sample-bricks', name: 'Tiling Bricks', dataUrl: 'data:image/png;base64,', width: 256, height: 256, isSample: true };

function sceneWith(textureIds: string[]): SharePayload {
  addTriangle();
  const objects = getState().objects.map((o, i) => ({ ...o, texture: textureIds[i] ? { textureId: textureIds[i], filter: 'NEAREST' as const, wrap: 'REPEAT' as const } : null }));
  return buildSharePayload({ sceneName: 'Solar system', objects, callbacks: emptyCallbacks(), viewportLimits: LIMITS, canvasBackgroundColor: '#000000', textures: [upload, sample] });
}

/** Deterministic, high-entropy names (mulberry32), so the over-limit data never compresses away or varies. */
function seededName(i: number): string {
  let a = (i + 1) * 0x9e3779b9;
  let out = '';
  for (let k = 0; k < 8; k++) {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    out += (((t ^ (t >>> 14)) >>> 0) % 36).toString(36);
  }
  return out;
}

function overLimitScene(): SharePayload {
  const small = sceneWith([]);
  return { ...small, objects: Array.from({ length: 60 }, (_, i) => ({ ...small.objects[0], id: `o-${i}-${seededName(i)}`, name: `Shape ${seededName(i + 100)}` })) };
}

describe('WB-SHARE-01: The payload carries the scene and only the textures it uses', () => {
  it('lists a used sample by id and leaves unused textures out', () => {
    const p = sceneWith(['sample-bricks']);
    expect(p.v).toBe(1);
    expect(p.name).toBe('Solar system');
    expect(p.objects).toHaveLength(1);
    expect(p.textures).toEqual([{ id: 'sample-bricks', sample: true }]);
    expect(hasUploads(p)).toBe(false);
    const q = sceneWith(['up-1']);
    expect(q.textures).toEqual([{ id: 'up-1', name: 'Photo', dataUrl: upload.dataUrl, width: 800, height: 600 }]);
    expect(hasUploads(q)).toBe(true);
    expect(withoutUploads(q).textures).toEqual([]);
  });
});

describe('WB-SHARE-02: A link round-trips the payload', () => {
  it('encodes to base64url and decodes to the same JSON', () => {
    const p = sceneWith([]);
    const data = encodeShare(p);
    expect(data).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeShare(data)).toEqual(JSON.parse(JSON.stringify(p)));
    expect(carriedLink(p)).toBe(`${SHARE_ORIGIN}/app#s=${data}`);
  });
});

describe('WB-SHARE-03: Damaged link data decodes to null, never throws', () => {
  it('rejects junk, truncation and non-JSON', () => {
    const data = encodeShare(sceneWith([]));
    expect(decodeShare('!!!')).toBeNull();
    expect(decodeShare(data.slice(0, data.length >> 1))).toBeNull();
    expect(decodeShare('')).toBeNull();
    expect(decodeShare('aGVsbG8')).toBeNull();
  });
});

describe('WB-SHARE-04: Reading a payload sanitises it and checks the version', () => {
  it('returns the name and clean project data, or null', () => {
    const p = sceneWith(['up-1']);
    const read = readSharePayload(JSON.parse(JSON.stringify(p)))!;
    expect(read.name).toBe('Solar system');
    expect(read.data.objects).toHaveLength(1);
    expect(read.data.uploadedTextures.map((t) => t.id)).toEqual(['up-1']);
    expect(readSharePayload({ ...p, v: 2 })).toBeNull();
    expect(readSharePayload({ ...p, objects: 'nope' })).toBeNull();
    expect(readSharePayload(null)).toBeNull();
    expect(readSharePayload([])).toBeNull();
    expect(readSharePayload({ ...p, name: '   ' })!.name).toBe('Untitled scene');
    expect(readSharePayload({ ...p, objects: [{ junk: true }] })!.data.objects).toEqual([]);
  });
});

describe('WB-SHARE-05: Small scenes travel in the link, others are stored', () => {
  it('chooses by uploads and by the 1,000-character limit', () => {
    const small = sceneWith([]);
    const plan = planShare(small);
    expect(plan.kind).toBe('carried');
    if (plan.kind === 'carried') expect(plan.url.length).toBeLessThanOrEqual(MAX_CARRIED_URL);
    expect(carriedLink(small).length).toBeLessThanOrEqual(MAX_CARRIED_URL);
    expect(planShare(sceneWith(['up-1'])).kind).toBe('stored');
    const big = overLimitScene();
    expect(carriedLink(big).length).toBeGreaterThan(MAX_CARRIED_URL * 2);
    expect(planShare(big).kind).toBe('stored');
  });
});

describe('WB-SHARE-06: The other link builders', () => {
  it('builds stored and lesson links on the share origin', () => {
    expect(storedLink('k3x9q2Ab')).toBe(`${SHARE_ORIGIN}/s/k3x9q2Ab`);
    expect(lessonLink('transforms-demo-1')).toBe(`${SHARE_ORIGIN}/app?lesson=transforms-demo-1`);
  });
});

describe('WB-SHARE-07: payloadBytes counts UTF-8 bytes', () => {
  it('counts a multibyte name by bytes', () => {
    const p = { ...sceneWith([]), name: 'ü' };
    expect(payloadBytes(p)).toBe(new TextEncoder().encode(JSON.stringify(p)).length);
  });
});

describe('WB-SHARE-08: The shared schema checks structure and ids', () => {
  it('accepts a built payload and names the reason for a bad one', () => {
    const p = JSON.parse(JSON.stringify(sceneWith(['sample-bricks'])));
    expect(checkShareShape(p)).toBeNull();
    expect(checkShareShape({ ...p, v: 2 })).not.toBeNull();
    expect(checkShareShape({ ...p, name: 'x'.repeat(81) })).not.toBeNull();
    expect(checkShareShape({ ...p, textures: [{ id: 'a', dataUrl: 'javascript:1', width: 1, height: 1 }] })).not.toBeNull();
    expect(checkShareShape({ ...p, textures: [{ id: 'a', dataUrl: 'data:image/png;base64,AA', width: NaN, height: 1 }] })).not.toBeNull();
    expect(checkShareShape(null)).not.toBeNull();
    expect(isShareId('k3x9q2Ab')).toBe(true);
    expect(isShareId('../etc')).toBe(false);
  });
});

describe('WB-SHARE-09: Boundaries the server relies on', () => {
  const base = () => JSON.parse(JSON.stringify(sceneWith(['sample-bricks'])));
  it('pins id length and character class', () => {
    expect(isShareId('abcdefg')).toBe(false);
    expect(isShareId('abcdefghi')).toBe(false);
    expect(isShareId('abcdefg-')).toBe(false);
    expect(isShareId('abcdefgh')).toBe(true);
  });
  it('pins the object and name limits', () => {
    const p = base();
    expect(checkShareShape({ ...p, objects: new Array(MAX_OBJECTS).fill({}) })).toBeNull();
    expect(checkShareShape({ ...p, objects: new Array(MAX_OBJECTS + 1).fill({}) })).not.toBeNull();
    expect(checkShareShape({ ...p, name: 'x'.repeat(MAX_NAME_LENGTH) })).toBeNull();
    expect(checkShareShape({ ...p, name: 'x'.repeat(MAX_NAME_LENGTH + 1) })).not.toBeNull();
  });
  it('reads a samples-only scene with no uploads and rejects a null texture', () => {
    const p = base();
    expect(readSharePayload(p)!.data.uploadedTextures).toEqual([]);
    expect(checkShareShape({ ...p, textures: [null] })).not.toBeNull();
    expect(readSharePayload({ ...p, textures: [null] })).toBeNull();
  });
  it('keeps a texture marked sample:false as an upload', () => {
    const p = { ...base(), textures: [{ id: 'up-1', sample: false, name: 'Photo', dataUrl: upload.dataUrl, width: 800, height: 600 }] };
    expect(checkShareShape(p)).toBeNull();
    expect(readSharePayload(p)!.data.uploadedTextures.map((t) => t.id)).toEqual(['up-1']);
  });
});

describe('WB-SHARE-10: Images fit within 512 px, keeping their shape', () => {
  it('scales the longer side to 512 and leaves small images alone', () => {
    expect(SHARE_IMAGE_MAX).toBe(512);
    expect(fitWithin(2048, 1024)).toEqual({ width: 512, height: 256 });
    expect(fitWithin(600, 1800)).toEqual({ width: 171, height: 512 });
    expect(fitWithin(512, 300)).toEqual({ width: 512, height: 300 });
    expect(fitWithin(64, 64)).toEqual({ width: 64, height: 64 });
    expect(fitWithin(5000, 2)).toEqual({ width: 512, height: 1 });
  });

  it('shrinks only the uploads that need it and counts them', async () => {
    const resize = vi.fn(async (_url: string, size: { width: number; height: number }) => `data:image/webp;base64,${size.width}x${size.height}`);
    const p = {
      ...sceneWith(['up-1']),
      textures: [
        { id: 'up-1', name: 'Photo', dataUrl: 'data:image/png;base64,AAAA', width: 2048, height: 1024 },
        { id: 'up-2', name: 'Icon', dataUrl: 'data:image/png;base64,BBBB', width: 32, height: 32 },
        { id: 'sample-bricks', sample: true as const },
      ],
    };
    const { payload, shrunk } = await shrinkPayloadImages(p, resize);
    expect(shrunk).toBe(1);
    expect(resize).toHaveBeenCalledTimes(1);
    expect(payload.textures[0]).toEqual({ id: 'up-1', name: 'Photo', dataUrl: 'data:image/webp;base64,512x256', width: 512, height: 256 });
    expect(payload.textures[1]).toBe(p.textures[1]);
    expect(payload.textures[2]).toBe(p.textures[2]);
  });
});

describe('WB-SHARE-11: Storing a share reports each outcome', () => {
  const respond = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
  it('returns the id and expiry on 201, and a reason otherwise', async () => {
    const p = sceneWith([]);
    expect(await createStoredShare(p, respond(201, { id: 'k3x9q2Ab', expiresAt: '2027-01-14T00:00:00.000Z' }))).toEqual({ ok: true, id: 'k3x9q2Ab', expiresAt: '2027-01-14T00:00:00.000Z' });
    expect(await createStoredShare(p, respond(429, {}))).toEqual({ ok: false, reason: 'limited' });
    expect(await createStoredShare(p, respond(413, {}))).toEqual({ ok: false, reason: 'too-large' });
    expect(await createStoredShare(p, respond(400, {}))).toEqual({ ok: false, reason: 'invalid' });
    expect(await createStoredShare(p, respond(503, {}))).toEqual({ ok: false, reason: 'unavailable' });
    expect(await createStoredShare(p, vi.fn(async () => { throw new TypeError('Failed to fetch'); }))).toEqual({ ok: false, reason: 'offline' });
    const sent = respond(201, { id: 'a', expiresAt: 'b' });
    await createStoredShare(p, sent);
    expect(sent).toHaveBeenCalledWith('/api/share', expect.objectContaining({ method: 'POST' }));
  });
});

describe('WB-SHARE-12: Fetching a stored share reports each outcome', () => {
  it('returns the payload, or missing, offline or unavailable', async () => {
    const ok = vi.fn(async () => new Response('{"v":1}', { status: 200 }));
    expect(await fetchStoredShare('k3x9q2Ab', ok)).toEqual({ ok: true, payload: { v: 1 } });
    expect(ok).toHaveBeenCalledWith('/api/share/k3x9q2Ab');
    expect(await fetchStoredShare('k3x9q2Ab', vi.fn(async () => new Response('', { status: 404 })))).toEqual({ ok: false, reason: 'missing' });
    expect(await fetchStoredShare('k3x9q2Ab', vi.fn(async () => new Response('', { status: 500 })))).toEqual({ ok: false, reason: 'unavailable' });
    expect(await fetchStoredShare('k3x9q2Ab', vi.fn(async () => new Response('not json', { status: 200 })))).toEqual({ ok: false, reason: 'unavailable' });
    expect(await fetchStoredShare('k3x9q2Ab', vi.fn(async () => { throw new TypeError('offline'); }))).toEqual({ ok: false, reason: 'offline' });
  });
});

describe('WB-SHARE-13: QR codes are SVG, dark on white, and deterministic', () => {
  it('draws a square code with a white background', () => {
    const svg = qrSvg('https://vams.pages.dev');
    expect(svg).toMatch(/^<svg[^>]+viewBox="0 0 (\d+) \1"/);
    expect(svg).toContain('fill="#fff"');
    expect(svg).toMatch(/<path fill="#000" d="M/);
    expect(qrSvg('https://vams.pages.dev')).toBe(svg);
    expect(qrSvg('https://vams.pages.dev/s/k3x9q2Ab')).not.toBe(svg);
  });
});
