import { Library } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import { useMyScenesDialog } from '../model/dialog-store';

export default function MyScenesButton() {
  const appMode = useVamsStore((state) => state.appMode);
  const open = useMyScenesDialog((state) => state.open);
  if (appMode === 'Lesson') return null;
  return (
    <button type="button" className="icon-btn" onClick={open} title="My scenes" aria-label="My scenes">
      <Library size={16} aria-hidden />
    </button>
  );
}
