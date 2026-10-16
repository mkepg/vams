import './share.scss';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useVamsStore } from '@/core/store';
import { buildProjectFile, createDefaultProjectFilename, downloadJSON } from '@/entities/project/model/project-io';
import { qrPngBlob, qrSvg } from '@/shared/lib/qr';
import { slugify } from '@/shared/lib/slug';
import { Button, Dialog } from '@/shared/ui/controls';
import QrCode from '@/shared/ui/qr/QrCode';
import { copyLink } from '../model/copy-link';
import { useShareDialog } from '../model/dialog-store';
import { prepareShare, type ShareResult } from '../model/share-flow';

const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function Note({ tone, children }: { tone: 'ok' | 'warn'; children: string }) {
  return (
    <p className={`share-dialog__note is-${tone}`}>
      <span className="share-dialog__dot" aria-hidden="true" />
      {children}
    </p>
  );
}

/** The link, its notes and the QR code for one result. Exported for tests. */
export function ShareResultView({ result, onSaveFile }: { result: ShareResult; onSaveFile: () => void }) {
  if (result.kind === 'failed') {
    return (
      <div className="share-dialog__failed">
        <p>Couldn’t make a link right now.</p>
        <Button variant="primary" onClick={onSaveFile}>Save project file</Button>
      </div>
    );
  }
  const download = () =>
    qrPngBlob(qrSvg(result.url)).then(
      (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${slugify(result.kind === 'lesson' ? result.title : useVamsStore.getState().sceneName)}-qr.png`;
        a.click();
        URL.revokeObjectURL(url);
      },
      () => void toast.error('Couldn’t make the QR image.'),
    );
  return (
    <div className="share-dialog__body">
      <div className="share-dialog__main">
        <div className="share-dialog__field">
          <input className="share-dialog__link" readOnly value={result.url} aria-label="Link" onFocus={(e) => e.currentTarget.select()} />
          <Button variant="primary" onClick={() => void copyLink(result.url)}>Copy link</Button>
        </div>
        {result.kind === 'carried' && <Note tone="ok">This link carries your scene and never expires.</Note>}
        {result.kind === 'stored' && <Note tone="ok">{`Stored for 90 days, until ${date(result.expiresAt)}.`}</Note>}
        {result.kind === 'stored' && result.shrunk > 0 && (
          <Note tone="warn">{result.shrunk === 1 ? 'Your uploaded image is shared at 512 px.' : 'Your uploaded images are shared at 512 px.'}</Note>
        )}
        {result.kind === 'fallback' && <Note tone="warn">Your uploaded images are left out.</Note>}
        {result.kind === 'lesson' && <Note tone="ok">Anyone with the link opens this lesson.</Note>}
      </div>
      <div className="share-dialog__qr">
        <QrCode text={result.url} label="QR code for this link" />
        <button type="button" className="share-dialog__textlink" onClick={() => void download()}>Download QR</button>
      </div>
    </div>
  );
}

function saveFile() {
  try {
    downloadJSON(createDefaultProjectFilename(), buildProjectFile(useVamsStore.getState()));
    toast.success('Project saved');
  } catch (error) {
    console.error(error);
    toast.error('Failed to save project');
  }
}

/** Mounted only while the dialog is open, so its result starts empty each time. */
function ShareDialogBody({ lessonTitle }: { lessonTitle: string | null }) {
  const close = useShareDialog((s) => s.close);
  const titleId = useId();
  const doneRef = useRef<HTMLButtonElement>(null);
  const [result, setResult] = useState<ShareResult | null>(null);
  const sceneName = useVamsStore((s) => s.sceneName);
  const lessonId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.activeLessonId : null));

  useEffect(() => {
    let live = true;
    const s = useVamsStore.getState();
    prepareShare({
      sceneName: s.sceneName,
      objects: s.objects,
      callbacks: s.callbacks,
      viewportLimits: s.viewportLimits,
      canvasBackgroundColor: s.canvasBackgroundColor,
      textures: s.getAllTextures(),
      lesson: lessonId ? { id: lessonId, title: lessonTitle ?? '' } : null,
    })
      .catch((): ShareResult => ({ kind: 'failed' }))
      .then((r) => {
        if (live) setResult(r);
      });
    return () => {
      live = false;
    };
  }, [lessonId, lessonTitle]);

  return (
    <Dialog open onClose={close} labelledBy={titleId} size="md" className="share-dialog" initialFocusRef={doneRef}>
      <h2 id={titleId}>{lessonId ? 'Share this lesson' : `Share ‘${sceneName}’`}</h2>
      <p className="share-dialog__lead">
        {lessonId ? 'Anyone with the link opens this lesson.' : 'Anyone with the link opens a copy of this scene. On a phone it opens as a view.'}
      </p>
      {result ? (
        <ShareResultView result={result} onSaveFile={saveFile} />
      ) : (
        <div className="share-dialog__field">
          <input className="share-dialog__link" readOnly value="Making your link…" aria-label="Link" />
          <Button variant="primary" disabled>Copy link</Button>
        </div>
      )}
      <div className="share-dialog__foot">
        {!lessonId && result?.kind !== 'failed' ? (
          <button type="button" className="share-dialog__textlink" onClick={saveFile}>Save project file instead</button>
        ) : (
          <span />
        )}
        <Button ref={doneRef} onClick={close}>Done</Button>
      </div>
    </Dialog>
  );
}

export default function ShareDialog({ lessonTitle }: { lessonTitle: string | null }) {
  const open = useShareDialog((s) => s.open);
  return open ? <ShareDialogBody lessonTitle={lessonTitle} /> : null;
}
