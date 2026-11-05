/**
 * The text a student reads in a source file, and the two wording checks it must pass: British
 * spelling (WB-SPELL) and the Language Discipline list (BB-LAB-58).
 */
import ts from 'typescript';

export const AMERICAN = /\b(colors?|colored|coloring|colorful|rasteriz(?:e|ed|es|ing|ation)|normaliz(?:e|ed|es|ing|ation)|centers?|centered|centering|gray|grayscale|behaviors?|minimiz(?:e|ed|es|ing)|maximiz(?:e|ed|es|ing)|visualiz(?:e|ed|es|ing|ation)|optimiz(?:e|ed|es|ing|ation)|initializ(?:e|ed|es|ing|ation)|organiz(?:e|ed|es|ing|ation|ations|er|ers)|analyz(?:e|ed|es|ing)|recogniz(?:e|ed|es|ing)|summariz(?:e|ed|es|ing)|customiz(?:e|ed|es|ing|ation)|prioritiz(?:e|ed|es|ing)|favorites?|labeled|labeling|canceled|canceling|catalogs?|synchroniz(?:e|ed|es|ing|ation)|utiliz(?:e|ed|es|ing)|emphasiz(?:e|ed|es|ing)|realiz(?:e|ed|es|ing|ation)|generaliz(?:e|ed|es|ing|ation)|specializ(?:e|ed|es|ing)|neighbors?|neighboring|travel(?:ed|ing)|fulfill|enroll)\b/gi;

/** The words student text never uses (AGENTS.md and the product plan's Language Discipline). */
export const LANGUAGE_DISCIPLINE = /coming soon|not yet|not supported|unsupported|future|deferred|\b3D\b|lighting/gi;

/** Remove what is code, not prose: backtick spans, <code> elements, and GL and GLUT names. */
export function stripCode(text: string): string {
  return text
    .replace(/`[^`]*`/g, ' ')
    .replace(/<code>[\s\S]*?<\/code>/g, ' ')
    .replace(/\bglu?t?[A-Z]\w*/g, ' ')
    .replace(/\bGL(?:UT)?_\w+/g, ' ')
    .replace(/prefers-color-scheme/g, ' ');
}

export function americanInText(text: string): string[] {
  return (stripCode(text).match(AMERICAN) ?? []).map((w) => w.toLowerCase());
}

export function bannedInText(text: string): string[] {
  return (stripCode(text).match(LANGUAGE_DISCIPLINE) ?? []).map((w) => w.toLowerCase());
}

/** One piece of text in a file, at the line it starts on. */
export interface Prose {
  line: number;
  text: string;
  /** The whole string is a code-like token: spelling leaves it alone, the Language Discipline doesn't. */
  code: boolean;
}

const SKIPPED_ATTRIBUTES = new Set(['className', 'class', 'id', 'key', 'role', 'type', 'href', 'src', 'htmlFor', 'panelId', 'focusPanel']);
/** A name, a path, a CONSTANT or a command-line flag, which is code even inside quotes. */
export const isCodeLikeToken = (s: string) => /^[a-z_$][\w$./-]*$/.test(s) || /^[A-Z0-9_]+$/.test(s) || /^--?[a-z][\w=.+-]*$/.test(s);

function scriptKind(file: string): ts.ScriptKind {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

/**
 * Every string literal, template part and JSX text in a TypeScript or JavaScript file, apart from
 * imports and attributes that hold no text. Code-like tokens are marked.
 */
export function proseInScript(text: string, file: string): Prose[] {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file));
  const found: Prose[] = [];
  const add = (node: ts.Node, value: string) => {
    found.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text: value, code: isCodeLikeToken(value) });
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sf);
      if (SKIPPED_ATTRIBUTES.has(name) || name.startsWith('data-')) return;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node, node.text);
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) add(node, node.text);
    else if (ts.isJsxText(node)) add(node, node.text);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** Every string literal in a C file, apart from #include names, with code-like tokens marked. Comments are skipped. */
export function proseInC(text: string): Prose[] {
  const found: Prose[] = [];
  let line = 1;
  let i = 0;
  let lineStart = true;
  let directive = '';
  while (i < text.length) {
    const c = text[i];
    if (c === '\n') {
      line++;
      i++;
      lineStart = true;
      directive = '';
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end < 0 ? text.length : end + 2;
      for (let j = i; j < stop; j++) if (text[j] === '\n') line++;
      i = stop;
      continue;
    }
    if (lineStart && c === '#') directive = /^#\s*(\w*)/.exec(text.slice(i))?.[1] ?? '';
    if (c !== ' ' && c !== '\t' && c !== '\r') lineStart = false;
    if (c === '"' || c === "'") {
      const startLine = line;
      let j = i + 1;
      let value = '';
      while (j < text.length && text[j] !== c && text[j] !== '\n') {
        if (text[j] === '\\') {
          const next = text[j + 1];
          value += next === 'n' || next === 't' ? ' ' : next;
          j += 2;
        } else value += text[j++];
      }
      i = j + 1;
      if (c === '"' && directive !== 'include') found.push({ line: startLine, text: value, code: isCodeLikeToken(value) });
      continue;
    }
    i++;
  }
  return found;
}
