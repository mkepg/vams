/**
 * BLACK-BOX TEST SUITE — BB-LAB (the student's code and files)
 * Test focus:
 *  - The code saves in the browser as it is typed, under its own key, and a reload keeps it
 *  - Save and Open round-trip main.cpp, and a .zip of main.cpp with its images and Input.txt
 *  - New asks before replacing unsaved changes, then loads the course template
 *  - Every example loads, passes the include check, and brings the images it loads
 *  - The file list takes PNG, JPEG, BMP and .txt, says what it takes, matches names in any case,
 *    and offers the files a program wrote for download
 *  - The examples cover the five programs and every gallery scene, regenerated from the editor
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { EditorView } from '@codemirror/view';
import { clear as clearIdb, del as idbDel, get as idbGet } from 'idb-keyval';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { labProjectDefaults, readLabFiles, useLabStore, type LabFile } from '@/entities/lab-project';
import {
  addUploads,
  BROWSER_SAVE_FAILED,
  missingFilesMessage,
  EXAMPLES,
  exampleWork,
  FileList,
  GALLERY_EXAMPLE_SIZE,
  LAB_TAKES,
  loadExample,
  newWork,
  OPEN_TAKES,
  openWork,
  REPLACE_QUESTION,
  saveWork,
  TEMPLATE,
} from '@/features/lab-files';
import { EXAMPLE_IMAGES, dataUrlBytes } from '@/features/lab-files/model/example-images';
import { LabWorkspace } from '@/widgets/lab-workspace';
import { useLabStage } from '@/widgets/lab-workspace/model/stage-store';
import { runController, useLabRun, type WorkerLike } from '@/features/lab-run';
import type { StartMessage, WorkerMessage } from '@/features/lab-run/model/protocol';
import type { CompileResult } from '@/features/lab-compile';
import { confirm, useConfirmStore } from '@/shared/ui/confirm-dialog/confirm-store';
import { LAB_MESSAGES } from '@/features/lab-compile';
import LabPage from '@/pages/lab';
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog';
import { GALLERY_BUILDERS } from '@/entities/project/model/gallery-scenes';
import { getPreset } from '@/entities/project/model/scene-presets';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { FOX_PALETTE, FOX_SPRITE, SAMPLE_TEXTURE_SPECS } from '@/features/textures/lib/sample-textures';
import { checkIncludes } from '../../lab/service/src/includes.ts';
import { decodePng, encodePng } from '../helpers/image-compare';

// Beside this file, whatever the working directory (import.meta.url isn't a file URL under happy-dom).
const EXAMPLES_DIR = join(__dirname, '../../src/features/lab-files/examples/');
/** LAB_EXAMPLES_EXPORT=1 rewrites the gallery examples from the editor's export. */
const EXPORT = process.env.LAB_EXAMPLES_EXPORT === '1';

class FakeWorker implements WorkerLike {
  started: StartMessage | null = null;
  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  postMessage(message: StartMessage) {
    this.started = message;
  }
  terminate() {}
}

let workers: FakeWorker[] = [];
const hosts: HTMLElement[] = [];

beforeEach(async () => {
  // tests/setup.ts has put the store back as a first visit finds it.
  await clearIdb();
  workers = [];
  runController.setWorkerFactory(() => {
    const w = new FakeWorker();
    workers.push(w);
    return w;
  });
  useLabStage.getState().reset();
});

afterEach(() => {
  for (const host of hosts.splice(0)) {
    act(() => render(null, host));
    host.remove();
  }
  runController.reset();
  useConfirmStore.setState({ open: false, options: null, resolve: null });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const flush = async () => {
  for (let i = 0; i < 5; i++) await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
};

const ok = (): CompileResult => ({ kind: 'ok', module: new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]).buffer, diagnostics: [] });

/** The workspace with the confirm host the Lab page gives it. */
function mountWorkspace(compile: () => Promise<CompileResult> = async () => ok()) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  hosts.push(host);
  act(() => render(h('div', null, h(LabWorkspace, { compile }), h(ConfirmDialog, null)), host));
  return host;
}

