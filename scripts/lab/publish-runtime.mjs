// Publishes the Lab's runtime: the main module and the headers pack, which lab/runtime/build.sh
// builds in the pinned emscripten/emsdk image, and the browser's compiler, the files of the
// pinned @yowasp/clang. It stores every file brotli-compressed in the LAB_RUNTIME KV namespace
// under <EMSDK_VERSION>-<sha8>/<file>, with the compiler's manifest, and writes that version into
// src/features/lab-run/model/runtime-version.ts, which is committed.
//
//   node scripts/lab/publish-runtime.mjs             build, upload, write the version
//   node scripts/lab/publish-runtime.mjs --dry-run   build, compress and check, print the keys only
//
// sha8 is the first 8 hex digits of a SHA-256 over the files, by name, so the same build always
// has the same version and a changed one never reuses it.
//
// It refuses to publish when a stored file is over KV's 25 MiB, or when the compiler's download
// rounds to another number of megabytes than the Lab's notice states.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { brotliCompressSync, constants } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
/** The LAB_RUNTIME namespace in wrangler.toml. */
export const NAMESPACE_ID = '03554bbf6ea4458bba35732e7e1f43db';
/** Where the build lands, and the compressed copies: inside lab/runtime/out/, which git leaves out. */
export const OUT = 'lab/runtime/out/publish';
export const STORED_OUT = 'lab/runtime/out/publish-br';
export const VERSION_FILE = 'src/features/lab-run/model/runtime-version.ts';
/** Where the pinned @yowasp/clang keeps the compiler's files. */
export const COMPILER_DIR = 'node_modules/@yowasp/clang/gen';
export const MANIFEST = 'compiler-manifest.json';
/** The files the program worker loads itself; every other file is the compiler's download. */
export const MAIN_MODULE_FILES = ['vams_main.mjs', 'vams_main.wasm'];
/** The largest value KV stores. */
export const KV_VALUE_LIMIT = 25 * 1024 * 1024;
/** The notice's megabytes, as src/features/lab-compile/model/messages.ts states them. */
export const MESSAGES_FILE = 'src/features/lab-compile/model/messages.ts';
/** What KV holds beside a compressed file, so the runtime function sends it with Content-Encoding: br. */
export const STORED_METADATA = '{"encoding":"br"}';

/** `<emsdk>-<sha8>` for the files, each `{ name, bytes }`, in whatever order they come. */
export function runtimeVersion(emsdk, files) {
  const hash = createHash('sha256');
  for (const f of [...files].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    hash.update(`${f.name}\0${f.bytes.length}\0`);
    hash.update(f.bytes);
  }
  return `${emsdk}-${hash.digest('hex').slice(0, 8)}`;
}

/** The KV key of each file. */
export const plannedKeys = (version, names) => [...names].sort().map((name) => `${version}/${name}`);

/** The source of runtime-version.ts for a version. */
export const versionModule = (version) =>
  [
    '/** The shared runtime the Lab loads from /lab-runtime/<version>/. Written by scripts/lab/publish-runtime.mjs. */',
    `export const runtimeVersion = '${version}';`,
    '',
  ].join('\n');

/** The files a build left in a folder, by name: regular files only, sorted. */
export function outputFiles(folder) {
  return readdirSync(folder)
    .filter((name) => statSync(join(folder, name)).isFile())
    .sort()
    .map((name) => ({ name, path: join(folder, name), bytes: readFileSync(join(folder, name)) }));
}

/** A file as KV stores it: brotli at its best, for a file that is compressed once and read many times. */
export const compress = (bytes) =>
  brotliCompressSync(bytes, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
      [constants.BROTLI_PARAM_LGWIN]: constants.BROTLI_MAX_WINDOW_BITS,
      [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length,
    },
  });

/** The compiler's manifest: every file but the main module's, with its size unpacked and as stored. */
export function compilerManifest(files) {
  return {
    files: files
      .filter((f) => !MAIN_MODULE_FILES.includes(f.name) && f.name !== MANIFEST)
      .map((f) => ({ name: f.name, bytes: f.bytes.length, stored: f.stored })),
  };
}

/** The names of the files whose stored size is over KV's limit. */
export const storedTooLarge = (files) => files.filter((f) => f.stored > KV_VALUE_LIMIT).map((f) => f.name);

/** The compiler's download in megabytes, as stored, rounded. */
export const downloadMegabytes = (manifest) => Math.round(manifest.files.reduce((n, f) => n + f.stored, 0) / 1_000_000);

/** The megabytes the notice states, read from messages.ts. */
export function noticeMegabytes(source) {
  const match = /export const COMPILER_DOWNLOAD_MB = (\d+);/.exec(source);
  if (!match) throw new Error(`${MESSAGES_FILE} has no COMPILER_DOWNLOAD_MB`);
  return Number(match[1]);
}

