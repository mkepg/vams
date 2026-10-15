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
import MathPanel from '@/features/math-panel/ui/MathPanel';
import { addTriangle, getState } from '../helpers/store';

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

/** The mocks' triangle, selected: vertex 1 at (0, 0.5), moved 0.40, −0.17 and turned 15°. */
function mockTriangle() {
  getState().addCustomObject('TRIANGLES', [{ x: 0.4, y: 0.33 }, { x: -0.1, y: -0.67 }, { x: 0.9, y: -0.67 }]);
  const tri = getState().objects[0];
  useVamsStore.setState({
    objects: [{
      ...tri, name: 'Triangle',
      vertices: [
        { id: 'v0', x: 0, y: 0.5, color: '#ff6633' }, { id: 'v1', x: -0.5, y: -0.5, color: '#3399ff' }, { id: 'v2', x: 0.5, y: -0.5, color: '#55dd88' },
      ],
      transform: { translateX: 0.4, translateY: -0.17, rotate: 15, scaleX: 1, scaleY: 1 },
    }],
  });
  getState().selectObject(tri.id);
  return tri.id;
}
const openTitle = (host: HTMLElement) => host.querySelector('.journey-open__title')!.textContent;
const row = (host: HTMLElement, name: string) =>
  [...host.querySelectorAll('.journey-stage__row')].find((b) => b.querySelector('.journey-stage__name')!.textContent === name) as HTMLButtonElement;

describe('BB-JOURNEY-05: The math pane is a track of six stages, one open', () => {
  it('lists the stages in pipeline order, as buttons, with the open stage\'s heading expanded and a real table', async () => {
    mockTriangle();
    useVamsStore.setState({ activeSection: 'Transforms' });
    const host = mount(h(MathPanel, {}));
    await settle();
    expect(host.querySelector('[role="tablist"]')).toBeNull();
    const stages = [...host.querySelectorAll('ol.journey-track > li.journey-stage')];
    expect(stages.map((li) => li.querySelector('.journey-stage__name, .journey-open__title')!.textContent)).toEqual(
      ['Stored', 'Transformed', 'Projected', 'Assembled', 'Rasterised', 'Coloured']);
    expect(stages.map((li) => li.classList.contains('is-done'))).toEqual([true, false, false, false, false, false]);
    expect(host.querySelectorAll('button.journey-stage__row[aria-expanded="false"]')).toHaveLength(5);
    expect(host.querySelector('.journey-open__title button')!.getAttribute('aria-expanded')).toBe('true');
    expect([...host.querySelectorAll('table.journey-work thead th')].map((th) => [th.textContent, th.getAttribute('scope')])).toEqual(
      [['Step', 'col'], ['Value', 'col'], ['Code', 'col']]);
    unmount(host);
  });
});

describe('BB-JOURNEY-06: The Transformed stage works the student\'s vertex with their numbers', () => {
  it('shows from Stored, scale, rotate and move with amber inputs, and the result the closed rows continue from', async () => {
    mockTriangle();
    useVamsStore.setState({ activeSection: 'Transforms' });
    const host = mount(h(MathPanel, {}));
    await settle();
    expect(openTitle(host)).toBe('Transformed');
    expect(host.querySelector('.journey-open__section')!.textContent).toBe('Transforms');
    const rows = [...host.querySelectorAll('table.journey-work tbody tr')].map((tr) => [...tr.children].map((c) => c.textContent));
    expect(rows).toEqual([
      ['from Stored', '(0.00, 0.50)', 'glVertex2f'],
      ['scale 1, 1', '(0.00, 0.50)', 'glScalef'],
      ['rotate 15°', '(−0.13, 0.48)', 'glRotatef'],
      ['move 0.40, −0.17', '(0.27, 0.31)', 'glTranslatef'],
      ['Result', '(0.27, 0.31)', ''],
    ]);
    expect([...host.querySelectorAll('.journey-work__in')].map((el) => el.textContent)).toEqual(['1', '1', '15°', '0.40', '−0.17']);
    expect(row(host, 'Stored').querySelector('.journey-stage__value')!.textContent).toBe('(0.00, 0.50)');
    expect(row(host, 'Projected').querySelector('.journey-stage__value')!.textContent).toBe('NDC (0.27, 0.31)');
    expect(row(host, 'Assembled').querySelector('.journey-stage__value')!.textContent).toBe('triangle, 1 of 3');
    expect(row(host, 'Coloured').querySelector('.journey-stage__value')!.textContent).toBe('rgb(1.0, 0.4, 0.2)');
    expect(host.textContent).toContain('As one matrix');
    unmount(host);
  });
});