function mount(node: ReturnType<typeof h>) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  hosts.push(host);
  act(() => render(node, host));
  return host;
}

const editorOf = (host: HTMLElement) => EditorView.findFromDOM(host.querySelector('.cm-editor') as HTMLElement)!;
const type = (host: HTMLElement, text: string) => act(() => editorOf(host).dispatch({ changes: { from: 0, insert: text } }));
const button = (root: ParentNode, label: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent?.replace('▶', '').trim() === label || b.getAttribute('aria-label') === label) as
    | HTMLButtonElement
    | undefined;
const stored = () => JSON.parse(localStorage.getItem('vams-lab')!) as { state: { source: string; files: { name: string }[] }; version: number };

/** A store reload: the state a fresh page starts from, then what the browser save holds. */
async function reloadStore() {
  const saved = localStorage.getItem('vams-lab')!;
  // Setting the store writes the save, so the save is put back before it is read.
  useLabStore.setState(labProjectDefaults());
  localStorage.setItem('vams-lab', saved);
  await useLabStore.persist.rehydrate();
}

const bytes = (...values: number[]) => new Uint8Array(values);
const PNG_A = bytes(0x89, 0x50, 0x4e, 0x47, 1);
const PNG_B = bytes(0x89, 0x50, 0x4e, 0x47, 2);
const INPUT = new TextEncoder().encode('3\n1 2 3\n');
const file = (contents: Uint8Array | string, name: string) => new File([contents], name);
const listNames = () => useLabStore.getState().files.map((f) => f.name);

describe('BB-LAB-52: The code autosaves, and survives a reload of the store', () => {
  it('saves what is typed under vams-lab, version 1, and a reload brings it back to the editor', async () => {
    const host = mountWorkspace();
    expect(editorOf(host).state.doc.toString()).toBe(TEMPLATE);
    type(host, '// my work\n');
    expect(useLabStore.getState().source).toBe(`// my work\n${TEMPLATE}`);
    expect(stored().version).toBe(1);
    expect(stored().state.source).toBe(`// my work\n${TEMPLATE}`);
    expect(localStorage.getItem('vams-storage') ?? '').not.toContain('my work');

    act(() => render(null, host));
    await reloadStore();
    expect(useLabStore.getState().source).toBe(`// my work\n${TEMPLATE}`);
    const again = mountWorkspace();
    expect(editorOf(again).state.doc.toString()).toBe(`// my work\n${TEMPLATE}`);
  });

  it('keeps each file’s bytes in IndexedDB under vams-lab-file:<name>, and its name in the save', async () => {
    await addUploads([file(PNG_A, 'sky.png'), file(INPUT, 'Input.txt')]);
    expect(await idbGet('vams-lab-file:sky.png')).toEqual(PNG_A);
    expect(await idbGet('vams-lab-file:Input.txt')).toEqual(INPUT);
    expect(stored().state.files.map((f) => f.name)).toEqual(['sky.png', 'Input.txt']);
    await reloadStore();
    expect(await readLabFiles()).toEqual([
      { name: 'sky.png', bytes: PNG_A, type: 'image/png' },
      { name: 'Input.txt', bytes: INPUT, type: 'text/plain' },
    ]);
    // What a reload reads is IndexedDB's copy: with it gone, the file is gone.
    await idbDel('vams-lab-file:sky.png');
    expect((await readLabFiles()).map((f) => f.name)).toEqual(['Input.txt']);
  });
});

