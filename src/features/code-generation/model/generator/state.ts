import type { SceneNode } from '@/core/types/scene';
import { sanitizeName } from './utils';

export interface StateOptions {
  /** Add colour and visibility fields (a colour or visibility rule exists). */
  extended?: boolean;
  /** Objects a Reset rule targets: each gets a const initial_<name>. */
  resetIds?: ReadonlySet<string>;
}

export const generateState = (allObjects: SceneNode[], options: StateOptions = {}): string => {
  let code = `// --- Global State ---\n`;
  code += `struct ObjectState {\n`;
  code += `    float x, y;\n`;
  code += `    float rotation;\n`;
  code += `    float scaleX, scaleY;\n`;
  if (options.extended) {
    code += `    float r, g, b;\n`;
    code += `    bool useColor;\n`;
    code += `    bool visible;\n`;
  }
  code += `};\n\n`;
  const tail = options.extended ? ', 0.0f, 0.0f, 0.0f, false, true' : '';
  const initializer = (obj: SceneNode) => {
    const t = obj.transform;
    return `{ ${t.translateX.toFixed(4)}f, ${t.translateY.toFixed(4)}f, ${t.rotate.toFixed(4)}f, ${t.scaleX.toFixed(4)}f, ${t.scaleY.toFixed(4)}f${tail} }`;
  };
  allObjects.forEach((obj) => {
    code += `ObjectState state_${sanitizeName(obj.name)} = ${initializer(obj)};\n`;
  });
  allObjects
    .filter((obj) => options.resetIds?.has(obj.id))
    .forEach((obj) => {
      code += `const ObjectState initial_${sanitizeName(obj.name)} = ${initializer(obj)};\n`;
    });
  return code + `\n`;
};
