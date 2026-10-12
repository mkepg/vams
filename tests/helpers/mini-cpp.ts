/**
 * A tiny interpreter for the statement subset VAMS generates inside handler, reshape and
 * animator bodies. It shares no code with src: the runtime parity tests run the generated
 * C++ through it and compare the result with the Run runtime.
 */
export type Value = number | boolean | { [field: string]: number | boolean };

const PREC: Record<string, number> = {
  '?': 1, '||': 2, '&&': 3, '==': 4, '!=': 4, '<': 5, '<=': 5, '>': 5, '>=': 5, '+': 6, '-': 6, '*': 7, '/': 7,
};
const TOKEN = /\s*(\d+\.?\d*f?|[A-Za-z_]\w*|>=|<=|==|!=|&&|\|\||[-+*/()?:.!<>])/y;

function tokenize(src: string): string[] {
  const text = src.trim();
  const out: string[] = [];
  let pos = 0;
  while (pos < text.length) {
    TOKEN.lastIndex = pos;
    const m = TOKEN.exec(text);
    if (!m) throw new Error(`mini-cpp: cannot read "${src}" at ${pos}`);
    out.push(m[1]);
    pos = TOKEN.lastIndex;
  }
  return out;
}

function matchParen(line: string, open: number): number {
  let depth = 0;
  for (let i = open; i < line.length; i++) {
    if (line[i] === '(') depth++;
    if (line[i] === ')' && --depth === 0) return i;
  }
  throw new Error(`mini-cpp: unbalanced "${line}"`);
}

export class MiniCpp {
  vars = new Map<string, Value>();
  private statics = new Set<string>();
  private lastIf: boolean | null = null;

  run(lines: string[]): void {
    for (const line of lines) this.exec(line.trim());
  }

  private exec(line: string): void {
    if (!line || line.startsWith('//') || line === '{' || line === '}') return;
    if (line.startsWith('else ')) {
      const take = this.lastIf === false;
      this.lastIf = null;
      if (take) this.exec(line.slice(5).trim());
      return;
    }
    if (line.startsWith('if (')) {
      const close = matchParen(line, 3);
      const ok = Boolean(this.eval(line.slice(4, close)));
      if (ok) this.exec(line.slice(close + 1).trim());
      this.lastIf = ok;
      return;
    }
    this.lastIf = null;
    if (/^gl\w*\(/.test(line)) return; // glViewport, glutPostRedisplay: no state to model
    let m = /^static float (\w+) = (.+);$/.exec(line);
    if (m) {
      if (!this.statics.has(m[1])) {
        this.statics.add(m[1]);
        this.vars.set(m[1], this.eval(m[2]));
      }
      return;
    }
    m = /^float (.+);$/.exec(line);
    if (m) {
      for (const part of m[1].split(',')) {
        const [name, expr] = part.split('=').map((s) => s.trim());
        this.vars.set(name, expr === undefined ? 0 : this.eval(expr));
      }
      return;
    }
    m = /^([\w.]+)\s*(=|\+=|-=|\*=)\s*(.+);$/.exec(line);
    if (m) {
      this.assign(m[1], m[2], this.eval(m[3]));
      return;
    }
    throw new Error(`mini-cpp: unsupported statement "${line}"`);
  }

  private assign(target: string, op: string, value: Value): void {
    const [name, field] = target.split('.');
    if (!field) {
      const next = typeof value === 'object' ? { ...value } : value;
      this.vars.set(name, op === '=' ? next : this.combine(op, this.vars.get(name) as number, value as number));
      return;
    }
    const obj = this.vars.get(name) as Record<string, number | boolean>;
    obj[field] = op === '=' ? (value as number | boolean) : this.combine(op, obj[field] as number, value as number);
  }

  private combine(op: string, a: number, b: number): number {
    if (op === '+=') return a + b;
    if (op === '-=') return a - b;
    return a * b;
  }

  eval(src: string): Value {
    const tokens = tokenize(src);
    let i = 0;
    const peek = () => tokens[i];
    const next = () => tokens[i++];
    const expect = (t: string) => {
      if (next() !== t) throw new Error(`mini-cpp: expected ${t} in "${src}"`);
    };
    const primary = (): Value => {
      const t = next();
      if (t === '(') {
        if ((peek() === 'float' || peek() === 'int') && tokens[i + 1] === ')') {
          i += 2;
          return primary();
        }
        const v = expr(0);
        expect(')');
        return v;
      }
      if (t === '-') return -(primary() as number);
      if (t === '!') return !primary();
      if (/^\d/.test(t)) return parseFloat(t);
      if (t === 'true') return true;
      if (t === 'false') return false;
      if (t === 'sinf' || t === 'cosf') {
        expect('(');
        const v = expr(0) as number;
        expect(')');
        return t === 'sinf' ? Math.sin(v) : Math.cos(v);
      }
      let v = this.vars.get(t);
      if (v === undefined) throw new Error(`mini-cpp: unknown name ${t}`);
      while (peek() === '.') {
        i++;
        v = (v as Record<string, number | boolean>)[next()];
      }
      return v as Value;
    };
    const expr = (min: number): Value => {
      let left = primary();
      for (;;) {
        const op = peek();
        const prec = PREC[op];
        if (prec === undefined || prec < min) return left;
        i++;
        if (op === '?') {
          const a = expr(0);
          expect(':');
          const b = expr(1);
          left = left ? a : b;
          continue;
        }
        const right = expr(prec + 1) as number;
        const l = left as number;
        left = op === '+' ? l + right : op === '-' ? l - right : op === '*' ? l * right : op === '/' ? l / right
          : op === '>=' ? l >= right : op === '<=' ? l <= right : op === '>' ? l > right : op === '<' ? l < right
            : op === '==' ? l === right : op === '!=' ? l !== right : op === '&&' ? Boolean(l && right) : Boolean(l || right);
      }
    };
    const value = expr(0);
    if (i !== tokens.length) throw new Error(`mini-cpp: trailing tokens in "${src}"`);
    return value;
  }
}
