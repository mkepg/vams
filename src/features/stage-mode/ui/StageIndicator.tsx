import './stage-mode.scss';

interface StageIndicatorProps {
  /** Stage mode is on and hydrated. Otherwise the live region stays mounted, empty and hidden. */
  active: boolean;
  index: number;
  count: number;
  label: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The live region is always in the page, so a screen reader is already listening when the first
 * slide appears. It renders empty in the prerender and the first client render, so they match.
 */
export default function StageIndicator({ active, index, count, label }: StageIndicatorProps) {
  return (
    <p className={active ? 'stage-live stage-indicator' : 'stage-live'} aria-live="polite">
      {active && (
        <>
          <span className="stage-indicator__sr">
            Slide {index + 1} of {count}: {label}.{' '}
          </span>
          <span aria-hidden="true">
            {pad(index + 1)} / {pad(count)}
          </span>
        </>
      )}
    </p>
  );
}
