import './vertices-panel.scss';
import type { Vertex } from '@/core/types/scene';
import { useVamsStore } from '@/core/store';
import { DataTable, GlHint, NumberField, Panel, type DataColumn } from '@/shared/ui/controls';

/** The selected object's vertices as glVertex2f positions, editable by typing or scrubbing. */
export default function VerticesPanel() {
  const selected = useVamsStore((s) => s.objects.find((o) => o.id === s.selectedObjectId) ?? null);
  const updateVertexPosition = useVamsStore((s) => s.updateVertexPosition);
  const pushToHistory = useVamsStore((s) => s.pushToHistory);
  if (!selected) return null;

  const columns: DataColumn<Vertex>[] = [
    { key: 'index', header: '#', width: '28px', render: (_v, i) => <span className="vertex-index">{i}</span> },
    {
      key: 'x',
      header: 'X',
      numeric: true,
      render: (v, i) => (
        <NumberField
          label={`Vertex ${i} X`}
          hideTag
          value={v.x}
          step={0.05}
          onBeginChange={pushToHistory}
          onChange={(x) => updateVertexPosition(selected.id, v.id, x, v.y)}
        />
      ),
    },
    {
      key: 'y',
      header: 'Y',
      numeric: true,
      render: (v, i) => (
        <NumberField
          label={`Vertex ${i} Y`}
          hideTag
          value={v.y}
          step={0.05}
          onBeginChange={pushToHistory}
          onChange={(y) => updateVertexPosition(selected.id, v.id, v.x, y)}
        />
      ),
    },
  ];

  return (
    <Panel panelId="vertices-panel" title="Vertices" defaultOpen>
      <div className="vertices-panel">
        <GlHint call="glVertex2f" args="x, y" />
        <DataTable caption={`Vertices of ${selected.name}`} columns={columns} rows={selected.vertices} rowKey={(v) => v.id} />
      </div>
    </Panel>
  );
}
