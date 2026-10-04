import { VIEWS } from '@/pages/home/model/content';
import VertexDemo from '../VertexDemo';
import SectionHeading from './SectionHeading';

export default function ViewsSection() {
  return (
    <section id="views" className="home-section" data-slide="" aria-labelledby="views-title">
      <SectionHeading id="views" title={VIEWS.title} subhead={VIEWS.subhead} />
      <VertexDemo />
    </section>
  );
}
