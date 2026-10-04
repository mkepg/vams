import './stage-mode.scss';

export default function PresentButton({ onPresent }: { onPresent: () => void }) {
  return (
    <button type="button" className="present-button" onClick={onPresent} aria-keyshortcuts="P">
      Present <kbd aria-hidden="true">P</kbd>
    </button>
  );
}
