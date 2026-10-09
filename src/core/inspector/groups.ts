import type { CurriculumSection } from '@/core/store/types';

export type ObjectGroupId = 'vertices' | 'buffers' | 'transform' | 'appearance' | 'texture' | 'animation';
export type SettingsGroupId = 'background' | 'viewing-volume' | 'texture-library' | 'callbacks';
export type InspectorGroupId = ObjectGroupId | SettingsGroupId;

/** Pipeline order: the order the inspector shows them. */
export const OBJECT_GROUPS: readonly ObjectGroupId[] = ['vertices', 'buffers', 'transform', 'appearance', 'texture', 'animation'];
export const SETTINGS_GROUPS: readonly SettingsGroupId[] = ['background', 'viewing-volume', 'texture-library', 'callbacks'];

/** Open by default: Transform for an object, Background for the scene. */
export const DEFAULT_OPEN_GROUPS: readonly InspectorGroupId[] = ['transform', 'background'];

/** The curriculum section whose math and help belong to each group. */
export const GROUP_SECTION: Record<InspectorGroupId, CurriculumSection> = {
  vertices: 'Primitives',
  buffers: 'Buffers',
  transform: 'Transforms',
  appearance: 'Primitives',
  texture: 'Textures',
  animation: 'Transforms',
  background: 'Pipeline',
  'viewing-volume': 'Transforms',
  'texture-library': 'Textures',
  callbacks: 'Pipeline',
};
