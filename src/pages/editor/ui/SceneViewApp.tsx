import './scene-view.scss';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { useVamsStore } from '@/core/store';
import { copyLink, resolveSharedScene, SHARE_MESSAGES } from '@/features/share';
import { loadProjectData } from '@/features/scene-library';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import ThemeToggleButton from '@/features/theme-toggle/ui/ThemeToggleButton';
import CanvasWindow from '@/widgets/canvas/ui/CanvasWindow';
import VamsCanvas from '@/widgets/canvas/VamsCanvas';
import CodeViewer from '@/shared/ui/code-viewer/CodeViewer';
import { Button, SegmentedControl } from '@/shared/ui/controls';
import Logo from '@/shared/ui/logo';
import { useCanvasSize } from '@/shared/lib/use-canvas-size';
import { getActiveTheme, subscribeTheme, toEditorTheme, useSiteTheme } from '@/shared/lib/theme';
import { editorAnywayUrl, parseShareLink } from '../model/share-link';

type Pane = 'scene' | 'code';
type ViewState = { status: 'loading' } | { status: 'ready'; name: string } | { status: 'error'; message: string };

/** A full page load, so the editor starts from the visitor's own saved scene. */
const goTo = (href: string) => (event: { preventDefault: () => void }) => {
  event.preventDefault();
  window.location.assign(href);
};

/** The scene and its code. Mounted only once the shared scene is loaded, so the visitor's own scene never shows. */
function SharedScene({ pane }: { pane: Pane }) {
  const size = useCanvasSize();
  const objects = useVamsStore((s) => s.objects);
  const callbacks = useVamsStore((s) => s.callbacks);
  const viewportLimits = useVamsStore((s) => s.viewportLimits);
  const background = useVamsStore((s) => s.canvasBackgroundColor);
  const code = generateCodeFromState({ objects, canvasBackgroundColor: background, callbacks, viewportLimits, textures: useVamsStore.getState().getAllTextures() }, size);
  return (
    <div className="scene-view__panes">
      <div className={`scene-view__window${pane === 'scene' ? '' : ' scene-view__window--away'}`}>
        <CanvasWindow size={size} running={false}>
          <VamsCanvas readOnly />
        </CanvasWindow>
      </div>
      <div className="scene-view__code" hidden={pane !== 'code'}>
        <CodeViewer code={code} />
      </div>
    </div>
  );
}

export default function SceneViewApp() {
  const [view, setView] = useState<ViewState>(() => {
    return parseShareLink(window.location.pathname, window.location.hash)
      ? { status: 'loading' }
      : { status: 'error', message: SHARE_MESSAGES.damaged };
  });
  const [pane, setPane] = useState<Pane>('scene');
  const theme = useSiteTheme();

  useEffect(() => {
    const mirror = (next: Parameters<typeof toEditorTheme>[0]) => useVamsStore.setState({ theme: toEditorTheme(next) });
    mirror(getActiveTheme());
    return subscribeTheme(mirror);
  }, []);

  useEffect(() => {
    const link = parseShareLink(window.location.pathname, window.location.hash);
    if (!link) return;
    void resolveSharedScene(link)
      .then((r) => {
        if (!r.ok) {
          setView({ status: 'error', message: r.message });
          return;
        }
        loadProjectData(r.scene.data, { sceneId: '', sceneName: r.scene.name });
        useVamsStore.setState({ selectedObjectId: null, appMode: 'Author', activeLessonId: null });
        setView({ status: 'ready', name: r.scene.name });
      })
      .catch(() => setView({ status: 'error', message: SHARE_MESSAGES.unavailable }));
  }, []);

  const anyway = editorAnywayUrl(window.location);

  return (
    <div className="scene-view">
      <header className="scene-view__top">
        <a className="scene-view__home" href="/" aria-label="VAMS home" onClick={goTo('/')}>
          <Logo />
        </a>
        <h1 className="scene-view__name">{view.status === 'ready' ? view.name : 'Shared scene'}</h1>
        <ThemeToggleButton className="vbtn vbtn--quiet vbtn--md vbtn--icon" />
      </header>
      {view.status === 'error' && <p className="scene-view__error" role="alert">{view.message}</p>}
      {view.status === 'loading' && <p className="scene-view__note" role="status">Opening the scene…</p>}
      {view.status === 'ready' && (
        <>
          <SegmentedControl
            label="Show"
            value={pane}
            onChange={setPane}
            options={[{ value: 'scene', label: 'Scene' }, { value: 'code', label: 'Code' }]}
          />
          <SharedScene pane={pane} />
        </>
      )}
      <p className="scene-view__note">Editing needs a computer. Open this link there.</p>
      <div className="scene-view__actions">
        <Button variant="primary" onClick={() => void copyLink(window.location.href)}>Copy link</Button>
        <a className="scene-view__anyway" href={anyway} onClick={goTo(anyway)}>Open in the editor anyway</a>
      </div>
      <Toaster position="bottom-center" theme={theme} />
    </div>
  );
}
