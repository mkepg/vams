import './animation-preview-panel.scss';
import { useEffect } from 'react';
import { Film, Play, Square, Save, Trash2, Check } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';
import { useAnimationPreview } from '../model/useAnimationPreview';
import { animationController } from '../model/animation-controller';
import { MOTIONS, type MotionType } from '../model/motion';

const SPEED_STEPS = [0.5, 1, 2];

/**
 * Animation controls for the selected object (Author Mode, single selection).
 *
 * Play is a transient, visual-only preview (no retained state — consistent
 * with the uni-directional architecture). Save writes a declarative animation
 * onto the object, which the generator compiles into a real `animate_<name>()`
 * GLUT idle callback and which is stored in the `.vams` project file. The
 * canvas only animates when the user presses Play — there is no auto-running
 * playback loop.
 */
export default function AnimationPreviewPanel() {
  const appMode = useVamsStore((s) => s.appMode);
  const selectedObjectId = useVamsStore((s) => s.selectedObjectId);
  const objects = useVamsStore((s) => s.objects);
  const setObjectAnimation = useVamsStore((s) => s.setObjectAnimation);
  const { playing, objectId, motion, speed, play, stop } = useAnimationPreview();

  const selectedObject = objects.find((o) => o.id === selectedObjectId);
  const savedAnim = selectedObject?.animation ?? null;

  // When selection changes, sync the selectors to that object's saved
  // animation (if any) so the panel reflects what's stored.
  useEffect(() => {
    const obj = useVamsStore.getState().objects.find((o) => o.id === selectedObjectId);
    if (obj?.animation) {
      animationController.setPreferredMotion(obj.animation.motion);
      animationController.setPreferredSpeed(obj.animation.speed);
    }
  }, [selectedObjectId]);

  // The store carries a single selection, so a selected id IS "exactly one".
  if (appMode !== 'Author' || !selectedObjectId) return null;

  const isPlayingThis = playing && objectId === selectedObjectId;
  const isSaved = !!savedAnim && savedAnim.motion === motion && savedAnim.speed === speed;
  const hasSaved = !!savedAnim;

  const handleToggle = () => {
    if (isPlayingThis) stop();
    else play(selectedObjectId, motion, speed);
  };

  const selectMotion = (next: MotionType) => {
    if (isPlayingThis) play(selectedObjectId, next, speed);
    else animationController.setPreferredMotion(next);
  };
  const selectSpeed = (next: number) => {
    if (isPlayingThis) play(selectedObjectId, motion, next);
    else animationController.setPreferredSpeed(next);
  };

  const handleSave = () => setObjectAnimation(selectedObjectId, { motion, speed });
  const handleRemove = () => setObjectAnimation(selectedObjectId, null);

  return (
    <CollapsibleSection
      title="Animation"
      icon={<Film size={14} />}
      defaultOpen={false}
      panelId="animation-preview"
    >
      <div className="anim-preview">
        <div className="anim-motion-grid" role="radiogroup" aria-label="Animation motion">
          {MOTIONS.map((m) => (
            <button
              key={m.type}
              type="button"
              role="radio"
              aria-checked={motion === m.type}
              className={`anim-motion-btn ${motion === m.type ? 'active' : ''}`}
              onClick={() => selectMotion(m.type)}
              title={m.blurb}
            >
              <span className="motion-label">{m.label}</span>
              <span className="motion-blurb">{m.blurb}</span>
            </button>
          ))}
        </div>

        <div className="anim-controls-row">
          <button
            type="button"
            className={`anim-play-btn ${isPlayingThis ? 'playing' : ''}`}
            onClick={handleToggle}
          >
            {isPlayingThis ? <Square size={13} /> : <Play size={13} />}
            <span>{isPlayingThis ? 'Stop' : 'Preview'}</span>
          </button>

          <div className="anim-speed" role="radiogroup" aria-label="Animation speed">
            {SPEED_STEPS.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={speed === s}
                className={`anim-speed-btn ${speed === s ? 'active' : ''}`}
                onClick={() => selectSpeed(s)}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        <div className="anim-save-row">
          <button
            type="button"
            className={`anim-save-btn ${isSaved ? 'saved' : ''}`}
            onClick={handleSave}
            disabled={isSaved}
            title="Save this animation onto the object (written to the code and the .vams file)"
          >
            {isSaved ? <Check size={13} /> : <Save size={13} />}
            <span>{isSaved ? 'Saved' : hasSaved ? 'Update' : 'Save animation'}</span>
          </button>
          {hasSaved && (
            <button
              type="button"
              className="anim-remove-btn"
              onClick={handleRemove}
              title="Remove the saved animation from this object"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>

        <p className="anim-note">
          {hasSaved
            ? 'Saved — this object now generates a real glutIdleFunc callback in the code and the saved project. Press Preview to watch it; the canvas stays still otherwise.'
            : 'Preview is a temporary, visual-only overlay. Save to make it a real idle-callback animation that is written into the code and the project file.'}
        </p>
      </div>
    </CollapsibleSection>
  );
}
