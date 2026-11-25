/**
 * WHITE-BOX TEST SUITE — WB-LAB (the browser's compile)
 * src/features/lab-compile/model: how clang's messages reach the student, the flags the
 * browser's compiler builds with, the section strip, and one compile's steps.
 *
 * Test focus:
 *  - A rejected or undeclared GL name gives the VAMS message on its line
 *  - Notes and errors inside headers never show a path in the compiler's file tree
 *  - The flags match lab/runtime/build.sh word for word
 *  - The strip removes .debug*, producers and name, and nothing else
 *  - A compile checks the source, runs clang++ then wasm-ld, and caps the compiler's messages
 *  - A name used and never defined, or a missing main, stops the link in plain words
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { linkDiagnostics, rewriteDiagnostics, scrubPaths, type Diagnostic } from '@/features/lab-compile/model/diagnostics';
import { LAB_INCLUDE, LAB_SYSROOT, SIDE_CC_FLAGS, SIDE_LD_FLAGS, STRIP_SECTIONS } from '@/features/lab-compile/model/flags';
import { exportNames, stripSections } from '@/features/lab-compile/model/strip';
import {
  compileWith,
  COMPILE_STOPPED,
  LINK_STOPPED,
  MESSAGES_CAPPED,
  NO_MAIN,
  OUT_CAP_BYTES,
  SOURCE_TOO_LARGE,
  type CompileTools,
  type FileTree,
} from '@/features/lab-compile/model/compile';
import { shellVariables } from '../helpers/shell-vars';

const SPEC_MESSAGE = "main.cpp:12:5: gluPerspective isn't part of VAMS Lab's OpenGL. Use glOrtho or gluOrtho2D.";
const shown = (d: Diagnostic) => `${d.file}:${d.line}:${d.col}: ${d.message}`;

describe('WB-LAB-01: A rejected or undeclared GL name gives the VAMS message on its line', () => {
  it("maps clang's unavailable error to the spec's exact message", () => {
    const out = rewriteDiagnostics(
      "main.cpp:12:5: error: 'gluPerspective' is unavailable: gluPerspective isn't part of VAMS Lab's OpenGL. Use glOrtho or gluOrtho2D.\n" +
        "/lab/include/vams_rejected.h:20:13: note: 'gluPerspective' has been explicitly marked unavailable here\n" +
        '1 error generated.\n',
    );
    expect(out).toEqual([
      {
        file: 'main.cpp',
        line: 12,
        col: 5,
        severity: 'error',
        message: "gluPerspective isn't part of VAMS Lab's OpenGL. Use glOrtho or gluOrtho2D.",
      },
    ]);
    expect(shown(out[0])).toBe(SPEC_MESSAGE);
  });

  it.each([
    ['glLightfv', "use of undeclared identifier 'glLightfv'", ' Use glColor3f or glColor4f.'],
    ['GL_DEPTH_TEST', "use of undeclared identifier 'GL_DEPTH_TEST'", ' Leave it out: each shape is drawn over the ones drawn before it.'],
    ['GL_LIGHTING', "use of undeclared identifier 'GL_LIGHTING'", ' Use glColor3f or glColor4f.'],
    ['gluSphere', "use of undeclared identifier 'gluSphere'", ' Draw the shape with glBegin(GL_TRIANGLE_FAN), using cosf and sinf for its points.'],
    ['glutStrokeCharacter', "use of undeclared identifier 'glutStrokeCharacter'", ' Use glutBitmapString or glutBitmapCharacter with a bitmap font, such as GLUT_BITMAP_9_BY_15.'],
    ['GLUT_STROKE_ROMAN', "use of undeclared identifier 'GLUT_STROKE_ROMAN'", ' Use glutBitmapString or glutBitmapCharacter with a bitmap font, such as GLUT_BITMAP_9_BY_15.'],
    ['glewIsSupported', "use of undeclared identifier 'glewIsSupported'", ''],
    ['GLU_FILL', "use of undeclared identifier 'GLU_FILL'", ' Draw the shape with glBegin(GL_TRIANGLE_FAN), using cosf and sinf for its points.'],
    ['GLUquadric', "unknown type name 'GLUquadric'", ' Draw the shape with glBegin(GL_TRIANGLE_FAN), using cosf and sinf for its points.'],
    ['glVertex2iv', "use of undeclared identifier 'glVertex2iv'; did you mean 'glVertex2fv'?", ' Use glVertex2i(v[0], v[1]).'],
    ['glGenBuffersARB', "use of undeclared identifier 'glGenBuffersARB'; did you mean 'glGenBuffers'?", ' Use glGenBuffers.'],
  ])('turns an undeclared %s into the VAMS message, with what to use', (name, clang, advice) => {
    const [d] = rewriteDiagnostics(`main.cpp:5:14: error: ${clang}\n`);
    expect(d).toEqual({ file: 'main.cpp', line: 5, col: 14, severity: 'error', message: `${name} isn't part of VAMS Lab's OpenGL.${advice}` });
  });

  it("keeps clang's suggestion for a mistyped GL name, and says what to use for a Windows call", () => {
    const [typo] = rewriteDiagnostics("main.cpp:4:3: error: use of undeclared identifier 'glVertex2ff'; did you mean 'glVertex2f'?\n");
    expect(typo.message).toBe("use of undeclared identifier 'glVertex2ff'; did you mean 'glVertex2f'?");
    const [box] = rewriteDiagnostics("main.cpp:3:3: error: use of undeclared identifier 'MessageBox'\n");
    expect(box.message).toBe("MessageBox isn't part of VAMS Lab's windows.h. Print the message with printf: it shows in the Console.");
    const [mine] = rewriteDiagnostics("main.cpp:3:3: error: use of undeclared identifier 'DrawHouse'\n");
    expect(mine.message).toBe("use of undeclared identifier 'DrawHouse'");
    const [shift] = rewriteDiagnostics("main.cpp:4:10: error: use of undeclared identifier 'GLUT_KEY_SHIFT_L'\n");
    expect(shift.message).toBe('GLUT_KEY_SHIFT_L is in <GL/freeglut.h>, which <GL/glut.h> leaves out. Write #include <GL/freeglut.h>.');
  });

  it('keeps only the VAMS message when clang reads on with its guess at an undeclared GL name', () => {
    const out = rewriteDiagnostics(
      "main.cpp:5:3: error: use of undeclared identifier 'glVertex2iv'; did you mean 'glVertex2fv'?\n" +
        "main.cpp:5:15: error: cannot initialize a parameter of type 'const GLfloat *' (aka 'const float *') with an lvalue of type 'int[2]'\n",
    );
    expect(out.map((d) => d.message)).toEqual(["glVertex2iv isn't part of VAMS Lab's OpenGL. Use glVertex2i(v[0], v[1])."]);
  });

  it('leaves other diagnostics as clang wrote them', () => {
    const stderr = [
      "main.cpp:3:5: error: use of undeclared identifier 'score'",
      "main.cpp:4:9: error: use of undeclared identifier 'global'",
      "main.cpp:7:17: error: expected ';' after expression",
      "main.cpp:9:9: warning: unused variable 'x' [-Wunused-variable]",
      "main.cpp:11:3: error: unknown type name 'Sprite'",
      '2 warnings and 3 errors generated.',
    ].join('\n');
    expect(rewriteDiagnostics(stderr).map((d) => `${d.line}:${d.col}: ${d.severity}: ${d.message}`)).toEqual([
      "3:5: error: use of undeclared identifier 'score'",
      "4:9: error: use of undeclared identifier 'global'",
      "7:17: error: expected ';' after expression",
      "9:9: warning: unused variable 'x' [-Wunused-variable]",
      "11:3: error: unknown type name 'Sprite'",
    ]);
  });

  it('keeps only the VAMS message when a rejected function is taken as a value', () => {
    // Clang's output for `void (*f)(double) = glutSolidCube;` on line 11.
    const stderr = [
      "main.cpp:11:12: error: cannot initialize a variable of type 'void (*)(double)' with an lvalue of type 'void (...)': different number of parameters (1 vs 0)",
      "main.cpp:11:25: error: 'glutSolidCube' is unavailable: glutSolidCube isn't part of VAMS Lab's OpenGL. Use glRectf or glBegin(GL_QUADS).",
      "/lab/include/vams_rejected.h:46:13: note: 'glutSolidCube' has been explicitly marked unavailable here",
      "main.cpp:12:5: error: use of undeclared identifier 'score'",
    ].join('\n');
    expect(rewriteDiagnostics(stderr).map(shown)).toEqual([
      "main.cpp:11:25: glutSolidCube isn't part of VAMS Lab's OpenGL. Use glRectf or glBegin(GL_QUADS).",
      "main.cpp:12:5: use of undeclared identifier 'score'",
    ]);
  });
});

describe('WB-LAB-02: Notes inside the bundled headers are dropped, and no message names a server path', () => {
  // Clang's output for std::sort(v.begin(), v.end(), 5) on line 12, shortened.
  const sortError = [
    'In file included from main.cpp:2:',
    'In file included from /lab/sysroot/include/c++/v1/vector:352:',
    'In file included from /lab/sysroot/include/c++/v1/algorithm:1868:',
    '/lab/sysroot/include/c++/v1/__algorithm/sift_down.h:47:32: error: called object type \'int\' is not a function or function pointer',
    "/lab/sysroot/include/c++/v1/__algorithm/make_heap.h:39:12: note: in instantiation of function template specialization 'std::__sift_down<std::_ClassicAlgPolicy, int &, int *>' requested here",
    "main.cpp:12:30: note: in instantiation of function template specialization 'std::sort<std::__wrap_iter<int *>, int>' requested here",
    "/lab/sysroot/include/c++/v1/__algorithm/sift_down.h:54:7: error: called object type 'int' is not a function or function pointer",
    "/lab/sysroot/include/c++/v1/__algorithm/sort.h:101:1: note: candidate template ignored: requirement '__use_branchless_sort<int &, int *>' was not satisfied",
    'fatal error: too many errors emitted, stopping now [-ferror-limit=]',
    '20 errors generated.',
  ].join('\n');

  it('drops notes that point into /lab/include', () => {
    const out = rewriteDiagnostics(
      "main.cpp:6:5: error: 'gluLookAt' is unavailable: gluLookAt isn't part of VAMS Lab's OpenGL. Use glTranslatef and glRotatef.\n" +
        "/lab/include/vams_rejected.h:22:13: note: 'gluLookAt' has been explicitly marked unavailable here\n" +
        "/lab/include/GL/glu.h:30:6: note: candidate function not viable\n",
    );
    expect(out.map((d) => d.severity)).toEqual(['error']);
  });

  it("places an error inside a header on the main.cpp line that led there, without the header's path", () => {
    const out = rewriteDiagnostics(sortError);
    expect(out.map((d) => `${d.line}:${d.col}: ${d.severity}: ${d.message}`)).toEqual([
      "12:30: error: called object type 'int' is not a function or function pointer",
      "12:30: note: in instantiation of function template specialization 'std::sort<std::__wrap_iter<int *>, int>' requested here",
      '12:30: error: too many errors emitted, stopping now [-ferror-limit=]',
    ]);
  });

  it('places an error in an included header on its #include line', () => {
    const out = rewriteDiagnostics(
      'In file included from main.cpp:3:\nIn file included from /lab/include/GL/freeglut.h:17:\n' +
        "/lab/include/GL/gl.h:120:1: error: expected unqualified-id\n",
    );
    expect(out).toEqual([{ file: 'main.cpp', line: 3, col: 1, severity: 'error', message: 'expected unqualified-id' }]);
  });

  it("drops clang's header list, its summary line and a crash's stack dump", () => {
    const out = rewriteDiagnostics(
      [
        '. /lab/include/GL/freeglut.h',
        '.. /lab/include/GL/freeglut_std.h',
        "main.cpp:4:1: error: unknown type name 'foo'",
        'PLEASE submit a bug report to https://github.com/llvm/llvm-project/issues/ and include the crash backtrace.',
        'Stack dump:',
        '0.\tProgram arguments: /opt/llvm/bin/clang++ -cc1 -isystem /lab/include main.cpp',
        ' #0 0x000055d0 llvm::sys::PrintStackTrace (/opt/llvm/bin/clang+0x1234)',
        'clang++: error: clang frontend command failed with exit code 139 (use -v to see invocation)',
        'InstalledDir: /opt/llvm/bin',
        '1 error generated.',
      ].join('\n'),
    );
    expect(out.map((d) => d.message)).toEqual([
      "unknown type name 'foo'",
      'clang frontend command failed with exit code 139 (use -v to see invocation)',
    ]);
  });

  it('never names a server path in any message', () => {
    const stderr = [
      sortError,
      "main.cpp:2:10: fatal error: '/lab/include/GL/missing.h' file not found",
      'wasm-ld: error: /tmp/vams-a1b2c3/main.o: section too large',
      "main.cpp:9:3: warning: '/opt/llvm/lib/clang/21/include/stddef.h' is odd",
    ].join('\n');
    const out = rewriteDiagnostics(stderr);
    expect(out.length).toBeGreaterThan(3);
    for (const d of out) {
      expect(d.file).toBe('main.cpp');
      expect(d.message).not.toMatch(/\/(lab|tmp|opt|etc|proc|usr|home)\b/);
    }
    expect(out.map((d) => d.message)).toContain("'GL/missing.h' file not found");
    expect(out.map((d) => d.message)).toContain('main.o: section too large');
  });

  it('scrubs paths but leaves the rest of a message alone', () => {
    expect(scrubPaths("invalid operands to binary expression ('int' and 'std::string')")).toBe(
      "invalid operands to binary expression ('int' and 'std::string')",
    );
    expect(scrubPaths('cannot open /etc/passwd for reading')).toBe('cannot open passwd for reading');
    expect(scrubPaths("in '/lab/sysroot/include/c++/v1/vector'")).toBe("in 'vector'");
  });
});

describe('WB-LAB-13: The browser compiles with the flags lab/runtime/build.sh holds', () => {
  const vars = shellVariables(readFileSync(join(process.cwd(), 'lab/runtime/build.sh'), 'utf8'));
  const words = (name: string) => (vars.get(name) ?? '').split(/\s+/).filter(Boolean);

  it('reads the paths the headers pack mounts at', () => {
    expect(vars.get('LAB_INCLUDE')).toBe(LAB_INCLUDE);
    expect(vars.get('LAB_SYSROOT')).toBe(LAB_SYSROOT);
  });

  it('matches SIDE_CC_FLAGS, SIDE_LD_FLAGS and SIDE_STRIP_FLAGS word for word', () => {
    expect(words('SIDE_CC_FLAGS').length).toBeGreaterThan(20);
    expect([...SIDE_CC_FLAGS]).toEqual(words('SIDE_CC_FLAGS'));
    expect([...SIDE_LD_FLAGS]).toEqual(words('SIDE_LD_FLAGS'));
    expect(STRIP_SECTIONS.map((s) => `--remove-section=${s}`)).toEqual(words('SIDE_STRIP_FLAGS'));
  });
});

/** A module from sections, each [id, bytes]; a custom section's bytes start with its name. */
function module(...sections: [number, Uint8Array][]): Uint8Array {
  const parts: number[] = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
  for (const [id, bytes] of sections) {
    parts.push(id);
    let n = bytes.length;
    do {
      let b = n & 0x7f;
      n >>>= 7;
      if (n) b |= 0x80;
      parts.push(b);
    } while (n);
    parts.push(...bytes);
  }
  return new Uint8Array(parts);
}
const custom = (name: string, payload: number[] = [1, 2, 3]): [number, Uint8Array] => {
  const n = new TextEncoder().encode(name);
  return [0, new Uint8Array([n.length, ...n, ...payload])];
};
const types: [number, Uint8Array] = [1, new Uint8Array([1, 0x60, 0, 0])];

