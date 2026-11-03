import { tokenizeLine } from '@/shared/ui/code-viewer/tokenize';

/**
 * The GL and GLUT call names in one line, by the tokenizer's rule. A comment is one token, so the
 * names in its words are never marked.
 */
export function glNameRanges(line: string): Array<{ from: number; to: number }> {
  const out: Array<{ from: number; to: number }> = [];
  let pos = 0;
  for (const token of tokenizeLine(line)) {
    if (token.k === 'glfn') out.push({ from: pos, to: pos + token.t.length });
    pos += token.t.length;
  }
  return out;
}
