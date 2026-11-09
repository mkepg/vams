import Logo from '@/shared/ui/logo';
import { Button, MenuButton, type MenuEntry } from '@/shared/ui/controls';

/** The file actions. Each shows only once it has something to do. */
export interface LabFileActions {
  /** The Examples menu. */
  examples?: MenuEntry[];
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

const ACTIONS: { key: Exclude<keyof LabFileActions, 'examples'>; label: string }[] = [
  { key: 'onNew', label: 'New' },
  { key: 'onOpen', label: 'Open' },
  { key: 'onSave', label: 'Save' },
  { key: 'onShare', label: 'Share' },
];

/** The wordmark, "Lab" and its Experimental tag, the status line, the file actions and ▶ Run, in that order. */
export default function LabTopBar({ status, onRun, examples, ...actions }: LabTopBarProps) {
  return (
    <header className="lab-top-bar">
      <a className="lab-top-bar__home" href="/" aria-label="VAMS home">
        <Logo />
      </a>
      <h1 className="lab-top-bar__name">Lab</h1>
      <span className="lab-top-bar__tag">Experimental</span>
      <p className="lab-top-bar__status" role="status">
        {status}
      </p>
      <div className="lab-top-bar__actions">
        {examples ? (
          <MenuButton label="Examples" entries={examples} variant="quiet">
            Examples
          </MenuButton>
        ) : null}
        {ACTIONS.map(({ key, label }) => {
          const action = actions[key];
          return action ? (
            <Button key={key} variant="quiet" aria-haspopup={key === 'onShare' ? 'dialog' : undefined} onClick={action}>
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
