import type { WorkingRow } from '../../model/vertex-journey';

interface WorkingTableProps {
  rows: readonly WorkingRow[];
  result: string;
  /** A row's GL call was chosen: Code opens on that line. Plain text when omitted. */
  onCall?: (call: string) => void;
}

/** The open stage's working: Step · Value · Code, the student's inputs in amber, the result last. */
export default function WorkingTable({ rows, result, onCall }: WorkingTableProps) {
  return (
    <table className="journey-work">
      <thead>
        <tr>
          <th scope="col">Step</th>
          <th scope="col">Value</th>
          <th scope="col">Code</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className={row.from ? 'is-from' : undefined}>
            <td className="journey-work__step">
              {row.step.map((part, k) =>
                typeof part === 'string' ? part : <span key={k} className="journey-work__in">{part.input}</span>,
              )}
            </td>
            <td className="journey-work__value">{row.value}</td>
            <td className="journey-work__call">
              {row.call && (onCall ? (
                <button type="button" className="journey-work__call-link" onClick={() => onCall(row.call!)}>{row.call}</button>
              ) : (
                <code>{row.call}</code>
              ))}
            </td>
          </tr>
        ))}
        <tr className="is-result">
          <th scope="row" className="journey-work__step">Result</th>
          <td className="journey-work__value">{result}</td>
          <td className="journey-work__call" />
        </tr>
      </tbody>
    </table>
  );
}
