/**
 * BLACK-BOX TEST SUITE — BB-LAB (the compiler worker)
 * Test focus:
 *  - One start of the compiler, however many times the page asks, and the download's outcome
 *  - Compiles one at a time, each announced as it starts, and a compile that throws answers failed
 *  - The compiler's entry point is imported from its own cache, finding its files where they were
 */
import { describe, expect, it, vi } from 'vitest';
import { serveCompiler, type CompilerScope, type Prepared } from '@/features/lab-compile/worker/compiler-service';
import { DownloadError, localBundle } from '@/features/lab-compile/model/compiler-files';
import type { BrowserCompileResult } from '@/features/lab-compile/model/compile';
import type { CompilerReply, CompilerRequest } from '@/features/lab-compile/model/compiler-protocol';

const PREPARED: Prepared = { tools: { clang: async () => ({}), ld: async () => ({}) }, headers: {} };
const flush = () => new Promise((r) => setTimeout(r, 0));

function scope() {
  const sent: { message: CompilerReply; transfer?: Transferable[] }[] = [];
  const s: CompilerScope = {
    postMessage: (message, transfer) => void sent.push({ message, transfer }),
    onmessage: null,
  };
  const send = (message: CompilerRequest) => s.onmessage?.({ data: message } as MessageEvent<CompilerRequest>);
  return { s, sent, send, replies: () => sent.map((x) => x.message) };
}

/** A compile the test ends by hand. */
function deferred() {
  let resolve: (r: BrowserCompileResult) => void = () => {};
  const promise = new Promise<BrowserCompileResult>((r) => (resolve = r));
  return { promise, resolve };
}

describe('BB-LAB-106: The compiler worker starts once, and compiles one program at a time', () => {
  it('starts the compiler once for two prepares, reporting progress, and says ready to each', async () => {
    const { s, send, replies } = scope();
    const prepare = vi.fn(async (_version: string, progress: (received: number, total: number) => void) => {
      progress(5, 10);
      return PREPARED;
    });
    serveCompiler(s, prepare);
    send({ type: 'prepare', version: 'v1' });
    send({ type: 'prepare', version: 'v1' });
    await flush();
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(prepare.mock.calls[0][0]).toBe('v1');
    expect(replies()).toEqual([{ type: 'progress', received: 5, total: 10 }, { type: 'ready' }, { type: 'ready' }]);
  });

  it('tells a network failure from a compiler that wouldn\'t start', async () => {
    for (const [error, network] of [[new DownloadError('gone'), true], [new Error('bad module'), false]] as const) {
      const { s, send, replies } = scope();
      serveCompiler(s, async () => {
        throw error;
      });
      send({ type: 'prepare', version: 'v1' });
      await flush();
      expect(replies()).toEqual([{ type: 'download-failed', network }]);
    }
  });

  it('fails a compile sent before the compiler was asked to start', async () => {
    const { s, send, replies } = scope();
    serveCompiler(s, async () => PREPARED);
    send({ type: 'compile', id: 1, source: 'int a;' });
    await flush();
    expect(replies()).toEqual([{ type: 'result', id: 1, result: { kind: 'failed' } }]);
  });

  it('runs compiles in order, announcing each as it starts, and the next only after the last answered', async () => {
    const { s, send, replies } = scope();
    const runs = [deferred(), deferred()];
    const compile = vi.fn((_tools: Prepared['tools'], source: string) => runs[source === 'one' ? 0 : 1].promise);
    serveCompiler(s, async () => PREPARED, compile);
    send({ type: 'prepare', version: 'v1' });
    send({ type: 'compile', id: 1, source: 'one' });
    send({ type: 'compile', id: 2, source: 'two' });
    await flush();
    expect(replies().slice(1)).toEqual([{ type: 'started', id: 1 }]);
    runs[0].resolve({ kind: 'errors', diagnostics: [] });
    await flush();
    expect(replies().slice(1)).toEqual([
      { type: 'started', id: 1 },
      { type: 'result', id: 1, result: { kind: 'errors', diagnostics: [] } },
      { type: 'started', id: 2 },
    ]);
    expect(compile.mock.calls.map((c) => c[1])).toEqual(['one', 'two']);
  });

  it('hands an ok module over, and answers failed for a compile that throws', async () => {
    const { s, send, sent } = scope();
    const module = new ArrayBuffer(8);
    const compile = vi
      .fn<(tools: Prepared['tools'], source: string, headers: Prepared['headers']) => Promise<BrowserCompileResult>>()
      .mockResolvedValueOnce({ kind: 'ok', module, diagnostics: [] })
      .mockRejectedValueOnce(new RuntimeErrorLike());
    serveCompiler(s, async () => PREPARED, compile);
    send({ type: 'prepare', version: 'v1' });
    send({ type: 'compile', id: 1, source: 'int a;' });
    send({ type: 'compile', id: 2, source: 'int b;' });
    await flush();
    const results = sent.filter((x) => x.message.type === 'result');
    expect(results[0].transfer).toEqual([module]);
    expect(results[1].message).toEqual({ type: 'result', id: 2, result: { kind: 'failed' } });
  });
});

/** What a WebAssembly trap looks like to the worker: an error thrown out of the compile. */
class RuntimeErrorLike extends Error {}

describe('BB-LAB-107: The compiler\'s entry point runs from its own cache, finding its files beside its address', () => {
  it('replaces every import.meta.url with the address the entry point was fetched from', () => {
    const url = 'https://vams.pages.dev/lab-runtime/v1/bundle.js';
    const text = 'a(new URL("./llvm.core.wasm", import.meta.url)); b(new URL(`./${n}`, import.meta.url));';
    const local = localBundle(text, url);
    expect(local).not.toContain('import.meta');
    expect(local).toBe(`a(new URL("./llvm.core.wasm", "${url}")); b(new URL(\`./\${n}\`, "${url}"));`);
  });

  it('leaves code that names no address unchanged', () => {
    expect(localBundle('export const x = 1;', 'https://a/b.js')).toBe('export const x = 1;');
  });
});
