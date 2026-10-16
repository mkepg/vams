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
      const width = Math.floor(target.clientWidth);
      const height = Math.floor(target.clientHeight);
      // A 0 by 0 read means the box is not laid out right now; keep the last real size.
      if (width === 0 && height === 0) return;
      setCanvasSize({ width, height });
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