const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** The colour if it is a six-digit hex colour such as #1a2b3c; otherwise the fallback. */
export function toHexColor(value: unknown, fallback = '#000000'): string {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value : fallback;
}
