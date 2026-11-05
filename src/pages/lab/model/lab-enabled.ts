/** What decides whether the Lab is shown. */
export interface LabFlags {
  /** LAB_LIVE. */
  live: boolean;
  /** The build's VITE_LAB value; '1' turns the Lab on. */
  flag?: string;
  /** The dev server, which also serves the local runtime. */
  dev?: boolean;
}

/** The one decision: the Lab is on when it is live, flagged on, or running in the dev server. */
export function labEnabled({ live, flag, dev }: LabFlags): boolean {
  return live || flag === '1' || dev === true;
}

/** What the live check reads: the switch, whether this is a build, and the runtime it would load. */
export interface LiveRuntime {
  /** LAB_LIVE. */
  live: boolean;
  /** True for `vite build`; the dev server serves the local runtime itself. */
  build: boolean;
  /** runtimeVersion from src/features/lab-run/model/runtime-version.ts. */
  runtimeVersion: string;
}

/**
 * Why a build can't ship, or null when it can. A live build loads the runtime from
 * /lab-runtime/<runtimeVersion>/, and only the dev server answers /lab-runtime/dev/: in
 * production every Run would fail to load it.
 */
export function liveRuntimeProblem({ live, build, runtimeVersion }: LiveRuntime): string | null {
  if (!live || !build || runtimeVersion !== 'dev') return null;
  return (
    'LAB_LIVE is true, but runtimeVersion is still "dev", which only the dev server serves. ' +
    'Publish the runtime with `node scripts/lab/publish-runtime.mjs`, which writes the new runtimeVersion, ' +
    'then build again (see docs/lab-operations.md).'
  );
}

/** Stops the build when liveRuntimeProblem finds a problem. */
export function assertLiveRuntime(check: LiveRuntime): void {
  const problem = liveRuntimeProblem(check);
  if (problem) throw new Error(problem);
}
