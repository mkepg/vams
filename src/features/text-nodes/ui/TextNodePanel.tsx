import './text-node-panel.scss';
import { useState } from 'react';
import { Type, Plus } from 'lucide-react';
import { useVamsStore } from "@/core/store";
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';
import { Button } from '@/shared/ui/controls';
import TextEditField from './TextEditField';
export default function TextNodePanel() {
  const addTextObject = useVamsStore((s) => s.addTextObject);
  const [textInput, setTextInput] = useState('');
  const handleAddText = () => {
    if (!textInput.trim()) return;
    addTextObject(textInput, 0, 0);
    setTextInput('');
  };
  return (
    <CollapsibleSection panelId="text-node-panel" title="Create Text" icon={<Type size={14} />} defaultOpen={true}>
      <div className="text-objects-section">
        <div className="text-create">
          <span className="vfield-label">Create New Text</span>
          <div className="text-create__row">
            <input
              type="text"
              value={textInput}
              aria-label="Text"
              onChange={(e) => setTextInput(e.currentTarget.value)}
              placeholder="Enter text..."
              onKeyDown={(e) => e.key === 'Enter' && handleAddText()}
              className="vfield-input"
            />
            <Button
              iconOnly
              label="Add text"
              icon={<Plus size={16} />}
              onClick={handleAddText}
              disabled={!textInput.trim()}
            />
          </div>
        </div>
        <TextEditField />
      </div>
    </CollapsibleSection>
  );
}
