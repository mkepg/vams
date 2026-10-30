import SiteHeader from '@/widgets/site-header';
import SiteFooter from '@/widgets/site-footer';
import { HELP_CATEGORIES, HELP_TOPICS, getHelpTopic } from '@/features/help/model/help-content';
import type { HelpTopic } from '@/features/help/model/types';
import { HelpBlockView } from '@/features/help/ui/HelpBlocks';
import { GUIDE_COPY } from '../model/copy';
import './guide.scss';

const TOUR = (
  <p className="guide-tour">
    {GUIDE_COPY.tour} <a href="/app">{GUIDE_COPY.tourLink}</a>
  </p>
);

/** The Help topics in their categories, in the order Help lists them. */
const GROUPS = HELP_CATEGORIES.map((category) => ({
  category,
  topics: HELP_TOPICS.filter((topic) => topic.category === category.id),
})).filter((group) => group.topics.length > 0);

function Topic({ topic }: { topic: HelpTopic }) {
  return (
    <article id={topic.id} className="guide-topic" aria-labelledby={`${topic.id}-title`}>
      <h3 id={`${topic.id}-title`} className="guide-topic__title">{topic.title}</h3>
      <p className="guide-topic__summary">{topic.summary}</p>
      <div className="guide-topic__body">
        {topic.blocks.map((block, i) => (
          <HelpBlockView key={i} block={block} startTour={TOUR} headingLevel={4} termAnchors={topic.id === 'glossary'} />
        ))}
      </div>
      {topic.related && topic.related.length > 0 && (
        <p className="guide-topic__related">
          <span>{GUIDE_COPY.seeAlso}</span>
          {topic.related.map((id) => (
            <a key={id} href={`#${id}`}>{getHelpTopic(id).title}</a>
          ))}
        </p>
      )}
    </article>
  );
}

/** Every Help topic on one page, with its contents beside it, so the guide can be read without the editor. */
export default function GuidePage() {
  return (
    <div className="site-page">
      <SiteHeader current="/guide" />
      <main id="main" className="guide">
        <div className="guide__intro">
          <h1 className="guide__title">{GUIDE_COPY.title}</h1>
          <p className="guide__lede">{GUIDE_COPY.lede}</p>
          <p className="guide__teach">
            {GUIDE_COPY.teach} <a href="/teach">{GUIDE_COPY.teachLink}</a>
          </p>
        </div>
        <div className="guide__layout">
          <nav className="guide-contents" aria-labelledby="guide-contents-title">
            <h2 id="guide-contents-title" className="guide-contents__title">{GUIDE_COPY.contents}</h2>
            {GROUPS.map(({ category, topics }) => (
              <div key={category.id} className="guide-contents__group">
                <p className="guide-contents__label">{category.label}</p>
                <ul>
                  {topics.map((topic) => (
                    <li key={topic.id}>
                      <a href={`#${topic.id}`}>{topic.title}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <div className="guide__topics">
            {GROUPS.map(({ category, topics }) => (
              <section key={category.id} className="guide-group" aria-labelledby={`guide-${category.id}`}>
                <h2 id={`guide-${category.id}`} className="guide-group__title">{category.label}</h2>
                {topics.map((topic) => (
                  <Topic key={topic.id} topic={topic} />
                ))}
              </section>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