describe('BB-LAB-53: Save then Open round-trips main.cpp, and a .zip with two images and Input.txt', () => {
  const save = async () => {
    const saved: { name: string; blob: Blob }[] = [];
    await saveWork((name, blob) => saved.push({ name, blob }));
    expect(saved).toHaveLength(1);
    return saved[0];
  };

  it('saves the code alone as main.cpp, and Open brings it back', async () => {
    useLabStore.getState().setSource('int main() { return 0; }\n');
    const { name, blob } = await save();
    expect(name).toBe('main.cpp');
    expect(await blob.text()).toBe('int main() { return 0; }\n');
    expect(useLabStore.getState().unsaved).toBe(false);

    useLabStore.getState().setSource('changed');
    await openWork(new File([blob], name));
    expect(useLabStore.getState().source).toBe('int main() { return 0; }\n');
    expect(useLabStore.getState().unsaved).toBe(false);
  });

  it('saves lab.zip when there are files, and Open restores the code and every file', async () => {
    useLabStore.getState().setSource('// textured\n');
    await addUploads([file(PNG_A, 'a.png'), file(PNG_B, 'b.png'), file(INPUT, 'Input.txt')]);
    const { name, blob } = await save();
    expect(name).toBe('lab.zip');
    const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(entries).sort()).toEqual(['Input.txt', 'a.png', 'b.png', 'main.cpp']);
    expect(new TextDecoder().decode(entries['main.cpp'])).toBe('// textured\n');

    await newWork(async () => true);
    expect(await readLabFiles()).toEqual([]);
    await openWork(new File([blob], name));
    expect(useLabStore.getState().source).toBe('// textured\n');
    expect(await readLabFiles()).toEqual([
      { name: 'a.png', bytes: PNG_A, type: 'image/png' },
      { name: 'b.png', bytes: PNG_B, type: 'image/png' },
      { name: 'Input.txt', bytes: INPUT, type: 'text/plain' },
    ]);
  });

  it('opens a .cpp with Windows line ends, keeping the file list', async () => {
    await addUploads([file(PNG_A, 'a.png')]);
    await openWork(file('int a;\r\nint b;\r\n', 'Lab3.cpp'));
    expect(useLabStore.getState().source).toBe('int a;\nint b;\n');
    expect(listNames()).toEqual(['a.png']);
  });

  it('says what Open takes when it is given another kind of file', async () => {
    await expect(openWork(file('hello', 'notes.docx'))).rejects.toThrow(OPEN_TAKES);
    await expect(openWork(file('not a zip', 'work.zip'))).rejects.toThrow(/couldn't be read/);
  });

  it('downloads from the top bar’s Save', async () => {
    const created: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      created.push(blob as Blob);
      return 'blob:lab';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    const host = mountWorkspace();
    await act(() => button(host, 'Save')!.click());
    await flush();
    expect(names).toEqual(['main.cpp']);
    expect(await created[0].text()).toBe(TEMPLATE);
  });
});

describe('BB-LAB-54: New asks before replacing unsaved changes, then loads TEMPLATE', () => {
  it('is the course template: glew.h and freeglut.h, init, display and main at 500 × 500, one triangle', () => {
    expect(TEMPLATE).toContain('#include <GL/glew.h>');
    expect(TEMPLATE).toContain('#include <GL/freeglut.h>');
    expect(TEMPLATE).toMatch(/void init\(\)/);
    expect(TEMPLATE).toMatch(/void display\(\)/);
    expect(TEMPLATE).toMatch(/int main\(int argc, char\*\* argv\)/);
    expect(TEMPLATE).toContain('glutInitWindowSize(500, 500);');
    expect(TEMPLATE.match(/glBegin\(GL_TRIANGLES\)/g)).toHaveLength(1);
    expect(TEMPLATE.match(/glVertex2f/g)).toHaveLength(3);
    expect(checkIncludes(TEMPLATE).ok).toBe(true);
  });

  it('replaces saved work without asking', async () => {
    useLabStore.setState({ source: 'saved work', unsaved: false });
    const ask = vi.fn(async () => true);
    expect(await newWork(ask)).toBe(true);
    expect(ask).not.toHaveBeenCalled();
    expect(useLabStore.getState().source).toBe(TEMPLATE);
  });

  it('asks about unsaved changes, keeps them when told to, and otherwise starts afresh with no files', async () => {
    await addUploads([file(PNG_A, 'a.png')]);
    useLabStore.getState().setSource('unsaved work');
    const no = vi.fn(async () => false);
    expect(await newWork(no)).toBe(false);
    expect(no).toHaveBeenCalledWith(REPLACE_QUESTION);
    expect(useLabStore.getState().source).toBe('unsaved work');
    expect(await newWork(async () => true)).toBe(true);
    expect(useLabStore.getState().source).toBe(TEMPLATE);
    expect(listNames()).toEqual([]);
    expect(await idbGet('vams-lab-file:a.png')).toBeUndefined();
    expect(useLabStore.getState().unsaved).toBe(false);
  });

  it('shows Examples, New, Open and Save in the top bar, and New asks in a dialog', async () => {
    const host = mountWorkspace();
    const bar = host.querySelector('.lab-top-bar')!;
    expect([...bar.querySelectorAll('button')].map((b) => b.textContent?.replace('▶', '').trim())).toEqual(['Examples', 'New', 'Open', 'Save', 'Run']);
    type(host, '// mine\n');
    await act(() => button(host, 'New')!.click());
    const dialog = document.querySelector('[role="alertdialog"]')!;
    expect(dialog.textContent).toContain(REPLACE_QUESTION.title);
    await act(() => button(dialog, 'Keep my work')!.click());
    await flush();
    expect(editorOf(host).state.doc.toString()).toBe(`// mine\n${TEMPLATE}`);
    await act(() => button(host, 'New')!.click());
    await act(() => button(document.querySelector('[role="alertdialog"]')!, 'Replace')!.click());
    await flush();
    expect(editorOf(host).state.doc.toString()).toBe(TEMPLATE);
  });
});

