/** Shared scene builders that generate the program: the generator is exercised the same way by several suites. */
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import type { CallbackRule } from '@/core/types/scene';
import { addTriangle, addQuad, addPrimitive, getState } from './store';

export const program = () => {
  const s = getState();
  return generateCodeFromState(
    { objects: s.objects, canvasBackgroundColor: s.canvasBackgroundColor, callbacks: s.callbacks, viewportLimits: s.viewportLimits, textures: s.getAllTextures() },
    { width: 800, height: 600 },
  );
};
export const rule = (objectId: string, over: Partial<CallbackRule> = {}): CallbackRule => ({
  id: `r-${Math.random()}`, objectId, trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'translate', dx: 0.1, dy: 0 }, ...over,
});

/** Every structure the generator writes: vertex arrays, an indexed textured quad, a dynamic VBO, text, a group, three handlers. */
export function fullFixture() {
  const tri = addTriangle(0.4, -0.17, 0.5);
  const quad = addQuad(-0.3, 0.3, 0.2);
  getState().updateRenderingMode(quad.id, 'VERTEX_ARRAY');
  getState().updateUseIndexed(quad.id, true);
  getState().attachTexture(quad.id, getState().getAllTextures()[0].id);
  getState().updateRenderingMode(tri.id, 'VBO');
  getState().updateBufferUsage(tri.id, 'DYNAMIC');
  getState().addTextObject('Hi', 0.1, 0.2);
  const text = getState().objects[0];
  getState().setCallbackHandler('keyboard', 'onKey');
  getState().addCallbackRule('keyboard', rule(tri.id));
  getState().setCallbackHandler('mouse', 'onMouse');
  getState().setCallbackHandler('idle', 'onIdle');
  return { tri, quad, text, code: program() };
}
/** Every generator feature at once: all ten modes of drawing data, every callback kind and every action. */
export function everythingFixture() {
  fullFixture();
  const line = addPrimitive('LINE_STRIP', [{ x: -0.8, y: -0.8 }, { x: -0.6, y: -0.6 }, { x: -0.4, y: -0.8 }]);
  getState().updateLineWidth(line.id, 3);
  getState().updateLineStipple(line.id, { factor: 2, pattern: 0xF0F0 });
  const dots = addPrimitive('POINTS', [{ x: 0.8, y: -0.8 }]);
  getState().updateObjectColorMode(dots.id, 'BYTE');
  getState().updateObjectShading(dots.id, 'FLAT');
  const stream = addTriangle(-0.6, 0.6, 0.1);
  getState().updateRenderingMode(stream.id, 'VBO');
  getState().updateBufferUsage(stream.id, 'STREAM');
  const mapped = addQuad(0.6, 0.6, 0.1);
  getState().updateRenderingMode(mapped.id, 'VBO');
  getState().updateBufferUsage(mapped.id, 'DYNAMIC');
  getState().updateUpdateMethod(mapped.id, 'MAP_BUFFER');
  getState().updateUseIndexed(mapped.id, true);
  const a = addTriangle(-0.2, -0.5, 0.1);
  const b = addTriangle(0.2, -0.5, 0.1);
  getState().createGroup([a.id, b.id]);
  getState().setCallbackHandler('special', 'onSpecial');
  getState().addCallbackRule('special', rule(line.id, { trigger: { kind: 'special', key: 'left' }, action: { type: 'rotate', degrees: 5 } }));
  getState().addCallbackRule('keyboard', rule(dots.id, { trigger: { kind: 'keyboard', key: 's' }, action: { type: 'scale', sx: 1.1, sy: 1.1 } }));
  getState().addCallbackRule('keyboard', rule(dots.id, { trigger: { kind: 'keyboard', key: 'r' }, action: { type: 'reset' } }));
  getState().addCallbackRule('keyboard', rule(dots.id, { trigger: { kind: 'keyboard', key: 'c' }, action: { type: 'setColor', color: '#ff0000' } }));
  getState().addCallbackRule('keyboard', rule(dots.id, { trigger: { kind: 'keyboard', key: ' ' }, action: { type: 'visibility', mode: 'toggle' } }));
  getState().addCallbackRule('mouse', rule(line.id, { trigger: { kind: 'mouse', button: 'left', state: 'down' }, action: { type: 'moveToPointer' } }));
  getState().setCallbackHandler('motion', 'onMotion');
  getState().addCallbackRule('motion', rule(line.id, { trigger: { kind: 'motion' }, action: { type: 'moveToPointer' } }));
  getState().setCallbackHandler('reshape', 'onReshape');
  const painted = addQuad(0.1, 0.8, 0.1);
  getState().attachTexture(painted.id, getState().getAllTextures()[0].id);
  getState().addCallbackRule('keyboard', rule(painted.id, { trigger: { kind: 'keyboard', key: 'h' }, action: { type: 'visibility', mode: 'hide' } }));
  getState().addCallbackRule('keyboard', rule(painted.id, { trigger: { kind: 'keyboard', key: 'v' }, action: { type: 'visibility', mode: 'show' } }));
  getState().setCallbackHandler('idle', 'onIdle');
  getState().addCallbackRule('idle', rule(painted.id, { trigger: { kind: 'idle' }, action: { type: 'rotate', degrees: 1 } }));
  return program();
}
