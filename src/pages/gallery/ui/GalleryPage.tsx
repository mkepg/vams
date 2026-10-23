import SiteHeader from '@/widgets/site-header';
import SiteFooter from '@/widgets/site-footer';
import { GALLERY_SCENES } from '@/entities/project/model/gallery-links';
import { GALLERY_COPY } from '../model/copy';
import GalleryCard from './GalleryCard';
import './gallery.scss';

export default function GalleryPage() {
  const [lead, ...rest] = GALLERY_SCENES;
  return (
    <div className="site-page">
      <SiteHeader current="/gallery" />
      <main id="main" className="gallery">
        <div className="gallery__intro">
          <h1 className="gallery__title">{GALLERY_COPY.title}</h1>
          <p className="gallery__lede">{GALLERY_COPY.lede}</p>
        </div>
        <GalleryCard scene={lead} lead />
        <div className="gallery__grid">
          {rest.map((scene) => (
            <GalleryCard key={scene.slug} scene={scene} />
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
