/**
 * SECURITY TEST SUITE — SEC-LAB (what a student's file can reach on the compile server)
 * A Lab program may include the bundled headers and the standard headers by name, and
 * nothing else. checkIncludes in lab/service/src/includes.ts refuses everything else
 * before clang runs.
 *
 * Test focus:
 *  - Paths, quoted headers other than "stb_image.h" and unlisted angle headers are refused
 *  - Includes built from macros, #include_next, #embed, #import, __has_include, __has_embed
 *    and every #pragma but once are refused, however they are spelt
 *  - Against the built image (LAB_DOCKER=1): file probes are refused, a long compile is
 *    stopped, a flood of messages is capped, and no response holds a byte of a server file
 *  - Inline assembly, whose .incbin and .include read files, is refused however it is spelt
 *    or built: the keywords and ## in the file before clang runs, and a header macro's
 *    pasting in clang's preprocessed output, before the compile
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { request } from 'node:http';
import { BUNDLED_HEADERS, checkExpanded, checkIncludes, STANDARD_HEADERS } from '../../lab/service/src/includes.ts';
import { labRequest } from '../helpers/lab-http';

const refused = (source: string) => {
  const r = checkIncludes(source);
  if (r.ok) throw new Error(`accepted: ${JSON.stringify(source)}`);
  return r;
};
const at = (source: string) => {
  const r = refused(source);
  return [r.line, r.col];
};
const LANGUAGE_DISCIPLINE = /coming soon|not yet|future|deferred|unsupported|not supported|\b3D\b|lighting/i;

describe('SEC-LAB-01: Only the bundled and standard headers can be included, by name', () => {
  it('lists exactly the headers in lab/include, apart from vams_rejected.h', () => {
    const root = join(process.cwd(), 'lab/include');
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
    const files = walk(root).map((f) => relative(root, f).replace(/\\/g, '/')).filter((f) => f !== 'vams_rejected.h');
    expect([...BUNDLED_HEADERS].sort()).toEqual(files.sort());
  });

  it.each([
    ['#include "/etc/passwd"'],
    ['#include </etc/passwd>'],
    ['#include "/proc/self/environ"'],
    ['#include "../../proc/self/environ"'],
    ['#include <GL/../../etc/passwd>'],
    ['#include "GL/../stb_image.h"'],
    ['#include "C:\\\\Users\\\\x\\\\Desktop\\\\header.h"'],
    ['#include <GL\\glut.h>'],
    ['#include "C:/Users/x/header.h"'],
    ['#include <c:stdio.h>'],
    ['#include "~/header.h"'],
  ])('refuses the path in %s', (line) => {
    const r = refused(`int a;\n${line}\n`);
    expect([r.line, r.col]).toEqual([2, 10]);
    expect(r.message).toBe('VAMS Lab includes headers by name, not by path.');
  });

  it.each([
    ['#include "myheader.h"', '"myheader.h" isn\'t one of VAMS Lab\'s headers.'],
    ['#include "main.cpp"', '"main.cpp" isn\'t one of VAMS Lab\'s headers.'],
    ['#include "GL/glutt.h"', '"GL/glutt.h" isn\'t one of VAMS Lab\'s headers.'],
    ['#include "iostream"', 'Write #include <iostream> in VAMS Lab.'],
  ])('refuses the quoted include %s', (line, message) => {
    const r = refused(line);
    expect(r).toEqual({ ok: false, line: 1, col: 10, message });
  });

  it('accepts a quoted bundled header and writes it in <>, as a lab PC finds it either way', () => {
    const source = [
      '#include "GL/glew.h"',
      '#include "GL/glut.h"',
      '  #include "GL/gl.h" // core',
      '#include "GL/freeglut.h"',
      '#include "Windows.h"',
      '#include "conio.h"',
      '#include "stb_image.h"',
      'int x;',
    ].join('\n');
    const r = checkIncludes(source);
    expect(r).toEqual({
      ok: true,
      source: [
        '#include <GL/glew.h>',
        '#include <GL/glut.h>',
        '  #include <GL/gl.h> // core',
        '#include <GL/freeglut.h>',
        '#include <windows.h>',
        '#include <conio.h>',
        '#include "stb_image.h"',
        'int x;',
      ].join('\n'),
    });
  });

  it.each([
    ['#include <unistd.h>', '<unistd.h>'],
    ['#include <bits/stdc++.h>', '<bits/stdc++.h>'],
    ['#include <vams_rejected.h>', '<vams_rejected.h>'],
    ['#include <GL/gl.h >', '<GL/gl.h >'],
    ['#include <passwd>', '<passwd>'],
  ])('refuses the unlisted angle include %s', (line, shownName) => {
    const r = refused(`\n\n   ${line}`);
    expect(r).toEqual({ ok: false, line: 3, col: 13, message: `${shownName} isn't one of VAMS Lab's headers.` });
  });

  it('gives the column in bytes, as clang does', () => {
    expect(at('/* ñ */ #include "/etc/passwd"')).toEqual([1, 19]);
  });

  it('accepts every bundled and standard header, and "stb_image.h" in quotes', () => {
    const all = [...BUNDLED_HEADERS, ...STANDARD_HEADERS].map((h) => `#include <${h}>`).join('\n');
    expect(checkIncludes(`${all}\n#include "stb_image.h"\n`)).toEqual({ ok: true, source: `${all}\n#include "stb_image.h"\n` });
  });

  it('spells a header as lab/include does, so <Windows.h> finds windows.h as on Windows', () => {
    const r = checkIncludes('#include <Windows.h>\n#include <gl/GLUT.h>\n#include "STB_image.h"\nint x;\n');
    expect(r).toEqual({ ok: true, source: '#include <windows.h>\n#include <GL/glut.h>\n#include "stb_image.h"\nint x;\n' });
  });

  it('accepts the program VAMS generates, and the course template', () => {
    const generated = readFileSync(join(process.cwd(), 'tests/fixtures/no-callbacks-program.cpp'), 'utf8');
    expect(checkIncludes(generated).ok).toBe(true);
    const template = [
      '#include <GL/glew.h>',
      '#include <GL/freeglut.h>',
      '#include <iostream>',
      '',
      'void init() { glClearColor(1, 1, 1, 1); }',
      'void display() {',
      '    glClear(GL_COLOR_BUFFER_BIT);',
      "    char c = 'x'; int n = 1'000'000; double d = 1e+3; const char *s = \"#include </etc/passwd>\";",
      '    glFlush();',
      '}',
      'int main(int argc, char **argv) {',
      '    glutInit(&argc, argv);',
      '    glutInitWindowSize(500, 500);',
      '    glutCreateWindow("Triangle");',
      '    glewInit(); init(); glutDisplayFunc(display); glutMainLoop();',
      '}',
    ].join('\r\n');
    expect(checkIncludes(template).ok).toBe(true);
  });

  it('ignores includes inside comments, strings and raw strings', () => {
    const source = [
      '// #include "/etc/passwd"',
      '/* #include "/etc/passwd"',
      '   #embed "/etc/passwd" */',
      'const char *a = "#include </etc/passwd>";',
      'const char *b = R"x(',
      '#include "/etc/passwd"',
      ')x";',
      "char c = '#';",
      '#if 0',
      "  don't mind this line",
      '#endif',
      '#pragma once',
      '',
    ].join('\n');
    expect(checkIncludes(source).ok).toBe(true);
  });

  it('writes every refusal without the banned wording', () => {
    const messages = [
      '#include "/etc/passwd"', '#include "x.h"', '#include "iostream"', '#include <x.h>', '#include X',
      '#include_next <x.h>', '#embed "x"', '#pragma GCC poison x', '#if __has_include(<x.h>)\n#endif', '#line 1', '#pragma comment',
      '# 1 "x"', 'int \\u0061;', '\0', '#include <x.h',
    ].map((s) => refused(s).message);
    for (const m of messages) expect(m).not.toMatch(LANGUAGE_DISCIPLINE);
  });
});

