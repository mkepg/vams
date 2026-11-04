import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LabEditor, statusLine, type Diagnostic } from '@/features/lab-editor';
import { compileMessage, compileSource, LAB_MESSAGES, type CompileOptions, type CompileResult } from '@/features/lab-compile';
import { consoleLines, INPUT_STATE, runController, useLabRun, useRunState, type LabFile, type RunStatus } from '@/features/lab-run';
import { LOG_SPLIT, PANE_SPLIT, splitStyle } from '../model/split';
import { STARTER_SOURCE } from '../model/starter';
import { useIsNarrow } from '../model/use-narrow';
import Handle from './Handle';
import LabLog from './LabLog';
import LabStage from './LabStage';
import LabTopBar, { type LabFileActions } from './LabTopBar';
import './lab-workspace.scss';

export interface LabWorkspaceProps extends LabFileActions {
  /** Sends the source to the compile service; the tests replace it. */
  compile?: (source: string, options?: CompileOptions) => Promise<CompileResult>;
  initialSource?: string;
  /** The images and text files the program can open. */
  files?: LabFile[];
}

const EDITOR_HINT_ID = 'lab-editor-hint';
/** CodeMirror's own ways out of the editor: Esc then Tab (within two seconds), and Ctrl+M, which toggles Tab moving focus. */
export const EDITOR_HINT =
  'Tab indents the code. To move out of the editor with the keyboard, press Esc then Tab, or press Ctrl+M (Shift+Alt+M on a Mac) so that Tab moves focus until you press it again.';

/** What Run is doing, for the status line. Nothing while it rests. */
export function runPhase(status: RunStatus, exitCode?: number): string | null {
  switch (status) {
    case 'compiling':
    case 'busy':
      return 'Compiling…';
    case 'running':
      return 'Running';
    case 'waitingInput':
      return 'Waiting for input in the Console';
    case 'exited':
      return `Ended with exit code ${exitCode ?? 0}`;
    case 'crashed':
      return 'Stopped on an error';
    default:
      return null;
  }
}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

/** The Lab: the code over its log on the left, the program's stage on the right. */
export default function LabWorkspace({ compile = compileSource, initialSource = STARTER_SOURCE, files = [], ...actions }: LabWorkspaceProps) {
  const [source, setSource] = useState(initialSource);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [jumpTo, setJumpTo] = useState<{ line: number; col: number } | undefined>();
  const [pane, setPane] = useState(PANE_SPLIT.initial);
  const [log, setLog] = useState(LOG_SPLIT.initial);
  const [logFolded, setLogFolded] = useState(false);
  const [consoleRequest, setConsoleRequest] = useState(0);
  const [compilerRequest, setCompilerRequest] = useState(0);
  const narrow = useIsNarrow();
  const { status, exitCode } = useRunState();
  const consoleLog = useLabRun((s) => s.console);
  const input = useLabRun((s) => s.input);
  const splitRef = useRef<HTMLElement>(null);
  const compiling = useRef<AbortController | null>(null);
  // Run reads the newest source and files, whenever it was pressed.
  const latest = useRef({ source, files });
  useLayoutEffect(() => {
    latest.current = { source, files };
  });

  // Stop the program and any compile when the page goes.
  useEffect(
    () => () => {
      compiling.current?.abort();
      runController.stop();
    },
    [],
  );

  // The moment a program starts, or begins to wait for input, the Console comes forward.
  useEffect(
    () =>
      useLabRun.subscribe((now, before) => {
        const started = now.status === 'running' && before.status !== 'running' && before.status !== 'waitingInput';
        const waits = now.input !== INPUT_STATE.NONE && before.input === INPUT_STATE.NONE;
        if (started || waits) setConsoleRequest((n) => n + 1);
      }),
    [],
  );

  const run = async () => {
    compiling.current?.abort();
    const controller = new AbortController();
    compiling.current = controller;
    runController.compiling();
    setMessage(null);
    let result: CompileResult;
    try {
      result = await compile(latest.current.source, {
        signal: controller.signal,
        onBusy: () => {
          if (compiling.current !== controller) return;
          runController.busy();
          setMessage(LAB_MESSAGES.busy);
          setCompilerRequest((n) => n + 1);
        },
      });
    } catch (error) {
      if (compiling.current !== controller) return;
      compiling.current = null;
      runController.compileEnded();
      if (!isAbort(error)) {
        setMessage(LAB_MESSAGES.failed);
        setCompilerRequest((n) => n + 1);
      }
      return;
    }
    if (compiling.current !== controller) return;
    compiling.current = null;
    const said = compileMessage(result);
    setMessage(said);
    if (result.kind === 'ok' || result.kind === 'errors') setDiagnostics(result.diagnostics);
    // What the compile has to say comes forward, even over a Console the last run brought forward.
    if (said || result.kind === 'errors') setCompilerRequest((n) => n + 1);
    if (result.kind === 'ok') runController.start(result.module, latest.current.files);
    else runController.compileEnded();
  };

  const phase = runPhase(status, exitCode);
  const statusText = phase ? `${statusLine(diagnostics)} · ${phase}` : statusLine(diagnostics);

  return (
    <div className="lab-workspace" data-layout={narrow ? 'stacked' : 'split'}>
      <LabTopBar status={statusText} onRun={() => void run()} {...actions} />
      <main id="main" ref={splitRef} className="lab-workspace__split" style={splitStyle({ narrow, pane, log, logFolded })}>
        <div id="lab-code" className="lab-workspace__code">
          <div className="lab-workspace__editor">
            <LabEditor value={source} onChange={setSource} diagnostics={diagnostics} jumpTo={jumpTo} onRun={() => void run()} describedBy={EDITOR_HINT_ID} />
          </div>
          <p id={EDITOR_HINT_ID} className="lab-workspace__hint">
            {EDITOR_HINT}
          </p>
        </div>
        {!narrow && !logFolded && (
          <Handle
            orientation="horizontal"
            label="Resize the code and the log"
            value={log}
            limits={LOG_SPLIT}
            onChange={setLog}
            boxRef={splitRef}
            controls="lab-code"
            className="lab-workspace__log-handle"
          />
        )}
        <div className="lab-workspace__log">
          <LabLog
            diagnostics={diagnostics}
            consoleLines={consoleLines(consoleLog)}
            onJump={(line, col) => setJumpTo({ line, col })}
            message={message}
            input={input === INPUT_STATE.LINE ? 'line' : input === INPUT_STATE.KEY ? 'key' : null}
            onLine={(text) => runController.sendLine(text)}
            onKey={(code) => runController.sendKey(code)}
            consoleRequest={consoleRequest}
            compilerRequest={compilerRequest}
            onFoldedChange={setLogFolded}
          />
        </div>
        {!narrow && (
          <Handle
            orientation="vertical"
            label="Resize the code and the stage"
            value={pane}
            limits={PANE_SPLIT}
            onChange={setPane}
            boxRef={splitRef}
            controls="lab-code"
            className="lab-workspace__pane-handle"
          />
        )}
        <div className="lab-workspace__stage">
          <LabStage />
        </div>
      </main>
    </div>
  );
}
