import SiteHeader from '@/widgets/site-header';
import SiteFooter from '@/widgets/site-footer';

export default function HomePage() {
  return (
    <div className="site-page">
      <SiteHeader />
      <main id="main" className="home">
        <section className="home__hero" aria-labelledby="home-title">
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
        </section>
        <section className="home__views" aria-labelledby="views-title">
          <h2 id="views-title" className="home__section-title">One scene, three views</h2>
          <ul className="home__view-list">
            <li><strong>Canvas</strong> The scene, drawn live as you build it.</li>
            <li><strong>Code</strong> The C++ OpenGL 1.5 program that produces it, always in sync.</li>
            <li><strong>Math</strong> Coordinates, colour conversion and the matrices behind every vertex.</li>
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
