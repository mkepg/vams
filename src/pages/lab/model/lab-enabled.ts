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
