// Records the Lab's reference images. Each program in tests/fixtures/lab/programs is built with
// the course toolchain (x.bat's flags, plus the capture shim in tests/fixtures/lab/capture), run
// with its working directory in the programs folder so its images and Input.txt resolve, and its
// frame saved as tests/fixtures/lab/reference/<name>.png.
//
//   VAMS_GLUT_TOOLCHAIN=<the toolchain's mingw32 folder> node scripts/lab/capture-reference.mjs [name ...]
//
// stb_image.h is read from VAMS_STB_IMAGE, or from the Application folder beside mingw32.
// VAMS_CAPTURE_FRAME picks the frame to save (default 1). A program fails unless the renderer it
// ran on names VAMS_CAPTURE_RENDERER (default NVIDIA). Each capture records the SHA-256 of its
// program, and the renderer, in tests/fixtures/lab/reference/manifest.json. Needs Node 22.2 or
// later (node:zlib's crc32).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';
import { zlibSync } from 'fflate';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PROGRAMS = join(ROOT, 'tests/fixtures/lab/programs');
const CAPTURE = join(ROOT, 'tests/fixtures/lab/capture');
const REFERENCE = join(ROOT, 'tests/fixtures/lab/reference');
const MANIFEST = join(REFERENCE, 'manifest.json');

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  out.set(data, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** An 8-bit RGBA PNG of `rgba` (top row first), unfiltered. */
function encodePng(width, height, rgba) {
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', zlibSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** Builds and runs one program; returns its frame as a PNG, and the renderer it ran on. */
function capture(name, toolchain, stb, work) {
  const source = join(PROGRAMS, `${name}.cpp`);
  const cpp = readFileSync(source, 'utf8');
  const exe = join(work, `${name}.exe`);
  const out = join(work, `${name}.rgba`);
  const env = { ...process.env, PATH: `${join(toolchain, 'bin')};${process.env.PATH}`, VAMS_CAPTURE_OUT: out };

  const build = spawnSync(join(toolchain, 'bin', 'g++.exe'), [
    '-include', join(CAPTURE, 'capture-pre.h'), source, join(CAPTURE, 'capture.cpp'),
    `-I${join(toolchain, 'include')}`, `-I${stb}`, `-L${join(toolchain, 'lib')}`,
    '-lglew32', '-lfreeglut', '-lopengl32', '-lglu32', '-lwinmm', '-lgdi32', '-Wl,--subsystem,windows',
    '-o', exe,
  ], { env, encoding: 'utf8' });
  if (build.status !== 0) throw new Error(`${name} didn't build:\n${build.stderr}`);

  const run = spawnSync(exe, [], { cwd: PROGRAMS, env, timeout: 20_000, encoding: 'utf8' });
  if (run.status !== 0 || !existsSync(out)) throw new Error(`${name} didn't save a frame (exit ${run.status}).\n${run.stderr ?? ''}`);
  const renderer = run.stderr.trim().split(/\r?\n/).pop() ?? '';
  const want = process.env.VAMS_CAPTURE_RENDERER ?? 'NVIDIA';
  if (!renderer.includes(want)) throw new Error(`${name} ran on "${renderer}"; the references are recorded on ${want}.`);

  const frame = readFileSync(out);
  const width = frame.readInt32LE(0);
  const height = frame.readInt32LE(4);
  const samples = frame.readInt32LE(8);
  const declared = /glutInitWindowSize\(\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(cpp);
  if (!declared || +declared[1] !== width || +declared[2] !== height) {
    throw new Error(`${name}'s window is ${width} × ${height}; the program asks for ${declared?.[1]} × ${declared?.[2]}.`);
  }
  const multisample = /GLUT_MULTISAMPLE/.test(cpp);
  if (multisample ? samples !== 4 : samples > 1) {
    throw new Error(`${name} ran with ${samples} samples; the references are recorded with ${multisample ? 4 : 'none'}.`);
  }
  // glReadPixels starts at the bottom row. The window has no alpha to read.
  const rows = frame.subarray(12);
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) rgba.set(rows.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
  return { png: encodePng(width, height, rgba), renderer };
}

const toolchain = process.env.VAMS_GLUT_TOOLCHAIN;
if (!toolchain) {
  console.error("Set VAMS_GLUT_TOOLCHAIN to the course toolchain's mingw32 folder.");
  process.exit(1);
}
const stb = process.env.VAMS_STB_IMAGE ?? join(toolchain, '..', 'Application');
const names = process.argv.slice(2);
const all = readdirSync(PROGRAMS).filter((f) => f.endsWith('.cpp')).map((f) => basename(f, '.cpp'));
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { renderer: '', programs: {} };
const work = mkdtempSync(join(tmpdir(), 'vams-lab-capture-'));
try {
  for (const name of names.length > 0 ? names : all) {
    if (!all.includes(name)) throw new Error(`There is no ${name}.cpp in ${PROGRAMS}.`);
    const { png, renderer } = capture(name, toolchain, stb, work);
    writeFileSync(join(REFERENCE, `${name}.png`), png);
    manifest.renderer = renderer;
    manifest.programs[name] = createHash('sha256').update(readFileSync(join(PROGRAMS, `${name}.cpp`))).digest('hex');
    const programs = Object.fromEntries(Object.entries(manifest.programs).sort(([a], [b]) => (a < b ? -1 : 1)));
    writeFileSync(MANIFEST, `${JSON.stringify({ renderer: manifest.renderer, programs }, null, 2)}\n`.replaceAll('\n', '\r\n'));
    console.log(`${name}.png  ${png.length} bytes  (${renderer})`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
