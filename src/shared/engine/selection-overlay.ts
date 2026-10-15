import { Container, Graphics } from 'pixi.js';
import { readCssColor } from '@/shared/lib/theme';
import { firstRasterY } from '@/shared/lib/text-raster';

export class SelectionOverlay extends Container {
    private border: Graphics;
    private target: Container | null = null;
    private suppressed = false;

    constructor() {
        super();
        this.border = new Graphics();
        this.addChild(this.border);
        this.eventMode = 'none';
    }

    public setTarget(target: Container | null) {
        this.target = target;
        if (!target) {
            this.border.clear();
            this.visible = false;
        } else {
            this.visible = !this.suppressed;
            this.update();
        }
    }

    /** Run hides the outline while it moves objects; the target is kept for when Run stops. */
    public setSuppressed(suppressed: boolean) {
        if (this.suppressed === suppressed) return;
        this.suppressed = suppressed;
        this.visible = !suppressed && this.target !== null;
        if (!suppressed && this.target) this.update();
    }

    public update() {
        if (!this.target || this.target.destroyed || !this.parent) {
            this.setTarget(null);
            return;
        }

        const target = this.target;
        const relativeMatrix = target.worldTransform.clone();
        const parentMatrix = this.parent.worldTransform.clone();
        
        parentMatrix.invert();
        relativeMatrix.prepend(parentMatrix);

        this.x = relativeMatrix.tx;
        this.y = relativeMatrix.ty;
        this.rotation = Math.atan2(relativeMatrix.b, relativeMatrix.a);
        
        const sign = Math.sign(relativeMatrix.a * relativeMatrix.d - relativeMatrix.b * relativeMatrix.c);
        this.scale.x = Math.sqrt(relativeMatrix.a * relativeMatrix.a + relativeMatrix.b * relativeMatrix.b);
        this.scale.y = Math.sqrt(relativeMatrix.c * relativeMatrix.c + relativeMatrix.d * relativeMatrix.d) * sign;
        this.skew.x = 0;
        this.skew.y = 0;

        const bounds = target.getLocalBounds();
        this.border.clear();

        const parentScale = this.parent ? Math.abs(this.parent.scale.x) : 1;
        const objectScale = Math.abs(this.scale.x) || 1;
        const lineWidth = 2 / (parentScale * objectScale);
        const lineColor = readCssColor('--accent', 0x4762f5);

        // Draw the clean bounding box outline without the fake corner handles
        this.border.rect(bounds.x, bounds.y, bounds.width, bounds.height);
        this.border.stroke({ width: lineWidth, color: lineColor });
    }
}

export type RingTarget = { kind: 'vertex'; index: number } | { kind: 'raster'; x: number; y: number } | null;

/**
 * Where the followed vertex's ring goes: a shape's vertex (clamped), a text's first raster
 * position (the point the journey follows), or nowhere for a group or while Code shows.
 */
export function ringTarget(
  node: { type: string; vertices: readonly unknown[]; textContent?: string } | undefined,
  vertex: number,
  showsMath: boolean,
): RingTarget {
  if (!node || !showsMath || node.type === 'GROUP') return null;
  if (node.type === 'TEXT') return { kind: 'raster', x: 0, y: firstRasterY(node.textContent ?? '') };
  if (node.vertices.length === 0) return null;
  return { kind: 'vertex', index: Math.min(Math.max(0, Math.floor(vertex)), node.vertices.length - 1) };
}

/**
 * A vertex handle was pressed: the math follows its vertex. `handles` are the renderer's handle
 * graphics in vertex order, including spares beyond the object's last vertex.
 */
export function pickHandleVertex(
  handles: readonly object[],
  handle: object,
  vertexCount: number,
  follow: (index: number) => void,
): number | null {
  const index = handles.indexOf(handle);
  if (index < 0 || index >= vertexCount) return null;
  follow(index);
  return index;
}

/** The amber ring around the vertex the math journey follows. A transient overlay: never saved. */
export class FollowRing extends Graphics {
  constructor() {
    super();
    this.eventMode = 'none';
    this.visible = false;
  }

  /** At a point in its parent's space; `inverseScale` keeps it the same size on screen at any zoom. */
  public show(x: number, y: number, inverseScale: number) {
    this.position.set(x, y);
    this.scale.set(inverseScale);
    this.clear();
    this.circle(0, 0, 9);
    this.stroke({ width: 2, color: readCssColor('--canvas-ring', 0xfbbf77) });
    this.visible = true;
  }

  public hide() {
    this.visible = false;
  }
}
