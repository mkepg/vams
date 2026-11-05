import type { Text } from '@codemirror/state';
import type { Diagnostic as LintDiagnostic } from '@codemirror/lint';
import type { Diagnostic } from '@/shared/lib/lab-diagnostic';

export type { Diagnostic };

/** The file name and what the compiler found: errors first, then warnings. Notes are not counted. */
export function statusLine(diagnostics: readonly Diagnostic[]): string {
  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length;
  const parts: string[] = [];
  if (errors) parts.push(`${errors} ${errors === 1 ? 'error' : 'errors'}`);
  if (warnings) parts.push(`${warnings} ${warnings === 1 ? 'warning' : 'warnings'}`);
  return parts.length ? `main.cpp · ${parts.join(', ')}` : 'main.cpp';
}

/** The document offset of a 1-based line and column, kept inside the text. */
export function positionOf(doc: Text, line: number, col: number): number {
  const at = doc.line(Math.min(Math.max(1, Math.trunc(line) || 1), doc.lines));
  return at.from + Math.min(Math.max(0, Math.trunc(col) - 1 || 0), at.length);
}

/** The editor's marks for the diagnostics: from the column to the end of the word there, or to the end of the line. */
export function toLintDiagnostics(doc: Text, diagnostics: readonly Diagnostic[]): LintDiagnostic[] {
  return diagnostics.map((d) => {
    const from = positionOf(doc, d.line, d.col);
    const line = doc.lineAt(from);
    const word = /^[\w]+/.exec(doc.sliceString(from, line.to));
    const to = Math.max(from + 1, word ? from + word[0].length : from + 1);
    return {
      from,
      to: Math.min(to, Math.max(line.to, from)),
      severity: d.severity === 'note' ? 'info' : d.severity,
      message: d.message,
    };
  });
}

/** The 1-based lines that carry an error. */
export function errorLines(diagnostics: readonly Diagnostic[]): number[] {
  return [...new Set(diagnostics.filter((d) => d.severity === 'error').map((d) => d.line))];
}
