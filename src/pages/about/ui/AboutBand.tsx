import type { ComponentChildren } from 'preact';
import type { BandCopy } from '../model/copy';

/** One About band: its heading and summary on the left, its content on the right. */
export default function AboutBand({ band, children }: { band: BandCopy; children: ComponentChildren }) {
  return (
    <section id={band.id} className="about-band" aria-labelledby={`${band.id}-title`}>
      <div className="about-band__intro">
        <h2 id={`${band.id}-title`} className="about-band__title">{band.title}</h2>
        <p className="about-band__summary">{band.summary}</p>
      </div>
      <div className="about-band__body">{children}</div>
    </section>
  );
}