describe('BB-JOURNEY-07: Stages open by the context, by hand, and with Back and Next', () => {
  it('follows the opened group, holds a clicked stage, and steps to the neighbours', async () => {
    mockTriangle();
    const host = mount(h(MathPanel, {}));
    await settle();
    getState().toggleGroup('buffers');
    await settle();
    expect(openTitle(host)).toBe('Stored');
    row(host, 'Projected').click();
    await settle();
    expect(openTitle(host)).toBe('Projected');
    (host.querySelector('.journey-open__next') as HTMLButtonElement).click();
    await settle();
    expect(openTitle(host)).toBe('Assembled');
    (host.querySelector('.journey-open__back') as HTMLButtonElement).click();
    await settle();
    expect(openTitle(host)).toBe('Projected');
    getState().toggleGroup('texture');
    await settle();
    expect(openTitle(host)).toBe('Coloured');
    expect(host.querySelector('.journey-open__next')).toBeNull();
    unmount(host);
  });
});

describe('BB-JOURNEY-08: The stepper follows another vertex, and a removed vertex clamps', () => {
  it('moves through the vertices, wraps, names them in a live region, and never passes the last', async () => {
    const id = mockTriangle();
    const host = mount(h(MathPanel, {}));
    await settle();
    const vertexText = () => host.querySelector('.journey-follow__vertex')!.textContent;
    expect(host.querySelector('.journey-follow__vertex')!.getAttribute('aria-live')).toBe('polite');
    expect(vertexText()).toBe('vertex 1 of 3');
    (host.querySelector('button[aria-label="Next vertex"]') as HTMLButtonElement).click();
    await settle();
    expect(vertexText()).toBe('vertex 2 of 3');
    expect(getState().journeyVertex).toBe(1);
    (host.querySelector('button[aria-label="Previous vertex"]') as HTMLButtonElement).click();
    // Each click acts on the vertex the panel last rendered, so let it render between clicks.
    await settle();
    (host.querySelector('button[aria-label="Previous vertex"]') as HTMLButtonElement).click();
    await settle();
    expect(vertexText()).toBe('vertex 3 of 3');
    useVamsStore.setState({ objects: getState().objects.map((o) => (o.id === id ? { ...o, vertices: o.vertices.slice(0, 2) } : o)) });
    await settle();
    expect(vertexText()).toBe('vertex 2 of 2');
    unmount(host);
  });
});

describe('BB-JOURNEY-09: Every card from the old tabs is still in its stage', () => {
  it('shows each section\'s cards in the stage they belong to', async () => {
    mockTriangle();
    useVamsStore.setState({ pipelineMode: 'Playground' });
    const host = mount(h(MathPanel, {}));
    await settle();
    const open = async (name: string) => {
      row(host, name)?.click();
      await settle();
    };
    await open('Stored');
    for (const title of ['Memory Footprint', 'Array vs Indexed', 'Layout: Interleaved', 'CPU → GPU Traffic']) expect(host.textContent, title).toContain(title);
    await open('Transformed');
    (host.querySelector('.journey-open__deeper') as HTMLButtonElement).click();
    await settle();
    expect(host.textContent).toContain('Selected Matrix (4×4)');
    await open('Projected');
    (host.querySelector('.journey-open__deeper') as HTMLButtonElement).click();
    await settle();
    expect(host.textContent).toContain('glOrtho — Viewing Volume');
    await open('Assembled');
    expect(host.textContent).toContain('Vertices');
    await open('Rasterised');
    expect(host.textContent).toContain('Cursor (NDC)');
    await open('Coloured');
    expect(host.textContent).toContain('Barycentric Interpolation');
    unmount(host);
  });
});

