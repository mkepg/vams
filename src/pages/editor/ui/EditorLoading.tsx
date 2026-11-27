import Logo from '@/shared/ui/logo';
import ToolSwitch from '@/shared/ui/tool-switch';
import './editor-loading.scss';

/**
 * The editor's top bar as it first paints, the wordmark and the Editor | Lab switch where the editor
 * puts them, above a page that says the editor is loading. Coming from the Lab, the bar holds still
 * and only the page below it changes.
 */
export default function EditorLoading() {
  return (
    <div className="editor-loading">
      <header className="editor-loading__bar">
        <a className="editor-loading__home" href="/" aria-label="VAMS home">
          <Logo />
        </a>
        <ToolSwitch current="editor" />
      </header>
      <p className="editor-loading__label" role="status" aria-live="polite">
        Loading the editor…
      </p>
    </div>
  );
}
