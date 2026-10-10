import { useLocation } from 'preact-iso';
import { presetHref } from '@/entities/project/model/preset-links';
import SiteHeader from '@/widgets/site-header';
import SiteFooter from '@/widgets/site-footer';
import { PresentButton, StageIndicator, useStageMode } from '@/features/stage-mode';
import { SECTIONS } from '@/pages/home/model/content';
import HeroSection from './sections/HeroSection';
import ProblemSection from './sections/ProblemSection';
import ViewsSection from './sections/ViewsSection';
import CurriculumSection from './sections/CurriculumSection';
import UnderTheHoodSection from './sections/UnderTheHoodSection';
import TeamSection from './sections/TeamSection';
import TryItSection from './sections/TryItSection';
import './home.scss';
import './sections/sections.scss';
import './home-stage.scss';

const SECTION_IDS = SECTIONS.map((section) => section.id);

export default function HomePage() {
  const { route } = useLocation();
  const stage = useStageMode(SECTION_IDS, () => route(presetHref('triangle')));
  return (
    <div className="site-page">
      <SiteHeader current="/" />
      <main id="main" className="home">
        <HeroSection />
        <ProblemSection />
        <ViewsSection />
        <CurriculumSection />
        <UnderTheHoodSection />
        <TeamSection />
        <TryItSection />
      </main>
      {/* The button sits under the last slide, so it starts the talk from the first one. */}
      <SiteFooter actions={<PresentButton onPresent={() => stage.enter(0)} />} />
      <StageIndicator
        active={stage.active && stage.ready}
        index={stage.index}
        count={stage.count}
        label={SECTIONS[stage.index].label}
      />
    </div>
  );
}
