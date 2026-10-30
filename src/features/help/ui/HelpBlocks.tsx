import type { ComponentChildren } from 'preact';
import { Info, Lightbulb, AlertTriangle } from 'lucide-react';
import type { HelpBlock } from '@/features/help/model/types';
import { SHORTCUT_GROUPS } from '@/features/help/model/shortcuts';
import { glossaryTermId } from '@/features/help/model/help-content';

/*
 * One Help block as markup. It reads no editor state, so the site's Guide page shows the same
 * content; each caller says what the "Start the tour" block becomes.
 */

const CALLOUT_ICON = {
  info: Info,
  tip: Lightbulb,
  warning: AlertTriangle,
} as const;

type HeadingLevel = 3 | 4;

function ShortcutsTable({ level }: { level: HeadingLevel }) {
  const GroupHeading = level === 3 ? 'h4' : 'h5';
  return (
    <div className="help-shortcuts">
      {SHORTCUT_GROUPS.map((group) => (
        <div key={group.group} className="help-shortcut-group">
          <GroupHeading className="help-shortcut-group__title">{group.group}</GroupHeading>
          <dl>
            {group.items.map((item) => (
              <div key={`${group.group}-${item.keys}-${item.label}`} className="help-shortcut-row">
                <dt>
                  {item.keys.split(' + ').map((key, i, arr) => (
                    <span key={key + i}>
                      <kbd>{key}</kbd>
                      {i < arr.length - 1 && <span className="plus">+</span>}
                    </span>
                  ))}
                </dt>
                <dd>{item.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

interface HelpBlockViewProps {
  block: HelpBlock;
  startTour: ComponentChildren;
  /** The level of the block's own headings: one below the topic title it sits under. */
  headingLevel?: HeadingLevel;
  /** Give each defined term an anchor, so a link can open the glossary at that term. */
  termAnchors?: boolean;
}

export function HelpBlockView({ block, startTour, headingLevel = 3, termAnchors = false }: HelpBlockViewProps) {
  switch (block.kind) {
    case 'heading': {
      const Heading = headingLevel === 3 ? 'h3' : 'h4';
      return <Heading className="help-block-heading">{block.text}</Heading>;
    }
    case 'paragraph':
      return <p className="help-block-paragraph">{block.text}</p>;
    case 'list':
      return block.ordered ? (
        <ol className="help-block-list">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      ) : (
        <ul className="help-block-list">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case 'code':
      return (
        <pre className="help-block-code">
          <code>{block.code}</code>
        </pre>
      );
    case 'table':
      return (
        <div className="help-block-table-wrap">
          <table className="help-block-table">
            <thead>
              <tr>
                {block.headers.map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'definitions':
      return (
        <dl className="help-block-definitions">
          {block.items.map((item, i) => (
            <div key={i} id={termAnchors ? glossaryTermId(item.term) : undefined} className="def-row">
              <dt>{item.term}</dt>
              <dd>{item.description}</dd>
            </div>
          ))}
        </dl>
      );
    case 'callout': {
      const tone = block.tone ?? 'info';
      const Icon = CALLOUT_ICON[tone];
      return (
        <div className={`help-block-callout tone-${tone}`}>
          <Icon size={16} className="callout-icon" aria-hidden />
          <p>{block.text}</p>
        </div>
      );
    }
    case 'shortcuts':
      return <ShortcutsTable level={headingLevel} />;
    case 'start-tour':
      return <>{startTour}</>;
  }
}

