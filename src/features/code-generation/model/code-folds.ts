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
 * blocks the student opened by hand, and `forced` lines that must show: a lesson's highlighted
 * lines, changed values, Find's current match, Run's fired branch and the explained line.
 */
export function visibleRows(
  outline: CodeOutline,
  selection: string | null,
  opened: readonly string[],
  forced: readonly number[],
): CodeRow[] {
  const rows: CodeRow[] = [];
  const forcedLines = new Set(forced);
  const openKinds = selection === null ? OPEN_FOR_NOTHING : OPEN_FOR_SELECTION;
  for (const block of outline.blocks) {
    const all = range(block.start, block.end);
    if (opened.includes(block.id)) {
      all.forEach((line, k) => rows.push(k === 0 ? { kind: 'line', line, closes: { block: block.id, label: block.label } } : { kind: 'line', line }));
      continue;
    }
    if (all.some((line) => forcedLines.has(line))) {
      all.forEach((line) => rows.push({ kind: 'line', line }));
      continue;
    }
    const shown = openKinds.has(block.kind)
      ? all.filter((line) => {
          const owner = outline.lines[line].object;
          return owner !== null && (selection === null || owner === selection);
        })
      : [];
    if (shown.length === 0) {
      rows.push({ kind: 'fold', block: block.id, label: block.label, summary: block.summary, start: block.start, end: block.end });
      continue;
    }
    const visible = new Set([...shown, ...frameLines(block, outline)]);
    for (let k = 0; k < all.length; ) {
      if (visible.has(all[k])) {
        rows.push({ kind: 'line', line: all[k] });
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
