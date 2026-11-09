/**
 * BLACK-BOX TEST SUITE — BB-LAB (the editor, the browser's compiler and the log)
 * Test focus:
 *  - A compile error marks its line, and the Compiler tab jumps to line and column
 *  - One download for every Run that waits on it; the download, offline, failed and time-limit messages
 *  - The page knows the compiler is in this browser from Cache Storage alone
 *  - Ctrl+Enter and Cmd+Enter run; the status line counts errors
 *  - The log folds, and the fold is remembered
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { h, render } from 'preact';
import { useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { EditorView } from '@codemirror/view';
import { LabEditor, statusLine, type Diagnostic } from '@/features/lab-editor';
import {
  checkCompiler,
  compileMessage,
  compileSource,
  COMPILE_TIME_LIMIT_MS,
  downloadCompiler,
  downloadingMessage,
  LAB_MESSAGES,
  setCompilerEnv,
  TIME_LIMIT_MESSAGE,
  useCompiler,
  type CompilerWorker,
} from '@/features/lab-compile';
import type { CompilerReply, CompilerRequest } from '@/features/lab-compile/model/compiler-protocol';
import {
  cachedFetch,
  compilerCached,
  DownloadError,
  fillCompilerCache,
  headersTree,
  type CachesLike,
} from '@/features/lab-compile/model/compiler-files';
import LabLog from '@/widgets/lab-workspace/ui/LabLog';
import { labProjectDefaults, useLabStore } from '@/entities/lab-project';

/** The log's fold as the Lab's browser save holds it. */
const storedFold = () => (JSON.parse(localStorage.getItem('vams-lab') ?? '{}') as { state?: { log?: { folded?: boolean } } }).state?.log?.folded;

const diag = (line: number, col: number, severity: Diagnostic['severity'] = 'error', message = 'expected ;'): Diagnostic => ({
  file: 'main.cpp',
  line,
  col,
  severity,
  message,
});

const SOURCE = Array.from({ length: 14 }, (_, i) => `int line${i + 1} = ${'0'.repeat(30)};`).join('\n');

function mount(node: ReturnType<typeof h>) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  act(() => render(node, root));
  return root;
}

function viewOf(root: HTMLElement): EditorView {
  const view = EditorView.findFromDOM(root.querySelector('.cm-editor') as HTMLElement);
  if (!view) throw new Error('no editor');
  return view;
}

describe('BB-LAB-37: A compile error marks its line, and the Compiler tab jumps to it', () => {
  function Harness() {
    const [jump, setJump] = useState<{ line: number; col: number } | undefined>(undefined);
    const diagnostics = [diag(11, 27)];
    return h('div', null, [
      h(LabEditor, { key: 'e', value: SOURCE, onChange: () => {}, diagnostics, jumpTo: jump }),
      h(LabLog, { key: 'l', diagnostics, consoleLines: [], onJump: (line: number, col: number) => setJump({ line, col }) }),
    ]);
  }

  it('marks line 11 and moves the cursor to 11:27 on a click', () => {
    const root = mount(h(Harness, null));
    const marked = [...root.querySelectorAll('.cm-line')].map((l, i) => (l.classList.contains('lab-error-line') ? i + 1 : 0)).filter(Boolean);
    expect(marked).toEqual([11]);
    const link = [...root.querySelectorAll('button')].find((b) => b.textContent?.includes('main.cpp:11:27'));
    expect(link).toBeTruthy();
    act(() => (link as HTMLButtonElement).click());
    const view = viewOf(root);
    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    expect([line.number, head - line.from + 1]).toEqual([11, 27]);
  });

  it('moves the cursor again for the same position clicked twice', () => {
    const root = mount(h(Harness, null));
    const link = [...root.querySelectorAll('button')].find((b) => b.textContent?.includes('main.cpp:11:27')) as HTMLButtonElement;
    act(() => link.click());
    const view = viewOf(root);
    act(() => view.dispatch({ selection: { anchor: 0 } }));
    act(() => link.click());
    expect(view.state.doc.lineAt(view.state.selection.main.head).number).toBe(11);
  });
});

