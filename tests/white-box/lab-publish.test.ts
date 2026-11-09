/**
 * WHITE-BOX TEST SUITE — WB-LAB (publishing the Lab's runtime)
 * scripts/lab/publish-runtime.mjs, checked offline. Nothing here reaches Cloudflare.
 *
 * Test focus:
 *  - The runtime version is the emsdk version and a hash of the files, whatever their order
 *  - Every file is stored brotli-compressed; the compiler's manifest lists all but the main module
 *  - Publishing is refused for a stored file over 25 MiB, or a download the notice misstates
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import {
  compilerManifest,
  compress,
  downloadMegabytes,
  KV_VALUE_LIMIT,
  noticeMegabytes,
  outputFiles,
  plannedKeys,
  publishProblems,
  runtimeVersion,
  STORED_METADATA,
  storedTooLarge,
  versionModule,
} from '../../scripts/lab/publish-runtime.mjs';

const dirs: string[] = [];
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'vams-publish-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

describe('WB-LAB-15: The runtime version is <EMSDK_VERSION>-<sha8> of the files', () => {
  const a = { name: 'vams_main.mjs', bytes: Buffer.from('export default 1;') };
  const b = { name: 'vams_main.wasm', bytes: Buffer.from([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]) };

  it('is the same whatever order the files come in, and changes with any byte or name', () => {
    const v = runtimeVersion('4.0.10', [a, b]);
    expect(v).toMatch(/^4\.0\.10-[0-9a-f]{8}$/);
    expect(runtimeVersion('4.0.10', [b, a])).toBe(v);
    expect(runtimeVersion('4.0.10', [a, { ...b, bytes: Buffer.from([0, 0x61, 0x73, 0x6d, 1, 0, 0, 1]) }])).not.toBe(v);
    expect(runtimeVersion('4.0.10', [a, { ...b, name: 'vams_main2.wasm' }])).not.toBe(v);
    expect(runtimeVersion('4.0.11', [a, b]).slice(-8)).toBe(v.slice(-8));
  });

  it('plans one key per file under the version, and writes the version as one exported constant', () => {
    expect(plannedKeys('4.0.10-0123abcd', ['vams_main.wasm', 'vams_main.mjs'])).toEqual([
      '4.0.10-0123abcd/vams_main.mjs',
      '4.0.10-0123abcd/vams_main.wasm',
    ]);
    const source = versionModule('4.0.10-0123abcd');
    expect(source.match(/^export /gm)).toHaveLength(1);
    expect(source).toContain("export const runtimeVersion = '4.0.10-0123abcd';");
  });

  it('uploads the files the build left, and not the folders beside them', () => {
    const dir = temp();
    writeFileSync(join(dir, 'vams_main.wasm'), 'w');
    writeFileSync(join(dir, 'vams_main.mjs'), 'm');
    mkdirSync(join(dir, 'check'));
    writeFileSync(join(dir, 'check', 'hello.wasm'), 'h');
    expect(outputFiles(dir).map((f: { name: string }) => f.name)).toEqual(['vams_main.mjs', 'vams_main.wasm']);
  });
});

describe('WB-LAB-25: The compiler is stored compressed, listed in its manifest, and checked before it is published', () => {
  const file = (name: string, size: number, stored = Math.ceil(size / 4)) => ({ name, bytes: Buffer.alloc(size, 1), stored });
  const files = [
    file('vams_main.mjs', 10),
    file('vams_main.wasm', 20),
    file('bundle.js', 250_000, 60_000),
    file('llvm.core.wasm', 75_000_000, 17_200_000),
    file('llvm-resources.tar', 29_000_000, 3_100_000),
    file('lab-headers.json', 15_000_000, 1_200_000),
  ];

  it('compresses with brotli and gives the bytes back unpacked', () => {
    const text = Buffer.from('#include <GL/glut.h>\n'.repeat(200));
    const packed = compress(text);
    expect(packed.length).toBeLessThan(text.length / 10);
    expect(brotliDecompressSync(packed)).toEqual(text);
    expect(JSON.parse(STORED_METADATA)).toEqual({ encoding: 'br' });
  });

  it('lists every file but the main module, with its unpacked and stored sizes', () => {
    expect(compilerManifest(files)).toEqual({
      files: [
        { name: 'bundle.js', bytes: 250_000, stored: 60_000 },
        { name: 'llvm.core.wasm', bytes: 75_000_000, stored: 17_200_000 },
        { name: 'llvm-resources.tar', bytes: 29_000_000, stored: 3_100_000 },
        { name: 'lab-headers.json', bytes: 15_000_000, stored: 1_200_000 },
      ],
    });
    expect(downloadMegabytes(compilerManifest(files))).toBe(22);
  });

  it('publishes when every file fits and the notice states the download', () => {
    expect(publishProblems(files, compilerManifest(files), 22)).toEqual([]);
  });

  it('refuses a stored file over 25 MiB, a misstated download, and a missing compiler or headers pack', () => {
    const big = [...files, file('huge.wasm', 1, KV_VALUE_LIMIT + 1)];
    expect(storedTooLarge(big)).toEqual(['huge.wasm']);
    expect(storedTooLarge([file('edge.wasm', 1, KV_VALUE_LIMIT)])).toEqual([]);
    const problems = publishProblems(big, compilerManifest(big), 22);
    expect(problems.join('\n')).toMatch(/huge\.wasm is over 25 MiB/);
    expect(problems.join('\n')).toMatch(/about 48 MB, but the notice says 22 MB/);
    const bare = files.filter((f) => f.name !== 'bundle.js' && f.name !== 'lab-headers.json');
    expect(publishProblems(bare, compilerManifest(bare), 21).join('\n')).toMatch(/no bundle\.js[\s\S]*no lab-headers\.json/);
  });

  it('reads the notice’s megabytes from messages.ts', () => {
    expect(noticeMegabytes(readFileSync('src/features/lab-compile/model/messages.ts', 'utf8'))).toBe(22);
    expect(() => noticeMegabytes('export const OTHER = 1;')).toThrow();
  });
});
