import { useSyncExternalStore } from 'react';
import { animationController } from './animation-controller';
import type { MotionType } from './motion';

/**
 * React binding for the {@link animationController}. Components read the live
 * playback snapshot and trigger play/stop, but the controller — not React —
 * owns the frame loop and the transient pose.
 */
export function useAnimationPreview() {
  const snapshot = useSyncExternalStore(
    animationController.subscribe,
    animationController.getSnapshot,
  );

  return {
    ...snapshot,
    play: (objectId: string, motion: MotionType, speed?: number) =>
      animationController.play(objectId, motion, speed),
    stop: () => animationController.stop(),
  };
}
