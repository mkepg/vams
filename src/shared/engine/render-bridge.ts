import type { Application, Container } from 'pixi.js';

/**
 * Render bridge — a tiny read-only window into the live PixiJS renderer.
 *
 * The scene renderer (`useSceneRenderer`) already keeps a private map of
 * scene-object id → on-screen display Container. Run needs to move display
 * objects directly, frame by frame, WITHOUT touching the Zustand scene state.
 * Rather than spin up a second source of truth, the renderer registers a
 * couple of accessors here and Run reads them.
 *
 * Two hard rules live in this file's contract:
 *   1. `getDisplayObject` is read-only. Callers may animate the returned
 *      Container, but the saved scene never learns about it.
 *   2. `resync()` re-applies the store transforms and visibility, clears Run's
 *      appearance overrides and restores the editor's viewport transform,
 *      returning the renderer to "state is the single source of truth" after
 *      a run ends.
 */

interface RenderBridgeHandlers {
  /** Look up the live display object for a scene-object id. */
  getDisplayObject: (id: string) => Container | undefined;
  /** Re-apply every object's stored transform onto its live container. */
  resync: () => void;
  /** The active PixiJS application (used for its shared frame ticker). */
  app: Application;
  /** Run: draw an object in one flat colour (or its own colours for null), shown or hidden. */
  setAppearance?: (id: string, appearance: { color: string | null; visible: boolean }) => void;
  /** Run: map `view` (world units) onto `rect` (canvas pixels, top-left origin). */
  setView?: (
    view: { minX: number; maxX: number; minY: number; maxY: number },
    rect: { x: number; y: number; width: number; height: number },
  ) => void;
  /** The canvas size in CSS pixels. */
  getCanvasSize?: () => { width: number; height: number };
}

let handlers: RenderBridgeHandlers | null = null;
let editorOverlaysHidden = false;

export const renderBridge = {
  /** Called by the renderer once Pixi is ready. Returns an unregister fn. */
  register(next: RenderBridgeHandlers): () => void {
    handlers = next;
    return () => {
      // Only clear if we're still the active registration.
      if (handlers === next) handlers = null;
    };
  },

  /** True once a renderer has registered. */
  isReady(): boolean {
    return handlers !== null;
  },

  /** Read-only accessor for a live display object. */
  getDisplayObject(id: string): Container | undefined {
    return handlers?.getDisplayObject(id);
  },

  /** The active Pixi application, if any. */
  get app(): Application | null {
    return handlers?.app ?? null;
  },

  /** Restore every live container to its stored transform. No-op if unready. */
  resync(): void {
    handlers?.resync();
  },

  setAppearance(id: string, appearance: { color: string | null; visible: boolean }): void {
    handlers?.setAppearance?.(id, appearance);
  },

  setView(
    view: { minX: number; maxX: number; minY: number; maxY: number },
    rect: { x: number; y: number; width: number; height: number },
  ): void {
    handlers?.setView?.(view, rect);
  },

  getCanvasSize(): { width: number; height: number } | null {
    return handlers?.getCanvasSize?.() ?? null;
  },

  /** Run hides the selection outline and vertex handles while it moves objects; the renderer reads this every frame. */
  setEditorOverlaysHidden(hidden: boolean): void {
    editorOverlaysHidden = hidden;
  },

  editorOverlaysHidden(): boolean {
    return editorOverlaysHidden;
  },
};