describe('SEC-LAB-02: Includes built from macros, file probes and pragmas are refused, however they are spelt', () => {
  it.each([
    ['#include MACRO', [1, 10]],
    ['#define H "/etc/passwd"\n#include H', [2, 10]],
    ['#include __FILE__', [1, 10]],
    ['#include', [1, 9]],
  ])('refuses an include built from a macro: %j', (source, pos) => {
    const r = refused(source);
    expect([r.line, r.col]).toEqual(pos);
    expect(r.message).toBe('Write the header\'s name in <> or "" after #include.');
  });

  it.each([
    ['#include_next <stdio.h>', 'include_next'],
    ['#embed "/etc/passwd"', 'embed'],
    ['#import <stdio.h>', 'import'],
    ['#__include_macros "/etc/passwd"', '__include_macros'],
    ['#line 1 "/etc/passwd"', 'line'],
    ['#ident "x"', 'ident'],
  ])('refuses %s', (line, name) => {
    expect(refused(`int a;\n  ${line}\n`)).toEqual({ ok: false, line: 2, col: 3, message: `#${name} isn't available in VAMS Lab.` });
  });

  it('refuses a line marker', () => {
    expect(refused('# 1 "/etc/passwd"')).toEqual({ ok: false, line: 1, col: 1, message: "This directive isn't available in VAMS Lab." });
  });

  it.each([
    ['#if __has_include(</etc/passwd>)\n#endif', '__has_include', [1, 5]],
    ['#if defined(X) || __has_include_next(<stdio.h>)\n#endif', '__has_include_next', [1, 19]],
    ['#if __has_embed("/etc/passwd")\n#endif', '__has_embed', [1, 5]],
    ['#define P(x) _Pragma(#x)\nP(GCC dependency "/etc/passwd")', '_Pragma', [1, 14]],
    ['__pragma(once)', '__pragma', [1, 1]],
  ])('refuses %j', (source, name, pos) => {
    const r = refused(source);
    expect([r.line, r.col]).toEqual(pos);
    expect(r.message).toBe(`${name} isn't available in VAMS Lab.`);
  });

  it.each([
    ['#pragma GCC dependency "/etc/passwd"'],
    ['#pragma clang system_header'],
    ['#pragma once extra'],
    ['#pragma'],
    ['  #  pragma   message("hi")'],
    ['#pragma comment'],
    ['#pragma warning disable'],
    ['#pragma comments(lib, "x.lib")'],
  ])('refuses %s, which is not #pragma once, comment(...) or warning(...)', (line) => {
    const r = refused(`\n${line}\n`);
    expect(r.line).toBe(2);
    expect(r.message).toBe('Only #pragma once is available in VAMS Lab.');
  });

  it('allows #pragma once, with spaces and a comment', () => {
    expect(checkIncludes('#pragma once\n  #  pragma  once // header guard\n#pragma /* c */ once\n').ok).toBe(true);
  });

  it.each([
    ['', '#pragma comment(lib, "opengl32.lib")', '\nint x;'],
    ['', '#pragma warning(disable: 4996)', '\nint x;'],
    ['  ', '#  pragma  warning ( push )', ''],
    ['', '%:pragma comment(lib, "glu32.lib")', '\n'],
    ['/* Windows */ ', '#pragma comment(lib, "glew32.lib")', '\nint x;'],
    ['int a;\n', '#pragma comment(lib, \\\n  "freeglut.lib")', '\nint x;'],
    ['', '#pragma comment(lib, \\  \r\n  "freeglut.lib")', '\r\nint x;'],
    ['', '#pragma comment(lib, /* a\n b */ "x.lib") // done', '\nint x;'],
  ])('blanks the MSVC directive in %j%j, keeping its lines and columns', (before, directive, after) => {
    const blanked = directive.replace(/[^\r\n]/g, ' ');
    expect(checkIncludes(before + directive + after)).toEqual({ ok: true, source: before + blanked + after });
  });

  it('still checks the line after a blanked #pragma comment', () => {
    expect(at('#pragma comment(lib, "opengl32.lib")\n#include "/etc/passwd"')).toEqual([2, 10]);
    expect(at('#pragma warning(disable: 4996)\n__has_include(<x>)')).toEqual([2, 1]);
  });

  it.each([
    ['_Pragma("comment(lib, \\"x.lib\\")")', '_Pragma'],
    ['__pragma(warning(disable: 4996))', '__pragma'],
  ])('refuses the pragma operator in %s', (source, name) => {
    expect(refused(source).message).toBe(`${name} isn't available in VAMS Lab.`);
  });

  it.each([
    ['a directive name split by a line continuation', '#inc\\\nlude "/etc/passwd"', [2, 6]],
    ['a continuation with spaces after the backslash', '#incl\\  \nude "/etc/passwd"', [2, 5]],
    ['a continuation before the header name', '#include \\\n"/etc/passwd"', [2, 1]],
    ['a CRLF continuation', '#include\\\r\n "/etc/passwd"', [2, 2]],
    ['a continuation inside the header name', '#include "/etc/\\\npasswd"', [1, 10]],
    ['a continuation inside #embed', '#em\\\nbed "/etc/passwd"', [1, 1]],
    ['a continuation inside __has_include', '#if __has_\\\ninclude(</etc/passwd>)\n#endif', [1, 5]],
    ['a continuation inside #pragma', '#prag\\\nma GCC dependency "/etc/passwd"', [1, 1]],
    ['a line comment continued onto the next line, then a directive', '// note \\\nstill a comment\n#embed "/etc/passwd"', [3, 1]],
  ])('refuses %s', (_name, source, pos) => {
    expect(at(source)).toEqual(pos);
  });

  it.each([
    ['a block comment before the #', '/* note */ #include "/etc/passwd"', [1, 21]],
    ['a block comment between # and include', '#/* note */include "/etc/passwd"', [1, 20]],
    ['a block comment between include and the name', '#include/* note */"/etc/passwd"', [1, 19]],
    ['a block comment that ends on the directive line', '/* one\n   two */ #embed "/etc/passwd"', [2, 11]],
    ['a block comment spanning lines inside the directive', '#/*\n*/ embed "/etc/passwd"', [1, 1]],
    ['a line comment above', '// about to include\n#include "/etc/passwd"', [2, 10]],
    ['the %: digraph', '%:include "/etc/passwd"', [1, 11]],
    ['the %: digraph with #embed', '  %:embed "/etc/passwd"', [1, 3]],
    ['spaces and tabs around the #', ' \t # \t include "/etc/passwd"', [1, 16]],
    ['a form feed after the #', '#\finclude "/etc/passwd"', [1, 11]],
    ['a no-break space before the #', '\u00a0#include "/etc/passwd"', [1, 12]],
    ['a CR-only line ending before the directive', 'int x;\r#include "/etc/passwd"', [2, 10]],
    ['a directive after #error /*, which clang reads to the end of its line', '#error /*\n#include "/etc/passwd"\n*/', [2, 10]],
    ['a directive after #warning /*', '#warning /*\n#embed "/etc/passwd"\n*/', [2, 1]],
    ["a directive after digit separators and '/*", "int q = 1'2'/*\n#include \"/etc/passwd\"\n*/;", [2, 10]],
    ["a directive after a hex digit separator", "int q = 0x1'F'/*\n#embed \"/etc/passwd\"\n*/;", [2, 1]],
    ['a directive after an unterminated character literal', "char c = 'a; /*\n#include \"/etc/passwd\"\n*/", [2, 10]],
    ['a directive after an unterminated string', 'const char *s = "abc /*\n#include "/etc/passwd"\n*/";', [2, 10]],
    ['a directive after a raw string with an invalid delimiter', 'auto s = R"a b(x\n#include "/etc/passwd"\n)a b";', [2, 10]],
    ['a directive after a raw string with no end', 'auto s = R"(x\n#include "/etc/passwd"\n', [2, 10]],
    ['a directive after a raw string that ends', 'auto s = R"(x\n)";\n#include "/etc/passwd"', [3, 10]],
    ['a directive name written with \\u', '#incl\\u0075de "/etc/passwd"', [1, 6]],
    ['__has_include written with \\u', '#if __has_\\u0069nclude(</etc/passwd>)\n#endif', [1, 11]],
    ['a null character', 'int x;\0\n#include <stdio.h>', [1, 7]],
    ['a non-ASCII character outside strings and comments', 'int é1\'x /*\n#include "/etc/passwd"\n*/', [1, 5]],
  ])('refuses %s', (_name, source, pos) => {
    expect(at(source)).toEqual(pos);
  });

  it('reads #error and #warning text, comments included, without refusing it', () => {
    expect(checkIncludes('#error see "/etc/passwd" /* not a comment\n#warning __has_include in words\nint x;').ok).toBe(true);
  });
});

