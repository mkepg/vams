/**
 * The compiler worker's messages: one start of the compiler however many times the page asks,
 * then compiles one at a time, each announced with `started` as it leaves the queue so the page
 * times it from there. Kept apart from the worker's entry so the tests can drive it.
 */
import { compileWith, type BrowserCompileResult, type CompileTools, type FileTree } from '../model/compile';
import { DownloadError } from '../model/compiler-files';
import type { CompilerReply, CompilerRequest } from '../model/compiler-protocol';

/** The started compiler: its tools, and the headers every compile mounts. */
export interface Prepared {
  tools: CompileTools;
  headers: FileTree;
}

/** What the service needs of the worker's global scope. */
export interface CompilerScope {
  postMessage(message: CompilerReply, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<CompilerRequest>) => void) | null;
}

export type Prepare = (version: string, progress: (received: number, total: number) => void) => Promise<Prepared>;
export type Compile = (tools: CompileTools, source: string, headers: FileTree) => Promise<BrowserCompileResult>;

export function serveCompiler(scope: CompilerScope, prepare: Prepare, compile: Compile = compileWith): void {
  const post = (message: CompilerReply, transfer?: Transferable[]) => scope.postMessage(message, transfer ?? []);
  let ready: Promise<Prepared> | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  scope.onmessage = (event) => {
    const message = event.data;
    if (message.type === 'prepare') {
      ready ??= prepare(message.version, (received, total) => post({ type: 'progress', received, total }));
      ready.then(
        () => post({ type: 'ready' }),
        (error) => post({ type: 'download-failed', network: error instanceof DownloadError }),
      );
    } else if (message.type === 'compile') {
      const { id, source } = message;
      queue = queue.then(async () => {
        if (!ready) return post({ type: 'result', id, result: { kind: 'failed' } });
        try {
          const { tools, headers } = await ready;
          post({ type: 'started', id });
          const result = await compile(tools, source, headers);
          if (result.kind === 'ok') post({ type: 'result', id, result }, [result.module]);
          else post({ type: 'result', id, result });
        } catch {
          post({ type: 'result', id, result: { kind: 'failed' } });
        }
      });
    }
  };
}
