import type { CodeRow } from '@/shared/ui/code-viewer/types';
import type { BlockKind, CodeBlock, CodeOutline } from './code-outline';

/** Blocks that open for the selected object's lines. */
const OPEN_FOR_SELECTION: ReadonlySet<BlockKind> = new Set(['state', 'buffer-data', 'draw-object', 'draw', 'init']);
/** With nothing selected, every object's code opens and only the boilerplate folds. */
const OPEN_FOR_NOTHING: ReadonlySet<BlockKind> = new Set(['state', 'buffer-data', 'draw-object', 'draw']);

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** The lines a partly open block keeps around the object's lines, so it still reads as code. */
function frameLines(block: CodeBlock, outline: CodeOutline): number[] {
  if (block.signature !== null && block.close !== null) {
    return [...range(block.start, block.signature + 1), ...range(block.close, block.end)];
  }
  const blanks: number[] = [];
  for (let l = block.end; l >= block.start && outline.lines[l].text === ''; l--) blanks.push(l);
  return blanks;
}

function moreLabel(hidden: number[], outline: CodeOutline): string {
  const others = new Set(hidden.map((l) => outline.lines[l].object).filter((o): o is string => o !== null));
  if (others.size > 0) return `${others.size} more object${others.size === 1 ? '' : 's'}`;
  return `${hidden.length} more line${hidden.length === 1 ? '' : 's'}`;
}

/**
 * The rows the code panel shows. `selection` is the selected object's code name, `opened` the
 * blocks the student opened by hand, `closed` the blocks they folded by hand, and `forced` lines that must show: a lesson's highlighted
 * lines, changed values, Find's current match, Run's fired branch and the explained line.
 *
 * - A block opened by hand shows every line.
 * - A block folded by hand shows only the forced lines, even when the selection owns it.
 * - Otherwise a block shows the selected object's lines (every object's with no selection) and the
 *   forced lines. A forced line opens only itself, never its whole block.
 * - A partly open block keeps its frame: a function keeps its comment, signature, braces and the
 *   blank lines after it; a data block keeps its trailing blank lines.
 * - Every other run of hidden lines is one `more` row.
 * - A block with nothing to show is one fold row.
 */
export function visibleRows(
  outline: CodeOutline,
  selection: string | null,
  opened: readonly string[],
  forced: readonly number[],
  closed: readonly string[] = [],
): CodeRow[] {
  const rows: CodeRow[] = [];
  const forcedLines = new Set(forced);
  const openKinds = selection === null ? OPEN_FOR_NOTHING : OPEN_FOR_SELECTION;
  for (const block of outline.blocks) {
    const all = range(block.start, block.end);
    // The first line of an open block carries the toggle that folds it again.
    let toggled = false;
    const lineRow = (line: number): CodeRow => {
      if (toggled || closed.includes(block.id)) return { kind: 'line', line };
      toggled = true;
      return { kind: 'line', line, closes: { block: block.id, label: block.label } };
    };
    if (opened.includes(block.id)) {
      all.forEach((line) => rows.push(lineRow(line)));
      continue;
    }
    // A forced line shows as if the selection owned it; the rest of its block stays folded.
    const shown = all.filter((line) => {
      if (forcedLines.has(line)) return true;
      const owner = outline.lines[line].object;
      return !closed.includes(block.id) && openKinds.has(block.kind) && owner !== null && (selection === null || owner === selection);
    });
    if (shown.length === 0) {
      rows.push({ kind: 'fold', block: block.id, label: block.label, summary: block.summary, start: block.start, end: block.end });
      continue;
    }
    const visible = new Set([...shown, ...frameLines(block, outline)]);
    for (let k = 0; k < all.length; ) {
      if (visible.has(all[k])) {
        rows.push(lineRow(all[k]));
        k += 1;
        continue;
      }
      let e = k;
      while (e + 1 < all.length && !visible.has(all[e + 1])) e += 1;
      const hidden = all.slice(k, e + 1);
      rows.push({ kind: 'more', block: block.id, label: moreLabel(hidden, outline), start: hidden[0], end: hidden[hidden.length - 1] });
      k = e + 1;
    }
  }
  return rows;
}
