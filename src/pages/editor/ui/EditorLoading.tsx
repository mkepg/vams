import { VertexMark } from '@/shared/ui/logo';
import './editor-loading.scss';

export default function EditorLoading() {
  return (
    <div className="editor-loading" role="status" aria-live="polite">
      <VertexMark size={56} />
      <p className="editor-loading__label">Loading the editor…</p>
    </div>
  );
}
