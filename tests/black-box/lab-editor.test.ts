/**
 * BLACK-BOX TEST SUITE — BB-LAB (the editor, the compile client and the log)
 * Test focus:
 *  - A compile error marks its line, and the Compiler tab jumps to line and column
 *  - The retry schedule, and the three messages the spec words
 *  - Ctrl+Enter and Cmd+Enter run; the status line counts errors
 *  - The log folds, and the fold is remembered
 */
import { describe, it, expect, vi } from 'vitest';
import { h, render } from 'preact';
import { useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { EditorView } from '@codemirror/view';
import { LabEditor, statusLine, type Diagnostic } from '@/features/lab-editor';
import { compileSource, compileMessage, visitorId, LAB_MESSAGES } from '@/features/lab-compile';
import { decodeDiagnostics } from '@/features/lab-compile/model/compile-client';
import { encodeDiagnostics } from '../../lab/service/src/server';
import LabLog from '@/widgets/lab-workspace/ui/LabLog';

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

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
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

describe('BB-LAB-38: Busy retries follow the schedule', () => {
  it('waits 1, 2, 4, 8, 16 and 29 s, calls onBusy once, and then compiles', async () => {
    const waits: number[] = [];
    const answers = [429, 503, 429, 429, 503, 429];
    const fetchFn = vi.fn(async () => {
      const next = answers.shift();
      if (next) return new Response('busy', { status: next });
      return new Response(new Uint8Array([0, 97, 115, 109]), { status: 200, headers: { 'content-type': 'application/wasm' } });
    });
    const onBusy = vi.fn();
    const result = await compileSource('int main(){}', { fetch: fetchFn, sleep: async (ms) => void waits.push(ms), onBusy });
    expect(waits).toEqual([1000, 2000, 4000, 8000, 16000, 29000]);
    expect(onBusy).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledTimes(7);
    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.module.byteLength).toBe(4);
  });

  it('gives up after the schedule', async () => {
    const waits: number[] = [];
    const result = await compileSource('x', { fetch: async () => new Response('busy', { status: 429 }), sleep: async (ms) => void waits.push(ms) });
    expect(waits.reduce((a, b) => a + b, 0)).toBe(60000);
    expect(result.kind).toBe('limited');
  });

  it('shows the spec’s busy line in the Compiler tab', () => {
    expect(LAB_MESSAGES.busy).toBe('Compiling… the Lab is busy, this can take a few seconds');
    const root = mount(h(LabLog, { diagnostics: [], consoleLines: [], onJump: () => {}, message: LAB_MESSAGES.busy }));
    expect(root.textContent).toContain('Compiling… the Lab is busy, this can take a few seconds');
  });

  it('does not retry a rate limit the service names, and stops when the caller does', async () => {
    const fetchFn = vi.fn(async () => json({ limit: 'visitor' }, 429));
    expect((await compileSource('x', { fetch: fetchFn, sleep: async () => {} })).kind).toBe('limited');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const controller = new AbortController();
    controller.abort();
    await expect(compileSource('x', { fetch: async () => json({}, 429), signal: controller.signal })).rejects.toThrow();
  });
});

describe('BB-LAB-39: Resting shows the spec message', () => {
  it('maps a rested month and a rested day', async () => {
    const month = await compileSource('x', { fetch: async () => json({ resting: 'month' }, 503) });
    const day = await compileSource('x', { fetch: async () => json({ resting: 'day' }, 503) });
    expect(month).toEqual({ kind: 'resting', until: 'month' });
    expect(day).toEqual({ kind: 'resting', until: 'day' });
    expect(compileMessage(month)).toBe('Run is resting until the 1st. Your code is saved in this browser.');
    expect(compileMessage(day)).toBe('Run is resting until tomorrow. Your code is saved in this browser.');
  });
});

