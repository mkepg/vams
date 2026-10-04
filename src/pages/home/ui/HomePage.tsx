import SiteHeader from '@/widgets/site-header';
import SiteFooter from '@/widgets/site-footer';
import HeroSection from './sections/HeroSection';
import ProblemSection from './sections/ProblemSection';
import ViewsSection from './sections/ViewsSection';
import CurriculumSection from './sections/CurriculumSection';
import UnderTheHoodSection from './sections/UnderTheHoodSection';
import TeamSection from './sections/TeamSection';
import TryItSection from './sections/TryItSection';
import './home.scss';
import './sections/sections.scss';

export default function HomePage() {
  return (
    <div className="site-page">
      <SiteHeader />
      <main id="main" className="home">
        <HeroSection />
        <ProblemSection />
        <ViewsSection />
        <CurriculumSection />
        <UnderTheHoodSection />
        <TeamSection />
        <TryItSection />
      </main>
      <SiteFooter />
    </div>
  );
}