describe('BB-LAB-55: Each example loads and its source passes checkIncludes', () => {
  it.each(EXAMPLES.map((e) => [e.id, e] as const))('%s', async (_, example) => {
    await loadExample(example.id);
    const { source } = useLabStore.getState();
    expect(source).toBe((await exampleWork(example.id)).source);
    expect(source).not.toContain('\r');
    expect(checkIncludes(source).ok).toBe(true);
    expect(useLabStore.getState().unsaved).toBe(false);
    // Every image the program loads is in the file list, found by its name.
    const names = (await readLabFiles()).map((f) => f.name.toLowerCase());
    const loads = [...source.matchAll(/stbi_load\("([^"]+)"/g)].map(([, path]) => path.split(/\\\\|\//).pop()!.toLowerCase());
    for (const name of loads) expect(names).toContain(name);
    expect(names).toEqual(example.images.map((n) => n.toLowerCase()));
  });

  it('lists every example under Examples, and choosing one loads it', async () => {
    const host = mountWorkspace();
    await act(() => button(host, 'Examples')!.click());
    const items = [...host.querySelectorAll('[role="menuitem"]')] as HTMLElement[];
    expect(items.map((i) => i.textContent)).toEqual(EXAMPLES.map((e) => e.title));
    await act(() => items.find((i) => i.textContent === 'Bitmap text')!.click());
    await flush();
    expect(editorOf(host).state.doc.toString()).toBe((await exampleWork('bitmap-text')).source);
  });
});

describe('BB-LAB-56: The file list takes PNG, JPEG, BMP and .txt files, and offers the program’s files', () => {
  it('takes PNG, JPEG, BMP and .txt, and says what it takes when given anything else', async () => {
    const said = await addUploads([
      file(PNG_A, 'a.png'),
      file(PNG_A, 'b.JPG'),
      file(PNG_A, 'c.jpeg'),
      file(PNG_A, 'd.bmp'),
      file(INPUT, 'Input.txt'),
      file(PNG_A, 'e.gif'),
      file(PNG_A, 'game.exe'),
    ]);
    expect(listNames()).toEqual(['a.png', 'b.JPG', 'c.jpeg', 'd.bmp', 'Input.txt']);
    expect(said).toEqual([LAB_TAKES]);
    expect(LAB_TAKES).toBe('The Lab takes PNG, JPEG, BMP and .txt files.');
  });

  it('replaces a file whose name matches apart from case, says so, and never holds both', async () => {
    await addUploads([file(INPUT, 'Input.txt')]);
    const said = await addUploads([file('9\n', 'input.TXT')]);
    expect(listNames()).toEqual(['input.TXT']);
    expect(said).toEqual(['input.TXT replaced Input.txt. The program finds a file by its name in any case.']);
    expect(await readLabFiles()).toEqual([{ name: 'input.TXT', bytes: new TextEncoder().encode('9\n'), type: 'text/plain' }]);
    expect(await idbGet('vams-lab-file:Input.txt')).toBeUndefined();
    expect(await addUploads([file('x', 'a.txt'), file('y', 'A.TXT')])).toEqual(['A.TXT replaced a.txt. The program finds a file by its name in any case.']);
    expect(listNames()).toEqual(['input.TXT', 'A.TXT']);
  });

  it('adds and removes files in the list, and says what it takes', async () => {
    const host = mount(h(FileList, { written: [] }));
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [file(PNG_A, 'sky.png'), file('x', 'notes.docx')] });
    await act(() => input.dispatchEvent(new Event('change', { bubbles: true })));
    await flush();
    expect([...host.querySelectorAll('.lab-files__name')].map((n) => n.textContent)).toEqual(['sky.png']);
    expect(host.querySelector('[role="status"]')!.textContent).toBe(LAB_TAKES);
    await act(() => button(host, 'Remove sky.png')!.click());
    await flush();
    expect(host.querySelectorAll('.lab-files__name')).toHaveLength(0);
    expect(listNames()).toEqual([]);
  });

  it('offers each file the program wrote for download', async () => {
    const created: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      created.push(blob as Blob);
      return 'blob:lab';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    const written: LabFile[] = [{ name: 'scores.txt', bytes: new TextEncoder().encode('42\n'), type: 'text/plain' }];
    const host = mount(h(FileList, { written }));
    await act(() => button(host, 'Download scores.txt')!.click());
    expect(names).toEqual(['scores.txt']);
    expect(await created[0].text()).toBe('42\n');
  });

  it('shows what a running program writes, and Run gives the program the list’s files', async () => {
    await addUploads([file(INPUT, 'Input.txt')]);
    const host = mountWorkspace();
    await flush();
    await act(() => button(host, 'Run')!.click());
    await flush();
    const w = workers[workers.length - 1];
    expect(w.started!.files).toEqual([{ name: 'Input.txt', bytes: INPUT, type: 'text/plain' }]);
    act(() => w.onmessage?.({ data: { type: 'fileWritten', name: 'Output.txt', bytes: bytes(52, 50) } } as MessageEvent<WorkerMessage>));
    expect(useLabRun.getState().written).toEqual([{ name: 'Output.txt', bytes: bytes(52, 50), type: 'text/plain' }]);
    expect(button(host, 'Download Output.txt')).toBeDefined();
  });
});

