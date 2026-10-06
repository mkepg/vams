import type { ComponentChildren } from 'preact';
import { useVamsStore } from '@/core/store';
import type { CurriculumSection } from '@/core/store/types';
import PipelineModeControls from '@/features/pipeline-controls/ui/PipelineModeControls';
import CustomShapeBuilderPanel from '@/features/custom-shapes/ui/CustomShapeBuilderPanel';
import TextNodePanel from '@/features/text-nodes/ui/TextNodePanel';
import SceneHierarchyPanel from '@/features/scene-hierarchy/ui/SceneHierarchyPanel';
import ObjectTransformPanel from '@/features/object-transform/ui/ObjectTransformPanel';
import AnimationPreviewPanel from '@/features/animation-preview/ui/AnimationPreviewPanel';
import ObjectAppearancePanel from '@/features/object-appearance/ui/ObjectAppearancePanel';
import LineStylePanel from '@/features/line-style/ui/LineStylePanel';
import CallbacksPanel from '@/features/callbacks/ui/CallbacksPanel';
import BuffersPanel from '@/features/buffers/ui/BuffersPanel';
import OrthoEditorPanel from '@/features/ortho-editor/ui/OrthoEditorPanel';
import TextureLibraryPanel from '@/features/textures/ui/TextureLibraryPanel';
import TextureAttachmentPanel from '@/features/textures/ui/TextureAttachmentPanel';
import UVEditorPanel from '@/features/textures/ui/UVEditorPanel';

export interface SectionPanelEntry {
  /** Equals the panel's panelId, which lesson focusPanel targets. */
  id: string;
  render: () => ComponentChildren;
}

export type SectionPanels = Record<CurriculumSection, SectionPanelEntry[]>;

export const PINNED_PANEL_ID = 'scene-hierarchy';

const hasSelectedObject = (s: ReturnType<typeof useVamsStore.getState>) =>
  s.objects.some((o) => o.id === s.selectedObjectId);

/** Pipeline shows the appearance panel only while nothing is selected. */
function PipelineAppearance() {
  const hasSelection = useVamsStore(hasSelectedObject);
  return hasSelection ? null : <ObjectAppearancePanel />;
}

/** The animation preview needs an object to play on. */
function SelectedAnimation() {
  const hasSelection = useVamsStore(hasSelectedObject);
  return hasSelection ? <AnimationPreviewPanel /> : null;
}

const hierarchy: SectionPanelEntry = { id: 'scene-hierarchy', render: () => <SceneHierarchyPanel /> };
const palette: SectionPanelEntry = { id: 'primitive-palette', render: () => <CustomShapeBuilderPanel /> };

export const SECTION_PANELS: SectionPanels = {
  Pipeline: [
    { id: 'pipeline-mode-controls', render: () => <PipelineModeControls /> },
    hierarchy,
    { id: 'appearance-panel', render: () => <PipelineAppearance /> },
  ],
  Primitives: [
    hierarchy,
    palette,
    { id: 'text-node-panel', render: () => <TextNodePanel /> },
    { id: 'appearance-panel', render: () => <ObjectAppearancePanel /> },
    { id: 'line-style-panel', render: () => <LineStylePanel /> },
    { id: 'callbacks-panel', render: () => <CallbacksPanel /> },
  ],
  Buffers: [hierarchy, palette, { id: 'buffers-panel', render: () => <BuffersPanel /> }],
  Transforms: [
    hierarchy,
    { id: 'object-transform', render: () => <ObjectTransformPanel /> },
    { id: 'animation-preview', render: () => <SelectedAnimation /> },
    { id: 'ortho-editor', render: () => <OrthoEditorPanel /> },
  ],
  Textures: [
    hierarchy,
    palette,
    { id: 'texture-library', render: () => <TextureLibraryPanel /> },
    { id: 'texture-attach', render: () => <TextureAttachmentPanel /> },
    { id: 'uv-editor', render: () => <UVEditorPanel /> },
  ],
};
