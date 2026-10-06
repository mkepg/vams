const NUMBER_PATTERN = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;

/** Parses user-typed numbers: accepts "1,5" and the Unicode minus sign; returns null for anything else. */
export function parseNumberInput(text: string): number | null {
  const normalized = text.trim().replace('−', '-').replace(',', '.');
  if (normalized === '' || !NUMBER_PATTERN.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Decimal places needed to represent a step (0.01 → 2, 0.5 → 1, 1 → 0), capped at 6. */
export function decimalsFor(step: number): number {
  if (!(step > 0)) return 0;
  return Math.min(6, Math.max(0, Math.ceil(-Math.log10(step) - 1e-9)));
}

export function roundToStep(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
