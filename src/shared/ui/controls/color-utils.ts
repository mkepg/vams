export type ColorGlCall = 'glColor3f' | 'glColor3ub' | 'glClearColor';

/** Accepts `abc`, `#abc`, `aabbcc` or `#AABBCC`; returns lowercase `#rrggbb`, or null. */
export function normalizeHex(input: string): string | null {
  const text = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(text)) {
    return `#${text.split('').map((c) => c + c).join('')}`.toLowerCase();
  }
  if (/^[0-9a-f]{6}$/i.test(text)) return `#${text}`.toLowerCase();
  return null;
}

export function hexToBytes(hex: string): [number, number, number] {
  const normalized = normalizeHex(hex) ?? '#000000';
  return [
    parseInt(normalized.slice(1, 3), 16),
    parseInt(normalized.slice(3, 5), 16),
    parseInt(normalized.slice(5, 7), 16),
  ];
}

/** The arguments GL receives for this colour, e.g. `0.73, 0.11, 0.11`. */
export function glColorArgs(hex: string, call: ColorGlCall): string {
  const [r, g, b] = hexToBytes(hex);
  if (call === 'glColor3ub') return `${r}, ${g}, ${b}`;
  const f = (byte: number) => (byte / 255).toFixed(2);
  if (call === 'glClearColor') return `${f(r)}, ${f(g)}, ${f(b)}, 1.0`;
  return `${f(r)}, ${f(g)}, ${f(b)}`;
}

export function glColorReadout(hex: string, call: ColorGlCall): string {
  return `${call}(${glColorArgs(hex, call)})`;
}
