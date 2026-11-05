/**
 * BLACK-BOX TEST SUITE — BB-SHARE
 * Sharing a scene: choosing the link, the dialog's states, copying and the QR code.
 * Sharing Lab work: the stored payload, the way from /s/<id> to /lab?share=<id>, and its images.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useVamsStore } from '@/core/store';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { carriedLink, buildSharePayload, MAX_CARRIED_URL } from '@/entities/project/model/share';
import { createStoredShare } from '@/features/share/model/share-api';
import { clearShareMemory, prepareShare, ShareButton, ShareDialog, useShareDialog, type ShareResult } from '@/features/share';
import { SHARE_ORIGIN } from '@/shared/lib/share-origin';
import { addTriangle, getState } from '../helpers/store';
import { act } from 'preact/test-utils';
import { fetchStoredShare } from '@/features/share/model/share-api';
import { resolveSharedScene, SHARE_MESSAGES } from '@/features/share';
import { imageSize, LAB_SHARE_COPY, LAB_SHARE_MESSAGES, labShareUrl, prepareLabShare, readLabShare } from '@/features/share/lab';
import { checkLabShape, MAX_LAB_FILES, MAX_LAB_SOURCE, MAX_STORED_BYTES, type LabSharePayload } from '@/shared/lib/share-schema';
import { openSharedScene } from '@/pages/editor/model/open-shared';
import { TEMPLATE, useLabStore } from '@/entities/lab-project';
import { REPLACE_QUESTION } from '@/features/lab-files';
import { runController, type WorkerLike } from '@/features/lab-run';
import type { StartMessage, WorkerMessage } from '@/features/lab-run/model/protocol';
import type { CompileResult } from '@/features/lab-compile';
import { LabWorkspace } from '@/widgets/lab-workspace';
import { useLabStage } from '@/widgets/lab-workspace/model/stage-store';
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog';
import { useConfirmStore } from '@/shared/ui/confirm-dialog/confirm-store';
import { onRequestPost } from '../../functions/api/share';
import { onRequestGet } from '../../functions/api/share/[id]';
import { TTL_SECONDS, type KvLike } from '../../functions/_lib/share-store';
import { decodePng, encodePng } from '../helpers/image-compare';

vi.mock('@/features/share/model/share-api', () => ({ createStoredShare: vi.fn(), fetchStoredShare: vi.fn() }));

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

const STORED = { ok: true as const, id: 'k3x9q2Ab', expiresAt: '2027-01-14T00:00:00.000Z' };

beforeEach(() => {
  clearShareMemory();
  vi.mocked(createStoredShare).mockResolvedValue(STORED);
});

afterEach(() => {
  useShareDialog.getState().close();
  useVamsStore.setState({ appMode: 'Author', activeLessonId: null });
});

describe('BB-SHARE-01: A small scene shares the short stored link', () => {
  it('stores the scene and gives /s/<id>', async () => {
    const store = vi.fn(async () => STORED);
    const r = await prepareShare(input(), { store, shrink });
    expect(r).toEqual({ kind: 'stored', url: `${SHARE_ORIGIN}/s/k3x9q2Ab`, expiresAt: STORED.expiresAt, shrunk: 1 });
    expect(store).toHaveBeenCalledTimes(1);
  });
});

describe('BB-SHARE-02: A scene with an uploaded image is stored, shrunk', () => {
  it('returns the short link and the expiry', async () => {
    const store = vi.fn(async () => ({ ok: true as const, id: 'k3x9q2Ab', expiresAt: '2027-01-14T00:00:00.000Z' }));
    const r = await prepareShare(textured(), { store, shrink });
    expect(r).toEqual({ kind: 'stored', url: `${SHARE_ORIGIN}/s/k3x9q2Ab`, expiresAt: '2027-01-14T00:00:00.000Z', shrunk: 1 });
  });
});

describe('BB-SHARE-03: When storing fails, the link carries the scene, or leaves the uploads out, or there is no link', () => {
  const store = vi.fn(async () => ({ ok: false as const, reason: 'offline' as const }));
  it('carries a small scene, whole', async () => {
    const r = await prepareShare(input(), { store, shrink });
    expect(r.kind).toBe('carried');
    const url = (r as Extract<ShareResult, { kind: 'carried' }>).url;
    expect(url.startsWith(`${SHARE_ORIGIN}/app#s=`)).toBe(true);
    expect(url.length).toBeLessThanOrEqual(MAX_CARRIED_URL);
  });
  it('leaves uploads out, and fails when even that is too long', async () => {
    const r = await prepareShare(textured(), { store, shrink });
    expect(r.kind).toBe('fallback');
    const huge = overLimit();
    expect(carriedLink(buildSharePayload({ ...huge, textures: [] })).length).toBeGreaterThan(MAX_CARRIED_URL * 2);
    expect((await prepareShare({ ...huge, textures: [upload] }, { store, shrink })).kind).toBe('failed');
    expect((await prepareShare(huge, { store, shrink })).kind).toBe('failed');
  });
});

describe('BB-SHARE-04: During a lesson, Share gives the lesson link', () => {
  it('uses ?lesson=', async () => {
    const r = await prepareShare(input({ lesson: { id: 'transforms-demo-1', title: 'Transforms 1' } }));
    expect(r).toEqual({ kind: 'lesson', url: `${SHARE_ORIGIN}/app?lesson=transforms-demo-1`, title: 'Transforms 1' });
  });
});

describe('BB-SHARE-05: The dialog shows the link, the note and the QR code', () => {
  it('reads as approved for a stored link', async () => {
    addTriangle();
    useVamsStore.setState({ sceneName: 'Solar system' });
    const host = mount(h('div', {}, h(ShareButton, {}), h(ShareDialog, { lessonTitle: null })));
    (host.querySelector('.share-button') as HTMLButtonElement).click();
    await settle();
    const dialog = document.querySelector('.share-dialog')!;
    expect(dialog.querySelector('h2')!.textContent).toBe('Share ‘Solar system’');
    expect(dialog.textContent).toContain('Anyone with the link opens a copy of this scene. On a phone it opens as a view.');
    expect((dialog.querySelector('.share-dialog__link') as HTMLInputElement).value).toBe(`${SHARE_ORIGIN}/s/k3x9q2Ab`);
    expect(dialog.textContent).toContain('Stored for 90 days, until 14 Jan 2027.');
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
  it('stored, shrunk, carried, fallback, failed and lesson', async () => {
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
    expect(view({ kind: 'carried', url: 'u' })).toContain('Couldn’t store it right now, so this link carries your scene instead. It never expires.');
    expect(view({ kind: 'fallback', url: 'u' })).toContain('Couldn’t store your uploaded images, so this link leaves them out.');
    expect(view({ kind: 'failed' })).toContain('Couldn’t make a link right now.');
    expect(view({ kind: 'lesson', url: 'u', title: 'Transforms 1' })).toContain('Anyone with the link opens this lesson.');
  });
});

describe('BB-SHARE-09: An image that cannot be resized never leaves the dialog waiting', () => {
  it('takes the same path as a failed store', async () => {
    const store = vi.fn();
    const broken = async () => {
      throw new Error('The image could not be decoded');
    };
    const r = await prepareShare(textured(), { store, shrink: broken });
    expect(r.kind).toBe('fallback');
    expect((await prepareShare(input(), { store, shrink: broken })).kind).toBe('carried');
    expect(store).not.toHaveBeenCalled();
    const huge = overLimit();
    expect((await prepareShare({ ...huge, textures: [upload] }, { store, shrink: broken })).kind).toBe('failed');
  });
});

describe('BB-SHARE-10: In a lesson the dialog says who can open the link once', () => {
  it('titles the lesson and words it in one note, without a lead', async () => {
    useVamsStore.setState({ appMode: 'Lesson', activeLessonId: 'transforms-demo-1' });
    const host = mount(h(ShareDialog, { lessonTitle: 'Transforms 1' }));
    useShareDialog.getState().show();
    await settle();
    const dialog = document.querySelector('.share-dialog')!;
    expect(dialog.querySelector('h2')!.textContent).toBe('Share this lesson');
    expect(dialog.textContent!.split('Anyone with the link opens this lesson.').length - 1).toBe(1);
    expect(dialog.querySelector('.share-dialog__lead')).toBeNull();
    unmount(host);
  });
});

describe('BB-SHARE-11: An unchanged scene reuses its stored link', () => {
  it('stores once for the same scene and again after a change', async () => {
    const store = vi.fn(async () => STORED);
    const scene = input();
    const first = await prepareShare(scene, { store, shrink });
    const second = await prepareShare({ ...scene }, { store, shrink });
    expect(store).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    await prepareShare({ ...scene, sceneName: 'Moons' }, { store, shrink });
    expect(store).toHaveBeenCalledTimes(2);
  });
  it('does not remember a failed store', async () => {
    const store = vi.fn(async () => ({ ok: false as const, reason: 'offline' as const }));
    const scene = input();
    await prepareShare(scene, { store, shrink });
    await prepareShare(scene, { store, shrink });
    expect(store).toHaveBeenCalledTimes(2);
  });
});

// ---- Lab work ----------------------------------------------------------------------------------

class MemoryKv implements KvLike {
  entries = new Map<string, { value: string; ttl?: number }>();
  async get(key: string) {
    return this.entries.get(key)?.value ?? null;
  }
  async put(key: string, value: string, options?: { expirationTtl?: number }) {
    this.entries.set(key, { value, ttl: options?.expirationTtl });
  }
}

class FakeWorker implements WorkerLike {
  started: StartMessage | null = null;
  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  postMessage(message: StartMessage) {
    this.started = message;
  }
  terminate() {}
}

const postShare = (kv: KvLike, body: string) =>
  onRequestPost({ request: new Request('https://vams.pages.dev/api/share', { method: 'POST', body, headers: { 'CF-Connecting-IP': '203.0.113.7' } }), env: { SHARES: kv } });
const getShare = (kv: KvLike, id: string) => onRequestGet({ params: { id }, env: { SHARES: kv } });

const utf8 = (text: string) => new TextEncoder().encode(text);
const blankPng = (width: number, height: number) => encodePng({ width, height, data: new Uint8Array(width * height * 4) });
/** A 2 × 2, 24-bit BMP: blue, green, red, white. */
const BMP = Uint8Array.from([
  0x42, 0x4d, 70, 0, 0, 0, 0, 0, 0, 0, 54, 0, 0, 0,
  40, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 1, 0, 24, 0, 0, 0, 0, 0, 16, 0, 0, 0, 0x13, 0x0b, 0, 0, 0x13, 0x0b, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  255, 0, 0, 0, 255, 0, 0, 0, 0, 0, 255, 255, 255, 255, 0, 0,
]);
/** The start of a baseline JPEG (APP0, then SOF0) that says it is width × height. */
const jpegHeader = (width: number, height: number) =>
  Uint8Array.from([
    0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
    0xff, 0xc0, 0, 17, 8, height >> 8, height & 255, width >> 8, width & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1,
  ]);
