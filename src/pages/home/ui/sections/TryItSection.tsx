import { PRESET_LINKS, presetHref } from '@/entities/project/model/preset-links';
import { TRY_IT } from '@/pages/home/model/content';
import QrCode from '@/shared/ui/qr/QrCode';
import { SHARE_ORIGIN } from '@/shared/lib/share-origin';
import SectionHeading from './SectionHeading';

export default function TryItSection() {
  return (
    <section id="try" className="home-section home-section--try" data-slide="" aria-labelledby="try-title">
      <SectionHeading id="try" title={TRY_IT.title} />
      <p className="home__actions">
        <a className="home__cta home__cta--large" href="/app">{TRY_IT.cta}</a>
      </p>
      <nav className="try-presets" aria-label="Prepared scenes">
        <span className="try-presets__label">{TRY_IT.startFrom}</span>
        <ul className="try-presets__list">
          {PRESET_LINKS.map((preset) => (
            <li key={preset.slug}>
              <a href={presetHref(preset.slug)}>{preset.title}</a>
            </li>
          ))}
        </ul>
      </nav>
      <figure className="try-qr">
        <QrCode text={SHARE_ORIGIN} label={`QR code for ${TRY_IT.displayUrl}`} size={168} className="try-qr__code" />
        <figcaption className="try-url">{TRY_IT.displayUrl}</figcaption>
      </figure>
      <p className="try-note">{TRY_IT.note}</p>
    </section>
  );
}
