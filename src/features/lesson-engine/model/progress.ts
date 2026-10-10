import { useEffect, useState } from 'react';
import { isCatalogLesson as isLesson } from './catalog';

/** Lesson progress lives under its own key, so the editor's saved store keeps version 7. */
export const PROGRESS_KEY = 'vams-lesson-progress';

export interface LessonProgress {
  version: 1;
  completed: string[];
  /** The lesson the student left mid-way; shown as "in progress". Starting it again begins at step 1. */
  current: { lessonId: string; step: number } | null;
}

const empty = (): LessonProgress => ({ version: 1, completed: [], current: null });

type Listener = (progress: LessonProgress) => void;
const listeners = new Set<Listener>();

export function readProgress(): LessonProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw) as Partial<LessonProgress> | null;
    if (!data || typeof data !== 'object' || data.version !== 1 || !Array.isArray(data.completed)) return empty();
    const completed = [...new Set(data.completed.filter(isLesson))];
    const c = data.current;
    const current =
      c && typeof c === 'object' && isLesson(c.lessonId) && Number.isInteger(c.step) && c.step >= 0
        ? { lessonId: c.lessonId, step: c.step }
        : null;
    return { version: 1, completed, current };
  } catch {
    return empty();
  }
}

function write(progress: LessonProgress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Storage is full or blocked: progress is lost for this visit, the lesson itself is not.
  }
  listeners.forEach((listener) => listener(progress));
}

export function markLessonComplete(id: string): void {
  const progress = readProgress();
  write({
    version: 1,
    completed: progress.completed.includes(id) ? progress.completed : [...progress.completed, id],
    current: progress.current?.lessonId === id ? null : progress.current,
  });
}

export function recordLessonLeft(id: string, step: number): void {
  write({ ...readProgress(), current: { lessonId: id, step } });
}

export function subscribeProgress(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The student's progress, kept current. A prerendered page passes afterMount, so its first
 * render matches the build (which has no storage) and progress is read once the page runs.
 * Progress written by another tab arrives through the storage event.
 */
export function useLessonProgress({ afterMount = false }: { afterMount?: boolean } = {}): LessonProgress {
  const [progress, setProgress] = useState<LessonProgress>(() => (afterMount ? empty() : readProgress()));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (afterMount) setProgress(readProgress());
    const onStorage = (event: StorageEvent) => {
      if (event.key === PROGRESS_KEY || event.key === null) setProgress(readProgress());
    };
    window.addEventListener('storage', onStorage);
    const unsubscribe = subscribeProgress(setProgress);
    return () => {
      unsubscribe();
      window.removeEventListener('storage', onStorage);
    };
  }, [afterMount]);
  return progress;
}
