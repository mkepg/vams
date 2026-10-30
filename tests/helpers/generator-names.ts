import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const GL_NAME = /\b(gl[A-Z]\w*|glut[A-Z]\w*|GL_[A-Z0-9_]+|GLUT_[A-Z0-9_]+)\b/g;

/** Every OpenGL and GLUT name the code generator's source can emit, sorted. */
export function generatorNames(): string[] {
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
