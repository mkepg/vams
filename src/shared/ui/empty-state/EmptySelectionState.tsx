import { MousePointerClick } from 'lucide-react';

interface EmptySelectionStateProps {
  title?: string;
  message: string;
}

/**
 * Stable placeholder shown where a selection-dependent panel would otherwise
 * unmount, so the layout explains itself instead of silently collapsing.
 */
export default function EmptySelectionState({
  title = 'No object selected',
  message,
}: EmptySelectionStateProps) {
  return (
    <div className="empty-selection-state">
      <MousePointerClick size={28} className="empty-icon" aria-hidden />
      <h4>{title}</h4>
      <p>{message}</p>
    </div>
  );
}
