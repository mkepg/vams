import type { VamsState } from '@/core/store';

/** The Pipeline illustrations replace the scene canvas only during a Pipeline lesson. */
export function showsIllustration(s: Pick<VamsState, 'appMode' | 'activeSection' | 'pipelineMode'>): boolean {
  return s.appMode === 'Lesson' && s.activeSection === 'Pipeline' && s.pipelineMode !== 'Playground';
}
