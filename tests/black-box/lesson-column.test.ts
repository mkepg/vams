/**
 * BLACK-BOX TEST SUITE — BB-LCOL
 * The lesson column: the runner hook, the lesson bar and the editor column in Lesson mode.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useVamsStore } from '@/core/store';
import type { Lesson } from '@/core/types/lesson';
import LessonBar from '@/features/lesson-engine/ui/LessonBar';
import { SegmentedControl } from '@/shared/ui/controls';
import { LESSON_REGISTRY } from '@/features/lesson-engine/model/lesson-registry';
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
    expect(host.querySelector('.lesson-bar__step')!.textContent).toBe('Step 1 of 2');
    expect(host.querySelector('.lesson-card__chip, .lesson-bar__chip')).toBeNull();
    const progress = host.querySelector('[role="progressbar"]') as HTMLElement;
    expect(progress.getAttribute('aria-valuenow')).toBe('1');
    expect(progress.getAttribute('aria-valuemax')).toBe('2');
    expect((progress.firstElementChild as HTMLElement).style.width).toBe('50%');
    expect(host.querySelector('.lesson-bar__narration')!.textContent).toContain('Move the triangle to (0.5,');
    expect(buttonNamed(host, 'Next')!.disabled).toBe(true);
    expect(buttonNamed(host, 'Back')!.disabled).toBe(true);
    expect(host.querySelector('.lesson-bar__task')!.textContent).toContain('Waiting for you');
    unmount(host);
  });
});

describe('BB-LCOL-03: Meeting the success check enables Next; the last step says Finish', () => {
  it('advances when the triangle is moved to the target', async () => {
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
    expect(buttonNamed(host, 'Finish')).toBeDefined();
    unmount(host);
  });
});

describe('BB-LCOL-04: Finish and Exit return to Author mode', () => {
  it('Finish on the last step ends the lesson', async () => {
    startLesson('transforms-exercise-1');
    useVamsStore.getState().setCurrentStep(1);
    const host = mount(h(LessonBar, {}));
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
    let host = mount(lessonEditor());
    await settle();
    expect(host.querySelector('[data-group="transform"]')!.classList.contains('is-focus')).toBe(true);
    expect(host.querySelectorAll('.inspector-group.is-dimmed')).toHaveLength(0);
    unmount(host);
    useVamsStore.getState().clearLessonState();
    useVamsStore.setState({ appMode: 'Author' });

    startLesson('transforms-exercise-4');
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
    // Step 2 focuses object-transform; its own action needs a selection and does nothing without one.
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

describe('BB-LCOL-21: The Pipeline illustrations appear only during Pipeline lessons', () => {
  // The router mounts the PixiJS canvas, which cannot initialise under happy-dom; the decision it
  // renders from is checked directly.
  it('shows the diagram in a Pipeline lesson and the scene canvas otherwise', () => {
    expect(showsIllustration({ appMode: 'Author', activeSection: 'Pipeline', pipelineMode: 'Diagram' })).toBe(false);
    expect(showsIllustration({ appMode: 'Lesson', activeSection: 'Pipeline', pipelineMode: 'Diagram' })).toBe(true);
    expect(showsIllustration({ appMode: 'Lesson', activeSection: 'Pipeline', pipelineMode: 'Playground' })).toBe(false);
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
    for (const text of narrationAtScroll) expect(text).toContain('Stippling');
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
    // Texture library starts open, so the first toggle closes it and the second opens it again.
    useVamsStore.getState().toggleGroup('texture-library');
    useVamsStore.getState().toggleGroup('texture-library');
    expect(useVamsStore.getState().lastOpenedGroup).toBe('texture-library');
    expect(await startLessonFromLearn('transforms-exercise-4')).toBe(true);
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
      startLesson('transforms-exercise-4');
      await settle();
      expect(writes).toEqual([0]);
    } finally {
      unmount(host);
    }
  });
});

describe('BB-LCOL-25: The task line waits for the student and says Done when the step passes', () => {
  it('falls back to "Waiting for you", shows the step’s task, and turns to Done', async () => {
    const lesson = LESSON_REGISTRY['transforms-exercise-1'];
    const original = lesson.steps[0].task;
    try {
      startLesson('transforms-exercise-1');
      let host = mount(h(LessonBar, {}));
      await settle();
      expect(host.querySelector('.lesson-bar__task')!.textContent).toBe('Waiting for you');
      expect(host.querySelector('.lesson-bar__task')!.classList.contains('is-done')).toBe(false);
      unmount(host);
      useVamsStore.getState().clearLessonState();
      useVamsStore.setState({ appMode: 'Author' });

      lesson.steps[0].task = 'Move the triangle to (0.5, −0.3)';
      startLesson('transforms-exercise-1');
      host = mount(h(LessonBar, {}));
      await settle();
      expect(host.querySelector('.lesson-bar__task')!.textContent).toBe('Move the triangle to (0.5, −0.3)');
      const id = useVamsStore.getState().objects[0].id;
      useVamsStore.getState().updateObjectTransform(id, { translateX: 0.5, translateY: -0.3 });
      await settle();
      const task = host.querySelector('.lesson-bar__task')!;
      expect(task.classList.contains('is-done')).toBe(true);
      expect(task.textContent).toBe('Done · Move the triangle to (0.5, −0.3)');
      unmount(host);
    } finally {
      lesson.steps[0].task = original;
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
    expect(host.querySelector('.lesson-bar__step')!.textContent).toBe('Step 1 of 5');
    expect(host.querySelector('button[aria-label="Unfold lesson"]')).not.toBeNull();
    buttonNamed(host, 'Next')!.click();
    await settle();
    expect(host.querySelector('.lesson-bar')!.classList.contains('is-folded')).toBe(false);
    expect(host.querySelector('.lesson-bar__narration')!.textContent).toContain('Translate moves the shape');
    unmount(host);
  });
});

describe('BB-LCOL-27: Pipeline lessons switch the canvas view from the bar', () => {
  it('shows the viewport modes as a radiogroup under the narration', async () => {
    const pipeline = Object.values(LESSON_REGISTRY).find((l) => l.section === 'Pipeline' && l.type === 'demo')!;
    startLesson(pipeline.id, 'Pipeline');
    const host = mount(h(LessonBar, {}));
    await settle();
    const modes = host.querySelector('.lesson-bar__modes [role="radiogroup"]')!;
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
    expect(host.querySelector('.lesson-bar__narration')!.textContent).toContain('Watch the math panel');
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
