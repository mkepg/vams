import { GitCommit, Shapes, Database, Move3d, Image as ImageIcon } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import type { CurriculumSection } from '@/core/store/types';
import { confirm } from '@/shared/ui/confirm-dialog/confirm-store';
import EmptySelectionState from '@/shared/ui/empty-state/EmptySelectionState';
import PipelineModeControls from '@/features/pipeline-controls/ui/PipelineModeControls';
import CustomShapeBuilderPanel from '@/features/custom-shapes/ui/CustomShapeBuilderPanel';
import TextNodePanel from '@/features/text-nodes/ui/TextNodePanel';
import SceneHierarchyPanel from '@/features/scene-hierarchy/ui/SceneHierarchyPanel';
import ObjectTransformPanel from '@/features/object-transform/ui/ObjectTransformPanel';
import ObjectAppearancePanel from '@/features/object-appearance/ui/ObjectAppearancePanel';
import LineStylePanel from '@/features/line-style/ui/LineStylePanel';
import CallbacksPanel from '@/features/callbacks/ui/CallbacksPanel';
import BuffersPanel from '@/features/buffers/ui/BuffersPanel';
import OrthoEditorPanel from '@/features/ortho-editor/ui/OrthoEditorPanel';
import TextureLibraryPanel from '@/features/textures/ui/TextureLibraryPanel';
import TextureAttachmentPanel from '@/features/textures/ui/TextureAttachmentPanel';
import UVEditorPanel from '@/features/textures/ui/UVEditorPanel';
import './left-sidebar.scss';

export default function LeftSidebar() {
  const {
    activeSection,
    setActiveSection,
    selectedObjectId,
    objects,
    appMode,
    setAppMode,
    clearLessonState
  } = useVamsStore();
  const selectedObject = objects.find((object) => object.id === selectedObjectId);
  const handleTabClick = async (section: CurriculumSection) => {
    if (activeSection === section) return;
    if (appMode === 'Lesson') {
      const confirmLeave = await confirm({
        title: 'Leave current lesson?',
        message: 'Your progress in this lesson will be lost and you will return to Author mode.',
        confirmLabel: 'Leave lesson',
        cancelLabel: 'Stay',
        tone: 'danger',
      });
      if (confirmLeave) {
        clearLessonState();
        setAppMode('Author');
        setActiveSection(section);
      }
    } else {
      setActiveSection(section);
    }
  };
  const renderSectionContent = () => {
    switch (activeSection) {
      case 'Pipeline':
        return (
          <div className="tab-pane">
            <PipelineModeControls />
            <div className="separator" />
            <SceneHierarchyPanel />
            {!selectedObject && <ObjectAppearancePanel />}
          </div>
        );
      case 'Primitives':
        return (
          <div className="tab-pane">
            <SceneHierarchyPanel />
            <div className="separator" />
            <CustomShapeBuilderPanel />
            <TextNodePanel />
            <div className="separator" />
            <ObjectAppearancePanel />
            <LineStylePanel />
            <div className="separator" />
            <CallbacksPanel />
          </div>
        );
      case 'Buffers':
        return (
          <div className="tab-pane">
            <SceneHierarchyPanel />
            <div className="separator" />
            <CustomShapeBuilderPanel />
            <div className="separator" />
            <BuffersPanel />
          </div>
        );
      case 'Transforms':
        return (
          <div className="tab-pane">
            <SceneHierarchyPanel />
            {selectedObject ? (
              <ObjectTransformPanel />
            ) : (
              <EmptySelectionState message="Select an object in the scene to translate, rotate, or scale it." />
            )}
            <OrthoEditorPanel />
          </div>
        );
      case 'Textures':
        return (
          <div className="tab-pane">
            <SceneHierarchyPanel />
            <div className="separator" />
            <CustomShapeBuilderPanel />
            <div className="separator" />
            <TextureLibraryPanel />
            <TextureAttachmentPanel />
            <UVEditorPanel />
          </div>
        );
      default:
        return null;
    }
  };
  return (
    <aside className="left-sidebar">
      <div className="sidebar-tabs" role="tablist" aria-label="Curriculum sections">
        {SECTION_TABS.map((tab) => (
          <SidebarTab
            key={tab.section}
            label={tab.label}
            description={tab.description}
            icon={tab.icon}
            isActive={activeSection === tab.section}
            onClick={() => handleTabClick(tab.section)}
          />
        ))}
      </div>
      <div className="sidebar-content">
        {renderSectionContent()}
      </div>
    </aside>
  );
}
type SectionTab = {
  section: CurriculumSection;
  label: string;
  description: string;
  icon: React.ReactNode;
};
const SECTION_TABS: SectionTab[] = [
  { section: 'Pipeline', label: 'Pipeline', description: 'Pipeline — the rendering pipeline, NDC, and rasterization', icon: <GitCommit size={16} /> },
  { section: 'Primitives', label: 'Primitives', description: 'Primitives — points, lines, triangles, color, and line style', icon: <Shapes size={16} /> },
  { section: 'Buffers', label: 'Buffers', description: 'Buffers — vertex arrays, VBOs, and memory layout', icon: <Database size={16} /> },
  { section: 'Transforms', label: 'Transforms', description: 'Transforms — translate, rotate, scale, and the matrix stack', icon: <Move3d size={16} /> },
  { section: 'Textures', label: 'Textures', description: 'Textures — images, UV mapping, filtering, and wrapping', icon: <ImageIcon size={16} /> },
];
type SidebarTabProps = {
  label: string;
  description: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
};
function SidebarTab({ label, description, icon, isActive, onClick }: SidebarTabProps) {
  return (
    <button
      className={`tab-button ${isActive ? 'active' : ''}`}
      onClick={onClick}
      type="button"
      role="tab"
      aria-selected={isActive}
      title={description}
    >
      <span className="tab-icon">{icon}</span>
      <span className="tab-label">{label}</span>
    </button>
  );
}