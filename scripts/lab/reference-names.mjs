// Lists the names a lab PC's OpenGL headers declare, so a test can hold that every one the Lab's
// headers leave out gets a refusal that says what to use. Reads gl.h and glu.h from the course
// toolchain's i686-w64-mingw32/include/GL, and freeglut_std.h and freeglut_ext.h from its
// include/GL, and writes tests/fixtures/lab/reference-names.txt: the functions, constants and
// types, one a line, sorted.
//
//   VAMS_GLUT_TOOLCHAIN=<the toolchain's mingw32 folder> node scripts/lab/reference-names.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'tests/fixtures/lab/reference-names.txt');

/** The function, constant and type names a header declares. */
export function declaredNames(text) {
  const names = new Set();
  for (const m of text.matchAll(/\b((?:gl|glu|glut)[A-Z]\w*)\s*\(/g)) names.add(m[1]);
  for (const m of text.matchAll(/^\s*#\s*define\s+((?:GL|GLU|GLUT)_\w+)/gm)) names.add(m[1]);
  for (const m of text.matchAll(/\b((?:GL|GLU)[a-z]\w*)\s*;/g)) names.add(m[1]);
  return names;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const toolchain = process.env.VAMS_GLUT_TOOLCHAIN;
  if (!toolchain) {
    console.error('Set VAMS_GLUT_TOOLCHAIN to the course toolchain\'s mingw32 folder.');
    process.exit(2);
  }
  const headers = [
    join(toolchain, 'i686-w64-mingw32/include/GL/gl.h'),
    join(toolchain, 'i686-w64-mingw32/include/GL/glu.h'),
    join(toolchain, 'include/GL/freeglut_std.h'),
    join(toolchain, 'include/GL/freeglut_ext.h'),
  ];
  const names = new Set();
  for (const header of headers) for (const name of declaredNames(readFileSync(header, 'latin1'))) names.add(name);
  const lines = [
    '# The names a lab PC\'s gl.h, glu.h, freeglut_std.h and freeglut_ext.h declare, one a line.',
    '# Written by scripts/lab/reference-names.mjs from the course toolchain.',
    ...[...names].sort(),
  ];
  writeFileSync(OUT, `${lines.join('\r\n')}\r\n`);
  console.log(`wrote ${names.size} names to ${OUT}`);
}