/** Why the files can't be published, or an empty list when they can. */
export function publishProblems(files, manifest, noticeMb) {
  const problems = storedTooLarge(files).map((name) => `${name} is over 25 MiB as stored`);
  const mb = downloadMegabytes(manifest);
  if (mb !== noticeMb) problems.push(`the compiler downloads about ${mb} MB, but the notice says ${noticeMb} MB: change COMPILER_DOWNLOAD_MB in ${MESSAGES_FILE}`);
  if (!manifest.files.some((f) => f.name === 'bundle.js')) problems.push(`${COMPILER_DIR} holds no bundle.js: run npm ci`);
  if (!manifest.files.some((f) => f.name === 'lab-headers.json')) problems.push('the build left no lab-headers.json');
  return problems;
}

const quote = (arg) => (/^[\w./:=@-]+$/.test(arg) ? arg : `"${arg.replace(/"/g, '\\"')}"`);

/** Runs a command and stops the script if it fails. npx is a .cmd on Windows, so this goes through the shell. */
function run(command, args) {
  const line = [command, ...args].map(quote).join(' ');
  const r = spawnSync(line, { cwd: ROOT, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error(`failed (${r.status ?? r.signal}): ${line}`);
    process.exit(1);
  }
}

function build() {
  const emsdk = readFileSync(join(ROOT, 'lab/runtime/EMSDK_VERSION'), 'utf8').trim();
  const out = join(ROOT, OUT);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  // Docker on Windows takes C:/ paths.
  const host = ROOT.replace(/\\/g, '/');
  run('docker', [
    'run', '--rm',
    '-v', `${host}:/src`,
    '-v', 'vams-lab-emcache:/emsdk/upstream/emscripten/cache',
    '-w', '/src',
    '-e', `OUT=/src/${OUT}`,
    `emscripten/emsdk:${emsdk}`,
    'sh', 'lab/runtime/build.sh',
  ]);
  const compiler = join(ROOT, COMPILER_DIR);
  for (const name of readdirSync(compiler)) {
    if (statSync(join(compiler, name)).isFile()) copyFileSync(join(compiler, name), join(out, name));
  }
  const built = outputFiles(out);
  if (built.length === 0) {
    console.error(`the build left nothing in ${OUT}`);
    process.exit(1);
  }
  const version = runtimeVersion(emsdk, built);
  const stored = join(ROOT, STORED_OUT);
  rmSync(stored, { recursive: true, force: true });
  mkdirSync(stored, { recursive: true });
  const files = built.map((f) => {
    const packed = compress(f.bytes);
    writeFileSync(join(stored, f.name), packed);
    return { ...f, stored: packed.length, storedPath: join(stored, f.name) };
  });
  const manifest = compilerManifest(files);
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  const packedManifest = compress(manifestBytes);
  writeFileSync(join(stored, MANIFEST), packedManifest);
  files.push({ name: MANIFEST, bytes: manifestBytes, stored: packedManifest.length, storedPath: join(stored, MANIFEST) });
  return { version, files, manifest };
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const { version, files, manifest } = build();
  const keys = plannedKeys(version, files.map((f) => f.name));
  console.log(`\nruntime version ${version}`);
  for (const f of files) console.log(`  ${version}/${f.name}  (${f.bytes.length} bytes, ${f.stored} stored)`);
  console.log(`the compiler downloads about ${downloadMegabytes(manifest)} MB`);
  const problems = publishProblems(files, manifest, noticeMegabytes(readFileSync(join(ROOT, MESSAGES_FILE), 'utf8')));
  if (problems.length > 0) {
    for (const p of problems) console.error(`refused: ${p}`);
    process.exit(1);
  }
  if (dryRun) {
    console.log(`\ndry run: nothing uploaded, ${VERSION_FILE} unchanged (${keys.length} keys planned)`);
    return;
  }
  for (const f of files) {
    run('npx', [
      'wrangler', 'kv', 'key', 'put', '--namespace-id', NAMESPACE_ID, '--remote',
      `${version}/${f.name}`, '--path', f.storedPath, '--metadata', STORED_METADATA,
    ]);
  }
  mkdirSync(dirname(join(ROOT, VERSION_FILE)), { recursive: true });
  writeFileSync(join(ROOT, VERSION_FILE), versionModule(version));
  console.log(`\nuploaded ${keys.length} files and wrote ${VERSION_FILE}; commit it.`);
  console.log(`after the next Pages deploy: curl -sI https://vams.pages.dev/lab-runtime/${version}/llvm.core.wasm`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
