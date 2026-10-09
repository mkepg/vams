import './pedagogical-views.scss';

/**
 * Side-by-side visualization: a smooth vector triangle next to the same
 * shape rasterized into a coarse fragment grid. Purely illustrative — no
 * interactive controls — so it drops neatly into the pedagogical overlay.
 */
export default function RasterVectorView() {
  // Triangle corners (in SVG coords, 0..200 canvas)
  const tri = '40,160 160,140 110,40';

  // Pre-baked fragment grid approximation of the same triangle
  const frags: Array<[number, number, number]> = [
    // x, y, coverage (0..1)
    [100, 40, 0.45],
    [90, 60, 0.6], [100, 60, 0.95], [110, 60, 0.7],
    [80, 80, 0.55], [90, 80, 1], [100, 80, 1], [110, 80, 0.95], [120, 80, 0.55],
    [70, 100, 0.45], [80, 100, 0.95], [90, 100, 1], [100, 100, 1], [110, 100, 1], [120, 100, 0.9], [130, 100, 0.45],
    [60, 120, 0.4], [70, 120, 0.9], [80, 120, 1], [90, 120, 1], [100, 120, 1], [110, 120, 1], [120, 120, 1], [130, 120, 0.85], [140, 120, 0.4],
    [50, 140, 0.35], [60, 140, 0.85], [70, 140, 1], [80, 140, 1], [90, 140, 1], [100, 140, 1], [110, 140, 1], [120, 140, 1], [130, 140, 1], [140, 140, 0.8], [150, 140, 0.3],
  ];

  return (
    <div className="pedagogical-overlay raster-vector-view">
      <div className="split-view">
        <div className="view-pane vector-pane">
          <div className="pane-header">
            <h3>Vector</h3>
            <span className="pane-tag">math</span>
          </div>
          <p className="pane-caption">
            Made of math: a few points and lines. No matter how far you zoom in, the edges
            stay perfectly sharp.
          </p>
          <div className="visualization">
            <svg viewBox="0 0 200 200" className="rv-svg" aria-label="Vector triangle">
              <defs>
                <pattern id="rv-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" className="rv-grid-line" />
                </pattern>
              </defs>
              <rect width="200" height="200" fill="url(#rv-grid)" />
              <polygon points={tri} className="rv-tri" />
              <circle cx="40" cy="160" r="3" className="rv-vertex" />
              <circle cx="160" cy="140" r="3" className="rv-vertex" />
              <circle cx="110" cy="40" r="3" className="rv-vertex" />
              <text x="30" y="175" className="rv-label" fontSize={10.5}>(-0.6, -0.6)</text>
              <text x="196" y="158" textAnchor="end" className="rv-label" fontSize={10.5}>(0.6, -0.4)</text>
              <text x="80" y="32" className="rv-label" fontSize={10.5}>(0.1, 0.6)</text>
            </svg>
          </div>
        </div>

        <div className="divider" />

        <div className="view-pane raster-pane">
          <div className="pane-header">
            <h3>Raster</h3>
            <span className="pane-tag">pixels</span>
          </div>
          <p className="pane-caption">
            The same triangle, redrawn as a grid of tiny squares. Each square is a
            <em> fragment </em>— what your screen actually displays.
          </p>
          <div className="visualization">
            <svg viewBox="0 0 200 200" className="rv-svg" aria-label="Rasterized triangle">
              {/* grid */}
              {Array.from({ length: 11 }).map((_, i) => (
                <line key={`rx${i}`} x1={i * 20} y1={0} x2={i * 20} y2={200} className="rv-grid-line" />
              ))}
              {Array.from({ length: 11 }).map((_, i) => (
                <line key={`ry${i}`} x1={0} y1={i * 20} x2={200} y2={i * 20} className="rv-grid-line" />
              ))}
              {frags.map(([x, y, a], i) => (
                <rect
                  key={i}
                  x={x - 10}
                  y={y - 10}
                  width={20}
                  height={20}
                  className="rv-frag"
                  style={{ opacity: a }}
                />
              ))}
              <polygon points={tri} className="rv-tri ghost" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
