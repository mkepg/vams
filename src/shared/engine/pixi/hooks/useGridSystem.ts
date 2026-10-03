import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import { useVamsStore } from "@/core/store";
interface UseGridSystemProps {
  pixiReady: boolean;
  appRef: React.MutableRefObject<Application | null>;
  worldRef: React.MutableRefObject<Container | null>;
  gridRef: React.MutableRefObject<Container | null>;
}
export function useGridSystem({
  pixiReady,
  appRef,
  worldRef,
  gridRef,
}: UseGridSystemProps) {
  const axesGraphicsRef = useRef<Graphics | null>(null);
  const labelsContainerRef = useRef<Container | null>(null);
  const textPoolRef = useRef<Text[]>([]);
  const axisVisibility = useVamsStore((s) => s.axisVisibility);
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || !pixiReady) return;
    const g = new Graphics();
    const labels = new Container();
    grid.addChild(g);
    grid.addChild(labels);
    axesGraphicsRef.current = g;
    labelsContainerRef.current = labels;
    return () => {
      g.destroy();
      labels.destroy({ children: true });
      axesGraphicsRef.current = null;
      labelsContainerRef.current = null;
      textPoolRef.current = [];
    };
  }, [pixiReady, gridRef]);
  const getPooledText = (style: TextStyle) => {
    const pool = textPoolRef.current;
    let textObj = pool.find((t) => !t.visible);
    if (!textObj) {
      textObj = new Text({ text: "", style });
      pool.push(textObj);
      labelsContainerRef.current?.addChild(textObj);
    }
    textObj.visible = true;
    textObj.alpha = 0.6; // Set alpha on the Text object, not the style
    return textObj;
  };
  // Main Render Loop
  useEffect(() => {
    const app = appRef.current;
    const world = worldRef.current;
    if (!app || !world || !pixiReady) return;
    const textStyle = new TextStyle({
      fontFamily: "monospace",
      fontSize: 10,
      fill: 0xffffff,
    });
    const update = () => {
      const g = axesGraphicsRef.current;
      const labels = labelsContainerRef.current;
      if (!g || !labels) return;
      g.clear();
      textPoolRef.current.forEach((t) => (t.visible = false));
      const screenWidth = app.screen.width;
      const screenHeight = app.screen.height;
      const originScreen = world.toGlobal({ x: 0, y: 0 });
      const zoom = Math.abs(world.scale.x);
      if (zoom < 0.0001) return;
      const stepPx = 100;
      const stepWorld = stepPx / zoom;
      const power = Math.floor(Math.log10(stepWorld));
      const base = stepWorld / Math.pow(10, power);
      let niceBase = 1;
      if (base > 5) niceBase = 10;
      else if (base > 2) niceBase = 5;
      else if (base > 1) niceBase = 2;
      const niceStep = niceBase * Math.pow(10, power);
      const topLeft = world.toLocal({ x: 0, y: 0 });
      const bottomRight = world.toLocal({ x: screenWidth, y: screenHeight });
      const startX = Math.min(topLeft.x, bottomRight.x);
      const endX = Math.max(topLeft.x, bottomRight.x);
      const startY = Math.min(topLeft.y, bottomRight.y);
      const endY = Math.max(topLeft.y, bottomRight.y);
      const startTickX = Math.ceil(startX / niceStep) * niceStep;
      const endTickX = Math.floor(endX / niceStep) * niceStep;
      const startTickY = Math.ceil(startY / niceStep) * niceStep;
      const endTickY = Math.floor(endY / niceStep) * niceStep;
      if (axisVisibility.showGridlines) {
        g.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.1 });
        for (let x = startTickX; x <= endTickX; x += niceStep) {
          const screenPos = world.toGlobal({ x, y: 0 });
          if (screenPos.x >= -1 && screenPos.x <= screenWidth + 1) {
            g.moveTo(screenPos.x, 0);
            g.lineTo(screenPos.x, screenHeight);
          }
        }
        for (let y = startTickY; y <= endTickY; y += niceStep) {
          const screenPos = world.toGlobal({ x: 0, y });
          if (screenPos.y >= -1 && screenPos.y <= screenHeight + 1) {
            g.moveTo(0, screenPos.y);
            g.lineTo(screenWidth, screenPos.y);
          }
        }
        g.stroke();
      }
      if (axisVisibility.showOriginMarker) {
        g.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.3 });
        if (originScreen.y >= 0 && originScreen.y <= screenHeight) {
          g.moveTo(0, originScreen.y);
          g.lineTo(screenWidth, originScreen.y);
        }
        if (originScreen.x >= 0 && originScreen.x <= screenWidth) {
          g.moveTo(originScreen.x, 0);
          g.lineTo(originScreen.x, screenHeight);
        }
        g.stroke();
        for (let x = startTickX; x <= endTickX; x += niceStep) {
          if (Math.abs(x) < niceStep / 10) continue;
          const screenPos = world.toGlobal({ x, y: 0 });
          const screenX = screenPos.x;
          const screenY = originScreen.y;
          if (screenY >= -20 && screenY <= screenHeight + 20) {
            if (screenX >= -20 && screenX <= screenWidth + 20) {
              const t = getPooledText(textStyle);
              t.text = parseFloat(x.toPrecision(6)).toString();
              t.anchor.set(0.5, 0);
              t.position.set(screenX, screenY + 4);
            }
          }
        }
        for (let y = startTickY; y <= endTickY; y += niceStep) {
          if (Math.abs(y) < niceStep / 10) continue;
          const screenPos = world.toGlobal({ x: 0, y });
          const screenX = originScreen.x;
          const screenY = screenPos.y;
          if (screenX >= -50 && screenX <= screenWidth + 50) {
            if (screenY >= -20 && screenY <= screenHeight + 20) {
              const t = getPooledText(textStyle);
              t.text = parseFloat(y.toPrecision(6)).toString();
              t.anchor.set(1, 0.5);
              t.position.set(screenX - 6, screenY);
            }
          }
        }
      }
      if (
        axisVisibility.showOriginMarker &&
        originScreen.x >= -20 &&
        originScreen.x <= screenWidth + 20 &&
        originScreen.y >= -20 &&
        originScreen.y <= screenHeight + 20
      ) {
        const t = getPooledText(textStyle);
        t.text = "0";
        t.anchor.set(1, 0);
        t.position.set(originScreen.x - 4, originScreen.y + 4);
      }
    };
    app.ticker.add(update);
    return () => {
      // usePixiApp's cleanup runs first on unmount and destroys the app (ticker becomes null).
      app.ticker?.remove(update);
    };
  }, [pixiReady, appRef, worldRef, axisVisibility]);
}