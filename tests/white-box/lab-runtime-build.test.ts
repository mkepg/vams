/**
 * WHITE-BOX TEST SUITE — WB-LAB (how lab/runtime/build.sh builds the runtime)
 * The main module can't evaluate JavaScript a program carries, and the headers the browser's
 * compiler reads are packed beside it, without the sysroot's graphics, audio and browser headers.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { shellVariables } from '../helpers/shell-vars';
import { libraryNames, packHeaders, SKIPPED, SYMBOLS, symbolNames } from '../../lab/runtime/pack-headers.mjs';

const script = readFileSync(join(process.cwd(), 'lab/runtime/build.sh'), 'utf8');

describe('WB-LAB-21: The main module is built without dynamic execution', () => {
  it('puts -sDYNAMIC_EXECUTION=0 in MAIN_FLAGS', () => {
    const words = (shellVariables(script).get('MAIN_FLAGS') ?? '').split(/\s+/);
    expect(words).toContain('-sDYNAMIC_EXECUTION=0');
    expect(words).toContain('-sMAIN_MODULE=1');
  });

  it('packs the headers after the build, with the main module for its names', () => {
    expect(script).toMatch(/node "\$HERE\/pack-headers\.mjs" .*"\$OUT\/lab-headers\.json" "\$OUT\/vams_main\.mjs"/);
  });
});

describe('WB-LAB-22: The headers pack holds the sysroot and lab/include under /lab', () => {
  let dir = '';
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const put = (path: string, text: string | Uint8Array) => {
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, text);
  };

  it('keys each file by its path, skips the removed folders at the top only, and keeps the text', () => {
    dir = mkdtempSync(join(tmpdir(), 'vams-pack-'));
    const sys = join(dir, 'sys');
    const lab = join(dir, 'lab');
    put(join(sys, 'stdio.h'), '/* stdio */');
    put(join(sys, 'c++/v1/vector'), '// vector');
    put(join(sys, 'GL/gl.h'), 'emscripten gl');
    put(join(sys, 'emscripten.h'), 'em');
    put(join(sys, 'emscripten/em_asm.h'), 'em');
    put(join(sys, 'c++/v1/GL/keep.h'), 'deeper GL stays');
    put(join(lab, 'GL/glut.h'), '// the bundled glut, ü');
    const pack = packHeaders(sys, lab);
    expect(Object.keys(pack).sort()).toEqual([
      'include/GL/glut.h',
      'sysroot/include/c++/v1/GL/keep.h',
      'sysroot/include/c++/v1/vector',
      'sysroot/include/stdio.h',
    ]);
    expect(pack['include/GL/glut.h']).toBe('// the bundled glut, ü');
    expect(SKIPPED).toEqual(expect.arrayContaining(['GL', 'SDL', 'emscripten', 'emscripten.h', 'webgpu']));
  });

  it("lists the names a side module can find: the main module's exports and the library's functions", () => {
    const js = 'var a=1;var wasmImports={glBegin:_glBegin,exit:_exit,vams_sleep:(ms)=>{const o={inner:1};return o},Sleep:_Sleep};var b={notThis:1};';
    expect(libraryNames(js)).toEqual(['glBegin', 'exit', 'vams_sleep', 'Sleep']);
    // (module (func (export "main")) (global (export "__stack_pointer") i32 (i32.const 0)))
    const wasm = new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 6, 6, 1, 127, 0, 65, 0, 11,
      7, 26, 2, 4, 109, 97, 105, 110, 0, 0, 15, 95, 95, 115, 116, 97, 99, 107, 95, 112, 111, 105, 110, 116, 101, 114, 3, 0,
      10, 4, 1, 2, 0, 11,
    ]);
    expect(symbolNames(js, wasm)).toEqual(['Sleep', '__stack_pointer', 'exit', 'glBegin', 'main', 'vams_sleep']);
    expect(() => libraryNames('var x={};')).toThrow(/no wasmImports/);
  });

  it('puts the names in the pack as symbols.txt, one a line, when they are given', () => {
    dir = mkdtempSync(join(tmpdir(), 'vams-pack-'));
    put(join(dir, 'sys/stdio.h'), '');
    put(join(dir, 'lab/GL/gl.h'), '');
    expect(SYMBOLS).toBe('symbols.txt');
    expect(packHeaders(join(dir, 'sys'), join(dir, 'lab'), ['exit', 'main'])[SYMBOLS]).toBe('exit\nmain\n');
    expect(packHeaders(join(dir, 'sys'), join(dir, 'lab'))[SYMBOLS]).toBeUndefined();
  });

  it('refuses a file that is not UTF-8 text', () => {
    dir = mkdtempSync(join(tmpdir(), 'vams-pack-'));
    put(join(dir, 'sys/bad.h'), new Uint8Array([0xff, 0xfe, 0x00]));
    mkdirSync(join(dir, 'lab'));
    expect(() => packHeaders(join(dir, 'sys'), join(dir, 'lab'))).toThrow(/not UTF-8/);
  });
});