describe('BB-LAB-40: Offline shows the spec message without a request', () => {
  it('does not fetch when the browser is offline', async () => {
    const fetchFn = vi.fn();
    const result = await compileSource('x', { fetch: fetchFn, online: () => false });
    expect(result).toEqual({ kind: 'offline' });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(compileMessage(result)).toBe('Run needs the internet. Your code is saved in this browser.');
  });

  it('reads navigator.onLine by default', async () => {
    const fetchFn = vi.fn();
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      expect((await compileSource('x', { fetch: fetchFn })).kind).toBe('offline');
      expect(fetchFn).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('maps the function’s offline answer and a failed request', async () => {
    expect((await compileSource('x', { fetch: async () => json({ offline: true }, 503), sleep: async () => {} })).kind).toBe('offline');
    expect(
      (
        await compileSource('x', {
          online: () => false,
          fetch: async () => {
            throw new TypeError('network');
          },
        })
      ).kind,
    ).toBe('offline');
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

  it('keeps a visitor id for the browser', () => {
    const first = visitorId();
    expect(first.length).toBeGreaterThan(4);
    expect(visitorId()).toBe(first);
    expect(localStorage.getItem('vams-lab-visitor')).toBe(first);
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
    expect(localStorage.getItem('vams-lab-log-folded')).toBe('1');
    act(() => toggle.click());
    expect(localStorage.getItem('vams-lab-log-folded')).toBe('0');
    expect(root.textContent).toContain('main.cpp:3:4');
  });

  it('opens folded when the last visit left it folded, and survives blocked storage', () => {
    localStorage.setItem('vams-lab-log-folded', '1');
    const root = mount(h(LabLog, props));
    expect(root.querySelector('button[aria-expanded]')?.getAttribute('aria-expanded')).toBe('false');
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    try {
      const other = mount(h(LabLog, props));
      expect(other.querySelector('button[aria-expanded]')?.getAttribute('aria-expanded')).toBe('true');
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

describe('BB-LAB-43: A keystroke typed before the parent catches up survives', () => {
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

describe('BB-LAB-44: Only a program counts as a program', () => {
  it('rejects a 200 that is not wasm', async () => {
    const html = await compileSource('x', { fetch: async () => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }) });
    expect(html).toEqual({ kind: 'failed', status: 200 });
  });

  it('accepts the wasm magic bytes when the content type is missing', async () => {
    const bytes = new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]);
    const result = await compileSource('x', { fetch: async () => new Response(bytes, { status: 200 }) });
    expect(result.kind).toBe('ok');
  });

  it('says failed for a broken service, not busy', async () => {
    for (const status of [400, 401, 404, 405, 500]) {
      const result = await compileSource('x', { fetch: async () => new Response('no', { status }), sleep: async () => {} });
      expect(result).toEqual({ kind: 'failed', status });
      expect(compileMessage(result)).toBe("The Lab couldn't compile this time. Your code is saved in this browser. Try Run again.");
    }
    expect(LAB_MESSAGES.failed).toBe("The Lab couldn't compile this time. Your code is saved in this browser. Try Run again.");
  });

  it('says failed with status 0 for a network error while online', async () => {
    const result = await compileSource('x', {
      online: () => true,
      fetch: async () => {
        throw new TypeError('network');
      },
    });
    expect(result).toEqual({ kind: 'failed', status: 0 });
  });
});

describe('BB-LAB-45: The retry wait and the time guard', () => {
  it('clears the timer and rejects when the caller stops during a wait', async () => {
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      const done = compileSource('x', { fetch: async () => new Response('busy', { status: 429 }), signal: controller.signal });
      const outcome = done.then(
        () => 'settled',
        (e: Error) => e.name,
      );
      await vi.advanceTimersByTimeAsync(0);
      expect(vi.getTimerCount()).toBe(1);
      controller.abort();
      expect(await outcome).toBe('AbortError');
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops retrying once more than 61 s have passed', async () => {
    const times = [0, 62000, 62000, 62000];
    const fetchFn = vi.fn(async () => new Response('busy', { status: 429 }));
    const onBusy = vi.fn();
    const result = await compileSource('x', { fetch: fetchFn, sleep: async () => {}, now: () => times.shift() ?? 62000, onBusy });
    expect(result.kind).toBe('limited');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(onBusy).not.toHaveBeenCalled();
  });
});

describe('BB-LAB-46: Diagnostics are read from the wire and checked', () => {
  it('decodes the header the service writes, with non-ASCII text', () => {
    const sent: Diagnostic[] = [diag(3, 5, 'error', 'expected “;” after é'), diag(4, 1, 'warning', 'unused')];
    expect(decodeDiagnostics(encodeDiagnostics(sent))).toEqual(sent);
  });

  it('drops malformed entries from the header and from a 422 body', async () => {
    const mixed = [diag(1, 2), { line: 'x' }, null, 7, { file: 'main.cpp', line: 2, col: 1, severity: 'loud', message: 'm' }, diag(5, 6, 'note')];
    const header = Buffer.from(JSON.stringify(mixed), 'utf8').toString('base64url');
    expect(decodeDiagnostics(header)).toEqual([diag(1, 2), diag(5, 6, 'note')]);
    const result = await compileSource('x', { fetch: async () => json({ diagnostics: mixed }, 422) });
    expect(result).toEqual({ kind: 'errors', diagnostics: [diag(1, 2), diag(5, 6, 'note')] });
  });

  it('reads the header of a successful compile', async () => {
    const header = encodeDiagnostics([diag(2, 2, 'warning', 'ü')]);
    const result = await compileSource('x', {
      fetch: async () => new Response(new Uint8Array([0, 0x61, 0x73, 0x6d]), { status: 200, headers: { 'content-type': 'application/wasm', 'x-lab-diagnostics': header } }),
    });
    expect(result.kind === 'ok' && result.diagnostics).toEqual([diag(2, 2, 'warning', 'ü')]);
  });
});

describe('BB-LAB-47: Sent texts are drained as the parent echoes them', () => {
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
