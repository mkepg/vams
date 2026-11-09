/**
 * The Lab's compiler worker. On `prepare` it fills the version's cache with the compiler's
 * files, reporting progress, then starts @yowasp/clang from that cache and unpacks the headers.
 * On `compile` it runs one compile, one at a time. The page terminates it to stop a compile.
 *
 * @yowasp/clang reads `globalThis.fetch` once, when its bundle loads, so the cached fetch is put
 * in place before the bundle is imported. A browser that can't keep the files in Cache Storage
 * keeps them in this worker's memory instead (openCompilerCache).
 */
import { compileWith, type CompileTools, type FileTree, type Tool } from '../model/compile';
import {
  cachedFetch,
  COMPILER_ENTRY,
  DownloadError,
  fillCompilerCache,
  HEADERS_PACK,
  headersTree,
  openCompilerCache,
  runtimeBase,
  type CachesLike,
} from '../model/compiler-files';
import type { CompilerReply, CompilerRequest } from '../model/compiler-protocol';

type Run = (args: string[], files: FileTree, options: Record<string, unknown>) => Promise<FileTree>;
interface Yowasp {
  runClang: Run;
  runLLVM: (args: string[] | null, files?: FileTree, options?: Record<string, unknown>) => Promise<FileTree | undefined>;
}

interface Scope {
  postMessage(message: CompilerReply, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<CompilerRequest>) => void) | null;
}

declare const WorkerGlobalScope: { new (): unknown } | undefined;

function tool(run: Run): Tool {
  return (args, files, stderr) => {
    const decoder = new TextDecoder();
    return run(args, files, {
      stdout: null,
      stderr: (bytes: Uint8Array | null) => {
        const text = bytes ? decoder.decode(bytes, { stream: true }) : decoder.decode();
        if (text) stderr(text);
      },
      decodeASCII: false,
    });
  };
}

async function prepare(version: string, post: Scope['postMessage']): Promise<{ tools: CompileTools; headers: FileTree }> {
  const cache = await openCompilerCache(typeof caches === 'undefined' ? undefined : (caches as unknown as CachesLike), version);
  const network = globalThis.fetch.bind(globalThis);
  await fillCompilerCache(cache, version, network, (received, total) => post({ type: 'progress', received, total }));
  globalThis.fetch = cachedFetch(cache, version, network);
  const headersResponse = await globalThis.fetch(runtimeBase(version) + HEADERS_PACK);
  const headers = headersTree((await headersResponse.json()) as Record<string, string>);
  const yowasp = (await import(/* @vite-ignore */ runtimeBase(version) + COMPILER_ENTRY)) as Yowasp;
  // Fetches and compiles the compiler's modules now, so the first compile's time is its own.
  await yowasp.runLLVM(null, {}, { fetchProgress: () => {} });
  return { tools: { clang: tool(yowasp.runClang), ld: tool((args, files, options) => yowasp.runLLVM(args, files, options) as Promise<FileTree>) }, headers };
}

if (typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope) {
  const scope = globalThis as unknown as Scope;
  const post: Scope['postMessage'] = (message, transfer) => scope.postMessage(message, transfer ?? []);
  let ready: Promise<{ tools: CompileTools; headers: FileTree }> | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  scope.onmessage = (event) => {
    const message = event.data;
    if (message.type === 'prepare') {
      ready ??= prepare(message.version, post);
      ready.then(
        () => post({ type: 'ready' }),
        (error) => post({ type: 'download-failed', network: error instanceof DownloadError }),
      );
    } else if (message.type === 'compile') {
      queue = queue.then(async () => {
        if (!ready) return post({ type: 'result', id: message.id, result: { kind: 'failed' } });
        try {
          const { tools, headers } = await ready;
          const result = await compileWith(tools, message.source, headers);
          if (result.kind === 'ok') post({ type: 'result', id: message.id, result }, [result.module]);
          else post({ type: 'result', id: message.id, result });
        } catch {
          post({ type: 'result', id: message.id, result: { kind: 'failed' } });
        }
      });
    }
  };
}
