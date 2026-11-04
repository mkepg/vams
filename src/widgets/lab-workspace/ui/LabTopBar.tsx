import Logo from '@/shared/ui/logo';
import { Button } from '@/shared/ui/controls';

/** The file actions. Each shows only once it has something to do. */
export interface LabFileActions {
  onExamples?: () => void;
  onNew?: () => void;
  onOpen?: () => void;
  onSave?: () => void;
  onShare?: () => void;
}

interface LabTopBarProps extends LabFileActions {
  /** The status line: the file, what the compiler found, and what Run is doing. */
  status: string;
  onRun: () => void;
}

const ACTIONS: { key: keyof LabFileActions; label: string }[] = [
  { key: 'onExamples', label: 'Examples' },
  { key: 'onNew', label: 'New' },
  { key: 'onOpen', label: 'Open' },
  { key: 'onSave', label: 'Save' },
  { key: 'onShare', label: 'Share' },
];

/** The wordmark and "Lab", the status line, the file actions and ▶ Run, in that order. */
export default function LabTopBar({ status, onRun, ...actions }: LabTopBarProps) {
  return (
    <header className="lab-top-bar">
      <a className="lab-top-bar__home" href="/" aria-label="VAMS home">
        <Logo />
      </a>
      <h1 className="lab-top-bar__name">Lab</h1>
      <p className="lab-top-bar__status" role="status">
        {status}
      </p>
      <div className="lab-top-bar__actions">
        {ACTIONS.map(({ key, label }) => {
          const action = actions[key];
          return action ? (
            <Button key={key} variant="quiet" onClick={action}>
              {label}
            </Button>
          ) : null;
        })}
        <Button variant="primary" className="lab-top-bar__run" title="Run (Ctrl+Enter)" onClick={onRun}>
          <span aria-hidden="true">▶</span> Run
        </Button>
      </div>
    </header>
  );
}
