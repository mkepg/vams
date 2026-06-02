import { useEffect, useRef } from 'react';
import { Wrench, Eye, Code2, X } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import './welcome-card.scss';

/**
 * First-run welcome card. Shown once (gated on the persisted `hasSeenWelcome`
 * flag) to orient a new student to the three regions of the workspace, with a
 * shortcut into the guided Workspace Tour in the Help Center.
 */
export default function WelcomeCard() {
  const hasSeenWelcome = useVamsStore((state) => state.hasSeenWelcome);
  const appMode = useVamsStore((state) => state.appMode);
  if (hasSeenWelcome || appMode === 'Lesson') return null;
  return <WelcomeCardInner />;
}

function WelcomeCardInner() {
  const markWelcomeSeen = useVamsStore((state) => state.markWelcomeSeen);
  const openHelp = useVamsStore((state) => state.openHelp);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => closeRef.current?.focus());
  }, []);

  const dismiss = () => markWelcomeSeen();

  const takeTour = () => {
    markWelcomeSeen();
    openHelp('workspace-tour');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      dismiss();
    }
  };

  return (
    <div className="welcome-overlay" onMouseDown={dismiss}>
      <div
        className="welcome-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <button ref={closeRef} type="button" className="welcome-close" onClick={dismiss} aria-label="Dismiss welcome">
          <X size={18} />
        </button>

        <h2 id="welcome-title">Welcome to VAMS</h2>
        <p className="welcome-lead">
          A visual way to learn the OpenGL 1.5 pipeline. The screen has three regions:
        </p>

        <ul className="welcome-regions">
          <li>
            <Wrench size={18} aria-hidden />
            <div>
              <strong>Build</strong>
              <span>The left panels: create and edit scene objects.</span>
            </div>
          </li>
          <li>
            <Eye size={18} aria-hidden />
            <div>
              <strong>See</strong>
              <span>The center canvas: your scene, drawn live.</span>
            </div>
          </li>
          <li>
            <Code2 size={18} aria-hidden />
            <div>
              <strong>Read</strong>
              <span>The right panels: the generated OpenGL code and the math behind it.</span>
            </div>
          </li>
        </ul>

        <div className="welcome-actions">
          <button type="button" className="welcome-btn secondary" onClick={dismiss}>
            Start building
          </button>
          <button type="button" className="welcome-btn primary" onClick={takeTour}>
            Take the tour
          </button>
        </div>
      </div>
    </div>
  );
}
