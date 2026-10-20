/**
 * BLACK-BOX TEST SUITE — BB-LRULE
 * The rules every lesson meets: coverage, structure and wording
 *
 * Test focus:
 *  - Every GL name the generator can emit is taught in a lesson, or listed as untaught
 *  - No lesson text uses the banned wording
 *  - Waiting steps in the sections on the bar carry hints and a task
 *  - Waiting steps without a widget can be solved, and solving them makes them pass
 *  - Every lesson closes with a recap whose calls are in the code of its last step
 *  - Every predict step offers 2-4 answers, each with a why, one of them right, and has an action
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CurriculumSection } from '@/core/store/types';
import type { Lesson } from '@/core/types/lesson';
import { LESSON_REGISTRY } from '@/features/lesson-engine/model/lesson-registry';
import { SAMPLE_LESSONS } from '@/features/lesson-engine/model/sample-lessons';
import { waitsForStudent } from '@/features/lesson-engine/model/step-rules';
import { useVamsStore } from '@/core/store';
import { solvedStepScene } from '../helpers/lesson-scene';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { outlineCode, findCallLine } from '@/features/code-generation/model/code-outline';

/** Sections whose lessons already meet the full bar. The content work adds each one as it lands. */
export const SECTIONS_ON_THE_BAR: CurriculumSection[] = [];

export function lessonsUnderRules(): Lesson[] {
  return [
    ...Object.values(LESSON_REGISTRY).filter((l) => SECTIONS_ON_THE_BAR.includes(l.section)),
    ...Object.values(SAMPLE_LESSONS),
  ];
}

/** Everything a lesson teaches in words. Later blocks add their own text here. */
export function taughtText(lesson: Lesson): string {
  const parts: string[] = [];
  for (const step of lesson.steps) {
    parts.push(step.narration);
    if (step.hints) parts.push(...step.hints);
    if (step.recap) parts.push(...step.recap.calls);
    if (step.predict) for (const o of step.predict.options) parts.push(o.label, o.why);
  }
  return parts.join('\n');
}

/** Every text a student can read in a lesson, for the wording rule. */
function allText(lesson: Lesson): string {
  const parts = [lesson.title, taughtText(lesson)];
  for (const step of lesson.steps) {
    if (step.task) parts.push(step.task);
    if (step.recap) parts.push(...step.recap.points);
    if (step.goals) parts.push(...step.goals.map((g) => g.label));
    const ex = step.exercise;
    if (ex) {
      parts.push(ex.prompt);
      if (ex.kind === 'multiple-choice') parts.push(...ex.options.map((o) => o.label));
      else parts.push(...ex.items.map((i) => i.label));
    }
  }
  return parts.join('\n');
}

const GL_NAME = /\b(gl[A-Z]\w*|glut[A-Z]\w*|GL_[A-Z0-9_]+|GLUT_[A-Z0-9_]+)\b/g;

function generatorNames(): string[] {
  const dir = join(process.cwd(), 'src/features/code-generation/model');
  const files = [
    join(dir, 'code-generator.ts'),
    ...readdirSync(join(dir, 'generator'))
      .filter((f) => f.endsWith('.ts'))
      .map((f) => join(dir, 'generator', f)),
  ];
  const names = new Set<string>();
  for (const f of files) {
    for (const m of readFileSync(f, 'utf8').matchAll(GL_NAME)) names.add(m[0]);
  }
  names.delete('GLUT_FUNCS');
  return [...names].sort();
}

function isTaught(name: string, text: string): boolean {
  return new RegExp(`\\b${name}\\b`).test(text);
}

