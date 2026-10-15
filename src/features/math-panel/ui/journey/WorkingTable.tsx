import type { WorkingRow } from '../../model/vertex-journey';

const valueClass = (value: string) => (isProseValue(value) ? 'journey-work__value is-prose' : 'journey-work__value');

/** A step too long for the column ("refreshed every frame, usage GL_DYNAMIC_DRAW") gets more room to wrap in the stages that allow it (wrapSteps). */
const LONG_STEP = 24;
export const stepClass = (row: WorkingRow, wrapSteps: boolean) =>
  wrapSteps && row.step.map((part) => (typeof part === 'string' ? part : part.input)).join('').length > LONG_STEP ? 'journey-work__step is-long' : 'journey-work__step';

interface WorkingTableProps {
  rows: readonly WorkingRow[];
  result: string;
  /** A row's GL call was chosen: Code opens on that line. Plain text when omitted. */
  onCall?: (call: string) => void;
  /** Stored's rows are wordy ("refreshed every frame…"), so its steps may wrap; every other stage keeps one line per step. */
  wrapSteps?: boolean;
}

/** Coordinates and plain numbers ("(0.27, 0.31)", "x → 0.27", "pixel (3, 4)") stay on one line; anything else is prose and may wrap. */
const NUMERIC = /^([xy] → |NDC |pixel |texel )?[(\d−.,\s)-]+$/;
export const isProseValue = (value: string) => !NUMERIC.test(value);

interface Section {
  /** The enclosing group the rows belong to; undefined for the object's own rows. */
  heading?: string;
  rows: WorkingRow[];
}

/** The object's own rows first, then one section per enclosing group, each opened by its heading row. */
function sectionsOf(rows: readonly WorkingRow[]): Section[] {
  const sections: Section[] = [{ rows: [] }];
  for (const row of rows) {
    if (row.heading !== undefined) sections.push({ heading: row.heading, rows: [] });
    else sections[sections.length - 1].rows.push(row);
  }
  return sections;
}

/** The open stage's working: Step · Value · Code, the student's inputs in amber, the result last. */
export default function WorkingTable({ rows, result, onCall, wrapSteps }: WorkingTableProps) {
  const sections = sectionsOf(rows);
  return (
    <table className={wrapSteps ? 'journey-work journey-work--wrap-steps' : 'journey-work'}>
      <thead>
        <tr>
          <th scope="col">Step</th>
          <th scope="col">Value</th>
          <th scope="col">Code</th>
        </tr>
      </thead>
      {sections.map((section, n) => (
        <tbody key={n}>
          {section.heading !== undefined && (
            <tr className="journey-work__group">
              <th scope="rowgroup" colSpan={3} title={section.heading || 'group'}>{section.heading || 'group'}</th>
            </tr>
          )}
          {section.rows.map((row, i) => (
            <tr key={i} className={row.from ? 'is-from' : undefined}>
              <td className={stepClass(row, !!wrapSteps)}>
                {row.step.map((part, k) =>
                  typeof part === 'string' ? part : <span key={k} className="journey-work__in">{part.input}</span>,
                )}
              </td>
              <td className={valueClass(row.value)}>{row.value}</td>
              <td className="journey-work__call">
                {row.call && (onCall ? (
                  <button type="button" className="journey-work__call-link" onClick={() => onCall(row.call!)}>{row.call}</button>
                ) : (
                  <code>{row.call}</code>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      ))}
      <tbody>
        <tr className="is-result">
          <th scope="row" className="journey-work__step">Result</th>
          <td className={valueClass(result)}>{result}</td>
          <td className="journey-work__call" />
        </tr>
      </tbody>
    </table>
  );
}
