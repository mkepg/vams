import './object-transform-panel.scss';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Move,
  RotateCw,
  Link2,
  Unlink2,
  RotateCcw,
  Maximize2,
  MoveHorizontal,
  MoveVertical,
} from 'lucide-react';
import { useVamsStore } from '@/core/store';
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';
import EmptySelectionState from '@/shared/ui/empty-state/EmptySelectionState';
import NumberInput from '@/shared/ui/number-input/NumberInput';
import type { TransformState } from '@/core/types/scene';
const DEFAULT_TRANSFORM: TransformState = {
  translateX: 0,
  translateY: 0,
  rotate: 0,
  scaleX: 1,
  scaleY: 1,
};
const ScaleXIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 12H4" />
    <rect width="4" height="4" x="2" y="10" rx="1" />
    <rect width="4" height="4" x="18" y="10" rx="1" />
  </svg>
);
const ScaleYIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20V4" />
    <rect width="4" height="4" x="10" y="2" rx="1" />
    <rect width="4" height="4" x="10" y="18" rx="1" />
  </svg>
);
const SCALE_RANGE = 2.5;
const SCALE_MIN = -SCALE_RANGE + 1 + 0.01;
const SCALE_MAX = SCALE_RANGE + 1;
interface ScalePadProps {
  scaleX: number;
  scaleY: number;
  locked: boolean;
  onChange: (sx: number, sy: number) => void;
  onCommit: () => void;
}
function ScalePad({ scaleX, scaleY, locked, onChange, onCommit }: ScalePadProps) {
  const padRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{
    sx: number;
    sy: number;
    pX: number;
    pY: number;
  } | null>(null);
  const nx = Math.max(-1, Math.min(1, (scaleX - 1) / SCALE_RANGE));
  const ny = Math.max(-1, Math.min(1, (scaleY - 1) / SCALE_RANGE));
  const puckLeft = `${50 + nx * 45}%`;
  const puckTop = `${50 - ny * 45}%`;
  const normalize = useCallback((clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const rawX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const rawY = -(((clientY - rect.top) / rect.height) * 2 - 1);
    return {
      x: Math.max(-1, Math.min(1, rawX)),
      y: Math.max(-1, Math.min(1, rawY)),
    };
  }, []);
  const computeFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const start = startRef.current;
      if (!start) return;
      const { x: cx, y: cy } = normalize(clientX, clientY);
      let sx: number;
      let sy: number;
      if (locked) {
        const sxDir = 1;
        const syDir = start.sx === 0 ? 1 : start.sy / start.sx;
        const dirLen = Math.hypot(sxDir, syDir) || 1;
        const ux = sxDir / dirLen;
        const uy = syDir / dirLen;
        const dx = cx - start.pX;
        const dy = cy - start.pY;
        const t = dx * ux + dy * uy;
        sx = start.sx + t * ux * SCALE_RANGE;
        sy = start.sy + t * uy * SCALE_RANGE;
      } else {
        sx = start.sx + (cx - start.pX) * SCALE_RANGE;
        sy = start.sy + (cy - start.pY) * SCALE_RANGE;
      }
      sx = Math.max(SCALE_MIN, Math.min(SCALE_MAX, sx));
      sy = Math.max(SCALE_MIN, Math.min(SCALE_MAX, sy));
      onChange(parseFloat(sx.toFixed(3)), parseFloat(sy.toFixed(3)));
    },
    [locked, normalize, onChange],
  );
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    padRef.current?.setPointerCapture(e.pointerId);
    const p = normalize(e.clientX, e.clientY);
    startRef.current = { sx: scaleX, sy: scaleY, pX: p.x, pY: p.y };
    setDragging(true);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    computeFromPointer(e.clientX, e.clientY);
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    padRef.current?.releasePointerCapture(e.pointerId);
    setDragging(false);
    startRef.current = null;
    onCommit();
  };
  const handleDoubleClick = () => {
    onChange(1, 1);
    onCommit();
  };
  return (
    <div className="scale-pad-wrap">
      <div
        ref={padRef}
        className={`scale-pad ${dragging ? 'dragging' : ''} ${locked ? 'locked' : ''}`}
        role="slider"
        aria-label="Scale X and Y"
        aria-valuetext={`scaleX ${scaleX.toFixed(2)}, scaleY ${scaleY.toFixed(2)}`}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDblClick={handleDoubleClick}
        title={locked ? 'Drag to scale (uniform) · Double-click to reset' : 'Drag to scale X/Y · Double-click to reset'}
      >
        <div className="pad-grid" aria-hidden>
          <div className="pad-axis pad-axis-x" />
          <div className="pad-axis pad-axis-y" />
          <div className="pad-identity" />
          {locked && <div className="pad-diagonal" />}
        </div>
        <div
          className="pad-puck"
          style={{ left: puckLeft, top: puckTop }}
          aria-hidden
        />
        <span className="pad-readout" aria-hidden>
          {scaleX.toFixed(2)} × {scaleY.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
interface RotateDialProps {
  value: number;
  onChange: (deg: number) => void;
  onCommit: () => void;
}
function RotateDial({ value, onChange, onCommit }: RotateDialProps) {
  const dialRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const lastAngleRef = useRef<number | null>(null);
  const accumRef = useRef<number>(0);
  const pointerAngle = (clientX: number, clientY: number) => {
    const el = dialRef.current!;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rad = Math.atan2(clientY - cy, clientX - cx);
    return (rad * 180) / Math.PI;
  };
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dialRef.current?.setPointerCapture(e.pointerId);
    accumRef.current = value;
    lastAngleRef.current = pointerAngle(e.clientX, e.clientY);
    setDragging(true);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || lastAngleRef.current === null) return;
    const cur = pointerAngle(e.clientX, e.clientY);
    let delta = cur - lastAngleRef.current;
    if (delta > 180) delta -= 360;
    else if (delta < -180) delta += 360;
    accumRef.current += delta;
    lastAngleRef.current = cur;
    onChange(parseFloat(accumRef.current.toFixed(2)));
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    dialRef.current?.releasePointerCapture(e.pointerId);
    setDragging(false);
    lastAngleRef.current = null;
    onCommit();
  };
  const needleTransform = `translate(-50%, -100%) rotate(${value}deg)`;
  return (
    <div
      ref={dialRef}
      className={`rotate-dial ${dragging ? 'dragging' : ''}`}
      role="slider"
      aria-label="Rotation"
      aria-valuenow={value}
      aria-valuemin={-360}
      aria-valuemax={360}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDblClick={() => { onChange(0); onCommit(); }}
      title="Drag to rotate · Double-click to reset"
    >
      <div className="dial-ring" aria-hidden />
      {[0, 90, 180, 270].map((t) => (
        <span key={t} className="dial-tick" style={{ transform: `translate(-50%, 0) rotate(${t}deg)` }} aria-hidden />
      ))}
      <div className="dial-needle" style={{ transform: needleTransform }} aria-hidden />
      <div className="dial-hub" aria-hidden />
      <span className="dial-readout">{value.toFixed(1)}°</span>
    </div>
  );
}
export default function ObjectTransformPanel() {
  const { objects, selectedObjectId, updateObjectTransform, pushToHistory } = useVamsStore();
  const selectedObject = objects.find((o) => o.id === selectedObjectId);
  const [lockScale, setLockScale] = useState(true);
  const commit = useCallback(
    (update: Partial<TransformState>) => {
      if (!selectedObjectId) return;
      pushToHistory();
      updateObjectTransform(selectedObjectId, update);
    },
    [selectedObjectId, pushToHistory, updateObjectTransform],
  );
  const liveUpdate = useCallback(
    (update: Partial<TransformState>) => {
      if (!selectedObjectId) return;
      updateObjectTransform(selectedObjectId, update);
    },
    [selectedObjectId, updateObjectTransform],
  );
  const handleScaleChange = useCallback(
    (axis: 'X' | 'Y', value: number) => {
      if (!selectedObject) return;
      if (lockScale) {
        const { scaleX, scaleY } = selectedObject.transform;
        const source = axis === 'X' ? scaleX : scaleY;
        const ratio = source === 0 ? 1 : value / source;
        commit({
          scaleX: parseFloat((scaleX * ratio).toFixed(4)),
          scaleY: parseFloat((scaleY * ratio).toFixed(4)),
        });
      } else {
        commit(axis === 'X' ? { scaleX: value } : { scaleY: value });
      }
    },
    [selectedObject, lockScale, commit],
  );
  const matrixString = useMemo(() => {
    if (!selectedObject) return '';
    const { translateX, translateY, rotate, scaleX, scaleY } = selectedObject.transform;
    const rad = (rotate * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const a = c * scaleX;
    const b = s * scaleX;
    const cc = -s * scaleY;
    const d = c * scaleY;
    const fmt = (n: number) => n.toFixed(2);
    return `matrix(${fmt(a)}, ${fmt(b)}, ${fmt(cc)}, ${fmt(d)}, ${fmt(translateX)}, ${fmt(translateY)})`;
  }, [selectedObject]);
  if (!selectedObject) {
    return (
      <CollapsibleSection panelId="object-transform" title="Object Transform" icon={<Move size={14} />} defaultOpen={true}>
        <EmptySelectionState message="Select an object in the scene to translate, rotate, or scale it." />
      </CollapsibleSection>
    );
  }
  const { transform } = selectedObject;
  const isIdentity =
    transform.translateX === 0 &&
    transform.translateY === 0 &&
    transform.rotate === 0 &&
    transform.scaleX === 1 &&
    transform.scaleY === 1;
  const resetAll = () => commit(DEFAULT_TRANSFORM);
  return (
    <CollapsibleSection panelId="object-transform" title="Object Transform" icon={<Move size={14} />} defaultOpen={true}>
      <div className="transform-panel">
        {/* Scale pad + Rotate dial side-by-side */}
        <div className="gizmo-row">
          <ScalePad
            scaleX={transform.scaleX}
            scaleY={transform.scaleY}
            locked={lockScale}
            onChange={(sx, sy) => liveUpdate({ scaleX: sx, scaleY: sy })}
            onCommit={pushToHistory}
          />
          <RotateDial
            value={transform.rotate}
            onChange={(deg) => liveUpdate({ rotate: deg })}
            onCommit={pushToHistory}
          />
        </div>
        <div className="input-stack">
          {/* Position (numeric only — canvas handles interactive drag) */}
          <div className="row-group" data-axis="x">
            <NumberInput
              label="Position X"
              value={transform.translateX}
              onChange={(v) => commit({ translateX: v })}
              icon={<MoveHorizontal size={14} />}
              step={0.05}
              precision={2}
            />
          </div>
          <div className="row-group" data-axis="y">
            <NumberInput
              label="Position Y"
              value={transform.translateY}
              onChange={(v) => commit({ translateY: v })}
              icon={<MoveVertical size={14} />}
              step={0.05}
              precision={2}
            />
          </div>
          {/* Rotate numeric */}
          <div className="row-group" data-axis="r">
            <NumberInput
              label="Rotate (deg)"
              value={transform.rotate}
              onChange={(v) => commit({ rotate: v })}
              icon={<RotateCw size={14} />}
              step={1}
              precision={2}
            />
          </div>
          {/* Scale numeric + lock */}
          <div className={`scale-section ${lockScale ? 'locked' : ''}`}>
            <button
              type="button"
              className={`lock-toggle ${lockScale ? 'on' : ''}`}
              onClick={() => setLockScale((v) => !v)}
              title={lockScale ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
              aria-pressed={lockScale}
              aria-label={lockScale ? 'Unlock scale X and Y' : 'Lock scale X and Y'}
            >
              {lockScale ? <Link2 size={13} /> : <Unlink2 size={13} />}
            </button>
            <div className="scale-inputs">
              <div className="row-group">
                <NumberInput
                  label="Scale X"
                  value={transform.scaleX}
                  onChange={(v) => handleScaleChange('X', v)}
                  icon={<ScaleXIcon size={14} />}
                  step={0.05}
                  precision={2}
                />
              </div>
              <div className="row-group">
                <NumberInput
                  label="Scale Y"
                  value={transform.scaleY}
                  onChange={(v) => handleScaleChange('Y', v)}
                  icon={<ScaleYIcon size={14} />}
                  step={0.05}
                  precision={2}
                />
              </div>
            </div>
          </div>
        </div>
        {}
        <div className="transform-matrix" title="Composite 2D affine matrix">
          <span className="matrix-label">matrix</span>
          <code className="matrix-value">{matrixString}</code>
        </div>
        {}
        <div className="transform-footer">
          <button
            type="button"
            className="footer-btn"
            onClick={() => commit({ scaleX: 1, scaleY: 1 })}
            disabled={transform.scaleX === 1 && transform.scaleY === 1}
            title="Reset scale to 1×1"
          >
            <Maximize2 size={12} />
            <span>Unit Scale</span>
          </button>
          <button
            type="button"
            className="footer-btn"
            onClick={resetAll}
            disabled={isIdentity}
            title="Reset all transforms"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </CollapsibleSection>
  );
}