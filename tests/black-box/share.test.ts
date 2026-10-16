/**
 * BLACK-BOX TEST SUITE — BB-SHARE
 * Sharing a scene: choosing the link, the dialog's states, copying and the QR code.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useVamsStore } from '@/core/store';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { carriedLink, buildSharePayload, MAX_CARRIED_URL } from '@/entities/project/model/share';
import { prepareShare, ShareButton, ShareDialog, useShareDialog, type ShareResult } from '@/features/share';
import { SHARE_ORIGIN } from '@/shared/lib/share-origin';
import { addTriangle, getState } from '../helpers/store';

async function settle() {
  for (let i = 0; i < 8; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}
function mount(vnode: VNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(vnode, host);
  return host;
}
function unmount(host: HTMLElement) {
  render(null, host);
  host.remove();
}
const LIMITS = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
const upload = { id: 'up-1', name: 'Photo', dataUrl: 'data:image/png;base64,AAAA', width: 2048, height: 1024 };
function input(extra: Partial<Parameters<typeof prepareShare>[0]> = {}) {
  addTriangle();
  return { sceneName: 'Solar system', objects: getState().objects, callbacks: emptyCallbacks(), viewportLimits: LIMITS, canvasBackgroundColor: '#000000', textures: [], lesson: null, ...extra };
}
const textured = () => {
  const base = input({ textures: [upload] });
  return { ...base, objects: base.objects.map((o) => ({ ...o, texture: { textureId: 'up-1', filter: 'NEAREST' as const, wrap: 'REPEAT' as const } })) };
};
const shrink = async (p: never) => ({ payload: p, shrunk: 1 });

/** Deterministic, high-entropy names (mulberry32), so the over-limit scene never compresses away or varies. */
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
function overLimit() {
  const base = input();
  return { ...base, objects: Array.from({ length: 60 }, (_, i) => ({ ...base.objects[0], id: `o-${i}-${seededName(i)}`, name: `Shape ${seededName(i + 100)}` })) };
}

afterEach(() => {
  useShareDialog.getState().close();
  useVamsStore.setState({ appMode: 'Author', activeLessonId: null });
});

describe('BB-SHARE-01: A small scene shares a link that carries it', () => {
  it('needs no server', async () => {
    const store = vi.fn();
    const r = await prepareShare(input(), { store });
    expect(r.kind).toBe('carried');
    const url = (r as Extract<ShareResult, { kind: 'carried' }>).url;
    expect(url.startsWith(`${SHARE_ORIGIN}/app#s=`)).toBe(true);
    expect(url.length).toBeLessThanOrEqual(MAX_CARRIED_URL);
    expect(store).not.toHaveBeenCalled();
  });
});

describe('BB-SHARE-02: A scene with an uploaded image is stored, shrunk', () => {
  it('returns the short link and the expiry', async () => {
    const store = vi.fn(async () => ({ ok: true as const, id: 'k3x9q2Ab', expiresAt: '2027-01-14T00:00:00.000Z' }));
    const r = await prepareShare(textured(), { store, shrink });
    expect(r).toEqual({ kind: 'stored', url: `${SHARE_ORIGIN}/s/k3x9q2Ab`, expiresAt: '2027-01-14T00:00:00.000Z', shrunk: 1 });
  });
});

describe('BB-SHARE-03: When storing fails, the link leaves the uploads out, or there is no link', () => {
  it('falls back to a carried link, and fails when even that is too long', async () => {
    const store = vi.fn(async () => ({ ok: false as const, reason: 'offline' as const }));
    const r = await prepareShare(textured(), { store, shrink });
    expect(r.kind).toBe('fallback');
    const huge = overLimit();
    expect(carriedLink(buildSharePayload({ ...huge, textures: [] })).length).toBeGreaterThan(MAX_CARRIED_URL * 2);
    expect((await prepareShare({ ...huge, textures: [upload] }, { store, shrink })).kind).toBe('failed');
  });
});

describe('BB-SHARE-04: During a lesson, Share gives the lesson link', () => {
  it('uses ?lesson=', async () => {
    const r = await prepareShare(input({ lesson: { id: 'transforms-demo-1', title: 'Transforms 1' } }));
    expect(r).toEqual({ kind: 'lesson', url: `${SHARE_ORIGIN}/app?lesson=transforms-demo-1`, title: 'Transforms 1' });
  });
});

