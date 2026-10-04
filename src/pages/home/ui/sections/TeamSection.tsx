import { TEAM } from '@/pages/home/model/content';
import SectionHeading from './SectionHeading';

export default function TeamSection() {
  return (
    <section id="team" className="home-section" data-slide="" aria-labelledby="team-title">
      <SectionHeading id="team" title={`${TEAM.name}.`} subhead={TEAM.program} />
      <dl className="team-list">
        {TEAM.members.map((member) => (
          <div key={member.name}>
            <dt>{member.name}</dt>
            <dd>{member.credit}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
