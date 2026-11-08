// Packs the headers the browser's compiler reads into one JSON file: the Emscripten sysroot's
// include folder, less the graphics, audio and browser headers (the GL headers a program sees
// are the bundled ones in lab/include), and lab/include itself. Each key is the file's path
// under /lab, where the compiler's file tree mounts the pack.
//
//   node lab/runtime/pack-headers.mjs <sysroot include> <lab include> <out.json>
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

/** The pack: `sysroot/include/<path>` and `include/<path>`, each the file's text. */
export function packHeaders(sysrootInclude, labInclude) {
  const out = {};
  walk(sysrootInclude, 'sysroot/include', SKIPPED, out);
  walk(labInclude, 'include', [], out);
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [sysrootInclude, labInclude, outFile] = process.argv.slice(2);
  if (!outFile) {
    console.error('usage: node pack-headers.mjs <sysroot include> <lab include> <out.json>');
    process.exit(2);
  }
  const pack = packHeaders(sysrootInclude, labInclude);
  writeFileSync(outFile, JSON.stringify(pack));
  console.log(`packed ${Object.keys(pack).length} headers into ${outFile}`);
}
