import './scene-view.scss';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { useVamsStore } from '@/core/store';
import { copyLink, resolveSharedScene, SHARE_MESSAGES } from '@/features/share';
import { loadProjectData } from '@/features/scene-library';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import ThemeToggleButton from '@/features/theme-toggle/ui/ThemeToggleButton';
import { CanvasWindow } from '@/shared/ui/floating-window';
import VamsCanvas from '@/widgets/canvas/VamsCanvas';
import CodeViewer from '@/shared/ui/code-viewer/CodeViewer';
import { Button, SegmentedControl } from '@/shared/ui/controls';
import Logo from '@/shared/ui/logo';
import { useCanvasSize } from '@/shared/lib/use-canvas-size';
import { getActiveTheme, subscribeTheme, toEditorTheme, useSiteTheme } from '@/shared/lib/theme';
import { getPreset } from '@/entities/project/model/scene-presets';
import { LESSON_CATALOG } from '@/features/lesson-engine/model/catalog';
import { editorAnywayUrl, parseShareLink } from '../model/share-link';

type Pane = 'scene' | 'code';
type ViewState =
  | { status: 'loading' }
  | { status: 'ready'; name: string }
  | { status: 'error'; message: string }
  | { status: 'intro'; name: string; detail: string | null };

/** What this address opens on a phone: a shared or prepared scene, or the editor itself. */
function initialView(): ViewState {
  const { pathname, search, hash } = window.location;
  const params = new URLSearchParams(search);
  if (parseShareLink(pathname, hash) || getPreset(params.get('scene') ?? '')) return { status: 'loading' };
  const lesson = LESSON_CATALOG.find((entry) => entry.id === params.get('lesson'));
  if (!lesson) return { status: 'intro', name: 'The VAMS editor', detail: null };
  const kind = lesson.type === 'demo' ? 'Demo' : 'Exercise';
  return { status: 'intro', name: lesson.title, detail: `${kind} · ${lesson.section} · ${lesson.steps} steps` };
}

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
  const [view, setView] = useState<ViewState>(initialView);
  const [pane, setPane] = useState<Pane>('scene');
  const theme = useSiteTheme();

  useEffect(() => {
    const mirror = (next: Parameters<typeof toEditorTheme>[0]) => useVamsStore.setState({ theme: toEditorTheme(next) });
    mirror(getActiveTheme());
    return subscribeTheme(mirror);
  }, []);

  useEffect(() => {
    const link = parseShareLink(window.location.pathname, window.location.hash);
    if (!link) {
      // A prepared scene is bundled with the page, so it opens at once.
      const preset = getPreset(new URLSearchParams(window.location.search).get('scene') ?? '');
      if (!preset) return;
      loadProjectData(preset.data, { sceneId: '', sceneName: preset.title });
      useVamsStore.setState({ selectedObjectId: null, appMode: 'Author', activeLessonId: null });
      // The scene goes into the store first, so the view switches to it only once it is there.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView({ status: 'ready', name: preset.title });
      return;
    }
    void resolveSharedScene(link)
      .then((r) => {
        if (!r.ok) {
          // Lab work: the page is loading the Lab, so the view goes on opening until it goes.
          if ('message' in r) setView({ status: 'error', message: r.message });
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
        <h1 className="scene-view__name">{view.status === 'ready' || view.status === 'intro' ? view.name : 'Shared scene'}</h1>
        <ThemeToggleButton className="vbtn vbtn--quiet vbtn--md vbtn--icon" />
      </header>
      {view.status === 'error' && <p className="scene-view__error" role="alert">{view.message}</p>}
      {view.status === 'loading' && <p className="scene-view__note" role="status">Opening the scene…</p>}
      {view.status === 'intro' && (
        <div className="scene-view__intro">
          {view.detail && <p className="scene-view__detail">{view.detail}</p>}
          <p>The editor opens in a window at least 960 pixels wide, on a laptop or a desktop.</p>
          <p>
            On this phone, the <a href="/gallery">gallery</a> scenes open to look at, and the{' '}
            <a href="/learn">lessons</a> and the <a href="/guide">guide</a> read as they do anywhere.
          </p>
        </div>
      )}
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
