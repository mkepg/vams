/**
 * Checks a student's file before clang sees it. A program may include the
 * bundled headers and the standard headers by name, and nothing else: no
 * paths, no includes built from macros, and no directive or operator that
 * reads or probes a file.
 *
 * The scan follows clang's lexer where it matters: line splices (a backslash,
 * optional spaces, then a newline), comments, string and character literals,
 * raw strings, digit separators, the %: digraph, the Unicode spaces clang
 * reads as spaces, and #error and #warning lines, which clang reads raw to
 * the end of the line. Any other character outside ASCII must sit in a string
 * or a comment, so the scan and clang always split a line into the same
 * tokens. Where they could still disagree, the scan sees more directives than
 * clang does, never fewer.
 */

/** The headers in lab/include a program may include, as they are spelt there. */
export const BUNDLED_HEADERS = [
  'GL/gl.h',
  'GL/glu.h',
  'GL/glut.h',
  'GL/freeglut.h',
  'GL/freeglut_std.h',
  'GL/freeglut_ext.h',
  'GL/glew.h',
  'stb_image.h',
  'windows.h',
  'conio.h',
] as const;

/** The C++17 library headers and the C headers. */
export const STANDARD_HEADERS = [
  'algorithm', 'any', 'array', 'atomic', 'bitset', 'cassert', 'ccomplex', 'cctype', 'cerrno',
  'cfenv', 'cfloat', 'charconv', 'chrono', 'cinttypes', 'ciso646', 'climits', 'clocale', 'cmath',
  'codecvt', 'complex', 'condition_variable', 'csetjmp', 'csignal', 'cstdalign', 'cstdarg',
  'cstdbool', 'cstddef', 'cstdint', 'cstdio', 'cstdlib', 'cstring', 'ctgmath', 'ctime', 'cuchar',
  'cwchar', 'cwctype', 'deque', 'exception', 'execution', 'filesystem', 'forward_list', 'fstream',
  'functional', 'future', 'initializer_list', 'iomanip', 'ios', 'iosfwd', 'iostream', 'istream',
  'iterator', 'limits', 'list', 'locale', 'map', 'memory', 'memory_resource', 'mutex', 'new',
  'numeric', 'optional', 'ostream', 'queue', 'random', 'ratio', 'regex', 'scoped_allocator', 'set',
  'shared_mutex', 'sstream', 'stack', 'stdexcept', 'streambuf', 'string', 'string_view',
  'strstream', 'system_error', 'thread', 'tuple', 'type_traits', 'typeindex', 'typeinfo',
  'unordered_map', 'unordered_set', 'utility', 'valarray', 'variant', 'vector',
  'assert.h', 'complex.h', 'ctype.h', 'errno.h', 'fenv.h', 'float.h', 'inttypes.h', 'iso646.h',
  'limits.h', 'locale.h', 'math.h', 'setjmp.h', 'signal.h', 'stdalign.h', 'stdarg.h', 'stdbool.h',
  'stddef.h', 'stdint.h', 'stdio.h', 'stdlib.h', 'string.h', 'tgmath.h', 'time.h', 'uchar.h',
  'wchar.h', 'wctype.h',
] as const;

/** The one header a program may include in quotes, as the course's programs do. */
export const QUOTED_HEADER = 'stb_image.h';

/** Directives clang may see. Any other is refused, #line, #import and #embed among them. */
const DIRECTIVES = new Set([
  'define', 'undef', 'include', 'if', 'ifdef', 'ifndef', 'elif', 'elifdef', 'elifndef', 'else',
  'endif', 'error', 'warning', 'pragma',
]);

/** Operators that read or probe a file, or run a pragma from inside a macro. */
const OPERATORS = new Set(['__has_include', '__has_include_next', '__has_embed', '_Pragma', '__pragma']);

const HEADERS = new Map<string, string>(
  [...BUNDLED_HEADERS, ...STANDARD_HEADERS].map((h) => [h.toLowerCase(), h]),
);

export type IncludeCheck =
  | { ok: true; source: string }
  | { ok: false; line: number; col: number; message: string };

