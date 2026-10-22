/**
 * WHITE-BOX TEST SUITE — WB-SPELL
 * Students read British spelling everywhere: labels, tooltips, Help, lessons, the course map,
 * the Math panel, line explanations, site pages and the generated program's comments.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { everythingFixture } from '../helpers/code-fixtures';

const AMERICAN = /\b(colors?|colored|coloring|colorful|rasteriz(?:e|ed|es|ing|ation)|normaliz(?:e|ed|es|ing|ation)|centers?|centered|centering|gray|grayscale|behaviors?|minimiz(?:e|ed|es|ing)|maximiz(?:e|ed|es|ing)|visualiz(?:e|ed|es|ing|ation)|optimiz(?:e|ed|es|ing|ation)|initializ(?:e|ed|es|ing|ation))\b/gi;

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

/** Remove what is code, not prose: backtick spans, <code> elements, and GL and GLUT names. */
function stripCode(text: string): string {
  return text
    .replace(/`[^`]*`/g, ' ')
    .replace(/<code>[\s\S]*?<\/code>/g, ' ')
    .replace(/\bglu?t?[A-Z]\w*/g, ' ')
    .replace(/\bGL(?:UT)?_\w+/g, ' ')
    .replace(/prefers-color-scheme/g, ' ');
}

function americanInText(text: string): string[] {
  return (stripCode(text).match(AMERICAN) ?? []).map((w) => w.toLowerCase());
}

const SKIPPED_ATTRIBUTES = new Set(['className', 'class', 'id', 'key', 'role', 'type', 'href', 'src', 'htmlFor', 'panelId', 'focusPanel']);
const isCodeLikeToken = (s: string) => /^[a-z_$][\w$./-]*$/.test(s) || /^[A-Z0-9_]+$/.test(s);

function americanIn(file: string): string[] {
  const text = fs.readFileSync(path.join(SRC, file), 'utf8');
  const kind = file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const found: string[] = [];
  const check = (node: ts.Node, value: string) => {
    if (isCodeLikeToken(value)) return;
    const words = americanInText(value);
    if (words.length) found.push(`${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}: ${words.join(', ')}`);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sf);
      if (SKIPPED_ATTRIBUTES.has(name) || name.startsWith('data-')) return;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) check(node, node.text);
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) check(node, node.text);
    else if (ts.isJsxText(node)) check(node, node.text);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
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
    expect(americanInText('Colour the corner; glColor3f and GL_COLOR_ARRAY stay; `color` in code')).toEqual([]);
  });
});
