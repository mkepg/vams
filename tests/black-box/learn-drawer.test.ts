/**
 * BLACK-BOX TEST SUITE — BB-LEARN
 * The course map in the editor: progress, course data, the Learn drawer and starting lessons.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useVamsStore } from '@/core/store';
import { useConfirmStore } from '@/shared/ui/confirm-dialog/confirm-store';
import { LESSON_REGISTRY } from '@/features/lesson-engine/model/lesson-registry';
import {
  PROGRESS_KEY,
  markLessonComplete,
  readProgress,
  recordLessonLeft,
} from '@/features/lesson-engine/model/progress';
import { COURSE, lessonsFor } from '@/features/lesson-engine/model/course';
import { startLesson } from '@/features/lesson-engine/model/start-lesson';
import LearnDrawer from '@/features/lesson-engine/ui/LearnDrawer';
import LessonCard from '@/features/lesson-engine/ui/LessonCard';

async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}
const hosts: HTMLElement[] = [];
function mount(vnode: VNode) {
  const host = document.createElement('div');
  hosts.push(host);
  document.body.appendChild(host);
  render(vnode, host);
  return host;
}
function unmount(host: HTMLElement) {
  render(null, host);
  host.remove();
}

afterEach(() => {
  // Unmount here so a failed assertion cannot leave a mounted tree for later tests.
  while (hosts.length) unmount(hosts.pop()!);
  vi.restoreAllMocks();
  localStorage.removeItem(PROGRESS_KEY);
  useVamsStore.getState().clearLessonState();
  useVamsStore.setState({ appMode: 'Author', learnOpen: false, activeSection: 'Pipeline' });
});

describe('BB-LEARN-01: Progress records completion and the lesson left mid-way', () => {
  it('marks complete, records current, and clears current when that lesson completes', () => {
    recordLessonLeft('transforms-exercise-1', 1);
    expect(readProgress().current).toEqual({ lessonId: 'transforms-exercise-1', step: 1 });
    markLessonComplete('transforms-exercise-1');
    markLessonComplete('transforms-exercise-1');
    expect(readProgress()).toEqual({ version: 1, completed: ['transforms-exercise-1'], current: null });
  });
});

describe('BB-LEARN-02: Unreadable or foreign progress reads as clean progress', () => {
  it('ignores bad JSON, wrong versions, unknown ids and prototype keys', () => {
    for (const raw of ['{', '"x"', '{"version":2,"completed":[],"current":null}', '{"version":1}']) {
      localStorage.setItem(PROGRESS_KEY, raw);
      expect(readProgress()).toEqual({ version: 1, completed: [], current: null });
    }
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({
      version: 1,
      completed: ['toString', 'pipeline-demo-1', 42, 'pipeline-demo-1'],
      current: { lessonId: '__proto__', step: 1 },
    }));
    expect(readProgress()).toEqual({ version: 1, completed: ['pipeline-demo-1'], current: null });
  });
});

describe('BB-LEARN-03: A failed progress write never blocks finishing a lesson', () => {
  it('finishes and returns to Author mode when storage throws', async () => {
    useVamsStore.setState({ activeSection: 'Transforms' });
    useVamsStore.getState().setActiveLesson('transforms-exercise-4');
    useVamsStore.getState().setAppMode('Lesson');
    const host = mount(h(LessonCard, {}));
    await settle();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    useVamsStore.getState().setCurrentStep(LESSON_REGISTRY['transforms-exercise-4'].steps.length - 1);
    await settle();
    const finish = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Finish') as HTMLButtonElement;
    // Force the last step's check open: the test is about the write, not the exercise.
    finish.disabled = false;
    finish.click();
    await settle();
    expect(useVamsStore.getState().appMode).toBe('Author');
    unmount(host);
  });
});

describe('BB-LEARN-04: The course lists the five sections in pipeline order with their lessons', () => {
  it('uses the exact labels and splits demos from exercises in registry order', () => {
    expect(COURSE.map((c) => c.section)).toEqual(['Pipeline', 'Primitives', 'Buffers', 'Transforms', 'Textures']);
    const { demos, exercises } = lessonsFor('Transforms');
    expect(demos.every((l) => l.type === 'demo' && l.section === 'Transforms')).toBe(true);
    expect(exercises.map((l) => l.id)).toEqual(['transforms-exercise-1', 'transforms-exercise-2', 'transforms-exercise-3', 'transforms-exercise-4']);
  });
});

describe('BB-LEARN-05: The drawer opens on the current section and browsing does not change it', () => {
  it('checks the current stop, switches with arrows, and leaves activeSection alone', async () => {
    useVamsStore.setState({ activeSection: 'Transforms', learnOpen: true });
    const host = mount(h(LearnDrawer, {}));
    await settle();
    const checked = () => document.querySelector('[role="radio"][aria-checked="true"]')!.textContent;
    expect(checked()).toContain('Transforms');
    const radio = document.querySelector('[role="radio"][aria-checked="true"]') as HTMLElement;
    radio.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await settle();
    expect(checked()).toContain('Textures');
    expect(useVamsStore.getState().activeSection).toBe('Transforms');
    expect(document.querySelector('.learn-drawer')!.textContent).toContain('First Coat of Paint');
    unmount(host);
  });
});

describe('BB-LEARN-06: The drawer marks complete and in-progress lessons and starts one', () => {
  it('shows a tick, a step count, and starts the chosen lesson in its section', async () => {
    markLessonComplete('transforms-exercise-1');
    recordLessonLeft('transforms-exercise-2', 0);
    useVamsStore.setState({ activeSection: 'Transforms', learnOpen: true });
    const host = mount(h(LearnDrawer, {}));
    await settle();
    const row = (title: string) => [...document.querySelectorAll('.learn-lesson')].find((el) => el.textContent?.includes(title)) as HTMLButtonElement;
    expect(row('Translate to Position').classList.contains('is-complete')).toBe(true);
    expect(row('Rotate to Angle').textContent).toContain('Step 1 of 2');
    row('Build a Hierarchy').click();
    await settle();
    const s = useVamsStore.getState();
    expect(s.appMode).toBe('Lesson');
    expect(s.activeLessonId).toBe('transforms-exercise-3');
    expect(s.activeSection).toBe('Transforms');
    expect(s.learnOpen).toBe(false);
    unmount(host);
  });
});

describe('BB-LEARN-07: Starting another lesson mid-lesson asks first; cancelling keeps the lesson', () => {
  it('keeps the running lesson and step when the student cancels', async () => {
    await startLesson('transforms-exercise-1');
    useVamsStore.getState().setCurrentStep(1);
    const objectsBefore = useVamsStore.getState().objects;
    const pending = startLesson('textures-exercise-1');
    await settle();
    expect(useConfirmStore.getState().open).toBe(true);
    useConfirmStore.getState().handleCancel();
    expect(await pending).toBe(false);
    const s = useVamsStore.getState();
    expect(s.activeLessonId).toBe('transforms-exercise-1');
    expect(s.currentStepIndex).toBe(1);
    expect(s.objects).toBe(objectsBefore);
  });

  it('records the left lesson and starts the new one when confirmed', async () => {
    await startLesson('transforms-exercise-1');
    const pending = startLesson('textures-exercise-1');
    await settle();
    useConfirmStore.getState().handleConfirm();
    expect(await pending).toBe(true);
    expect(useVamsStore.getState().activeLessonId).toBe('textures-exercise-1');
    expect(useVamsStore.getState().activeSection).toBe('Textures');
    expect(readProgress().current?.lessonId).toBe('transforms-exercise-1');
  });
});

describe('BB-LEARN-08: Escape closes the drawer', () => {
  it('sets learnOpen to false', async () => {
    useVamsStore.setState({ learnOpen: true });
    const host = mount(h(LearnDrawer, {}));
    await settle();
    document.querySelector('.learn-drawer')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await settle();
    expect(useVamsStore.getState().learnOpen).toBe(false);
    unmount(host);
  });
});