describe('BB-LAB-57: The examples are the five programs and every gallery scene, exported from the editor', () => {
  it('has a triangle, keyboard movement, an idle animation, a textured quad and bitmap text, then each gallery scene', () => {
    const programs = EXAMPLES.filter((e) => e.group === 'program').map((e) => e.id);
    expect(programs).toEqual(['triangle', 'keyboard', 'idle-animation', 'textured-quad', 'bitmap-text']);
    const gallery = EXAMPLES.filter((e) => e.group === 'gallery').map((e) => e.id.replace(/^gallery-/, ''));
    expect(gallery.sort()).toEqual(Object.keys(GALLERY_BUILDERS).sort());
  });

  it.each(Object.keys(GALLERY_BUILDERS))('gallery-%s is generateCodeFromState of the scene', async (slug) => {
    const data = getPreset(slug)!.data;
    const samples = SAMPLE_TEXTURE_SPECS.map((s) => ({ ...s, dataUrl: '', isSample: true }));
    const cpp = generateCodeFromState(
      { objects: data.objects, canvasBackgroundColor: data.canvasBackgroundColor, callbacks: data.callbacks, viewportLimits: data.viewportLimits, textures: [...data.uploadedTextures, ...samples] },
      GALLERY_EXAMPLE_SIZE,
    );
    const path = `${EXAMPLES_DIR}gallery-${slug}.cpp`;
    if (EXPORT) writeFileSync(path, cpp.replace(/\n/g, '\r\n'));
    expect(readFileSync(path, 'utf8').replace(/\r\n/g, '\n'), `re-export with LAB_EXAMPLES_EXPORT=1`).toBe(cpp);
    expect((await exampleWork(`gallery-${slug}`)).source).toBe(cpp);
  });

  it('brings the images the editor draws: the Pixel fox sample, the gallery textures and an 8 × 8 checkerboard', () => {
    const fox = new Uint8Array(64 * 64 * 4);
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const hex = FOX_PALETTE[FOX_SPRITE[Math.floor(y / 4)][Math.floor(x / 4)]];
        fox.set([parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255], (y * 64 + x) * 4);
      }
    }
    expect(dataUrlBytes(EXAMPLE_IMAGES['Pixel fox.png'])).toEqual(encodePng({ width: 64, height: 64, data: fox }));
    for (const name of ['Cloud tile', 'Sari-sari sign']) {
      const texture = getPreset(name === 'Cloud tile' ? 'pixel-fox' : 'jeepney-street')!.data.uploadedTextures.find((t) => t.name === name)!;
      expect(EXAMPLE_IMAGES[`${name}.png`]).toBe(texture.dataUrl);
    }
    const checker = decodePng(dataUrlBytes(EXAMPLE_IMAGES['checkerboard.png']));
    expect([checker.width, checker.height]).toEqual([8, 8]);
    expect([...checker.data.subarray(0, 8)]).toEqual([255, 255, 255, 255, 220, 30, 30, 255]);
  });
});

