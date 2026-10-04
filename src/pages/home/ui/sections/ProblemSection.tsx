import { PROBLEM } from '@/pages/home/model/content';
import SectionHeading from './SectionHeading';

export default function ProblemSection() {
  return (
    <section id="problem" className="home-section" data-slide="" aria-labelledby="problem-title">
      <SectionHeading id="problem" title={PROBLEM.title} />
      <ol className="problem-list">
        {PROBLEM.points.map((point) => (
          <li key={point.term}>
            <strong>{point.term}</strong> {point.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
