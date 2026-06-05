import './animation-code-overlay.scss';
import { useMemo } from 'react';
import { Film } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import CodeViewer from '@/shared/ui/code-viewer/CodeViewer';
import { useAnimationPreview } from '../model/useAnimationPreview';
import { generateIdleCallback } from '../model/idle-callback';
import { MOTIONS } from '../model/motion';

/**
 * Synced teaching layer: while a preview plays, this floats a small read-only
 * panel beside the canvas showing the GLUT idle callback that drives the same
 * motion, with the exact transform line(s) highlighted. The student sees the
 * motion, the transform call, and the callback that produces it at once.
 */
export default function AnimationCodeOverlay() {
  const { playing, objectId, motion, speed } = useAnimationPreview();
  const objects = useVamsStore((s) => s.objects);

  const target = objectId ? objects.find((o) => o.id === objectId) : undefined;
  const snippet = useMemo(
    () => (target ? generateIdleCallback(motion, target.name, speed) : null),
    [motion, target, speed],
  );

  if (!playing || !target || !snippet) return null;

  const motionLabel = MOTIONS.find((m) => m.type === motion)?.label ?? motion;

  return (
    <div className="anim-code-overlay" role="complementary" aria-label="Idle callback for preview">
      <div className="anim-code-overlay-header">
        <Film size={12} />
        <span>glutIdleFunc — {motionLabel} · {speed}×</span>
      </div>
      <div className="anim-code-overlay-body">
        <CodeViewer code={snippet.code} changedLines={snippet.highlightLines} />
      </div>
      <p className="anim-code-overlay-foot">
        The highlighted line is what moves the object. Preview only — not saved.
      </p>
    </div>
  );
}
