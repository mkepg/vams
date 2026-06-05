import './animation-preview-panel.scss';
import { Film, Play, Square } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';
import { useAnimationPreview } from '../model/useAnimationPreview';
import { animationController } from '../model/animation-controller';
import { MOTIONS, type MotionType } from '../model/motion';

const SPEED_STEPS = [0.5, 1, 2];

/**
 * Transient playback controls for the selected object. Visible only in Author
 * Mode with exactly one object selected. Nothing here is ever saved — the line
 * of copy at the bottom says so, for the user and for anyone watching a demo.
 */
export default function AnimationPreviewPanel() {
  const appMode = useVamsStore((s) => s.appMode);
  const selectedObjectId = useVamsStore((s) => s.selectedObjectId);
  const { playing, objectId, motion, speed, play, stop } = useAnimationPreview();

  // The store carries a single selection, so a selected id IS "exactly one".
  if (appMode !== 'Author' || !selectedObjectId) return null;

  const isPlayingThis = playing && objectId === selectedObjectId;

  const handleToggle = () => {
    if (isPlayingThis) stop();
    else play(selectedObjectId, motion, speed);
  };

  // When stopped, picking a motion/speed just remembers it for the next Play.
  // When playing, it re-launches with the new setting so motion stays live.
  const selectMotion = (next: MotionType) => {
    if (isPlayingThis) play(selectedObjectId, next, speed);
    else animationController.setPreferredMotion(next);
  };
  const selectSpeed = (next: number) => {
    if (isPlayingThis) play(selectedObjectId, motion, next);
    else animationController.setPreferredSpeed(next);
  };

  return (
    <CollapsibleSection
      title="Animation Preview"
      icon={<Film size={14} />}
      defaultOpen={false}
      panelId="animation-preview"
    >
      <div className="anim-preview">
        <div className="anim-motion-grid" role="radiogroup" aria-label="Preview motion">
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
            <span>{isPlayingThis ? 'Stop' : 'Play'}</span>
          </button>

          <div className="anim-speed" role="radiogroup" aria-label="Playback speed">
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

        <p className="anim-note">
          Preview only — this is a temporary, visual-only overlay. Nothing here
          is written to the scene or saved to the project file.
        </p>
      </div>
    </CollapsibleSection>
  );
}
