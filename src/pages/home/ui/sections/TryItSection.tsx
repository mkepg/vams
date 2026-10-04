import { TRY_IT } from '@/pages/home/model/content';
import SectionHeading from './SectionHeading';

export default function TryItSection() {
  return (
    <section id="try" className="home-section home-section--try" data-slide="" aria-labelledby="try-title">
      <SectionHeading id="try" title={TRY_IT.title} />
      <p className="home__actions">
        <a className="home__cta home__cta--large" href="/app">{TRY_IT.cta}</a>
      </p>
      <p className="try-url">{TRY_IT.displayUrl}</p>
      <p className="try-note">{TRY_IT.note}</p>
    </section>
  );
}
