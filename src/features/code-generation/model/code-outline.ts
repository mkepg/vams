/**
 * Reads the generated program's text into blocks and lines, so the code panel can fold, mark and
 * explain it. Pure, and kept in step with generator/*: a format change it does not expect fails
 * the WB-CODE tests instead of breaking silently. The generator itself does not change.
 */

import type { ExplainRequest } from '@/core/store/types';

export type BlockKind =
  | 'includes' | 'struct' | 'state' | 'view' | 'buffer-data' | 'vbo-handles' | 'texture-handles'
  | 'declarations' | 'draw-object' | 'draw' | 'update-buffers' | 'display' | 'window-to-world'
  | 'handler' | 'init' | 'idle' | 'main';

export type LineKind =
  | 'include' | 'struct' | 'state' | 'view' | 'buffer-array' | 'handle' | 'declaration'
  | 'function' | 'branch' | 'assign' | 'call' | 'other';

export interface CodeBlock {
  /** Stable across edits: `main`, `draw:Triangle`, `handler:onKey`. */
  id: string;
  kind: BlockKind;
  /** What a folded block shows: its name only. */
  label: string;
  /** One plain sentence, shown when a folded row is hovered or focused. */
  summary: string;
  /** First and last line, 0-based and inclusive. The last includes the blank lines after the block. */
  start: number;
  end: number;
  /** A function's signature line and its closing brace; null for data blocks. */
  signature: number | null;
  close: number | null;
  /** The object a `draw_<name>()` function draws. */
  object: string | null;
}

export interface OutlineLine {
  text: string;
  /** Id of the block the line is in. */
  block: string;
  /** Code name of the object the line belongs to (`state_<name>`), or null for shared code. */
  object: string | null;
  kind: LineKind;
  explainable: boolean;
}

export interface CodeOutline {
  lines: OutlineLine[];
  blocks: CodeBlock[];
  /** Every object's code name, in the order of the state lines. */
  objects: string[];
}

type DataKind = 'includes' | 'struct' | 'state' | 'view' | 'buffer-data' | 'vbo-handles' | 'texture-handles' | 'declarations';

const DATA_LABELS: Record<DataKind, string> = {
  includes: '#include …',
  struct: 'struct ObjectState …',
  state: 'ObjectState …',
  view: 'View bounds …',
  'buffer-data': 'Buffer data …',
  'vbo-handles': 'VBO handles …',
  'texture-handles': 'Texture handles …',
  declarations: 'Declarations …',
};

const SUMMARIES: Record<Exclude<BlockKind, 'draw-object' | 'handler'>, string> = {
  includes: 'Loads OpenGL, GLUT and GLEW so the program can call them.',
  struct: 'Describes what every object keeps: its position, rotation and scale.',
  state: 'One line per object with its starting position, rotation and scale.',
  view: 'The viewing volume’s edges, kept in variables so the reshape callback can change them.',
  'buffer-data': 'Each object’s vertices, colours and indices as C arrays.',
  'vbo-handles': 'Names for the GPU buffers that init() creates.',
  'texture-handles': 'Names for the textures that init() loads.',
  declarations: 'Tells the compiler about functions defined further down.',
  draw: 'Calls each object’s draw function.',
  'update-buffers': 'Runs every frame to refresh the buffers that change.',
  display: 'Clears the window, sets up the view, draws the scene and shows the frame.',
  'window-to-world': 'Turns a mouse position in pixels into scene coordinates.',
  init: 'One-time setup before the main loop: uploads buffers and loads textures.',
  idle: 'Runs every frame: updates buffers, then calls your idle handler.',
  main: 'Opens the window, registers the callbacks and starts GLUT.',
};

/** Handler comments read `// <Label> callback: glut<Name>Func` (generator/handlers.ts). */
const HANDLER_SUMMARIES: Record<string, string> = {
  Keyboard: 'GLUT calls it when a key is pressed.',
  'Special keys': 'GLUT calls it when an arrow key is pressed.',
  Mouse: 'GLUT calls it when a mouse button goes down or up.',
  Motion: 'GLUT calls it when the mouse moves with a button held.',
  Reshape: 'GLUT calls it when the window changes size.',
  Idle: 'GLUT calls it whenever nothing else is happening, about once a frame.',
};

