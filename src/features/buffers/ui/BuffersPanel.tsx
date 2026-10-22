import './buffers-panel.scss';
import { useRef } from 'react';
import { Database, Info, Boxes } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';
import { GlHint, Switch } from '@/shared/ui/controls';
import type {
  BufferUpdateMethod,
  BufferUsage,
  RenderingMode,
  SceneNode,
} from '@/core/types/scene';

const NON_PRIMITIVE_TYPES: ReadonlySet<SceneNode['type']> = new Set(['GROUP', 'TEXT']);

interface ModeOption {
  id: RenderingMode;
  label: string;
  api: string;
  hint: string;
  /** The call the generator emits in this mode, with parameter names in place of values. */
  call: string;
  args: string;
}

const MODE_OPTIONS: ModeOption[] = [
  { id: 'IMMEDIATE',    label: 'Immediate',    api: 'glBegin / glEnd', hint: 'vertex by vertex',          call: 'glBegin',         args: 'mode' },
  { id: 'VERTEX_ARRAY', label: 'Vertex Array', api: 'glDrawArrays',    hint: 'sent each frame', call: 'glVertexPointer', args: '2, GL_FLOAT, 0, verts' },
  { id: 'VBO',          label: 'VBO',          api: 'glBufferData',    hint: 'uploaded once',    call: 'glBufferData',    args: 'GL_ARRAY_BUFFER, size, data, usage' },
];

interface UsageOption {
  id: BufferUsage;
  label: string;
  macro: string;
  hint: string;
}

const USAGE_OPTIONS: UsageOption[] = [
  { id: 'STATIC',  label: 'Static',  macro: 'GL_STATIC_DRAW',  hint: 'set once, drawn often' },
  { id: 'DYNAMIC', label: 'Dynamic', macro: 'GL_DYNAMIC_DRAW', hint: 'changed sometimes' },
  { id: 'STREAM',  label: 'Stream',  macro: 'GL_STREAM_DRAW',  hint: 'rebuilt every frame' },
];

interface UpdateMethodOption {
  id: BufferUpdateMethod;
  label: string;
  api: string;
  hint: string;
  call: string;
  args: string;
}

const UPDATE_METHOD_OPTIONS: UpdateMethodOption[] = [
  {
    id: 'BUFFER_SUB_DATA',
    label: 'Sub Data',
    api: 'glBufferSubData',
    hint: 'rewrites a GPU range',
    call: 'glBufferSubData',
    args: 'GL_ARRAY_BUFFER, 0, size, data',
  },
  {
    id: 'MAP_BUFFER',
    label: 'Map Buffer',
    api: 'glMapBuffer',
    hint: 'writes by pointer',
    call: 'glMapBuffer',
    args: 'GL_ARRAY_BUFFER, GL_WRITE_ONLY',
  },
];

interface CardGroupProps<O extends { id: string }> {
  label: string;
  className: string;
  options: O[];
  value: O['id'];
  onChange: (id: O['id']) => void;
  renderCard: (option: O) => { title: string; name: string; desc: string };
}