/*
 * Runs the compile service's image, built from lab/toolchain/Dockerfile, and sends it
 * what a student could send. Needs Docker: LAB_DOCKER=1 npx vitest run tests/security/lab-includes.test.ts
 */
const DOCKER = process.env.LAB_DOCKER === '1';
const IMAGE = 'vams-lab-compile';

describe.skipIf(!DOCKER)('SEC-LAB-03: Against the built image, probes are refused, long compiles stop and output is capped', () => {
  const secret = `lab-${randomBytes(12).toString('hex')}`;
  let container = '';
  let url = '';
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const bodies: string[] = [];

  const post = async (source: string) => {
    const res = await labRequest(url, {
      headers: { 'Content-Type': 'application/json', 'X-Lab-Secret': secret, 'X-Lab-Client-IP': '203.0.113.7' },
      body: JSON.stringify({ source, visitor: 'sec-lab-03' }),
    });
    const bytes = res.headers['content-encoding'] === 'gzip' ? gunzipSync(res.body) : res.body;
    const diagnostics = (res.headers['x-lab-diagnostics'] as string | undefined) ?? '';
    const json = String(res.headers['content-type']).startsWith('application/json') ? JSON.parse(res.text) : null;
    bodies.push(bytes.toString('latin1'), Buffer.from(diagnostics, 'base64url').toString('utf8'));
    return { status: res.status, bytes, text: res.text, headers: res.headers, json };
  };

  beforeAll(async () => {
    const version = readFileSync(join(process.cwd(), 'lab/toolchain/EMSDK_VERSION'), 'utf8').trim();
    docker('build', '-f', 'lab/toolchain/Dockerfile', '--build-arg', `EMSDK_VERSION=${version}`, '-t', IMAGE, '.');
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::8080', '-e', `LAB_SECRET=${secret}`, IMAGE);
    const port = docker('port', container, '8080').split('\n')[0].split(':').at(-1);
    url = `http://127.0.0.1:${port}/compile`;
    for (let i = 0; i < 100; i++) {
      try {
        await labRequest(url);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    throw new Error('the service did not start');
  }, 900_000);

  afterAll(() => {
    if (container) docker('rm', '-f', container);
  });

  it('refuses #include "/etc/passwd" before clang runs', async () => {
    for (const source of ['#include "/etc/passwd"\nint main() {}', '#include </etc/passwd>\n', '%:include "../../../../etc/passwd"\n']) {
      const r = await post(source);
      expect(r.status).toBe(422);
      expect(r.json.diagnostics).toHaveLength(1);
      expect(r.json.diagnostics[0]).toMatchObject({ file: 'main.cpp', line: 1, severity: 'error' });
      expect(r.text).not.toContain('root:');
    }
  });

  it("refuses an include of the service's environment", async () => {
    for (const source of [
      '#include "/proc/self/environ"\n',
      '#include </proc/1/environ>\n',
      '#include "../../proc/self/environ"\n',
      '#define ENV </proc/self/environ>\n#include ENV\n',
      'const char e[] = {\n#embed "/proc/self/environ"\n};\n',
      '#if __has_include("/proc/self/environ")\n#endif\n',
    ]) {
      const r = await post(source);
      expect(r.status).toBe(422);
      expect(r.text).not.toContain(secret);
      expect(r.text).not.toContain('LAB_SECRET');
    }
  });

  it('stops a 30-second constexpr loop at the time limit', async () => {
    const source = [
      'constexpr long spin(long k) {',
      '  long s = 0;',
      '  for (long i = 0; i < 300000; i++) s += (i ^ k) & 7;',
      '  return s;',
      '}',
      'template <int N> struct Spin { static constexpr long value = spin(N) + Spin<N - 1>::value; };',
      'template <> struct Spin<0> { static constexpr long value = 0; };',
      'long total = Spin<1000>::value;',
    ].join('\n');
    const started = Date.now();
    const r = await post(source);
    const took = Date.now() - started;
    expect(r.status).toBe(422);
    expect(r.json.diagnostics.at(-1)).toEqual({
      file: 'main.cpp', line: 1, col: 1, severity: 'error', message: 'The compile took longer than 10 seconds, so it was stopped.',
    });
    expect(took).toBeGreaterThanOrEqual(10_000);
    expect(took).toBeLessThan(15_000);
  }, 30_000);

  it('kills the compile when its client disconnects, and serves the next one', async () => {
    const clangs = () =>
      Number(docker('exec', container, 'sh', '-c', 'for p in /proc/[0-9]*; do tr "\\0" " " < $p/cmdline 2>/dev/null; echo; done | grep -c "^/opt/llvm/bin/clang" || true'));
    const source = 'constexpr long spin(long k) { long s = 0; for (long i = 0; i < 300000; i++) s += (i ^ k) & 7; return s; }\n' +
      'template <int N> struct Spin { static constexpr long value = spin(N) + Spin<N - 1>::value; };\n' +
      'template <> struct Spin<0> { static constexpr long value = 0; };\nlong total = Spin<1000>::value;\n';
    const gone = request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lab-Secret': secret, 'X-Lab-Client-IP': '203.0.113.7' },
    });
    gone.on('error', () => {});
    gone.end(JSON.stringify({ source, visitor: 'sec-lab-03' }));
    await expect.poll(clangs, { timeout: 5_000, interval: 100 }).toBe(1);
    gone.destroy();
    const left = Date.now();
    await expect.poll(clangs, { timeout: 3_000, interval: 100 }).toBe(0);
    expect(Date.now() - left).toBeLessThan(3_000);
    await expect.poll(() => docker('exec', container, 'sh', '-c', 'ls -A /tmp'), { timeout: 3_000, interval: 100 }).toBe('');
    const next = await post('int main() { return 0; }\n');
    expect(next.status).toBe(200);
  }, 30_000);

  it('caps the messages of a 2 MB template blow-up', async () => {
    const nest = (n: number): string => (n === 0 ? '0' : `twice(${nest(n - 1)})`);
    const source = [
      'template <class A, class B> struct P {};',
      'template <class T> P<T, T> twice(T) { return {}; }',
      `auto x = ${nest(18)};`,
      'int y = x;',
    ].join('\n');
    const r = await post(source);
    expect(r.status).toBe(422);
    expect(r.bytes.length).toBeLessThan(256 * 1024 + 8 * 1024);
    const last = r.json.diagnostics.at(-1);
    expect(last.message).toBe("The compiler's messages passed 256 KB, so the compile was stopped. Fix the first error and compile again.");
    expect(r.json.diagnostics[0]).toMatchObject({ line: 4, col: 5, severity: 'error' });
    expect(r.json.diagnostics[0].message).toMatch(/^no viable conversion from 'P<P<P</);
  }, 30_000);

  it('compiles a course program to a side module, with a rejected call refused on its line', async () => {
    const program = [
      '#include <GL/glew.h>',
      '#include <GL/freeglut.h>',
      '#include <iostream>',
      'void display() { glClear(GL_COLOR_BUFFER_BIT); glBegin(GL_TRIANGLES); glVertex2f(0, 1); glEnd(); glFlush(); }',
      'int main(int argc, char **argv) { glutInit(&argc, argv); glutCreateWindow("t"); glutDisplayFunc(display); std::cout << "hi"; glutMainLoop(); }',
    ];
    const ok = await post(program.join('\n'));
    expect(ok.status).toBe(200);
    expect([...ok.bytes.subarray(0, 4)]).toEqual([0, 0x61, 0x73, 0x6d]);
    expect(ok.headers['content-type']).toBe('application/wasm');

    // A lab PC's spellings: a bundled header in quotes, and MSVC pragmas MinGW ignores.
    const windows = await post([
      '#include "GL/glut.h"',
      '#include "Windows.h"',
      '#pragma comment(lib, "opengl32.lib")',
      '#pragma warning(disable: \\',
      '  4996)',
      'void display() { glClear(GL_COLOR_BUFFER_BIT); Sleep(1); glFlush(); }',
      'int main(int argc, char **argv) { glutInit(&argc, argv); glutCreateWindow("t"); glutDisplayFunc(display); glutMainLoop(); }',
      'int oops = undeclared_name;',
    ].join('\n'));
    expect(windows.status).toBe(422);
    expect(windows.json.diagnostics).toEqual([
      { file: 'main.cpp', line: 8, col: 12, severity: 'error', message: "use of undeclared identifier 'undeclared_name'" },
    ]);

    const bad = await post([...program.slice(0, 3), 'void reshape() {', '  glEnable(GL_DEPTH_TEST);', '  gluPerspective(45, 1, 0.1, 10);', '}'].join('\n'));
    expect(bad.status).toBe(422);
    expect(bad.json.diagnostics.map((d: { line: number; col: number; message: string }) => `main.cpp:${d.line}:${d.col}: ${d.message}`)).toEqual([
      "main.cpp:5:12: GL_DEPTH_TEST isn't part of VAMS Lab's OpenGL.",
      "main.cpp:6:3: gluPerspective isn't part of VAMS Lab's OpenGL. Use glOrtho or gluOrtho2D.",
    ]);
  }, 30_000);

  it('refuses a request without the secret', async () => {
    const res = await labRequest(url, { body: '{"source":"","visitor":"x"}', headers: { 'X-Lab-Client-IP': '203.0.113.7' } });
    expect(res.status).toBe(401);
  });

  it('leaves no compile directory behind, and no response holds root: or the secret', () => {
    expect(docker('exec', container, 'sh', '-c', 'ls -A /tmp')).toBe('');
    for (const b of bodies) {
      expect(b).not.toContain('root:');
      expect(b).not.toContain(secret);
    }
  });
});

/*
 * Inline assembly. The assembler's .incbin and .include read a file into the module, so a
 * program that reaches the assembler could return any file the service can read. Every
 * program here names only a canary path the tests own.
 */
const CANARY = '/tmp/vams-canary.txt';
const INCBIN = String.raw`".incbin \"/tmp/vams-canary.txt\""`;
const ASSEMBLY = (name: string) => `Inline assembly (${name}) isn't available in VAMS Lab.`;
const PASTING = "Token pasting (##) isn't available in VAMS Lab.";

describe('SEC-LAB-11: Inline assembly is refused before clang runs, however it is spelt', () => {
  it.each([
    ['module-level __asm__ with .incbin', `__asm__(${INCBIN});\nint main() {}`, [1, 1], '__asm__'],
    ['asm(...) inside a function', `int main() {\n  asm(${INCBIN});\n}`, [2, 3], 'asm'],
    ['__asm volatile', `void f() { __asm volatile(${INCBIN}); }`, [1, 12], '__asm'],
    ['__asm__ __volatile__', `void f() { __asm__ __volatile__(${INCBIN}); }`, [1, 12], '__asm__'],
    ['asm goto', `int main() { asm goto(${INCBIN} :::: out); out: return 0; }`, [1, 14], 'asm'],
    ['a macro whose body holds __asm__', `#define EMBED(f) __asm__(".incbin \\"" f "\\"")\nEMBED("${CANARY}");`, [1, 18], '__asm__'],
    ['an object-like macro for the keyword', `#define A asm\nA(${INCBIN});`, [1, 11], 'asm'],
    ['the keyword as a macro argument', `#define ID(x) x\nID(__asm__)(${INCBIN});`, [2, 4], '__asm__'],
    ['.include', String.raw`__asm__(".include \"/tmp/vams-canary.txt\"");`, [1, 1], '__asm__'],
    ['an upper-case .INCBIN', String.raw`__asm__(".INCBIN \"/tmp/vams-canary.txt\"");`, [1, 1], '__asm__'],
    ['a keyword split by a line splice', `__as\\\nm__(${INCBIN});`, [1, 1], '__asm__'],
    ['_asm', `void f() { _asm(${INCBIN}); }`, [1, 12], '_asm'],
    ['an asm label on a declaration', 'extern int x __asm__("y");', [1, 14], '__asm__'],
    ['the keyword in #if', '#if defined(__asm__)\n#endif', [1, 13], '__asm__'],
  ])('refuses %s', (_name, source, pos, keyword) => {
    const r = refused(source);
    expect([r.line, r.col]).toEqual(pos);
    expect(r.message).toBe(ASSEMBLY(keyword as string));
    expect(r.message).not.toMatch(LANGUAGE_DISCIPLINE);
  });
});

describe('SEC-LAB-12: Token pasting is refused, so a macro in the file cannot build the keyword', () => {
  it.each([
    ['a##b', `#define CAT(a, b) a##b\nCAT(__as, m__)(${INCBIN});`, [1, 20]],
    ['a ## b', '#define CAT(a, b) a ## b', [1, 21]],
    ['the %:%: digraph', '%:define CAT(a, b) a %:%: b', [1, 22]],
    ['## split by a line splice', '#define CAT(a, b) a #\\\n# b', [1, 21]],
    ['# then %:', '#define CAT(a, b) a #%: b', [1, 21]],
    ['%: then #', '#define CAT(a, b) a %:# b', [1, 21]],
    ['## in code', 'int x = 1 ## 2;', [1, 11]],
  ])('refuses %s', (_name, source, pos) => {
    const r = refused(source);
    expect([r.line, r.col]).toEqual(pos);
    expect(r.message).toBe(PASTING);
    expect(r.message).not.toMatch(LANGUAGE_DISCIPLINE);
  });
});

describe('SEC-LAB-13: Programs that only mention asm, or # once, still compile', () => {
  it.each([
    ['asm in a string', `#include <cstdio>\nint main() { std::puts("asm __asm__ .incbin ${CANARY} ##"); }`],
    ['asm in a raw string', 'const char *s = R"(asm("nop") ## __asm__)";'],
    ['asm in comments', '// asm("nop") and __asm__\n/* .incbin "/tmp/vams-canary.txt" ## */\nint main() {}'],
    ['identifiers that hold asm', 'int plasma = 1, asm_count = 2, my_asm = 3, __asm_x = 4, Asm = 5;'],
    ['stringizing with one #', '#include <cstdio>\n#define SHOW(x) #x\nint main() { std::puts(SHOW(plasma)); }'],
    ['a # character literal', "char a = '#', b = '%';"],
    ['#error text that mentions asm', '#error asm and ## in words\nint x;'],
  ])('accepts %s', (_name, source) => {
    expect(checkIncludes(source).ok).toBe(true);
  });

  it('accepts every example program, gallery program and battery program', () => {
    const dirs = ['src/features/lab-files/examples', 'tests/fixtures/lab/programs'];
    const files = dirs.flatMap((d) => readdirSync(join(process.cwd(), d)).filter((f) => f.endsWith('.cpp')).map((f) => join(d, f)));
    expect(files.length).toBeGreaterThan(20);
    for (const f of files) expect(checkIncludes(readFileSync(join(process.cwd(), f), 'utf8')), f).toMatchObject({ ok: true });
  });
});

describe('SEC-LAB-14: Inline assembly a header macro builds is found in the preprocessed program', () => {
  // clang -E output as the compile service writes it: line markers, then the expanded tokens.
  const expanded = (...body: string[]) =>
    [
      '# 1 "main.cpp"',
      '# 1 "<built-in>" 1',
      '# 1 "<command line>" 1',
      '# 1 "main.cpp" 2',
      '# 1 "/lab/sysroot/include/c++/v1/cstdio" 1 3',
      'extern "C" int puts(const char *);',
      '# 2 "main.cpp" 2',
      '',
      ...body,
    ].join('\n') + '\n';
  const MACRO = (name: string) => `A macro on this line makes inline assembly (${name}), which isn't available in VAMS Lab.`;

  it('refuses the keyword on the main.cpp line it came from', () => {
    // _LIBCPP_CONCAT(__as, m__)(...) on line 4 of main.cpp, as clang -E prints it.
    const r = checkExpanded(expanded('int x;', `__asm__(${INCBIN});`));
    expect(r).toEqual({ ok: false, line: 4, col: 1, message: MACRO('__asm__') });
    expect(MACRO('__asm__')).not.toMatch(LANGUAGE_DISCIPLINE);
  });

  it('follows the line markers clang writes when it skips blank lines', () => {
    const r = checkExpanded(expanded('int x;', '# 40 "main.cpp"', 'int y;', `void f() { asm(${INCBIN}); }`));
    expect(r).toEqual({ ok: false, line: 41, col: 1, message: MACRO('asm') });
  });

  it('places a keyword inside a header on line 1', () => {
    const text = ['# 1 "main.cpp"', '# 1 "/lab/include/GL/glut.h" 1', `__asm__(${INCBIN});`, '# 2 "main.cpp" 2', 'int x;'].join('\n');
    expect(checkExpanded(text)).toEqual({ ok: false, line: 1, col: 1, message: MACRO('__asm__') });
  });

  it('reads every token on a line that only starts like a marker', () => {
    expect(checkExpanded(expanded(`# __asm__(${INCBIN});`))).toMatchObject({ ok: false, message: MACRO('__asm__') });
    expect(checkExpanded(expanded(`# 5 "main.cpp" __asm__(${INCBIN});`))).toMatchObject({ ok: false, message: MACRO('__asm__') });
    expect(checkExpanded(expanded(`#pragma clang diagnostic push __asm__`))).toMatchObject({ ok: false, message: MACRO('__asm__') });
  });

  it('accepts asm in strings, identifiers that hold it, pragmas and characters a header may use', () => {
    const r = checkExpanded(expanded(
      '#pragma clang diagnostic push',
      'int plasma = 1, asm_count = 2;',
      'const char *s = "asm(\\"nop\\") __asm__", *t = R"(asm)";',
      "int q = 1'000; char c = '#';",
      'const char *u = "é"; int é2;',
      '#pragma clang diagnostic pop',
    ));
    expect(r).toEqual({ ok: true });
  });
});

/*
 * The same forms, and the header-macro route only the preprocessed check can see, against
 * the built image. The container has no network: requests are sent from inside it. A canary
 * file with a fresh marker stands in for the server's files, and no response may hold it.
 * Needs Docker: LAB_DOCKER=1 npx vitest run tests/security/lab-includes.test.ts
 */
describe.skipIf(!DOCKER)('SEC-LAB-15: Against the built image, inline assembly is refused and no response holds the canary', () => {
  const secret = `lab-${randomBytes(12).toString('hex')}`;
  const marker = `VAMS-CANARY-${randomBytes(12).toString('hex')}`;
  let container = '';
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  /** Posts from inside the container, which has no network of its own. */
  const SEND = [
    "import { request } from 'node:http';",
    "const chunks = []; for await (const c of process.stdin) chunks.push(c);",
    "const { secret, source } = JSON.parse(Buffer.concat(chunks).toString('utf8'));",
    "const req = request('http://127.0.0.1:8080/compile', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lab-Secret': secret, 'X-Lab-Client-IP': '203.0.113.7' } }, (res) => {",
    "  const body = []; res.on('data', (c) => body.push(c));",
    "  res.on('end', () => process.stdout.write(JSON.stringify({ status: res.statusCode, headers: res.headers, body: Buffer.concat(body).toString('base64') })));",
    "});",
    "req.on('error', (e) => { process.stdout.write(JSON.stringify({ error: e.message })); });",
    "req.end(JSON.stringify({ source, visitor: 'sec-lab-15' }));",
  ].join('\n');
  const post = (source: string) => {
    const out = execFileSync('docker', ['exec', '-i', container, 'node', '--input-type=module', '-e', SEND], {
      input: JSON.stringify({ secret, source }), encoding: 'utf8',
    });
    const r = JSON.parse(out) as { status: number; headers: Record<string, string>; body: string; error?: string };
    if (r.error) throw new Error(r.error);
    const raw = Buffer.from(r.body, 'base64');
    const bytes = r.headers['content-encoding'] === 'gzip' ? gunzipSync(raw) : raw;
    const diagnostics = Buffer.from(r.headers['x-lab-diagnostics'] ?? '', 'base64url').toString('utf8');
    const json = String(r.headers['content-type']).startsWith('application/json') ? JSON.parse(bytes.toString('utf8')) : null;
    return { status: r.status, everything: bytes.toString('latin1') + diagnostics, json };
  };

  beforeAll(async () => {
    const version = readFileSync(join(process.cwd(), 'lab/toolchain/EMSDK_VERSION'), 'utf8').trim();
    docker('build', '-f', 'lab/toolchain/Dockerfile', '--build-arg', `EMSDK_VERSION=${version}`, '-t', IMAGE, '.');
    container = docker('run', '-d', '--rm', '--network', 'none', '-e', `LAB_SECRET=${secret}`, IMAGE);
    expect(docker('inspect', '-f', '{{.HostConfig.NetworkMode}}', container)).toBe('none');
    docker('exec', container, 'sh', '-c', `printf '%s\\n' '${marker}' > ${CANARY}`);
    expect(docker('exec', container, 'cat', CANARY)).toBe(marker);
    for (let i = 0; i < 100; i++) {
      try {
        post('');
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    throw new Error('the service did not start');
  }, 900_000);

  afterAll(() => {
    if (container) docker('rm', '-f', container);
  });

  // A section the linker keeps, as a symbol the program uses: this is how a read would show.
  const KEPT = String.raw`".section .rodata.c,\"\",@\n.globl leak\n.type leak,@object\nleak:\n.incbin \"/tmp/vams-canary.txt\"\n.size leak, 37\n"`;
  const USE = 'extern "C" const char leak[];\nextern "C" const char *get() { return leak; }\nint main() { return get()[0]; }';

  it.each([
    ['module-level __asm__ with .incbin', `__asm__(${KEPT});\n${USE}`, 1],
    ['asm(...) inside a function', `int main() {\n  asm(${INCBIN});\n}`, 2],
    ['__asm volatile', `void f() { __asm volatile(${INCBIN}); }\nint main() { f(); }`, 1],
    ['the keyword pasted by a macro in the file', `#define CAT(a, b) a##b\nCAT(__as, m__)(${KEPT});\n${USE}`, 1],
    ['a macro whose body holds __asm__', `#define EMBED(s) __asm__(s)\nEMBED(${KEPT});\n${USE}`, 1],
    ['.include', String.raw`__asm__(".include \"/tmp/vams-canary.txt\"");` + '\nint main() {}', 1],
    ['the keyword pasted by libc++’s _LIBCPP_CONCAT', `#include <cstdio>\n_LIBCPP_CONCAT(__as, m__)(${KEPT});\n${USE}`, 2],
  ])('refuses %s, and returns none of the canary', (_name, source, line) => {
    const r = post(source);
    expect(r.status).toBe(422);
    expect(r.json.diagnostics).toHaveLength(1);
    expect(r.json.diagnostics[0]).toMatchObject({ file: 'main.cpp', line, severity: 'error' });
    expect(r.json.diagnostics[0].message).toMatch(/inline assembly|Token pasting/i);
    expect(r.everything).not.toContain(marker);
  }, 30_000);

  it.each([
    ['asm in a string', `#include <cstdio>\nint main() { std::puts("asm __asm__ .incbin ${CANARY}"); }`],
    ['asm in comments', '// asm("nop") and __asm__\n/* .incbin "/tmp/vams-canary.txt" */\nint main() {}'],
    ['plasma', 'int plasma = 1, asm_count = 2;\nint main() { return plasma + asm_count; }'],
    ['every bundled and standard header', [...BUNDLED_HEADERS, ...STANDARD_HEADERS].map((h) => `#include <${h}>`).join('\n') + '\nint main() {}'],
  ])('compiles a program with %s, and its module holds none of the canary', (_name, source) => {
    const r = post(source);
    expect(r.json?.diagnostics ?? []).toEqual([]);
    expect(r.status).toBe(200);
    expect(r.everything).not.toContain(marker);
  }, 30_000);
});
