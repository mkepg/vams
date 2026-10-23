import { useRef, useEffect } from 'react';
import { useVamsStore } from '@/core/store';
import { usePixiApp } from '@/shared/engine/pixi/hooks/usePixiApp';
import { useCanvasInteraction } from '@/features/scene-interaction/model/useCanvasInteraction';
import { useSceneRenderer } from '@/shared/engine/pixi/hooks/useSceneRenderer';
import { useCustomShapePreview } from '@/features/custom-shapes/model/useCustomShapePreview';
import { useGridSystem } from '@/shared/engine/pixi/hooks/useGridSystem';
import { runController } from '@/features/callbacks';
import { observeResize } from '@/shared/engine/observe-resize';
import { CanvasOverlays } from './ui/CanvasOverlays';
import './vams-canvas.scss';

interface VamsCanvasProps {
  isHidden?: boolean;
  /** Draws the scene without taking pointer or key input (the shared scene view). */
  readOnly?: boolean;
}

export default function VamsCanvas({ isHidden = false, readOnly = false }: VamsCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  const interactionMode = useVamsStore((state) => state.interactionMode);
  const setCursorWorld = useVamsStore((state) => state.setCursorWorld);
  const objectCount = useVamsStore((state) => state.objects.length);
  const appMode = useVamsStore((state) => state.appMode);

  const { pixiReady, appRef, worldRef, gridRef, overlayRef } = usePixiApp(canvasRef);
  
  const { screenToWorld, applyViewportTransform } = useCanvasInteraction({
    pixiReady,
    appRef,
    worldRef,
    canvasRef,
    readOnly,
  });

  useSceneRenderer({ pixiReady, appRef, worldRef, overlayRef, applyViewportTransform });
  useGridSystem({ pixiReady, appRef, worldRef, gridRef });
  useCustomShapePreview({ pixiReady, worldRef });

  const rafRef = useRef<number | null>(null);
  const pendingCoordRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      setCursorWorld(null);
      runController.cleanup();
    };
  }, [setCursorWorld]);

  // PixiJS, the grid and the viewport transform listen for window resizes. The canvas box also
  // changes when a panel hides or the lesson bar grows, so pass those changes on the same way.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    return observeResize(el, () => window.dispatchEvent(new Event('resize')));
  }, []);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    // During Run the program's windowToWorld drives the readout (run-controller).
    if (isHidden || readOnly || runController.isRunning()) return;
    const { x, y } = screenToWorld(event.clientX, event.clientY);

    pendingCoordRef.current = { x, y };

    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        if (pendingCoordRef.current) setCursorWorld(pendingCoordRef.current);
        rafRef.current = null;
      });
    }
  };

  const handlePointerLeave = () => {
    setCursorWorld(null);
  };

  const cursorStyle = !readOnly && interactionMode === 'VERTEX_PLACE' ? 'crosshair' : undefined;
  
  // Onboarding nudge: only on the real editing canvas, in Author mode, with an empty scene.
  const showEmptyHint =
    !isHidden && !readOnly && appMode === 'Author' && objectCount === 0;

  return (
    <div
      className={`canvas-wrapper${isHidden ? ' hidden' : ''}${readOnly ? ' canvas-wrapper--readonly' : ''}`}
      ref={canvasRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onContextMenu={(event) => event.preventDefault()}
      style={{ cursor: cursorStyle }}
    >
      <CanvasOverlays showEmptyHint={showEmptyHint} />
    </div>
  );
}