const INPUT_TXT = utf8('\ufeff3\r\n1 2 3\r\n');
const SOURCE = '#include <GL/freeglut.h>\nint main(int argc, char** argv) { return 0; }\n';

const labFile = (name: string, bytes: Uint8Array, type: string) => ({ name, bytes, type });
const labWork = () => ({
  source: SOURCE,
  files: [
    labFile('Input.txt', INPUT_TXT, 'text/plain'),
    labFile('tiles.bmp', BMP, 'image/bmp'),
    labFile('Sky.png', blankPng(1024, 512), 'image/png'),
    labFile('small.png', blankPng(16, 8), 'image/png'),
  ],
});
/** Draws the image again at the size asked for, as the browser's canvas does, as a PNG. */
const resize = vi.fn(async (_bytes: Uint8Array, _type: string, size: { width: number; height: number }) => blankPng(size.width, size.height));

/** The payload prepareLabShare stored, as the server keeps it. */
async function storedLabPayload(work = labWork()): Promise<LabSharePayload> {
  let sent: unknown = null;
  const store = vi.fn(async (p: unknown) => {
    sent = p;
    return STORED;
  });
  await prepareLabShare(work, { store, resize });
  return JSON.parse(JSON.stringify(sent)) as LabSharePayload;
}

const flushLab = async () => {
  for (let i = 0; i < 8; i++) await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
};
const labButton = (root: ParentNode, label: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent?.replace('▶', '').trim() === label) as HTMLButtonElement | undefined;

