/**
 * One compile of a student's program, as the browser's compiler runs it: the include check,
 * clang++ -c, wasm-ld and the section strip. The tools are passed in, so the steps run the same
 * in the compiler worker, with @yowasp/clang, and in the tests, with stand-ins.
 */
import type { Diagnostic } from '@/shared/lib/lab-diagnostic';
import { checkIncludes } from './includes';
import { rewriteDiagnostics } from './diagnostics';
import { MAIN_FILE, REPORT_FLAGS, SIDE_CC_FLAGS, SIDE_LD_FLAGS } from './flags';
import { stripSections } from './strip';

/** A folder of the compiler's file tree: each entry a file's text or bytes, or a folder. */
export interface FileTree {
  [name: string]: FileTree | string | Uint8Array;
}

/** A tool's run: it resolves with the files it wrote, and rejects when it exits with an error. */
export type Tool = (args: string[], files: FileTree, stderr: (text: string) => void) => Promise<FileTree>;

export interface CompileTools {
  clang: Tool;
  ld: Tool;
}

export type BrowserCompileResult =
  | { kind: 'ok'; module: ArrayBuffer; diagnostics: Diagnostic[] }
  | { kind: 'errors'; diagnostics: Diagnostic[] };

/** The largest source a compile takes, in UTF-8 bytes. */
export const MAX_SOURCE_BYTES = 200 * 1024;
/** How much of the compiler's messages a compile keeps. */
export const OUT_CAP_BYTES = 256 * 1024;

export const SOURCE_TOO_LARGE = 'The source is over 200 KB.';
export const MESSAGES_CAPPED = `The compiler's messages passed ${OUT_CAP_BYTES / 1024} KB, so the compile was stopped. Fix the first error and compile again.`;
export const COMPILE_STOPPED = 'The compiler stopped before it finished. Compile again.';
export const LINK_STOPPED = 'Linking stopped before it finished. Compile again.';

const fail = (line: number, col: number, message: string): Diagnostic => ({ file: 'main.cpp', line, col, severity: 'error', message });
const hasError = (d: Diagnostic[]) => d.some((x) => x.severity === 'error');

/** Collects a tool's messages up to the cap; the rest is counted, not kept. */
function messages() {
  let text = '';
  let capped = false;
  return {
    take: (chunk: string) => {
      if (capped) return;
      if (text.length + chunk.length > OUT_CAP_BYTES) {
        const room = chunk.slice(0, OUT_CAP_BYTES - text.length);
        // Keep whole lines: what passed the cap is cut at its last newline.
        text += room.slice(0, room.lastIndexOf('\n') + 1);
        capped = true;
      } else text += chunk;
    },
    get text() {
      return text;
    },
    get capped() {
      return capped;
    },
  };
}

async function step(tool: Tool, args: string[], files: FileTree): Promise<{ out: FileTree | null; text: string; capped: boolean }> {
  const said = messages();
  try {
    const out = await tool(args, files, said.take);
    return { out, text: said.text, capped: said.capped };
  } catch {
    return { out: null, text: said.text, capped: said.capped };
  }
}

const asBytes = (file: FileTree[string] | undefined): Uint8Array | null =>
  file instanceof Uint8Array ? file : typeof file === 'string' ? new TextEncoder().encode(file) : null;

/** Compiles one program against the headers pack, mounted at /lab. */
export async function compileWith(tools: CompileTools, source: string, headers: FileTree): Promise<BrowserCompileResult> {
  if (new TextEncoder().encode(source).length > MAX_SOURCE_BYTES) return { kind: 'errors', diagnostics: [fail(1, 1, SOURCE_TOO_LARGE)] };

  const checked = checkIncludes(source);
  if (!checked.ok) return { kind: 'errors', diagnostics: [fail(checked.line, checked.col, checked.message)] };

  const cc = await step(tools.clang, ['clang++', ...SIDE_CC_FLAGS, ...REPORT_FLAGS, '-c', MAIN_FILE, '-o', 'main.o'], {
    lab: headers,
    [MAIN_FILE]: checked.source,
  });
  const diagnostics = rewriteDiagnostics(cc.text);
  if (cc.capped) return { kind: 'errors', diagnostics: [...diagnostics, fail(1, 1, MESSAGES_CAPPED)] };
  const object = asBytes(cc.out?.['main.o']);
  if (!object) {
    if (!hasError(diagnostics)) diagnostics.push(fail(1, 1, COMPILE_STOPPED));
    return { kind: 'errors', diagnostics };
  }

  const ld = await step(tools.ld, ['wasm-ld', ...SIDE_LD_FLAGS, 'main.o', '-o', 'main.wasm'], { 'main.o': object });
  const linked = rewriteDiagnostics(ld.text);
  if (ld.capped) return { kind: 'errors', diagnostics: [...diagnostics, ...linked, fail(1, 1, MESSAGES_CAPPED)] };
  const module = asBytes(ld.out?.['main.wasm']);
  if (!module) {
    if (!hasError(linked)) linked.push(fail(1, 1, LINK_STOPPED));
    return { kind: 'errors', diagnostics: [...diagnostics, ...linked] };
  }
  diagnostics.push(...linked);

  let stripped: Uint8Array;
  try {
    stripped = stripSections(module);
  } catch {
    return { kind: 'errors', diagnostics: [...diagnostics, fail(1, 1, LINK_STOPPED)] };
  }
  const buffer = new ArrayBuffer(stripped.length);
  new Uint8Array(buffer).set(stripped);
  return { kind: 'ok', module: buffer, diagnostics };
}
