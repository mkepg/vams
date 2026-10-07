import { CURRICULUM } from '@/pages/home/model/content';
import SectionHeading from './SectionHeading';

export default function CurriculumSection() {
  return (
    <section id="curriculum" className="home-section" data-slide="" aria-labelledby="curriculum-title">
      <SectionHeading id="curriculum" title={CURRICULUM.title} />
      <ol className="pipeline">
        {CURRICULUM.sections.map((section) => (
          <li key={section.name} className="pipeline__stop">
            <span className="pipeline__dot" aria-hidden="true" />
            <h3 className="pipeline__name">{section.name}</h3>
            <p className="pipeline__summary">{section.summary}</p>
            <ul className="pipeline__calls" aria-label={`Key calls in ${section.name}`}>
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
