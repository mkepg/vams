import './custom-shape-builder-panel.scss';
import React from 'react';
import {
  Edit3, X, Plus, Minus, MousePointer, Trash2,
  CirclePile, Triangle, Square, Spline,
} from 'lucide-react';
import { MdShowChart } from "react-icons/md";
import { TbTriangles, TbHexagons, TbCarFanFilled  } from "react-icons/tb";
import { BsBoxes } from "react-icons/bs";
import type { PrimitiveType } from "@/core/types/scene";
import { useVamsStore } from "@/core/store";
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';

interface ShapeDefinition {
  type: PrimitiveType;
  icon: React.ReactNode;
  label: string;
  minVertices: number;
  stride: number | null;
  hint: string;
}

const SHAPE_DEFS: ShapeDefinition[] = [
  {
    type: 'POINTS',
    icon: <CirclePile size={18} />,
    label: 'GL_POINTS',
    minVertices: 1,
    stride: null,
    hint: 'Each click places an independent point.',
  },
  {
    type: 'LINES',
    icon: <Minus size={20} />,
    label: 'GL_LINES',
    minVertices: 2,
    stride: 2,
    hint: 'Click pairs of vertices — each pair forms one segment.',
  },
  {
    type: 'LINE_STRIP',
    icon: <MdShowChart size={18} />,
    label: 'GL_LINE_STRIP',
    minVertices: 2,
    stride: null,
    hint: 'Each new vertex connects to the previous one.',
  },
  {
    type: 'LINE_LOOP',
    icon: <Spline size={18} />,
    label: 'GL_LINE_LOOP',
    minVertices: 3,
    stride: null,
    hint: 'Like Line Strip, but the last vertex connects back to the first.',
  },
  {
    type: 'TRIANGLES',
    icon: <Triangle size={18} />,
    label: 'GL_TRIANGLES',
    minVertices: 3,
    stride: 3,
    hint: 'Click groups of 3 — each triple forms one triangle.',
  },
  {
    type: 'TRIANGLE_STRIP',
    icon: <TbTriangles size={18} />,
    label: 'GL_TRIANGLE_STRIP',
    minVertices: 3,
    stride: null,
    hint: 'Each new vertex forms a triangle with the previous two.',
  },
  {
    type: 'TRIANGLE_FAN',
    icon: <TbCarFanFilled size={18} />,
    label: 'GL_TRIANGLE_FAN',
    minVertices: 3,
    stride: null,
    hint: 'First vertex is the center — all triangles fan outward from it.',
  },
  {
    type: 'QUADS',
    icon: <Square size={18} />,
    label: 'GL_QUADS',
    minVertices: 4,
    stride: 4,
    hint: 'Click groups of 4 — each quad is split into two triangles.',
  },
  {
    type: 'QUAD_STRIP',
    icon: <BsBoxes size={18} />,
    label: 'GL_QUAD_STRIP',
    minVertices: 4,
    stride: 2,
    hint: 'Click pairs of vertices forming columns of quads.',
  },
  {
    type: 'POLYGON',
    icon: <TbHexagons size={18} />,
    label: 'GL_POLYGON',
    minVertices: 3,
    stride: null,
    hint: 'Vertices of a single convex polygon — order matters.',
  },
];

const STRIDE_LABEL_SINGULAR: Partial<Record<PrimitiveType, string>> = {
  LINES: 'segment',
  TRIANGLES: 'triangle',
  QUADS: 'quad',
  QUAD_STRIP: 'column',
};

const STRIDE_LABEL_PLURAL: Partial<Record<PrimitiveType, string>> = {
  LINES: 'segments',
  TRIANGLES: 'triangles',
  QUADS: 'quads',
  QUAD_STRIP: 'columns',
};

