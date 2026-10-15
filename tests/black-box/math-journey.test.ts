/**
 * BLACK-BOX TEST SUITE — BB-JOURNEY
 * The math pane's vertex journey: which stage opens, the track, the open stage, the stepper and the links.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useVamsStore } from '@/core/store';
import type { Lesson } from '@/core/types/lesson';
import { FOCUS_PANEL_IDS, journeyStageFor, type JourneyContext, type JourneyStageId } from '@/core/inspector';
import { LESSON_REGISTRY } from '@/features/lesson-engine/model/lesson-registry';
import LessonBar from '@/features/lesson-engine/ui/LessonBar';
import { getState } from '../helpers/store';

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

afterEach(() => {
  getState().clearLessonState();
  useVamsStore.setState({ appMode: 'Author', activeSection: 'Pipeline', lastOpenedGroup: null, journeyStageOverride: null, tourStep: null });
});

const base: JourneyContext = {
  appMode: 'Author', lessonFocusPanel: null, selectedObjectId: null, lastOpenedGroup: null, activeSection: 'Pipeline', journeyStageOverride: null,
};

describe('BB-JOURNEY-01: The context opens the stage that belongs to it', () => {
  it('maps every lesson focus place, every group and every section', () => {
    const focus: Record<string, JourneyStageId> = {
      'scene-hierarchy': 'transformed', 'primitive-palette': 'assembled', 'text-node-panel': 'assembled',
      'buffers-panel': 'stored', 'object-transform': 'transformed', 'line-style-panel': 'coloured',
      'texture-attach': 'coloured', 'uv-editor': 'coloured', 'ortho-editor': 'projected',
      'texture-library': 'coloured', 'callbacks-panel': 'stored', 'pipeline-mode-controls': 'rasterised',
      'appearance-panel': 'coloured',
    };
    expect(Object.keys(focus).sort()).toEqual([...FOCUS_PANEL_IDS].sort());
    for (const [panel, stage] of Object.entries(focus)) {
      // Callbacks has no stage of its own: it keeps the section's (Buffers here).
      const ctx = { ...base, appMode: 'Lesson' as const, lessonFocusPanel: panel, selectedObjectId: 'x', activeSection: 'Buffers' as const };
      expect(journeyStageFor(ctx), panel).toBe(stage);
    }
    expect(journeyStageFor({ ...base, appMode: 'Lesson', lessonFocusPanel: 'appearance-panel' })).toBe('rasterised');
    const groups = { vertices: 'stored', buffers: 'stored', transform: 'transformed', appearance: 'coloured', texture: 'coloured',
      background: 'rasterised', 'viewing-volume': 'projected', 'texture-library': 'coloured', callbacks: 'assembled' } as const;
    for (const [group, stage] of Object.entries(groups)) {
      expect(journeyStageFor({ ...base, activeSection: 'Primitives', lastOpenedGroup: group as keyof typeof groups }), group).toBe(stage);
    }
    const sections = { Pipeline: 'rasterised', Primitives: 'assembled', Buffers: 'stored', Transforms: 'transformed', Textures: 'coloured' } as const;
    for (const [section, stage] of Object.entries(sections)) {
      expect(journeyStageFor({ ...base, activeSection: section as keyof typeof sections })).toBe(stage);
    }
  });
});

describe('BB-JOURNEY-02: A stage opened by hand holds until the next lesson step or opened group', () => {
  it('wins over the context, and is cleared by a group, a focus step, a section change and leaving a lesson', () => {
    const s = () => getState();
    expect(journeyStageFor({ ...base, journeyStageOverride: 'projected' })).toBe('projected');
    s().setJourneyStageOverride('projected');
    s().toggleGroup('buffers');
    expect(s().journeyStageOverride).toBeNull();
    s().setJourneyStageOverride('projected');
    s().setLessonFocusPanel('object-transform');
    expect(s().journeyStageOverride).toBeNull();
    s().setJourneyStageOverride('projected');
    s().setActiveSection('Textures');
    expect(s().journeyStageOverride).toBeNull();
    s().setJourneyStageOverride('projected');
    s().clearLessonState();
    expect(s().journeyStageOverride).toBeNull();
  });
});

describe('BB-JOURNEY-03: A lesson step can name its stage', () => {
  const ID = 'test-math-stage';
  it('opens the step\'s mathStage, and the next step without one goes back to the context', async () => {
    const lesson: Lesson = {
      id: ID, title: 'Math stage', type: 'demo', section: 'Primitives',
      steps: [{ narration: 'One', pane: 'math', mathStage: 'coloured' }, { narration: 'Two' }],
    };
    LESSON_REGISTRY[ID] = lesson;
    try {
      useVamsStore.setState({ activeSection: 'Primitives' });
      getState().setActiveLesson(ID);
      getState().setAppMode('Lesson');
      const host = mount(h(LessonBar, {}));
      await settle();
      expect(getState().journeyStageOverride).toBe('coloured');
      expect(journeyStageFor(getState())).toBe('coloured');
      getState().setCurrentStep(1);
      await settle();
      expect(getState().journeyStageOverride).toBeNull();
      expect(journeyStageFor(getState())).toBe('assembled');
      unmount(host);
    } finally {
      getState().clearLessonState();
      delete LESSON_REGISTRY[ID];
    }
  });
});

describe('BB-JOURNEY-04: The tour\'s Understand step opens Transformed', () => {
  it('sets the stage when the step opens, whatever the course section, and clears it when the tour ends', () => {
    useVamsStore.setState({ activeSection: 'Pipeline' });
    getState().startTour();
    getState().nextTourStep();
    getState().nextTourStep();
    expect(getState().journeyStageOverride).toBeNull();
    getState().nextTourStep();
    expect(getState().tourStep).toBe(3);
    expect(journeyStageFor(getState())).toBe('transformed');
    getState().endTour();
    expect(getState().journeyStageOverride).toBeNull();
  });
});
