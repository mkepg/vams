/**
 * WHITE-BOX TEST SUITE — WB-SPELL
 * Students read British spelling everywhere: labels, tooltips, Help, lessons, the course map,
 * the Math panel, line explanations, site pages and the generated program's comments.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { everythingFixture } from '../helpers/code-fixtures';
import { americanInText, proseInScript } from '../helpers/student-text';

const SRC = path.resolve(__dirname, '../../src');
const GENERATOR_FILE = path.join('features', 'code-generation', 'model', 'code-generator.ts');
const GENERATOR_DIR = path.join('features', 'code-generation', 'model', 'generator') + path.sep;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

/** Every source file whose strings students can read; the generator's C++ is checked through the program (WB-SPELL-02). */
function sourceFiles(): string[] {
  return walk(SRC)
    .map((p) => path.relative(SRC, p))
    .filter((r) => /\.tsx?$/.test(r) && !r.endsWith('.d.ts') && r !== GENERATOR_FILE && !r.startsWith(GENERATOR_DIR))
    .sort();
}

function americanIn(file: string): string[] {
  return proseInScript(fs.readFileSync(path.join(SRC, file), 'utf8'), file).flatMap(({ line, text }) => {
    const words = americanInText(text);
    return words.length ? [`${line}: ${words.join(', ')}`] : [];
  });
}

describe('WB-SPELL-01: Text in the sources is British', () => {
  it.each(sourceFiles())('%s', (file) => {
    expect(americanIn(file)).toEqual([]);
  });
});

describe('WB-SPELL-02: The generated program\'s comments are British', () => {
  it('has no American spelling in any // comment', () => {
    const program = everythingFixture();
    const comments = program.split('\n').map((l) => l.split('//')[1]).filter((c): c is string => Boolean(c));
    expect(comments.length).toBeGreaterThan(20);
    expect(comments.filter((c) => americanInText(c).length > 0)).toEqual([]);
  });
});

describe('WB-SPELL-03: The guard catches what it should and leaves code alone', () => {
  it('flags prose and passes names', () => {
    expect(americanInText('Pick a color')).toEqual(['color']);
    expect(americanInText('Organize your scene')).toEqual(['organize']);
    expect(americanInText('Colour the corner; glColor3f and GL_COLOR_ARRAY stay; `color` in code')).toEqual([]);
  });
});
