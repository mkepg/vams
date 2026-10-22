/**
 * BLACK-BOX TEST SUITE — BB-LCOL
 * The lesson column: the runner hook, the lesson bar and the editor column in Lesson mode.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useLayoutEffect } from 'preact/hooks';
import { useVamsStore } from '@/core/store';
import type { Lesson } from '@/core/types/lesson';
import LessonBar from '@/features/lesson-engine/ui/LessonBar';
import CanvasHeader from '@/widgets/canvas/ui/CanvasHeader';
import { SegmentedControl } from '@/shared/ui/controls';
import { LESSON_REGISTRY, getLessonById } from '@/features/lesson-engine/model/lesson-registry';
import * as registry from '@/features/lesson-engine/model/lesson-registry';
import { SAMPLE_LESSONS } from '@/features/lesson-engine/model/sample-lessons';
import { LESSON_CATALOG, courseOrder, nextInCourse } from '@/features/lesson-engine/model/catalog';
import { PROGRESS_KEY } from '@/features/lesson-engine/model/progress';
import { courseMap, useLessonRunner, type LessonRunner } from '@/features/lesson-engine/model/useLessonRunner';
import { EditorPanel } from '@/widgets/layout/editor-column';
import Rail from '@/widgets/layout/rail';
import CodeMathColumn from '@/widgets/layout/code-math-column';
import { DEFAULT_OPEN_GROUPS, FOCUS_PANEL_IDS, journeyStageFor } from '@/core/inspector';
import { startLesson as startLessonFromLearn } from '@/features/lesson-engine/model/start-lesson';
import { focusStyleFor } from '@/features/lesson-engine/model/guidance';
import { showsIllustration } from '@/core/store/illustration';
import ObjectTransformPanel from '@/features/object-transform/ui/ObjectTransformPanel';
import TextNodePanel from '@/features/text-nodes/ui/TextNodePanel';
import SceneHierarchyPanel from '@/features/scene-hierarchy/ui/SceneHierarchyPanel';
import MathPanel from '@/features/math-panel/ui/MathPanel';
import SceneCodePanel from '@/features/code-generation/ui/SceneCodePanel';
import { addQuad, addTriangle, findById } from '../helpers/store';

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

function startLesson(id: string, section: 'Transforms' | 'Pipeline' | 'Textures' | 'Primitives' = 'Transforms') {
  useVamsStore.setState({ activeSection: section });
  useVamsStore.getState().setActiveLesson(id);
  useVamsStore.getState().setAppMode('Lesson');
}
function buttonNamed(host: HTMLElement, text: string) {
  return [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined;
}
const exitButton = (host: HTMLElement) => host.querySelector('button[aria-label="Exit lesson (Esc)"]') as HTMLButtonElement;
/** The lesson bar with the open panel, as the editor lays them out. */
const lessonEditor = () => h('div', {}, h(LessonBar, {}), h(EditorPanel, {}));

afterEach(() => {
  useVamsStore.getState().clearLessonState();
  useVamsStore.setState({ appMode: 'Author' });
  vi.unstubAllEnvs();
});

describe('BB-LCOL-01: The lesson bar renders nothing outside a lesson', () => {
  it('is empty in Author mode', () => {
    const host = mount(h(LessonBar, {}));
    expect(host.innerHTML).toBe('');
    unmount(host);
  });
});

describe('BB-LCOL-02: The bar shows the title, the step, a progress hairline and the narration', () => {
  it('waits for the student on an exercise step', async () => {
    startLesson('transforms-exercise-1');
    const host = mount(h(LessonBar, {}));
    await settle();
    expect(host.querySelector('.lesson-bar__title')!.textContent).toBe('Translate to Position');
    expect(host.querySelector('.lesson-bar__step')!.textContent).toBe('Step 1 of 5');
    expect(host.querySelector('.lesson-card__chip, .lesson-bar__chip')).toBeNull();
    const progress = host.querySelector('[role="progressbar"]') as HTMLElement;
    expect(progress.getAttribute('aria-valuenow')).toBe('1');
    expect(progress.getAttribute('aria-valuemax')).toBe('5');
    expect((progress.firstElementChild as HTMLElement).style.width).toBe('20%');
    expect(host.querySelector('.lesson-bar__narration')!.textContent).toContain('Move the triangle to (0.5,');
    expect(buttonNamed(host, 'Next')!.disabled).toBe(true);
    expect(buttonNamed(host, 'Back')!.disabled).toBe(true);
    expect(host.querySelector('.lesson-bar__goal')!.textContent).toContain('At (0.5, −0.3)');
    unmount(host);
  });
});

describe('BB-LCOL-03: Meeting the success check enables Next; the last step names the next lesson', () => {
  it('advances when the triangle is moved to the target, then names and starts the next lesson', async () => {
    startLesson('transforms-exercise-1');
    const host = mount(h(LessonBar, {}));
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
    expect(host.querySelector('.lesson-bar__narration')!.textContent).toContain('Spot on!');
    useVamsStore.getState().setCurrentStep(LESSON_REGISTRY['transforms-exercise-1'].steps.length - 1);
    await settle();
    expect(buttonNamed(host, 'Finish')).toBeUndefined();
    const named = buttonNamed(host, 'Rotate to Angle')!;
    expect(named.title).toBe('Next lesson: Rotate to Angle');
    named.click();
    await settle();
    expect(useVamsStore.getState().activeLessonId).toBe('transforms-exercise-2');
    expect(useVamsStore.getState().currentStepIndex).toBe(0);
    expect(host.querySelector('.lesson-bar__title')!.textContent).toBe('Rotate to Angle');
    unmount(host);
  });
});

describe('BB-LCOL-04: The named Next stays in Lesson mode, and Exit returns to Author mode', () => {
  it('the last step starts the next lesson, still in Lesson mode, and Exit then ends it', async () => {
    startLesson('transforms-exercise-1');
    useVamsStore.getState().setCurrentStep(LESSON_REGISTRY['transforms-exercise-1'].steps.length - 1);
    const host = mount(h(LessonBar, {}));
    await settle();
    buttonNamed(host, 'Rotate to Angle')!.click();
    await settle();
    expect(useVamsStore.getState().appMode).toBe('Lesson');
    expect(useVamsStore.getState().activeLessonId).toBe('transforms-exercise-2');
    expect(host.querySelector('.lesson-bar__step')!.textContent).toBe('Step 1 of 5');
    exitButton(host).click();
    await settle();
    expect(useVamsStore.getState().appMode).toBe('Author');
    expect(useVamsStore.getState().activeLessonId).toBeNull();
    unmount(host);
  });
});

describe('BB-LCOL-05: Esc on the window exits the lesson', () => {
  it('keeps the global lesson keys', async () => {
    startLesson('transforms-exercise-1');
    const host = mount(h(LessonBar, {}));
    await settle();
    key(window, 'Escape');
    await settle();
    expect(useVamsStore.getState().appMode).toBe('Author');
    unmount(host);
  });
});

describe('BB-LCOL-06: In Lesson mode the lesson bar sits beside the live panels', () => {
  it('shows the bar and the step’s panel, with no lesson card', async () => {
    startLesson('transforms-exercise-1');
    const host = mount(lessonEditor());
    await settle();
    expect(host.querySelector('.lesson-bar')).not.toBeNull();
    expect(host.querySelector('.editor-panel .rail-panel')).not.toBeNull();
    expect(host.querySelector('.lesson-card')).toBeNull();
    unmount(host);
  });
});

