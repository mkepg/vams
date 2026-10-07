import { Container, Graphics } from 'pixi.js';
import { readCssColor } from '@/shared/lib/theme';

export class SelectionOverlay extends Container {
    private border: Graphics;
    private target: Container | null = null;

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
            this.visible = true;
            this.update();
        }
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