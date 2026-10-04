import { CURRICULUM } from '@/pages/home/model/content';
import SectionHeading from './SectionHeading';

export default function CurriculumSection() {
  return (
    <section id="curriculum" className="home-section" data-slide="" aria-labelledby="curriculum-title">
      <SectionHeading id="curriculum" title={CURRICULUM.title} />
      <ol className="curriculum-list">
        {CURRICULUM.sections.map((section, i) => (
          <li key={section.name}>
            <span className="curriculum-list__number">{String(i + 1).padStart(2, '0')}</span>
            <h3 className="curriculum-list__name">{section.name}</h3>
            <p className="curriculum-list__summary">{section.summary}</p>
            <ul className="curriculum-list__calls" aria-label={`Key calls in ${section.name}`}>
              {section.calls.map((call) => (
                <li key={call}>
                  <code>{call}</code>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <dl className="mode-list">
        {CURRICULUM.modes.map((mode) => (
          <div key={mode.name}>
            <dt>{mode.name}</dt>
            <dd>{mode.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
