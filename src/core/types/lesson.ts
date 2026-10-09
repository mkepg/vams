import type { VamsState } from '@/core/store/types';
import type { CurriculumSection } from '@/core/store/types';
import type { CodeChangeFocus } from '@/features/code-generation/model/code-diff';

export type ExerciseWidget =
  | {
      kind: 'multiple-choice';
      prompt: string;
      visualArtifact?:
        | 'vertex-specification'
        | 'vertex-processing'
        | 'primitive-assembly'
        | 'clipping'
        | 'rasterization'
        | 'fragment-processing'
        | 'per-sample-operations';
      options: { id: string; label: string }[];
      correctId: string;
    }
  | {
      kind: 'ordered-list';
      prompt: string;
      items: { id: string; label: string }[];
      correctOrder: string[];
    };

export interface LessonStep {
  narration: string;
  waitForUser?: boolean;
  action?: (state: VamsState) => void;
  successCheck?: (state: VamsState) => boolean;
  codeHighlightTarget?: string;
  exercise?: ExerciseWidget;
  focusPanel?: string; // Targets a specific CollapsibleSection panelId

  /**
   * Drives the Direct Memory Access pointer diagram in the Buffers math panel.
   * When set, the diagram shows this step (0-indexed) and hides its own controls.
   * When omitted/null, the diagram falls back to its standalone state.
   */
  dmaStep?: number | null;

  /**
   * Controls how the code panel highlights what changed in this step.
   *
   *  - omitted / 'auto'  → auto-diff the generated code before vs. after the
   *    step's action and highlight every line that differs.
   *  - 'none'            → suppress the highlight entirely (use for steps
   *    that touch state in a way that's not pedagogically interesting).
   *  - number[]          → explicit 0-indexed line numbers in the generated
   *    output to highlight (use sparingly — brittle if the generator changes).
   *  - string[]          → substring matchers; every line in the new code
   *    that contains any matcher gets highlighted.
   *
   * Most steps need nothing here — auto-diff handles them. The override
   * exists for cases where the diff over- or under-highlights and a hand-
   * tuned focus reads better.
   */
  codeChangeFocus?: CodeChangeFocus;
}

export interface Lesson {
  id: string;
  title: string;
  type: 'demo' | 'exercise';
  section: CurriculumSection;
  shuffleRange?: [number, number];
  steps: LessonStep[];
}
