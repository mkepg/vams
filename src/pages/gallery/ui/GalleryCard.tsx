import { galleryHref, galleryImage, GALLERY_SCENES } from '@/entities/project/model/gallery-links';
import { GALLERY_COPY } from '../model/copy';

type Scene = (typeof GALLERY_SCENES)[number];

/** One scene: its still, what it is, what it shows and what to try in Run. The whole card opens it. */
export default function GalleryCard({ scene, lead = false }: { scene: Scene; lead?: boolean }) {
  const titleId = `gallery-${scene.slug}`;
  const linkId = `${titleId}-open`;
  return (
    <article className={lead ? 'gallery-card gallery-card--lead' : 'gallery-card'} aria-labelledby={titleId}>
      <img
        className="gallery-card__image"
        src={galleryImage(scene.slug)}
        alt={scene.alt}
        width={960}
        height={540}
        loading={lead ? 'eager' : 'lazy'}
        decoding="async"
      />
      <div className="gallery-card__body">
        <h2 id={titleId} className="gallery-card__title">{scene.title}</h2>
        <p className="gallery-card__summary">{scene.summary}</p>
        <ul className="gallery-card__shows" aria-label={GALLERY_COPY.shows}>
          {scene.shows.map((section) => (
            <li key={section}>{section}</li>
          ))}
        </ul>
        <p className="gallery-card__run">
          <span className="gallery-card__run-label">{GALLERY_COPY.run}</span>{' '}
          {scene.run}
        </p>
        <a id={linkId} className="gallery-card__open" href={galleryHref(scene.slug)} aria-labelledby={`${linkId} ${titleId}`}>
          {GALLERY_COPY.open}
        </a>
      </div>
    </article>
  );
}
