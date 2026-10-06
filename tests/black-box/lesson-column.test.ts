/**
 * BLACK-BOX TEST SUITE — BB-LCOL
 * The lesson column: the runner hook, the lesson card and panel focus.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useVamsStore } from '@/core/store';
import LessonCard from '@/features/lesson-engine/ui/LessonCard';
import { Panel } from '@/shared/ui/controls';
import { LESSON_REGISTRY } from '@/features/lesson-engine/model/lesson-registry';
import { SectionColumn, SECTION_PANELS, type SectionPanels } from '@/widgets/layout/section-column';
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

function fakePanels(): SectionPanels {
  const panel = (id: string, title: string, defaultOpen = true) => ({
    id,
    render: () => h(Panel, { panelId: id, title, defaultOpen }, `${title} body`),
  });
  return {
    Pipeline: [panel('pipeline-mode-controls', 'Viewport Mode'), panel('scene-hierarchy', 'Scene Hierarchy')],
    Primitives: [panel('scene-hierarchy', 'Scene Hierarchy'), panel('line-style-panel', 'Line Style')],
    Buffers: [panel('scene-hierarchy', 'Scene Hierarchy'), panel('buffers-panel', 'Memory & Buffers')],
    Transforms: [
      panel('scene-hierarchy', 'Scene Hierarchy'),
      panel('ortho-editor', 'Viewing Volume', false),
      panel('object-transform', 'Object Transform'),
    ],
    Textures: [panel('scene-hierarchy', 'Scene Hierarchy'), panel('uv-editor', 'UV Editor')],
  };
}
const titles = (host: HTMLElement) => [...host.querySelectorAll('.vpanel__title')].map((t) => t.textContent);

describe('BB-LCOL-06: In Lesson mode the column shows the lesson instead of the section menu', () => {
  it('has a lesson card and no section menu', async () => {
    startLesson('transforms-exercise-1');
    const host = mount(h(SectionColumn, { panels: fakePanels() }));
    await settle();
    expect(host.querySelector('.lesson-card')).not.toBeNull();
    expect(host.querySelector('.section-menu')).toBeNull();
    unmount(host);
  });
});

describe('BB-LCOL-07: The focus panel comes first, open, under "Use this panel"', () => {
  it('reorders and collapses the rest', async () => {
    // Step 1 of transforms-exercise-1 targets object-transform, which is last in the fake list.
    startLesson('transforms-exercise-1');
    const host = mount(h(SectionColumn, { panels: fakePanels() }));
    await settle();
    expect(titles(host)).toEqual(['Object Transform', 'Scene Hierarchy', 'Viewing Volume']);
    expect(host.querySelector('.section-column__use')!.textContent).toContain('Use this panel');
    const headers = host.querySelectorAll('.vpanel__header');
    expect(headers[0].getAttribute('aria-expanded')).toBe('true');
    expect(headers[1].getAttribute('aria-expanded')).toBe('false');
    expect(headers[2].getAttribute('aria-expanded')).toBe('false');
    unmount(host);
  });
});

describe('BB-LCOL-08: Every lesson focusPanel is a panel in its section', () => {
  it('resolves all ids against SECTION_PANELS', () => {
    const missing: string[] = [];
    for (const lesson of Object.values(LESSON_REGISTRY)) {
      const ids = new Set(SECTION_PANELS[lesson.section].map((entry) => entry.id));
      for (const step of lesson.steps) {
        if (step.focusPanel && !ids.has(step.focusPanel)) missing.push(`${lesson.id}:${step.focusPanel}`);
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
      (host.querySelector('button[aria-label="Rename"]') as HTMLButtonElement).click();
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

describe('BB-LCOL-13: Exit hands focus to the section menu', () => {
  it('focuses the section-menu trigger when the card took focus with it', async () => {
    startLesson('transforms-exercise-1');
    const host = mount(h(SectionColumn, { panels: fakePanels() }));
    await settle();
    const exit = buttonNamed(host, 'Exit')!;
    exit.focus();
    exit.click();
    await settle();
    expect(useVamsStore.getState().appMode).toBe('Author');
    expect(document.activeElement).toBe(host.querySelector('.section-menu__trigger'));
    unmount(host);
  });

  it('leaves focus alone when it is elsewhere', async () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    startLesson('transforms-exercise-1');
    const host = mount(h(SectionColumn, { panels: fakePanels() }));
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
