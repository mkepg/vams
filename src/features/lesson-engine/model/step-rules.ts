import type { LessonStep } from '@/core/types/lesson';

/** A waiting step holds the student: it has goals, a success check or an exercise. */
export function waitsForStudent(step: LessonStep): boolean {
  return (step.goals?.length ?? 0) > 0 || !!step.successCheck || !!step.exercise;
}

/** A waiting step can be skipped when it can be solved for the student. */
export function canSkip(step: LessonStep): boolean {
  return waitsForStudent(step) && (!!step.solve || !!step.exercise);
}

/** Coordinate groups like `(0.5, 0.2)` and numbers, with an optional degree sign. */
const NUMBER_PART = /\([^()]*\d[^()]*\)|[-−+]?\d+(?:\.\d+)?°?|[-−+]?\.\d+°?/g;

/** Splits a goal label so the numbers can be set in tabular figures. */
export function goalLabelParts(label: string): { text: string; num: boolean }[] {
  const parts: { text: string; num: boolean }[] = [];
  let last = 0;
  for (const m of label.matchAll(NUMBER_PART)) {
    const at = m.index ?? 0;
    if (at > last) parts.push({ text: label.slice(last, at), num: false });
    parts.push({ text: m[0], num: true });
    last = at + m[0].length;
  }
  if (last < label.length) parts.push({ text: label.slice(last), num: false });
  return parts;
}
