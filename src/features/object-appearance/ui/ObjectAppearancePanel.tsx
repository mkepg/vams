import './object-appearance-panel.scss';
import { useState, useEffect, useRef } from 'react';
import { Palette } from 'lucide-react';
import { useVamsStore } from "@/core/store";
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';
import { Button, ColorField, SegmentedControl, type SegmentOption } from '@/shared/ui/controls';
import type { ColorMode } from '@/core/types/scene';
import BackgroundColorPanel from './BackgroundColorPanel';

type EmissionOption = '3f' | '3ub';
const EMISSION_OPTIONS: SegmentOption<EmissionOption>[] = [
  { value: '3f', label: 'glColor3f', title: 'Emit colors as glColor3f (normalized 0.0–1.0)' },
  { value: '3ub', label: 'glColor3ub', title: 'Emit colors as glColor3ub (integer 0–255)' },
];
const EMISSION_TO_MODE: Record<EmissionOption, ColorMode> = { '3f': 'FLOAT', '3ub': 'BYTE' };

const APPLICATION_OPTIONS: SegmentOption<'OBJECT' | 'VERTEX'>[] = [
  { value: 'OBJECT', label: 'Uniform', title: 'Apply one uniform color to the entire object' },
  { value: 'VERTEX', label: 'Per vertex', title: 'Paint individual vertices for interpolated gradients' },
];

