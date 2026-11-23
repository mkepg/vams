import { useEffect, useRef, useSyncExternalStore } from 'react';
import { runView, useRunSnapshot } from '@/features/callbacks';

/**
 * While Run is on, the running program's frames as the exported program draws them on the lab PCs,
 * over the editing view. Pointer input passes through to the canvas below, which Run listens to.
 * Outside Run there is no element at all, so the editing canvas is the wrapper's only canvas.
 */
export function RunViewCanvas() {
  const running = useRunSnapshot().running;
  return running ? <RunViewFrames /> : null;
}

function RunViewFrames() {
  const ref = useRef<HTMLCanvasElement>(null);
  const showing = useSyncExternalStore(
    (listener) => runView.subscribe(listener),
    () => runView.isShowing(),
  );
  useEffect(() => {
    runView.attach(ref.current);
    return () => runView.attach(null);
  }, []);
  return <canvas ref={ref} className="run-view" data-showing={showing ? '' : undefined} aria-hidden="true" />;
}
