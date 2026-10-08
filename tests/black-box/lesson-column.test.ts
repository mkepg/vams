/**
 * BLACK-BOX TEST SUITE — BB-LCOL
 * The lesson column: the runner hook, the lesson card and the editor column in Lesson mode.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useVamsStore } from '@/core/store';
import LessonCard from '@/features/lesson-engine/ui/LessonCard';
import { SegmentedControl } from '@/shared/ui/controls';
import { LESSON_REGISTRY } from '@/features/lesson-engine/model/lesson-registry';
import { EditorColumn } from '@/widgets/layout/editor-column';
import { FOCUS_PANEL_IDS } from '@/core/inspector';
import { focusStyleFor } from '@/features/lesson-engine/model/guidance';
import { showsIllustration } from '@/widgets/canvas/illustration';
import EditorShell from '@/pages/editor/ui/EditorShell';
import ObjectTransformPanel from '@/features/object-transform/ui/ObjectTransformPanel';
import TextNodePanel from '@/features/text-nodes/ui/TextNodePanel';
import SceneHierarchyPanel from '@/features/scene-hierarchy/ui/SceneHierarchyPanel';
import { addTriangle, findById } from '../helpers/store';

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

describe('BB-LCOL-06: In Lesson mode the lesson card sits above the live editor', () => {
  it('shows the card, the scene area and the inspector together', async () => {
    startLesson('transforms-exercise-1');
    const host = mount(h(EditorColumn, {}));
    await settle();
    expect(host.querySelector('.lesson-card')).not.toBeNull();
    expect(host.querySelector('.scene-area')).not.toBeNull();
    expect(host.querySelector('.inspector')).not.toBeNull();
    const card = host.querySelector('.lesson-card')!;
    expect(card.compareDocumentPosition(host.querySelector('.inspector')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount(host);
  });
});

describe('BB-LCOL-07: A demo opens and outlines the step’s group and dims the rest', () => {
  it('focuses Transform in a Transforms demo step', async () => {
    startLesson('transforms-demo-1');
    const host = mount(h(EditorColumn, {}));
    await settle();
    // Step 2 targets object-transform; the demo created and selected its object.
    buttonNamed(host, 'Next')!.click();
    await settle();
    const transform = host.querySelector('[data-group="transform"]')!;
    expect(transform.classList.contains('is-focus')).toBe(true);
    expect(transform.querySelector('.inspector-group__header')!.getAttribute('aria-expanded')).toBe('true');
    expect(transform.querySelector('[data-panel-id="object-transform"]')!.classList.contains('is-lesson-focus')).toBe(true);
    const others = [...host.querySelectorAll('.inspector-group:not([data-group="transform"])')];
    expect(others.length).toBeGreaterThan(0);
    for (const group of others) {
      expect(group.classList.contains('is-dimmed')).toBe(true);
      expect(group.querySelector('.inspector-group__header')!.getAttribute('aria-expanded')).toBe('false');
    }
    unmount(host);
  });
});

describe('BB-LCOL-08: Every lesson focusPanel has a place in the editor', () => {
  it('resolves all ids against the focus map', () => {
    const missing: string[] = [];
    for (const lesson of Object.values(LESSON_REGISTRY)) {
      for (const step of lesson.steps) {
        if (step.focusPanel && !FOCUS_PANEL_IDS.includes(step.focusPanel)) missing.push(`${lesson.id}:${step.focusPanel}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('BB-LCOL-09: Object Transform and Create Text carry the ids lessons use', () => {
  it('renders data-panel-id and the Object Transform title', () => {
    let host = mount(h(ObjectTransformPanel, {}));
    expect(host.querySelector('[data-panel-id="object-transform"]')).not.toBeNull();
    expect(host.querySelector('.vpanel__title')!.textContent).toBe('Object Transform');
    unmount(host);
    host = mount(h(TextNodePanel, {}));
    expect(host.querySelector('[data-panel-id="text-node-panel"]')).not.toBeNull();
    expect(host.querySelector('button[aria-label="Add text"]')).not.toBeNull();
    unmount(host);
  });
});

/** Makes the narrow-layout media query match; returns the restore function. */
function mockNarrow() {
  const realMatchMedia = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
  }));
  return () => {
    window.matchMedia = realMatchMedia;
  };
}
function narrowShell(column: VNode) {
  return mount(h(EditorShell, {
    topBar: h('header', {}, 'top'),
    column,
    canvas: h('div', {}, 'canvas'),
    codeMath: h('div', {}, 'code'),
  }));
}
const panelsToggle = (host: HTMLElement) =>
  [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Panels'))!;

describe('BB-LCOL-10: On narrow screens Esc in the open drawer closes only the drawer', () => {
  it('keeps the lesson running and returns focus to the Panels button', async () => {
    const restore = mockNarrow();
    try {
      startLesson('transforms-exercise-1');
      const host = narrowShell(h('div', {}, h(LessonCard, {}), h('button', { id: 'inside' }, 'inside')));
      await settle();
      const toggle = panelsToggle(host);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      (host.querySelector('#inside') as HTMLElement).focus();
      key(host.querySelector('#inside')!, 'Escape');
      await settle();
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(toggle);
      expect(useVamsStore.getState().appMode).toBe('Lesson');
      unmount(host);
    } finally {
      restore();
    }
  });
});

describe('BB-LCOL-11: Esc in a rename field inside the drawer cancels the rename only', () => {
  it('keeps the old name and the drawer open', async () => {
    const restore = mockNarrow();
    try {
      startLesson('transforms-exercise-1');
      const triangle = addTriangle();
      const originalName = triangle.name;
      const host = narrowShell(h(SceneHierarchyPanel, {}));
      await settle();
      (host.querySelector('button[aria-label^="Rename"]') as HTMLButtonElement).click();
      await settle();
      const input = host.querySelector('.rename-input') as HTMLInputElement;
      input.focus();
      input.value = 'Typed but cancelled';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
      key(input, 'Escape');
      await settle();
      expect(findById(triangle.id)!.name).toBe(originalName);
      expect(panelsToggle(host).getAttribute('aria-expanded')).toBe('true');
      unmount(host);
    } finally {
      restore();
    }
  });
});

describe('BB-LCOL-12: The drawer closes when the lesson ends', () => {
  it('opens for a step and closes on exit', async () => {
    const restore = mockNarrow();
    try {
      startLesson('transforms-exercise-1');
      const host = narrowShell(h('div', {}, 'column'));
      await settle();
      expect(panelsToggle(host).getAttribute('aria-expanded')).toBe('true');
      useVamsStore.getState().clearLessonState();
      useVamsStore.getState().setAppMode('Author');
      await settle();
      expect(panelsToggle(host).getAttribute('aria-expanded')).toBe('false');
      expect(host.querySelector('.editor')!.classList.contains('is-drawer-open')).toBe(false);
      unmount(host);
    } finally {
      restore();
    }
  });
});

describe('BB-LCOL-13: Exit hands focus to the Learn button', () => {
  it('focuses the Learn trigger when the card took focus with it', async () => {
    const learn = document.createElement('button');
    learn.className = 'learn-trigger';
    document.body.appendChild(learn);
    startLesson('transforms-exercise-1');
    const host = mount(h(EditorColumn, {}));
    await settle();
    const exit = buttonNamed(host, 'Exit')!;
    exit.focus();
    exit.click();
    await settle();
    expect(useVamsStore.getState().appMode).toBe('Author');
    expect(document.activeElement).toBe(learn);
    unmount(host);
    learn.remove();
  });

  it('leaves focus alone when it is elsewhere', async () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    startLesson('transforms-exercise-1');
    const host = mount(h(EditorColumn, {}));
    await settle();
    outside.focus();
    useVamsStore.getState().clearLessonState();
    useVamsStore.getState().setAppMode('Author');
    await settle();
    expect(document.activeElement).toBe(outside);
    unmount(host);
    outside.remove();
  });
});

