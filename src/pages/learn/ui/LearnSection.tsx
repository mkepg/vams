import { catalogFor, type CourseSection, type LessonEntry } from '@/features/lesson-engine/model/catalog';
import type { LessonProgress } from '@/features/lesson-engine/model/progress';
import { doneCount, lessonStatus } from '../model/learn-progress';
import { LEARN_COPY, sectionAnchor } from '../model/copy';
import LessonRow from './LessonRow';

/** One course section: what it teaches on the left, its lessons on the right. */
export default function LearnSection({ course, progress }: { course: CourseSection; progress: LessonProgress }) {
  const { demos, exercises } = catalogFor(course.section);
  const lessons = [...demos, ...exercises];
  const done = doneCount(progress, lessons);
  const id = sectionAnchor(course.section);

  const list = (title: string, items: LessonEntry[]) => (
    <div className="learn-section__group">
      <h3 className="learn-section__group-title">{title}</h3>
      <ul className="learn-section__list">
        {items.map((lesson) => (
          <li key={lesson.id}>
            <LessonRow lesson={lesson} status={lessonStatus(lesson, progress)} />
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <section id={id} className="learn-section" aria-labelledby={`${id}-title`}>
      <div className="learn-section__intro">
        <h2 id={`${id}-title`} className="learn-section__title">{course.section}</h2>
        <p className="learn-section__summary">{course.summary}</p>
        <ul className="learn-section__calls" aria-label={`Key calls in ${course.section}`}>
          {course.calls.map((call) => (
            <li key={call}>
              <code>{call}</code>
            </li>
          ))}
        </ul>
        <p className="learn-section__count">{done > 0 ? `${done} of ${lessons.length} done` : `${lessons.length} lessons`}</p>
      </div>
      <div className="learn-section__lessons">
        {list(LEARN_COPY.demos, demos)}
        {list(LEARN_COPY.exercises, exercises)}
      </div>
    </section>
  );
}
