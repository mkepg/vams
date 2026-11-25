// Packs the headers the browser's compiler reads into one JSON file: the Emscripten sysroot's
// include folder, less the graphics, audio and browser headers (the GL headers a program sees
// are the bundled ones in lab/include), and lab/include itself. Each key is the file's path
// under /lab, where the compiler's file tree mounts the pack.
//
// Given the main module too, the pack also holds symbols.txt: every name a program's side module
// can find when it loads, one a line. wasm-ld reads it as --allow-undefined-file, so a function
// that is declared but never defined stops the link on its name, as it does on a lab PC.
//
//   node lab/runtime/pack-headers.mjs <sysroot include> <lab include> <out.json> [<vams_main.mjs>]
//
// lab/runtime/build.sh runs it inside the pinned emscripten/emsdk image.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** What the sysroot's include folder loses at its top. */
export const SKIPPED = ['GL', 'GLES', 'GLES2', 'GLES3', 'EGL', 'KHR', 'SDL', 'AL', 'X11', 'GLFW', 'webgl', 'webgpu', 'emscripten', 'emscripten.h'];

const utf8 = new TextDecoder('utf-8', { fatal: true });

function walk(root, prefix, skipTop, out) {
  const visit = (dir, rel) => {
    for (const name of readdirSync(dir).sort()) {
      if (rel === '' && skipTop.includes(name)) continue;
      const path = join(dir, name);
      const key = rel ? `${rel}/${name}` : name;
      if (statSync(path).isDirectory()) visit(path, key);
      else {
        try {
          out[`${prefix}/${key}`] = utf8.decode(readFileSync(path));
        } catch {
          throw new Error(`${path} is not UTF-8 text`);
        }
      }
    }
  };
  visit(root, '');
}

/** The pack's key for the names a side module can find. */
export const SYMBOLS = 'symbols.txt';

/**
 * The keys of the `wasmImports` object in Emscripten's JavaScript: the library functions a side
 * module's imports resolve to. Only the object's own keys count, not those of objects inside it.
 */
export function libraryNames(mainJs) {
  const start = mainJs.indexOf('wasmImports={');
  if (start < 0) throw new Error('the main module has no wasmImports');
  const names = [];
  let depth = 0;
  let key = true;
  for (let i = start + 'wasmImports='.length; i < mainJs.length; i++) {
    const c = mainJs[i];
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') {
      depth--;
      if (depth === 0) return names;
    } else if (depth === 1 && c === ',') key = true;
    else if (depth === 1 && key && /[A-Za-z_$]/.test(c)) {
      const m = /^[A-Za-z_$][\w$]*(?=:)/.exec(mainJs.slice(i));
      if (m) names.push(m[0]);
      key = false;
    }
  }
  throw new Error('wasmImports never closes');
}

/** Every name a side module can import: the main module's exports and the library's functions, sorted. */
export function symbolNames(mainJs, mainWasm) {
  const exported = WebAssembly.Module.exports(new WebAssembly.Module(mainWasm)).map((e) => e.name);
  return [...new Set([...exported, ...libraryNames(mainJs)])].sort();
}

/** The pack: `sysroot/include/<path>` and `include/<path>`, each the file's text, and symbols.txt when the names are given. */
export function packHeaders(sysrootInclude, labInclude, symbols) {
  const out = {};
  walk(sysrootInclude, 'sysroot/include', SKIPPED, out);
  walk(labInclude, 'include', [], out);
  if (symbols) out[SYMBOLS] = `${symbols.join('\n')}\n`;
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [sysrootInclude, labInclude, outFile, mainJs] = process.argv.slice(2);
  if (!outFile) {
    console.error('usage: node pack-headers.mjs <sysroot include> <lab include> <out.json> [<vams_main.mjs>]');
    process.exit(2);
  }
  const symbols = mainJs
    ? symbolNames(readFileSync(mainJs, 'utf8'), readFileSync(mainJs.replace(/\.mjs$/, '.wasm')))
    : undefined;
  const pack = packHeaders(sysrootInclude, labInclude, symbols);
  writeFileSync(outFile, JSON.stringify(pack));
  console.log(`packed ${Object.keys(pack).length - (symbols ? 1 : 0)} headers${symbols ? ` and ${symbols.length} names` : ''} into ${outFile}`);
}
