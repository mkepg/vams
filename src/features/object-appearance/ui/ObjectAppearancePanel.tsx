import './object-appearance-panel.scss';
import { useState, useEffect, useRef } from 'react';
import { Palette, Hash, CircleDashed, Paintbrush, Waypoints } from 'lucide-react';
import { useVamsStore } from "@/core/store";
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';

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
    canvasBackgroundColor,
    setCanvasBackgroundColor,
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

  if (!selectedObject) {
    return (
      <CollapsibleSection panelId="appearance-panel" title="Scene Color" icon={<Palette size={14} />} defaultOpen={true}>
        <div className="canvas-color-control">
           <div className="property-row">
              <div className="label-group">
                <span className="label">Background</span>
                <span className="sub-label">Canvas Color</span>
              </div>
              <input
                type="color"
                value={canvasBackgroundColor}
                onChange={(e) => setCanvasBackgroundColor(e.currentTarget.value)}
                className="color-preview-input"
                title="Change Canvas Background"
              />
           </div>
        </div>
      </CollapsibleSection>
    );
  }

  if (selectedObject.type === 'GROUP') return null;

  const supportsPerVertexColor = selectedObject.vertices.length >= 2;
  const objColorMode = selectedObject.colorMode ?? 'FLOAT';

  const handleUniformColorChange = (color: string) => {
    if (!selectedObjectId) return;
    pushToHistory();
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
          <div className="emission-toggle" role="radiogroup" aria-label="Color emission mode">
            <button
              type="button"
              className={objColorMode === 'FLOAT' ? 'active' : ''}
              onClick={() => updateObjectColorMode(selectedObject.id, 'FLOAT')}
              role="radio"
              aria-checked={objColorMode === 'FLOAT'}
              title="Emit colors as glColor3f (normalized 0.0–1.0)"
            >
              <CircleDashed size={12} />
              <span>Float</span>
            </button>
            <button
              type="button"
              className={objColorMode === 'BYTE' ? 'active' : ''}
              onClick={() => updateObjectColorMode(selectedObject.id, 'BYTE')}
              role="radio"
              aria-checked={objColorMode === 'BYTE'}
              title="Emit colors as glColor3ub (integer 0–255)"
            >
              <Hash size={12} />
              <span>Byte</span>
            </button>
          </div>
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
            <div className="mode-toggle" role="radiogroup" aria-label="Color application mode">
              <button
                type="button"
                className={colorMode === 'OBJECT' ? 'active' : ''}
                onClick={() => switchColorMode('OBJECT')}
                role="radio"
                aria-checked={colorMode === 'OBJECT'}
                title="Apply one uniform color to the entire object"
              >
                <Paintbrush size={12} />
                <span>Uniform</span>
              </button>
              <button
                type="button"
                className={colorMode === 'VERTEX' ? 'active' : ''}
                onClick={() => switchColorMode('VERTEX')}
                role="radio"
                aria-checked={colorMode === 'VERTEX'}
                title="Paint individual vertices for interpolated gradients"
              >
                <Waypoints size={12} />
                <span>Per Vertex</span>
              </button>
            </div>
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
            <div className="property-row">
              <div className="label-group">
                <span className="vertex-label">FILL</span>
                <span className="vertex-coords">
                  {supportsPerVertexColor ? 'Apply to Object' : 'Uniform Color'}
                </span>
              </div>
              <input
                type="color"
                value={selectedObject.vertices[0]?.color || '#ffffff'}
                onChange={(e) => handleUniformColorChange(e.currentTarget.value)}
                className="color-preview-input"
              />
            </div>
          </div>
        ) : (
          selectedObject.vertices.length > 0 && (
            <div className="vertex-color-list">
              <div className="vertex-hint">
                Paint individual vertices to create smooth gradients and shading effects.
              </div>
              
              <div className="vertex-scroll-area">
                {selectedObject.vertices.map((vertex, idx) => (
                  <div key={vertex.id} className="property-row">
                    <div className="label-group">
                      <span className="vertex-label">V{idx}</span>
                      <span className="vertex-coords">
                        ({vertex.x.toFixed(2)}, {vertex.y.toFixed(2)})
                      </span>
                    </div>
                    <input
                      type="color"
                      value={vertex.color}
                      onFocus={() => handleVertexColorStart(vertex.id)}
                      onChange={(e) => handleVertexColorChange(vertex.id, e.currentTarget.value)}
                      onBlur={handleVertexColorEnd}
                      className="color-preview-input"
                    />
                  </div>
                ))}
              </div>

              <div className="gradient-presets">
                <div className="shading-header" style={{ marginTop: '12px' }}>Quick Gradients</div>
                <div className="preset-buttons">
                  <button className="preset-btn" onClick={() => handlePresetGradient(['#ff0000', '#0000ff'])}>Red → Blue</button>
                  <button className="preset-btn" onClick={() => handlePresetGradient(['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff'])}>Rainbow</button>
                  <button className="preset-btn" onClick={() => handlePresetGradient(['#ff6b35', '#f7931e', '#fdc500'])}>Warm</button>
                  <button className="preset-btn" onClick={() => handlePresetGradient(['#667eea', '#764ba2', '#f093fb'])}>Cool</button>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </CollapsibleSection>
  );
}