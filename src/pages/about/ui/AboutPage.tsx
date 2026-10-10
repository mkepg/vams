import SiteHeader from '@/widgets/site-header';
import SiteFooter from '@/widgets/site-footer';
import { LESSON_CATALOG } from '@/features/lesson-engine/model/catalog';
import { ABOUT_COPY, THESIS } from '../model/copy';
import AboutBand from './AboutBand';
import CitationTabs from './CitationTabs';
import './about.scss';

export default function AboutPage() {
  const lessons = LESSON_CATALOG.length;
  const { bands } = ABOUT_COPY;

  return (
    <div className="site-page">
      <SiteHeader current="/about" />
      <main id="main" className="about">
        <div className="about__intro">
          <h1 className="about__title">{ABOUT_COPY.title}</h1>
          <p className="about__lede">{ABOUT_COPY.lede}</p>
        </div>

        <AboutBand band={bands.story}>
          {ABOUT_COPY.story(lessons).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </AboutBand>

        <AboutBand band={bands.students}>
          <dl className="about-facts">
            {ABOUT_COPY.facts(lessons).map((fact) => (
              <div key={fact.term}>
                <dt>{fact.term}</dt>
                <dd>{fact.href ? <a href={fact.href} rel="noopener">{fact.text}</a> : fact.text}</dd>
              </div>
            ))}
          </dl>
        </AboutBand>

        <AboutBand band={bands.thesis}>
          <div className="about-record">
            <p className="about-record__title">{THESIS.title}</p>
            <dl className="about-record__facts">
              <dt>{ABOUT_COPY.authorsLabel}</dt>
              <dd>{THESIS.authors.join(', ')}</dd>
              <dt>{ABOUT_COPY.adviserLabel}</dt>
              <dd>{THESIS.adviser}</dd>
              <dt>{ABOUT_COPY.degreeLabel}</dt>
              <dd>{THESIS.degree}</dd>
              <dt>{ABOUT_COPY.institutionLabel}</dt>
              <dd>{THESIS.institution}</dd>
              <dt>{ABOUT_COPY.yearLabel}</dt>
              <dd>{THESIS.year}</dd>
            </dl>
            <CitationTabs />
          </div>
        </AboutBand>
      </main>
      <SiteFooter />
    </div>
  );
}
