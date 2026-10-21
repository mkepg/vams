import './object-appearance-panel.scss';
import { useState, useEffect, useRef } from 'react';
import { Palette } from 'lucide-react';
import { useVamsStore } from "@/core/store";
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';
import { ColorField, SegmentedControl, type SegmentOption } from '@/shared/ui/controls';
import type { ColorMode } from '@/core/types/scene';
import BackgroundColorPanel from './BackgroundColorPanel';
import GradientPreview from './GradientPreview';
import { GRADIENT_PRESETS, gradientColours } from '../lib/gradient';

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

  const handlePresetGradient = (colors: readonly string[]) => {
    if (!selectedObjectId) return;
    pushToHistory();
    startBatch();
    const painted = gradientColours(selectedObject.vertices, colors);
    selectedObject.vertices.forEach((v, i) => updateVertexColor(selectedObjectId, v.id, painted[i]));
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
                      label={`Vertex ${idx + 1}`}
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
                    <button
                      key={preset.label}
                      type="button"
                      className="gradient-preview"
                      aria-label={preset.label}
                      onClick={() => handlePresetGradient(preset.colors)}
                    >
                      <GradientPreview vertices={selectedObject.vertices} type={selectedObject.type} colors={preset.colors} />
                      <span className="gradient-preview__label" aria-hidden="true">{preset.label}</span>
                    </button>
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
