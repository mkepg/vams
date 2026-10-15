/** Splits one line of generated C++ into tokens. The code panel colours them; the value diff compares them. */
const KEYWORDS = new Set([
  'void', 'int', 'float', 'double', 'char', 'bool', 'const', 'static',
  'struct', 'class', 'return', 'if', 'else', 'for', 'while', 'do',
  'switch', 'case', 'break', 'continue', 'true', 'false', 'nullptr',
  'unsigned', 'signed', 'short', 'long', 'auto', 'using', 'namespace',
  'reinterpret_cast', 'sizeof', 'new', 'delete',
]);

const GL_PREFIXES = ['GL_', 'GLUT_'];

export function tokenizeLine(line: string): Array<{ t: string; k: string }> {
  const out: Array<{ t: string; k: string }> = [];
  let i = 0;
  const n = line.length;

  while (i < n) {
    const ch = line[i];

    if (i === 0 && /^\s*#/.test(line)) { out.push({ t: line, k: 'pp' }); return out; }
    if (ch === '/' && line[i + 1] === '/') { out.push({ t: line.slice(i), k: 'comment' }); return out; }

    if (ch === '"') {
      let j = i + 1;
      while (j < n && line[j] !== '"') { if (line[j] === '\\') j++; j++; }
      out.push({ t: line.slice(i, j + 1), k: 'string' }); i = j + 1; continue;
    }
    if (ch === "'") {
      let j = i + 1;
      while (j < n && line[j] !== "'") { if (line[j] === '\\') j++; j++; }
      out.push({ t: line.slice(i, j + 1), k: 'string' }); i = j + 1; continue;
    }

    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(line[i + 1] || ''))) {
      const m = line.slice(i).match(/^[0-9]*\.?[0-9]+(e[+-]?[0-9]+)?[fFlLuU]*/);
      if (m) { out.push({ t: m[0], k: 'num' }); i += m[0].length; continue; }
    }

    if (/[A-Za-z_]/.test(ch)) {
      const m = line.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
      if (m) {
        const tok = m[0];
        let kind = 'ident';
        if (KEYWORDS.has(tok)) kind = 'kw';
        else if (GL_PREFIXES.some((p) => tok.startsWith(p))) kind = 'const';
        else if (tok.startsWith('gl') && tok.length > 2 && /[A-Z]/.test(tok[2])) kind = 'glfn';
        else if (tok.startsWith('glut') && tok.length > 4) kind = 'glfn';
        else if (line[i + tok.length] === '(') kind = 'fn';
        else if (tok === tok.toUpperCase() && tok.length > 1) kind = 'const';
        out.push({ t: tok, k: kind });
        i += tok.length; continue;
      }
    }

    if (/[{}()[\];,.:]/.test(ch)) { out.push({ t: ch, k: 'punct' }); i++; continue; }
    if (/[+\-*/%=<>!&|^~?]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[+\-*/%=<>!&|^~?]/.test(line[j])) j++;
      out.push({ t: line.slice(i, j), k: 'op' }); i = j; continue;
    }

    out.push({ t: ch, k: 'ws' }); i++;
  }
  return out;
}
