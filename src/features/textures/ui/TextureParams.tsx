import './textures-panels.scss';
import { useState } from 'react';
import { useVamsStore } from '@/core/store';
import { SegmentedControl, type SegmentOption } from '@/shared/ui/controls';
import type { TextureFilter, TextureWrap } from '@/core/types/textures';

const FILTER_OPTIONS: SegmentOption<TextureFilter>[] = [
  { value: 'NEAREST', label: 'NEAREST', title: 'GL_NEAREST: each pixel takes the nearest texel, so zoomed-in images stay blocky' },
  { value: 'LINEAR', label: 'LINEAR', title: 'GL_LINEAR: each pixel blends the four nearest texels, so zoomed-in images look smooth' },
];
const WRAP_OPTIONS: SegmentOption<TextureWrap>[] = [
  { value: 'REPEAT', label: 'REPEAT', title: 'GL_REPEAT: UVs past 0 to 1 tile the image' },
  { value: 'CLAMP_TO_EDGE', label: 'CLAMP', title: 'GL_CLAMP_TO_EDGE: UVs past 0 to 1 stretch the edge texels' },
];

/** Filter and wrap side by side, and the glTexParameteri line for whichever changed last. */
export default function TextureParams() {
  const selected = useVamsStore((s) => s.objects.find((o) => o.id === s.selectedObjectId));
  const updateTextureFilter = useVamsStore((s) => s.updateTextureFilter);
  const updateTextureWrap = useVamsStore((s) => s.updateTextureWrap);
  const [last, setLast] = useState<'filter' | 'wrap'>('filter');

  if (!selected?.texture) return null;
  const { filter, wrap } = selected.texture;
  const line = last === 'filter'
    ? `glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_${filter});`
    : `glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_${wrap});`;

  return (
    <div className="tx-params">
      <div className="tx-params__pair">
        <div className="tx-params__field">
          <span className="tx-params__label" aria-hidden="true">Filter</span>
          <SegmentedControl<TextureFilter>
            label="Filter mode"
            mono
            options={FILTER_OPTIONS}
            value={filter}
            onChange={(next) => {
              setLast('filter');
              updateTextureFilter(selected.id, next);
            }}
          />
        </div>
        <div className="tx-params__field">
          <span className="tx-params__label" aria-hidden="true">Wrap</span>
          <SegmentedControl<TextureWrap>
            label="Wrap mode"
            mono
            options={WRAP_OPTIONS}
            value={wrap}
            onChange={(next) => {
              setLast('wrap');
              updateTextureWrap(selected.id, next);
            }}
          />
        </div>
      </div>
      <code className="tx-params__line">{line}</code>
    </div>
  );
}
