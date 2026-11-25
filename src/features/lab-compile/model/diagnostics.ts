/**
 * Turns clang's and wasm-ld's stderr into diagnostics on the student's lines.
 *
 * - A use of a rejected name keeps the VAMS message vams_rejected.h gives it.
 * - An undeclared GL, GLU, GLUT or GLEW name gets the same message form, with the advice
 *   refusals.ts gives it; a mistyped one keeps clang's "did you mean". So does a Windows call the
 *   Lab's windows.h leaves out.
 * - wasm-ld's undefined symbols are said in plain words, on the line that uses the name.
 * - Anything reported inside a header moves to the line of main.cpp that led
 *   there; notes inside headers are dropped.
 * - No message names a path in the compiler's file tree.
 */

import type { Diagnostic } from '@/shared/lib/lab-diagnostic';
import { FREEGLUT_EXT, freeglutMessage, GL_NAME, GL_TYPE, REJECTED_TEXT, refusalAdvice, WINDOWS_TEXT, windowsAdvice } from './refusals';

export type { Diagnostic };
export type Severity = Diagnostic['severity'];

export const MAIN_FILE = 'main.cpp';

export { REJECTED_TEXT };

const LOCATED = /^(.+?):(\d+):(\d+): (fatal error|error|warning|note): (.*)$/;
const UNLOCATED = /^(?:(?:clang(?:\+\+)?|wasm-ld|llvm-objcopy)(?:-\d+)?: )?(fatal error|error|warning): (.*)$/;
const INCLUDED_FROM = /^In file included from (.+?):(\d+):$/;
const ALSO_INCLUDED_FROM = /^\s+from (.+?):(\d+):$/;

const UNAVAILABLE = /^'([A-Za-z_]\w*)' is unavailable: (\1 isn't part of VAMS Lab's OpenGL\..*)$/;
const UNDECLARED = /^use of undeclared identifier '([A-Za-z_]\w*)'(?:; did you mean (?:'(?:::)?([A-Za-z_][\w:]*)'|.*))?\??$/;
const UNKNOWN_TYPE = /^unknown type name '([A-Za-z_]\w*)'(?:; did you mean (?:'(?:::)?([A-Za-z_][\w:]*)'|.*))?\??$/;

/** Every file name clang prints for the student's file. */
function isMain(file: string): boolean {
  return file === MAIN_FILE || file.endsWith(`/${MAIN_FILE}`);
}

/**
 * Removes the compiler's paths from a message: a path under a known root loses the
 * root (/lab/include/GL/gl.h becomes GL/gl.h) and any other absolute path
 * keeps only its file name.
 */