/** A compiler worker the test answers by hand. */
class FakeCompilerWorker implements CompilerWorker {
  sent: CompilerRequest[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent<CompilerReply>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  postMessage(message: CompilerRequest) {
    this.sent.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  reply(message: CompilerReply) {
    this.onmessage?.({ data: message } as MessageEvent<CompilerReply>);
  }
  compiles() {
    return this.sent.filter((m): m is Extract<CompilerRequest, { type: 'compile' }> => m.type === 'compile');
  }
}

/** Starts the compiler with workers the test holds, newest last. */
function fakeCompiler(options: { online?: () => boolean; timeoutMs?: number } = {}) {
  const workers: FakeCompilerWorker[] = [];
  setCompilerEnv({
    createWorker: () => {
      const w = new FakeCompilerWorker();
      workers.push(w);
      return w;
    },
    caches: () => undefined,
    online: options.online ?? (() => true),
    timeoutMs: options.timeoutMs ?? 30_000,
  });
  return workers;
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const WASM = new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]).buffer;

describe('BB-LAB-38: Run downloads the compiler once, and a second Run waits for the same download', () => {
  afterEach(() => setCompilerEnv());

  it('starts one worker for two Runs, shows the progress, and compiles each source after the download', async () => {
    const workers = fakeCompiler();
    const first = compileSource('v1', 'int a;');
    const second = compileSource('v1', 'int b;');
    expect(workers).toHaveLength(1);
    expect(workers[0].sent).toEqual([{ type: 'prepare', version: 'v1' }]);
    workers[0].reply({ type: 'progress', received: 50, total: 100 });
    expect(useCompiler.getState()).toMatchObject({ state: 'downloading', received: 50, total: 100 });
    expect(downloadingMessage(50, 100)).toBe('Downloading the compiler… 11 of 22 MB');
    workers[0].reply({ type: 'ready' });
    await flush();
    expect(useCompiler.getState().state).toBe('ready');
    expect(workers[0].compiles().map((m) => m.source)).toEqual(['int a;', 'int b;']);
    const [a, b] = workers[0].compiles();
    workers[0].reply({ type: 'result', id: b.id, result: { kind: 'errors', diagnostics: [diag(1, 5)] } });
    workers[0].reply({ type: 'result', id: a.id, result: { kind: 'ok', module: WASM, diagnostics: [] } });
    expect((await first).kind).toBe('ok');
    expect(await second).toEqual({ kind: 'errors', diagnostics: [diag(1, 5)] });
  });

  it('lets Download now start the same download Run then waits for', async () => {
    const workers = fakeCompiler();
    const early = downloadCompiler('v1');
    const run = compileSource('v1', 'int a;');
    expect(workers).toHaveLength(1);
    workers[0].reply({ type: 'ready' });
    expect(await early).toBe('ready');
    await flush();
    expect(workers[0].compiles()).toHaveLength(1);
    workers[0].reply({ type: 'result', id: workers[0].compiles()[0].id, result: { kind: 'ok', module: WASM, diagnostics: [] } });
    expect((await run).kind).toBe('ok');
  });

  it('rejects a stopped Run and lets the download it started finish', async () => {
    const workers = fakeCompiler();
    const controller = new AbortController();
    const run = compileSource('v1', 'int a;', { signal: controller.signal });
    controller.abort();
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
    expect(workers[0].terminated).toBe(false);
    workers[0].reply({ type: 'ready' });
    expect(useCompiler.getState().state).toBe('ready');
    expect(workers[0].compiles()).toHaveLength(0);
  });
});

describe('BB-LAB-39: A download that fails says so, and the next Run tries again', () => {
  afterEach(() => setCompilerEnv());

  it('shows the download message, ends the worker, and starts a fresh one on the next Run', async () => {
    const workers = fakeCompiler();
    const run = compileSource('v1', 'int a;');
    workers[0].reply({ type: 'download-failed', network: true });
    const result = await run;
    expect(result).toEqual({ kind: 'download' });
    expect(compileMessage(result)).toBe("The compiler couldn't download. Your code is saved in this browser. Try Run again.");
    expect(useCompiler.getState().state).toBe('failed');
    expect(workers[0].terminated).toBe(true);
    expect(LAB_MESSAGES.download).toBe(compileMessage(result));
    void compileSource('v1', 'int a;');
    expect(workers).toHaveLength(2);
  });

  it('says the Lab could not compile when the files came but the compiler did not start', async () => {
    const workers = fakeCompiler();
    const run = compileSource('v1', 'int a;');
    workers[0].reply({ type: 'download-failed', network: false });
    expect(await run).toEqual({ kind: 'failed' });
  });
});

describe('BB-LAB-40: With no connection before the first download, Run says it needs the internet', () => {
  afterEach(() => setCompilerEnv());

  it('starts no worker and gives the offline message', async () => {
    const workers = fakeCompiler({ online: () => false });
    const result = await compileSource('v1', 'int a;');
    expect(result).toEqual({ kind: 'offline' });
    expect(workers).toHaveLength(0);
    expect(compileMessage(result)).toBe('Run needs the internet the first time, to download the compiler. Your code is saved in this browser.');
  });

  it('gives the offline message when the connection went during the download', async () => {
    let online = true;
    const workers = fakeCompiler({ online: () => online });
    const run = compileSource('v1', 'int a;');
    online = false;
    workers[0].reply({ type: 'download-failed', network: true });
    expect(await run).toEqual({ kind: 'offline' });
  });

  it('compiles offline once the compiler is in this browser', async () => {
    const workers = fakeCompiler({ online: () => false });
    useCompiler.setState({ state: 'ready' });
    const run = compileSource('v1', 'int a;');
    expect(workers).toHaveLength(1);
    workers[0].reply({ type: 'ready' });
    await flush();
    workers[0].reply({ type: 'result', id: workers[0].compiles()[0].id, result: { kind: 'ok', module: WASM, diagnostics: [] } });
    expect((await run).kind).toBe('ok');
  });
});

describe('BB-LAB-41: Ctrl+Enter runs, and the status line counts errors', () => {
  const press = (root: HTMLElement, init: KeyboardEventInit) =>
    act(() => {
      viewOf(root).contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...init }));
    });

  it('runs on Ctrl+Enter and Cmd+Enter without adding a line', () => {
    const onRun = vi.fn();
    const root = mount(h(LabEditor, { value: 'int a;', onChange: () => {}, diagnostics: [], onRun }));
    press(root, { ctrlKey: true });
    press(root, { metaKey: true });
    expect(onRun).toHaveBeenCalledTimes(2);
    expect(viewOf(root).state.doc.toString()).toBe('int a;');
  });

  it('reports typing through onChange', () => {
    const onChange = vi.fn();
    const root = mount(h(LabEditor, { value: 'int a;', onChange, diagnostics: [] }));
    act(() => viewOf(root).dispatch({ changes: { from: 0, insert: 'x' }, userEvent: 'input.type' }));
    expect(onChange).toHaveBeenCalledWith('xint a;');
  });

  it('counts errors', () => {
    expect(statusLine([diag(1, 1)])).toBe('main.cpp · 1 error');
    expect(statusLine([diag(1, 1), diag(2, 1)])).toBe('main.cpp · 2 errors');
  });

  it('shows warnings alone, and nothing for a clean file; notes are not counted', () => {
    expect(statusLine([diag(1, 1, 'warning')])).toBe('main.cpp · 1 warning');
    expect(statusLine([diag(1, 1, 'error'), diag(1, 1, 'warning'), diag(1, 1, 'warning')])).toBe('main.cpp · 1 error, 2 warnings');
    expect(statusLine([diag(1, 1, 'note')])).toBe('main.cpp');
    expect(statusLine([])).toBe('main.cpp');
  });

});

