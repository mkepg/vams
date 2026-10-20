const NUMBER_TEXT = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?[fF]?$/;

/** Splits a code line at its `{n}` blanks: text stays a string, a blank becomes its number. */
export function templateParts(template: string): (string | number)[] {
  const parts: (string | number)[] = [];
  let last = 0;
  for (const m of template.matchAll(/\{(\d+)\}/g)) {
    if (m.index > last) parts.push(template.slice(last, m.index));
    parts.push(Number(m[1]));
    last = m.index + m[0].length;
  }
  if (last < template.length) parts.push(template.slice(last));
  return parts;
}

/** A number answer takes numeric text within tolerance; a name answer takes the same text. */
export function checkBlank(
  typed: string,
  answer: number | string,
  tolerance = 0.01,
): 'empty' | 'right' | 'wrong' {
  const text = typed.trim();
  if (text === '') return 'empty';
  if (typeof answer === 'string') return text === answer ? 'right' : 'wrong';
  if (!NUMBER_TEXT.test(text)) return 'wrong';
  const value = parseFloat(text.replace(/[fF]$/, ''));
  return Math.abs(value - answer) <= tolerance ? 'right' : 'wrong';
}

/** The text Skip puts in a number blank: four places, no trailing zeros. */
export function formatBlankNumber(n: number): string {
  return n.toFixed(4).replace(/\.?0+$/, '');
}