const SECTION_HEADERS: Array<[string, DataKind]> = [
  ['// --- View', 'view'],
  ['// --- Buffer Data ---', 'buffer-data'],
  ['// --- VBO Handles ---', 'vbo-handles'],
  ['// --- Texture Handles ---', 'texture-handles'],
];

const OWNER_REF = /\b(?:state|initial|verts|colors|uvs|indices|vbo|cbo|ebo|uvbo|tex)_(\w+)/;
const STATE_REF = /\bstate_(\w+)\./;
const SETUP_HEADER = /^ {4}\/\/ .+ — /;
const DECLARATION = /^void \w+\(\);$/;
const STATE_LINE = /^(const )?ObjectState /;

function functionKind(name: string): BlockKind {
  if (name.startsWith('draw_')) return 'draw-object';
  switch (name) {
    case 'draw': return 'draw';
    case 'update_buffers': return 'update-buffers';
    case 'display': return 'display';
    case 'windowToWorld': return 'window-to-world';
    case 'init': return 'init';
    case '_vams_idle': return 'idle';
    case 'main': return 'main';
    default: return 'handler';
  }
}

function dataBlock(kind: DataKind, start: number, end: number): CodeBlock {
  return { id: kind, kind, label: DATA_LABELS[kind], summary: SUMMARIES[kind], start, end, signature: null, close: null, object: null };
}

function functionBlock(text: string[], ret: string, name: string, start: number, signature: number, close: number): CodeBlock {
  const kind = functionKind(name);
  const object = kind === 'draw-object' ? name.slice('draw_'.length) : null;
  const id = kind === 'draw-object' ? `draw:${object}` : kind === 'handler' ? `handler:${name}` : kind;
  let summary: string;
  if (kind === 'draw-object') summary = `Draws ${object}: moves it into place, then sends its vertices.`;
  else if (kind === 'handler') {
    const label = /^\/\/ (.+) callback:/.exec(signature > start ? text[start] : '')?.[1] ?? '';
    summary = HANDLER_SUMMARIES[label] ?? 'GLUT calls it when its event happens.';
  } else summary = SUMMARIES[kind as Exclude<BlockKind, 'draw-object' | 'handler'>];
  return { id, kind, label: `${ret} ${name}()`, summary, start, end: close, signature, close, object };
}

/** The last line of the run starting at `from` whose lines all pass `test`. */
function runEnd(text: string[], from: number, test: (line: string) => boolean): number {
  let k = from;
  while (k + 1 < text.length && test(text[k + 1])) k += 1;
  return k;
}

/** The first line from `from` that passes `test`, or the last line. */
function firstFrom(text: string[], from: number, test: (line: string) => boolean): number {
  let k = from;
  while (k < text.length - 1 && !test(text[k])) k += 1;
  return k;
}

