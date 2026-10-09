import type { CurriculumSection } from '@/core/store/types';
import { GROUP_SECTION, type ObjectGroupId, type SettingsGroupId } from './groups';

export type FocusPlace =
  | { area: 'scene'; target: 'list' | 'add' | 'create-text' }
  | { area: 'object'; group: ObjectGroupId }
  | { area: 'settings'; group: SettingsGroupId }
  | { area: 'lesson-card' };

/** Lesson focusPanel ids (the panels' own panelId values) and where each lives in the editor. */
const FIXED: Record<string, FocusPlace> = {
  'scene-hierarchy': { area: 'scene', target: 'list' },
  'primitive-palette': { area: 'scene', target: 'add' },
  'text-node-panel': { area: 'scene', target: 'create-text' },
  'buffers-panel': { area: 'object', group: 'buffers' },
  'object-transform': { area: 'object', group: 'transform' },
  'line-style-panel': { area: 'object', group: 'appearance' },
  'texture-attach': { area: 'object', group: 'texture' },
  'uv-editor': { area: 'object', group: 'texture' },
  'animation-preview': { area: 'object', group: 'animation' },
  'ortho-editor': { area: 'settings', group: 'viewing-volume' },
  'texture-library': { area: 'settings', group: 'texture-library' },
  'callbacks-panel': { area: 'settings', group: 'callbacks' },
  'pipeline-mode-controls': { area: 'lesson-card' },
};

export const FOCUS_PANEL_IDS: readonly string[] = [...Object.keys(FIXED), 'appearance-panel'];

export function resolveFocus(panelId: string | null | undefined, hasSelection: boolean): FocusPlace | null {
  if (!panelId) return null;
  // The appearance panel is the object's colour with a selection and the background without one.
  if (panelId === 'appearance-panel') {
    return hasSelection ? { area: 'object', group: 'appearance' } : { area: 'settings', group: 'background' };
  }
  return Object.prototype.hasOwnProperty.call(FIXED, panelId) ? FIXED[panelId] : null;
}

export function sectionForPlace(place: FocusPlace): CurriculumSection {
  switch (place.area) {
    case 'scene':
      return 'Primitives';
    case 'lesson-card':
      return 'Pipeline';
    default:
      return GROUP_SECTION[place.group];
  }
}
