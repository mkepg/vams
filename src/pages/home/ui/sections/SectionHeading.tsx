interface SectionHeadingProps {
  id: string;
  title: string;
  subhead?: string;
}

/** Title strip shared by every section after the hero: the heading, then an optional subhead. */
export default function SectionHeading({ id, title, subhead }: SectionHeadingProps) {
  return (
    <header className="home-section__head">
      <h2 id={`${id}-title`} className="home-section__title">
        {title}
      </h2>
      {subhead && <p className="home-section__subhead">{subhead}</p>}
    </header>
  );
}
