import './share.scss';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { qrPngBlob, qrSvg } from '@/shared/lib/qr';
import { slugify } from '@/shared/lib/slug';
import { Button, Dialog } from '@/shared/ui/controls';
import QrCode from '@/shared/ui/qr/QrCode';
import { copyLink } from '../model/copy-link';
import { useShareDialog } from '../model/dialog-store';
import type { ShareResult } from '../model/share-flow';

const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function Note({ tone, children }: { tone: 'ok' | 'warn'; children: string }) {
  return (
    <p className={`share-dialog__note is-${tone}`}>
      <span className="share-dialog__dot" aria-hidden="true" />
      {children}
    </p>
  );
}

export interface ResultBodyProps {
  result: ShareResult;
  onSaveFile: () => void;
  /** The save button's label when there is no link. */
  saveLabel: string;
  /** The QR image's name, before -qr.png, for a link that isn't a lesson's. */
  qrName: () => string;
}

/** The link, its notes and the QR code for one result. The editor and the Lab share it. */
export function ShareResultBody({ result, onSaveFile, saveLabel, qrName }: ResultBodyProps) {
  if (result.kind === 'failed' || result.kind === 'over-limit') {
    return (
      <div className="share-dialog__failed">
        <p>{result.kind === 'failed' ? 'Couldn’t make a link right now.' : result.message}</p>
        <Button variant="primary" onClick={onSaveFile}>{saveLabel}</Button>
      </div>
    );
  }
  const download = () =>
    qrPngBlob(qrSvg(result.url)).then(
      (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${slugify(result.kind === 'lesson' ? result.title : qrName())}-qr.png`;
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
        {result.kind === 'carried' && <Note tone="ok">Couldn’t store it right now, so this link carries your scene instead. It never expires.</Note>}
        {result.kind === 'stored' && <Note tone="ok">{`Stored for 90 days, until ${date(result.expiresAt)}.`}</Note>}
        {result.kind === 'stored' && result.shrunk > 0 && (
          <Note tone="warn">{result.shrunk === 1 ? 'Your uploaded image is shared at 512 px.' : 'Your uploaded images are shared at 512 px.'}</Note>
        )}
        {result.kind === 'fallback' && <Note tone="warn">Couldn’t store your uploaded images, so this link leaves them out.</Note>}
        {result.kind === 'lesson' && <Note tone="ok">Anyone with the link opens this lesson.</Note>}
      </div>
      <div className="share-dialog__qr">
        <QrCode text={result.url} label="QR code for this link" />
        <button type="button" className="share-dialog__textlink" onClick={() => void download()}>Download QR</button>
      </div>
    </div>
  );
}

export interface ShareDialogFrameProps extends Omit<ResultBodyProps, 'result'> {
  title: string;
  /** Who can open the link, under the title; null leaves it out. */
  lead: string | null;
  /** Makes the link. It runs when the dialog opens, and again when prepareKey changes. */
  prepare: () => Promise<ShareResult>;
  prepareKey: string;
  /** The foot's save link beside Done; null leaves it out. */
  saveInsteadLabel: string | null;
}

/** The Share dialog: the title, the lead, the link once it is made, and the foot. Mounted only while open. */
export function ShareDialogFrame({ title, lead, prepare, prepareKey, saveInsteadLabel, onSaveFile, saveLabel, qrName }: ShareDialogFrameProps) {
  const close = useShareDialog((s) => s.close);
  const titleId = useId();
  const doneRef = useRef<HTMLButtonElement>(null);
  const [result, setResult] = useState<ShareResult | null>(null);
  // The newest prepare, read when the key changes.
  const prepareRef = useRef(prepare);
  useLayoutEffect(() => {
    prepareRef.current = prepare;
  });

  useEffect(() => {
    let live = true;
    prepareRef
      .current()
      .catch((): ShareResult => ({ kind: 'failed' }))
      .then((r) => {
        if (live) setResult(r);
      });
    return () => {
      live = false;
    };
  }, [prepareKey]);

  const noLink = result?.kind === 'failed' || result?.kind === 'over-limit';
  return (
    <Dialog open onClose={close} labelledBy={titleId} size="md" className="share-dialog" initialFocusRef={doneRef}>
      <h2 id={titleId}>{title}</h2>
      {lead && <p className="share-dialog__lead">{lead}</p>}
      {result ? (
        <ShareResultBody result={result} onSaveFile={onSaveFile} saveLabel={saveLabel} qrName={qrName} />
      ) : (
        <div className="share-dialog__field">
          <input className="share-dialog__link" readOnly value="Making your link…" aria-label="Link" />
          <Button variant="primary" disabled>Copy link</Button>
        </div>
      )}
      <div className="share-dialog__foot">
        {saveInsteadLabel && !noLink ? (
          <button type="button" className="share-dialog__textlink" onClick={onSaveFile}>{saveInsteadLabel}</button>
        ) : (
          <span />
        )}
        <Button ref={doneRef} onClick={close}>Done</Button>
      </div>
    </Dialog>
  );
}
