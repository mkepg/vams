import './text-node-panel.scss';
import { useState } from 'react';
import { Type, Plus, Edit3 } from 'lucide-react';
import { useVamsStore } from "@/core/store";
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';
import { Button } from '@/shared/ui/controls';
export default function TextNodePanel() {
  const {
    addTextObject,
    objects,
    selectedObjectId,
    updateTextContent
  } = useVamsStore();
  const [textInput, setTextInput] = useState('');
  const selectedObject = objects.find(o => o.id === selectedObjectId);
  const isTextSelected = selectedObject?.type === 'TEXT';
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
        {isTextSelected && (
          <div className="text-edit">
            <span className="vfield-label text-edit__label">
              <Edit3 size={14} aria-hidden="true" />
              <span>Edit Selected Text</span>
            </span>
            <textarea
              value={selectedObject?.textContent || ''}
              aria-label="Edit text"
              onChange={(e) => {
                if (selectedObjectId) {
                  updateTextContent(selectedObjectId, e.currentTarget.value);
                }
              }}
              className="vfield-input text-edit__area"
              rows={3}
            />
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
