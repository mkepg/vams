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

/** The status chip's colour: at rest, busy, running, ended, or stopped on an error. */
export type StatusTone = 'idle' | 'busy' | 'running' | 'ended' | 'error';

interface LabTopBarProps extends LabFileActions {
  /** The file and what the compiler found, such as "main.cpp · 2 errors". */
  file: string;
  /** What Run is doing, in the chip. */
  phase: { label: string; tone: StatusTone };
  onRun: () => void;
}

/**
 * "LAB" drawn on a pixel grid, one string per row and X for a pixel, to stand beside the pixel
 * wordmark. The font's own B closes its bowls at this size; these leave each a two-pixel hole.
 */
const LAB_PIXELS = [
  'XX.......XXXX...XXXXX.',
  'XX......XX..XX..XX..XX',
  'XX......XX..XX..XX..XX',
  'XX......XXXXXX..XXXXX.',
  'XX......XX..XX..XX..XX',
  'XXXXXX..XX..XX..XX..XX',
  'XXXXXX..XX..XX..XXXXX.',
];

/** The pixels of LAB_PIXELS as one path of unit squares, row by row, runs merged. */
const LAB_PATH = LAB_PIXELS.flatMap((row, y) =>
  [...row.matchAll(/X+/g)].map((run) => `M${run.index} ${y}h${run[0].length}v1h-${run[0].length}z`),
).join('');

function PixelWord() {
  return (
    <svg className="lab-top-bar__word" viewBox={`0 0 ${LAB_PIXELS[0].length} ${LAB_PIXELS.length}`} aria-hidden="true" focusable="false">
      <path className="lab-top-bar__word-depth" d={LAB_PATH} transform="translate(0.45 0.45)" />
      <path className="lab-top-bar__word-face" d={LAB_PATH} />
    </svg>
  );
}

const ACTIONS: { key: Exclude<keyof LabFileActions, 'examples'>; label: string }[] = [
  { key: 'onNew', label: 'New' },
  { key: 'onOpen', label: 'Open' },
  { key: 'onSave', label: 'Save' },
  { key: 'onShare', label: 'Share' },
];

/**
 * The wordmark with "LAB" in pixels beside it, and the Experimental tag; the file with Run's state in a chip, the file
 * actions as one group, and ▶ Run on its own at the end.
 */
export default function LabTopBar({ file, phase, onRun, examples, ...actions }: LabTopBarProps) {
  return (
    <header className="lab-top-bar">
      <div className="lab-top-bar__brand">
        <a className="lab-top-bar__home" href="/" aria-label="VAMS home">
          <Logo />
        </a>
        <h1 className="lab-top-bar__name">
          <PixelWord />
          <span className="lab-top-bar__hidden">Lab</span>
        </h1>
        <span className="lab-top-bar__tag">Experimental</span>
      </div>
      <p className="lab-top-bar__status" role="status">
        <span className="lab-top-bar__file">{file}</span>
        <span className="lab-top-bar__hidden"> · </span>
        <span className="lab-status" data-tone={phase.tone}>
          <span className="lab-status__dot" aria-hidden="true" />
          {phase.label}
        </span>
      </p>
      <div className="lab-top-bar__actions">
        <div className="lab-top-bar__files" role="group" aria-label="File">
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
        </div>
        <Button variant="primary" className="lab-top-bar__run" title="Run (Ctrl+Enter)" onClick={onRun}>
          <svg className="lab-top-bar__run-icon" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
            <path d="M3 1.8v8.4a.6.6 0 0 0 .9.5l6.6-4.2a.6.6 0 0 0 0-1L3.9 1.3a.6.6 0 0 0-.9.5Z" />
          </svg>
          Run
        </Button>
      </div>
    </header>
  );
}
