/** Numbers as students read them: a true minus sign (U+2212), and never "−0.00". */

const minus = (s: string) => s.replace('-', '−');
const zeroed = (n: number) => (Math.abs(n) < 0.005 ? 0 : n);

/** Two decimals with a true minus sign, and no "−0.00". */
export function fmt(n: number): string {
  return minus(zeroed(n).toFixed(2));
}

/** As few decimals as the number needs, up to two: 1, 1.6, 0.85. */
export function short(n: number): string {
  return minus(String(Number(zeroed(n).toFixed(2))));
}

/** A whole number with a true minus sign, such as a pixel left of the window: −12. */
export function int(n: number): string {
  return minus(String(Math.round(n) || 0));
}

/** Bare when it rounds to a whole number at two decimals (0, 1, −1), else as fmt: 0.40. */
export function whole(n: number): string {
  const rounded = Number(n.toFixed(2));
  return Number.isInteger(rounded) ? minus(String(rounded || 0)) : fmt(n);
}
