/**
 * The browser's keys and buttons as FreeGLUT on Windows gives them to a program: characters to the
 * keyboard callback, the arrows, function and navigation keys to the special callback with their
 * GLUT_KEY_* codes, and glutGetModifiers' Shift, Ctrl and Alt bits.
 */

/** GLUT_KEY_* codes, FreeGLUT's Shift, Ctrl and Alt keys included. */
export const GLUT_KEY = {
  LEFT: 100,
  UP: 101,
  RIGHT: 102,
  DOWN: 103,
  PAGE_UP: 104,
  PAGE_DOWN: 105,
  HOME: 106,
  END: 107,
  INSERT: 108,
  SHIFT_L: 112,
  SHIFT_R: 113,
  CTRL_L: 114,
  CTRL_R: 115,
  ALT_L: 116,
  ALT_R: 117,
} as const;

/** GLUT_ACTIVE_SHIFT, GLUT_ACTIVE_CTRL and GLUT_ACTIVE_ALT. */
export const GLUT_ACTIVE = { SHIFT: 1, CTRL: 2, ALT: 4 } as const;

/** GLUT_DOWN and GLUT_UP. */
export const GLUT_STATE = { DOWN: 0, UP: 1 } as const;

const SPECIAL_BY_KEY: Record<string, number> = {
  ArrowLeft: GLUT_KEY.LEFT,
  ArrowUp: GLUT_KEY.UP,
  ArrowRight: GLUT_KEY.RIGHT,
  ArrowDown: GLUT_KEY.DOWN,
  PageUp: GLUT_KEY.PAGE_UP,
  PageDown: GLUT_KEY.PAGE_DOWN,
  Home: GLUT_KEY.HOME,
  End: GLUT_KEY.END,
  Insert: GLUT_KEY.INSERT,
};
for (let n = 1; n <= 12; n++) SPECIAL_BY_KEY[`F${n}`] = n;

const SPECIAL_BY_CODE: Record<string, number> = {
  ShiftLeft: GLUT_KEY.SHIFT_L,
  ShiftRight: GLUT_KEY.SHIFT_R,
  ControlLeft: GLUT_KEY.CTRL_L,
  ControlRight: GLUT_KEY.CTRL_R,
  AltLeft: GLUT_KEY.ALT_L,
  AltRight: GLUT_KEY.ALT_R,
};

/** Keys that reach the keyboard callback as a control character, as on Windows. */
const CHARACTER_BY_KEY: Record<string, number> = { Enter: 13, Backspace: 8, Escape: 27, Delete: 127 };

export type GlutKey = { kind: 'key' | 'special'; key: number };

interface KeyLike {
  key: string;
  code: string;
  ctrlKey: boolean;
}

/**
 * The GLUT key for a browser key, or null for one GLUT has no code for. Tab is left to the page,
 * so the keyboard can always move focus out of the program window.
 */
export function glutKey(e: KeyLike): GlutKey | null {
  const special = SPECIAL_BY_CODE[e.code] ?? SPECIAL_BY_KEY[e.key];
  if (special !== undefined) return { kind: 'special', key: special };
  const named = CHARACTER_BY_KEY[e.key];
  if (named !== undefined) return { kind: 'key', key: named };
  const code = e.key.codePointAt(0);
  if (code === undefined || e.key.length !== String.fromCodePoint(code).length || code > 0xff) return null;
  // Ctrl with a letter types its control character: Ctrl+A is 1.
  if (e.ctrlKey && /^[a-z]$/i.test(e.key)) return { kind: 'key', key: code & 0x1f };
  return { kind: 'key', key: code };
}

export function glutModifiers(e: { shiftKey: boolean; ctrlKey: boolean; altKey: boolean }): number {
  return (e.shiftKey ? GLUT_ACTIVE.SHIFT : 0) | (e.ctrlKey ? GLUT_ACTIVE.CTRL : 0) | (e.altKey ? GLUT_ACTIVE.ALT : 0);
}

/** GLUT_LEFT_BUTTON 0, GLUT_MIDDLE_BUTTON 1 and GLUT_RIGHT_BUTTON 2, from a pointer's button; null for others. */
export function glutButton(button: number): number | null {
  return button === 0 || button === 1 || button === 2 ? button : null;
}
