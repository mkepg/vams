import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { VIEWS } from '@/pages/home/model/content';
import {
  GRID_STEP,
  INITIAL_TRIANGLE,
  generateDemoCode,
  glToPixel,
  pixelToGl,
  replaceVertex,
  snapToGrid,
  type DemoTriangle,
  type DemoVertex,
} from '@/pages/home/model/demo-code';
import './vertex-demo.scss';

/** The drawing is VIEW × VIEW SVG units, framed by PAD units so handles at the edge stay whole. */
const VIEW = 300;
const PAD = 30;
const BOX = VIEW + PAD * 2;
const GRID_LINES = Array.from({ length: 21 }, (_, i) => -1 + i * 0.1);
const KEY_STEPS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
};

function formatPixel(n: number) {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function vertexLabel(index: number, v: DemoVertex) {
  return `Vertex ${index + 1} at x ${v.x.toFixed(2)}, y ${v.y.toFixed(2)}`;
}

/** Colour the leading function name the same way the hero figure does. */
function renderCodeLine(line: string) {
  const match = /^(\s*)([A-Za-z_][A-Za-z0-9_]*)(.*)$/.exec(line);
  if (!match) return line;
  return (
    <>
      {match[1]}
      <span className="tok-fn">{match[2]}</span>
      {match[3]}
    </>
  );
}

export default function VertexDemo() {
  const [vertices, setVertices] = useState<DemoTriangle>(INITIAL_TRIANGLE);
  const [selected, setSelected] = useState(2);
  const code = useMemo(() => generateDemoCode(vertices), [vertices]);

  const rootRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const leaderRef = useRef<SVGPathElement>(null);
  const handleRefs = useRef<(SVGGElement | null)[]>([]);
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const dragRef = useRef<number | null>(null);

  function eventToVertex(e: PointerEvent): DemoVertex | null {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!ctm) return null;
    // viewBox units equal drawing pixels, so the inverse screen matrix gives the drawing position directly.
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const gl = pixelToGl(point.x, point.y, VIEW, VIEW);
    return { x: snapToGrid(gl.x), y: snapToGrid(gl.y) };
  }

  function onHandlePointerDown(index: number, e: PointerEvent) {
    if (e.button !== 0 || !e.isPrimary) return;
    e.preventDefault();
    dragRef.current = index;
    setSelected(index);
    handleRefs.current[index]?.focus();
    svgRef.current?.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    const index = dragRef.current;
    if (index === null) return;
    const next = eventToVertex(e);
    if (!next) return;
    // Skip no-op updates so the generator does not re-run on every pointer event inside one grid cell.
    setVertices((prev) => (prev[index].x === next.x && prev[index].y === next.y ? prev : replaceVertex(prev, index, next)));
  }

  function endDrag(e: PointerEvent) {
    if (dragRef.current === null) return;
    dragRef.current = null;
    svgRef.current?.releasePointerCapture?.(e.pointerId);
  }

  function onHandleKeyDown(index: number, e: KeyboardEvent) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const step = KEY_STEPS[e.key];
    if (!step) return;
    e.preventDefault();
    const size = GRID_STEP * (e.shiftKey ? 4 : 1);
    setSelected(index);
    setVertices((prev) =>
      replaceVertex(prev, index, {
        x: snapToGrid(prev[index].x + step[0] * size),
        y: snapToGrid(prev[index].y + step[1] * size),
      }),
    );
  }

  // The leader runs from the selected vertex to its code line. It is drawn by writing the path
  // directly (no state), and it is left empty when the code sits below the drawing.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const path = leaderRef.current;
    if (!root || !path) return;
    const update = () => {
      const handle = handleRefs.current[selected]?.getBoundingClientRect();
      const line = lineRefs.current[code.vertexLineIndexes[selected]]?.getBoundingClientRect();
      const frame = root.getBoundingClientRect();
      if (!handle || !line || frame.width === 0) {
        path.setAttribute('d', '');
        return;
      }
      const x1 = handle.left + handle.width / 2 - frame.left;
      const y1 = handle.top + handle.height / 2 - frame.top;
      const x2 = line.left - frame.left - 8;
      const y2 = line.top + line.height / 2 - frame.top;
      if (x2 - x1 < 24) {
        path.setAttribute('d', '');
        return;
      }
      const bend = (x2 - x1) * 0.45;
      path.setAttribute('d', `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`);
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(root);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [selected, code]);

  const current = vertices[selected];
  const currentPx = glToPixel(current.x, current.y, VIEW, VIEW);
  const points = vertices
    .map((v) => {
      const p = glToPixel(v.x, v.y, VIEW, VIEW);
      return `${p.px},${p.py}`;
    })
    .join(' ');
  // Keep the coordinate tag inside the drawing: flip it right near the left edge, below near the top.
  const tagX = currentPx.px < 110 ? 12 : -104;
  const tagY = currentPx.py < 40 ? 14 : -34;

  return (
    <figure className="vertex-demo" ref={rootRef}>
      <div className="vertex-demo__grid">
        <div className="vertex-demo__part vertex-demo__part--canvas">
          <p className="vertex-demo__label">Canvas</p>
          <svg
            ref={svgRef}
            className="vertex-demo__svg"
            viewBox={`${-PAD} ${-PAD} ${BOX} ${BOX}`}
            role="group"
            aria-label="Triangle with three movable vertices"
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <g aria-hidden="true">
              {GRID_LINES.map((t, i) => {
                const p = glToPixel(t, t, VIEW, VIEW);
                return (
                  <g key={i} className={i % 5 === 0 ? 'vertex-demo__gridline vertex-demo__gridline--major' : 'vertex-demo__gridline'}>
                    <line x1={p.px} y1={0} x2={p.px} y2={VIEW} />
                    <line x1={0} y1={p.py} x2={VIEW} y2={p.py} />
                  </g>
                );
              })}
              <g className="vertex-demo__axis">
                <line x1={VIEW / 2} y1={0} x2={VIEW / 2} y2={VIEW} />
                <line x1={0} y1={VIEW / 2} x2={VIEW} y2={VIEW / 2} />
              </g>
              <g className="vertex-demo__ticks">
                {[-1, 0, 1].map((t) => {
                  const p = glToPixel(t, t, VIEW, VIEW);
                  return (
                    <g key={t}>
                      <text x={p.px} y={VIEW + 22} text-anchor="middle">{t}</text>
                      <text x={-9} y={p.py + 4} text-anchor="end">{t}</text>
                    </g>
                  );
                })}
                <text x={VIEW + 10} y={VIEW / 2 + 4}>x</text>
                <text x={VIEW / 2 + 9} y={-9}>y</text>
              </g>
              <polygon className="vertex-demo__fill" points={points} />
              <polygon className="vertex-demo__edge" points={points} />
            </g>
            {vertices.map((v, i) => {
              const p = glToPixel(v.x, v.y, VIEW, VIEW);
              return (
                <g
                  key={i}
                  ref={(el) => {
                    handleRefs.current[i] = el;
                  }}
                  className="vertex-demo__handle"
                  data-vertex-handle=""
                  transform={`translate(${p.px} ${p.py})`}
                  tabIndex={0}
                  role="button"
                  aria-label={vertexLabel(i, v)}
                  aria-describedby="vertex-demo-hint"
                  aria-current={i === selected ? 'true' : undefined}
                  onPointerDown={(e) => onHandlePointerDown(i, e)}
                  onKeyDown={(e) => onHandleKeyDown(i, e)}
                  onFocus={() => setSelected(i)}
                >
                  <circle className="vertex-demo__hit" r={16} />
                  <circle className="vertex-demo__focus" r={13} />
                  {i === selected && <circle className="vertex-demo__ring" r={10} />}
                  <circle className={`vertex-demo__dot vertex-demo__dot--${i}`} r={6} />
                  <text className="vertex-demo__number" x={15} y={4} aria-hidden="true">
                    {i + 1}
                  </text>
                </g>
              );
            })}
            <g className="vertex-demo__tag" transform={`translate(${currentPx.px} ${currentPx.py})`} aria-hidden="true">
              <rect x={tagX} y={tagY} width={92} height={20} />
              <text x={tagX + 46} y={tagY + 14} text-anchor="middle">
                ({current.x.toFixed(2)}, {current.y.toFixed(2)})
              </text>
            </g>
          </svg>
          <p id="vertex-demo-hint" className="vertex-demo__hint">
            Drag a vertex, or focus one and use the arrow keys. Hold Shift for bigger steps.
          </p>
        </div>

        <div className="vertex-demo__part vertex-demo__part--code">
          <p className="vertex-demo__label" id="vertex-demo-code-label">Code</p>
          <pre className="vertex-demo__code" role="region" tabIndex={0} aria-labelledby="vertex-demo-code-label">
            <code>
              {code.lines.map((line, i) => (
                <span
                  key={i}
                  ref={(el) => {
                    lineRefs.current[i] = el;
                  }}
                  className={
                    i === code.vertexLineIndexes[selected] ? 'vertex-demo__line vertex-demo__line--selected' : 'vertex-demo__line'
                  }
                >
                  {renderCodeLine(line)}
                </span>
              ))}
            </code>
          </pre>
        </div>

        <div className="vertex-demo__part vertex-demo__part--math">
          <p className="vertex-demo__label">Math</p>
          <dl className="vertex-demo__math">
            <div>
              <dt>Vertex</dt>
              <dd>{selected + 1} of 3</dd>
            </div>
            <div>
              <dt>Pixel</dt>
              <dd>
                ({formatPixel(currentPx.px)}, {formatPixel(currentPx.py)}) in a {VIEW} × {VIEW} view
              </dd>
            </div>
            <div>
              <dt>x</dt>
              <dd>
                2 · {formatPixel(currentPx.px)} / {VIEW} − 1 = <strong>{current.x.toFixed(2)}</strong>
              </dd>
            </div>
            <div>
              <dt>y</dt>
              <dd>
                1 − 2 · {formatPixel(currentPx.py)} / {VIEW} = <strong>{current.y.toFixed(2)}</strong>
              </dd>
            </div>
          </dl>
        </div>
      </div>
      <svg className="vertex-demo__leader" aria-hidden="true" focusable="false">
        <path ref={leaderRef} />
      </svg>
      <figcaption className="vertex-demo__caption">{VIEWS.caption}</figcaption>
    </figure>
  );
}
