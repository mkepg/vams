import { useState, useEffect } from 'react';
interface CanvasSize {
  width: number;
  height: number;
}
export function useCanvasSize(): CanvasSize {
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 800, height: 600 });
  useEffect(() => {
    const el = document.querySelector('.canvas-wrapper');
    if (!el) return;
    const updateSize = (target: Element) => {
      setCanvasSize({
        width: Math.floor(target.clientWidth),
        height: Math.floor(target.clientHeight),
      });
    };
    updateSize(el);
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) updateSize(entry.target);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return canvasSize;
}