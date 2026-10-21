import './textures-panels.scss';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useVamsStore } from '@/core/store';
import { Button, DataTable, NumberField, Panel, type DataColumn } from '@/shared/ui/controls';
import { presetUVs, type UVPreset } from '../lib/uv-presets';
import type { UV } from '@/core/types/textures';

const ZOOM_STEP = 1.25;
const clampZoom = (zoom: number) => Math.max(0.05, Math.min(20.0, zoom));

/** A square view holding the 0..1 square and every UV, with a margin round them. */
function fitView(uvs: readonly UV[] | null | undefined) {
  let minU = 0, maxU = 1, minV = 0, maxV = 1;
  for (const { u, v } of uvs ?? []) {
    if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
    minU = Math.min(minU, u); maxU = Math.max(maxU, u);
    minV = Math.min(minV, v); maxV = Math.max(maxV, v);
  }
  return { cx: (minU + maxU) / 2, cy: (minV + maxV) / 2, zoom: clampZoom(Math.max(maxU - minU, maxV - minV) * 1.3) };
}
const PRESETS: { preset: UVPreset; label: string; title: string }[] = [
  { preset: 'fit', label: 'Fit', title: 'Fit the image once over the shape' },
  { preset: 'tile', label: 'Tile 2 × 2', title: 'Repeat the image twice each way (UVs from 0 to 2)' },
  { preset: 'flip-u', label: 'Flip U', title: 'Mirror the image left to right (u becomes 1 − u)' },
  { preset: 'flip-v', label: 'Flip V', title: 'Mirror the image top to bottom (v becomes 1 − v)' },
];

