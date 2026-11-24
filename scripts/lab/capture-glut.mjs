// Records how FreeGLUT behaves on the reference, for the Lab's GLUT batteries. Each probe in
// tests/fixtures/lab/glut is built with the course toolchain and x.bat's flags, run natively, and
// what it did is written into tests/fixtures/lab/glut/reference.json under the battery's name.
//
//   VAMS_GLUT_TOOLCHAIN=<the toolchain's mingw32 folder> node scripts/lab/capture-glut.mjs [battery ...]
//
// Batteries:
//   misuse  every case of misuse.cpp, its name on standard input: stdout, stderr and the exit code.
//           The program's path in FreeGLUT's messages is written as <program>.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GLUT_DIR = join(ROOT, 'tests/fixtures/lab/glut');
const REFERENCE = join(GLUT_DIR, 'reference.json');

/** Builds `name`.cpp with x.bat's flags; the executable is named vams-*.exe so no driver profile moves it to another GPU. */
function build(name, toolchain, work) {
  const exe = join(work, `vams-${name}.exe`);
  const env = { ...process.env, PATH: `${join(toolchain, 'bin')};${process.env.PATH}` };
  const result = spawnSync(join(toolchain, 'bin', 'g++.exe'), [
    join(GLUT_DIR, `${name}.cpp`),
    `-I${join(toolchain, 'include')}`, `-L${join(toolchain, 'lib')}`,
    '-lglew32', '-lfreeglut', '-lopengl32', '-lglu32', '-lwinmm', '-lgdi32', '-Wl,--subsystem,windows',
    '-o', exe,
  ], { env, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${name}.cpp didn't build:\n${result.stderr}`);
  return { exe, env };
}

/** The case names in misuse.cpp: each CALLS entry twice (before glutInit and without a window), then the named cases. */
export function misuseCases(source) {
  const calls = [...source.matchAll(/\{ prefix "([\w-]+)"/g)].map((m) => m[1]);
  const named = [...source.matchAll(/^\s+\{ "([\w-]+)", \[\]/gm)].map((m) => m[1]);
  return [...calls.map((c) => `noinit-${c}`), ...calls.map((c) => `nowindow-${c}`), ...named];
}

function misuse(toolchain, work) {
  const { exe, env } = build('misuse', toolchain, work);
  const cases = {};
  for (const name of misuseCases(readFileSync(join(GLUT_DIR, 'misuse.cpp'), 'utf8'))) {
    const run = spawnSync(exe, [], { env, input: `${name}\n`, timeout: 10_000, encoding: 'utf8' });
    if (run.error) throw new Error(`${name}: ${run.error.message}`);
    const clean = (text) => text.replaceAll(exe, '<program>').replaceAll('\r\n', '\n');
    cases[name] = { stdout: clean(run.stdout), stderr: clean(run.stderr), exit: run.status };
    console.log(`${name}: exit ${run.status}${run.stderr ? `, ${clean(run.stderr).trim()}` : ''}`);
  }
  return cases;
}

const BATTERIES = { misuse };

const toolchain = process.env.VAMS_GLUT_TOOLCHAIN;
if (!toolchain) {
  console.error("Set VAMS_GLUT_TOOLCHAIN to the course toolchain's mingw32 folder.");
  process.exit(1);
}
const asked = process.argv.slice(2);
for (const name of asked) if (!(name in BATTERIES)) throw new Error(`There is no battery ${name}.`);
const reference = existsSync(REFERENCE) ? JSON.parse(readFileSync(REFERENCE, 'utf8')) : {};
const work = mkdtempSync(join(tmpdir(), 'vams-glut-capture-'));
try {
  for (const name of asked.length > 0 ? asked : Object.keys(BATTERIES)) reference[name] = BATTERIES[name](toolchain, work);
  reference.freeglut = '3.0.0, course toolchain, Intel Iris Xe, driver 31.0.101.4502';
  const sorted = Object.fromEntries(Object.entries(reference).sort(([a], [b]) => (a < b ? -1 : 1)));
  writeFileSync(REFERENCE, `${JSON.stringify(sorted, null, 2)}\n`.replaceAll('\n', '\r\n'));
} finally {
  rmSync(work, { recursive: true, force: true });
}
