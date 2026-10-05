import { Suspense, lazy, useEffect, useState } from 'react';
import { EditorErrorBoundary, RecoveryScreen, type RecoveryActions } from '@/features/crash-recovery';
import EditorLoading from './EditorLoading';

const EditorApp = lazy(() => import('./EditorApp'));
const loadRecovery = () => import('../model/recovery');

/** Loaded on demand, so the store stays out of the bundle every page shares. */
const recoveryActions: RecoveryActions = {
  reload: () => window.location.reload(),
  download: () => {
    loadRecovery()
      .then((m) => m.downloadWork())
      .catch((error) => console.error(error));
  },
  startFresh: () => loadRecovery().then((m) => m.startFresh()),
};

export default function EditorPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Two-pass render: prerendering and hydration both see the loading shell; the editor mounts afterwards.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  if (!mounted) return <EditorLoading />;
  return (
    <EditorErrorBoundary fallback={(error) => <RecoveryScreen error={error} actions={recoveryActions} />}>
      <Suspense fallback={<EditorLoading />}>
        <EditorApp />
      </Suspense>
    </EditorErrorBoundary>
  );
}
