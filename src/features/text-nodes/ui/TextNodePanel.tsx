import './text-node-panel.scss';
import { useState } from 'react';
import { Type, Plus, Edit3 } from 'lucide-react';
import { useVamsStore } from "@/core/store";
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';
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
    <CollapsibleSection title="Create Text" icon={<Type size={14} />} defaultOpen={true}>
      <div className="text-objects-section">
        {/* Creation Input */}
        <div>
          {/* --- FIX APPLIED HERE --- */}
          <div className="section-label">Create New Text</div>
          <div className="input-group">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.currentTarget.value)}
              placeholder="Enter text..."
              onKeyDown={(e) => e.key === 'Enter' && handleAddText()}
              className="text-input"
            />
            <button
              onClick={handleAddText}
              disabled={!textInput.trim()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.4rem',
                backgroundColor: 'rgba(var(--accent-blue-rgb), 0.1)',
                color: 'var(--accent-blue-text)',
                border: '1px solid rgba(var(--accent-blue-rgb), 0.3)',
                borderRadius: '4px',
                cursor: 'pointer',
                opacity: !textInput.trim() ? 0.5 : 1
              }}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
        {}
        {isTextSelected && (
          <div className="edit-panel" style={{
            padding: '0.75rem',
            backgroundColor: 'rgba(var(--accent-blue-rgb), 0.05)',
            border: '1px solid rgba(var(--accent-blue-rgb), 0.2)',
            borderRadius: '6px',
            marginTop: '0.5rem'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem',
              color: 'var(--accent-blue-text)',
              fontSize: '0.8rem',
              fontWeight: 600
            }}>
              <Edit3 size={14} />
              <span>Edit Selected Text</span>
            </div>
            <textarea
              value={selectedObject?.textContent || ''}
              onChange={(e) => {
                if (selectedObjectId) {
                  updateTextContent(selectedObjectId, e.currentTarget.value);
                }
              }}
              className="text-input edit-textarea"
              rows={3}
            />
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}