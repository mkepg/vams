import { Shapes } from "lucide-react";
import type { InteractionMode, ViewportLimits } from "@/core/types/scene";
import { useVamsStore } from "@/core/store";
import AnimationCodeOverlay from "@/features/animation-preview/ui/AnimationCodeOverlay";
interface CanvasOverlaysProps {
  viewportLimits: ViewportLimits;
  interactionMode: InteractionMode;
  coordinates: { x: number; y: number };
  showCoordinateTracker: boolean;
  showEmptyHint?: boolean;
}
export function CanvasOverlays({
  viewportLimits,
  interactionMode,
  coordinates,
  showCoordinateTracker,
  showEmptyHint = false,
}: CanvasOverlaysProps) {
  const setActiveSection = useVamsStore((s) => s.setActiveSection);
  return (
    <>
      <AnimationCodeOverlay />
      <div className="viewport-info">
        Viewport: ({viewportLimits.minX}, {viewportLimits.maxX})
      </div>
      {interactionMode === "VERTEX_PLACE" && (
        <div className="placement-mode-banner">
          <span className="banner-title">● Vertex Placement Mode — click to place</span>
          <span className="banner-hint">
            <kbd>Enter</kbd> finish · <kbd>Backspace</kbd> undo last · <kbd>Esc</kbd> cancel
          </span>
        </div>
      )}
      {showCoordinateTracker && (
        <div className="coordinate-tracker">
          <span className="label-x">X:</span> {coordinates.x.toFixed(2)}
          <span className="label-y">Y:</span> {coordinates.y.toFixed(2)}
        </div>
      )}
      {showEmptyHint && interactionMode !== "VERTEX_PLACE" && (
        <div className="empty-canvas-hint">
          <Shapes size={32} aria-hidden />
          <p>Your scene is empty.</p>
          <button type="button" onClick={() => setActiveSection("Primitives")}>
            Add your first shape
          </button>
        </div>
      )}
    </>
  );
}
