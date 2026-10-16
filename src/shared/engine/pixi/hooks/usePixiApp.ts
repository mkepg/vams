import { useRef, useEffect, useState } from "react";
import { Application, Container } from "pixi.js";
import { SelectionOverlay } from "@/shared/engine/selection-overlay";
import { useVamsStore } from "@/core/store";
import { toHexColor } from "@/shared/lib/hex-color";
interface UsePixiAppReturn {
  pixiReady: boolean;
  appRef: React.MutableRefObject<Application | null>;
  worldRef: React.MutableRefObject<Container | null>;
  gridRef: React.MutableRefObject<Container | null>;
  overlayRef: React.MutableRefObject<SelectionOverlay | null>;
}
export function usePixiApp(
  canvasRef: React.RefObject<HTMLDivElement | null>
): UsePixiAppReturn {
  const [pixiReady, setPixiReady] = useState(false);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const gridRef = useRef<Container | null>(null);
  const overlayRef = useRef<SelectionOverlay | null>(null);
  const canvasBackgroundColor = useVamsStore((s) => toHexColor(s.canvasBackgroundColor));
  useEffect(() => {
    if (!canvasRef.current || appRef.current) return;
    let destroyed = false;
    const init = async () => {
      const app = new Application();
      await app.init({
        background: canvasBackgroundColor,
        resizeTo: canvasRef.current!,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
        eventMode: "static",
        eventFeatures: { move: true, globalMove: true, click: true, wheel: true },
      });
      if (destroyed) {
        app.destroy({ removeView: true });
        return;
      }
      canvasRef.current!.appendChild(app.canvas as HTMLCanvasElement);
      appRef.current = app;
      const grid = new Container();
      app.stage.addChild(grid);
      gridRef.current = grid;
      const world = new Container();
      world.sortableChildren = true;
      app.stage.addChild(world);
      worldRef.current = world;
      const overlay = new SelectionOverlay();
      overlay.zIndex = 9999;
      world.addChild(overlay);
      overlayRef.current = overlay;
      setPixiReady(true);
    };
    init();
    return () => {
      destroyed = true;
      if (appRef.current) {
        appRef.current.destroy({ removeView: true });
        appRef.current = null;
      }
      worldRef.current = null;
      gridRef.current = null;
      overlayRef.current = null;
      setPixiReady(false);
    };
  }, [canvasRef, canvasBackgroundColor]);
  useEffect(() => {
    if (appRef.current) {
      appRef.current.renderer.background.color = canvasBackgroundColor;
    }
  }, [canvasBackgroundColor]);
  return { pixiReady, appRef, worldRef, gridRef, overlayRef };
}