describe('BB-LCOL-14: Arrow keys inside a radiogroup do not move the lesson', () => {
  it('keeps the step index when ArrowLeft and ArrowRight change a segmented control', async () => {
    startLesson('transforms-demo-1');
    useVamsStore.getState().setCurrentStep(1);
    const onChange = vi.fn();
    const host = mount(h('div', {},
      h(LessonCard, {}),
      h(SegmentedControl, {
        label: 'Mode',
        options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }],
        value: 'b',
        onChange,
      }),
    ));
    await settle();
    const radio = host.querySelector('[role="radio"][aria-checked="true"]') as HTMLElement;
    radio.focus();
    key(radio, 'ArrowRight');
    await settle();
    expect(useVamsStore.getState().currentStepIndex).toBe(1);
    key(radio, 'ArrowLeft');
    await settle();
    expect(useVamsStore.getState().currentStepIndex).toBe(1);
    expect(onChange).toHaveBeenCalledTimes(2);
    // The same keys on the page still move the lesson.
    key(document.body, 'ArrowRight');
    await settle();
    expect(useVamsStore.getState().currentStepIndex).toBe(2);
    unmount(host);
  });
});

describe('BB-LCOL-15: On narrow screens Esc outside the open drawer closes the drawer first', () => {
  it('closes the drawer from the Panels button and keeps the lesson running', async () => {
    const restore = mockNarrow();
    try {
      startLesson('transforms-exercise-1');
      const host = narrowShell(h('div', {}, h(LessonCard, {})));
      await settle();
      const toggle = panelsToggle(host);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      toggle.focus();
      key(toggle, 'Escape');
      await settle();
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(toggle);
      expect(useVamsStore.getState().appMode).toBe('Lesson');
      // With the drawer closed, Esc exits the lesson again.
      key(toggle, 'Escape');
      await settle();
      expect(useVamsStore.getState().appMode).toBe('Author');
      unmount(host);
    } finally {
      restore();
    }
  });
});

