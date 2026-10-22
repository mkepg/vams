/**
 * BLACK-BOX TEST SUITE — BB-JOURNEY
 * The math pane's vertex journey: which stage opens, the track, the open stage, the stepper and the links.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { h, render, type VNode } from 'preact';
import { useVamsStore } from '@/core/store';
import type { Lesson } from '@/core/types/lesson';
import { FOCUS_PANEL_IDS, journeyStageFor, type JourneyContext, type JourneyStageId } from '@/core/inspector';
import { LESSON_REGISTRY } from '@/features/lesson-engine/model/lesson-registry';
import LessonBar from '@/features/lesson-engine/ui/LessonBar';
import MathPanel from '@/features/math-panel/ui/MathPanel';
import CodeMathColumn from '@/widgets/layout/code-math-column';
import { ringTarget, FollowRing, pickHandleVertex } from '@/shared/engine/selection-overlay';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
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
      background: 'rasterised', 'viewing-volume': 'projected', callbacks: 'assembled' } as const;
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
    // Separate Arrays shows only where the code declares arrays, so not in Immediate mode.
    getState().updateRenderingMode(mockTriangle(), 'VERTEX_ARRAY');
    useVamsStore.setState({ pipelineMode: 'Playground' });
    const host = mount(h(MathPanel, {}));
    await settle();
    const open = async (name: string) => {
      row(host, name)?.click();
      await settle();
    };
    await open('Stored');
    for (const title of ['Memory Footprint', 'Array vs Indexed', 'Layout: Separate Arrays', 'CPU → GPU Traffic']) expect(host.textContent, title).toContain(title);
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

describe('BB-JOURNEY-13: Whole numbers read bare and amber marks only the move', () => {
  it('shows 0 0 1 under the matrix, colours just the two move values, and writes the bounds bare in the formula', async () => {
    mockTriangle();
    useVamsStore.setState({ activeSection: 'Transforms' });
    const host = mount(h(MathPanel, {}));
    await settle();
    const cells = [...host.querySelectorAll('.journey-matrix span')].map((el) => el.textContent);
    expect(cells.slice(6)).toEqual(['0', '0', '1']);
    expect(cells.slice(0, 2)).toEqual(['0.97', '−0.26']);
    expect([...host.querySelectorAll('.journey-matrix .is-value')].map((el) => el.textContent)).toEqual(['0.40', '−0.17']);
    row(host, 'Projected').click();
    await settle();
    expect(host.querySelector('.journey-formula')!.textContent).toContain('(1 + 1)');
    expect(host.querySelector('.journey-formula')!.textContent).toContain('(0.27 + 1)');
    unmount(host);
  });
});

describe('BB-JOURNEY-14: A working row\'s GL call opens Code on that line', () => {
  it('switches to Code, opens the line\'s fold and explains it', async () => {
    mockTriangle();
    useVamsStore.setState({ activeSection: 'Transforms', codePane: 'math', codeHidden: false });
    const host = mount(h(CodeMathColumn, {}));
    await settle();
    const call = [...host.querySelectorAll('.journey-work__call-link')].find((b) => b.textContent === 'glTranslatef') as HTMLButtonElement;
    call.click();
    await settle();
    await settle();
    expect(getState().codePane).toBe('code');
    expect(getState().explainRequest).toBeNull();
    expect(host.querySelector('.code-line.is-explained .code-line__text')!.textContent!.trim()).toMatch(/^glTranslatef\(state_Triangle\.x/);
    expect(host.querySelector('.code-strip__sig')!.textContent).toBe('glTranslatef(x, y, z)');
    unmount(host);
  });
});

describe('BB-JOURNEY-15: The canvas ring marks the followed vertex only while Math shows', () => {
  it('rings a shape\'s clamped vertex, a text\'s first raster position, nothing for a group, and hides with Code', () => {
    const shape = { type: 'TRIANGLES', vertices: [{}, {}, {}] };
    expect(ringTarget(shape, 1, true)).toEqual({ kind: 'vertex', index: 1 });
    expect(ringTarget(shape, 7, true)).toEqual({ kind: 'vertex', index: 2 });
    expect(ringTarget(shape, 1, false)).toBeNull();
    expect(ringTarget({ type: 'TEXT', vertices: [{}], textContent: 'Hi' }, 0, true)).toEqual({ kind: 'raster', x: 0, y: 0 });
    // Three lines, 0.07 apart and centred: the first starts one line above the origin.
    expect(ringTarget({ type: 'TEXT', vertices: [{}], textContent: 'a\nb\nc' }, 0, true)).toEqual({ kind: 'raster', x: 0, y: 0.07 });
    expect(ringTarget({ type: 'GROUP', vertices: [] }, 0, true)).toBeNull();
    expect(ringTarget(undefined, 0, true)).toBeNull();
    const ring = new FollowRing();
    expect(ring.visible).toBe(false);
    ring.show(10, 20, 0.5);
    expect([ring.visible, ring.position.x, ring.position.y, ring.scale.x]).toEqual([true, 10, 20, 0.5]);
    ring.hide();
    expect(ring.visible).toBe(false);
  });
});

describe('BB-JOURNEY-16: Clicking a vertex handle on the canvas follows that vertex', () => {
  it('follows the pressed handle\'s vertex in the header, and ignores a handle beyond the object\'s vertices', async () => {
    mockTriangle();
    const host = mount(h(MathPanel, {}));
    await settle();
    // The renderer keeps one handle per vertex and spares beyond them, in vertex order.
    const handles = [{}, {}, {}, {}];
    expect(pickHandleVertex(handles, handles[2], 3, getState().setJourneyVertex)).toBe(2);
    await settle();
    expect(getState().journeyVertex).toBe(2);
    expect(host.querySelector('.journey-follow__vertex')!.textContent).toBe('vertex 3 of 3');
    expect(pickHandleVertex(handles, handles[3], 3, getState().setJourneyVertex)).toBeNull();
    expect(pickHandleVertex(handles, {}, 3, getState().setJourneyVertex)).toBeNull();
    expect(getState().journeyVertex).toBe(2);
    unmount(host);
  });
});

describe('BB-JOURNEY-20: Prose values wrap so the working fits its column; numbers stay on one line', () => {
  it('marks a prose value cell for wrapping and leaves a coordinate cell alone', async () => {
    mockTriangle();
    const host = mount(h(MathPanel, {}));
    await settle();
    getState().setJourneyStageOverride('stored');
    await settle();
    const cells = [...host.querySelectorAll('table.journey-work tbody td.journey-work__value')];
    const typed = cells.find((c) => c.textContent === '(0.00, 0.50)')!;
    const prose = cells.find((c) => c.textContent === 'no buffer holds it')!;
    expect(typed.classList.contains('is-prose')).toBe(false);
    expect(prose.classList.contains('is-prose')).toBe(true);
    unmount(host);
  });
});

describe('BB-JOURNEY-21: The draw call in the Buffers card wraps inside its box', () => {
  it('lets the call text wrap instead of scrolling out of sight', () => {
    const css = readFileSync(resolve(__dirname, '../../src/features/math-panel/ui/_buffers-math.scss'), 'utf8');
    const block = /\.bm-current-call-code \{([^}]*)\}/.exec(css)![1];
    expect(block).toMatch(/white-space:\s*normal/);
    expect(block).toMatch(/overflow-wrap:\s*anywhere/);
    expect(block).not.toMatch(/nowrap|overflow-x:\s*auto/);
  });
});

describe('BB-JOURNEY-22: Step cells wrap only where a stage allows it', () => {
  function groupedTriangle() {
    const id = mockTriangle();
    const tri = getState().objects[0];
    const group = { ...tri, id: 'grp', name: 'Group 1', type: 'GROUP' as const, parentId: null, children: [id], vertices: [], transform: { ...tri.transform, scaleX: 1.5, scaleY: 2 } };
    useVamsStore.setState({ objects: [group, { ...tri, parentId: 'grp', renderingMode: 'VBO', bufferUsage: 'DYNAMIC' }] });
    getState().selectObject(id);
  }

  it('keeps every Transformed step on one line, grouped or not', async () => {
    groupedTriangle();
    useVamsStore.setState({ activeSection: 'Transforms' });
    const host = mount(h(MathPanel, {}));
    await settle();
    expect(openTitle(host)).toBe('Transformed');
    const steps = [...host.querySelectorAll('table.journey-work td.journey-work__step')];
    const heading = host.querySelector('table.journey-work tr.journey-work__group th')!;
    expect(heading.textContent).toBe('Group 1');
    expect(heading.getAttribute('colspan')).toBe('3');
    expect(heading.getAttribute('scope')).toBe('rowgroup');
    expect(heading.getAttribute('title')).toBe('Group 1');
    expect(heading.closest('tbody')!.firstElementChild).toBe(heading.parentElement);
    // The object's own rows, one body for the group, and the Result row's body.
    expect(host.querySelectorAll('table.journey-work tbody').length).toBe(3);
    expect(steps.some((c) => c.textContent!.startsWith('Group 1'))).toBe(false);
    expect(host.querySelectorAll('table.journey-work tr.journey-work__group button').length).toBe(0);
    expect(host.querySelector('table.journey-work')!.classList.contains('journey-work--wrap-steps')).toBe(false);
    expect(steps.every((c) => c.className === 'journey-work__step')).toBe(true);
    unmount(host);
  });

  it('lets Stored wrap its steps and marks the long one', async () => {
    groupedTriangle();
    useVamsStore.setState({ activeSection: 'Buffers' });
    const host = mount(h(MathPanel, {}));
    await settle();
    expect(openTitle(host)).toBe('Stored');
    expect(host.querySelector('table.journey-work')!.classList.contains('journey-work--wrap-steps')).toBe(true);
    const long = [...host.querySelectorAll('td.journey-work__step.is-long')].map((c) => c.textContent);
    expect(long).toEqual(['refreshed every frame, usage GL_DYNAMIC_DRAW']);
    unmount(host);
  });
});

describe('BB-JOURNEY-17: Assembled draws the shape with the followed vertex ringed', () => {
  it('shows the working and a sketch with one ring', async () => {
    mockTriangle();
    getState().setJourneyStageOverride('assembled');
    const host = mount(h(MathPanel, {}));
    await settle();
    expect(openTitle(host)).toBe('Assembled');
    expect([...host.querySelectorAll('table.journey-work tbody tr')].map((tr) => tr.children[0].textContent)).toEqual(
      ['from Projected', 'primitive GL_TRIANGLES', 'this vertex', 'Result']);
    expect(host.querySelectorAll('svg.journey-sketch circle.journey-sketch__ring')).toHaveLength(1);
    unmount(host);
  });
});

describe('BB-JOURNEY-23: The sketch shades what holds the vertex and its caption agrees', () => {
  const show = async (type: 'TRIANGLE_FAN' | 'LINES', n: number, vertex: number) => {
    const id = mockTriangle();
    const tri = getState().objects[0];
    const vertices = Array.from({ length: n }, (_, k) => ({ id: `v${k}`, x: k * 0.2, y: (k % 2) * 0.3, color: '#ffffff' }));
    useVamsStore.setState({ objects: [{ ...tri, type, vertices }] });
    getState().selectObject(id);
    getState().setJourneyVertex(vertex);
    getState().setJourneyStageOverride('assembled');
    const host = mount(h(MathPanel, {}));
    await settle();
    return host;
  };

  it('shades all three triangles of a fan that hold its first vertex', async () => {
    const host = await show('TRIANGLE_FAN', 5, 0);
    expect(host.querySelectorAll('svg.journey-sketch .journey-sketch__face')).toHaveLength(3);
    expect(host.querySelectorAll('svg.journey-sketch .journey-sketch__face.is-held')).toHaveLength(3);
    expect(host.querySelector('.journey-picture__caption')!.textContent).toContain('shapes it belongs to are shaded');
    unmount(host);
  });

  it('says a leftover vertex is not drawn, and calls held lines highlighted', async () => {
    let host = await show('LINES', 3, 2);
    expect(host.querySelector('svg.journey-sketch .is-held')).toBeNull();
    expect(host.querySelector('.journey-picture__caption')!.textContent).toBe('This vertex is left over, so nothing is drawn for it.');
    unmount(host);
    host = await show('LINES', 3, 0);
    expect(host.querySelectorAll('svg.journey-sketch .journey-sketch__edge.is-held')).toHaveLength(1);
    expect(host.querySelector('.journey-picture__caption')!.textContent).toContain('lines it belongs to are highlighted');
    unmount(host);
  });
});

describe('BB-JOURNEY-18: Rasterised keeps the pointer readout in every Pipeline mode', () => {
  const showRasterised = async (mode: 'Diagram' | 'Playground') => {
    mockTriangle();
    useVamsStore.setState({ pipelineMode: mode, activePipelineStage: mode === 'Diagram' ? 4 : null });
    getState().setJourneyStageOverride('rasterised');
    const host = mount(h(MathPanel, {}));
    await settle();
    return host;
  };
  const formula = (host: HTMLElement) => host.querySelector('.journey-formula')!.textContent!.replace(/\s+/g, ' ');

  it('shows the cursor readout and Vector vs Raster in Diagram mode too, with the real numbers', async () => {
    const host = await showRasterised('Diagram');
    expect(host.textContent).toContain('Cursor (NDC)');
    expect(host.textContent).toContain('Vector vs Raster');
    expect(host.textContent).toContain('Rasterisation');
    expect(host.textContent).toContain('The formula, with your numbers');
    // The canvas is 800 × 600 when no canvas wrapper is mounted.
    expect(formula(host)).toContain('= (0.27 + 1) / 2 · 800 = 508.2 → 508');
    expect(formula(host)).toContain('= (0.31 + 1) / 2 · 600 = 393.8 → 393');
    unmount(host);
    useVamsStore.setState({ pipelineMode: 'Playground', activePipelineStage: null });
  });

  it('shows the same formula, readout and card in Playground mode', async () => {
    const host = await showRasterised('Playground');
    expect(host.textContent).toContain('Cursor (NDC)');
    expect(host.textContent).toContain('Vector vs Raster');
    expect(host.textContent).not.toContain('Rasterisation');
    expect(formula(host)).toContain('→');
    expect(host.querySelector('.journey-picture__caption')!.textContent).toContain('whole number at or below it');
    unmount(host);
  });

  it('has no formula for a group, and nothing breaks', async () => {
    const a = addTriangle(-0.4, 0, 0.2);
    const b = addTriangle(0.4, 0, 0.2);
    getState().createGroup([a.id, b.id]);
    getState().setJourneyStageOverride('rasterised');
    const host = mount(h(MathPanel, {}));
    await settle();
    expect(host.querySelector('.journey-formula')).toBeNull();
    expect(host.textContent).toContain('Vector vs Raster');
    unmount(host);
  });
});

describe('BB-JOURNEY-19: The glViewport link exists only when a reshape handler does', () => {
  const sizeCalls = (host: HTMLElement) =>
    [...host.querySelectorAll('.journey-work tbody tr')].filter((r) => r.textContent!.includes('glViewport'));

  it('shows plain code, no button, in the size rows without a handler', async () => {
    mockTriangle();
    useVamsStore.setState({ codePane: 'math', codeHidden: false });
    getState().setJourneyStageOverride('rasterised');
    const host = mount(h(CodeMathColumn, {}));
    await settle();
    expect(sizeCalls(host)).toHaveLength(2);
    for (const r of sizeCalls(host)) {
      expect(r.querySelector('button')).toBeNull();
      expect(r.querySelector('code')!.textContent).toBe('glViewport');
    }
    expect(host.querySelector('.journey-open__why')!.textContent).toContain('GLUT calls glViewport for you');
    unmount(host);
  });

  it('opens the explanation from the button once a handler is set', async () => {
    mockTriangle();
    getState().setCallbackHandler('reshape', 'onReshape');
    useVamsStore.setState({ codePane: 'math', codeHidden: false });
    getState().setJourneyStageOverride('rasterised');
    const host = mount(h(CodeMathColumn, {}));
    await settle();
    const buttons = [...host.querySelectorAll('.journey-work__call-link')].filter((b) => b.textContent === 'glViewport') as HTMLButtonElement[];
    expect(buttons).toHaveLength(2);
    expect(host.querySelector('.journey-open__why')!.textContent).not.toContain('reshape handler');
    buttons[0].click();
    await settle();
    await settle();
    expect(getState().codePane).toBe('code');
    expect(host.querySelector('.code-line.is-explained .code-line__text')!.textContent).toContain('glViewport(0, 0, width, height)');
    expect(host.querySelector('.code-strip__sig')!.textContent).toBe('glViewport(x, y, width, height)');
    unmount(host);
    getState().setCallbackHandler('reshape', '');
  });
});

describe('BB-JOURNEY-24: The formula truncates the unrounded value so it never reads as the next pixel', () => {
  const formulaFor = async (x: number) => {
    mockTriangle();
    const obj = getState().objects[0];
    useVamsStore.setState({
      objects: [{ ...obj, transform: { translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1 }, vertices: [{ id: 'v0', x, y: 0, color: '#ffffff' }] }],
    });
    getState().setJourneyVertex(0);
    getState().setJourneyStageOverride('rasterised');
    const host = mount(h(MathPanel, {}));
    await settle();
    const text = host.querySelector('.journey-formula')!.textContent!;
    unmount(host);
    return text;
  };

  it('reads 372.9 → 372 for a raw 372.96, not 373', async () => {
    expect(await formulaFor(-0.0676)).toContain('· 800 = 372.9 → 372');
  });

  it('reads −0.1 → −1 for a raw −0.04, not 0', async () => {
    expect(await formulaFor(-1.0001)).toContain('· 800 = −0.1 → −1');
  });

  it('reads a whole raw value bare, and the +1 edge as 800 → 799', async () => {
    expect(await formulaFor(0)).toContain('· 800 = 400');
    expect(await formulaFor(0)).not.toContain('400 →');
    expect(await formulaFor(1)).toContain('· 800 = 800 → 799');
  });
});

describe('BB-JOURNEY-25: Coloured shows the colour across the face with the vertex ringed', () => {
  it('matches the mock\'s working and draws the face', async () => {
    mockTriangle();
    getState().setJourneyStageOverride('coloured');
    const host = mount(h(MathPanel, {}));
    await settle();
    const rows = [...host.querySelectorAll('table.journey-work tbody tr')].map((tr) => [...tr.children].map((c) => c.textContent));
    expect(rows.slice(1)).toEqual([
      ['vertex colour', '(1.0, 0.4, 0.2)', 'glColor3f'],
      ['shading smooth', 'weights 1, 0, 0', 'glShadeModel'],
      ['Result', 'rgb(1.0, 0.4, 0.2)', ''],
    ]);
    expect(host.querySelector('svg.journey-face .journey-face__ring')).not.toBeNull();
    expect(host.textContent).toContain('Across the face');
    unmount(host);
  });
});

describe('BB-JOURNEY-25: a flat face is one colour', () => {
  it('fills the face with the provoking vertex colour and draws no gradients', async () => {
    mockTriangle();
    useVamsStore.setState({ objects: [{ ...getState().objects[0], shading: 'FLAT' }] });
    getState().setJourneyStageOverride('coloured');
    const host = mount(h(MathPanel, {}));
    await settle();
    const svg = host.querySelector('svg.journey-face')!;
    expect(svg.querySelectorAll('linearGradient, radialGradient').length).toBe(0);
    const fills = [...svg.querySelectorAll('polygon')].map((p) => p.getAttribute('fill'));
    expect(fills).toEqual(['#55dd88']);
    expect(svg.getAttribute('aria-label')).toContain('flat');
    unmount(host);
  });
});

describe('BB-JOURNEY-26: With a Keep proportions reshape handler, Projected works the widened volume', () => {
  it('puts the widened bounds in the formula and says the reshape callback widened them', async () => {
    mockTriangle();
    getState().setCallbackHandler('reshape', 'onReshape');
    getState().setReshapeMode('keep');
    getState().setJourneyStageOverride('projected');
    const host = mount(h(MathPanel, {}));
    await settle();
    expect(host.querySelector('.journey-open__why')!.textContent).toContain('The reshape callback first widened your viewing volume to match the window’s shape.');
    expect(host.querySelector('.journey-formula')!.textContent).toContain('1.33');
    expect(host.textContent).toContain('The reshape callback widened your volume to match the window’s shape');
    unmount(host);
    getState().setCallbackHandler('reshape', '');
  });
});

describe('BB-JOURNEY-27: A group row\'s GL call opens the group\'s line, not the child\'s', () => {
  it('opens glScalef(state_Group_1…) from the group\'s scale row, with the group\'s value in the strip', async () => {
    const tri = addTriangle();
    getState().updateObjectName(tri.id, 'Tri');
    getState().addCustomObject('QUADS', [{ x: 0.3, y: 0.3 }, { x: 0.7, y: 0.3 }, { x: 0.7, y: 0.7 }, { x: 0.3, y: 0.7 }]);
    const quad = getState().objects[0];
    getState().createGroup([tri.id, quad.id]);
    const group = getState().objects.find((o) => o.type === 'GROUP')!;
    getState().updateObjectTransform(group.id, { scaleX: 2, scaleY: 2 });
    getState().selectObject(tri.id);
    useVamsStore.setState({ activeSection: 'Transforms', codePane: 'math', codeHidden: false });
    const host = mount(h(CodeMathColumn, {}));
    await settle();
    const scales = [...host.querySelectorAll('.journey-work__call-link')].filter((b) => b.textContent === 'glScalef') as HTMLButtonElement[];
    expect(scales).toHaveLength(2);
    scales[1].click();
    await settle();
    await settle();
    expect(host.querySelector('.code-line.is-explained .code-line__text')!.textContent!.trim()).toMatch(/^glScalef\(state_Group_1\.scaleX/);
    expect(host.querySelector('section.code-strip')!.textContent).toContain('state_Group_1.scaleX');
    unmount(host);
  });
});

describe('BB-JOURNEY-28: A vertex row\'s GL call opens the followed vertex\'s line', () => {
  const explainedText = (host: HTMLElement) => host.querySelector('.code-line.is-explained .code-line__text')!.textContent!.trim();
  const clickCall = async (host: HTMLElement, call: string) => {
    ([...host.querySelectorAll('.journey-work__call-link')].find((b) => b.textContent === call) as HTMLButtonElement).click();
    await settle();
    await settle();
  };

  it('opens vertex 3\'s glVertex2f from Stored and its glColor3f from Coloured', async () => {
    mockTriangle();
    useVamsStore.setState({ codePane: 'math', codeHidden: false });
    getState().setJourneyVertex(2);
    getState().setJourneyStageOverride('stored');
    const host = mount(h(CodeMathColumn, {}));
    await settle();
    expect(host.querySelector('.journey-follow__vertex')!.textContent).toBe('vertex 3 of 3');
    await clickCall(host, 'glVertex2f');
    expect(explainedText(host)).toBe('glVertex2f(0.5000f, -0.5000f);');
    getState().setJourneyStageOverride('coloured');
    useVamsStore.setState({ codePane: 'math' });
    await settle();
    await clickCall(host, 'glColor3f');
    expect(explainedText(host)).toBe('glColor3f(0.33f, 0.87f, 0.53f);');
    unmount(host);
  });
});

describe('BB-JOURNEY-29: Coloured\'s face caption and Color card follow the vertex', () => {
  const coloured = async (patch: Record<string, unknown>, vertex: number) => {
    mockTriangle();
    useVamsStore.setState({ objects: [{ ...getState().objects[0], ...patch }] });
    getState().setJourneyVertex(vertex);
    getState().setJourneyStageOverride('coloured');
    return mount(h(MathPanel, {}));
  };
  const hex = (host: HTMLElement) => host.querySelector('.cc-swatch-hex')!.textContent;

  it('converts the followed vertex\'s colour with smooth shading', async () => {
    const host = await coloured({}, 2);
    await settle();
    expect(hex(host)).toBe('#55DD88');
    unmount(host);
  });

  it('names the triangle and its provoking vertex under flat shading, and converts that vertex\'s colour', async () => {
    const host = await coloured({ shading: 'FLAT' }, 0);
    await settle();
    expect(host.textContent).not.toContain('whole shape');
    expect(host.textContent).toContain('With flat shading, triangle 1 takes vertex 3’s colour.');
    expect(hex(host)).toBe('#55DD88');
    unmount(host);
  });

  it('names the strip\'s triangle that holds the vertex', async () => {
    const vertices = [
      { id: 'v0', x: -0.5, y: -0.5, color: '#ff0000' }, { id: 'v1', x: -0.5, y: 0.5, color: '#00ff00' },
      { id: 'v2', x: 0.5, y: -0.5, color: '#0000ff' }, { id: 'v3', x: 0.5, y: 0.5, color: '#ffff00' },
    ];
    const host = await coloured({ type: 'TRIANGLE_STRIP', shading: 'FLAT', vertices }, 3);
    await settle();
    expect(host.textContent).toContain('With flat shading, triangle 2 takes vertex 4’s colour.');
    expect(hex(host)).toBe('#FFFF00');
    unmount(host);
  });
});

describe('BB-JOURNEY-30: The Stored stage draws the separate arrays the code declares', () => {
  it('names verts_ and colors_, adds uvs_ for a textured shape, and never says interleaved', async () => {
    getState().updateRenderingMode(mockTriangle(), 'VERTEX_ARRAY');
    useVamsStore.setState({ pipelineMode: 'Playground' });
    const host = mount(h(MathPanel, {}));
    await settle();
    row(host, 'Stored')?.click();
    await settle();
    const card = () => host.querySelector('.bm-arrays')!;
    expect(card().textContent).toContain('verts_Triangle');
    expect(card().textContent).toContain('colors_Triangle');
    expect(card().textContent).not.toContain('uvs_Triangle');
    expect(card().textContent).toContain('3 × 8 B');
    expect(card().textContent).toContain('3 × 12 B');
    expect(host.textContent).not.toMatch(/interleaved/i);
    expect(card().textContent).not.toMatch(/\bcolor\b/);
    getState().attachTexture(getState().objects[0].id, 'sample-bricks');
    await settle();
    expect(card().textContent).toContain('uvs_Triangle');
    unmount(host);
  });
});

describe('BB-JOURNEY-31: The Stored stage counts UVs in a textured vertex', () => {
  it('shows 20 B per vertex for a plain shape and 28 B once it has a texture', async () => {
    mockTriangle();
    useVamsStore.setState({ pipelineMode: 'Playground' });
    const host = mount(h(MathPanel, {}));
    await settle();
    row(host, 'Stored')?.click();
    await settle();
    const footprint = () => host.querySelector('.bm-footprint')!.textContent;
    expect(footprint()).toContain('20 Bper vertex');
    expect(footprint()).toContain('60 Btotal');
    getState().attachTexture(getState().objects[0].id, 'sample-bricks');
    await settle();
    expect(footprint()).toContain('28 Bper vertex');
    expect(footprint()).toContain('84 Btotal');
    expect(host.querySelector('.bm-footprint [title]')!.getAttribute('title')).toBe('position (8 B) + colour (12 B) + UV (8 B)');
    unmount(host);
  });
});

describe('BB-JOURNEY-32: The separate arrays follow indexed drawing, and Immediate mode declares none', () => {
  /** A quad drawn as two triangles that share two corners, all one colour. */
  function quad() {
    const corners = [{ x: -0.5, y: -0.5 }, { x: 0.5, y: -0.5 }, { x: 0.5, y: 0.5 }, { x: -0.5, y: -0.5 }, { x: 0.5, y: 0.5 }, { x: -0.5, y: 0.5 }];
    getState().addCustomObject('TRIANGLES', corners);
    const id = getState().objects[0].id;
    getState().updateObjectName(id, 'Quad');
    getState().setAllVertexColors(id, '#ff6633');
    getState().selectObject(id);
    useVamsStore.setState({ pipelineMode: 'Playground' });
    return id;
  }
  const code = () => {
    const s = getState();
    return generateCodeFromState(
      { objects: s.objects, canvasBackgroundColor: s.canvasBackgroundColor, callbacks: s.callbacks, viewportLimits: s.viewportLimits },
      { width: 800, height: 600 },
    );
  };
  const openStored = async (host: HTMLElement) => {
    row(host, 'Stored')?.click();
    await settle();
  };

  it('counts the unique vertices and adds the indices array the code declares', async () => {
    const id = quad();
    getState().updateRenderingMode(id, 'VERTEX_ARRAY');
    getState().updateUseIndexed(id, true);
    const host = mount(h(MathPanel, {}));
    await settle();
    await openStored(host);
    const arrays = [...host.querySelectorAll('.bm-arrays .bm-array')];
    const named = (name: string) => arrays.find((a) => a.querySelector('.bm-array-name')!.textContent === name)!;
    expect(arrays.map((a) => a.querySelector('.bm-array-name')!.textContent)).toEqual(['verts_Quad', 'colors_Quad', 'indices_Quad']);
    expect(named('verts_Quad').querySelectorAll('.bm-vblock')).toHaveLength(4);
    expect(named('verts_Quad').textContent).toContain('4 × 8 B');
    expect(named('colors_Quad').textContent).toContain('4 × 12 B');
    expect(named('indices_Quad').textContent).toContain('6 × 4 B');
    const generated = code();
    expect(generated).toContain('GLuint indices_Quad[] = { 0, 1, 2, 0, 2, 3 };');
    for (const a of arrays) expect(generated).toContain(`${a.querySelector('.bm-array-name')!.textContent}[]`);
    unmount(host);
  });

  it('shows no Separate Arrays card in Immediate mode', async () => {
    quad();
    const host = mount(h(MathPanel, {}));
    await settle();
    await openStored(host);
    expect(host.textContent).toContain('Memory Footprint');
    expect(host.textContent).not.toContain('Layout: Separate Arrays');
    expect(host.querySelector('.bm-arrays')).toBeNull();
    expect(code()).not.toMatch(/verts_Quad\[\]/);
    unmount(host);
  });
});
