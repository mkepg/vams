import { useState } from 'react';
import { ArrowUpRight, Check, Map as MapIcon, X } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import type { CurriculumSection } from '@/core/store/types';
import type { Lesson } from '@/core/types/lesson';
import { Button, Dialog } from '@/shared/ui/controls';
import { COURSE, lessonsFor } from '../model/course';
import { useLessonProgress, type LessonProgress } from '../model/progress';
import { startLesson } from '../model/start-lesson';
import './learn-drawer.scss';

function lessonState(lesson: Lesson, progress: LessonProgress) {
  if (progress.completed.includes(lesson.id)) return { kind: 'complete' as const, meta: 'Done' };
  if (progress.current?.lessonId === lesson.id) {
    return { kind: 'progress' as const, meta: `Step ${progress.current.step + 1} of ${lesson.steps.length}` };
  }
  return { kind: 'new' as const, meta: `${lesson.steps.length} steps` };
}

export default function LearnDrawer() {
  const open = useVamsStore((s) => s.learnOpen);
  const setLearnOpen = useVamsStore((s) => s.setLearnOpen);
  const activeSection = useVamsStore((s) => s.activeSection);
  const progress = useLessonProgress();
  const [shown, setShown] = useState<CurriculumSection>(activeSection);
  // Each opening starts on the student's current section.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setShown(activeSection);
  }

  const close = () => setLearnOpen(false);
  const choose = (id: string) => {
    close();
    void startLesson(id);
  };

  const index = COURSE.findIndex((c) => c.section === shown);
  const onRailKey = (event: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    let next = step === undefined ? -1 : (index + step + COURSE.length) % COURSE.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = COURSE.length - 1;
    if (next < 0) return;
    event.preventDefault();
    setShown(COURSE[next].section);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`.learn-rail [data-section="${COURSE[next].section}"]`)?.focus());
  };

  const { demos, exercises } = lessonsFor(shown);
  const sectionDone = (section: CurriculumSection) => {
    const { demos: d, exercises: e } = lessonsFor(section);
    return [...d, ...e].every((l) => progress.completed.includes(l.id));
  };

  const list = (title: string, lessons: Lesson[]) => (
    <section className="learn-drawer__group" aria-label={title}>
      <h3 className="learn-drawer__group-title">{title}</h3>
      <ul className="learn-drawer__list">
        {lessons.map((lesson) => {
          const state = lessonState(lesson, progress);
          return (
            <li key={lesson.id}>
              <button type="button" className={`learn-lesson is-${state.kind}`} onClick={() => choose(lesson.id)}>
                <span className="learn-lesson__mark" aria-hidden="true">
                  {state.kind === 'complete' ? <Check size={13} /> : state.kind === 'progress' ? '●' : '○'}
                </span>
                <span className="learn-lesson__title">{lesson.title}</span>
                <span className="learn-lesson__meta">{state.meta}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );

  return (
    <Dialog open={open} onClose={close} labelledBy="learn-title" className="learn-drawer">
      <div className="learn-drawer__head">
        <h2 id="learn-title" className="learn-drawer__title">Learn</h2>
        <Button variant="quiet" iconOnly label="Close" icon={<X />} onClick={close} />
      </div>
      {/* Leaves the editor for the /learn page, which shows every section at once. */}
      <a className="learn-drawer__map" href="/learn" onClick={close}>
        <MapIcon aria-hidden="true" />
        Full course map
        <ArrowUpRight aria-hidden="true" />
      </a>
      <div className="learn-rail" role="radiogroup" aria-label="Sections" onKeyDown={onRailKey}>
        {COURSE.map(({ section }) => {
          const checked = section === shown;
          const done = sectionDone(section);
          return (
            <button
              key={section}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              data-section={section}
              className={['learn-rail__stop', checked ? 'is-current' : '', done ? 'is-done' : ''].filter(Boolean).join(' ')}
              onClick={() => setShown(section)}
            >
              <span className="learn-rail__dot" aria-hidden="true">{done && <Check size={9} />}</span>
              {section}
              {done && <span className="sr-only"> (complete)</span>}
            </button>
          );
        })}
      </div>
      <p className="learn-drawer__desc">{COURSE[index].description}</p>
      {list('Demos', demos)}
      {list('Exercises', exercises)}
    </Dialog>
  );
}