export default function CustomShapeBuilderPanel() {
  const pendingShapeType    = useVamsStore((s) => s.pendingShapeType);
  const pendingVertices     = useVamsStore((s) => s.pendingVertices);
  const pendingMinVertices  = useVamsStore((s) => s.pendingMinVertices);
  const pendingVertexStride = useVamsStore((s) => s.pendingVertexStride);
  const interactionMode     = useVamsStore((s) => s.interactionMode);
  const startCustomShape        = useVamsStore((s) => s.startCustomShape);
  const cancelCustomShape       = useVamsStore((s) => s.cancelCustomShape);
  const addManualVertex         = useVamsStore((s) => s.addManualVertex);
  const removeLastPendingVertex = useVamsStore((s) => s.removeLastPendingVertex);
  const removePendingVertexAt   = useVamsStore((s) => s.removePendingVertexAt);
  const updatePendingVertex     = useVamsStore((s) => s.updatePendingVertex);
  const addCustomObject         = useVamsStore((s) => s.addCustomObject);

  const isPlacing = interactionMode === 'VERTEX_PLACE';
  const activeDef = SHAPE_DEFS.find((d) => d.type === pendingShapeType);

  const hasMinimum = pendingVertices.length >= pendingMinVertices;
  const satisfiesStride =
    !pendingVertexStride || pendingVertices.length % pendingVertexStride === 0;
  const canCreate = hasMinimum && satisfiesStride && pendingVertices.length > 0;

  const handleCreate = () => {
    if (!pendingShapeType || !canCreate) return;
    addCustomObject(pendingShapeType, pendingVertices);
  };

  const handleCoordChange = (index: number, axis: 'x' | 'y', raw: string) => {
    const num = parseFloat(raw);
    const val = isNaN(num) ? 0 : num;
    const v = pendingVertices[index];
    updatePendingVertex(index, axis === 'x' ? val : v.x, axis === 'y' ? val : v.y);
  };

  const statusText = (): string => {
    const n = pendingVertices.length;
    if (!activeDef) return `${n} / ${pendingMinVertices} min`;

    if (pendingVertexStride) {
      const sing = STRIDE_LABEL_SINGULAR[activeDef.type] ?? 'group';
      const plur = STRIDE_LABEL_PLURAL[activeDef.type] ?? 'groups';
      const remainder = n % pendingVertexStride;
      if (remainder === 0) {
        if (n < pendingMinVertices) return `${n} / ${pendingMinVertices} min`;
        const complete = n / pendingVertexStride;
        return `${n} vertices (${complete} ${complete === 1 ? sing : plur})`;
      }
      const needed = pendingVertexStride - remainder;
      return `${n} vertices (need ${needed} more for a full ${sing})`;
    }

    return `${n} / ${pendingMinVertices} min`;
  };

  if (!pendingShapeType) {
    return (
      <CollapsibleSection panelId="primitive-palette" title="Create Primitive" icon={<Edit3 size={12} />} defaultOpen={true}>
        <div className="grid-buttons">
          {SHAPE_DEFS.map((def) => (
            <button
              key={def.type}
              onClick={() => startCustomShape(def.type, def.minVertices, def.stride)}
              className="create-btn"
              title={`Create ${def.label}`}
            >
              {def.icon}
              <span>{def.label}</span>
            </button>
          ))}
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection panelId="primitive-palette" title="Create Primitive" icon={<Edit3 size={12} />} defaultOpen={true}>
      <div className="vertex-shape-builder">
        <div className="control-row header">
          <span className="shape-label">{activeDef?.label}</span>
          <button onClick={cancelCustomShape} className="icon-btn-ghost" title="Cancel">
            <X size={16} />
          </button>
        </div>
        <div className={`placement-hint ${isPlacing ? 'active' : ''}`}>
          <MousePointer size={13} className="hint-icon" />
          <span>{activeDef?.hint ?? 'Click on the canvas to place vertices'}</span>
        </div>
        <div className="vertex-list">
          {pendingVertices.length === 0 && (
            <div className="vertex-empty-msg">No vertices yet — click the canvas or add one below</div>
          )}
          {pendingVertices.map((v, i) => (
            <div key={i} className="vertex-row">
              <span className="vertex-index">V{i}</span>
              <div className="coord-input-group">
                <span className="coord-label">X</span>
                <input
                  type="number"
                  value={v.x}
                  onChange={(e) => handleCoordChange(i, 'x', e.currentTarget.value)}
                  placeholder="0.0"
                  step="0.1"
                  className="vertex-coord-input"
                />
              </div>
              <div className="coord-input-group">
                <span className="coord-label">Y</span>
                <input
                  type="number"
                  value={v.y}
                  onChange={(e) => handleCoordChange(i, 'y', e.currentTarget.value)}
                  placeholder="0.0"
                  step="0.1"
                  className="vertex-coord-input"
                />
              </div>
              <button
                className="icon-btn-ghost vertex-delete"
                onClick={() => removePendingVertexAt(i)}
                disabled={pendingVertices.length <= pendingMinVertices}
                title="Remove vertex"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <div className="vertex-count-status">
          <span className={`count-badge ${canCreate ? 'sufficient' : 'insufficient'}`}>
            {statusText()}
          </span>
        </div>
        <div className="vertex-tools">
          <button
            onClick={addManualVertex}
            className="tool-btn"
          >
            <Plus size={14} /> <span>Add Vertex</span>
          </button>
          <button
            onClick={removeLastPendingVertex}
            disabled={pendingVertices.length === 0}
            className="tool-btn"
          >
            <Minus size={14} /> <span>Remove Last</span>
          </button>
        </div>
        <div className="vertex-input-actions">
          <button onClick={cancelCustomShape} className="action-btn cancel-btn">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="action-btn create-btn-primary"
          >
            Create Shape
          </button>
        </div>
      </div>
    </CollapsibleSection>
  );
}