describe('BB-SHARE-05: The dialog shows the link, the note and the QR code', () => {
  it('reads as approved for a carried link', async () => {
    addTriangle();
    useVamsStore.setState({ sceneName: 'Solar system' });
    const host = mount(h('div', {}, h(ShareButton, {}), h(ShareDialog, { lessonTitle: null })));
    (host.querySelector('.share-button') as HTMLButtonElement).click();
    await settle();
    const dialog = document.querySelector('.share-dialog')!;
    expect(dialog.querySelector('h2')!.textContent).toBe('Share ‘Solar system’');
    expect(dialog.textContent).toContain('Anyone with the link opens a copy of this scene. On a phone it opens as a view.');
    expect((dialog.querySelector('.share-dialog__link') as HTMLInputElement).value).toMatch(/\/app#s=/);
    expect(dialog.textContent).toContain('This link carries your scene and never expires.');
    expect(dialog.querySelector('.qr-code svg')).not.toBeNull();
    expect(dialog.querySelector('.qr-code')!.getAttribute('aria-label')).toBe('QR code for this link');
    unmount(host);
  });
});

describe('BB-SHARE-06: Copy link copies and says so', () => {
  it('writes the link to the clipboard', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    addTriangle();
    const host = mount(h(ShareDialog, { lessonTitle: null }));
    useShareDialog.getState().show();
    await settle();
    const url = (document.querySelector('.share-dialog__link') as HTMLInputElement).value;
    ([...document.querySelectorAll('.share-dialog button')].find((b) => b.textContent === 'Copy link') as HTMLButtonElement).click();
    await settle();
    expect(writeText).toHaveBeenCalledWith(url);
    unmount(host);
  });
});

describe('BB-SHARE-07: Done closes the dialog and focus returns to Share', () => {
  it('restores focus', async () => {
    addTriangle();
    const host = mount(h('div', {}, h(ShareButton, {}), h(ShareDialog, { lessonTitle: null })));
    const button = host.querySelector('.share-button') as HTMLButtonElement;
    button.focus();
    button.click();
    await settle();
    ([...document.querySelectorAll('.share-dialog button')].find((b) => b.textContent === 'Done') as HTMLButtonElement).click();
    await settle();
    expect(document.querySelector('.share-dialog')).toBeNull();
    expect(document.activeElement).toBe(button);
    unmount(host);
  });
});

describe('BB-SHARE-08: The dialog words each state', () => {
  it('stored, shrunk, fallback, failed and lesson', async () => {
    const { ShareResultView } = await import('@/features/share/ui/ShareDialog');
    const view = (result: ShareResult) => {
      const host = mount(h(ShareResultView, { result, onSaveFile: () => {} }));
      const text = host.textContent ?? '';
      unmount(host);
      return text;
    };
    expect(view({ kind: 'stored', url: 'u', expiresAt: '2027-01-14T00:00:00.000Z', shrunk: 1 })).toContain('Stored for 90 days, until 14 Jan 2027.');
    expect(view({ kind: 'stored', url: 'u', expiresAt: '2027-01-14T00:00:00.000Z', shrunk: 1 })).toContain('Your uploaded image is shared at 512 px.');
    expect(view({ kind: 'stored', url: 'u', expiresAt: '2027-01-14T00:00:00.000Z', shrunk: 2 })).toContain('Your uploaded images are shared at 512 px.');
    expect(view({ kind: 'fallback', url: 'u' })).toContain('Your uploaded images are left out.');
    expect(view({ kind: 'failed' })).toContain('Couldn’t make a link right now.');
    expect(view({ kind: 'lesson', url: 'u', title: 'Transforms 1' })).toContain('Anyone with the link opens this lesson.');
  });
});

describe('BB-SHARE-09: An image that cannot be resized never leaves the dialog waiting', () => {
  it('gives the link without the uploads, or no link when that is too long', async () => {
    const store = vi.fn();
    const broken = async () => {
      throw new Error('The image could not be decoded');
    };
    const r = await prepareShare(textured(), { store, shrink: broken });
    expect(r.kind).toBe('fallback');
    expect(store).not.toHaveBeenCalled();
    const huge = overLimit();
    expect((await prepareShare({ ...huge, textures: [upload] }, { store, shrink: broken })).kind).toBe('failed');
  });
});
