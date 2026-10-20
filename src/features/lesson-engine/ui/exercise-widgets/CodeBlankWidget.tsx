import { useId, useState } from 'react';
import { tokenizeLine } from '@/shared/ui/code-viewer/tokenize';
import { templateParts } from '../../model/code-blanks';
import type { BlankVerdict } from '../../model/useLessonRunner';
// The token colours the code panel uses, so the line reads the same here as it does there.
import '@/shared/ui/code-viewer/code-viewer.scss';
import './exercise-widgets.scss';

interface CodeBlankWidgetProps {
  /** The line, with {0}, {1}, … where the blanks go. */
  template: string;
  /** The few words shown under each blank when it is wrong. */
  wrong: string[];
  values: string[];
  verdicts: BlankVerdict[];
  onChange: (index: number, text: string) => void;
}

/**
 * One line of code in a sunken well, set in the code panel's colours, with a typed blank for each
 * missing value. A blank shows its verdict once it has text and the student has left it.
 */
export default function CodeBlankWidget({ template, wrong, values, verdicts, onChange }: CodeBlankWidgetProps) {
  const [focused, setFocused] = useState<number | null>(null);
  const baseId = useId();
  const parts = templateParts(template);
  const count = parts.filter((p) => typeof p === 'number').length;

  const shown = (index: number): BlankVerdict =>
    focused === index || !(values[index] ?? '').trim() ? 'empty' : verdicts[index] ?? 'empty';
  const hasNote = parts.some((p) => typeof p === 'number' && shown(p) === 'wrong');

  return (
    <div className={hasNote ? 'lesson-code has-note' : 'lesson-code'}>
      {parts.map((part, i) => {
        if (typeof part === 'string') {
          return tokenizeLine(part).map((token, j) => (
            <span key={`${i}-${j}`} className={`tk-${token.k}`}>
              {token.t}
            </span>
          ));
        }
        const value = values[part] ?? '';
        const verdict = shown(part);
        const noteId = `${baseId}-note-${part}`;
        const className = [
          'lesson-code__blank',
          focused === part && 'is-focus',
          verdict === 'right' && 'is-right',
          verdict === 'wrong' && 'is-wrong',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <span key={i} className="lesson-code__slot">
            <input
              type="text"
              className={className}
              aria-label={`Blank ${part + 1} of ${count}`}
              aria-invalid={verdict === 'wrong' ? 'true' : undefined}
              aria-describedby={verdict === 'wrong' ? noteId : undefined}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellcheck={false}
              value={value}
              style={{ width: `${Math.max(6, value.length + 1)}ch` }}
              onInput={(e) => onChange(part, e.currentTarget.value)}
              onFocus={() => setFocused(part)}
              onBlur={() => setFocused((at) => (at === part ? null : at))}
            />
            {verdict === 'wrong' && (
              <span id={noteId} className="lesson-code__note">
                {wrong[part]}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
