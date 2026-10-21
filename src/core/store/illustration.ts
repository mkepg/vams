import type { VamsState } from './types';

/**
 * The Pipeline illustrations replace the scene canvas in the Pipeline section, in both modes: for
 * the mode the student chose, and for a "Which Stage?" step's picture whatever mode is chosen.
 */
export function showsIllustration(s: Pick<VamsState, 'activeSection' | 'pipelineMode' | 'quizPipelineStage'>): boolean {
  return s.activeSection === 'Pipeline' && (s.quizPipelineStage !== null || s.pipelineMode !== 'Playground');
}
