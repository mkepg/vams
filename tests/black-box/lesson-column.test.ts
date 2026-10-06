/**
 * BLACK-BOX TEST SUITE — BB-LCOL
 * The lesson column: the runner hook, the lesson card and panel focus.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useVamsStore } from '@/core/store';
import LessonCard from '@/features/lesson-engine/ui/LessonCard';

async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}
function mount(vnode: VNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(vnode, host);
  return host;
}
function unmount(host: HTMLElement) {
  render(null, host);
  host.remove();
}
function key(target: EventTarget, k: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

function startLesson(id: string, section: 'Transforms' | 'Pipeline' = 'Transforms') {
  useVamsStore.setState({ activeSection: section });
  useVamsStore.getState().setActiveLesson(id);
  useVamsStore.getState().setAppMode('Lesson');
}
function buttonNamed(host: HTMLElement, text: string) {
  return [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined;
}

afterEach(() => {
  useVamsStore.getState().clearLessonState();
  useVamsStore.setState({ appMode: 'Author' });
});

describe('BB-LCOL-01: The lesson card renders nothing outside a lesson', () => {
  it('is empty in Author mode', () => {
    const host = mount(h(LessonCard, {}));
    expect(host.innerHTML).toBe('');
    unmount(host);
  });
});

describe('BB-LCOL-02: The card shows type, title, progress and narration', () => {
  it('waits for the student on an exercise step', async () => {
    startLesson('transforms-exercise-1');
    const host = mount(h(LessonCard, {}));
    await settle();
    expect(host.querySelector('.lesson-card__chip')!.textContent).toBe('Exercise');
    expect(host.querySelector('.lesson-card__title')!.textContent).toBe('Translate to Position');
    const progress = host.querySelector('[role="progressbar"]')!;
    expect(progress.getAttribute('aria-valuenow')).toBe('1');
    expect(progress.getAttribute('aria-valuemax')).toBe('2');
    expect(host.querySelector('.lesson-card__narration')!.textContent).toContain('Move the triangle to (0.5,');
    expect(buttonNamed(host, 'Next')!.disabled).toBe(true);
    expect(buttonNamed(host, 'Back')!.disabled).toBe(true);
    expect(host.textContent).toContain('Waiting for you');
    unmount(host);
  });
});

describe('BB-LCOL-03: Meeting the success check enables Next; the last step says Finish', () => {
  it('advances when the triangle is moved to the target', async () => {
    startLesson('transforms-exercise-1');
    const host = mount(h(LessonCard, {}));
    await settle();
    const state = useVamsStore.getState();
    const id = state.objects[0].id;
    useVamsStore.setState({ selectedObjectId: id });
    useVamsStore.getState().updateObjectTransform(id, { translateX: 0.5, translateY: -0.3 });
    await settle();
    const next = buttonNamed(host, 'Next')!;
    expect(next.disabled).toBe(false);
    next.click();
    await settle();
    expect(host.querySelector('.lesson-card__narration')!.textContent).toContain('Spot on!');
    expect(buttonNamed(host, 'Finish')).toBeDefined();
    unmount(host);
  });
});

describe('BB-LCOL-04: Finish and Exit return to Author mode', () => {
  it('Finish on the last step ends the lesson', async () => {
    startLesson('transforms-exercise-1');
    useVamsStore.getState().setCurrentStep(1);
    const host = mount(h(LessonCard, {}));
    await settle();
    buttonNamed(host, 'Finish')!.click();
    await settle();
    expect(useVamsStore.getState().appMode).toBe('Author');
    expect(useVamsStore.getState().activeLessonId).toBeNull();
    unmount(host);
  });
});

describe('BB-LCOL-05: Esc on the window exits the lesson', () => {
  it('keeps the global lesson keys', async () => {
    startLesson('transforms-exercise-1');
    const host = mount(h(LessonCard, {}));
    await settle();
    key(window, 'Escape');
    await settle();
    expect(useVamsStore.getState().appMode).toBe('Author');
    unmount(host);
  });
});
