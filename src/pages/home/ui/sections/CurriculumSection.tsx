import { COURSE } from '@/features/lesson-engine/model/catalog';
import { CURRICULUM } from '@/pages/home/model/content';
import SectionHeading from './SectionHeading';

export default function CurriculumSection() {
  return (
    <section id="curriculum" className="home-section" data-slide="" aria-labelledby="curriculum-title">
      <SectionHeading id="curriculum" title={CURRICULUM.title} />
      <ol className="pipeline">
        {COURSE.map((course) => (
          <li key={course.section} className="pipeline__stop">
            <span className="pipeline__dot" aria-hidden="true" />
            <h3 className="pipeline__name">{course.section}</h3>
            <p className="pipeline__summary">{course.summary}</p>
            <ul className="pipeline__calls" aria-label={`Key calls in ${course.section}`}>
              {course.calls.map((call) => (
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
      <p className="curriculum-more">
        <a href={CURRICULUM.more.href}>{CURRICULUM.more.label}</a>
      </p>
    </section>
  );
}