describe('WB-LAB-23: The strip removes the sections llvm-objcopy removed, and keeps the rest in place', () => {
  it('drops .debug*, producers and name, and keeps dylink.0, a type section and other custom sections', () => {
    const big = new Array(200).fill(7);
    const wasm = module(custom('dylink.0'), types, custom('.debug_info', big), custom('.debug_line'), custom('producers'), custom('name'), custom('target_features'));
    expect(stripSections(wasm)).toEqual(module(custom('dylink.0'), types, custom('target_features')));
  });

  it('gives a module without those sections back unchanged', () => {
    const wasm = module(custom('dylink.0'), types);
    expect(stripSections(wasm)).toEqual(wasm);
  });

  it('refuses what is not a module, and a section that runs past the end', () => {
    expect(() => stripSections(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow();
    expect(() => stripSections(module(custom('name')).slice(0, -2))).toThrow();
  });
});

/** An export section naming main, as a program's module has. */
const EXPORTS_MAIN: [number, Uint8Array] = [7, new Uint8Array([1, 4, 0x6d, 0x61, 0x69, 0x6e, 0, 0])];
const WASM = module(custom('dylink.0'), EXPORTS_MAIN, custom('name'));
const tool = (out: FileTree | Error, stderr = '') =>
  vi.fn<CompileTools['clang']>(async (_args, _files, say) => {
    if (stderr) say(stderr);
    if (out instanceof Error) throw out;
    return out;
  });
const headers: FileTree = { include: { GL: { 'glut.h': '' } } };

describe('WB-LAB-24: One compile checks the source, runs clang++ then wasm-ld, and strips the module', () => {
  it('compiles, links, strips and passes warnings on', async () => {
    const clang = tool({ 'main.o': new Uint8Array([9]) }, "main.cpp:2:18: warning: unused variable 'x' [-Wunused-variable]\n");
    const ld = tool({ 'main.wasm': WASM });
    const result = await compileWith({ clang, ld }, '#include <Windows.h>\nint main() { int x; }', headers);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(new Uint8Array(result.module)).toEqual(module(custom('dylink.0'), EXPORTS_MAIN));
    expect(result.diagnostics).toMatchObject([{ line: 2, col: 18, severity: 'warning' }]);
    const [args, files] = clang.mock.calls[0];
    expect(args.slice(0, 2)).toEqual(['clang++', '--target=wasm32-unknown-emscripten']);
    expect(args.slice(-4)).toEqual(['-c', 'main.cpp', '-o', 'main.o']);
    expect(args).toContain('-fno-caret-diagnostics');
    expect(args).not.toContain('-H');
    // The include check's rewrite is what clang reads.
    expect(files['main.cpp']).toBe('#include <windows.h>\nint main() { int x; }');
    expect(files.lab).toBe(headers);
    expect(ld.mock.calls[0][0][0]).toBe('wasm-ld');
    expect(ld.mock.calls[0][1]).toEqual({ 'main.o': new Uint8Array([9]) });
  });

  it("gives clang's errors on their lines, and never links", async () => {
    const ld = tool({ 'main.wasm': WASM });
    const clang = tool(new Error('exit 1'), "main.cpp:1:20: error: use of undeclared identifier 'x'\n");
    const result = await compileWith({ clang, ld }, 'int main() { return x; }', headers);
    expect(result).toEqual({ kind: 'errors', diagnostics: [expect.objectContaining({ line: 1, col: 20, severity: 'error' })] });
    expect(ld).not.toHaveBeenCalled();
  });

  it('says the compiler stopped when it fails with no error, and the link stopped when wasm-ld does', async () => {
    const stopped = await compileWith({ clang: tool(new Error('crash')), ld: tool({}) }, 'int main() {}', headers);
    expect(stopped).toEqual({ kind: 'errors', diagnostics: [expect.objectContaining({ message: COMPILE_STOPPED })] });
    const unlinked = await compileWith({ clang: tool({ 'main.o': new Uint8Array([1]) }), ld: tool(new Error('exit 1')) }, 'int main() {}', headers);
    expect(unlinked).toEqual({ kind: 'errors', diagnostics: [expect.objectContaining({ message: LINK_STOPPED })] });
  });

  it("caps the compiler's messages at 256 KB and says so", async () => {
    const line = 'main.cpp:1:1: error: too many errors here\n';
    const flood = line.repeat(Math.ceil((OUT_CAP_BYTES * 2) / line.length));
    const result = await compileWith({ clang: tool(new Error('exit 1'), flood), ld: tool({}) }, 'int main() {}', headers);
    expect(result.kind).toBe('errors');
    const d = result.diagnostics;
    expect(d.at(-1)?.message).toBe(MESSAGES_CAPPED);
    expect(d.length - 1).toBeLessThanOrEqual(Math.floor(OUT_CAP_BYTES / line.length));
  });

  it('refuses a source over 200 KB, and a refused include, before any tool runs', async () => {
    const clang = tool({});
    const big = await compileWith({ clang, ld: tool({}) }, `int main() {}\n//${'x'.repeat(200 * 1024)}`, headers);
    expect(big).toEqual({ kind: 'errors', diagnostics: [expect.objectContaining({ line: 1, col: 1, message: SOURCE_TOO_LARGE })] });
    const refused = await compileWith({ clang, ld: tool({}) }, '#include "/etc/passwd"', headers);
    expect(refused.kind).toBe('errors');
    expect(clang).not.toHaveBeenCalled();
  });
});

describe('WB-LAB-26: A name used and never defined stops the link, in plain words, on the line that uses it', () => {
  const SOURCE = [
    '#include <GL/glut.h>', // 1
    'void helper();', // 2
    'extern int counter;', // 3
    'struct A { void f(); virtual void g(); };', // 4
    'struct Shape { virtual void draw(); };', // 5
    'int main() {', // 6
    '  helper();', // 7
    '  A a;', // 8
    '  a.f();', // 9
    '  return counter;', // 10
    '}', // 11
  ].join('\n');

  it.each([
    ['helper()', 7, 3, 'helper() is declared but never defined. Write its body, or check that its name and parameters match the function you wrote.'],
    ['A::f()', 9, 5, 'A::f() is declared but never defined. Write its body, or check that its name and parameters match the function you wrote.'],
    ['counter', 10, 10, 'counter is declared but never defined. Define it once, outside any class and without extern.'],
    ['vtable for Shape', 5, 1, "Shape declares a virtual function it never defines. Write the body of each of Shape's virtual functions."],
  ])('says %s is never defined', (name, line, col, message) => {
    const out = linkDiagnostics(`wasm-ld: error: main.o: undefined symbol: ${name}\n`, SOURCE);
    expect(out).toEqual([{ file: 'main.cpp', line, col, severity: 'error', message }]);
  });

  it('gives wasm-ld the names the main module offers, from the pack', async () => {
    const ld = tool({ 'main.wasm': WASM });
    const clang = tool({ 'main.o': new Uint8Array([9]) });
    const result = await compileWith({ clang, ld }, 'int main() {}', { ...headers, 'symbols.txt': 'main\nputs\n' });
    expect(result.kind).toBe('ok');
    const [args, files] = ld.mock.calls[0];
    expect(args).toContain('--unresolved-symbols=report-all');
    expect(args).toContain('--allow-undefined-file=/lab/symbols.txt');
    expect(files).toEqual({ 'main.o': new Uint8Array([9]), lab: { 'symbols.txt': 'main\nputs\n' } });
  });

  it("puts an undefined symbol on its use when wasm-ld fails", async () => {
    const ld = tool(new Error('exit 1'), 'wasm-ld: error: main.o: undefined symbol: helper()\n');
    const clang = tool({ 'main.o': new Uint8Array([9]) });
    const result = await compileWith({ clang, ld }, SOURCE, headers);
    expect(result).toEqual({ kind: 'errors', diagnostics: [expect.objectContaining({ line: 7, col: 3, message: expect.stringMatching(/^helper\(\) is declared but never defined/) })] });
  });
});

describe('WB-LAB-27: A program without main stops at the link, as on a lab PC', () => {
  it('says to add main when the module exports none', async () => {
    const ld = tool({ 'main.wasm': module(custom('dylink.0')) });
    const result = await compileWith({ clang: tool({ 'main.o': new Uint8Array([9]) }), ld }, 'void f() {}', headers);
    expect(result).toEqual({ kind: 'errors', diagnostics: [expect.objectContaining({ line: 1, col: 1, message: NO_MAIN })] });
    expect(NO_MAIN).toBe('The program has no main function. Add int main(), where the program starts.');
  });

  it('reads the export names of a module', () => {
    expect(exportNames(WASM)).toEqual(['main']);
    expect(exportNames(module(custom('dylink.0')))).toEqual([]);
  });
});
