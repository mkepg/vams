/** One row of the code panel: a real line, a folded block, or the hidden rest of a partly open block. */
export type CodeRow =
  | { kind: 'line'; line: number; closes?: { block: string; label: string } }
  | { kind: 'fold'; block: string; label: string; summary: string; start: number; end: number }
  | { kind: 'more'; block: string; label: string; start: number; end: number };