describe('BB-JOURNEY-10: Nothing selected, a group, and Run', () => {
  it('prompts to select a shape, explains a group, and makes the journey inert during Run', async () => {
    const host = mount(h(MathPanel, {}));
    await settle();
    expect(host.querySelector('.journey-follow')!.textContent).toBe('Select a shape to follow one of its vertices.');
    expect(row(host, 'Stored').querySelector('.journey-stage__value')!.textContent).toBe('Where a vertex is kept before drawing.');
    const a = addTriangle(-0.4, 0, 0.2);
    const b = addTriangle(0.4, 0, 0.2);
    getState().createGroup([a.id, b.id]);
    await settle();
    expect(host.querySelector('.journey-follow')!.textContent).toBe('A group has no vertices of its own. Select a shape inside it to follow one.');
    render(h(MathPanel, { contentInert: true }), host);
    await settle();
    expect(host.querySelector('.journey')!.hasAttribute('inert')).toBe(true);
    unmount(host);
  });
});

describe('BB-JOURNEY-11: Focus follows a stage the student opens, and only that', () => {
  it('moves focus to the open heading on a row click, Back and Next, but not on a group or selection change', async () => {
    mockTriangle();
    const host = mount(h(MathPanel, {}));
    await settle();
    const title = () => host.querySelector('.journey-open__title button');
    row(host, 'Projected').click();
    await settle();
    expect(openTitle(host)).toBe('Projected');
    expect(document.activeElement).toBe(title());
    (host.querySelector('.journey-open__next') as HTMLButtonElement).click();
    await settle();
    expect(openTitle(host)).toBe('Assembled');
    expect(document.activeElement).toBe(title());
    (host.querySelector('.journey-open__back') as HTMLButtonElement).click();
    await settle();
    expect(openTitle(host)).toBe('Projected');
    expect(document.activeElement).toBe(title());
    (document.activeElement as HTMLElement).blur();
    getState().toggleGroup('texture');
    await settle();
    expect(openTitle(host)).toBe('Coloured');
    expect(document.activeElement).not.toBe(title());
    unmount(host);
  });
});

describe('BB-JOURNEY-12: Wording and labels of the follow row, captions and controls', () => {
  it('announces the vertex whole, says nothing of a raster position for an empty shape, and singularises a 1 pixel line', async () => {
    const id = mockTriangle();
    const host = mount(h(MathPanel, {}));
    await settle();
    expect(host.querySelector('.journey-follow__vertex')!.getAttribute('aria-atomic')).toBe('true');
    row(host, 'Assembled').click();
    await settle();
    useVamsStore.setState({ objects: getState().objects.map((o) => (o.id === id ? { ...o, type: 'LINES' as const, lineWidth: 1 } : o)) });
    await settle();
    expect(host.textContent).toContain('drawn 1 pixel wide');
    useVamsStore.setState({ objects: getState().objects.map((o) => (o.id === id ? { ...o, vertices: [] } : o)) });
    await settle();
    expect(host.querySelector('.journey-follow')!.textContent).not.toContain('raster position');
    for (const b of host.querySelectorAll('.journey-open__back, .journey-open__next')) {
      expect(b.querySelector('[aria-hidden="true"]'), b.textContent ?? '').not.toBeNull();
    }
    unmount(host);
  });

  it('keeps the cards\' explanations and links the deeper toggle to its region', async () => {
    mockTriangle();
    const host = mount(h(MathPanel, {}));
    await settle();
    row(host, 'Transformed').click();
    await settle();
    const toggle = host.querySelector('.journey-open__deeper') as HTMLButtonElement;
    expect(toggle.querySelector('[aria-hidden="true"]')).not.toBeNull();
    toggle.click();
    await settle();
    const controls = (host.querySelector('.journey-open__deeper') as HTMLElement).getAttribute('aria-controls')!;
    expect(host.querySelector(`#${CSS.escape(controls)}`)).not.toBeNull();
    expect(host.textContent).toContain('Composed in conventional');
    row(host, 'Projected').click();
    await settle();
    (host.querySelector('.journey-open__deeper') as HTMLButtonElement).click();
    await settle();
    expect(host.textContent).toContain('defines the rectangle of world space');
    unmount(host);
  });

  it('shows one prompt, not two, for the Stored stage with nothing selected', async () => {
    const host = mount(h(MathPanel, {}));
    await settle();
    row(host, 'Stored').click();
    await settle();
    expect(host.textContent).not.toContain('Select a primitive');
    unmount(host);
  });
});
