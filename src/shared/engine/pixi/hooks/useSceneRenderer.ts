import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { Container, FederatedPointerEvent, Mesh } from "pixi.js";
import { useVamsStore } from "@/core/store";
import { createDrawable } from "@/shared/engine/pixi/primitives";
import { renderBridge } from "@/shared/engine/render-bridge";
import type { SelectionOverlay } from "@/shared/engine/selection-overlay";
import type { SceneNode } from "@/core/types/scene";

interface UseSceneRendererProps {
  pixiReady: boolean;
  appRef: React.MutableRefObject<PIXI.Application | null>;
  worldRef: React.MutableRefObject<Container | null>;
  overlayRef: React.MutableRefObject<SelectionOverlay | null>;
  applyViewportTransform: () => void;
}
interface DragInfo {
  id: string;
  offsetX: number;
  offsetY: number;
  historyPushed: boolean;
}
interface HandleGraphics extends PIXI.Graphics {
  isHovered?: boolean;
}
export function useSceneRenderer({
  pixiReady,
  appRef,
  worldRef,
  overlayRef,
  applyViewportTransform,
}: UseSceneRendererProps) {
  const dragRef = useRef<DragInfo | null>(null);
  const vertexDragRef = useRef<{ objectId: string; vertexId: string; historyPushed: boolean } | null>(null);
  const interactionModeRef = useRef<string>("SELECT");
  const pushToHistoryRef = useRef<() => void>(() => {});
  const containersRef = useRef<Map<string, Container>>(new Map());
  const objectsRef = useRef<SceneNode[]>([]);
  const prevObjectsRef = useRef<Map<string, SceneNode>>(new Map());
  const prevSelectedObjectIdRef = useRef<string | null>(null);
  const prevWorldScaleRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const vertexOverlayRef = useRef<Container | null>(null);
  const handleGraphicsRef = useRef<HandleGraphics[]>([]);
  const objects = useVamsStore((s) => s.objects);
  const selectedObjectId = useVamsStore((s) => s.selectedObjectId);
  const interactionMode = useVamsStore((s) => s.interactionMode);
  const selectObject = useVamsStore((s) => s.selectObject);
  const updateObjectTransform = useVamsStore((s) => s.updateObjectTransform);
  const updateVertexPosition = useVamsStore((s) => s.updateVertexPosition);
  const pushToHistory = useVamsStore((s) => s.pushToHistory);
  const updateVertexPositionRef = useRef(updateVertexPosition);
  useEffect(() => {
    updateVertexPositionRef.current = updateVertexPosition;
  }, [updateVertexPosition]);
  useEffect(() => {
    interactionModeRef.current = interactionMode;
  }, [interactionMode]);
  useEffect(() => {
    pushToHistoryRef.current = pushToHistory;
  }, [pushToHistory]);
  useEffect(() => {
    objectsRef.current = objects;
  }, [objects]);
  // Expose a read-only window into the live renderer for the Animation Preview.
  // Containers are keyed by scene-object id; `resync` re-applies the stored
  // transforms so the scene state stays the single source of truth.
  useEffect(() => {
    const app = appRef.current;
    if (!app || !pixiReady) return;
    const unregister = renderBridge.register({
      app,
      getDisplayObject: (id) => containersRef.current.get(id),
      resync: () => {
        useVamsStore.getState().objects.forEach((obj) => {
          const container = containersRef.current.get(obj.id);
          if (!container || container.destroyed) return;
          const t = obj.transform;
          container.position.set(t.translateX, t.translateY);
          container.rotation = (t.rotate * Math.PI) / 180;
          container.scale.set(t.scaleX, t.scaleY);
        });
      },
    });
    return unregister;
  }, [pixiReady, appRef]);
  useEffect(() => {
    const app = appRef.current;
    const overlay = overlayRef.current;
    const world = worldRef.current;
    if (!app || !overlay || !world || !pixiReady) return;
    const vertexOverlay = new Container();
    vertexOverlay.zIndex = 10001;
    world.addChild(vertexOverlay);
    vertexOverlayRef.current = vertexOverlay;
    const tickerFn = () => {
      if (overlay) overlay.update();
      if (interactionModeRef.current === 'SELECT' && prevSelectedObjectIdRef.current) {
        const layer = vertexOverlayRef.current;
        const container = containersRef.current.get(prevSelectedObjectIdRef.current);
        const obj = objectsRef.current.find(o => o.id === prevSelectedObjectIdRef.current);
        if (layer && container && obj && obj.type !== 'GROUP' && obj.type !== 'TEXT') {
          layer.visible = true;
          const worldScale = Math.abs(world.scale.x);
          const inverseScale = worldScale > 0 ? 1 / worldScale : 1;
          while (handleGraphicsRef.current.length < obj.vertices.length) {
            const g = new PIXI.Graphics() as HandleGraphics;
            g.eventMode = 'static';
            g.cursor = 'move';
            g.isHovered = false;
            g.on('pointerover', () => { g.isHovered = true; });
            g.on('pointerout', () => { g.isHovered = false; });
            g.on('pointerdown', (e: FederatedPointerEvent) => {
              if (interactionModeRef.current !== 'SELECT') return;
              e.stopPropagation();
              const idx = handleGraphicsRef.current.indexOf(g);
              const currentObj = objectsRef.current.find(o => o.id === prevSelectedObjectIdRef.current);
              if (currentObj && currentObj.vertices[idx]) {
                vertexDragRef.current = {
                  objectId: currentObj.id,
                  vertexId: currentObj.vertices[idx].id,
                  historyPushed: false
                };
                app.canvas.style.cursor = 'grabbing';
              }
            });
            layer.addChild(g);
            handleGraphicsRef.current.push(g);
          }
          handleGraphicsRef.current.forEach((g, i) => {
            if (i < obj.vertices.length) {
              g.visible = true;
              const v = obj.vertices[i];
              const globalPos = container.toGlobal({ x: v.x, y: v.y });
              const worldPos = world.toLocal(globalPos);
              g.position.copyFrom(worldPos);
              const hoverScale = g.isHovered ? 1.3 : 1.0;
              g.scale.set(inverseScale * hoverScale);
              g.clear();
              g.circle(0, 0, 5);
              g.fill({ color: 0xffffff });
              g.stroke({ color: 0x3b82f6, width: 2, alignment: 0.5 });
            } else {
              g.visible = false;
            }
          });
        } else if (layer) {
          layer.visible = false;
        }
      } else if (vertexOverlayRef.current) {
        vertexOverlayRef.current.visible = false;
      }
    };
    app.ticker.add(tickerFn);
    return () => {
      app.ticker.remove(tickerFn);
      if (vertexOverlayRef.current) {
        vertexOverlayRef.current.destroy({ children: true });
        vertexOverlayRef.current = null;
      }
      handleGraphicsRef.current = [];
    };
  }, [pixiReady, appRef, overlayRef, worldRef]);
  useEffect(() => {
    const app = appRef.current;
    const world = worldRef.current;
    const overlay = overlayRef.current;
    if (!app || !world || !overlay || !pixiReady) return;
    const onStageMove = (e: FederatedPointerEvent) => {
      const vDrag = vertexDragRef.current;
      if (vDrag && world) {
        if (app.canvas.style.cursor !== "grabbing") app.canvas.style.cursor = "grabbing";
        const container = containersRef.current.get(vDrag.objectId);
        if (container) {
          const localPos = container.toLocal(e.global);
          updateVertexPositionRef.current(vDrag.objectId, vDrag.vertexId, localPos.x, localPos.y);
        }
        if (!vDrag.historyPushed) {
          pushToHistoryRef.current();
          vDrag.historyPushed = true;
        }
        return;
      }
      const drag = dragRef.current;
      if (!drag || !world) return;
      if (app.canvas.style.cursor !== "grabbing") app.canvas.style.cursor = "grabbing";
      const p = world.toLocal(e.global);
      const newX = p.x - drag.offsetX;
      const newY = p.y - drag.offsetY;
      const container = containersRef.current.get(drag.id);
      if (container) {
        container.position.set(newX, newY);
      }
      if (overlay) overlay.update();
      if (!drag.historyPushed) {
        pushToHistoryRef.current();
        drag.historyPushed = true;
      }
    };
    const endDrag = () => {
      if (vertexDragRef.current) {
        vertexDragRef.current = null;
        app.canvas.style.cursor = "default";
        return;
      }
      const drag = dragRef.current;
      if (!drag) return;
      const container = containersRef.current.get(drag.id);
      if (container) {
        updateObjectTransform(drag.id, {
          translateX: container.position.x,
          translateY: container.position.y,
        });
      }
      dragRef.current = null;
      app.canvas.style.cursor = "grab";
    };
    app.stage.on("globalpointermove", onStageMove);
    app.stage.on("pointerup", endDrag);
    app.stage.on("pointerupoutside", endDrag);
    app.stage.on("pointercancel", endDrag);
    return () => {
      app.stage.off("globalpointermove", onStageMove);
      app.stage.off("pointerup", endDrag);
      app.stage.off("pointerupoutside", endDrag);
      app.stage.off("pointercancel", endDrag);
    };
  }, [pixiReady, appRef, worldRef, overlayRef, updateObjectTransform]);
  useEffect(() => {
    const world = worldRef.current;
    const app = appRef.current;
    const overlay = overlayRef.current;
    if (!world || !app || !overlay || !pixiReady) return;
    applyViewportTransform();
    const unusedIds = new Set(containersRef.current.keys());
    const nextContainers = new Map<string, Container>();
    const nextObjectsMap = new Map<string, SceneNode>();
    const worldScaleX = world.scale.x;
    const worldScaleY = world.scale.y;
    const worldScaleChanged =
      prevWorldScaleRef.current.x !== worldScaleX ||
      prevWorldScaleRef.current.y !== worldScaleY;
    objects.forEach((obj, index) => {
      nextObjectsMap.set(obj.id, obj);
      let container = containersRef.current.get(obj.id);
      const prevObj = prevObjectsRef.current.get(obj.id);
      const isSelected = obj.id === selectedObjectId;
      const wasSelected = prevSelectedObjectIdRef.current === obj.id;
      const stippleChanged =
        (prevObj?.lineStipple === null && obj.lineStipple !== null) ||
        (prevObj?.lineStipple !== null && obj.lineStipple === null) ||
        (prevObj?.lineStipple?.factor !== obj.lineStipple?.factor) ||
        (prevObj?.lineStipple?.pattern !== obj.lineStipple?.pattern);
      let needsRebuild =
        !container ||
        !prevObj ||
        worldScaleChanged ||
        prevObj.type !== obj.type ||
        prevObj.vertices !== obj.vertices ||
        prevObj.textContent !== obj.textContent ||
        prevObj.shading !== obj.shading ||
        prevObj.lineWidth !== obj.lineWidth ||
        stippleChanged ||
        prevObj.texture            !== obj.texture            ||
        prevObj.texture?.textureId !== obj.texture?.textureId ||
        prevObj.texture?.filter    !== obj.texture?.filter    ||
        prevObj.texture?.wrap      !== obj.texture?.wrap      ||
        prevObj.uvs                !== obj.uvs;
        
      if (
        obj.type === "GROUP" &&
        (isSelected !== wasSelected || prevObj?.children !== obj.children || isSelected)
      ) {
        needsRebuild = true;
      }
      if (needsRebuild) {
        if (container) {
          container.removeChildren();
          let groupChildren: SceneNode[] | undefined;
          if (obj.type === "GROUP") {
            groupChildren = objects.filter((c) => c.parentId === obj.id);
          }
          const newContent = createDrawable(obj, worldScaleX, {
            groupChildren,
            isSelected,
            worldScaleY,
          });
          while (newContent.children.length > 0) {
            container.addChild(newContent.children[0]);
          }
          container.hitArea = newContent.hitArea;
          newContent.destroy();
        } else {
          let groupChildren: SceneNode[] | undefined;
          if (obj.type === "GROUP") {
            groupChildren = objects.filter((c) => c.parentId === obj.id);
          }
          container = createDrawable(obj, worldScaleX, {
            groupChildren,
            isSelected,
            worldScaleY,
          });
        }
      }
      unusedIds.delete(obj.id);
      const t = obj.transform;
      container!.position.set(t.translateX, t.translateY);
      container!.rotation = (t.rotate * Math.PI) / 180;
      container!.scale.set(t.scaleX, t.scaleY);
      container!.visible = obj.visible;
      container!.zIndex = objects.length - index;
      container!.label = obj.id;
      container!.sortableChildren = true;
      const listenersNeedUpdate = needsRebuild || !prevObj;
      if (listenersNeedUpdate) {
        container!.removeAllListeners();
        container!.eventMode = "static";
        container!.on("pointerover", () => {
          if (!dragRef.current && !vertexDragRef.current) {
            const mode = interactionModeRef.current;
            if (mode === "VERTEX_PLACE") {
              app.canvas.style.cursor = "crosshair";
            } else {
              app.canvas.style.cursor = "grab";
            }
          }
        });
        container!.on("pointerout", () => {
          if (!dragRef.current && !vertexDragRef.current) {
            const mode = interactionModeRef.current;
            if (mode === "VERTEX_PLACE") {
              app.canvas.style.cursor = "crosshair";
            } else {
              app.canvas.style.cursor = "default";
            }
          }
        });
        container!.on("pointerdown", (e: FederatedPointerEvent) => {
          if (interactionModeRef.current === "VERTEX_PLACE") return;
          e.stopPropagation();
          selectObject(obj.id);
          if (e.button === 0 && interactionModeRef.current === "SELECT") {
            const p = world.toLocal(e.global);
            const currentObj = objectsRef.current.find((o) => o.id === obj.id);
            if (currentObj) {
              dragRef.current = {
                id: currentObj.id,
                offsetX: p.x - currentObj.transform.translateX,
                offsetY: p.y - currentObj.transform.translateY,
                historyPushed: false,
              };
              app.canvas.style.cursor = "grabbing";
            }
          }
        });
      }
      nextContainers.set(obj.id, container!);
    });
    if (overlay.parent) overlay.parent.removeChild(overlay);
    objects.forEach((obj) => {
      const container = nextContainers.get(obj.id);
      if (!container) return;
      const isRoot = !obj.parentId;
      if (isRoot) {
        if (container.parent !== world) {
          world.addChild(container);
        }
        container.eventMode = 'static';
      } else {
        const parentContainer = nextContainers.get(obj.parentId!);
        if (parentContainer && container.parent !== parentContainer) {
          parentContainer.addChild(container);
          container.eventMode = 'none';
        }
      }
    });
    unusedIds.forEach((id) => {
      const c = containersRef.current.get(id);
      if (c) {
        c.children.forEach((child) => {
          if (child instanceof Mesh && child.geometry) {
            child.geometry.destroy();
          }
        });
        c.destroy({ children: true });
        if (c.parent) c.parent.removeChild(c);
      }
    });
    containersRef.current = nextContainers;
    prevObjectsRef.current = nextObjectsMap;
    prevSelectedObjectIdRef.current = selectedObjectId;
    prevWorldScaleRef.current = { x: worldScaleX, y: worldScaleY };
    world.addChild(overlay);
  }, [
    pixiReady,
    objects,
    selectedObjectId,
    worldRef,
    appRef,
    overlayRef,
    selectObject,
    applyViewportTransform,
  ]);
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    if (selectedObjectId) {
      const target = containersRef.current.get(selectedObjectId);
      if (target && !target.destroyed) {
        overlay.setTarget(target);
        overlay.visible = true;
      } else {
        overlay.setTarget(null);
        overlay.visible = false;
      }
    } else {
      overlay.setTarget(null);
      overlay.visible = false;
    }
  }, [selectedObjectId, objects, worldRef, overlayRef]);
}