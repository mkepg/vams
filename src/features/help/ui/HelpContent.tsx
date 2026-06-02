import { Info, Lightbulb, AlertTriangle } from 'lucide-react';
import type { HelpBlock, HelpTopic, HelpTopicId } from '@/features/help/model/types';
import { getHelpTopic } from '@/features/help/model/help-content';
import { SHORTCUT_GROUPS } from '@/features/help/model/shortcuts';

interface HelpContentProps {
  topic: HelpTopic;
  onNavigate: (topicId: HelpTopicId) => void;
}

const CALLOUT_ICON = {
  info: Info,
  tip: Lightbulb,
  warning: AlertTriangle,
} as const;

function ShortcutsTable() {
  return (
    <div className="help-shortcuts">
      {SHORTCUT_GROUPS.map((group) => (
        <div key={group.group} className="help-shortcut-group">
          <h4>{group.group}</h4>
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

function Block({ block }: { block: HelpBlock }) {
  switch (block.kind) {
    case 'heading':
      return <h3 className="help-block-heading">{block.text}</h3>;
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
            <div key={i} className="def-row">
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
      return <ShortcutsTable />;
  }
}

export default function HelpContent({ topic, onNavigate }: HelpContentProps) {
  return (
    <article className="help-article">
      <header className="help-article-header">
        <h2 id="help-center-title">{topic.title}</h2>
        <p className="help-article-summary">{topic.summary}</p>
      </header>

      <div className="help-article-body">
        {topic.blocks.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>

      {topic.related && topic.related.length > 0 && (
        <footer className="help-article-related">
          <span className="related-label">See also</span>
          <div className="related-chips">
            {topic.related.map((id) => (
              <button
                key={id}
                type="button"
                className="related-chip"
                onClick={() => onNavigate(id)}
              >
                {getHelpTopic(id).title}
              </button>
            ))}
          </div>
        </footer>
      )}
    </article>
  );
}
