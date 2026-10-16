import './custom-shape-builder-panel.scss';
import { Edit3, X, Plus, Minus, MousePointer, Trash2 } from 'lucide-react';
import type { PendingVertex, PrimitiveType } from "@/core/types/scene";
import { useVamsStore } from "@/core/store";
import PrimitiveTiles from './PrimitiveTiles';
import { primitiveDef, type PrimitiveDef } from '../model/primitive-defs';
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';
import { Button, DataTable, GlHint, NumberField, type DataColumn } from '@/shared/ui/controls';

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
  const pushToHistory           = useVamsStore((s) => s.pushToHistory);

  const isPlacing = interactionMode === 'VERTEX_PLACE';
  const activeDef = pendingShapeType ? primitiveDef(pendingShapeType) : undefined;

  const hasMinimum = pendingVertices.length >= pendingMinVertices;
  const satisfiesStride =
    !pendingVertexStride || pendingVertices.length % pendingVertexStride === 0;
  const canCreate = hasMinimum && satisfiesStride && pendingVertices.length > 0;

  const handleCreate = () => {
    if (!pendingShapeType || !canCreate) return;
    addCustomObject(pendingShapeType, pendingVertices);
  };

  const handleCoordChange = (index: number, axis: 'x' | 'y', value: number) => {
    const v = useVamsStore.getState().pendingVertices[index];
    if (!v) return;
    updatePendingVertex(index, axis === 'x' ? value : v.x, axis === 'y' ? value : v.y);
  };

  const vertexColumns: DataColumn<PendingVertex>[] = [
    { key: 'index', header: '#', width: '28px', render: (_v, i) => <span className="vertex-index">{i}</span> },
    {
      key: 'x',
      header: 'X',
      numeric: true,
      render: (v, i) => (
        <NumberField
          label={`Vertex ${i + 1} X`}
          hideTag
          value={v.x}
          step={0.1}
          onBeginChange={pushToHistory}
          onChange={(value) => handleCoordChange(i, 'x', value)}
        />
      ),
    },
    {
      key: 'y',
      header: 'Y',
      numeric: true,
      render: (v, i) => (
        <NumberField
          label={`Vertex ${i + 1} Y`}
          hideTag
          value={v.y}
          step={0.1}
          onBeginChange={pushToHistory}
          onChange={(value) => handleCoordChange(i, 'y', value)}
        />
      ),
    },
    {
      key: 'remove',
      header: '',
      width: '32px',
      render: (_v, i) => (
        <Button
          variant="quiet"
          iconOnly
          label={`Remove vertex ${i}`}
          icon={<Trash2 size={13} />}
          onClick={() => removePendingVertexAt(i)}
          disabled={pendingVertices.length <= pendingMinVertices}
        />
      ),
    },
  ];

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
    const start = (def: PrimitiveDef) => startCustomShape(def.type, def.minVertices, def.stride);
    return (
      <CollapsibleSection panelId="primitive-palette" title="Primitives" titleHidden icon={<Edit3 size={12} />} defaultOpen={true}>
        <PrimitiveTiles onPick={start} />
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection panelId="primitive-palette" title="Primitives" titleHidden icon={<Edit3 size={12} />} defaultOpen={true}>
      <div className="vertex-shape-builder">
        <div className="control-row header">
          <span className="shape-label">{activeDef?.glName}</span>
          <Button variant="quiet" iconOnly label="Cancel" icon={<X size={16} />} onClick={cancelCustomShape} />
        </div>
        <div className={`placement-hint ${isPlacing ? 'active' : ''}`}>
          <MousePointer size={13} className="hint-icon" />
          <span>{activeDef?.hint ?? 'Click on the canvas to place vertices'}</span>
        </div>
        <div className="vertex-list">
          <GlHint call="glVertex2f" args="x, y" />
          {pendingVertices.length === 0 ? (
            <div className="vertex-empty-msg">No vertices yet — click the canvas or add one below</div>
          ) : (
            <DataTable
              caption="Vertices"
              columns={vertexColumns}
              rows={pendingVertices}
              rowKey={(_v, i) => String(i)}
            />
          )}
        </div>
        <div className="vertex-count-status">
          <span className={`count-badge ${canCreate ? 'sufficient' : 'insufficient'}`}>
            {statusText()}
          </span>
        </div>
        <div className="vertex-tools">
          <Button variant="secondary" icon={<Plus size={14} />} onClick={addManualVertex}>
            Add Vertex
          </Button>
          <Button
            variant="secondary"
            icon={<Minus size={14} />}
            onClick={removeLastPendingVertex}
            disabled={pendingVertices.length === 0}
          >
            Remove Last
          </Button>
        </div>
        <div className="vertex-input-actions">
          <Button variant="quiet" onClick={cancelCustomShape}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreate} disabled={!canCreate}>
            Create Shape
          </Button>
        </div>
      </div>
    </CollapsibleSection>
  );
}
