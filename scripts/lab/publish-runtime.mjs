// Publishes the Lab's main module. It builds lab/runtime/build.sh in the pinned
// emscripten/emsdk image, uploads every file it makes to the LAB_RUNTIME KV
// namespace under <EMSDK_VERSION>-<sha8>/<file>, and writes that version into
// src/features/lab-run/model/runtime-version.ts, which is committed.
//
//   node scripts/lab/publish-runtime.mjs             build, upload, write the version
//   node scripts/lab/publish-runtime.mjs --dry-run   build and print the keys only
//
// sha8 is the first 8 hex digits of a SHA-256 over the files, by name, so the
// same build always has the same version and a changed one never reuses it.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
/** The LAB_RUNTIME namespace in wrangler.toml. */
export const NAMESPACE_ID = '03554bbf6ea4458bba35732e7e1f43db';
/** Where the build lands: inside lab/runtime/out/, which git leaves out. */
export const OUT = 'lab/runtime/out/publish';
export const VERSION_FILE = 'src/features/lab-run/model/runtime-version.ts';

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
  const emsdk = readFileSync(join(ROOT, 'lab/toolchain/EMSDK_VERSION'), 'utf8').trim();
  const out = join(ROOT, OUT);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  // Docker on Windows takes C:/ paths.
  const host = ROOT.replace(/\\/g, '/');
  run('docker', [
    'run', '--rm',
    '-v', `${host}:/src`,
    '-v', `${host}/lab/include:/lab/include:ro`,
    '-v', 'vams-lab-emcache:/emsdk/upstream/emscripten/cache',
    '-w', '/src',
    '-e', `OUT=/src/${OUT}`,
    `emscripten/emsdk:${emsdk}`,
    'sh', 'lab/runtime/build.sh',
  ]);
  const files = outputFiles(out);
  if (files.length === 0) {
    console.error(`the build left nothing in ${OUT}`);
    process.exit(1);
  }
  return { version: runtimeVersion(emsdk, files), files };
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const { version, files } = build();
  const keys = plannedKeys(version, files.map((f) => f.name));
  console.log(`\nruntime version ${version}`);
  for (const f of files) console.log(`  ${version}/${f.name}  (${f.bytes.length} bytes)`);
  if (dryRun) {
    console.log(`\ndry run: nothing uploaded, ${VERSION_FILE} unchanged (${keys.length} keys planned)`);
    return;
  }
  for (const f of files) {
    run('npx', ['wrangler', 'kv', 'key', 'put', '--namespace-id', NAMESPACE_ID, '--remote', `${version}/${f.name}`, '--path', f.path]);
  }
  mkdirSync(dirname(join(ROOT, VERSION_FILE)), { recursive: true });
  writeFileSync(join(ROOT, VERSION_FILE), versionModule(version));
  console.log(`\nuploaded ${keys.length} files and wrote ${VERSION_FILE}; commit it.`);
  console.log(`after the next Pages deploy: curl -I https://vams.pages.dev/lab-runtime/${keys.find((k) => k.endsWith('.wasm')) ?? keys[0]}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
