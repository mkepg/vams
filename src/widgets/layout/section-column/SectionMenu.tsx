import { Database, GitCommit, Image as ImageIcon, Move3d, Shapes } from 'lucide-react';
import type { ComponentChildren } from 'preact';
import { useVamsStore } from '@/core/store';
import type { CurriculumSection } from '@/core/store/types';
import { MenuButton } from '@/shared/ui/controls';

const SECTIONS: { section: CurriculumSection; description: string; icon: ComponentChildren }[] = [
  { section: 'Pipeline', description: 'The rendering pipeline, NDC, and rasterization', icon: <GitCommit /> },
  { section: 'Primitives', description: 'Points, lines, triangles, color, and line style', icon: <Shapes /> },
  { section: 'Buffers', description: 'Vertex arrays, VBOs, and memory layout', icon: <Database /> },
  { section: 'Transforms', description: 'Translate, rotate, scale, and the matrix stack', icon: <Move3d /> },
  { section: 'Textures', description: 'Images, UV mapping, filtering, and wrapping', icon: <ImageIcon /> },
];

/** The column's title: the active section's name, which opens a menu of all sections. */
export default function SectionMenu() {
  const activeSection = useVamsStore((s) => s.activeSection);
  const setActiveSection = useVamsStore((s) => s.setActiveSection);
  const current = SECTIONS.find((s) => s.section === activeSection) ?? SECTIONS[0];

  return (
    <div className="section-menu">
      <p className="section-menu__eyebrow" aria-hidden="true">Section</p>
      <h2 className="sr-only">{current.section}</h2>
      <MenuButton
        label="Sections"
        variant="quiet"
        triggerClassName="section-menu__trigger"
        entries={SECTIONS.map(({ section, description, icon }) => ({
          kind: 'radio' as const,
          id: section,
          label: section,
          description,
          icon,
          checked: section === activeSection,
          onSelect: () => setActiveSection(section),
        }))}
      >
        <span className="section-menu__name">{current.section}</span>
      </MenuButton>
      <p className="section-menu__desc">{current.description}</p>
    </div>
  );
}
