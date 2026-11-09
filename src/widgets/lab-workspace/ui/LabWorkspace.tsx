import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LabEditor, statusLine, type Diagnostic } from '@/features/lab-editor';
import { checkCompiler, compileMessage, compileSource, downloadCompiler, LAB_MESSAGES, useCompiler, type CompileOptions, type CompileResult } from '@/features/lab-compile';
import { consoleLines, INPUT_STATE, runController, runtimeVersion, useLabRun, useRunState, type LabFile, type RunStatus } from '@/features/lab-run';
import {
  canOpen,
  chooseFile,
  EXAMPLES,
  FileList,
  loadExample,
  mayReplaceWork,
  missingFilesMessage,
  newWork,
  OPEN_TAKES,
  OpenError,
  openWork,
  saveWork,
  withBrowserSave,
} from '@/features/lab-files';
import { dropMissingFiles, readLabFiles, useLabStore } from '@/entities/lab-project';
import { LabShareDialog, useShareDialog } from '@/features/share/lab';
import type { MenuEntry } from '@/shared/ui/controls';
import { LOG_SPLIT, PANE_SPLIT, splitStyle } from '../model/split';
import { useLabShareLink } from '../model/use-lab-share-link';
import { useIsNarrow } from '../model/use-narrow';
import CompilerNotice from './CompilerNotice';
import Handle from './Handle';
import LabLog from './LabLog';
import LabStage from './LabStage';
import LabTopBar, { type LabFileActions } from './LabTopBar';
import './lab-workspace.scss';

export interface LabWorkspaceProps extends LabFileActions {
  /** Compiles the source in this browser; the tests replace it. */
  compile?: (source: string, options?: CompileOptions) => Promise<CompileResult>;
  /** Starts the compiler's download; the tests replace it. */
  download?: () => void;
}

const compileHere = (source: string, options?: CompileOptions) => compileSource(runtimeVersion, source, options);
const downloadHere = () => void downloadCompiler(runtimeVersion);

const EDITOR_HINT_ID = 'lab-editor-hint';
/** CodeMirror's own ways out of the editor: Esc then Tab (within two seconds), and Ctrl+M, which toggles Tab moving focus. */
export const EDITOR_HINT =
  'Tab indents the code. To move out of the editor with the keyboard, press Esc then Tab, or press Ctrl+M (Shift+Alt+M on a Mac) so that Tab moves focus until you press it again.';

