/**
 * SECURITY TEST SUITE — SEC-LAB (what a student's file may include and use)
 * A Lab program may include the bundled headers and the standard headers by name, and
 * nothing else. checkIncludes in src/features/lab-compile/model/includes.ts refuses
 * everything else before the browser's compiler runs.
 *
 * Test focus:
 *  - Paths, quoted headers other than "stb_image.h" and unlisted angle headers are refused
 *  - Includes built from macros, #include_next, #embed, #import, __has_include, __has_embed
 *    and every #pragma but once are refused, however they are spelt
 *  - Inline assembly is refused however it is spelt: the keywords, and ## in the file
 *
 * SEC-LAB-03, 14 and 15 checked the compile service's image and clang's preprocessed
 * output on the server. They went with the service; the browser's compiler sees only
 * the headers pack, so there is no server file to reach.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { BUNDLED_HEADERS, checkIncludes, STANDARD_HEADERS } from '@/features/lab-compile/model/includes';

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
 * Inline assembly. The assembler's .incbin and .include read a file into the module, so it
 * stays refused. Every program here names only a canary path the tests own.
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
