import { renderBridge } from '@/shared/engine/render-bridge';
import { useVamsStore } from '@/core/store';

/**
 * A minimal stand-in for a PixiJS display Container — just the transform
 * surface the animation controller touches. Lets the white/black-box tests
 * exercise the controller without a live renderer.
 */
export interface FakeDisplay {
  position: { x: number; y: number; set(x: number, y: number): void };
  scale: { x: number; y: number; set(x: number, y: number): void };
  rotation: number;
  destroyed: boolean;
}

export function makeFakeDisplay(): FakeDisplay {
  return {
    position: {
      x: 0,
      y: 0,
      set(x: number, y: number) {
        this.x = x;
        this.y = y;
      },
    },
    scale: {
      x: 1,
      y: 1,
      set(x: number, y: number) {
        this.x = x;
        this.y = y;
      },
    },
    rotation: 0,
    destroyed: false,
  };
}

/**
 * Register a fake renderer that serves `displays` (keyed by object id) and
 * resyncs them from the store. Returns the unregister fn.
 */
export function registerFakeRenderer(displays: Map<string, FakeDisplay>): () => void {
  return renderBridge.register({
    // The controller only ever reads the transform surface; the Application is
    // never touched here, so an empty cast is safe for tests.
    app: {} as never,
    getDisplayObject: (id) => displays.get(id) as never,
    resync: () => {
      useVamsStore.getState().objects.forEach((obj) => {
        const d = displays.get(obj.id);
        if (!d) return;
        d.position.set(obj.transform.translateX, obj.transform.translateY);
        d.rotation = (obj.transform.rotate * Math.PI) / 180;
        d.scale.set(obj.transform.scaleX, obj.transform.scaleY);
      });
    },
  });
}
