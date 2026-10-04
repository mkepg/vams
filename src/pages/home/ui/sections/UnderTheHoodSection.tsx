import { UNDER_THE_HOOD } from '@/pages/home/model/content';
import SectionHeading from './SectionHeading';

export default function UnderTheHoodSection() {
  return (
    <section id="under-the-hood" className="home-section" data-slide="" aria-labelledby="under-the-hood-title">
      <SectionHeading id="under-the-hood" title={UNDER_THE_HOOD.title} />
      <dl className="hood-list">
        {UNDER_THE_HOOD.blocks.map((block) => (
          <div key={block.term}>
            <dt>{block.term}</dt>
            <dd>{block.text}</dd>
          </div>
        ))}
      </dl>
      <p className="hood-stack">{UNDER_THE_HOOD.stack.join(' · ')}</p>
    </section>
  );
}
