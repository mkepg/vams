import type { Application, Container } from 'pixi.js';

/**
 * Render bridge — a tiny read-only window into the live PixiJS renderer.
 *
 * The scene renderer (`useSceneRenderer`) already keeps a private map of
 * scene-object id → on-screen display Container. The Animation Preview needs
 * to nudge a single display object directly, frame by frame, WITHOUT touching
 * the Zustand scene state. Rather than spin up a second source of truth, the
 * renderer registers a couple of accessors here and the preview reads them.
 *
 * Two hard rules live in this file's contract:
 *   1. `getDisplayObject` is read-only. Callers may animate the returned
 *      Container, but the saved scene never learns about it.
 *   2. `resync()` re-applies the store transforms to the live containers,
 *      restoring the renderer to "state is the single source of truth" after
 *      a transient preview ends.
 */

interface RenderBridgeHandlers {
  /** Look up the live display object for a scene-object id. */
  getDisplayObject: (id: string) => Container | undefined;
  /** Re-apply every object's stored transform onto its live container. */
  resync: () => void;
  /** The active PixiJS application (used for its shared frame ticker). */
  app: Application;
}

let handlers: RenderBridgeHandlers | null = null;

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
};
