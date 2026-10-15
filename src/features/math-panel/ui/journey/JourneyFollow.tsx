import type { JourneySubject } from '../../model/vertex-journey';

interface JourneyFollowProps {
  subject: JourneySubject;
  onStep: (delta: 1 | -1) => void;
}

/** "○ Following Triangle      ‹ vertex 1 of 3 ›" */
export default function JourneyFollow({ subject, onStep }: JourneyFollowProps) {
  if (subject.kind === 'none') {
    return <div className="journey-follow">Select a shape to follow one of its vertices.</div>;
  }
  if (subject.kind === 'group') {
    return <div className="journey-follow">A group has no vertices of its own. Select a shape inside it to follow one.</div>;
  }
  return (
    <div className="journey-follow">
      <span className="journey-follow__ring" aria-hidden="true" />
      <span>Following <b>{subject.name}</b></span>
      <span className="journey-follow__space" />
      {subject.kind === 'shape' && subject.count > 0 ? (
        <>
          <button type="button" className="journey-follow__step" aria-label="Previous vertex" onClick={() => onStep(-1)}>‹</button>
          <span className="journey-follow__vertex" aria-live="polite">vertex {subject.vertex + 1} of {subject.count}</span>
          <button type="button" className="journey-follow__step" aria-label="Next vertex" onClick={() => onStep(1)}>›</button>
        </>
      ) : (
        <span className="journey-follow__vertex" aria-live="polite">raster position</span>
      )}
    </div>
  );
}
