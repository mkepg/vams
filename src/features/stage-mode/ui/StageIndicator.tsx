import './stage-mode.scss';

interface StageIndicatorProps {
  index: number;
  count: number;
  label: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export default function StageIndicator({ index, count, label }: StageIndicatorProps) {
  return (
    <p className="stage-indicator" aria-live="polite">
      <span className="stage-indicator__sr">
        Slide {index + 1} of {count}: {label}.{' '}
      </span>
      <span aria-hidden="true">
        {pad(index + 1)} / {pad(count)}
      </span>
    </p>
  );
}
