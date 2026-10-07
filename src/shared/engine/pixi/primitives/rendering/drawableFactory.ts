import * as PIXI from "pixi.js";
import { useVamsStore } from '@/core/store';
import { ensureTexture } from '@/features/textures/lib/pixi-texture-cache';
import type { SceneNode } from "@/core/types/scene";
import { toNumColor } from "../utils/color-utils";
import {
  pxToWorld,
  bboxRadii,
  hasUniformColor,
  createPaddedHitArea,
  getGroupLocalBounds
} from "../utils/geometry-utils";
import { drawWithGraphics } from "./graphicsRenderer";
import { createMesh } from "./meshRenderer";
import { readCssColor } from '@/shared/lib/theme';

export interface CreateDrawableOptions {
  groupChildren?: SceneNode[];
  isSelected?: boolean;
  worldScaleY?: number;
}
export function createDrawable(
  o: SceneNode,
  worldScaleX?: number,
  options?: CreateDrawableOptions
): PIXI.Container {
  const container = new PIXI.Container();
  container.label = o.id;
  container.sortableChildren = true;
  const hitPadding = worldScaleX ? 10 / Math.abs(worldScaleX) : 0.5;
  const worldScaleY = options?.worldScaleY;
  if (o.type === 'GROUP') {
    return createGroupDrawable(o, worldScaleX, options, container);
  }
  if (o.type === 'TEXT') {
    return createTextDrawable(o, hitPadding, container);
  }
  // Add `&& !o.texture` so textured objects are forced into the Mesh pipeline
const shouldUseGraphics = o.type === 'POINTS' || (hasUniformColor(o) && !o.texture) || !!o.lineStipple;
  if (shouldUseGraphics) {
    return createGraphicsDrawable(o, worldScaleX, worldScaleY, hitPadding, container);
  }
  return createMeshDrawable(o, worldScaleX, hitPadding, container);
}

function createGroupDrawable(
  o: SceneNode,
  worldScaleX: number | undefined,
  options: CreateDrawableOptions | undefined,
  container: PIXI.Container
): PIXI.Container {
  container.position.set(o.transform.translateX, o.transform.translateY);
  container.rotation = (o.transform.rotate * Math.PI) / 180;
  container.scale.set(o.transform.scaleX, o.transform.scaleY);
  container.visible = o.visible;
  const bounds = getGroupLocalBounds(options?.groupChildren || []);
  const padding = pxToWorld(4, worldScaleX);
  const drawX = bounds.minX - padding;
  const drawY = bounds.minY - padding;
  const drawW = bounds.width + (padding * 2);
  const drawH = bounds.height + (padding * 2);
  const groupGraphics = new PIXI.Graphics();
  if (options?.isSelected) {
      groupGraphics.setStrokeStyle({
        width: pxToWorld(1, worldScaleX),
        color: readCssColor('--accent', 0x4762f5),
        alpha: 0.3,
        alignment: 0.5
      });
      drawDashedRectangle(groupGraphics, drawX, drawY, drawW, drawH);
      groupGraphics.stroke();
  }
  container.addChild(groupGraphics);
  container.hitArea = new PIXI.Rectangle(drawX, drawY, drawW, drawH);
  return container;
}

function drawDashedRectangle(
  graphics: PIXI.Graphics,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const dashLength = 0.2;
  const gapLength = 0.15;
  const points = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
    { x, y }
  ];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const sideLength = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(sideLength / (dashLength + gapLength));
    for (let j = 0; j < steps; j++) {
      const t1 = j / steps;
      const t2 = Math.min((j + 0.6) / steps, 1);
      const x1 = start.x + dx * t1;
      const y1 = start.y + dy * t1;
      const x2 = start.x + dx * t2;
      const y2 = start.y + dy * t2;
      graphics.moveTo(x1, y1);
      graphics.lineTo(x2, y2);
    }
  }
}

function createTextDrawable(
  o: SceneNode,
  hitPadding: number,
  container: PIXI.Container
): PIXI.Container {
  const color = toNumColor(o.vertices[0]?.color, 0xffffff);
  const textStyle = new PIXI.TextStyle({
    fontFamily: "Comfortaa",
    fontSize: 64,
    fill: color,
    align: 'center',
    fontWeight: '300',
  });
  const text = new PIXI.Text({
    text: o.textContent || '',
    style: textStyle,
    resolution: 2,
  });
  text.anchor.set(0.5);
  const textScaleX = 0.003;
  const textScaleY = 0.003 * (0.0016 / 0.0011);
  text.scale.set(textScaleX, -textScaleY);
  container.position.set(o.transform.translateX, o.transform.translateY);
  container.rotation = (o.transform.rotate * Math.PI) / 180;
  container.scale.set(o.transform.scaleX, o.transform.scaleY);
  container.visible = o.visible;
  container.zIndex = 10;
  container.addChild(text);
  const w = text.width;
  const h = text.height;
  container.hitArea = createPaddedHitArea(-w/2, -h/2, w, h, hitPadding);
  return container;
}