class Refusal {
  pos: number;
  message: string;
  constructor(pos: number, message: string) {
    this.pos = pos;
    this.message = message;
  }
}

/** Spaces a line splice may hold between its backslash and the newline. */
const isHSpace = (c: string) => c === ' ' || c === '\t' || c === '\f' || c === '\v';
/** The Unicode characters clang treats as spaces (with a warning). */
const isUnicodeSpace = (c: string) => {
  const n = c.charCodeAt(0);
  return (
    n === 0x85 || n === 0xa0 || n === 0x1680 || n === 0x180e || (n >= 0x2000 && n <= 0x200a) ||
    n === 0x2028 || n === 0x2029 || n === 0x202f || n === 0x205f || n === 0x3000
  );
};
const isSpace = (c: string) => isHSpace(c) || isUnicodeSpace(c);
const isIdent = (c: string) => /^[A-Za-z0-9_$]$/.test(c);
const isIdentStart = (c: string) => /^[A-Za-z_$]$/.test(c);
const isDigit = (c: string) => c >= '0' && c <= '9';
/** Characters clang keeps in a pp-number, and the ones a digit separator may stand before. */
const isNumberBody = (c: string) => /^[A-Za-z0-9_.]$/.test(c);
const isSeparated = (c: string) => /^[A-Za-z0-9_]$/.test(c);
/** Characters a raw string's delimiter may hold: printable ASCII other than space, parentheses and backslash. */
const isDelimiter = (c: string) => /^[!-~]$/.test(c) && c !== '(' && c !== ')' && c !== '\\';

/**
 * Reads the source as clang's lexer does after line splicing. `at(p)` is the
 * position of the next real character at or after p, skipping splices.
 */
class Reader {
  src: string;
  constructor(src: string) {
    this.src = src;
  }

  /** Skips every splice that starts at p. */
  at(p: number): number {
    const s = this.src;
    for (;;) {
      if (s[p] !== '\\') return p;
      let q = p + 1;
      while (q < s.length && isHSpace(s[q])) q++;
      if (s[q] === '\r' && s[q + 1] === '\n') q += 2;
      else if (s[q] === '\n' || s[q] === '\r') q += 1;
      else return p;
      p = q;
    }
  }

  ch(p: number): string {
    const q = this.at(p);
    return q < this.src.length ? this.src[q] : '';
  }

  /** The position just after the character at p. */
  next(p: number): number {
    return this.at(p) + 1;
  }

  /** Length of the newline at p, or 0. */
  newline(p: number): number {
    const s = this.src;
    if (s[p] === '\r' && s[p + 1] === '\n') return 2;
    return s[p] === '\n' || s[p] === '\r' ? 1 : 0;
  }
}

