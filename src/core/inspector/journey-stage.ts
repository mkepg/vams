import type { CurriculumSection, VamsState } from '@/core/store/types';
import type { InspectorGroupId } from './groups';
import { resolveFocus, type FocusPlace } from './focus-map';

/** The six stages of the math journey, in the order OpenGL processes a vertex. */
export type JourneyStageId = 'stored' | 'transformed' | 'projected' | 'assembled' | 'rasterised' | 'coloured';

export const JOURNEY_STAGES: readonly JourneyStageId[] = ['stored', 'transformed', 'projected', 'assembled', 'rasterised', 'coloured'];

/** Each stage's name, for the journey and for the code panel's "See the math" link. */
export const JOURNEY_STAGE_TITLES: Record<JourneyStageId, string> = {
  stored: 'Stored',
  transformed: 'Transformed',
  projected: 'Projected',
  assembled: 'Assembled',
  rasterised: 'Rasterised',
  coloured: 'Coloured',
};

const SECTION_STAGE: Record<CurriculumSection, JourneyStageId> = {
  Pipeline: 'rasterised',
  Primitives: 'assembled',
  Buffers: 'stored',
  Transforms: 'transformed',
  Textures: 'coloured',
};

/** Callbacks has no stage of its own; it keeps the section's. */
const GROUP_STAGE: Record<InspectorGroupId, JourneyStageId | null> = {
  vertices: 'stored',
  buffers: 'stored',
  transform: 'transformed',
  appearance: 'coloured',
  texture: 'coloured',
  background: 'rasterised',
  'viewing-volume': 'projected',
  'texture-library': 'coloured',
  callbacks: null,
};

export function stageForSection(section: CurriculumSection): JourneyStageId {
  return SECTION_STAGE[section];
}

export function stageForGroup(group: InspectorGroupId): JourneyStageId | null {
  return GROUP_STAGE[group];
}

export function stageForPlace(place: FocusPlace): JourneyStageId | null {
  switch (place.area) {
    case 'scene':
      return place.target === 'list' ? 'transformed' : 'assembled';
    case 'canvas-header':
      return 'rasterised';
    default:
      return GROUP_STAGE[place.group];
  }
}

export type JourneyContext = Pick<
  VamsState,
  'appMode' | 'lessonFocusPanel' | 'selectedObjectId' | 'lastOpenedGroup' | 'activeSection' | 'journeyStageOverride'
>;

/**
 * The stage the math journey opens. A stage the student opened by hand wins until the next lesson
 * step or opened group. Otherwise, in a lesson: the step's focus, else the section. Outside one:
 * the last opened group, else the section.
 */
export function journeyStageFor(s: JourneyContext): JourneyStageId {
  if (s.journeyStageOverride) return s.journeyStageOverride;
  if (s.appMode === 'Lesson') {
    const place = resolveFocus(s.lessonFocusPanel, s.selectedObjectId !== null);
    return (place ? stageForPlace(place) : null) ?? stageForSection(s.activeSection);
  }
  return (s.lastOpenedGroup ? GROUP_STAGE[s.lastOpenedGroup] : null) ?? stageForSection(s.activeSection);
}
