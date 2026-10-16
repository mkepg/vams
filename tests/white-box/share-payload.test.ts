/**
 * WHITE-BOX TEST SUITE — WB-SHARE
 * The shared scene payload: what it carries, how it is packed into a link, and how it is read back.
 */
import { describe, it, expect } from 'vitest';
import {
  buildSharePayload, carriedLink, decodeShare, encodeShare, hasUploads, lessonLink, MAX_CARRIED_URL,
  payloadBytes, planShare, readSharePayload, storedLink, withoutUploads, type SharePayload,
} from '@/entities/project/model/share';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { SHARE_ORIGIN } from '@/shared/lib/share-origin';
import { checkShareShape, isShareId } from '@/shared/lib/share-schema';
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
