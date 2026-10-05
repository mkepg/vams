import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { registerServiceWorker, type ApplyUpdate, type ServiceWorkerEvents } from './register';
import './update-notice.scss';

type Notice = 'none' | 'update' | 'offline-ready';

function subscribeStage(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

const isPresenting = () => typeof document !== 'undefined' && document.documentElement.classList.contains('stage');

interface Props {
  register?: (events: ServiceWorkerEvents) => Promise<ApplyUpdate | null>;
  offlineNoticeMs?: number;
}

/** Tells the user when VAMS works offline and when a new version is waiting. Silent while presenting. */
export default function UpdateNotice({ register = registerServiceWorker, offlineNoticeMs = 6000 }: Props) {
  const [notice, setNotice] = useState<Notice>('none');
  const applyRef = useRef<ApplyUpdate | null>(null);
  const presenting = useSyncExternalStore(subscribeStage, isPresenting);

  useEffect(() => {
    let live = true;
    register({
      onNeedRefresh: () => {
        if (live) setNotice('update');
      },
      onOfflineReady: () => {
        if (live) setNotice('offline-ready');
      },
    })
      .then((apply) => {
        applyRef.current = apply;
      })
      .catch((error) => console.error('Service worker registration failed', error));
    return () => {
      live = false;
    };
  }, [register]);

  useEffect(() => {
    if (notice !== 'offline-ready' || presenting) return;
    const timer = setTimeout(() => setNotice('none'), offlineNoticeMs);
    return () => clearTimeout(timer);
  }, [notice, presenting, offlineNoticeMs]);

  const visible = notice !== 'none' && !presenting;

  return (
    <div className="update-notice" role="status">
      {visible && notice === 'update' && (
        <div className="update-notice__card">
          <p className="update-notice__text">A new version of VAMS is ready.</p>
          <div className="update-notice__actions">
            <button
              type="button"
              className="update-notice__btn update-notice__btn--primary"
              onClick={() => void applyRef.current?.(true)}
            >
              Reload
            </button>
            <button type="button" className="update-notice__btn" onClick={() => setNotice('none')}>
              Later
            </button>
          </div>
        </div>
      )}
      {visible && notice === 'offline-ready' && (
        <div className="update-notice__card">
          <p className="update-notice__text">VAMS now works offline.</p>
        </div>
      )}
    </div>
  );
}