function createGraphicsDrawable(
  o: SceneNode,
  worldScaleX: number | undefined,
  worldScaleY: number | undefined,
  hitPadding: number,
  container: PIXI.Container
): PIXI.Container {
  const g = new PIXI.Graphics();
  drawWithGraphics(g, o, worldScaleX, worldScaleY);
  container.addChild(g);
  container.position.set(o.transform.translateX, o.transform.translateY);
  container.rotation = (o.transform.rotate * Math.PI) / 180;
  container.scale.set(o.transform.scaleX, o.transform.scaleY);
  container.visible = o.visible;
  if (!g.hitArea) {
    const { cx, cy, rx, ry } = bboxRadii(o);
    container.hitArea = createPaddedHitArea(cx - rx, cy - ry, rx * 2, ry * 2, hitPadding);
  }
  return container;
}

function createMeshDrawable(
  o: SceneNode,
  worldScaleX: number | undefined,
  hitPadding: number,
  container: PIXI.Container
): PIXI.Container {
  // Stage 5: textured fillable primitives use a Mesh with per-vertex UVs.
  if (
    o.texture &&
    o.uvs &&
    o.uvs.length === o.vertices.length &&
    (o.type === 'TRIANGLES' || o.type === 'TRIANGLE_STRIP' ||
     o.type === 'TRIANGLE_FAN' || o.type === 'QUADS' ||
     o.type === 'QUAD_STRIP' || o.type === 'POLYGON')
  ) {
    return buildTexturedMesh(o, hitPadding, container);
  }

  const meshResult = createMesh(o);
  if (!meshResult) {
    const g = new PIXI.Graphics();
    drawWithGraphics(g, o, worldScaleX);
    container.addChild(g);
    finalizeContainer(container, o, hitPadding);
    return container;
  }
  container.addChild(meshResult.mesh);
  finalizeContainer(container, o, hitPadding);
  return container;
}

function buildTexturedMesh(
  o: SceneNode,
  hitPadding: number,
  container: PIXI.Container,
): PIXI.Container {
  const asset = useVamsStore.getState().getAllTextures().find(
    (t) => t.id === o.texture!.textureId,
  );

  if (!asset) {
    // Texture missing — fall through to plain mesh path.
    const meshResult = createMesh(o);
    if (meshResult) container.addChild(meshResult.mesh);
    finalizeContainer(container, o, hitPadding);
    return container;
  }

  const tex = ensureTexture(asset);
  
  if (tex && tex.source && tex.source.style) {
  tex.source.style.scaleMode = o.texture!.filter === 'NEAREST' ? 'nearest' : 'linear';
  tex.source.style.addressMode = o.texture!.wrap === 'CLAMP_TO_EDGE' ? 'clamp-to-edge' : 'repeat';
  tex.source.style.update();
}

  const positions: number[] = [];
  const uvs: number[] = [];
  for (let i = 0; i < o.vertices.length; i++) {
    positions.push(o.vertices[i].x, o.vertices[i].y);
    // OpenGL bottom-left origin → PixiJS top-left origin: flip V.
    uvs.push(o.uvs![i].u, 1 - o.uvs![i].v);
  }

  const indices: number[] = [];
  const n = o.vertices.length;
  switch (o.type) {
    case 'TRIANGLES':
      for (let i = 0; i + 2 < n; i += 3) indices.push(i, i + 1, i + 2);
      break;
    case 'TRIANGLE_STRIP':
      for (let i = 0; i + 2 < n; i++) {
        if (i % 2 === 0) indices.push(i, i + 1, i + 2);
        else              indices.push(i + 1, i, i + 2);
      }
      break;
    case 'TRIANGLE_FAN':
    case 'POLYGON':
      for (let i = 1; i < n - 1; i++) indices.push(0, i, i + 1);
      break;
    case 'QUADS':
      for (let i = 0; i + 3 < n; i += 4) {
        indices.push(i, i + 1, i + 3, i + 1, i + 2, i + 3);
      }
      break;
    case 'QUAD_STRIP':
      for (let i = 0; i + 3 < n; i += 2) {
        indices.push(i, i + 1, i + 3, i, i + 3, i + 2);
      }
      break;
  }

  if (tex && indices.length > 0) {
    const geometry = new PIXI.MeshGeometry({
      positions: new Float32Array(positions),
      uvs: new Float32Array(uvs),
      indices: new Uint32Array(indices),
      topology: 'triangle-list',
    });
    const mesh = new PIXI.Mesh({ geometry, texture: tex });
    container.addChild(mesh);
  } else {
    // Texture still loading — placeholder mesh so layout is stable.
    const meshResult = createMesh(o);
    if (meshResult) container.addChild(meshResult.mesh);
  }

  finalizeContainer(container, o, hitPadding);
  return container;
}

/** Helper extracted so both paths share the same finalization. */
function finalizeContainer(container: PIXI.Container, o: SceneNode, hitPadding: number) {
  container.position.set(o.transform.translateX, o.transform.translateY);
  container.rotation = (o.transform.rotate * Math.PI) / 180;
  container.scale.set(o.transform.scaleX, o.transform.scaleY);
  container.visible = o.visible;
  const { cx, cy, rx, ry } = bboxRadii(o);
  container.hitArea = createPaddedHitArea(cx - rx, cy - ry, rx * 2, ry * 2, hitPadding);
}