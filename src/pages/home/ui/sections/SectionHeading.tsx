import { SECTIONS } from '@/pages/home/model/content';

interface SectionHeadingProps {
  id: string;
  title: string;
  subhead?: string;
}

/** Title strip shared by every section after the hero: a sheet number, the section label, then the heading. */
export default function SectionHeading({ id, title, subhead }: SectionHeadingProps) {
  const index = SECTIONS.findIndex((section) => section.id === id);
  return (
    <header className="home-section__head">
      <p className="home-section__eyebrow">
        <span className="home-section__sheet">{String(index + 1).padStart(2, '0')}</span>
        {SECTIONS[index].label}
      </p>
      <h2 id={`${id}-title`} className="home-section__title">
        {title}
      </h2>
      {subhead && <p className="home-section__subhead">{subhead}</p>}
    </header>
  );
}
