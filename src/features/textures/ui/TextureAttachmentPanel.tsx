import './textures-panels.scss';
import { Link, Unlink, ImageOff } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';
import { Button, GlHint, SegmentedControl } from '@/shared/ui/controls';
import type { SceneNode } from '@/core/types/scene';
import type { TextureFilter, TextureWrap } from '@/core/types/textures';

export const TEXTUREABLE_TYPES: ReadonlySet<SceneNode['type']> = new Set([
  'TRIANGLES', 'TRIANGLE_STRIP', 'TRIANGLE_FAN',
  'QUADS', 'QUAD_STRIP', 'POLYGON',
]);

export default function TextureAttachmentPanel() {
  const objects = useVamsStore((s) => s.objects);
  const selectedObjectId = useVamsStore((s) => s.selectedObjectId);
  const activeTextureId = useVamsStore((s) => s.activeTextureId);
  const getTextureById = useVamsStore((s) => s.getTextureById);
  const attachTexture = useVamsStore((s) => s.attachTexture);
  const detachTexture = useVamsStore((s) => s.detachTexture);
  const updateTextureFilter = useVamsStore((s) => s.updateTextureFilter);
  const updateTextureWrap = useVamsStore((s) => s.updateTextureWrap);

  const selected = objects.find((o) => o.id === selectedObjectId);

  if (!selected || !TEXTUREABLE_TYPES.has(selected.type)) {
    return (
      <CollapsibleSection
        panelId="texture-attach"
        title="Apply Texture"
        icon={<Link size={14} />}
        defaultOpen={true}
        hint="glBindTexture"
      >
        <div className="tx-attach-empty">
          <ImageOff size={28} strokeWidth={1.5} />
          <p>
            Select a fillable primitive — triangle, quad, or polygon — to apply a texture to it.
          </p>
        </div>
      </CollapsibleSection>
    );
  }

  const attached = selected.texture
    ? getTextureById(selected.texture.textureId)
    : null;

  const candidate = activeTextureId ? getTextureById(activeTextureId) : null;
  const canApply = !!candidate;

  const filter: TextureFilter = selected.texture?.filter ?? 'LINEAR';
  const wrap: TextureWrap = selected.texture?.wrap ?? 'REPEAT';

  return (
    <CollapsibleSection
      panelId="texture-attach"
      title="Apply Texture"
      icon={<Link size={14} />}
      defaultOpen={true}
      hint="glBindTexture"
    >
      <div className="tx-attach">
        {attached ? (
          <div className="tx-attach-active-row">
            <div
              className="tx-attach-thumb"
              style={{ backgroundImage: `url(${attached.dataUrl})` }}
            />
            <div className="tx-attach-info">
              <span className="tx-attach-name">{attached.name}</span>
              <span className="tx-attach-dim">
                {attached.width} × {attached.height}
              </span>
            </div>
            <Button
              icon={<Unlink size={13} />}
              onClick={() => detachTexture(selected.id)}
            >
              Detach
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            className="tx-attach-apply"
            icon={<Link size={13} />}
            disabled={!canApply}
            onClick={() => candidate && attachTexture(selected.id, candidate.id)}
            title={
              canApply
                ? `Apply "${candidate!.name}" to ${selected.name}`
                : 'Pick a texture in the library first'
            }
          >
            {canApply ? `Apply "${candidate!.name}"` : 'Pick a texture in the library above'}
          </Button>
        )}

        {selected.texture && (
          <>
            <div className="tx-attach-block">
              <span className="tx-attach-block-label">Filter</span>
              <GlHint call="glTexParameteri" args="GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, filter" />
              <SegmentedControl<TextureFilter>
                label="Filter mode"
                mono
                options={[
                  { value: 'NEAREST', label: 'GL_NEAREST', title: 'Nearest-neighbour sampling — blocky on zoom' },
                  { value: 'LINEAR', label: 'GL_LINEAR', title: 'Bilinear sampling — smooth on zoom' },
                ]}
                value={filter}
                onChange={(next) => updateTextureFilter(selected.id, next)}
              />
            </div>

            <div className="tx-attach-block">
              <span className="tx-attach-block-label">Wrap</span>
              <GlHint call="glTexParameteri" args="GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, wrap" />
              <SegmentedControl<TextureWrap>
                label="Wrap mode"
                mono
                options={[
                  { value: 'REPEAT', label: 'GL_REPEAT', title: 'Tile the texture beyond [0,1]' },
                  { value: 'CLAMP_TO_EDGE', label: 'GL_CLAMP_TO_EDGE', title: 'Stretch the edge pixels beyond [0,1]' },
                ]}
                value={wrap}
                onChange={(next) => updateTextureWrap(selected.id, next)}
              />
            </div>
          </>
        )}
      </div>
    </CollapsibleSection>
  );
}
