import type { ShortcutGroup } from './types';

/**
 * Canonical list of keyboard shortcuts, rendered by the "Keyboard Shortcuts"
 * help topic. This documents the behavior currently implemented in
 * [useKeyboardShortcuts](src/shared/hooks/useKeyboardShortcuts.ts) and
 * [useCanvasInteraction](src/features/scene-interaction/model/useCanvasInteraction.ts).
 *
 * Keep this in sync when shortcuts change. (See UX-IMPROVEMENT-PLAN item #1 for a
 * planned refactor that would let the key handler and this table share one source.)
 */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    group: 'Editing',
    items: [
      { keys: 'Ctrl + Z', label: 'Undo' },
      { keys: 'Ctrl + Y', label: 'Redo' },
      { keys: 'Ctrl + Shift + Z', label: 'Redo (alternative)' },
      { keys: 'Ctrl + D', label: 'Duplicate selected object' },
      { keys: 'Delete', label: 'Delete selected object' },
    ],
  },
  {
    group: 'Scene hierarchy',
    items: [
      { keys: 'Double-click', label: 'Rename an object' },
      { keys: 'F2', label: 'Rename the selected object' },
    ],
  },
  {
    group: 'Vertex placement',
    items: [
      { keys: 'Click', label: 'Place a vertex on the canvas' },
      { keys: 'Enter', label: 'Finish the shape' },
      { keys: 'Backspace', label: 'Remove the last placed vertex' },
      { keys: 'Esc', label: 'Cancel placement' },
    ],
  },
  {
    group: 'Tour',
    items: [
      { keys: 'Right arrow', label: 'Next tour step' },
      { keys: 'Enter', label: 'Next tour step' },
      { keys: 'Left arrow', label: 'Previous tour step' },
      { keys: 'Esc', label: 'End the tour' },
    ],
  },
  {
    group: 'General',
    items: [
      { keys: '?', label: 'Open this Help Centre' },
      { keys: 'F1', label: 'Open this Help Centre' },
      { keys: 'Esc', label: 'Close the Help Centre' },
    ],
  },
];