describe('BB-LAB-42: The log folds and remembers it', () => {
  const props = { diagnostics: [diag(3, 4)], consoleLines: [{ stream: 'stdout' as const, text: 'hello' }], onJump: () => {} };

  it('folds, unfolds and stores the fold', () => {
    const root = mount(h(LabLog, props));
    const toggle = root.querySelector('button[aria-expanded]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(root.textContent).toContain('main.cpp:3:4');
    act(() => toggle.click());
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(root.textContent).not.toContain('main.cpp:3:4');
    expect(storedFold()).toBe(true);
    act(() => toggle.click());
    expect(storedFold()).toBe(false);
    expect(root.textContent).toContain('main.cpp:3:4');
  });

  it('opens folded when the last visit left it folded, and survives blocked storage', async () => {
    localStorage.setItem('vams-lab', JSON.stringify({ state: { ...labProjectDefaults(), log: { folded: true } }, version: 1 }));
    await useLabStore.persist.rehydrate();
    const root = mount(h(LabLog, props));
    expect(root.querySelector('button[aria-expanded]')?.getAttribute('aria-expanded')).toBe('false');
    useLabStore.setState(labProjectDefaults());
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    try {
      await useLabStore.persist.rehydrate();
      const other = mount(h(LabLog, props));
      const toggle = other.querySelector('button[aria-expanded]') as HTMLButtonElement;
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      act(() => toggle.click());
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('switches between Compiler and Console', () => {
    const root = mount(h(LabLog, props));
    const tabs = [...root.querySelectorAll('[role="tab"]')] as HTMLElement[];
    expect(tabs.map((t) => t.textContent)).toEqual(['Compiler', 'Console']);
    act(() => tabs[1].click());
    expect(root.textContent).toContain('hello');
    expect(root.textContent).not.toContain('main.cpp:3:4');
  });
});

describe('BB-LAB-66: A keystroke typed before the parent catches up survives', () => {
  it('keeps both characters when value arrives one change behind', () => {
    const root = mount(h(LabEditor, { value: 'int a;', onChange: () => {}, diagnostics: [] }));
    const view = viewOf(root);
    act(() => view.dispatch({ changes: { from: 0, insert: 'x' }, userEvent: 'input.type' }));
    act(() => view.dispatch({ changes: { from: 1, insert: 'y' }, userEvent: 'input.type' }));
    act(() => render(h(LabEditor, { value: 'xint a;', onChange: () => {}, diagnostics: [] }), root));
    expect(view.state.doc.toString()).toBe('xyint a;');
    act(() => render(h(LabEditor, { value: 'xyint a;', onChange: () => {}, diagnostics: [] }), root));
    expect(view.state.doc.toString()).toBe('xyint a;');
  });

  it('still replaces the text when the page loads other code', () => {
    const root = mount(h(LabEditor, { value: 'int a;', onChange: () => {}, diagnostics: [] }));
    const view = viewOf(root);
    act(() => view.dispatch({ changes: { from: 0, insert: 'x' }, userEvent: 'input.type' }));
    act(() => render(h(LabEditor, { value: 'void f();', onChange: () => {}, diagnostics: [] }), root));
    expect(view.state.doc.toString()).toBe('void f();');
  });
});

describe('BB-LAB-67: A compiler that dies fails the compile, and the next Run starts a fresh one', () => {
  afterEach(() => setCompilerEnv());

  it('fails every compile waiting on a worker that errors, and keeps the compiler marked ready', async () => {
    const workers = fakeCompiler();
    const run = compileSource('v1', 'int a;');
    workers[0].reply({ type: 'ready' });
    await flush();
    workers[0].onerror?.(new Event('error'));
    const result = await run;
    expect(result).toEqual({ kind: 'failed' });
    expect(compileMessage(result)).toBe("The Lab couldn't compile this time. Your code is saved in this browser. Try Run again.");
    expect(workers[0].terminated).toBe(true);
    expect(useCompiler.getState().state).toBe('ready');
    void compileSource('v1', 'int b;');
    expect(workers).toHaveLength(2);
    expect(workers[1].sent[0]).toEqual({ type: 'prepare', version: 'v1' });
  });

  it('marks the download failed when the worker dies while downloading', async () => {
    const workers = fakeCompiler();
    const run = compileSource('v1', 'int a;');
    workers[0].reply({ type: 'progress', received: 1, total: 10 });
    workers[0].onerror?.(new Event('error'));
    expect(await run).toEqual({ kind: 'failed' });
    expect(useCompiler.getState().state).toBe('failed');
  });
});

describe('BB-LAB-68: A compile that passes 30 s is stopped, with its worker', () => {
  afterEach(() => {
    vi.useRealTimers();
    setCompilerEnv();
  });

  it('gives the time-limit message at 30 s, terminates the worker, and starts afresh after', async () => {
    vi.useFakeTimers();
    const workers = fakeCompiler();
    const run = compileSource('v1', 'while (1) {}');
    workers[0].reply({ type: 'ready' });
    await vi.advanceTimersByTimeAsync(29_999);
    expect(workers[0].terminated).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await run).toEqual({ kind: 'errors', diagnostics: [diag(1, 1, 'error', 'The compile took longer than 30 seconds, so it was stopped.')] });
    expect(TIME_LIMIT_MESSAGE).toBe('The compile took longer than 30 seconds, so it was stopped.');
    expect(COMPILE_TIME_LIMIT_MS).toBe(30_000);
    expect(workers[0].terminated).toBe(true);
    void compileSource('v1', 'int a;');
    expect(workers).toHaveLength(2);
  });

  it('counts the time from the compile, not from the download', async () => {
    vi.useFakeTimers();
    const workers = fakeCompiler();
    const run = compileSource('v1', 'int a;');
    await vi.advanceTimersByTimeAsync(60_000);
    workers[0].reply({ type: 'ready' });
    await vi.advanceTimersByTimeAsync(10_000);
    workers[0].reply({ type: 'result', id: workers[0].compiles()[0].id, result: { kind: 'ok', module: WASM, diagnostics: [] } });
    expect((await run).kind).toBe('ok');
    expect(workers[0].terminated).toBe(false);
  });
});

/** Cache Storage, in memory: each cache maps a path to its body. */
function memoryCaches(initial: Record<string, Record<string, string>> = {}): CachesLike & { names: () => string[] } {
  const store = new Map(Object.entries(initial).map(([name, files]) => [name, new Map(Object.entries(files))]));
  return {
    names: () => [...store.keys()],
    has: async (name) => store.has(name),
    keys: async () => [...store.keys()],
    delete: async (name) => store.delete(name),
    open: async (name) => {
      if (!store.has(name)) store.set(name, new Map());
      const files = store.get(name)!;
      return {
        match: async (path: string) => (files.has(path) ? new Response(files.get(path)) : undefined),
        put: async (path: string, response: Response) => void files.set(path, await response.text()),
      };
    },
  };
}

const MANIFEST_BODY = JSON.stringify({ files: [{ name: 'bundle.js', bytes: 3, stored: 2 }, { name: 'llvm.core.wasm', bytes: 5, stored: 4 }] });

describe('BB-LAB-69: The page knows the compiler is here only when every file is in its cache', () => {
  afterEach(() => setCompilerEnv());

  it('is ready with the manifest and every file it lists, and absent otherwise, without the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const whole = { '/lab-runtime/v1/compiler-manifest.json': MANIFEST_BODY, '/lab-runtime/v1/bundle.js': 'abc', '/lab-runtime/v1/llvm.core.wasm': 'abcde' };
    expect(await compilerCached(memoryCaches({ 'vams-lab-compiler-v1': whole }), 'v1')).toBe(true);
    const without = (key: string) => Object.fromEntries(Object.entries(whole).filter(([k]) => k !== key));
    const partial = without('/lab-runtime/v1/llvm.core.wasm');
    expect(await compilerCached(memoryCaches({ 'vams-lab-compiler-v1': partial }), 'v1')).toBe(false);
    const noManifest = without('/lab-runtime/v1/compiler-manifest.json');
    expect(await compilerCached(memoryCaches({ 'vams-lab-compiler-v1': noManifest }), 'v1')).toBe(false);
    expect(await compilerCached(memoryCaches(), 'v1')).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('sets the store from the cache, and a missing cache API means absent', async () => {
    const caches = memoryCaches({ 'vams-lab-compiler-v1': { '/lab-runtime/v1/compiler-manifest.json': MANIFEST_BODY, '/lab-runtime/v1/bundle.js': 'abc', '/lab-runtime/v1/llvm.core.wasm': 'abcde' } });
    setCompilerEnv({ caches: () => caches });
    await checkCompiler('v1');
    expect(useCompiler.getState().state).toBe('ready');
    setCompilerEnv({ caches: () => undefined });
    await checkCompiler('v1');
    expect(useCompiler.getState().state).toBe('absent');
  });

  it('fills the cache file by file with progress, puts the manifest in last, and keeps what it already holds', async () => {
    const caches = memoryCaches({ 'vams-lab-compiler-v1': { '/lab-runtime/v1/bundle.js': 'abc' } });
    const cache = await caches.open('vams-lab-compiler-v1');
    const asked: string[] = [];
    const fetchFn = (async (url: string) => {
      asked.push(url);
      if (url.endsWith('compiler-manifest.json')) return new Response(MANIFEST_BODY);
      if (url.endsWith('llvm.core.wasm')) return new Response('abcde');
      return new Response('', { status: 404 });
    }) as unknown as typeof fetch;
    const seen: number[] = [];
    await fillCompilerCache(cache, 'v1', fetchFn, (received) => seen.push(received));
    expect(asked).toEqual(['/lab-runtime/v1/compiler-manifest.json', '/lab-runtime/v1/llvm.core.wasm']);
    expect(seen[0]).toBe(0);
    expect(seen.at(-1)).toBe(8);
    expect(await compilerCached(caches, 'v1')).toBe(true);
  });

  it('refuses a file that arrives short, or answers other than 200, and leaves the cache not ready', async () => {
    for (const body of [new Response('abc'), new Response('nope', { status: 503 })]) {
      const caches = memoryCaches();
      const cache = await caches.open('vams-lab-compiler-v1');
      const fetchFn = (async (url: string) => (url.endsWith('.json') ? new Response(MANIFEST_BODY) : body.clone())) as unknown as typeof fetch;
      await expect(fillCompilerCache(cache, 'v1', fetchFn, () => {})).rejects.toBeInstanceOf(DownloadError);
      expect(await compilerCached(caches, 'v1')).toBe(false);
    }
  });

  it('answers the version from the cache and anything else from the network', async () => {
    const caches = memoryCaches({ c: { '/lab-runtime/v1/bundle.js': 'cached' } });
    const network = vi.fn(async () => new Response('net')) as unknown as typeof fetch;
    const f = cachedFetch(await caches.open('c'), 'v1', network);
    expect(await (await f(new URL('https://vams.pages.dev/lab-runtime/v1/bundle.js'))).text()).toBe('cached');
    expect(await (await f('/lab-runtime/v2/bundle.js')).text()).toBe('net');
  });

  it('builds the headers tree from the pack', () => {
    expect(headersTree({ 'include/GL/gl.h': 'a', 'include/GL/glu.h': 'b', 'sysroot/include/stdio.h': 'c' })).toEqual({
      include: { GL: { 'gl.h': 'a', 'glu.h': 'b' } },
      sysroot: { include: { 'stdio.h': 'c' } },
    });
  });
});

describe('BB-LAB-93: Opening the Lab deletes the compiler caches of older versions', () => {
  afterEach(() => setCompilerEnv());

  it('keeps this version and every other cache, and drops other compiler versions', async () => {
    const caches = memoryCaches({ 'vams-lab-compiler-old': {}, 'vams-lab-compiler-v1': {}, 'workbox-precache-v2': {} });
    setCompilerEnv({ caches: () => caches });
    await checkCompiler('v1');
    expect(caches.names().sort()).toEqual(['vams-lab-compiler-v1', 'workbox-precache-v2']);
  });
});

describe('BB-LAB-70: Sent texts are drained as the parent echoes them', () => {
  const type = (view: EditorView, at: number, text: string) =>
    act(() => view.dispatch({ changes: { from: at, insert: text }, userEvent: 'input.type' }));
  const echo = (root: HTMLElement, value: string) =>
    act(() => render(h(LabEditor, { value, onChange: () => {}, diagnostics: [] }), root));

  it('sets the text back to an earlier value after both edits were echoed', () => {
    const root = mount(h(LabEditor, { value: 'A', onChange: () => {}, diagnostics: [] }));
    const view = viewOf(root);
    type(view, 1, 'B');
    echo(root, 'AB');
    type(view, 2, 'C');
    echo(root, 'ABC');
    echo(root, 'A');
    expect(view.state.doc.toString()).toBe('A');
  });

  it('applies a reset to the loaded text after type, delete and type again', () => {
    const root = mount(h(LabEditor, { value: 'O', onChange: () => {}, diagnostics: [] }));
    const view = viewOf(root);
    type(view, 1, 'x');
    echo(root, 'Ox');
    act(() => view.dispatch({ changes: { from: 1, to: 2 }, userEvent: 'delete.backward' }));
    echo(root, 'O');
    type(view, 1, 'y');
    echo(root, 'Oy');
    echo(root, 'O');
    expect(view.state.doc.toString()).toBe('O');
  });
});
