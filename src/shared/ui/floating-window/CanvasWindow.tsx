import './canvas-window.scss';
import type { ComponentChildren, JSX } from 'preact';
import { Copy, Minus, Square, X } from 'lucide-react';
import { PROGRAM_WINDOW_TITLE } from '@/shared/lib/program-window';
import type { ResizeEdge } from './resize-edge';

/**
 * What a movable window adds to the bar: its buttons, the drag surface and the resize handles.
 * Minimise and Maximise show only when there is something for them to do.
 */
export interface WindowControls {
  /** A maximised window has no resize handles. */
  maximised: boolean;
  onMinimise?: () => void;
  onMaximise?: () => void;
  onClose: () => void;
  barProps: JSX.HTMLAttributes<HTMLDivElement>;
  handleProps: (edge: ResizeEdge) => JSX.HTMLAttributes<HTMLDivElement>;
}

interface CanvasWindowProps {
  size: { width: number; height: number };
  /** The window's title; the generated program's by default. */
  title?: string;
  running: boolean;
  /** While running: the program's last callback, or how to stop it. */
  status?: string;
  children: ComponentChildren;
  /** Makes the window movable. Without it the window is a fixed, quiet frame. */
  controls?: WindowControls;
  className?: string;
  style?: JSX.CSSProperties;
}

const EDGES: ResizeEdge[] = ['e', 's', 'se'];

/** The program's window: a quiet title bar with what glutCreateWindow and glutInitWindowSize set. */
export default function CanvasWindow({ size, title = PROGRAM_WINDOW_TITLE, running, status, children, controls, className, style }: CanvasWindowProps) {
  const label = controls?.maximised ? 'Restore' : 'Maximise';
  return (
    <div className={`canvas-window${className ? ` ${className}` : ''}`} style={style}>
      <div className="canvas-window__frame">
        <div className="canvas-window__bar" {...controls?.barProps}>
          <span className="canvas-window__title">{title}</span>
          <span className="canvas-window__size">{`${size.width} × ${size.height}`}</span>
          {running && (
            <span className="canvas-window__running">
              <span className="canvas-window__dot" aria-hidden="true" />
              <span className="canvas-window__running-label">running</span>
            </span>
          )}
          {running && status && <span className="canvas-window__status">{status}</span>}
          <span className="canvas-window__spacer" />
          {controls && (
            <span className="canvas-window__buttons">
              {controls.onMinimise && (
                <button type="button" className="canvas-window__btn" aria-label="Minimise" title="Minimise" onClick={controls.onMinimise}>
                  <Minus size={14} aria-hidden="true" />
                </button>
              )}
              {controls.onMaximise && (
                <button type="button" className="canvas-window__btn" aria-label={label} title={label} onClick={controls.onMaximise}>
                  {controls.maximised ? <Copy size={12} aria-hidden="true" /> : <Square size={12} aria-hidden="true" />}
                </button>
              )}
              <button type="button" className="canvas-window__btn canvas-window__btn--close" aria-label="Close" title="Close" onClick={controls.onClose}>
                <X size={14} aria-hidden="true" />
              </button>
            </span>
          )}
        </div>
        <div className="canvas-window__body">{children}</div>
      </div>
      {controls && !controls.maximised &&
        EDGES.map((edge) => (
          <div key={edge} className={`canvas-window__handle canvas-window__handle--${edge}`} {...controls.handleProps(edge)} />
        ))}
    </div>
  );
}