export function scrubPaths(message: string): string {
  return message
    .replace(/\/lab\/sysroot\/include\/c\+\+\/v1\//g, '')
    .replace(/\/lab\/sysroot\/include\//g, '')
    .replace(/\/lab\/include\//g, '')
    .replace(/(^|[\s'"(=:<])\/(?:[\w.+@-]+\/)+([\w.+@-]+)/g, '$1$2')
    .replace(/(^|[\s'"(=:<])\/[\w.+@-]+(?=$|[\s'")>:,])/g, (m, pre: string) => `${pre}${m.slice(pre.length + 1)}`);
}

/**
 * The message for a GL name the Lab's headers leave out, or for a Windows call its windows.h
 * leaves out; null to keep clang's own. A mistyped GL name keeps clang's "did you mean".
 */
function refusal(name: string, suggestion: string | undefined, gl: boolean): string | null {
  if (gl) {
    if (FREEGLUT_EXT.test(name)) return freeglutMessage(name);
    const advice = refusalAdvice(name, (stem) => stem === suggestion);
    if (advice) return `${name}${REJECTED_TEXT} ${advice}`;
    return suggestion ? null : `${name}${REJECTED_TEXT}`;
  }
  const windows = windowsAdvice(name);
  return windows ? `${name}${WINDOWS_TEXT} ${windows}` : null;
}

/** The message to show for clang's, and whether it is a VAMS refusal, which the line's other errors follow from. */
function rewriteMessage(message: string): { message: string; rejected: boolean } {
  const unavailable = UNAVAILABLE.exec(message);
  if (unavailable) return { message: unavailable[2], rejected: true };
  const undeclared = UNDECLARED.exec(message);
  const said = undeclared && refusal(undeclared[1], undeclared[2], GL_NAME.test(undeclared[1]));
  if (said) return { message: said, rejected: true };
  const type = UNKNOWN_TYPE.exec(message);
  const typed = type && refusal(type[1], type[2], GL_NAME.test(type[1]) || GL_TYPE.test(type[1]));
  if (typed) return { message: typed, rejected: true };
  return { message: scrubPaths(message), rejected: false };
}

interface Raw {
  file: string;
  line: number;
  col: number;
  severity: Severity;
  message: string;
  rejected: boolean;
}

interface Group {
  primary: Raw;
  /** The main.cpp line an include chain before the primary started from. */
  includedAt: { line: number; col: number } | null;
  notes: Raw[];
}

const severityOf = (s: string): Severity => (s === 'fatal error' ? 'error' : (s as Severity));

export function rewriteDiagnostics(stderr: string): Diagnostic[] {
  const groups: Group[] = [];
  let includedAt: { line: number; col: number } | null = null;
  let chainOpen = false;

  for (const line of stderr.split(/\r?\n/)) {
    const inc = INCLUDED_FROM.exec(line) ?? ALSO_INCLUDED_FROM.exec(line);
    if (inc) {
      // The chain lists the innermost header first and main.cpp last.
      if (!chainOpen) includedAt = null;
      chainOpen = true;
      if (isMain(inc[1])) includedAt = { line: Number(inc[2]), col: 1 };
      continue;
    }
    const m = LOCATED.exec(line);
    if (m) {
      chainOpen = false;
      const severity = severityOf(m[4]);
      const { message, rejected } = rewriteMessage(m[5]);
      const raw: Raw = {
        file: m[1],
        line: Number(m[2]),
        col: Number(m[3]),
        severity,
        message,
        rejected,
      };
      if (severity === 'note') {
        groups.at(-1)?.notes.push(raw);
      } else {
        groups.push({ primary: raw, includedAt: isMain(raw.file) ? null : includedAt, notes: [] });
      }
      continue;
    }
    const u = UNLOCATED.exec(line);
    if (u) {
      chainOpen = false;
      groups.push({
        primary: { file: '', line: 0, col: 0, severity: severityOf(u[1]), message: scrubPaths(u[2]), rejected: false },
        includedAt: null,
        notes: [],
      });
    }
    // Anything else (the -H trace, "N errors generated.", a crash's stack dump) is dropped.
  }

  // Place every group on a line of main.cpp.
  const placed: { at: { line: number; col: number }; group: Group }[] = [];
  let last: { line: number; col: number } | null = null;
  let lastInHeader: { line: number; col: number } | null = null;
  for (const g of groups) {
    let at: { line: number; col: number } | null = null;
    if (isMain(g.primary.file)) {
      at = { line: g.primary.line, col: g.primary.col };
      lastInHeader = null;
    } else if (g.primary.file === '') {
      at = last;
    } else {
      // An instantiation's "requested here" in main.cpp is where the student's code is. Clang
      // prints it once per instantiation, so a later error in the same header shares it.
      const fromNote = [...g.notes].reverse().find((n) => isMain(n.file));
      at = fromNote ? { line: fromNote.line, col: fromNote.col } : (lastInHeader ?? g.includedAt ?? last);
      lastInHeader = at;
    }
    at ??= { line: 1, col: 1 };
    last = at;
    placed.push({ at, group: g });
  }

  // A rejected name also gives a type error on its line (clang reads on with its best guess); the VAMS message is the one to keep.
  const rejectedLines = new Set(placed.filter((p) => p.group.primary.rejected).map((p) => p.at.line));

  const out: Diagnostic[] = [];
  const seen = new Set<string>();
  const push = (d: Diagnostic) => {
    const key = `${d.line}:${d.col}:${d.severity}:${d.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(d);
  };
  for (const { at, group } of placed) {
    const p = group.primary;
    if (p.severity === 'error' && !p.rejected && rejectedLines.has(at.line)) continue;
    push({ file: MAIN_FILE, line: at.line, col: at.col, severity: p.severity, message: p.message });
    for (const n of group.notes) {
      if (!isMain(n.file)) continue;
      push({ file: MAIN_FILE, line: n.line, col: n.col, severity: 'note', message: n.message });
    }
  }
  return out;
}

const UNDEFINED = /^(?:wasm-ld(?:-\d+)?: )?error: (?:[^:]*: )?undefined symbol: (.+)$/;

/** Where the program uses a name it never defined: the first line that uses it and doesn't only declare it. */
function lineUsing(source: string, name: string): { line: number; col: number } {
  const owner = /^(?:vtable|typeinfo) for ([A-Za-z_][\w:]*)$/.exec(name);
  const isFunction = name.endsWith(')');
  const ident = (owner ? owner[1] : name.replace(/\(.*$/, '').replace(/<.*>/g, '')).split('::').pop()!.replace(/^operator.*/, '');
  if (!/^[A-Za-z_]\w*$/.test(ident)) return { line: 1, col: 1 };
  const qualifiers = '(?:(?:extern|static|inline|virtual|const|unsigned|signed)\\s+)*';
  // A type, then the name: at a line's start or after { ; or :, and never a statement such as return x;.
  const typed = `(?:^|[{;:])\\s*${qualifiers}(?!(?:return|else|throw|delete|case|goto|new)\\b)[A-Za-z_][\\w:<>,]*[\\s*&]+${ident}\\s*`;
  // A class's line for its missing virtual functions; otherwise a use that isn't only a declaration.
  const use = owner ? new RegExp(`\\b(?:class|struct)\\s+${ident}\\b`) : new RegExp(`\\b${ident}\\b${isFunction ? '\\s*\\(' : ''}`);
  const declaration = owner
    ? /(?!)/
    : isFunction
      ? new RegExp(`${typed}\\([^)]*\\)\\s*(?:const\\s*)?;`)
      : new RegExp(`\\bextern\\b|${typed}(?:\\[[^\\]]*\\])?\\s*;`);
  const lines = source.split(/\r\n|\n|\r/);
  for (let i = 0; i < lines.length; i++) {
    const m = use.exec(lines[i]);
    if (m && !declaration.test(lines[i])) return { line: i + 1, col: new TextEncoder().encode(lines[i].slice(0, m.index)).length + 1 };
  }
  return { line: 1, col: 1 };
}

/** The plain words for a name the program uses and never defines, as wasm-ld demangles it. */
export function undefinedMessage(name: string): string {
  const vtable = /^(?:vtable|typeinfo) for (.+)$/.exec(name);
  if (vtable) return `${vtable[1]} declares a virtual function it never defines. Write the body of each of ${vtable[1]}'s virtual functions.`;
  if (name.endsWith(')')) return `${name} is declared but never defined. Write its body, or check that its name and parameters match the function you wrote.`;
  return `${name} is declared but never defined. Define it once, outside any class and without extern.`;
}

/** wasm-ld's messages: each undefined symbol on the line that uses it, the rest as rewriteDiagnostics gives them. */
export function linkDiagnostics(stderr: string, source: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  const rest: string[] = [];
  for (const line of stderr.split(/\r?\n/)) {
    const m = UNDEFINED.exec(line);
    if (!m) {
      rest.push(line);
      continue;
    }
    const name = m[1].trim();
    out.push({ file: MAIN_FILE, ...lineUsing(source, name), severity: 'error', message: undefinedMessage(name) });
  }
  return [...out, ...rewriteDiagnostics(rest.join('\n'))];
}