function scan(src: string): { includes: { start: number; chars: number[]; name: string }[] } {
  const r = new Reader(src);
  const includes: { start: number; chars: number[]; name: string }[] = [];
  let p = 0;
  let lineStart = true;
  if (src.charCodeAt(0) === 0xfeff) p = 1;

  const nul = src.indexOf('\0');
  if (nul >= 0) throw new Refusal(nul, 'This file holds a null character. Remove it and compile again.');

  /** Skips one comment at p, if there is one. Returns the new position and whether it crossed a line. */
  const comment = (q: number): { end: number; crossed: boolean } | null => {
    const a = r.at(q);
    if (r.src[a] !== '/') return null;
    const b = r.at(a + 1);
    if (r.src[b] === '/') {
      let e = b + 1;
      for (;;) {
        e = r.at(e);
        if (e >= src.length || r.newline(e)) return { end: e, crossed: false };
        e++;
      }
    }
    if (r.src[b] === '*') {
      let e = b + 1;
      let crossed = false;
      for (;;) {
        e = r.at(e);
        if (e >= src.length) return { end: e, crossed };
        if (r.newline(e)) crossed = true;
        if (src[e] === '*' && r.ch(e + 1) === '/') return { end: r.next(e + 1), crossed };
        e++;
      }
    }
    return null;
  };

  /** Skips spaces and comments that stay on the current logical line (block comments may cross lines). */
  const skipInLine = (q: number): number => {
    for (;;) {
      q = r.at(q);
      if (q < src.length && isSpace(src[q])) {
        q++;
        continue;
      }
      const c = comment(q);
      if (c) {
        q = c.end;
        continue;
      }
      return q;
    }
  };

  /** Reads an identifier at q (splices allowed inside), or returns null. */
  const ident = (q: number): { name: string; end: number } | null => {
    q = r.at(q);
    if (!isIdentStart(src[q] ?? '') && !(src[q] === '\\' && /[uU]/.test(r.ch(q + 1)))) return null;
    let name = '';
    for (;;) {
      q = r.at(q);
      const c = src[q] ?? '';
      if (c === '\\' && /[uU]/.test(r.ch(q + 1))) throw new Refusal(q, 'Write names without \\u escapes in VAMS Lab.');
      if (!isIdent(c)) return { name, end: q };
      name += c;
      q++;
    }
  };

  /** Skips a quoted literal (string or character) that opens at q. Ends at the close or the line's end. */
  const quoted = (q: number, close: string): number => {
    q = r.next(q);
    for (;;) {
      q = r.at(q);
      if (q >= src.length || r.newline(q)) return q;
      const c = src[q];
      if (c === '\\') {
        q = r.next(q + 1);
        continue;
      }
      q++;
      if (c === close) return q;
    }
  };

  /**
   * Skips a raw string whose prefix ends with the quote at q. Clang reads its
   * delimiter and body without splices. Returns null when the delimiter is
   * invalid or the string never ends, so the scan reads on as code.
   */
  const raw = (q: number): number | null => {
    const d = q + 1;
    let n = 0;
    while (n < 16 && isDelimiter(src[d + n] ?? '')) n++;
    if (src[d + n] !== '(') return null;
    const delim = src.slice(d, d + n);
    const end = src.indexOf(')' + delim + '"', d + n + 1);
    return end < 0 ? null : end + delim.length + 2;
  };

  /** Reads to the end of the logical line, as clang does for #error and #warning. */
  const toLineEnd = (q: number): number => {
    for (;;) {
      q = r.at(q);
      if (q >= src.length || r.newline(q)) return q;
      q++;
    }
  };

  const directive = (hash: number, afterHash: number): number => {
    let q = skipInLine(afterHash);
    if (q >= src.length || r.newline(q)) return q;
    const id = ident(q);
    if (!id) throw new Refusal(hash, "This directive isn't available in VAMS Lab.");
    const name = id.name;
    if (!DIRECTIVES.has(name)) throw new Refusal(hash, `#${name} isn't available in VAMS Lab.`);
    q = id.end;
    if (name === 'error' || name === 'warning') return toLineEnd(q);
    if (name === 'pragma') {
      const arg = ident(skipInLine(q));
      const rest = arg ? skipInLine(arg.end) : q;
      if (!arg || arg.name !== 'once' || !(rest >= src.length || r.newline(rest))) {
        throw new Refusal(hash, 'Only #pragma once is available in VAMS Lab.');
      }
      return rest;
    }
    if (name === 'include') return include(skipInLine(q));
    return q;
  };

  const include = (q: number): number => {
    const open = src[q];
    if (open !== '<' && open !== '"') {
      throw new Refusal(q, 'Write the header\'s name in <> or "" after #include.');
    }
    const close = open === '<' ? '>' : '"';
    const chars: number[] = [];
    let name = '';
    let e = q + 1;
    for (;;) {
      e = r.at(e);
      if (e >= src.length || r.newline(e)) throw new Refusal(q, `Close the header's name with ${close}.`);
      if (src[e] === close) break;
      chars.push(e);
      name += src[e];
      e++;
    }
    const isPath =
      name.startsWith('/') || name.includes('\\') || /^[A-Za-z]:/.test(name) || name.split('/').includes('..') ||
      name.startsWith('~');
    if (isPath) throw new Refusal(q, 'VAMS Lab includes headers by name, not by path.');
    const known = HEADERS.get(name.toLowerCase());
    if (open === '"') {
      if (known === QUOTED_HEADER) {
        includes.push({ start: q, chars, name: known });
      } else if (known) {
        throw new Refusal(q, `Write #include <${known}> in VAMS Lab.`);
      } else {
        throw new Refusal(q, `"${short(name)}" isn't one of VAMS Lab's headers. The one header in quotes is "${QUOTED_HEADER}".`);
      }
    } else {
      if (!known) throw new Refusal(q, `<${short(name)}> isn't one of VAMS Lab's headers.`);
      includes.push({ start: q, chars, name: known });
    }
    return e + 1;
  };

  while (p < src.length) {
    p = r.at(p);
    if (p >= src.length) break;
    const nl = r.newline(p);
    if (nl) {
      p += nl;
      lineStart = true;
      continue;
    }
    const c = src[p];
    if (isSpace(c)) {
      p++;
      continue;
    }
    const cm = comment(p);
    if (cm) {
      p = cm.end;
      if (cm.crossed) lineStart = true;
      continue;
    }
    const wasLineStart = lineStart;
    lineStart = false;

    // # or its digraph %: opens a directive at the start of a line.
    if (c === '#' || (c === '%' && r.ch(p + 1) === ':')) {
      const after = c === '#' ? p + 1 : r.next(p + 1);
      if (wasLineStart) {
        p = directive(p, after);
        continue;
      }
      p = after;
      continue;
    }
    if (c === '"' || c === "'") {
      p = quoted(p, c);
      continue;
    }
    if (isDigit(c) || (c === '.' && isDigit(r.ch(p + 1)))) {
      // A pp-number, with C++14 digit separators and exponent signs.
      let q = r.next(p);
      for (;;) {
        q = r.at(q);
        const d = src[q] ?? '';
        if (/[eEpP]/.test(d) && /[+-]/.test(r.ch(q + 1))) {
          q = r.next(q + 1);
        } else if (d === "'" && isSeparated(r.ch(q + 1))) {
          q = r.next(q + 1);
        } else if (isNumberBody(d)) {
          q++;
        } else {
          break;
        }
      }
      p = q;
      continue;
    }
    if (isIdentStart(c) || (c === '\\' && /[uU]/.test(r.ch(p + 1)))) {
      const id = ident(p)!;
      if (OPERATORS.has(id.name)) throw new Refusal(p, `${id.name} isn't available in VAMS Lab.`);
      const q = r.at(id.end);
      if (src[q] === '"' && /^(?:u8|u|U|L)?R$/.test(id.name)) {
        p = raw(q) ?? q;
        continue;
      }
      p = id.end;
      continue;
    }
    if (c.charCodeAt(0) > 127) throw new Refusal(p, 'This character can be used only in a string or a comment.');
    p++;
  }
  return { includes };
}

