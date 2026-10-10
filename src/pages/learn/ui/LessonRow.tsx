import { Check } from 'lucide-react';
import { lessonHref, type LessonEntry } from '@/features/lesson-engine/model/catalog';
import type { LessonStatus } from '../model/learn-progress';

/** One lesson: the whole row opens it in the editor. */
export default function LessonRow({ lesson, status }: { lesson: LessonEntry; status: LessonStatus }) {
  return (
    <a className={`learn-row is-${status.kind}`} href={lessonHref(lesson.id)} aria-label={`${lesson.title}, ${status.spoken}`}>
      <span className="learn-row__mark" aria-hidden="true">
        {status.kind === 'complete' && <Check size={14} strokeWidth={2.5} />}
      </span>
      <span className="learn-row__title">{lesson.title}</span>
      <span className="learn-row__meta">{status.meta}</span>
    </a>
  );
}
