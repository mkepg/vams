import type { TourBaseline, VamsState } from '@/core/store/types';
import type { SceneNode } from '@/core/types/scene';

export type TourStepId = 'build' | 'read' | 'change' | 'understand' | 'run' | 'learn';

/** The store fields the steps read. */
export type TourState = Pick<VamsState, 'objects' | 'selectedObjectId' | 'interactionMode' | 'codePane'>;

/** What the Run step knows about Run: whether a run started during the step, and whether one is on. */
export interface TourRunState {
  startedThisStep: boolean;
  running: boolean;
}

export interface TourCaptionContext {
  state: TourState;
  baseline: TourBaseline | null;
  /** The C++ name the generator gives an object, as in `draw_<name>()`. */
  codeName: (name: string) => string;
  /** Make it spin has run during this tour. */
  spun: boolean;
}

/**
 * One tour step. Captions and try-it lines mark bold with **…** and code with `…`; the callout renders them.
 * `done` is pure: it reads the store each time, so undo and redo can make a step undone again.
 */
export interface TourStep {
  id: TourStepId;
  title: string;
  /** The `data-tour-anchor` values of the regions the step spotlights. */
  anchors: readonly string[];
  /** On a narrow screen, the panel drawer is open while this step shows. */
  drawer: boolean;
  caption: (ctx: TourCaptionContext) => string;
  tryIt?: (ctx: TourCaptionContext) => string | null;
  /** True once the student has done what the step invites; the tour then moves on by itself. */
  done?: (state: TourState, baseline: TourBaseline | null, run: TourRunState) => boolean;
}

/** The triangle the Build step asks for: made during the step, with at least 3 vertices, its placement finished. */
export function builtTriangle(state: TourState, baseline: TourBaseline | null): SceneNode | undefined {
  if (!baseline || state.interactionMode === 'VERTEX_PLACE') return undefined;
  return state.objects.find((o) => o.type === 'TRIANGLES' && o.vertices.length >= 3 && !baseline.buildIds.includes(o.id));
}

/** The object the Change step watches, while it still exists. */
function watched(state: TourState, baseline: TourBaseline | null): SceneNode | undefined {
  return baseline?.objectId ? state.objects.find((o) => o.id === baseline.objectId) : undefined;
}

/** The selected object when it has a draw function of its own (groups and text do not). */
function selectedShape(state: TourState): SceneNode | undefined {
  const selected = state.objects.find((o) => o.id === state.selectedObjectId);
  return selected && selected.type !== 'GROUP' && selected.type !== 'TEXT' ? selected : undefined;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'build',
    title: 'Build',
    anchors: ['rail-add', 'panel', 'canvas'],
    drawer: true,
    caption: () => 'The rail switches what this panel shows. **Add** is where you build.',
    tryIt: () => 'Pick **Triangles**, click three points on the canvas, then press **Enter**.',
    done: (state, baseline) => builtTriangle(state, baseline) !== undefined,
  },
  {
    id: 'read',
    title: 'Read',
    anchors: ['code-column'],
    drawer: false,
    caption: ({ state, codeName }) => {
      const shape = selectedShape(state);
      const lead = 'Every shape you make becomes real OpenGL code.';
      if (!shape) return lead;
      const noun = shape.type === 'TRIANGLES' ? 'triangle' : 'shape';
      return `${lead} Your ${noun} is drawn by \`draw_${codeName(shape.name)}()\`.`;
    },
  },
  {
    id: 'change',
    title: 'Change',
    anchors: ['panel', 'code-column'],
    drawer: true,
    caption: ({ state, baseline }) =>
      watched(state, baseline)
        ? 'Selecting an object opens its settings. Change **X** and watch the code.'
        : 'Selecting an object opens its settings.',
    tryIt: ({ state, baseline }) => (watched(state, baseline) ? 'Change the selected object’s **Translate X**.' : null),
    done: (state, baseline) => {
      const object = watched(state, baseline);
      return !!object && baseline?.translateX !== null && object.transform.translateX !== baseline?.translateX;
    },
  },
  {
    id: 'understand',
    title: 'Understand',
    anchors: ['code-switch', 'code-column'],
    drawer: false,
    caption: () => '**Math** shows the numbers behind the code, like the matrix your X just changed.',
    tryIt: () => 'Click **Math**.',
    done: (state) => state.codePane === 'math',
  },
  {
    id: 'run',
    title: 'Run',
    anchors: ['run'],
    drawer: false,
    caption: ({ spun }) =>
      '**Run** plays your program like a real GLUT window. **Esc** stops it, and your scene stays as you built it.' +
      (spun ? ' Your Idle callback stays in **Callbacks**.' : ''),
    done: (_state, _baseline, run) => run.startedThisStep && !run.running,
  },
  {
    id: 'learn',
    title: 'Learn',
    anchors: ['learn'],
    drawer: false,
    caption: () => '**Learn** opens the course: five sections of demos and exercises.',
  },
];