/** What Run is doing, for the status line. Nothing while it rests. */
export function runPhase(status: RunStatus, exitCode?: number): string | null {
  switch (status) {
    case 'compiling':
      return 'Compiling…';
    case 'downloading':
      return 'Downloading the compiler…';
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

/** Said when an example's code can't be fetched. */
export const EXAMPLE_UNAVAILABLE = "This example couldn't be loaded. Check the connection, then choose it again.";

/** The Lab: the code over its log on the left, the program's stage on the right. */
export default function LabWorkspace({ compile = compileHere, download = downloadHere, ...actions }: LabWorkspaceProps) {
  // The code is the Lab's browser save, so every edit is kept as it is made.
  const source = useLabStore((s) => s.source);
  // What the file list says about Open and the examples; each new object replaces its last line.
  const [fileNotice, setFileNotice] = useState<{ text: string | null } | null>(null);
  const tellFiles = (text: string | null) => setFileNotice({ text });
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [message, setCompileMessage] = useState<string | null>(null);
  // Run's lines say the code is saved in this browser only while it is.
  const setMessage = (said: string | null) => setCompileMessage(withBrowserSave(said, useLabStore.getState().browserSaveFailed));
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
  const written = useLabRun((s) => s.written);
  const splitRef = useRef<HTMLElement>(null);
  const compiling = useRef<AbortController | null>(null);
  // Run reads the newest source, whenever it was pressed.
  const latest = useRef({ source });
  useLayoutEffect(() => {
    latest.current = { source };
  });

  // A file whose bytes this browser no longer holds leaves the list, and the list says which.
  useEffect(() => {
    void dropMissingFiles().then((missing) => {
      if (missing.length > 0) tellFiles(missingFilesMessage(missing));
    });
  }, []);

  // Whether the compiler is in this browser: asked of Cache Storage, which downloads nothing.
  useEffect(() => {
    void checkCompiler(runtimeVersion);
  }, []);

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
    // The files are read from IndexedDB while the code compiles.
    const filesReady = readLabFiles();
    // While the compiler downloads, Run says so; once it is here, Run is compiling again.
    const follow = (state: string) => {
      if (compiling.current !== controller) return;
      if (state === 'downloading') runController.downloading();
      else if (state === 'ready') runController.downloaded();
    };
    const unfollow = useCompiler.subscribe((s) => follow(s.state));
    let result: CompileResult;
    try {
      const pending = compile(latest.current.source, { signal: controller.signal });
      follow(useCompiler.getState().state);
      result = await pending;
    } catch (error) {
      unfollow();
      if (compiling.current !== controller) return;
      compiling.current = null;
      runController.compileEnded();
      if (!isAbort(error)) {
        setMessage(LAB_MESSAGES.failed);
        setCompilerRequest((n) => n + 1);
      }
      return;
    }
    unfollow();
    if (compiling.current !== controller) return;
    let files: LabFile[] = [];
    if (result.kind === 'ok') {
      files = await filesReady;
      if (compiling.current !== controller) return;
    }
    compiling.current = null;
    const said = compileMessage(result);
    setMessage(said);
    if (result.kind === 'ok' || result.kind === 'errors') setDiagnostics(result.diagnostics);
    // What the compile has to say comes forward, even over a Console the last run brought forward.
    if (said || result.kind === 'errors') setCompilerRequest((n) => n + 1);
    if (result.kind === 'ok') runController.start(result.module, files);
    else runController.compileEnded();
  };

  // New work: what the compiler said was about the old code.
  const replaced = () => {
    setDiagnostics([]);
    setMessage(null);
    tellFiles(null);
  };

  // A Lab link opens here, as Open does.
  useLabShareLink(replaced, tellFiles);

  const fileActions: LabFileActions = {
    examples: [
      { kind: 'group', id: 'programs', label: 'Programs' },
      ...exampleItems('program'),
      { kind: 'group', id: 'gallery', label: 'From the gallery' },
      ...exampleItems('gallery'),
    ],
    onNew: () => void newWork().then((done) => done && replaced()),
    onOpen: () =>
      void chooseFile('.cpp,.zip').then(async (file) => {
        if (!file) return;
        if (!canOpen(file.name)) return tellFiles(OPEN_TAKES);
        if (!(await mayReplaceWork())) return;
        try {
          const notice = await openWork(file);
          replaced();
          if (notice) tellFiles(notice);
        } catch (error) {
          tellFiles(error instanceof OpenError ? error.message : OPEN_TAKES);
        }
      }),
    onSave: () => void saveWork(),
    onShare: () => useShareDialog.getState().show(),
    ...actions,
  };

  function exampleItems(group: 'program' | 'gallery'): MenuEntry[] {
    return EXAMPLES.filter((e) => e.group === group).map((e) => ({
      kind: 'item',
      id: e.id,
      label: e.title,
      onSelect: async () => {
        if (!(await mayReplaceWork())) return;
        try {
          await loadExample(e.id);
          replaced();
        } catch {
          tellFiles(EXAMPLE_UNAVAILABLE);
        }
      },
    }));
  }

  const phase = runPhase(status, exitCode);
  const statusText = phase ? `${statusLine(diagnostics)} · ${phase}` : statusLine(diagnostics);

  return (
    <div className="lab-workspace" data-layout={narrow ? 'stacked' : 'split'}>
      <LabTopBar status={statusText} onRun={() => void run()} {...fileActions} />
      <main id="main" ref={splitRef} className="lab-workspace__split" style={splitStyle({ narrow, pane, log, logFolded })}>
        <div id="lab-code" className="lab-workspace__code">
          <CompilerNotice onDownload={download} />
          <div className="lab-workspace__editor">
            <LabEditor value={source} onChange={useLabStore.getState().setSource} diagnostics={diagnostics} jumpTo={jumpTo} onRun={() => void run()} describedBy={EDITOR_HINT_ID} />
          </div>
          <FileList written={written} notice={fileNotice} />
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
      <LabShareDialog onSaveFile={() => void saveWork()} />
    </div>
  );
}