/** GL names no lesson teaches yet. It only shrinks: teach a name, then delete it here. */
const UNTAUGHT_ALLOWLIST: string[] = [
  'GLUT_BITMAP_9_BY_15', 'GLUT_DOUBLE', 'GLUT_DOWN', 'GLUT_KEY_DOWN', 'GLUT_KEY_LEFT', 'GLUT_KEY_RIGHT',
  'GLUT_KEY_UP', 'GLUT_LEFT_BUTTON', 'GLUT_MIDDLE_BUTTON', 'GLUT_MULTISAMPLE', 'GLUT_RGB',
  'GLUT_RIGHT_BUTTON', 'GLUT_UP', 'GLUT_WINDOW_HEIGHT', 'GLUT_WINDOW_WIDTH', 'GL_ARRAY_BUFFER',
  'GL_COLOR_ARRAY', 'GL_COLOR_BUFFER_BIT', 'GL_DYNAMIC_DRAW', 'GL_ELEMENT_ARRAY_BUFFER', 'GL_FLAT',
  'GL_FLOAT', 'GL_LINES', 'GL_MODELVIEW', 'GL_POLYGON', 'GL_PROJECTION', 'GL_QUAD_STRIP', 'GL_REPLACE',
  'GL_RGBA', 'GL_SMOOTH', 'GL_STREAM_DRAW', 'GL_TEXTURE_2D', 'GL_TEXTURE_COORD_ARRAY', 'GL_TEXTURE_ENV',
  'GL_TEXTURE_ENV_MODE', 'GL_TEXTURE_MIN_FILTER', 'GL_TEXTURE_WRAP_S', 'GL_TEXTURE_WRAP_T',
  'GL_TRIANGLE_FAN', 'GL_TRIANGLE_STRIP', 'GL_TRUE', 'GL_UNSIGNED_BYTE', 'GL_UNSIGNED_INT',
  'GL_VERTEX_ARRAY', 'GL_WRITE_ONLY', 'glClearColor', 'glColor3ub', 'glColorPointer', 'glDisableClientState',
  'glEnableClientState', 'glGenTextures', 'glLoadIdentity', 'glMapBuffer', 'glMatrixMode', 'glPointSize',
  'glShadeModel', 'glTexCoordPointer', 'glTexEnvi', 'glTexParameteri', 'glVertexPointer', 'glViewport',
  'glutCreateWindow', 'glutDisplayFunc', 'glutGet', 'glutIdleFunc', 'glutInit', 'glutInitDisplayMode',
  'glutInitWindowSize', 'glutMainLoop', 'glutMotionFunc', 'glutMouseFunc', 'glutReshapeFunc',
];

describe('BB-LRULE-01: Every GL name the generator emits is taught or listed', () => {
  const names = generatorNames();
  const text = Object.values(LESSON_REGISTRY).map(taughtText).join('\n');
  const untaught = names.filter((n) => !isTaught(n, text));

  it('reads the generator source', () => {
    expect(names.length).toBeGreaterThan(100);
    expect(names).toContain('glBegin');
    expect(names).toContain('GL_TRIANGLES');
  });

  it('every untaught name is in the allowlist', () => {
    const missing = untaught.filter((n) => !UNTAUGHT_ALLOWLIST.includes(n));
    if (missing.length) console.log('UNTAUGHT:', JSON.stringify(untaught));
    expect(missing).toEqual([]);
  });

  it('every allowlist entry is a generator name that is still untaught', () => {
    const stale = UNTAUGHT_ALLOWLIST.filter((n) => !names.includes(n) || !untaught.includes(n));
    expect(stale).toEqual([]);
  });
});

describe('BB-LRULE-02: No lesson text uses banned wording', () => {
  it('narration, tasks, hints and exercise text are clean', () => {
    const banned = /coming soon|not supported|future|deferred|\b3D\b|lighting/i;
    const offenders = [...Object.values(LESSON_REGISTRY), ...Object.values(SAMPLE_LESSONS)]
      .filter((l) => banned.test(allText(l)))
      .map((l) => l.id);
    expect(offenders).toEqual([]);
  });
});