const GRADIENT_PRESETS: { label: string; colors: string[] }[] = [
  { label: 'Red → Blue', colors: ['#ff0000', '#0000ff'] },
  { label: 'Rainbow', colors: ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff'] },
  { label: 'Warm', colors: ['#ff6b35', '#f7931e', '#fdc500'] },
  { label: 'Cool', colors: ['#667eea', '#764ba2', '#f093fb'] },
];

const getGradientColor = (colors: string[], position: number): string => {
  if (colors.length === 0) return '#ffffff';
  if (colors.length === 1) return colors[0];
  if (position <= 0) return colors[0];
  if (position >= 1) return colors[colors.length - 1];

  const segment = 1 / (colors.length - 1);
  const index = Math.floor(position / segment);
  const factor = (position - index * segment) / segment;

  const c1 = colors[index];
  const c2 = colors[index + 1];

  const r1 = parseInt(c1.substring(1, 3), 16);
  const g1 = parseInt(c1.substring(3, 5), 16);
  const b1 = parseInt(c1.substring(5, 7), 16);

  const r2 = parseInt(c2.substring(1, 3), 16);
  const g2 = parseInt(c2.substring(3, 5), 16);
  const b2 = parseInt(c2.substring(5, 7), 16);

  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

export default function ObjectAppearancePanel() {
  const {
    objects,
    selectedObjectId,
    updateVertexColor,
    pushToHistory,
    startBatch,
    endBatch,
    updateObjectColorMode,
  } = useVamsStore();

  const selectedObject = objects.find(o => o.id === selectedObjectId);
  const [colorMode, setColorMode] = useState<'OBJECT' | 'VERTEX'>('OBJECT');
  const [activeColorChange, setActiveColorChange] = useState<string | null>(null);

  const isMultiColor = selectedObject && selectedObject.vertices.length > 0
    ? selectedObject.vertices.some(v => v.color !== selectedObject.vertices[0].color)
    : false;

  const [prevSelectedId, setPrevSelectedId] = useState<string | null>(selectedObjectId);
  const [prevIsMulti, setPrevIsMulti] = useState<boolean>(isMultiColor);

  if (selectedObjectId !== prevSelectedId) {
    setPrevSelectedId(selectedObjectId);
    setPrevIsMulti(isMultiColor);
    setColorMode(isMultiColor ? 'VERTEX' : 'OBJECT');
  } else if (isMultiColor && !prevIsMulti) {
    setPrevIsMulti(true);
    setColorMode('VERTEX');
  } else if (!isMultiColor && prevIsMulti) {
    setPrevIsMulti(false);
  }

  const toggleContainerRef = useRef<HTMLDivElement>(null);
  const scrollTriggerRef = useRef({ id: selectedObjectId, wasMulti: isMultiColor });

  useEffect(() => {
    const last = scrollTriggerRef.current;
    if (selectedObjectId === last.id && isMultiColor && !last.wasMulti) {
      setTimeout(() => {
        const el = toggleContainerRef.current;
        if (el) {
          const scrollParent = el.closest('[data-scroll-root]') as HTMLElement;
          
          if (scrollParent) {
            const parentRect = scrollParent.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            const targetTop = scrollParent.scrollTop + (elRect.top - parentRect.top) - (parentRect.height / 2) + (elRect.height / 2);
            
            scrollParent.scrollTo({ top: targetTop, behavior: 'smooth' });
          } else {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 100);
    }
    scrollTriggerRef.current = { id: selectedObjectId, wasMulti: isMultiColor };
  }, [selectedObjectId, isMultiColor]);

  const switchColorMode = (mode: 'OBJECT' | 'VERTEX') => {
    setColorMode(mode);
    setActiveColorChange(null);
  };

  if (!selectedObject) return <BackgroundColorPanel />;

  if (selectedObject.type === 'GROUP') return null;

  const supportsPerVertexColor = selectedObject.vertices.length >= 2;
  const objColorMode = selectedObject.colorMode ?? 'FLOAT';

  // One picking session or typed hex is one undo step: ColorField calls onBeginChange
  // once (pushToHistory), and each live change runs batched so it never pushes again.
  const handleUniformColorChange = (color: string) => {
    if (!selectedObjectId) return;
    startBatch();
    selectedObject.vertices.forEach(v => {
      updateVertexColor(selectedObjectId, v.id, color);
    });
    endBatch();
  };

  const handlePresetGradient = (colors: string[]) => {
    if (!selectedObjectId) return;
    pushToHistory();
    startBatch();
    
    const numVertices = selectedObject.vertices.length;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    selectedObject.vertices.forEach(v => {
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    });

    const width = maxX - minX;
    const height = maxY - minY;
    
    const useY = width < 0.0001 && height > 0.0001;
    const range = useY ? height : width;

    selectedObject.vertices.forEach((v, i) => {
      let position = 0;
      if (range > 0.0001) {
         position = useY ? (v.y - minY) / range : (v.x - minX) / range;
      } else {
         position = numVertices > 1 ? i / (numVertices - 1) : 0;
      }
      const interpolatedColor = getGradientColor(colors, position);
      updateVertexColor(selectedObjectId, v.id, interpolatedColor);
    });
    endBatch();
  };

  const handleVertexColorStart = (vertexId: string) => {
    if (!activeColorChange) {
      pushToHistory();
      setActiveColorChange(vertexId);
    }
  };

  const handleVertexColorChange = (vertexId: string, color: string) => {
    if (!selectedObjectId) return;
    startBatch();
    updateVertexColor(selectedObjectId, vertexId, color);
    endBatch();
  };

  const handleVertexColorEnd = () => {
    setActiveColorChange(null);
  };

  const glCall = objColorMode === 'BYTE' ? 'glColor3ub' : 'glColor3f';

  return (
    <CollapsibleSection panelId="appearance-panel" title="Color & Shading" icon={<Palette size={14} />} defaultOpen={true}>
      <div className="color-section">

        {/* Emission Mode Toggle */}
        <div className="emission-mode">
          <div className="emission-label">
            <span>Emission</span>
            <span className="emission-hint">
              {objColorMode === 'FLOAT' ? 'glColor3f · 0.0–1.0' : 'glColor3ub · 0–255'}
            </span>
          </div>
          <SegmentedControl
            label="Color emission"
            mono
            options={EMISSION_OPTIONS}
            value={objColorMode === 'BYTE' ? '3ub' : '3f'}
            onChange={(value) => updateObjectColorMode(selectedObject.id, EMISSION_TO_MODE[value])}
          />
        </div>

        {/* Color Mode Toggle */}
        {supportsPerVertexColor && (
          <div className="color-mode-section" ref={toggleContainerRef}>
            <div className="mode-label">
              <span>Color Mode</span>
              <span className="mode-hint">
                {colorMode === 'OBJECT' ? 'Solid Fill' : 'Barycentric Gradient'}
              </span>
            </div>
            <SegmentedControl
              label="Color application mode"
              options={APPLICATION_OPTIONS}
              value={colorMode}
              onChange={switchColorMode}
            />
          </div>
        )}

        {/* Color Controls */}
        {colorMode === 'OBJECT' || !supportsPerVertexColor ? (
          <div className="vertex-color-list">
            {supportsPerVertexColor && isMultiColor && (
              <div className="vertex-hint warning">
                Mixed colors detected. Selecting a color below will overwrite all vertex colors.
              </div>
            )}
            <ColorField
              label="Fill"
              glCall={glCall}
              value={selectedObject.vertices[0]?.color || '#ffffff'}
              onBeginChange={pushToHistory}
              onChange={handleUniformColorChange}
            />
          </div>
        ) : (
          selectedObject.vertices.length > 0 && (
            <div className="vertex-color-list">
              <div className="vertex-hint">
                Paint individual vertices to create smooth gradients and shading effects.
              </div>

              <div className="vertex-scroll-area">
                {selectedObject.vertices.map((vertex, idx) => (
                  <div key={vertex.id} className="vertex-color-row">
                    <ColorField
                      label={`Vertex ${idx}`}
                      showRecent={false}
                      glCall={glCall}
                      value={vertex.color}
                      onBeginChange={() => handleVertexColorStart(vertex.id)}
                      onChange={(color) => handleVertexColorChange(vertex.id, color)}
                      onCommit={handleVertexColorEnd}
                    />
                    <span className="vertex-coords">
                      ({vertex.x.toFixed(2)}, {vertex.y.toFixed(2)})
                    </span>
                  </div>
                ))}
              </div>

              <div className="gradient-presets">
                <div className="shading-header">Quick Gradients</div>
                <div className="preset-buttons">
                  {GRADIENT_PRESETS.map((preset) => (
                    <Button key={preset.label} variant="quiet" onClick={() => handlePresetGradient(preset.colors)}>
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </CollapsibleSection>
  );
}
