import type { ComponentChildren } from 'preact';
import type { SceneNode } from '@/core/types/scene';
import type { InspectorGroupId } from '@/core/inspector';
import VerticesPanel from '@/features/vertex-editor/ui/VerticesPanel';
import BuffersPanel from '@/features/buffers/ui/BuffersPanel';
import ObjectTransformPanel from '@/features/object-transform/ui/ObjectTransformPanel';
import ObjectAppearancePanel from '@/features/object-appearance/ui/ObjectAppearancePanel';
import BackgroundColorPanel from '@/features/object-appearance/ui/BackgroundColorPanel';
import LineStylePanel, { LINE_TYPES } from '@/features/line-style/ui/LineStylePanel';
import TextureAttachmentPanel, { TEXTUREABLE_TYPES } from '@/features/textures/ui/TextureAttachmentPanel';
import UVEditorPanel from '@/features/textures/ui/UVEditorPanel';
import AnimationPreviewPanel from '@/features/animation-preview/ui/AnimationPreviewPanel';
import OrthoEditorPanel from '@/features/ortho-editor/ui/OrthoEditorPanel';
import TextureLibraryPanel from '@/features/textures/ui/TextureLibraryPanel';
import CallbacksPanel from '@/features/callbacks/ui/CallbacksPanel';

export interface GroupDef {
  id: InspectorGroupId;
  title: string;
  /** The OpenGL call shown in the header; may depend on the selected object. */
  hint: (object: SceneNode | null) => string;
  applies?: (object: SceneNode) => boolean;
  render: (object: SceneNode | null) => ComponentChildren;
}

const BUFFER_HINT: Record<string, string> = { IMMEDIATE: 'glBegin', VERTEX_ARRAY: 'glDrawArrays', VBO: 'glBufferData' };

/** Text and groups have no vertices of their own to edit or upload. */
const hasVertices = (o: SceneNode) => o.type !== 'TEXT' && o.type !== 'GROUP';

/** Pipeline order. */
export const OBJECT_GROUP_DEFS: GroupDef[] = [
  { id: 'vertices', title: 'Vertices', hint: () => 'glVertex2f', applies: hasVertices, render: () => <VerticesPanel /> },
  {
    id: 'buffers',
    title: 'Buffers',
    hint: (o) => BUFFER_HINT[o?.renderingMode ?? 'IMMEDIATE'] ?? 'glBegin',
    applies: hasVertices,
    render: () => <BuffersPanel />,
  },
  { id: 'transform', title: 'Transform', hint: () => 'glTranslatef · glRotatef · glScalef', render: () => <ObjectTransformPanel /> },
  {
    id: 'appearance',
    title: 'Appearance',
    hint: () => 'glColor3f',
    applies: (o) => o.type !== 'GROUP',
    render: (o) => (
      <>
        <ObjectAppearancePanel />
        {o && LINE_TYPES.has(o.type) && <LineStylePanel />}
      </>
    ),
  },
  {
    id: 'texture',
    title: 'Texture',
    hint: (o) => (o?.texture ? 'glBindTexture' : 'none'),
    applies: (o) => TEXTUREABLE_TYPES.has(o.type),
    render: () => (
      <>
        <TextureAttachmentPanel />
        <UVEditorPanel />
      </>
    ),
  },
  { id: 'animation', title: 'Animation', hint: () => 'glutIdleFunc', render: () => <AnimationPreviewPanel /> },
];

export const SETTINGS_GROUP_DEFS: GroupDef[] = [
  // The settings show with an object selected during a settings focus, so Background never reads the selection.
  { id: 'background', title: 'Background', hint: () => 'glClearColor', render: () => <BackgroundColorPanel /> },
  { id: 'viewing-volume', title: 'Viewing volume', hint: () => 'glOrtho', render: () => <OrthoEditorPanel /> },
  { id: 'texture-library', title: 'Texture library', hint: () => 'glGenTextures', render: () => <TextureLibraryPanel /> },
  { id: 'callbacks', title: 'Callbacks', hint: () => 'glutKeyboardFunc …', render: () => <CallbacksPanel /> },
];