describe('BB-LRULE-03: Waiting steps carry hints and a task', () => {
  it('every waiting step under the rules has 1-3 hints and a task', () => {
    const bad: string[] = [];
    for (const lesson of lessonsUnderRules()) {
      lesson.steps.forEach((step, i) => {
        if (!waitsForStudent(step)) return;
        const hints = step.hints ?? [];
        const ok =
          hints.length >= 1 && hints.length <= 3 && hints.every((h) => h.trim()) && !!step.task?.trim();
        if (!ok) bad.push(`${lesson.id}#${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });
});

describe('BB-LRULE-04: Waiting steps can be solved, and solving them makes them pass', () => {
  afterEach(() => {
    useVamsStore.getState().clearLessonState();
  });

  it('the sample lessons are under the rules', () => {
    expect(lessonsUnderRules().map((l) => l.id)).toContain('sample-goals');
  });

  it('every waiting step without an exercise has a solve', () => {
    const bad: string[] = [];
    for (const lesson of lessonsUnderRules()) {
      lesson.steps.forEach((step, i) => {
        if (waitsForStudent(step) && !step.exercise && !step.solve) bad.push(`${lesson.id}#${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it("the step's action and solve, on the scene the earlier steps built, meet its goals and success check", () => {
    const bad: string[] = [];
    for (const lesson of lessonsUnderRules()) {
      lesson.steps.forEach((step, i) => {
        if (!waitsForStudent(step)) return;
        solvedStepScene(lesson, i);
        const state = useVamsStore.getState();
        const unmet = (step.goals ?? []).filter((g) => !g.check(state)).map((g) => g.label);
        if (step.successCheck && !step.successCheck(state)) unmet.push('successCheck');
        if (unmet.length) bad.push(`${lesson.id}#${i + 1}: ${unmet.join(', ')}`);
      });
    }
    expect(bad).toEqual([]);
  });
});

describe('BB-LRULE-05: Every lesson closes with a recap, and its calls are in the code', () => {
  afterEach(() => {
    useVamsStore.getState().clearLessonState();
  });

  it('the recap sample is under the rules', () => {
    expect(lessonsUnderRules().map((l) => l.id)).toContain('sample-recap');
  });

  it('the last step of every lesson under the rules has 1-3 points and at least one call', () => {
    const bad: string[] = [];
    for (const lesson of lessonsUnderRules()) {
      const recap = lesson.steps[lesson.steps.length - 1].recap;
      const ok =
        !!recap &&
        recap.points.length >= 1 &&
        recap.points.length <= 3 &&
        recap.points.every((p) => p.trim()) &&
        recap.calls.length >= 1;
      if (!ok) bad.push(lesson.id);
    }
    expect(bad).toEqual([]);
  });

  it("every recap call is found in the code generated for its step's scene", () => {
    const bad: string[] = [];
    for (const lesson of lessonsUnderRules()) {
      const last = lesson.steps.length - 1;
      const recap = lesson.steps[last].recap;
      if (!recap) continue;
      solvedStepScene(lesson, last);
      const s = useVamsStore.getState();
      const outline = outlineCode(
        generateCodeFromState(
          { objects: s.objects, canvasBackgroundColor: s.canvasBackgroundColor, callbacks: s.callbacks, viewportLimits: s.viewportLimits, textures: s.getAllTextures() },
          { width: 800, height: 600 },
        ),
      );
      for (const call of recap.calls) {
        if (findCallLine(outline, null, call) === null) bad.push(`${lesson.id}: ${call}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('taughtText counts the recap calls', () => {
    const lesson = SAMPLE_LESSONS['sample-recap'];
    expect(lesson.steps.some((step) => step.narration.includes('glScalef'))).toBe(false);
    expect(taughtText(lesson)).toMatch(/\bglScalef\b/);
  });
});

describe('BB-LRULE-06: Predict steps offer 2-4 answers with a why each, one right, and an action', () => {
  it('the predict sample is under the rules', () => {
    expect(lessonsUnderRules().map((l) => l.id)).toContain('sample-predict');
  });

  it('every predict step under the rules is well formed', () => {
    const bad: string[] = [];
    for (const lesson of lessonsUnderRules()) {
      lesson.steps.forEach((step, i) => {
        const p = step.predict;
        if (!p) return;
        const ids = p.options.map((o) => o.id);
        const ok =
          p.options.length >= 2 &&
          p.options.length <= 4 &&
          new Set(ids).size === ids.length &&
          p.options.every((o) => o.label.trim() && o.why.trim()) &&
          ids.includes(p.correctId) &&
          !!step.action;
        if (!ok) bad.push(`${lesson.id}#${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('taughtText counts the answer labels and whys', () => {
    const text = taughtText(SAMPLE_LESSONS['sample-predict']);
    expect(text).toContain('It grows wider');
    expect(text).toContain('Translate moves a shape; scale changes its size.');
  });
});
