import { tokenizeLine } from '@/shared/ui/code-viewer/tokenize';
import type { CodeMark } from '@/shared/ui/code-viewer/types';
import { matchLines } from './code-diff';

interface Piece {
  text: string;
  start: number;
}

/** The viewer's tokens, with a minus sign kept on the number it negates, so 0.30 → −0.10 is one change. */
function pieces(line: string): Piece[] {
  const tokens = tokenizeLine(line);
  const out: Piece[] = [];
  let pos = 0;
  let previous = '';
  for (let k = 0; k < tokens.length; k++) {
    const token = tokens[k];
    const next = tokens[k + 1];
    if (token.t === '-' && token.k === 'op' && next?.k === 'num' && (previous === '' || /^[,({=]$/.test(previous))) {
      out.push({ text: token.t + next.t, start: pos });
      pos += token.t.length + next.t.length;
      previous = next.t;
      k += 1;
      continue;
    }
    out.push({ text: token.t, start: pos });
    pos += token.t.length;
    if (token.k !== 'ws') previous = token.t;
  }
  return out;
}

function lineMarks(old: string | undefined, line: string, index: number): CodeMark[] {
  const whole = (): CodeMark[] => {
    const start = line.search(/\S/);
    return start < 0 ? [] : [{ line: index, start, end: line.length }];
  };
  if (old === undefined) return whole();
  const before = pieces(old);
  const after = pieces(line);
  if (before.length !== after.length) return whole();
  const marks = after
    .filter((piece, k) => piece.text !== before[k].text)
    .map((piece) => ({ line: index, start: piece.start, end: piece.start + piece.text.length }));
  return marks.length > 0 ? marks : whole();
}

/**
 * What changed between two programs, as ranges in `next`. A changed line is compared with the
 * old line it replaced, token by token, and only the differing tokens are marked; a line with no
 * counterpart (an added object, say) is marked whole.
 */
export function diffChangedValues(prev: string, next: string): CodeMark[] {
  if (prev === next) return [];
  const a = prev.replace(/\r\n/g, '\n').split('\n');
  const b = next.replace(/\r\n/g, '\n').split('\n');
  const marks: CodeMark[] = [];
  let ai = 0;
  let bi = 0;
  for (const [ma, mb] of [...matchLines(a, b), [a.length, b.length] as [number, number]]) {
    for (let k = 0; bi + k < mb; k++) {
      marks.push(...lineMarks(ai + k < ma ? a[ai + k] : undefined, b[bi + k], bi + k));
    }
    ai = ma + 1;
    bi = mb + 1;
  }
  return marks;
}
