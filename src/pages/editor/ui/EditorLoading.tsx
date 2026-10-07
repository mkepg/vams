import Logo from '@/shared/ui/logo';
import './editor-loading.scss';

export default function EditorLoading() {
  return (
    <div className="editor-loading" role="status" aria-live="polite">
      <Logo className="editor-loading__logo" />
      <p className="editor-loading__label">Loading the editor…</p>
    </div>
  );
}