function splitBlocks(text: string[]): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  let i = 0;
  const stateHeader = text.indexOf('// --- Global State ---');
  if (stateHeader > 0) {
    blocks.push(dataBlock('includes', 0, stateHeader - 1));
    i = stateHeader;
  }
  while (i < text.length) {
    const line = text[i];
    const last = blocks[blocks.length - 1];
    // Blank lines belong to the block before them.
    if (line === '' && last) {
      last.end = i;
      i += 1;
      continue;
    }
    let block: CodeBlock | null = null;
    const header = SECTION_HEADERS.find(([prefix]) => line.startsWith(prefix));
    if (line === '// --- Global State ---') {
      block = dataBlock('struct', i, firstFrom(text, i, (l) => l === '};'));
    } else if (STATE_LINE.test(line)) {
      block = dataBlock('state', i, runEnd(text, i, (l) => STATE_LINE.test(l)));
    } else if (header) {
      block = dataBlock(header[1], i, runEnd(text, i, (l) => l !== ''));
    } else if (DECLARATION.test(line)) {
      block = dataBlock('declarations', i, runEnd(text, i, (l) => DECLARATION.test(l)));
    } else {
      let signature = i;
      while (signature < text.length && text[signature].startsWith('//')) signature += 1;
      const m = signature < text.length ? /^(void|int) (\w+)\(/.exec(text[signature]) : null;
      if (m) block = functionBlock(text, m[1], m[2], i, signature, firstFrom(text, signature, (l) => l === '}'));
    }
    if (block) {
      blocks.push(block);
      i = block.end + 1;
      continue;
    }
    // A line the parser does not know joins the block before it.
    if (last) last.end = i;
    else blocks.push(dataBlock('includes', 0, i));
    i += 1;
  }
  return blocks;
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/** The object each line of a block belongs to. */
function owners(block: CodeBlock, text: string[]): (string | null)[] {
  const out: (string | null)[] = new Array(block.end - block.start + 1).fill(null);
  const set = (line: number, owner: string | null) => { out[line - block.start] = owner; };
  switch (block.kind) {
    case 'state':
    case 'buffer-data':
    case 'vbo-handles':
    case 'texture-handles':
      for (let l = block.start; l <= block.end; l++) set(l, OWNER_REF.exec(text[l])?.[1] ?? null);
      break;
    case 'draw-object':
      for (let l = block.start; l <= block.end; l++) set(l, block.object);
      break;
    case 'draw': {
      // Groups and text are drawn inline, between `// <name>` and glPopMatrix, or inside `if (state_X.visible) { … }`.
      // Ranges nest: the scan carries on inside each one, so a line belongs to the innermost object around it.
      for (let l = block.signature! + 2; l < block.close!; l++) {
        const trimmed = text[l].trim();
        const guarded = /^if \(state_(\w+)\.visible\) \{$/.exec(trimmed);
        const opens = trimmed.startsWith('// ') && text[l + 1]?.trim() === 'glPushMatrix();';
        if (!guarded && !opens) continue;
        const indent = indentOf(text[l]);
        const last = guarded
          ? firstFrom(text, l + 1, (t) => t === `${' '.repeat(indent)}}`)
          : firstFrom(text, l + 1, (t) => t.trim() === 'glPopMatrix();' && indentOf(t) === indent);
        let owner = guarded ? guarded[1] : null;
        for (let k = l; k <= last && !owner; k++) owner = STATE_REF.exec(text[k])?.[1] ?? null;
        for (let k = l; k <= last; k++) set(k, owner);
      }
      break;
    }
    case 'init':
    case 'update-buffers': {
      // Each object's setup starts with `    // <name> — …` and runs to a blank line or the next one.
      for (let l = block.signature! + 2; l < block.close!; l++) {
        if (!SETUP_HEADER.test(text[l])) continue;
        let last = l;
        while (last + 1 < block.close! && text[last + 1] !== '' && !SETUP_HEADER.test(text[last + 1])) last += 1;
        let owner: string | null = null;
        for (let k = l + 1; k <= last && !owner; k++) owner = OWNER_REF.exec(text[k])?.[1] ?? null;
        for (let k = l; k <= last; k++) set(k, owner);
        l = last;
      }
      break;
    }
    default:
      break;
  }
  return out;
}

const OWN_CALL = /^(?:if \(state_\w+\.visible\) )?[A-Za-z_]\w*\([^;]*\);$/;

function lineKind(raw: string): LineKind {
  const t = raw.trim();
  if (t === '' || t.startsWith('//') || /^[{}]+;?$/.test(t)) return 'other';
  if (t.startsWith('#')) return 'include';
  if (t.startsWith('struct ObjectState')) return 'struct';
  if (/^(const )?ObjectState \w+ = /.test(t)) return 'state';
  if (t.startsWith('float viewMinX')) return 'view';
  if (/^GL(float|uint) (verts|colors|uvs|indices)_\w+\[\] = /.test(t)) return 'buffer-array';
  if (/^GLuint (vbo|cbo|ebo|uvbo|tex)_\w+ = 0;$/.test(t)) return 'handle';
  if (DECLARATION.test(t)) return 'declaration';
  if (/^(void|int) \w+\(.*\)$/.test(t)) return 'function';
  if (/^case .+:$/.test(t) || t.startsWith('if (button == ')) return 'branch';
  if (/^state_\w+(\.\w+)? [+*]?= /.test(t) || t.startsWith('glewExperimental')) return 'assign';
  if (/\b(gl[A-Z]\w*|glut[A-Z]\w*|glew[A-Z]\w*|stbi_\w+)\s*\(/.test(t)) return 'call';
  if (OWN_CALL.test(t) && !t.startsWith('return')) return 'call';
  return 'other';
}

export function outlineCode(code: string): CodeOutline {
  const text = code.replace(/\r\n/g, '\n').split('\n');
  const blocks = splitBlocks(text);
  const lines: OutlineLine[] = [];
  for (const block of blocks) {
    const owned = owners(block, text);
    for (let l = block.start; l <= block.end; l++) {
      const kind = lineKind(text[l]);
      lines.push({ text: text[l], block: block.id, object: owned[l - block.start], kind, explainable: kind !== 'other' });
    }
  }
  const objects = lines
    .filter((l) => l.kind === 'state' && l.text.startsWith('ObjectState '))
    .map((l) => l.object)
    .filter((o): o is string => o !== null);
  return { lines, blocks, objects };
}

/**
 * The line that makes a call: the owner's (the request's, else `object`), narrowed by the request's
 * block, contained text and nth vertex call. A narrowing that matches nothing falls back to the
 * owner's first call, then to the first call in the program.
 */
export function findCallLine(outline: CodeOutline, object: string | null, target: ExplainRequest | string): number | null {
  const t = typeof target === 'string' ? { call: target } : target;
  const owner = t.owner ?? object;
  // A constant has no `(` after it, so it matches as a whole word.
  const constant = /^GLU?T?_[A-Z0-9_]+$/.test(t.call) ? new RegExp(`\\b${t.call}\\b`) : null;
  const calls = (l: OutlineLine) => (constant ? constant.test(l.text) : l.text.includes(`${t.call}(`));
  const narrowed = (l: OutlineLine) => calls(l) && (!t.contains || l.text.includes(t.contains)) && (!t.block || l.block === t.block);
  if (owner !== null) {
    if (t.nth !== undefined) {
      const at = nthBetweenBeginEnd(outline, owner, calls, t.nth);
      if (at !== null) return at;
    }
    const own = outline.lines.findIndex((l) => l.object === owner && narrowed(l));
    if (own >= 0) return own;
    const first = outline.lines.findIndex((l) => l.object === owner && calls(l));
    if (first >= 0) return first;
  }
  const any = outline.lines.findIndex(narrowed);
  if (any >= 0) return any;
  const fallback = outline.lines.findIndex(calls);
  return fallback >= 0 ? fallback : null;
}

/** The nth matching line between the owner's glBegin and glEnd, where immediate mode makes one call per vertex. */
function nthBetweenBeginEnd(outline: CodeOutline, owner: string, calls: (l: OutlineLine) => boolean, nth: number): number | null {
  let inside = false;
  let seen = 0;
  for (let i = 0; i < outline.lines.length; i++) {
    const l = outline.lines[i];
    if (l.object !== owner) continue;
    const text = l.text.trim();
    if (text.startsWith('glBegin(')) inside = true;
    else if (text.startsWith('glEnd(')) inside = false;
    else if (inside && calls(l) && seen++ === nth) return i;
  }
  return null;
}

/** The ObjectState fields in initialiser order (generator/state.ts). */
const STATE_FIELDS = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'r', 'g', 'b', 'useColor', 'visible'];

export function stateFieldAt(text: string, column: number): string | null {
  const m = /^(?:const )?ObjectState (?:state|initial)_(\w+) = \{/.exec(text);
  if (!m) return null;
  const open = text.indexOf('{');
  if (column <= open) return null;
  const before = text.slice(open + 1, column);
  const field = STATE_FIELDS[(before.match(/,/g) ?? []).length];
  return field ? `state_${m[1]}.${field}` : null;
}
