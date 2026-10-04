/**
 * Stage mode decisions as pure functions: which key does what, where the talk starts,
 * and when a key belongs to the focused element instead of the presenter.
 */
export type StageAction =
  | 'next'
  | 'prev'
  | 'first'
  | 'last'
  | 'exit'
  | 'enter-app'
  | 'theme'
  | 'fullscreen'
  | 'enter-stage';

export type FocusKind = 'text' | 'vertex' | 'interactive' | 'none';

export interface KeyInput {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

export interface KeyContext {
  /** Stage mode is on. */
  active: boolean;
  /** The current slide is the last one. */
  atLast: boolean;
  focus: FocusKind;
}

const ARROWS = new Set(['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']);

export function keyToAction(input: KeyInput, context: KeyContext): StageAction | null {
  if (input.ctrlKey || input.altKey || input.metaKey) return null;
  if (context.focus === 'text') return null;
  const { key } = input;

  if (!context.active) return key === 'p' || key === 'P' ? 'enter-stage' : null;

  // A focused vertex handle uses the arrows to move itself; clickers send PageUp/PageDown.
  if (context.focus === 'vertex' && ARROWS.has(key)) return null;

  let forward: boolean;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
    case 'PageDown':
      forward = true;
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'PageUp':
      forward = false;
      break;
    case ' ':
      // Space activates a focused link or button; leave that to the browser.
      if (context.focus === 'interactive') return null;
      forward = !input.shiftKey;
      break;
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    case 'Escape':
      return 'exit';
    case 't':
    case 'T':
      return 'theme';
    case 'f':
    case 'F':
      return 'fullscreen';
    case 'Enter':
      return context.atLast && context.focus === 'none' ? 'enter-app' : null;
    default:
      return null;
  }
  if (!forward) return 'prev';
  return context.atLast ? 'enter-app' : 'next';
}

export function clampIndex(index: number, count: number): number {
  return Math.min(count - 1, Math.max(0, index));
}

export function nextIndex(current: number, count: number): number {
  return clampIndex(current + 1, count);
}

export function prevIndex(current: number): number {
  return Math.max(0, current - 1);
}

export function readStageFromUrl(search: string, hash: string, sectionIds: readonly string[]) {
  const active = new URLSearchParams(search).has('stage');
  const found = sectionIds.indexOf(hash.replace(/^#/, ''));
  return { active, index: found >= 0 ? found : 0 };
}

export function focusKind(el: Element | null): FocusKind {
  if (!el) return 'none';
  if (el.matches('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return 'text';
  if (el.closest('[data-vertex-handle]')) return 'vertex';
  if (el.matches('a[href], button, [role="button"], summary')) return 'interactive';
  return 'none';
}
