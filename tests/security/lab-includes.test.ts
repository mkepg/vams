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
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { BUNDLED_HEADERS, checkIncludes, STANDARD_HEADERS } from '../../lab/service/src/includes.ts';
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
    ['#include "myheader.h"', '"myheader.h" isn\'t one of VAMS Lab\'s headers. The one header in quotes is "stb_image.h".'],
    ['#include "main.cpp"', '"main.cpp" isn\'t one of VAMS Lab\'s headers. The one header in quotes is "stb_image.h".'],
    ['#include "GL/glut.h"', 'Write #include <GL/glut.h> in VAMS Lab.'],
    ['#include "iostream"', 'Write #include <iostream> in VAMS Lab.'],
  ])('refuses the quoted include %s', (line, message) => {
    const r = refused(line);
    expect(r).toEqual({ ok: false, line: 1, col: 10, message });
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
      '#include "/etc/passwd"', '#include "x.h"', '#include "GL/glut.h"', '#include <x.h>', '#include X',
      '#include_next <x.h>', '#embed "x"', '#pragma GCC poison x', '#if __has_include(<x.h>)\n#endif', '#line 1',
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
    ['#pragma comment(lib, "opengl32.lib")'],
    ['#pragma clang system_header'],
    ['#pragma once extra'],
    ['#pragma'],
    ['  #  pragma   message("hi")'],
  ])('refuses %s, which is not #pragma once', (line) => {
    const r = refused(`\n${line}\n`);
    expect(r.line).toBe(2);
    expect(r.message).toBe('Only #pragma once is available in VAMS Lab.');
  });

  it('allows #pragma once, with spaces and a comment', () => {
    expect(checkIncludes('#pragma once\n  #  pragma  once // header guard\n#pragma /* c */ once\n').ok).toBe(true);
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