describe('Lab work', () => {
  let workers: FakeWorker[] = [];
  const labHosts: HTMLElement[] = [];

  beforeEach(() => {
    workers = [];
    resize.mockClear();
    runController.setWorkerFactory(() => {
      const w = new FakeWorker();
      workers.push(w);
      return w;
    });
    useLabStage.getState().reset();
  });

  afterEach(() => {
    for (const host of labHosts.splice(0)) {
      act(() => render(null, host));
      host.remove();
    }
    runController.reset();
    useConfirmStore.setState({ open: false, options: null, resolve: null });
    vi.mocked(fetchStoredShare).mockReset();
    window.history.replaceState(null, '', '/');
  });

  /** The workspace with the confirm host the Lab page gives it. */
  function mountLab() {
    const host = document.createElement('div');
    document.body.appendChild(host);
    labHosts.push(host);
    const compile = async (): Promise<CompileResult> => ({ kind: 'ok', module: new ArrayBuffer(8), diagnostics: [] });
    act(() => render(h('div', null, h(LabWorkspace, { compile }), h(ConfirmDialog, null)), host));
    return host;
  }

  describe('BB-SHARE-12: A Lab payload is stored for 90 days and returned as sent', () => {
    it('stores kind lab with v 1, and GET gives back the same JSON', async () => {
      const kv = new MemoryKv();
      const body = JSON.stringify(await storedLabPayload());
      expect(JSON.parse(body)).toMatchObject({ kind: 'lab', v: 1, source: SOURCE });
      const res = await postShare(kv, body);
      expect(res.status).toBe(201);
      const { id, expiresAt } = (await res.json()) as { id: string; expiresAt: string };
      expect(kv.entries.get(id)!.ttl).toBe(TTL_SECONDS);
      expect(TTL_SECONDS).toBe(90 * 24 * 60 * 60);
      expect(Date.parse(expiresAt) - Date.now()).toBeGreaterThan(89 * 86_400_000);
      const back = await getShare(kv, id);
      expect(back.status).toBe(200);
      expect(await back.text()).toBe(body);
    });

    it('refuses WebP, a name the list would not take, a path, code over 200,000 characters and another version', async () => {
      const kv = new MemoryKv();
      const lab = (extra: Record<string, unknown>) => JSON.stringify({ kind: 'lab', v: 1, source: 'int main() {}', files: [], ...extra });
      for (const body of [
        lab({ files: [{ name: 'a.webp', dataUrl: 'data:image/webp;base64,AAAA' }] }),
        lab({ files: [{ name: 'a.png', dataUrl: 'data:image/webp;base64,AAAA' }] }),
        lab({ files: [{ name: 'a.png', dataUrl: 'data:text/html;base64,PGI+' }] }),
        lab({ files: [{ name: 'notes.docx', text: 'x' }] }),
        lab({ files: [{ name: 'a.txt', dataUrl: 'data:image/png;base64,AAAA' }] }),
        lab({ files: [{ name: '../a.txt', text: 'x' }] }),
        lab({ files: [{ name: 'C:\\a.txt', text: 'x' }] }),
        lab({ files: [{ name: '', text: 'x' }] }),
        lab({ files: 'x' }),
        lab({ source: 'x'.repeat(MAX_LAB_SOURCE + 1) }),
        lab({ source: 42 }),
        lab({ v: 2 }),
        lab({ files: [{ name: 'a.png', dataUrl: 'data:image/png;base64,A' }] }),
        lab({ files: [{ name: 'a.png', dataUrl: 'data:image/png;base64,A=AA' }] }),
        lab({ files: [{ name: 'a.png', dataUrl: 'data:image/png;base64,' }] }),
        lab({ files: [{ name: 'a.png', text: 5, dataUrl: 'data:image/png;base64,AAAA' }] }),
      ]) {
        expect((await postShare(kv, body)).status, body.slice(0, 120)).toBe(400);
      }
      expect(kv.entries.size).toBe(0);
      const fits = lab({
        source: 'x'.repeat(MAX_LAB_SOURCE),
        files: [{ name: 'a.JPG', dataUrl: 'data:image/jpeg;base64,AAAA' }, { name: 'b.bmp', dataUrl: 'data:image/bmp;base64,AAAA' }],
      });
      expect((await postShare(kv, fits)).status).toBe(201);
      expect(checkLabShape({ kind: 'lab', v: 1, source: '', files: [{ name: 'a.png', dataUrl: 'data:image/webp;base64,AAAA' }] })).toBe(
        'an image is not a PNG, JPEG or BMP data URL',
      );
      for (const dataUrl of ['data:image/png;base64,AA==', 'data:image/png;base64,AAA=', 'data:image/png;base64,AAAAAAAA']) {
        expect(checkLabShape({ kind: 'lab', v: 1, source: '', files: [{ name: 'a.png', dataUrl }] })).toBeNull();
      }
    });

    it('opens nothing from a malformed image or text in the Lab, says the link is damaged and clears ?share=', async () => {
      const bad = [
        { name: 'a.png', dataUrl: 'data:image/png;base64,A' },
        { name: 'a.png', dataUrl: 'data:image/png;base64,A=AA' },
        { name: 'a.png', text: 5, dataUrl: 'data:image/png;base64,AAAA' },
      ];
      for (const file of bad) expect(readLabShare({ kind: 'lab', v: 1, source: 'x', files: [file] })).toBeNull();
      vi.mocked(fetchStoredShare).mockResolvedValue({ ok: true, payload: { kind: 'lab', v: 1, source: '// shared\n', files: [bad[0]] } });
      window.history.replaceState(null, '', '/lab?share=k3x9q2Ab');
      const host = mountLab();
      await flushLab();
      expect(host.querySelector('.lab-files [role="status"]')!.textContent).toBe(LAB_SHARE_MESSAGES.damaged);
      expect(useLabStore.getState().source).toBe(TEMPLATE);
      expect(window.location.search).toBe('');
    });
  });

  describe('BB-SHARE-13: A scene payload is stored and opened as before', () => {
    it('stores a scene, and a scene link opens the scene without going to the Lab', async () => {
      const kv = new MemoryKv();
      const body = JSON.stringify(buildSharePayload(input()));
      const res = await postShare(kv, body);
      expect(res.status).toBe(201);
      const { id } = (await res.json()) as { id: string };
      expect(kv.entries.get(id)!.ttl).toBe(TTL_SECONDS);
      expect(await (await getShare(kv, id)).text()).toBe(body);
      const webp = { ...JSON.parse(body), textures: [{ id: 'u', name: 'p', dataUrl: 'data:image/webp;base64,AAAA', width: 2, height: 2 }] };
      expect((await postShare(kv, JSON.stringify(webp))).status).toBe(201);

      vi.mocked(fetchStoredShare).mockResolvedValue({ ok: true, payload: JSON.parse(body) });
      const go = vi.fn();
      const r = await resolveSharedScene({ kind: 'stored', id: 'k3x9q2Ab' }, undefined, { enabled: true, go });
      expect(r.ok).toBe(true);
      expect((r as Extract<typeof r, { ok: true }>).scene.name).toBe('Solar system');
      expect(go).not.toHaveBeenCalled();
    });
  });

  describe('BB-SHARE-14: A Lab link opened at /s/<id> goes to /lab?share=<id> with a full page load', () => {
    it('hands the Lab address to the page load, and a malformed Lab payload is an incomplete link', async () => {
      vi.mocked(fetchStoredShare).mockResolvedValue({ ok: true, payload: await storedLabPayload() });
      const go = vi.fn();
      const r = await resolveSharedScene({ kind: 'stored', id: 'k3x9q2Ab' }, undefined, { enabled: true, go });
      expect(go).toHaveBeenCalledWith('/lab?share=k3x9q2Ab');
      expect(r).toEqual({ ok: false, lab: '/lab?share=k3x9q2Ab' });
      expect(labShareUrl('k3x9q2Ab')).toBe('/lab?share=k3x9q2Ab');

      go.mockClear();
      const webp = { kind: 'lab', v: 1, source: 'x', files: [{ name: 'a.webp', dataUrl: 'data:image/webp;base64,AAAA' }] };
      vi.mocked(fetchStoredShare).mockResolvedValue({ ok: true, payload: webp });
      expect(await resolveSharedScene({ kind: 'stored', id: 'k3x9q2Ab' }, undefined, { enabled: true, go })).toEqual({ ok: false, message: SHARE_MESSAGES.damaged });
      expect(go).not.toHaveBeenCalled();
    });
  });

  describe('BB-SHARE-15: With the Lab off, a Lab link is a link not found', () => {
    it('never goes to /lab', async () => {
      vi.mocked(fetchStoredShare).mockResolvedValue({ ok: true, payload: await storedLabPayload() });
      const go = vi.fn();
      expect(await resolveSharedScene({ kind: 'stored', id: 'k3x9q2Ab' }, undefined, { enabled: false, go })).toEqual({ ok: false, message: SHARE_MESSAGES.missing });
      expect(go).not.toHaveBeenCalled();
    });
  });

  describe('BB-SHARE-16: /lab?share=<id> loads the code and files ready to Run, then leaves the address', () => {
    it('loads the shared work into the Lab, clears ?share= and Run gives the program the files', async () => {
      const payload = await storedLabPayload();
      vi.mocked(fetchStoredShare).mockResolvedValue({ ok: true, payload });
      window.history.replaceState(null, '', '/lab?share=k3x9q2Ab');
      const host = mountLab();
      await flushLab();
      expect(vi.mocked(fetchStoredShare).mock.calls[0][0]).toBe('k3x9q2Ab');
      expect(useLabStore.getState().source).toBe(SOURCE);
      expect(useLabStore.getState().unsaved).toBe(false);
      expect(useLabStore.getState().files.map((f) => f.name)).toEqual(['Input.txt', 'tiles.bmp', 'Sky.png', 'small.png']);
      expect(`${window.location.pathname}${window.location.search}`).toBe('/lab');
      await act(() => labButton(host, 'Run')!.click());
      await flushLab();
      const started = workers[workers.length - 1].started!;
      expect(started.files.map((f) => [f.name, f.type])).toEqual([
        ['Input.txt', 'text/plain'],
        ['tiles.bmp', 'image/bmp'],
        ['Sky.png', 'image/png'],
        ['small.png', 'image/png'],
      ]);
      expect(started.files[0].bytes).toEqual(INPUT_TXT);
      expect(started.files[1].bytes).toEqual(BMP);
    });

    it('asks before replacing unsaved work, and keeps it when told to', async () => {
      vi.mocked(fetchStoredShare).mockResolvedValue({ ok: true, payload: await storedLabPayload() });
      useLabStore.getState().setSource('// my own work\n');
      window.history.replaceState(null, '', '/lab?share=k3x9q2Ab');
      mountLab();
      await flushLab();
      const dialog = document.querySelector('[role="alertdialog"]')!;
      expect(dialog.textContent).toContain(REPLACE_QUESTION.title);
      await act(() => labButton(dialog, 'Keep my work')!.click());
      await flushLab();
      expect(useLabStore.getState().source).toBe('// my own work\n');
      expect(window.location.search).toBe('');
    });

    it('replaces unsaved work when the student agrees', async () => {
      vi.mocked(fetchStoredShare).mockResolvedValue({ ok: true, payload: await storedLabPayload() });
      useLabStore.getState().setSource('// my own work\n');
      window.history.replaceState(null, '', '/lab?share=k3x9q2Ab');
      mountLab();
      await flushLab();
      await act(() => labButton(document.querySelector('[role="alertdialog"]')!, 'Replace')!.click());
      await flushLab();
      expect(useLabStore.getState().source).toBe(SOURCE);
      expect(window.location.search).toBe('');
    });

    it('says when the link has expired, and leaves the work alone', async () => {
      vi.mocked(fetchStoredShare).mockResolvedValue({ ok: false, reason: 'missing' });
      window.history.replaceState(null, '', '/lab?share=k3x9q2Ab');
      const host = mountLab();
      await flushLab();
      expect(host.querySelector('.lab-files [role="status"]')!.textContent).toBe(LAB_SHARE_MESSAGES.missing);
      expect(useLabStore.getState().source).toBe(TEMPLATE);
      expect(window.location.search).toBe('');
    });
  });

  describe('BB-SHARE-17: Images over 512 px are shrunk to 512 px as PNG and keep their names', () => {
    it('round-trips a BMP and a .txt byte for byte, shrinks a 1024 px PNG, and keeps a small image as it was', async () => {
      const store = vi.fn(async () => STORED);
      expect(await prepareLabShare(labWork(), { store, resize })).toEqual({ kind: 'stored', url: `${SHARE_ORIGIN}/s/k3x9q2Ab`, expiresAt: STORED.expiresAt, shrunk: 1 });
      expect(resize).toHaveBeenCalledTimes(1);
      expect(resize.mock.calls[0][1]).toBe('image/png');
      expect(resize.mock.calls[0][2]).toEqual({ width: 512, height: 256 });
      const payload = await storedLabPayload();
      expect(payload.files.map((f) => f.name)).toEqual(['Input.txt', 'tiles.bmp', 'Sky.png', 'small.png']);
      expect(payload.files[0]).toEqual({ name: 'Input.txt', text: '\ufeff3\r\n1 2 3\r\n' });
      expect((payload.files[1] as { dataUrl: string }).dataUrl.startsWith('data:image/bmp;base64,')).toBe(true);
      const back = readLabShare(payload)!;
      expect(back.source).toBe(SOURCE);
      expect(back.files[0]).toEqual(labFile('Input.txt', INPUT_TXT, 'text/plain'));
      expect(back.files[1]).toEqual(labFile('tiles.bmp', BMP, 'image/bmp'));
      const sky = decodePng(back.files[2].bytes);
      expect([back.files[2].name, sky.width, sky.height]).toEqual(['Sky.png', 512, 256]);
      expect(back.files[3].bytes).toEqual(blankPng(16, 8));
    });

    it('reads the size of a PNG, a JPEG and a BMP, and re-encodes a large JPEG as PNG under its own name', async () => {
      expect(imageSize(blankPng(1024, 512))).toEqual({ width: 1024, height: 512 });
      expect(imageSize(jpegHeader(640, 2048))).toEqual({ width: 640, height: 2048 });
      expect(imageSize(BMP)).toEqual({ width: 2, height: 2 });
      expect(imageSize(utf8('not an image'))).toBeNull();
      const payload = await storedLabPayload({ source: SOURCE, files: [labFile('photo.jpg', jpegHeader(640, 2048), 'image/jpeg')] });
      expect(resize.mock.calls.at(-1)![2]).toEqual({ width: 160, height: 512 });
      expect(payload.files[0].name).toBe('photo.jpg');
      expect((payload.files[0] as { dataUrl: string }).dataUrl.startsWith('data:image/png;base64,')).toBe(true);
      expect(readLabShare(payload)!.files[0].type).toBe('image/jpeg');
    });
  });

  describe('BB-SHARE-18: The Lab shows Share, and its dialog gives the stored link for 90 days', () => {
    it('stores the work as kind lab and shows the link, the note and the QR code', async () => {
      useLabStore.setState({ source: SOURCE });
      const host = mountLab();
      await flushLab();
      const share = labButton(host.querySelector('.lab-top-bar')!, 'Share')!;
      expect(share.getAttribute('aria-haspopup')).toBe('dialog');
      share.focus();
      await act(() => share.click());
      await flushLab();
      const dialog = document.querySelector('.share-dialog')!;
      expect(dialog.querySelector('h2')!.textContent).toBe(LAB_SHARE_COPY.title);
      expect(dialog.textContent).toContain(LAB_SHARE_COPY.lead);
      expect((dialog.querySelector('.share-dialog__link') as HTMLInputElement).value).toBe(`${SHARE_ORIGIN}/s/k3x9q2Ab`);
      expect(dialog.textContent).toContain('Stored for 90 days, until 14 Jan 2027.');
      expect(dialog.querySelector('.qr-code svg')).not.toBeNull();
      expect(vi.mocked(createStoredShare).mock.calls.at(-1)![0]).toEqual({ kind: 'lab', v: 1, source: SOURCE, files: [] });
      await act(() => labButton(dialog, 'Done')!.click());
      await flushLab();
      expect(document.querySelector('.share-dialog')).toBeNull();
      expect(document.activeElement).toBe(share);
    });
  });

  describe('BB-SHARE-19: Work over the limit is not stored, and the dialog says what a link holds', () => {
    it('words code over 200,000 characters and work over 1 MB', async () => {
      const store = vi.fn(async () => STORED);
      expect(await prepareLabShare({ source: 'x'.repeat(MAX_LAB_SOURCE + 1), files: [] }, { store, resize })).toEqual({
        kind: 'over-limit',
        message: LAB_SHARE_MESSAGES.codeTooLong,
      });
      let seed = 7;
      const noise = Uint8Array.from({ length: 800_000 }, () => (seed = (seed * 1103515245 + 12345) >>> 0) >>> 24);
      expect(await prepareLabShare({ source: SOURCE, files: [labFile('noise.bmp', noise, 'image/bmp')] }, { store, resize })).toEqual({
        kind: 'over-limit',
        message: LAB_SHARE_MESSAGES.tooLarge,
      });
      expect(store).not.toHaveBeenCalled();
      const refused = vi.fn(async () => ({ ok: false as const, reason: 'too-large' as const }));
      expect(await prepareLabShare({ source: SOURCE, files: [] }, { store: refused, resize })).toEqual({ kind: 'over-limit', message: LAB_SHARE_MESSAGES.tooLarge });
      const down = vi.fn(async () => ({ ok: false as const, reason: 'offline' as const }));
      expect(await prepareLabShare({ source: SOURCE, files: [] }, { store: down, resize })).toEqual({ kind: 'failed' });
      expect(LAB_SHARE_MESSAGES.codeTooLong).toBe('A link holds up to 200,000 characters of code. Yours is longer, so save it to a file instead.');
      expect(LAB_SHARE_MESSAGES.tooLarge).toBe('A link holds up to 1 MB of code and files. Yours come to more, so save them to a file instead.');
      expect(MAX_STORED_BYTES).toBe(1_000_000);

      useLabStore.setState({ source: 'x'.repeat(MAX_LAB_SOURCE + 1) });
      const host = mountLab();
      await flushLab();
      await act(() => labButton(host.querySelector('.lab-top-bar')!, 'Share')!.click());
      await flushLab();
      const dialog = document.querySelector('.share-dialog')!;
      expect(dialog.textContent).toContain(LAB_SHARE_MESSAGES.codeTooLong);
      expect(labButton(dialog, LAB_SHARE_COPY.save)).toBeDefined();
      await act(() => labButton(dialog, 'Done')!.click());
    });
  });

  describe('BB-SHARE-20: A Lab link opened in the editor leaves the editor’s welcome as it was', () => {
    it('puts back a welcome not yet seen when the link goes to the Lab, and marks it seen for a scene', async () => {
      const go = vi.fn();
      vi.mocked(fetchStoredShare).mockResolvedValue({ ok: true, payload: await storedLabPayload() });
      useVamsStore.setState({ hasSeenWelcome: false });
      void openSharedScene({ kind: 'stored', id: 'k3x9q2Ab' }, { openLibrary: () => {}, lab: { enabled: true, go } });
      // While the link opens, the welcome stays away.
      expect(useVamsStore.getState().hasSeenWelcome).toBe(true);
      await flushLab();
      expect(go).toHaveBeenCalledWith('/lab?share=k3x9q2Ab');
      expect(useVamsStore.getState().hasSeenWelcome).toBe(false);

      useVamsStore.setState({ hasSeenWelcome: true });
      void openSharedScene({ kind: 'stored', id: 'k3x9q2Ab' }, { openLibrary: () => {}, lab: { enabled: true, go } });
      await flushLab();
      expect(useVamsStore.getState().hasSeenWelcome).toBe(true);

      useVamsStore.setState({ hasSeenWelcome: false });
      vi.mocked(fetchStoredShare).mockResolvedValue({ ok: true, payload: buildSharePayload(input()) });
      expect(await openSharedScene({ kind: 'stored', id: 'k3x9q2Ab' }, { openLibrary: () => {}, lab: { enabled: true, go } })).toBe(true);
      expect(useVamsStore.getState().hasSeenWelcome).toBe(true);
    });
  });

  describe('BB-SHARE-21: A Lab share holds at most 64 files, with no control characters in their names', () => {
    it('refuses a 65th file and a name with a control character, on the server and in the Lab', async () => {
      const kv = new MemoryKv();
      const files = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `f${i}.txt`, text: '' }));
      const lab = (list: unknown[]) => ({ kind: 'lab', v: 1, source: 'int main() {}', files: list });
      expect(MAX_LAB_FILES).toBe(64);
      expect((await postShare(kv, JSON.stringify(lab(files(64))))).status).toBe(201);
      for (const body of [lab(files(65)), lab([{ name: 'a\u0001.txt', text: '' }]), lab([{ name: 'a\tb.txt', text: '' }]), lab([{ name: 'a\u007f.txt', text: '' }])]) {
        expect((await postShare(kv, JSON.stringify(body))).status).toBe(400);
        expect(readLabShare(body)).toBeNull();
      }
      expect(kv.entries.size).toBe(1);
    });
  });
});
