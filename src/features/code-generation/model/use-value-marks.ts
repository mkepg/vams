import { useEffect, useRef, useState } from 'react';
import type { CodeMark } from '@/shared/ui/code-viewer/types';
import { diffChangedValues } from './value-diff';

export interface MarkSnapshot {
  code: string;
  width: number;
  height: number;
  swapKey: string;
  selectionKey: string | null;
}

/**
 * What a new render does to the value marks. Only the student's own edit is marked (`diff`).
 * A canvas resize (only glutInitWindowSize changes) and a lesson starting or ending (`swapKey`)
 * are not the student's edit, and neither is a new selection with no code change: they `clear`
 * the marks and mark nothing.
 */
export function nextMarks(prev: MarkSnapshot | null, next: MarkSnapshot): 'keep' | 'clear' | 'diff' {
  if (!prev) return 'keep';
  if (prev.code === next.code) return prev.selectionKey === next.selectionKey ? 'keep' : 'clear';
  if (prev.width !== next.width || prev.height !== next.height || prev.swapKey !== next.swapKey) return 'clear';
  return 'diff';
}

/** The values the student's last edit changed. `key` changes with every new edit, so the fade restarts. */
export function useValueMarks(
  code: string,
  canvas: { width: number; height: number },
  swapKey: string,
  selectionKey: string | null,
): { marks: CodeMark[]; key: number } {
  const [state, setState] = useState<{ marks: CodeMark[]; key: number }>({ marks: [], key: 0 });
  const last = useRef<MarkSnapshot | null>(null);
  useEffect(() => {
    const prev = last.current;
    const next: MarkSnapshot = { code, width: canvas.width, height: canvas.height, swapKey, selectionKey };
    last.current = next;
    const step = nextMarks(prev, next);
    if (step === 'clear') {
      // A render that is not the student's edit drops the marks.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState((s) => (s.marks.length === 0 ? s : { marks: [], key: s.key }));
    } else if (step === 'diff' && prev) {
      setState((s) => ({ marks: diffChangedValues(prev.code, code), key: s.key + 1 }));
    }
  }, [code, canvas.width, canvas.height, swapKey, selectionKey]);
  return state;
}