export default function UVEditorPanel() {
  const objects = useVamsStore((s) => s.objects);
  const selectedObjectId = useVamsStore((s) => s.selectedObjectId);
  const getTextureById = useVamsStore((s) => s.getTextureById);
  const updateUV = useVamsStore((s) => s.updateUV);
  const setUVs = useVamsStore((s) => s.setUVs);
  const startBatch = useVamsStore((s) => s.startBatch);
  const endBatch = useVamsStore((s) => s.endBatch);
  const pushToHistory = useVamsStore((s) => s.pushToHistory);
  
  const stageRef = useRef<HTMLDivElement>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  // --- Navigable Camera State ---
  // The view fits the shape's UVs when it opens and whenever another shape is selected.
  const uvsOf = (id: string | null) => objects.find((o) => o.id === id)?.uvs;
  const [camera, setCamera] = useState(() => fitView(uvsOf(selectedObjectId)));
  const [cameraFor, setCameraFor] = useState(selectedObjectId);
  if (cameraFor !== selectedObjectId) {
    setCameraFor(selectedObjectId);
    setCamera(fitView(uvsOf(selectedObjectId)));
  }
  const cameraRef = useRef(camera);
  useEffect(() => { cameraRef.current = camera; }, [camera]);

  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);

  // --- Viewport Math ---
  // (Moved above the early return to comply with Rules of Hooks)
  const viewMinX = camera.cx - camera.zoom / 2;
  const viewMinY = camera.cy - camera.zoom / 2;
  const viewSpan = camera.zoom;

  const uvToSvg = useCallback((u: number, v: number) => {
    const x = (u - viewMinX) / viewSpan;
    const y = 1 - (v - viewMinY) / viewSpan;
    return { x, y };
  }, [viewMinX, viewMinY, viewSpan]);

  const svgToUv = useCallback((sx: number, sy: number) => {
    const u = viewMinX + sx * viewSpan;
    const v = viewMinY + (1 - sy) * viewSpan;
    return { u, v };
  }, [viewMinX, viewMinY, viewSpan]);

  // --- Zoom Handling (Centered on cursor) ---
  // (Moved above the early return to comply with Rules of Hooks)
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.shiftKey) return; // ONLY Shift + Scroll
      e.preventDefault(); // Prevent page scroll
      
      // Browsers map Shift + Scroll to horizontal scroll (deltaX)
      let delta = e.deltaY;
      if (delta === 0 && e.deltaX !== 0) {
        delta = e.deltaX;
      }
      if (delta === 0) return;

      const rect = stage.getBoundingClientRect();
      const sx = (e.clientX - rect.left) / rect.width;
      const sy = (e.clientY - rect.top) / rect.height;

      const cam = cameraRef.current;
      const curViewMinX = cam.cx - cam.zoom / 2;
      const curViewMinY = cam.cy - cam.zoom / 2;

      // Coordinate under cursor
      const u = curViewMinX + sx * cam.zoom;
      const v = curViewMinY + (1 - sy) * cam.zoom;

      const zoomFactor = delta > 0 ? 1.15 : 1 / 1.15;
      const newZoom = clampZoom(cam.zoom * zoomFactor);

      // Adjust center to keep the coordinate pinned to the cursor
      const newCx = u + newZoom / 2 - sx * newZoom;
      const newCy = v + newZoom / 2 - (1 - sy) * newZoom;

      setCamera({ cx: newCx, cy: newCy, zoom: newZoom });
    };

    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, []);

  // --- Early Return ---
  const selected = objects.find((o) => o.id === selectedObjectId);
  if (!selected || !selected.texture || !selected.uvs || selected.uvs.length === 0) {
    return (
      <Panel panelId="uv-editor" title="UV coordinates" hint="glTexCoord2f" defaultOpen>
        <p className="uve-empty">Pick an image above, then place it on the shape here.</p>
      </Panel>
    );
  }

  const tex = getTextureById(selected.texture.textureId);
  const uvs = selected.uvs;
  const wrap = selected.texture.wrap;
  const isRepeat = wrap === 'REPEAT';

  // --- Pan & Drag Handling ---
  const onStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // ONLY Shift + Left Click for panning
    if (e.button === 0 && e.shiftKey) {
      e.preventDefault();
      (e.target as Element).setPointerCapture(e.pointerId);
      setPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const onHandlePointerDown = (idx: number) => (e: React.PointerEvent<SVGCircleElement>) => {
    // Prevent dragging if holding shift (which is reserved for panning)
    if (e.button !== 0 || e.shiftKey) return; 
    e.preventDefault();
    e.stopPropagation(); // Prevents panning from triggering
    (e.target as SVGCircleElement).setPointerCapture(e.pointerId);
    pushToHistory();
    startBatch();
    setDraggingIdx(idx);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();

    if (panning && panStart) {
      const dx = (e.clientX - panStart.x) / rect.width;
      const dy = (e.clientY - panStart.y) / rect.height;

      setCamera(prev => ({
        ...prev,
        cx: prev.cx - dx * prev.zoom,
        cy: prev.cy + dy * prev.zoom // V goes up, so drag down (dy > 0) means cy goes up
      }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (draggingIdx !== null) {
      const sx = (e.clientX - rect.left) / rect.width;
      const sy = (e.clientY - rect.top) / rect.height;
      const { u, v } = svgToUv(sx, sy);
      updateUV(selected.id, draggingIdx, { u, v });
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panning) {
      (e.target as Element).releasePointerCapture(e.pointerId);
      setPanning(false);
      setPanStart(null);
    } else if (draggingIdx !== null) {
      endBatch();
      setDraggingIdx(null);
    }
  };

  const zoomBy = (factor: number) => setCamera((prev) => ({ ...prev, zoom: clampZoom(prev.zoom * factor) }));
  const applyPreset = (preset: UVPreset) => {
    const next = presetUVs(preset, selected.vertices, uvs);
    setUVs(selected.id, next);
    setCamera(fitView(next));
  };

  // --- Typed coordinates: the keyboard path to every handle ---
  // The field's onBeginChange records the undo step, so the edit itself runs batched.
  const setUV = (index: number, patch: { u?: number; v?: number }) => {
    const current = uvs[index];
    startBatch();
    updateUV(selected.id, index, { u: patch.u ?? current.u, v: patch.v ?? current.v });
    endBatch();
  };
  const uvColumns: DataColumn<{ u: number; v: number }>[] = [
    { key: 'index', header: '#', width: '28px', render: (_uv, i) => <span className="uve-index">{i}</span> },
    {
      key: 'u',
      header: 'U',
      numeric: true,
      render: (uv, i) => (
        <NumberField
          label={`Vertex ${i + 1} U`}
          hideTag
          value={uv.u}
          step={0.01}
          precision={2}
          onBeginChange={pushToHistory}
          onChange={(value) => setUV(i, { u: value })}
        />
      ),
    },
    {
      key: 'v',
      header: 'V',
      numeric: true,
      render: (uv, i) => (
        <NumberField
          label={`Vertex ${i + 1} V`}
          hideTag
          value={uv.v}
          step={0.01}
          precision={2}
          onBeginChange={pushToHistory}
          onChange={(value) => setUV(i, { v: value })}
        />
      ),
    },
  ];

  // --- Geometry Generation ---
  const edges: Array<[number, number]> = [];
  const t = selected.type;
  const n = uvs.length;
  if (t === 'TRIANGLES') {
    for (let i = 0; i + 2 < n; i += 3) edges.push([i, i + 1], [i + 1, i + 2], [i + 2, i]);
  } else if (t === 'TRIANGLE_STRIP') {
    for (let i = 0; i + 2 < n; i++) edges.push([i, i + 1], [i + 1, i + 2], [i + 2, i]);
  } else if (t === 'TRIANGLE_FAN') {
    for (let i = 1; i + 1 < n; i++) edges.push([0, i], [i, i + 1], [i + 1, 0]);
  } else if (t === 'QUADS') {
    for (let i = 0; i + 3 < n; i += 4) edges.push([i, i + 1], [i + 1, i + 2], [i + 2, i + 3], [i + 3, i]);
  } else if (t === 'QUAD_STRIP') {
    for (let i = 0; i + 3 < n; i += 2) edges.push([i, i + 1], [i + 1, i + 3], [i + 3, i + 2], [i + 2, i]);
  } else if (t === 'POLYGON' && n >= 2) {
    for (let i = 0; i < n - 1; i++) edges.push([i, i + 1]);
    if (n >= 3) edges.push([n - 1, 0]);
  }

  // --- Visuals ---
  const unitTL = uvToSvg(0, 1);
  const unitSize = 1 / viewSpan;

  return (
    <Panel panelId="uv-editor" title="UV coordinates" hint="glTexCoord2f" defaultOpen>
      <div className="uve-panel">
        <div
          className="uve-stage"
          ref={stageRef}
          title="Drag a corner to move its UV. Shift + drag pans, Shift + scroll zooms."
          onPointerDown={onStagePointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          <svg
            className="uve-stage-svg"
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
          >
            <defs>
              {tex && isRepeat && (
                <pattern id="bg-tex" x={unitTL.x} y={unitTL.y} width={unitSize} height={unitSize} patternUnits="userSpaceOnUse">
                  <image href={tex.dataUrl} width={unitSize} height={unitSize} preserveAspectRatio="none" style={{ imageRendering: 'pixelated' }} />
                </pattern>
              )}
            </defs>

            {/* The texture, tiled under REPEAT, then dimmed so the shape reads on top. */}
            {tex && isRepeat ? (
              <rect x="0" y="0" width="1" height="1" fill="url(#bg-tex)" />
            ) : tex ? (
              <image href={tex.dataUrl} x={unitTL.x} y={unitTL.y} width={unitSize} height={unitSize} preserveAspectRatio="none" style={{ imageRendering: 'pixelated' }} />
            ) : null}
            <rect className="uve-dim" x="0" y="0" width="1" height="1" />

            {/* The 0..1 square */}
            <rect className="uve-unit" x={unitTL.x} y={unitTL.y} width={unitSize} height={unitSize} />

            {/* The shape's outline */}
            <g className="uve-edges">
              {edges.map(([a, b], i) => {
                const pa = uvToSvg(uvs[a].u, uvs[a].v);
                const pb = uvToSvg(uvs[b].u, uvs[b].v);
                return <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} />;
              })}
            </g>

            {/* Numbered corners */}
            {uvs.map((uv, i) => {
              const p = uvToSvg(uv.u, uv.v);
              return (
                <g key={i}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={0.035}
                    className={`uve-handle ${draggingIdx === i ? 'dragging' : ''}`}
                    onPointerDown={onHandlePointerDown(i)}
                  />
                  <text
                    x={p.x}
                    y={p.y + 0.012}
                    fontSize={0.04}
                    className="uve-handle-label"
                  >
                    {i}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="uve-zoom" role="group" aria-label="Zoom">
            <button type="button" aria-label="Zoom out" onClick={() => zoomBy(ZOOM_STEP)}>−</button>
            <button type="button" aria-label="Fit the view" onClick={() => setCamera(fitView(uvs))}>Fit</button>
            <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1 / ZOOM_STEP)}>+</button>
          </div>
        </div>
        <div className="uve-presets" role="group" aria-label="UV presets">
          {PRESETS.map(({ preset, label, title }) => (
            <Button key={preset} title={title} onClick={() => applyPreset(preset)}>
              {label}
            </Button>
          ))}
        </div>
        <details className="uve-exact">
          <summary>
            <span>Exact values</span>
            <span className="uve-exact__count">{uvs.length} {uvs.length === 1 ? 'vertex' : 'vertices'}</span>
          </summary>
          <DataTable
            caption="Texture coordinates, glTexCoord2f(u, v)"
            columns={uvColumns}
            rows={uvs}
            rowKey={(_uv, i) => String(i)}
            activeRowKey={draggingIdx !== null ? String(draggingIdx) : null}
          />
        </details>
      </div>
    </Panel>
  );
}
