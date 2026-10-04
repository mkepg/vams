import HeroFigure from '../HeroFigure';

export default function HeroSection() {
  return (
    <section id="top" className="home__hero" data-slide="" aria-labelledby="home-title">
      <div className="home__copy">
        <p className="home__eyebrow">OpenGL 1.5 · 2D · in your browser</p>
        <h1 id="home-title" className="home__title">
          Every shape is a <em>program.</em>
        </h1>
        <p className="home__lede">
          Draw a triangle and VAMS writes the OpenGL that draws it, then shows the math underneath.
          No compiler, no setup: just the concept.
        </p>
        <p className="home__actions">
          <a className="home__cta" href="/app">Open the app</a>
        </p>
      </div>
      <HeroFigure />
    </section>
  );
}
