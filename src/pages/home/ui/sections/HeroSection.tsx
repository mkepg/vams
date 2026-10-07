import HeroFigure from '../HeroFigure';

export default function HeroSection() {
  return (
    <section id="top" className="home__hero" data-slide="" aria-labelledby="home-title">
      <div className="home__copy">
        <h1 id="home-title" className="home__title">
          Every shape is a <span className="home__accent">program.</span>
        </h1>
        <p className="home__lede">
          Draw a triangle and VAMS writes the OpenGL that draws it, then shows the math underneath.
          No compiler, no setup. Just the concept.
        </p>
        <p className="home__actions">
          <a className="home__cta" href="/app">Open the app</a>
        </p>
      </div>
      <HeroFigure />
    </section>
  );
}
