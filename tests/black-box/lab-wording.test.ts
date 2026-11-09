/**
 * BLACK-BOX TEST SUITE — BB-LAB (what the Lab says)
 * Every message the Lab can show passes the Language Discipline list and the British spelling
 * guard (WB-SPELL): the strings and JSX text of the Lab's sources (src/**\/lab-* and src/pages/lab),
 * and the messages of the runtime (lab/runtime). The browser's compile, src/features/lab-compile, is
 * among the Lab's sources.
 *
 * Scope: messages, not code. The example programs (.cpp) and the bundled headers in lab/include are
 * C++ the student reads as code, where GL_LIGHTING is an API name, so they are not scanned. Nor are
 * the runtime's vendored stb_image.h, its build script and its build output. In a scanned file the
 * checks leave out imports, attributes that hold no text (className, href, data-*), and GL and
 * GLUT names. A string that is wholly a code-like token (a name, path, CONSTANT or compiler flag)
 * keeps its spelling, as in WB-SPELL, but is still checked for the banned words: a lone "future" is
 * flagged. The one such token that is code, the C++ header <future>, is listed in CODE_NAMES. Clang's
 * own diagnostics pass through the service unchanged, so they are not the Lab's messages.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { americanInText, bannedInText, proseInC, proseInScript, type Prose } from '../helpers/student-text';

const ROOT = join(__dirname, '../..');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

const fromRoot = (p: string) => relative(ROOT, p).replace(/\\/g, '/');

/** The Lab's TypeScript under src: any file below a lab-* folder, a lab-* file, or the /lab page. */
function labSources(): string[] {
  return walk(join(ROOT, 'src'))
    .map(fromRoot)
    .filter((r) => /\.tsx?$/.test(r) && !r.endsWith('.d.ts'))
    .filter((r) => r.startsWith('src/pages/lab/') || r.split('/').some((part) => part.startsWith('lab-')));
}

/** The runtime's own C and JavaScript. */
function runtimeSources(): string[] {
  return readdirSync(join(ROOT, 'lab/runtime'), { withFileTypes: true })
    .filter((e) => e.isFile() && /\.(c|js)$/.test(e.name))
    .map((e) => `lab/runtime/${e.name}`);
}

const FILES = [...labSources(), ...runtimeSources()].sort();

/** Strings that hold a banned word and are code, not messages, each in the one file that has it. */
const CODE_NAMES: Record<string, string[]> = {
  // The C++17 header <future>, in the list of standard headers a program may include.
  'src/features/lab-compile/model/includes.ts': ['future'],
};

function messagesIn(file: string): Prose[] {
  const text = readFileSync(join(ROOT, file), 'utf8');
  const all = file.endsWith('.c') ? proseInC(text) : proseInScript(text, file);
  const names = CODE_NAMES[file] ?? [];
  return all.filter(({ text: t, code }) => !(code && names.includes(t)));
}

/** Each message that breaks a rule, with its line and the words that break it. */
function violations(messages: Prose[]): string[] {
  return messages.flatMap(({ line, text, code }) => {
    // A name or path keeps its spelling, but a banned word is flagged wherever it stands.
    const words = [...bannedInText(text), ...(code ? [] : americanInText(text))];
    return words.length ? [`${line}: ${words.join(', ')} in ${JSON.stringify(text.trim())}`] : [];
  });
}

describe('BB-LAB-58: What the Lab says passes the Language Discipline list and the British spelling guard', () => {
  it('scans the page, the Lab slices, the compile and the runtime', () => {
    for (const file of [
      'src/pages/lab/model/copy.ts',
      'src/pages/lab/ui/LabPage.tsx',
      'src/features/lab-compile/model/messages.ts',
      'src/features/lab-run/worker/glut-runtime.ts',
      'src/features/lab-files/model/open.ts',
      'src/widgets/lab-workspace/ui/LabWorkspace.tsx',
      'src/entities/lab-project/model/lab-store.ts',
      'src/shared/lib/lab-diagnostic.ts',
      'src/features/lab-compile/model/diagnostics.ts',
      'src/features/lab-compile/model/includes.ts',
      'src/features/lab-compile/model/compile.ts',
      'src/widgets/lab-workspace/ui/CompilerNotice.tsx',
      'lab/runtime/library_vams.js',
      'lab/runtime/vams_main.c',
    ]) {
      expect(FILES).toContain(file);
    }
    expect(FILES.some((f) => f.endsWith('.cpp') || f.endsWith('.h'))).toBe(false);
    expect(FILES.flatMap(messagesIn).length).toBeGreaterThan(300);
  });

  it.each(FILES)('%s', (file) => {
    expect(violations(messagesIn(file))).toEqual([]);
  });

  it('lists only code names that are still in their files', () => {
    for (const [file, names] of Object.entries(CODE_NAMES)) {
      const text = readFileSync(join(ROOT, file), 'utf8');
      const found = proseInScript(text, file).filter((p) => p.code).map((p) => p.text);
      for (const name of names) expect(found, `${file}: ${name}`).toContain(name);
    }
  });

  it('flags a message and leaves code alone', () => {
    const tsx = [
      'import x from "future-lib";',
      'const a = "Lighting isn\'t ready yet, it is coming soon.";',
      'const b = <p className="lab-future">This colour is Not Supported in 3D</p>;',
      'const c = ["GL_LIGHTING", "glLightfv", "lab-stage", "color", "-fno-color-diagnostics", `${n} lines`];',
      'const d = ["future", "deferred", "lighting", "3D", "unsupported"];',
    ].join('\n');
    expect(violations(proseInScript(tsx, 'x.tsx'))).toEqual([
      '2: lighting, coming soon in "Lighting isn\'t ready yet, it is coming soon."',
      '3: not supported, 3d in "This colour is Not Supported in 3D"',
      // A banned word is flagged even when the whole string looks like a name.
      '5: future in "future"',
      '5: deferred in "deferred"',
      '5: lighting in "lighting"',
      '5: 3d in "3D"',
      '5: unsupported in "unsupported"',
    ]);
    const c = [
      '#include "future.h"',
      '// a comment about lighting',
      '/* unsupported',
      '   here */ static const char *s = "GL_LIGHTING";',
      'int f(void) { fprintf(stderr, "%s has no color\\n", "x"); return \'"\'; }',
      'const char *t = "Deferred until the \\"next\\" run";',
      'const char *u = "lighting";',
    ].join('\n');
    expect(violations(proseInC(c))).toEqual([
      '5: color in "%s has no color"',
      '6: deferred in "Deferred until the \\"next\\" run"',
      '7: lighting in "lighting"',
    ]);
  });
});
