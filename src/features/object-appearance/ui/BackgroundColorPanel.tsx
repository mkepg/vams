import './object-appearance-panel.scss';
import { Palette } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';
import { ColorField } from '@/shared/ui/controls';

/** The scene's clear colour (glClearColor). It never reads the selection. */
export default function BackgroundColorPanel() {
  const canvasBackgroundColor = useVamsStore((s) => s.canvasBackgroundColor);
  const setCanvasBackgroundColor = useVamsStore((s) => s.setCanvasBackgroundColor);
  return (
    <CollapsibleSection panelId="appearance-panel" title="Scene Color" icon={<Palette size={14} />} defaultOpen={true}>
      <div className="canvas-color-control" title="Change Canvas Background">
        <ColorField
          label="Background"
          glCall="glClearColor"
          value={canvasBackgroundColor}
          onChange={setCanvasBackgroundColor}
        />
      </div>
    </CollapsibleSection>
  );
}
