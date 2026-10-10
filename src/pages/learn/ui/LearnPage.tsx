import { Check } from 'lucide-react';
import SiteHeader from '@/widgets/site-header';
import SiteFooter from '@/widgets/site-footer';
import { COURSE, LESSON_CATALOG, catalogFor } from '@/features/lesson-engine/model/catalog';
import { useLessonProgress } from '@/features/lesson-engine/model/progress';
import { doneCount, lessonStatus, nextUp } from '../model/learn-progress';
import { LEARN_COPY, sectionAnchor } from '../model/copy';
import LearnSection from './LearnSection';
import LessonRow from './LessonRow';
import './learn.scss';

export default function LearnPage() {
  // Prerendered as a first visit; the student's progress is read once the page runs.
  const progress = useLessonProgress({ afterMount: true });
  const total = LESSON_CATALOG.length;
  const done = doneCount(progress);
  const next = nextUp(progress);

  return (
    <div className="site-page">
      <SiteHeader current="/learn" />
      <main id="main" className="learn">
        <div className="learn__intro">
          <h1 className="learn__title">{LEARN_COPY.title}</h1>
          <p className="learn__lede">{LEARN_COPY.lede}</p>
          {next ? (
            <div className="learn-next">
              <p className="learn-next__label">{LEARN_COPY.nextLabel}</p>
              <LessonRow lesson={next} status={lessonStatus(next, progress)} />
            </div>
          ) : (
            <p className="learn-next learn-next--done">{LEARN_COPY.allDone}</p>
          )}
          <p className="learn__status">{done > 0 ? `${done} of ${total} lessons done` : `${total} lessons in five sections`}</p>
        </div>
        <nav className="learn-index" aria-label="Sections">
          <ul className="learn-index__list">
            {COURSE.map(({ section }) => {
              const { demos, exercises } = catalogFor(section);
              const lessons = [...demos, ...exercises];
              const complete = doneCount(progress, lessons) === lessons.length;
              return (
                <li key={section}>
                  <a
                    className={complete ? 'learn-index__link is-done' : 'learn-index__link'}
                    href={`#${sectionAnchor(section)}`}
                    aria-label={complete ? `${section}, complete` : undefined}
                  >
                    <span className="learn-index__mark" aria-hidden="true">
                      {complete && <Check size={9} strokeWidth={3} />}
                    </span>
                    {section}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        {COURSE.map((course) => (
          <LearnSection key={course.section} course={course} progress={progress} />
        ))}
      </main>
      <SiteFooter />
    </div>
  );
}
