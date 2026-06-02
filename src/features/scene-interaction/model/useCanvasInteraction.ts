import { useRef, useEffect, useCallback } from "react";
import type { Application, Container, FederatedPointerEvent } from "pixi.js";
import { Rectangle } from "pixi.js";
import { useVamsStore } from "@/core/store";
interface UseCanvasInteractionProps {
  pixiReady: boolean;
  appRef: React.MutableRefObject<Application | null>;
  worldRef: React.MutableRefObject<Container | null>;
  canvasRef: React.RefObject<HTMLDivElement | null>;
}
export function useCanvasInteraction({
  pixiReady,
  appRef,
  worldRef,
  canvasRef,
}: UseCanvasInteractionProps) {
  const cleanupListenersRef = useRef<(() => void) | null>(null);
  const viewportLimits = useVamsStore((s) => s.viewportLimits);
  const viewportLimitsRef = useRef(viewportLimits);
  useEffect(() => {
    viewportLimitsRef.current = viewportLimits;
  }, [viewportLimits]);
  const learningSettings = useVamsStore((s) => s.learningSettings);
  const learningSettingsRef = useRef(learningSettings);
  useEffect(() => {
    learningSettingsRef.current = learningSettings;
  }, [learningSettings]);
  const interactionMode = useVamsStore((s) => s.interactionMode);
  const interactionModeRef = useRef(interactionMode);
  useEffect(() => {
    interactionModeRef.current = interactionMode;
  }, [interactionMode]);
  const addPendingVertex = useVamsStore((s) => s.addPendingVertex);
  const addPendingVertexRef = useRef(addPendingVertex);
  useEffect(() => {
    addPendingVertexRef.current = addPendingVertex;
  }, [addPendingVertex]);
  const selectObject = useVamsStore((s) => s.selectObject);
  const applyViewportTransform = useCallback(() => {
    const app = appRef.current;
    const world = worldRef.current;
    if (!app || !world) return;
    const { minX, maxX, minY, maxY } = viewportLimitsRef.current;
    const w = app.screen.width;
    const h = app.screen.height;
    const vw = maxX - minX;
    const vh = maxY - minY;
    if (vw === 0 || vh === 0) return;
    const sx = w / vw;
    const sy = h / vh;
    world.scale.set(sx, -sy);
    world.position.set(-minX * sx, h + minY * sy);
    app.stage.hitArea = new Rectangle(0, 0, w, h);
  }, [appRef, worldRef]);
  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      const pixelX = clientX - rect.left;
      const pixelY = clientY - rect.top;
      const { minX, maxX, minY, maxY } = viewportLimitsRef.current;
      const vw = maxX - minX;
      const vh = maxY - minY;
      let x = minX + (pixelX / rect.width) * vw;
      let y = minY + ((rect.height - pixelY) / rect.height) * vh;
      const settings = learningSettingsRef.current;
      if (settings.gridSnapping) {
        const snap = settings.snapIncrement;
        x = Math.round(x / snap) * snap;
        y = Math.round(y / snap) * snap;
      }
      return { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) };
    },
    [canvasRef]
  );
  useEffect(() => {
    if (!pixiReady) return;
    applyViewportTransform();
  }, [pixiReady, viewportLimits, applyViewportTransform]);
  useEffect(() => {
    const app = appRef.current;
    if (!app || !pixiReady) return;
    const onStagePointerDown = (e: FederatedPointerEvent) => {
      if (interactionModeRef.current === "VERTEX_PLACE") {
        if (e.button !== 0) return;
        e.stopPropagation();
        const { x, y } = screenToWorld(e.clientX, e.clientY);
        addPendingVertexRef.current(x, y);
        return;
      }
      if (e.target === app.stage) {
        selectObject(null);
      }
    };
    const onResize = () => applyViewportTransform();
    app.stage.eventMode = "static";
    app.stage.on("pointerdown", onStagePointerDown);
    window.addEventListener("resize", onResize);
    cleanupListenersRef.current = () => {
      window.removeEventListener("resize", onResize);
      app.stage.off("pointerdown", onStagePointerDown);
    };
    return () => {
      if (cleanupListenersRef.current) {
        cleanupListenersRef.current();
        cleanupListenersRef.current = null;
      }
    };
  }, [pixiReady, appRef, screenToWorld, selectObject, applyViewportTransform]);
  useEffect(() => {
    if (!pixiReady) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useVamsStore.getState();
      // Only vertex-placement keys live here. App-level shortcuts (delete,
      // duplicate, undo/redo) are handled centrally in useKeyboardShortcuts.
      if (interactionModeRef.current !== "VERTEX_PLACE") return;

      if (e.key === "Escape") {
        state.cancelCustomShape();
      } else if (e.key === "Enter") {
        if (
          state.pendingShapeType &&
          state.pendingVertices.length >= state.pendingMinVertices
        ) {
          state.addCustomObject(state.pendingShapeType, state.pendingVertices);
        }
      } else if (e.key === "Backspace" || e.key === "Delete") {
        if (state.pendingVertices.length > 0) {
          state.removeLastPendingVertex();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [pixiReady]);
  return {
    screenToWorld,
    applyViewportTransform,
  };
}
