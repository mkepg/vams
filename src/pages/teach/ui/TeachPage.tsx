import SiteHeader from '@/widgets/site-header';
import SiteFooter from '@/widgets/site-footer';
import { COURSE, catalogFor } from '@/features/lesson-engine/model/catalog';
import { GALLERY_SCENES, galleryHref } from '@/entities/project/model/gallery-links';
import { PRESET_LINKS, presetHref } from '@/entities/project/model/preset-links';
import { TEACH_COPY } from '../model/copy';
import './teach.scss';

const SCENES = [
  ...GALLERY_SCENES.map((scene) => ({ href: galleryHref(scene.slug), title: scene.title })),
  ...PRESET_LINKS.map((preset) => ({ href: presetHref(preset.slug), title: preset.title })),
];

/** For instructors: how the course maps onto a class, the links to hand out, and running a lab. */
export default function TeachPage() {
  const { course, links, lab, plan, more } = TEACH_COPY;
  return (
    <div className="site-page">
      <SiteHeader />
      <main id="main" className="teach">
        <div className="teach__intro">
          <h1 className="teach__title">{TEACH_COPY.title}</h1>
          <p className="teach__lede">{TEACH_COPY.lede}</p>
        </div>

        <section className="teach-band" aria-labelledby="teach-course">
          <h2 id="teach-course" className="teach-band__title">{course.heading}</h2>
          <p className="teach-band__intro">{course.intro}</p>
          <ol className="teach-course">
            {COURSE.map(({ section, summary, calls }) => {
              const { demos, exercises } = catalogFor(section);
              return (
                <li key={section} className="teach-course__row">
                  <div className="teach-course__head">
                    <h3>{section}</h3>
                    <p className="teach-course__count">{`${course.demos(demos.length)} · ${course.exercises(exercises.length)}`}</p>
                  </div>
                  <p className="teach-course__summary">{summary}</p>
                  <p className="teach-course__calls">
                    <span>{course.teaches}</span>
                    {calls.map((call) => <code key={call}>{call}</code>)}
                  </p>
                  <a className="teach-course__link" href={`/learn#${section.toLowerCase()}`}>{course.open}</a>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="teach-band" aria-labelledby="teach-links">
          <h2 id="teach-links" className="teach-band__title">{links.heading}</h2>
          <p className="teach-band__intro">{links.intro}</p>
          <dl className="teach-links">
            {links.items.map((item) => (
              <div key={item.term} className="teach-links__row">
                <dt>{item.term}</dt>
                <dd>
                  <p>{item.text}</p>
                  {item.example && <code className="teach-links__example">{item.example}</code>}
                </dd>
              </div>
            ))}
          </dl>
          <h3 className="teach-band__sub">{links.scenesLabel}</h3>
          <ul className="teach-scenes">
            {SCENES.map((scene) => (
              <li key={scene.href}>
                <a href={scene.href}>{scene.title}</a>
                <code>{scene.href}</code>
              </li>
            ))}
          </ul>
        </section>

        <section className="teach-band" aria-labelledby="teach-lab">
          <h2 id="teach-lab" className="teach-band__title">{lab.heading}</h2>
          <ul className="teach-list">
            {lab.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section className="teach-band" aria-labelledby="teach-plan">
          <h2 id="teach-plan" className="teach-band__title">{plan.heading}</h2>
          <p className="teach-band__intro">{plan.intro}</p>
          <ol className="teach-plan">
            {plan.steps.map((step) => (
              <li key={step.time + step.text}>
                <span className="teach-plan__time">{step.time}</span>
                <span>{step.text}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="teach-band" aria-labelledby="teach-more">
          <h2 id="teach-more" className="teach-band__title">{more.heading}</h2>
          <ul className="teach-list teach-list--links">
            {more.items.map((item) => (
              <li key={item.href}>
                <a href={item.href}>{item.label}</a>: {item.text}
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
