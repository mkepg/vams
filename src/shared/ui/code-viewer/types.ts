/** One row of the code panel: a real line, a folded block, or the hidden rest of a partly open block. */
export type CodeRow =
  | { kind: 'line'; line: number; closes?: { block: string; label: string } }
  | { kind: 'fold'; block: string; label: string; summary: string; start: number; end: number }
  | { kind: 'more'; block: string; label: string; start: number; end: number };

/** A note under a code line: plain words, and values that are amber when they just changed. */
export type CodeNote = Array<{ text: string; changed?: boolean }>;

/** The explanation strip under the code. */
export interface CodeStrip {
  signature: string;
  text: string;
  values: Array<{ arg: string; source: string; value: string; control: string | null }>;
  links: Array<{ label: string; onSelect: () => void }>;
}

/** A marked range in one line: the value that just changed, or a Find match. `end` is exclusive. */
export interface CodeMark {
  line: number;
  start: number;
  end: number;
}
