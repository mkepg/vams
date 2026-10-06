import type { ComponentChildren } from 'preact';
import './table.scss';

export interface DataColumn<Row> {
  key: string;
  header: string;
  render: (row: Row, rowIndex: number) => ComponentChildren;
  numeric?: boolean;
  width?: string;
}

export interface DataTableProps<Row> {
  /** Accessible table caption (visually hidden). */
  caption: string;
  columns: DataColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row, rowIndex: number) => string;
  activeRowKey?: string | null;
  footer?: ComponentChildren;
  className?: string;
}

/** Plain, accessible data table. Editable cells hold a NumberField with hideTag and its own aria-label. */
export function DataTable<Row>({ caption, columns, rows, rowKey, activeRowKey, footer, className }: DataTableProps<Row>) {
  return (
    <div className={className ? `vtable ${className}` : 'vtable'}>
      <table className="vtable__table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={column.numeric ? 'is-num' : undefined} style={column.width ? { width: column.width } : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const keyValue = rowKey(row, rowIndex);
            return (
              <tr key={keyValue} className={keyValue === activeRowKey ? 'is-active' : undefined}>
                {columns.map((column) => (
                  <td key={column.key} className={column.numeric ? 'is-num' : undefined}>
                    {column.render(row, rowIndex)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {footer && <div className="vtable__footer">{footer}</div>}
    </div>
  );
}
