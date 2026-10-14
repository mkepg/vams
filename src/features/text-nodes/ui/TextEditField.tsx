import './text-node-panel.scss';
import { Edit3 } from 'lucide-react';
import { useVamsStore } from '@/core/store';

/** The selected text object's text. Renders nothing for other objects. */
export default function TextEditField() {
  const selected = useVamsStore((s) => s.objects.find((o) => o.id === s.selectedObjectId) ?? null);
  const updateTextContent = useVamsStore((s) => s.updateTextContent);
  if (selected?.type !== 'TEXT') return null;
  return (
    <div className="text-edit">
      <span className="vfield-label text-edit__label">
        <Edit3 size={14} aria-hidden="true" />
        <span>Edit Selected Text</span>
      </span>
      <textarea
        value={selected.textContent || ''}
        aria-label="Edit text"
        onChange={(e) => updateTextContent(selected.id, e.currentTarget.value)}
        className="vfield-input text-edit__area"
        rows={3}
      />
    </div>
  );
}
