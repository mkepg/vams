import { Shapes } from "lucide-react";
import { useVamsStore } from "@/core/store";
import { Button } from "@/shared/ui/controls";
import { RunLayer } from "@/features/callbacks";

interface CanvasOverlaysProps {
  showEmptyHint?: boolean;
}

/** What sits over the scene: the running program, and the empty-scene card. */
export function CanvasOverlays({ showEmptyHint = false }: CanvasOverlaysProps) {
  const interactionMode = useVamsStore((s) => s.interactionMode);
  const setLearnOpen = useVamsStore((s) => s.setLearnOpen);
  const setRailPanel = useVamsStore((s) => s.setRailPanel);
  // Add may already be showing, so also bring the panel up and put focus on the first tile.
  const addAShape = () => {
    setRailPanel('add');
    requestAnimationFrame(() => document.querySelector<HTMLElement>('#editor-panel .primitive-tile')?.focus());
  };
  return (
    <>
      <RunLayer />
      {showEmptyHint && interactionMode !== "VERTEX_PLACE" && (
        <div className="empty-canvas-hint">
          <Shapes size={32} aria-hidden />
          <p>Your scene is empty.</p>
          <div className="empty-canvas-hint__actions">
            <Button variant="primary" onClick={addAShape}>
              Add a shape
            </Button>
            <Button onClick={() => setLearnOpen(true)}>Start a lesson</Button>
          </div>
        </div>
      )}
    </>
  );
}
