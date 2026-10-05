import { useEffect, useRef, useState } from 'react';
import './recovery-screen.scss';

export interface RecoveryActions {
  reload(): void;
  download(): void;
  startFresh(): Promise<void>;
}

interface Props {
  error: Error;
  actions: RecoveryActions;
}

export default function RecoveryScreen({ error, actions }: Props) {
  const [busy, setBusy] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const startFresh = async () => {
    setBusy(true);
    try {
      await actions.startFresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="recovery" aria-labelledby="recovery-title">
      <div className="recovery__panel">
        <h1 id="recovery-title" className="recovery__title" ref={headingRef} tabIndex={-1}>
          VAMS hit a problem
        </h1>
        <p className="recovery__lead">Your work is still on this device. Choose what to do next.</p>
        <div className="recovery__actions">
          <button type="button" className="recovery__btn recovery__btn--primary" onClick={actions.reload}>
            Reload
          </button>
          <button type="button" className="recovery__btn" onClick={actions.download}>
            Download my work
          </button>
          <button type="button" className="recovery__btn" disabled={busy} onClick={() => void startFresh()}>
            Start fresh
          </button>
        </div>
        <p className="recovery__hint">Start fresh keeps a copy of your scene in My scenes, then opens an empty editor.</p>
        <details className="recovery__details">
          <summary>Technical details</summary>
          <pre>{error.message || String(error)}</pre>
        </details>
      </div>
    </main>
  );
}