describe('BB-LAB-78: A browser save that fails is said once, and Run stops saying the code is saved', () => {
  const warnings = (host: ParentNode) => [...host.querySelectorAll('[role="alert"]')].filter((a) => a.textContent === BROWSER_SAVE_FAILED);

  it('says so when IndexedDB refuses a file, and keeps the file for this visit', async () => {
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });
    const host = mount(h(FileList, { written: [] }));
    expect(warnings(host)).toHaveLength(0);
    await addUploads([file(PNG_A, 'sky.png')]);
    await addUploads([file(PNG_B, 'sea.png')]);
    await flush();
    expect(useLabStore.getState().browserSaveFailed).toBe(true);
    expect(warnings(host)).toHaveLength(1);
    expect((await readLabFiles()).map((f) => f.name)).toEqual(['sky.png', 'sea.png']);
  });

  it('says so when localStorage refuses the code, and Run’s message says to save to a file', async () => {
    const host = mountWorkspace(async () => ({ kind: 'offline' }));
    // A full localStorage: every write is refused.
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      removeItem: () => {},
      setItem: () => {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      },
    });
    type(host, '// mine\n');
    await flush();
    expect(warnings(host)).toHaveLength(1);
    await act(() => button(host, 'Run')!.click());
    await flush();
    const message = host.querySelector('.lab-log__message')!.textContent;
    expect(message).toBe(LAB_MESSAGES.offline.replace('Your code is saved in this browser.', BROWSER_SAVE_FAILED));
    expect(message).not.toContain('saved in this browser');
  });
});

describe('BB-LAB-79: On load, a listed file whose bytes are gone leaves the list, which says so', () => {
  it('drops the file and names it', async () => {
    await addUploads([file(PNG_A, 'sky.png'), file(INPUT, 'Input.txt')]);
    await reloadStore();
    await idbDel('vams-lab-file:sky.png');
    const host = mountWorkspace();
    await flush();
    expect(listNames()).toEqual(['Input.txt']);
    expect(stored().state.files.map((f) => f.name)).toEqual(['Input.txt']);
    expect(host.querySelector('.lab-files [role="status"]')!.textContent).toBe(missingFilesMessage(['sky.png']));
    expect(missingFilesMessage(['sky.png'])).toBe("sky.png couldn't be found in this browser, so it left the list. Add it again.");
    expect(missingFilesMessage(['a.png', 'b.png', 'Input.txt'])).toBe(
      "a.png, b.png and Input.txt couldn't be found in this browser, so they left the list. Add them again.",
    );
  });
});

