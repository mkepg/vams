import './textures-panels.scss';
import { useRef, useState, useEffect, useCallback } from 'react';
import { Grid3x3, RotateCcw, LocateFixed } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';
import { Button, DataTable, GlHint, NumberField, type DataColumn } from '@/shared/ui/controls';

export default function UVEditorPanel() {
  const objects = useVamsStore((s) => s.objects);
  const selectedObjectId = useVamsStore((s) => s.selectedObjectId);
  const getTextureById = useVamsStore((s) => s.getTextureById);
  const updateUV = useVamsStore((s) => s.updateUV);
  const resetUVsToDefault = useVamsStore((s) => s.resetUVsToDefault);
  const startBatch = useVamsStore((s) => s.startBatch);
  const endBatch = useVamsStore((s) => s.endBatch);
  const pushToHistory = useVamsStore((s) => s.pushToHistory);
  
  const stageRef = useRef<HTMLDivElement>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  // --- Navigable Camera State ---
  const [camera, setCamera] = useState({ cx: 0.5, cy: 0.5, zoom: 2.0 });
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
      const newZoom = Math.max(0.05, Math.min(20.0, cam.zoom * zoomFactor));

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
      <CollapsibleSection
        panelId="uv-editor"
        title="UV Editor"
        icon={<Grid3x3 size={14} />}
        defaultOpen={true}
        hint="glTexCoord2f"
      >
        <div className="uve-empty">
          Apply a texture to a primitive to edit its UV coordinates.
        </div>
      </CollapsibleSection>
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
          label={`Vertex ${i} U`}
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
          label={`Vertex ${i} V`}
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
    <CollapsibleSection
      panelId="uv-editor"
      title="UV Editor"
      icon={<Grid3x3 size={14} />}
      defaultOpen={true}
      hint="glTexCoord2f"
    >
      <div className="uve-panel">
        <div
          className="uve-stage"
          ref={stageRef}
          onPointerDown={onStagePointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Button
            variant="quiet"
            iconOnly
            label="Recenter Camera"
            icon={<LocateFixed size={14} />}
            className="uve-recenter"
            onClick={() => setCamera({ cx: 0.5, cy: 0.5, zoom: 2.0 })}
          />
          
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

            {/* Background Texture */}
            {tex && isRepeat ? (
              <rect x="0" y="0" width="1" height="1" fill="url(#bg-tex)" />
            ) : tex ? (
              <image href={tex.dataUrl} x={unitTL.x} y={unitTL.y} width={unitSize} height={unitSize} preserveAspectRatio="none" style={{ imageRendering: 'pixelated' }} />
            ) : null}

            {/* Unit square outlines */}
            <rect x={unitTL.x} y={unitTL.y} width={unitSize} height={unitSize} fill="none" stroke="rgba(0,0,0,0.8)" strokeWidth={0.005} />
            <rect x={unitTL.x} y={unitTL.y} width={unitSize} height={unitSize} fill="none" stroke="#fbbf24" strokeWidth={0.0025} strokeDasharray="0.01 0.01" />

            {/* Edges */}
            <g className="uve-edges">
              {edges.map(([a, b], i) => {
                const pa = uvToSvg(uvs[a].u, uvs[a].v);
                const pb = uvToSvg(uvs[b].u, uvs[b].v);
                return <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} />;
              })}
            </g>

            {/* Vertices */}
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
        </div>
        <div className="uve-foot">
          <span className="uve-foot-hint">
            Drag handles to edit UVs. <strong>Shift + Drag</strong> to pan. <strong>Shift + Scroll</strong> to zoom.
          </span>
          <Button
            variant="quiet"
            className="uve-reset"
            icon={<RotateCcw size={13} />}
            onClick={() => resetUVsToDefault(selected.id)}
            title="Reset UVs to default unit-square mapping"
          >
            Reset
          </Button>
        </div>
        <div className="uve-table">
          <GlHint call="glTexCoord2f" args="u, v" />
          <DataTable
            caption="Texture coordinates"
            columns={uvColumns}
            rows={uvs}
            rowKey={(_uv, i) => String(i)}
            activeRowKey={draggingIdx !== null ? String(draggingIdx) : null}
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}