function short(name: string): string {
  return name.length > 60 ? `${name.slice(0, 60)}…` : name;
}

/** Line and column (1-based, the column in UTF-8 bytes, as clang counts) of an offset. */
export function position(src: string, offset: number): { line: number; col: number } {
  let line = 1;
  let start = 0;
  for (let i = 0; i < offset && i < src.length; i++) {
    const c = src[i];
    if (c === '\r' && src[i + 1] === '\n') continue;
    if (c === '\n' || c === '\r') {
      line++;
      start = i + 1;
    }
  }
  const col = Buffer.byteLength(src.slice(start, offset), 'utf8') + 1;
  return { line, col };
}

/**
 * Checks every include and directive in a student's file. When the file
 * passes, `source` is the same text with each header name in the spelling
 * lab/include uses, so <Windows.h> finds windows.h as it does on Windows.
 */
export function checkIncludes(source: string): IncludeCheck {
  try {
    const { includes } = scan(source);
    const out = source.split('');
    for (const inc of includes) {
      inc.chars.forEach((at, i) => {
        out[at] = inc.name[i] ?? out[at];
      });
    }
    return { ok: true, source: out.join('') };
  } catch (e) {
    if (!(e instanceof Refusal)) throw e;
    return { ok: false, ...position(source, e.pos), message: e.message };
  }
}
