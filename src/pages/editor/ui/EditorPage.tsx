import { Suspense, lazy, useEffect, useState } from 'react';
import EditorLoading from './EditorLoading';

const EditorApp = lazy(() => import('./EditorApp'));

export default function EditorPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Two-pass render: prerendering and hydration both see the loading shell; the editor mounts afterwards.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  if (!mounted) return <EditorLoading />;
  return (
    <Suspense fallback={<EditorLoading />}>
      <EditorApp />
    </Suspense>
  );
}