describe('BB-LAB-80: In a zip, the shallowest copy of each name wins', () => {
  it('takes Input.txt at the top over backup/input.txt, whichever comes first', async () => {
    const zip = zipSync({
      'backup/input.txt': strToU8('old\n'),
      'backup/main.cpp': strToU8('// old\n'),
      'main.cpp': strToU8('// new\n'),
      'Input.txt': strToU8('new\n'),
    });
    await openWork(new File([zip], 'work.zip'));
    expect(useLabStore.getState().source).toBe('// new\n');
    expect(await readLabFiles()).toEqual([{ name: 'Input.txt', bytes: strToU8('new\n'), type: 'text/plain' }]);
  });
});

describe('BB-LAB-81: A picked file that can’t be read gets a message', () => {
  const unreadable = (name: string) => {
    const f = file(PNG_A, name);
    Object.defineProperty(f, 'arrayBuffer', { value: () => Promise.reject(new DOMException('The file was moved.', 'NotFoundError')) });
    return f;
  };

  it('adds the rest, and names the one it couldn’t read', async () => {
    expect(await addUploads([unreadable('gone.png'), file(PNG_B, 'here.png')])).toEqual(["gone.png couldn't be read. Add it again."]);
    expect(listNames()).toEqual(['here.png']);
  });

  it('shows the message in the list', async () => {
    const host = mount(h(FileList, { written: [] }));
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [unreadable('gone.png')] });
    await act(() => input.dispatchEvent(new Event('change', { bubbles: true })));
    await flush();
    expect(host.querySelector('[role="status"]')!.textContent).toBe("gone.png couldn't be read. Add it again.");
  });
});

describe('BB-LAB-82: The Lab page hosts the confirm dialog, the workspace does not', () => {
  afterEach(() => Reflect.deleteProperty(window, 'crossOriginIsolated'));

  it('shows one dialog on the page, and none from the workspace alone', async () => {
    const alone = document.createElement('div');
    document.body.appendChild(alone);
    hosts.push(alone);
    act(() => render(h(LabWorkspace, { compile: async () => ok() }), alone));
    let asked = confirm({ title: 'Replace your work?' });
    await flush();
    expect(document.querySelectorAll('[role="alertdialog"]')).toHaveLength(0);
    act(() => useConfirmStore.getState().handleCancel());
    await asked;
    act(() => render(null, alone));

    Object.defineProperty(window, 'crossOriginIsolated', { value: true, configurable: true });
    const page = mount(h(LabPage, { reload: () => {} }));
    await flush();
    asked = confirm({ title: 'Replace your work?' });
    await flush();
    expect(page.querySelectorAll('[role="alertdialog"]')).toHaveLength(1);
    act(() => useConfirmStore.getState().handleCancel());
    await asked;
  });
});

describe('BB-LAB-83: Each test starts with no Lab save written', () => {
  it('finds no vams-lab key in localStorage', () => {
    expect(localStorage.getItem('vams-lab')).toBeNull();
  });
});

describe('BB-LAB-84: The file features reach other slices through their public index', () => {
  it('imports @/entities/<slice> and never a path inside it', () => {
    const root = join(__dirname, '../../src/features/lab-files/');
    const sources = (readdirSync(root, { recursive: true }) as string[]).filter((f) => /\.tsx?$/.test(f));
    const deep = sources.flatMap((f) =>
      [...readFileSync(join(root, f), 'utf8').matchAll(/from '(@\/entities\/[^']+)'/g)]
        .map(([, spec]) => spec)
        .filter((spec) => /^@\/entities\/[^/]+\//.test(spec))
        .map((spec) => `${f}: ${spec}`),
    );
    expect(deep).toEqual([]);
  });
});

describe('BB-LAB-85: The suite map in tests/README.md lists every Lab black-box file', () => {
  it('names each lab-*.test.ts', () => {
    const readme = readFileSync(join(__dirname, '../README.md'), 'utf8');
    const files = readdirSync(__dirname).filter((f) => /^lab-.*\.test\.ts$/.test(f));
    expect(files.filter((f) => !readme.includes(f))).toEqual([]);
  });
});
