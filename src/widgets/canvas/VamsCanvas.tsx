import { useRef, useState, useEffect } from 'react';
import { useVamsStore } from '@/core/store';
import { usePixiApp } from '@/shared/engine/pixi/hooks/usePixiApp';
import { useCanvasInteraction } from '@/features/scene-interaction/model/useCanvasInteraction';
import { useSceneRenderer } from '@/shared/engine/pixi/hooks/useSceneRenderer';
import { useCustomShapePreview } from '@/features/custom-shapes/model/useCustomShapePreview';
import { useGridSystem } from '@/shared/engine/pixi/hooks/useGridSystem';
import { animationController } from '@/features/animation-preview/model/animation-controller';
import { CanvasOverlays } from './ui/CanvasOverlays';
import './vams-canvas.scss';

interface VamsCanvasProps {
  isHidden?: boolean;
}

export default function VamsCanvas({ isHidden = false }: VamsCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [coordinates, setCoordinates] = useState({ x: 0, y: 0 });

  const viewportLimits = useVamsStore((state) => state.viewportLimits);
  const interactionMode = useVamsStore((state) => state.interactionMode);
  const showCoordinateTracker = useVamsStore((state) => state.showCoordinateTracker);
  const activeSection = useVamsStore((state) => state.activeSection);
  const setCursorWorld = useVamsStore((state) => state.setCursorWorld);
  const objectCount = useVamsStore((state) => state.objects.length);
  const appMode = useVamsStore((state) => state.appMode);

  const { pixiReady, appRef, worldRef, gridRef, overlayRef } = usePixiApp(canvasRef);
  
  const { screenToWorld, applyViewportTransform } = useCanvasInteraction({
    pixiReady,
    appRef,
    worldRef,
    canvasRef,
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
      // Tear down any in-flight animation preview so its frame loop never leaks.
      animationController.cleanup();
    };
  }, [setCursorWorld]);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isHidden) return;
    const { x, y } = screenToWorld(event.clientX, event.clientY);
    
    setCoordinates({ x, y });
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

  const cursorStyle = interactionMode === 'VERTEX_PLACE' ? 'crosshair' : undefined;
  
  // Derive effective visibility: disable in Pipeline tab to prevent redundant UI, 
  // but preserve the underlying user setting for when they switch tabs.
  const effectiveShowCoordinateTracker = showCoordinateTracker && activeSection !== 'Pipeline';

  // Onboarding nudge: only on the real editing canvas, in Author mode, with an empty scene.
  const showEmptyHint =
    !isHidden && appMode === 'Author' && activeSection !== 'Pipeline' && objectCount === 0;

  return (
    <div
      className={`canvas-wrapper ${isHidden ? 'hidden' : ''}`}
      ref={canvasRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onContextMenu={(event) => event.preventDefault()}
      style={{ cursor: cursorStyle }}
    >
      <CanvasOverlays
        viewportLimits={viewportLimits}
        interactionMode={interactionMode}
        coordinates={coordinates}
        showCoordinateTracker={effectiveShowCoordinateTracker}
        showEmptyHint={showEmptyHint}
      />
    </div>
  );
}