/**
 * Decorative drawing for the home page: a triangle with labelled vertices, a dimension line and a
 * dashed leader from the selected apex to the glVertex2f call that places it. The figure caption is
 * the text alternative, so the drawing itself is hidden from assistive technology.
 *
 * Scene units: NDC x in [-0.5, 0.5] maps to 30..190, NDC y in [-0.5, 0.5] maps to 200..50,
 * so the origin sits at (110, 125).
 */
export default function HeroFigure() {
  return (
    <figure className="hero-figure">
      <div className="hero-figure__drawing" aria-hidden="true">
        <svg className="hero-figure__scene" viewBox="0 0 240 264" focusable="false">
          <g className="hero-figure__axis">
            <line x1="110" y1="20" x2="110" y2="212" />
            <line x1="6" y1="125" x2="214" y2="125" />
          </g>
          <polygon className="hero-figure__fill" points="30,200 190,200 110,50" />
          <polygon className="hero-figure__edge" points="30,200 190,200 110,50" />
          <circle className="hero-figure__vertex" cx="30" cy="200" r="4" />
          <circle className="hero-figure__vertex" cx="190" cy="200" r="4" />
          <rect className="hero-figure__handle" x="102" y="42" width="16" height="16" />
          <circle className="hero-figure__vertex hero-figure__vertex--selected" cx="110" cy="50" r="5" />
          <g className="hero-figure__dimension">
            <line x1="30" y1="240" x2="190" y2="240" />
            <line x1="30" y1="232" x2="30" y2="248" />
            <line x1="190" y1="232" x2="190" y2="248" />
          </g>
          <text className="hero-figure__label" x="110" y="260" text-anchor="middle">Δx = 1.00</text>
          <text className="hero-figure__label" x="4" y="220">(−0.5, −0.5)</text>
          <text className="hero-figure__label" x="236" y="220" text-anchor="end">(0.5, −0.5)</text>
          <rect className="hero-figure__tag" x="35" y="35" width="63" height="15" />
          <text className="hero-figure__label hero-figure__label--selected" x="66.5" y="46" text-anchor="middle">(0.0, 0.5)</text>
          <path className="hero-figure__leader" d="M119,50 C170,40 196,152 240,154" />
          <circle className="hero-figure__leader-end" cx="240" cy="154" r="2.5" />
        </svg>
        <pre className="hero-figure__code"><code>
          <span className="tok-fn">glBegin</span>(GL_TRIANGLES);{'\n'}
          {'  '}glVertex2f(-0.5f, -0.5f);{'\n'}
          {'  '}glVertex2f( 0.5f, -0.5f);{'\n'}
          <span className="hero-figure__hl">{'  '}glVertex2f( 0.0f,  0.5f);</span>{'\n'}
          <span className="tok-fn">glEnd</span>();
        </code></pre>
      </div>
      <figcaption className="hero-figure__caption">
        Fig. 1 — A triangle in VAMS and the OpenGL calls that draw it. The selected vertex and its line of code stay linked.
      </figcaption>
    </figure>
  );
}
