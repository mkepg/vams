import type { CurriculumSection } from '@/core/store/types';

export type ObjectGroupId = 'vertices' | 'buffers' | 'transform' | 'appearance' | 'texture';
export type SettingsGroupId = 'background' | 'viewing-volume' | 'texture-library' | 'callbacks';
export type InspectorGroupId = ObjectGroupId | SettingsGroupId;

/** Pipeline order: the order the inspector shows them. */
export const OBJECT_GROUPS: readonly ObjectGroupId[] = ['vertices', 'buffers', 'transform', 'appearance', 'texture'];
/** The Settings panel's groups. Callbacks has its own rail panel; it keeps a group id for its focus place and math section. */
export const SETTINGS_GROUPS: readonly SettingsGroupId[] = ['background', 'viewing-volume', 'texture-library'];

/** Open by default: Transform for an object, and every Settings group. */
export const DEFAULT_OPEN_GROUPS: readonly InspectorGroupId[] = ['transform', 'background', 'viewing-volume', 'texture-library'];

/** The curriculum section whose math and help belong to each group. */
export const GROUP_SECTION: Record<InspectorGroupId, CurriculumSection> = {
  vertices: 'Primitives',
  buffers: 'Buffers',
  transform: 'Transforms',
  appearance: 'Primitives',
  texture: 'Textures',
  background: 'Pipeline',
  'viewing-volume': 'Transforms',
  'texture-library': 'Textures',
  callbacks: 'Pipeline',
};
