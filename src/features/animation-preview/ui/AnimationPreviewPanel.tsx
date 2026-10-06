import './animation-preview-panel.scss';
import { useEffect, useRef } from 'react';
import { Film, Play, Square, Save, Trash2, Check } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';
import { Button, SegmentedControl } from '@/shared/ui/controls';
import { useAnimationPreview } from '../model/useAnimationPreview';
import { animationController } from '../model/animation-controller';
import { MOTIONS, type MotionType } from '../model/motion';

const SPEED_OPTIONS = [0.5, 1, 2].map((n) => ({ value: String(n), label: `${n}×` }));

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
  const motionRefs = useRef<(HTMLButtonElement | null)[]>([]);
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

  const chooseMotion = (index: number) => {
    const next = (index + MOTIONS.length) % MOTIONS.length;
    selectMotion(MOTIONS[next].type);
    motionRefs.current[next]?.focus();
  };
  const onMotionKeyDown = (event: KeyboardEvent) => {
    const current = Math.max(0, MOTIONS.findIndex((m) => m.type === motion));
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        chooseMotion(current + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        chooseMotion(current - 1);
        break;
      case 'Home':
        event.preventDefault();
        chooseMotion(0);
        break;
      case 'End':
        event.preventDefault();
        chooseMotion(MOTIONS.length - 1);
        break;
    }
  };

  const handleSave = () => setObjectAnimation(selectedObjectId, { motion, speed });
  const handleRemove = () => setObjectAnimation(selectedObjectId, null);

  return (
    <CollapsibleSection
      title="Animation"
      icon={<Film size={14} />}
      defaultOpen={false}
      panelId="animation-preview"
      hint="glutIdleFunc"
    >
      <div className="anim-preview">
        <div className="anim-motion-grid" role="radiogroup" aria-label="Animation motion" onKeyDown={onMotionKeyDown}>
          {MOTIONS.map((m, index) => (
            <button
              key={m.type}
              ref={(el) => {
                motionRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={motion === m.type}
              tabIndex={motion === m.type ? 0 : -1}
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
          <Button
            className="anim-play-btn"
            variant="secondary"
            icon={isPlayingThis ? <Square size={13} /> : <Play size={13} />}
            onClick={handleToggle}
          >
            {isPlayingThis ? 'Stop' : 'Preview'}
          </Button>

          <SegmentedControl
            label="Animation speed"
            options={SPEED_OPTIONS}
            value={String(speed)}
            onChange={(v) => selectSpeed(Number(v))}
          />
        </div>

        <div className="anim-save-row">
          <Button
            className="anim-save-btn"
            variant="primary"
            icon={isSaved ? <Check size={13} /> : <Save size={13} />}
            onClick={handleSave}
            disabled={isSaved}
            title="Save this animation onto the object (written to the code and the .vams file)"
          >
            {isSaved ? 'Saved' : hasSaved ? 'Update' : 'Save animation'}
          </Button>
          {hasSaved && (
            <Button
              variant="danger"
              iconOnly
              label="Remove saved animation"
              icon={<Trash2 size={13} />}
              onClick={handleRemove}
              title="Remove the saved animation from this object"
            />
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