describe('BB-LCOL-16: Starting a lesson moves focus to the lesson title', () => {
  it('focuses the title when focus fell to the page, and leaves it alone otherwise', async () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    startLesson('transforms-exercise-1');
    let host = mount(h(LessonCard, {}));
    await settle();
    expect(document.activeElement).toBe(host.querySelector('.lesson-card__title'));
    unmount(host);
    useVamsStore.getState().clearLessonState();
    useVamsStore.setState({ appMode: 'Author' });

    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    startLesson('transforms-exercise-1');
    host = mount(h(LessonCard, {}));
    await settle();
    expect(document.activeElement).toBe(outside);
    unmount(host);
    outside.remove();
  });
});

describe('BB-LCOL-17: The narration is one live region across steps', () => {
  it('keeps the same aria-live element and changes its text', async () => {
    startLesson('transforms-demo-1');
    const host = mount(h(LessonCard, {}));
    await settle();
    const region = host.querySelector('[aria-live="polite"]')!;
    expect(region.textContent).toContain('Welcome to Transforms');
    buttonNamed(host, 'Next')!.click();
    await settle();
    expect(host.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
    expect(host.querySelector('[aria-live="polite"]')).toBe(region);
    expect(region.textContent).toContain('Translate moves the shape');
    unmount(host);
  });
});

describe('BB-LCOL-18: Guidance fades through a section', () => {
  it('is tight for demos, an outline for exercises, and none for each section’s last exercise', () => {
    const lastExercise = new Map<string, string>();
    for (const lesson of Object.values(LESSON_REGISTRY)) if (lesson.type === 'exercise') lastExercise.set(lesson.section, lesson.id);
    for (const lesson of Object.values(LESSON_REGISTRY)) {
      const expected = lesson.type === 'demo' ? 'tight' : lastExercise.get(lesson.section) === lesson.id ? 'none' : 'outline';
      expect(focusStyleFor(lesson), lesson.id).toBe(expected);
    }
    expect(focusStyleFor(LESSON_REGISTRY['transforms-exercise-4'])).toBe('none');
    expect(focusStyleFor(LESSON_REGISTRY['transforms-exercise-1'])).toBe('outline');
  });
});

describe('BB-LCOL-19: An exercise outlines its group and dims nothing; the last exercise focuses nothing', () => {
  it('outlines Transform in transforms-exercise-1 and sets no focus in transforms-exercise-4', async () => {
    startLesson('transforms-exercise-1');
    let host = mount(h(EditorColumn, {}));
    await settle();
    expect(host.querySelector('[data-group="transform"]')!.classList.contains('is-focus')).toBe(true);
    expect(host.querySelectorAll('.inspector-group.is-dimmed')).toHaveLength(0);
    unmount(host);
    useVamsStore.getState().clearLessonState();
    useVamsStore.setState({ appMode: 'Author' });

    startLesson('transforms-exercise-4');
    host = mount(h(EditorColumn, {}));
    await settle();
    expect(useVamsStore.getState().lessonFocusPanel).toBeNull();
    expect(host.querySelectorAll('.is-focus, .is-lesson-focus')).toHaveLength(0);
    unmount(host);
  });
});

describe('BB-LCOL-20: A per-object focus selects the newest object, and never crashes on an empty scene', () => {
  it('selects the lesson’s object when nothing is selected', async () => {
    startLesson('transforms-exercise-1');
    const host = mount(h(EditorColumn, {}));
    await settle();
    const s = useVamsStore.getState();
    expect(s.objects.length).toBeGreaterThan(0);
    expect(s.selectedObjectId).toBe(s.objects[0].id);
    unmount(host);
  });

  it('shows scene settings when there is nothing to select', async () => {
    startLesson('transforms-exercise-1');
    const host = mount(h(EditorColumn, {}));
    await settle();
    useVamsStore.setState({ objects: [], selectedObjectId: null, lessonFocusPanel: 'object-transform' });
    await settle();
    expect(host.querySelector('.inspector__name')!.textContent).toBe('Scene settings');
    unmount(host);
  });
});

describe('BB-LCOL-21: The Pipeline illustrations appear only during Pipeline lessons', () => {
  // The router mounts the PixiJS canvas, which cannot initialise under happy-dom; the decision it
  // renders from is checked directly.
  it('shows the diagram in a Pipeline lesson and the scene canvas otherwise', () => {
    expect(showsIllustration({ appMode: 'Author', activeSection: 'Pipeline', pipelineMode: 'Diagram' })).toBe(false);
    expect(showsIllustration({ appMode: 'Lesson', activeSection: 'Pipeline', pipelineMode: 'Diagram' })).toBe(true);
    expect(showsIllustration({ appMode: 'Lesson', activeSection: 'Pipeline', pipelineMode: 'Playground' })).toBe(false);
  });
});