describe('BB-LCOL-07: A demo opens and outlines the step’s group and dims the rest', () => {
  it('focuses Transform in a Transforms demo step', async () => {
    startLesson('transforms-demo-1');
    const host = mount(lessonEditor());
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
async function narrowShell(panel: VNode) {
  const { default: Shell } = await import('@/pages/editor/ui/EditorShell');
  return mount(h(Shell, {
    topBar: h('header', {}, 'top'),
    rail: h(Rail, {}),
    panel,
    canvas: h('div', {}, 'canvas'),
    lessonBar: h(LessonBar, {}),
    codeMath: h('div', {}, 'code'),
  }));
}
const drawerOpen = () => !useVamsStore.getState().railHidden;

describe('BB-LCOL-10: On narrow screens Esc in the open drawer closes only the drawer', () => {
  it('keeps the lesson running and returns focus to the rail', async () => {
    const restore = mockNarrow();
    try {
      startLesson('transforms-exercise-1');
      const host = await narrowShell(h('button', { id: 'inside' }, 'inside'));
      await settle();
      useVamsStore.getState().setRailPanel('scene');
      await settle();
      expect(drawerOpen()).toBe(true);
      (host.querySelector('#inside') as HTMLElement).focus();
      key(host.querySelector('#inside')!, 'Escape');
      await settle();
      expect(drawerOpen()).toBe(false);
      expect(document.activeElement).toBe(host.querySelector('#rail-tab-scene'));
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
      const host = await narrowShell(h(SceneHierarchyPanel, {}));
      await settle();
      // The lesson bar sets up the step's scene when it mounts, so the object is added after it.
      const triangle = addTriangle();
      const originalName = triangle.name;
      useVamsStore.getState().setRailPanel('scene');
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
      expect(drawerOpen()).toBe(true);
      unmount(host);
    } finally {
      restore();
    }
  });
});

describe('BB-LCOL-12: The drawer closes when the lesson ends', () => {
  it('opens for a step’s panel and closes on exit', async () => {
    const restore = mockNarrow();
    try {
      startLesson('transforms-demo-1');
      const host = await narrowShell(h('div', {}, 'panel'));
      await settle();
      buttonNamed(host, 'Next')!.click();
      await settle();
      expect(useVamsStore.getState().lessonFocusPanel).toBe('object-transform');
      expect(drawerOpen()).toBe(true);
      useVamsStore.getState().clearLessonState();
      useVamsStore.getState().setAppMode('Author');
      await settle();
      expect(drawerOpen()).toBe(false);
      expect(host.querySelector('.editor')!.classList.contains('is-panel-hidden')).toBe(true);
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
    const host = mount(lessonEditor());
    await settle();
    const exit = exitButton(host);
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
    const host = mount(lessonEditor());
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
      h(LessonBar, {}),
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
  it('closes the drawer from the rail and keeps the lesson running', async () => {
    const restore = mockNarrow();
    try {
      startLesson('transforms-exercise-1');
      const host = await narrowShell(h('div', {}, 'panel'));
      await settle();
      useVamsStore.getState().setRailPanel('scene');
      await settle();
      const tab = host.querySelector('#rail-tab-scene') as HTMLButtonElement;
      tab.focus();
      key(tab, 'Escape');
      await settle();
      expect(drawerOpen()).toBe(false);
      expect(document.activeElement).toBe(tab);
      expect(useVamsStore.getState().appMode).toBe('Lesson');
      // With the drawer closed, Esc exits the lesson again.
      key(tab, 'Escape');
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
    let host = mount(h(LessonBar, {}));
    await settle();
    expect(document.activeElement).toBe(host.querySelector('.lesson-bar__title'));
    unmount(host);
    useVamsStore.getState().clearLessonState();
    useVamsStore.setState({ appMode: 'Author' });

    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    startLesson('transforms-exercise-1');
    host = mount(h(LessonBar, {}));
    await settle();
    expect(document.activeElement).toBe(outside);
    unmount(host);
    outside.remove();
  });
});

describe('BB-LCOL-17: The narration is one live region across steps', () => {
  it('keeps the same aria-live element and changes its text', async () => {
    startLesson('transforms-demo-1');
    const host = mount(h(LessonBar, {}));
    await settle();
    const region = host.querySelector('[aria-live="polite"]')!;
    expect(region.textContent).toContain('So far every shape stayed');
    buttonNamed(host, 'Next')!.click();
    await settle();
    expect(host.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
    expect(host.querySelector('[aria-live="polite"]')).toBe(region);
    expect(region.textContent).toContain('Transform group holds where it is');
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
    expect(focusStyleFor(LESSON_REGISTRY['transforms-exercise-6'])).toBe('none');
    expect(focusStyleFor(LESSON_REGISTRY['transforms-exercise-1'])).toBe('outline');
  });
});

describe('BB-LCOL-19: An exercise outlines its group and dims nothing; the last exercise focuses nothing', () => {
  it('outlines Transform in transforms-exercise-1 and sets no focus in transforms-exercise-6', async () => {
    startLesson('transforms-exercise-1');
    let host = mount(lessonEditor());
    await settle();
    expect(host.querySelector('[data-group="transform"]')!.classList.contains('is-focus')).toBe(true);
    expect(host.querySelectorAll('.inspector-group.is-dimmed')).toHaveLength(0);
    unmount(host);
    useVamsStore.getState().clearLessonState();
    useVamsStore.setState({ appMode: 'Author' });

    startLesson('transforms-exercise-6');
    host = mount(lessonEditor());
    await settle();
    expect(useVamsStore.getState().lessonFocusPanel).toBeNull();
    expect(host.querySelectorAll('.is-focus, .is-lesson-focus')).toHaveLength(0);
    unmount(host);
  });
});

describe('BB-LCOL-20: A per-object focus selects the newest object, and never crashes on an empty scene', () => {
  it('selects the lesson’s object when nothing is selected', async () => {
    startLesson('transforms-exercise-1');
    const host = mount(lessonEditor());
    await settle();
    const s = useVamsStore.getState();
    expect(s.objects.length).toBeGreaterThan(0);
    expect(s.selectedObjectId).toBe(s.objects[0].id);
    unmount(host);
  });

  it('selects the newest object when a step moves to a per-object focus with nothing selected', async () => {
    startLesson('transforms-demo-1');
    const host = mount(lessonEditor());
    await settle();
    useVamsStore.setState({ selectedObjectId: null });
    await settle();
    // Step 2 focuses object-transform.
    buttonNamed(host, 'Next')!.click();
    await settle();
    const s = useVamsStore.getState();
    expect(s.lessonFocusPanel).toBe('object-transform');
    expect(s.objects.length).toBeGreaterThan(0);
    expect(s.selectedObjectId).toBe(s.objects[0].id);
    unmount(host);
  });

  it('points to Settings when there is nothing to select', async () => {
    startLesson('transforms-exercise-1');
    const host = mount(lessonEditor());
    await settle();
    useVamsStore.setState({ objects: [], selectedObjectId: null, lessonFocusPanel: 'object-transform', railPanel: 'scene' });
    await settle();
    expect(host.querySelector('.inspector__empty')!.textContent).toBe('Select an object to edit it');
    expect(host.querySelector('.inspector__link')!.textContent).toBe('Scene settings are in Settings');
    unmount(host);
  });
});

describe('BB-LCOL-21: The Pipeline illustrations appear in the Pipeline section, in both modes', () => {
  // The router mounts the PixiJS canvas, which cannot initialise under happy-dom; the decision it
  // renders from is checked directly.
  it('shows the diagram in the Pipeline section and the scene canvas otherwise', () => {
    expect(showsIllustration({ activeSection: 'Pipeline', pipelineMode: 'Diagram', quizPipelineStage: null })).toBe(true);
    expect(showsIllustration({ activeSection: 'Transforms', pipelineMode: 'Diagram', quizPipelineStage: null })).toBe(false);
    expect(showsIllustration({ activeSection: 'Pipeline', pipelineMode: 'Playground', quizPipelineStage: null })).toBe(false);
    expect(showsIllustration({ activeSection: 'Pipeline', pipelineMode: 'Playground', quizPipelineStage: 3 })).toBe(true);
  });
});

describe('BB-LCOL-22: A demo scrolls to the focused group on its final layout', () => {
  it('scrolls to Texture once Transform above it has collapsed and Texture has opened', async () => {
    startLesson('textures-demo-1', 'Textures');
    const host = mount(lessonEditor());
    await settle();
    // Step 2 places a quad; step 3 focuses texture-attach, below the open Transform group.
    buttonNamed(host, 'Next')!.click();
    await settle();
    const expanded = (group: string) =>
      host.querySelector(`[data-group="${group}"] .inspector-group__header`)?.getAttribute('aria-expanded') ?? 'absent';
    expect(expanded('transform')).toBe('true');
    const root = host.querySelector<HTMLElement>('[data-scroll-root]')!;
    const layoutAtScroll: string[] = [];
    Object.defineProperty(root, 'scrollTop', {
      configurable: true,
      get: () => 0,
      set: () => {
        layoutAtScroll.push(`transform=${expanded('transform')} texture=${expanded('texture')}`);
      },
    });
    buttonNamed(host, 'Next')!.click();
    await settle();
    expect(host.querySelector('[data-group="texture"]')!.classList.contains('is-focus')).toBe(true);
    expect(layoutAtScroll).toEqual(['transform=false texture=true']);
    unmount(host);
  });

  it('scrolls after the card shows the new step when consecutive steps share a group', async () => {
    startLesson('primitives-demo-3', 'Primitives');
    const host = mount(lessonEditor());
    await settle();
    // Steps 2 and 3 both focus line-style-panel; step 3's narration is longer, so the card grows.
    buttonNamed(host, 'Next')!.click();
    await settle();
    const root = host.querySelector<HTMLElement>('[data-scroll-root]')!;
    const narrationAtScroll: string[] = [];
    Object.defineProperty(root, 'scrollTop', {
      configurable: true,
      get: () => 0,
      set: () => {
        narrationAtScroll.push(host.querySelector('.lesson-bar__narration')!.textContent ?? '');
      },
    });
    buttonNamed(host, 'Next')!.click();
    await settle();
    expect(narrationAtScroll.length).toBeGreaterThan(0);
    for (const text of narrationAtScroll) expect(text).toContain('stipple pattern of 16 bits');
    unmount(host);
  });
});

describe('BB-LCOL-23: Leaving a lesson leaves the plain editor, and starting one forgets the opened group', () => {
  it('restores the default open groups and clears the last opened group on exit', async () => {
    startLesson('transforms-demo-4');
    const host = mount(lessonEditor());
    try {
      await settle();
      // The glOrtho demo collapses everything but Viewing volume.
      expect(useVamsStore.getState().openGroups).toEqual(['viewing-volume']);
      useVamsStore.getState().toggleGroup('callbacks');
      expect(useVamsStore.getState().lastOpenedGroup).toBe('callbacks');
      exitButton(host).click();
      await settle();
      const s = useVamsStore.getState();
      expect(s.appMode).toBe('Author');
      expect(s.openGroups).toEqual([...DEFAULT_OPEN_GROUPS]);
      expect(s.lastOpenedGroup).toBeNull();
    } finally {
      unmount(host);
    }
  });

  it('forgets a group the student opened before the lesson, even in the same section', async () => {
    useVamsStore.setState({ activeSection: 'Transforms' });
    // Viewing volume starts open, so the first toggle closes it and the second opens it again.
    useVamsStore.getState().toggleGroup('viewing-volume');
    useVamsStore.getState().toggleGroup('viewing-volume');
    expect(useVamsStore.getState().lastOpenedGroup).toBe('viewing-volume');
    expect(await startLessonFromLearn('transforms-exercise-6')).toBe(true);
    expect(useVamsStore.getState().lastOpenedGroup).toBeNull();
    expect(journeyStageFor(useVamsStore.getState())).toBe('transformed');
  });
});

describe('BB-LCOL-24: Focus on the Scene list shows the Scene panel, and a new lesson starts at the top', () => {
  it('shows and outlines the Scene list when Back returns to its step', async () => {
    startLesson('transforms-demo-1');
    const host = mount(lessonEditor());
    try {
      await settle();
      buttonNamed(host, 'Next')!.click();
      await settle();
      expect(useVamsStore.getState().lessonFocusPanel).toBe('object-transform');
      useVamsStore.setState({ railPanel: 'settings' });
      buttonNamed(host, 'Back')!.click();
      await settle();
      expect(useVamsStore.getState().lessonFocusPanel).toBe('scene-hierarchy');
      expect(useVamsStore.getState().railPanel).toBe('scene');
      expect(host.querySelector('[data-panel-id="scene-hierarchy"]')!.classList.contains('is-lesson-focus')).toBe(true);
    } finally {
      unmount(host);
    }
  });

  it('resets the open panel to the top when a lesson starts', async () => {
    useVamsStore.setState({ railPanel: 'settings', railHidden: false });
    const host = mount(lessonEditor());
    try {
      await settle();
      const root = host.querySelector<HTMLElement>('[data-scroll-root]')!;
      const writes: number[] = [];
      Object.defineProperty(root, 'scrollTop', { configurable: true, get: () => 400, set: (v: number) => writes.push(v) });
      // The section's last exercise has no focus, so nothing else scrolls the panel.
      startLesson('transforms-exercise-6');
      await settle();
      expect(writes).toEqual([0]);
    } finally {
      unmount(host);
    }
  });
});

describe('BB-LCOL-25: The task line waits for the student and says Done when the step passes', () => {
  const ID = 'test-task-line-lesson';
  it('falls back to "Waiting for you", shows the step’s task, and turns to Done', async () => {
    const lesson: Lesson = {
      id: ID,
      title: 'Task line',
      type: 'exercise',
      section: 'Transforms',
      steps: [
        {
          narration: 'Move the triangle to (0.5, −0.3).',
          action: (state) => state.addCustomObject('TRIANGLES', [{ x: 0, y: 0.5 }, { x: -0.5, y: -0.5 }, { x: 0.5, y: -0.5 }]),
          successCheck: (state) => {
            const t = state.objects[0]?.transform;
            return !!t && Math.abs(t.translateX - 0.5) < 0.01 && Math.abs(t.translateY + 0.3) < 0.01;
          },
        },
        { narration: 'Moved.' },
      ],
    };
    LESSON_REGISTRY[ID] = lesson;
    let host: HTMLElement | null = null;
    try {
      startLesson(ID);
      host = mount(h(LessonBar, {}));
      await settle();
      expect(host.querySelector('.lesson-bar__task')!.textContent).toBe('Waiting for you');
      expect(host.querySelector('.lesson-bar__task')!.classList.contains('is-done')).toBe(false);
      unmount(host);
      host = null;
      useVamsStore.getState().clearLessonState();
      useVamsStore.setState({ appMode: 'Author' });

      lesson.steps[0].task = 'Move the triangle to (0.5, −0.3)';
      startLesson(ID);
      host = mount(h(LessonBar, {}));
      await settle();
      expect(host.querySelector('.lesson-bar__task')!.textContent).toBe('Move the triangle to (0.5, −0.3)');
      const id = useVamsStore.getState().objects[0].id;
      useVamsStore.getState().updateObjectTransform(id, { translateX: 0.5, translateY: -0.3 });
      await settle();
      const task = host.querySelector('.lesson-bar__task')!;
      expect(task.classList.contains('is-done')).toBe(true);
      expect(task.textContent).toBe('Done · Move the triangle to (0.5, −0.3)');
    } finally {
      if (host) unmount(host);
      useVamsStore.getState().clearLessonState();
      delete LESSON_REGISTRY[ID];
    }
  });
});

describe('BB-LCOL-26: Folding leaves a strip with the title, the step and Next; a new step unfolds it', () => {
  it('folds, keeps Next working, and unfolds on the next step', async () => {
    startLesson('transforms-demo-1');
    const host = mount(h(LessonBar, {}));
    await settle();
    (host.querySelector('button[aria-label="Fold lesson"]') as HTMLButtonElement).click();
    await settle();
    expect(host.querySelector('.lesson-bar')!.classList.contains('is-folded')).toBe(true);
    expect(host.querySelector('.lesson-bar__narration')).toBeNull();
    expect(host.querySelector('.lesson-bar__step')!.textContent).toBe('Step 1 of 10');
    expect(host.querySelector('button[aria-label="Unfold lesson"]')).not.toBeNull();
    buttonNamed(host, 'Next')!.click();
    await settle();
    expect(host.querySelector('.lesson-bar')!.classList.contains('is-folded')).toBe(false);
    expect(host.querySelector('.lesson-bar__narration')!.textContent).toContain('Transform group holds where it is');
    unmount(host);
  });
});

describe('BB-LCOL-27: Pipeline lessons switch the canvas view from the canvas header', () => {
  it('shows the viewport modes as a radiogroup in the canvas header', async () => {
    const pipeline = Object.values(LESSON_REGISTRY).find((l) => l.section === 'Pipeline' && l.type === 'demo')!;
    startLesson(pipeline.id, 'Pipeline');
    const host = mount(h('div', {}, h(CanvasHeader, {}), h(LessonBar, {})));
    await settle();
    expect(host.querySelector('.lesson-bar__modes')).toBeNull();
    const modes = host.querySelector('.canvas-header [data-panel-id="pipeline-mode-controls"] [role="radiogroup"]')!;
    expect(modes.getAttribute('aria-label')).toBe('Viewport mode');
    expect([...modes.querySelectorAll('[role="radio"]')].map((r) => r.textContent)).toEqual(['Diagram', 'Raster vs vector', 'Playground']);
    (modes.querySelector('[role="radio"]') as HTMLButtonElement).click();
    expect(useVamsStore.getState().pipelineMode).toBe('Diagram');
    unmount(host);
    useVamsStore.setState({ pipelineMode: 'Playground' });
  });
});

describe('BB-LCOL-28: Quiz rows stay plain and still pass and fail as before', () => {
  it('letters each option, keeps a wrong answer clickable, and enables Next on the right one', async () => {
    // A lesson without a shuffled range, so the registry's step index is the runner's.
    const lesson = Object.values(LESSON_REGISTRY).find(
      (l) => !l.shuffleRange && l.steps.some((s) => s.exercise?.kind === 'multiple-choice'),
    )!;
    const stepIndex = lesson.steps.findIndex((s) => s.exercise?.kind === 'multiple-choice');
    const exercise = lesson.steps[stepIndex].exercise as Extract<NonNullable<typeof lesson.steps[number]['exercise']>, { kind: 'multiple-choice' }>;
    useVamsStore.setState({ activeSection: lesson.section });
    useVamsStore.getState().setActiveLesson(lesson.id);
    useVamsStore.getState().setAppMode('Lesson');
    useVamsStore.getState().setCurrentStep(stepIndex);
    const host = mount(h(LessonBar, {}));
    await settle();
    const options = [...host.querySelectorAll<HTMLButtonElement>('.mc-option')];
    expect(options.map((o) => o.querySelector('.opt-letter')!.textContent)).toEqual(options.map((_, i) => String.fromCharCode(65 + i)));
    const wrong = options.find((o) => o.querySelector('.opt-label')!.textContent !== exercise.options.find((x) => x.id === exercise.correctId)!.label)!;
    wrong.click();
    await settle();
    expect(wrong.classList.contains('wrong')).toBe(true);
    expect(wrong.disabled).toBe(false);
    const right = options.find((o) => o.querySelector('.opt-label')!.textContent === exercise.options.find((x) => x.id === exercise.correctId)!.label)!;
    right.click();
    await settle();
    expect(right.classList.contains('correct')).toBe(true);
    expect((buttonNamed(host, 'Next') ?? buttonNamed(host, 'Finish'))!.disabled).toBe(false);
    unmount(host);
  });
});

describe('BB-LCOL-31: Next on the folded strip keeps keyboard focus when the bar unfolds', () => {
  it('moves focus to the unfolded bar’s Next button', async () => {
    startLesson('transforms-demo-1');
    const host = mount(h(LessonBar, {}));
    await settle();
    (host.querySelector('button[aria-label="Fold lesson"]') as HTMLButtonElement).click();
    await settle();
    const folded = buttonNamed(host, 'Next')!;
    folded.focus();
    expect(document.activeElement).toBe(folded);
    folded.click();
    await settle();
    expect(host.querySelector('.lesson-bar')!.classList.contains('is-folded')).toBe(false);
    expect(document.activeElement).toBe(buttonNamed(host, 'Next'));
    unmount(host);
  });
});

describe('BB-LCOL-29: A lesson step picks the side of the code column it is about', () => {
  const ID = 'test-pane-lesson';
  it('shows Math for pane math, Code for pane code or a code change, and leaves the column otherwise', async () => {
    const lesson: Lesson = {
      id: ID,
      title: 'Panes',
      type: 'demo',
      section: 'Transforms',
      steps: [
        { narration: 'Nothing changes.' },
        { narration: 'The math.', pane: 'math' },
        { narration: 'A triangle.', action: (s) => s.addCustomObject('TRIANGLES', [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0, y: 0.5 }]) },
        { narration: 'Quiet.' },
        { narration: 'The code.', pane: 'code' },
      ],
    };
    LESSON_REGISTRY[ID] = lesson;
    try {
      useVamsStore.setState({ codePane: 'code', codeHidden: true });
      startLesson(ID);
      const host = mount(h(LessonBar, {}));
      await settle();
      const s = () => useVamsStore.getState();
      expect([s().codePane, s().codeHidden]).toEqual(['code', true]);
      buttonNamed(host, 'Next')!.click();
      await settle();
      expect([s().codePane, s().codeHidden]).toEqual(['math', false]);
      buttonNamed(host, 'Next')!.click();
      await settle();
      expect(s().codePane).toBe('code');
      s().setCodePane('math');
      buttonNamed(host, 'Next')!.click();
      await settle();
      expect(s().codePane).toBe('math');
      buttonNamed(host, 'Next')!.click();
      await settle();
      expect(s().codePane).toBe('code');
      unmount(host);
    } finally {
      useVamsStore.getState().clearLessonState();
      useVamsStore.setState({ appMode: 'Author', codePane: 'code', codeHidden: false });
      delete LESSON_REGISTRY[ID];
    }
  });
});

describe('BB-LCOL-30: Leaving a lesson gives the student back their Code / Math view', () => {
  it('restores the switch and Hide from before the lesson', async () => {
    useVamsStore.setState({ codePane: 'math', codeHidden: true });
    startLesson('transforms-demo-1');
    const host = mount(h(LessonBar, {}));
    await settle();
    useVamsStore.getState().setCodePane('code');
    useVamsStore.getState().setCodeHidden(false);
    exitButton(host).click();
    await settle();
    expect(useVamsStore.getState().codePane).toBe('math');
    expect(useVamsStore.getState().codeHidden).toBe(true);
    expect(useVamsStore.getState().codeViewBeforeLesson).toBeNull();
    useVamsStore.setState({ codePane: 'code', codeHidden: false });
    unmount(host);
  });

  it('keeps the Code dot off when a lesson starts or ends, and still lights it for an edit on Math', async () => {
    useVamsStore.setState({ codePane: 'math', codeHidden: false, codeChangedUnseen: false });
    const column = mount(h(CodeMathColumn, {}));
    const bar = mount(h(LessonBar, {}));
    await settle();
    startLesson('transforms-demo-1');
    await settle();
    useVamsStore.getState().setCodePane('math');
    await settle();
    exitButton(bar).click();
    await settle();
    expect(useVamsStore.getState().codePane).toBe('math');
    expect(useVamsStore.getState().codeChangedUnseen).toBe(false);
    expect(column.querySelector('.code-math-switch__dot')).toBeNull();
    addTriangle();
    await settle();
    expect(column.querySelector('.code-math-switch__dot')).not.toBeNull();
    useVamsStore.setState({ codePane: 'code', codeHidden: false, codeChangedUnseen: false });
    unmount(bar);
    unmount(column);
  });
});

describe('BB-LCOL-32: The task line shows only when a step waits for something', () => {
  const ID = 'test-task-line-lesson';
  it('is absent on a narration-only step and present on a step with a success check', async () => {
    LESSON_REGISTRY[ID] = {
      id: ID,
      title: 'Task line',
      type: 'demo',
      section: 'Transforms',
      steps: [
        { narration: 'Just read this.', waitForUser: true },
        { narration: 'Now do it.', waitForUser: true, successCheck: (s) => s.objects.length > 5 },
      ],
    };
    try {
      startLesson(ID);
      const host = mount(h(LessonBar, {}));
      await settle();
      expect(host.querySelector('.lesson-bar__narration')!.textContent).toBe('Just read this.');
      expect(host.querySelector('.lesson-bar__task')).toBeNull();
      expect(buttonNamed(host, 'Next')!.disabled).toBe(false);
      buttonNamed(host, 'Next')!.click();
      await settle();
      expect(host.querySelector('.lesson-bar__task')!.textContent).toContain('Waiting for you');
      unmount(host);
    } finally {
      useVamsStore.getState().clearLessonState();
      delete LESSON_REGISTRY[ID];
    }
  });
});

describe('BB-LCOL-33: The Transforms step that points at the math panel shows Math', () => {
  it('switches the column to Math on the first step of Matrix Representation', async () => {
    useVamsStore.setState({ codePane: 'code', codeHidden: false });
    startLesson('transforms-demo-2');
    const host = mount(h(LessonBar, {}));
    await settle();
    expect(host.querySelector('.lesson-bar__narration')!.textContent).toContain("Math's Transformed stage");
    expect(useVamsStore.getState().codePane).toBe('math');
    unmount(host);
    useVamsStore.setState({ codePane: 'code' });
  });
});

describe('BB-LCOL-34: On narrow screens the lesson bar stays above the open drawer', () => {
  it('lifts the bar over the drawer and keeps the drawer clear of it', () => {
    const scss = readFileSync('src/pages/editor/ui/editor-app.scss', 'utf8');
    const narrow = scss.slice(scss.indexOf('&--narrow'));
    expect(narrow).toMatch(/\.lesson-bar\s*\{[^}]*z-index:\s*(3[1-9]|[4-9]\d)/);
    expect(narrow).toMatch(/\.editor__panel\s*\{[^}]*padding-bottom:\s*var\(--lesson-bar-height/);
  });

  it('publishes the bar height on the editor while a lesson runs', async () => {
    const heights: Array<() => void> = [];
    const RealRO = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      constructor(cb: () => void) { heights.push(cb); }
      observe() {}
      disconnect() {}
    };
    const restore = mockNarrow();
    try {
      startLesson('transforms-demo-1');
      const host = await narrowShell(h('div', {}, 'panel'));
      await settle();
      const editor = host.querySelector('.editor') as HTMLElement;
      const bar = host.querySelector('.lesson-bar') as HTMLElement;
      bar.getBoundingClientRect = () => ({ height: 123 }) as DOMRect;
      heights.forEach((cb) => cb());
      expect(editor.style.getPropertyValue('--lesson-bar-height')).toBe('123px');
      useVamsStore.getState().clearLessonState();
      useVamsStore.getState().setAppMode('Author');
      await settle();
      expect(editor.style.getPropertyValue('--lesson-bar-height')).toBe('');
      unmount(host);
    } finally {
      (globalThis as { ResizeObserver?: unknown }).ResizeObserver = RealRO;
      restore();
    }
  });
});

const STAGE_TITLES = ['Stored', 'Transformed', 'Projected', 'Assembled', 'Rasterised', 'Coloured'] as const;

describe('BB-LCOL-35: Steps about the math name a journey stage, and Math opens on it', () => {
  it('keeps the old card and column words out, and opens each named stage when its step runs', async () => {
    const named: Array<{ lesson: string; index: number; stage: string }> = [];
    for (const lesson of Object.values(LESSON_REGISTRY)) {
      lesson.steps.forEach((step, index) => {
        if (step.pane !== 'math') return;
        expect(step.narration, `${lesson.id} ${index}`).not.toMatch(/math panel|right column|on the right/i);
        const stage = STAGE_TITLES.find((t) => step.narration.includes(`${t} stage`));
        if (stage) named.push({ lesson: lesson.id, index, stage });
      });
    }
    expect(named).toHaveLength(14);
    for (const { lesson, index, stage } of named) {
      expect(await startLessonFromLearn(lesson)).toBe(true);
      const host = mount(h('div', {}, h(LessonBar, {}), h(MathPanel, {})));
      await settle();
      useVamsStore.getState().setCurrentStep(index);
      await settle();
      expect(useVamsStore.getState().codePane, `${lesson} ${index}`).toBe('math');
      expect(host.querySelector('.journey-open__title')!.textContent, `${lesson} ${index}`).toBe(stage);
      unmount(host);
      useVamsStore.getState().clearLessonState();
    }
  });
});

describe("BB-LCOL-36: The mapping steps still drive the Stored stage's diagram", () => {
  it('shows the lesson-driven mapping diagram in Stored for each dmaStep', async () => {
    const lesson = LESSON_REGISTRY['buffers-demo-5'];
    const index = lesson.steps.findIndex((s) => s.dmaStep === 0);
    expect(index).toBeGreaterThan(0);
    expect(await startLessonFromLearn('buffers-demo-5')).toBe(true);
    const host = mount(h('div', {}, h(LessonBar, {}), h(MathPanel, {})));
    await settle();
    useVamsStore.getState().setCurrentStep(index);
    await settle();
    expect(host.querySelector('.journey-open__title')!.textContent).toBe('Stored');
    expect(host.querySelector('.bm-dma')).not.toBeNull();
    expect(host.querySelector('.bm-dma-driven-badge')).not.toBeNull();
    unmount(host);
    useVamsStore.getState().clearLessonState();
  });
});

/** The runner on its own, so a test can read the fields the bar does not draw yet. */
let runner: LessonRunner;
function RunnerProbe() {
  const current = useLessonRunner();
  useLayoutEffect(() => {
    runner = current;
  });
  return null;
}
const goalsMet = () => runner.goals?.map((g) => g.met);
/** Starts the goals sample with the sample lessons built in, and mounts the runner. */
async function startGoalsSample() {
  vi.stubEnv('VITE_LESSON_SAMPLES', '1');
  startLesson('sample-goals');
  const host = mount(h(RunnerProbe, {}));
  await settle();
  // A fresh history, so the next undo step is the one the test makes.
  useVamsStore.getState().clearHistory();
  return host;
}
const sampleTriangleId = () => useVamsStore.getState().objects[0].id;
const rawProgress = () => JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? 'null') as { completed: string[]; skipped: string[] };

describe('BB-LCOL-37: Goals tick as the scene changes, and undo un-ticks them', () => {
  it('reads the goals of the step and re-checks them on every change', async () => {
    const host = await startGoalsSample();
    expect(runner.goals).toEqual([
      { label: 'Red', met: true },
      { label: 'At (0.5, 0.2)', met: false },
      { label: 'Turned 45°', met: false },
    ]);
    const s = useVamsStore.getState();
    s.pushToHistory();
    s.updateObjectTransform(sampleTriangleId(), { translateX: 0.5, translateY: 0.2 });
    await settle();
    expect(goalsMet()).toEqual([true, true, false]);
    useVamsStore.getState().undo();
    await settle();
    expect(goalsMet()).toEqual([true, false, false]);
    unmount(host);
  });
});

describe('BB-LCOL-38: Meeting every goal enables Next and ArrowRight', () => {
  it('holds the step until all three goals are met, then advances on ArrowRight', async () => {
    const host = await startGoalsSample();
    expect(runner.canAdvance).toBe(false);
    key(document.body, 'ArrowRight');
    await settle();
    expect(useVamsStore.getState().currentStepIndex).toBe(0);
    useVamsStore.getState().updateObjectTransform(sampleTriangleId(), { translateX: 0.5, translateY: 0.2 });
    await settle();
    expect(runner.canAdvance).toBe(false);
    useVamsStore.getState().updateObjectTransform(sampleTriangleId(), { rotate: 45 });
    await settle();
    expect(goalsMet()).toEqual([true, true, true]);
    expect(runner.canAdvance).toBe(true);
    key(document.body, 'ArrowRight');
    await settle();
    expect(useVamsStore.getState().currentStepIndex).toBe(1);
    expect(runner.step!.narration).toBe('Done.');
    unmount(host);
  });
});

describe('BB-LCOL-39: Skip solves the step as one undo step and never advances', () => {
  it('meets every goal, lights Next, keeps the step, and one undo takes it back', async () => {
    const host = await startGoalsSample();
    expect(runner.canSkip).toBe(true);
    expect(runner.skipped).toBe(false);
    runner.skip();
    await settle();
    expect(goalsMet()).toEqual([true, true, true]);
    expect(runner.canAdvance).toBe(true);
    expect(runner.canSkip).toBe(false);
    expect(runner.skipped).toBe(true);
    expect(useVamsStore.getState().currentStepIndex).toBe(0);
    useVamsStore.getState().undo();
    await settle();
    expect(goalsMet()).toEqual([true, false, false]);
    expect(runner.canAdvance).toBe(false);
    expect(runner.skipped).toBe(true);
    unmount(host);
  });
});

describe('BB-LCOL-40: A run with Skip is recorded as skipped, a run without it as completed', () => {
  it('writes the sample to skipped after a Skip, and to completed after a run by hand', async () => {
    localStorage.removeItem(PROGRESS_KEY);
    try {
      const host = await startGoalsSample();
      runner.skip();
      await settle();
      runner.next();
      await settle();
      expect(runner.isLastStep).toBe(true);
      runner.finish();
      await settle();
      expect(rawProgress().skipped).toContain('sample-goals');
      expect(rawProgress().completed).not.toContain('sample-goals');

      startLesson('sample-goals');
      await settle();
      expect(runner.active).toBe(true);
      expect(runner.skipped).toBe(false);
      useVamsStore.getState().updateObjectTransform(sampleTriangleId(), { translateX: 0.5, translateY: 0.2, rotate: 45 });
      await settle();
      runner.next();
      await settle();
      runner.finish();
      await settle();
      expect(rawProgress().completed).toContain('sample-goals');
      expect(rawProgress().skipped).not.toContain('sample-goals');
      unmount(host);
    } finally {
      localStorage.removeItem(PROGRESS_KEY);
    }
  });
});

describe('BB-LCOL-41: The sample lessons exist only with the flag, and never in the course', () => {
  it('hides the samples without the flag and keeps them out of the registry and the catalog', () => {
    expect(getLessonById('sample-goals')).toBeUndefined();
    vi.stubEnv('VITE_LESSON_SAMPLES', '1');
    expect(getLessonById('sample-goals')).toBe(SAMPLE_LESSONS['sample-goals']);
    vi.unstubAllEnvs();
    const ids = Object.keys(SAMPLE_LESSONS);
    expect(ids).toContain('sample-goals');
    for (const id of ids) {
      expect(LESSON_REGISTRY[id], id).toBeUndefined();
      expect(LESSON_CATALOG.some((entry) => entry.id === id), id).toBe(false);
    }
  });
});

describe("BB-LCOL-42: Rebuilding a lesson's scene replays the earlier steps' solve", () => {
  const ID = 'test-replay-solve-lesson';
  const movedRight = (s: ReturnType<typeof useVamsStore.getState>) =>
    s.objects.length === 1 && Math.abs(s.objects[0].transform.translateX - 0.5) <= 0.01;
  it('opens a later step, after Back or a jump, on the scene the goals step left', async () => {
    LESSON_REGISTRY[ID] = {
      id: ID,
      title: 'Replay solve',
      type: 'exercise',
      section: 'Transforms',
      steps: [
        {
          narration: 'Move the triangle right.',
          action: (state) => state.addCustomObject('TRIANGLES', [{ x: 0, y: 0.5 }, { x: -0.5, y: -0.5 }, { x: 0.5, y: -0.5 }]),
          goals: [{ label: 'At x 0.5', check: movedRight }],
          solve: (state) => state.updateObjectTransform(state.objects[0].id, { translateX: 0.5 }),
        },
        { narration: 'It moved.' },
        { narration: 'Still there.' },
      ],
    };
    try {
      startLesson(ID);
      const host = mount(h(RunnerProbe, {}));
      await settle();
      expect(runner.canAdvance).toBe(false);
      useVamsStore.getState().updateObjectTransform(useVamsStore.getState().objects[0].id, { translateX: 0.5 });
      await settle();
      runner.next();
      await settle();
      runner.next();
      await settle();
      expect(useVamsStore.getState().currentStepIndex).toBe(2);
      // Back rebuilds step 2 from scratch: step 1's solve stands in for the student's work.
      runner.back();
      await settle();
      expect(useVamsStore.getState().currentStepIndex).toBe(1);
      expect(movedRight(useVamsStore.getState())).toBe(true);
      // A jump rebuilds too.
      useVamsStore.getState().setCurrentStep(0);
      await settle();
      useVamsStore.getState().setCurrentStep(2);
      await settle();
      expect(movedRight(useVamsStore.getState())).toBe(true);
      // Step 1 was passed with Next, so a rebuild onto it runs its solve too and it opens passed.
      useVamsStore.getState().setCurrentStep(0);
      await settle();
      expect(movedRight(useVamsStore.getState())).toBe(true);
      expect(runner.canAdvance).toBe(true);
      unmount(host);
    } finally {
      useVamsStore.getState().clearLessonState();
      delete LESSON_REGISTRY[ID];
    }
  });
});

/** Starts the goals sample with the sample lessons built in, and mounts the lesson bar. */
async function startGoalsBar() {
  vi.stubEnv('VITE_LESSON_SAMPLES', '1');
  startLesson('sample-goals');
  const host = mount(h(LessonBar, {}));
  await settle();
  return host;
}
const goalItems = (host: HTMLElement) => [...host.querySelectorAll<HTMLElement>('.lesson-bar__goal')];

describe('BB-LCOL-43: A goals step lists its goals, hides the task line and holds Next', () => {
  it('shows three goals with the met one marked and the numbers set apart', async () => {
    const host = await startGoalsBar();
    try {
      expect(host.querySelector('ul.lesson-bar__goals')!.getAttribute('aria-label')).toBe('Goals');
      const goals = goalItems(host);
      expect(goals).toHaveLength(3);
      expect(goals[0].classList.contains('is-met')).toBe(true);
      expect(goals[0].querySelector('.lesson-bar__goal-label')!.textContent).toBe('Red');
      expect(goals[0].querySelector('.sr-only')!.textContent).toBe(', met');
      expect(goals[1].classList.contains('is-met')).toBe(false);
      expect(goals[1].querySelector('.sr-only')).toBeNull();
      expect(goals[1].querySelector('.lesson-bar__num')!.textContent).toBe('(0.5, 0.2)');
      expect(goals[1].querySelector('.lesson-bar__goal-label')!.textContent).toBe('At (0.5, 0.2)');
      expect(host.querySelector('.lesson-bar__task')).toBeNull();
      expect(buttonNamed(host, 'Next')!.disabled).toBe(true);
    } finally {
      unmount(host);
    }
  });
});

describe('BB-LCOL-44: Stuck? opens into Show a hint and Skip this step, and shows one hint at a time', () => {
  it('hands focus to the first link, counts the hints, and leaves only Skip after the last', async () => {
    const hints = SAMPLE_LESSONS['sample-goals'].steps[0].hints!;
    const host = await startGoalsBar();
    try {
      expect(host.querySelector('.lesson-bar__hint')).toBeNull();
      buttonNamed(host, 'Stuck?')!.click();
      await settle();
      expect(buttonNamed(host, 'Stuck?')).toBeUndefined();
      expect(buttonNamed(host, 'Skip this step')).toBeDefined();
      expect(document.activeElement).toBe(buttonNamed(host, 'Show a hint'));

      buttonNamed(host, 'Show a hint')!.click();
      await settle();
      const hint = host.querySelector('.lesson-bar__hint')!;
      expect(hint.textContent).toContain(hints[0]);
      expect(hint.querySelector('.lesson-bar__hint-count')!.textContent).toBe('1 of 3');
      expect(buttonNamed(host, 'Show a hint')).toBeUndefined();
      expect(document.activeElement).toBe(buttonNamed(host, 'Show another hint'));

      buttonNamed(host, 'Show another hint')!.click();
      await settle();
      expect(host.querySelector('.lesson-bar__hint')!.textContent).toContain(hints[1]);
      expect(host.querySelector('.lesson-bar__hint')!.textContent).not.toContain(hints[0]);
      buttonNamed(host, 'Show another hint')!.click();
      await settle();
      expect(host.querySelector('.lesson-bar__hint')!.textContent).toContain(hints[2]);
      expect(host.querySelector('.lesson-bar__hint-count')!.textContent).toBe('3 of 3');
      const left = [...host.querySelectorAll<HTMLButtonElement>('.lesson-bar__stuck button')].map((b) => b.textContent?.trim());
      expect(left).toEqual(['Skip this step']);
      expect(document.activeElement).toBe(buttonNamed(host, 'Skip this step'));
    } finally {
      unmount(host);
    }
  });
});

describe('BB-LCOL-45: Skip this step ticks every goal and lights Next', () => {
  it('meets the goals, removes Stuck? and the hint, and reads Done with the task', async () => {
    const host = await startGoalsBar();
    try {
      buttonNamed(host, 'Stuck?')!.click();
      await settle();
      buttonNamed(host, 'Show a hint')!.click();
      await settle();
      buttonNamed(host, 'Skip this step')!.click();
      await settle();
      expect(goalItems(host).map((g) => g.classList.contains('is-met'))).toEqual([true, true, true]);
      const next = buttonNamed(host, 'Next')!;
      expect(next.disabled).toBe(false);
      expect(document.activeElement).toBe(next);
      expect(host.querySelector('.lesson-bar__stuck')).toBeNull();
      expect(buttonNamed(host, 'Stuck?')).toBeUndefined();
      expect(host.querySelector('.lesson-bar__hint')).toBeNull();
      const task = host.querySelector('.lesson-bar__task')!;
      expect(task.classList.contains('is-done')).toBe(true);
      expect(task.textContent).toBe('Done · Red, at (0.5, 0.2), turned 45°');
      expect(useVamsStore.getState().currentStepIndex).toBe(0);

      // A step left without Next opens again unpassed, with Stuck? closed and no hint showing.
      useVamsStore.getState().setCurrentStep(1);
      await settle();
      buttonNamed(host, 'Back')!.click();
      await settle();
      expect(buttonNamed(host, 'Stuck?')).toBeDefined();
      expect(host.querySelector('.lesson-bar__hint')).toBeNull();
    } finally {
      unmount(host);
    }
  });
});

describe('BB-LCOL-46: A waiting step with no hints and no way to skip shows no Stuck?', () => {
  const ID = 'test-no-stuck-lesson';
  it('leaves Stuck? out of a goals step with no hints and no solve', async () => {
    LESSON_REGISTRY[ID] = {
      id: ID,
      title: 'No hints',
      type: 'exercise',
      section: 'Transforms',
      steps: [
        {
          narration: 'Move the triangle right.',
          action: (state) => state.addCustomObject('TRIANGLES', [{ x: 0, y: 0.5 }, { x: -0.5, y: -0.5 }, { x: 0.5, y: -0.5 }]),
          goals: [{ label: 'At x 0.5', check: (s) => Math.abs((s.objects[0]?.transform.translateX ?? 0) - 0.5) <= 0.01 }],
        },
        { narration: 'It moved.' },
      ],
    };
    startLesson(ID);
    const host = mount(h(LessonBar, {}));
    try {
      await settle();
      expect(buttonNamed(host, 'Next')!.disabled).toBe(true);
      expect(buttonNamed(host, 'Stuck?')).toBeUndefined();
      expect(host.querySelector('.lesson-bar__stuck')).toBeNull();
    } finally {
      unmount(host);
      useVamsStore.getState().clearLessonState();
      delete LESSON_REGISTRY[ID];
    }
  });
});

describe('BB-LCOL-47: The disabled Next uses the action-off tokens in both themes', () => {
  it('defines --action-off and --on-action-off for light and dark, and the bar uses them', () => {
    const tokens = readFileSync('src/shared/styles/_tokens.scss', 'utf8');
    const darkAt = tokens.indexOf("[data-theme='dark'] {");
    const light = tokens.slice(tokens.indexOf(':root {'), darkAt);
    const dark = tokens.slice(darkAt, tokens.indexOf('\n}', darkAt));
    expect(light).toMatch(/--action-off:\s*#dde3f0;/);
    expect(light).toMatch(/--on-action-off:\s*#4a536c;/);
    expect(dark).toMatch(/--action-off:\s*#232b40;/);
    expect(dark).toMatch(/--on-action-off:\s*#9aa3bb;/);
    const scss = readFileSync('src/features/lesson-engine/ui/lesson-bar.scss', 'utf8');
    const rule = scss.match(/&__next[^{]*:disabled\s*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule![1]).toMatch(/opacity:\s*1;/);
    expect(rule![1]).toMatch(/background:\s*var\(--action-off\);/);
    expect(rule![1]).toMatch(/color:\s*var\(--on-action-off\);/);
  });
});

describe('BB-LCOL-48: A shown hint is announced politely, and so is the next one', () => {
  it('puts the hint inside a polite live region that stays mounted from the first hint to the next', async () => {
    const hints = SAMPLE_LESSONS['sample-goals'].steps[0].hints!;
    const host = await startGoalsBar();
    try {
      const live = host.querySelector<HTMLElement>('.lesson-bar__hint-live')!;
      expect(live).not.toBeNull();
      expect(live.getAttribute('aria-live')).toBe('polite');
      expect(live.textContent).toBe('');
      buttonNamed(host, 'Stuck?')!.click();
      await settle();
      buttonNamed(host, 'Show a hint')!.click();
      await settle();
      expect(host.querySelector('.lesson-bar__hint-live')).toBe(live);
      expect(live.contains(host.querySelector('.lesson-bar__hint'))).toBe(true);
      expect(live.textContent).toContain(hints[0]);
      buttonNamed(host, 'Show another hint')!.click();
      await settle();
      expect(host.querySelector('.lesson-bar__hint-live')).toBe(live);
      expect(live.textContent).toContain(hints[1]);
      expect(live.textContent).not.toContain(hints[0]);
    } finally {
      unmount(host);
    }
  });
});

describe('BB-LCOL-49: The arrow on Next comes after the word, and Back keeps its arrow first', () => {
  it('has the Next icon as its last child and the Back icon as its first', async () => {
    const host = await startGoalsBar();
    try {
      const next = host.querySelector<HTMLElement>('.lesson-bar__next')!;
      expect((next.lastElementChild as HTMLElement).classList.contains('vbtn__icon')).toBe(true);
      expect(next.firstChild!.nodeType).toBe(Node.TEXT_NODE);
      const back = host.querySelector<HTMLElement>('.lesson-bar__back')!;
      expect((back.firstElementChild as HTMLElement).classList.contains('vbtn__icon')).toBe(true);
      expect(back.firstChild).toBe(back.firstElementChild);
    } finally {
      unmount(host);
    }
  });
});

/** Opens a lesson's last step in the lesson bar. */
async function lastStepBar(id: string, section: 'Transforms' | 'Pipeline' = 'Transforms') {
  startLesson(id, section);
  useVamsStore.getState().setCurrentStep(LESSON_REGISTRY[id].steps.length - 1);
  const host = mount(h(LessonBar, {}));
  await settle();
  return host;
}

describe('BB-LCOL-50: The last step names the next lesson in the course and starts it', () => {
  it('records the lesson as complete and opens the next one at step 1, still in Lesson mode', async () => {
    const nextEntry = courseOrder()[courseOrder().findIndex((l) => l.id === 'pipeline-demo-1') + 1];
    const nextLesson = LESSON_REGISTRY[nextEntry.id];
    const host = await lastStepBar('pipeline-demo-1', 'Pipeline');
    try {
      const button = host.querySelector<HTMLButtonElement>('.lesson-bar__next')!;
      expect(button.textContent!.trim()).toBe(nextEntry.title);
      expect(button.title).toBe(`Next lesson: ${nextEntry.title}`);
      expect((button.lastElementChild as HTMLElement).classList.contains('vbtn__icon')).toBe(true);
      button.click();
      await settle();
      expect(rawProgress().completed).toContain('pipeline-demo-1');
      const s = useVamsStore.getState();
      expect(s.appMode).toBe('Lesson');
      expect(s.activeLessonId).toBe(nextEntry.id);
      expect(s.currentStepIndex).toBe(0);
      expect(host.querySelector('.lesson-bar__step')!.textContent).toBe(`Step 1 of ${nextLesson.steps.length}`);
      expect(host.querySelector('.lesson-bar__narration')!.textContent).toBe(nextLesson.steps[0].narration);
    } finally {
      unmount(host);
    }
  });
});

describe("BB-LCOL-51: A section's last lesson reads Finish and opens the course map at its section", () => {
  it('records completion, returns to Author mode and goes to /learn#transforms', async () => {
    const order = courseOrder().filter((l) => l.section === 'Transforms');
    const last = order[order.length - 1];
    const go = vi.spyOn(courseMap, 'go').mockImplementation(() => {});
    const host = await lastStepBar(last.id);
    try {
      const button = buttonNamed(host, 'Finish')!;
      expect(button).toBeDefined();
      expect(button.classList.contains('lesson-bar__next')).toBe(true);
      expect((button.lastElementChild as HTMLElement).classList.contains('vbtn__icon')).toBe(true);
      button.click();
      await settle();
      expect(rawProgress().completed).toContain(last.id);
      expect(useVamsStore.getState().appMode).toBe('Author');
      expect(useVamsStore.getState().activeLessonId).toBeNull();
      expect(go).toHaveBeenCalledTimes(1);
      expect(go).toHaveBeenCalledWith('/learn#transforms');
    } finally {
      go.mockRestore();
      unmount(host);
    }
  });
});

describe("BB-LCOL-52: Chaining lessons keeps the student's own scene for Exit", () => {
  it('brings back the one quad after two lessons ended with the named Next', async () => {
    const quad = addQuad(0.2, 0.1, 0.3);
    startLesson('transforms-demo-1');
    const host = mount(h(LessonBar, {}));
    try {
      await settle();
      for (let i = 0; i < 2; i++) {
        const id = useVamsStore.getState().activeLessonId!;
        useVamsStore.getState().setCurrentStep(LESSON_REGISTRY[id].steps.length - 1);
        await settle();
        const title = nextInCourse(id)!.title;
        buttonNamed(host, title)!.click();
        await settle();
        expect(useVamsStore.getState().activeLessonId).toBe(nextInCourse(id)!.id);
        // The next lesson opens on its own clean scene, not on the student's.
        expect(useVamsStore.getState().objects.some((o) => o.id === quad.id)).toBe(false);
      }
      exitButton(host).click();
      await settle();
      const objects = useVamsStore.getState().objects;
      expect(objects).toHaveLength(1);
      expect(objects[0].id).toBe(quad.id);
      expect(useVamsStore.getState().appMode).toBe('Author');
    } finally {
      unmount(host);
    }
  });
});

describe('BB-LCOL-53: The recap lists its points and the calls, and a call opens its line', () => {
  it('shows two points and three calls, explains glRotatef in Code, and Finish stays in the editor', async () => {
    vi.stubEnv('VITE_LESSON_SAMPLES', '1');
    const go = vi.spyOn(courseMap, 'go').mockImplementation(() => {});
    useVamsStore.getState().setCodePane('math');
    startLesson('sample-recap');
    const bar = mount(h(LessonBar, {}));
    const code = mount(h(SceneCodePanel, {}));
    try {
      await settle();
      expect(bar.querySelector('.lesson-bar__learned')).toBeNull();
      buttonNamed(bar, 'Next')!.click();
      await settle();
      const points = [...bar.querySelectorAll('ul.lesson-bar__learned li')];
      expect(points.map((p) => p.textContent)).toEqual([
        'Translate moves, rotate turns, scale stretches.',
        'They apply in reverse code order: scale first, move last.',
      ]);
      expect(points.every((p) => p.querySelector('svg'))).toBe(true);
      const calls = bar.querySelector('p.lesson-bar__calls')!;
      expect(calls.firstChild!.textContent!.trim()).toBe('You used');
      const buttons = [...calls.querySelectorAll<HTMLButtonElement>('button.lesson-bar__call')];
      expect(buttons.map((b) => b.textContent)).toEqual(['glTranslatef', 'glRotatef', 'glScalef']);
      useVamsStore.getState().setCodePane('math');
      buttons[1].click();
      await settle();
      const s = useVamsStore.getState();
      expect(s.codePane).toBe('code');
      expect(s.codeHidden).toBe(false);
      expect(s.explainedLine).not.toBeNull();
      const line = code.querySelector(`.code-line[data-line="${s.explainedLine}"] .code-line__text`)!;
      expect(line.textContent).toContain('glRotatef(');

      const finish = buttonNamed(bar, 'Finish')!;
      expect(finish).toBeDefined();
      finish.click();
      await settle();
      expect(useVamsStore.getState().appMode).toBe('Author');
      expect(useVamsStore.getState().activeLessonId).toBeNull();
      expect(go).not.toHaveBeenCalled();
    } finally {
      go.mockRestore();
      unmount(code);
      unmount(bar);
    }
  });
});

describe("BB-LCOL-54: The recap's points are set at the narration's size", () => {
  it("sets .lesson-bar__learned's own font-size to --text-md and nothing else", () => {
    const scss = readFileSync('src/features/lesson-engine/ui/lesson-bar.scss', 'utf8');
    const open = /&__learned\s*\{/.exec(scss);
    expect(open).not.toBeNull();
    let depth = 1;
    let own = '';
    for (let i = open!.index + open![0].length; i < scss.length && depth > 0; i++) {
      const ch = scss[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (depth === 1) own += ch;
    }
    // Nested rules (li, svg) leave their selectors in `own`, but their declarations are dropped.
    const sizes = [...own.matchAll(/font-size\s*:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(sizes).toEqual(['var(--text-md)']);
    expect(own).not.toContain('--text-base');
  });
});

/** Starts the predict sample with the sample lessons built in, and opens its predict step. */
async function startPredictBar() {
  vi.stubEnv('VITE_LESSON_SAMPLES', '1');
  startLesson('sample-predict');
  const host = mount(h(LessonBar, {}));
  await settle();
  buttonNamed(host, 'Next')!.click();
  await settle();
  return host;
}
const predictTriangle = () => useVamsStore.getState().objects.find((o) => o.type === 'TRIANGLES')!;
const choiceButtons = (host: HTMLElement) => [...host.querySelectorAll<HTMLButtonElement>('button.lesson-bar__choice')];
const choiceNamed = (host: HTMLElement, label: string) => choiceButtons(host).find((b) => b.textContent === label)!;

describe("BB-LCOL-55: A predict step holds its action and Next until the student picks", () => {
  it('shows four answers in a group, leaves the triangle where it was, and ArrowRight stays put', async () => {
    const host = await startPredictBar();
    try {
      expect(useVamsStore.getState().currentStepIndex).toBe(1);
      expect(host.querySelector('.lesson-bar__narration')!.textContent).toBe(
        "We're about to set Translate X to 0.4. Where will the triangle go?",
      );
      expect(predictTriangle().transform.translateX).toBe(0);
      expect(buttonNamed(host, 'Next')!.disabled).toBe(true);
      key(document.body, 'ArrowRight');
      await settle();
      expect(useVamsStore.getState().currentStepIndex).toBe(1);
      const group = host.querySelector('div.lesson-bar__choices')!;
      expect(group.getAttribute('role')).toBe('group');
      expect(group.getAttribute('aria-label')).toBe('Your prediction');
      expect(choiceButtons(host).map((b) => b.textContent)).toEqual(['Right', 'Up', 'It grows wider', 'Nowhere until Run']);
      expect(choiceButtons(host).every((b) => b.closest('.lesson-bar__choices') === group)).toBe(true);
      expect(host.querySelector('.lesson-bar__verdict')).toBeNull();
    } finally {
      unmount(host);
    }
  });
});

describe('BB-LCOL-56: A wrong pick runs the action, says why, and lights Next', () => {
  it('moves the triangle to 0.4, shows "Up" marked wrong with its why, announced politely', async () => {
    const host = await startPredictBar();
    try {
      const live = host.querySelector('.lesson-bar__verdict-live')!;
      expect(live.getAttribute('aria-live')).toBe('polite');
      choiceNamed(host, 'Up').click();
      await settle();
      expect(predictTriangle().transform.translateX).toBeCloseTo(0.4);
      expect(host.querySelector('.lesson-bar__choices')).toBeNull();
      const verdict = host.querySelector('p.lesson-bar__verdict')!;
      expect(verdict.closest('[aria-live="polite"]')).toBe(live);
      const pick = verdict.querySelector('.lesson-bar__pick')!;
      expect(pick.classList.contains('is-wrong')).toBe(true);
      expect(pick.textContent).toContain('Up');
      expect(pick.querySelector('svg.lucide-x')).not.toBeNull();
      expect(verdict.querySelector('.sr-only')!.textContent).toBe(', incorrect');
      expect(verdict.textContent).toContain('It slid right. X is the horizontal axis; up would be Y.');
      expect(buttonNamed(host, 'Next')!.disabled).toBe(false);
      // The answers are gone, so focus moves on to the lit Next.
      expect(document.activeElement).toBe(buttonNamed(host, 'Next'));
      // The pick changed the code, so the step shows Code with the changed line marked.
      expect(useVamsStore.getState().changedCodeLines.length).toBeGreaterThan(0);
      key(document.body, 'ArrowRight');
      await settle();
      expect(useVamsStore.getState().currentStepIndex).toBe(2);
    } finally {
      unmount(host);
    }
  });
});

describe("BB-LCOL-57: A predict step's action runs once, and Back keeps the answer", () => {
  it('runs the action for the pick and once for the rebuild, and the scene has it applied once', async () => {
    const original = SAMPLE_LESSONS['sample-predict'];
    let runs = 0;
    const copy: Lesson = {
      ...original,
      steps: original.steps.map((step, i) =>
        i !== 1
          ? step
          : {
              ...step,
              action: (state) => {
                runs++;
                const t = state.objects.find((o) => o.type === 'TRIANGLES')!;
                state.updateObjectTransform(t.id, { translateX: t.transform.translateX + 0.4 });
              },
            },
      ),
    };
    const getLesson = registry.getLessonById;
    const spy = vi.spyOn(registry, 'getLessonById').mockImplementation((id) => (id === 'sample-predict' ? copy : getLesson(id)));
    const host = await startPredictBar();
    try {
      expect(runs).toBe(0);
      choiceNamed(host, 'Right').click();
      await settle();
      expect(runs).toBe(1);
      buttonNamed(host, 'Next')!.click();
      await settle();
      expect(useVamsStore.getState().currentStepIndex).toBe(2);
      expect(runs).toBe(1);
      buttonNamed(host, 'Back')!.click();
      await settle();
      expect(useVamsStore.getState().currentStepIndex).toBe(1);
      expect(runs).toBe(2);
      expect(predictTriangle().transform.translateX).toBeCloseTo(0.4);
      expect(host.querySelector('.lesson-bar__choices')).toBeNull();
      expect(host.querySelector('p.lesson-bar__verdict .lesson-bar__pick')!.textContent).toContain('Right');
      expect(buttonNamed(host, 'Next')!.disabled).toBe(false);
    } finally {
      unmount(host);
      spy.mockRestore();
    }
  });
});

describe('BB-LCOL-58: A right pick shows a tick and is not marked wrong', () => {
  it('shows a Check before "Right", with no is-wrong', async () => {
    const host = await startPredictBar();
    try {
      choiceNamed(host, 'Right').click();
      await settle();
      const pick = host.querySelector('p.lesson-bar__verdict .lesson-bar__pick')!;
      expect(pick.classList.contains('is-wrong')).toBe(false);
      expect(pick.querySelector('svg.lucide-check')).not.toBeNull();
      expect(pick.querySelector('svg.lucide-x')).toBeNull();
      expect(pick.textContent).toContain('Right');
      expect(host.querySelector('p.lesson-bar__verdict .sr-only')!.textContent).toBe(', correct');
      expect(host.querySelector('p.lesson-bar__verdict')!.textContent).toContain('It slid right. X is the horizontal axis.');
    } finally {
      unmount(host);
    }
  });
});

describe('BB-LCOL-59: The wrong-answer text colour is a token in both themes', () => {
  it('defines --warning-text for light and dark, and the wrong pick uses it', () => {
    const tokens = readFileSync('src/shared/styles/_tokens.scss', 'utf8');
    const darkAt = tokens.indexOf("[data-theme='dark'] {");
    const light = tokens.slice(tokens.indexOf(':root {'), darkAt);
    const dark = tokens.slice(darkAt, tokens.indexOf('\n}', darkAt));
    expect(light).toMatch(/--warning-text:\s*#92400e;/);
    expect(dark).toMatch(/--warning-text:\s*#fbbf24;/);
    const scss = readFileSync('src/features/lesson-engine/ui/lesson-bar.scss', 'utf8');
    expect(scss).toMatch(/is-wrong svg\s*\{[^}]*color:\s*var\(--warning-text\);/);
  });
});

describe('BB-LCOL-60: Starting another lesson clears the answers of the last run', () => {
  it('asks the prediction again after the predict sample, the recap sample, then the predict sample', async () => {
    const host = await startPredictBar();
    try {
      choiceNamed(host, 'Up').click();
      await settle();
      expect(host.querySelector('.lesson-bar__verdict')).not.toBeNull();
      useVamsStore.getState().clearLessonState();
      useVamsStore.getState().setActiveLesson('sample-recap');
      await settle();
      expect(host.querySelector('.lesson-bar__step')!.textContent).toBe('Step 1 of 2');
      useVamsStore.getState().clearLessonState();
      useVamsStore.getState().setActiveLesson('sample-predict');
      await settle();
      useVamsStore.getState().setCurrentStep(1);
      await settle();
      expect(host.querySelector('.lesson-bar__verdict')).toBeNull();
      expect(choiceButtons(host)).toHaveLength(4);
      expect(predictTriangle().transform.translateX).toBe(0);
      expect(buttonNamed(host, 'Next')!.disabled).toBe(true);
    } finally {
      unmount(host);
    }
  });
});

/** Starts the code sample with the sample lessons built in, and opens its fill-in step. */
async function startCodeBar() {
  vi.stubEnv('VITE_LESSON_SAMPLES', '1');
  startLesson('sample-code');
  const host = mount(h(LessonBar, {}));
  await settle();
  buttonNamed(host, 'Next')!.click();
  await settle();
  return host;
}
const blanks = (host: HTMLElement) => [...host.querySelectorAll<HTMLInputElement>('input.lesson-code__blank')];
/** Focuses a blank and types into it, as a student would; the blank keeps focus. */
async function typeInto(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await settle();
}
async function blurBlank(input: HTMLInputElement) {
  input.blur();
  await settle();
}

describe('BB-LCOL-61: A code step sets the line in a well with labelled blanks and holds Next', () => {
  it('shows glTranslatef in the code colour, two blanks, and a disabled Next', async () => {
    const host = await startCodeBar();
    try {
      expect(useVamsStore.getState().currentStepIndex).toBe(1);
      expect(host.querySelector('.lesson-bar__narration')!.textContent).toBe('Write the line that puts it there.');
      const well = host.querySelector('div.lesson-code')!;
      expect(well).not.toBeNull();
      expect(well.closest('.lesson-bar__exercise')).not.toBeNull();
      const inputs = blanks(host);
      expect(inputs.map((b) => b.getAttribute('aria-label'))).toEqual(['Blank 1 of 2', 'Blank 2 of 2']);
      expect(inputs.every((b) => b.parentElement!.matches('span.lesson-code__slot'))).toBe(true);
      expect(inputs.every((b) => b.value === '')).toBe(true);
      expect(well.querySelector('.tk-glfn')!.textContent).toBe('glTranslatef');
      expect(well.textContent).toContain(', 0.0f);');
      expect(well.classList.contains('has-note')).toBe(false);
      // The task line stays hidden until every blank is right.
      expect(host.querySelector('.lesson-bar__task')).toBeNull();
      expect(buttonNamed(host, 'Next')!.disabled).toBe(true);
      // The well adds no live region: the narration and the hint wrapper stay the only two.
      expect(host.querySelectorAll('[aria-live]')).toHaveLength(2);
    } finally {
      unmount(host);
    }
  });
});

describe('BB-LCOL-62: A blank shows its verdict once left, and the step passes as soon as both are right', () => {
  it('marks 0.5 right and 0.3 wrong with its note, then .2f lights Next while still focused', async () => {
    const host = await startCodeBar();
    try {
      const [x, y] = blanks(host);
      await typeInto(x, '0.5');
      expect(x.classList.contains('is-focus')).toBe(true);
      expect(x.classList.contains('is-right')).toBe(false);
      await blurBlank(x);
      expect(x.classList.contains('is-right')).toBe(true);
      expect(x.classList.contains('is-focus')).toBe(false);
      expect(x.hasAttribute('aria-invalid')).toBe(false);

      await typeInto(y, '0.3');
      expect(y.classList.contains('is-wrong')).toBe(false);
      expect(host.querySelector('.lesson-code__note')).toBeNull();
      await blurBlank(y);
      expect(y.classList.contains('is-wrong')).toBe(true);
      expect(y.getAttribute('aria-invalid')).toBe('true');
      const note = host.querySelector('.lesson-code__note')!;
      expect(note.textContent).toBe("that's not Y");
      expect(note.parentElement).toBe(y.parentElement);
      expect(y.getAttribute('aria-describedby')).toBe(note.id);
      expect(note.id).not.toBe('');
      expect(host.querySelector('.lesson-code')!.classList.contains('has-note')).toBe(true);
      expect(buttonNamed(host, 'Next')!.disabled).toBe(true);

      await typeInto(y, '.2f');
      expect(document.activeElement).toBe(y);
      expect(y.classList.contains('is-focus')).toBe(true);
      expect(y.classList.contains('is-right')).toBe(false);
      expect(y.hasAttribute('aria-invalid')).toBe(false);
      expect(host.querySelector('.lesson-code__note')).toBeNull();
      expect(buttonNamed(host, 'Next')!.disabled).toBe(false);
      expect(host.querySelector('.lesson-bar__task')!.textContent).toBe('Done · Fill in both numbers');
      // A blank grows with its text, from six characters wide.
      expect(y.style.width).toBe('6ch');
      await typeInto(y, '0.2000000f');
      expect(y.style.width).toBe('11ch');
    } finally {
      unmount(host);
    }
  });
});

describe('BB-LCOL-63: The blanks are checked against the scene, and arrow keys in a blank stay in it', () => {
  it('takes 0.6 once Translate Y is 0.6, rejects 0.2, and ArrowLeft and ArrowRight never move the step', async () => {
    const host = await startCodeBar();
    try {
      const t = useVamsStore.getState().objects.find((o) => o.type === 'TRIANGLES')!;
      useVamsStore.getState().updateObjectTransform(t.id, { translateY: 0.6 });
      await settle();
      const [x, y] = blanks(host);
      await typeInto(x, '0.5');
      await typeInto(y, '0.6');
      expect(buttonNamed(host, 'Next')!.disabled).toBe(false);
      key(y, 'ArrowRight');
      key(y, 'ArrowLeft');
      await settle();
      expect(useVamsStore.getState().currentStepIndex).toBe(1);
      await blurBlank(y);
      expect(y.classList.contains('is-right')).toBe(true);

      await typeInto(y, '0.2');
      key(y, 'ArrowLeft');
      await settle();
      expect(useVamsStore.getState().currentStepIndex).toBe(1);
      await blurBlank(y);
      expect(y.classList.contains('is-wrong')).toBe(true);
      expect(buttonNamed(host, 'Next')!.disabled).toBe(true);
    } finally {
      unmount(host);
    }
  });
});

describe('BB-LCOL-64: Skip on a code step fills in the answers and lights Next', () => {
  it('fills 0.5 and 0.2, marks both right, and stays on the step', async () => {
    const host = await startCodeBar();
    try {
      buttonNamed(host, 'Stuck?')!.click();
      await settle();
      buttonNamed(host, 'Skip this step')!.click();
      await settle();
      const [x, y] = blanks(host);
      expect([x.value, y.value]).toEqual(['0.5', '0.2']);
      const next = buttonNamed(host, 'Next')!;
      expect(next.disabled).toBe(false);
      expect(document.activeElement).toBe(next);
      expect(x.classList.contains('is-right') && y.classList.contains('is-right')).toBe(true);
      expect(useVamsStore.getState().currentStepIndex).toBe(1);

      // A step left without Next opens again with empty blanks.
      useVamsStore.getState().setCurrentStep(2);
      await settle();
      buttonNamed(host, 'Back')!.click();
      await settle();
      expect(blanks(host).map((b) => b.value)).toEqual(['', '']);
      expect(buttonNamed(host, 'Next')!.disabled).toBe(true);
    } finally {
      unmount(host);
    }
  });
});

describe('BB-LCOL-65: A goal check, blank answer or success check that throws counts as not met', () => {
  it('keeps the bar up with the goal unmet, the blanks wrong and Next disabled', async () => {
    const original = SAMPLE_LESSONS['sample-code'];
    const boom = (): never => {
      throw new Error('reads a shape that is gone');
    };
    const copy: Lesson = {
      ...original,
      steps: original.steps.map((step, i) => {
        if (i === 0) return { ...step, goals: [{ label: 'Moved', check: boom }], successCheck: boom };
        if (i === 1 && step.exercise?.kind === 'code') {
          return { ...step, exercise: { ...step.exercise, blanks: step.exercise.blanks.map((b) => ({ ...b, answer: boom })) } };
        }
        return step;
      }),
    };
    const getLesson = registry.getLessonById;
    const spy = vi.spyOn(registry, 'getLessonById').mockImplementation((id) => (id === 'sample-code' ? copy : getLesson(id)));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('VITE_LESSON_SAMPLES', '1');
    startLesson('sample-code');
    let host: HTMLElement | null = null;
    try {
      host = mount(h(LessonBar, {}));
      await settle();
      expect(host.querySelector('.lesson-bar__title')).not.toBeNull();
      const goal = host.querySelector('.lesson-bar__goal')!;
      expect(goal.classList.contains('is-met')).toBe(false);
      expect(buttonNamed(host, 'Next')!.disabled).toBe(true);
      // Every change re-runs the checks; a throw still leaves the step waiting.
      const t = useVamsStore.getState().objects[0];
      useVamsStore.getState().updateObjectTransform(t.id, { translateX: 0.1 });
      await settle();
      expect(buttonNamed(host, 'Next')!.disabled).toBe(true);

      useVamsStore.getState().setCurrentStep(1);
      await settle();
      const [x, y] = blanks(host);
      await typeInto(x, '0.5');
      await typeInto(y, '0.2');
      await blurBlank(y);
      expect(x.classList.contains('is-wrong') && y.classList.contains('is-wrong')).toBe(true);
      expect(buttonNamed(host, 'Next')!.disabled).toBe(true);
      expect(error).toHaveBeenCalled();
    } finally {
      if (host) unmount(host);
      error.mockRestore();
      spy.mockRestore();
    }
  });
});

describe('BB-LCOL-66: Two picks before a re-render run the prediction once', () => {
  it('keeps the first pick and runs the action a single time', async () => {
    const original = SAMPLE_LESSONS['sample-predict'];
    let runs = 0;
    const copy: Lesson = {
      ...original,
      steps: original.steps.map((step, i) => (i !== 1 ? step : { ...step, action: () => void runs++ })),
    };
    const getLesson = registry.getLessonById;
    const spy = vi.spyOn(registry, 'getLessonById').mockImplementation((id) => (id === 'sample-predict' ? copy : getLesson(id)));
    vi.stubEnv('VITE_LESSON_SAMPLES', '1');
    startLesson('sample-predict');
    const host = mount(h(RunnerProbe, {}));
    try {
      await settle();
      runner.next();
      await settle();
      expect(runs).toBe(0);
      const pick = runner.pick;
      pick('up');
      pick('right');
      await settle();
      expect(runs).toBe(1);
      expect(runner.predictAnswer).toBe('up');
    } finally {
      unmount(host);
      spy.mockRestore();
    }
  });
});

describe('BB-LCOL-67: Back to a goals step passed with Next shows it passed', () => {
  it('meets the goals by hand, goes on and back, and finds every goal met with Next lit', async () => {
    const host = await startGoalsSample();
    try {
      useVamsStore.getState().updateObjectTransform(sampleTriangleId(), { translateX: 0.5, translateY: 0.2, rotate: 45 });
      await settle();
      expect(runner.canAdvance).toBe(true);
      runner.next();
      await settle();
      expect(useVamsStore.getState().currentStepIndex).toBe(1);
      runner.back();
      await settle();
      expect(useVamsStore.getState().currentStepIndex).toBe(0);
      expect(goalsMet()).toEqual([true, true, true]);
      expect(runner.canAdvance).toBe(true);
      expect(runner.canSkip).toBe(false);
      expect(runner.skipped).toBe(false);
    } finally {
      unmount(host);
    }
  });
});

describe('BB-LCOL-68: Back to a fill-in step passed with Next shows the right values', () => {
  it('types both answers, goes on and back, and finds them filled in with Next lit', async () => {
    const host = await startCodeBar();
    try {
      const [x, y] = blanks(host);
      await typeInto(x, '0.50');
      await typeInto(y, '.2f');
      await blurBlank(y);
      buttonNamed(host, 'Next')!.click();
      await settle();
      expect(useVamsStore.getState().currentStepIndex).toBe(2);
      buttonNamed(host, 'Back')!.click();
      await settle();
      expect(useVamsStore.getState().currentStepIndex).toBe(1);
      expect(blanks(host).map((b) => b.value)).toEqual(['0.5', '0.2']);
      expect(blanks(host).every((b) => b.classList.contains('is-right'))).toBe(true);
      expect(buttonNamed(host, 'Next')!.disabled).toBe(false);
      expect(buttonNamed(host, 'Stuck?')).toBeUndefined();
    } finally {
      unmount(host);
    }
  });
});

describe('BB-LCOL-69: A step never passed with Next still opens unpassed', () => {
  it('jumps past the goals step and back, and finds it waiting', async () => {
    const host = await startGoalsSample();
    try {
      useVamsStore.getState().setCurrentStep(1);
      await settle();
      useVamsStore.getState().setCurrentStep(0);
      await settle();
      expect(goalsMet()).toEqual([true, false, false]);
      expect(runner.canAdvance).toBe(false);
      expect(runner.canSkip).toBe(true);
    } finally {
      unmount(host);
    }
  });
});

describe('BB-LCOL-70: Back to a question passed with Next shows the right answer', () => {
  const ID = 'test-passed-question-lesson';
  it('restores the right choice and the right order, and a new run starts with none', async () => {
    LESSON_REGISTRY[ID] = {
      id: ID,
      title: 'Passed questions',
      type: 'exercise',
      section: 'Pipeline',
      steps: [
        {
          narration: 'Which comes first?',
          exercise: { kind: 'multiple-choice', prompt: 'First?', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], correctId: 'b' },
        },
        {
          narration: 'Put them in order.',
          exercise: {
            kind: 'ordered-list',
            prompt: 'Order',
            items: [{ id: 'x', label: 'X' }, { id: 'y', label: 'Y' }, { id: 'z', label: 'Z' }],
            correctOrder: ['x', 'y', 'z'],
          },
        },
        { narration: 'Done.' },
      ],
    };
    try {
      startLesson(ID, 'Pipeline');
      const host = mount(h(RunnerProbe, {}));
      await settle();
      runner.setMcAnswer('b');
      await settle();
      runner.next();
      await settle();
      runner.setOrderAnswer(['x', 'y', 'z']);
      await settle();
      runner.next();
      await settle();
      runner.back();
      await settle();
      expect(runner.orderAnswer).toEqual(['x', 'y', 'z']);
      expect(runner.canAdvance).toBe(true);
      runner.back();
      await settle();
      expect(runner.mcAnswer).toBe('b');
      expect(runner.canAdvance).toBe(true);
      expect(runner.skipped).toBe(false);

      // Leaving ends the run: the lesson started again opens with nothing passed.
      runner.exit();
      await settle();
      startLesson(ID, 'Pipeline');
      useVamsStore.getState().setCurrentStep(0);
      await settle();
      expect(runner.mcAnswer).toBeNull();
      expect(runner.canAdvance).toBe(false);
      unmount(host);
    } finally {
      useVamsStore.getState().clearLessonState();
      delete LESSON_REGISTRY[ID];
    }
  });
});
