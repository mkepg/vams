import { useSyncExternalStore } from 'react';
import { runController, type RunSnapshot } from './run-controller';

export function useRunSnapshot(): RunSnapshot {
  return useSyncExternalStore(runController.subscribe, runController.getSnapshot);
}
