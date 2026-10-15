/**
 * Line-level diff utilities for the generated OpenGL code.
 *
 * Used by the lesson engine to figure out which lines changed between two
 * consecutive demo steps so the code panel can highlight and scroll to them.
 *
 * The algorithm is a textbook LCS with common prefix/suffix trimming — good
 * enough for the structurally similar code the generator produces, and
 * predictable per-line (no surprise "everything shifted" false positives).
 */

/**
 * The pairs of lines `a` and `b` share, by longest common subsequence after trimming the common
 * prefix and suffix. Ascending in both. The backtrack's tie-break is the one diffChangedLines has
 * always used, so its results do not change.
 */
export function matchLines(a: readonly string[], b: readonly string[]): Array<[number, number]> {
  let prefixLen = 0;
  const minLen = Math.min(a.length, b.length);
  while (prefixLen < minLen && a[prefixLen] === b[prefixLen]) prefixLen++;
  let suffixLen = 0;
  while (
    suffixLen < a.length - prefixLen &&
    suffixLen < b.length - prefixLen &&
    a[a.length - 1 - suffixLen] === b[b.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }
  const aMid = a.slice(prefixLen, a.length - suffixLen);
  const bMid = b.slice(prefixLen, b.length - suffixLen);
  const m = aMid.length;
  const n = bMid.length;
  const lcs: number[][] = [];
  for (let i = 0; i <= m; i++) lcs.push(new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (aMid[i - 1] === bMid[j - 1]) lcs[i][j] = lcs[i - 1][j - 1] + 1;
      else lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
    }
  }
  const middle: Array<[number, number]> = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (aMid[i - 1] === bMid[j - 1]) {
      middle.push([prefixLen + i - 1, prefixLen + j - 1]);
      i--;
      j--;
    } else if (lcs[i - 1][j] > lcs[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  const pairs: Array<[number, number]> = [];
  for (let k = 0; k < prefixLen; k++) pairs.push([k, k]);
  pairs.push(...middle.reverse());
  for (let k = 0; k < suffixLen; k++) pairs.push([a.length - suffixLen + k, b.length - suffixLen + k]);
  return pairs;
}

/**
 * Returns the 0-indexed line numbers in `next` that are NOT part of the
 * longest common subsequence shared with `prev`. Loosely: lines that were
 * added or modified.
 *
 * Returns `[]` when the inputs are identical (the most common case for
 * narrative steps that don't mutate scene state).
 */
export function diffChangedLines(prev: string, next: string): number[] {
  if (prev === next) return [];
  const a = prev.split('\n');
  const b = next.split('\n');
  const matched = new Set(matchLines(a, b).map(([, j]) => j));
  return b.map((_, j) => j).filter((j) => !matched.has(j));
}

/**
 * Returns the 0-indexed line numbers in `next` whose content contains any of
 * the given substring matchers. Whitespace-only lines are skipped so a
 * generic match like `glColor` doesn't pull in incidental blank lines.
 */
export function findLinesByMatch(next: string, matchers: string[]): number[] {
  if (matchers.length === 0) return [];
  const lines = next.split('\n');
  const out: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().length === 0) continue;
    for (const m of matchers) {
      if (line.includes(m)) {
        out.push(i);
        break;
      }
    }
  }
  return out;
}

/** Author-facing override for a step's change-highlight resolution. */
export type CodeChangeFocus =
  | 'auto'
  | 'none'
  | number[]
  | string[];

/**
 * Resolves the final list of "changed" line numbers given the pre/post
 * generated code and an optional author override.
 *
 *   undefined | 'auto'  → auto-diff
 *   'none'              → empty result (suppresses the highlight)
 *   number[]            → returned as-is, deduplicated and sorted ascending
 *   string[]            → substring matching against `next`
 */
export function resolveChangedLines(
  prev: string,
  next: string,
  override?: CodeChangeFocus
): number[] {
  if (override === 'none') return [];
  if (Array.isArray(override)) {
    if (override.length === 0) return [];
    if (typeof override[0] === 'number') {
      return Array.from(new Set(override as number[])).sort((a, b) => a - b);
    }
    return findLinesByMatch(next, override as string[]);
  }
  return diffChangedLines(prev, next);
}
