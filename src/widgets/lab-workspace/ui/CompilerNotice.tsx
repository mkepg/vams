import { useState } from 'react';
import { downloadingMessage, LAB_MESSAGES, COMPILER_DOWNLOAD_MB, useCompiler } from '@/features/lab-compile';
import { Button } from '@/shared/ui/controls';
import './compiler-notice.scss';

/** Where a dismissed notice is remembered, in this browser only. */
export const NOTICE_KEY = 'vams-lab-compiler-notice';

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(NOTICE_KEY) === 'dismissed';
  } catch {
    return false;
  }
}

/**
 * The compiler's download, above the code. Before the first download it offers Download now, and
 * can be dismissed; while the compiler downloads, from Run or from here, it shows the progress,
 * dismissed or not; after a failed download it offers the download again. Once the compiler is
 * in this browser it shows nothing.
 */
export default function CompilerNotice({ onDownload }: { onDownload: () => void }) {
  const { state, received, total } = useCompiler();
  const [dismissed, setDismissed] = useState(wasDismissed);

  if (state === 'downloading') {
    const done = total > 0 ? Math.min(COMPILER_DOWNLOAD_MB, (received / total) * COMPILER_DOWNLOAD_MB) : 0;
    return (
      <div className="compiler-notice compiler-notice--progress" role="status">
        <p className="compiler-notice__text">{downloadingMessage(received, total)}</p>
        <div
          className="compiler-notice__bar"
          role="progressbar"
          aria-label="Compiler download"
          aria-valuemin={0}
          aria-valuemax={COMPILER_DOWNLOAD_MB}
          aria-valuenow={Math.floor(done)}
          aria-valuetext={`${Math.floor(done)} of ${COMPILER_DOWNLOAD_MB} MB`}
        >
          <span className="compiler-notice__fill" style={{ width: `${(done / COMPILER_DOWNLOAD_MB) * 100}%` }} />
        </div>
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <div className="compiler-notice compiler-notice--failed" role="status">
        <p className="compiler-notice__text">{LAB_MESSAGES.download}</p>
        <Button variant="secondary" className="compiler-notice__download" onClick={onDownload}>
          {LAB_MESSAGES.downloadNow}
        </Button>
      </div>
    );
  }

  if (state !== 'absent' || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(NOTICE_KEY, 'dismissed');
    } catch {
      /* A browser that keeps nothing shows the notice again next time. */
    }
  };

  return (
    <div className="compiler-notice" role="region" aria-label="The compiler">
      <p className="compiler-notice__text">{LAB_MESSAGES.notice}</p>
      <Button variant="secondary" className="compiler-notice__download" onClick={onDownload}>
        {LAB_MESSAGES.downloadNow}
      </Button>
      <Button variant="quiet" className="compiler-notice__dismiss" iconOnly label="Dismiss" icon={<span aria-hidden="true">✕</span>} onClick={dismiss} />
    </div>
  );
}
