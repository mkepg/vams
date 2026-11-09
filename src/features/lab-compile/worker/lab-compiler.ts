/**
 * The Lab's compiler worker. On `prepare` it fills the version's cache with the compiler's
 * files, reporting progress, then starts @yowasp/clang from that cache and unpacks the headers.
 * On `compile` it runs one compile, one at a time (compiler-service.ts). The page terminates it
 * to stop a compile.
 *
 * @yowasp/clang reads `globalThis.fetch` once, when its bundle loads, so the cached fetch is put
 * in place before the bundle is imported. The bundle itself is read from the cache too and
 * imported from a blob URL (localBundle), so nothing of the compiler depends on the browser's HTTP
 * cache. A browser that can't keep the files in Cache Storage keeps them in this worker's memory
 * instead (openCompilerCache).
 */
import type { FileTree, Tool } from '../model/compile';
import {
  cachedFetch,
  COMPILER_ENTRY,
  fillCompilerCache,
  HEADERS_PACK,
  headersTree,
  localBundle,
  openCompilerCache,
  runtimeBase,
  type CachesLike,
} from '../model/compiler-files';
import { serveCompiler, type CompilerScope, type Prepare } from './compiler-service';

type Run = (args: string[], files: FileTree, options: Record<string, unknown>) => Promise<FileTree>;
interface Yowasp {
  runClang: Run;
  runLLVM: (args: string[] | null, files?: FileTree, options?: Record<string, unknown>) => Promise<FileTree | undefined>;
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

/** Imports the compiler's entry point from the cache, by way of a blob URL. */
async function importCompiler(version: string): Promise<Yowasp> {
  const url = new URL(runtimeBase(version) + COMPILER_ENTRY, self.location.href).href;
  const text = await (await globalThis.fetch(url)).text();
  const blob = URL.createObjectURL(new Blob([localBundle(text, url)], { type: 'text/javascript' }));
  try {
    return (await import(/* @vite-ignore */ blob)) as Yowasp;
  } finally {
    URL.revokeObjectURL(blob);
  }
}

const prepare: Prepare = async (version, progress) => {
  const cache = await openCompilerCache(typeof caches === 'undefined' ? undefined : (caches as unknown as CachesLike), version);
  const network = globalThis.fetch.bind(globalThis);
  await fillCompilerCache(cache, version, network, progress);
  globalThis.fetch = cachedFetch(cache, version, network);
  const headersResponse = await globalThis.fetch(runtimeBase(version) + HEADERS_PACK);
  const headers = headersTree((await headersResponse.json()) as Record<string, string>);
  const yowasp = await importCompiler(version);
  // Fetches and compiles the compiler's modules now, so the first compile's time is its own.
  await yowasp.runLLVM(null, {}, { fetchProgress: () => {} });
  return { tools: { clang: tool(yowasp.runClang), ld: tool((args, files, options) => yowasp.runLLVM(args, files, options) as Promise<FileTree>) }, headers };
};

if (typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope) {
  serveCompiler(globalThis as unknown as CompilerScope, prepare);
}
