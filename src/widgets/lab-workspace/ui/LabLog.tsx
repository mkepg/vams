import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  /** What the program waits for in the Console: a line, sent on Enter, or a key, sent as it is pressed. */
  input?: 'line' | 'key' | null;
  onLine?: (text: string) => void;
  onKey?: (code: number) => void;
  /** A new value brings the Console tab forward, unfolded. */
  consoleRequest?: number;
  /** A new value brings the Compiler tab forward, unfolded. */
  compilerRequest?: number;
  /** Told whether the log is folded, now and whenever that changes. */
  onFoldedChange?: (folded: boolean) => void;
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

/** The Console key for a key pressed while the program waits for one: its character, or Enter as 13. */
function consoleKey(event: KeyboardEvent): number | null {
  if (event.key === 'Enter') return 13;
  if (event.key === 'Backspace') return 8;
  if (event.key === 'Escape') return 27;
  if (event.key.length !== 1 || event.ctrlKey || event.metaKey) return null;
  const code = event.key.charCodeAt(0);
  return code <= 0xff ? code : null;
}

export default function LabLog({
  diagnostics,
  consoleLines,
  onJump,
  message,
  input,
  onLine,
  onKey,
  consoleRequest,
  compilerRequest,
  onFoldedChange,
}: LabLogProps) {
  // Unfolded in the first render, as the prerendered page is; the saved fold is read after hydration.
  const [folded, setFolded] = useState(false);
  const foldRead = useRef(false);
  const [tab, setTab] = useState<Tab>('compiler');
  const [line, setLine] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const foldedChange = useRef(onFoldedChange);
  useLayoutEffect(() => {
    foldedChange.current = onFoldedChange;
  });

  // Every fold is remembered once the saved one has been read: the student's own, and the unfold a request makes.
  useEffect(() => {
    if (foldRead.current) writeFolded(folded);
    foldedChange.current?.(folded);
  }, [folded]);

  useEffect(() => {
    foldRead.current = true;
    // Two-pass render: the saved fold applies after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (readFolded()) setFolded(true);
  }, []);

  // A new request brings its tab forward, unfolded, during the render that brings it.
  const [requests, setRequests] = useState({ console: consoleRequest, compiler: compilerRequest });
  if (consoleRequest !== requests.console || compilerRequest !== requests.compiler) {
    setRequests({ console: consoleRequest, compiler: compilerRequest });
    const tabNow: Tab | null = compilerRequest !== requests.compiler && compilerRequest ? 'compiler' : consoleRequest ? 'console' : null;
    if (tabNow) {
      setTab(tabNow);
      setFolded(false);
    }
  }

  // The Console follows the newest output, as a console window does.
  useEffect(() => {
    const body = bodyRef.current;
    if (body && tab === 'console') body.scrollTop = body.scrollHeight;
  }, [consoleLines, tab, input]);

  // The input line takes the keyboard when it appears, unless the student is typing code.
  useEffect(() => {
    if (!input) return;
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    if (active instanceof Element && active.closest('.cm-editor')) return;
    inputRef.current?.focus();
  }, [input, tab]);

  const toggle = () => setFolded(!folded);

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
        <div id="lab-log-body" ref={bodyRef} className="lab-log__body" role="tabpanel" aria-labelledby={`lab-log-tab-${tab}`}>
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
            <>
              <pre className="lab-log__console">
                {consoleLines.map((l, i) => (
                  <span key={i} className={`lab-log__line lab-log__line--${l.stream}`}>
                    {l.text}
                    {'\n'}
                  </span>
                ))}
              </pre>
              {input ? (
                <div className="lab-log__input">
                  <label htmlFor="lab-console-input" className="lab-log__prompt">
                    {input === 'line' ? 'The program is waiting for a line. Type it and press Enter.' : 'The program is waiting for a key. Press one here.'}
                  </label>
                  <input
                    id="lab-console-input"
                    ref={inputRef}
                    className="lab-log__field"
                    type="text"
                    autoComplete="off"
                    spellcheck={false}
                    value={input === 'line' ? line : ''}
                    onInput={(event) => setLine((event.target as HTMLInputElement).value)}
                    onKeyDown={(event) => {
                      if (input === 'key') {
                        const code = consoleKey(event);
                        if (code === null) return;
                        event.preventDefault();
                        onKey?.(code);
                        return;
                      }
                      if (event.key !== 'Enter') return;
                      event.preventDefault();
                      onLine?.((event.target as HTMLInputElement).value);
                      setLine('');
                    }}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </section>
  );
}
