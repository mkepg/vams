/**
 * Turns clang's and wasm-ld's stderr into diagnostics on the student's lines.
 *
 * - A use of a rejected name keeps the VAMS message vams_rejected.h gives it.
 * - An undeclared GL, GLU, GLUT or GLEW name gets the same message form.
 * - Anything reported inside a header moves to the line of main.cpp that led
 *   there; notes inside headers are dropped.
 * - No message names a path on the server.
 */

export type Severity = 'error' | 'warning' | 'note';

export interface Diagnostic {
  file: 'main.cpp';
  line: number;
  col: number;
  severity: Severity;
  message: string;
}

export const MAIN_FILE = 'main.cpp';

/** The text after a name that vams_rejected.h's VAMS_REJECT_MESSAGE writes. */
export const REJECTED_TEXT = " isn't part of VAMS Lab's OpenGL.";

const LOCATED = /^(.+?):(\d+):(\d+): (fatal error|error|warning|note): (.*)$/;
const UNLOCATED = /^(?:(?:clang(?:\+\+)?|wasm-ld|llvm-objcopy)(?:-\d+)?: )?(fatal error|error|warning): (.*)$/;
const INCLUDED_FROM = /^In file included from (.+?):(\d+):$/;
const ALSO_INCLUDED_FROM = /^\s+from (.+?):(\d+):$/;
const TRACE = /^\.+ (\/.*)$/;

const UNAVAILABLE = /^'([A-Za-z_]\w*)' is unavailable: (\1 isn't part of VAMS Lab's OpenGL\..*)$/;
const UNDECLARED = /^use of undeclared identifier '([A-Za-z_]\w*)'(?:; did you mean .*)?$/;
const UNKNOWN_TYPE = /^unknown type name '([A-Za-z_]\w*)'(?:; did you mean .*)?$/;

/** GL, GLU, GLUT and GLEW names: functions, constants and types. */
const GL_NAME = /^(?:gl|glu|glut|glew)[A-Z]\w*$|^(?:GL|GLU|GLUT|GLEW)_\w+$/;
const GL_TYPE = /^(?:GL|GLU|GLUT|GLEW)[a-z]\w*$/;

/** Every file name clang prints for the student's file. */
function isMain(file: string): boolean {
  return file === MAIN_FILE || file.endsWith(`/${MAIN_FILE}`);
}

/**
 * Removes server paths from a message: a path under a known root loses the
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

/** The headers clang's -H trace lists, in the order clang entered them. */
export function includeTrace(stderr: string): string[] {
  const out: string[] = [];
  for (const line of stderr.split(/\r?\n/)) {
    const m = TRACE.exec(line);
    if (m) out.push(m[1]);
  }
  return out;
}

function rewriteMessage(message: string): string {
  const unavailable = UNAVAILABLE.exec(message);
  if (unavailable) return unavailable[2];
  const undeclared = UNDECLARED.exec(message);
  if (undeclared && GL_NAME.test(undeclared[1])) return `${undeclared[1]}${REJECTED_TEXT}`;
  const type = UNKNOWN_TYPE.exec(message);
  if (type && (GL_NAME.test(type[1]) || GL_TYPE.test(type[1]))) return `${type[1]}${REJECTED_TEXT}`;
  return scrubPaths(message);
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
      const message = rewriteMessage(m[5]);
      const raw: Raw = {
        file: m[1],
        line: Number(m[2]),
        col: Number(m[3]),
        severity,
        message,
        rejected: UNAVAILABLE.test(m[5]),
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

  // A rejected function used as a value also gives a type error on its line; the VAMS message is the one to keep.
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
