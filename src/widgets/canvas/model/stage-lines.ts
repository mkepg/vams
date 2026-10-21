import type { ExplainRequest } from '@/core/store/types';
import type { JourneyStageId } from '@/core/inspector/journey-stage';
import type { CodeOutline } from '@/features/code-generation/model/code-outline';
import type { Subject } from './pipeline-subject';

import type { StageIndex } from '@/core/types/lesson';

export type { StageIndex };

export interface StageLine {
  /** Index into the outline's lines. */
  line: number;
  text: string;
  request: ExplainRequest;
}

export const STAGES: readonly { short: string; title: string; math: JourneyStageId }[] = [
  { short: 'Specify', title: 'Vertex specification', math: 'stored' },
  { short: 'Transform', title: 'Vertex processing', math: 'transformed' },
  { short: 'Assemble', title: 'Primitive assembly', math: 'assembled' },
  { short: 'Clip', title: 'Clipping', math: 'projected' },
  { short: 'Raster', title: 'Rasterisation', math: 'rasterised' },
  { short: 'Shade', title: 'Fragment processing', math: 'coloured' },
  { short: 'Output', title: 'Per-sample operations', math: 'coloured' },
];

/** Stages whose line belongs to the shape; the rest are found anywhere in the program. */
const OWNED: ReadonlySet<StageIndex> = new Set<StageIndex>([0, 1, 2, 5]);

function candidates(stage: StageIndex, subject: Subject): string[] {
  const node = subject.node;
  const mode = node?.renderingMode ?? 'IMMEDIATE';
  switch (stage) {
    case 0: return [mode === 'IMMEDIATE' ? 'glVertex2f' : mode === 'VERTEX_ARRAY' ? 'glVertexPointer' : 'glBufferData'];
    case 1: return ['glTranslatef'];
    case 2: return [mode === 'IMMEDIATE' ? 'glBegin' : node?.useIndexed ? 'glDrawElements' : 'glDrawArrays'];
    case 3: return ['glOrtho'];
    case 4: return ['glutInitWindowSize'];
    case 5: return subject.texture ? ['glBindTexture'] : ['glColor3f', 'glColor3ub'];
    case 6: return ['glutSwapBuffers'];
  }
}

/** The line of the generated program that does this stage's work for the subject, or null. */
export function stageProgramLine(stage: StageIndex, outline: CodeOutline, subject: Subject): StageLine | null {
  const owned = OWNED.has(stage);
  if (owned && subject.owner === null) return null;
  for (const call of candidates(stage, subject)) {
    const line = outline.lines.findIndex((l) => (!owned || l.object === subject.owner) && l.text.includes(`${call}(`));
    if (line < 0) continue;
    return {
      line,
      text: outline.lines[line].text.trim(),
      request: owned ? { call, owner: subject.owner! } : { call },
    };
  }
  return null;
}