/** Radiogroup of stacked rows, each with a marker, a name and a description: roving tabIndex, arrows and Home/End. */
function CardGroup<O extends { id: string }>({ label, className, options, value, onChange, renderCard }: CardGroupProps<O>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(0, options.findIndex((o) => o.id === value));

  const choose = (index: number) => {
    const next = (index + options.length) % options.length;
    onChange(options[next].id);
    refs.current[next]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        choose(current + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        choose(current - 1);
        break;
      case 'Home':
        event.preventDefault();
        choose(0);
        break;
      case 'End':
        event.preventDefault();
        choose(options.length - 1);
        break;
    }
  };

  return (
    <div className={className} role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((option, index) => {
        const active = option.id === value;
        const card = renderCard(option);
        return (
          <button
            key={option.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            className={`bp-row ${active ? 'active' : ''}`}
            role="radio"
            aria-checked={active}
            tabIndex={index === current ? 0 : -1}
            onClick={() => onChange(option.id)}
            title={card.title}
          >
            <span className="bp-row__mark" aria-hidden="true" />
            <span className="bp-row__name">{card.name}</span>
            <span className="bp-row__desc">{card.desc}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function BuffersPanel() {
  const objects = useVamsStore((s) => s.objects);
  const selectedObjectId = useVamsStore((s) => s.selectedObjectId);
  const updateRenderingMode = useVamsStore((s) => s.updateRenderingMode);
  const updateBufferUsage = useVamsStore((s) => s.updateBufferUsage);
  const updateUseIndexed = useVamsStore((s) => s.updateUseIndexed);
  const updateUpdateMethod = useVamsStore((s) => s.updateUpdateMethod);

  const selected = objects.find((o) => o.id === selectedObjectId);

  if (!selected) {
    return (
      <CollapsibleSection
        panelId="buffers-panel"
        title="Memory & Buffers"
        icon={<Database size={14} />}
        defaultOpen={true}
        hint="glVertexPointer"
      >
        <div className="bp-empty">
          <Boxes size={28} className="bp-empty-icon" strokeWidth={1.5} />
          <p>Select a primitive to manage how its vertex data is stored and submitted to OpenGL.</p>
        </div>
      </CollapsibleSection>
    );
  }

  if (NON_PRIMITIVE_TYPES.has(selected.type)) {
    return (
      <CollapsibleSection
        panelId="buffers-panel"
        title="Memory & Buffers"
        icon={<Database size={14} />}
        defaultOpen={true}
        hint="glVertexPointer"
      >
        <div className="bp-empty">
          <p>Buffer settings apply to drawing primitives only. Select a shape to continue.</p>
        </div>
      </CollapsibleSection>
    );
  }

  const mode: RenderingMode = selected.renderingMode ?? 'IMMEDIATE';
  const usage: BufferUsage = selected.bufferUsage ?? 'STATIC';
  const updateMethod: BufferUpdateMethod = selected.updateMethod ?? 'BUFFER_SUB_DATA';
  const indexed = !!selected.useIndexed;

  const modeOption = MODE_OPTIONS.find((m) => m.id === mode)!;
  const methodOption = UPDATE_METHOD_OPTIONS.find((u) => u.id === updateMethod)!;
  const showUsage = mode === 'VBO';
  const showUpdateMethod = mode === 'VBO' && usage === 'DYNAMIC';

  return (
    <CollapsibleSection
      panelId="buffers-panel"
      title="Memory & Buffers"
      icon={<Database size={14} />}
      defaultOpen={true}
      hint="glVertexPointer"
    >
      <div className="bp-panel">

        {/* ---- Rendering Mode cards ---- */}
        <div className="bp-block">
          <div className="bp-block-head">
            <span className="bp-block-label">Rendering Mode</span>
            <span className="bp-block-hint">{modeOption.api}</span>
          </div>
          <CardGroup
            label="Rendering mode"
            className="bp-list"
            options={MODE_OPTIONS}
            value={mode}
            onChange={(id) => updateRenderingMode(selected.id, id)}
            renderCard={(opt) => ({ title: opt.api, name: opt.label, desc: opt.hint })}
          />
          <GlHint call={modeOption.call} args={modeOption.args} />
        </div>

        {/* ---- Buffer Usage Hint (VBO only) ---- */}
        {showUsage && (
          <div className="bp-block">
            <div className="bp-block-head">
              <span className="bp-block-label">Buffer Usage</span>
              <span className="bp-block-hint">{USAGE_OPTIONS.find((u) => u.id === usage)!.macro}</span>
            </div>
            <CardGroup
              label="Buffer usage hint"
              className="bp-list"
              options={USAGE_OPTIONS}
              value={usage}
              onChange={(id) => updateBufferUsage(selected.id, id)}
              renderCard={(opt) => ({ title: opt.macro, name: opt.label, desc: opt.hint })}
            />
          </div>
        )}

        {/* ---- Update Method (VBO + DYNAMIC only) ----
             STATIC has no update path. STREAM always re-uploads the whole
             buffer regardless. The choice between sub-data and map-buffer
             only meaningfully changes the emitted code for DYNAMIC. */}
        {showUpdateMethod && (
          <div className="bp-block">
            <div className="bp-block-head">
              <span className="bp-block-label">Update Method</span>
              <span className="bp-block-hint">{methodOption.api}</span>
            </div>
            <CardGroup
              label="Buffer update method"
              className="bp-list"
              options={UPDATE_METHOD_OPTIONS}
              value={updateMethod}
              onChange={(id) => updateUpdateMethod(selected.id, id)}
              renderCard={(opt) => ({ title: opt.api, name: opt.label, desc: opt.hint })}
            />
            <GlHint call={methodOption.call} args={methodOption.args} />
          </div>
        )}

        {/* ---- Indexed Drawing toggle ---- */}
        <div className="bp-block">
          <div className="bp-block-head">
            <span className="bp-block-label">Indexed Drawing</span>
            <span className="bp-block-hint">{indexed ? 'glDrawElements' : 'glDrawArrays'}</span>
          </div>
          <Switch
            label="Deduplicate vertices"
            checked={indexed}
            onChange={(next) => updateUseIndexed(selected.id, next)}
          />
          <span className="bp-indexed-sub">
            {indexed
              ? 'Vertices reused via an index array.'
              : 'Each vertex is emitted in order — repetition is allowed.'}
          </span>
        </div>

        {/* ---- Footnote ---- */}
        <div className="bp-note" role="note">
          <Info size={12} className="bp-note-icon" aria-hidden />
          <p>
            Visual output is identical across modes — switching changes the
            generated code structure. Watch the code panel for the diff, especially
            when you change usage or update method.
          </p>
        </div>
      </div>
    </CollapsibleSection>
  );
}
