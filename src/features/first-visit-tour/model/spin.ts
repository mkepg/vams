import type { VamsState } from '@/core/store/types';
import type { SceneNode } from '@/core/types/scene';
import { isCallbackValid, newRuleId, programObjects } from '@/core/callbacks/callbacks-model';

/** The Idle handler name Make it spin registers when the scene has no valid one. */
export const SPIN_HANDLER = 'onIdle';
export const SPIN_DEGREES = 2;

/** The object Make it spin turns: the selection when the program draws it, else the first shape it draws. */
export function spinTarget(state: Pick<VamsState, 'objects' | 'selectedObjectId'>): SceneNode | null {
  const drawn = programObjects(state.objects);
  return drawn.find((o) => o.id === state.selectedObjectId) ?? drawn.find((o) => o.type !== 'GROUP') ?? null;
}

/**
 * Registers the Idle callback (unless a valid one exists) and adds "every frame, rotate the target by
 * 2 degrees" through the actions the Callbacks panel uses, as one undo step. Returns the target's id,
 * or null when the program draws nothing. Starting Run is the caller's job.
 */
export function makeItSpin(state: VamsState): string | null {
  const target = spinTarget(state);
  if (!target) return null;
  state.pushToHistory();
  state.startBatch();
  try {
    if (!isCallbackValid(state.callbacks, 'idle')) state.setCallbackHandler('idle', SPIN_HANDLER);
    state.addCallbackRule('idle', {
      id: newRuleId(),
      objectId: target.id,
      trigger: { kind: 'idle' },
      action: { type: 'rotate', degrees: SPIN_DEGREES },
    });
  } finally {
    state.endBatch();
  }
  return target.id;
}
