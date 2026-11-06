import type { VamsState } from './types';

type PipelineView = Pick<VamsState, 'activeSection' | 'activeLessonId'>;

/**
 * A Pipeline lesson is running: the only time the canvas offers its view switch and illustrations.
 * Outside one, the canvas always shows the scene, and the coordinate playground is the normal canvas.
 */
export function pipelineLessonRunning(s: PipelineView): boolean {
  return s.activeSection === 'Pipeline' && s.activeLessonId !== null;
}

/**
 * The Pipeline illustrations replace the scene canvas during a Pipeline lesson: for the mode the
 * student chose, and for a "Which Stage?" step's picture whatever mode is chosen.
 */
export function showsIllustration(s: PipelineView & Pick<VamsState, 'pipelineMode' | 'quizPipelineStage'>): boolean {
  return pipelineLessonRunning(s) && (s.quizPipelineStage !== null || s.pipelineMode !== 'Playground');
}
