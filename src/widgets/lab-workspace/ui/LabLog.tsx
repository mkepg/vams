import { useState } from 'react';
import type { Diagnostic } from '@/shared/lib/lab-diagnostic';
import type { ConsoleLine } from '@/features/lab-run/model/console-lines';
import './lab-log.scss';

export interface LabLogProps {
  diagnostics: readonly Diagnostic[];
  /** The program's output, oldest line first. */
  consoleLines: readonly ConsoleLine[];
  /** Called with a 1-based line and column when a diagnostic is clicked. */
  onJump: (line: number, col: number) => void;
  /** A line for the Compiler tab: the busy line, or why Run cannot go ahead. */
  message?: string | null;
}

type Tab = 'compiler' | 'console';

const FOLD_KEY = 'vams-lab-log-folded';

function readFolded(): boolean {
  try {
    return localStorage.getItem(FOLD_KEY) === '1';
  } catch {
    return false;
  }
}

function writeFolded(folded: boolean): void {
  try {
    localStorage.setItem(FOLD_KEY, folded ? '1' : '0');
  } catch {
    // Blocked storage: the log still folds, it just is not remembered.
  }
}

export default function LabLog({ diagnostics, consoleLines, onJump, message }: LabLogProps) {
  const [folded, setFolded] = useState(readFolded);
  const [tab, setTab] = useState<Tab>('compiler');

  const toggle = () => {
    const next = !folded;
    setFolded(next);
    writeFolded(next);
  };

  return (
    <section className="lab-log" data-folded={folded ? 'true' : 'false'} aria-label="Log">
      <div className="lab-log__bar">
        <button type="button" className="lab-log__fold" aria-expanded={!folded} aria-controls="lab-log-body" onClick={toggle}>
          <span aria-hidden="true">{folded ? '▸' : '▾'}</span>
          <span className="lab-log__fold-text">{folded ? 'Show log' : 'Hide log'}</span>
        </button>
        <div role="tablist" aria-label="Log" className="lab-log__tabs">
          {(['compiler', 'console'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`lab-log-tab-${t}`}
              aria-selected={tab === t}
              aria-controls="lab-log-body"
              className="lab-log__tab"
              onClick={() => {
                setTab(t);
                if (folded) {
                  setFolded(false);
                  writeFolded(false);
                }
              }}
            >
              {t === 'compiler' ? 'Compiler' : 'Console'}
            </button>
          ))}
        </div>
      </div>
      {!folded && (
        <div id="lab-log-body" className="lab-log__body" role="tabpanel" aria-labelledby={`lab-log-tab-${tab}`}>
          {tab === 'compiler' ? (
            <>
              {message ? (
                <p className="lab-log__message" role="status">
                  {message}
                </p>
              ) : null}
              <ul className="lab-log__list">
                {diagnostics.map((d, i) => (
                  <li key={i} className={`lab-log__item lab-log__item--${d.severity}`}>
                    <button type="button" className="lab-log__jump" onClick={() => onJump(d.line, d.col)}>
                      {`main.cpp:${d.line}:${d.col}`}
                    </button>{' '}
                    <span className="lab-log__severity">{d.severity}:</span> {d.message}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <pre className="lab-log__console">
              {consoleLines.map((l, i) => (
                <span key={i} className={`lab-log__line lab-log__line--${l.stream}`}>
                  {l.text}
                  {'\n'}
                </span>
              ))}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}
