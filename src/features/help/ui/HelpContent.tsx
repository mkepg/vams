import { useVamsStore } from '@/core/store';
import type { HelpTopic, HelpTopicId } from '@/features/help/model/types';
import { getHelpTopic } from '@/features/help/model/help-content';
import { HelpBlockView } from './HelpBlocks';

interface HelpContentProps {
  topic: HelpTopic;
  onNavigate: (topicId: HelpTopicId) => void;
}

/** Closes Help and starts the first-visit tour, marking the welcome as seen. */
export function startTourFromHelp() {
  const state = useVamsStore.getState();
  state.markWelcomeSeen();
  state.closeHelp();
  state.startTour();
}

/** Not offered during a lesson, which the tour would end. */
function StartTourButton() {
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');
  if (inLesson) return null;
  return (
    <button type="button" className="help-start-tour" onClick={startTourFromHelp}>
      Start the tour
    </button>
  );
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
          <HelpBlockView key={i} block={block} startTour={<StartTourButton />} />
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
