import type { PrimitiveType } from '@/core/types/scene';
import { clipOutcome } from '@/entities/scene/model/pipeline-geometry';
import { short } from '@/shared/lib/format-number';
import { DEMO_TRIANGLE, type Subject } from './pipeline-subject';
import type { StageIndex } from './stage-lines';

export const INTRO = {
  title: 'From vertex to pixel',
  text: 'Seven stages turn your shape into pixels. Pick one to see what it does.',
} as const;

export const ASSEMBLY: Record<PrimitiveType, string> = {
  POINTS: 'GL_POINTS keeps each corner as its own point.',
  LINES: 'GL_LINES joins each pair of corners into a line.',
  LINE_STRIP: 'GL_LINE_STRIP joins each corner to the next.',
  LINE_LOOP: 'GL_LINE_LOOP joins each corner to the next, and the last back to the first.',
  TRIANGLES: 'GL_TRIANGLES joins every three corners into a triangle.',
  TRIANGLE_STRIP: 'GL_TRIANGLE_STRIP makes a triangle from each corner and the two before it.',
  TRIANGLE_FAN: 'GL_TRIANGLE_FAN makes triangles that all share the first corner.',
  QUADS: 'GL_QUADS joins every four corners into a quad.',
  QUAD_STRIP: 'GL_QUAD_STRIP makes a quad from each new pair of corners and the pair before.',
  POLYGON: 'GL_POLYGON joins all the corners into one polygon.',
};

/** One plain sentence for a stage, in the shape's own numbers. */
export function stageSentence(stage: StageIndex, subject: Subject, window: { width: number; height: number }): string {
  switch (stage) {
    case 0:
      return `Your program lists ${subject.stored.length} ${subject.stored.length === 1 ? 'corner' : 'corners'}, each with a colour. Nothing is drawn yet: these are just numbers.`;
    case 1: {
      const t = (subject.node ?? DEMO_TRIANGLE).transform;
      if (t.translateX === 0 && t.translateY === 0 && t.rotate === 0 && t.scaleX === 1 && t.scaleY === 1) {
        return 'Each corner is multiplied by the modelview matrix. Yours is the identity, so the corners stay where they are.';
      }
      return `Each corner is multiplied by the modelview matrix: scaled ${short(t.scaleX)} × ${short(t.scaleY)}, turned ${short(t.rotate)}° and moved (${short(t.translateX)}, ${short(t.translateY)}).`;
    }
    case 2:
      return ASSEMBLY[subject.type];
    case 3: {
      const outcome = clipOutcome(subject.type, subject.world, subject.volume);
      if (outcome === 'inside') return 'glOrtho sets the visible box. Your shape is inside it, so nothing is cut off.';
      if (outcome === 'partial') return 'glOrtho sets the visible box. The parts outside it are cut off, and new corners appear where the edges cross it.';
      return 'glOrtho sets the visible box. Your shape is entirely outside it, so nothing reaches the screen.';
    }
    case 4:
      return `The shape becomes squares: one fragment for every pixel whose centre it covers. Shown 24 across; your ${window.width} × ${window.height} window has many more.`;
    case 5:
      if (subject.texture) return 'Each fragment reads its colour from the texture, at the UV the corners carry.';
      if (subject.shading === 'FLAT') return "With flat shading, every fragment of a primitive takes one corner's colour.";
      return 'Each fragment gets a colour, blended from the corner colours by how close it is to each.';
    case 6:
      return 'The fragments are written over the cleared background, then glutSwapBuffers shows the finished frame.';
  }
}
